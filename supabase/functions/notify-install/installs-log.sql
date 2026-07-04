-- One-time setup for PER-DAY install history.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL).
--
-- install_counter (see install-counter.sql) is only a reset-on-flush batch buffer
-- for the Telegram pings, so it keeps no history. This table stores one dated row
-- per install instead, so you can chart installs per day and line them up against
-- promo_clicks (banner taps).

create table if not exists installs_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  platform   text
);

-- Lock it down: RLS on + no policies = anon/authenticated keys get ZERO access
-- via the auto REST API. The Edge Function writes with the service-role key, which
-- bypasses RLS; you read it in the dashboard (also bypasses RLS).
alter table installs_log enable row level security;

create index if not exists installs_log_created_idx on installs_log (created_at);
