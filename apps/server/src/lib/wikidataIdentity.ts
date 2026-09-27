// An entity's Wikidata identity is its EntityExternalRef row with provider
// 'wikimedia'. media:sync only fetches images for identities that carry a
// `verification` record in that row's metadata — how the QID was confirmed:
//
//   fixture      reviewed by hand in taxonomyMediaFixtures.ts
//   auto-strict  media:identify: exact name/alias match + allowed Wikidata class + the only such item
//   review       a human approved it from catalog/review/identities.json
//   admin        an admin attached an image for this QID in the admin UI
//
// Several writers touch the same metadata JSON, so every write merges.

import type { Prisma } from '@project/db'

export const IDENTITY_PROVIDER = 'wikimedia'

export type VerificationMethod = 'fixture' | 'auto-strict' | 'review' | 'admin'
export type IdentityVerification = { method: VerificationMethod; at: string; note?: string }

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function verificationOf(metadata: unknown): IdentityVerification | undefined {
  const v = asObject(metadata).verification as IdentityVerification | undefined
  return v?.method ? v : undefined
}

export function verification(method: VerificationMethod, note?: string): IdentityVerification {
  return { method, at: new Date().toISOString(), ...(note ? { note } : {}) }
}

/** Merge into a ref's metadata. Pass `sameIdentity: false` when the QID changes: the old identity's records don't carry over. */
export function mergeRefMetadata(existing: unknown, patch: Record<string, unknown>, sameIdentity = true): Prisma.InputJsonObject {
  return { ...(sameIdentity ? asObject(existing) : {}), ...patch } as Prisma.InputJsonObject
}
