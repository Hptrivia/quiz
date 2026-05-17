#!/usr/bin/env python3
"""
1. Replace bare "Ad-Free" footer links with "Buy me a coffee"
2. In theme pages: rename Ad-Free card + move it after Challenge Mode card
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 1. Footer Ad-Free link → Buy me a coffee ───────────────────────────────
FOOTER_OLD = re.compile(
    r'<a class="footer-highlight" href="remove-ads\.html">Ad-Free</a>'
)
FOOTER_NEW = '<a class="footer-highlight" href="remove-ads.html">Buy me a coffee</a>'

# ── 2. Theme card: extract Ad-Free card, move after Challenge card ──────────
ADFREE_CARD = re.compile(
    r'\s*<a class="card" href="\.\.\/remove-ads\.html\?theme=[^"]+">.*?</a>',
    re.DOTALL
)

COFFEE_CARD_TPL = '''
        <a class="card" href="../remove-ads.html?theme={slug}&mode=normal">
          <h3>Buy me a coffee</h3>
          <p>If you enjoyed playing, every little bit helps.</p>
        </a>'''

CHALLENGE_CARD_END = re.compile(
    r'(        <a class="card" href="\.\./challenge\.html[^"]*">.*?</a>)',
    re.DOTALL
)

def get_slug_from_theme_path(path):
    return os.path.splitext(os.path.basename(path))[0]

def process_theme_page(path, content):
    slug = get_slug_from_theme_path(path)

    # Extract the Ad-Free card
    m = ADFREE_CARD.search(content)
    if not m:
        return content

    # Remove it from current position
    content = content[:m.start()] + content[m.end():]

    # Insert Buy me a coffee card after Challenge Mode card
    coffee_card = COFFEE_CARD_TPL.format(slug=slug)
    cm = CHALLENGE_CARD_END.search(content)
    if cm:
        insert_at = cm.end()
        content = content[:insert_at] + coffee_card + content[insert_at:]

    return content

# ── 3. Rename h3 Ad-Free → Buy me a coffee in quiz.html grid cards ─────────
H3_ADFREE = re.compile(r'<h3>Ad-Free</h3>')
H3_COFFEE  = '<h3>Buy me a coffee</h3>'

P_PRINTABLES = re.compile(r'<p>Printables, answer sheets, and bonus files</p>')
P_COFFEE     = '<p>If you enjoyed playing, every little bit helps.</p>'

def process(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Footer links
    content = FOOTER_OLD.sub(FOOTER_NEW, content)

    # h3 Ad-Free in any non-theme card (quiz.html etc.)
    content = H3_ADFREE.sub(H3_COFFEE, content)
    content = P_PRINTABLES.sub(P_COFFEE, content)

    # Theme pages: also move the card
    rel = os.path.relpath(path, ROOT)
    if rel.startswith('themes' + os.sep):
        content = process_theme_page(path, content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

updated = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.git')]
    for fname in filenames:
        if not fname.endswith('.html'):
            continue
        fpath = os.path.join(dirpath, fname)
        if process(fpath):
            updated += 1
            print(' updated:', os.path.relpath(fpath, ROOT))

print(f'\nDone. Updated: {updated}')
