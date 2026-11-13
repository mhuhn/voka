-- Fix stage semantics: stage 0 is the *initial* reverse position.
-- Stage 1+ is the delay for a card that has already earned that many points.
-- The earlier 0.9.0 implementation mistakenly used stage-0 positions only
-- after the first successful reverse answer.

-- Immutable, private stage matrix shared by insert and grading paths.
create or replace function app_private.voka_reverse_stage_position(
  p_share smallint, p_points integer
) returns smallint
language sql immutable strict security invoker set search_path=''
as $$
  select (case p_share
    when 0 then case when p_points=0 then 0 end
    when 25 then case p_points when 0 then 10 end
    when 50 then case p_points when 0 then 4 when 1 then 13 end
    when 75 then case p_points when 0 then 4 when 1 then 12 when 2 then 24 end
    when 100 then case p_points when 0 then 1 when 1 then 4 when 2 then 10 when 3 then 24 end
    else null
  end)::smallint;
$$;

revoke all on function app_private.voka_reverse_stage_position(smallint,integer)
  from public,anon;
grant execute on function app_private.voka_reverse_stage_position(smallint,integer)
  to authenticated;

-- Initialize every inserted card, whether from the PWA, direct REST inserts,
-- older installed PWA versions or the shared-list import procedure.
create or replace function public.voka_initialize_reverse_position()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_share smallint;
begin
  select l.reverse_share into v_share
    from public.voka_lists l
   where l.id=new.list_id and l.user_id=new.user_id;
  if v_share is not null
     and v_share>0
     and new.reverse_success_count=0
     and new.reverse_position=0 then
    new.reverse_position:=app_private.voka_reverse_stage_position(v_share,0);
  end if;
  return new;
end $$;

drop trigger if exists voka_initialize_reverse_position_trigger
  on public.voka_cards;
create trigger voka_initialize_reverse_position_trigger
  before insert on public.voka_cards
  for each row execute function public.voka_initialize_reverse_position();

-- When the list's percentage changes, give reverse cards which have never
-- been tested the initial position of the NEW percentage. Preserve positions
-- after a failed/unsure/known review, so changing the slider does not erase
-- the user's already-earned scheduling.
create or replace function public.voka_clamp_reverse_scores()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if new.reverse_share>0 and new.reverse_share<old.reverse_share then
    update public.voka_cards
       set reverse_success_count=least(reverse_success_count,new.reverse_share/25)
     where list_id=new.id and user_id=new.user_id
       and reverse_success_count>new.reverse_share/25;
  end if;
  if new.reverse_share>0 then
    update public.voka_cards c
       set reverse_position=app_private.voka_reverse_stage_position(new.reverse_share,0)
     where c.list_id=new.id and c.user_id=new.user_id
       and c.reverse_success_count=0
       and not exists(
         select 1 from public.voka_query_cards qc
          where qc.card_id=c.id and qc.user_id=c.user_id
            and qc.reverse=true and qc.result is not null
       );
  end if;
  return null;
end $$;

-- Correct existing never-reviewed reverse cards that were given position 0
-- by the previous implementation, but do NOT reset cards already reviewed.
update public.voka_cards c
   set reverse_position=app_private.voka_reverse_stage_position(l.reverse_share,0)
  from public.voka_lists l
 where c.list_id=l.id and c.user_id=l.user_id and l.reverse_share>0
   and c.reverse_success_count=0 and c.reverse_position=0
   and not exists(
     select 1 from public.voka_query_cards qc
      where qc.card_id=c.id and qc.user_id=c.user_id
        and qc.reverse=true and qc.result is not null
   );

-- Existing cards graded with the previous matrix have their remaining
-- waiting time adjusted by the matrix difference, without resetting the
-- elapsed decrements. Leave unsure/unknown and completed tracks untouched.
with last_reverse_grade as (
  select c.id,c.reverse_position,c.reverse_success_count,l.reverse_share,
         old_schedule.old_position,
         app_private.voka_reverse_stage_position(
           l.reverse_share,c.reverse_success_count::integer
         ) as intended_position,
         (select qc.result
            from public.voka_query_cards qc
           where qc.card_id=c.id and qc.user_id=c.user_id
             and qc.reverse=true and qc.result is not null
           order by qc.answered_at desc nulls last, qc.query_id desc
           limit 1
         ) as last_result
    from public.voka_cards c
    join public.voka_lists l on l.id=c.list_id and l.user_id=c.user_id
    cross join lateral (
       select (case l.reverse_share
         when 50 then case c.reverse_success_count when 1 then 4 end
         when 75 then case c.reverse_success_count when 1 then 4 when 2 then 12 end
         when 100 then case c.reverse_success_count when 1 then 1 when 2 then 4 when 3 then 10 end
       end)::smallint as old_position
    ) old_schedule
   where l.reverse_share>0
     and c.reverse_success_count>0
     and c.reverse_success_count<l.reverse_share/25
)
update public.voka_cards c
   set reverse_position=least(24,greatest(0,
     c.reverse_position+(g.intended_position-g.old_position)
   ))
  from last_reverse_grade g
 where g.id=c.id
   and g.last_result='known'
   and g.old_position is not null
   and g.intended_position is not null
   and c.reverse_position<=g.old_position;

-- Keep scoring atomically integrated with the existing list locks, query
-- history, completion tracking and two-hour/calendar pauses.
create or replace function app_private.voka_grade_direction_impl(
 p_query_id uuid,p_card_id uuid,p_reverse boolean,p_result text
) returns jsonb
language plpgsql security invoker volatile set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_list_id uuid;
 v_share smallint;
 v_paused_until timestamptz;
 v_points smallint;
 v_position smallint;
 v_pending integer;
 v_due integer;
 v_finished boolean:=false;
begin
 if v_uid is null or not (select public.can_access_app('voka')) then
   raise exception 'Voka access denied' using errcode='42501';
 end if;
 if p_result is null or p_result not in ('known','unknown','unsure')
    or p_reverse is null then
   raise exception 'Invalid learning grade' using errcode='22023';
 end if;

 select c.list_id into v_list_id from public.voka_query_cards qc
   join public.voka_cards c on c.id=qc.card_id and c.user_id=qc.user_id
  where qc.query_id=p_query_id and qc.card_id=p_card_id
    and qc.reverse=p_reverse and qc.user_id=v_uid;
 if v_list_id is null then
   raise exception 'Card orientation not in this query' using errcode='42501';
 end if;
 select l.reverse_share,l.learning_paused_until
   into v_share,v_paused_until
   from public.voka_lists l where l.id=v_list_id and l.user_id=v_uid for update;
 if not found or (v_paused_until is not null and v_paused_until>now()) then
   raise exception 'List paused or unavailable' using errcode='42501';
 end if;
 perform 1 from public.voka_queries q where q.id=p_query_id
   and q.user_id=v_uid and q.finished_at is null for update;
 if not found then
   raise exception 'Learning query already finished' using errcode='42501';
 end if;
 perform 1 from public.voka_query_cards qc where qc.query_id=p_query_id
    and qc.card_id=p_card_id and qc.reverse=p_reverse and qc.user_id=v_uid
    and qc.result is null for update;
 if not found then
   raise exception 'Card orientation already graded' using errcode='42501';
 end if;

 if p_reverse then
   if v_share=0 then
     raise exception 'Reverse learning is disabled' using errcode='42501';
   end if;
   update public.voka_cards c
     set reverse_success_count=case when p_result='unknown' then 0
                                    when p_result='known' then least(c.reverse_success_count+1,v_share/25)
                                    else c.reverse_success_count end,
         reverse_position=case
           when p_result in ('unknown','unsure') then 1
           -- Known advances the score first. The stage position describes
           -- the *new* score. A completed track does not need another delay.
           else coalesce(
             app_private.voka_reverse_stage_position(
               v_share,(c.reverse_success_count+1)::integer
             ),
             c.reverse_position
           ) end
   where c.id=p_card_id and c.list_id=v_list_id and c.user_id=v_uid
     and c.reverse_position=0 and c.reverse_success_count<v_share/25
   returning c.reverse_success_count,c.reverse_position into v_points,v_position;
 else
   update public.voka_cards c
      set success_count=case when p_result='unknown' then 0
                             when p_result='known' then least(c.success_count+1,4)
                             else c.success_count end,
          position=case when p_result in ('unknown','unsure') then 1
                        when c.success_count=0 then 2
                        when c.success_count=1 then 6 else 19 end
    where c.id=p_card_id and c.list_id=v_list_id and c.user_id=v_uid
      and c.position=0 and c.success_count<4
    returning c.success_count,c.position into v_points,v_position;
 end if;
 if not found then
   raise exception 'Card orientation is not due' using errcode='42501';
 end if;

 update public.voka_query_cards qc
    set result=p_result,answered_at=now()
  where qc.query_id=p_query_id and qc.card_id=p_card_id and qc.reverse=p_reverse
    and qc.user_id=v_uid;

 select count(*) into v_due from (
   select 1 from public.voka_cards c
    where c.list_id=v_list_id and c.user_id=v_uid
      and c.success_count<4 and c.position=0
   union all
   select 1 from public.voka_cards c
    where c.list_id=v_list_id and c.user_id=v_uid and v_share>0
      and c.reverse_success_count<v_share/25 and c.reverse_position=0
 ) remaining;
 if v_due=0 then
   update public.voka_cards c
      set position=greatest(c.position-1,0),
          reverse_position=greatest(c.reverse_position-1,0)
    where c.list_id=v_list_id and c.user_id=v_uid;
   v_paused_until:=now()+interval '2 hours';
   update public.voka_lists l set learning_paused_until=v_paused_until
     where l.id=v_list_id and l.user_id=v_uid;
 else v_paused_until:=null;
 end if;

 select count(*) into v_pending from public.voka_query_cards qc
  where qc.query_id=p_query_id and qc.user_id=v_uid and qc.result is null;
 if v_pending=0 then
   update public.voka_queries set finished_at=now()
    where id=p_query_id and user_id=v_uid;
   v_finished:=true;
 end if;

 return pg_catalog.jsonb_build_object(
    'success_count',v_points,'position',v_position,
    'reverse',p_reverse,'finished',v_finished,'paused_until',v_paused_until);
end $$;

