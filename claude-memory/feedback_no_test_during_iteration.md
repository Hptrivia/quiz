---
name: feedback-no-test-during-iteration
description: "Don't re-run smoke/test scripts after every small tweak while the user is still actively iterating on a feature"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c99d3b5d-ff4b-4b31-9f3e-ac312f2f79a7
  modified: 2026-09-03T16:02:05.835Z
---

Don't re-run the Puppeteer smoke test (or similar slow verification scripts) after each small UI/code tweak while the user is mid-iteration on a feature — e.g. running the full 10-player party-mode smoke test again immediately after a CSS/copy change during [[project_party_mode_multiplayer]]'s build.

**Why:** User explicitly told me to stop ("stop running smoke tests every 5 minutes when we are still making changes") — it's slow (2+ min per run) and adds no value between rapid successive edits; only worth running at a real checkpoint.

**How to apply:** During active back-and-forth UI/logic iteration, just do a fast syntax check (`node --check`) after edits and keep moving. Only run the full test suite again when the user asks, when a batch of changes is "done" for now, or right before saying a feature is ready to review/commit.
