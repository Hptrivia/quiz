---
name: feedback-surface-migration-steps
description: "Announce a required Supabase SQL migration the moment it's written, not only when the user asks — don't make them discover it via a broken feature."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4077a500-ceda-410e-8ece-f4f63042a572
  modified: 2026-09-03T20:57:36.166Z
---

When a change requires the user to run a `.sql` file in the Supabase dashboard before the code works (new column, new table, renamed column), say so immediately, in the same message as the code change — don't wait for the user to ask "do I need to do anything in Supabase?"

**Why:** during the 2026-09-03 Party mode chat/scheduling session, several features (scheduled-start countdown, host-kick) were built across multiple turns that all depended on `supabase/multiplayer-chat.sql`. The requirement was only mentioned once the user directly asked. In the meantime the user manually tested and saw a confusing partial failure (host's own screen showed a countdown optimistically, but new joiners saw nothing, because the underlying DB write was silently failing on a missing column) and had to debug it themselves before finding out a migration was pending. Reaction was pointed: "are u daft when were u going to tell me that." Worse, this app's Supabase writes are hit by the local smoke-test suite too (hardcoded to the live project, not a sandbox) — so an unrun migration doesn't just block manual testing, it makes the automated test suite fail in a way that looks like a real regression ("never reached end screen") until the missing step is identified.

**How to apply:** any time a task in this repo touches a `supabase/*.sql` file, the very next message must say, plainly and up front: "run `supabase/<file>.sql` in the Supabase SQL editor before testing this" — not buried, not deferred to "if you hit issues." Treat it as part of "done," not an FYI. See [[project_party_mode_multiplayer]] for the incident this came from.
