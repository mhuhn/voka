-- Versioned RPCs: both directions have independent due positions, scores,
-- history and grading. The original RPC signatures remain for installed PWAs.
create or replace function app_private.voka_prepare_directional_learning_list(
  p_list_id uuid,p_timezone text
) returns jsonb
language plpgsql security invoker volatile set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_list record;
 v_min integer;
 v_day_until timestamptz;
 v_cards jsonb;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
   raise exception 'Invalid learning timezone' using errcode='22023';
 end if;
 select l.* into v_list from public.voka_lists l
  where l.id=p_list_id and l.user_id=v_uid for update;
 if not found then raise exception 'List not found' using errcode='P0002'; end if;

 select min(x.pos)::integer into v_min from (
    select c.position as pos from public.voka_cards c
     where c.list_id=p_list_id and c.user_id=v_uid and c.success_count<4
    union all
    select c.reverse_position as pos from public.voka_cards c
     where c.list_id=p_list_id and c.user_id=v_uid
       and v_list.reverse_share>0
       and c.reverse_success_count<v_list.reverse_share/25
 ) x;

 if v_min is null then
   return pg_catalog.jsonb_build_object('all_learned',true,'cards','[]'::jsonb);
 end if;

 if v_list.last_learning_at is not null then
   v_day_until:=(
      ((v_list.last_learning_at at time zone v_list.learning_timezone)::date+v_min)::timestamp
       at time zone v_list.learning_timezone);
 end if;
 if (v_list.learning_paused_until is not null and v_list.learning_paused_until>now())
    or (v_day_until is not null and v_day_until>now()) then
   return pg_catalog.jsonb_build_object(
     'paused_until',v_list.learning_paused_until,
     'calendar_pause_until',v_day_until,'cards','[]'::jsonb);
 end if;

 -- Fast-forward both independent schedules by the earliest outstanding stage.
 if v_min>0 then
   update public.voka_cards
      set position=greatest(position-v_min,0),
          reverse_position=greatest(reverse_position-v_min,0)
    where list_id=p_list_id and user_id=v_uid;
 end if;

 -- Both orientations of the same card may be queued once in a query.
 -- Always ask normal questions before reverse questions at this stage.
 select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id',r.id,'reverse',r.is_reverse)
        order by r.is_reverse,r.random_order
       ),'[]'::jsonb)
   into v_cards
   from (
     select c.id,false as is_reverse,pg_catalog.random() as random_order
       from public.voka_cards c
      where c.list_id=p_list_id and c.user_id=v_uid
        and c.success_count<4 and c.position=0
     union all
     select c.id,true as is_reverse,pg_catalog.random() as random_order
       from public.voka_cards c
      where c.list_id=p_list_id and c.user_id=v_uid
        and v_list.reverse_share>0
        and c.reverse_success_count<v_list.reverse_share/25 and c.reverse_position=0
   ) r;

 if pg_catalog.jsonb_array_length(v_cards)=0 then
   raise exception 'No due cards after normalization' using errcode='P0002';
 end if;
 update public.voka_lists
    set last_learning_at=now(),learning_timezone=p_timezone
  where id=p_list_id and user_id=v_uid;

 return pg_catalog.jsonb_build_object('cards',v_cards);
end $$;
revoke all on function app_private.voka_prepare_directional_learning_list(uuid,text) from public,anon;
grant execute on function app_private.voka_prepare_directional_learning_list(uuid,text) to authenticated;

create or replace function public.voka_begin_learning_v2(
  p_list_id uuid,p_timezone text
) returns jsonb
language plpgsql security invoker volatile set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_prepared jsonb;
 v_entries jsonb;
 v_query uuid;
begin
 v_prepared:=app_private.voka_prepare_directional_learning_list(p_list_id,p_timezone);
 v_entries:=v_prepared->'cards';
 if pg_catalog.jsonb_array_length(v_entries)=0 then return v_prepared; end if;
 insert into public.voka_queries(user_id) values(v_uid) returning id into v_query;
 insert into public.voka_query_cards(query_id,card_id,user_id,reverse)
   select v_query,x.id,v_uid,x.reverse from pg_catalog.jsonb_to_recordset(v_entries)
   as x(id uuid,reverse boolean);
 return pg_catalog.jsonb_build_object('query_id',v_query,'cards',v_entries);
end $$;
revoke all on function public.voka_begin_learning_v2(uuid,text) from public,anon;
grant execute on function public.voka_begin_learning_v2(uuid,text) to authenticated;

create or replace function public.voka_preview_mixed_learning_v2(
 p_subject_ids uuid[],p_tags text[]
) returns jsonb
language plpgsql security invoker stable set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_result jsonb;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 if p_subject_ids is null or p_tags is null
    or coalesce(pg_catalog.array_length(p_subject_ids,1),0)>100
    or coalesce(pg_catalog.array_length(p_tags,1),0)>100
    or pg_catalog.array_position(p_subject_ids,null::uuid) is not null
    or pg_catalog.array_position(p_tags,null::text) is not null then
   raise exception 'Invalid selection' using errcode='22023';
 end if;

 with matching as (
 select l.id as list_id,l.subject_id,
       due.due_count
   from public.voka_lists l
   join public.voka_subjects s on s.id=l.subject_id and s.user_id=v_uid
   join public.voka_list_learning_state state on state.list_id=l.id
   cross join lateral (
      select count(*)::integer as due_count from (
        select 1 from public.voka_cards c
          where c.list_id=l.id and c.user_id=v_uid and c.success_count<4
            and c.position=state.min_position
        union all
        select 1 from public.voka_cards c
          where c.list_id=l.id and c.user_id=v_uid and l.reverse_share>0
            and c.reverse_success_count<l.reverse_share/25
            and c.reverse_position=state.min_position
      ) entries
   ) due
  where l.user_id=v_uid and l.subject_id=any(p_subject_ids)
    and l.tags @> p_tags and state.min_position is not null
    and (l.learning_paused_until is null or l.learning_paused_until<=now())
    and (state.calendar_pause_until is null or state.calendar_pause_until<=now())
 )
 select pg_catalog.jsonb_build_object(
    'total',coalesce(sum(due_count),0),
    'lists',coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('list_id',list_id,'subject_id',subject_id,'count',due_count)
    ),'[]'::jsonb)
 ) into v_result from matching;
 return v_result;
end $$;
revoke all on function public.voka_preview_mixed_learning_v2(uuid[],text[]) from public,anon;
grant execute on function public.voka_preview_mixed_learning_v2(uuid[],text[]) to authenticated;

create or replace function public.voka_begin_mixed_learning_v2(
 p_subject_ids uuid[],p_tags text[],p_timezone text
) returns jsonb
language plpgsql security invoker volatile set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_list record;
 v_prepared jsonb;
 v_cards jsonb:='[]'::jsonb;
 v_query uuid;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 if p_subject_ids is null or p_tags is null
    or coalesce(pg_catalog.array_length(p_subject_ids,1),0)>100
    or coalesce(pg_catalog.array_length(p_tags,1),0)>100
    or pg_catalog.array_position(p_subject_ids,null::uuid) is not null
    or pg_catalog.array_position(p_tags,null::text) is not null then
   raise exception 'Invalid selection' using errcode='22023';
 end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
   raise exception 'Invalid learning timezone' using errcode='22023';
 end if;
 -- Deterministic list ordering, with normal cards before reverse at each list.
 for v_list in
   select l.id from public.voka_lists l
   join public.voka_subjects s on s.id=l.subject_id and s.user_id=v_uid
   where l.user_id=v_uid and l.subject_id=any(p_subject_ids) and l.tags @> p_tags
   order by s.title,s.id,l.title,l.id
 loop
   v_prepared:=app_private.voka_prepare_directional_learning_list(v_list.id,p_timezone);
   if pg_catalog.jsonb_array_length(v_prepared->'cards')>0 then
     v_cards:=v_cards||(v_prepared->'cards');
   end if;
 end loop;
 if pg_catalog.jsonb_array_length(v_cards)=0 then
   return pg_catalog.jsonb_build_object('cards',v_cards);
 end if;
 insert into public.voka_queries(user_id) values(v_uid) returning id into v_query;
 insert into public.voka_query_cards(query_id,card_id,user_id,reverse)
   select v_query,x.id,v_uid,x.reverse
     from pg_catalog.jsonb_to_recordset(v_cards) as x(id uuid,reverse boolean);
 return pg_catalog.jsonb_build_object('query_id',v_query,'cards',v_cards);
end $$;
revoke all on function public.voka_begin_mixed_learning_v2(uuid[],text[],text) from public,anon;
grant execute on function public.voka_begin_mixed_learning_v2(uuid[],text[],text) to authenticated;

-- Single- and mixed-list learning use the same grader. A list pauses when
-- its last due orientation is done; the query closes after all entries done.
create or replace function app_private.voka_grade_direction_impl(
 p_query_id uuid,p_card_id uuid,p_reverse boolean,p_result text
) returns jsonb
language plpgsql security invoker volatile set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_list_id uuid;
 v_share smallint;
 v_paused_until timestamptz;
 v_points smallint;
 v_position smallint;
 v_pending integer;
 v_due integer;
 v_finished boolean:=false;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 if p_result is null or p_result not in ('known','unknown','unsure')
    or p_reverse is null then
   raise exception 'Invalid learning grade' using errcode='22023';
 end if;

 select c.list_id into v_list_id from public.voka_query_cards qc
   join public.voka_cards c on c.id=qc.card_id and c.user_id=qc.user_id
  where qc.query_id=p_query_id and qc.card_id=p_card_id
    and qc.reverse=p_reverse and qc.user_id=v_uid;
 if v_list_id is null then
   raise exception 'Card orientation not in this query' using errcode='42501';
 end if;
 select l.reverse_share,l.learning_paused_until
   into v_share,v_paused_until
   from public.voka_lists l where l.id=v_list_id and l.user_id=v_uid for update;
 if not found or (v_paused_until is not null and v_paused_until>now()) then
   raise exception 'List paused or unavailable' using errcode='42501';
 end if;
 perform 1 from public.voka_queries q where q.id=p_query_id
   and q.user_id=v_uid and q.finished_at is null for update;
 if not found then
   raise exception 'Learning query already finished' using errcode='42501';
 end if;
 perform 1 from public.voka_query_cards qc where qc.query_id=p_query_id
    and qc.card_id=p_card_id and qc.reverse=p_reverse and qc.user_id=v_uid
    and qc.result is null for update;
 if not found then
   raise exception 'Card orientation already graded' using errcode='42501';
 end if;

 if p_reverse then
   if v_share=0 then
     raise exception 'Reverse learning is disabled' using errcode='42501';
   end if;
   update public.voka_cards c
     set reverse_success_count=case when p_result='unknown' then 0
                                    when p_result='known' then least(c.reverse_success_count+1,v_share/25)
                                    else c.reverse_success_count end,
         reverse_position=case
           when p_result in ('unknown','unsure') then 1
           when c.reverse_success_count=0 then case v_share when 25 then 10 when 50 then 4 when 75 then 4 else 1 end
           when c.reverse_success_count=1 then case v_share when 50 then 13 when 75 then 12 else 4 end
           when c.reverse_success_count=2 then case v_share when 75 then 24 else 10 end
           else 24 end
   where c.id=p_card_id and c.list_id=v_list_id and c.user_id=v_uid
     and c.reverse_position=0 and c.reverse_success_count<v_share/25
   returning c.reverse_success_count,c.reverse_position into v_points,v_position;
 else
   update public.voka_cards c
      set success_count=case when p_result='unknown' then 0
                             when p_result='known' then least(c.success_count+1,4)
                             else c.success_count end,
          position=case when p_result in ('unknown','unsure') then 1
                        when c.success_count=0 then 2
                        when c.success_count=1 then 6 else 19 end
    where c.id=p_card_id and c.list_id=v_list_id and c.user_id=v_uid
      and c.position=0 and c.success_count<4
    returning c.success_count,c.position into v_points,v_position;
 end if;
 if not found then
   raise exception 'Card orientation is not due' using errcode='42501';
 end if;

 update public.voka_query_cards qc
    set result=p_result,answered_at=now()
  where qc.query_id=p_query_id and qc.card_id=p_card_id and qc.reverse=p_reverse
    and qc.user_id=v_uid;

 select count(*) into v_due from (
   select 1 from public.voka_cards c
    where c.list_id=v_list_id and c.user_id=v_uid
      and c.success_count<4 and c.position=0
   union all
   select 1 from public.voka_cards c
    where c.list_id=v_list_id and c.user_id=v_uid and v_share>0
      and c.reverse_success_count<v_share/25 and c.reverse_position=0
 ) remaining;
 if v_due=0 then
   update public.voka_cards c
      set position=greatest(c.position-1,0),
          reverse_position=greatest(c.reverse_position-1,0)
    where c.list_id=v_list_id and c.user_id=v_uid;
   v_paused_until:=now()+interval '2 hours';
   update public.voka_lists l set learning_paused_until=v_paused_until
     where l.id=v_list_id and l.user_id=v_uid;
 else v_paused_until:=null;
 end if;

 select count(*) into v_pending from public.voka_query_cards qc
  where qc.query_id=p_query_id and qc.user_id=v_uid and qc.result is null;
 if v_pending=0 then
   update public.voka_queries set finished_at=now()
    where id=p_query_id and user_id=v_uid;
   v_finished:=true;
 end if;

 return pg_catalog.jsonb_build_object(
    'success_count',v_points,'position',v_position,
    'reverse',p_reverse,'finished',v_finished,'paused_until',v_paused_until);
end $$;
revoke all on function app_private.voka_grade_direction_impl(uuid,uuid,boolean,text) from public,anon;
grant execute on function app_private.voka_grade_direction_impl(uuid,uuid,boolean,text) to authenticated;

create or replace function public.voka_grade_learning_v2(
 p_query_id uuid,p_card_id uuid,p_reverse boolean,p_result text
) returns jsonb language sql security invoker volatile set search_path=''
as $$ select app_private.voka_grade_direction_impl(p_query_id,p_card_id,p_reverse,p_result) $$;
create or replace function public.voka_grade_mixed_learning_v2(
 p_query_id uuid,p_card_id uuid,p_reverse boolean,p_result text
) returns jsonb language sql security invoker volatile set search_path=''
as $$ select app_private.voka_grade_direction_impl(p_query_id,p_card_id,p_reverse,p_result) $$;
revoke all on function public.voka_grade_learning_v2(uuid,uuid,boolean,text) from public,anon;
revoke all on function public.voka_grade_mixed_learning_v2(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.voka_grade_learning_v2(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.voka_grade_mixed_learning_v2(uuid,uuid,boolean,text) to authenticated;
