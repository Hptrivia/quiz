-- Reddit posting planner (post-planner.html): private post log + per-sub state.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL). Idempotent:
-- safe to re-run.
--
-- Every row carries an `owner` (the logged-in user's id, filled in
-- automatically) and RLS only ever lets a signed-in user see or change their
-- own rows. The anon key alone gets nothing. Create the login under
-- Authentication -> Users -> Add user (tick "Auto confirm").

-- One row per subreddit.
create table if not exists rp_subs (
  owner        uuid not null default auth.uid(),
  sub          text not null,              -- lowercase, no "r/"
  display      text,                       -- original casing, e.g. "TheOffice"
  show_slug    text,                       -- data/themes.json slug
  status       text not null default 'works',  -- works | mod_removed | never | banned | temp_ban
  status_until date,                       -- temp ban end
  snooze_until date,                       -- "come back in N weeks"
  skip_on      date,                       -- "not today"
  members      integer,                    -- subscriber count, for the 150k multiplayer rule
  notes        text,
  updated_at   timestamptz not null default now(),
  primary key (owner, sub)
);

-- One row per Reddit post.
create table if not exists rp_posts (
  id         bigint generated always as identity primary key,
  owner      uuid not null default auth.uid(),
  posted_on  date not null,
  sub        text not null,                -- lowercase, matches rp_subs.sub
  show_slug  text,
  format     text,                         -- trivia | episode | multiplayer | character | fan | '' (unknown)
  episode    integer,                      -- episode number for episode posts
  link       text,                         -- web | app | '' (unknown)
  outcome    text not null default 'unknown', -- unknown | stayed | removed_instant | removed_later | removed | pending | banned | deleted
  rating     text,                         -- flop | ok | great (for your reference; never changes timing)
  views      integer,
  note       text,
  source     text not null default 'manual', -- import | manual | suggest | plan
  created_at timestamptz not null default now()
);
-- Added after the first version: safe if the table already existed without them.
alter table rp_posts add column if not exists rating text;
alter table rp_posts add column if not exists views  integer;
create index if not exists rp_posts_owner_sub_idx  on rp_posts (owner, sub);
create index if not exists rp_posts_owner_date_idx on rp_posts (owner, posted_on);

-- One row per show you've reviewed or annotated.
create table if not exists rp_shows (
  owner     uuid not null default auth.uid(),
  slug      text not null,
  reviewed  boolean not null default false,
  notes     text,
  primary key (owner, slug)
);

-- Single settings row: the saved 3-month plan, cooldowns.
create table if not exists rp_settings (
  owner uuid primary key default auth.uid(),
  data  jsonb not null default '{}'::jsonb
);

alter table rp_subs     enable row level security;
alter table rp_posts    enable row level security;
alter table rp_shows    enable row level security;
alter table rp_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rp_subs','rp_posts','rp_shows','rp_settings'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on %I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())',
        t || '_own', t);
    end if;
  end loop;
end $$;
