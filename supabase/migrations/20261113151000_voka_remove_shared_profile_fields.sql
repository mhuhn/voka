-- Phase 2: after the React client reads voka_profiles. Shared profile rows
-- retain their generic id/user_id/name/status/default fields only.
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
 insert into public.profiles(user_id,first_name,last_name,display_name,status,is_default)
 values(uid,btrim(p_first_name),'',btrim(p_first_name),v_status,false)
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
 insert into public.profiles(user_id,first_name,last_name,display_name,status,is_default)
 values(uid,btrim(p_name),'',btrim(p_name),v_status,false)
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
 update public.profiles set display_name=btrim(p_name)
 where id=p_profile_id and user_id=uid and status<>'disabled';
 if not found then raise exception 'Profile not found' using errcode='42501'; end if;
 update public.voka_profiles set emoji=p_emoji where id=p_profile_id and user_id=uid;
 if not found then raise exception 'Voka profile data missing' using errcode='42501'; end if;
end $function$;

drop index if exists public.profiles_user_emoji_unique;
alter table public.profiles
 drop constraint if exists profiles_streak_count_range,
 drop constraint if exists profiles_streak_notice_range;
alter table public.profiles
 drop column if exists emoji,
 drop column if exists streak_count,
 drop column if exists streak_day,
 drop column if exists streak_notice_lost,
 drop column if exists streak_notice_days,
 drop column if exists streak_award_query_id,
 drop column if exists streak_updated_at;
