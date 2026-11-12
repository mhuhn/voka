-- Keep all Sprachen list answers labeled with the subject title.
-- For newly created Sprachen lists, default the question label to Deutsch.
create function public.voka_language_list_labels()
returns trigger language plpgsql set search_path='' as $$
declare v_language text;
begin
  select s.title into v_language
    from public.voka_subjects s
    join public.voka_subjectgroups g on g.id=s.group_id and g.user_id=s.user_id
   where s.id=new.subject_id and s.user_id=new.user_id and g.title='Sprachen';
  if v_language is not null then
    new.answer_label := v_language;
    if tg_op='INSERT' and new.question_label='Frage' then
      new.question_label := 'Deutsch';
    end if;
  end if;
  return new;
end
$$;
create trigger voka_language_list_labels_before_write
before insert or update of subject_id,answer_label
on public.voka_lists for each row
execute function public.voka_language_list_labels();

create function public.voka_language_subject_renamed()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.title is distinct from old.title or new.group_id is distinct from old.group_id then
    update public.voka_lists l set answer_label=new.title
    where l.subject_id=new.id and l.user_id=new.user_id
      and exists (
        select 1 from public.voka_subjectgroups g
         where g.id=new.group_id and g.user_id=new.user_id and g.title='Sprachen'
      );
  end if;
  return new;
end
$$;
create trigger voka_language_subject_renamed_after_write
after update of title,group_id on public.voka_subjects for each row
execute function public.voka_language_subject_renamed();

-- Reconcile existing language lists without changing their custom question labels.
update public.voka_lists l
   set answer_label=s.title
  from public.voka_subjects s
  join public.voka_subjectgroups g on g.id=s.group_id and g.user_id=s.user_id
 where l.subject_id=s.id and l.user_id=s.user_id
   and g.title='Sprachen' and l.answer_label is distinct from s.title;

revoke execute on function public.voka_language_list_labels() from public,anon,authenticated;
revoke execute on function public.voka_language_subject_renamed() from public,anon,authenticated;
