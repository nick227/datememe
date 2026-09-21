import { StyleSheet, View } from 'react-native'
import { spacing } from '../theme'
import { Typography } from './Typography'
import { Button } from './Button'

export function ErrorState({ title = 'Something went wrong', subtitle, onRetry }: { title?: string; subtitle?: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Typography variant="heading">{title}</Typography>
      {subtitle ? (
        <Typography variant="bodyMuted" style={styles.subtitle}>
          {subtitle}
        </Typography>
      ) : null}
      {onRetry ? (
        <View style={styles.retry}>
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  subtitle: { marginTop: spacing.xs, textAlign: 'center' },
  retry: { marginTop: spacing.lg },
})
