#!/usr/bin/env python3
"""acid-trip dice roller.

Picks two structural rolls from OS entropy:
  - document_type — what kind of *object* the page is (one of ~30)
  - lineage       — the aesthetic lens / visual movement (one of ~80)

Plus a fixed URL: Wikipedia's Special:Random, which the SKILL.md fetches to
get the SUBJECT of the design. The article's actual subject, era, place, and
imagery then drive palette, typography, layout, and mood through derivation
in SKILL.md — not through additional dice rolls.

Output: a small JSON blob the SKILL.md instructions consume.
"""

import argparse
import json
import secrets
import random
from pathlib import Path


LINEAGES = [
    {"name": "Memphis Group (Milan, 1981)", "notes": "primary colors over terrazzo, squiggles, fake stone, laminate maximalism"},
    {"name": "Soviet Constructivism (Rodchenko, Moscow 1920s)", "notes": "diagonal red bars, sans-serif Cyrillic shouting, photomontage agitprop"},
    {"name": "Edo woodblock (Hokusai-era ukiyo-e, 1820s)", "notes": "flat fields, Prussian blue, woodgrain print artifacts, narrative panels"},
    {"name": "ANSI BBS art (Acid/Ice/Fire scenes, 1990–95)", "notes": "16-color blocks, CP437 glyphs, group tags, neon on black phosphor"},
    {"name": "Béton brut brutalist brochures (1960s concrete catalogs)", "notes": "raw photography of concrete, plain Akzidenz, single-color print, civic seriousness"},
    {"name": "Anti-design (Studio Alchimia, Milan 1976)", "notes": "decorative laminate, refusal of function, kitsch lifted to art, pattern collision"},
    {"name": "Y2K chrome (1998–2003 teen portals)", "notes": "frosted lozenge buttons, gel reflections, lens flares, blueberry/silver"},
    {"name": "Vaporwave (Tumblr era 2011–14)", "notes": "Helvetica Japanese, pink/teal washes, Greek busts, jpeg degradation"},
    {"name": "Amiga 500 demoscene (Future Crew, Triton)", "notes": "copper bars, sine scrollers, 320×240 mode 13h, plasma fields"},
    {"name": "Stenberg brothers film posters (Moscow, 1923–33)", "notes": "screaming red, mechanical figures, distorted perspective, hand-drawn type"},
    {"name": "Polish poster school (Tomaszewski, 1955–75)", "notes": "painterly, melancholic, hand-rendered titles, surrealist metaphor"},
    {"name": "Bauhaus Dessau period (Moholy-Nagy, 1925–28)", "notes": "primary geometry, sans-serif lower case, photogram negatives"},
    {"name": "Swiss International Style (Müller-Brockmann, post-1957)", "notes": "Akzidenz/Helvetica, mathematical grid, photographic objectivity, no italics"},
    {"name": "Push Pin Studios (Glaser & Chwast, NY 1954–75)", "notes": "Art Nouveau revival, illustrative, ornamental capitals, optimistic"},
    {"name": "Wes Wilson Fillmore posters (San Francisco, 1966–67)", "notes": "vibrating complementaries, melted lettering, no negative space"},
    {"name": "Saul Bass film titles (Vertigo through Psycho, 1958–60)", "notes": "cut paper silhouettes, kinetic type, narrative compression"},
    {"name": "Vignelli NYC subway map era (Unimark, 1972)", "notes": "geometric stylization, octal angles, color-coded systems, ruthless wayfinding"},
    {"name": "Mucha Art Nouveau (Paris 1894, theatrical posters)", "notes": "whiplash curves, halo composition, fin-de-siècle goddesses, ornamental borders"},
    {"name": "Cassandre Art Deco posters (Dubonnet, 1932)", "notes": "airbrushed geometry, machine-age glamour, three-color limit, monumental"},
    {"name": "De Stijl (Mondrian/van Doesburg, 1917–31)", "notes": "primary blocks, black grid lines, refusal of curve, utopian rectangle"},
    {"name": "Mayakovsky ROSTA windows (Moscow, 1919–22)", "notes": "stenciled propaganda, comic-panel narrative, slogan typography, agit-art"},
    {"name": "OSPAAAL Cuban tricontinental posters (Havana, 1966–75)", "notes": "silkscreen flatness, revolutionary iconography, Spanish/Arabic/English"},
    {"name": "NASA Graphics Standards Manual (Danne & Blackburn, 1976)", "notes": "the worm logo, red engineering, modular grid, bureaucratic confidence"},
    {"name": "Atari arcade flyer art (Centipede, Tempest, 1979–83)", "notes": "airbrushed sci-fi, cabinet photography, bright neon over black"},
    {"name": "Persian Safavid miniature painting (16th c. Isfahan)", "notes": "lapis and gold leaf, flattened perspective, intricate borders, courtly scene"},
    {"name": "Mughal manuscript illumination (Akbar period, 1560s)", "notes": "framed miniatures, calligraphic panels, gold dust ground, Persian script"},
    {"name": "Vilna Talmud page (1880, 4-margin commentary layout)", "notes": "central text surrounded by concentric commentary in different fonts/sizes"},
    {"name": "Medieval marginalia (Smithfield Decretals, c.1340)", "notes": "drolleries in margins, rabbits with swords, gold initials, vellum texture"},
    {"name": "Victorian playbill (1860s ransom-note typography)", "notes": "every line different face, wood type, exclamation marks, rules everywhere"},
    {"name": "Vienna Secession (Klimt/Moser, Ver Sacrum 1898)", "notes": "square format, gilded geometry, custom display alphabets, ornament-as-structure"},
    {"name": "Malevich Suprematism (1915 Black Square era)", "notes": "floating planes, off-axis composition, white void, painting as object"},
    {"name": "Hannah Höch Dada photomontage (Berlin 1919)", "notes": "scissored magazine cuts, female subjectivity, anti-bourgeois collision"},
    {"name": "Tschichold Die Neue Typographie (Munich, 1928)", "notes": "asymmetric balance, sans-serif dogma, rules as structure, DIN paper sizes"},
    {"name": "ECM Records covers (Manfred Eicher, Munich 1969–present)", "notes": "monochrome landscape photography, generous white, restraint as luxury"},
    {"name": "Blue Note jazz covers (Reid Miles, 1956–67)", "notes": "duotone portraits, oversized headlines, Trade Gothic discipline, jazz energy"},
    {"name": "4AD record sleeves (Vaughan Oliver/v23, 1985–95)", "notes": "lush photography, fragmented type, ambiguous symbolism, ink on uncoated"},
    {"name": "Factory Records (Peter Saville, FAC catalog, 1978–92)", "notes": "withheld information, references to art history, industrial materials"},
    {"name": "Raygun magazine (David Carson, 1992–2000)", "notes": "shattered grid, unreadable on purpose, layered chaos, grunge"},
    {"name": "The Face magazine (Neville Brody, 1981–86)", "notes": "custom alphabets, ornamental hand-drawn, post-punk editorial"},
    {"name": "Emigre magazine (Rudy VanderLans, post-Mac 1984)", "notes": "bitmap fonts, early Macintosh, designer-as-publisher"},
    {"name": "WIRED launch issues (1993–95 fluorescent paper era)", "notes": "neon ink, color-shift paper, manga-influenced grid, cyber-utopian"},
    {"name": "Tamil film hand-painted posters (Madurai, 1970s)", "notes": "wall-sized acrylic portraits, saturated skin tones, painterly flames"},
    {"name": "Bollywood hand-painted hoardings (1960s, Diwakar Karkare)", "notes": "stacked heroes, distorted proportions, gold scripts, melodrama"},
    {"name": "Ghanaian mobile cinema posters (1980s, acrylic on flour sacks)", "notes": "imagined movie scenes from films never seen, lurid violence, hand-lettered"},
    {"name": "Italian giallo film posters (Argento/Bava, 1970s)", "notes": "blood red, lone figure, fragmented body parts, lurid set pieces"},
    {"name": "North Korean Mansudae diplomatic gift art", "notes": "socialist realism, smiling workers, vermillion banners, idealized landscape"},
    {"name": "Iranian revolutionary silkscreens (1979 post-Shah)", "notes": "stenciled fists, Farsi calligraphy, deep green and red"},
    {"name": "Mexican lotería cards (Don Clemente, 1887)", "notes": "tarot grid, folk illustrations, La Sirena and El Diablito, frame around each"},
    {"name": "Whole Earth Catalog (Stewart Brand, 1968–74)", "notes": "tools-for-living, typewriter copy, hand-drawn diagrams, hippie pragmatism"},
    {"name": "Mondo 2000 zine (1989–98)", "notes": "cyberdelic, full-bleed psychedelia over interview text, RU Sirius weirdness"},
    {"name": "Boing Boing print zine (1988–95)", "notes": "Mark Frauenfelder hand collage, cyberpunk lo-fi, pre-blog blog"},
    {"name": "2600 Hacker Quarterly (early issues, 1984–94)", "notes": "blue text on cream, ASCII diagrams, phone phreaking aesthetics"},
    {"name": "Geocities personal home pages (1996–2001)", "notes": "tiled backgrounds, animated GIFs, Comic Sans, under-construction signs"},
    {"name": "Webring graphics (1998 spinning gifs)", "notes": "best-viewed-in banners, 88x31 button collection, navigation as social ritual"},
    {"name": "Windows 95 chrome (gray dialog, Marlett bitmap)", "notes": "system gray, raised/sunken bevels, MS Sans Serif, modal everything"},
    {"name": "Teletext (Ceefax/Prestel, 1976–2012)", "notes": "40-column block characters, six colors over black, news as ASCII art"},
    {"name": "VHS B-movie cover art (Cannon Films, 1985–92)", "notes": "airbrushed muscle, exploding helicopters, neon title treatments, lurid"},
    {"name": "NASA mission patches (Apollo through Shuttle)", "notes": "circular composition, embroidered look, crew names around rim, cosmic seriousness"},
    {"name": "National Geographic 1970s photo essay layout", "notes": "yellow rectangle, full-bleed photography, caption-as-prose, Bodoni titling"},
    {"name": "Italian Domus magazine (Gio Ponti, 1948–79)", "notes": "architectural confidence, oversized photography, modernist Italian typography"},
    {"name": "Skateboarder magazine (Stecyk DogTown, 1975)", "notes": "halftone action shots, hand-lettered headlines, surf-punk crossover"},
    {"name": "Thrasher magazine (Mörizen Föche, 1981–86)", "notes": "gnarly stencil type, anti-establishment energy, raw photocopy aesthetic"},
    {"name": "Riot grrrl zines (Olympia/DC, 1991–95)", "notes": "xerox staple, hand-cut letters, urgent confession, marker on notebook paper"},
    {"name": "Polish jazz album covers (Polskie Nagrania Muza, 1960s)", "notes": "Eastern Bloc modernism, abstract figure, limited four-color, behind-curtain cool"},
    {"name": "East German DDR Verlag book covers", "notes": "muted earth tones, Cyrillic-adjacent display, woodblock illustration, austerity"},
    {"name": "South African resistance posters (Medu Art Ensemble, 1979)", "notes": "screen-printed solidarity, hand-cut stencils, communal authorship"},
    {"name": "IKEA catalog 1995 (Scandinavian beige era)", "notes": "blonde wood, generous white, helpful arrows, family-friendly modernism"},
    {"name": "J. Peterman catalog (1989, watercolor + romance)", "notes": "no photography, only watercolor sketches, narrative product descriptions"},
    {"name": "Restoration Hardware Source Book (oversized 2010s)", "notes": "sepia photography, broadsheet format, weight as luxury signal"},
    {"name": "LIFE magazine photo essay (1950s 4-page spread)", "notes": "rotogravure photography, Bodoni headlines, white framing, civic narrative"},
    {"name": "WGBH Boston public TV identity (1971, Chermayeff & Geismar)", "notes": "kinetic 3-letter mark, primary colors, broadcast modernism"},
    {"name": "Sears Wish Book 1979 toy section", "notes": "catalog grid, prices in bursts, kid-eye photography, fluorescent lighting"},
    {"name": "Early HTML 1.0 default (Times New Roman + #0000EE links)", "notes": "system serif, default blue/purple links, gray background, document-as-page"},
    {"name": "K-records / Calvin Johnson DIY (Olympia, 1982)", "notes": "rubber stamp logos, marker on cardstock, anti-corporate music packaging"},
    {"name": "Soviet children's book illustration (Lebedev, 1930s)", "notes": "flat color planes, simplified forms, propaganda-meets-Suprematism for kids"},
    {"name": "Hot Rod magazine pin-stripe (Big Daddy Roth, 1959)", "notes": "Rat Fink leering, airbrushed flames, custom-shop typography, drag-strip culture"},
    {"name": "Surfer magazine (Drew Kampion design, 1971)", "notes": "saltwater photography, generous editorial type, counterculture sincerity"},
    {"name": "Phrack ASCII art newsletter (1985–present)", "notes": "monospaced ASCII headers, technical articles, hacker ethos, plain text only"},
    {"name": "Pruitt-Igoe demolition press kit (St. Louis, 1972)", "notes": "newsprint, modernist failure documented, civic-grade type, ruin-as-symbol"},
    {"name": "Studio Dumbar Dutch transport identity (1980s NS railway)", "notes": "playful systems, splatter and grid coexist, color-coded service lines"},
    {"name": "Wolfgang Weingart New Wave (Basel, late 1970s)", "notes": "broken Swiss grid, layered type, exposed printing process, pedagogical rebellion"},
    {"name": "Karel Martens (Dutch experimental, 1970s–present)", "notes": "found materials as printing matrix, color theory exercises, OASE journal"},
]


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


# Wikipedia's random-article endpoint. Server-side redirects to a fresh article
# on every fetch, drawing from ~6M+ entries. This is the SUBJECT of the design —
# the article handed to the LLM as the basis from which palette, typography,
# layout, and mood are derived in the SKILL.md instructions.
WIKIPEDIA_RANDOM = "https://en.wikipedia.org/wiki/Special:Random"


def roll(seed_int: int) -> dict:
    rng = random.Random(seed_int)

    return {
        "trip_id": f"{seed_int:016x}"[-6:].upper(),
        "seed": f"{seed_int:016x}",
        "document_type": rng.choice(DOCUMENT_TYPES),
        "lineage": rng.choice(LINEAGES),
        "subject_url": WIKIPEDIA_RANDOM,
    }


def main():
    parser = argparse.ArgumentParser(description="Roll dice for an acid trip design brief.")
    parser.add_argument("--seed", help="Hex seed to reproduce a prior trip")
    parser.add_argument("--reroll", help="Comma-separated axes to re-roll (document_type, lineage)")
    parser.add_argument("--prior", help="JSON path of prior roll to merge with --reroll")
    args = parser.parse_args()

    if args.seed:
        seed_int = int(args.seed, 16)
    else:
        seed_int = secrets.randbits(64)

    result = roll(seed_int)

    if args.reroll and args.prior:
        prior = json.loads(Path(args.prior).read_text())
        keep = set(prior.keys()) - set(args.reroll.split(","))
        for k in keep:
            if k in ("trip_id", "seed"):
                continue
            result[k] = prior[k]

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
