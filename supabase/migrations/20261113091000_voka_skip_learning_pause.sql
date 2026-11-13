-- The owner can opt out of ONE learning break without altering the historical
-- timestamp of the previous query, or changing card points/positions.
-- An unused skip is consumed by the next successful learning start.
alter table public.voka_lists add column if not exists learning_pause_skipped boolean not null default false;

-- The same security-invoker status view used by the UI and mixed preview.
create or replace view public.voka_list_learning_state
with (security_invoker = true) as
select l.id as list_id, due.min_position,
       case when l.learning_pause_skipped or l.last_learning_at is null or due.min_position is null then null::timestamptz
            else (
              ((l.last_learning_at at time zone l.learning_timezone)::date + due.min_position)::timestamp
              at time zone l.learning_timezone
            )
       end as calendar_pause_until
from public.voka_lists l
left join lateral (
  select min(x.pos)::integer as min_position
  from (
    select c.position as pos from public.voka_cards c
      where c.list_id=l.id and c.user_id=l.user_id and c.success_count<4
    union all
    select c.reverse_position as pos from public.voka_cards c
      where c.list_id=l.id and c.user_id=l.user_id and l.reverse_share>0
        and c.reverse_success_count<l.reverse_share/25
  ) x
) due on true;

grant select on public.voka_list_learning_state to authenticated;

-- Owner-scoped, invoker-rights control. Clear the hour pause and mark one
-- calendar exemption. No user can skip somebody else's list.
create or replace function public.voka_skip_learning_pause(p_list_id uuid)
returns void language plpgsql volatile security invoker set search_path=''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  update public.voka_lists l
     set learning_paused_until=null,learning_pause_skipped=true
   where l.id=p_list_id and l.user_id=v_uid;
  if not found then
    raise exception 'List not found or access denied' using errcode='42501';
  end if;
end $$;
revoke all on function public.voka_skip_learning_pause(uuid) from public,anon;
grant execute on function public.voka_skip_learning_pause(uuid) to authenticated;

-- A permitted learning start consumes the exemption after advancing both
-- directional positions and creating the query; if anything fails, the whole
-- transaction rolls back and the exemption remains unused.
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
 if not v_list.learning_pause_skipped and
    ((v_list.learning_paused_until is not null and v_list.learning_paused_until>now())
    or (v_day_until is not null and v_day_until>now())) then
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
    set last_learning_at=now(),learning_timezone=p_timezone,
        learning_pause_skipped=false
  where id=p_list_id and user_id=v_uid;

 return pg_catalog.jsonb_build_object('cards',v_cards);
end $$;

