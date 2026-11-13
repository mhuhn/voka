-- Composite indexes matching the foreign-key column order.
create index voka_subjects_group_owner_fk_idx on public.voka_subjects(group_id,user_id);
create index voka_lists_subject_owner_fk_idx on public.voka_lists(subject_id,user_id);
create index voka_cards_list_owner_fk_idx on public.voka_cards(list_id,user_id);
create index voka_query_cards_query_owner_fk_idx on public.voka_query_cards(query_id,user_id);
create index voka_query_cards_owner_fk_idx on public.voka_query_cards(user_id);
