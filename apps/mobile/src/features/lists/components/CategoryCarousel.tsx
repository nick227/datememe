import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { colors, radius, spacing } from '../../../theme'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { CategoriesStackParamList } from '../../../navigation/types'

type NavigationProp = NativeStackNavigationProp<CategoriesStackParamList>
type Props = {
  title: string
  subtitle?: string
  categories: any[]
}

export function CategoryCarousel({ title, subtitle, categories }: Props) {
  const navigation = useNavigation<NavigationProp>()

  if (!categories || categories.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="heading">{title}</Typography>
        {subtitle ? <Typography variant="bodyMuted">{subtitle}</Typography> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {categories.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate('ListBuilder', { categorySlug: item.slug, shortLabel: item.shortLabel })}
          >
            <Typography variant="heading" style={{ marginBottom: spacing.xs }}>{item.shortLabel}</Typography>
            <Typography variant="bodyMuted" numberOfLines={2}>
              {item.prompt}
            </Typography>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: 200,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
