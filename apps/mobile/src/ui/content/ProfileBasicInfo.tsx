import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'

type Props = {
  displayName: string
  age?: number
  genderIdentity?: string | null
  locationLabel?: string | null
  seekingGenders?: string[]
}

function formatValue(val?: string | null) {
  if (!val) return 'Not specified'
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function ProfileBasicInfo({ displayName, age, genderIdentity, locationLabel, seekingGenders }: Props) {
  const primaryLine = [displayName, age].filter(Boolean).join(', ')
  const seekingStr = seekingGenders?.length ? seekingGenders.map(formatValue).join(', ') : 'Not specified'

  return (
    <View style={styles.container}>
      <Typography variant="display" style={styles.primary}>
        {primaryLine}
      </Typography>
      
      <View style={styles.vitalsGrid}>
        <View style={styles.vitalRow}>
          <Typography variant="label" style={styles.vitalLabel}>City</Typography>
          <Typography variant="body" style={styles.vitalValue}>{locationLabel || 'Unknown'}</Typography>
        </View>
        <View style={styles.vitalRow}>
          <Typography variant="label" style={styles.vitalLabel}>Gender</Typography>
          <Typography variant="body" style={styles.vitalValue}>{formatValue(genderIdentity)}</Typography>
        </View>
        <View style={styles.vitalRow}>
          <Typography variant="label" style={styles.vitalLabel}>Seeking</Typography>
          <Typography variant="body" style={styles.vitalValue}>{seekingStr}</Typography>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  primary: {
    color: colors.ink,
    fontSize: 28,
  },
  vitalsGrid: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  vitalLabel: {
    width: 80,
    color: colors.inkMuted,
  },
  vitalValue: {
    flex: 1,
    color: colors.ink,
  }
})
