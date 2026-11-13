-- Preserve the shared first_name/last_name API for existing apps, but use a
-- single display_name and an emoji in Voka. The new columns are additive.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists emoji text not null default '🙂';

update public.profiles
set display_name=coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(first_name),''),nullif(btrim(last_name),''))),''),'Profil')
where display_name is null;

alter table public.profiles
  add constraint profiles_display_name_valid check
    (display_name is null or (length(btrim(display_name)) between 1 and 120));

-- Keep the existing RPC signature usable by earlier Voka versions.
create or replace function public.voka_create_profile(p_first_name text,p_last_name text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); pid uuid; v_status public.profile_status;
begin
 if uid is null or not app_private.is_confirmed() or not (select public.can_access_app('voka')) then
   raise exception 'Confirmed Voka account required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_first_name,''))) not between 1 and 120
    or length(coalesce(p_last_name,''))>150 then
   raise exception 'Invalid profile name' using errcode='22023'; end if;
 select status into v_status from public.profiles where user_id=uid and is_default limit 1;
 if v_status is null then raise exception 'Account has no default profile'; end if;
 insert into public.profiles(user_id,first_name,last_name,display_name,emoji,status,is_default)
 values(uid,btrim(p_first_name),'',btrim(p_first_name),'🙂',v_status,false)
 returning id into pid;
 return pid;
end $$;
revoke all on function public.voka_create_profile(text,text) from public,anon;
grant execute on function public.voka_create_profile(text,text) to authenticated;

-- Only the selected owned profile may be customized, and only after a
-- second profile exists. Roles and other shared account fields are untouched.
create or replace function public.voka_update_profile(p_profile_id uuid,p_name text,p_emoji text)
returns void language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); n integer;
begin
 if uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 -- Lock the account row to serialize against profile deletion.
 perform 1 from auth.users where id=uid for update;
 select count(*) into n from public.profiles where user_id=uid;
 if n<2 then
   raise exception 'Editing requires at least two profiles' using errcode='23514';
 end if;
 if p_profile_id is distinct from (select public.voka_active_profile_id()) then
   raise exception 'Not the active profile' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 then
   raise exception 'Invalid profile name' using errcode='22023';
 end if;
 if p_emoji is null or p_emoji <> all(array['🙂','😀','🐼','🦊','🐻','🐱','🐶','🐸','🦄','🐧','🐨','🐯','🦁','🐙','🐝','🦋','🌸','🌻','🌈','⭐','🚀','⚽','🎨','🎵','🧠','📚','🍀','🍕','🐢','🦉']) then
   raise exception 'Invalid profile emoji' using errcode='22023';
 end if;
 update public.profiles
 set display_name=btrim(p_name),emoji=p_emoji
 where id=p_profile_id and user_id=uid and status<>'disabled';
 if not found then raise exception 'Profile not found' using errcode='42501'; end if;
end $$;
revoke all on function public.voka_update_profile(uuid,text,text) from public,anon;
grant execute on function public.voka_update_profile(uuid,text,text) to authenticated;
