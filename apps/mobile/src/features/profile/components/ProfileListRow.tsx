import { Pressable, StyleSheet, View } from 'react-native'
import { SmartImage } from '../../../ui/content/SmartImage'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

type Props = {
  testID: string
  title: string
  imageUrl?: string | null
  onEdit: () => void
  onResults: () => void
}

export function ProfileListRow({ testID, title, imageUrl, onEdit, onResults }: Props) {
  return (
    <View testID={testID} style={styles.row}>
      <SmartImage uri={imageUrl} fallbackText={title} width={36} height={36} style={styles.thumb} />
      <Typography style={styles.title} numberOfLines={1}>{title}</Typography>
      <Pressable testID={`${testID}.edit`} accessibilityRole="link" accessibilityLabel={`Edit answers for ${title}`} hitSlop={8} onPress={onEdit}>
        <Typography style={styles.link}>Edit answers</Typography>
      </Pressable>
      <Pressable testID={`${testID}.results`} accessibilityRole="link" accessibilityLabel={`Results for ${title}`} hitSlop={8} onPress={onResults}>
        <Typography style={styles.link}>Results</Typography>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: { borderRadius: 4 },
  title: { flex: 1, fontSize: 16 },
  link: { color: colors.accent, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
})
