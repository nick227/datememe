import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../../../theme'

export function SwipeActions({
  onPass,
  onLike,
  disabled,
}: {
  onPass: () => void
  onLike: () => void
  disabled?: boolean
}) {
  return (
    <View style={styles.row}>
      <Pressable style={[styles.button, styles.pass]} onPress={onPass} disabled={disabled}>
        <Text style={styles.passText}>✕</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.like]} onPress={onLike} disabled={disabled}>
        {disabled ? <ActivityIndicator color={colors.white} /> : <Text style={styles.likeText}>♥</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.lg },
  button: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pass: { backgroundColor: colors.surfaceMuted },
  passText: { fontSize: 26, color: colors.inkMuted, fontWeight: '700' },
  like: { backgroundColor: colors.primary },
  likeText: { fontSize: 28, color: colors.white },
})
