import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { usePhotoPicker } from '../lib/usePhotoPicker'
import { colors, radius } from '../theme'

type Props = {
  uri?: string | null
  onChange: (url: string) => void
  onRemove?: () => void
  size?: number
  shape?: 'circle' | 'square'
  placeholder?: string
}

/**
 * The reusable "tap to pick a photo" primitive — an avatar circle, a gallery slot,
 * anything that needs "pick a photo, get back a hosted URL" uses this one component
 * rather than each screen wiring expo-image-picker + upload itself.
 */
export function PhotoPicker({ uri, onChange, onRemove, size = 96, shape = 'circle', placeholder }: Props) {
  const { pick, isUploading } = usePhotoPicker()

  async function handlePress() {
    try {
      const url = await pick()
      if (url) onChange(url)
    } catch (err: any) {
      Alert.alert('Could not upload photo', err?.message ?? 'Try again in a moment')
    }
  }

  const shapeStyle = { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : radius.md }

  return (
    <View style={{ width: size, height: size }}>
      <Pressable onPress={handlePress} disabled={isUploading} style={[styles.base, shapeStyle]}>
        {uri ? (
          <Image source={{ uri }} style={[StyleSheet.absoluteFill, shapeStyle]} />
        ) : (
          <View style={[styles.placeholder, shapeStyle]}>
            <Text style={styles.placeholderText}>{placeholder ?? '+'}</Text>
          </View>
        )}
        {isUploading ? (
          <View style={[StyleSheet.absoluteFill, shapeStyle, styles.overlay]}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>{uri ? '✎' : '+'}</Text>
          </View>
        )}
      </Pressable>

      {uri && onRemove && !isUploading ? (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBadge}>
          <Text style={styles.removeBadgeText}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceMuted, overflow: 'hidden', position: 'relative' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  placeholderText: { fontSize: 28, color: colors.primary, fontWeight: '700' },
  overlay: { backgroundColor: 'rgba(22,24,50,0.45)', alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  editBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  removeBadge: {
    position: 'absolute',
    left: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  removeBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
})
