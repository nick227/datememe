import { useState, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Typography } from './Typography'
import { borderWidth, colors, spacing } from '../theme'
import { hapticLight } from '../lib/haptics'

type Props = {
  testID?: string
  photos: string[]
  placeholderInitial: string
  // Free-tier viewer looking at someone else's profile — the API already
  // returns an empty `photos`/null `avatarUrl` in that case (docs §8 photo
  // gate); this just renders the honest, on-brand locked state instead of a
  // blank fallback.
  locked?: boolean
  lockedMessage?: string
  topLeft?: ReactNode
  topRight?: ReactNode
  // Rendered inside the bottom gradient scrim, over the photo — name/age/
  // location, the primary identity block for the whole page.
  children?: ReactNode
}

// The one full-bleed photo-gallery hero shared by both profile-facing
// screens (viewing someone else, viewing your own) — paged photos, dot
// pagination, a bottom gradient scrim for text legibility over the image,
// same visual grammar as the Discover swipe card (MatchFeedCard) so a
// profile page and a swipe card read as the same product, not two
// different ones bolted together.
export function ProfileGalleryHero({ testID, photos, placeholderInitial, locked, lockedMessage, topLeft, topRight, children }: Props) {
  const [index, setIndex] = useState(0)
  const hasPhotos = !locked && photos.length > 0
  const currentUrl = hasPhotos ? photos[Math.min(index, photos.length - 1)] : null

  function next() {
    if (index < photos.length - 1) {
      setIndex(index + 1)
      hapticLight()
    }
  }
  function prev() {
    if (index > 0) {
      setIndex(index - 1)
      hapticLight()
    }
  }

  return (
    <View testID={testID} style={styles.wrap}>
      {currentUrl ? (
        <Image source={{ uri: currentUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <Typography variant="display" style={styles.fallbackInitial}>
            {placeholderInitial.toUpperCase()}
          </Typography>
          {locked ? (
            <Typography variant="bodyMuted" style={styles.lockedMessage}>
              {lockedMessage ?? 'Go premium to see photos'}
            </Typography>
          ) : null}
        </View>
      )}

      {hasPhotos ? (
        <View style={styles.tapZones}>
          <Pressable testID={testID ? `${testID}.previous-photo` : undefined} style={styles.tapZone} onPress={prev} />
          <Pressable testID={testID ? `${testID}.next-photo` : undefined} style={styles.tapZone} onPress={next} />
        </View>
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.pagination}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.paginationBar, i === index && styles.paginationBarActive]} />
          ))}
        </View>
      ) : null}

      {topLeft ? <View style={styles.topLeft}>{topLeft}</View> : null}
      {topRight ? <View style={styles.topRight}>{topRight}</View> : null}

      {children ? (
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']} style={styles.gradient}>
          <View style={styles.content}>{children}</View>
        </LinearGradient>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 0.8,
    backgroundColor: colors.ink,
    borderBottomWidth: borderWidth.thick,
    borderBottomColor: colors.ink,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, gap: spacing.sm },
  fallbackInitial: { color: colors.inkMuted, fontSize: 72 },
  lockedMessage: { paddingHorizontal: spacing.xl, textAlign: 'center' },
  tapZones: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  tapZone: { flex: 1 },
  pagination: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', gap: 4 },
  paginationBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  paginationBarActive: { backgroundColor: colors.white },
  topLeft: { position: 'absolute', top: spacing.lg, left: spacing.lg },
  topRight: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 120 },
  content: { padding: spacing.lg },
})
