import type { components } from '@project/sdk'

export type ProfileAttributeKey = components['schemas']['ProfileAttributeKey']

export const PROFILE_ATTRIBUTE_GROUPS: {
  title: string
  options: { value: ProfileAttributeKey; label: string }[]
}[] = [
  {
    title: 'Seeking',
    options: [
      { value: 'DATING', label: 'Dating' },
      { value: 'FRIEND', label: 'Friends' },
      { value: 'RELATIONSHIP', label: 'Relationship' },
      { value: 'COLLABORATOR', label: 'Collaborator' },
      { value: 'COFFEE', label: 'Coffee' },
      { value: 'MARRIAGE', label: 'Marriage' },
      { value: 'ONLINE', label: 'Online' },
      { value: 'MEN', label: 'Men' },
      { value: 'WOMEN', label: 'Women' },
      { value: 'NONBINARY', label: 'Nonbinary' },
      { value: 'OTHER', label: 'Other' },
      { value: 'NOT_SPECIFIED', label: 'None of the above' },
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
