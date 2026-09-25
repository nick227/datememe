import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { MatchPercentageBadge } from './MatchPercentageBadge'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { PressableScale } from '../../../ui/PressableScale'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import { hapticLight } from '../../../lib/haptics'
import type { MatchInsight } from '../../../navigation/types'


type Props = {
  profileId: string
  displayName: string
  avatarUrl?: string | null
  photos?: { url: string }[]
  matchPercentage?: number
  insights?: MatchInsight[]
  onPress: () => void
  onAction: (action: 'LIKE' | 'PASS' | 'MORE_LIKE_THIS' | 'LESS_LIKE_THIS') => void
}

function ActionButton({ testID, icon, variant, onPress, onAction }: { testID: string, icon: any, variant: 'pass' | 'like', onPress: () => void, onAction: () => void }) {
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        onAction()
        onPress()
      }}
      scaleTo={0.9}
      duration={100}
      haptic="none" // Action manually controls haptic type in QuickPicks
      style={[
        styles.decisionBtn,
        variant === 'pass' ? styles.passBtn : styles.likeBtn
      ]}
    >
      <Icon name={icon} size={28} color={variant === 'pass' ? colors.inkMuted : colors.white} />
    </PressableScale>
  )
}

export function MatchFeedCard({ profileId, displayName, avatarUrl, photos = [], matchPercentage, insights, onPress, onAction }: Props) {
  const primaryInsight = insights && insights.length > 0 ? insights[0] : null
  const [photoIndex, setPhotoIndex] = useState(0)

  // Use avatarUrl as fallback if no photos
  const activePhotos = photos.length > 0 ? photos.map(p => p.url) : (avatarUrl ? [avatarUrl] : [])
  const currentPhotoUrl = activePhotos[photoIndex]

  function nextPhoto() {
    if (photoIndex < activePhotos.length - 1) {
      setPhotoIndex(photoIndex + 1)
      hapticLight()
    }
  }

  function prevPhoto() {
    if (photoIndex > 0) {
      setPhotoIndex(photoIndex - 1)
      hapticLight()
    }
  }

  return (
    <View testID={`discover.profile.${profileId}`} style={styles.card}>
      <PressableScale testID={`discover.profile.${profileId}.open`} onPress={onPress} scaleTo={0.98} haptic="light">
        <View style={styles.imageWrap}>
          {currentPhotoUrl ? (
            <Image source={{ uri: currentPhotoUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.photoLocked]}>
              <Text style={styles.photoLockedText}>{(displayName || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}

          {/* Top interaction zones for gallery */}
          <View style={styles.tapZones}>
            <Pressable testID={`discover.profile.${profileId}.previous-photo`} style={styles.tapZone} onPress={prevPhoto} />
            <Pressable testID={`discover.profile.${profileId}.next-photo`} style={styles.tapZone} onPress={nextPhoto} />
          </View>

          {/* Gallery pagination indicators */}
          {activePhotos.length > 1 && (
            <View style={styles.paginationContainer}>
              {activePhotos.map((_, i) => (
                <View key={i} style={[styles.paginationDot, i === photoIndex && styles.paginationDotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Typography variant="heading" style={styles.title}>{displayName}</Typography>
            </View>
            {matchPercentage != null ? <MatchPercentageBadge percentage={matchPercentage} /> : null}
          </View>

          {primaryInsight ? (
            <View style={styles.insightBox}>
              <Typography style={styles.insightIcon}>{primaryInsight.icon}</Typography>
              <View style={{ flex: 1 }}>
                <Typography variant="label" style={styles.insightTitle}>{primaryInsight.title}</Typography>
                <Typography variant="bodyMuted" numberOfLines={2}>{primaryInsight.description}</Typography>
              </View>
            </View>
          ) : null}

          <View style={styles.actionsContainer}>
            <View style={styles.decisionActions}>
              <ActionButton testID={`discover.profile.${profileId}.pass`}
                icon="X" 
                variant="pass" 
                onAction={() => hapticMedium()}
                onPress={() => onAction('PASS')} 
              />
              <ActionButton testID={`discover.profile.${profileId}.like`}
                icon="Heart" 
                variant="like" 
                onAction={() => hapticHeavy()}
                onPress={() => onAction('LIKE')} 
              />
            </View>
          </View>
        </View>
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    marginBottom: spacing.lg,
    maxHeight: 600, // Reasonable cap for the main feed card to prevent runaway heights
  },
  imageWrap: {
    position: 'relative',
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.ink,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceMuted,
  },
  photoLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    aspectRatio: 4 / 3, // Restored 4:3 to match actual photos and prevent layout shift
    backgroundColor: colors.surfaceMuted,
  },
  photoLockedText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 40,
    color: colors.inkMuted,
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
  },
  paginationContainer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: 4,
  },
  paginationDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  paginationDotActive: {
    backgroundColor: colors.white,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  insightBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  insightIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  insightTitle: {
    color: colors.ink,
    marginBottom: 2,
  },
  actionsContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  decisionActions: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  decisionBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
  },
  passBtn: {
    backgroundColor: colors.surface,
  },
  likeBtn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
})
