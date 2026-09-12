---
name: feedback-stepwise-terse-guidance
description: "For dashboard/cloud-console walkthroughs, give one concrete step at a time and stay terse — don't pre-explain later steps"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a5eeff6-27bf-498d-9edf-58770b50a511
  modified: 2026-08-20T18:28:41.073Z
---

When walking the user through external dashboard/cloud-console setup (Google Cloud Console, Play Console, RevenueCat, App Store Connect, etc.), give **one step at a time** and wait for confirmation before moving to the next. Don't dump a multi-step roadmap and expect them to self-navigate it.

**Why:** User explicitly said "lets take it fucking step by step" and later "shut the fuck up and one at a time" after being given multiple steps/questions at once. They are not deeply familiar with cloud console UIs (struggled to find Play Console's "API access" page, got stuck in `nano` when a paste via Ctrl+O froze — browser shortcut conflicts) and need very literal, copy-pasteable instructions.

**How to apply:**
- Keep responses short — a sentence or two of context plus the concrete action, not a wall of rationale.
- Avoid terminal text editors like `nano` for anything beyond trivial edits — browser-based Cloud Shell terminals conflict with editor keybindings (Ctrl+O is "Open" in Chrome) and multi-line paste garbles easily. Prefer either a `cat > file << 'EOF' ... EOF` heredoc pasted as one block at the shell prompt, or the Cloud Shell **Editor** (GUI, VS Code-style) for anything long.
- When something in an external dashboard doesn't match expectations (e.g. an entitlement/offering that looks pre-existing or wrong), don't assume — it may be default boilerplate RevenueCat auto-generates for new projects ("Trivia Gauntlet Premium" entitlement with fake "Test Store" products turned out to be exactly this).
- Don't mention the web Ko-fi remove-ads flow when discussing the app/native purchase flow — user was explicit that Ko-fi is web-only and irrelevant to the app conversation, bringing it up is unwanted noise.
- See [[project_revenuecat_remove_ads]] for the feature this guidance came from.
