import { StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'

export type PageFact = {
  value: string | number
  label: string
}

export type PageHeaderProps = {
  title: string
  facts?: PageFact[]
  sectionTitle?: string
  sectionAction?: ReactNode
}

/**
 * Shared page shell header for primary tabs (Discover, Lists, Messages).
 * Owns the visual grammar for the top of the page, establishing the title,
 * summary facts, and the first subsection title/dropdown slot.
 */
export function PageHeader({ title, facts, sectionTitle, sectionAction }: PageHeaderProps) {
  return (
    <View style={styles.header}>
      <Typography variant="title" style={styles.heading}>
        {title}
      </Typography>

      {facts && facts.length > 0 ? (
        <Typography variant="label" style={styles.statsLine}>
          {facts.map((f) => `${f.value} ${f.label}`).join('   ·   ')}
        </Typography>
      ) : null}

      {sectionTitle || sectionAction ? (
        <View style={styles.sectionRow}>
          {sectionTitle ? (
            <Typography variant="heading" style={styles.sectionTitle}>
              {sectionTitle}
            </Typography>
          ) : <View />}
          {sectionAction ? <View>{sectionAction}</View> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { 
    paddingHorizontal: spacing.lg, 
    paddingTop: spacing.lg, 
    paddingBottom: spacing.md 
  },
  heading: { 
    marginBottom: 2 
  },
  statsLine: { 
    color: colors.inkMuted, 
    marginTop: spacing.xs 
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  sectionTitle: {
    // inherits heading variant
  },
})
