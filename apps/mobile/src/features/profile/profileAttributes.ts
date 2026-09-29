import type { components } from '@project/sdk'

export type ProfileAttributeKey = components['schemas']['ProfileAttributeKey']

export const PROFILE_ATTRIBUTE_GROUPS: {
  title: string
  options: { value: ProfileAttributeKey; label: string }[]
}[] = [
  {
    title: 'Connection',
    options: [
      { value: 'FRIEND', label: 'Friend' },
      { value: 'RELATIONSHIP', label: 'Relationship' },
      { value: 'MARRIAGE', label: 'Marriage' },
    ],
  },
  {
    title: 'Work',
    options: [
      { value: 'COLLABORATOR', label: 'Collaborator' },
      { value: 'BUSINESS_PARTNER', label: 'Business partner' },
      { value: 'INVESTOR', label: 'Investor' },
    ],
  },
  {
    title: 'Creative',
    options: [
      { value: 'ACTOR', label: 'Actor' },
      { value: 'MUSICIAN', label: 'Musician' },
      { value: 'WRITER', label: 'Writer' },
    ],
  },
]

export function formatAttributeKeys(keys: readonly string[]) {
  if (keys.length === 0) return 'Not specified'
  const selected = new Set(keys)
  return PROFILE_ATTRIBUTE_GROUPS
    .flatMap((group) => group.options)
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
    .join(', ')
}
