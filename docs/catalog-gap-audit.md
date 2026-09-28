# Catalog gap audit — 2026-09-27

Source: production (read-only), all **97 active categories**, not just the 54 lists in `catalog/lists/*.json` (the rest came from seed data, the in-app Content factory and older importers). Production has 11 profiles, so completion counts below are signals, not statistics.

## Status (2026-09-28)

- **Issue 1 fixed:** lists are curated by default; 53 existing lists backfilled.
- **Issues 2–3 fixed:** 6 duplicate lists retired; groups merged (food→food-drink, lifestyle→lifestyle-hobbies, entertainment→film-tv, geography→travel); new History & Politics group; 3 orphan types deleted.
- **Batch 1 published** (`catalog/lists/2026-09-batch-09-compatibility.json`): Perfect First Date, Ideal Date Night In, Green Flags (new Dating & Relationships group), Your Role at a Party, Ideal Sunday Morning, Late-Night Snack, Travel Style, Favorite Time of Year — each with a picked cover.
- **Next batches:** still missing — home & living, nightlife, humor, values, pets, money habits, wellness; social habits and routines have one list each.

## Fix before generating more: 3 structural issues

**1. Sub-genre lists offer the entire type (quality bug).** The JSON importer creates `FILTERED` categories with no required tags and no curated pool, so the choices are *every* entity of the type:

| List | Offers | Should offer |
|---|---|---|
| Top Documentaries, Top Anime Movies, Favorite Comedy / Action / Animated Movies, Top Sci-Fi Movies, Top 90s Movies, Top Movie Soundtracks | all 77 movies | that sub-genre |
| Favorite Indie Bands, Top R&B Artists, Favorite Pop Artists, Top Hip Hop Artists (2nd copy) | all 63 artists | that genre |
| Favorite Political Podcasts | all 26 podcasts | political ones |
| Favorite Sci-Fi Shows | all 42 TV shows | sci-fi |

Only 3 categories have a tag filter (Top 90s Bands, one Top Hip Hop Artists, EduTubers). Fix: have `ListImporterService` create **`CURATED`** categories whose pool is the list's own `values` (the Content factory already publishes this way), then backfill the existing ones from their JSON values. Until then, every narrow list generated through the pipeline has this bug.

**2. Duplicates** — merge or retire one of each:
- Top Hip Hop Artists ×2 (one tag-filtered, one not)
- Favorite Comedians / Top Comedians
- Top Athletes / Top Athletes of All Time
- Sports Teams / Favorite Sports Franchises
- Best Pizza Toppings (`pizza-topping`) / Favorite Pizza Toppings (`food`)
- Top Streaming Services / Most Used Streaming Services
- Top Podcasts / Favorite Political Podcasts (fine once #1 is fixed)

**3. Duplicate groups** — `food` + `food-drink`, `lifestyle` + `lifestyle-hobbies`, `entertainment` + `film-tv`, `geography` + `travel` (empty). CLAUDE.md says to run `apps/worker/src/scripts/merge-category-groups.ts` against production; it hasn't been. Also misfiled: *US Presidents* and *Historical Figures* sit in **Craft & Hobbies**.

## Coverage

**Heavily covered — stop generating here.** Media consumption is **55 of 97 (57%)**: movies/TV 24 (9 of them on the same 77-movie pool), music 14, creators/memes 7, podcasts 2, gaming 4, books 4.

**Moderately covered:** Food & drink 11 (but no home cooking, beer, wine, tea), Sports 5, Lifestyle/hobbies 12 (gym, cars, dog breeds, sneakers, cities, interior design, weekend vibe), Tech 4.

**Thin:** Career 3 (all ICON), Travel 2 (destinations, national parks — no travel *style*), Tabletop 1.

**Missing entirely — generate here:**

| Domain | Why it matters for Datememe |
|---|---|
| **Dating & relationships** | It's a dating app with zero lists about dating: ideal first dates, date-night spots, what makes someone attractive, relationship must-haves |
| **Social habits** | How you are with people: party role, texting style, group-chat behavior, how you make plans |
| **Daily routines** | Morning routine, sleep schedule, late-night snack, commute — strong real-life compatibility signal |
| **Home & living** | Ideal home, living situation, houseplants, cleaning style |
| **Nightlife & going out** | Bar types, night-out plans, karaoke songs, drinks (beer/wine) |
| **Travel style** | Trip types, travel habits, airport behavior — not just destinations |
| **Humor** | Types of humor, funniest sitcom moments — currently only comedians and memes |
| **Values & priorities** | What matters most, dealbreakers-positive ("green flags"), life goals |
| **Pets & animals** | Beyond dog breeds: cats, pet names, dream pet |
| **Seasons & holidays** | Favorite season, holiday, holiday traditions |
| **Money & spending** | Splurges, savings style (ranked options, not judgments) |
| **Wellness & self-care** | Unwinding, self-care rituals |

## Rules for the next batches

- **5–10 lists per batch, only from the missing domains above**, until media is under ~40% of the catalog.
- **Prefer lists that reveal compatibility** (routines, social style, dating, values) over trivia-knowledge lists.
- **Values must be concrete choices people disagree on.** "Sunrise hike" vs "Sleep in" beats "Good communication" (everyone agrees). Aim for 10–15 values, at least 8 (importer minimum).
- **These domains are mostly abstract** (`isAbstract: true`, ICON media), so they won't need Wikidata identities or media review — batches will publish fast.
- **Check the existing types first** (`hobby`, `weekend-vibe`, `pet-peeve`, `comfort-food`, `cocktail`) before declaring a new one with `createEntityType`.
- Fix issue #1 before generating any *narrow* list of an existing concrete type (e.g. "Favorite Horror Movies"), or it will offer every movie.

## Suggested first batch (8, all in missing domains)

1. Perfect First Date — *dating*
2. Ideal Date Night In — *dating*
3. Green Flags — *dating / values*
4. Your Role at a Party — *social habits*
5. Ideal Sunday Morning — *daily routines*
6. Late-Night Snack — *routines / food*
7. Travel Style — *travel*
8. Favorite Season — *seasons*

Titles only; values are the generating agent's job, then `pnpm prod:publish-catalog --dry-run`, review, publish.
