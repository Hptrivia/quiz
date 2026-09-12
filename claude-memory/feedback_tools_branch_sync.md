---
name: feedback-tools-branch-sync
description: "Local-only tool files (trivia-builder.html, storage-viewer.html) live on the `tools` git branch; push once a round of changes/testing is actually finished, not after every single edit"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3cb949f1-754d-4c3f-bd29-8a3cb82e24e5
  modified: 2026-08-07T14:53:22.905Z
---

`trivia-builder.html` and `storage-viewer.html` are gitignored on `main` (GitHub Pages serves `main`'s root directly via the `CNAME` file — no build workflow — so committing them there would publish them live, and `trivia-builder.html` has an API-key input). They're backed up instead on a dedicated `tools` branch (pushed 2026-08-07, first commit `25a57f78`), which is never merged into `main` and never deployed.

**Why:** On 2026-08-07 the user lost a fuller version of `trivia-builder.html` from a prior codespace because it only ever existed on that codespace's local disk — never pushed anywhere. Same root cause as [[project-memory-not-persisted]]: anything not pushed to `origin` is gone when the codespace is deleted/rebuilt. However, later that same day, after being pushed to after every micro-edit, the user pushed back: while actively iterating/testing a batch of changes, don't push after each one — wait until they say the round is done.

**How to apply:** Edit the file locally (and keep the working copy in `/workspaces/quiz` and the `/workspaces/quiz-tools` worktree in sync) without pushing while the user is still actively testing/requesting changes in the same session. Once the user signals they're done with the round (e.g. "ok push it", "that's everything"), then: `git add -f <file>`, commit, `git push origin tools`. Still push before the *session* ends if there's any risk of losing unpushed work (e.g. long idle, user signing off) — the "don't push yet" instruction is about batching mid-session edits, not skipping the backup entirely. To recover the files in a fresh codespace: `git checkout tools -- trivia-builder.html storage-viewer.html`.
