create table if not exists public.user_avatars (
  user_id bigint primary key references public.users(id) on delete cascade,
  name text not null default 'Rookie Hunter',
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level >= 1),
  battles_won integer not null default 0 check (battles_won >= 0),
  battles_lost integer not null default 0 check (battles_lost >= 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_avatar_game_progress (
  user_id bigint not null references public.users(id) on delete cascade,
  appid integer not null check (appid > 0),
  game_title text,
  unlocked_count integer not null default 0 check (unlocked_count >= 0),
  total_count integer not null default 0 check (total_count >= 0),
  game_xp integer not null default 0 check (game_xp >= 0),
  synced_at timestamptz not null default now(),
  primary key (user_id, appid)
);

create table if not exists public.avatar_battles (
  id bigserial primary key,
  group_id uuid references public.groups(id) on delete set null,
  appid integer,
  challenger_user_id bigint not null references public.users(id) on delete cascade,
  opponent_user_id bigint not null references public.users(id) on delete cascade,
  challenger_level integer not null check (challenger_level >= 1),
  opponent_level integer not null check (opponent_level >= 1),
  challenger_hp integer not null check (challenger_hp >= 0),
  opponent_hp integer not null check (opponent_hp >= 0),
  challenger_block integer not null default 0 check (challenger_block >= 0),
  opponent_block integer not null default 0 check (opponent_block >= 0),
  turn_user_id bigint not null references public.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'finished')),
  winner_user_id bigint references public.users(id) on delete set null,
  battle_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_user_id <> opponent_user_id)
);

create index if not exists avatar_battles_challenger_idx
  on public.avatar_battles(challenger_user_id, updated_at desc);

create index if not exists avatar_battles_opponent_idx
  on public.avatar_battles(opponent_user_id, updated_at desc);
