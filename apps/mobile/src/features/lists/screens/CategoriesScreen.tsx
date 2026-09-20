import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategories, useCategoryGroups, useMyLists } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { EmptyState } from '../../../ui/EmptyState'
import { CategoryCarousel } from '../components/CategoryCarousel'
import { CategoryCarouselSkeleton } from '../components/CategoryCarouselSkeleton'
import { borderWidth, colors, radius, spacing, type } from '../../../theme'
import type { CategoriesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<CategoriesStackParamList, 'Categories'>

export function CategoriesScreen({ navigation }: Props) {
  const groups = useCategoryGroups()
  const categories = useCategories()
  const myLists = useMyLists()

  const completedCategoryIds = useMemo(
    () => new Set((myLists.data ?? []).filter((l) => l.isComplete).map((l) => l.categoryId)),
    [myLists.data],
  )

  const incomplete = useMemo(() => categories.data?.filter((c) => !completedCategoryIds.has(c.id)) ?? [], [categories.data, completedCategoryIds])
  const completed = useMemo(() => categories.data?.filter((c) => completedCategoryIds.has(c.id)) ?? [], [categories.data, completedCategoryIds])

  const answerNext = incomplete.slice(0, 5)
  const popular = incomplete.slice(5, 10)
  const improveMatches = incomplete.slice(10, 15)

  const isLoading = groups.isLoading || categories.isLoading

  return (
    <ScreenContainer padded={false} width="wide">
      <TopNavigation
        title="Your favorites"
        subtitle={`${completedCategoryIds.size} completed — pick a category and build your list`}
        alignment="left"
      />
      {isLoading ? (
        <ScrollView style={styles.listContent}>
          <CategoryCarouselSkeleton />
          <CategoryCarouselSkeleton />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <CategoryCarousel title="Answer next" categories={answerNext} />
          <CategoryCarousel title="Popular with people like you" categories={popular} />
          <CategoryCarousel title="Improve your matches" categories={improveMatches} />

          {completed.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Typography variant="heading" style={{ marginBottom: spacing.md }}>Completed lists</Typography>
              {completed.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('ListBuilder', { categorySlug: item.slug, shortLabel: item.shortLabel })}
                >
                  <View style={{ flex: 1 }}>
                    <Typography variant="heading">{item.shortLabel}</Typography>
                    <Typography variant="bodyMuted" numberOfLines={1}>
                      {item.prompt}
                    </Typography>
                  </View>
                  <View style={[styles.badge, styles.badgeDone]}>
                    <Text style={[styles.badgeText, styles.badgeTextDone]}>✓</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {categories.data?.length === 0 ? (
            <EmptyState title="No categories yet" subtitle="Check back soon — new ones ship often." />
          ) : null}
        </ScrollView>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionHeader: {
    ...type.label,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  badgeDone: { backgroundColor: colors.primary },
  badgeText: { ...type.label, color: colors.inkMuted },
  badgeTextDone: { color: colors.white },
})
