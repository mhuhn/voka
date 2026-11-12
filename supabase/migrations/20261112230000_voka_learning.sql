-- Learning sessions: scores 0..4, spaced card positions and two-hour list pause.
-- Security: all RPCs use SECURITY INVOKER and existing owner-only RLS policies.

alter table public.voka_cards
  drop constraint if exists voka_cards_success_count_check;
alter table public.voka_cards
  add constraint voka_cards_success_count_check
  check (success_count between 0 and 4);

alter table public.voka_lists
  add column if not exists learning_paused_until timestamptz;

create or replace function public.voka_begin_learning(p_list_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_until timestamptz;
  v_ids uuid[];
  v_query uuid;
  v_eligible integer;
begin
  if v_uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;

  -- Serializes new sessions and card grading for the same list.
  select l.learning_paused_until into v_until
    from public.voka_lists l
   where l.id=p_list_id and l.user_id=v_uid
   for update;
  if not found then
    raise exception 'List not found' using errcode='P0002';
  end if;

  if v_until is not null and v_until > now() then
    return pg_catalog.jsonb_build_object('paused_until',v_until,'card_ids','[]'::jsonb);
  end if;

  select pg_catalog.count(*) into v_eligible from public.voka_cards c
   where c.user_id=v_uid and c.list_id=p_list_id and c.success_count < 4;
  if v_eligible=0 then
    return pg_catalog.jsonb_build_object('all_learned',true,'card_ids','[]'::jsonb);
  end if;

  select pg_catalog.array_agg(c.id order by pg_catalog.random())
    into v_ids from public.voka_cards c
   where c.user_id=v_uid and c.list_id=p_list_id
     and c.success_count < 4 and c.position=0;

  if pg_catalog.coalesce(pg_catalog.array_length(v_ids,1),0)=0 then
    -- No currently due cards: advance the entire list by one position,
    -- but only once per two-hour period.
    update public.voka_cards
       set position=pg_catalog.greatest(position-1,0)
     where user_id=v_uid and list_id=p_list_id;
    v_until := now()+interval '2 hours';
    update public.voka_lists set learning_paused_until=v_until
     where id=p_list_id and user_id=v_uid;
    return pg_catalog.jsonb_build_object('paused_until',v_until,'card_ids','[]'::jsonb);
  end if;

  insert into public.voka_queries(user_id) values(v_uid) returning id into v_query;
  insert into public.voka_query_cards(query_id,card_id,user_id)
    select v_query,pg_catalog.unnest(v_ids),v_uid;

  return pg_catalog.jsonb_build_object(
    'query_id',v_query,'card_ids',pg_catalog.to_jsonb(v_ids)
  );
end
$$;

create or replace function public.voka_grade_learning(
  p_query_id uuid,
  p_card_id uuid,
  p_result text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_list uuid;
  v_until timestamptz;
  v_points smallint;
  v_position smallint;
  v_finished boolean := false;
  v_due integer;
begin
  if v_uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  if p_result is null or p_result not in ('unknown','unsure','known') then
    raise exception 'Invalid learning result' using errcode='22023';
  end if;

  select c.list_id into v_list
    from public.voka_query_cards qc
    join public.voka_cards c on c.id=qc.card_id and c.user_id=qc.user_id
   where qc.query_id=p_query_id and qc.card_id=p_card_id and qc.user_id=v_uid;
  if v_list is null then
    raise exception 'Card is not in this session' using errcode='42501';
  end if;

  select l.learning_paused_until into v_until
    from public.voka_lists l
   where l.id=v_list and l.user_id=v_uid
   for update;
  if not found or (v_until is not null and v_until>now()) then
    raise exception 'List is paused or unavailable' using errcode='42501';
  end if;

  perform 1 from public.voka_queries q
    where q.id=p_query_id and q.user_id=v_uid and q.finished_at is null
    for update;
  if not found then
    raise exception 'Learning session already finished' using errcode='42501';
  end if;

  perform 1 from public.voka_query_cards qc
    where qc.query_id=p_query_id and qc.card_id=p_card_id
      and qc.user_id=v_uid and qc.result is null
    for update;
  if not found then
    raise exception 'Card already graded' using errcode='42501';
  end if;

  update public.voka_cards c
     set success_count=case
          when p_result='unknown' then 0
          when p_result='known' then pg_catalog.least(c.success_count+1,4)
          else c.success_count end,
         position=case
          when p_result in ('unknown','unsure') then 1
          when c.success_count=0 then 2
          when c.success_count=1 then 6
          else 19 end
   where c.id=p_card_id and c.list_id=v_list and c.user_id=v_uid
     and c.position=0 and c.success_count < 4
   returning c.success_count,c.position into v_points,v_position;
  if not found then
    raise exception 'Card is not due for learning' using errcode='42501';
  end if;

  update public.voka_query_cards
    set result=p_result,answered_at=now()
   where query_id=p_query_id and card_id=p_card_id and user_id=v_uid;

  select pg_catalog.count(*) into v_due from public.voka_cards c
   where c.user_id=v_uid and c.list_id=v_list
     and c.success_count < 4 and c.position=0;
  if v_due=0 then
    -- All cards with position zero have been assessed; close the round.
    update public.voka_cards
      set position=pg_catalog.greatest(position-1,0)
      where user_id=v_uid and list_id=v_list;
    v_until:=now()+interval '2 hours';
    update public.voka_lists set learning_paused_until=v_until
      where id=v_list and user_id=v_uid;
    update public.voka_queries set finished_at=now()
      where id=p_query_id and user_id=v_uid;
    v_finished:=true;
  else
    v_until:=null;
  end if;

  return pg_catalog.jsonb_build_object(
     'success_count',v_points,'position',v_position,
     'finished',v_finished,'paused_until',v_until
  );
end
$$;

create or replace function public.voka_finish_learning(p_query_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  update public.voka_queries set finished_at=now()
   where id=p_query_id and user_id=v_uid and finished_at is null;
end
$$;

revoke all on function public.voka_begin_learning(uuid) from public,anon;
revoke all on function public.voka_grade_learning(uuid,uuid,text) from public,anon;
revoke all on function public.voka_finish_learning(uuid) from public,anon;
grant execute on function public.voka_begin_learning(uuid) to authenticated;
grant execute on function public.voka_grade_learning(uuid,uuid,text) to authenticated;
grant execute on function public.voka_finish_learning(uuid) to authenticated;
