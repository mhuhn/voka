-- Distinct emoji per account, including pre-existing duplicate defaults.
-- Keep user roles and profile-linked Voka data unchanged.
do $$
declare r record; candidate text;
begin
 for r in
   select id,user_id from (
     select id,user_id,emoji,
       row_number() over(partition by user_id,emoji order by created_at,id) as rn
     from public.profiles
   ) duplicates where rn>1
 loop
   select e into candidate from unnest(array[
     '🐼','🦊','🐻','🐱','🐶','🐸','🦄','🐧','🦁','🦋','🌈','⭐','🚀','⚽','🎨','🎵','🍀','🌻','🐙','🦉','🏆','🌙','💎','🔥'
   ]) e where not exists(
     select 1 from public.profiles p where p.user_id=r.user_id and p.emoji=e
   ) limit 1;
   if candidate is null then raise exception 'No free migration emoji for account'; end if;
   update public.profiles set emoji=candidate where id=r.id;
 end loop;
end $$;

create unique index if not exists profiles_user_emoji_unique
  on public.profiles(user_id,emoji);

-- Legacy clients can still call the original create RPC without providing an emoji.
-- Allocate a unique default instead of colliding with other profiles.
create or replace function public.voka_create_profile(p_first_name text,p_last_name text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
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
   select 1 from public.profiles p where p.user_id=uid and p.emoji=candidate
 ) limit 1;
 if free_emoji is null then raise exception 'Choose a different profile emoji' using errcode='23505'; end if;
 insert into public.profiles(user_id,first_name,last_name,display_name,emoji,status,is_default)
 values(uid,btrim(p_first_name),'',btrim(p_first_name),free_emoji,v_status,false)
 returning id into pid;
 return pid;
end $$;
revoke all on function public.voka_create_profile(text,text) from public,anon;
grant execute on function public.voka_create_profile(text,text) to authenticated;

-- New React API: chosen emoji is supplied at creation and checked atomically.
create or replace function public.voka_create_profile_with_emoji(p_name text,p_emoji text)
returns uuid language plpgsql security definer set search_path=''
as $$
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
 if exists(select 1 from public.profiles where user_id=uid and emoji=p_emoji) then
   raise exception 'This emoji is already used by another profile' using errcode='23505'; end if;
 insert into public.profiles(user_id,first_name,last_name,display_name,emoji,status,is_default)
 values(uid,btrim(p_name),'',btrim(p_name),p_emoji,v_status,false)
 returning id into pid;
 return pid;
end $$;
revoke all on function public.voka_create_profile_with_emoji(text,text) from public,anon;
grant execute on function public.voka_create_profile_with_emoji(text,text) to authenticated;

-- Editing: remove finite emoji whitelist. Ownership, selected profile and
-- at-least-two-profiles guard are retained.
create or replace function public.voka_update_profile(p_profile_id uuid,p_name text,p_emoji text)
returns void language plpgsql security definer set search_path=''
as $$
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
 if exists(select 1 from public.profiles where user_id=uid and emoji=p_emoji and id<>p_profile_id) then
   raise exception 'This emoji is already used by another profile' using errcode='23505'; end if;
 update public.profiles set display_name=btrim(p_name),emoji=p_emoji
 where id=p_profile_id and user_id=uid and status<>'disabled';
 if not found then raise exception 'Profile not found' using errcode='42501'; end if;
end $$;
revoke all on function public.voka_update_profile(uuid,text,text) from public,anon;
grant execute on function public.voka_update_profile(uuid,text,text) to authenticated;
