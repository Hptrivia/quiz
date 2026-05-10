#!/usr/bin/env python3
import os, re

root = '/workspaces/quiz'

PREMIUM_FN = "function isPremiumUser(){var e=localStorage.getItem('adsRemovedUntil');if(!e)return false;return new Date(e)>new Date();}"

THEME_OLD   = "  <script>" + PREMIUM_FN + "if(!isPremiumUser()){(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>"
THEME_NEW   = "  <script>" + PREMIUM_FN + "</script>"

CAT_OLD     = "  <script>" + PREMIUM_FN + "if(!isPremiumUser()){(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>"
CAT_NEW     = "  <script>" + PREMIUM_FN + "</script>"

BLOG_OLD    = "<script>" + PREMIUM_FN + "if(!isPremiumUser()){(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>"
BLOG_NEW    = "<script>" + PREMIUM_FN + "</script>"

PLAY_OLD    = "<script>" + PREMIUM_FN + "if(!isPremiumUser()){(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));}</script>"
PLAY_NEW    = "<script>" + PREMIUM_FN + "</script>"

CHALLENGE_OLD_SOCIAL = "  <script>if(!isPremiumUser()&&new URLSearchParams(window.location.search).get('round')==='2'){var _as=document.createElement('script');_as.src='https://pl29378740.profitablecpmratenetwork.com/54/0b/d4/540bd45393d3b426f087b18680fbe67c.js';document.body.appendChild(_as);}</script>"
SOCIAL_BAR = "  <script>if(!isPremiumUser()){var _as=document.createElement('script');_as.src='https://pl29378740.profitablecpmratenetwork.com/54/0b/d4/540bd45393d3b426f087b18680fbe67c.js';document.body.appendChild(_as);}</script>"

BANNER = """    <div style="text-align:center;margin:10px 0;">
      <script>if(!isPremiumUser()){atOptions={'key':'b9be7f308767ec033bd304d299704695','format':'iframe','height':50,'width':320,'params':{}};}</script>
      <script>if(!isPremiumUser()){document.write('<scr'+'ipt src="https://www.highperformanceformat.com/b9be7f308767ec033bd304d299704695/invoke.js"><\\/scr'+'ipt>');}</script>
    </div>"""

def after_body(content):
    m = re.search(r'<body[^>]*>', content)
    if m:
        i = m.end()
        return content[:i] + '\n' + BANNER + '\n' + content[i:]
    return content

def after_theme_top_links(content):
    idx = content.find('<div class="theme-top-links">')
    if idx == -1:
        return content
    close_idx = content.find('    </div>', idx)
    if close_idx == -1:
        return content
    i = close_idx + len('    </div>')
    return content[:i] + '\n\n' + BANNER + '\n' + content[i:]

def add_social_bar(content):
    return content.replace('</body>', SOCIAL_BAR + '\n</body>', 1)

SKIP = {
    'shameless.html','survival.html','episode.html','mashup.html',
    'wordsearch.html','wordle.html','daily.html','challenge.html',
    'play.html','trivia-rush.html','mashup-play.html','trivia-rush-test.html',
    'mashup-trivia-rush.html','remove-ads.html','mashup-landing.html',
}

counts = {'theme': 0, 'general': 0, 'category': 0, 'play': 0}

# --- Theme pages ---
for fname in os.listdir(os.path.join(root, 'themes')):
    if not fname.endswith('.html') or fname == 'shameless.html':
        continue
    fp = os.path.join(root, 'themes', fname)
    c = open(fp).read()
    if THEME_OLD not in c:
        continue
    c = c.replace(THEME_OLD, THEME_NEW)
    c = after_theme_top_links(c)
    open(fp, 'w').write(c)
    counts['theme'] += 1

# --- General / blog pages ---
for fname in os.listdir(root):
    if not fname.endswith('.html') or fname in SKIP:
        continue
    fp = os.path.join(root, fname)
    c = open(fp).read()
    if BLOG_OLD not in c:
        continue
    c = c.replace(BLOG_OLD, BLOG_NEW)
    c = after_body(c)
    open(fp, 'w').write(c)
    counts['general'] += 1

# --- Category pages ---
for fname in os.listdir(os.path.join(root, 'categories')):
    if not fname.endswith('.html'):
        continue
    fp = os.path.join(root, 'categories', fname)
    c = open(fp).read()
    if CAT_OLD not in c:
        continue
    c = c.replace(CAT_OLD, CAT_NEW)
    c = after_body(c)
    open(fp, 'w').write(c)
    counts['category'] += 1

# --- Play pages ---
for fname in ['survival.html','episode.html','mashup.html','wordsearch.html','wordle.html','daily.html']:
    fp = os.path.join(root, fname)
    c = open(fp).read()
    if PLAY_OLD not in c:
        print(f'WARNING: play script not found in {fname}')
        continue
    c = c.replace(PLAY_OLD, PLAY_NEW)
    c = add_social_bar(c)
    open(fp, 'w').write(c)
    counts['play'] += 1

# --- challenge.html ---
fp = os.path.join(root, 'challenge.html')
c = open(fp).read()
c = c.replace(CHALLENGE_OLD_SOCIAL, SOCIAL_BAR)
open(fp, 'w').write(c)

print(f"Theme pages:    {counts['theme']}")
print(f"General/blog:   {counts['general']}")
print(f"Category pages: {counts['category']}")
print(f"Play pages:     {counts['play']}")
print(f"challenge.html: done")
