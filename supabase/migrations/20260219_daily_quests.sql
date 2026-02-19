create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.users(id) on delete cascade,
  quest_date date not null,
  appid integer not null,
  game_title text not null,
  achievement_api_name text not null,
  achievement_display_name text not null,
  achievement_description text not null default '',
  achievement_icon text not null default '',
  quest_key text not null,
  reroll_count integer not null default 0,
  picks_history text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quest_date)
);

create index if not exists daily_quests_user_id_quest_date_idx
  on public.daily_quests (user_id, quest_date desc);
