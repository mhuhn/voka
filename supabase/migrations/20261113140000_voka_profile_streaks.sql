-- Profile-scoped streaks. All state lives in Supabase, never in Google Drive.
-- A completed query awards at most once per local calendar day, after verifying
-- no due work remains anywhere in the active profile.
alter table public.profiles
  add column if not exists streak_count integer not null default 0,
  add column if not exists streak_day date,
  add column if not exists streak_notice_lost integer not null default 0,
  add column if not exists streak_notice_days integer not null default 0,
  add column if not exists streak_award_query_id uuid,
  add column if not exists streak_updated_at timestamptz not null default now();

alter table public.profiles
  add constraint profiles_streak_count_range check (streak_count between 0 and 99999),
  add constraint profiles_streak_notice_range check (streak_notice_lost >= 0 and streak_notice_days >= 0);

-- SECURITY INVOKER: ownership is enforced by existing profiles RLS.
create or replace function app_private.voka_decay_profile_streak(p_profile_id uuid,p_today date)
returns void language plpgsql volatile security invoker set search_path=''
as $$
declare v_old record;
        v_missing integer;
        v_lost integer;
begin
  select streak_count,streak_day into v_old
    from public.profiles
    where id=p_profile_id and user_id=(select auth.uid())
    for update;
  if not found then raise exception 'Profile not found or access denied' using errcode='42501'; end if;
  if v_old.streak_day is null or p_today-v_old.streak_day<=1 then return; end if;

  v_missing:=p_today-v_old.streak_day-1;
  v_lost:=least(v_old.streak_count,v_missing*2);
  update public.profiles
     set streak_count=streak_count-v_lost,
         streak_day=p_today-1,
         streak_notice_lost=streak_notice_lost+v_lost,
         streak_notice_days=streak_notice_days+case when v_lost>0 then v_missing else 0 end,
         streak_updated_at=now()
   where id=p_profile_id and user_id=(select auth.uid());
end $$;

revoke all on function app_private.voka_decay_profile_streak(uuid,date) from public,anon;
grant execute on function app_private.voka_decay_profile_streak(uuid,date) to authenticated;

-- A query is completed by the server-side grade RPC (the last answer) or
-- explicitly aborted by finishLearning. Reject aborted and empty sessions.
-- This trigger also runs inside the grading transaction, preventing lost awards.
create or replace function app_private.voka_award_profile_streak_trigger()
returns trigger language plpgsql volatile security invoker set search_path=''
as $$
declare v_zone text;
        v_today date;
        v_ready boolean;
begin
  if old.finished_at is not null or new.finished_at is null then return new; end if;
  if new.user_id is distinct from (select auth.uid())
     or new.profile_id is distinct from (select public.voka_active_profile_id())
     or not (select public.can_access_app('voka')) then return new; end if;

  if not exists (
     select 1 from public.voka_query_cards qc
      where qc.query_id=new.id and qc.profile_id=new.profile_id and qc.result is not null
  ) or exists (
     select 1 from public.voka_query_cards qc
      where qc.query_id=new.id and qc.profile_id=new.profile_id and qc.result is null
  ) then return new; end if;

  select l.learning_timezone into v_zone
    from public.voka_query_cards qc
    join public.voka_cards c on c.id=qc.card_id and c.profile_id=qc.profile_id
    join public.voka_lists l on l.id=c.list_id and l.profile_id=c.profile_id
   where qc.query_id=new.id and qc.profile_id=new.profile_id
   order by qc.card_id limit 1;
  v_today:=(now() at time zone coalesce(v_zone,'UTC'))::date;
  perform app_private.voka_decay_profile_streak(new.profile_id,v_today);

  -- The security-invoker view handles both directional progress and calendar
  -- cooldown, including a manually skipped pause. At its minimum outstanding
  -- position every non-learned list has at least one question.
  select exists (
    select 1
      from public.voka_lists l
      join public.voka_list_learning_state state on state.list_id=l.id
     where l.profile_id=new.profile_id and l.user_id=new.user_id
       and state.min_position is not null
       and (l.learning_paused_until is null or l.learning_paused_until<=now())
       and (state.calendar_pause_until is null or state.calendar_pause_until<=now())
  ) into v_ready;
  if v_ready then return new; end if;

  update public.profiles
     set streak_count=least(99999,streak_count+1),
         streak_day=v_today,
         streak_notice_lost=0,
         streak_notice_days=0,
         streak_award_query_id=new.id,
         streak_updated_at=now()
   where id=new.profile_id and user_id=new.user_id
     and (streak_day is null or streak_day<v_today);
  return new;
end $$;

revoke all on function app_private.voka_award_profile_streak_trigger() from public,anon;
drop trigger if exists voka_award_streak_after_finish on public.voka_queries;
create trigger voka_award_streak_after_finish
after update of finished_at on public.voka_queries
for each row
when (old.finished_at is null and new.finished_at is not null)
execute function app_private.voka_award_profile_streak_trigger();

-- Reading actively applies any overdue penalties; the result is obtained
-- from the same locked, authoritative profile row.
create or replace function public.voka_get_profile_streak(p_timezone text)
returns jsonb language plpgsql volatile security invoker set search_path=''
as $$
declare v_id uuid:=(select public.voka_active_profile_id());
        v_user uuid:=(select auth.uid());
        v_today date;
        v_p record;
begin
  if v_user is null or v_id is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka profile access denied' using errcode='42501';
  end if;
  if p_timezone is null or not exists(
    select 1 from pg_catalog.pg_timezone_names where name=p_timezone
  ) then raise exception 'Invalid learning timezone' using errcode='22023'; end if;
  v_today:=(now() at time zone p_timezone)::date;
  perform app_private.voka_decay_profile_streak(v_id,v_today);
  select streak_count,streak_day,streak_notice_lost,streak_notice_days,streak_award_query_id
    into v_p from public.profiles where id=v_id and user_id=v_user;
  if not found then raise exception 'Profile not found' using errcode='42501'; end if;
  return pg_catalog.jsonb_build_object(
    'n',v_p.streak_count,
    'day',coalesce(v_p.streak_day::text,''),
    'note',case when v_p.streak_notice_lost>0 then
        pg_catalog.jsonb_build_object('lost',v_p.streak_notice_lost,'days',v_p.streak_notice_days)
        else null::jsonb end,
    'last_awarded_query_id',v_p.streak_award_query_id
  );
end $$;
revoke all on function public.voka_get_profile_streak(text) from public,anon;
grant execute on function public.voka_get_profile_streak(text) to authenticated;

create or replace function public.voka_dismiss_streak_notice()
returns void language plpgsql volatile security invoker set search_path=''
as $$
declare v_id uuid:=(select public.voka_active_profile_id());
begin
  if v_id is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka profile access denied' using errcode='42501'; end if;
  update public.profiles
     set streak_notice_lost=0,streak_notice_days=0
   where id=v_id and user_id=(select auth.uid());
  if not found then raise exception 'Profile not found' using errcode='42501'; end if;
end $$;
revoke all on function public.voka_dismiss_streak_notice() from public,anon;
grant execute on function public.voka_dismiss_streak_notice() to authenticated;
