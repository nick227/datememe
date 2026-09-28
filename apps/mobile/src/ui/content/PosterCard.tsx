import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Typography } from '../Typography'
import { CardShell } from './CardShell'
import { SmartImage } from './SmartImage'
import { MicroBadge } from './MicroBadge'
import { ImageCredit } from './ImageCredit'
import { colors, spacing } from '../../theme'
import type { CardModel } from './cardModel'

type Props = {
  model: CardModel
  onPress: () => void
  containerStyle?: StyleProp<ViewStyle>
}

export function PosterCard({ model, onPress, containerStyle }: Props) {
  const aspect = model.media?.aspectRatio || (3 / 4)

  return (
    <CardShell testID={`card.${model.id}`} containerStyle={containerStyle} onPress={onPress} radius="grid" noBorder>
      <CardShell.Media style={[styles.imageWrap, { aspectRatio: aspect }]}>
        <SmartImage 
          uri={model.media?.uri} 
          fallbackText={model.title} 
          aspectRatio={aspect} 
          style={StyleSheet.absoluteFill} 
        />
        {model.badge ? (
          <MicroBadge label={model.badge.label} position="top-left" variant={model.badge.variant} />
        ) : null}
      </CardShell.Media>
      <CardShell.Body style={styles.body}>
        <View style={{ gap: spacing.xs }}>
          <Typography 
            variant="heading" 
            style={styles.title} 
            numberOfLines={model.titleLines ?? 1}
          >
            {model.title}
          </Typography>
          <Typography variant="label" style={styles.meta} numberOfLines={1}>
            {model.meta?.value || ' '}
          </Typography>
        </View>
        {model.media?.credit ? <ImageCredit credit={model.media?.credit} /> : null}
      </CardShell.Body>
    </CardShell>
  )
}

const styles = StyleSheet.create({
  imageWrap: { position: 'relative', width: '100%', overflow: 'hidden' },
  body: {
    borderTopWidth: 0,
    padding: spacing.md,
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, lineHeight: 22, marginBottom: 0, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.inkMuted, minHeight: 20 },
})
