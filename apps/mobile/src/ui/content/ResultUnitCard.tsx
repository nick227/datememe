import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { PressableScale } from '../PressableScale'
import { SmartImage } from './SmartImage'
import { MicroBadge } from './MicroBadge'
import { Box, colors, spacing } from '../../theme'
import type { ResultUnit } from './types'
import { SHOW_VALUE_IMAGES } from '../mediaPolicy'

type Props = {
  unit: ResultUnit
  onPress: () => void
}

export function ResultUnitCard({ unit, onPress }: Props) {
  return (
    <PressableScale testID={`results.card.${unit.id}`} onPress={onPress} style={styles.row}>
      <Box width={40} alignItems="center">
        <Typography variant="display" style={styles.rankNumber}>
          #{unit.rank}
        </Typography>
      </Box>
      {SHOW_VALUE_IMAGES ? <SmartImage uri={unit.imageUrl} fallbackText={unit.title} width={40} height={40} round /> : null}
      
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rankNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
    paddingRight: spacing.sm,
  },
  meta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 50,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  trend: {
    fontSize: 13,
    fontWeight: '500',
  },
  trendUp: {
    color: colors.ink,
  },
  trendDown: {
    color: colors.inkMuted,
  },
  trendNeutral: {
    color: colors.inkMuted,
  },
})
