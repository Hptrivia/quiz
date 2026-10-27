-- Quick Match (Versus vs the 🤖 bot) — one row per match, for seeing who
-- plays the bot, how it goes, and where people quit. The match itself runs
-- entirely on the player's device; this table is only a log. Kept separate
-- from multiplayer_rooms so bot games never mix into real-player numbers or
-- the stuck-room cleanup.
--
-- Row is inserted when the match starts, updated after every question
-- (rounds_played + scores) and once more when it ends (finished = true).
-- A row left at finished = false means the player quit partway.

create table if not exists quick_matches (
  id            uuid primary key,
  player_id     text not null,            -- same tg_player_id the friend games use
  player_name   text,
  platform      text,                     -- app | web
  theme_slugs   text not null,            -- comma-separated for a mashup
  best_of       int not null,
  bot_name      text not null,
  bot_skill     real not null,            -- 0 easy … 2 hard, at match start
  source        text,                     -- setup | waiting_room | rematch
  my_score      int not null default 0,
  bot_score     int not null default 0,
  rounds_played int not null default 0,
  result        text,                     -- win | loss | draw (null until finished)
  finished      boolean not null default false,
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists quick_matches_started_idx on quick_matches (started_at desc);

alter table quick_matches enable row level security;

-- Same trust level as multiplayer_rooms: anon key reads/writes directly.
create policy "anon full access" on quick_matches
  for all using (true) with check (true);

-- Handy views of the data:
--   select date(started_at), count(*), count(*) filter (where finished),
--          round(avg(extract(epoch from finished_at - started_at)) filter (where finished)) as avg_secs
--   from quick_matches group by 1 order by 1 desc;
