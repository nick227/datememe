import { Linking, Pressable } from 'react-native'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'
import type { ContentUnit } from './types'

export function ImageCredit({ credit }: { credit?: ContentUnit['imageCredit'] }) {
  if (!credit?.attribution) return null
  const url = credit.landingUrl ?? credit.licenseUrl
  return (
    <Pressable accessibilityRole={url ? 'link' : 'text'} accessibilityLabel={`Image credit: ${credit.attribution}`} onPress={(event) => {
      event.stopPropagation()
      if (url) void Linking.openURL(url)
    }} style={{ marginBottom: spacing.sm }}>
      <Typography style={{ fontSize: 10, color: colors.inkMuted }}>{credit.attribution}</Typography>
    </Pressable>
  )
}
