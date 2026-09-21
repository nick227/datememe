import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'
import type { PageSummary } from './types'

/**
 * Page chrome, not a feed module (proposal §3) — rendered once, above the
 * FeedModule stream. Deliberately quiet: this is a consumer favorites/
 * browsing page, not an analytics dashboard. The same component drives both
 * Lists and Discover so the two pages read as siblings, not two apps.
 */
export function PageSummaryHero({ summary }: { summary: PageSummary }) {
  return (
    <View style={styles.header}>
      <Typography variant="title" style={styles.heading}>
        {summary.title}
      </Typography>
      {summary.subtitle ? (
        <Typography variant="bodyMuted" style={styles.subtitle}>
          {summary.subtitle}
        </Typography>
      ) : null}

      {summary.stats?.length ? (
        <Typography variant="label" style={styles.statsLine}>
          {summary.stats.map((s) => `${s.value} ${s.label}`).join('   ·   ')}
        </Typography>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  heading: { marginBottom: 2 },
  subtitle: { marginBottom: spacing.sm },
  statsLine: { color: colors.inkMuted, marginTop: spacing.xs },
})
