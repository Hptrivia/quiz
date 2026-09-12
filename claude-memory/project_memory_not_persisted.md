---
name: project-memory-not-persisted
description: "Claude Code memory did not carry over from the user's prior codespace"
metadata: 
  node_type: memory
  type: project
  originSessionId: 259d5125-1f55-43ba-be12-e54f5b505e05
  modified: 2026-08-05T19:37:01.870Z
---

On 2026-08-05, this project's Claude Code memory directory (`~/.claude/projects/-workspaces-quiz/memory/`) was found completely empty — no `MEMORY.md`, no memory files anywhere on the machine — even though the user expected memories saved from an earlier codespace session to be present ("I had it saved on my old codespaces").

**Why:** `~/.claude` lives in the codespace container's home directory, not in the git repo, so it is not committed/versioned and is not guaranteed to persist across a rebuilt or new codespace instance.

**How to apply:** Don't assume prior-session memory persists across a codespace rebuild for this user — verify the memory directory actually has content before relying on it. If the user wants something to reliably survive environment changes, suggest putting it in a repo file (e.g. a `CLAUDE.md`, which does not currently exist in this repo) instead of / in addition to Claude Code memory.
