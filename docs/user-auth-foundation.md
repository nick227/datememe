# User/Auth foundation

Scope: consolidate existing behavior before Phase 7. No grant/promotion/coupon schema, entitlement administration, additional tiers, or new premium rules are implemented here.

## Vocabulary and contracts

- **Principal:** a small authenticated identity on `request.user`: `id` (User ID), `profileId` (nullable Profile ID), role, verification and account-state fields. Session authentication loads no photos, subscription collections or entitlement usage counters. Route handlers use a typed `AuthenticatedRequest`; identity fields are not `any`.
- **Membership:** FREE or MEMBER with all currently qualifying subscription source IDs and expiry dates. Existing MANUAL subscriptions are labeled honestly as `MANUAL_SUBSCRIPTION`, not paid purchases. No claim is made that grants already exist.
- **Entitlements:** named typed feature permissions and product limits, resolved in `lib/entitlements.ts`. Only currently enforced rules are included: full photos, incoming messages, daily sends, Member-only lists. FREE incoming reading remains disabled to preserve current behavior; the approved enabled default is pending Phase 7.
- **Capabilities:** contextual authorization stays with the operation: authentication/account access, required role/profile, conversation participation, blocks, list visibility and content moderation. MEMBER and UNLIMITED never bypass these checks. No speculative capability framework or eagerly loaded context object.

`request.user.id` always refers to User; `requireProfileId(request.user)` returns Profile or throws a deliberate 403. HTTP path IDs such as `/profiles/:profileId` remain Profile IDs. Ownership/participant/block queries use Profile IDs; billing, sessions and audit actors use User IDs.

`resolveUserContext(userId)` builds the canonical `/auth/me` representation. Existing identity/profile fields remain at their existing paths, with `account`, `membership`, and `entitlements` added. Login/register serialize the same contract. The OpenAPI schema and generated SDK include all fields to prevent Fastify silently stripping role or entitlement state. Clients consume `useCurrentUser()` (`['me']`); no new current-user endpoint or second cache was added.

## Audit and old → new map

| Area | Previous path/convention | Consolidated path |
|---|---|---|
| Session creation | AuthService, random opaque token stored in Session; no JWT | Retained; no payment/role claims embedded in token |
| Session extraction | Cookie/Bearer parsing repeated in hooks/logout | `sessionToken`; cookie priority retained; malformed Authorization rejected |
| Request identity | Full Prisma user including password hash and full profile | Selected Principal fields only, typed on FastifyRequest |
| Authentication hooks | bearerAuth and adminAuth; special async arity requirements | Same hook names, two parameters; admin delegates to `requireRole` |
| Account suspension | Separate login and request checks | `requireAccountAccess` reused by login, auth and bootstrap |
| Verification | AuthService verification workflow and client badge | Retained as identity state; no new verification prerequisite |
| Soft deletion | `deletedAt` exists but was not an authentication gate | Exposed as account state; policy unchanged pending explicit decision |
| Profile lookup | Repeated `request.user.profile.id`; historical profileId ambiguity | `requireProfileId` on every profile-oriented handler, including quick picks |
| Premium decision | `isPremiumUser` boolean used across services | Removed; `resolveMembership` for status, `resolveEntitlements` for feature rules |
| Photos | Premium boolean in profile/discovery/feed/conversation serialization | `profile.fullPhotoAccess` at every existing gate; owner exception retained |
| Lists | Premium boolean for PREMIUM_ONLY list visibility | `lists.memberOnly`; owner/privacy/block rules retained |
| Messaging | Same premium boolean for photos, reading, sending; 3 hardcoded in service/UI | Independent feature keys; centralized daily policy and `enforceLimit`; server error supplies UI text |
| Client membership | Account/paywall derive status from `/subscriptions/me` | Canonical `/auth/me` membership; purchase invalidates `['me']` |
| Login bootstrap | Hook refetch before native token persistence, followed by screen refetch | Screen persists credentials before triggering bootstrap; hook no longer races |
| Admin identity | Cookie session, `/auth/me`, local role presentation check | Retained; server role check remains authoritative |
| Billing reads/writes | SubscriptionService plus Admin plan/reporting/override handlers | Retained as billing/administration, not feature authorization |
| Manual overrides | Can rewrite an existing subscription | Explicitly deferred with grant migration; this pass does not alter billing data |

Frontend inventory: RootNavigator, profile/account, edit profile, discovery/list/messaging screens use the existing shared `useCurrentUser` query. Admin has a separate application bootstrap via the same `/auth/me` endpoint. `useMySubscription` remains a billing hook for compatibility; it no longer decides the mobile membership badge. No independent membership cache was added. Token storage remains platform-specific (SecureStore/native, localStorage/web); credential transport and token persistence are not membership concerns.

Category `isPremiumOnly` metadata is not an existing universal access gate; this pass does not silently introduce one. Discovery match limits, filters, new-conversation limits and live video rules are likewise deferred.

## Verification

Real database + Fastify/OpenAPI integration tests cover Login → `/auth/me` → protected profile/conversation reads, cookie/Bearer parity, role serialization and changes, suspension, missing profiles, expired/malformed/revoked sessions, manual/paid overlap, archived-plan membership, expiry, daily send limit, blocked MEMBER sends and protected photo/message/attachment redaction. Existing suites remain in place.

`pnpm build` builds DB, Admin, server and worker; mobile has no `build` script. Mobile typechecking independently hits a compiler stack overflow. Increasing the Node stack reveals existing errors in MatchFeedCard/QuickPicksScreen (StyleSheet API), RankingBoard/RankingBoardOption (theme/typography), ListBuilderScreen (missing style), and ConversationScreen (attachment input/navigation types). These are not hidden by a successful root build.

Known existing limits remain: media storage exposes public URLs once known; payload redaction is not storage authorization. Daily sends use count-then-write, not an atomic quota reservation. No new deletion/verification enforcement, payment validation, or manual-grant migration is claimed.
