const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const VIGNETTE = `(function(s){s.dataset.zone='10961427',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;
const IPP = `(function(s){s.dataset.zone='10961935',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;
const POPUNDER = `(function(s){s.dataset.zone='10962017',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;

const IS_PREMIUM_FN = `function isPremiumUser(){var e=localStorage.getItem('adsRemovedUntil');if(!e)return false;return new Date(e)>new Date();}`;

function gatedBlock(scripts) {
  const calls = scripts.map(fn => `${fn};`).join('');
  return `<script>${IS_PREMIUM_FN}if(!isPremiumUser()){${calls}}</script>`;
}

const GATED_2 = gatedBlock([VIGNETTE, IPP]);
const GATED_3 = gatedBlock([VIGNETTE, IPP, POPUNDER]);

// Use [^<]* to match script body (no nested tags possible in these inline scripts)
// Try 3-script pattern first to avoid partial matches
const S_VIGNETTE = `<script>[^<]*n6wxm\\.com[^<]*</script>`;
const S_IPP      = `<script>[^<]*nap5k\\.com[^<]*</script>`;
const S_POP      = `<script>[^<]*al5sm\\.com[^<]*</script>`;
const SEP        = `\\s*`;

const PATTERNS = [
  {
    re: new RegExp(`[ \\t]*${S_VIGNETTE}${SEP}[ \\t]*${S_IPP}${SEP}[ \\t]*${S_POP}`, 'g'),
    replacement: GATED_3,
  },
  {
    re: new RegExp(`[ \\t]*${S_VIGNETTE}${SEP}[ \\t]*${S_IPP}`, 'g'),
    replacement: GATED_2,
  },
];

const files = execSync(`find ${ROOT} -name "*.html" -not -path "*/node_modules/*"`)
  .toString().trim().split('\n').filter(Boolean);

let updated = 0;
let alreadyGated = 0;
let skipped = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('n6wxm.com') && !content.includes('nap5k.com')) {
    skipped++;
    continue;
  }

  if (content.includes('isPremiumUser')) {
    alreadyGated++;
    continue;
  }

  let changed = false;
  for (const { re, replacement } of PATTERNS) {
    const next = content.replace(re, replacement);
    if (next !== content) {
      content = next;
      changed = true;
      break;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    updated++;
  } else {
    console.warn('WARN: no pattern matched in', file);
  }
}

console.log(`Done. Updated: ${updated}, already gated: ${alreadyGated}, no ads (skipped): ${skipped}`);
