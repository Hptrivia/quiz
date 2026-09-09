-- One-time setup for install-ping rate limiting.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL).
--
-- The install-ping endpoint's URL + anon key are visible to anyone who views
-- the site's public JS (assets/admob.js) and can be curled directly, bypassing
-- the app entirely and the client-side once-per-device localStorage flag with
-- it. This is a cheap backstop: one accepted ping per source IP per window,
-- so a curl loop can't spam fake installs into the counters or Telegram.

create table if not exists install_ping_recent (
  ip        text primary key,
  last_ping timestamptz not null default now()
);

-- Lock it down: RLS on + no policies = anon/authenticated keys get ZERO access
-- via the auto REST API. The Edge Function calls in with the service-role key,
-- which bypasses RLS, so it keeps working.
alter table install_ping_recent enable row level security;

-- Atomically checks + records: if this ip has no row, or its row is older than
-- p_window_seconds, upsert last_ping = now() and return true (allowed). If its
-- row is within the window, the update is skipped (WHERE guards it) and this
-- returns false (blocked) without touching last_ping, so the window is judged
-- from the *first* ping of a burst, not extended forever by a tight loop.
create or replace function check_install_rate_limit(p_ip text, p_window_seconds int default 120)
returns boolean
language plpgsql
security definer
as $$
declare
  allowed boolean;
begin
  insert into install_ping_recent (ip, last_ping)
  values (p_ip, now())
  on conflict (ip) do update
    set last_ping = now()
    where install_ping_recent.last_ping < now() - (p_window_seconds || ' seconds')::interval
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

-- Only the service-role key (used by the Edge Function) may call the RPC.
revoke all on function check_install_rate_limit(text, int) from public;
grant execute on function check_install_rate_limit(text, int) to service_role;
