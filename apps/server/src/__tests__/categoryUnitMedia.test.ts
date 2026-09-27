import { describe, expect, it } from 'vitest'
import { toCategoryUnit } from '../services/ContentFeedService'

const category = (id: string, imageUrl: string | null = null) => ({ id, slug: id, shortLabel: id, prompt: '?', popularityCount: 0, imageUrl })
const candidates = ['a', 'b', 'c'].map((k) => ({ id: k, imageUrl: `https://img/${k}.webp`, imageCredit: null }))

describe('toCategoryUnit fallback art', () => {
  it("keeps a category's own image", () => {
    const unit = toCategoryUnit(category('own', 'https://img/own.webp'), { completed: false, mediaCandidates: candidates, usedMedia: new Set() })
    expect(unit.imageUrl).toBe('https://img/own.webp')
  })

  it('borrows an image from its ranked entities, never repeating one within a feed', () => {
    const used = new Set<string>()
    const images = ['x', 'y', 'z'].map((id) => toCategoryUnit(category(id), { completed: false, mediaCandidates: candidates, usedMedia: used }).imageUrl)
    expect(new Set(images).size).toBe(3)
    for (const url of images) expect(candidates.map((c) => c.imageUrl)).toContain(url)
  })

  it('picks the same image for the same category and page', () => {
    const pick = () => toCategoryUnit(category('stable'), { completed: false, mediaCandidates: candidates, usedMedia: new Set(), feedPage: 0 }).imageUrl
    expect(pick()).toBe(pick())
  })

  it('is unchanged when no candidates are passed', () => {
    expect(toCategoryUnit(category('bare'), { completed: false }).imageUrl).toBeNull()
  })
})
