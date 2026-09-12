---
name: feedback-cost-conscious-ai-calls
description: User is strongly cost-sensitive about Claude API usage inside his own tools (trivia-builder.html) — default to cheap/fast, don't spend extra tokens without being asked
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3cb949f1-754d-4c3f-bd29-8a3cb82e24e5
  modified: 2026-08-07T15:29:28.866Z
---

When building/editing features in `trivia-builder.html` (or any tool that calls the Claude API on the user's own API key), default to the cheapest option that gets the job done, and don't add cost/latency without being asked.

**Why:** On 2026-08-07 the user reacted angrily to discovering the tool defaulted to `claude-opus-5` (the most expensive model) and to being shown a model-picker dropdown he never asked for ("did i fucking ask u to give options of versions to use"). Separately, he complained "AI Options" was "taking ages" — root cause was Claude Sonnet 5 running adaptive (extended) thinking by default since the request never set `thinking`, which burns extra latency *and* billed reasoning tokens for what were simple structured-JSON tasks (regenerate distractors, rephrase a question, parse freeform notes into questions).

**How to apply:**
- Default AI-calling code to `claude-sonnet-5`, not Opus, unless the user asks for higher quality.
- Explicitly set `thinking: {type: "disabled"}` on requests that are simple/structured (JSON-schema extraction, short rewrites) — don't leave `thinking` unset, since several current models (Sonnet 5, Opus 5) run adaptive thinking by default when omitted, which costs more and is slower.
- Don't add a model-picker / options UI unless asked — just pick the sensible default and move on. See [[feedback-fewer-options-more-action]] if that memory exists, or just: don't offer choices the user didn't request.
- If a task genuinely needs deeper reasoning (e.g. recalling correct trivia answers from memory, judging difficulty), it's a real tradeoff — flag it to the user rather than silently picking the expensive path, but bias toward cheap/fast by default given this preference.
