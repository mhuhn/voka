-- Allow editing the selected profile when it is the user's only profile.
-- Keep account authorization, profile ownership, and unique emoji checks.
CREATE OR REPLACE FUNCTION public.voka_update_profile(p_profile_id uuid, p_name text, p_emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=(select auth.uid());
begin
 if uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501'; end if;
 perform 1 from auth.users where id=uid for update;
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
end $function$
;
revoke all on function public.voka_update_profile(uuid,text,text) from public,anon;
grant execute on function public.voka_update_profile(uuid,text,text) to authenticated;
