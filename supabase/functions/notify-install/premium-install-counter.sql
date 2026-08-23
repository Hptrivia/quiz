-- One-time setup for the premium (paid, ad-free) apps' install counter.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL).
--
-- Separate from install_counter (the free app's batched tally) so premium
-- installs don't get lumped into the free app's per-10 Telegram batches.
-- Premium installs are rare enough that every one gets its own Telegram
-- ping instead of waiting for a batch.

create table if not exists premium_install_counter (
  id      int primary key default 1,
  ios     int not null default 0,
  android int not null default 0,
  constraint premium_install_counter_singleton check (id = 1)
);

insert into premium_install_counter (id) values (1) on conflict (id) do nothing;

-- Lock the table down: RLS on + no policies = anon/authenticated keys get ZERO
-- access via the auto REST API. The Edge Function calls in with the service-role
-- key, which bypasses RLS, so it keeps working.
alter table premium_install_counter enable row level security;

create or replace function bump_premium_install(p_platform text)
returns table (ios int, android int)
language plpgsql
security definer
as $$
declare
  i int; a int;
begin
  update premium_install_counter set
    ios     = premium_install_counter.ios     + (case when p_platform = 'ios'     then 1 else 0 end),
    android = premium_install_counter.android + (case when p_platform = 'android' then 1 else 0 end)
  where id = 1
  returning premium_install_counter.ios, premium_install_counter.android
    into i, a;

  return query select i, a;
end;
$$;

-- Only the service-role key (used by the Edge Function) may call the RPC.
revoke all on function bump_premium_install(text) from public;
grant execute on function bump_premium_install(text) to service_role;
