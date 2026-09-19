# Data Schema Proposal — Favorites-Based Match-Making App

**Status:** Draft v3 — reconciled with the swipe/match product direction
**Scope:** Core data model for the mobile app (users, profiles, favorites/lists, taxonomy, matching, messaging, monetization), with a brief section on the supporting marketing/admin site. The list + taxonomy model is still the largest section, since favorites lists are still the majority of profile content — v3 adds a thin identity layer (photos, a short tagline) and a swipe/match gate on top of it, it doesn't replace it.

**v3 changes — product pivot:** early visual mockups (`art/match.png`, `art/profile.png`, `art/home.png`) surfaced a direction not reflected in v2: discovery is swipe-based (Like/Pass) with a mutual-match gate before messaging, profiles show a percentage compatibility score plus a few qualitative "insight" highlights, and profiles carry a short optional tagline and a small photo gallery rather than exactly one photo. This is a genuine reversal of one v2 principle ("no bio, one photo, no percentage score") — see the updated §1 principle 1 for the reasoning — so it's called out explicitly rather than quietly edited over. New in v3: `Swipe` (§7), `ProfilePhoto` and `Profile.bio` (§3), a match-gated `Conversation` creation rule (§8), and `matchPercentage`/`insights` as derived, non-stored display fields (§7).

**v2 changes (still in effect):** fixed a MySQL-incompatible scalar-array field, added real Prisma relations (with explicit `onDelete` behavior) everywhere an id field was acting like an unenforced foreign key, closed the gap between `EntitySubmission` and the pending `Entity` it produces, stated one explicit rule for rejected-entity visibility, documented `Category` tag filtering as AND-only, fixed a null-scoping uniqueness bug on `Tag`, made compatibility-score pair canonicalization an explicit service contract, and cut speculative Phase-2 concepts out of the physical MVP schema. Also corrected §6 (Search) which had assumed Postgres — this project's DB is MySQL.

**Read this before the rest of the document:** the inline Prisma snippets in each numbered section below are illustrative — they show the model being introduced but may omit reverse-relation fields that only become necessary once a *later* section adds a relation into it (e.g. `Profile` gains `sentMessages`, `initiatedConversations`, etc. only once §8 exists). **§13 (MVP Schema Appendix) is the single copy that must actually compile** and is the authoritative source; if anything in §§3–11 and §13 ever disagree, §13 wins.

---

## 0. Database & Runtime

Per the project's established stack, the DB is **MySQL via Prisma** (not Postgres). This has two concrete consequences baked into the design below:

1. **No native scalar-list columns.** Prisma cannot represent `String[]` on MySQL — anything that looks like a multi-value field becomes a join table instead (§3).
2. **No `pg_trgm`.** Fuzzy/typo-tolerant search isn't a database extension away — MVP search leans on prefix indexes + an explicit alias table, with real fuzzy matching deferred to a dedicated search engine sync (§6).

---

## 1. Design Principles

1. **Lists are the majority of the content, but not the only identity signal.** A profile is a curated stack of `List` records — that's still where 90% of a user's time goes and still what drives matching (§7). v3 adds a small photo gallery and one short optional tagline (`Profile.bio`, ~150 chars) so a profile isn't *just* lists, matching the reference mockups — but there is deliberately no long-form "about me" essay field, and lists remain the primary surface. This is a narrower reversal of v2's "no bio, no photos" stance than it might look: the bet is still that favorites carry the personality; the tagline and photos are lightweight identity context, not a return to a bio-and-photo-grid profile.
2. **The taxonomy is a first-class, continuously-growing graph**, not a set of enums. Every "thing" a user can favorite (a band, a fruit, a sewing machine, a Twitch streamer) is a row in one normalized `Entity` table, typed by `EntityType` and faceted by `Tag`. New categories and new entities are expected weekly, not just at launch.
3. **Autocomplete-first, typing-as-fallback.** Every list-building interaction is "search and click," not "type free text." Free text only exists to *seed* the taxonomy (via `EntitySubmission`), never to populate a list directly with unvalidated data.
4. **One entity table, many narrow categories.** "Top 5 PS5 Action Games" and "Favorite 90s Bands" don't get their own tables — they're a `Category` that points at an `EntityType` (`VideoGame`, `Band`) plus optional `Tag` filters (`platform:ps5`, `genre:action`, `decade:1990s`).
5. **Denormalized counters for speed, source-of-truth events for correctness.** `Entity.usageCount` and `Category.popularityCount` are denormalized read-path optimizations — incremented transactionally on write, never the only record of truth.
6. **Premium gating is a service-layer concern, not a schema constraint.** Messages are stored identically regardless of subscription status; whether the API serializes `body` back depends on the reader's `Subscription` state at read time.
7. **Every id-shaped field is a real foreign key with an explicit delete behavior.** No column is allowed to merely *look like* a relation — see the FK/delete contract in §12.

---

## 2. Entity-Relationship Overview

```
User ──1:1── Profile ──1:N── List ──1:N── ListItem ──N:1── Entity ──N:1── EntityType
                │  │                         │                │  │
                │  └─1:N─ ProfileSeekingGender│                │  └─N:M─ Tag
                N:1                           │                │
             Category ─N:1─ CategoryGroup     │                └─1:N─ EntityAlias
                │  └─N:M─ Tag                 │
                │                             │
                └── EntitySubmission ─────────┘  (growth pipeline, see §5)

Profile ──1:N── ProfilePhoto
Profile ──N:N (via Swipe, self-relation)── Profile   (mutual LIKE ⇒ Match ⇒ Conversation, see §7)
Profile ──N:M (via ConversationParticipant)── Conversation ──1:N── Message
Profile ──1:N (initiatedById)── Conversation
Profile ──1:N (senderId)── Message
User ──1:N── Subscription ──N:1── Plan
User ──1:N── Session
Profile ──N:N (cached, Phase 2)── CompatibilityScore
```

---

## 3. Identity & Profile

```prisma
model User {
  id           String      @id @default(cuid())
  email        String      @unique
  phone        String?     @unique
  passwordHash String?
  role         AccountRole @default(USER)
  isVerified   Boolean     @default(false)
  suspendedAt  DateTime?
  deletedAt    DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  profile       Profile?
  subscriptions Subscription[]
  sessions      Session[]
}

enum AccountRole {
  USER
  MODERATOR
  ADMIN
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
}

model Profile {
  id             String   @id @default(cuid())
  userId         String   @unique
  username       String   @unique
  displayName    String
  birthdate      DateTime
  genderIdentity String?
  bio            String?  @db.VarChar(150)   // short optional tagline, not a bio essay — see §1 principle 1
  locationLat    Float?
  locationLng    Float?
  locationLabel  String?
  avatarUrl      String?             // primary/first photo; gated the same way as `photos` (docs §8/§9)
  isDiscoverable Boolean  @default(true)
  onboardingStep Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  seekingGenders ProfileSeekingGender[]
  photos         ProfilePhoto[]
  lists          List[]

  @@index([locationLat, locationLng])
}
```

**Fix from review:** `seekingGenders` cannot be a scalar `String[]` — Prisma doesn't support scalar lists on MySQL. Normalized as a join table instead:

```prisma
model ProfileSeekingGender {
  profileId String
  gender    String

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@id([profileId, gender])
}
```

**v3 addition — `ProfilePhoto`:** a small ordered gallery beyond the primary `avatarUrl`. Deliberately still a *small, curated* set (the app enforces a max, e.g. 6, at the service layer — not a schema constraint, so the limit can be tuned without a migration), not an open-ended photo-dump grid; that distinction is what's left of the original "not a photo-first app" stance.

```prisma
model ProfilePhoto {
  id        String   @id @default(cuid())
  profileId String
  url       String
  sortOrder Int
  createdAt DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, sortOrder])
}
```

---

## 4. The List & Taxonomy System (core of the product)

### 4.1 `EntityType` — the kind of thing

The root of the taxonomy. Each of the example domains — songs, movies, jobs, states, fruits, IDEs, sewing machines, mobile devices, video games, YouTubers, Twitch streamers, 19th-century authors — is one `EntityType` row, not a new table.

```prisma
model EntityType {
  id             String   @id @default(cuid())
  slug           String   @unique
  label          String
  pluralLabel    String
  icon           String?
  metadataSchema Json?    // optional JSON-schema describing expected Entity.metadata shape for this type, used by the admin form
  createdAt      DateTime @default(now())

  entities   Entity[]
  categories Category[]
}
```

| `EntityType.slug` | Label | Example `Category` built on it |
|---|---|---|
| `song` | Song | "Favorite Songs of All Time" |
| `band` | Band | "Favorite 90s Bands" *(tag: decade-1990s)* |
| `movie` | Movie | "Top 5 Movies", "Favorite Horror Movies" *(tag: genre-horror)* |
| `job-title` | Job Title | "Dream Job" |
| `us-state` | U.S. State | "Favorite State to Live In" |
| `fruit` | Fruit | "Top 3 Fruits" |
| `ide` | IDE / Editor | "Favorite IDE" |
| `sewing-machine` | Sewing Machine | "Favorite Sewing Machine" |
| `mobile-device` | Mobile Device | "Current Phone", "Dream Phone" |
| `video-game` | Video Game | "Top 5 PS5 Action Games" *(tags: platform-ps5, genre-action)* |
| `youtuber` | YouTuber | "Favorite YouTubers" |
| `twitch-streamer` | Twitch Streamer | "Favorite Twitch Streamers" |
| `author` | Author | "Favorite 19th-Century Authors" *(tag: era-19th-century)* |

### 4.2 `Entity` — the known things

```prisma
model Entity {
  id                    String           @id @default(cuid())
  entityTypeId          String
  canonicalName         String
  slug                  String
  imageUrl              String?
  metadata              Json?              // free-form per-type attributes: { releaseYear, platforms: ["ps5"], genre: "action" }
  externalIds           Json?              // { musicbrainz, tmdb, igdb, wikidata } — enrichment + cross-source dedup keys
  sourceType            EntitySourceType   @default(SEEDED)
  status                SubmissionStatus   @default(APPROVED)
  mergedIntoId          String?            // set when this row was a duplicate later folded into a canonical entity
  usageCount            Int      @default(0)   // denormalized; incremented on every ListItem create, decremented on delete
  submittedByProfileId  String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  entityType         EntityType    @relation(fields: [entityTypeId], references: [id], onDelete: Restrict)
  mergedInto         Entity?       @relation("EntityMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom         Entity[]      @relation("EntityMerge")
  submittedByProfile Profile?      @relation(fields: [submittedByProfileId], references: [id], onDelete: SetNull)
  aliases            EntityAlias[]
  tags               EntityTag[]
  listItems          ListItem[]

  @@unique([entityTypeId, slug])
  @@index([entityTypeId, status])
  @@index([entityTypeId, usageCount])   // powers "most popular in this type" autocomplete ordering
}

enum EntitySourceType {
  SEEDED
  IMPORTED
  USER_SUBMITTED
}

enum SubmissionStatus {
  PENDING
  APPROVED
  REJECTED
  MERGED
}
```

Only `APPROVED` entities appear in public autocomplete/search. `PENDING`/`REJECTED` entities are visible only on the submitting profile's own list — the exact rule and its single enforcement point are in §5.

### 4.3 `EntityAlias` and `Tag` — search surface and facets

```prisma
model EntityAlias {
  id        String   @id @default(cuid())
  entityId  String
  alias     String            // "Fab Four", "GTA" for "Grand Theft Auto", common misspellings
  locale    String   @default("en")
  createdAt DateTime @default(now())

  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([entityId, alias])
  @@index([alias])
}
```

**Fix from review — Tag scoping.** The original design had `Tag.entityTypeId String?` (nullable, for "global" tags like decades) under `@@unique([entityTypeId, slug])`. On MySQL, a unique index treats every `NULL` as distinct from every other `NULL`, so that constraint would silently allow duplicate global tags (`decade-1990s` created twice). Rather than patch around that with a sentinel scope column, **`Tag` is made fully global**: tags aren't intrinsically owned by one `EntityType` anyway (a decade or a "based on a true story" tag can apply to bands, movies, *and* video games), so the FK was removed rather than fixed.

```prisma
model Tag {
  id        String   @id @default(cuid())
  slug      String   @unique   // globally unique — e.g. "decade-1990s", "genre-action", "platform-ps5"
  label     String
  kind      TagKind  @default(CUSTOM)
  createdAt DateTime @default(now())

  entityTags   EntityTag[]
  categoryTags CategoryTag[]
}

enum TagKind {
  DECADE
  GENRE
  PLATFORM
  REGION
  ERA
  CUSTOM
}

model EntityTag {
  entityId String
  tagId    String

  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([entityId, tagId])
}
```

The guardrail that used to live in the FK (don't let an admin tag a `Fruit` with `platform-ps5`) moves to the admin UI instead: the tag picker for a given `EntityType` is scoped to tags already used by entities/categories of that type, plus `kind`-based filtering. This is looser than a DB constraint, but it's an admin-only tool, not user-facing input — acceptable at MVP.

### 4.4 `CategoryGroup` and `Category` — the list templates

```prisma
model CategoryGroup {
  id        String   @id @default(cuid())
  slug      String   @unique     // "music", "film-tv", "food", "career", "tech", "gaming", "creators", "geography"
  label     String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  categories Category[]
}

model Category {
  id              String           @id @default(cuid())
  groupId         String
  entityTypeId    String
  slug            String           @unique
  prompt          String                     // "What are your top 5 90s bands?"
  shortLabel      String                     // "Top 90s Bands" — card/chip label
  minItems        Int              @default(1)
  maxItems        Int              @default(5)
  orderingMode    OrderingMode     @default(RANKED)
  isMatchSignal   Boolean          @default(true)
  isPremiumOnly   Boolean          @default(false)
  status          SubmissionStatus @default(APPROVED)
  popularityCount Int              @default(0)   // # profiles who have completed this category
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  group        CategoryGroup @relation(fields: [groupId], references: [id], onDelete: Restrict)
  entityType   EntityType    @relation(fields: [entityTypeId], references: [id], onDelete: Restrict)
  requiredTags CategoryTag[]
  lists        List[]

  @@index([groupId, status])
  @@index([entityTypeId])
}

enum OrderingMode {
  RANKED     // position matters: #1 favorite, #2, #3...
  UNRANKED   // a set, no implied order (e.g. "Fruits you like")
}

model CategoryTag {
  categoryId String
  tagId      String

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Restrict)

  @@id([categoryId, tagId])
}
```

**Invariant, stated explicitly:** `Category.requiredTags` is **pure AND** — an entity is eligible for the category only if it carries *every* tag attached here. This cleanly expresses `platform-ps5 AND genre-action`, but it **cannot** express OR/IN (`genre IN (action, rpg)`) or exclusion (`NOT multiplayer`). That's an intentional MVP limitation, not an oversight — do not build category-eligibility logic that assumes richer boolean expressions exist. If that need shows up, it's a deliberate new model (e.g. a `TagGroup` expression tree), not an extension of `CategoryTag`.

### 4.5 `List` and `ListItem` — the actual profile content

```prisma
model List {
  id          String         @id @default(cuid())
  profileId   String
  categoryId  String
  title       String?                    // optional personalization override of Category.shortLabel
  visibility  ListVisibility @default(PUBLIC)
  isComplete  Boolean        @default(false)
  completedAt DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  profile  Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  items    ListItem[]

  @@unique([profileId, categoryId])   // one list per category per profile in MVP
  @@index([profileId])
  @@index([categoryId])
}

enum ListVisibility {
  PUBLIC
  PREMIUM_ONLY
  PRIVATE
}

model ListItem {
  id        String   @id @default(cuid())
  listId    String
  entityId  String
  rank      Int                  // 1 = top favorite; ignored for display when Category.orderingMode = UNRANKED. Ranks only need to be UNIQUE per list, not contiguous — hiding a rejected/pending item never breaks this constraint (§5).
  note      String?              // optional short "why" blurb
  createdAt DateTime @default(now())

  list   List   @relation(fields: [listId], references: [id], onDelete: Cascade)
  entity Entity @relation(fields: [entityId], references: [id], onDelete: Restrict)

  @@unique([listId, rank])
  @@unique([listId, entityId])
  @@index([entityId])
}
```

`ListItem.entityId` writes trigger `Entity.usageCount += 1` (and `Category.popularityCount` maintenance on completion) in the same transaction — the one place these denormalized counters get mutated, centralized in one service method.

---

## 5. Seeding & Taxonomy Growth Pipeline

### 5.1 Launch seeding

Each `EntityType` ships with a curated seed file (`packages/db/prisma/seed-data/<type>.json`). Suggested external sources per type, tracked via `Entity.externalIds` to avoid duplicate re-imports:

- **Bands / Songs** → MusicBrainz
- **Movies / TV** → TMDB
- **Video Games** → IGDB
- **Authors / general people, places, brands** → Wikidata
- **Job Titles** → O*NET taxonomy
- **US States, countries** → static reference list

### 5.2 Admin-curated growth

Internal team/contractors add `Entity`/`Category` rows directly through the admin panel (`sourceType: SEEDED`) — the primary way whole new verticals get added post-launch.

### 5.3 User-driven growth — schema and rule

**Fix from review:** the original write-up said a submission creates "an `EntitySubmission` and immediately an `Entity`," but had no durable field connecting the two during moderation. `EntitySubmission` now holds an explicit, required, unique pointer to the pending entity it produced, separate from the field recording the eventual moderation outcome:

```prisma
model EntitySubmission {
  id                   String           @id @default(cuid())
  entityTypeId         String
  rawText              String
  submittedByProfileId String
  submittedEntityId    String           @unique   // the PENDING Entity created immediately so the submitter's list is never blocked
  suggestedMatchId     String?                     // best-guess existing APPROVED entity from the fuzzy-match pass, shown to the reviewer
  resolvedEntityId     String?                     // set once a reviewer approves (= submittedEntityId) or merges (= the canonical entity)
  status               SubmissionStatus @default(PENDING)
  reviewedByUserId     String?
  reviewNotes          String?
  createdAt            DateTime         @default(now())
  reviewedAt           DateTime?

  entityType         EntityType @relation(fields: [entityTypeId], references: [id], onDelete: Restrict)
  submittedByProfile Profile    @relation("SubmissionSubmitter", fields: [submittedByProfileId], references: [id], onDelete: Restrict)
  submittedEntity    Entity     @relation("SubmissionSubmittedEntity", fields: [submittedEntityId], references: [id], onDelete: Restrict)
  suggestedMatch     Entity?    @relation("SubmissionSuggestedMatch", fields: [suggestedMatchId], references: [id], onDelete: SetNull)
  resolvedEntity     Entity?    @relation("SubmissionResolvedEntity", fields: [resolvedEntityId], references: [id], onDelete: SetNull)
  reviewedByUser     User?      @relation(fields: [reviewedByUserId], references: [id], onDelete: SetNull)

  @@index([status, entityTypeId])
}
```

Flow:

1. User searches, gets no good match, taps "Can't find it? Add '<typed text>'."
2. Service creates `Entity { status: PENDING, sourceType: USER_SUBMITTED }` **and** `EntitySubmission { submittedEntityId: <that entity's id> }` in one transaction. The user's `ListItem` points at the new `PENDING` entity immediately — their list is never blocked on review.
3. A synchronous fuzzy-match pass (see §6) sets `suggestedMatchId` when a high-confidence existing entity is found; above a very high threshold the UI short-circuits to "did you mean X?" instead of creating a submission at all.
4. A human reviewer resolves the `EntitySubmission`:
   - **Approve** → `submittedEntity.status = APPROVED`, `resolvedEntityId = submittedEntityId`.
   - **Merge** → `submittedEntity.status = MERGED`, `submittedEntity.mergedIntoId = <canonical entity>`, `resolvedEntityId = <canonical entity>`; affected `ListItem` rows get repointed to the canonical entity in the same batch.
   - **Reject** → `submittedEntity.status = REJECTED`, `resolvedEntityId` stays null.

**Rejected/pending visibility rule (fix from review):** the document previously said a rejected entity stays in the user's list but "never surfaces publicly," without specifying how that's enforced given `ListItem → Entity` is a plain FK. The rule is now definitive and has exactly one enforcement point:

> An entity with `status IN (PENDING, REJECTED)` is visible **only** to the profile that submitted it (`Entity.submittedByProfileId = viewer.profileId`); every other viewer never sees that `ListItem` at all. This is not optional per-query behavior — every code path that renders someone else's list **must** go through one shared service method, `serializeListForViewer(list, viewerProfileId)`, which filters `WHERE entity.status = 'APPROVED' OR entity.submittedByProfileId = viewerProfileId`. There is no second code path permitted to fetch `ListItem.entity` for external rendering.

### 5.4 Growing the categories themselves (Phase 2)

Deferred — see §11.

---

## 6. Search & Autocomplete Architecture

The DB is MySQL (§0), which rules out Postgres's `pg_trgm` trigram search that a naive read of this schema might assume.

- **MVP:** a B-tree index on `Entity.canonicalName` (and `EntityAlias.alias`) serves prefix queries (`WHERE canonicalName LIKE 'beat%'`), covering the large majority of autocomplete keystrokes since users are typing the start of a name. A MySQL `FULLTEXT` index over the same columns backs a secondary boolean-mode query for multi-word names typed out of order ("beatles the"). Known synonyms/abbreviations/misspellings go through the explicit `EntityAlias` table (curated at seed time, grown by admins/reviewers) rather than a fuzzy algorithm — "GTA" only resolves to "Grand Theft Auto" because a row says so.
- **Ranking:** `APPROVED` entities first, then the *viewer's own* `PENDING` entities, ordered within each group by match quality then `usageCount DESC`.
- **Dedup fuzzy-matching at submission time** (§5) doesn't have DB-native trigram similarity to lean on. MVP approach: fetch a shortlist via prefix/`FULLTEXT` match within the same `EntityType` (at most a few dozen rows), then score that shortlist in the application layer with Levenshtein/Damerau-Levenshtein — cheap outside the DB at that size.
- **Phase 2:** sync `Entity` + `EntityAlias` into Typesense/Meilisearch for true typo-tolerant, sub-20ms fuzzy search, taking the highest-traffic read path off MySQL entirely. MySQL stays source of truth; the search index rebuilds from a change feed, never written to directly. `Entity.trendingScore`-driven ranking (Phase 2, §11) lives here too, not in a MySQL query.

---

## 7. Matching / Compatibility / Swipe

**v3 addition.** Discovery is swipe-based: a profile is shown one candidate at a time and records a Like or a Pass. A **Match** is not a stored fact — it's the derived state of two opposite-direction `Swipe` rows both being `LIKE`. That's a deliberate choice: a match is fully determined by its two swipes, so storing it separately would just be a second place the same fact could go stale.

```prisma
model Swipe {
  id             String      @id @default(cuid())
  actorProfileId String                        // who swiped
  targetProfileId String                       // who they swiped on
  action         SwipeAction
  createdAt      DateTime    @default(now())

  actor  Profile @relation("SwipeActor", fields: [actorProfileId], references: [id], onDelete: Cascade)
  target Profile @relation("SwipeTarget", fields: [targetProfileId], references: [id], onDelete: Cascade)

  @@unique([actorProfileId, targetProfileId])   // one swipe per pair per direction — re-swiping isn't a thing
  @@index([targetProfileId])
}

enum SwipeAction {
  LIKE
  PASS
}
```

- **Discovery feed exclusion:** the candidate query excludes any profile the viewer has already swiped in either direction (`WHERE targetProfileId NOT IN (SELECT targetProfileId FROM Swipe WHERE actorProfileId = viewer)`), so nobody is shown twice.
- **Detecting a match:** on `LIKE`, check for the mirror row (`Swipe { actorProfileId: target, targetProfileId: actor, action: LIKE }`). If found, it's a match: the service creates the `Conversation` right there, in the same transaction as the second `Swipe` insert, with `initiatedById` set to whichever profile completed the match (the second liker) — an arbitrary but harmless convention now that "initiator" no longer means "who started the conversation" in the request/accept sense. `Conversation.status` is set straight to `ACCEPTED`. A `PASS` never creates anything beyond its own row.
- **Messaging is match-gated (see §8):** there is no other path to creating a `Conversation`. A direct "message anyone" endpoint no longer exists in this design — matching *is* the only door into a conversation.

### Compatibility percentage and insight highlights

The reference design shows a **percentage match score** and a few qualitative **insight** callouts (e.g. "Shared taste," "Rare overlap"). Both are **derived, non-stored display values** computed from the same rarity-weighted overlap the pre-swipe design already used — nothing new to persist:

- `matchPercentage`: the rarity-weighted score (`Σ 1 / log(entity.usageCount + 2)` over shared `ListItem.entityId`, same formula as before) run through a saturating normalization (e.g. `round(100 * (1 - e^(-score / k)))` for a tuned constant `k`) so it reads as a 0–100 number instead of an unbounded raw score. This is presentation math in the service layer, not a new column.
- `insights`: a short, ordered list of `{ icon, title, description }` built from simple threshold rules over the same shared-items data (e.g. `sharedItemsCount >= 5` → "Shared taste"; the shared set includes an entity with unusually low `usageCount` → "Rare overlap"). This is deliberately heuristic copy-generation for MVP, not a scored ML feature — treat the exact thresholds as tunable product parameters, not a contract.
- Both are computed against the *candidate pool already being fetched* for the swipe stack (§ below), so there's no separate "get my match score with X" endpoint — it rides along with the discovery/candidate response.

- **MVP compatibility computation:** compute overlap on read for the current candidate, weighted by rarity — two profiles both listing "The Beatles" is a weak signal; two profiles both listing the same obscure `sewing-machine` entity is strong. Rarity weight = `1 / log(entity.usageCount + 2)`, summed over shared `ListItem.entityId`.
- **Phase 2 caching layer**, with explicit relations and a canonicalization contract:

```prisma
model CompatibilityScore {
  id               String   @id @default(cuid())
  profileAId       String
  profileBId       String
  score            Float
  sharedItemsCount Int
  computedAt       DateTime @default(now())

  profileA Profile @relation("CompatibilityScoreProfileA", fields: [profileAId], references: [id], onDelete: Cascade)
  profileB Profile @relation("CompatibilityScoreProfileB", fields: [profileBId], references: [id], onDelete: Cascade)

  @@unique([profileAId, profileBId])
  @@index([profileBId])
}
```

**Fix from review:** "`profileAId` is always the lexicographically smaller id" was previously just a comment, which means nothing prevents a bug from writing both `(A, B)` and `(B, A)`, or `(A, A)`. This is made an explicit contract instead of a convention:

- Exactly one service method, `getOrCreateCompatibilityScore(profileIdX, profileIdY)`, is permitted to read or write this table. It sorts its two arguments before every query (`[a, b] = [x, y].sort()`) and throws if `x === y`. No other code path touches `CompatibilityScore` directly.
- Belt-and-suspenders: Prisma has no `@@check` attribute, but MySQL 8.0.16+ supports `CHECK` constraints natively, so the migration adds `ALTER TABLE CompatibilityScore ADD CONSTRAINT chk_profile_order CHECK (profileAId < profileBId)` by hand after the Prisma-generated migration. A bug that bypasses the service layer then fails loudly at the DB instead of silently duplicating rows.

- **Parking lot:** `pgvector`-equivalent ANN matching isn't available on MySQL the way it is on Postgres; if pairwise batch computation stops scaling, the likely path is a dedicated vector store (e.g. a managed vector DB) fed by the same favorites data, not a MySQL extension.

---

## 8. Messaging (Match-Gated, Premium-Gated)

**v3 change:** a `Conversation` is only ever created by the swipe/match flow in §7 — there is no "message anyone" entry point. `status` is set to `ACCEPTED` at creation time (the match already *is* the mutual consent); `PENDING` is unused for now but left in the enum since `DECLINED`/`BLOCKED` remain useful post-match actions (unmatching, blocking).

```prisma
model Conversation {
  id            String             @id @default(cuid())
  status        ConversationStatus @default(ACCEPTED)   // always created ACCEPTED — see §7, matching is the consent step
  initiatedById String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  initiator    Profile                    @relation("ConversationInitiator", fields: [initiatedById], references: [id], onDelete: Restrict)
  participants ConversationParticipant[]
  messages     Message[]
}

enum ConversationStatus {
  PENDING
  ACCEPTED
  DECLINED
  BLOCKED
}

model ConversationParticipant {
  conversationId String
  profileId      String
  lastReadAt     DateTime?
  isArchived     Boolean   @default(false)

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  profile      Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@id([conversationId, profileId])
}

model Message {
  id             String    @id @default(cuid())
  conversationId String
  senderId       String
  body           String    @db.Text
  createdAt      DateTime  @default(now())
  deletedAt      DateTime?

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       Profile      @relation("MessageSender", fields: [senderId], references: [id], onDelete: Restrict)

  @@index([conversationId, createdAt])
  @@index([senderId, createdAt])   // supports the free-tier daily send-cap count across all of a sender's conversations
}
```

**Fix from review:** `initiatedById` and `senderId` are now real relations to `Profile` (matching `ConversationParticipant.profileId`), each with `onDelete: Restrict` — see the account-deletion note in §12 for why that's the correct choice rather than `Cascade`.

**Two independent gates, don't conflate them:** matching (§7) determines *whether a conversation exists at all* — same rule for free and premium members alike. Membership tier then gates communication *within* an existing conversation, plus photo visibility — not participation (list-building, swiping, and browsing are unlimited for everyone). All three tier checks below read the same `Subscription.currentPeriodEnd > now()` entitlement; storing every message identically regardless of plan means an upgrade never requires a backfill.

- **Sending:** a free-tier `senderId` is capped at **3 messages per day**, resetting on a day boundary (UTC, TBD vs. per-user local time — see requirements doc). Checked as `COUNT(*) WHERE senderId = X AND createdAt >= startOfCurrentDay` at write time, across all of that sender's conversations. This needs an index on `(senderId, createdAt)` — added below — since the existing `(conversationId, createdAt)` index doesn't help a cross-conversation, per-sender count. Premium senders are uncapped.
- **Receiving:** a free-tier recipient does not get `Message.body` at all, for any conversation — the API returns only that a conversation/notification exists, not its content or sender identity, until they upgrade. This is a harder gate than "send freely, pay to read": free members cannot read incoming messages under any circumstance.
- **Photos:** `Profile.avatarUrl` and `Profile.photos` are only returned to a viewer with an active `Subscription` (or the profile's own owner); free viewers get a placeholder and an empty `photos` array.

The cap value (3) and reset cadence (daily) are product parameters enforced entirely in the service method that creates a `Message` — not a schema constraint, so they can change without a migration. No denormalized counter is needed; a date-bounded `COUNT(*)` against a proper index is cheap at this volume.

---

## 9. Monetization (mobile-first, built in from day one)

```prisma
model Plan {
  id         String       @id @default(cuid())
  slug       String       @unique   // "premium-monthly", "premium-annual"
  label      String
  interval   PlanInterval
  priceCents Int
  currency   String       @default("USD")
  isActive   Boolean      @default(true)

  subscriptions Subscription[]
}

enum PlanInterval {
  MONTHLY
  ANNUAL
  LIFETIME
}

model Subscription {
  id                     String   @id @default(cuid())
  userId                 String
  planId                 String
  provider               PaymentProvider
  providerSubscriptionId String   @unique   // Apple originalTransactionId / Google purchaseToken / Stripe subscription id
  status                 SubscriptionStatus
  currentPeriodEnd       DateTime            // the single field the message-gating check reads: currentPeriodEnd > now()
  cancelAtPeriodEnd      Boolean  @default(false)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)
  plan Plan @relation(fields: [planId], references: [id], onDelete: Restrict)

  @@index([userId, status])
}

enum PaymentProvider {
  APPLE_APP_STORE
  GOOGLE_PLAY
  STRIPE
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  EXPIRED
}
```

`Purchase` (one-off IAP: boosts, spotlights) is deferred to Phase 2 — see §11/§14.

---

## 10. Supporting Site (brief)

A marketing/companion web site shares the same MySQL database (read-mostly, via the same Prisma client or a read replica once traffic warrants it):

- **Public category browse pages** (`/categories/top-90s-bands`) — SEO surface built off `Category` + aggregate `Entity` popularity within it.
- **Waitlist / landing page** — standalone `WaitlistSignup { id, email, createdAt, source }` model, decoupled from `User`.
- **Admin console** — the moderation queue for `EntitySubmission` (§5), entity merge tool, and category/entity CRUD, gated by `User.role = MODERATOR | ADMIN`.

The site is a thin consumer of the same taxonomy tables rather than a separate content system.

---

## 11. MVP / Phase 2 / Parking Lot

**MVP — the actual product loop:** register → answer favorite lists → swipe → match → message → premium gate.

- `User`, `Session`
- `Profile`, `ProfileSeekingGender`, `ProfilePhoto`
- `EntityType`, `Entity`, `EntityAlias`, `Tag`, `EntityTag`
- `CategoryGroup`, `Category`, `CategoryTag`
- `List`, `ListItem`
- `EntitySubmission`
- `Swipe`
- `Conversation`, `ConversationParticipant`, `Message`
- `Plan`, `Subscription`

**Phase 2 — cut entirely out of the physical MVP schema, not just deprioritized:**
- `CompatibilityScore` (+ the pair-canonicalization service contract in §7)
- `Entity.trendingScore`, `Category.sortWeight` (new columns added to existing MVP tables)
- `CategorySuggestion`
- `Purchase`
- Search-engine sync (Typesense/Meilisearch) alongside MySQL

**Parking Lot**
- ANN-based vector matching (needs a dedicated vector store; not a MySQL feature)
- Icebreaker/"spot the overlap" game mechanic between matched users
- Multi-locale `EntityAlias` expansion beyond `en`
- Richer `CategoryTag` expressions (OR/exclusion) if AND-only filtering proves insufficient

---

## 12. Foreign Key & Delete-Behavior Contract

Every id-shaped field in the MVP schema, with its enforced relation and *why* that `onDelete` behavior was chosen. **Convention underlying most of the `Restrict` choices below:** this project never hard-deletes `User`/`Profile` rows in normal operation — account closure is a soft delete (`deletedAt`), consistent with the "never hard-delete user content" rule already governing `Message.deletedAt` etc. `Restrict` on those FKs is therefore a DB-level backstop that should never actually fire — if it does, it's surfacing a bug (an attempted hard delete) loudly instead of silently cascading away message history or a moderation audit trail.

| FK | On Delete | Why |
|---|---|---|
| `Session.userId → User` | Cascade | Sessions are purely ephemeral |
| `Profile.userId → User` | Cascade | Profile is owned 1:1 by User; no orphaned profiles |
| `ProfileSeekingGender.profileId → Profile` | Cascade | Pure join row |
| `ProfilePhoto.profileId → Profile` | Cascade | Photos have no meaning without their owner |
| `Swipe.actorProfileId → Profile`, `.targetProfileId → Profile` | Cascade | A swipe is meaningless once either party's profile is gone; unlike messages, there's no audit-trail reason to keep it |
| `List.profileId → Profile` | Cascade | Lists have no meaning without their owner |
| `List.categoryId → Category` | Restrict | Categories are shared reference data; retire, don't delete, while lists depend on them |
| `ListItem.listId → List` | Cascade | Items have no meaning without their list |
| `ListItem.entityId → Entity` | Restrict | Entities are never hard-deleted; duplicates are merged via `mergedIntoId` instead |
| `Entity.entityTypeId → EntityType` | Restrict | Types are foundational reference data |
| `Entity.mergedIntoId → Entity` (self) | SetNull | If a canonical entity is ever removed, duplicates become unmerged rather than orphaned |
| `Entity.submittedByProfileId → Profile` | SetNull | The entity survives even if the submitting profile is later deleted |
| `EntityAlias.entityId → Entity` | Cascade | Aliases have no independent meaning |
| `EntityTag.entityId → Entity`, `.tagId → Tag` | Cascade | Join row |
| `CategoryTag.categoryId → Category` | Cascade | Join row |
| `CategoryTag.tagId → Tag` | Restrict | Don't silently narrow a category's filter by deleting a tag it depends on |
| `Category.groupId → CategoryGroup` | Restrict | Groups are structural navigation, not disposable |
| `Category.entityTypeId → EntityType` | Restrict | Same as `Entity.entityTypeId` |
| `EntitySubmission.entityTypeId → EntityType` | Restrict | |
| `EntitySubmission.submittedByProfileId → Profile` | Restrict | Moderation audit trail must survive |
| `EntitySubmission.submittedEntityId → Entity` | Restrict | The pending entity this submission produced; never silently orphaned |
| `EntitySubmission.suggestedMatchId → Entity` | SetNull | Advisory only |
| `EntitySubmission.resolvedEntityId → Entity` | SetNull | Advisory/audit only |
| `EntitySubmission.reviewedByUserId → User` | SetNull | Reviewer may leave; the review record stays |
| `Conversation.initiatedById → Profile` | Restrict | See account-deletion convention above |
| `ConversationParticipant.conversationId → Conversation`, `.profileId → Profile` | Cascade | Join row; conversation membership has no meaning without both sides |
| `Message.conversationId → Conversation` | Cascade | |
| `Message.senderId → Profile` | Restrict | Message history must survive account actions |
| `Subscription.userId → User`, `.planId → Plan` | Restrict | Billing history must survive |
| `CompatibilityScore.profileAId/profileBId → Profile` (Phase 2) | Cascade | Pure cache; meaningless once either profile is gone |

---

## 13. Full Schema Appendix — MVP

This block is the authoritative, self-consistent MVP schema (`packages/db/prisma/schema.prisma`), with every relation from §§3–9 and the delete contract from §12 fully wired, including reverse-relation fields omitted from the inline snippets above for readability.

```prisma
// ── Identity ──────────────────────────────────────────────
model User {
  id           String      @id @default(cuid())
  email        String      @unique
  phone        String?     @unique
  passwordHash String?
  role         AccountRole @default(USER)
  isVerified   Boolean     @default(false)
  suspendedAt  DateTime?
  deletedAt    DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  profile             Profile?
  subscriptions       Subscription[]
  sessions            Session[]
  reviewedSubmissions EntitySubmission[]
}

enum AccountRole {
  USER
  MODERATOR
  ADMIN
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
}

model Profile {
  id             String   @id @default(cuid())
  userId         String   @unique
  username       String   @unique
  displayName    String
  birthdate      DateTime
  genderIdentity String?
  bio            String?  @db.VarChar(150)
  locationLat    Float?
  locationLng    Float?
  locationLabel  String?
  avatarUrl      String?
  isDiscoverable Boolean  @default(true)
  onboardingStep Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user                   User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  seekingGenders         ProfileSeekingGender[]
  photos                 ProfilePhoto[]
  lists                  List[]
  submittedEntities      Entity[]
  submissions            EntitySubmission[]         @relation("SubmissionSubmitter")
  swipesMade             Swipe[]                    @relation("SwipeActor")
  swipesReceived         Swipe[]                    @relation("SwipeTarget")
  conversations          ConversationParticipant[]
  initiatedConversations Conversation[]             @relation("ConversationInitiator")
  sentMessages           Message[]                  @relation("MessageSender")

  @@index([locationLat, locationLng])
}

model ProfileSeekingGender {
  profileId String
  gender    String

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@id([profileId, gender])
}

model ProfilePhoto {
  id        String   @id @default(cuid())
  profileId String
  url       String
  sortOrder Int
  createdAt DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, sortOrder])
}

// ── Matching ──────────────────────────────────────────────
model Swipe {
  id              String      @id @default(cuid())
  actorProfileId  String
  targetProfileId String
  action          SwipeAction
  createdAt       DateTime    @default(now())

  actor  Profile @relation("SwipeActor", fields: [actorProfileId], references: [id], onDelete: Cascade)
  target Profile @relation("SwipeTarget", fields: [targetProfileId], references: [id], onDelete: Cascade)

  @@unique([actorProfileId, targetProfileId])
  @@index([targetProfileId])
}

enum SwipeAction {
  LIKE
  PASS
}

// ── Taxonomy ──────────────────────────────────────────────
model EntityType {
  id             String   @id @default(cuid())
  slug           String   @unique
  label          String
  pluralLabel    String
  icon           String?
  metadataSchema Json?
  createdAt      DateTime @default(now())

  entities         Entity[]
  categories       Category[]
  entitySubmissions EntitySubmission[]
}

model Entity {
  id                    String           @id @default(cuid())
  entityTypeId          String
  canonicalName         String
  slug                  String
  imageUrl              String?
  metadata              Json?
  externalIds           Json?
  sourceType            EntitySourceType @default(SEEDED)
  status                SubmissionStatus @default(APPROVED)
  mergedIntoId          String?
  usageCount            Int              @default(0)
  submittedByProfileId  String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  entityType         EntityType        @relation(fields: [entityTypeId], references: [id], onDelete: Restrict)
  mergedInto         Entity?           @relation("EntityMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom         Entity[]          @relation("EntityMerge")
  submittedByProfile Profile?          @relation(fields: [submittedByProfileId], references: [id], onDelete: SetNull)
  aliases            EntityAlias[]
  tags               EntityTag[]
  listItems          ListItem[]
  submittedEntityFor EntitySubmission? @relation("SubmissionSubmittedEntity")
  suggestedMatchFor  EntitySubmission[] @relation("SubmissionSuggestedMatch")
  resolvedFor        EntitySubmission[] @relation("SubmissionResolvedEntity")

  @@unique([entityTypeId, slug])
  @@index([entityTypeId, status])
  @@index([entityTypeId, usageCount])
}

enum EntitySourceType {
  SEEDED
  IMPORTED
  USER_SUBMITTED
}

enum SubmissionStatus {
  PENDING
  APPROVED
  REJECTED
  MERGED
}

model EntityAlias {
  id        String   @id @default(cuid())
  entityId  String
  alias     String
  locale    String   @default("en")
  createdAt DateTime @default(now())

  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([entityId, alias])
  @@index([alias])
}

model Tag {
  id        String   @id @default(cuid())
  slug      String   @unique
  label     String
  kind      TagKind  @default(CUSTOM)
  createdAt DateTime @default(now())

  entityTags   EntityTag[]
  categoryTags CategoryTag[]
}

enum TagKind {
  DECADE
  GENRE
  PLATFORM
  REGION
  ERA
  CUSTOM
}

model EntityTag {
  entityId String
  tagId    String

  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([entityId, tagId])
}

model EntitySubmission {
  id                   String           @id @default(cuid())
  entityTypeId         String
  rawText              String
  submittedByProfileId String
  submittedEntityId    String           @unique
  suggestedMatchId     String?
  resolvedEntityId     String?
  status               SubmissionStatus @default(PENDING)
  reviewedByUserId     String?
  reviewNotes          String?
  createdAt            DateTime         @default(now())
  reviewedAt           DateTime?

  entityType         EntityType @relation(fields: [entityTypeId], references: [id], onDelete: Restrict)
  submittedByProfile Profile    @relation("SubmissionSubmitter", fields: [submittedByProfileId], references: [id], onDelete: Restrict)
  submittedEntity    Entity     @relation("SubmissionSubmittedEntity", fields: [submittedEntityId], references: [id], onDelete: Restrict)
  suggestedMatch     Entity?    @relation("SubmissionSuggestedMatch", fields: [suggestedMatchId], references: [id], onDelete: SetNull)
  resolvedEntity     Entity?    @relation("SubmissionResolvedEntity", fields: [resolvedEntityId], references: [id], onDelete: SetNull)
  reviewedByUser     User?      @relation(fields: [reviewedByUserId], references: [id], onDelete: SetNull)

  @@index([status, entityTypeId])
}

// ── Categories & Lists ────────────────────────────────────
model CategoryGroup {
  id        String   @id @default(cuid())
  slug      String   @unique
  label     String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  categories Category[]
}

model Category {
  id              String           @id @default(cuid())
  groupId         String
  entityTypeId    String
  slug            String           @unique
  prompt          String
  shortLabel      String
  minItems        Int              @default(1)
  maxItems        Int              @default(5)
  orderingMode    OrderingMode     @default(RANKED)
  isMatchSignal   Boolean          @default(true)
  isPremiumOnly   Boolean          @default(false)
  status          SubmissionStatus @default(APPROVED)
  popularityCount Int              @default(0)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  group        CategoryGroup @relation(fields: [groupId], references: [id], onDelete: Restrict)
  entityType   EntityType    @relation(fields: [entityTypeId], references: [id], onDelete: Restrict)
  requiredTags CategoryTag[]
  lists        List[]

  @@index([groupId, status])
  @@index([entityTypeId])
}

enum OrderingMode {
  RANKED
  UNRANKED
}

model CategoryTag {
  categoryId String
  tagId      String

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Restrict)

  @@id([categoryId, tagId])
}

model List {
  id          String         @id @default(cuid())
  profileId   String
  categoryId  String
  title       String?
  visibility  ListVisibility @default(PUBLIC)
  isComplete  Boolean        @default(false)
  completedAt DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  profile  Profile    @relation(fields: [profileId], references: [id], onDelete: Cascade)
  category Category   @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  items    ListItem[]

  @@unique([profileId, categoryId])
  @@index([profileId])
  @@index([categoryId])
}

enum ListVisibility {
  PUBLIC
  PREMIUM_ONLY
  PRIVATE
}

model ListItem {
  id        String   @id @default(cuid())
  listId    String
  entityId  String
  rank      Int
  note      String?
  createdAt DateTime @default(now())

  list   List   @relation(fields: [listId], references: [id], onDelete: Cascade)
  entity Entity @relation(fields: [entityId], references: [id], onDelete: Restrict)

  @@unique([listId, rank])
  @@unique([listId, entityId])
  @@index([entityId])
}

// ── Messaging ─────────────────────────────────────────────
model Conversation {
  id            String             @id @default(cuid())
  status        ConversationStatus @default(ACCEPTED)
  initiatedById String
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  initiator    Profile                   @relation("ConversationInitiator", fields: [initiatedById], references: [id], onDelete: Restrict)
  participants ConversationParticipant[]
  messages     Message[]
}

enum ConversationStatus {
  PENDING
  ACCEPTED
  DECLINED
  BLOCKED
}

model ConversationParticipant {
  conversationId String
  profileId      String
  lastReadAt     DateTime?
  isArchived     Boolean   @default(false)

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  profile      Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@id([conversationId, profileId])
}

model Message {
  id             String    @id @default(cuid())
  conversationId String
  senderId       String
  body           String    @db.Text
  createdAt      DateTime  @default(now())
  deletedAt      DateTime?

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       Profile      @relation("MessageSender", fields: [senderId], references: [id], onDelete: Restrict)

  @@index([conversationId, createdAt])
  @@index([senderId, createdAt])   // supports the free-tier daily send-cap count across all of a sender's conversations
}

// ── Monetization ──────────────────────────────────────────
model Plan {
  id         String       @id @default(cuid())
  slug       String       @unique
  label      String
  interval   PlanInterval
  priceCents Int
  currency   String       @default("USD")
  isActive   Boolean      @default(true)

  subscriptions Subscription[]
}

enum PlanInterval {
  MONTHLY
  ANNUAL
  LIFETIME
}

model Subscription {
  id                     String             @id @default(cuid())
  userId                 String
  planId                 String
  provider               PaymentProvider
  providerSubscriptionId String             @unique
  status                 SubscriptionStatus
  currentPeriodEnd       DateTime
  cancelAtPeriodEnd      Boolean            @default(false)
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)
  plan Plan @relation(fields: [planId], references: [id], onDelete: Restrict)

  @@index([userId, status])
}

enum PaymentProvider {
  APPLE_APP_STORE
  GOOGLE_PLAY
  STRIPE
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  EXPIRED
}

// ── Supporting site ───────────────────────────────────────
model WaitlistSignup {
  id        String   @id @default(cuid())
  email     String   @unique
  source    String?
  createdAt DateTime @default(now())
}
```

---

## 14. Schema Appendix — Phase 2 Additions

Not part of the MVP migration. Shown separately per §11 so the physical MVP schema above stays lean. Applying this phase adds two columns to existing MVP tables (`Entity.trendingScore`, `Category.sortWeight`) plus three new models, each with full relations per the same review standard applied to the MVP schema.

```prisma
// Additive columns on existing MVP models:
//   Entity.trendingScore    Float @default(0)   // recency-weighted score, refreshed by a nightly batch job
//   Category.sortWeight     Float @default(0)   // feeds the personalized "next category" queue

model CompatibilityScore {
  id               String   @id @default(cuid())
  profileAId       String
  profileBId       String
  score            Float
  sharedItemsCount Int
  computedAt       DateTime @default(now())

  profileA Profile @relation("CompatibilityScoreProfileA", fields: [profileAId], references: [id], onDelete: Cascade)
  profileB Profile @relation("CompatibilityScoreProfileB", fields: [profileBId], references: [id], onDelete: Cascade)

  @@unique([profileAId, profileBId])
  @@index([profileBId])
}
// Requires adding onto Profile:
//   compatibilityScoresAsA CompatibilityScore[] @relation("CompatibilityScoreProfileA")
//   compatibilityScoresAsB CompatibilityScore[] @relation("CompatibilityScoreProfileB")
// Migration also adds (Prisma has no @@check attribute):
//   ALTER TABLE CompatibilityScore ADD CONSTRAINT chk_profile_order CHECK (profileAId < profileBId);
// Enforced in code by a single service method, getOrCreateCompatibilityScore(idX, idY), see §7.

model CategorySuggestion {
  id                     String           @id @default(cuid())
  suggestedByProfileId   String
  proposedLabel          String
  proposedEntityTypeSlug String?
  notes                  String?
  status                 SubmissionStatus @default(PENDING)
  resultingCategoryId    String?
  createdAt              DateTime         @default(now())

  suggestedByProfile Profile   @relation(fields: [suggestedByProfileId], references: [id], onDelete: Restrict)
  resultingCategory  Category? @relation(fields: [resultingCategoryId], references: [id], onDelete: SetNull)
}
// Requires adding onto Profile:  categorySuggestions CategorySuggestion[]
// Requires adding onto Category: suggestionsResolved CategorySuggestion[]

model Purchase {
  id                    String          @id @default(cuid())
  userId                String
  provider              PaymentProvider
  productSku            String                  // e.g. "profile_boost_24h", "spotlight_1x" — one-off IAP, not subscriptions
  providerTransactionId String          @unique
  priceCents            Int
  currency              String          @default("USD")
  createdAt             DateTime        @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId, productSku])
}
// Requires adding onto User: purchases Purchase[]
```
