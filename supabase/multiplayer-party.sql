-- Extends the multiplayer tables (see multiplayer-rooms.sql) so Party mode
-- (N players, not just 2) can reuse them instead of getting its own schema.
-- 2-player Versus and Category Blitz Versus are untouched — they keep using
-- multiplayer_rooms.host_id/guest_id directly. Party mode ignores those two
-- columns entirely and keeps its roster in the new multiplayer_players table
-- instead, since "host slot + guest slot" doesn't generalize past 2 players.
--
-- Column reuse across modes (discriminated by game_mode):
--   multiplayer_rooms.game_mode     — 'party' for this mode
--   multiplayer_rooms.payload       — party: { subMode: "score" | "survival" }
--   multiplayer_rooms.question_ids  — same as trivia Versus: ordered question ids
--   multiplayer_rooms.guest_id etc  — unused for party; roster is multiplayer_players
--   multiplayer_answers.score       — party: 1 if that round's answer was correct, else 0.
--                                      Summed per player_id for the "score" subMode
--                                      scoreboard. In "survival" subMode, a 0 here is
--                                      also what flips that player's multiplayer_players
--                                      row to eliminated=true.

create table if not exists multiplayer_players (
  room_code   text not null references multiplayer_rooms(code) on delete cascade,
  player_id   text not null,
  name        text not null,
  is_host     boolean not null default false,
  eliminated  boolean not null default false,
  joined_at   timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (room_code, player_id)
);

create index if not exists multiplayer_players_room_idx on multiplayer_players (room_code);

alter table multiplayer_players enable row level security;
create policy "anon full access" on multiplayer_players
  for all using (true) with check (true);
