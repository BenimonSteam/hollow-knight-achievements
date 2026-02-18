create table if not exists public.group_feed_comments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id text not null,
  user_id bigint not null references public.users(id) on delete cascade,
  text text not null check (char_length(text) > 0 and char_length(text) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists group_feed_comments_group_id_event_id_created_at_idx
  on public.group_feed_comments (group_id, event_id, created_at asc);

create index if not exists group_feed_comments_group_id_created_at_idx
  on public.group_feed_comments (group_id, created_at desc);
