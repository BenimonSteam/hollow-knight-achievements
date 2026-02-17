create table if not exists public.group_leaderboards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  appid integer not null,
  title text null,
  created_by_user_id bigint not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists group_leaderboards_group_id_appid_uidx
  on public.group_leaderboards (group_id, appid);

create index if not exists group_leaderboards_group_id_created_at_idx
  on public.group_leaderboards (group_id, created_at desc);
