-- attribution_survey: "Where did you originally find us?" prompt shown in the
-- free native app (not premium, not web) — shown on app-opens #1, #2 and #4
-- (3 attempts total), until answered or attempts run out. Written
-- client-side from assets/attribution-survey.js
-- with the public anon key (same project as promo_clicks / leaderboards).
-- Run this once in the Supabase SQL editor (Dashboard -> SQL). Idempotent:
-- safe to re-run whether or not the table already exists.

create table if not exists attribution_survey (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  source      text not null,   -- google_search / reddit / other (older rows may hold reddit_web_link / reddit_app_link)
  detail      text,            -- optional free text: search term / show or subreddit (for Reddit) / wherever
  platform    text,            -- android / ios (Capacitor.getPlatform())
  session_id  text             -- tg_sid, same stable per-device id used elsewhere
);

create index if not exists attribution_survey_created_idx on attribution_survey (created_at);
create index if not exists attribution_survey_source_idx  on attribution_survey (source);

-- Lock down reads: RLS on, anon may INSERT only (the client posts answers),
-- never SELECT. Read it in the dashboard (service role bypasses RLS), or via
-- the summary view below.
alter table attribution_survey enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attribution_survey'
      and policyname = 'attribution_survey_anon_insert'
  ) then
    create policy attribution_survey_anon_insert on attribution_survey
      for insert to anon with check (true);
  end if;
end $$;

-- Quick distribution check -- run this directly in the SQL editor:
--   select * from attribution_survey_summary;
-- Shows answer counts per source plus how many included a written-in detail
-- (subreddit / search term / other text), so you can see both "where" and
-- how many bothered to say more.
create or replace view attribution_survey_summary as
select
  source,
  count(*) as total,
  count(*) filter (where detail is not null and detail <> '') as with_detail,
  max(created_at) as last_answered
from attribution_survey
group by source
order by total desc;
