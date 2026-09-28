import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { db } from '@project/db'
import { TaxonomyMediaService } from './TaxonomyMediaService'
import type { ImageCandidate } from './imageProviders'
import { coverDecisionOf, recordCoverDecision, DERIVED_COVER } from '../lib/categoryCovers'
import { findCoverCandidates, isGood, liveDeps, takenByCatalog } from '../lib/coverSuggest'
import { subjectKey } from '../lib/coverScoring'
import { wikimediaSizedUrl } from '../lib/imageHosts'
import { isServableAsset } from '../lib/mediaIntegrity'
import { mergeRefMetadata } from '../lib/wikidataIdentity'

// A list's cover, from the admin app: suggest candidates (the cover
// automation for one list), use one, go without, or undo. Every change is a
// cover decision (Category.metadata.cover) plus the matching primary asset,
// so media-sync and the automation agree with what the admin chose.
//
// Suggestion runs in this process after the request returns (~20–40 s: four
// Openverse searches, thumbnails, model ratings); its state lives in
// Category.metadata.coverSuggest and the app polls it. A run that outlives a
// restart shows as failed after STALE_MS.

const media = new TaxonomyMediaService()
const STALE_MS = 10 * 60 * 1000
const BRIEFS_FILE = resolve(__dirname, '../../../../catalog/cover-briefs.json')

export type SuggestedCover = {
  id: string; title: string; creator?: string; license: string; licenseVersion?: string; licenseUrl?: string; attribution?: string
  url: string; thumbnail: string; landingUrl?: string; width: number; height: number; source?: string
  score: number; subject: string; reason: string; good: boolean
}
export type CoverSuggestState =
  | { status: 'running'; at: string }
  | { status: 'done'; at: string; candidates: SuggestedCover[]; rejected: Record<string, number> }
  | { status: 'failed'; at: string; error: string }

type Actor = { id: string; role: string }

async function patchMetadata(categoryId: string, patch: Record<string, unknown>) {
  const { metadata } = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { metadata: true } })
  await db.category.update({ where: { id: categoryId }, data: { metadata: mergeRefMetadata(metadata, patch) } })
}

function briefFor(slug: string): string | undefined {
  try { return existsSync(BRIEFS_FILE) ? JSON.parse(readFileSync(BRIEFS_FILE, 'utf8'))[slug] : undefined } catch { return undefined }
}

export class ListCoverService {
  suggestState(metadata: unknown): CoverSuggestState | null {
    const state = (metadata as any)?.coverSuggest as CoverSuggestState | undefined
    if (!state) return null
    if (state.status === 'running' && Date.now() - Date.parse(state.at) > STALE_MS) return { status: 'failed', at: state.at, error: 'Suggestion was interrupted; try again.' }
    return state
  }

  /** Starts a suggestion run unless one is in flight. `autoApply` uses the best candidate when it clears the bar and the list has no cover decision. */
  async suggest(categoryId: string, actor: Actor, opts: { autoApply?: boolean } = {}) {
    const { metadata } = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { metadata: true } })
    const current = this.suggestState(metadata)
    if (current?.status === 'running') return current
    const state: CoverSuggestState = { status: 'running', at: new Date().toISOString() }
    await patchMetadata(categoryId, { coverSuggest: state })
    void this.run(categoryId, actor, opts.autoApply ?? false)
    return state
  }

  private async run(categoryId: string, actor: Actor, autoApply: boolean) {
    try {
      const c = await db.category.findUniqueOrThrow({
        where: { id: categoryId },
        select: { slug: true, shortLabel: true, prompt: true, metadata: true, curatedEntities: { select: { entity: { select: { canonicalName: true } } }, orderBy: { sortOrder: 'asc' }, take: 8 } },
      })
      const rejected: Record<string, number> = {}
      const scored = await findCoverCandidates(
        c.slug,
        { title: c.shortLabel, prompt: c.prompt, values: c.curatedEntities.map((e) => e.entity.canonicalName), brief: briefFor(c.slug) },
        coverDecisionOf(c.metadata)?.id,
        await takenByCatalog(),
        liveDeps(),
        (why) => { rejected[why] = (rejected[why] ?? 0) + 1 },
      )
      const candidates: SuggestedCover[] = scored.slice(0, 6).map((s) => ({
        ...s.candidate, score: s.score, subject: subjectKey(s.rating.subject), reason: s.rating.reason, good: isGood(s),
      }))
      await patchMetadata(categoryId, { coverSuggest: { status: 'done', at: new Date().toISOString(), candidates, rejected } })
      const decided = coverDecisionOf((await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { metadata: true } })).metadata)
      if (autoApply && !decided && candidates[0]?.good) await this.use(categoryId, candidates[0].id, actor, { auto: true })
    } catch (error: any) {
      await patchMetadata(categoryId, { coverSuggest: { status: 'failed', at: new Date().toISOString(), error: error?.message ?? String(error) } }).catch(() => {})
    }
  }

  /** Uses one of the list's suggested candidates as its cover. */
  async use(categoryId: string, candidateId: string, actor: Actor, opts: { auto?: boolean } = {}) {
    const { metadata } = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { metadata: true } })
    const state = this.suggestState(metadata)
    const pick = state?.status === 'done' ? state.candidates.find((c) => c.id === candidateId) : undefined
    if (!pick) throw { statusCode: 404, message: 'That image is not one of this list\'s suggestions; suggest again.' }
    // Someone may have taken it for another list since the suggestion ran.
    const holder = (await takenByCatalog()).ids.get(pick.id)
    const self = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { slug: true } })
    if (holder && holder !== self.slug) throw { statusCode: 409, message: 'That image is already another list\'s cover.' }
    const { score, reason, good: _good, ...candidate } = pick
    const cover = await recordCoverDecision(categoryId, {
      status: 'approved', provider: 'openverse', ...candidate,
      ...(opts.auto ? { auto: { score, reason, subject: pick.subject, model: process.env.COVER_MODEL || 'gpt-4o-mini' } } : { chosenBy: actor.id }),
    })
    await this.materialize(categoryId, cover, actor)
    return cover
  }

  async none(categoryId: string, actor: Actor) {
    const cover = await recordCoverDecision(categoryId, { status: 'none', chosenBy: actor.id })
    await this.materialize(categoryId, cover, actor)
    return cover
  }

  /** Back to the previous decision (which becomes the new "previous", so undo can be undone). */
  async revert(categoryId: string, actor: Actor) {
    const { metadata } = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { metadata: true } })
    const previous = coverDecisionOf(metadata)?.replaced
    if (!previous?.status) throw { statusCode: 409, message: 'There is no previous cover to go back to.' }
    const { at: _at, ...restored } = previous
    const cover = await recordCoverDecision(categoryId, restored as any)
    await this.materialize(categoryId, cover, actor)
    return cover
  }

  /** Makes the primary asset match the decision, importing an approved image if it isn't stored yet. */
  async materialize(categoryId: string, cover: Record<string, any>, actor: Actor): Promise<void> {
    const demoteOthers = (keepId?: string) => db.$transaction([
      db.mediaAsset.deleteMany({ where: { categoryId, sourceType: DERIVED_COVER, ...(keepId ? { id: { not: keepId } } : {}) } }),
      db.mediaAsset.updateMany({ where: { categoryId, isPrimary: true, ...(keepId ? { id: { not: keepId } } : {}) }, data: { isPrimary: false } }),
    ])
    if (cover.status === 'none') { await demoteOthers(); return }
    const existing = cover.status === 'asset'
      ? await db.mediaAsset.findFirst({ where: { id: cover.assetId, categoryId } })
      : await db.mediaAsset.findFirst({ where: { categoryId, provider: cover.provider, sourceId: cover.id }, orderBy: { createdAt: 'desc' } })
    if (existing && isServableAsset(existing)) {
      await demoteOthers(existing.id)
      await db.mediaAsset.update({ where: { id: existing.id }, data: { isPrimary: true } })
      return
    }
    if (cover.status === 'asset') throw { statusCode: 409, message: 'That image is no longer stored; choose another cover.' }
    await importApprovedCover(categoryId, cover, actor)
  }
}

/**
 * Downloads an approved Openverse cover at cover quality and makes it the
 * list's primary asset (with its 3:4 card). Commons throttles bursts (429),
 * so those are retried. Also used by media-sync.
 */
export async function importApprovedCover(categoryId: string, cover: Record<string, any>, actor: Actor, attempt = 0): Promise<unknown> {
  const candidate: ImageCandidate = {
    // A sized Commons copy, not the (often huge, throttled) original.
    provider: cover.provider, externalId: cover.id, title: cover.title, previewUrl: wikimediaSizedUrl(cover.url, cover.width), sourceUrl: cover.url, landingUrl: cover.landingUrl,
    creator: cover.creator, license: cover.license, licenseUrl: cover.licenseUrl, attribution: cover.attribution,
    importRule: 'IMPORT_ALLOWED', metadata: { approvedCover: true, source: cover.source },
  }
  try {
    return await media.importAndAttach({ categoryId }, candidate, actor.id, actor.role, { maxDimension: 1600 })
  } catch (error: any) {
    if (attempt < 3 && /returned 429/.test(error?.message ?? '')) {
      await new Promise((r) => setTimeout(r, 60_000 * (attempt + 1)))
      return importApprovedCover(categoryId, cover, actor, attempt + 1)
    }
    throw error
  }
}
