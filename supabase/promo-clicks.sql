-- promo_clicks: one row per install-promo tap in the mobile/desktop WEB build
-- (written client-side from assets/profile.js -> trackPromoClick with the public
-- anon key). Run this in the Supabase SQL editor (Dashboard -> SQL). Idempotent:
-- safe to re-run whether or not the table already exists.

create table if not exists promo_clicks (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  banner_id   text,        -- which promo (wall_store_btn, result_app_banner, quiz_theme_promo, ...)
  theme_slug  text,        -- theme the visitor was on (explicit, else derived from the URL)
  platform    text,        -- android / ios / desktop (from UA)
  session_id  text         -- stable per-browser id (localStorage tg_sid): unique people vs raw taps
);

-- 2026-07-06 attribution enrichment: what they were PLAYING + where they came FROM,
-- so we can tell which theme / mode / round / traffic-source drives install intent.
alter table promo_clicks add column if not exists game_mode  text;  -- challenge, marathon, wordle, survival, ...
alter table promo_clicks add column if not exists round      int;   -- challenge round in progress (else null)
alter table promo_clicks add column if not exists utm_source text;  -- explicit tag on pasted links (?utm_source=reddit)
alter table promo_clicks add column if not exists ref_host   text;  -- referring domain (google.com, t.co, direct)

create index if not exists promo_clicks_created_idx on promo_clicks (created_at);

-- Lock down reads: RLS on, anon may INSERT only (the client posts taps), never SELECT.
-- You read it in the dashboard (service role bypasses RLS).
alter table promo_clicks enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'promo_clicks'
      and policyname = 'promo_clicks_anon_insert'
  ) then
    create policy promo_clicks_anon_insert on promo_clicks
      for insert to anon with check (true);
  end if;
end $$;
