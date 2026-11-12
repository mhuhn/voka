-- Cross-subject learning is one query containing full, due-card batches from
-- multiple owned lists. List locks, due selection and per-list pauses remain atomic.
-- These invoker RPCs use existing user-scoped table RLS and Voka app approval.

create or replace function public.voka_preview_mixed_learning(
  p_subject_ids uuid[], p_tags text[]
) returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
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
           due.min_position,
           due.due_count
      from public.voka_lists l
      join public.voka_subjects s on s.id=l.subject_id and s.user_id=v_uid
      cross join lateral (
        select min(c.position) as min_position
          from public.voka_cards c
         where c.user_id=v_uid and c.list_id=l.id and c.success_count<4
      ) least_due
      cross join lateral (
        select least_due.min_position,
               count(*)::integer as due_count
          from public.voka_cards c
         where c.user_id=v_uid and c.list_id=l.id
           and c.success_count<4 and c.position=least_due.min_position
      ) due
     where l.user_id=v_uid
       and l.subject_id=any(p_subject_ids)
       and l.tags @> p_tags
       and due.min_position is not null
       and (l.learning_paused_until is null or l.learning_paused_until<=now())
       and (l.last_learning_at is null or (
           ((l.last_learning_at at time zone l.learning_timezone)::date + due.min_position)::timestamp
           at time zone l.learning_timezone
       )<=now())
  )
  select pg_catalog.jsonb_build_object(
    'total',coalesce(sum(due_count),0),
    'lists',coalesce(pg_catalog.jsonb_agg(
       pg_catalog.jsonb_build_object('list_id',list_id,'subject_id',subject_id,'count',due_count)
    ),'[]'::jsonb)
  ) into v_result from matching;
  return v_result;
end;
$$;

create or replace function public.voka_begin_mixed_learning(
  p_subject_ids uuid[], p_tags text[], p_timezone text
) returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_list record;
  v_min_position integer;
  v_calendar_until timestamptz;
  v_card_ids uuid[];
  v_ids uuid[] := array[]::uuid[];
  v_list_ids uuid[] := array[]::uuid[];
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
  if p_timezone is null or not exists(
    select 1 from pg_catalog.pg_timezone_names where name=p_timezone
  ) then
    raise exception 'Invalid learning timezone' using errcode='22023';
  end if;

  -- Deterministic lock order prevents overlapping mixed sessions deadlocking.
  -- Subject and list order also determines the order of returned card IDs.
  for v_list in
    select l.id,l.last_learning_at,l.learning_timezone,
           l.learning_paused_until
      from public.voka_lists l
      join public.voka_subjects s on s.id=l.subject_id and s.user_id=v_uid
     where l.user_id=v_uid and l.subject_id=any(p_subject_ids)
       and l.tags @> p_tags
     order by s.title,s.id,l.title,l.id
     for update of l
  loop
    select min(c.position) into v_min_position
      from public.voka_cards c
     where c.list_id=v_list.id and c.user_id=v_uid and c.success_count<4;
    if v_min_position is null then continue; end if;

    v_calendar_until:=null;
    if v_list.last_learning_at is not null then
      v_calendar_until:=(
        ((v_list.last_learning_at at time zone v_list.learning_timezone)::date
           + v_min_position)::timestamp at time zone v_list.learning_timezone
      );
    end if;
    if (v_list.learning_paused_until is not null
        and v_list.learning_paused_until>now())
       or (v_calendar_until is not null and v_calendar_until>now()) then
      continue;
    end if;

    if v_min_position>0 then
      update public.voka_cards
         set position=greatest(position-v_min_position,0)
       where list_id=v_list.id and user_id=v_uid;
    end if;

    select pg_catalog.array_agg(c.id order by pg_catalog.random())
      into v_card_ids
      from public.voka_cards c
     where c.list_id=v_list.id and c.user_id=v_uid
       and c.success_count<4 and c.position=0;
    if coalesce(pg_catalog.array_length(v_card_ids,1),0)>0 then
      v_ids:=v_ids||v_card_ids;
      v_list_ids:=pg_catalog.array_append(v_list_ids,v_list.id);
    end if;
  end loop;

  if coalesce(pg_catalog.array_length(v_ids,1),0)=0 then
    return pg_catalog.jsonb_build_object('card_ids','[]'::jsonb);
  end if;

  insert into public.voka_queries(user_id)
    values(v_uid) returning id into v_query;

  insert into public.voka_query_cards(query_id,card_id,user_id)
    select v_query,pg_catalog.unnest(v_ids),v_uid;

  update public.voka_lists
     set last_learning_at=now(),learning_timezone=p_timezone
   where user_id=v_uid and id=any(v_list_ids);

  return pg_catalog.jsonb_build_object(
    'query_id',v_query,'card_ids',pg_catalog.to_jsonb(v_ids)
  );
end;
$$;

create or replace function public.voka_grade_mixed_learning(
  p_query_id uuid,p_card_id uuid,p_result text
) returns jsonb
language plpgsql volatile security invoker
set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_list_id uuid;
 v_pause timestamptz;
 v_score smallint;
 v_position smallint;
 v_due_count integer;
 v_pending_count integer;
 v_finished boolean:=false;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 if p_result is null or p_result not in ('known','unknown','unsure') then
   raise exception 'Invalid grade' using errcode='22023';
 end if;
 select c.list_id into v_list_id
   from public.voka_query_cards qc
   join public.voka_cards c on c.id=qc.card_id and c.user_id=qc.user_id
  where qc.query_id=p_query_id and qc.card_id=p_card_id and qc.user_id=v_uid;
 if v_list_id is null then
   raise exception 'Card is not in this query' using errcode='42501';
 end if;

 select l.learning_paused_until into v_pause
   from public.voka_lists l
  where l.id=v_list_id and l.user_id=v_uid for update;
 if not found or (v_pause is not null and v_pause>now()) then
   raise exception 'List is paused or unavailable' using errcode='42501';
 end if;
 perform 1 from public.voka_queries q
  where q.id=p_query_id and q.user_id=v_uid and q.finished_at is null
  for update;
 if not found then
   raise exception 'Query already finished' using errcode='42501';
 end if;
 perform 1 from public.voka_query_cards qc
  where qc.query_id=p_query_id and qc.card_id=p_card_id
    and qc.user_id=v_uid and qc.result is null
  for update;
 if not found then
   raise exception 'Card already graded' using errcode='42501';
 end if;

 update public.voka_cards c
    set success_count=case when p_result='unknown' then 0
                           when p_result='known' then least(c.success_count+1,4)
                           else c.success_count end,
        position=case when p_result in ('unknown','unsure') then 1
                      when c.success_count=0 then 2
                      when c.success_count=1 then 6 else 19 end
  where c.id=p_card_id and c.list_id=v_list_id and c.user_id=v_uid
    and c.position=0 and c.success_count<4
  returning c.success_count,c.position into v_score,v_position;
 if not found then
   raise exception 'Card not due' using errcode='42501';
 end if;

 update public.voka_query_cards
    set result=p_result,answered_at=now()
  where query_id=p_query_id and card_id=p_card_id and user_id=v_uid;

 select count(*) into v_due_count from public.voka_cards c
  where c.list_id=v_list_id and c.user_id=v_uid and c.success_count<4 and c.position=0;
 if v_due_count=0 then
   update public.voka_cards
      set position=greatest(position-1,0)
    where list_id=v_list_id and user_id=v_uid;
   v_pause:=now()+interval '2 hours';
   update public.voka_lists set learning_paused_until=v_pause
    where id=v_list_id and user_id=v_uid;
 else
   v_pause:=null;
 end if;

 select count(*) into v_pending_count from public.voka_query_cards
  where query_id=p_query_id and user_id=v_uid and result is null;
 if v_pending_count=0 then
   update public.voka_queries set finished_at=now()
    where id=p_query_id and user_id=v_uid;
   v_finished:=true;
 end if;

 return pg_catalog.jsonb_build_object(
   'success_count',v_score,'position',v_position,
   'finished',v_finished,'paused_until',v_pause
 );
end;
$$;

revoke all on function public.voka_preview_mixed_learning(uuid[],text[]) from public,anon;
revoke all on function public.voka_begin_mixed_learning(uuid[],text[],text) from public,anon;
revoke all on function public.voka_grade_mixed_learning(uuid,uuid,text) from public,anon;
grant execute on function public.voka_preview_mixed_learning(uuid[],text[]) to authenticated;
grant execute on function public.voka_begin_mixed_learning(uuid[],text[],text) to authenticated;
grant execute on function public.voka_grade_mixed_learning(uuid,uuid,text) to authenticated;
