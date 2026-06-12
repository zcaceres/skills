#!/usr/bin/env python3
"""acid-trip dice roller.

Picks structural rolls from OS entropy:
  - document_type — what kind of *object* the page is (one of ~30)
  - lineage       — the aesthetic lens / visual movement (one of ~80)
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
