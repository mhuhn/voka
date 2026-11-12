-- Calendar-based spacing for Voka learning. Existing two-hour cooldown remains.
-- Days are counted from local midnight in the timezone of the preceding session.
-- Uses owner RLS and security-invoker functions throughout.

alter table public.voka_lists
  add column if not exists last_learning_at timestamptz,
  add column if not exists learning_timezone text not null default 'Europe/Berlin';

-- Preserve the history of lists already studied before this feature.
with latest_sessions as (
  select c.list_id, max(q.started_at) as last_started
    from public.voka_query_cards qc
    join public.voka_queries q on q.id = qc.query_id and q.user_id = qc.user_id
    join public.voka_cards c on c.id = qc.card_id and c.user_id = qc.user_id
   group by c.list_id
)
update public.voka_lists l
   set last_learning_at = latest.last_started
  from latest_sessions latest
 where latest.list_id = l.id
   and (l.last_learning_at is null or l.last_learning_at < latest.last_started);

-- A security-invoker view keeps client eligibility in sync with server rules.
-- Fully learned cards do not block remaining unlearned cards at position zero.
create or replace view public.voka_list_learning_state
  with (security_invoker = true)
as
select l.id as list_id,
       due.min_position,
       case when l.last_learning_at is null or due.min_position is null then null::timestamptz
            else (
              ((l.last_learning_at at time zone l.learning_timezone)::date + due.min_position)::timestamp
              at time zone l.learning_timezone
            )
       end as calendar_pause_until
  from public.voka_lists l
  left join lateral (
    select min(c.position)::integer as min_position
      from public.voka_cards c
     where c.list_id = l.id and c.user_id = l.user_id and c.success_count < 4
  ) due on true;

grant select on public.voka_list_learning_state to authenticated;

create or replace function public.voka_begin_learning(p_list_id uuid, p_timezone text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_two_hour_until timestamptz;
  v_last_learning_at timestamptz;
  v_last_timezone text;
  v_day_until timestamptz;
  v_min_position integer;
  v_ids uuid[];
  v_query uuid;
begin
  if v_uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode = '42501';
  end if;

  if p_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid learning timezone' using errcode = '22023';
  end if;

  -- Both grade_learning and begin_learning lock the list row.
  select l.learning_paused_until, l.last_learning_at, l.learning_timezone
    into v_two_hour_until, v_last_learning_at, v_last_timezone
    from public.voka_lists l
   where l.id = p_list_id and l.user_id = v_uid
   for update;
  if not found then
    raise exception 'List not found' using errcode = 'P0002';
  end if;

  select min(c.position)::integer into v_min_position
    from public.voka_cards c
   where c.list_id = p_list_id and c.user_id = v_uid and c.success_count < 4;

  if v_min_position is null then
    return pg_catalog.jsonb_build_object('all_learned',true,'card_ids','[]'::jsonb);
  end if;

  if v_last_learning_at is not null then
    v_day_until := (
      ((v_last_learning_at at time zone v_last_timezone)::date + v_min_position)::timestamp
      at time zone v_last_timezone
    );
  end if;

  if (v_two_hour_until is not null and v_two_hour_until > now())
     or (v_day_until is not null and v_day_until > now()) then
    return pg_catalog.jsonb_build_object(
      'paused_until',v_two_hour_until,
      'calendar_pause_until',v_day_until,
      'card_ids','[]'::jsonb
    );
  end if;

  -- At the next permissible query, all positions advance together.
  -- This replaces repeated one-step decrements with a single jump.
  if v_min_position > 0 then
    update public.voka_cards
       set position = greatest(position - v_min_position, 0)
     where list_id = p_list_id and user_id = v_uid;
  end if;

  select pg_catalog.array_agg(c.id order by pg_catalog.random())
    into v_ids
    from public.voka_cards c
   where c.list_id = p_list_id and c.user_id = v_uid
     and c.success_count < 4 and c.position = 0;

  if coalesce(pg_catalog.array_length(v_ids,1),0) = 0 then
    raise exception 'No cards due after position advancement' using errcode = 'P0002';
  end if;

  -- Preserve existing behavior of one query with its own randomized cards.
  insert into public.voka_queries(user_id) values(v_uid)
    returning id into v_query;
  insert into public.voka_query_cards(query_id,card_id,user_id)
    select v_query,pg_catalog.unnest(v_ids),v_uid;

  update public.voka_lists
     set last_learning_at = now(), learning_timezone = p_timezone
   where id = p_list_id and user_id = v_uid;

  return pg_catalog.jsonb_build_object(
    'query_id',v_query,'card_ids',pg_catalog.to_jsonb(v_ids)
  );
end
$$;

-- Keep the previous RPC signature for already installed PWAs until they update.
-- Older clients use the last stored timezone, while newer ones send their
-- browser's IANA timezone explicitly.
create or replace function public.voka_begin_learning(p_list_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.voka_begin_learning(
    p_list_id,
    coalesce(
      (select l.learning_timezone
         from public.voka_lists l
        where l.id = p_list_id and l.user_id = (select auth.uid())),
      'Europe/Berlin'
    )
  )
$$;

revoke all on function public.voka_begin_learning(uuid,text) from public, anon;
grant execute on function public.voka_begin_learning(uuid,text) to authenticated;
revoke all on function public.voka_begin_learning(uuid) from public, anon;
grant execute on function public.voka_begin_learning(uuid) to authenticated;
