---
name: acid-trip
description: Generate frontend designs from random rolls — a Wikipedia article (subject), a document_type, and a lineage. Palette / type / layout are DERIVED from subject × lineage. Invoke via /acid-trip.
argument-hint: "[--react | --paper]"
disable-model-invocation: true
---

# Acid Trip

A design ritual driven by entropy from two sources:

1. **Wikipedia's `Special:Random` endpoint** — server-side picks one of ~6M articles. This is the **subject** of the design.
2. **A local `/dev/urandom` roll** (via `secrets.randbits`) picks two structural constraints from curated lists: `document_type` (what kind of object the page is) and `lineage` (the aesthetic lens applied on top).

From those three rolls, you DERIVE the rest — palette, typography, layout, mood — by reading the article and folding the lineage's signature aesthetic over the article's natural one. Cross-axis tension lives in the collision between **subject** (whatever Wikipedia handed us) and **lineage** (a deliberately picked visual lens that may or may not fit).

You cannot fake the dice. The script must run.

## When to use

- `/acid-trip` — Wikipedia article becomes the design subject. Pure trip.
- `/acid-trip --react`, `/acid-trip --paper` — same trip, different output mode.
- Default output is HTML.

## The two phases

This skill always runs as **Trip → pause → Realize**. Do not collapse them.

### Phase 1 — The Trip

1. **Roll the dice.** Run:
   ```bash
   python3 ${CLAUDE_SKILL_DIR}/scripts/roll.py > /tmp/acid-trip-latest.json
   cat /tmp/acid-trip-latest.json
   ```
   The script outputs `trip_id`, `seed`, `document_type`, `lineage`, and `subject_url` (always Wikipedia Special:Random).

2. **WebFetch the subject URL.** Use a prompt like:

   > *"Summarize the subject in 2 sentences. List: title, era/date, place, 3 specific proper nouns, dominant colors mentioned or visible in the article's imagery, the article's emotional register, and 1 surprising fact. Also return the final article URL after redirect."*

   Capture the final URL (after `Special:Random` redirects) — you'll need it for the provenance stamp.

3. **Derive the remaining axes** from the article and the rolled lineage. This is not a free invention — it is a *blend*:

   - **palette** — start from the article's natural palette (era, place, mentioned colors, photograph hues). Then blend with the lineage's signature palette as an **antagonist accent** that fights the natural one. The disruption is the point. Resist the gravitational pull toward limestone / oxblood / mountain-fog as a default "historical European" reading — *look at the article's actual images and named colors*; if it gives you Sahel ochre, Arctic frost-blue, Cantonese vermillion, or factory-canteen formica green, use those.
   - **typography** — use the rolled `type_pairing.display` and `type_pairing.body` as the floor. The pair is already matched to the lineage's typographic temperament via tags, so don't override it with the LLM's instinct for "period-correct" fallbacks. Let the article *modulate* the pair instead — weight, casing, tracking, italics, mixing in a third face for ornaments or non-Latin script. Substitute only when a face is not web-available, and note the substitution in the provenance stamp. If the article's era genuinely clashes with the rolled pair (a 17th-century article + a pixel pair), that *is* the article × lineage tension — build it; do not soften.
   - **layout** — pick a visual treatment modifier that either reinforces or destabilizes the document_type. Options to choose from (not a fixed list — invent if needed): *broken grid, isometric projection, Swiss centered, heavy-left/right asymmetric, diagonal flow, full-bleed singular, terminal/CRT overlay, scrolljacked panels, stamped repetition, rotated 90°*. Justify the choice in the brief.
   - **mood** — two emotions in conflict that capture the article-vs-lineage tension. A subject of gravity (war, death, religion, ruin) paired with a frivolous lineage produces moods like "sober × decorative" or "grave × giddy." A trivial subject paired with a monumental lineage produces "petty × reverent." Name them and explain the collision.

   The derived axes are NOT a free invention. Each must trace clearly to either the article or the lineage. If you can't name *why* a palette or font was picked, you're regressing to LLM-generic — try again with a more specific extraction from the article.

4. **Present the brief** as a styled text box. Order: subject, then rolled axes, then derived axes. Example shape:

   ```
   ╭─ ACID TRIP #68B8F5 ─────────────────────────────────────────────
   │  subject     : Murmansk Oblast
   │                Arctic Russian region above the 69th parallel;
   │                concrete port city, polar night, Khrushchyovkas,
   │                naval shipyards. Tone: hard, luminous, far-north.
   │
   │  ─────────── rolled ─────────────────────────────────────────────
   │  document    : lotería card grid — 4×4 panels, each illustrated
   │  lineage     : 4AD record sleeves (Vaughan Oliver/v23, 1985–95)
   │  type pair   : Trade Gothic Bold Condensed × Trade Gothic
   │                (matched to 4AD's editorial restraint via tags)
   │
   │  ─────────── derived from subject × lineage ─────────────────────
   │  palette     : Murmansk frost-blue + concrete grey + sodium-lamp
   │                amber + a single 4AD ink-bleed magenta (antagonist)
   │  layout      : strict 4×4, no marketing structure around it —
   │                each cell is a named place/object from the region
   │  mood        : monumental × intimate — Soviet bulk inside the
   │                hand-illustrated card frame
   ╰─────────────────────────────────────────────────────────────────
   
   Type "build it" to realize, or reroll:
     reroll document | reroll lineage | reroll type_pairing | reroll subject | reroll all
   ```

5. **STOP.** Do not proceed to Phase 2 in the same turn. The user approves, rerolls, or manually overrides.

### Re-rolling

Four things can be rerolled — three local rolls and the Wikipedia subject:

```bash
# Re-roll document_type, lineage, or type_pairing (preserves the others):
python3 ${CLAUDE_SKILL_DIR}/scripts/roll.py \
  --reroll "<document_type|lineage|type_pairing>" \
  --prior /tmp/acid-trip-latest.json \
  > /tmp/acid-trip-latest.json

# Note: rerolling lineage automatically rerolls type_pairing too,
# since the pairing is matched to the lineage's typographic tags.

# Re-roll subject: just WebFetch the subject_url again (Special:Random gives a new article).
# Then re-derive palette/layout/mood from the new article (the rolled type_pairing stays).

# Re-roll all: run roll.py with no flags + refetch Wikipedia.
```

If the user manually overrides a derived axis ("make the palette deep-sea anglerfish instead"), honor the override and note it in the provenance stamp.

### Phase 2 — Realize

Triggered when the user signals approval (build it / go / ship it / yes).

1. **Pick the output mode:**
   - `--html` (default): write `acid-trip-<trip_id>.html` to the cwd. Single self-contained file: inline `<style>`, web fonts via `@import` from Google Fonts.
   - `--react`: write `acid-trip-<trip_id>.tsx` to the cwd. Assume Tailwind + `motion` library are available.
   - `--paper`: call paper MCP tools (`get_basic_info` first, then `write_html` for visual groups, `update_styles` for tweaks, `finish_working_on_nodes` when done). Stamp goes on a small text node beside the artboard.

2. **Plan visual assets.** Look at the subject, document_type, lineage, and derived palette to decide what imagery is needed.

   **Delegate to nano-banana** for:
   - Hero illustrations / portraits / scenes related to the subject
   - Decorative ornaments specific to the lineage
   - Textures (paper grain, halftone, scan artifacts, risograph, concrete, etc.)
   - Patterns too tedious to hand-author (suzani embroidery, ANSI mosaics, etc.)

   **Do NOT delegate** (handle in CSS / SVG / Unicode directly):
   - Simple geometric shapes — squares, lines, circles
   - Trivial UI glyphs (×, →, ✓) — Unicode or hand-authored SVG
   - Solid colors, gradients, shadows — pure CSS
   - Text — that's the rolled font pair

   Aim for 1–5 generated assets per design. Restrained lineages may legitimately need zero.

3. **Generate the assets via nano-banana.** Create an asset folder next to the output file, then call the generator once per asset. Every prompt must bake in the **subject** (so the image depicts something real from the article) AND the **lineage** (so the aesthetic is consistent):

   ```bash
   mkdir -p ./acid-trip-<trip_id>-assets

   bun run ~/.claude/skills/nano-banana-generator/generate.ts \
     "<concrete subject from the Wikipedia article>, depicted in the visual style of <rolled lineage>, using a palette of <derived palette hex codes or hints>" \
     --output ./acid-trip-<trip_id>-assets/hero.png \
     --width 1200 --height 800 \
     --model nano-banana-pro
   ```

   Use `nano-banana-pro` for hero/signature pieces, plain `nano-banana` for textures and ornaments, `--transparent` for ornaments.

   If `GEMINI_API_KEY` is not set: stop and tell the user. Offer either (a) they set the key and you regenerate, or (b) you build a typography-and-CSS-only design — noted explicitly in the provenance stamp. Do not silently substitute external placeholder URLs.

4. **Build the design.** Production-grade, not a sketch. The page derives from three sources in this dominance order:

   - The **subject** (the Wikipedia article) — its actual content, names, dates, places. Copy in the page should reference real facts from the article. This is what gives the design specificity and prevents LLM-generic placeholders.
   - The **document_type** — the structural object the page IS. If the roll says "phonebook page," the page IS a two-column alphabetized listing — not a search interface around one. If the roll says "lotería card grid," the page IS sixteen labeled panels — not a marketing site with cards on it.
   - The **lineage** — the aesthetic lens. Implement details a specialist would recognize: actual Memphis Group squiggles, actual Polish poster melancholy, actual ANSI block characters. No surface-level pastiche.

   The **derived axes** (palette, typography, layout, mood) carry the article × lineage tension into every visual decision:
   - Palette uses CSS variables; one color dominates 60%+; antagonist accents from the lineage are deliberately placed.
   - Typography is the derived pair; if a face is not web-available, substitute the closest free alternative AND note the substitution in the provenance stamp.
   - Layout is the spatial doctrine — broken grid, isometric, full-bleed, etc.
   - Mood permeates copy tone, animation easing, image choice, micro-interaction timing.

   **Forbidden default anatomy.** Unless the rolled `document_type` explicitly calls for it, do NOT produce a page with this skeleton:

   ```
   sticky nav with logo + links + CTA  →  hero with headline + 2 CTAs  →
   3-or-4 column feature grid  →  metrics row  →  team grid  →
   testimonials  →  pricing tiers  →  big CTA  →  footer with link columns
   ```

   This is the SaaS-landing-page anatomy. The document_type is the actual page skeleton; an article rendered as a *phonebook page* is a phonebook page, not a homepage with phonebook-card decoration.

   Page length follows the document type. Posters, labels, playbills, departure boards, recipe cards, and album covers occupy a single viewport. Manuscripts, transcripts, phonebooks, catalogs, and lineup posters can be long. Don't pad short documents with invented sections.

5. **Self-critique pass. Mandatory.** Before stamping provenance:

   **(a) Audit.** Capture the current state — `get_screenshot` the artboard (Paper) or read the rendered file (HTML/React). Walk through the **Hard blacklist** and the **Forbidden micro-anatomy** lists item by item and ask, for each: *does the current build contain this?* Be specific. Name the section, quote the element. Examples of good audit notes:

   > "Yes — there's a three-box stat strip in the headliner: DATE / VENUE / FORMAT, each with a mono-caps label + display value + mono caption. That's the label/value/description triad too. Two violations in one block."
   >
   > "Yes — there's an italic explainer paragraph at the top of the header: *'A complete six-card record of a small Anglican diocese...'* — that's the meta-caption cliché."
   >
   > "Yes — the provenance stamp at the bottom is a centered mono code block taking ~140px of vertical space. It's reading as a design element rather than a credit."

   The LLM tendency is to glaze past its own work and declare it clean. Don't. Look at the screenshot like a stranger would. Most first-pass builds violate ≥3 items because the clichés ride in via muscle memory under fancy lineage skins.

   **(b) Rebuild the violations.** For each named violation, *restructure* — don't tweak. A few sample moves:
   - Three-box stat strip → embed values in flowing copy, oversize one and inline the others as type, run them vertically up the edge with no boxes, or fuse them with the headline.
   - Label / value / description triad → drop the label, drop the description, or fuse the value into prose.
   - Italic explainer paragraph → delete it. The page is the page.
   - Cards-within-cards bento → rebuild each card around the document_type's *native* anatomy. A real trading card has a portrait, a name, a stats plate, and a prose biography — not a marketing-card header/photo/table/paragraph/footer.
   - Prominent provenance code block → shrink to a single line of fine print in a corner.

   If after one restructure attempt the cliché survives in a transmuted form, *name that too* in your audit notes. Sometimes the document_type itself encodes a grid (lotería card grid, departure board) and you cannot eliminate "things arranged in a grid" — but you can still kill the label/value/description triad inside each cell. Be honest about where the cliché remained and why.

   Two passes max. After the second rebuild, declare done with whatever caveats remain — surfacing the remaining violations in the provenance stamp.

6. **Match implementation complexity to the aesthetic.** Maximalist lineages (Wes Wilson, Raygun, Memphis, Bollywood hoardings) need elaborate code — layered animations, decorative layers, staggered reveals, custom cursors. Restrained lineages (ECM, Swiss, Agnes Martin) need precision — pixel-perfect grids, baseline alignment, near-imperceptible motion, generous breathing room, possibly zero generated imagery. Elegance is execution, not minimalism.

7. **Stamp the provenance** at the top of the file (HTML/JSX comment, or text node for Paper):

   ```html
   <!-- ACID TRIP #68B8F5
     seed:        9c2f1a7e3b1668b8f5
     subject:     Murmansk Oblast
     subject_url: https://en.wikipedia.org/wiki/Murmansk_Oblast
     document:    lotería card grid
     lineage:     4AD record sleeves (Vaughan Oliver/v23, 1985–95)
     type pair:   Trade Gothic Bold Condensed × Trade Gothic
                  (rolled — matched to 4AD's editorial/restrained tags)
     ───── derived from subject × lineage ─────
     palette:     Murmansk frost-blue + concrete grey + sodium-lamp amber
                  + 4AD ink-bleed magenta (antagonist)
     layout:      strict 4×4 lotería grid — each cell a real place/object
     mood:        monumental × intimate
     ───────────────────────────────────────────
     assets:      acid-trip-68B8F5-assets/{shipyard.png, polar-night.png}
     surviving:   [none] OR list of clichés that survived the critique pass
                  e.g. "grid arrangement (encoded by document_type) — could not
                  be eliminated without abandoning the rolled lotería anatomy"
     reproduce:   python3 ${CLAUDE_SKILL_DIR}/scripts/roll.py --seed 9c2f1a7e3b1668b8f5
                  (note: subject_url is refetched fresh — to reproduce the SUBJECT,
                   visit the captured subject_url directly)
   -->
   ```

   If no imagery was generated, write `assets: none — pure CSS/typography design`.

8. **Extract the design system. Mandatory, every trip.** Once the build is critiqued and stamped, document what was actually built as a standardized design system. This is an *extraction*, not an invention — read the finished artifact (the HTML/TSX file, or `get_computed_styles` on the Paper nodes) and record the values that actually shipped, including font substitutions and user overrides.

   **The structure is standard; only the values are trippy.** The trip's randomness (subject, document_type, lineage) determines the *content* of the design system — never its *shape*. No themed section names, no in-character prose, no manifesto paragraphs, no extra sections. A giallo-poster trip and an IKEA-catalog trip produce documents with the identical skeleton.

   Write two sibling files next to the artifact. First, `acid-trip-<trip_id>-design-system.md` — exact sections, exact order, nothing added or removed:

   ```markdown
   # Design System — ACID TRIP #68B8F5

   <One plain-prose paragraph, ≤80 words: the subject × lineage collision,
   the document_type, and the mood pair. Neutral documentary voice — the
   lineage's voice stays out of it.>

   ## Palette
   | Token | Hex | Role |
   |---|---|---|
   | `--frost-blue` | `#A9C4D4` | dominant ground (60%+) |
   | `--concrete` | `#8B8C88` | structure, rules, frames |
   | `--ink-magenta` | `#C2185B` | antagonist accent — deliberate placements only |

   ## Typography
   | Role | Face | Size / Weight / Spacing | Notes |
   |---|---|---|---|
   | Display | Trade Gothic Bold Condensed | clamp(2.5rem, 7vw, 6rem) / 700 | substituted: Oswald |
   | Body | Trade Gothic | 1.0625rem / 400 / 1.55 lh | substituted: PT Sans |

   ## Spacing & Grid
   <Base unit, scale steps, column structure, breakpoints, and the layout
   doctrine — plain bullets.>

   ## Motion
   <Durations, easings, what animates and what never animates.>

   ## Components & Motifs
   <The reusable pieces the artifact actually contains — rules, frames,
   ornaments, list treatments, generated-asset usage. One bullet each,
   naming the CSS/technique used.>
   ```

   Every value must be traceable to the artifact: hex codes from the actual CSS variables, faces from the actual `@import`, durations from the actual keyframes. If a section is genuinely empty (a static poster has no motion), write `None.` — do not invent content to fill the section.

   Second, `acid-trip-<trip_id>-tokens.json` — the same values, machine-readable. Keys are the kebab-case token names from the markdown tables; omit empty groups rather than writing nulls:

   ```json
   {
     "trip_id": "68B8F5",
     "color": { "frost-blue": "#A9C4D4", "concrete": "#8B8C88", "ink-magenta": "#C2185B" },
     "font": {
       "display": { "family": "Oswald", "weight": 700 },
       "body": { "family": "PT Sans", "weight": 400 }
     },
     "type-scale": { "display": "clamp(2.5rem, 7vw, 6rem)", "body": "1.0625rem" },
     "space": { "base": "8px", "scale": [8, 16, 24, 40, 64] },
     "motion": { "duration": { "reveal": "600ms" }, "easing": { "default": "cubic-bezier(0.16, 1, 0.3, 1)" } }
   }
   ```

   **Paper mode:** additionally lay the design system out as a spec sheet on a new artboard beside the design — palette swatches with hex labels, type specimens at actual size, a spacing scale, motif samples — following the same five-section order. Still write the `.md` and `.json` files.

9. **Open the file** (for HTML/React) with `open` if the user is on macOS. For Paper, call `get_screenshot` after `finish_working_on_nodes`.

## Hard blacklist

These appear nowhere in any acid-trip output unless the rolled lineage explicitly demands them (e.g., Y2K chrome legitimately uses gradients on white):

- ❌ Inter, Geist, Space Grotesk, SF Pro, Roboto, Arial, system-ui, sans-serif fallback
- ❌ Purple → blue gradient on white background
- ❌ Glassmorphism / backdrop-filter blur as a primary effect
- ❌ Default Tailwind slate / zinc / neutral / gray scales as the dominant palette
- ❌ Bento grids
- ❌ Lucide, Heroicons, Tabler icon sets — use custom SVG or symbols from the lineage
- ❌ Centered hero + two CTAs + soft drop shadow + rounded card layout
- ❌ "Gradient orbs" / blurred radial decorations
- ❌ Generic stock photography vibes
- ❌ External placeholder services (`picsum.photos`, `placehold.co`, `unsplash.it`, `dummyimage.com`)
- ❌ Hand-drawn SVG illustrations beyond simple geometric forms — delegate to nano-banana
- ❌ Emoji standing in for proper iconography
- ❌ LLM-generic placeholder content ("Acme Corp," "John Doe," "Lorem ipsum") — pull real names, dates, places from the Wikipedia article

## Forbidden micro-anatomy (kill the cliché at every scale)

The document_type axis prevents SaaS landing-page anatomy at the *page* level. But SaaS micro-anatomy keeps smuggling itself back in inside the rolled document. **The cliché has to be killed at every scale.** None of the following appear unless the rolled lineage + document explicitly demand them:

- ❌ **Three-box stat rows / metric strips.** "DATE / VENUE / FORMAT" as three side-by-side colored boxes is a SaaS marketing reflex (uptime % · users · revenue). Real posters, notebooks, recipe cards, and trading cards do NOT use this layout. If you find yourself building three little boxes in a row with a label, value, and caption, stop — restructure as flowing copy, varied-size type, or a single grand element.
- ❌ **The label / value / description triad.** Tiny mono-caps label → big bold value → small mono description is the Linear/Vercel/Resend dev-tool signature. The rolled typography axis varied across designs but this triad keeps reassembling. Vary the relationship between data and label — embed values in prose, use vertical type, oversize a date and inline a venue, scatter measurements at angles.
- ❌ **Italic "explainer" paragraphs near the top.** "A complete six-card record of a small Anglican diocese…" — that meta-caption explaining what the page is to the viewer is the AI-design impulse to be helpful. Real lab notebooks don't explain themselves. Real Stenberg posters don't apologize. Real trading card sheets don't preview their contents. **The page is the page.**
- ❌ **Cards-within-cards bento.** A 3×2 grid where each cell has a top-color-band header, image, label/value table, body paragraph, and footer is a SaaS feature-card anatomy repeated six times — even if the *container* is framed as a "trading card sheet" or "lineup poster." If the rolled document_type encodes repeated units (a card grid, a lineup), the *inside* of each unit must follow that document's native anatomy, NOT marketing-card anatomy.
- ❌ **Prominent provenance stamps styled as code blocks.** A multi-line `<!-- ACID TRIP ... -->` comment block laid out as a centered design element is the indie-tech "look at me, I'm a code artifact" cliché (val.town, Linear, Vercel landing pages). The stamp must exist for reproducibility, but it should sit small, in a corner, in fine print — not as a graphic element.

The pattern: AI design's structural reflex is "split content into small uniform boxes, label them, and stack them." Acid-trip designs must resist this reflex *inside* the rolled document, not just at the page level. A festival poster has type scattered at angles and varied sizes; it does not have a metrics row. A notebook page has flowing handwritten annotations; it does not have feature cards. A trading card has prose biography and an info plate; it does not have a label-value-description triad sub-grid.

If unsure: ask whether a real historical instance of the rolled document_type would have this layout move. If a 1925 Stenberg poster wouldn't have three side-by-side stat boxes, neither does the acid-trip version.

## Rules of the ritual

- **Never fake the dice.** Always shell out to `roll.py` and WebFetch Wikipedia. Do not hand-pick a "better" article or lineage.
- **Never soften the brief.** If the article is grim and the lineage is silly, the design is "grim × silly." Build that. Do not reach for a more comfortable pairing.
- **Never collapse the phases.** Always pause after the brief.
- **Never strip the provenance stamp.** Capture the actual Wikipedia URL after redirect.
- **Never invent placeholder content when the article contains real content.** Use real names, dates, places, and quotes from the article. Generic placeholders ("Sample text," "Company Name") indicate you didn't read the article carefully enough.
- **Never apologize for the design in the page itself.** No "this design uses…" copy in the output. The page just is what it is.
- **Never skip the self-critique pass.** Single-pass execution is lazy and clichés ride in via muscle memory under fancy lineage skins. Audit your own build against both forbidden lists, name violations specifically, and restructure them before stamping. If a cliché survives one rebuild attempt, declare it honestly in the provenance stamp rather than pretending it isn't there.
- **Never let the trip restructure the design system.** The randomness drives the *values*; the document's skeleton is fixed — the five sections, in order, nothing else. If the design system grows themed headings, in-character prose, or extra sections, delete them and re-extract.

## Examples

**User:** `/acid-trip`
→ Run `roll.py`, WebFetch the Wikipedia article, derive the four other axes from the article + rolled lineage, present brief, pause.

**User (after seeing brief):** `reroll lineage`
→ `roll.py --reroll lineage --prior /tmp/acid-trip-latest.json`, re-derive the four derived axes from the same subject + new lineage, present updated brief, pause.

**User:** `reroll subject`
→ WebFetch `Special:Random` again, re-derive everything from the new article + same rolled document_type & lineage, present, pause.

**User:** `build it`
→ Realize phase: plan assets, generate 2–4 PNGs via nano-banana into `./acid-trip-<id>-assets/`, build `acid-trip-<id>.html` referencing those assets, stamp provenance with subject_url + reproduce command, extract the design system into `acid-trip-<id>-design-system.md` + `acid-trip-<id>-tokens.json`, open with `open`.

**User:** `/acid-trip --paper`
→ Same flow, but Phase 2 builds directly into the active Paper canvas via MCP tools.
