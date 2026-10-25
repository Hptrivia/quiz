import json, random, sys, collections
sys.path.insert(0, sys.argv[1]); from wf_pool import POOL; from wf_cut import CUT
MERGE = {"animation": "film", "console": "game"}
p = 'data/daily_order.json'; d = json.load(open(p))
used = {i['name'].lower() for pz in d['puzzles'] for i in pz['items']}
pool = [x for x in POOL if x[0].lower() not in used and x[0] not in CUT]
names = [x[0] for x in pool]; assert len(names) == len(set(names)), [n for n in names if names.count(n) > 1]
rng = random.Random(42)
bycat = collections.defaultdict(list)
for x in pool: bycat[MERGE.get(x[3], x[3])].append(x)
for c in bycat: rng.shuffle(bycat[c])
new = []
while True:
    cats = sorted([c for c in bycat if bycat[c]], key=lambda c: (-len(bycat[c]), rng.random()))
    if len(cats) < 5: break
    chosen, years = [], set()
    for c in cats:
        if len(chosen) == 5: break
        # pick the item whose year is furthest from those already chosen
        cand = [x for x in bycat[c] if x[2] not in years]
        if not cand: continue
        best = max(cand[:8], key=lambda x: min([abs(x[2] - y) for y in years] or [999]))
        chosen.append(best); years.add(best[2]); bycat[c].remove(best)
    if len(chosen) < 5:
        for x in chosen: bycat[MERGE.get(x[3], x[3])].append(x)
        break
    chosen.sort(key=lambda x: x[2])
    new.append({"items": [{"name": n, "emoji": e, "year": y, "source": s} for n, e, y, _, s in chosen]})
d['puzzles'].extend(new)
d['sources'].update({
 "highest-grossing-by-year": "https://en.wikipedia.org/wiki/List_of_highest-grossing_films (by year of release)",
 "afi-100": d['sources'].get("afi-100", "https://en.wikipedia.org/wiki/AFI%27s_100_Years...100_Movies"),
 "oscar-best-picture": "https://en.wikipedia.org/wiki/Academy_Award_for_Best_Picture",
 "bond-films": "https://en.wikipedia.org/wiki/James_Bond_in_film",
 "disney-animation": "https://en.wikipedia.org/wiki/List_of_Walt_Disney_Animation_Studios_films",
 "pixar": "https://en.wikipedia.org/wiki/List_of_Pixar_films",
 "spotify-most-streamed": "https://en.wikipedia.org/wiki/List_of_Spotify_streaming_records",
 "best-selling-video-games": "https://en.wikipedia.org/wiki/List_of_best-selling_video_games",
 "time-50-games": d['sources'].get("time-50-games", ""),
 "best-selling-consoles": "https://en.wikipedia.org/wiki/List_of_best-selling_game_consoles",
 "best-selling-books": "https://en.wikipedia.org/wiki/List_of_best-selling_books",
 "world-cup-finals": "https://en.wikipedia.org/wiki/List_of_FIFA_World_Cup_finals",
 "olympic-hosts": "https://en.wikipedia.org/wiki/List_of_Olympic_Games_host_cities",
 "ballon-dor": "https://en.wikipedia.org/wiki/Ballon_d%27Or",
 "space-100-milestones": "https://newspaceeconomy.ca/2025/06/29/100-milestones-that-took-us-to-the-stars/",
 "247-landmarks": "https://247wallst.com/special-report/2021/08/20/early-photographs-of-the-worlds-most-famous-landmarks/",
})
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2); open(p, 'a').write('\n')
left = {c: len(v) for c, v in bycat.items() if v}
allnames = [i['name'] for pz in d['puzzles'] for i in pz['items']]
print('pool', len(pool), '| new puzzles', len(new), '| total', len(d['puzzles']), '| dupes', len(allnames) - len(set(allnames)),
      '| 2020+', sum(any(i['year'] >= 2020 for i in pz['items']) for pz in d['puzzles']), '| leftover', left)
for pz in new[:3]: print(' · '.join(f"{i['name']} ({i['year']})" for i in pz['items']))
