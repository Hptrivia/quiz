#!/usr/bin/env python3
"""Add 'Buy me a coffee' link back to footers that have footer-links divs."""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Match the footer-links div and insert the coffee link before the first <a>
# Only add if not already present
COFFEE_LINK = '<a href="remove-ads.html" class="footer-highlight">Buy me a coffee</a>'

PAT = re.compile(
    r'(<div class="footer-links">\s*)(<a )',
    re.DOTALL
)

def process(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'footer-links' not in content:
        return False
    if 'Buy me a coffee' in content or 'removeAdsLink' in content:
        return False  # already has it
    new = PAT.sub(lambda m: m.group(1) + COFFEE_LINK + '\n        ' + m.group(2), content, count=1)
    if new == content:
        return False
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new)
    return True

updated = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.git')]
    for fname in filenames:
        if not fname.endswith('.html'):
            continue
        if process(os.path.join(dirpath, fname)):
            updated += 1
            print('  updated:', os.path.relpath(os.path.join(dirpath, fname), ROOT))

print(f'\nDone. Updated: {updated}')
