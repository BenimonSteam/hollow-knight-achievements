alter table public.groups
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'groups_description_length_check'
  ) then
    alter table public.groups
      add constraint groups_description_length_check
      check (description is null or char_length(description) <= 500);
  end if;
end
$$;
