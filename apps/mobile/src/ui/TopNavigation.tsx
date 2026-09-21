import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Typography } from './Typography'
import { Icon } from './Icon'
import { spacing, type } from '../theme'

type Props = {
  testID?: string
  title?: string
  subtitle?: string
  alignment?: 'left' | 'center'
  leftAction?: 'back' | 'close'
  onLeftAction?: () => void
  rightElement?: React.ReactNode
}

export function TopNavigation({ testID, title, subtitle, alignment = 'center', leftAction, onLeftAction, rightElement }: Props) {
  return (
    <View testID={testID} style={styles.container}>
      {(leftAction || alignment === 'center') && (
        <View style={styles.side}>
          {leftAction && (
            <Pressable testID={testID ? `${testID}.${leftAction}` : undefined} onPress={onLeftAction} hitSlop={12} style={styles.actionBtn}>
              <Icon name={leftAction === 'back' ? 'ChevronLeft' : 'X'} size={24} />
            </Pressable>
          )}
        </View>
      )}

      <View style={[styles.center, alignment === 'left' && styles.centerLeft]}>
        {title ? <Typography variant={alignment === 'center' ? 'heading' : 'title'}>{title}</Typography> : null}
        {subtitle ? <Typography variant="bodyMuted">{subtitle}</Typography> : null}
      </View>

      {(rightElement || alignment === 'center') && (
        <View style={[styles.side, styles.sideRight]}>
          {rightElement}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    minHeight: 56,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  actionBtn: {
    paddingVertical: spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  centerLeft: {
    alignItems: 'flex-start',
  },
})
