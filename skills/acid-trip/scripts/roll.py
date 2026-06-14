#!/usr/bin/env python3
"""acid-trip dice roller.

Picks structural rolls from OS entropy:
  - document_type — what kind of *object* the page is (one of ~100)
  - lineage       — the aesthetic lens / visual movement (one of ~190)
  - type_pairing  — a display + body font pair, sampled from a pool whose
                    `tags` overlap the rolled lineage's `type_tags`

Plus a fixed URL: Wikipedia's Special:Random, which the SKILL.md fetches to
get the SUBJECT of the design. The article's actual subject, era, place, and
imagery then drive palette, layout, and mood through derivation in SKILL.md.

Typography used to be derived freely by the LLM, which caused the same
small set of "safe" fonts (Caslon, Cooper Black, Druk) to reappear across
trips. The type_pairing roll seeds the floor with curated, lineage-tagged
pairs so the same lineage doesn't always collapse to the same fonts.

Output: a small JSON blob the SKILL.md instructions consume.
"""

import argparse
import json
import secrets
import random
from pathlib import Path


LINEAGES = [
    {"name": "Memphis Group (Milan, 1981)", "notes": "primary colors over terrazzo, squiggles, fake stone, laminate maximalism", "type_tags": ["postmodern", "decorative", "italic-display", "kitsch-revival"]},
    {"name": "Soviet Constructivism (Rodchenko, Moscow 1920s)", "notes": "diagonal red bars, sans-serif Cyrillic shouting, photomontage agitprop", "type_tags": ["constructivist", "industrial-sans", "shouting", "geometric"]},
    {"name": "Edo woodblock (Hokusai-era ukiyo-e, 1820s)", "notes": "flat fields, Prussian blue, woodgrain print artifacts, narrative panels", "type_tags": ["japanese", "edo", "ukiyo-e", "woodblock"]},
    {"name": "ANSI BBS art (Acid/Ice/Fire scenes, 1990–95)", "notes": "16-color blocks, CP437 glyphs, group tags, neon on black phosphor", "type_tags": ["pixel", "terminal", "ascii", "phreak"]},
    {"name": "Béton brut brutalist brochures (1960s concrete catalogs)", "notes": "raw photography of concrete, plain Akzidenz, single-color print, civic seriousness", "type_tags": ["brutalist", "civic", "industrial-sans", "restrained"]},
    {"name": "Anti-design (Studio Alchimia, Milan 1976)", "notes": "decorative laminate, refusal of function, kitsch lifted to art, pattern collision", "type_tags": ["postmodern", "decorative", "kitsch-revival"]},
    {"name": "Y2K chrome (1998–2003 teen portals)", "notes": "frosted lozenge buttons, gel reflections, lens flares, blueberry/silver", "type_tags": ["y2k", "chrome", "vaporwave"]},
    {"name": "Vaporwave (Tumblr era 2011–14)", "notes": "Helvetica Japanese, pink/teal washes, Greek busts, jpeg degradation", "type_tags": ["vaporwave", "y2k", "japanese-clash", "chrome"]},
    {"name": "Amiga 500 demoscene (Future Crew, Triton)", "notes": "copper bars, sine scrollers, 320×240 mode 13h, plasma fields", "type_tags": ["pixel", "terminal", "phosphor"]},
    {"name": "Stenberg brothers film posters (Moscow, 1923–33)", "notes": "screaming red, mechanical figures, distorted perspective, hand-drawn type", "type_tags": ["constructivist", "shouting", "wood-type", "showcard"]},
    {"name": "Polish poster school (Tomaszewski, 1955–75)", "notes": "painterly, melancholic, hand-rendered titles, surrealist metaphor", "type_tags": ["polish-poster", "psychedelic", "ornamental-display"]},
    {"name": "Bauhaus Dessau period (Moholy-Nagy, 1925–28)", "notes": "primary geometry, sans-serif lower case, photogram negatives", "type_tags": ["bauhaus", "geometric", "modernist"]},
    {"name": "Swiss International Style (Müller-Brockmann, post-1957)", "notes": "Akzidenz/Helvetica, mathematical grid, photographic objectivity, no italics", "type_tags": ["swiss", "wayfinding", "restrained", "modernist"]},
    {"name": "Push Pin Studios (Glaser & Chwast, NY 1954–75)", "notes": "Art Nouveau revival, illustrative, ornamental capitals, optimistic", "type_tags": ["psychedelic", "art-nouveau", "ornamental-display"]},
    {"name": "Wes Wilson Fillmore posters (San Francisco, 1966–67)", "notes": "vibrating complementaries, melted lettering, no negative space", "type_tags": ["psychedelic", "vibrating", "decorative", "showcard"]},
    {"name": "Saul Bass film titles (Vertigo through Psycho, 1958–60)", "notes": "cut paper silhouettes, kinetic type, narrative compression", "type_tags": ["mid-century-american", "geometric", "modernist"]},
    {"name": "Vignelli NYC subway map era (Unimark, 1972)", "notes": "geometric stylization, octal angles, color-coded systems, ruthless wayfinding", "type_tags": ["swiss", "wayfinding", "restrained"]},
    {"name": "Mucha Art Nouveau (Paris 1894, theatrical posters)", "notes": "whiplash curves, halo composition, fin-de-siècle goddesses, ornamental borders", "type_tags": ["art-nouveau", "secession", "ornamental-display"]},
    {"name": "Cassandre Art Deco posters (Dubonnet, 1932)", "notes": "airbrushed geometry, machine-age glamour, three-color limit, monumental", "type_tags": ["art-deco", "monumental", "machine-age"]},
    {"name": "De Stijl (Mondrian/van Doesburg, 1917–31)", "notes": "primary blocks, black grid lines, refusal of curve, utopian rectangle", "type_tags": ["bauhaus", "geometric", "modernist"]},
    {"name": "Mayakovsky ROSTA windows (Moscow, 1919–22)", "notes": "stenciled propaganda, comic-panel narrative, slogan typography, agit-art", "type_tags": ["constructivist", "showcard", "shouting"]},
    {"name": "OSPAAAL Cuban tricontinental posters (Havana, 1966–75)", "notes": "silkscreen flatness, revolutionary iconography, Spanish/Arabic/English", "type_tags": ["silkscreen", "shouting", "international-style"]},
    {"name": "NASA Graphics Standards Manual (Danne & Blackburn, 1976)", "notes": "the worm logo, red engineering, modular grid, bureaucratic confidence", "type_tags": ["swiss", "wayfinding", "restrained", "civic"]},
    {"name": "Atari arcade flyer art (Centipede, Tempest, 1979–83)", "notes": "airbrushed sci-fi, cabinet photography, bright neon over black", "type_tags": ["arcade", "neon", "70s-revival", "airbrushed"]},
    {"name": "Persian Safavid miniature painting (16th c. Isfahan)", "notes": "lapis and gold leaf, flattened perspective, intricate borders, courtly scene", "type_tags": ["persian", "manuscript", "ornamental-display"]},
    {"name": "Mughal manuscript illumination (Akbar period, 1560s)", "notes": "framed miniatures, calligraphic panels, gold dust ground, Persian script", "type_tags": ["persian", "arabic", "manuscript", "calligraphic"]},
    {"name": "Vilna Talmud page (1880, 4-margin commentary layout)", "notes": "central text surrounded by concentric commentary in different fonts/sizes", "type_tags": ["manuscript", "hebrew", "polyglot"]},
    {"name": "Medieval marginalia (Smithfield Decretals, c.1340)", "notes": "drolleries in margins, rabbits with swords, gold initials, vellum texture", "type_tags": ["medieval", "manuscript", "ornamental-display"]},
    {"name": "Victorian playbill (1860s ransom-note typography)", "notes": "every line different face, wood type, exclamation marks, rules everywhere", "type_tags": ["wood-type", "playbill", "ransom-note"]},
    {"name": "Vienna Secession (Klimt/Moser, Ver Sacrum 1898)", "notes": "square format, gilded geometry, custom display alphabets, ornament-as-structure", "type_tags": ["secession", "art-nouveau", "geometric", "ornamental-display"]},
    {"name": "Malevich Suprematism (1915 Black Square era)", "notes": "floating planes, off-axis composition, white void, painting as object", "type_tags": ["constructivist", "geometric", "modernist"]},
    {"name": "Hannah Höch Dada photomontage (Berlin 1919)", "notes": "scissored magazine cuts, female subjectivity, anti-bourgeois collision", "type_tags": ["constructivist", "shouting", "wood-type", "industrial-sans"]},
    {"name": "Tschichold Die Neue Typographie (Munich, 1928)", "notes": "asymmetric balance, sans-serif dogma, rules as structure, DIN paper sizes", "type_tags": ["tschichold", "swiss", "industrial-sans", "modernist"]},
    {"name": "ECM Records covers (Manfred Eicher, Munich 1969–present)", "notes": "monochrome landscape photography, generous white, restraint as luxury", "type_tags": ["restrained", "editorial", "ecm-like", "modernist"]},
    {"name": "Blue Note jazz covers (Reid Miles, 1956–67)", "notes": "duotone portraits, oversized headlines, Trade Gothic discipline, jazz energy", "type_tags": ["mid-century-american", "editorial", "industrial-sans"]},
    {"name": "4AD record sleeves (Vaughan Oliver/v23, 1985–95)", "notes": "lush photography, fragmented type, ambiguous symbolism, ink on uncoated", "type_tags": ["90s-experimental", "restrained", "editorial"]},
    {"name": "Factory Records (Peter Saville, FAC catalog, 1978–92)", "notes": "withheld information, references to art history, industrial materials", "type_tags": ["restrained", "editorial", "industrial-sans"]},
    {"name": "Raygun magazine (David Carson, 1992–2000)", "notes": "shattered grid, unreadable on purpose, layered chaos, grunge", "type_tags": ["90s-experimental", "raygun", "grunge"]},
    {"name": "The Face magazine (Neville Brody, 1981–86)", "notes": "custom alphabets, ornamental hand-drawn, post-punk editorial", "type_tags": ["90s-experimental", "emigre", "post-mac"]},
    {"name": "Emigre magazine (Rudy VanderLans, post-Mac 1984)", "notes": "bitmap fonts, early Macintosh, designer-as-publisher", "type_tags": ["90s-experimental", "emigre", "post-mac", "pixel"]},
    {"name": "WIRED launch issues (1993–95 fluorescent paper era)", "notes": "neon ink, color-shift paper, manga-influenced grid, cyber-utopian", "type_tags": ["90s-experimental", "y2k", "chrome"]},
    {"name": "Tamil film hand-painted posters (Madurai, 1970s)", "notes": "wall-sized acrylic portraits, saturated skin tones, painterly flames", "type_tags": ["tamil", "south-asian", "hand-painted", "showcard"]},
    {"name": "Bollywood hand-painted hoardings (1960s, Diwakar Karkare)", "notes": "stacked heroes, distorted proportions, gold scripts, melodrama", "type_tags": ["devanagari", "bollywood", "south-asian", "hand-painted"]},
    {"name": "Ghanaian mobile cinema posters (1980s, acrylic on flour sacks)", "notes": "imagined movie scenes from films never seen, lurid violence, hand-lettered", "type_tags": ["hand-painted", "showcard", "amateur"]},
    {"name": "Italian giallo film posters (Argento/Bava, 1970s)", "notes": "blood red, lone figure, fragmented body parts, lurid set pieces", "type_tags": ["showcard", "70s-revival", "airbrushed"]},
    {"name": "North Korean Mansudae diplomatic gift art", "notes": "socialist realism, smiling workers, vermillion banners, idealized landscape", "type_tags": ["constructivist", "shouting", "civic"]},
    {"name": "Iranian revolutionary silkscreens (1979 post-Shah)", "notes": "stenciled fists, Farsi calligraphy, deep green and red", "type_tags": ["persian", "arabic", "silkscreen", "shouting"]},
    {"name": "Mexican lotería cards (Don Clemente, 1887)", "notes": "tarot grid, folk illustrations, La Sirena and El Diablito, frame around each", "type_tags": ["showcard", "wood-type", "ornamental-display"]},
    {"name": "Whole Earth Catalog (Stewart Brand, 1968–74)", "notes": "tools-for-living, typewriter copy, hand-drawn diagrams, hippie pragmatism", "type_tags": ["zine", "diy", "typewriter", "whole-earth"]},
    {"name": "Mondo 2000 zine (1989–98)", "notes": "cyberdelic, full-bleed psychedelia over interview text, RU Sirius weirdness", "type_tags": ["90s-experimental", "psychedelic", "raygun"]},
    {"name": "Boing Boing print zine (1988–95)", "notes": "Mark Frauenfelder hand collage, cyberpunk lo-fi, pre-blog blog", "type_tags": ["zine", "diy", "psychedelic"]},
    {"name": "2600 Hacker Quarterly (early issues, 1984–94)", "notes": "blue text on cream, ASCII diagrams, phone phreaking aesthetics", "type_tags": ["terminal", "ascii", "phreak", "typewriter"]},
    {"name": "Geocities personal home pages (1996–2001)", "notes": "tiled backgrounds, animated GIFs, Comic Sans, under-construction signs", "type_tags": ["proto-web", "geocities", "amateur"]},
    {"name": "Webring graphics (1998 spinning gifs)", "notes": "best-viewed-in banners, 88x31 button collection, navigation as social ritual", "type_tags": ["proto-web", "geocities", "amateur"]},
    {"name": "Windows 95 chrome (gray dialog, Marlett bitmap)", "notes": "system gray, raised/sunken bevels, MS Sans Serif, modal everything", "type_tags": ["proto-web", "html-default", "chrome"]},
    {"name": "Teletext (Ceefax/Prestel, 1976–2012)", "notes": "40-column block characters, six colors over black, news as ASCII art", "type_tags": ["pixel", "terminal", "ascii", "phosphor"]},
    {"name": "VHS B-movie cover art (Cannon Films, 1985–92)", "notes": "airbrushed muscle, exploding helicopters, neon title treatments, lurid", "type_tags": ["showcard", "airbrushed", "neon", "70s-revival"]},
    {"name": "NASA mission patches (Apollo through Shuttle)", "notes": "circular composition, embroidered look, crew names around rim, cosmic seriousness", "type_tags": ["mid-century-american", "civic", "wayfinding"]},
    {"name": "National Geographic 1970s photo essay layout", "notes": "yellow rectangle, full-bleed photography, caption-as-prose, Bodoni titling", "type_tags": ["editorial", "70s-revival", "ornamental-display"]},
    {"name": "Italian Domus magazine (Gio Ponti, 1948–79)", "notes": "architectural confidence, oversized photography, modernist Italian typography", "type_tags": ["modernist", "editorial", "italian-postwar"]},
    {"name": "Skateboarder magazine (Stecyk DogTown, 1975)", "notes": "halftone action shots, hand-lettered headlines, surf-punk crossover", "type_tags": ["zine", "diy", "psychedelic", "70s-revival"]},
    {"name": "Thrasher magazine (Mörizen Föche, 1981–86)", "notes": "gnarly stencil type, anti-establishment energy, raw photocopy aesthetic", "type_tags": ["zine", "diy", "wood-type", "grunge"]},
    {"name": "Riot grrrl zines (Olympia/DC, 1991–95)", "notes": "xerox staple, hand-cut letters, urgent confession, marker on notebook paper", "type_tags": ["zine", "diy", "typewriter", "amateur"]},
    {"name": "Polish jazz album covers (Polskie Nagrania Muza, 1960s)", "notes": "Eastern Bloc modernism, abstract figure, limited four-color, behind-curtain cool", "type_tags": ["polish-poster", "modernist", "editorial"]},
    {"name": "East German DDR Verlag book covers", "notes": "muted earth tones, Cyrillic-adjacent display, woodblock illustration, austerity", "type_tags": ["editorial", "civic", "restrained", "manuscript"]},
    {"name": "South African resistance posters (Medu Art Ensemble, 1979)", "notes": "screen-printed solidarity, hand-cut stencils, communal authorship", "type_tags": ["silkscreen", "shouting", "constructivist"]},
    {"name": "IKEA catalog 1995 (Scandinavian beige era)", "notes": "blonde wood, generous white, helpful arrows, family-friendly modernism", "type_tags": ["restrained", "scandinavian", "modernist"]},
    {"name": "J. Peterman catalog (1989, watercolor + romance)", "notes": "no photography, only watercolor sketches, narrative product descriptions", "type_tags": ["editorial", "ornamental-display", "manuscript"]},
    {"name": "Restoration Hardware Source Book (oversized 2010s)", "notes": "sepia photography, broadsheet format, weight as luxury signal", "type_tags": ["editorial", "restrained", "ornamental-display"]},
    {"name": "LIFE magazine photo essay (1950s 4-page spread)", "notes": "rotogravure photography, Bodoni headlines, white framing, civic narrative", "type_tags": ["editorial", "mid-century-american", "ornamental-display"]},
    {"name": "WGBH Boston public TV identity (1971, Chermayeff & Geismar)", "notes": "kinetic 3-letter mark, primary colors, broadcast modernism", "type_tags": ["mid-century-american", "modernist", "geometric"]},
    {"name": "Sears Wish Book 1979 toy section", "notes": "catalog grid, prices in bursts, kid-eye photography, fluorescent lighting", "type_tags": ["70s-revival", "showcard", "amateur"]},
    {"name": "Early HTML 1.0 default (Times New Roman + #0000EE links)", "notes": "system serif, default blue/purple links, gray background, document-as-page", "type_tags": ["proto-web", "html-default"]},
    {"name": "K-records / Calvin Johnson DIY (Olympia, 1982)", "notes": "rubber stamp logos, marker on cardstock, anti-corporate music packaging", "type_tags": ["zine", "diy", "amateur", "typewriter"]},
    {"name": "Soviet children's book illustration (Lebedev, 1930s)", "notes": "flat color planes, simplified forms, propaganda-meets-Suprematism for kids", "type_tags": ["constructivist", "decorative", "playful"]},
    {"name": "Hot Rod magazine pin-stripe (Big Daddy Roth, 1959)", "notes": "Rat Fink leering, airbrushed flames, custom-shop typography, drag-strip culture", "type_tags": ["showcard", "airbrushed", "70s-revival"]},
    {"name": "Surfer magazine (Drew Kampion design, 1971)", "notes": "saltwater photography, generous editorial type, counterculture sincerity", "type_tags": ["editorial", "70s-revival", "psychedelic"]},
    {"name": "Phrack ASCII art newsletter (1985–present)", "notes": "monospaced ASCII headers, technical articles, hacker ethos, plain text only", "type_tags": ["terminal", "ascii", "phreak"]},
    {"name": "Pruitt-Igoe demolition press kit (St. Louis, 1972)", "notes": "newsprint, modernist failure documented, civic-grade type, ruin-as-symbol", "type_tags": ["brutalist", "civic", "editorial"]},
    {"name": "Studio Dumbar Dutch transport identity (1980s NS railway)", "notes": "playful systems, splatter and grid coexist, color-coded service lines", "type_tags": ["dutch-experimental", "swiss", "wayfinding"]},
    {"name": "Wolfgang Weingart New Wave (Basel, late 1970s)", "notes": "broken Swiss grid, layered type, exposed printing process, pedagogical rebellion", "type_tags": ["dutch-experimental", "swiss", "90s-experimental"]},
    {"name": "Karel Martens (Dutch experimental, 1970s–present)", "notes": "found materials as printing matrix, color theory exercises, OASE journal", "type_tags": ["dutch-experimental", "restrained", "modernist"]},
    {"name": "Kelmscott Press (William Morris, 1891–98)", "notes": "dense woodcut borders, Golden Type, decorated initials, ink-black density, medieval revival", "type_tags": ["ornamental-display", "decorative", "medieval", "manuscript"]},
    {"name": "Gutenberg 42-line Bible (Mainz, 1455)", "notes": "two columns of textura blackletter, hand-rubricated initials, justified perfection, no title page", "type_tags": ["manuscript", "medieval", "calligraphic", "monumental"]},
    {"name": "Aldine Press octavos (Aldus Manutius, Venice 1501)", "notes": "first italics, dolphin-and-anchor mark, humanist restraint, pocket-sized classics", "type_tags": ["italic-display", "manuscript", "restrained", "editorial"]},
    {"name": "Book of Kells insular illumination (Iona/Kells, c. 800)", "notes": "carpet pages, interlace knotwork, zoomorphic initials, ochre and verdigris on vellum", "type_tags": ["manuscript", "medieval", "decorative", "calligraphic"]},
    {"name": "Blue Qur'an kufic manuscript (Kairouan, 9th–10th c.)", "notes": "gold kufic script on indigo-dyed vellum, no diacritics, monumental horizontal rhythm", "type_tags": ["arabic", "manuscript", "calligraphic", "monumental"]},
    {"name": "Ethiopian Ge'ez gospel manuscripts (Gunda Gunde, 15th c.)", "notes": "wide-eyed frontal saints, banded geometric borders, saturated red/yellow/green, fidel script", "type_tags": ["manuscript", "medieval", "decorative", "calligraphic"]},
    {"name": "Tibetan thangka painting (mandala tradition)", "notes": "concentric sacred geometry, mineral pigment and gold, fierce deities in fire halos, silk brocade frame", "type_tags": ["manuscript", "decorative", "ornamental-display", "calligraphic"]},
    {"name": "Aztec codex pictography (Codex Mendoza, 1541)", "notes": "glyphic figures, footprint paths, tribute grids, place-name signs, annotations crowding margins", "type_tags": ["manuscript", "decorative", "geometric", "ornamental-display"]},
    {"name": "Egyptian Book of the Dead papyri (New Kingdom)", "notes": "horizontal registers, profile figures, hieroglyph columns, judgment scenes, ochre on papyrus", "type_tags": ["manuscript", "decorative", "monumental", "calligraphic"]},
    {"name": "Haeckel Kunstformen der Natur (1899–1904)", "notes": "radial symmetry, radiolarians and medusae, obsessive detail, dark grounds, numbered specimens", "type_tags": ["editorial", "ornamental-display", "secession", "decorative"]},
    {"name": "Audubon Birds of America (double elephant folio, 1827–38)", "notes": "life-size birds in dramatic poses, hand-colored aquatint, Latin binomials, branch-as-composition", "type_tags": ["editorial", "manuscript", "monumental", "ornamental-display"]},
    {"name": "Diderot Encyclopédie plates (Paris, 1751–72)", "notes": "engraved workshop scenes above, lettered part diagrams below, captions keyed by letter, Enlightenment order", "type_tags": ["editorial", "manuscript", "restrained"]},
    {"name": "Toulouse-Lautrec Moulin Rouge lithographs (1891–99)", "notes": "flat silhouettes, spatter crayon texture, cropped figures, hand-lettered names, dancehall night", "type_tags": ["ornamental-display", "secession", "hand-painted", "italic-display"]},
    {"name": "Beggarstaff Brothers posters (London, 1894–99)", "notes": "flat cut-paper shapes, missing outlines the eye completes, two or three colors, radical economy", "type_tags": ["secession", "restrained", "geometric"]},
    {"name": "Sachplakat (Lucian Bernhard, Berlin 1906)", "notes": "one object, one brand name, nothing else, flat color ground, poster as pure noun", "type_tags": ["secession", "restrained", "shouting"]},
    {"name": "Frank Pick's London Underground (Johnston/Kauffer, 1916–39)", "notes": "Johnston sans, roundel discipline, modernist travel posters, civic system as patron", "type_tags": ["civic", "wayfinding", "modernist", "swiss"]},
    {"name": "Harry Beck Tube diagram (1933)", "notes": "45/90-degree angles only, geography sacrificed to topology, color-coded lines, interchange ticks", "type_tags": ["civic", "wayfinding", "geometric", "modernist"]},
    {"name": "Italian Futurism parole in libertà (Marinetti, 1909–19)", "notes": "words exploding across the page, mixed sizes and weights in one line, onomatopoeia, speed worship", "type_tags": ["constructivist", "shouting", "vibrating", "machine-age"]},
    {"name": "BLAST Vorticist magazine (Wyndham Lewis, 1914)", "notes": "puce cover, giant diagonal block type, BLESS/BLAST lists, manifesto aggression", "type_tags": ["constructivist", "shouting", "machine-age"]},
    {"name": "Zurich Dada typography (Tzara, Cabaret Voltaire 1916–19)", "notes": "every face in the drawer, rules at odd angles, chance composition, anti-sense declarations", "type_tags": ["ransom-note", "shouting", "vibrating", "diy"]},
    {"name": "Devětsil poetism (Karel Teige, Prague 1920s)", "notes": "picture poems, constructivist grid softened by lyric collage, lowercase functionalism", "type_tags": ["constructivist", "restrained", "editorial"]},
    {"name": "WPA Federal Art Project posters (1936–43)", "notes": "silkscreen flat planes, limited inks, national parks and hygiene campaigns, stoic optimism", "type_tags": ["civic", "restrained", "mid-century-american", "modernist"]},
    {"name": "Isotype (Otto Neurath, Vienna 1930s)", "notes": "repeated pictograms as quantity, one symbol = fixed amount, no perspective, statistics for everyone", "type_tags": ["restrained", "wayfinding", "geometric", "modernist"]},
    {"name": "Fritz Kahn body-as-factory infographics (1920s)", "notes": "cutaway human filled with tiny workers, conveyor metaphors, sober German labels", "type_tags": ["editorial", "machine-age", "restrained"]},
    {"name": "Penguin tripartite paperbacks (Edward Young, 1935)", "notes": "horizontal orange/white/orange bands, Gill Sans only, color-coded genres, no imagery", "type_tags": ["restrained", "modernist", "editorial"]},
    {"name": "Gollancz yellow jackets (London, 1930s)", "notes": "shock-yellow ground, magenta and black type only, typographic shouting, zero illustration", "type_tags": ["shouting", "italic-display", "restrained"]},
    {"name": "Alvin Lustig New Directions jackets (1940s–50s)", "notes": "abstract symbols for literary content, hand-drawn marks, sophisticated flat color, no scene depicted", "type_tags": ["modernist", "restrained", "mid-century-american"]},
    {"name": "Harper's Bazaar under Brodovitch (1934–58)", "notes": "white space as luxury, Didot elegance, photographs bleeding off-page, motion across spreads", "type_tags": ["editorial", "restrained", "italic-display", "modernist"]},
    {"name": "George Lois Esquire covers (1962–72)", "notes": "one conceptual photograph, visual one-liner, cover line as punchline, Ali as St. Sebastian", "type_tags": ["editorial", "shouting", "modernist"]},
    {"name": "Twen magazine (Willy Fleckhaus, 1959–70)", "notes": "12-column grid, oversized photography cropped hard, black pages, provocative restraint", "type_tags": ["editorial", "modernist", "restrained"]},
    {"name": "Festival of Britain (1951)", "notes": "Skylon optimism, molecular ball-and-rod motifs, pastel modernism, festival lettering, postwar cheer", "type_tags": ["civic", "modernist", "decorative", "playful"]},
    {"name": "Mid-century airline posters (David Klein TWA, 1957)", "notes": "abstract cityscapes as confetti, gouache color blocks, destination name huge, jet-age glamour", "type_tags": ["mid-century-american", "playful", "modernist", "decorative"]},
    {"name": "Linen-era roadside postcards (Curt Teich, 1930s–40s)", "notes": "exaggerated saturated retouching, big-letter place names, impossible sunsets, textured stock", "type_tags": ["mid-century-american", "decorative", "kitsch-revival", "hand-painted"]},
    {"name": "California fruit crate labels (1900s–40s)", "notes": "stone litho brand scene, glowing produce, banner scripts, brand mascot, border rules", "type_tags": ["wood-type", "showcard", "hand-painted", "ornamental-display"]},
    {"name": "Strobridge circus lithographs (1890s)", "notes": "multi-sheet chromolitho spectacle, leaping tigers, banner ribbons, THE GREATEST superlatives", "type_tags": ["playbill", "wood-type", "ornamental-display", "shouting"]},
    {"name": "American sign-painter showcards (1930s–50s)", "notes": "one-stroke casual lettering, shade and shadow, price tickets, gold leaf, brush confidence", "type_tags": ["showcard", "hand-painted", "wood-type"]},
    {"name": "Googie signage (Los Angeles, 1950s)", "notes": "boomerangs, starbursts, upswept rooflines, atomic kidney shapes, neon script over space-age angles", "type_tags": ["mid-century-american", "neon", "playful", "raygun"]},
    {"name": "Tiki exotica (Trader Vic's era, 1950s)", "notes": "bamboo borders, carved mask motifs, faux-Polynesian display lettering, rum-drink menu romance", "type_tags": ["mid-century-american", "kitsch-revival", "decorative", "ornamental-display"]},
    {"name": "Pulp magazine covers (Weird Tales, 1930s)", "notes": "painted peril scene, masthead arched, cover lines in bursts, 10-cent price, lurid promise", "type_tags": ["kitsch-revival", "hand-painted", "shouting", "mid-century-american"]},
    {"name": "EC horror comics (1950–55)", "notes": "host narrators, sweat-drop linework, caption boxes screaming, four-color dots, twist-ending dread", "type_tags": ["mid-century-american", "kitsch-revival", "shouting", "italic-display"]},
    {"name": "Kirby Silver Age Marvel (1961–70)", "notes": "krackle energy dots, foreshortened fists at the reader, cosmic machinery, panel-breaking figures", "type_tags": ["kitsch-revival", "vibrating", "shouting", "mid-century-american"]},
    {"name": "Underground comix (Zap, R. Crumb, 1968)", "notes": "crosshatched sweat, rubber-limbed figures, hand-lettered everything, ink-dense transgression", "type_tags": ["diy", "zine", "grunge", "psychedelic"]},
    {"name": "Métal Hurlant / Moebius (Paris, 1975)", "notes": "ligne claire sci-fi deserts, silent sequences, crystalline detail, airless alien light", "type_tags": ["editorial", "restrained", "modernist"]},
    {"name": "Hergé ligne claire (Tintin, 1930s–50s)", "notes": "uniform line weight, flat color, no hatching, legible faces, documentary backgrounds", "type_tags": ["restrained", "editorial", "modernist"]},
    {"name": "Weekly shōnen manga anthology (1980s–90s)", "notes": "cheap tinted newsprint, screentone gradients, speed lines, furigana, phonebook density", "type_tags": ["japanese", "vibrating", "shouting", "diy"]},
    {"name": "MAD magazine (Kurtzman era, 1952–56)", "notes": "chicken-fat margin gags, parody logos, crowded panels, sweaty caricature, Potrzebie", "type_tags": ["shouting", "kitsch-revival", "mid-century-american", "vibrating"]},
    {"name": "Warhol Factory silkscreen (1962–68)", "notes": "repetition as composition, off-register color, celebrity flattened to stencil, deadpan seriality", "type_tags": ["kitsch-revival", "restrained", "mid-century-american"]},
    {"name": "Lichtenstein benday pop (1961–68)", "notes": "comic panel blown to mural scale, mechanical dots, thought balloons, heavy black contour", "type_tags": ["kitsch-revival", "shouting", "mid-century-american"]},
    {"name": "Op art (Riley/Vasarely, 1960s)", "notes": "perceptual vibration, moiré interference, black-and-white waves, geometry that refuses to sit still", "type_tags": ["vibrating", "geometric", "modernist", "restrained"]},
    {"name": "Marimekko supergraphic prints (Maija Isola, 1964)", "notes": "Unikko poppies at architectural scale, two flat colors, pattern as the entire surface", "type_tags": ["scandinavian", "decorative", "modernist", "playful"]},
    {"name": "Sea Ranch supergraphics (Barbara Stauffacher Solomon, 1966)", "notes": "giant Helvetica numerals and stripes painted across architecture, color as wayfinding", "type_tags": ["modernist", "monumental", "swiss", "civic"]},
    {"name": "Mexico 68 Olympics identity (Lance Wyman)", "notes": "op-art radiating lines from the logotype, huichol-meets-psychedelia, pictogram system, hot pink", "type_tags": ["psychedelic", "vibrating", "geometric", "civic"]},
    {"name": "Munich 72 Olympics (Otl Aicher)", "notes": "Univers, rainbow pastels without red, gridded pictograms, diagonal event posters, serene order", "type_tags": ["swiss", "restrained", "civic", "wayfinding"]},
    {"name": "Tokyo 64 Olympics (Yusaku Kamekura)", "notes": "rising sun disc over gold rings, photographic starting-gun posters, Japanese modernism announced", "type_tags": ["japanese", "civic", "modernist", "restrained"]},
    {"name": "Ikko Tanaka posters (1970s–80s)", "notes": "kabuki face built from flat geometric planes, Nihon Buyo, color fields as features, East-West synthesis", "type_tags": ["japanese", "modernist", "restrained", "decorative"]},
    {"name": "Tadanori Yokoo posters (1965–72)", "notes": "rising-sun rays, ukiyo-e figures collaged with trains and waterfalls, hot pink and gold, pop mysticism", "type_tags": ["japanese", "ukiyo-e", "psychedelic", "shouting"]},
    {"name": "Muji no-brand packaging (Ikko Tanaka, 1980)", "notes": "kraft paper, single rule, product description as the only graphic, ostentatious plainness", "type_tags": ["japanese", "restrained", "modernist", "editorial"]},
    {"name": "City pop album art (Hiroshi Nagai, 1980s)", "notes": "airbrushed pools and palms, flat blue skies, white buildings, leisure as landscape, English titles", "type_tags": ["japanese", "vaporwave", "airbrushed", "y2k"]},
    {"name": "Shōwa matchbox labels (Japan, 1920s–30s)", "notes": "tiny modernist compositions, two-color litho, cafe and cigarette advertising, deco-meets-Edo", "type_tags": ["japanese", "edo", "decorative", "modernist"]},
    {"name": "Shanghai yuefenpai calendar posters (1930s)", "notes": "rouged beauties in qipao, soft airbrush skin, brand products at the margin, calendar grid below", "type_tags": ["airbrushed", "decorative", "ornamental-display", "kitsch-revival"]},
    {"name": "Hong Kong neon signage (1970s–80s)", "notes": "stacked vertical characters, layered projecting signs, red/green/gold tubes, density as vitality", "type_tags": ["neon", "shouting", "decorative", "calligraphic"]},
    {"name": "Cultural Revolution posters (1966–76)", "notes": "heroic upturned faces, red sun radiance, bold slogan calligraphy, worker-peasant-soldier trinity", "type_tags": ["shouting", "monumental", "civic", "calligraphic"]},
    {"name": "Cairo golden-age film posters (1950s–60s)", "notes": "hand-painted star portraits, Arabic title calligraphy as a character, melodramatic color", "type_tags": ["arabic", "calligraphic", "hand-painted", "kitsch-revival"]},
    {"name": "Pakistani truck art (Bedford era)", "notes": "every surface ornamented, mirror mosaic, peacocks and eyes, Urdu couplets, chained dangling hearts", "type_tags": ["south-asian", "decorative", "ornamental-display", "calligraphic"]},
    {"name": "Cuban ICAIC film posters (1960s–70s)", "notes": "silkscreen pop, one bold metaphor per film, flat saturated planes, hand-drawn titling", "type_tags": ["modernist", "shouting", "italic-display", "constructivist"]},
    {"name": "Czech New Wave film posters (1960s)", "notes": "surreal collage, hand-lettered titles, absurdist metaphor, muted color with one scream", "type_tags": ["polish-poster", "psychedelic", "ornamental-display", "restrained"]},
    {"name": "Soviet kosmos propaganda (1957–69)", "notes": "cosmonauts haloed in orbits, deep blue space, red vector trajectories, CCCP optimism", "type_tags": ["constructivist", "monumental", "geometric", "machine-age"]},
    {"name": "Paul Rand corporate identity (IBM era, 1956–70)", "notes": "wit in the mark, rebus logic, flat color shapes, asymmetric balance, play as rigor", "type_tags": ["modernist", "restrained", "swiss", "civic"]},
    {"name": "Olivetti advertising (Giovanni Pintori, 1950s)", "notes": "abstract dots and lines dancing around the product, corporate modernism with joy", "type_tags": ["italian-postwar", "modernist", "restrained", "playful"]},
    {"name": "Herb Lubalin Avant Garde (1968–71)", "notes": "ligatures jammed tight, negative-space wit, type as image, editorial typography at max density", "type_tags": ["italic-display", "decorative", "editorial", "kitsch-revival"]},
    {"name": "Alexander Girard Herman Miller (1960s)", "notes": "folk-art motifs flattened to modern pattern, sun faces, alphabet panels, saturated textile color", "type_tags": ["mid-century-american", "decorative", "playful", "geometric"]},
    {"name": "Charley Harper minimal realism (1950s–70s)", "notes": "birds reduced to circles and triangles, flat color, geometric ecology, witty captions", "type_tags": ["mid-century-american", "geometric", "restrained", "playful"]},
    {"name": "Total Design / Wim Crouwel (Amsterdam, 1963–80)", "notes": "systematic grid, New Alphabet geometry, lowercase museum catalogs, gridnik discipline", "type_tags": ["dutch-experimental", "modernist", "geometric", "restrained"]},
    {"name": "Braun instruction-manual minimalism (Rams era, 1960s)", "notes": "exploded diagrams, numbered steps, Akzidenz captions, gray scale, as-little-design-as-possible", "type_tags": ["modernist", "restrained", "swiss", "wayfinding"]},
    {"name": "Corita Kent serigraphs (1960s)", "notes": "day-glo grocery slogans turned scripture, tilted hand lettering, crops of supermarket signs", "type_tags": ["diy", "kitsch-revival", "shouting", "hand-painted"]},
    {"name": "Atelier Populaire May '68 silkscreens (Paris)", "notes": "one-color stencil, factory-occupied production, fist and factory icons, slogan as image", "type_tags": ["diy", "shouting", "zine", "civic"]},
    {"name": "Black Panther newspaper (Emory Douglas, 1967–76)", "notes": "thick contour revolutionary figures, collaged halftones, bold flat second color, back-page poster", "type_tags": ["shouting", "diy", "civic", "zine"]},
    {"name": "Chicano movement posters (RCAF, 1970s)", "notes": "silkscreen rasquache, Virgen and UFW eagle iconography, bilingual slogans, day-glo inks", "type_tags": ["diy", "hand-painted", "shouting", "kitsch-revival"]},
    {"name": "Gran Fury / ACT UP graphics (1987–92)", "notes": "SILENCE=DEATH pink triangle, advertising's own tools turned against it, declarative sans caps", "type_tags": ["shouting", "modernist", "civic", "restrained"]},
    {"name": "Barbara Kruger (1980s)", "notes": "Futura Bold Oblique white-on-red bars over found photography, accusatory pronouns", "type_tags": ["italic-display", "shouting", "restrained", "kitsch-revival"]},
    {"name": "Keith Haring subway chalk (1980–85)", "notes": "radiant baby, barking dog, thick uniform line, figures vibrating with motion dashes, black paper", "type_tags": ["diy", "playful", "shouting", "vibrating"]},
    {"name": "NYC wildstyle graffiti (1973–84)", "notes": "interlocking arrowed letterforms, fades and fills, outline-on-outline, crew tags, whole-car ambition", "type_tags": ["diy", "decorative", "shouting", "vibrating"]},
    {"name": "Jamie Reid Sex Pistols (1976–79)", "notes": "ransom-note cutout letters, safety-pinned Queen, day-glo offset, situationist vandalism", "type_tags": ["ransom-note", "diy", "zine", "shouting"]},
    {"name": "Barney Bubbles Stiff Records (1977–82)", "notes": "art-history quotation in pop sleeves, hidden jokes, constructivism for the singles bin", "type_tags": ["constructivist", "kitsch-revival", "playful", "decorative"]},
    {"name": "Raymond Pettibon SST flyers (1981–85)", "notes": "ink-brush drawing with sinister caption, typewriter gig details, xerox grain, four bars logo", "type_tags": ["diy", "zine", "grunge", "typewriter"]},
    {"name": "UK acid house rave flyers (1988–92)", "notes": "smiley faces, fractals and clip-art collision, fluoro inks, map-point directions, warehouse mystique", "type_tags": ["diy", "psychedelic", "geocities", "playful"]},
    {"name": "The Designers Republic / Warp (Sheffield, 1990s)", "notes": "anti-design consumerism, Pho-Ku logos, dense layered vectors, techno-Japanese pastiche", "type_tags": ["japanese-clash", "vaporwave", "y2k", "vibrating"]},
    {"name": "Me Company Björk era (1993–99)", "notes": "digital hyperreal portraits, chrome typography, posthuman gloss, CGI ornament", "type_tags": ["chrome", "vaporwave", "y2k", "decorative"]},
    {"name": "April Greiman New Wave LA (1980s)", "notes": "video-grab pixels at print scale, layered Macintosh collage, diagonal energy, hybrid imagery", "type_tags": ["emigre", "vaporwave", "vibrating", "decorative"]},
    {"name": "Hipgnosis sleeves (1968–82)", "notes": "surreal staged photography, no band photo, pig over power station, image as riddle", "type_tags": ["editorial", "restrained", "modernist", "kitsch-revival"]},
    {"name": "Roger Dean Yes covers (1971–74)", "notes": "floating islands, organic bubble logos, watercolor alien landscapes, fantasy cartography", "type_tags": ["ornamental-display", "psychedelic", "airbrushed", "kitsch-revival"]},
    {"name": "Pedro Bell Funkadelic covers (1973–81)", "notes": "marker-maximalist cosmic slop, dense margin rants, funk creatures, hand-lettered liner chaos", "type_tags": ["psychedelic", "hand-painted", "shouting", "decorative"]},
    {"name": "Peter Max cosmic pop (1966–70)", "notes": "rainbow profile heads, stars and planets, poster-flat color bands, aquarian optimism", "type_tags": ["psychedelic", "decorative", "ornamental-display", "playful"]},
    {"name": "Heinz Edelmann Yellow Submarine (1968)", "notes": "rubbery psychedelic figures, sea of monsters, flat acid color, art nouveau melted into pop", "type_tags": ["psychedelic", "art-nouveau", "decorative", "playful"]},
    {"name": "Terry Gilliam Python cutouts (1969–74)", "notes": "Victorian engravings animated by scissors, giant foot, collage non-sequitur, absurd juxtaposition", "type_tags": ["ransom-note", "kitsch-revival", "playful", "ornamental-display"]},
    {"name": "Chris Foss sci-fi paperbacks (1970s)", "notes": "airbrushed megastructure spaceships, hazard stripes, tiny human scale figures, dusty nebula skies", "type_tags": ["airbrushed", "raygun", "kitsch-revival", "monumental"]},
    {"name": "MTV identity (Manhattan Design, 1981)", "notes": "one logo, infinite skins, the M repainted hourly, broadcast vandalism as brand system", "type_tags": ["diy", "shouting", "vibrating", "decorative"]},
    {"name": "Susan Kare Macintosh pixels (1984)", "notes": "32x32 icon wit, Chicago bitmap, happy Mac, dogcow, charm under constraint", "type_tags": ["pixel", "playful", "restrained", "post-mac"]},
    {"name": "HyperCard stacks (1987–94)", "notes": "1-bit dithered graphics, rounded-rect buttons, home stack metaphor, amateur hypermedia", "type_tags": ["pixel", "post-mac", "html-default", "playful"]},
    {"name": "Winamp skin culture (1997–2002)", "notes": "brushed chrome and LED sliders, custom pixel chrome, tiny bitmap fonts, it really whips", "type_tags": ["chrome", "pixel", "geocities", "90s-experimental"]},
    {"name": "Frutiger Aero (2004–09)", "notes": "glossy aqua orbs, grass and water photography, light streaks, humanist sans, optimistic glass", "type_tags": ["chrome", "y2k", "vaporwave", "restrained"]},
    {"name": "iOS skeuomorphism (2007–12)", "notes": "stitched leather, felt and linen textures, glass shelves, realistic knobs, lickable buttons", "type_tags": ["chrome", "restrained", "decorative", "playful"]},
    {"name": "Tibor Kalman Colors magazine (1991–95)", "notes": "one photograph as argument, provocative juxtaposition, captions in two languages, global lens", "type_tags": ["editorial", "polyglot", "restrained", "shouting"]},
    {"name": "Richard Turley Bloomberg Businessweek (2010–14)", "notes": "business magazine gone feral, jokes in the furniture, brutal crops, chart-as-cover", "type_tags": ["editorial", "vibrating", "kitsch-revival", "playful"]},
    {"name": "McSweeney's Quarterly (1998–present)", "notes": "Victorian title-page density played straight, Garamond ceremony, footnotes and spines as jokes", "type_tags": ["restrained", "editorial", "ornamental-display", "manuscript"]},
    {"name": "Howard Finster outsider gospel art (1976–91)", "notes": "every inch filled with sermon text, numbered visions, folk portraits, paradise garden density", "type_tags": ["diy", "hand-painted", "decorative", "amateur"]},
    {"name": "Dick Bruna picture books (1953–2011)", "notes": "thick black outline, primary flat fields, frontal symmetry, white ground, radical reduction", "type_tags": ["restrained", "geometric", "modernist", "scandinavian"]},
    {"name": "Ladybird Books (UK, 1960s)", "notes": "full-page educational gouache opposite plain text, matter-of-fact captions, postwar tidiness", "type_tags": ["editorial", "restrained", "modernist", "civic"]},
]


# TYPE_PAIRINGS — display + body font pairs, tagged with typographic
# temperaments. At roll time, pairs whose tags overlap the rolled lineage's
# `type_tags` form the candidate pool; the rng picks one.
#
# Most named faces are on Google Fonts so HTML output renders without
# substitution. Where canonical commercial faces are listed (Söhne, Druk,
# Knockout, Mercury, Reklame Script, Trade Gothic, etc.), the SKILL.md
# substitution clause applies — substitute the closest free face and note
# it in the provenance stamp.
TYPE_PAIRINGS = [
    # —— Modernist / Constructivist / Bauhaus / shouting industrial ——
    {"display": "Druk Wide Super",       "body": "Söhne",                     "tags": ["constructivist", "shouting", "industrial-sans", "monumental"],                "note": "monumental wide sans + clean grotesk — type IS the politics"},
    {"display": "Anton",                 "body": "Public Sans",               "tags": ["constructivist", "shouting", "industrial-sans"],                              "note": "free Google substitute for Druk territory"},
    {"display": "Bebas Neue",            "body": "Work Sans",                 "tags": ["constructivist", "industrial-sans", "wayfinding"],                            "note": "condensed agit-display + neutral utility body"},
    {"display": "Futura PT Bold",        "body": "Futura PT Book",            "tags": ["bauhaus", "geometric", "modernist"],                                          "note": "the period-correct geometric sans, top to bottom"},
    {"display": "Archivo Black",         "body": "Archivo",                   "tags": ["bauhaus", "geometric", "modernist", "industrial-sans"],                       "note": "free Google geometric pair"},
    {"display": "Knockout 70",           "body": "Mercury Text G2",           "tags": ["constructivist", "editorial", "shouting", "wood-type"],                       "note": "Hoefler condensed display + warm editorial serif"},
    {"display": "Oswald",                "body": "EB Garamond",               "tags": ["constructivist", "wood-type", "editorial"],                                   "note": "free condensed display + humanist serif"},
    {"display": "DIN Condensed",         "body": "Neue Haas Grotesk Text",    "tags": ["tschichold", "swiss", "industrial-sans"],                                     "note": "engineering DIN + canonical Swiss"},
    {"display": "Barlow Condensed Black","body": "Barlow",                    "tags": ["tschichold", "industrial-sans", "modernist", "civic"],                        "note": "free DIN-flavored pair"},

    # —— Swiss / corporate modernism / wayfinding ——
    {"display": "Neue Haas Grotesk Display","body": "Neue Haas Grotesk Text", "tags": ["swiss", "wayfinding", "restrained", "modernist"],                             "note": "the orthodox Swiss pair"},
    {"display": "Univers 75",            "body": "Univers 55",                "tags": ["swiss", "wayfinding", "restrained"],                                          "note": "Frutiger systemic"},
    {"display": "ABC Diatype Bold",      "body": "Times Now",                 "tags": ["restrained", "editorial", "ecm-like", "modernist", "scandinavian"],           "note": "ECM / Agnes Martin austerity — restraint as luxury"},
    {"display": "Söhne Halbfett",        "body": "Söhne Buch",                "tags": ["restrained", "editorial", "ecm-like", "scandinavian"],                        "note": "modern grotesk with warmth"},

    # —— Art Deco / Cassandre / machine-age ——
    {"display": "Peignot Bold",          "body": "EB Garamond",               "tags": ["art-deco", "monumental", "machine-age"],                                      "note": "Cassandre-era machine-age glamour"},
    {"display": "ITC Anna",              "body": "Futura PT",                 "tags": ["art-deco", "ornamental-display", "machine-age"],                              "note": "deco display + geometric body"},
    {"display": "Limelight",             "body": "Cormorant Garamond",        "tags": ["art-deco", "ornamental-display", "showcard"],                                 "note": "free Google deco display + serif"},

    # —— Art Nouveau / Mucha / Vienna Secession / Medieval ——
    {"display": "Eckmann",               "body": "Cormorant Garamond",        "tags": ["art-nouveau", "secession", "ornamental-display"],                             "note": "Jugendstil display + period serif"},
    {"display": "Berlin Sans FB",        "body": "EB Garamond",               "tags": ["secession", "geometric", "ornamental-display"],                               "note": "Secession-influenced geometric + serif"},
    {"display": "UnifrakturMaguntia",    "body": "EB Garamond",               "tags": ["medieval", "manuscript", "ornamental-display"],                               "note": "blackletter + humanist serif"},
    {"display": "Cinzel Decorative",     "body": "Cormorant Garamond",        "tags": ["medieval", "manuscript", "ornamental-display", "secession"],                  "note": "engraved capitals + humanist serif"},

    # —— Psychedelic / Wes Wilson / Polish poster ——
    {"display": "Monoton",               "body": "Cooper Hewitt",             "tags": ["psychedelic", "vibrating", "decorative"],                                     "note": "Wilson-style ringed letters + neutral body"},
    {"display": "Reklame Script",        "body": "Söhne",                     "tags": ["psychedelic", "ornamental-display", "showcard"],                              "note": "showcard script + neutral body"},
    {"display": "Cherry Bomb One",       "body": "Recoleta",                  "tags": ["psychedelic", "polish-poster", "decorative", "ornamental-display"],           "note": "playful hand-drawn + warm serif"},
    {"display": "Abril Fatface",         "body": "Lora",                      "tags": ["polish-poster", "editorial", "ornamental-display"],                           "note": "Polish poster heaviness + readable serif"},

    # —— Memphis / Anti-design / Postmodern ——
    {"display": "Cooper Black Italic",   "body": "ITC Souvenir",              "tags": ["postmodern", "italic-display", "kitsch-revival"],                             "note": "the actual Memphis pair (~1981)"},
    {"display": "ITC Benguiat",          "body": "Times New Roman",           "tags": ["postmodern", "kitsch-revival", "70s-revival"],                                "note": "Stranger Things / Souvenir revival"},
    {"display": "Bagel Fat One",         "body": "DM Serif Text",             "tags": ["postmodern", "kitsch-revival", "decorative"],                                 "note": "fat playful display + serif body"},

    # —— Wood-type / Victorian playbill / ransom-note ——
    {"display": "Rye",                   "body": "Caslon",                    "tags": ["wood-type", "playbill", "ransom-note", "showcard"],                           "note": "Tuscan woodtype + period serif"},
    {"display": "Alfa Slab One",         "body": "Goudy Old Style",           "tags": ["wood-type", "playbill", "showcard", "70s-revival"],                           "note": "slab woodtype + warm serif"},
    {"display": "Bungee Inline",         "body": "Vollkorn",                  "tags": ["wood-type", "playbill", "ransom-note", "decorative"],                         "note": "circus woodtype + sturdy body"},

    # —— ANSI / BBS / phreak / terminal / phosphor ——
    {"display": "Press Start 2P",        "body": "IBM Plex Mono",             "tags": ["pixel", "terminal", "ascii", "phreak"],                                       "note": "8-bit display + readable mono"},
    {"display": "VT323",                 "body": "VT323",                     "tags": ["terminal", "ascii", "phosphor"],                                              "note": "literal VT220 — single face throughout"},
    {"display": "Silkscreen",            "body": "JetBrains Mono",            "tags": ["pixel", "terminal", "ascii", "emigre", "post-mac"],                           "note": "early Mac bitmap + modern mono"},
    {"display": "DotGothic16",           "body": "Source Code Pro",           "tags": ["pixel", "phosphor", "japanese-clash", "ascii"],                               "note": "Japanese pixel + clean mono"},
    {"display": "Cutive Mono",           "body": "Cutive Mono",               "tags": ["typewriter", "phreak", "zine", "diy"],                                        "note": "single typewriter face throughout"},

    # —— Vaporwave / Y2K / chrome / arcade ——
    {"display": "Bungee Spice",          "body": "Shippori Mincho",           "tags": ["vaporwave", "y2k", "japanese-clash", "chrome"],                               "note": "chrome display + Japanese mincho"},
    {"display": "Audiowide",             "body": "Public Sans",               "tags": ["y2k", "chrome", "arcade"],                                                    "note": "Y2K portal-era display + neutral body"},
    {"display": "Russo One",             "body": "JetBrains Mono",            "tags": ["y2k", "chrome", "arcade", "neon"],                                            "note": "machine-age extended + tech mono"},

    # —— Edo / ukiyo-e / Japanese ——
    {"display": "Hina Mincho",           "body": "Shippori Mincho",           "tags": ["japanese", "edo", "ukiyo-e", "woodblock"],                                    "note": "narrow display mincho + body mincho"},
    {"display": "Reggae One",            "body": "Klee One",                  "tags": ["japanese", "woodblock", "ukiyo-e", "playful"],                                "note": "brush-painted display + handwritten body"},
    {"display": "Yuji Boku",             "body": "Zen Old Mincho",            "tags": ["japanese", "edo", "manuscript", "calligraphic"],                              "note": "calligraphic brush + classical mincho"},

    # —— Persian / Arabic / Mughal / Iranian ——
    {"display": "Vazirmatn",             "body": "Markazi Text",              "tags": ["persian", "arabic", "manuscript"],                                            "note": "Persian display + Arabic-Latin reading face"},
    {"display": "Amiri Quran",           "body": "Amiri",                     "tags": ["persian", "arabic", "manuscript", "calligraphic"],                            "note": "Naskh calligraphy + Naskh body"},
    {"display": "Lalezar",               "body": "Vazirmatn",                 "tags": ["persian", "arabic", "showcard", "silkscreen"],                                "note": "Iranian poster display + Persian body"},

    # —— Hebrew / Vilna Talmud ——
    {"display": "Frank Ruhl Libre",      "body": "David Libre",               "tags": ["hebrew", "polyglot", "manuscript", "editorial"],                              "note": "Hebrew display + Hebrew body"},

    # —— Tamil / Devanagari / South Asian ——
    {"display": "Catamaran 900",         "body": "Catamaran",                 "tags": ["tamil", "south-asian", "hand-painted", "showcard"],                           "note": "Tamil display + Latin/Tamil body"},
    {"display": "Tiro Devanagari Hindi", "body": "Hind",                      "tags": ["devanagari", "bollywood", "south-asian"],                                     "note": "Devanagari pair for hoarding territory"},
    {"display": "Yatra One",             "body": "Tiro Devanagari Hindi",     "tags": ["devanagari", "bollywood", "south-asian", "hand-painted"],                     "note": "Bollywood hand-painted Devanagari + reading face"},

    # —— Whole Earth / DIY / typewriter / zine ——
    {"display": "Special Elite",         "body": "Courier Prime",             "tags": ["zine", "diy", "typewriter", "whole-earth"],                                   "note": "weathered typewriter + clean mono"},
    {"display": "Permanent Marker",      "body": "Courier Prime",             "tags": ["zine", "diy", "amateur", "grunge"],                                           "note": "Sharpie on flyer + typewriter body"},
    {"display": "Flavors",               "body": "Sniglet",                   "tags": ["amateur", "kitsch-revival", "70s-revival"],                                   "note": "amateur display + rounded body"},

    # —— 90s experimental / Raygun / Emigre / The Face ——
    {"display": "Faster One",            "body": "IBM Plex Sans",             "tags": ["90s-experimental", "raygun", "grunge"],                                       "note": "Carson-era distortion + modern grotesk"},
    {"display": "Major Mono Display",    "body": "Spectral",                  "tags": ["90s-experimental", "emigre", "post-mac", "editorial"],                        "note": "geometric mono + editorial serif"},
    {"display": "Rubik Glitch",          "body": "Public Sans",               "tags": ["90s-experimental", "raygun", "grunge", "post-mac"],                           "note": "glitched display + neutral body"},

    # —— Brutalist / béton brut / civic ——
    {"display": "Big Shoulders Display", "body": "IBM Plex Mono",             "tags": ["brutalist", "civic", "industrial-sans"],                                      "note": "woodtype-flavored brutalist + utility mono"},
    {"display": "Syne Mono",             "body": "Syne",                      "tags": ["brutalist", "restrained", "dutch-experimental"],                              "note": "playful brutalism, single family pair"},

    # —— Dutch experimental / Weingart / Studio Dumbar / Karel Martens ——
    {"display": "Fraunces 900",          "body": "Fraunces",                  "tags": ["dutch-experimental", "post-mac", "editorial"],                                "note": "variable serif at extreme weights"},
    {"display": "Redaction 70",          "body": "Redaction 12",              "tags": ["dutch-experimental", "restrained", "90s-experimental"],                       "note": "optical-sized serif system"},

    # —— Mid-century American / Saul Bass / NASA / Blue Note ——
    {"display": "Trade Gothic Bold Condensed","body": "Trade Gothic",         "tags": ["mid-century-american", "editorial", "industrial-sans"],                       "note": "Blue Note / NYC tabloid pair"},
    {"display": "Antonio",               "body": "PT Sans",                   "tags": ["mid-century-american", "wayfinding", "civic", "industrial-sans"],             "note": "free condensed gothic + neutral body"},

    # —— Italian postwar / Domus / National Geographic ——
    {"display": "Bodoni Moda",           "body": "Spectral",                  "tags": ["italian-postwar", "editorial", "ornamental-display"],                         "note": "Italian modernist serif + readable body"},

    # —— Proto-web / Geocities / HTML 1.0 / Windows 95 ——
    {"display": "Times New Roman",       "body": "Times New Roman",           "tags": ["proto-web", "html-default"],                                                  "note": "literal browser default — that IS the point"},
    {"display": "Comic Sans MS",         "body": "Times New Roman",           "tags": ["proto-web", "geocities", "amateur"],                                          "note": "period-accurate amateur web"},
    {"display": "MS Sans Serif",         "body": "Tahoma",                    "tags": ["proto-web", "html-default", "chrome"],                                        "note": "Windows 95 system pair"},

    # —— Silkscreen / international solidarity ——
    {"display": "Staatliches",           "body": "Source Sans Pro",           "tags": ["silkscreen", "international-style", "shouting", "constructivist"],            "note": "stencil display + neutral body"},

    # —— Showcard / airbrushed / VHS / Hot Rod ——
    {"display": "Bungee",                "body": "Work Sans",                 "tags": ["showcard", "70s-revival", "neon", "arcade"],                                  "note": "neon signage display + neutral body"},
    {"display": "Black Ops One",         "body": "Barlow Condensed",          "tags": ["showcard", "airbrushed", "70s-revival"],                                      "note": "stencil military + condensed body"},
]


# Wikipedia's random-article endpoint. Server-side redirects to a fresh article
# on every fetch, drawing from ~6M+ entries. This is the SUBJECT of the design —
# the article handed to the LLM as the basis from which palette, layout, and
# mood are derived in the SKILL.md instructions.
WIKIPEDIA_RANDOM = "https://en.wikipedia.org/wiki/Special:Random"


def pick_pairing(rng: random.Random, lineage: dict) -> dict:
    lineage_tags = set(lineage.get("type_tags", []))
    matches = [p for p in TYPE_PAIRINGS if lineage_tags & set(p["tags"])]
    if not matches:
        matches = TYPE_PAIRINGS
    return rng.choice(matches)


def roll(seed_int: int) -> dict:
    rng = random.Random(seed_int)
    lineage = rng.choice(LINEAGES)
    return {
        "trip_id": f"{seed_int:016x}"[-6:].upper(),
        "seed": f"{seed_int:016x}",
        "document_type": rng.choice(DOCUMENT_TYPES),
        "lineage": lineage,
        "type_pairing": pick_pairing(rng, lineage),
        "subject_url": WIKIPEDIA_RANDOM,
    }


# DOCUMENT_TYPES is the dominant structural axis. It dictates what KIND OF OBJECT
# the page is — not just how sections are organized within a marketing site, but
# whether the page is even shaped like a marketing site. Most of these forbid the
# default SaaS landing-page anatomy (nav + hero + features grid + testimonials +
# CTA + footer). Honor the form of the document, not the convention of the web.
DOCUMENT_TYPES = [
    {"name": "Cassandre-era travel poster", "notes": "single canvas filling viewport, NO SCROLL. Monumental vehicle/destination illustration + city name + tiny fare/timetable at corner. The whole page is the poster."},
    {"name": "concert flyer", "notes": "vertical stack of band names sized by billing, every element fights for space, photocopier-xerox feel, venue/date/price crammed at bottom. ONE long page that reads like a wall paste-up, not a multi-section site."},
    {"name": "movie one-sheet poster", "notes": "single dominant illustration + title block + tagline + cast credit block + studio logos at bottom. NO SCROLL. Filling viewport with one cinematic statement."},
    {"name": "12-inch album cover gatefold", "notes": "two square panels — front side is sparse evocative cover, back side is dense liner notes / credits / lyrics. Two-panel layout, not a scrolling page."},
    {"name": "wine bottle label", "notes": "narrow vertical centered composition, ornate frame border, varietal/vintage/estate name in classical type, tiny ABV/import text at bottom. Surrounded by generous bottle-colored ground."},
    {"name": "picture book spread", "notes": "left page = full-bleed illustration, right page = short paragraph in oversized child-reading type. Two-page logic, no scroll. Page numbers in corners. Spine running down center."},
    {"name": "illuminated manuscript page", "notes": "narrow centered text column with extensive marginalia in different fonts/sizes around it, oversized gilded initial capital, running header, gutter ornaments. The marginalia is the value, not a sidebar."},
    {"name": "comic book page", "notes": "multi-panel grid with gutters between, speech bubbles, action lines, sound-effect lettering, panel-to-panel narrative, page number in corner. The story IS the page."},
    {"name": "newspaper front page", "notes": "masthead with date and edition number, multi-column flow with vertical rules, dateline, lead story + jumps to inside, fold marker, weather/index strip. Dense, multi-headline, no hero."},
    {"name": "lab notebook page", "notes": "ruled paper feel, dated entries top-of-page, handwritten-style annotations, sketched diagrams inline with arrows and labels, formulas in margins, page number at corner. First-person research, not marketing."},
    {"name": "restaurant menu", "notes": "categorized dishes (Appetizers / Mains / Desserts / Wines), each dish has name + leader dots + price, italic description lines, daily-specials box, footer with allergen notice. Reads as a menu, not as features."},
    {"name": "theater playbill", "notes": "cover with title and run dates, cast list with character names, scene breakdown (Act I / Act II), intermission notice, full-page program ads between sections, director's note."},
    {"name": "church bulletin", "notes": "service order with numbered movements, hymn numbers in parentheses, scripture references, announcements column, prayer-list page, weekly schedule. Ceremonial typography, two-column."},
    {"name": "library card catalog drawer", "notes": "stack of typewritten 3×5 cards each with call number / author / title / subject headings, alphabetized, fixed card format. Drawer label at top. The page IS a drawer of cards, not paragraphs."},
    {"name": "mall directory", "notes": "alphabetized store list with floor/section codes, color-coded zone map, You Are Here marker, hours strip at top. Public-signage type. Reads as wayfinding, not as content."},
    {"name": "airport/train departure board", "notes": "tabular rows: destination · gate/track · scheduled · status (ON TIME / DELAYED / BOARDING). Status colors. Monospace. Constant ticker quality. Updates at the bottom."},
    {"name": "phonebook white pages", "notes": "alphabetized listings with tiny addresses, leader dots before phone numbers, abbreviations (St / Ave / Apt), two-column dense, A-Z thumb tabs at edge."},
    {"name": "lotería card grid", "notes": "4×4 grid of named playable cards (La Sirena, El Diablito, El Sol, La Luna…), each card has illustration + numbered label + Spanish caption. The whole page is the grid, no other structure."},
    {"name": "auction catalog page", "notes": "lot number · description · provenance · estimate · photograph for each lot, lots stacked vertically. Bold lot numbers, italic descriptions, fine-print provenance. Reads as auction-house catalog."},
    {"name": "festival lineup poster", "notes": "bands clustered by day, type sizes encode billing (HEADLINER huge → co-bills medium → openers tiny → sponsors microscopic). Date columns. Venue and dates dominant at top. One canvas, no scroll."},
    {"name": "sheet music score", "notes": "staves with notes / rests / time signature / key signature / dynamics markings / fingering numbers, composer and lyricist credits at top, measure numbers at line ends. Page numbers at corners."},
    {"name": "recipe card", "notes": "title + yield/prep-time at top, ingredients column left + numbered steps column right, photograph at top or side, source attribution at bottom. Small fixed format, often two-sided."},
    {"name": "transit system map", "notes": "colored route lines connecting station nodes, station name list, fare-zone shading, accessibility icons at stations, legend in corner. Diagrammatic, not narrative."},
    {"name": "interview transcript", "notes": "alternating named-speaker blocks (INTERVIEWER: ... / SUBJECT: ...), header citation (publication / date / location), inline em-dashes for pauses, footnote numbers, page numbers. Q&A flow, not sections."},
    {"name": "telegram chain", "notes": "successive timestamped monospace messages with STOP delimiters, sender → recipient header, terse military-style copy, station codes, file number at top. Reads as a sequence of cables."},
    {"name": "enamel advertising sign", "notes": "fixed rectangular composition, vintage product name dominant, ornamental border, 'SINCE 18XX' date plaque, small slogan at bottom. Surface looks like enamel — chipped edges, drop shadows from the sign body."},
    {"name": "patent application figure", "notes": "labeled mechanical/scientific drawing with numbered callout references, claim list below figure (Claim 1, Claim 2…), inventor name, application number, filing date. USPTO-style stamps."},
    {"name": "encyclopedia entry", "notes": "title with pronunciation key + etymology in italics, sectioned body (Origins / Description / Notable examples / See also), small footnotes, page-bottom 'continued on page X'. Authoritative reference voice."},
    {"name": "baseball trading card back", "notes": "stats block (height/weight/team/position/bats/throws), portrait photo, career highlights paragraph, year-by-year stats table, copyright/series number footer. Fixed card aspect, two-sided logic."},
    {"name": "astrological chart wheel", "notes": "circular zodiac divided into 12 houses, planetary glyphs positioned in houses, aspect lines connecting planets, birth-data block in corner, interpretive notes around the wheel. Diagrammatic, circular reading order."},
    {"name": "Old West wanted poster", "notes": "WANTED dominant at top, portrait centered, list of crimes, DEAD OR ALIVE line, reward sum huge near bottom, sheriff/marshal contact in fine print. Distressed single sheet, NO SCROLL."},
    {"name": "field guide plate", "notes": "specimen illustration + common and Latin names, ID field marks with pointer lines to the figure, range map inset, habitat/season/similar-species notes, plate number. Peterson/Audubon anatomy, not content cards."},
    {"name": "seed packet", "notes": "front = variety illustration + name; back = planting table (depth / spacing / days to germination), hardiness-zone strip, lot number and packed-for date, tear notch. Small fixed format, two-sided logic."},
    {"name": "ship's passenger manifest", "notes": "ledger table: line number · name · age · occupation · nationality · berth, port of departure/arrival header, master's signature block, official stamps. Handwritten-register feel — the rows ARE the page."},
    {"name": "customs declaration form", "notes": "numbered boxed fields, checkbox rows, FOR OFFICIAL USE ONLY shaded zones, signature and date lines, form number in corner, carbon-copy tint. Bureaucratic grid, nothing promotional."},
    {"name": "mixtape J-card", "notes": "folded cassette insert: spine title, Side A / Side B track lists with durations, handwritten dedication, visible fold lines, Dolby/CrO2 marks. Panel-based layout, not a scrolling page."},
    {"name": "tarot spread reading", "notes": "cards laid in a named spread (Celtic cross, three-card), each card illustrated + named + position meaning (Past / Obstacle / Outcome), reader's interpretive notes threading between them. Diagrammatic reading order."},
    {"name": "aircraft safety card", "notes": "wordless numbered panels of figures performing procedures, directional arrows, red crossed-out prohibitions, brace positions, exit diagram. Laminated pictographic style, virtually NO body copy."},
    {"name": "stamp album page", "notes": "stamps mounted in ruled frames, perforation/watermark notes beneath each, catalog numbers, country-and-era header, hinge marks, collector's pencil annotations. Archive grid, fixed mounts."},
    {"name": "funeral order of service", "notes": "In Memoriam cover with name and dates, order of ceremony (processional / readings / eulogy / committal), hymn verses printed in full, pallbearer list, reception details. Solemn ceremonial typography."},
    {"name": "boxing fight bill", "notes": "two fighters' names in huge opposing type with VS between, weights and records beneath, undercard bouts in shrinking sizes, venue/date/ticket prices crammed at bottom. One vertical bill, NO SCROLL."},
    {"name": "racing form page", "notes": "past-performance tables per horse: post position · jockey · odds · speed figures, track-condition codes, morning line, handicapper's tip annotations. Dense agate type, abbreviations everywhere."},
    {"name": "crossword puzzle page", "notes": "numbered black-and-white grid + ACROSS and DOWN clue columns, puzzle number and setter byline, yesterday's solution inset small. The grid IS the hero; clues are the body."},
    {"name": "paint swatch strip", "notes": "vertical strip of graded color chips, each with a poetic name + code number, brand band at top, undertone/finish notes, fan-deck edge. The color fields ARE the design — almost no other content."},
    {"name": "cash register receipt", "notes": "narrow monospace tape: store header, itemized lines with right-aligned prices, subtotal/tax/total, payment line, SAVE YOUR RECEIPT footer, barcode. One long thin thermal-paper column."},
    {"name": "redacted intelligence dossier", "notes": "typewriter memo with CLASSIFIED stamps, black redaction bars mid-sentence, file and case numbers, distribution list, paperclipped photo inset with caption, declassification stamp overriding a corner."},
    {"name": "treasure map", "notes": "hand-drawn coastline, dotted route past named landmarks, X marks the spot, compass rose, sea monster in open water, scrawled warnings, burnt edges. Annotated terrain, not text sections."},
    {"name": "herbarium specimen sheet", "notes": "pressed plant arranged on the sheet, collection label at lower right (collector / date / locality / determination), accession stamp, scale bar, fragment envelope. Archive object, not article."},
    {"name": "architectural blueprint", "notes": "white linework on cyanotype blue, plan view with dimension chains, room labels, section markers, title block at lower right (project / scale / sheet number / revision table). Drafting conventions, not prose."},
    {"name": "sewing pattern envelope", "notes": "front = garment illustration in 2–3 views + pattern number huge; back = fabric-requirement table by size, notions list, body-measurement chart, suggested fabrics. Two-sided logic, tabular back."},
    {"name": "railway timetable", "notes": "columnar station times where reading down = one train, footnote daggers (†Sundays only), connection notes, fare table inset, EFFECTIVE date banner. Dense tabular agate, no hero."},
    {"name": "school report card", "notes": "subject rows × term columns with letter grades, teacher comments in cursive, attendance tally, conduct mark, parent signature line, school crest header. Folded-card logic."},
    {"name": "hotel register page", "notes": "ruled ledger spread: date · guest name · residence · room · rate, handwriting varying row to row, clerk's notations, ink blots, page tab. The ledger rows ARE the content."},
    {"name": "ouija board", "notes": "letter arcs A–M / N–Z, numerals 0–9, YES and NO at upper corners, GOOD BYE at bottom, sun and moon emblems, planchette resting somewhere meaningful. Single board face, NO SCROLL."},
    {"name": "diner placemat", "notes": "central local map or trivia panel ringed by mismatched boxed ads for local businesses, kids' maze and word-search corner, scalloped border. Cheerful paper clutter, single sheet."},
    {"name": "yearbook spread", "notes": "portrait grid with name captions, superlatives box, candid photos at angles, club roster column, handwritten signatures and farewells scrawled OVER the printed layout. School-year header."},
    {"name": "farmer's almanac page", "notes": "moon-phase calendar strip, weather predictions by region, best-days table (plant / fish / cut hair), proverb fillers between sections, woodcut spot illustrations, patent-remedy ads in margins."},
    {"name": "Snellen eye chart", "notes": "single huge letter at top, rows shrinking line by line with acuity ratios (20/200 → 20/10) at the edges, instruction line at bottom. Centered column, clinical sparseness, NO SCROLL."},
    {"name": "milk carton panels", "notes": "unfolded gable carton: brand/product face, MISSING panel with photo and last-seen details, nutrition panel, dairy code stamps, fold flaps visible. Panel-based carton-die layout."},
    {"name": "cereal box back", "notes": "game/maze/comic dominating the panel, mail-in offer with dotted-line coupon, box-tops counter, nutrition sliver at the side, mascot interjecting. Loud kid-eye composition, single panel."},
    {"name": "nautical chart", "notes": "depth soundings scattered as tiny numbers, depth contours, lighthouse symbols with light characteristics (Fl W 10s), compass rose with variation, hazard notes, chart number and corrections log."},
    {"name": "planisphere star chart", "notes": "circular sky map with constellation lines and graded star magnitudes, month/hour rim dials, horizon ellipse, Milky Way wash, instruction panel in a corner. Rotational diagram logic."},
    {"name": "apothecary label", "notes": "ornate bordered label: Latin compound name, dosage instructions, POISON warning with skull where apt, pharmacist's name and shop address, hand-numbered batch. Small ornamental format on bottle-colored ground."},
    {"name": "matchbook cover", "notes": "unfolded flat: front-flap ad, inside tray, CLOSE COVER BEFORE STRIKING strip, back flap with address and phone, striker band. All panels shown in die-cut arrangement."},
    {"name": "IBM punch card", "notes": "80 columns × 12 rows of punch positions, printed digit rows, corner cut, interpreted text printed along the top, DO NOT FOLD, SPINDLE OR MUTILATE. The card grid IS the page."},
    {"name": "Victorian dance card", "notes": "numbered dance list (Waltz / Polka / Quadrille) with partner lines beside each, tasseled-cord motif, ball name and date in copperplate, chaperone note. Small ornamental booklet logic."},
    {"name": "passport visa pages", "notes": "two facing pages of security guilloché, overlapping entry/exit stamps in varied inks and rotations, a visa sticker with photo and MRZ chevrons, page numbers in corners."},
    {"name": "postcard back", "notes": "divided back: message scrawled on the left half, address lines right, stamp box upper-right with cancellation mark, caption line in fine print along the edge. One card face; handwriting carries the content."},
    {"name": "war ration book", "notes": "page of numbered stamps in a tear-off grid (some already torn), holder's name/address block, serial numbers, penalties-for-misuse warnings. Wartime bureaucratic austerity."},
    {"name": "wordless assembly instructions", "notes": "numbered exploded-view steps, parts inventory with quantities (screw ×8), tools pictured, no-words figures with arrows, crossed-out misuse panel, part number footer. Pictographic only."},
    {"name": "tide table card", "notes": "month grid of high/low times and heights, moon-phase symbols, sunrise/sunset columns, station name and datum note, best-fishing shading. Pocket-card density."},
    {"name": "classified ads page", "notes": "tiny column ads under section headers (FOR SALE / HELP WANTED / PERSONALS / LOST), heavy abbreviation (OBO, EZ terms), boxed premium ads, per-word rate strip. Agate type, vertical rules."},
    {"name": "museum wall placards", "notes": "main object panel (title / maker / date / medium / accession number) + interpretive paragraph, smaller neighboring object labels, gallery map corner, audio-tour number disc. Gallery-wall arrangement."},
    {"name": "garage sale flyer", "notes": "hand-lettered headline, item list with prices, hand-drawn map to the address, fringe of tear-off phone tabs at bottom (some taken), staple marks, photocopier grain. Single telephone-pole sheet."},
    {"name": "diner guest check", "notes": "numbered green-tinted pad sheet: table/server/guests boxes, handwritten order lines in diner shorthand, prices column, tax and total at bottom, THANK YOU edge, carbon ghost beneath."},
    {"name": "prescription slip", "notes": "doctor's letterhead, Rx symbol, near-illegible medication scrawl with sig codes (1 tab PO BID), refill checkbox, registration number, signature line. Small slip, clinical sparseness."},
    {"name": "choose-your-own-adventure page", "notes": "second-person narrative paragraph, decision options at the bottom (If you open the hatch, turn to page 47), prominent page number, occasional inline illustration. Branching reading logic."},
    {"name": "TV listings grid", "notes": "channels down the side × half-hour slots across, program cells with cropped titles, prime-time shading, movie star-ratings, channel abbreviations, date/region header. The grid is the whole page."},
    {"name": "karaoke songbook page", "notes": "song table: code number · title · artist · language, alphabetical or by-artist tab header, highlighted new additions, drink-specials strip at the footer. Laminated binder-page feel."},
    {"name": "betting slip", "notes": "bookmaker header, dot-matrix or handwritten selections with odds, stake and potential-return boxes, terms in microtype, serial number and barcode, time/date stamp. Narrow slip format."},
    {"name": "genealogy fan chart", "notes": "ancestor tree fanning across the page, name/dates/place in each node, connector lines, generation rings or tiers, unknowns marked with question marks. Diagram first, prose nowhere."},
    {"name": "knitting pattern chart", "notes": "symbol grid with row numbers up the side, symbol key panel, gauge note, abbreviation glossary (k2tog, ssk), yarn requirements table, garment schematic with measurements."},
    {"name": "newspaper weather map", "notes": "national map with sawtooth cold fronts and bumped warm fronts, Hs and Ls, isobars, city temperature table, five-day outlook strip, sun/moon data box. Meteorological symbology throughout."},
    {"name": "ski trail map", "notes": "painted mountain panorama, runs as colored lines rated green-circle / blue-square / black-diamond, lift lines with chair symbols, base-lodge legend, elevation stats, SKI PATROL notice."},
    {"name": "book index page", "notes": "alphabetized entries with comma-separated page references, indented subentries, See also cross-references in italics, letter-break headers, running header with page range. Two-column reference density."},
    {"name": "library checkout card", "notes": "card pocket + lined card accumulating stamped due dates in varied inks, borrower-name column (older entries in cursive), call number header, DATE DUE slip. The stamp history IS the content."},
    {"name": "diploma", "notes": "engraved institution name arched at top, Latin boilerplate, recipient name huge in script, degree and honors, signatures with titles, embossed seal. Single ceremonial sheet, NO SCROLL."},
    {"name": "quarantine placard", "notes": "QUARANTINE huge in warning type, disease name, by-order-of health authority text, penalties paragraph, date posted, official seal, weathered tacked-to-the-door feel. Public notice, single sheet."},
    {"name": "civil defense instructions", "notes": "numbered survival steps with stark pictograms, siren-signal table (what each blast pattern means), shelter symbol, IN THE EVENT OF header, government printing footer. Institutional cold-war urgency."},
    {"name": "carnival height chart", "notes": "YOU MUST BE THIS TALL ruler with a mascot pointing at the line, inch/cm gradations, ride rules list, ticket prices, warning pictograms. A vertical measurement strip dominates the composition."},
    {"name": "jukebox selection panel", "notes": "lettered/numbered title strips in mechanical rows (A1–K9), artist beneath each title, PRESS LETTER THEN NUMBER instruction plate, chrome bezel framing, price-per-play tag."},
    {"name": "paper doll sheet", "notes": "central figure + surrounding outfits with fold-tabs, dotted cut lines, scissors icon, numbered garments matched to occasions. Punch-out card-stock logic — the page is meant to be cut."},
    {"name": "scorecard", "notes": "innings/frames/holes grid awaiting pencil, player-name rows, par or handicap data rows, running-total column, rules summary in microtype, stubby-pencil tally marks. The empty grid IS the page."},
    {"name": "annotated chess game", "notes": "board diagram at the critical position, move list in algebraic notation columns, annotator's marks (!?, ??, +–), commentary paragraphs between move runs, players/event/date header. Notation-driven."},
    {"name": "dictionary page", "notes": "guide words at top corners, entries with bold headword / pronunciation / part of speech / numbered senses / bracketed etymology, thumb-index notch, tiny line-art illustrations. Two-column reference."},
    {"name": "zoo enclosure sign", "notes": "animal name + Latin binomial, range map, conservation-status scale with one level highlighted, diet/lifespan/size facts, DO NOT FEED warning, sponsor plaque line. Outdoor interpretive signage."},
    {"name": "obituary page", "notes": "portrait thumbnails beside column entries, names in bold caps with dates, survived-by paragraphs, service details, In Loving Memory display notices between columns, funeral home credits."},
    {"name": "police evidence log", "notes": "case number header, itemized evidence rows (tag # / description / where found / collected by), chain-of-custody signature table, EVIDENCE stamp, typed-report sheet feel."},
    {"name": "boarding pass", "notes": "passenger/flight/gate/seat blocks in an airline grid, gate and boarding time oversized, barcode zone, tear perforation with repeated stub data, fare-class codes, airline livery strip. One pass, NO SCROLL."},
    {"name": "bingo card", "notes": "B-I-N-G-O column headers, 5×5 number grid with FREE center, hall name and game date, dauber blots on called numbers, prize list strip. A single card dominates the page."},
    {"name": "exam paper", "notes": "instructions block (answer ALL questions, time allowed), numbered questions with mark allocations in brackets [4], answer space or ruled lines, DO NOT TURN OVER warning, examining-board header."},
    {"name": "mining claim notice", "notes": "NOTICE OF LOCATION header, claim name, metes-and-bounds description, locator names and witness signatures, county recorder stamp, weathered nailed-to-a-post sheet. Frontier legalese."},
]


def main():
    parser = argparse.ArgumentParser(description="Roll dice for an acid trip design brief.")
    parser.add_argument("--seed", help="Hex seed to reproduce a prior trip")
    parser.add_argument("--reroll", help="Comma-separated axes to re-roll (document_type, lineage, type_pairing)")
    parser.add_argument("--prior", help="JSON path of prior roll to merge with --reroll")
    args = parser.parse_args()

    if args.seed:
        seed_int = int(args.seed, 16)
    else:
        seed_int = secrets.randbits(64)

    result = roll(seed_int)

    if args.reroll and args.prior:
        prior = json.loads(Path(args.prior).read_text())
        axes = set(args.reroll.split(","))
        # type_pairing is derived from lineage tags — rerolling lineage
        # always reshuffles the pairing so the new lineage gets a pair
        # actually matched to its tags rather than a stale match.
        if "lineage" in axes:
            axes.add("type_pairing")
        keep = set(prior.keys()) - axes
        for k in keep:
            if k in ("trip_id", "seed"):
                continue
            result[k] = prior[k]

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
