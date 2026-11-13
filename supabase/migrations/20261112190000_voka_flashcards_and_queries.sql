-- Voka data model. All data is private to its Supabase Auth user.
-- The existing shared apps/profiles/roles tables remain unchanged.
create table public.voka_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initialized_at timestamptz not null default now()
);

create table public.voka_subjectgroups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (user_id, title),
  unique (id, user_id)
);

create table public.voka_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  group_id uuid not null,
  emoji text not null default '📚' check (length(emoji) between 1 and 20),
  title text not null check (length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  foreign key (group_id, user_id) references public.voka_subjectgroups(id, user_id) on delete cascade,
  unique (user_id, group_id, title),
  unique (id, user_id)
);

create table public.voka_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  tags text[] not null default '{}',
  question_label text not null default 'Frage' check (length(btrim(question_label)) between 1 and 120),
  answer_label text not null default 'Antwort' check (length(btrim(answer_label)) between 1 and 120),
  learn_both_directions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.voka_subjects(id, user_id) on delete cascade,
  unique (id, user_id),
  check (array_position(tags, null) is null)
);

create table public.voka_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid not null,
  question text not null check (length(btrim(question)) > 0),
  answer text not null check (length(btrim(answer)) > 0),
  marked boolean not null default false,
  success_count smallint not null default 0 check (success_count between 0 and 3),
  position smallint not null default 0 check (position between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, user_id) references public.voka_lists(id, user_id) on delete cascade,
  unique (id, user_id)
);

-- A single query can combine cards from many different lists.
create table public.voka_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, user_id),
  check (finished_at is null or finished_at >= started_at)
);

create table public.voka_query_cards (
  query_id uuid not null,
  card_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  result text check (result in ('unknown', 'known', 'unsure')),
  answered_at timestamptz,
  primary key (query_id, card_id),
  foreign key (query_id, user_id) references public.voka_queries(id, user_id) on delete cascade,
  foreign key (card_id, user_id) references public.voka_cards(id, user_id) on delete cascade,
  check ((result is null) = (answered_at is null))
);

create index voka_subjectgroups_user_idx on public.voka_subjectgroups(user_id);
create index voka_subjects_user_group_idx on public.voka_subjects(user_id, group_id);
create index voka_lists_user_subject_idx on public.voka_lists(user_id, subject_id);
create index voka_cards_user_list_idx on public.voka_cards(user_id, list_id);
create index voka_cards_list_points_idx on public.voka_cards(list_id, success_count);
create index voka_queries_user_date_idx on public.voka_queries(user_id, started_at desc);
create index voka_query_cards_card_idx on public.voka_query_cards(card_id, user_id);

create function public.voka_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end
$$;
create trigger voka_lists_touch before update on public.voka_lists
  for each row execute function public.voka_touch_updated_at();
create trigger voka_cards_touch before update on public.voka_cards
  for each row execute function public.voka_touch_updated_at();

-- Authenticated owners can only access data while Voka access is enabled.
-- All referenced records must have the same owner (composite FKs above).
do $$
declare t text;
begin
  foreach t in array array['voka_subjectgroups','voka_subjects','voka_lists','voka_cards','voka_queries','voka_query_cards'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id and (select public.can_access_app(''voka''))) with check ((select auth.uid()) = user_id and (select public.can_access_app(''voka'')))',
      t || '_owner', t
    );
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
  end loop;
end
$$;

alter table public.voka_settings enable row level security;
create policy voka_settings_select on public.voka_settings for select to authenticated
 using ((select auth.uid()) = user_id and (select public.can_access_app('voka')));
create policy voka_settings_insert on public.voka_settings for insert to authenticated
 with check ((select auth.uid()) = user_id and (select public.can_access_app('voka')));
grant select,insert on public.voka_settings to authenticated;

-- Purely derived usage: last editing of a card or last answered query,
-- rather than list creation or changes to its metadata.
create view public.voka_list_usage with (security_invoker = true) as
select l.id as list_id, l.user_id,
  greatest(
    (select max(c.updated_at) from public.voka_cards c where c.list_id = l.id),
    (select max(coalesce(q.finished_at, qc.answered_at, q.started_at))
       from public.voka_cards c
       join public.voka_query_cards qc on qc.card_id = c.id and qc.result is not null
       join public.voka_queries q on q.id = qc.query_id
      where c.list_id = l.id)
  ) as last_used_at
from public.voka_lists l;
grant select on public.voka_list_usage to authenticated;

-- Initializes a new user's subjects exactly once. Users can thereafter
-- rename or delete every group and subject without automatic reseeding.
create function public.voka_initialize_defaults() returns void
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g uuid;
  seed_created uuid;
begin
  if uid is null or not public.can_access_app('voka') then
    raise exception 'Voka access denied' using errcode = '42501';
  end if;

  insert into public.voka_settings(user_id) values(uid)
    on conflict (user_id) do nothing returning user_id into seed_created;
  if seed_created is null then return; end if;

  insert into public.voka_subjectgroups(user_id,title) values
    (uid,'Sprachen'),(uid,'MINT'),(uid,'Sonstige');

  select id into g from public.voka_subjectgroups where user_id=uid and title='Sprachen';
  insert into public.voka_subjects(user_id,group_id,emoji,title) values
    (uid,g,'🇬🇧','Englisch'),(uid,g,'🇫🇷','Französisch'),
    (uid,g,'🏛️','Latein'),(uid,g,'🇬🇷','Griechisch');

  select id into g from public.voka_subjectgroups where user_id=uid and title='MINT';
  insert into public.voka_subjects(user_id,group_id,emoji,title) values
    (uid,g,'➗','Mathe'),(uid,g,'💻','Informatik'),(uid,g,'🌿','Bio'),
    (uid,g,'🌍','Erdkunde'),(uid,g,'⚛️','Physik'),(uid,g,'🧪','Chemie');

  select id into g from public.voka_subjectgroups where user_id=uid and title='Sonstige';
  insert into public.voka_subjects(user_id,group_id,emoji,title) values
    (uid,g,'🎨','Kunst'),(uid,g,'🎵','Musik');
end
$$;
revoke all on function public.voka_initialize_defaults() from public, anon;
grant execute on function public.voka_initialize_defaults() to authenticated;
revoke all on function public.voka_touch_updated_at() from public, anon, authenticated;
