import { StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '../../../theme'

export function MatchPercentageBadge({ percentage }: { percentage: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.percentage}>{percentage}%</Text>
      <Text style={styles.label}>Match</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  percentage: { fontSize: 16, fontWeight: '800', color: colors.primary },
  label: { fontSize: 10, fontWeight: '600', color: colors.inkMuted, marginTop: -2 },
})
