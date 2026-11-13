-- Voka profile isolation (existing user_id remains the authenticated account owner).
-- Legacy Voka clients without x-voka-profile-id continue to use the default profile.
create or replace function public.voka_active_profile_id()
returns uuid language plpgsql stable set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
        v_raw text;
        v_profile uuid;
begin
  if v_user is null then return null; end if;
  v_raw := nullif((nullif(pg_catalog.current_setting('request.headers', true),'')::jsonb ->> 'x-voka-profile-id'),'');
  if v_raw is null then
    select id into v_profile from public.profiles
      where user_id=v_user and is_default and status <> 'disabled'
      order by created_at limit 1;
  else
    begin v_profile := v_raw::uuid;
    exception when invalid_text_representation then return null; end;
  end if;
  if exists(select 1 from public.profiles where id=v_profile and user_id=v_user and status <> 'disabled')
  then return v_profile; end if;
  return null;
end $$;
revoke all on function public.voka_active_profile_id() from public, anon;
grant execute on function public.voka_active_profile_id() to authenticated;

do $$
declare v_table text;
begin
 foreach v_table in array array['voka_settings','voka_subjectgroups','voka_subjects','voka_lists','voka_cards','voka_queries','voka_query_cards']
 loop
  execute pg_catalog.format('alter table public.%I add column if not exists profile_id uuid',v_table);
  execute pg_catalog.format('update public.%I set profile_id = user_id where profile_id is null',v_table);
  execute pg_catalog.format('alter table public.%I alter column profile_id set default public.voka_active_profile_id()',v_table);
  execute pg_catalog.format('alter table public.%I alter column profile_id set not null',v_table);
  execute pg_catalog.format('alter table public.%I add constraint %I foreign key (profile_id) references public.profiles(id) on delete cascade',v_table,v_table||'_profile_id_fkey');
 end loop;
end $$;

alter table public.voka_settings drop constraint voka_settings_pkey;
alter table public.voka_settings add constraint voka_settings_pkey primary key(profile_id);
alter table public.voka_subjectgroups drop constraint voka_subjectgroups_user_id_title_key;
alter table public.voka_subjectgroups add constraint voka_subjectgroups_profile_title_key unique(profile_id,title);
alter table public.voka_subjectgroups add constraint voka_subjectgroups_id_profile_key unique(id,profile_id);
alter table public.voka_subjects add constraint voka_subjects_id_profile_key unique(id,profile_id);
alter table public.voka_lists add constraint voka_lists_id_profile_key unique(id,profile_id);
alter table public.voka_cards add constraint voka_cards_id_profile_key unique(id,profile_id);
alter table public.voka_queries add constraint voka_queries_id_profile_key unique(id,profile_id);
alter table public.voka_subjects add constraint voka_subjects_group_profile_fkey
 foreign key(group_id,profile_id) references public.voka_subjectgroups(id,profile_id) on delete cascade;
alter table public.voka_lists add constraint voka_lists_subject_profile_fkey
 foreign key(subject_id,profile_id) references public.voka_subjects(id,profile_id) on delete cascade;
alter table public.voka_cards add constraint voka_cards_list_profile_fkey
 foreign key(list_id,profile_id) references public.voka_lists(id,profile_id) on delete cascade;
alter table public.voka_query_cards add constraint voka_query_cards_query_profile_fkey
 foreign key(query_id,profile_id) references public.voka_queries(id,profile_id) on delete cascade;
alter table public.voka_query_cards add constraint voka_query_cards_card_profile_fkey
 foreign key(card_id,profile_id) references public.voka_cards(id,profile_id) on delete cascade;

-- Every Voka row must both belong to the authenticated account and to the selected, owned profile.
do $$
declare v_table text;
begin
 foreach v_table in array array['voka_subjectgroups','voka_subjects','voka_lists','voka_cards','voka_queries','voka_query_cards']
 loop
  execute pg_catalog.format('drop policy if exists %I on public.%I',v_table||'_owner',v_table);
  execute pg_catalog.format(
    'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid()) and profile_id = (select public.voka_active_profile_id()) and (select public.can_access_app(''voka''))) with check (user_id = (select auth.uid()) and profile_id = (select public.voka_active_profile_id()) and (select public.can_access_app(''voka'')))',
    v_table||'_owner',v_table);
 end loop;
end $$;
drop policy if exists voka_settings_select on public.voka_settings;
drop policy if exists voka_settings_insert on public.voka_settings;
create policy voka_settings_select on public.voka_settings for select to authenticated
 using (user_id=(select auth.uid()) and profile_id=(select public.voka_active_profile_id()) and (select public.can_access_app('voka')));
create policy voka_settings_insert on public.voka_settings for insert to authenticated
 with check (user_id=(select auth.uid()) and profile_id=(select public.voka_active_profile_id()) and (select public.can_access_app('voka')));

alter view public.voka_list_usage set (security_invoker=true);
alter view public.voka_list_learning_state set (security_invoker=true);

create or replace function public.voka_initialize_defaults()
returns void language plpgsql set search_path=''
as $$
declare uid uuid := (select auth.uid()); pid uuid := (select public.voka_active_profile_id());
        g uuid; seed_created uuid;
begin
  if uid is null or pid is null or not public.can_access_app('voka') then
    raise exception 'Voka profile access denied' using errcode='42501';
  end if;
  insert into public.voka_profiles(id) values(pid) on conflict(id) do nothing;
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
end $$;

-- Serialise profile deletions per account to prevent concurrent deletion of the final profile.
create or replace function public.voka_delete_profile(p_profile_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare uid uuid := (select auth.uid()); v_count integer; v_default boolean; v_next uuid;
begin
  if uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  perform 1 from auth.users where id=uid for update;
  select is_default into v_default from public.profiles
   where id=p_profile_id and user_id=uid and status<>'disabled' for update;
  if not found then raise exception 'Profile not found or not owned' using errcode='42501'; end if;
  select count(*) into v_count from public.profiles where user_id=uid;
  if v_count <= 1 then raise exception 'Cannot delete the last profile' using errcode='23514'; end if;
  if v_default then
    update public.profiles set is_default=false where id=p_profile_id;
    select id into v_next from public.profiles
      where user_id=uid and id<>p_profile_id order by created_at,id limit 1;
    update public.profiles set is_default=true where id=v_next;
  end if;
  delete from public.profiles where id=p_profile_id and user_id=uid;
end $$;
revoke all on function public.voka_delete_profile(uuid) from public, anon;
grant execute on function public.voka_delete_profile(uuid) to authenticated;

-- This API continues to work after the original (id = user_id) default profile is deleted.
create or replace function public.voka_create_profile(p_first_name text,p_last_name text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); pid uuid; v_status public.profile_status;
begin
 if uid is null or not app_private.is_confirmed() or not (select public.can_access_app('voka')) then
   raise exception 'Confirmed Voka account required' using errcode='42501'; end if;
 if length(trim(coalesce(p_first_name,'')))<1 or length(p_first_name)>150 or length(coalesce(p_last_name,''))>150 then
   raise exception 'Invalid profile name' using errcode='22023'; end if;
 select status into v_status from public.profiles where user_id=uid and is_default limit 1;
 if v_status is null then raise exception 'Account has no default profile'; end if;
 insert into public.profiles(user_id,first_name,last_name,status,is_default)
 values(uid,btrim(p_first_name),btrim(coalesce(p_last_name,'')),v_status,false)
 returning id into pid;
 return pid;
end $$;
revoke all on function public.voka_create_profile(text,text) from public, anon;
grant execute on function public.voka_create_profile(text,text) to authenticated;
