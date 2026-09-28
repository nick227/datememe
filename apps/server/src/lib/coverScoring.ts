import OpenAI from 'openai'
import sharp from 'sharp'
import { cardVariant, type ImageMetrics, technicalQuality } from './coverImage'

// Model-assisted list cover scoring. The model proposes search briefs and
// rates images; code decides (combineScore) and never lets the model pick
// identities or write data. Model is COVER_MODEL (default gpt-4o-mini).

const MODEL = process.env.COVER_MODEL || 'gpt-4o-mini'
let client: OpenAI | null = null
function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')
  return (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 2 }))
}

export type ListContext = { title: string; prompt: string; values: string[]; brief?: string }

/** 3 more Openverse briefs: 2-3 words, photographable, unambiguous, distinct from the current one. */
export async function generateBriefs(list: ListContext): Promise<string[]> {
  const response = await openai().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You write stock-photo search queries for the cover image of a list in a dating app. Each query is 1-2 plain nouns (3 at most) naming a photographable scene or object, like "chocolate cake" or "record store" — every word must appear in the photo title, so never add adjectives like warm, rich, creamy, cozy or vibrant, with no brand, product, character or person names and no words with a common second meaning (e.g. "sprinter" also means a van, "arcade" also means architecture). Make the three queries visually different from each other and from the current one.' },
      { role: 'user', content: `List: ${list.title}\nQuestion: ${list.prompt}\nExample answers: ${list.values.slice(0, 8).join(', ')}\nCurrent query: ${list.brief ?? '(none)'}` },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'briefs', strict: true, schema: { type: 'object', additionalProperties: false, required: ['queries'], properties: { queries: { type: 'array', items: { type: 'string' } } } } } },
    max_tokens: 200,
  })
  const queries: string[] = JSON.parse(response.choices[0]?.message?.content ?? '{"queries":[]}').queries
  return queries.map((q) => q.trim().toLowerCase()).filter((q) => q && q.split(/\s+/).length <= 3).slice(0, 3)
}

/** Bump when the rating prompt or schema changes, so cached ratings are redone. */
export const RATING_VERSION = 4

export type VisionRating = {
  relevance: number; cropSurvival: number; appeal: number
  isPhotograph: boolean; people: 'none' | 'incidental' | 'identifiable'; textOrLogo: 'none' | 'minor' | 'prominent'; sensitive: boolean
  /** One lowercase singular noun for the main subject ("microphone", "cat") — two lists never share one. */
  subject: string
  reason: string
}

const RATING_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['relevance', 'cropSurvival', 'appeal', 'isPhotograph', 'people', 'textOrLogo', 'sensitive', 'subject', 'reason'],
  properties: {
    relevance: { type: 'integer', description: '0-10: how clearly the image evokes THIS list at a glance. Clearly related is enough for 7+; below 5 means unrelated, misleading or confusing (chess pieces for video games)' },
    cropSurvival: { type: 'integer', description: '0-10: does the second image (the 3:4 card crop) still show the subject well' },
    appeal: { type: 'integer', description: '0-10: would this make someone want to open the list (light, composition, mood)' },
    isPhotograph: { type: 'boolean', description: 'false only for digital illustration, cartoon drawing, clip art, vector graphics, 3D renders and screenshots. A photo of anything (a painting, sculpture, toy, poster on a wall) is true' },
    people: { type: 'string', enum: ['none', 'incidental', 'identifiable'], description: 'identifiable = a recognizable face is a main subject' },
    textOrLogo: { type: 'string', enum: ['none', 'minor', 'prominent'], description: 'visible text, signage and brand logos (a photographed character or toy is fine)' },
    sensitive: { type: 'boolean', description: 'tragedy, violence, protest, medical, suggestive or otherwise inappropriate for a friendly cover' },
    subject: { type: 'string', description: 'the main subject as ONE lowercase singular noun, as generic as possible ("microphone", "cat", "trophy", "crowd", "graffiti")' },
    reason: { type: 'string', description: 'one short sentence' },
  },
}

const dataUrl = async (b: Buffer, width: number) => `data:image/jpeg;base64,${(await sharp(b).resize({ width, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer()).toString('base64')}`

/** Rates one image for one list. Sends a small copy and its 3:4 card crop. */
export async function rateImage(list: ListContext, image: Buffer): Promise<VisionRating> {
  const card = (await cardVariant(image, 300)).buffer
  const response = await openai().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You judge candidate cover photos for a list in a dating app. Be strict: a cover must make the list recognizable at a glance, look good, and still work when cropped to a 3:4 portrait card. Prefer real photos without recognizable faces, text or logos.' },
      { role: 'user', content: [
        { type: 'text', text: `List: ${list.title}\nQuestion: ${list.prompt}\nExample answers: ${list.values.slice(0, 8).join(', ')}\nImage 1 is the photo; image 2 is its 3:4 card crop.` },
        { type: 'image_url', image_url: { url: await dataUrl(image, 512), detail: 'low' } },
        { type: 'image_url', image_url: { url: await dataUrl(card, 300), detail: 'low' } },
      ] },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'cover_rating', strict: true, schema: RATING_SCHEMA } },
    max_tokens: 300,
  })
  return JSON.parse(response.choices[0]?.message?.content ?? '{}') as VisionRating
}

export type CoverScore = { score: number; rejected: string | null; flags: string[] }

/**
 * 0-100 from the vision rating (75%) and technical quality (25%), with fixed
 * penalties. Hard rejects are never auto-approved or proposed.
 */
export const subjectKey = (subject: string) => subject.trim().toLowerCase().split(/\s+/).pop()!.replace(/(?<=[^s])s$/, '')

export function combineScore(rating: VisionRating, metrics: ImageMetrics, realSize?: { width: number; height: number }): CoverScore {
  const technical = technicalQuality(realSize ? { ...metrics, ...realSize } : metrics)
  const flags = [...technical.issues]
  if (!rating.isPhotograph) return { score: 0, rejected: 'not a photograph', flags }
  if (rating.sensitive) return { score: 0, rejected: 'sensitive content', flags }
  if (technical.issues.some((i) => /transparent|extreme|too dark/.test(i))) return { score: 0, rejected: technical.issues.join(', '), flags }
  let score = 45 * (rating.relevance / 10) + 15 * (rating.cropSurvival / 10) + 15 * (rating.appeal / 10) + 25 * (technical.score / 100)
  if (rating.people === 'identifiable') { score -= 8; flags.push('identifiable person') }
  if (rating.textOrLogo === 'prominent') { score -= 20; flags.push('prominent text or logo') }
  if (rating.textOrLogo === 'minor') score -= 5
  if (technical.issues.includes('black & white')) score -= 8
  if (technical.issues.includes('blurry')) score -= 10
  return { score: Math.max(0, Math.round(score)), rejected: null, flags }
}
