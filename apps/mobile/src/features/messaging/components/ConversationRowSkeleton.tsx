import { StyleSheet, View } from 'react-native'
import { Skeleton } from '../../../ui/Skeleton'
import { colors, radius, spacing } from '../../../theme'

export function ConversationRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton variant="circular" width={56} height={56} style={styles.avatar} />
      <View style={styles.contentColumn}>
        <View style={styles.rowHeader}>
          <Skeleton variant="text" width={120} height={18} />
          <Skeleton variant="text" width={40} height={14} />
        </View>
        <View style={styles.rowSub}>
          <Skeleton variant="text" width={220} height={14} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: spacing.md, 
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: radius.pill, 
    marginRight: spacing.md 
  },
  contentColumn: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rowSub: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
