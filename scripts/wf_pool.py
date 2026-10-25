# Which Came First? item pool. (name, emoji, year, category, source)
# Every item comes from a published list; source keys are documented in
# data/daily_order.json "sources".
POOL = []
def add(cat, src, rows):
    for name, emoji, year in rows:
        POOL.append((name, emoji, year, cat, src))

# ── Films: Wikipedia highest-grossing film of each year (hg), AFI 100 (afi), Oscars Best Picture (oscar), Bond films (bond)
add("film", "highest-grossing-by-year", [
 ("Frankenstein is released", "🧟", 1931), ("Cleopatra (with Elizabeth Taylor) is released", "👑", 1963),
 ("My Fair Lady is released", "🎩", 1964), ("Butch Cassidy and the Sundance Kid is released", "🤠", 1969),
 ("The Exorcist is released", "😱", 1973), ("Grease is released", "🕺", 1978),
 ("The Empire Strikes Back is released", "🌌", 1980), ("Return of the Jedi is released", "🌲", 1983),
 ("Ghostbusters is released", "👻", 1984), ("Back to the Future is released", "⏰", 1985),
 ("Top Gun is released", "✈️", 1986), ("Indiana Jones and the Last Crusade is released", "🏺", 1989),
 ("Ghost (with Patrick Swayze) is released", "🏺", 1990), ("Terminator 2: Judgment Day is released", "🤖", 1991),
 ("Jurassic Park is released", "🦖", 1993), ("Independence Day is released", "🛸", 1996),
 ("Armageddon is released", "☄️", 1998), ("Star Wars: The Phantom Menace is released", "⚔️", 1999),
 ("Mission: Impossible 2 is released", "🕶️", 2000), ("The first Harry Potter film is released", "⚡", 2001),
 ("The Lord of the Rings: The Two Towers is released", "🗼", 2002), ("The Lord of the Rings: The Return of the King is released", "👑", 2003),
 ("Star Wars: Revenge of the Sith is released", "🔴", 2005), ("Pirates of the Caribbean: Dead Man's Chest is released", "🏴‍☠️", 2006),
 ("Harry Potter and the Deathly Hallows – Part 2 is released", "🪄", 2011), ("The Avengers is released", "🛡️", 2012),
 ("Star Wars: The Force Awakens is released", "🌟", 2015), ("Captain America: Civil War is released", "🛡️", 2016),
 ("Star Wars: The Last Jedi is released", "⚔️", 2017), ("Avengers: Infinity War is released", "💎", 2018),
 ("Avengers: Endgame is released", "🦸", 2019), ("Spider-Man: No Way Home is released", "🕷️", 2021),
 ("Avatar: The Way of Water is released", "🌊", 2022),
])
add("film", "afi-100", [
 ("Vertigo is released", "🌀", 1958), ("Some Like It Hot is released", "💋", 1959),
 ("Lawrence of Arabia is released", "🐪", 1962), ("The Graduate is released", "🎓", 1967),
 ("A Clockwork Orange is released", "🍊", 1971), ("Taxi Driver is released", "🚕", 1976),
 ("Apocalypse Now is released", "🚁", 1979), ("Blade Runner is released", "🌃", 1982),
 ("Goodfellas is released", "🍝", 1990), ("Saving Private Ryan is released", "🪖", 1998),
])
add("film", "oscar-best-picture", [
 ("Gandhi is released", "🕊️", 1982), ("Gladiator is released", "🛡️", 2000),
 ("The Departed is released", "🕵️", 2006), ("Slumdog Millionaire is released", "💰", 2008),
 ("The King's Speech is released", "🎙️", 2010), ("Everything Everywhere All at Once is released", "🥯", 2022),
])
add("film", "bond-films", [
 ("Dr. No, the first James Bond film, is released", "🍸", 1962), ("Goldfinger is released", "🥇", 1964),
 ("GoldenEye (Pierce Brosnan's first Bond film) is released", "🕶️", 1995), ("Casino Royale (Daniel Craig's first Bond film) is released", "🃏", 2006),
 ("Skyfall is released", "🍸", 2012), ("No Time to Die is released", "🔫", 2021),
])

# ── Animated films: Disney Animation (disney), Pixar (pixar), highest-grossing-by-year
add("animation", "disney-animation", [
 ("Snow White and the Seven Dwarfs is released", "🍎", 1937), ("Pinocchio is released", "🤥", 1940),
 ("Dumbo is released", "🐘", 1941), ("Bambi is released", "🦌", 1942), ("Cinderella is released", "👠", 1950),
 ("Peter Pan is released", "🧚", 1953), ("Lady and the Tramp is released", "🍝", 1955),
 ("Sleeping Beauty is released", "👸", 1959), ("One Hundred and One Dalmatians is released", "🐶", 1961),
 ("The Jungle Book is released", "🐻", 1967), ("The Little Mermaid is released", "🧜‍♀️", 1989),
 ("Beauty and the Beast is released", "🌹", 1991), ("Aladdin is released", "🧞", 1992),
 ("The Lion King is released", "🦁", 1994), ("Mulan is released", "🗡️", 1998),
 ("Lilo & Stitch is released", "🌺", 2002), ("Tangled is released", "👱‍♀️", 2010),
 ("Zootopia is released", "🐰", 2016), ("Frozen 2 is released", "❄️", 2019),
 ("Encanto is released", "🦋", 2021), ("Moana 2 is released", "🌊", 2024),
])
add("animation", "pixar", [
 ("Monsters, Inc. is released", "👹", 2001), ("Finding Nemo is released", "🐠", 2003),
 ("The Incredibles is released", "🦸", 2004), ("Cars is released", "🏎️", 2006),
 ("Ratatouille is released", "🐀", 2007), ("WALL-E is released", "🤖", 2008), ("Up is released", "🎈", 2009),
 ("Toy Story 3 is released", "🧸", 2010), ("Inside Out is released", "😢", 2015), ("Coco is released", "💀", 2017),
 ("Toy Story 4 is released", "🍴", 2019), ("Soul is released", "🎹", 2020), ("Turning Red is released", "🐼", 2022),
 ("Inside Out 2 is released", "😰", 2024),
])
add("animation", "highest-grossing-by-year", [
 ("Shrek 2 is released", "🟢", 2004), ("Demon Slayer: Mugen Train becomes the year's top film", "🚂", 2020),
 ("Ne Zha 2 becomes the year's top film", "🐉", 2025),
])

# ── Music: Spotify most-streamed songs (spotify) + Stacker 100 iconic moments (stacker-music)
add("music", "spotify-most-streamed", [
 ("Queen release \"Don't Stop Me Now\"", "🎤", 1979), ("Journey release \"Don't Stop Believin'\"", "🎹", 1981),
 ("Toto release \"Africa\"", "🌍", 1982), ("The Police release \"Every Breath You Take\"", "👀", 1983),
 ("A-ha release \"Take On Me\"", "✏️", 1984), ("Guns N' Roses release \"Sweet Child O' Mine\"", "🎸", 1987),
 ("Nirvana release \"Smells Like Teen Spirit\"", "🎸", 1991), ("Radiohead release \"Creep\"", "🎸", 1992),
 ("Oasis release \"Wonderwall\"", "🎸", 1995), ("Coldplay release \"Yellow\"", "💛", 2000),
 ("Linkin Park release \"In the End\"", "🎧", 2000), ("Eminem releases \"Lose Yourself\"", "🎤", 2002),
 ("The Killers release \"Mr. Brightside\"", "🎸", 2003), ("Coldplay release \"Viva La Vida\"", "👑", 2008),
 ("Don Omar releases \"Danza Kuduro\"", "💃", 2010), ("Bruno Mars releases \"Just the Way You Are\"", "💐", 2010),
 ("Passenger release \"Let Her Go\"", "🎻", 2012), ("Avicii releases \"Wake Me Up\"", "🌅", 2013),
 ("OneRepublic release \"Counting Stars\"", "⭐", 2013), ("Mark Ronson & Bruno Mars release \"Uptown Funk\"", "🕺", 2014),
 ("Ed Sheeran releases \"Thinking Out Loud\"", "💭", 2014), ("Justin Bieber releases \"Love Yourself\"", "💔", 2015),
 ("Drake releases \"One Dance\"", "💃", 2016), ("The Chainsmokers release \"Closer\"", "🚗", 2016),
 ("Ed Sheeran releases \"Shape of You\"", "🔷", 2017), ("Imagine Dragons release \"Believer\"", "⚡", 2017),
 ("Lewis Capaldi releases \"Someone You Loved\"", "💔", 2018), ("Lady Gaga & Bradley Cooper release \"Shallow\"", "⭐", 2018),
 ("Post Malone releases \"Sunflower\"", "🌻", 2018), ("The Weeknd releases \"Blinding Lights\"", "💡", 2019),
 ("Tones and I release \"Dance Monkey\"", "🐒", 2019), ("Billie Eilish releases \"Bad Guy\"", "😈", 2019),
 ("Taylor Swift releases \"Cruel Summer\"", "☀️", 2019), ("Olivia Rodrigo releases \"drivers license\"", "🚘", 2021),
 ("The Kid Laroi & Justin Bieber release \"Stay\"", "⏳", 2021), ("Harry Styles releases \"As It Was\"", "🎠", 2022),
 ("SZA releases \"Kill Bill\"", "🗡️", 2022), ("Miley Cyrus releases \"Flowers\"", "🌸", 2023),
 ("Jung Kook releases \"Seven\"", "7️⃣", 2023), ("Billie Eilish releases \"Birds of a Feather\"", "🐦", 2024),
 ("Lady Gaga & Bruno Mars release \"Die With a Smile\"", "😊", 2024), ("Sabrina Carpenter releases \"Espresso\"", "☕", 2024),
])
add("music", "stacker-music", [
 ("The Rolling Stones release \"(I Can't Get No) Satisfaction\"", "👅", 1965), ("The Beach Boys release Pet Sounds", "🏄", 1966),
 ("Black Sabbath release their first album", "🤘", 1970), ("Bob Marley releases \"No Woman, No Cry\"", "🇯🇲", 1975),
 ("\"Rapper's Delight\" becomes the first hip-hop Top 40 hit", "🎤", 1980), ("Cyndi Lauper releases \"Girls Just Want to Have Fun\"", "💃", 1983),
 ("Run-DMC and Aerosmith team up on \"Walk This Way\"", "🎸", 1986), ("Nirvana play MTV Unplugged", "🌻", 1993),
 ("Lady Gaga releases her first album, The Fame", "🌟", 2008), ("Tupac appears as a hologram at Coachella", "👻", 2012),
])

# ── Games & consoles: best-selling games (bsg), TIME 50 (time), best-selling consoles (consoles)
add("game", "best-selling-video-games", [
 ("Sonic the Hedgehog is released", "🦔", 1991), ("Pokémon Gold and Silver are released", "🥇", 1999),
 ("Grand Theft Auto: San Andreas is released", "🚗", 2004), ("Wii Sports is released", "🎳", 2006),
 ("The Elder Scrolls V: Skyrim is released", "🐉", 2011), ("Grand Theft Auto V is released", "💰", 2013),
 ("Mario Kart 8 is released", "🏎️", 2014), ("The Witcher 3 is released", "🐺", 2015),
 ("Overwatch is released", "🎯", 2016), ("The Legend of Zelda: Breath of the Wild is released", "🏔️", 2017),
 ("PUBG is released", "🍳", 2017), ("Red Dead Redemption 2 is released", "🐎", 2018),
 ("Animal Crossing: New Horizons is released", "🏝️", 2020), ("Cyberpunk 2077 is released", "🌆", 2020),
 ("Elden Ring is released", "💍", 2022), ("Hogwarts Legacy is released", "🏰", 2023),
 ("Black Myth: Wukong is released", "🐒", 2024),
])
add("game", "time-50-games", [
 ("Ms. Pac-Man is released", "🎀", 1982), ("Super Mario Bros. is released", "🍄", 1985),
 ("Super Mario Kart is released", "🏁", 1992), ("Final Fantasy VII is released", "⚔️", 1997),
 ("GoldenEye 007 is released for the Nintendo 64", "🔫", 1997), ("Angry Birds is released", "🐦", 2009),
])
add("console", "best-selling-consoles", [
 ("The Atari 2600 goes on sale", "🕹️", 1977), ("The Sega Mega Drive / Genesis goes on sale", "🦔", 1988),
 ("The Game Boy goes on sale", "🎮", 1989), ("The Super Nintendo goes on sale", "🎮", 1990),
 ("The first PlayStation goes on sale", "🎮", 1994), ("The Nintendo 64 goes on sale", "🎮", 1996),
 ("The Sega Dreamcast goes on sale", "🌀", 1998), ("The PlayStation 2 goes on sale", "🎮", 2000),
 ("The first Xbox goes on sale", "❎", 2001), ("The Game Boy Advance goes on sale", "🎮", 2001),
 ("The Nintendo DS goes on sale", "📱", 2004), ("The PSP goes on sale", "🎮", 2004),
 ("The Xbox 360 goes on sale", "❎", 2005), ("The Nintendo Wii goes on sale", "🎮", 2006),
 ("The PlayStation 3 goes on sale", "🎮", 2006), ("The Nintendo 3DS goes on sale", "🎮", 2011),
 ("The PlayStation 4 goes on sale", "🎮", 2013), ("The Xbox One goes on sale", "❎", 2013),
 ("The Nintendo Switch goes on sale", "🎮", 2017), ("The PlayStation 5 goes on sale", "🎮", 2020),
])

# ── Books: Wikipedia best-selling books & book series
add("book", "best-selling-books", [
 ("Pride and Prejudice is published", "📖", 1813), ("A Tale of Two Cities is published", "📖", 1859),
 ("Alice's Adventures in Wonderland is published", "🐇", 1865), ("War and Peace is published", "📖", 1869),
 ("Adventures of Huckleberry Finn is published", "🛶", 1885), ("The Tale of Peter Rabbit is published", "🐰", 1902),
 ("Anne of Green Gables is published", "📖", 1908), ("The Great Gatsby is published", "🥂", 1925),
 ("Winnie-the-Pooh is published", "🍯", 1926), ("The Hobbit is published", "💍", 1937),
 ("Agatha Christie's And Then There Were None is published", "🔪", 1939), ("The Little Prince is published", "🌹", 1943),
 ("Pippi Longstocking is published", "👧", 1945), ("Anne Frank's diary is published", "📔", 1947),
 ("The first Narnia book is published", "🦁", 1950), ("The Catcher in the Rye is published", "🧢", 1951),
 ("Charlotte's Web is published", "🕷️", 1952), ("The first James Bond novel is published", "🍸", 1953),
 ("The Cat in the Hat is published", "🎩", 1957), ("Paddington Bear first appears in a book", "🧸", 1958),
 ("To Kill a Mockingbird is published", "🐦", 1960), ("Charlie and the Chocolate Factory is published", "🍫", 1964),
 ("Dune is published", "🏜️", 1965), ("One Hundred Years of Solitude is published", "📖", 1967),
 ("The Very Hungry Caterpillar is published", "🐛", 1969), ("The Hitchhiker's Guide to the Galaxy is published", "🌌", 1979),
 ("Where's Wally? is published", "🔍", 1987), ("The Alchemist is published", "🏜️", 1988),
 ("Goosebumps book series begins", "👻", 1992), ("The first Game of Thrones book is published", "🐺", 1996),
 ("The first Harry Potter book is published", "⚡", 1997), ("The Gruffalo is published", "👹", 1999),
 ("The Da Vinci Code is published", "🔐", 2003), ("Diary of a Wimpy Kid is published", "📓", 2004),
 ("Twilight is published", "🧛", 2005), ("The Hunger Games is published", "🏹", 2008),
 ("Fifty Shades of Grey is published", "🩶", 2011), ("Sapiens is published", "🧠", 2011),
 ("The Fault in Our Stars is published", "⭐", 2012), ("It Ends with Us is published", "🌸", 2016),
 ("Michelle Obama's Becoming is published", "📕", 2018),
])

# ── Sport: World Cup finals (wc), Olympic hosts (olympics), Ballon d'Or (ballon)
add("sport", "world-cup-finals", [
 ("England win the World Cup", "🏴", 1966), ("Brazil win the World Cup in Mexico", "🇧🇷", 1970),
 ("Argentina win their first World Cup", "🇦🇷", 1978), ("Italy win the World Cup in Spain", "🇮🇹", 1982),
 ("Brazil win the World Cup in the USA", "🇧🇷", 1994), ("France win the World Cup at home", "🇫🇷", 1998),
 ("Brazil win the World Cup in Japan and South Korea", "🇧🇷", 2002), ("Spain win their first World Cup", "🇪🇸", 2010),
 ("France win the World Cup in Russia", "🇫🇷", 2018), ("Argentina and Messi win the World Cup in Qatar", "🏆", 2022),
])
add("sport", "olympic-hosts", [
 ("London hosts the first post-war Olympics", "🇬🇧", 1948), ("Rome hosts the Olympics", "🇮🇹", 1960),
 ("Tokyo hosts its first Olympics", "🇯🇵", 1964), ("Mexico City hosts the Olympics", "🇲🇽", 1968),
 ("Montreal hosts the Olympics", "🇨🇦", 1976), ("Los Angeles hosts the Olympics", "🇺🇸", 1984),
 ("Seoul hosts the Olympics", "🇰🇷", 1988), ("Barcelona hosts the Olympics", "🇪🇸", 1992),
 ("Atlanta hosts the Olympics", "🇺🇸", 1996), ("Sydney hosts the Olympics", "🇦🇺", 2000),
 ("Athens hosts the Olympics", "🇬🇷", 2004), ("Beijing hosts the Summer Olympics", "🇨🇳", 2008),
 ("Vancouver hosts the Winter Olympics", "🇨🇦", 2010), ("Rio de Janeiro hosts the Olympics", "🇧🇷", 2016),
 ("Beijing hosts the Winter Olympics", "⛷️", 2022),
])
add("sport", "ballon-dor", [
 ("Johan Cruyff wins his first Ballon d'Or", "⚽", 1971), ("Brazil's Ronaldo wins his first Ballon d'Or", "⚽", 1997),
 ("Ronaldinho wins the Ballon d'Or", "⚽", 2005), ("Kaká wins the Ballon d'Or", "⚽", 2007),
 ("Cristiano Ronaldo wins his first Ballon d'Or", "⚽", 2008), ("Lionel Messi wins his first Ballon d'Or", "⚽", 2009),
 ("Luka Modrić wins the Ballon d'Or", "⚽", 2018), ("Messi wins his eighth Ballon d'Or", "⚽", 2023),
 ("Rodri wins the Ballon d'Or", "⚽", 2024),
])

# ── Space: "100 milestones that took us to the stars" (newspaceeconomy)
add("space", "space-100-milestones", [
 ("The first liquid-fuelled rocket is launched", "🚀", 1926), ("The first woman goes to space", "👩‍🚀", 1963),
 ("The first spacewalk", "🧑‍🚀", 1965), ("The first soft landing on the Moon (Luna 9)", "🌕", 1966),
 ("Apollo 8 orbits the Moon and takes the \"Earthrise\" photo", "🌍", 1968), ("Apollo 13's crew returns safely", "🆘", 1970),
 ("The first space station is launched", "🛰️", 1971), ("The Voyager probes are launched", "🛰️", 1977),
 ("The first Space Shuttle launches", "🚀", 1981), ("Sally Ride becomes the first American woman in space", "👩‍🚀", 1983),
 ("The Mir space station is launched", "🛰️", 1986), ("The Hubble Space Telescope is launched", "🔭", 1990),
 ("The first planets outside our solar system are discovered", "🪐", 1992), ("The first rover lands on Mars (Sojourner)", "🔴", 1997),
 ("The first crew moves into the International Space Station", "🛰️", 2000), ("The first space tourist flies", "🧳", 2001),
 ("China sends its first astronaut to space", "🇨🇳", 2003), ("The Curiosity rover lands on Mars", "🔴", 2012),
 ("A spacecraft lands on a comet for the first time", "☄️", 2014), ("New Horizons flies past Pluto", "🪐", 2015),
 ("The first photo of a black hole is revealed", "🕳️", 2019), ("SpaceX flies the first commercial crewed spaceflight", "🚀", 2020),
 ("NASA's Perseverance rover lands on Mars", "🔴", 2021), ("NASA deliberately crashes a spacecraft into an asteroid", "☄️", 2022),
 ("A private company lands on the Moon for the first time", "🌕", 2024),
])

# ── Inventions: Britannica list
add("invention", "britannica", [
 ("Dynamite is invented", "🧨", 1867), ("The typewriter is invented", "⌨️", 1868),
 ("The escalator is invented", "🛗", 1891), ("The zipper is invented", "🤐", 1893),
 ("Aspirin is invented", "💊", 1897), ("Crayons are invented", "🖍️", 1903),
 ("The bra is invented", "👙", 1913), ("Automatic traffic lights are invented", "🚦", 1923),
 ("Scotch tape is invented", "📎", 1930), ("The jet engine is invented", "✈️", 1930),
 ("Nylon is invented", "🧵", 1937), ("The photocopier is invented", "🖨️", 1937),
 ("The helicopter is invented", "🚁", 1939), ("The electric guitar is invented", "🎸", 1941),
 ("The transistor is invented", "🔌", 1947), ("The instant camera is invented", "📸", 1947),
 ("The vinyl LP record is invented", "💿", 1948), ("The TV remote control is invented", "📺", 1950),
 ("The music synthesizer is invented", "🎹", 1955), ("The skateboard is invented", "🛹", 1958),
 ("The LED light is invented", "💡", 1962), ("Kevlar is invented", "🦺", 1965),
 ("The pocket calculator is invented", "🧮", 1967), ("The home smoke detector is invented", "🚨", 1969),
 ("The digital watch is invented", "⌚", 1970), ("The personal computer is invented", "🖥️", 1974),
 ("The camcorder is invented", "📹", 1982), ("The laptop computer is invented", "💻", 1983),
 ("DNA fingerprinting is invented", "🧬", 1984), ("Virtual reality is invented", "🥽", 1989),
])
add("tech", "mentalfloss-internet", [
 ("The first message is sent over ARPANET, the internet's ancestor", "🖧", 1969),
])
add("tech", "stacker-music", [("Apple launches the first iPod", "🎧", 2001)])

# ── Landmarks: 24/7 Wall St "Early Photographs of the World's Most Famous Landmarks"
add("landmark", "247-landmarks", [
 ("St. Basil's Cathedral in Moscow is completed", "⛪", 1561), ("The Blue Mosque in Istanbul is completed", "🕌", 1616),
 ("St. Peter's Basilica in Rome is completed", "⛪", 1626), ("The Taj Mahal is completed", "🕌", 1653),
 ("The Hollywood sign goes up", "🎬", 1923), ("The Empire State Building is completed", "🏙️", 1931),
 ("Christ the Redeemer statue in Rio is completed", "✝️", 1931), ("The Sydney Harbour Bridge is completed", "🌉", 1932),
 ("Alcatraz opens as a prison", "⛓️", 1934),
])

# ═══ Second batch ═══
add("film", "disney-animation", [
 ("Fantasia is released", "🎼", 1940), ("Alice in Wonderland (Disney) is released", "🐇", 1951), ("The Aristocats is released", "🐱", 1970),
 ("Disney's Robin Hood is released", "🦊", 1973), ("Pocahontas is released", "🍃", 1995), ("Hercules is released", "💪", 1997),
 ("Tarzan is released", "🦍", 1999), ("Wreck-It Ralph is released", "🍬", 2012), ("Big Hero 6 is released", "🤖", 2014),
 ("Moana is released", "🌊", 2016), ("Wish is released", "⭐", 2023), ("Zootopia 2 is released", "🦊", 2025),
])
add("film", "pixar", [
 ("A Bug's Life is released", "🐜", 1998), ("Toy Story 2 is released", "🤠", 1999), ("Brave is released", "🏹", 2012),
 ("Monsters University is released", "🎓", 2013), ("Finding Dory is released", "🐟", 2016), ("Incredibles 2 is released", "🦸", 2018),
 ("Luca is released", "🌊", 2021), ("Elemental is released", "🔥", 2023), ("Elio is released", "👽", 2025),
])
add("film", "bond-films", [
 ("From Russia with Love is released", "🚂", 1963), ("Thunderball is released", "🌊", 1965), ("Live and Let Die (Roger Moore's first Bond film) is released", "🐊", 1973),
 ("The Spy Who Loved Me is released", "🏔️", 1977), ("Moonraker is released", "🚀", 1979), ("Octopussy is released", "🐙", 1983),
 ("Licence to Kill is released", "🔫", 1989), ("Tomorrow Never Dies is released", "📰", 1997), ("Die Another Day is released", "💎", 2002),
 ("Quantum of Solace is released", "💧", 2008), ("Spectre is released", "🐙", 2015),
])
add("film", "oscar-best-picture", [
 ("An American in Paris is released", "🗼", 1951), ("The Godfather Part II is released", "🌹", 1974), ("Chariots of Fire is released", "🏃", 1981),
 ("The Last Emperor is released", "🏯", 1987), ("Driving Miss Daisy is released", "🚗", 1989), ("Shakespeare in Love is released", "🪶", 1998),
 ("Chicago (the musical film) is released", "🎭", 2002), ("The Artist is released", "🎞️", 2011), ("Argo is released", "✈️", 2012),
 ("12 Years a Slave is released", "⛓️", 2013), ("Spotlight is released", "📰", 2015), ("Moonlight is released", "🌙", 2016),
 ("The Shape of Water is released", "💧", 2017), ("Green Book is released", "🚗", 2018), ("CODA is released", "🤟", 2021),
])
add("film", "afi-100", [
 ("The Gold Rush (Charlie Chaplin) is released", "🎩", 1925), ("City Lights is released", "🌃", 1931), ("Modern Times is released", "⚙️", 1936),
 ("Rear Window is released", "🪟", 1954), ("12 Angry Men is released", "⚖️", 1957), ("North by Northwest is released", "✈️", 1959),
 ("Spartacus is released", "⚔️", 1960), ("West Side Story is released", "💃", 1961), ("Dr. Strangelove is released", "💣", 1964),
 ("Bonnie and Clyde is released", "🔫", 1967), ("Midnight Cowboy is released", "🤠", 1969), ("Chinatown is released", "🕵️", 1974),
 ("One Flew Over the Cuckoo's Nest is released", "🏥", 1975), ("Annie Hall is released", "👒", 1977), ("Raging Bull is released", "🥊", 1980),
 ("Tootsie is released", "💄", 1982), ("Platoon is released", "🪖", 1986), ("Unforgiven is released", "🤠", 1992),
])
add("film", "highest-grossing-by-year", [
 ("The Ten Commandments is released", "📜", 1956), ("The Bridge on the River Kwai is released", "🌉", 1957), ("South Pacific is released", "🌴", 1958),
 ("Love Story is released", "💕", 1970), ("The Towering Inferno is released", "🔥", 1974), ("Fatal Attraction is released", "🐇", 1987),
 ("Rain Man is released", "🃏", 1988), ("Pirates of the Caribbean: At World's End is released", "🏴‍☠️", 2007),
])
add("tv", "emmy-best-drama", [
 ("Gunsmoke wins the Emmy for best drama", "🤠", 1958), ("The Fugitive wins the Emmy for best drama", "🏃", 1966),
 ("The Waltons wins the Emmy for best drama", "🏡", 1973), ("The West Wing wins the Emmy for best drama", "🏛️", 2000),
 ("The Sopranos wins the Emmy for best drama", "🍝", 2004), ("Lost wins the Emmy for best drama", "🏝️", 2005),
 ("24 wins the Emmy for best drama", "⏱️", 2006), ("Mad Men wins the Emmy for best drama", "🥃", 2008),
 ("Homeland wins the Emmy for best drama", "🕵️", 2012), ("Game of Thrones wins the Emmy for best drama", "🐉", 2015),
 ("The Handmaid's Tale wins the Emmy for best drama", "🔴", 2017), ("Succession wins the Emmy for best drama", "💼", 2020),
 ("The Crown wins the Emmy for best drama", "👑", 2021), ("Shōgun wins the Emmy for best drama", "⚔️", 2024),
])
add("tv", "emmy-best-comedy", [
 ("The Dick Van Dyke Show wins the Emmy for best comedy", "📺", 1963), ("The Monkees wins the Emmy for best comedy", "🐒", 1967),
 ("All in the Family wins the Emmy for best comedy", "🪑", 1971), ("M*A*S*H wins the Emmy for best comedy", "🏥", 1974),
 ("The Mary Tyler Moore Show wins the Emmy for best comedy", "📰", 1975), ("Taxi wins the Emmy for best comedy", "🚕", 1979),
 ("Cheers wins the Emmy for best comedy", "🍺", 1983), ("The Golden Girls wins the Emmy for best comedy", "👵", 1986),
 ("The Wonder Years wins the Emmy for best comedy", "🧒", 1988), ("Frasier wins the Emmy for best comedy", "🛋️", 1994),
])
add("music", "spotify-most-streamed", [
 ("Fleetwood Mac release \"Dreams\"", "🌙", 1977), ("The Goo Goo Dolls release \"Iris\"", "🌸", 1998), ("Eminem releases \"Without Me\"", "🎤", 2002),
 ("Coldplay release \"The Scientist\"", "🔬", 2002), ("Linkin Park release \"Numb\"", "🎧", 2003), ("Arctic Monkeys release \"505\"", "🎸", 2007),
 ("Macklemore & Ryan Lewis release \"Can't Hold Us\"", "🙌", 2011), ("The Neighbourhood release \"Sweater Weather\"", "🧥", 2012),
 ("Bruno Mars releases \"Locked Out of Heaven\"", "🔒", 2012), ("Maroon 5 release \"Payphone\"", "☎️", 2012), ("Tom Odell releases \"Another Love\"", "💔", 2012),
 ("Imagine Dragons release \"Demons\"", "😈", 2012), ("Arctic Monkeys release \"Do I Wanna Know?\"", "🎸", 2013), ("Hozier releases \"Take Me to Church\"", "⛪", 2013),
 ("John Legend releases \"All of Me\"", "💍", 2013), ("Vance Joy releases \"Riptide\"", "🌊", 2013), ("Ed Sheeran releases \"Photograph\"", "📷", 2014),
 ("Major Lazer & DJ Snake release \"Lean On\"", "💃", 2015), ("Twenty One Pilots release \"Stressed Out\"", "😩", 2015), ("Justin Bieber releases \"Sorry\"", "🙏", 2015),
 ("The Weeknd & Daft Punk release \"Starboy\"", "⭐", 2016), ("James Arthur releases \"Say You Won't Let Go\"", "💑", 2016), ("Shawn Mendes releases \"Treat You Better\"", "💙", 2016),
 ("Ed Sheeran releases \"Perfect\"", "💍", 2017), ("Post Malone & 21 Savage release \"Rockstar\"", "🎸", 2017), ("Kendrick Lamar releases \"Humble\"", "🙇", 2017),
 ("Imagine Dragons release \"Thunder\"", "⚡", 2017), ("Drake releases \"God's Plan\"", "🙏", 2018), ("Calvin Harris & Dua Lipa release \"One Kiss\"", "💋", 2018),
 ("Kendrick Lamar & SZA release \"All the Stars\"", "✨", 2018), ("Shawn Mendes & Camila Cabello release \"Señorita\"", "💃", 2019), ("Dua Lipa releases \"Don't Start Now\"", "🪩", 2019),
 ("Harry Styles releases \"Watermelon Sugar\"", "🍉", 2019), ("Ariana Grande releases \"7 Rings\"", "💍", 2019), ("Glass Animals release \"Heat Waves\"", "🔥", 2020),
 ("The Weeknd releases \"Save Your Tears\"", "😢", 2020), ("Elton John & Dua Lipa release \"Cold Heart\"", "❄️", 2021), ("Benson Boone releases \"Beautiful Things\"", "🌷", 2024),
 ("Rosé & Bruno Mars release \"APT.\"", "🏢", 2024), ("Taylor Swift releases \"The Fate of Ophelia\"", "🌊", 2025),
])
add("music", "stacker-music", [
 ("Frank Sinatra causes teen mania in Times Square", "🎙️", 1942), ("Chuck Berry releases \"Maybellene\"", "🎸", 1955), ("James Brown records Live at the Apollo", "🕺", 1962),
 ("Simon & Garfunkel play Central Park", "🌳", 1981), ("Aretha Franklin becomes the first woman in the Rock & Roll Hall of Fame", "👑", 1987),
 ("Whitney Houston sings the US national anthem at the Super Bowl", "🇺🇸", 1991), ("Woodstock '99 descends into chaos", "🔥", 1999),
 ("Beyoncé wins six Grammys in one night", "🏆", 2010), ("James Corden's Carpool Karaoke launches with Mariah Carey", "🚗", 2015),
])
add("game", "best-selling-video-games", [
 ("Duck Hunt is released", "🦆", 1984), ("New Super Mario Bros. is released", "🍄", 2006), ("Wii Fit is released", "🧘", 2007),
 ("Mario Kart Wii is released", "🏎️", 2008), ("Grand Theft Auto IV is released", "🚕", 2008), ("Call of Duty: Black Ops is released", "🪖", 2010),
 ("Terraria is released", "⛏️", 2011), ("Fallout 4 is released", "☢️", 2015), ("Stardew Valley is released", "🌾", 2016),
 ("Super Mario Odyssey is released", "🎩", 2017), ("Super Smash Bros. Ultimate is released", "👊", 2018), ("Monster Hunter: World is released", "🐲", 2018),
 ("Pokémon Sword and Shield are released", "⚔️", 2019), ("Call of Duty: Modern Warfare (2019) is released", "🪖", 2019), ("It Takes Two is released", "👫", 2021),
 ("Pokémon Scarlet and Violet are released", "🟥", 2022),
])
add("game", "time-50-games", [
 ("Galaga is released", "👾", 1981), ("Myst is released", "🏝️", 1993), ("SimCity 2000 is released", "🏙️", 1993), ("Quake is released", "🔨", 1996),
 ("Super Smash Bros. is released", "👊", 1999), ("Counter-Strike is released", "🔫", 2000), ("Diablo II is released", "😈", 2000), ("Half-Life 2 is released", "🔧", 2004),
])
add("book", "best-selling-books", [
 ("Black Beauty is published", "🐴", 1877), ("Heidi is published", "🏔️", 1880), ("The Adventures of Pinocchio is published", "🤥", 1881),
 ("The Wind in the Willows is published", "🐸", 1908), ("Tarzan of the Apes is published", "🌴", 1914), ("Gone with the Wind (the novel) is published", "📖", 1936),
 ("Rebecca is published", "🏰", 1938), ("The Grapes of Wrath is published", "🍇", 1939), ("Curious George is published", "🐵", 1941),
 ("The Old Man and the Sea is published", "🎣", 1952), ("Fahrenheit 451 is published", "🔥", 1953), ("Lolita is published", "📖", 1955),
 ("Things Fall Apart is published", "📖", 1958), ("Catch-22 is published", "✈️", 1961), ("Where the Wild Things Are is published", "👾", 1963),
 ("The Outsiders is published", "📖", 1967), ("Matilda is published", "📚", 1988), ("A Brief History of Time is published", "⏳", 1988),
 ("Captain Underpants is published", "🩲", 1997), ("A Series of Unfortunate Events begins", "📕", 1999), ("Life of Pi is published", "🐯", 2001),
 ("The Kite Runner is published", "🪁", 2003), ("The Book Thief is published", "📚", 2005), ("The first Percy Jackson book is published", "🔱", 2005),
 ("The Girl with the Dragon Tattoo is published", "🐉", 2005), ("Divergent is published", "📕", 2011), ("Gone Girl is published", "📖", 2012),
 ("Me Before You is published", "💛", 2012), ("Where the Crawdads Sing is published", "🦀", 2018),
])
add("space", "space-100-milestones", [
 ("Laika becomes the first animal to orbit Earth", "🐕", 1957), ("The first photos of the Moon's far side", "🌑", 1959),
 ("Alan Shepard becomes the first American in space", "🇺🇸", 1961), ("Mariner 4 sends the first close-up photos of Mars", "🔴", 1965),
 ("Venera 7 makes the first landing on another planet", "🪐", 1970), ("The Skylab space station is launched", "🛰️", 1973),
 ("US and Soviet spacecraft dock in orbit (Apollo–Soyuz)", "🤝", 1975), ("Viking 1 sends the first pictures from the surface of Mars", "🔴", 1976),
 ("The first untethered spacewalk", "🧑‍🚀", 1984), ("Galileo becomes the first spacecraft to orbit Jupiter", "🪐", 1995),
 ("Cassini arrives at Saturn", "🪐", 2004), ("The Huygens probe lands on Saturn's moon Titan", "🌕", 2005),
 ("SpaceX's Dragon becomes the first private spacecraft to orbit and return", "🐉", 2010), ("India reaches Mars on its first try", "🇮🇳", 2014),
 ("SpaceX lands an orbital rocket booster for the first time", "🚀", 2015), ("China lands on the far side of the Moon", "🌑", 2019),
 ("China brings back Moon rock samples", "🌕", 2020), ("Inspiration4, the first all-civilian orbital flight", "👨‍🚀", 2021),
 ("The James Webb Space Telescope begins science operations", "🔭", 2022), ("Artemis I flies around the Moon", "🌕", 2022),
])
add("invention", "britannica", [
 ("The roller coaster is invented", "🎢", 1884), ("The motorcycle is invented", "🏍️", 1885), ("The dishwasher is invented", "🍽️", 1886),
 ("The radio is invented", "📻", 1896), ("The paper clip is invented", "📎", 1899), ("The battery flashlight is invented", "🔦", 1899),
 ("The electric vacuum cleaner is invented", "🧹", 1901), ("Air conditioning is invented", "❄️", 1902), ("The electric washing machine is invented", "🧺", 1907),
 ("The military tank is invented", "🪖", 1915), ("The lipstick tube is invented", "💄", 1915), ("The first supermarket opens", "🛒", 1930),
 ("The parking meter is invented", "🅿️", 1932), ("The laundromat is invented", "🧼", 1934), ("The Richter scale is invented", "🌋", 1935),
 ("Teflon is invented", "🍳", 1938), ("The car airbag is invented", "🚗", 1952), ("The heart pacemaker is invented", "❤️", 1952),
 ("Fibre optics are invented", "🔆", 1955), ("The car shoulder seat belt is invented", "🚘", 1959), ("The communications satellite is invented", "📡", 1960),
 ("The LCD screen is invented", "📺", 1963), ("The CT scanner is invented", "🩻", 1972), ("Genetic engineering is invented", "🧬", 1973),
 ("Laser eye surgery is invented", "👁️", 1987),
])
add("sport", "olympic-hosts", [
 ("Berlin hosts the Olympics", "🇩🇪", 1936), ("Helsinki hosts the Olympics", "🇫🇮", 1952), ("Melbourne hosts the Olympics", "🇦🇺", 1956),
 ("Moscow hosts the Olympics", "🇷🇺", 1980), ("Sarajevo hosts the Winter Olympics", "⛷️", 1984), ("Calgary hosts the Winter Olympics", "🇨🇦", 1988),
 ("Lillehammer hosts the Winter Olympics", "🇳🇴", 1994), ("Nagano hosts the Winter Olympics", "🗾", 1998), ("Salt Lake City hosts the Winter Olympics", "🏔️", 2002),
 ("Turin hosts the Winter Olympics", "🇮🇹", 2006), ("Sochi hosts the Winter Olympics", "⛷️", 2014), ("Pyeongchang hosts the Winter Olympics", "🇰🇷", 2018),
])
add("sport", "ballon-dor", [
 ("Michel Platini wins his first Ballon d'Or", "⚽", 1983), ("Marco van Basten wins his first Ballon d'Or", "⚽", 1988), ("George Weah wins the Ballon d'Or", "⚽", 1995),
 ("Zinedine Zidane wins the Ballon d'Or", "⚽", 1998), ("Luís Figo wins the Ballon d'Or", "⚽", 2000), ("Michael Owen wins the Ballon d'Or", "⚽", 2001),
 ("Karim Benzema wins the Ballon d'Or", "⚽", 2022), ("Ousmane Dembélé wins the Ballon d'Or", "⚽", 2025),
])
add("sport", "wimbledon-champions", [
 ("Björn Borg wins his first Wimbledon", "🎾", 1976), ("Martina Navratilova wins her first Wimbledon", "🎾", 1978), ("Pete Sampras wins his first Wimbledon", "🎾", 1993),
 ("Venus Williams wins her first Wimbledon", "🎾", 2000), ("Serena Williams wins her first Wimbledon", "🎾", 2002), ("Roger Federer wins his first Wimbledon", "🎾", 2003),
 ("Andy Murray wins Wimbledon", "🎾", 2013),
])
add("sport", "f1-champions", [
 ("Juan Manuel Fangio wins his first F1 title", "🏎️", 1951), ("Jackie Stewart wins his first F1 title", "🏎️", 1969), ("Niki Lauda wins his first F1 title", "🏎️", 1975),
 ("Ayrton Senna wins his first F1 title", "🏎️", 1988), ("Michael Schumacher wins his first F1 title", "🏎️", 1994), ("Fernando Alonso wins his first F1 title", "🏎️", 2005),
 ("Lewis Hamilton wins his first F1 title", "🏎️", 2008), ("Sebastian Vettel wins his first F1 title", "🏎️", 2010), ("Nico Rosberg wins the F1 title", "🏎️", 2016),
])

# ═══ Third batch ═══
add("invention", "britannica", [
 ("The bicycle is invented", "🚲", 1818), ("Braille is invented", "⠃", 1824), ("Photography is invented", "📷", 1837),
 ("The postage stamp is invented", "✉️", 1840), ("The sewing machine is invented", "🧵", 1841), ("The first Christmas card is sent", "🎄", 1843),
 ("The safety pin is invented", "🧷", 1849), ("The passenger elevator is invented", "🛗", 1852), ("Potato chips are invented", "🥔", 1853),
 ("The periodic table is created", "🧪", 1871), ("The cash register is invented", "🧾", 1879), ("The steel-frame skyscraper is invented", "🏙️", 1884),
 ("Contact lenses are invented", "👁️", 1887), ("The drinking straw is invented", "🥤", 1888), ("The jukebox is invented", "📻", 1889),
 ("The electric toaster is invented", "🍞", 1893), ("The hair dryer is invented", "💨", 1920), ("The sticking plaster (Band-Aid) is invented", "🩹", 1921),
 ("Insulin is first extracted to treat diabetes", "💉", 1921), ("Frozen food is invented", "🧊", 1924), ("Kool-Aid is invented", "🥤", 1927),
 ("Scuba gear is invented", "🤿", 1943), ("Sunscreen is invented", "🧴", 1944), ("Cat litter is invented", "🐈", 1947),
 ("Disposable nappies (diapers) are invented", "👶", 1950), ("The microchip (integrated circuit) is invented", "🔲", 1958), ("Ultrasound baby scans are invented", "🤰", 1958),
 ("AstroTurf is invented", "🏟️", 1965), ("The food processor is invented", "🥣", 1971), ("The first IVF baby is born", "👶", 1978),
])
add("space", "space-100-milestones", [
 ("The first US satellite is launched", "🛰️", 1958), ("The first weather satellite is launched", "🌦️", 1960), ("A Soviet robot rover drives on the Moon", "🚙", 1970),
 ("Astronauts drive a rover on the Moon (Apollo 15)", "🚙", 1971), ("Apollo 17, the last crewed Moon landing", "🌕", 1972), ("Pioneer 10 flies past Jupiter", "🪐", 1973),
 ("Pioneer 11 flies past Saturn", "🪐", 1979), ("Voyager 2 flies past Uranus", "🔵", 1986), ("Voyager 2 flies past Neptune", "🔵", 1989),
 ("A cosmonaut finishes a record 437 days in space", "⏳", 1995), ("SpaceX's Falcon 1 becomes the first private rocket to reach orbit", "🚀", 2008),
 ("Japan returns the first asteroid sample", "🪨", 2010), ("Juno sends the first pictures of Jupiter's poles", "🪐", 2016),
 ("SpaceX flies a used rocket into orbit again", "♻️", 2017), ("The Parker Solar Probe flies through the Sun's atmosphere", "☀️", 2021),
])
add("sport", "f1-champions", [
 ("Nelson Piquet wins his first F1 title", "🏎️", 1981), ("Alain Prost wins his first F1 title", "🏎️", 1985), ("Nigel Mansell wins the F1 title", "🏎️", 1992),
 ("Mika Häkkinen wins his first F1 title", "🏎️", 1998), ("Kimi Räikkönen wins the F1 title", "🏎️", 2007), ("James Hunt wins the F1 title", "🏎️", 1976),
])
add("sport", "wimbledon-champions", [
 ("Billie Jean King wins Wimbledon in the first Open Era year", "🎾", 1968), ("Evonne Goolagong wins her first Wimbledon", "🎾", 1971),
 ("Chris Evert wins her first Wimbledon", "🎾", 1974), ("Martina Navratilova wins a record ninth Wimbledon", "🎾", 1990),
])
add("sport", "ballon-dor", [
 ("Stanley Matthews wins the first Ballon d'Or", "⚽", 1956), ("Alfredo Di Stéfano wins his first Ballon d'Or", "⚽", 1957), ("Lev Yashin, a goalkeeper, wins the Ballon d'Or", "🧤", 1963),
 ("Eusébio wins the Ballon d'Or", "⚽", 1965), ("George Best wins the Ballon d'Or", "⚽", 1968), ("Franz Beckenbauer wins his first Ballon d'Or", "⚽", 1972),
 ("Ruud Gullit wins the Ballon d'Or", "⚽", 1987), ("Roberto Baggio wins the Ballon d'Or", "⚽", 1993), ("Hristo Stoichkov wins the Ballon d'Or", "⚽", 1994),
 ("Rivaldo wins the Ballon d'Or", "⚽", 1999), ("Fabio Cannavaro wins the Ballon d'Or", "⚽", 2006),
])
add("sport", "olympic-hosts", [
 ("Chamonix hosts the first Winter Olympics", "⛷️", 1924), ("Amsterdam hosts the Olympics", "🇳🇱", 1928), ("Los Angeles hosts its first Olympics", "🇺🇸", 1932),
 ("Innsbruck hosts the Winter Olympics", "🇦🇹", 1964), ("Grenoble hosts the Winter Olympics", "🇫🇷", 1968),
])
add("music", "stacker-music", [
 ("Frank Sinatra pioneers the concept album", "💿", 1954), ("Harry Belafonte's Calypso sells a million copies", "🌴", 1956), ("Pete Townshend smashes his guitar on stage", "🎸", 1964),
 ("Bob Dylan releases \"Like a Rolling Stone\"", "🎸", 1965), ("Sonny & Cher release \"I Got You Babe\"", "💑", 1965), ("The Velvet Underground team up with Andy Warhol", "🍌", 1967),
 ("David Bowie retires Ziggy Stardust", "⚡", 1973), ("Madonna begins her first world tour", "🎤", 1987), ("N.W.A. release their protest anthem", "🎤", 1988),
 ("Snoop Dogg makes West Coast hip-hop mainstream", "🎤", 1993), ("Metallica sue Napster", "⚖️", 2000), ("Mariah Carey turns up unannounced on TRL", "🍦", 2001),
 ("Radiohead let fans pay what they want for an album", "💸", 2007), ("Taylor Swift becomes the youngest winner of the top CMA award", "🤠", 2009),
 ("Five songs from Katy Perry's Teenage Dream hit No. 1", "🍭", 2011), ("U2 put their album on everyone's iTunes", "🍏", 2014), ("Taylor Swift gets Apple to pay artists", "💰", 2015),
])
add("book", "best-selling-books", [
 ("The Hardy Boys series begins", "🔎", 1927), ("The Nancy Drew series begins", "🔦", 1930), ("The first Thomas the Tank Engine book is published", "🚂", 1945),
 ("Noddy first appears in a book", "🚗", 1949), ("Miffy first appears in a book", "🐰", 1955), ("Clifford the Big Red Dog is published", "🐕", 1963),
 ("The first Mr. Men book is published", "🙂", 1971), ("Choose Your Own Adventure books begin", "🔀", 1979), ("The first Discworld book is published", "🐢", 1983),
 ("The Baby-Sitters Club series begins", "👧", 1986), ("The 7 Habits of Highly Effective People is published", "📈", 1989), ("The Wheel of Time series begins", "☸️", 1990),
 ("Outlander is published", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", 1991), ("The first Alex Cross novel is published", "🕵️", 1993), ("His Dark Materials begins", "🧭", 1995),
 ("Animorphs begins", "🦎", 1996), ("Rich Dad Poor Dad is published", "💵", 1997), ("Who Moved My Cheese? is published", "🧀", 1998),
 ("The Secret is published", "🤫", 2006), ("The Help is published", "📖", 2009), ("The Girl on the Train is published", "🚆", 2015),
])
add("game", "time-50-games", [
 ("The Oregon Trail is released", "🐂", 1971), ("Zork is released", "🗺️", 1977), ("Castlevania is released", "🧛", 1986), ("Wolfenstein 3D is released", "🔫", 1992),
 ("Final Fantasy VI is released", "⚔️", 1994), ("Gran Turismo 3 is released", "🏎️", 2001), ("Resident Evil 4 is released", "🧟", 2005), ("BioShock is released", "🌊", 2007),
 ("Fallout 3 is released", "☢️", 2008), ("Red Dead Redemption is released", "🤠", 2010), ("Portal 2 is released", "🌀", 2011), ("Dota 2 is released", "🛡️", 2013),
])
add("console", "best-selling-consoles", [
 ("The Intellivision goes on sale", "🕹️", 1980), ("The Sega Game Gear goes on sale", "🎮", 1990), ("The Sega Saturn goes on sale", "🪐", 1994),
 ("The PlayStation Vita goes on sale", "🎮", 2011), ("The Wii U goes on sale", "🎮", 2012), ("The Xbox Series X goes on sale", "❎", 2020),
])

# ═══ Fourth batch: household names only ═══
add("music", "best-selling-singles", [
 ("Bing Crosby releases \"White Christmas\"", "🎄", 1942), ("Bill Haley releases \"Rock Around the Clock\"", "🕰️", 1954),
 ("Elvis Presley releases \"It's Now or Never\"", "🎙️", 1960), ("Elton John releases \"Candle in the Wind 1997\"", "🕯️", 1997),
 ("Avril Lavigne releases \"Girlfriend\"", "🎸", 2007), ("Lady Gaga releases \"Poker Face\"", "🃏", 2009),
 ("Adele releases \"Rolling in the Deep\"", "🎤", 2010), ("Carly Rae Jepsen releases \"Call Me Maybe\"", "📞", 2012),
 ("Pharrell Williams releases \"Happy\"", "😊", 2014), ("Wiz Khalifa & Charlie Puth release \"See You Again\"", "🚗", 2015),
])
add("music", "best-selling-albums", [
 ("The Beatles release Abbey Road", "🚶", 1969), ("Led Zeppelin release their fourth album (\"Stairway to Heaven\")", "🪜", 1971),
 ("Eagles release Hotel California", "🏨", 1976), ("Meat Loaf releases Bat Out of Hell", "🦇", 1977),
 ("Pink Floyd release The Wall", "🧱", 1979), ("AC/DC release Back in Black", "⚡", 1980),
 ("Bruce Springsteen releases Born in the U.S.A.", "🇺🇸", 1984), ("Prince releases Purple Rain", "☔", 1984),
 ("The Dirty Dancing soundtrack is released", "💃", 1987), ("U2 release The Joshua Tree", "🌵", 1987), ("Michael Jackson releases Bad", "🕶️", 1987),
 ("Michael Jackson releases Dangerous", "🎭", 1991), ("ABBA Gold is released", "🥇", 1992), ("The Bodyguard soundtrack is released", "🎤", 1992),
 ("Alanis Morissette releases Jagged Little Pill", "💊", 1995), ("Shania Twain releases Come On Over", "🤠", 1997),
 ("Adele releases her album 21", "2️⃣", 2011),
])
add("tech", "timeline-of-social-media", [
 ("MSN Messenger launches", "💬", 1999), ("LinkedIn launches", "💼", 2003), ("Skype launches", "📞", 2003),
 ("Reddit launches", "👽", 2005), ("Tumblr launches", "📝", 2007), ("Pinterest launches", "📌", 2010),
 ("Snapchat launches", "👻", 2011), ("Twitch launches", "🎮", 2011), ("Tinder launches", "🔥", 2012),
 ("Telegram launches", "✈️", 2013), ("Discord launches", "🎧", 2015), ("TikTok launches", "🎵", 2017),
 ("Clubhouse launches", "🎙️", 2020), ("BeReal launches", "📸", 2020), ("Skype shuts down for good", "📴", 2025),
])
add("landmark", "tallest-buildings-history", [
 ("The Chrysler Building is completed", "🏙️", 1930), ("Chicago's Sears Tower becomes the world's tallest building", "🏙️", 1973),
 ("The Petronas Towers become the world's tallest buildings", "🏙️", 1999), ("Taipei 101 becomes the world's tallest building", "🏙️", 2004),
 ("Dubai's Burj Khalifa becomes the world's tallest building", "🏙️", 2010),
])
add("sport", "cricket-world-cup", [
 ("West Indies win the first Cricket World Cup", "🏏", 1975), ("India win their first Cricket World Cup", "🏏", 1983),
 ("Pakistan win the Cricket World Cup", "🏏", 1992), ("Sri Lanka win the Cricket World Cup", "🏏", 1996),
 ("India win the Cricket World Cup at home", "🏏", 2011), ("Australia win the Cricket World Cup in India", "🏏", 2023),
])
add("sport", "rugby-world-cup", [
 ("New Zealand win the first Rugby World Cup", "🏉", 1987), ("South Africa win the Rugby World Cup with Mandela watching", "🏉", 1995),
 ("England win the Rugby World Cup", "🏉", 2003), ("New Zealand win the Rugby World Cup at home", "🏉", 2011),
 ("South Africa win the Rugby World Cup in Japan", "🏉", 2019),
])
add("game", "best-selling-franchises", [
 ("Mario stars in his own game for the first time (Mario Bros.)", "🍄", 1983), ("The first Final Fantasy is released", "⚔️", 1987),
 ("The first Street Fighter is released", "🥋", 1987), ("Civilization is released", "🏛️", 1991), ("The first Kirby game is released", "🩷", 1992),
 ("The first FIFA video game is released", "⚽", 1993), ("The first Need for Speed is released", "🏎️", 1994), ("The first Tekken is released", "👊", 1994),
 ("The first Pro Evolution Soccer is released", "⚽", 1995), ("The Tamagotchi goes on sale", "🥚", 1996), ("The first Resident Evil is released", "🧟", 1996),
 ("The first Tomb Raider (Lara Croft) is released", "🏺", 1996), ("The first Grand Theft Auto is released", "🚗", 1997),
 ("The first Animal Crossing is released", "🍃", 2001), ("The first Battlefield is released", "🪖", 2002), ("The first Call of Duty is released", "🪖", 2003),
 ("The first Far Cry is released", "🌴", 2004), ("The first God of War is released", "🪓", 2005), ("The first Assassin's Creed is released", "🗡️", 2007),
 ("The first Just Dance is released", "💃", 2009), ("Destiny is released", "🌌", 2014), ("Marvel's Spider-Man is released on PlayStation", "🕷️", 2018),
])
add("history", "nobel-peace-prize", [
 ("Martin Luther King Jr. wins the Nobel Peace Prize", "🕊️", 1964), ("Mother Teresa wins the Nobel Peace Prize", "🕊️", 1979),
 ("Lech Wałęsa wins the Nobel Peace Prize", "🕊️", 1983), ("Desmond Tutu wins the Nobel Peace Prize", "🕊️", 1984),
 ("The Dalai Lama wins the Nobel Peace Prize", "🕊️", 1989), ("Mikhail Gorbachev wins the Nobel Peace Prize", "🕊️", 1990),
 ("Nelson Mandela wins the Nobel Peace Prize", "🕊️", 1993), ("Al Gore wins the Nobel Peace Prize", "🕊️", 2007),
 ("Barack Obama wins the Nobel Peace Prize", "🕊️", 2009), ("The European Union wins the Nobel Peace Prize", "🇪🇺", 2012),
 ("Malala Yousafzai wins the Nobel Peace Prize", "🕊️", 2014),
])
add("history", "time-person-of-the-year", [
 ("John F. Kennedy is TIME Person of the Year", "📰", 1961), ("The Apollo 8 astronauts are TIME Persons of the Year", "📰", 1968),
 ("TIME names \"The Computer\" its Machine of the Year", "🖥️", 1982), ("Jeff Bezos is TIME Person of the Year", "📰", 1999),
 ("Bill Gates, Melinda Gates and Bono are TIME Persons of the Year", "📰", 2005), ("TIME names \"You\" its Person of the Year", "🪞", 2006),
 ("Angela Merkel is TIME Person of the Year", "📰", 2015), ("Greta Thunberg is TIME Person of the Year", "📰", 2019),
 ("Volodymyr Zelenskyy is TIME Person of the Year", "📰", 2022), ("Taylor Swift is TIME Person of the Year", "📰", 2023),
 ("TIME names \"The Architects of AI\" its Person of the Year", "🤖", 2025),
])

# ═══ Fifth batch ═══
add("anime", "best-selling-manga", [
 ("Astro Boy manga begins", "🤖", 1952), ("Doraemon manga begins", "🐱", 1969), ("Captain Tsubasa manga begins", "⚽", 1981),
 ("Dragon Ball manga begins", "🐉", 1984), ("JoJo's Bizarre Adventure manga begins", "🕴️", 1987), ("Slam Dunk manga begins", "🏀", 1990),
 ("Detective Conan (Case Closed) manga begins", "🔍", 1994), ("One Piece manga begins", "🏴‍☠️", 1997), ("Hunter × Hunter manga begins", "🎣", 1998),
 ("Naruto manga begins", "🍥", 1999), ("Bleach manga begins", "⚔️", 2001), ("Attack on Titan manga begins", "🧱", 2009),
 ("Haikyu!! manga begins", "🏐", 2012), ("My Hero Academia manga begins", "🦸", 2014), ("Demon Slayer manga begins", "🗡️", 2016),
 ("Jujutsu Kaisen manga begins", "👁️", 2018),
])
add("sport", "champions-league-finals", [
 ("Ajax win the Champions League with a young team", "🇳🇱", 1995), ("Manchester United win the Champions League to complete the treble", "🔴", 1999),
 ("Porto, managed by José Mourinho, win the Champions League", "🔵", 2004), ("Barcelona win the Champions League under Pep Guardiola", "🔵🔴", 2009),
 ("Chelsea win their first Champions League", "🔵", 2012), ("Bayern Munich beat Dortmund in an all-German Champions League final", "🔴", 2013),
 ("Real Madrid win \"La Décima\", their 10th European Cup", "⚪", 2014), ("Real Madrid win three Champions Leagues in a row", "⚪", 2018),
 ("Liverpool win the Champions League under Jürgen Klopp", "🔴", 2019), ("Manchester City win their first Champions League", "🩵", 2023),
 ("PSG win their first Champions League", "🔵", 2025),
])
add("tv", "super-bowl-halftime", [
 ("Michael Jackson headlines the Super Bowl halftime show", "🧤", 1993), ("U2 play the Super Bowl halftime show", "🎸", 2002),
 ("Paul McCartney headlines the Super Bowl halftime show", "🎸", 2005), ("Madonna headlines the Super Bowl halftime show", "👑", 2012),
 ("Beyoncé headlines the Super Bowl halftime show", "🐝", 2013), ("Katy Perry's Super Bowl show (and the \"Left Shark\")", "🦈", 2015),
 ("Shakira and Jennifer Lopez headline the Super Bowl halftime show", "💃", 2020), ("Usher headlines the Super Bowl halftime show", "🎤", 2024),
 ("Kendrick Lamar headlines the Super Bowl halftime show", "👑", 2025),
])
add("tv", "netflix-most-watched", [
 ("Bridgerton premieres on Netflix", "💍", 2020), ("Adolescence premieres on Netflix", "🧑", 2025),
])
add("film", "netflix-most-watched", [
 ("Bird Box is released on Netflix", "🙈", 2018), ("KPop Demon Hunters becomes Netflix's most-watched film", "🎤", 2025),
])
add("toy", "best-selling-toys", [
 ("Mr. Potato Head becomes the first toy advertised on TV", "🥔", 1952), ("The hula hoop craze sweeps the world", "⭕", 1958),
 ("Cabbage Patch Kids cause a shopping frenzy", "🧸", 1983),
])
add("music", "eurovision-winners", [
 ("ABBA win Eurovision with \"Waterloo\"", "🇸🇪", 1974), ("Céline Dion wins Eurovision for Switzerland", "🇨🇭", 1988),
 ("Lordi, a monster-masked rock band, win Eurovision", "👹", 2006), ("Alexander Rybak wins Eurovision with \"Fairytale\"", "🎻", 2009),
 ("Loreen wins Eurovision with \"Euphoria\"", "🇸🇪", 2012), ("Conchita Wurst wins Eurovision", "🧔", 2014),
 ("Måneskin win Eurovision", "🇮🇹", 2021), ("Kalush Orchestra win Eurovision for Ukraine", "🇺🇦", 2022),
])
add("tech", "apple-products-timeline", [
 ("Apple launches the first Macintosh", "🖥️", 1984), ("Apple launches the colourful iMac", "🖥️", 1998),
 ("Apple launches the MacBook Air (out of an envelope)", "✉️", 2008), ("Apple launches the first iPad", "📲", 2010),
])

# ═══ Sixth batch ═══
add("tv", "super-bowl-halftime", [
 ("Coldplay, Beyoncé and Bruno Mars play the Super Bowl halftime show", "🏈", 2016), ("Lady Gaga jumps from the stadium roof at the Super Bowl", "🏈", 2017),
 ("Justin Timberlake headlines the Super Bowl halftime show", "🏈", 2018), ("Maroon 5 headline the Super Bowl halftime show", "🏈", 2019),
 ("The Weeknd headlines the Super Bowl halftime show", "🏈", 2021), ("Dr. Dre, Snoop Dogg and Eminem play the Super Bowl halftime show", "🏈", 2022),
 ("Rihanna headlines the Super Bowl halftime show while pregnant", "🏈", 2023),
])
add("sport", "champions-league-finals", [
 ("Liverpool come back from 3–0 down to win the Champions League in Istanbul", "🔴", 2005), ("Barcelona win the Champions League with Messi, Suárez and Neymar", "🔵🔴", 2015),
 ("Bayern Munich win the Champions League in an empty stadium", "🔴", 2020), ("Real Madrid win the Champions League with a late comeback run", "⚪", 2022),
])
add("music", "eurovision-winners", [
 ("Måns Zelmerlöw wins Eurovision with \"Heroes\"", "🇸🇪", 2015), ("Netta wins Eurovision with \"Toy\"", "🐔", 2018),
 ("Loreen wins Eurovision for a second time", "🇸🇪", 2023), ("Nemo wins Eurovision for Switzerland", "🇨🇭", 2024),
])
add("anime", "best-selling-manga", [
 ("Fist of the North Star manga begins", "👊", 1983), ("Rurouni Kenshin manga begins", "🗡️", 1994), ("Fullmetal Alchemist manga begins", "⚗️", 2001),
 ("Fairy Tail manga begins", "🧚", 2006), ("Tokyo Revengers manga begins", "🏍️", 2017), ("Blue Lock manga begins", "⚽", 2018),
])
add("tech", "timeline-of-social-media", [("Facebook goes public on the stock market", "📈", 2012)])

# ═══ Seventh batch: well-known replacements ═══
add("film", "disney-animation", [
 ("The Hunchback of Notre Dame is released", "🔔", 1996), ("The Emperor's New Groove is released", "🦙", 2000),
 ("Bolt is released", "🐕", 2008), ("The Princess and the Frog is released", "🐸", 2009), ("Ralph Breaks the Internet is released", "💻", 2018),
 ("Raya and the Last Dragon is released", "🐉", 2021),
])
add("music", "best-selling-albums", [
 ("Queen's Greatest Hits is released", "👑", 1981), ("Bob Marley's Legend is released", "🇯🇲", 1984), ("Whitney Houston releases her debut album", "🎤", 1985),
 ("Dire Straits release Brothers in Arms", "🎸", 1985), ("Bon Jovi release Slippery When Wet", "🎸", 1986), ("Madonna's The Immaculate Collection is released", "💿", 1990),
 ("Metallica release their \"Black Album\"", "🖤", 1991), ("Mariah Carey releases Music Box", "🎶", 1993), ("The Titanic soundtrack is released", "🚢", 1997),
 ("Santana release Supernatural", "🎸", 1999), ("Eminem releases The Marshall Mathers LP", "🎤", 2000), ("Norah Jones releases Come Away with Me", "🎹", 2002),
])
add("sport", "world-cup-finals", [
 ("Uruguay shock Brazil to win the World Cup in Rio", "🇺🇾", 1950), ("West Germany win their first World Cup", "🇩🇪", 1954),
 ("A 17-year-old Pelé helps Brazil win the World Cup", "🇧🇷", 1958), ("West Germany win the World Cup at home", "🇩🇪", 1974),
 ("West Germany win the World Cup in Italy", "🇩🇪", 1990), ("Italy win the World Cup on penalties in Germany", "🇮🇹", 2006),
 ("Germany win the World Cup in Brazil", "🇩🇪", 2014),
])
add("sport", "champions-league-finals", [("Inter Milan win the treble under José Mourinho", "⚫🔵", 2010)])
add("tv", "super-bowl-halftime", [
 ("Janet Jackson's Super Bowl \"wardrobe malfunction\"", "🏈", 2004), ("The Rolling Stones headline the Super Bowl halftime show", "🏈", 2006),
 ("Bruce Springsteen headlines the Super Bowl halftime show", "🏈", 2009), ("The Black Eyed Peas headline the Super Bowl halftime show", "🏈", 2011),
 ("Bruno Mars headlines the Super Bowl halftime show", "🏈", 2014),
])
add("history", "nobel-peace-prize", [("Begin and Sadat share the Nobel Peace Prize", "🕊️", 1978)])
add("history", "time-person-of-the-year", [
 ("Martin Luther King Jr. is TIME Person of the Year", "📰", 1963), ("Ronald Reagan is TIME Person of the Year", "📰", 1980),
 ("Pope John Paul II is TIME Person of the Year", "📰", 1994), ("Vladimir Putin is TIME Person of the Year", "📰", 2007),
 ("Barack Obama is TIME Person of the Year", "📰", 2008), ("Donald Trump is TIME Person of the Year", "📰", 2016),
 ("Joe Biden and Kamala Harris are TIME Persons of the Year", "📰", 2020),
])
add("tech", "timeline-of-social-media", [
 ("Vine launches", "🎬", 2013), ("Musical.ly (later TikTok) launches", "🎵", 2014), ("Bluesky opens to everyone", "🦋", 2024),
])
add("book", "best-selling-books", [
 ("A Wrinkle in Time is published", "🌌", 1962), ("Shōgun (the novel) is published", "⚔️", 1975), ("Norwegian Wood is published", "🌲", 1987),
 ("The Giver is published", "📕", 1993), ("Bridget Jones's Diary is published", "📔", 1996), ("The Lovely Bones is published", "📖", 2002),
])

# ═══ Eighth batch: top-up ═══
add("history", "time-person-of-the-year", [
 ("Mark Zuckerberg is TIME Person of the Year", "📰", 2010), ("Pope Francis is TIME Person of the Year", "📰", 2013), ("Elon Musk is TIME Person of the Year", "📰", 2021),
])
add("history", "nobel-peace-prize", [("Aung San Suu Kyi wins the Nobel Peace Prize", "🕊️", 1991)])
add("invention", "britannica", [
 ("The electric iron is invented", "🧺", 1882), ("The pneumatic tyre is invented", "🛞", 1888), ("The Thermos flask is invented", "🫖", 1892),
])
add("film", "netflix-most-watched", [("Red Notice is released on Netflix", "🎨", 2021), ("Don't Look Up is released on Netflix", "☄️", 2021)])
add("music", "spotify-most-streamed", [
 ("Bruno Mars releases \"When I Was Your Man\"", "🌹", 2012), ("DJ Snake & Justin Bieber release \"Let Me Love You\"", "💞", 2016),
 ("Bruno Mars releases \"That's What I Like\"", "💸", 2017), ("Post Malone releases \"Circles\"", "⭕", 2019),
])
add("sport", "ballon-dor", [
 ("Messi wins his fourth Ballon d'Or in a row", "⚽", 2012), ("Cristiano Ronaldo wins back-to-back Ballons d'Or", "⚽", 2014),
])
