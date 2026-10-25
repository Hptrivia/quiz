"""Build data/whoami_people.json for the Who Am I? daily game.

Source: Pantheon 2025 (https://pantheon.world, CC BY-SA 4.0)
  curl -L https://storage.googleapis.com/pantheon-public-data/person_2025_update.csv.bz2 | bunzip2 > person_2025.csv
  python3 scripts/build_whoami.py person_2025.csv

Guess list = top people by Pantheon's fame score (historical figures)
           + top people born 1930+ by page views (modern stars, which the
             fame score badly underrates) + all daily answers.
Daily answers = scripts/whoami_answers.py (hand-picked, all verified in Pantheon).
"""
import csv, json, random, sys, unicodedata
sys.path.insert(0, 'scripts')
from whoami_answers import ANSWERS
from whoami_geo import CONTINENT

TOP_BY_FAME = 1800
TOP_MODERN_BY_VIEWS = 2200
SKIP_OCCUPATIONS = {'', 'EXTREMIST', 'MAFIOSO', 'PORNOGRAPHIC ACTOR', 'PIRATE', 'OCCULTIST'}
SKIP_PEOPLE = {'Adolf Hitler', 'Benito Mussolini', 'Pol Pot', 'Idi Amin', 'Heinrich Himmler', 'Joseph Goebbels', 'Hermann Göring'}

# Pantheon occupation -> (field, sub-field)
OCC = {
 'SINGER': ('Music', 'Singer / musician'), 'MUSICIAN': ('Music', 'Singer / musician'),
 'COMPOSER': ('Music', 'Composer'), 'CONDUCTOR': ('Music', 'Composer'),
 'ACTOR': ('Film & TV', 'Actor'), 'FILM DIRECTOR': ('Film & TV', 'Director'), 'PRODUCER': ('Film & TV', 'Director'),
 'COMEDIAN': ('Film & TV', 'Comedian'), 'PRESENTER': ('Film & TV', 'TV host'), 'MAGICIAN': ('Film & TV', 'TV host'),
 'SOCCER PLAYER': ('Sport', 'Football'), 'BASKETBALL PLAYER': ('Sport', 'Basketball'), 'TENNIS PLAYER': ('Sport', 'Tennis'),
 'BOXER': ('Sport', 'Combat sports'), 'WRESTLER': ('Sport', 'Combat sports'), 'MARTIAL ARTS': ('Sport', 'Combat sports'),
 'ATHLETE': ('Sport', 'Athletics'), 'RACING DRIVER': ('Sport', 'Motorsport'), 'CYCLIST': ('Sport', 'Cycling'),
 'SWIMMER': ('Sport', 'Swimming'), 'GOLFER': ('Sport', 'Golf'), 'CRICKETER': ('Sport', 'Cricket'),
 'AMERICAN FOOTBALL PLAYER': ('Sport', 'American football'), 'BASEBALL PLAYER': ('Sport', 'Baseball'),
 'HOCKEY PLAYER': ('Sport', 'Ice hockey'), 'GYMNAST': ('Sport', 'Gymnastics'),
 **{o: ('Sport', 'Other sport') for o in ['SKIER', 'SKATER', 'VOLLEYBALL PLAYER', 'HANDBALL PLAYER', 'RUGBY PLAYER', 'TABLE TENNIS PLAYER',
     'BADMINTON PLAYER', 'FENCER', 'SNOOKER', 'CHESS PLAYER', 'GO PLAYER', 'POKER PLAYER', 'COACH', 'REFEREE', 'MOUNTAINEER', 'BULLFIGHTER']},
 'POLITICIAN': ('Politics', 'Politician'), 'DIPLOMAT': ('Politics', 'Politician'), 'JUDGE': ('Politics', 'Politician'),
 'LAWYER': ('Politics', 'Politician'), 'PUBLIC WORKER': ('Politics', 'Politician'), 'POLITICAL SCIENTIST': ('Politics', 'Politician'),
 'MILITARY PERSONNEL': ('Politics', 'Military leader'), 'RELIGIOUS FIGURE': ('Politics', 'Religious leader'),
 'SOCIAL ACTIVIST': ('Politics', 'Activist'),
 'NOBLEMAN': ('Royalty', 'Royal'), 'COMPANION': ('Royalty', 'Royal'),
 **{o: ('Science', 'Scientist') for o in ['PHYSICIST', 'CHEMIST', 'BIOLOGIST', 'MATHEMATICIAN', 'ASTRONOMER', 'PHYSICIAN', 'COMPUTER SCIENTIST',
     'ECONOMIST', 'PSYCHOLOGIST', 'GEOLOGIST', 'GEOGRAPHER', 'ANTHROPOLOGIST', 'ARCHAEOLOGIST', 'STATISTICIAN', 'SOCIOLOGIST', 'LINGUIST']},
 'ASTRONAUT': ('Science', 'Astronaut'), 'EXPLORER': ('Science', 'Explorer'), 'PILOT': ('Science', 'Explorer'),
 'INVENTOR': ('Science', 'Inventor'), 'ENGINEER': ('Science', 'Inventor'),
 'BUSINESSPERSON': ('Business & Tech', 'Businessperson'), 'GAME DESIGNER': ('Business & Tech', 'Tech founder'),
 'WRITER': ('Arts & Writing', 'Writer'), 'PHILOSOPHER': ('Arts & Writing', 'Writer'), 'HISTORIAN': ('Arts & Writing', 'Writer'),
 'CRITIC': ('Arts & Writing', 'Writer'), 'JOURNALIST': ('Arts & Writing', 'Writer'),
 'PAINTER': ('Arts & Writing', 'Artist'), 'ARTIST': ('Arts & Writing', 'Artist'), 'SCULPTOR': ('Arts & Writing', 'Artist'),
 'COMIC ARTIST': ('Arts & Writing', 'Artist'), 'PHOTOGRAPHER': ('Arts & Writing', 'Artist'), 'ARCHITECT': ('Arts & Writing', 'Artist'),
 'DANCER': ('Arts & Writing', 'Artist'), 'DESIGNER': ('Arts & Writing', 'Fashion & design'), 'FASHION DESIGNER': ('Arts & Writing', 'Fashion & design'),
 'MODEL': ('Arts & Writing', 'Fashion & design'), 'CHEF': ('Arts & Writing', 'Chef'),
 'YOUTUBER': ('Internet stars', 'YouTuber'), 'GAMER': ('Internet stars', 'YouTuber'), 'CELEBRITY': ('Internet stars', 'Influencer'),
 'INSPIRATION': ('Internet stars', 'Influencer'),
}
DEFAULT_SUB = {'Music': 'Singer / musician', 'Film & TV': 'Actor', 'Sport': 'Other sport', 'Politics': 'Politician', 'Royalty': 'Royal',
               'Science': 'Scientist', 'Business & Tech': 'Businessperson', 'Arts & Writing': 'Artist', 'Internet stars': 'Influencer'}

# Fixes for answers whose Pantheon label is wrong or too vague: name -> (field, sub)
FIX = {
 'Elon Musk': ('Business & Tech', 'Tech founder'), 'Steve Jobs': ('Business & Tech', 'Tech founder'), 'Bill Gates': ('Business & Tech', 'Tech founder'),
 'Mark Zuckerberg': ('Business & Tech', 'Tech founder'), 'Jeff Bezos': ('Business & Tech', 'Tech founder'), 'Jack Ma': ('Business & Tech', 'Tech founder'),
 'Sam Altman': ('Business & Tech', 'Tech founder'), 'Walt Disney': ('Business & Tech', 'Businessperson'), 'Henry Ford': ('Business & Tech', 'Businessperson'),
 'Oprah Winfrey': ('Film & TV', 'TV host'), 'David Attenborough': ('Film & TV', 'TV host'), 'Steve Irwin': ('Film & TV', 'TV host'),
 'Bruce Lee': ('Film & TV', 'Actor'), 'Dwayne Johnson': ('Film & TV', 'Actor'), 'Arnold Schwarzenegger': ('Film & TV', 'Actor'),
 'Jennifer Lopez': ('Film & TV', 'Actor'), 'Rowan Atkinson': ('Film & TV', 'Comedian'), 'Steven Spielberg': ('Film & TV', 'Director'),
 'Charlie Chaplin': ('Film & TV', 'Actor'), 'Will Smith': ('Film & TV', 'Actor'),
 'Wolfgang Amadeus Mozart': ('Music', 'Composer'), 'Ludwig van Beethoven': ('Music', 'Composer'),
 'Michelle Obama': ('Politics', 'Politician'), 'Pope Francis': ('Politics', 'Religious leader'), '14th Dalai Lama': ('Politics', 'Religious leader'),
 'Mother Teresa': ('Politics', 'Religious leader'), 'Martin Luther King Jr.': ('Politics', 'Activist'), 'Malala Yousafzai': ('Politics', 'Activist'),
 'Greta Thunberg': ('Politics', 'Activist'),
 'Nikola Tesla': ('Science', 'Inventor'), 'Thomas Edison': ('Science', 'Inventor'), 'Jane Goodall': ('Science', 'Scientist'),
 'Coco Chanel': ('Arts & Writing', 'Fashion & design'), 'Gordon Ramsay': ('Arts & Writing', 'Chef'), 'Anne Frank': ('Arts & Writing', 'Writer'),
 'Leonardo da Vinci': ('Arts & Writing', 'Artist'), 'Banksy': ('Arts & Writing', 'Artist'), 'Andy Warhol': ('Arts & Writing', 'Artist'),
 'Kim Kardashian': ('Internet stars', 'Influencer'), 'Kylie Jenner': ('Internet stars', 'Influencer'),
 "Charli D'Amelio": ('Internet stars', 'TikToker'), 'Khaby Lame': ('Internet stars', 'TikToker'),
 'MrBeast': ('Internet stars', 'YouTuber'), 'PewDiePie': ('Internet stars', 'YouTuber'), 'KSI': ('Internet stars', 'YouTuber'),
 'Conor McGregor': ('Sport', 'Combat sports'), 'Floyd Mayweather Jr.': ('Sport', 'Combat sports'),
}
# Names shown in the game (Pantheon uses older titles for some)
DISPLAY = {
 'Charles, Prince of Wales': 'King Charles III', 'Prince William, Duke of Cambridge': 'Prince William',
 'Catherine, Duchess of Cambridge': 'Kate Middleton', 'Prince Harry, Duke of Sussex': 'Prince Harry',
 'Meghan, Duchess of Sussex': 'Meghan Markle', 'Diana, Princess of Wales': 'Princess Diana', 'Elizabeth II': 'Queen Elizabeth II',
 '14th Dalai Lama': 'Dalai Lama', 'Wolfgang Amadeus Mozart': 'Mozart', 'Ludwig van Beethoven': 'Beethoven',
}
ALIASES = {
 'Taylor Swift': ['T Swift'], 'Dwayne Johnson': ['The Rock'], 'Cristiano Ronaldo': ['CR7'], 'Lionel Messi': ['Leo Messi'],
 'Kate Middleton': ['Catherine, Princess of Wales'], 'Meghan Markle': ['Meghan, Duchess of Sussex'], 'MrBeast': ['Jimmy Donaldson'],
 'PewDiePie': ['Felix Kjellberg'], 'Martin Luther King Jr.': ['MLK'], 'John F. Kennedy': ['JFK'], 'Mahatma Gandhi': ['Gandhi'],
}


def norm(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower().replace('.', '').replace(' ', '')


def main(path):
    rows = [r for r in csv.DictReader(open(path, encoding='utf-8'))
            if r['occupation'] not in SKIP_OCCUPATIONS and r['name'] not in SKIP_PEOPLE and r['birthyear'] and r['gender'] in ('M', 'F')]
    for r in rows:
        r['_h'] = float(r['hpi'] or 0)
        r['_v'] = float(r['non_en_page_views'] or 0)
    by = {}
    for r in sorted(rows, key=lambda r: -r['_h']):
        by.setdefault(norm(r['name']), r)   # duplicate names: keep the most famous

    answer_field = {}
    for field, names in ANSWERS.items():
        for n in names:
            # answers list Mozart/Beethoven under Arts; FIX moves them to Music
            answer_field[norm(n)] = field
    missing = [n for names in ANSWERS.values() for n in names if norm(n) not in by]
    assert not missing, f'answers not in Pantheon: {missing}'

    pick = {}
    for r in sorted(by.values(), key=lambda r: -r['_h'])[:TOP_BY_FAME]:
        pick[norm(r['name'])] = r
    modern = [r for r in by.values() if int(r['birthyear']) >= 1930]
    for r in sorted(modern, key=lambda r: -r['_v'])[:TOP_MODERN_BY_VIEWS]:
        pick[norm(r['name'])] = r
    for k in answer_field:
        pick[k] = by[k]

    people, unknown_geo = [], set()
    for k, r in pick.items():
        name = r['name']
        field, sub = FIX.get(name) or OCC.get(r['occupation'], (None, None))
        if k in answer_field and name not in FIX and field != answer_field[k]:
            field, sub = answer_field[k], DEFAULT_SUB[answer_field[k]]
        if not field:
            continue
        country = r['bplace_country'] or ''
        cont = CONTINENT.get(country)
        if country and not cont:
            unknown_geo.add(country)
        display = DISPLAY.get(name, name)
        people.append({
            'n': display, 'g': r['gender'], 'c': country or '?', 'ct': cont or '?', 'f': field, 's': sub,
            'y': int(r['birthyear']), 'a': 1 if r['alive'].upper() == 'TRUE' else 0,
            **({'al': ALIASES[display]} if display in ALIASES else {}),
            **({'ans': 1} if k in answer_field else {}),
            '_rank': -max(r['_v'] / 1e6, r['_h'] / 20),
        })
    # disambiguate any display-name clashes by birth year
    seen = {}
    for p in people:
        seen.setdefault(p['n'], []).append(p)
    for n, ps in seen.items():
        if len(ps) > 1:
            for p in ps:
                if not p.get('ans'):
                    p['n'] = f"{n} ({p['y']})"
    # Order = dropdown priority, by popularity (page views, or fame score for
    # historical people). Answers get NO boost — that would give the answer pool away.
    people.sort(key=lambda p: p.pop('_rank'))

    # Daily order: shuffled, no field twice in a row, Taylor Swift first (launch/test day)
    answers = [p['n'] for p in people if p.get('ans')]
    fieldof = {p['n']: p['f'] for p in people}
    rng = random.Random(2026)
    rest = [a for a in answers if a != 'Taylor Swift']
    rng.shuffle(rest)
    order = ['Taylor Swift']
    while rest:
        nxt = next((a for a in rest if fieldof[a] != fieldof[order[-1]]), rest[0])
        order.append(nxt); rest.remove(nxt)

    out = {'start': '2026-10-25', 'credit': 'Data: Pantheon (pantheon.world), CC BY-SA 4.0', 'answers': order, 'people': people}
    json.dump(out, open('data/whoami_people.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'people {len(people)} | answers {len(order)} | unknown continent for {len(unknown_geo)} countries: {sorted(unknown_geo)[:40]}')


if __name__ == '__main__':
    main(sys.argv[1])
