-- Upgrades multiplayer_reactions (see multiplayer-category-blitz.sql) from
-- fixed-vocabulary emoji/phrase reactions to real free-text chat, now shared
-- by Category Blitz Versus's between-round chat AND Party mode's lobby/
-- results chat. assets/app.js chatSanitize() does light client-side
-- profanity-censoring and callers rate-limit client-side (chatCanSend) —
-- same client-trusted model as the rest of these tables, so this is a
-- courtesy filter, not a security boundary.

alter table multiplayer_reactions rename column emoji to message;

-- Party mode host-scheduled start time (see multiplayer-party.sql). Null
-- (the default) means "start whenever the host clicks Start" — unchanged
-- behavior. Every other game_mode ignores this column.
alter table multiplayer_rooms add column if not exists scheduled_start_at timestamptz;

-- Host can remove someone from the Party lobby. Banning (rather than just
-- deleting the roster row) is what stops the same browser/device from
-- immediately rejoining with the same or a different display name while the
-- room is still in 'waiting' — a different browser/device gets a fresh
-- player_id and isn't covered by this, same limitation as any code-shared
-- invite link with no account system behind it.
alter table multiplayer_players add column if not exists banned boolean not null default false;
