-- One-time setup for batched install notifications.
-- Run this once in the Supabase SQL editor (Dashboard → SQL).
--
-- Keeps a single running tally of installs per platform. bump_install() adds one
-- install, and when the running total hits p_batch it returns flushed=true with the
-- breakdown and resets the counters to 0 — so the Edge Function only messages
-- Telegram once per batch (e.g. every 10 installs).

create table if not exists install_counter (
  id      int  primary key default 1,
  android int  not null default 0,
  ios     int  not null default 0,
  other   int  not null default 0,
  constraint install_counter_singleton check (id = 1)
);

insert into install_counter (id) values (1) on conflict (id) do nothing;

-- Lock the table down: RLS on + no policies = anon/authenticated keys get ZERO
-- access via the auto REST API. The Edge Function calls in with the service-role
-- key, which bypasses RLS, so it keeps working.
alter table install_counter enable row level security;

create or replace function bump_install(p_platform text, p_batch int default 10)
returns table (android int, ios int, other int, flushed boolean)
language plpgsql
security definer
as $$
declare
  a int; i int; o int;
begin
  update install_counter set
    android = install_counter.android + (case when p_platform = 'android' then 1 else 0 end),
    ios     = install_counter.ios     + (case when p_platform = 'ios'     then 1 else 0 end),
    other   = install_counter.other   + (case when p_platform not in ('android','ios') then 1 else 0 end)
  where id = 1
  returning install_counter.android, install_counter.ios, install_counter.other
    into a, i, o;

  if (a + i + o) >= p_batch then
    update install_counter set android = 0, ios = 0, other = 0 where id = 1;
    return query select a, i, o, true;
  else
    return query select a, i, o, false;
  end if;
end;
$$;

-- Only the service-role key (used by the Edge Function) may call the RPC.
-- Without this, anon/authenticated could call it and inflate the counter, since
-- a security-definer function bypasses the table's RLS.
revoke all on function bump_install(text, int) from public;
grant execute on function bump_install(text, int) to service_role;
