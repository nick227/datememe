# Project Requirements — Favorites-Based Match-Making App

**Status:** Draft v2 — reconciled with the swipe/match direction from the reference mockups (`art/match.png`, `art/profile.png`, `art/home.png`)
**Companion doc:** `docs/data-schema-proposal.md` (data model; this doc is scope and behavior, not schema)

**v2 changes:** discovery is now swipe-based (Like/Pass) with a mutual-match gate before messaging exists at all (previously: browse freely, message anyone); the compatibility signal is now a percentage plus a few qualitative "insight" highlights (previously: shared-favorites text only, explicitly *not* a percentage); profiles now carry a short optional tagline and a small photo gallery (previously: no bio, exactly one photo). This is a genuine partial reversal of v1's "no bio, one photo, no percentage" stance — see §3 for what's still true and what changed.

## 1. One-Liner

A mobile community + match-making app where your profile is built around ranked "favorites" lists across hundreds of categories (bands, movies, jobs, fruits, IDEs, games, streamers, authors...), not a bio essay or a photo grid. Filling out lists is the core loop; swiping through favorites-overlap and a compatibility score drives matching; messaging only exists after a mutual match, and is the monetization gate from there.

## 2. Target User

- Someone tired of bio-essay-first dating apps who wants to be found for *what they're into*, not a curated self-summary — but who still expects the baseline dating-app mechanics (a photo, a quick swipe) to be there.
- Willing to spend real time (10+ minutes at onboarding, then ongoing) building out favorites — the app should feel more like a fun personality quiz than a form.
- Mobile-first, casual-but-invested; comfortable with a freemium model where messaging and full photo access are the paid unlock.

## 3. Core Value Proposition

- **Lists are still the majority of the content.** No long-form "about me" essay. A profile is still, first and foremost, a stack of favorites lists — that's still where 90% of time goes and still what the match signal is computed from. What's new in v2: one short optional tagline (~150 characters) and a small photo gallery (a handful of photos, not an open-ended grid) — lightweight identity context, not a return to a bio-and-photo-first profile.
- **Swiping, but on substance.** The interaction is a familiar Like/Pass swipe — but each card leads with favorites overlap (a percentage + a couple of specific shared-interest callouts), not a five-second photo glance. The mechanic is standard; what's underneath it isn't.
- **The taxonomy is the moat.** A constantly-growing, deduplicated graph of "known things" that gets richer with every user, making autocomplete faster and matching more precise over time.

## 4. MVP Scope

### In scope

| Area | Requirement |
|---|---|
| Auth | Email/password (or phone) sign-up, login, session management |
| Onboarding | Guided, swipeable queue of Categories to complete; visible progress; skip allowed, but the app should nudge toward "10+ lists to unlock discovery" |
| List building | Search-and-click entity selection with autocomplete; drag-to-reorder for ranked categories; "can't find it? add it" fallback |
| Profile | Own and others' profiles show a small photo gallery, one optional ~150-char tagline, and a stack of completed Lists as the majority of the content |
| Discovery / Swipe | Like/Pass swipe queue of nearby or otherwise-eligible profiles — **unlimited for all members, free or premium**; each card shows a compatibility percentage plus 1–3 qualitative "insight" highlights (e.g. "Shared taste," "Rare overlap"), both derived from favorites overlap, not stored facts |
| Matching | A mutual Like creates a Match and, with it, the Conversation — this is the *only* way a conversation comes to exist; there is no "message anyone" path |
| List building (cap) | Building favorite lists is **unlimited for all members** — no free-tier cap on categories or list count; depth of participation is never paywalled |
| Photos | Viewing another member's photos (primary + gallery) **requires premium**; free members see a placeholder/blurred state |
| Messaging | Free members may **send up to 3 messages per day** before hitting the paywall (cap resets daily), and **cannot receive messages** at all while on the free tier (not even a locked preview — just a notice that someone messaged them); premium members send unlimited and receive normally — see §4.1 |
| Monetization | Subscription paywall live at launch (Apple/Google IAP), gating messaging (send cap + receiving) and photo viewing; premium-only categories supported via `Category.isPremiumOnly` |
| Taxonomy seeding | Each launch `EntityType` pre-seeded with a curated list (hundreds to low-thousands of entities); admin tool to add more |
| Moderation | Review queue for user-submitted entities before they go public; ability to reject or merge duplicates |
| Safety baseline | Block/report a profile; report a message; suspend an account — **backend built and live-verified; no mobile UI yet** (see `CLAUDE.md`) |

### 4.1 Membership Tiers

| Capability | Free | Premium |
|---|---|---|
| Build favorite lists | Unlimited | Unlimited |
| Browse / discover matches | Unlimited | Unlimited |
| View other members' photos (primary + gallery) | ❌ | ✅ |
| Swipe (Like/Pass) and match | Unlimited | Unlimited |
| Send messages | Up to 3 per day | Unlimited |
| Receive messages | ❌ | ✅ |

Everything that constitutes the actual *content* of the app — building lists, browsing, matching — is free and uncapped by design, since that's where users spend 90% of their time and it's what makes the taxonomy and matching signal grow. The paywall sits entirely on **communication and photos**, not participation. The free-send cap is **3 messages per rolling day**, resetting daily (midnight in the user's local timezone, TBD vs. UTC) — this is a tunable product parameter, not a hardcoded constant.

### Explicitly out of scope for MVP

- **Camera-roll picker in the app.** The upload *endpoint* now exists (`POST /media/upload`, local disk storage, real files) and is live-verified — but `EditProfileScreen` still takes photo URLs as text, since `expo-image-picker` isn't wired in yet. That's the remaining piece, not the storage/API layer.
- **Animated swipe gesture.** The Like/Pass interaction is button-taps in this pass, not a draggable card-stack gesture (no `react-native-deck-swiper`-style physics). Functionally identical outcome, less polish.
- Long-form "about me" text — the tagline is capped at ~150 characters on purpose; this isn't a bio field by another name.
- Video/voice messaging
- Compatibility score caching, trending/personalized category ordering (both are read-time computation at MVP, see schema doc §11)
- In-app purchases beyond the subscription (boosts, spotlights, etc.)
- Web app parity — mobile is primary; the "supporting site" is marketing/SEO/admin only, not a full second client
- Multi-language taxonomy (English only at launch)
- Unmatching / blocking a match (schema supports `DECLINED`/`BLOCKED` conversation states; no UI for either yet)

## 5. Key User Flows

1. **Sign up → Onboarding quiz.** New user is walked through a queue of Categories (highest-signal / most fun first — e.g. music, movies before niche verticals like sewing machines). Each card: prompt, autocomplete search, tap-to-add, drag-to-rank, "done" or "skip."
2. **Fill a list.** Type or scroll a pre-ranked/popular list of entities for that type; tap to add; reorder by drag; optional short note per item; save.
3. **Can't find my thing.** No match in autocomplete → "Add '<text>'" → item appears in the user's own list immediately (pending), goes to moderation in the background.
4. **Swipe.** See one candidate profile at a time — photos (if premium), tagline, a compatibility percentage, 1–3 insight highlights ("You both love The Beatles"), and their public lists. Pass or Like. A profile already swiped (either direction) never appears again.
5. **Match.** If the other profile already liked you back (or does so later), the Like completes a mutual match: a Conversation is created immediately and both members see a match moment. There is no separate "accept the conversation" step — matching *is* the consent.
6. **Message.** Free members can send up to 3 messages per day, only within conversations that exist because of a match; the 4th send attempt of the day routes to the paywall and the cap resets at the next day boundary. Free members cannot receive messages at all — an incoming message surfaces only as a locked notification ("Someone messaged you — go premium to receive messages"), with no preview of sender or content. Premium members send and receive without limits.
7. **View a photo.** Tapping another member's photo as a free user shows a blurred/locked state with an upgrade prompt; premium members see it directly.
8. **Upgrade.** Paywall triggered by the free-send cap, an incoming-message notification, a locked photo, a premium-only category, or a dedicated upsell screen; purchase via App Store/Play Store; unlock is immediate on purchase confirmation.

## 6. Non-Functional Requirements

- **Autocomplete latency:** perceived-instant (<150ms) on every keystroke for the primary search path — this is the single most performance-sensitive interaction in the app since it's used constantly.
- **Taxonomy integrity:** no user ever sees an unmoderated entity except their own pending submission (see schema doc §5.3 visibility rule).
- **Data correctness over cleverness:** every foreign-key-shaped relationship in the data model is an enforced relation, not an implicit convention (see schema doc §12).
- **Mobile IAP compliance:** subscription entitlement checks must work fully offline-tolerant (grace periods) per Apple/Google subscription guidelines — no message- or photo-locking flicker on transient network loss.
- **Moderation SLA:** user-submitted entities reviewed within 24 hours at MVP scale (manual queue is acceptable; no ML classifier required yet).

## 7. Success Metrics (MVP)

- **Activation:** % of new sign-ups completing ≥10 Categories in the first session.
- **Depth:** average Categories completed per active profile after week 1.
- **Taxonomy health:** % of entity submissions auto-resolved via alias/high-confidence match vs. requiring manual review; submission-to-approval turnaround time.
- **Monetization:** free → premium conversion rate, broken out by trigger — free-send cap hit, incoming-message notification, or locked photo view — since all three are live paywall funnels at launch.
- **Match quality proxy:** average shared-favorites overlap (and displayed match percentage) between users who form a match vs. random pairs (sanity check that the matching signal is real).
- **Swipe-to-match rate:** Likes ÷ swipes, and matches ÷ Likes — the first real signal on whether the percentage/insight display is actually driving better Like decisions than a bare photo would.

## 8. Open Questions / Risks

- **Cold-start taxonomy gaps:** if a user's niche interest has no seed data, does onboarding feel broken before the moderation queue catches up? Mitigate by seeding generously in high-traffic categories first and fast-tracking obvious approvals (exact alias match).
- **Compatibility algorithm trust:** MVP overlap scoring is simple (rarity-weighted shared items); needs real user feedback before investing in the Phase 2 vector/embedding approach.
- **Message-gating backlash:** capping sends at 3/day *and* blocking receiving entirely is a stronger paywall than typical "pay to read only" dating-app models — worth validating this doesn't tank engagement or make the app feel dead to new free users before hardening the mechanic further.
- **Cap reset timezone:** "daily" needs one authoritative clock (likely UTC day boundary, or per-user local day) — pick one before implementation so the cap doesn't feel arbitrary to users near the boundary.
- **Category curation bandwidth:** the product's ceiling is directly tied to how fast new Categories/EntityTypes ship post-launch; needs an owner and a lightweight admin workflow from day one, not just a review queue for existing types.
- **Percentage-score precision theater:** showing "92% Match" implies more precision than a heuristic rarity-weighted formula actually has — worth watching whether users over-trust the number, and whether the exact formula/thresholds need real tuning before or shortly after launch.
- **Bio/photo scope creep:** the tagline and gallery are meant to stay minor relative to lists — if usage data shows people gravitating to the photo/tagline over list-building, that's a signal the "lists are still the majority of the content" bet (§3) needs revisiting, not just a UI tweak.

## 9. Parking Lot (post-MVP, not scoped)

- Real photo upload (camera roll / library picker + storage provider + upload endpoint)
- Animated, gesture-driven swipe card stack
- Unmatch / block-after-match UI (schema already supports it via `ConversationStatus`)
- Personalized category-ordering / recommendation queue
- Icebreaker mechanic built on shared list overlap
- Public SEO category pages on the supporting site
- Boosts/spotlights and other one-off IAP
- Non-English taxonomy support
