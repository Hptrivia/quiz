// build-catblitz-seed-lists.js
// Builds the INITIAL data/catblitz/{name,place,thing}.json from real public
// frequency data (not LLM enumeration) — see .catblitz-cache/ for the raw
// downloads this reads. generate-catblitz-wordlists.js runs AFTER this to
// fill per-letter gaps via the Anthropic API.
//
// Sources (see plan for license notes):
//   Name  — sigpwned/popular-names-by-country-dataset (CC0), Romanized Name column
//   Place — GeoNames cities15000 (CC BY 4.0, population-sorted) + hand-listed
//           countries/capitals/US states (small closed sets)
//   Thing — WordNet 3.1 noun index (commercial-safe) ranked by SUBTLEX-derived
//           frequency counts (words/subtlex-word-frequencies, ISC license)
//
// Usage: node scripts/build-catblitz-seed-lists.js
// (Requires the files in scripts/.catblitz-cache/ — see fetch commands in the
// build order notes; this script only parses, it doesn't download.)

const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, ".catblitz-cache");
const DATA_DIR = path.join(__dirname, "../data/catblitz");
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function emptyBuckets() {
  const o = {};
  ALPHABET.forEach(l => { o[l] = []; });
  return o;
}

// Accepts single words or short space/hyphen/apostrophe-joined phrases
// ("new york", "o'brien", "port-au-prince"), rejects anything with digits,
// stray punctuation, or absurd length — those would never be a clean exact
// match target anyway.
function cleanWord(raw) {
  const w = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!/^[a-z][a-z' .-]*[a-z.]$|^[a-z]$/.test(w)) return null;
  if (w.length < 2 || w.length > 28) return null;
  return w;
}

function addWord(buckets, raw) {
  const w = cleanWord(raw);
  if (!w) return;
  const letter = w[0].toUpperCase();
  if (!buckets[letter]) return;
  if (!buckets[letter].includes(w)) buckets[letter].push(w);
}

function writeCategory(id, buckets) {
  const sorted = {};
  ALPHABET.forEach(l => { sorted[l] = buckets[l].slice().sort(); });
  const outPath = path.join(DATA_DIR, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2));
  const total = ALPHABET.reduce((sum, l) => sum + sorted[l].length, 0);
  console.log(`  wrote ${id}.json — ${total} words (min letter: ${ALPHABET.reduce((a, l) => sorted[l].length < sorted[a].length ? l : a)}=${Math.min(...ALPHABET.map(l => sorted[l].length))})`);
}

// ── Minimal CSV row splitter (handles simple quoted fields; this dataset's
// name columns are plain ASCII so this is deliberately not a full RFC parser) ──
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// The popularity dataset tracks formal registered names (Samuel, Michael,
// Alexander) — real players constantly type the common nickname instead
// (Sam, Mike, Alex). Confirmed via the empirical hit-rate test: this single
// gap was most of Name's shortfall. English-nickname-heavy since that's this
// app's primary audience; the LLM gap-fill pass can broaden this further.
const COMMON_NICKNAMES = [
  "al","alex","andy","artie","abby","annie",
  "ben","bill","bob","barb","beth","becky","billy","bobby",
  "chris","charlie","cindy","connie","carl",
  "dan","dave","debbie","don","doug","danny",
  "ed","eddie","ellie","emmy","evie",
  "frank","fred","freddie",
  "gary","greg","gwen","gabby",
  "hank","harry","holly",
  "izzy","ike",
  "jack","jake","jen","jenny","jess","jim","jimmy","joe","joey","josh","judy","johnny",
  "kate","katie","ken","kim","kit","kenny",
  "larry","liz","lizzie","lou","louie","lucy","lenny",
  "mac","maggie","mandy","matt","meg","mel","mike","mitch","molly","max",
  "nan","nate","nick","nicky","nate",
  "ollie",
  "pat","patty","peg","pete","phil","polly",
  "rick","rob","robbie","ron","ronnie","roy","russ","randy",
  "sal","sally","sam","sammy","sandy","sid","steph","steve","sue","susie",
  "ted","teddy","terry","theo","tim","timmy","tina","toby","tom","tommy","tony","trish","trudy",
  "vic","vinny",
  "wally","wendy","will","willie","wes",
  "zack","zach",
];

// Common informal/colloquial place names that don't appear as a country's
// or city's official name — "America" for United States, etc.
const PLACE_ALIASES = [
  "america","britain","uk","holland","russia","persia","siam",
];

// ── Name: sigpwned forenames CSV, "Romanized Name" column ──────────────────
function buildName() {
  const csvPath = path.join(CACHE_DIR, "forenames.csv");
  const lines = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "").split("\n").filter(Boolean);
  const header = splitCsvLine(lines[0]).map(h => h.trim());
  const romanIdx = header.indexOf("Romanized Name");
  if (romanIdx === -1) throw new Error("forenames.csv: 'Romanized Name' column not found");

  const buckets = emptyBuckets();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    addWord(buckets, cols[romanIdx]);
  }
  COMMON_NICKNAMES.forEach(w => addWord(buckets, w));
  writeCategory("name", buckets);
}

// ── Place: countries + capitals + US states (hand-listed, small closed
// sets — not worth sourcing externally) + GeoNames cities15000 ────────────
const COUNTRIES = [
  "afghanistan","albania","algeria","andorra","angola","antigua and barbuda","argentina","armenia","australia","austria",
  "azerbaijan","bahamas","bahrain","bangladesh","barbados","belarus","belgium","belize","benin","bhutan",
  "bolivia","bosnia and herzegovina","botswana","brazil","brunei","bulgaria","burkina faso","burundi","cambodia","cameroon",
  "canada","cape verde","central african republic","chad","chile","china","colombia","comoros","costa rica","croatia",
  "cuba","cyprus","czech republic","denmark","djibouti","dominica","dominican republic","east timor","ecuador","egypt",
  "el salvador","equatorial guinea","eritrea","estonia","eswatini","ethiopia","fiji","finland","france","gabon",
  "gambia","georgia","germany","ghana","greece","grenada","guatemala","guinea","guinea-bissau","guyana",
  "haiti","honduras","hungary","iceland","india","indonesia","iran","iraq","ireland","israel",
  "italy","ivory coast","jamaica","japan","jordan","kazakhstan","kenya","kiribati","kosovo","kuwait",
  "kyrgyzstan","laos","latvia","lebanon","lesotho","liberia","libya","liechtenstein","lithuania","luxembourg",
  "madagascar","malawi","malaysia","maldives","mali","malta","marshall islands","mauritania","mauritius","mexico",
  "micronesia","moldova","monaco","mongolia","montenegro","morocco","mozambique","myanmar","namibia","nauru",
  "nepal","netherlands","new zealand","nicaragua","niger","nigeria","north korea","north macedonia","norway","oman",
  "pakistan","palau","palestine","panama","papua new guinea","paraguay","peru","philippines","poland","portugal",
  "qatar","romania","russia","rwanda","saint kitts and nevis","saint lucia","saint vincent and the grenadines","samoa","san marino","sao tome and principe",
  "saudi arabia","senegal","serbia","seychelles","sierra leone","singapore","slovakia","slovenia","solomon islands","somalia",
  "south africa","south korea","south sudan","spain","sri lanka","sudan","suriname","sweden","switzerland","syria",
  "taiwan","tajikistan","tanzania","thailand","togo","tonga","trinidad and tobago","tunisia","turkey","turkmenistan",
  "tuvalu","uganda","ukraine","united arab emirates","united kingdom","united states","uruguay","uzbekistan","vanuatu","vatican city",
  "venezuela","vietnam","yemen","zambia","zimbabwe",
];
const CAPITALS = [
  "kabul","tirana","algiers","andorra la vella","luanda","saint john's","buenos aires","yerevan","canberra","vienna",
  "baku","nassau","manama","dhaka","bridgetown","minsk","brussels","belmopan","porto-novo","thimphu",
  "sucre","sarajevo","gaborone","brasilia","bandar seri begawan","sofia","ouagadougou","gitega","phnom penh","yaounde",
  "ottawa","praia","bangui","n'djamena","santiago","beijing","bogota","moroni","san jose","zagreb",
  "havana","nicosia","prague","copenhagen","djibouti","roseau","santo domingo","dili","quito","cairo",
  "san salvador","malabo","asmara","tallinn","mbabane","addis ababa","suva","helsinki","paris","libreville",
  "banjul","tbilisi","berlin","accra","athens","saint george's","guatemala city","conakry","bissau","georgetown",
  "port-au-prince","tegucigalpa","budapest","reykjavik","new delhi","jakarta","tehran","baghdad","dublin","jerusalem",
  "rome","yamoussoukro","kingston","tokyo","amman","astana","nairobi","tarawa","pristina","kuwait city",
  "bishkek","vientiane","riga","beirut","maseru","monrovia","tripoli","vaduz","vilnius","luxembourg city",
  "antananarivo","lilongwe","kuala lumpur","male","bamako","valletta","majuro","nouakchott","port louis","mexico city",
  "palikir","chisinau","monaco","ulaanbaatar","podgorica","rabat","maputo","naypyidaw","windhoek","yaren",
  "kathmandu","amsterdam","wellington","managua","niamey","abuja","pyongyang","skopje","oslo","muscat",
  "islamabad","ngerulmud","jerusalem","panama city","port moresby","asuncion","lima","manila","warsaw","lisbon",
  "doha","bucharest","moscow","kigali","basseterre","castries","kingstown","apia","san marino city","sao tome",
  "riyadh","dakar","belgrade","victoria","freetown","singapore","bratislava","ljubljana","honiara","mogadishu",
  "pretoria","seoul","juba","madrid","colombo","khartoum","paramaribo","stockholm","bern","damascus",
  "taipei","dushanbe","dodoma","bangkok","lome","nuku'alofa","port of spain","tunis","ankara","ashgabat",
  "funafuti","kampala","kyiv","abu dhabi","london","washington","montevideo","tashkent","port vila","vatican city",
  "caracas","hanoi","sanaa","lusaka","harare",
];
const US_STATES = [
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida","georgia",
  "hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine","maryland",
  "massachusetts","michigan","minnesota","mississippi","missouri","montana","nebraska","nevada","new hampshire","new jersey",
  "new mexico","new york","north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island","south carolina",
  "south dakota","tennessee","texas","utah","vermont","virginia","washington","west virginia","wisconsin","wyoming",
];

// Continents, regions, oceans, seas — a real gap found via the large hit-rate
// test: "Africa", "the Alps", "the Caribbean" etc. are extremely common real
// answers that don't fit "country" or "city," so they were missing entirely.
const REGIONS = [
  "africa","antarctica","asia","australia","europe","north america","south america","oceania",
  "middle east","caribbean","central america","scandinavia","balkans","sahara","amazon","arctic","siberia",
  "alps","himalayas","andes","rockies","sahara desert","gobi desert","outback","pacific islands","polynesia",
  "atlantic ocean","pacific ocean","indian ocean","arctic ocean","southern ocean",
  "mediterranean sea","caribbean sea","red sea","black sea","caspian sea","north sea","baltic sea",
  "amazon rainforest","great barrier reef","sahara","nile","amazon river","mississippi river","danube","rhine","thames",
];

function buildPlace() {
  const buckets = emptyBuckets();
  [...COUNTRIES, ...CAPITALS, ...US_STATES, ...PLACE_ALIASES, ...REGIONS].forEach(w => addWord(buckets, w));

  const citiesPath = path.join(CACHE_DIR, "cities15000.txt");
  const lines = fs.readFileSync(citiesPath, "utf8").split("\n").filter(Boolean);
  const rows = lines.map(line => {
    const cols = line.split("\t");
    return { name: cols[2], population: parseInt(cols[14], 10) || 0 };
  }).sort((a, b) => b.population - a.population);

  // Cap per letter so common/famous cities dominate over the long tail —
  // "fame-weighted", not exhaustive gazetteer coverage (per the plan).
  const perLetterCap = 400;
  const counts = {};
  rows.forEach(r => {
    const w = cleanWord(r.name);
    if (!w) return;
    const letter = w[0].toUpperCase();
    if (!buckets[letter]) return;
    counts[letter] = counts[letter] || 0;
    if (counts[letter] >= perLetterCap) return;
    if (!buckets[letter].includes(w)) { buckets[letter].push(w); counts[letter]++; }
  });

  writeCategory("place", buckets);
}

// ── Thing: WordNet noun index, ranked by SUBTLEX frequency ────────────────
function buildThing() {
  const indexPath = path.join(CACHE_DIR, "wordnet_extracted/dict/index.noun");
  const subtlexPath = path.join(CACHE_DIR, "subtlex.json");

  const freq = {};
  JSON.parse(fs.readFileSync(subtlexPath, "utf8")).forEach(({ word, count }) => {
    freq[String(word).toLowerCase()] = count;
  });

  const lines = fs.readFileSync(indexPath, "utf8").split("\n");
  const nouns = [];
  for (const line of lines) {
    if (!line || line.startsWith("  ")) continue; // license header lines are indented
    const lemma = line.split(" ")[0].replace(/_/g, " ");
    const w = cleanWord(lemma);
    if (!w) continue;
    nouns.push({ word: w, freq: freq[w] || freq[w.replace(/ /g, "")] || 0 });
  }

  const byLetter = {};
  ALPHABET.forEach(l => { byLetter[l] = []; });
  nouns.forEach(n => { byLetter[n.word[0].toUpperCase()]?.push(n); });

  const perLetterCap = 3000;
  const buckets = emptyBuckets();
  ALPHABET.forEach(l => {
    byLetter[l]
      .sort((a, b) => b.freq - a.freq)
      .slice(0, perLetterCap)
      .forEach(n => { if (!buckets[l].includes(n.word)) buckets[l].push(n.word); });
  });

  writeCategory("thing", buckets);
}

// ── Animal: hand-curated (common species + common dog/cat breeds) ─────────
// No good CC0/frequency dataset found for this one — but it's the most
// closed/bounded of the four categories, so a hand-curated list of common
// names is reliable (low hallucination risk, well-established knowledge) and
// avoids the complexity of parsing WordNet's hypernym/hyponym tree for one
// category. Confirmed against the empirical hit-rate test below.
const ANIMALS = [
  "aardvark","alligator","ant","anteater","antelope","ape","armadillo","alpaca","albatross","axolotl",
  "bat","bear","bee","beetle","bison","boar","buffalo","butterfly","badger","baboon","beagle","bulldog","boxer",
  "camel","cat","caterpillar","cheetah","chicken","chimpanzee","chipmunk","cobra","cougar","cow","coyote","crab","crane","cricket","crocodile","crow","chihuahua","collie","corgi",
  "deer","dingo","dodo","dog","dolphin","donkey","dove","dragonfly","duck","dachshund","doberman","dalmatian",
  "eagle","earthworm","eel","elephant","elk","emu",
  "falcon","ferret","finch","fish","flamingo","fly","fox","frog",
  "gazelle","gecko","giraffe","goat","goldfish","goose","gorilla","grasshopper","greyhound","guinea pig",
  "hamster","hare","hawk","hedgehog","heron","hippo","hippopotamus","horse","hummingbird","hyena","husky",
  "ibex","iguana","impala",
  "jackal","jaguar","jellyfish",
  "kangaroo","kingfisher","kiwi","koala","komodo dragon",
  "ladybug","lemur","leopard","lion","lizard","llama","lobster","lynx","labrador",
  "macaw","magpie","manatee","mantis","meerkat","mole","mongoose","monkey","moose","mosquito","moth","mouse","mule",
  "newt","nightingale",
  "ocelot","octopus","opossum","orangutan","orca","ostrich","otter","owl","ox",
  "panda","panther","parrot","peacock","pelican","penguin","pig","pigeon","platypus","poodle","porcupine","possum","pug","persian",
  "quail","quokka",
  "rabbit","raccoon","rat","rattlesnake","raven","reindeer","rhinoceros","robin","rooster","rottweiler",
  "salamander","salmon","scorpion","seagull","seahorse","seal","shark","sheep","shrew","skunk","sloth","snail","snake","sparrow","spider","squid","squirrel","starfish","stork","swan","siamese",
  "tarantula","termite","terrier","tiger","toad","tortoise","toucan","trout","turkey","turtle",
  "urchin",
  "vulture",
  "wallaby","walrus","warthog","wasp","weasel","whale","wolf","wolverine","wombat","woodpecker","worm",
  "xerus",
  "yak",
  "zebra",
];

function buildAnimal() {
  const buckets = emptyBuckets();
  ANIMALS.forEach(w => addWord(buckets, w));
  writeCategory("animal", buckets);
}

// ── Food: hand-curated (fruits, vegetables, dishes, snacks, drinks) ───────
// Same rationale as Animal — bounded/closed enough for a reliable hand list,
// and the classic 5th category for this game format.
const FOODS = [
  "apple","apricot","avocado","artichoke","asparagus","almond",
  "banana","blueberry","broccoli","bread","burger","bacon","burrito","beans","biscuit","bagel",
  "carrot","cherry","cabbage","cake","cheese","chicken","chocolate","coconut","cookie","corn","cucumber","cupcake","chili","curry","cereal",
  "date","doughnut","dumpling",
  "eggplant","egg",
  "fig","fries","fajita",
  "grape","grapefruit","garlic","granola","gravy",
  "honey","hummus","ham","hotdog",
  "ice cream",
  "jam","jelly",
  "kale","kiwi","ketchup",
  "lemon","lime","lettuce","lasagna",
  "mango","melon","milk","muffin","mushroom","meatball","mustard",
  "nachos","noodles","nutmeg","nuts",
  "orange","oatmeal","olive","omelet","onion",
  "peach","pear","pineapple","potato","pizza","pasta","popcorn","pretzel","pumpkin","pancake","peanut","pie",
  "quesadilla","quiche",
  "raspberry","rice","radish","ravioli",
  "strawberry","spinach","sandwich","soup","salad","salmon","sausage","spaghetti","sushi","steak","shrimp","syrup",
  "tomato","taco","tea","toast","tofu","turkey",
  "udon",
  "vanilla","vinegar",
  "watermelon","waffle","walnut",
  "yogurt","yam",
  "zucchini",
];

function buildFood() {
  const buckets = emptyBuckets();
  FOODS.forEach(w => addWord(buckets, w));
  writeCategory("food", buckets);
}

console.log("Building Category Blitz seed wordlists from cached source data...\n");
buildName();
buildAnimal();
buildPlace();
buildThing();
buildFood();
console.log("\nDone. Run scripts/generate-catblitz-wordlists.js next to fill per-letter gaps via the API.");
