# Pipeline Adversarial Critique & Proposals

This document outlines an adversarial review of the refactored AI list generation pipeline (`catalog-publish.ts`, `media-identify.ts`, `media-sync.ts`), highlighting edge cases, race conditions, ontological flaws, and systemic weaknesses.

## 1. The Wikidata Subclass Blindspot (Ontology vs. Strict Equality)
**Severity: High**
**File:** `media-identify.ts`
**Flaw:** The auto-identification script checks `P31` (instance of) strictly against `catalog/identity-classes.json`. However, Wikidata is a deeply nested ontology. For example, a video game might be an instance of "action role-playing game" (Q187394), which is a subclass of "video game" (Q7889). If `identity-classes.json` only whitelists "video game", the strict match `classMatch = itemClasses.some(c => classes[c])` will **fail** for all games with specific genres. 
**Impact:** `media-identify.ts` will unnecessarily punt thousands of perfectly valid entities to manual review because they use a subclass of an allowed P31 class.
**Proposal:** 
- *Short term*: Expand `identity-classes.json` to include all relevant P31 subclasses using an offline script.
- *Long term*: Replace the `wbgetentities` REST call with a direct SPARQL query that utilizes the property path `wdt:P31/wdt:P279*` (instance of, or instance of a subclass of) against the allowed core classes.

## 2. Search Truncation Bias
**Severity: Medium**
**File:** `media-identify.ts`
**Flaw:** The script queries the `wbsearchentities` API with `limit: '7'`. Wikidata's search ranking is based on internal popularity algorithms. If an entity name is common (e.g., "Ghost", "Alien", "Return"), the desired entity might easily be the 8th or 15th result. 
**Impact:** The correct entity is never downloaded in `details`, meaning the script reports "no allowed class" or "no exact name match" and manual reviewers will be forced to manually hunt down the QID outside the system.
**Proposal:** Increase the `limit` to at least `50`. The extra bandwidth is negligible since it only requests IDs, and `describe()` chunks in groups of 50 anyway.

## 3. TOCTOU Race Condition in Media Sync
**Severity: Medium**
**File:** `media-sync.ts`
**Flaw:** The `attach()` function checks `if (previous) return false` before initiating `importAndAttach()`. Because the file download and processing takes time (and occurs outside a transaction), two concurrent executions of `media:sync` (e.g., a cron job overlapping with a manual deploy run) will both read `previous = null` and proceed to download, process, and upload duplicate images to the volume.
**Impact:** Storage bloat on the Railway persistent volume and broken invariants if the application assumes a strict 1:1 mapping for primary assets.
**Proposal:** Push the `isPrimary` existence check *inside* the Prisma transaction within `TaxonomyMediaService.importAndAttach`.

## 4. Dry-Run State Accumulation Failure
**Severity: Low/Medium**
**File:** `catalog-publish.ts`
**Flaw:** The script loops over all lists to validate them (`importer.importList(list, true)`), and only if all pass does it commit them. However, if *List B* depends on a category or entity type created dynamically by *List A* in the same batch, the dry-run of *List B* will evaluate against the current database state (where the type doesn't exist yet) and throw an error.
**Impact:** Admins will be forced to split dependent lists into separate batches and publish them sequentially.
**Proposal:** Have `importer.importList(..., true)` accept an optional accumulator object representing mock DB state (created slugs, categories) to allow multi-file batches to validate inter-dependencies.

## 5. Strict Keying and the "The" Problem
**Severity: Low**
**File:** `media-identify.ts`
**Flaw:** Auto-acceptance requires an exact match via the Unicode-aware `key()` function. While safe, this means "The Matrix" (Datememe) and "Matrix, The" (Wikidata alias) will not match. 
**Impact:** Higher manual review burden.
**Proposal:** If `nameMatch` fails but `classMatch` is true, calculate the Levenshtein distance or strip leading articles before appending the candidate to the `identities.json` review file. Sort the review candidates by this heuristic to save the human reviewer time.

## 6. Railway Context Evasion
**Severity: Low**
**File:** `media-sync.ts`
**Flaw:** The script relies on `assertMediaWritesAreServable()` to prevent WSL users from accidentally polluting the DB with `localhost` URLs. However, if a developer runs a local proxy that mimics the production domain, the assertion might pass, dumping files onto their local C: drive while pointing production DB rows to them.
**Impact:** Broken production images.
**Proposal:** In `assertMediaWritesAreServable()`, explicitly check for a specific Railway environment variable (e.g., `process.env.RAILWAY_ENVIRONMENT`) before allowing any write operation, guaranteeing absolute environment enforcement.
