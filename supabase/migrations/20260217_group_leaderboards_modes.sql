alter table public.group_leaderboards
  add column if not exists mode text not null default 'overall_progress',
  add column if not exists tracked_achievement_api_names text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_leaderboards_mode_check'
  ) then
    alter table public.group_leaderboards
      add constraint group_leaderboards_mode_check
      check (mode in ('overall_progress', 'rarest_10', 'custom'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_leaderboards_custom_requires_tracked_check'
  ) then
    alter table public.group_leaderboards
      add constraint group_leaderboards_custom_requires_tracked_check
      check (
        mode <> 'custom'
        or coalesce(array_length(tracked_achievement_api_names, 1), 0) > 0
      );
  end if;
end $$;
