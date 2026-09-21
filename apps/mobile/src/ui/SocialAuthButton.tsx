import { StyleSheet, Text, View } from 'react-native'
import { Button } from './Button'
import { Typography } from './Typography'
import { borderWidth, colors, spacing } from '../theme'

/**
 * Not a real "Sign in with Google" button — no OAuth is wired up yet. A
 * plain "G" badge rather than Google's actual logo, since this is a
 * placeholder for the real thing, not a rendering of Google's brand mark.
 * onPress is the caller's job (each auth screen already owns an
 * ActionSheet — this stays presentational, no state of its own).
 */
export function GoogleAuthButton({ onPress }: { onPress: () => void }) {
  return <Button label="Continue with Google" variant="secondary" icon={<GoogleGlyph />} onPress={onPress} />
}

function GoogleGlyph() {
  return (
    <View style={styles.glyph}>
      <Text style={styles.glyphText}>G</Text>
    </View>
  )
}

export function OrDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Typography variant="label" style={{ color: colors.inkMuted }}>OR</Typography>
      <View style={styles.dividerLine} />
    </View>
  )
}

const styles = StyleSheet.create({
  glyph: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  glyphText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
})
