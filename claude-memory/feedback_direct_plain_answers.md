---
name: feedback-direct-plain-answers
description: "Answer with the concrete file/mechanism first in plain English; don't reuse internal jargon as the explanation; avoid multi-choice clarifying-question UI when a reasonable default exists"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6cb555e3-a074-408a-a4ca-c8ebc302898d
  modified: 2026-08-28T20:55:15.125Z
---

Give the concrete answer (which file, which line, what it does) in plain language before or instead of naming internal function/variable names as if they were self-explanatory. Example: explaining a gate by saying "it checks `isLimitedWeb()`" without translating what that means in practice drew direct anger ("stop fucking explaining with is limited web like i am supposed to understand that"). State the real-world effect first ("this makes the app stop showing question limits and download nags to a paying customer"), and only mention the function name as a pointer for verification, not as the explanation itself.

**Why:** user is a solo non-developer-background operator (see [[user_trivia_gauntlet_owner]]) who wants to understand *what will happen*, not trace the codebase's internal naming. Repeating jargon back at them reads as not having actually explained anything.

**How to apply:**
- Lead every technical answer with the plain-English behavior change, not the mechanism name.
- When correcting a wrong premise (e.g. "doesn't X already show on the web?"), say directly whether the premise is right or wrong before explaining why — don't bury the correction.
- Avoid `AskUserQuestion` multi-choice prompts for things that have a sensible default or where the user is likely to want to type a nuanced free-form answer — this user rejected it twice in one session, once explicitly asking to "just clarify" in plain text instead. Prefer: state the reasonable assumption/default and proceed, or ask a plain single-sentence question in prose, reserving the structured tool for genuinely hard either/or forks with no clear default (e.g. a permanent, unrecoverable choice like a Play Store package name).
- When re-explaining the same mechanism multiple times in a thread (this happens — the user asks "how does X not show" from several angles), each answer should still lead with plain language, not assume the jargon from three messages ago stuck.

See also [[feedback_stepwise_terse_guidance]], [[feedback_verify_before_asserting]].

**Reinforced 2026-08-28 (online multiplayer for Versus/Category Blitz build):** during a long architecture discussion, dumping all 3 open design points in one message ("point 1... point 2... point 3...") drew "..yeah no i just said lets fucking discuss one after the other." Discuss exactly one open question per message and wait for a response before raising the next, even if several are queued up. Also reconfirmed the AskUserQuestion aversion specifically for architecture/design forks (not just clarifying questions) — "not asking me to pick one is a stupid decision" then, moments later, "lets fucking discuss one after the other" when prose was offered instead — the fix isn't tool-vs-prose, it's **one question per turn**, in prose, and let the user answer free-form rather than presenting it as a locked set of options.
