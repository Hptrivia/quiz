-- Real-time multiplayer (Versus Online) — room + per-round answer storage.
-- Client-trusted model (matches leaderboard.js / promo-clicks.sql): the anon
-- key talks to these tables directly from the browser/app, no Edge Function.
-- Clients poll (no Realtime channels needed), so no publication setup here.

create table if not exists multiplayer_rooms (
  code            text primary key,
  game_mode       text not null default 'versus',   -- future modes (e.g. category-blitz) reuse this table
  theme_slugs     text not null,                    -- comma-separated for a mashup, e.g. "pitt,wednesday"
  best_of         int not null,
  question_ids    jsonb not null,                    -- ordered array of question ids, decided once at creation
  host_id         text not null,
  host_name       text not null,
  host_score      int not null default 0,
  host_last_seen  timestamptz not null default now(),
  guest_id        text,
  guest_name      text,
  guest_score     int not null default 0,
  guest_last_seen timestamptz,
  current_round   int not null default 0,
  round_started_at timestamptz,
  status          text not null default 'waiting',   -- waiting | active | finished | abandoned
  created_at      timestamptz not null default now()
);

create table if not exists multiplayer_answers (
  id           bigint generated always as identity primary key,
  room_code    text not null references multiplayer_rooms(code) on delete cascade,
  round_num    int not null,
  player_id    text not null,
  choice       text,                -- null means "timed out, no answer"
  answered_at  timestamptz not null default now(),
  unique (room_code, round_num, player_id)
);

create index if not exists multiplayer_answers_room_round_idx
  on multiplayer_answers (room_code, round_num);

alter table multiplayer_rooms enable row level security;
alter table multiplayer_answers enable row level security;

-- Same trust level as the rest of the app's client-side Supabase tables:
-- anon key can read/write directly, no auth layer.
create policy "anon full access" on multiplayer_rooms
  for all using (true) with check (true);

create policy "anon full access" on multiplayer_answers
  for all using (true) with check (true);

-- Housekeeping: rooms created and never joined just sit there. Run this
-- occasionally (or wire to pg_cron later if volume ever justifies it):
--   delete from multiplayer_rooms where status = 'waiting' and created_at < now() - interval '30 minutes';
