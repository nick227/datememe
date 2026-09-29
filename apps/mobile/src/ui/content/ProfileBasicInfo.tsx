import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'

type Props = {
  displayName: string
  age?: number
  genderIdentity?: string | null
  locationLabel?: string | null
  seekingGenders?: string[]
  isA?: string
  lookingFor?: string
}

function formatValue(val?: string | null) {
  if (!val) return 'Not specified'
  if (val === 'PREFER_NOT_TO_SAY') return 'Prefer not to say'
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function ProfileBasicInfo({ displayName, age, genderIdentity, locationLabel, seekingGenders, isA, lookingFor }: Props) {
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
          <Typography variant="label" style={styles.vitalLabel}>Interested in</Typography>
          <Typography variant="body" style={styles.vitalValue}>{seekingStr}</Typography>
        </View>
        <View style={styles.vitalRow}>
          <Typography variant="label" style={styles.vitalLabel}>I am</Typography>
          <Typography variant="body" style={styles.vitalValue}>{isA || 'Not specified'}</Typography>
        </View>
        <View style={styles.vitalRow}>
          <Typography variant="label" style={styles.vitalLabel}>Looking for</Typography>
          <Typography variant="body" style={styles.vitalValue}>{lookingFor || 'Not specified'}</Typography>
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
    width: 108,
    color: colors.inkMuted,
  },
  vitalValue: {
    flex: 1,
    color: colors.ink,
  }
})
