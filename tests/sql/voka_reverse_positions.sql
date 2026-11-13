-- Re-runnable, non-destructive regression test for reverse-stage scheduling.
-- Run as a database admin in the Supabase SQL editor. This transaction rolls
-- back all fixture lists/cards/queries; it never persists test data.
begin;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.voka_settings limit 1),true);
set local role authenticated;

do $test$
declare
  v_uid uuid:=auth.uid();
  v_subject uuid;
  v_list uuid;
  v_card uuid;
  v_imported_list uuid;
  v_level smallint;
  v_initial integer;
  v_stage integer;
  v_expected integer;
  v_actual integer;
  v_started jsonb;
  v_answer jsonb;
  v_query uuid;
begin
  if not public.can_access_app('voka') then
    raise exception 'Regression test requires an existing approved Voka account';
  end if;
  select id into v_subject
    from public.voka_subjects where user_id=v_uid limit 1;
  if v_subject is null then
    raise exception 'Regression test requires an owned subject';
  end if;

  for v_level in select unnest(array[0,25,50,75,100]::smallint[]) loop
    v_initial:=case v_level
      when 25 then 10 when 50 then 4 when 75 then 4
      when 100 then 1 else 0 end;
    insert into public.voka_lists(user_id,subject_id,title,reverse_share)
      values(v_uid,v_subject,'Temporary reverse test '||v_level,v_level)
      returning id into v_list;
    -- The PWA does not supply user_id or reverse_position.
    insert into public.voka_cards(list_id,question,answer,success_count,position)
      values(v_list,'test question','test answer',0,0)
      returning id into v_card;
    select reverse_position into v_actual
      from public.voka_cards where id=v_card;
    if v_actual<>v_initial then
      raise exception 'Level % must initialize at %, received %',
        v_level,v_initial,v_actual;
    end if;

    if v_level=50 then
      v_imported_list:=public.voka_import_shared_list(
        v_list,v_subject,'Temporary shared import',array[]::text[]);
      select reverse_position into v_actual
        from public.voka_cards where list_id=v_imported_list;
      if v_actual<>4 then raise exception 'Imported reverse position should be 4'; end if;
    end if;

    if v_level=0 then continue; end if;

    for v_stage in 0..(v_level/25-1) loop
      -- Force this reverse orientation due. The normal orientation is complete
      -- so the query contains exactly the one reversed card.
      update public.voka_cards
        set success_count=4,reverse_success_count=v_stage,
            reverse_position=0
        where id=v_card;
      update public.voka_lists
        set last_learning_at=now()-interval '40 days',
            learning_paused_until=null
        where id=v_list;

      v_started:=public.voka_begin_learning_v2(v_list,'Europe/Berlin');
      v_query:=(v_started->>'query_id')::uuid;
      if v_query is null or jsonb_array_length(v_started->'cards')<>1
         or (v_started->'cards'->0->>'reverse')::boolean is distinct from true then
        raise exception 'Invalid reverse query at level %, score %',
          v_level,v_stage;
      end if;

      v_answer:=public.voka_grade_learning_v2(v_query,v_card,true,'known');
      v_expected:=app_private.voka_reverse_stage_position(
        v_level,v_stage+1);
      if (v_answer->>'success_count')::integer<>(v_stage+1)
         or (v_expected is not null and
             (v_answer->>'position')::integer<>v_expected) then
        raise exception 'Level %, score % should schedule %, got %',
          v_level,v_stage+1,v_expected,v_answer;
      end if;
    end loop;
  end loop;
end $test$;

rollback;
