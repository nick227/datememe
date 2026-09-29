const EVENT_TYPES = new Set(['PROFILE_LIKED', 'PROFILE_LIKED_YOU', 'MATCH', 'LIST_COMPLETED', 'ACTIVITY_DIGEST'])
const CTA_ROUTES = new Set(['ProfileDetail', 'Conversation', 'ListBuilder', 'Activity'])
const EVENT_FIELDS = ['profileId', 'conversationId', 'categoryId', 'categorySlug', 'listId', 'insightSetId'] as const
const PARAM_FIELDS = ['profileId', 'displayName', 'conversationId', 'categorySlug', 'shortLabel', 'insightSetId'] as const

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value)

function pickStrings(source: JsonObject, keys: readonly string[]) {
  const picked: Record<string, string> = {}
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') picked[key] = value
  }
  return picked
}

function canonicalPayload(stored: JsonObject): JsonObject | null {
  if (typeof stored.eventKey === 'string' && isObject(stored.event)) return stored
  if (typeof stored.insightSetId !== 'string') return null
  return {
    eventKey: `insight:${stored.insightSetId}`,
    event: { type: 'ACTIVITY_DIGEST', insightSetId: stored.insightSetId },
    cta: stored.cta,
    notify: stored.notify,
  }
}

/** Map the attachments column of an Activity event onto the public systemData object. */
export function toSystemData(stored: unknown) {
  if (!isObject(stored)) return null
  const payload = canonicalPayload(stored)
  if (!payload || !isObject(payload.event) || typeof payload.eventKey !== 'string') return null
  const eventType = payload.event.type
  if (typeof eventType !== 'string' || !EVENT_TYPES.has(eventType)) return null

  const data: JsonObject = {
    eventKey: payload.eventKey,
    event: { type: eventType, ...pickStrings(payload.event, EVENT_FIELDS) },
  }
  if (typeof payload.notify === 'boolean') data.notify = payload.notify

  const cta = payload.cta
  if (!isObject(cta) || typeof cta.label !== 'string' || typeof cta.route !== 'string' || !CTA_ROUTES.has(cta.route)) {
    return data
  }
  data.cta = {
    label: cta.label,
    route: cta.route,
    params: isObject(cta.params) ? pickStrings(cta.params, PARAM_FIELDS) : {},
  }
  return data
}
