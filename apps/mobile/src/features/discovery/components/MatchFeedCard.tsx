import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { MatchPercentageBadge } from './MatchPercentageBadge'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import { hapticMedium, hapticHeavy, hapticLight } from '../../../lib/haptics'
import type { MatchInsight } from '../../../navigation/types'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

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

function ActionButton({ icon, variant, onPress, onAction }: { icon: any, variant: 'pass' | 'like', onPress: () => void, onAction: () => void }) {
  const scale = useSharedValue(1)

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 12, stiffness: 200 })
        onAction()
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 })
      }}
      style={[
        styles.decisionBtn,
        variant === 'pass' ? styles.passBtn : styles.likeBtn,
        style
      ]}
    >
      <Icon name={icon} size={28} color={variant === 'pass' ? colors.inkMuted : colors.white} />
    </AnimatedPressable>
  )
}

export function MatchFeedCard({ displayName, avatarUrl, photos = [], matchPercentage, insights, onPress, onAction }: Props) {
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
    <View style={styles.card}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        {currentPhotoUrl ? (
          <Image source={{ uri: currentPhotoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoLocked]}>
            <Text style={styles.photoLockedText}>{(displayName || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}

        {/* Top interaction zones for gallery */}
        <View style={styles.tapZones}>
          <Pressable style={styles.tapZone} onPress={prevPhoto} />
          <Pressable style={styles.tapZone} onPress={nextPhoto} />
        </View>

        {/* Gallery pagination indicators */}
        {activePhotos.length > 1 && (
          <View style={styles.paginationContainer}>
            {activePhotos.map((_, i) => (
              <View key={i} style={[styles.paginationDot, i === photoIndex && styles.paginationDotActive]} />
            ))}
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.infoRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="title" style={{ color: colors.white }}>{displayName}</Typography>
              </View>
              {matchPercentage != null ? <MatchPercentageBadge percentage={matchPercentage} /> : null}
            </View>

            {primaryInsight ? (
              <View style={styles.insightBox}>
                <Text style={styles.insightIcon}>{primaryInsight.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" style={{ color: colors.white }}>{primaryInsight.title}</Typography>
                  <Typography variant="bodyMuted" numberOfLines={2} style={{ color: 'rgba(255,255,255,0.7)' }}>{primaryInsight.description}</Typography>
                </View>
              </View>
            ) : null}

            <View style={styles.actionsContainer}>
              <View style={styles.decisionActions}>
                <ActionButton 
                  icon="X" 
                  variant="pass" 
                  onAction={() => hapticMedium()}
                  onPress={() => onAction('PASS')} 
                />
                <ActionButton 
                  icon="Heart" 
                  variant="like" 
                  onAction={() => hapticHeavy()}
                  onPress={() => onAction('LIKE')} 
                />
              </View>
              
              <View style={styles.tuningActions}>
                <Pressable style={styles.tuneBtn} onPress={() => { hapticLight(); onAction('LESS_LIKE_THIS') }}>
                  <Typography variant="label" style={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>Less like this</Typography>
                </Pressable>
                <View style={styles.tuneDivider} />
                <Pressable style={styles.tuneBtn} onPress={() => { hapticLight(); onAction('MORE_LIKE_THIS') }}>
                  <Typography variant="label" style={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>More like this</Typography>
                </Pressable>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    overflow: 'hidden',
    ...StyleSheet.absoluteFill,
  },
  photoLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  photoLockedText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 100,
    color: colors.primary,
  },
  tapZones: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    bottom: '40%', // leave bottom 40% for buttons/scrolling
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
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  paginationDotActive: {
    backgroundColor: colors.white,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 100,
  },
  content: {
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  insightBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  insightIcon: {
    fontSize: 20,
  },
  actionsContainer: {
    alignItems: 'center',
  },
  decisionActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  decisionBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  likeBtn: {
    backgroundColor: colors.primary,
  },
  tuningActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tuneBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tuneDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  }
})
