import { afterEach, describe, expect, it, vi } from 'vitest'
import { serializeProfile } from '../lib/serializers'

const profile = {
  id: 'profile', userId: 'user', username: 'sam', displayName: 'Sam',
  birthdate: new Date('1995-09-29T12:00:00Z'),
  avatarUrl: 'https://example.com/main.jpg',
  photos: [{ url: 'https://example.com/second.jpg' }],
}

afterEach(() => vi.useRealTimers())

describe('profile age and photo serialization', () => {
  it('shows the current age without exposing the birthdate', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'))
    const result = serializeProfile(profile, { revealPhoto: true })
    expect(result.age).toBe(30)
    expect(result).not.toHaveProperty('birthdate')
    expect(result.photos).toEqual(['https://example.com/second.jpg'])
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z'))
    expect(serializeProfile(profile, { revealPhoto: true }).age).toBe(31)
  })

  it('keeps photos gated when age is visible', () => {
    const result = serializeProfile(profile, { revealPhoto: false })
    expect(result.age).toEqual(expect.any(Number))
    expect(result.avatarUrl).toBeNull()
    expect(result.photos).toEqual([])
    expect(result.photosLocked).toBe(true)
    expect(result).not.toHaveProperty('birthdate')
  })
})
