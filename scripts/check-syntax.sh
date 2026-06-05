#!/usr/bin/env bash
# Syntax-checks every game JS file and reports pass/fail.
# Usage: bash scripts/check-syntax.sh

PASS=0
FAIL=0

JS_FILES=(
  assets/admob.js
  assets/app.js
  assets/challenge.js
  assets/daily.js
  assets/daily-wordle.js
  assets/episode.js
  assets/leaderboard.js
  assets/profile.js
  assets/remove-ads.js
  assets/sound.js
  assets/survival.js
  assets/trivia-rush.js
  assets/versus.js
  assets/wordle.js
  assets/wordsearch.js
)

for f in "${JS_FILES[@]}"; do
  result=$(node --check "$f" 2>&1)
  if [ $? -eq 0 ]; then
    echo "  OK  $f"
    PASS=$((PASS + 1))
  else
    echo " FAIL $f"
    echo "      $result"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
