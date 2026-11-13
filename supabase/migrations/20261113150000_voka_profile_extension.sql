-- Migrate Voka-specific profile attributes from shared profiles to voka_profiles.
-- Phase 1: additive and backwards compatible with the previously deployed client.
alter table public.voka_profiles
 add column if not exists user_id uuid,
 add column if not exists emoji text not null default '🙂',
 add column if not exists streak_count integer not null default 0,
 add column if not exists streak_day date,
 add column if not exists streak_notice_lost integer not null default 0,
 add column if not exists streak_notice_days integer not null default 0,
 add column if not exists streak_award_query_id uuid,
 add column if not exists streak_updated_at timestamptz not null default now();

-- Only profiles already used by Voka get a Voka-specific row in this backfill.
insert into public.voka_profiles
 (id,user_id,emoji,streak_count,streak_day,streak_notice_lost,streak_notice_days,streak_award_query_id,streak_updated_at)
select p.id,p.user_id,p.emoji,p.streak_count,p.streak_day,p.streak_notice_lost,
 p.streak_notice_days,p.streak_award_query_id,p.streak_updated_at
from public.profiles p
where exists(select 1 from public.voka_settings s where s.profile_id=p.id)
on conflict(id) do nothing;

update public.voka_profiles v set user_id=p.user_id
from public.profiles p where p.id=v.id and v.user_id is null;
alter table public.voka_profiles alter column user_id set not null;

-- The compound FK prevents impersonating another user's profile.
create unique index if not exists profiles_id_user_id_for_voka_key on public.profiles(id,user_id);
alter table public.voka_profiles
 add constraint voka_profiles_owner_profile_fkey
 foreign key(id,user_id) references public.profiles(id,user_id) on delete cascade;
alter table public.voka_profiles
 add constraint voka_profiles_streak_count_range check(streak_count between 0 and 99999),
 add constraint voka_profiles_notice_nonnegative check(streak_notice_lost>=0 and streak_notice_days>=0),
 add constraint voka_profiles_emoji_valid check(
   char_length(emoji) between 1 and 32 and octet_length(emoji)>char_length(emoji)
   and emoji !~ '[[:space:]]'
 );
create unique index if not exists voka_profiles_user_emoji_unique on public.voka_profiles(user_id,emoji);

-- Existing Voka profile rows had no RLS policies and were therefore unreadable by clients.
alter table public.voka_profiles enable row level security;
create policy voka_profiles_read_owned on public.voka_profiles
 for select to authenticated
 using(user_id=(select auth.uid()) and (select public.can_access_app('voka')));
create policy voka_profiles_update_active on public.voka_profiles
 for update to authenticated
 using(user_id=(select auth.uid()) and id=(select public.voka_active_profile_id())
   and (select public.can_access_app('voka')))
 with check(user_id=(select auth.uid()) and id=(select public.voka_active_profile_id())
   and (select public.can_access_app('voka')));

revoke all on table public.voka_profiles from anon,authenticated;
grant select on public.voka_profiles to authenticated;
grant update(streak_count,streak_day,streak_notice_lost,streak_notice_days,streak_award_query_id,streak_updated_at)
 on public.voka_profiles to authenticated;

-- Lazily add Voka-specific profile rows for previously existing shared profiles,
-- including the default profile made by the shared Auth provisioning logic.
create or replace function public.voka_ensure_profiles()
returns void language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_profile record; v_emoji text;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501'; end if;
 perform 1 from auth.users where id=v_uid for update;
 for v_profile in select id from public.profiles
    where user_id=v_uid and status<>'disabled' order by created_at,id loop
   if exists(select 1 from public.voka_profiles where id=v_profile.id) then continue; end if;
   select candidate into v_emoji from unnest(array[
     '🙂','😀','🐼','🦊','🐻','🐱','🐶','🐸','🦄','🐧','🦁',
     '🦋','🌈','⭐','🚀','⚽','🎨','🎵','🍀','🌻','🐙','🦉',
     '🏆','🌙','💎','🔥','🌟','🎯','🎮','🪐','🐳','🦜'
   ]) candidate
   where not exists(select 1 from public.voka_profiles vp where vp.user_id=v_uid and vp.emoji=candidate)
   limit 1;
   if v_emoji is null then raise exception 'No available profile emoji' using errcode='23505'; end if;
   insert into public.voka_profiles(id,user_id,emoji)
     values(v_profile.id,v_uid,v_emoji) on conflict(id) do nothing;
 end loop;
end $$;
revoke all on function public.voka_ensure_profiles() from public,anon;
grant execute on function public.voka_ensure_profiles() to authenticated;

CREATE OR REPLACE FUNCTION public.voka_create_profile(p_first_name text, p_last_name text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=(select auth.uid()); pid uuid; v_status public.profile_status;
        free_emoji text;
begin
 if uid is null or not app_private.is_confirmed() or not (select public.can_access_app('voka')) then
   raise exception 'Confirmed Voka account required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_first_name,''))) not between 1 and 120
    or length(coalesce(p_last_name,''))>150 then
   raise exception 'Invalid profile name' using errcode='22023'; end if;
 perform 1 from auth.users where id=uid for update;
 select status into v_status from public.profiles where user_id=uid and is_default limit 1;
 if v_status is null then raise exception 'Account has no default profile'; end if;
 select candidate into free_emoji from unnest(array[
   '🙂','😀','🐼','🦊','🐻','🐱','🐶','🐸','🦄','🐧','🦁','🦋','🌈','⭐','🚀','⚽','🎨','🎵','🍀','🌻','🐙','🦉','🏆','🌙','💎','🔥'
 ]) candidate where not exists(
   select 1 from public.voka_profiles p where p.user_id=uid and p.emoji=candidate
 ) limit 1;
 if free_emoji is null then raise exception 'Choose a different profile emoji' using errcode='23505'; end if;
 insert into public.profiles(user_id,first_name,last_name,display_name,emoji,status,is_default)
 values(uid,btrim(p_first_name),'',btrim(p_first_name),free_emoji,v_status,false)
 returning id into pid;
 insert into public.voka_profiles(id,user_id,emoji) values(pid,uid,free_emoji);
 return pid;
end $function$;

CREATE OR REPLACE FUNCTION public.voka_create_profile_with_emoji(p_name text, p_emoji text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=(select auth.uid()); pid uuid; v_status public.profile_status;
begin
 if uid is null or not app_private.is_confirmed() or not (select public.can_access_app('voka')) then
   raise exception 'Confirmed Voka account required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 then
   raise exception 'Invalid profile name' using errcode='22023'; end if;
 if p_emoji is null or char_length(p_emoji) not between 1 and 32
    or octet_length(p_emoji)=char_length(p_emoji)
    or p_emoji ~ '[[:space:]]' then
   raise exception 'Invalid emoji' using errcode='22023'; end if;
 perform 1 from auth.users where id=uid for update;
 select status into v_status from public.profiles where user_id=uid and is_default limit 1;
 if v_status is null then raise exception 'Account has no default profile'; end if;
 if exists(select 1 from public.voka_profiles where user_id=uid and emoji=p_emoji) then
   raise exception 'This emoji is already used by another profile' using errcode='23505'; end if;
 insert into public.profiles(user_id,first_name,last_name,display_name,emoji,status,is_default)
 values(uid,btrim(p_name),'',btrim(p_name),p_emoji,v_status,false)
 returning id into pid;
 insert into public.voka_profiles(id,user_id,emoji) values(pid,uid,p_emoji);
 return pid;
end $function$;

CREATE OR REPLACE FUNCTION public.voka_update_profile(p_profile_id uuid, p_name text, p_emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=(select auth.uid()); n integer;
begin
 if uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501'; end if;
 perform 1 from auth.users where id=uid for update;
 select count(*) into n from public.profiles where user_id=uid;
 if n<2 then raise exception 'Editing requires at least two profiles' using errcode='23514'; end if;
 if p_profile_id is distinct from (select public.voka_active_profile_id()) then
   raise exception 'Not the active profile' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 then
   raise exception 'Invalid profile name' using errcode='22023'; end if;
 if p_emoji is null or char_length(p_emoji) not between 1 and 32
    or octet_length(p_emoji)=char_length(p_emoji)
    or p_emoji ~ '[[:space:]]' then
   raise exception 'Invalid emoji' using errcode='22023'; end if;
 if exists(select 1 from public.voka_profiles where user_id=uid and emoji=p_emoji and id<>p_profile_id) then
   raise exception 'This emoji is already used by another profile' using errcode='23505'; end if;
 update public.profiles set display_name=btrim(p_name),emoji=p_emoji
 where id=p_profile_id and user_id=uid and status<>'disabled';
 if not found then raise exception 'Profile not found' using errcode='42501'; end if;
 update public.voka_profiles set emoji=p_emoji where id=p_profile_id and user_id=uid;
 if not found then raise exception 'Voka profile data missing' using errcode='42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.voka_initialize_defaults()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid := (select auth.uid()); pid uuid := (select public.voka_active_profile_id());
        g uuid; seed_created uuid;
begin
  if uid is null or pid is null or not public.can_access_app('voka') then
    raise exception 'Voka profile access denied' using errcode='42501';
  end if;
  perform public.voka_ensure_profiles();
  insert into public.voka_settings(user_id,profile_id) values(uid,pid)
    on conflict(profile_id) do nothing returning profile_id into seed_created;
  if seed_created is null then return; end if;
  insert into public.voka_subjectgroups(user_id,profile_id,title) values
    (uid,pid,'Sprachen'),(uid,pid,'MINT'),(uid,pid,'Sonstige');
  select id into g from public.voka_subjectgroups where profile_id=pid and title='Sprachen';
  insert into public.voka_subjects(user_id,profile_id,group_id,emoji,title) values
    (uid,pid,g,'🇬🇧','Englisch'),(uid,pid,g,'🇫🇷','Französisch'),
    (uid,pid,g,'🏛️','Latein'),(uid,pid,g,'🇬🇷','Griechisch');
  select id into g from public.voka_subjectgroups where profile_id=pid and title='MINT';
  insert into public.voka_subjects(user_id,profile_id,group_id,emoji,title) values
    (uid,pid,g,'➗','Mathe'),(uid,pid,g,'💻','Informatik'),(uid,pid,g,'🌿','Bio'),
    (uid,pid,g,'🌍','Erdkunde'),(uid,pid,g,'⚛️','Physik'),(uid,pid,g,'🧪','Chemie');
  select id into g from public.voka_subjectgroups where profile_id=pid and title='Sonstige';
  insert into public.voka_subjects(user_id,profile_id,group_id,emoji,title) values
    (uid,pid,g,'🎨','Kunst'),(uid,pid,g,'🎵','Musik');
end $function$;

CREATE OR REPLACE FUNCTION app_private.voka_decay_profile_streak(p_profile_id uuid, p_today date)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_old record;
        v_missing integer;
        v_lost integer;
begin
  select streak_count,streak_day into v_old
    from public.voka_profiles
    where id=p_profile_id and user_id=(select auth.uid())
    for update;
  if not found then raise exception 'Profile not found or access denied' using errcode='42501'; end if;
  if v_old.streak_day is null or p_today-v_old.streak_day<=1 then return; end if;

  v_missing:=p_today-v_old.streak_day-1;
  v_lost:=least(v_old.streak_count,v_missing*2);
  update public.voka_profiles
     set streak_count=streak_count-v_lost,
         streak_day=p_today-1,
         streak_notice_lost=streak_notice_lost+v_lost,
         streak_notice_days=streak_notice_days+case when v_lost>0 then v_missing else 0 end,
         streak_updated_at=now()
   where id=p_profile_id and user_id=(select auth.uid());
end $function$;

CREATE OR REPLACE FUNCTION app_private.voka_award_profile_streak_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  update public.voka_profiles
     set streak_count=least(99999,streak_count+1),
         streak_day=v_today,
         streak_notice_lost=0,
         streak_notice_days=0,
         streak_award_query_id=new.id,
         streak_updated_at=now()
   where id=new.profile_id and user_id=new.user_id
     and (streak_day is null or streak_day<v_today);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.voka_get_profile_streak(p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    into v_p from public.voka_profiles where id=v_id and user_id=v_user;
  if not found then raise exception 'Profile not found' using errcode='42501'; end if;
  return pg_catalog.jsonb_build_object(
    'n',v_p.streak_count,
    'day',coalesce(v_p.streak_day::text,''),
    'note',case when v_p.streak_notice_lost>0 then
        pg_catalog.jsonb_build_object('lost',v_p.streak_notice_lost,'days',v_p.streak_notice_days)
        else null::jsonb end,
    'last_awarded_query_id',v_p.streak_award_query_id
  );
end $function$;

CREATE OR REPLACE FUNCTION public.voka_dismiss_streak_notice()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid:=(select public.voka_active_profile_id());
begin
  if v_id is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka profile access denied' using errcode='42501'; end if;
  update public.voka_profiles
     set streak_notice_lost=0,streak_notice_days=0
   where id=v_id and user_id=(select auth.uid());
  if not found then raise exception 'Profile not found' using errcode='42501'; end if;
end $function$;
