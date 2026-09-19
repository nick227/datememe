type CursorPayload = {
  createdAt: string
  id: string
}

export function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw { statusCode: 400, message: 'Invalid cursor' }
  }
}

export function normalizeLimit(limit?: number, max = 100, fallback = 20) {
  return Math.min(Math.max(Number(limit ?? fallback), 1), max)
}

/**
 * Simpler opaque cursor for result sets ranked by relevance/popularity rather than
 * chronological order (autocomplete, discovery) — encodes a plain row offset instead
 * of a {createdAt, id} pair. Still opaque to the client; still cheap at MVP result-set sizes.
 */
export function encodeOffsetCursor(offset: number) {
  return Buffer.from(String(offset)).toString('base64url')
}

export function decodeOffsetCursor(cursor?: string): number {
  if (!cursor) return 0
  try {
    const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!Number.isFinite(n) || n < 0) throw new Error('bad cursor')
    return n
  } catch {
    throw { statusCode: 400, message: 'Invalid cursor' }
  }
}
