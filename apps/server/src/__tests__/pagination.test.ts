import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor, normalizeLimit, decodeOffsetCursor, encodeOffsetCursor } from '../lib/pagination'

describe('pagination', () => {
  it('round-trips a cursor', () => {
    const payload = { createdAt: '2026-01-01T00:00:00.000Z', id: 'abc123' }
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload)
  })

  it('returns null for an empty cursor', () => {
    expect(decodeCursor(undefined)).toBeNull()
  })

  it('rejects a malformed cursor', () => {
    expect(() => decodeCursor('not-base64url-json')).toThrow()
  })

  it('clamps limit within [1, max]', () => {
    expect(normalizeLimit(undefined)).toBe(20)
    expect(normalizeLimit(500)).toBe(100)
    expect(normalizeLimit(0)).toBe(1)
  })

  it('round-trips an offset cursor', () => {
    expect(decodeOffsetCursor(encodeOffsetCursor(40))).toBe(40)
    expect(decodeOffsetCursor(undefined)).toBe(0)
  })
})
