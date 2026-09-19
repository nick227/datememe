import { StyleSheet, View } from 'react-native'
import { colors } from '../theme'

// Restrained nod to the masthead collage energy — a few soft, oversized,
// low-opacity color blobs behind the entry-moment screens (auth, loading).
// Not used elsewhere: the signature move should stay rare, not wallpaper.
export function DecorativeBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.blob, styles.coral]} />
      <View style={[styles.blob, styles.lavender]} />
      <View style={[styles.blob, styles.sunshine]} />
    </View>
  )
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  coral: {
    width: 260,
    height: 260,
    top: -80,
    right: -60,
    backgroundColor: colors.primary,
    opacity: 0.14,
  },
  lavender: {
    width: 320,
    height: 320,
    bottom: -120,
    left: -100,
    backgroundColor: colors.lavender,
    opacity: 0.14,
  },
  sunshine: {
    width: 140,
    height: 140,
    top: '38%',
    left: -50,
    backgroundColor: colors.sunshine,
    opacity: 0.16,
  },
})
