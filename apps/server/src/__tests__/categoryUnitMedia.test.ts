import { describe, expect, it } from 'vitest'
import { toCategoryUnit } from '../services/ContentFeedService'

describe('toCategoryUnit art', () => {
  it("shows the list's own cover", () => {
    expect(toCategoryUnit({ id: 'a', slug: 'a', shortLabel: 'A', prompt: '?', popularityCount: 0, imageUrl: 'https://img/own.webp' }, { completed: false }).imageUrl).toBe('https://img/own.webp')
  })

  it("never borrows the top pick's image — that is another list's cover", () => {
    const unit = toCategoryUnit({ id: 'b', slug: 'b', shortLabel: 'B', prompt: '?', popularityCount: 3, imageUrl: null, topPick: { imageUrl: 'https://img/pick.webp' } }, { completed: false })
    expect(unit.imageUrl).toBeNull()
  })
})
