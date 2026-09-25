import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { PressableScale } from '../PressableScale'
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
  const isTop3 = unit.rank && unit.rank <= 3

  return (
    <PressableScale testID={`results.card.${unit.id}`} onPress={onPress} style={[styles.row, isTop3 && styles.rowTop3]}>
      <Box width={40} alignItems="center">
        <Typography variant="display" style={styles.rankNumber}>
          #{unit.rank}
        </Typography>
      </Box>
      <SmartImage uri={unit.imageUrl} fallbackText={unit.title} width={48} height={48} round />
      
      <View style={styles.content}>
        <Typography variant="heading" style={styles.title} numberOfLines={1}>
          {unit.title}
        </Typography>
        {unit.subtitle ? (
          <Typography variant="bodyMuted" style={styles.subtitle} numberOfLines={1}>
            {unit.subtitle}
          </Typography>
        ) : null}
      </View>
      
      <View style={styles.meta}>
        {unit.trend ? (
          unit.trend === 'new' ? (
            <MicroBadge label="NEW" variant="accent" />
          ) : (
            <Typography 
              variant="label" 
              style={[
                styles.trend, 
                unit.trend.startsWith('+') ? styles.trendUp : unit.trend.startsWith('-') ? styles.trendDown : styles.trendNeutral
              ]} 
              numberOfLines={1}
            >
              {unit.trend.startsWith('+') ? '↑ ' : unit.trend.startsWith('-') ? '↓ ' : '– '}{unit.trend.replace(/^[+-]/, '')}
            </Typography>
          )
        ) : null}
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
  },
  rowTop3: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  rankNumber: {
    fontSize: 24,
    color: colors.inkMuted,
  },
  content: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.sm,
  },
  meta: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  trend: {
    fontSize: 12,
  },
  trendUp: {
    color: colors.ink,
    fontWeight: 'bold',
  },
  trendDown: {
    color: colors.inkMuted,
  },
  trendNeutral: {
    color: colors.inkMuted,
  },
})
