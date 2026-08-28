-- Optional: scheduled cleanup for the multiplayer tables (see
-- multiplayer-rooms.sql and multiplayer-category-blitz.sql, which must be
-- run first). Kept separate so a missing pg_cron extension can't block the
-- actual game schema — run this one on its own, after enabling pg_cron
-- under Database → Extensions in the Supabase dashboard.
--
-- Deletes finished/abandoned rooms older than 14 days, and "waiting" rooms
-- (created, never joined) older than 30 minutes.

create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-multiplayer-rooms',
  '0 3 * * *', -- daily at 03:00 UTC
  $$
    delete from multiplayer_rooms where status in ('finished', 'abandoned') and created_at < now() - interval '14 days';
    delete from multiplayer_rooms where status = 'waiting' and created_at < now() - interval '30 minutes';
  $$
);
