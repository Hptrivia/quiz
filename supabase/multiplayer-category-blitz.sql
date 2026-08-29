-- Extends the multiplayer tables (see multiplayer-rooms.sql) so Category
-- Blitz Versus Online can reuse them instead of getting its own schema.
--
-- Column reuse across modes (discriminated by game_mode):
--   multiplayer_rooms.theme_slugs   — trivia only; category-blitz leaves it null
--   multiplayer_rooms.question_ids  — trivia: question ids. category-blitz: ordered letters, e.g. ["Q","M","T"]
--   multiplayer_rooms.payload       — mode-specific config. category-blitz: { categories: [...], seconds: 45 }
--   multiplayer_answers.choice      — trivia only (the picked option text)
--   multiplayer_answers.score       — category-blitz: categories correct this round
--   multiplayer_answers.payload     — category-blitz: { answers: { name: "...", animal: "...", ... } }

alter table multiplayer_rooms alter column theme_slugs drop not null;
alter table multiplayer_rooms add column if not exists payload jsonb;

alter table multiplayer_answers add column if not exists score int;
alter table multiplayer_answers add column if not exists payload jsonb;

-- Continue-gate: each player sets their OWN row's `ready` to true when they
-- click Continue on the reveal screen. mpAdvanceRound only fires once both
-- rows for the round show ready=true, so one player can no longer jump to
-- the next letter while the other is still reviewing/contesting words.
-- Trivia Versus doesn't use this column (it already gates on both answer
-- rows existing before reveal, and advances on a timer after that).
alter table multiplayer_answers add column if not exists ready boolean not null default false;

-- Fixed-vocabulary reactions (no freeform chat — see conversation notes).
create table if not exists multiplayer_reactions (
  id           bigint generated always as identity primary key,
  room_code    text not null references multiplayer_rooms(code) on delete cascade,
  player_id    text not null,
  emoji        text not null,
  created_at   timestamptz not null default now()
);
create index if not exists multiplayer_reactions_room_idx on multiplayer_reactions (room_code, created_at);

alter table multiplayer_reactions enable row level security;
create policy "anon full access" on multiplayer_reactions
  for all using (true) with check (true);

-- Scheduled cleanup lives in its own file (multiplayer-cleanup-cron.sql) —
-- it depends on the pg_cron extension, which isn't enabled by default and
-- shouldn't be able to break this schema if it's missing.
