-- Atomic, profile-scoped CSV card import. Client parses CSV and passes validated rows.
-- SECURITY INVOKER keeps existing Voka RLS rules in force.
create or replace function public.voka_import_cards_csv(
  p_list_id uuid, p_cards jsonb
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile uuid := (select public.voka_active_profile_id());
  v_row jsonb;
  v_id uuid;
  v_added integer := 0;
  v_updated integer := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_uid is null or v_profile is null or not public.can_access_app('voka') then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  if p_cards is null or jsonb_typeof(p_cards)<>'array'
    or jsonb_array_length(p_cards)>5000 then
    raise exception 'Invalid CSV rows' using errcode='22023';
  end if;
  perform 1 from public.voka_lists
    where id=p_list_id and user_id=v_uid and profile_id=v_profile for update;
  if not found then
    raise exception 'Destination list not found' using errcode='42501';
  end if;
  for v_row in select value from jsonb_array_elements(p_cards)
  loop
    if jsonb_typeof(v_row)<>'object'
      or length(btrim(coalesce(v_row->>'question',''))) not between 1 and 20000
      or length(btrim(coalesce(v_row->>'answer',''))) not between 1 and 20000
      or jsonb_typeof(v_row->'marked') <> 'boolean'
      or jsonb_typeof(v_row->'position') <> 'number'
      or jsonb_typeof(v_row->'success_count') <> 'number'
      or jsonb_typeof(v_row->'reverse_position') <> 'number'
      or jsonb_typeof(v_row->'reverse_success_count') <> 'number' then
      raise exception 'Invalid card fields in CSV' using errcode='22023';
    end if;
    if (v_row->>'position') !~ '^[0-9]+$' or (v_row->>'position')::integer not between 0 and 20
      or (v_row->>'reverse_position') !~ '^[0-9]+$' or (v_row->>'reverse_position')::integer not between 0 and 24
      or (v_row->>'success_count') !~ '^[0-9]+$' or (v_row->>'success_count')::integer not between 0 and 4
      or (v_row->>'reverse_success_count') !~ '^[0-9]+$' or (v_row->>'reverse_success_count')::integer not between 0 and 4 then
      raise exception 'Invalid position or points in CSV' using errcode='22023';
    end if;
    if nullif(v_row->>'id','') is null then
      v_id:=gen_random_uuid();
    else
      begin v_id:=(v_row->>'id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid card ID in CSV' using errcode='22023';
      end;
    end if;
    if v_id = any(v_seen) then
      raise exception 'Duplicate card ID in CSV' using errcode='22023';
    end if;
    v_seen:=array_append(v_seen,v_id);
    if exists(select 1 from public.voka_cards where id=v_id and (list_id<>p_list_id or profile_id<>v_profile or user_id<>v_uid)) then
      raise exception 'Card ID belongs to another list' using errcode='23505';
    end if;
    update public.voka_cards set
      question=v_row->>'question',
      answer=v_row->>'answer',
      marked=(v_row->>'marked')::boolean,
      position=(v_row->>'position')::smallint,
      success_count=(v_row->>'success_count')::smallint,
      reverse_position=(v_row->>'reverse_position')::smallint,
      reverse_success_count=(v_row->>'reverse_success_count')::smallint,
      updated_at=now()
    where id=v_id and list_id=p_list_id and user_id=v_uid and profile_id=v_profile;
    if found then
      v_updated:=v_updated+1;
    else
      insert into public.voka_cards(
        id,list_id,question,answer,marked,position,success_count,reverse_position,reverse_success_count
      ) values (
        v_id,p_list_id,v_row->>'question',v_row->>'answer',
        (v_row->>'marked')::boolean,(v_row->>'position')::smallint,
        (v_row->>'success_count')::smallint,(v_row->>'reverse_position')::smallint,
        (v_row->>'reverse_success_count')::smallint
      );
      v_added:=v_added+1;
    end if;
  end loop;
  return jsonb_build_object('added',v_added,'updated',v_updated);
end $$;
revoke all on function public.voka_import_cards_csv(uuid,jsonb) from public,anon;
grant execute on function public.voka_import_cards_csv(uuid,jsonb) to authenticated;
