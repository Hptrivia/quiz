#!/usr/bin/env python3
"""Remove all ad scripts and wrappers from every HTML file in the project."""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# -- Patterns to remove (order matters: most specific first) --

PATTERNS = [
    # grow.me script (single line or multi-line, non-greedy)
    re.compile(
        r'\s*<script\s+data-grow-initializer[^>]*>.*?</script>',
        re.DOTALL
    ),

    # isPremiumUser function script (standalone)
    re.compile(
        r'\s*<script>function isPremiumUser\(\)\{[^<]*\}</script>'
    ),

    # Gated block: isPremiumUser fn + vignette/IPP/popunder calls in one script
    re.compile(
        r'\s*<script>function isPremiumUser\(\)\{[^<]*\}if\(!isPremiumUser\(\)\)\{[^<]*</script>'
    ),

    # Top banner div (wraps two highperformanceformat scripts, no id)
    re.compile(
        r'\s*<div style="text-align:center;margin:[^"]*">\s*'
        r'<script>if\(!isPremiumUser\(\)\)\{atOptions[^<]*\}</script>\s*'
        r'<script>if\(!isPremiumUser\(\)\)\{document\.write[^<]*\}</script>\s*'
        r'</div>',
        re.DOTALL
    ),

    # Mid/bottom banner div (has an id, dynamic script injection)
    re.compile(
        r'\s*<div id="(?:mid|bottom)-banner-ad"[^>]*>.*?</div>',
        re.DOTALL
    ),

    # Page-specific vignette/IPP/popunder one-liner (condition on page/episode/round)
    re.compile(
        r'\s*<script>if\(!isPremiumUser\(\)\)\{var _[a-z]+=parseInt[^<]*n6wxm\.com[^<]*</script>'
    ),

    # Any remaining isPremiumUser-gated single-line script (atOptions, document.write, etc.)
    re.compile(
        r'\s*<script>if\(!isPremiumUser\(\)\)\{.*?</script>',
        re.DOTALL
    ),

    # Any remaining standalone isPremiumUser-gated script block
    re.compile(
        r'\s*<script>\s*if\(!isPremiumUser\(\)\)\{.*?\}\s*</script>',
        re.DOTALL
    ),

    # Orphaned top-banner wrapper div (left after inner scripts removed)
    re.compile(
        r'\s*<div style="text-align:center;margin:[^"]*">\s*</div>'
    ),

    # Footer "Ad-Free" link
    re.compile(
        r'\s*<a id="removeAdsLink"[^>]*>Ad-Free</a>'
    ),
]

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        original = f.read()

    content = original
    for pat in PATTERNS:
        content = pat.sub('', content)

    # Clean up any double blank lines left behind
    content = re.sub(r'\n{3,}', '\n\n', content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    updated = 0
    skipped = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.git')]
        for fname in filenames:
            if not fname.endswith('.html'):
                continue
            fpath = os.path.join(dirpath, fname)
            if process_file(fpath):
                updated += 1
                rel = os.path.relpath(fpath, ROOT)
                print(f'  updated: {rel}')
            else:
                skipped += 1

    print(f'\nDone. Updated: {updated}, unchanged: {skipped}')

if __name__ == '__main__':
    main()
