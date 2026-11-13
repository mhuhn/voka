-- Move privilege-bypassing implementation into the existing private schema.
-- Public Data API functions are security-invoker wrappers, removing public
-- SECURITY DEFINER exposure while preserving explicit authenticated access.
create or replace function app_private.voka_get_shared_list_impl(p_list_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null
     or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
      'id', l.id,
      'title', l.title,
      'tags', l.tags,
      'question_label', l.question_label,
      'answer_label', l.answer_label,
      'learn_both_directions', l.learn_both_directions,
      'cards', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'question', c.question,
            'answer', c.answer,
            'marked', c.marked
          ) order by c.created_at, c.id
        )
        from public.voka_cards c where c.list_id = l.id
      ), '[]'::jsonb)
    )
    into v_result
    from public.voka_lists l
    where l.id = p_list_id;

  -- Never expose owner IDs, progress, positions or assessment history.
  return v_result;
end;
$$;


create or replace function app_private.voka_import_shared_list_impl(
  p_list_id uuid,
  p_subject_id uuid,
  p_title text,
  p_tags text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_new_id uuid;
begin
  if v_user_id is null
     or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode = '42501';
  end if;

  if p_title is null or pg_catalog.length(pg_catalog.btrim(p_title)) not between 1 and 200
     or p_tags is null or pg_catalog.array_position(p_tags, null::text) is not null then
    raise exception 'Invalid title or tags' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.voka_subjects s
    where s.id = p_subject_id and s.user_id = v_user_id
  ) then
    raise exception 'Target subject is not available' using errcode = '42501';
  end if;

  -- The source is accessed only by this narrowly scoped, authenticated RPC.
  insert into public.voka_lists (
    user_id, subject_id, title, tags,
    question_label, answer_label, learn_both_directions
  )
  select
    v_user_id, p_subject_id, pg_catalog.btrim(p_title), p_tags,
    l.question_label, l.answer_label, l.learn_both_directions
  from public.voka_lists l
  where l.id = p_list_id
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'Shared list not found' using errcode = 'P0002';
  end if;

  insert into public.voka_cards (
    user_id, list_id, question, answer, marked, success_count, "position"
  )
  select
    v_user_id, v_new_id, c.question, c.answer, c.marked, 0, 0
  from public.voka_cards c
  where c.list_id = p_list_id
  order by c.created_at, c.id;

  return v_new_id;
end;
$$;


revoke all on function app_private.voka_get_shared_list_impl(uuid) from public, anon, authenticated;
revoke all on function app_private.voka_import_shared_list_impl(uuid,uuid,text,text[]) from public, anon, authenticated;
grant execute on function app_private.voka_get_shared_list_impl(uuid) to authenticated;
grant execute on function app_private.voka_import_shared_list_impl(uuid,uuid,text,text[]) to authenticated;

create or replace function public.voka_get_shared_list(p_list_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select app_private.voka_get_shared_list_impl(p_list_id) $$;

create or replace function public.voka_import_shared_list(
 p_list_id uuid, p_subject_id uuid, p_title text, p_tags text[])
returns uuid
language sql security invoker set search_path = ''
as $$ select app_private.voka_import_shared_list_impl(p_list_id,p_subject_id,p_title,p_tags) $$;

revoke all on function public.voka_get_shared_list(uuid) from public, anon;
revoke all on function public.voka_import_shared_list(uuid,uuid,text,text[]) from public, anon;
grant execute on function public.voka_get_shared_list(uuid) to authenticated;
grant execute on function public.voka_import_shared_list(uuid,uuid,text,text[]) to authenticated;

comment on function public.voka_get_shared_list(uuid) is
 'Authenticated invoker API for private cross-owner list share preview by UUID.';
comment on function public.voka_import_shared_list(uuid,uuid,text,text[]) is
 'Authenticated invoker API for privately authorized atomic list import.';
