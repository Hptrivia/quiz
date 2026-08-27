-- One-time script — run in the Supabase SQL Editor (dashboard), not via CI.
-- Logs words Category Blitz didn't recognize, for later human review and
-- folding into the next wordlist generation pass. Anon key can insert only —
-- no select policy, same lockdown as the existing promo_clicks table.

create table if not exists catblitz_candidates (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  category_id text not null,   -- 'name' | 'animal' | 'place' | 'thing' | custom free-text (Versus)
  letter      text not null,   -- single uppercase letter
  word        text not null,   -- cbNormalize()'d word as typed
  mode        text,            -- 'daily' | 'solo' | 'versus'
  confirmed   boolean,         -- Versus opponent-confirmed "yes" = true; Daily/Solo silent miss = null
  session_id  text
);

create index if not exists catblitz_candidates_lookup_idx
  on catblitz_candidates (category_id, letter);

alter table catblitz_candidates enable row level security;

create policy catblitz_candidates_anon_insert on catblitz_candidates
  for insert to anon with check (true);
-- no select policy: anon can only insert, same lockdown as promo_clicks
