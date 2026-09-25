import { Image, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { CardShell } from './CardShell'
import { SmartImage } from './SmartImage'
import { MicroBadge } from './MicroBadge'
import { Box, colors, spacing } from '../../theme'
import type { ResultUnit } from './types'

type Props = {
  unit: ResultUnit
  onPress: () => void
}

export function ResultUnitCard({ unit, onPress }: Props) {
  return (
    <CardShell testID={`results.card.${unit.id}`} onPress={onPress}>
      <CardShell.Media style={styles.imageWrap}>
        <SmartImage uri={unit.imageUrl} fallbackText={unit.title} />
        <MicroBadge label={`#${unit.rank}`} variant={unit.rank === 1 ? 'primary' : 'neutral'} position="top-left" />
      </CardShell.Media>
      
      <CardShell.Body style={styles.body}>
        <Typography variant="heading" style={styles.title} numberOfLines={2}>
          {unit.title}
        </Typography>
        
        {unit.subtitle ? (
          <Typography variant="bodyMuted" style={styles.subtitle} numberOfLines={1}>
            {unit.subtitle}
          </Typography>
        ) : null}

        {unit.trend ? (
          <Box flexDirection="row" alignItems="center" gap="sm" marginTop="xs">
            {unit.trend === 'new' ? (
              <MicroBadge label="NEW ENTRY" variant="accent" />
            ) : (
              <Typography 
                variant="label" 
                style={[
                  styles.trend, 
                  unit.trend.startsWith('+') ? styles.trendUp : unit.trend.startsWith('-') ? styles.trendDown : styles.trendNeutral
                ]} 
                numberOfLines={1}
              >
                {unit.trend.startsWith('+') ? '↑ ' : unit.trend.startsWith('-') ? '↓ ' : '– '}{unit.trend.replace(/^[+-]/, '')} positions
              </Typography>
            )}
          </Box>
        ) : null}
      </CardShell.Body>
    </CardShell>
  )
}

const styles = StyleSheet.create({
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    padding: spacing.md,
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 13,
  },
  trend: {
    fontSize: 12,
  },
  trendUp: {
    color: colors.success,
    fontWeight: 'bold',
  },
  trendDown: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  trendNeutral: {
    color: colors.inkMuted,
  },
})
