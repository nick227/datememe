import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Icon } from '../Icon'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'
import { hapticLight } from '../../lib/haptics'

type Props = {
  layout?: 'default' | 'profile'
  photos: string[]
  placeholderInitial: string
  locked?: boolean
  lockedMessage?: string
  matchPercentage?: number
}

export function ProfileImageGallery({ layout = 'default', photos, placeholderInitial, locked, lockedMessage, matchPercentage }: Props) {
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

  if (layout === 'profile') {
    const activeIndex = Math.min(index, Math.max(0, photos.length - 1))
    return (
      <View style={styles.profileGallery}>
        <View style={[styles.profileHero, !hasPhotos && styles.compactHero]}>
          {currentUrl ? (
            <Image source={{ uri: currentUrl }} style={styles.image} resizeMode="cover" accessibilityLabel={`Profile photo ${activeIndex + 1} of ${photos.length}`} />
          ) : (
            <View style={[styles.image, styles.fallback]}>
              {locked ? <Icon name="Lock" size={24} color={colors.inkMuted} /> : null}
              <Typography variant="display" style={styles.fallbackInitial}>{placeholderInitial.toUpperCase()}</Typography>
              <Typography variant="bodyMuted" style={styles.lockedMessage}>
                {locked ? lockedMessage ?? 'Go premium to see photos' : 'No photos yet'}
              </Typography>
            </View>
          )}
          {matchPercentage != null ? (
            <View style={styles.matchPill}>
              <Typography variant="label" style={styles.matchPillText}>{matchPercentage}% Match</Typography>
            </View>
          ) : null}
          {hasPhotos && photos.length > 1 ? (
            <View style={styles.photoCount}>
              <Typography variant="body" style={styles.countText}>{activeIndex + 1} / {photos.length}</Typography>
            </View>
          ) : null}
        </View>
        {hasPhotos && photos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
            {photos.map((url, photoIndex) => (
              <Pressable
                key={`${url}-${photoIndex}`}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${photoIndex + 1}`}
                accessibilityState={{ selected: activeIndex === photoIndex }}
                onPress={() => { setIndex(photoIndex); hapticLight() }}
                style={[styles.thumbnailFrame, activeIndex === photoIndex && styles.selectedThumbnail]}
              >
                <Image source={{ uri: url }} style={styles.thumbnailImage} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
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

      {matchPercentage != null ? (
        <View style={styles.matchPill}>
          <Typography variant="label" style={styles.matchPillText}>{matchPercentage}% Match</Typography>
        </View>
      ) : null}

      {hasPhotos ? (
        <View style={styles.tapZones}>
          <Pressable style={styles.tapZone} onPress={prev} />
          <Pressable style={styles.tapZone} onPress={next} />
        </View>
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.pagination}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.paginationBar, i === index && styles.paginationBarActive]} />
          ))}
        </View>
      ) : null}

      {/* Future reaction placeholder */}
      {hasPhotos ? (
        <View style={styles.reactionZone}>
          <Pressable style={styles.reactionBtn}>
            <Icon name="Heart" size={20} color={colors.ink} />
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  profileGallery: { gap: spacing.sm, backgroundColor: colors.surface },
  profileHero: { width: '100%', aspectRatio: 1.2, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  compactHero: { aspectRatio: 1.8 },
  thumbnails: { gap: spacing.sm, paddingVertical: 2 },
  thumbnailFrame: { width: 68, height: 76, padding: 3, borderRadius: 12, borderWidth: 2, borderColor: colors.transparent },
  selectedThumbnail: { borderColor: colors.accent },
  thumbnailImage: { width: '100%', height: '100%', borderRadius: 7 },
  photoCount: { position: 'absolute', bottom: spacing.md, right: spacing.md, backgroundColor: colors.overlay, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  countText: { color: colors.white, fontSize: 12 },
  wrap: {
    width: '100%',
    aspectRatio: 0.75, // Taller, more minimalist
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative'
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
  reactionZone: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
  },
  reactionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  matchPill: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 16,
  },
  matchPillText: {
    color: colors.white,
    fontSize: 13,
  }
})
