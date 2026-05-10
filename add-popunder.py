#!/usr/bin/env python3
import os

root = '/workspaces/quiz'

PREMIUM_FN = "function isPremiumUser(){var e=localStorage.getItem('adsRemovedUntil');if(!e)return false;return new Date(e)>new Date();}"

# isPremiumUser-only scripts as they exist in these pages after Ad Stack 2
BLOG_PREMIUM = "<script>" + PREMIUM_FN + "</script>"
CAT_PREMIUM  = "  <script>" + PREMIUM_FN + "</script>"

POPUNDER = "<script>if(!isPremiumUser()){var _p=document.createElement('script');_p.src='https://pl29410724.profitablecpmratenetwork.com/70/cb/2b/70cb2b8046084e4d2a20f7c4e8fe6dda.js';document.head.appendChild(_p);}</script>"
CAT_POPUNDER = "  <script>if(!isPremiumUser()){var _p=document.createElement('script');_p.src='https://pl29410724.profitablecpmratenetwork.com/70/cb/2b/70cb2b8046084e4d2a20f7c4e8fe6dda.js';document.head.appendChild(_p);}</script>"

SKIP = {
    'survival.html','challenge.html','play.html','episode.html','daily.html',
    'trivia-rush.html','wordsearch.html','wordle.html','mashup.html',
    'mashup-play.html','mashup-trivia-rush.html','mashup-landing.html',
    'trivia-rush-test.html','remove-ads.html',
}

counts = {'general': 0, 'category': 0}

# --- Root general/blog pages ---
for fname in os.listdir(root):
    if not fname.endswith('.html') or fname in SKIP:
        continue
    # Skip themes directory files (we're in root)
    fp = os.path.join(root, fname)
    c = open(fp).read()
    if BLOG_PREMIUM not in c:
        continue
    c = c.replace(BLOG_PREMIUM, BLOG_PREMIUM + '\n' + POPUNDER, 1)
    open(fp, 'w').write(c)
    counts['general'] += 1

# --- Category pages ---
for fname in os.listdir(os.path.join(root, 'categories')):
    if not fname.endswith('.html'):
        continue
    fp = os.path.join(root, 'categories', fname)
    c = open(fp).read()
    if CAT_PREMIUM in c:
        c = c.replace(CAT_PREMIUM, CAT_PREMIUM + '\n' + CAT_POPUNDER, 1)
        open(fp, 'w').write(c)
        counts['category'] += 1
    elif BLOG_PREMIUM in c:
        c = c.replace(BLOG_PREMIUM, BLOG_PREMIUM + '\n' + POPUNDER, 1)
        open(fp, 'w').write(c)
        counts['category'] += 1

print(f"General/blog pages: {counts['general']}")
print(f"Category pages:     {counts['category']}")
