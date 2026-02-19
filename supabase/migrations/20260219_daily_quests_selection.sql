alter table public.daily_quests
  add column if not exists candidate_options jsonb not null default '[]'::jsonb,
  add column if not exists is_selected boolean not null default false,
  add column if not exists selected_at timestamptz null;
