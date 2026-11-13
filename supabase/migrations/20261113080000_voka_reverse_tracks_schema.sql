-- Independent scoring and spacing for five reverse-question intensities.
-- Existing boolean 'both directions' lists are migrated to the 50% level.
alter table public.voka_lists
  add column if not exists reverse_share smallint not null default 0;
alter table public.voka_lists
  add constraint voka_lists_reverse_share_check
  check (reverse_share in (0,25,50,75,100));

update public.voka_lists
   set reverse_share = 50
 where learn_both_directions and reverse_share = 0;

-- Compatibility for older installed PWAs that still write the boolean.
create or replace function public.voka_sync_reverse_share()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.reverse_share=0 and new.learn_both_directions then
      new.reverse_share:=50;
    end if;
    new.learn_both_directions := (new.reverse_share>0);
  elsif new.reverse_share is distinct from old.reverse_share then
    new.learn_both_directions := (new.reverse_share>0);
  elsif new.learn_both_directions is distinct from old.learn_both_directions then
    new.reverse_share:=case when new.learn_both_directions then 50 else 0 end;
  end if;
  return new;
end $$;
create trigger voka_sync_reverse_share_trigger
  before insert or update of reverse_share,learn_both_directions
  on public.voka_lists
  for each row execute function public.voka_sync_reverse_share();

alter table public.voka_cards
  add column if not exists reverse_success_count smallint not null default 0,
  add column if not exists reverse_position smallint not null default 0;
alter table public.voka_cards
  add constraint voka_cards_reverse_success_count_check
  check (reverse_success_count between 0 and 4);
alter table public.voka_cards
  add constraint voka_cards_reverse_position_check
  check (reverse_position between 0 and 24);

-- Lowering an active reverse intensity lowers the actual score ceiling;
-- switching it off preserves progress if the user later switches it back on.
create or replace function public.voka_clamp_reverse_scores()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.reverse_share>0 and new.reverse_share<old.reverse_share then
    update public.voka_cards
       set reverse_success_count=least(reverse_success_count,new.reverse_share/25)
     where list_id=new.id and user_id=new.user_id
       and reverse_success_count>new.reverse_share/25;
  end if;
  return null;
end $$;
create trigger voka_clamp_reverse_scores_trigger
  after update of reverse_share on public.voka_lists
  for each row when (new.reverse_share is distinct from old.reverse_share)
  execute function public.voka_clamp_reverse_scores();

alter table public.voka_query_cards
  add column if not exists reverse boolean not null default false;
alter table public.voka_query_cards
  drop constraint voka_query_cards_pkey;
alter table public.voka_query_cards
  add constraint voka_query_cards_pkey
  primary key(query_id,card_id,reverse);

create or replace view public.voka_list_learning_state
with (security_invoker = true) as
select l.id as list_id, due.min_position,
       case when l.last_learning_at is null or due.min_position is null then null::timestamptz
            else (
              ((l.last_learning_at at time zone l.learning_timezone)::date + due.min_position)::timestamp
              at time zone l.learning_timezone
            )
       end as calendar_pause_until
from public.voka_lists l
left join lateral (
  select min(x.pos)::integer as min_position
  from (
    select c.position as pos from public.voka_cards c
      where c.list_id=l.id and c.user_id=l.user_id and c.success_count<4
    union all
    select c.reverse_position as pos from public.voka_cards c
      where c.list_id=l.id and c.user_id=l.user_id and l.reverse_share>0
        and c.reverse_success_count<l.reverse_share/25
  ) x
) due on true;
grant select on public.voka_list_learning_state to authenticated;

-- A copied list retains the chosen learning intensity, but resets both
-- directional progress tracks for its recipient.
create or replace function app_private.voka_get_shared_list_impl(p_list_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  select pg_catalog.jsonb_build_object(
    'id',l.id,'title',l.title,'tags',l.tags,
    'question_label',l.question_label,'answer_label',l.answer_label,
    'learn_both_directions',l.learn_both_directions,'reverse_share',l.reverse_share,
    'cards',coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('question',c.question,'answer',c.answer,'marked',c.marked)
        order by c.created_at,c.id)
      from public.voka_cards c where c.list_id=l.id
    ),'[]'::jsonb)
  ) into v_result from public.voka_lists l where l.id=p_list_id;
  return v_result;
end $$;

create or replace function app_private.voka_import_shared_list_impl(
  p_list_id uuid,p_subject_id uuid,p_title text,p_tags text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_new_id uuid;
begin
  if v_uid is null or not (select public.can_access_app('voka')) then
    raise exception 'Voka access denied' using errcode='42501';
  end if;
  if p_title is null or pg_catalog.length(pg_catalog.btrim(p_title)) not between 1 and 200
     or p_tags is null or pg_catalog.array_position(p_tags,null::text) is not null then
    raise exception 'Invalid title or tags' using errcode='22023';
  end if;
  if not exists(select 1 from public.voka_subjects s
                where s.id=p_subject_id and s.user_id=v_uid) then
    raise exception 'Target subject is not available' using errcode='42501';
  end if;
  insert into public.voka_lists (
    user_id,subject_id,title,tags,question_label,answer_label,
    learn_both_directions,reverse_share)
  select v_uid,p_subject_id,pg_catalog.btrim(p_title),p_tags,
         l.question_label,l.answer_label,l.learn_both_directions,l.reverse_share
    from public.voka_lists l where l.id=p_list_id
  returning id into v_new_id;
  if v_new_id is null then raise exception 'Shared list not found' using errcode='P0002'; end if;
  insert into public.voka_cards(
    user_id,list_id,question,answer,marked,
    success_count,"position",reverse_success_count,reverse_position)
  select v_uid,v_new_id,c.question,c.answer,c.marked,0,0,0,0
    from public.voka_cards c where c.list_id=p_list_id order by c.created_at,c.id;
  return v_new_id;
end $$;
