---
name: feedback-github-actions-dispatch-vs-rerun
description: "GitHub Actions 're-run jobs' replays the ORIGINAL commit's workflow code, not latest main - only secrets are read fresh. Caused repeated confusion debugging the iOS CI pipeline."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a01c5781-6205-4e3e-924a-50a5c96cb525
  modified: 2026-08-23T15:02:52.972Z
---

When iterating on a `.yml` workflow file with this user across multiple pushes, clicking "Re-run jobs" on an existing failed run does **not** pick up new commits to the workflow file — it re-executes against the exact commit SHA the run was originally dispatched with. Only a fresh "Run workflow" dispatch (from the workflow's own Actions page) uses the latest `main`.

**Why this matters:** GitHub Actions secrets ARE read fresh at execution time regardless of re-run vs fresh dispatch, so a secret-value fix (e.g. a wrong password) will appear to "work" on a re-run even while workflow-code fixes silently don't apply — producing the exact same error repeatedly and looking like the fix failed. This is genuinely confusing to debug from the run list alone, since `gh run list` shows the same run ID across attempts either way.

**How to apply:** after pushing any workflow-code fix (not just a secret change), explicitly tell the user to use "Run workflow" from the workflow's Actions page — not the "Re-run" button on a failed run's page — and verify via `gh run list` that a **new run ID** appeared before assuming the fix was tested. If the run ID is unchanged, the code fix wasn't actually exercised.

Also: when writing secret values to a file for the user to copy-paste into GitHub's secret UI, use `printf '%s'` (not `echo`), since `echo` appends a trailing newline that gets included in a naive select-all-copy and silently breaks exact-match secrets like passwords or profile names (`security import` / `xcodebuild`'s "no profile found" errors were both this in the iOS Premium app work — see [[project_ios_premium_app]]).
