/**
 * The one identity key (slug) derivation for catalog names. Unicode-aware:
 * "Pelé" -> "pelé", "Nikola Jokić" -> "nikola-jokić". Code owns this key;
 * AI output never supplies it.
 */
export function key(value: string) {
  return value.normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

/** The ASCII-only slugify the list importer used before 2026-09-27 ("Pelé" -> "pel"). Lookup only. */
export function legacyAsciiKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
