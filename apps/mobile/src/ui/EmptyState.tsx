import { StyleSheet, View } from 'react-native'
import { spacing } from '../theme'
import { Typography } from '../ui/Typography'

export function EmptyState({ testID, title, subtitle }: { testID?: string; title: string; subtitle?: string }) {
  return (
    <View testID={testID} style={styles.container}>
      <Typography variant="heading">{title}</Typography>
      {subtitle ? <Typography variant="bodyMuted" style={styles.subtitle}>{subtitle}</Typography> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
})
