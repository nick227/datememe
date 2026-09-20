import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategories, useMyLists } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { CategoryCarouselSkeleton } from '../components/CategoryCarouselSkeleton'
import { TasteProfileHero } from '../components/TasteProfileHero'
import { CompletedListsGrid } from '../components/CompletedListsGrid'
import { CategoryStatCard } from '../components/CategoryStatCard'
import { CategoryDiscoveryCard } from '../components/CategoryDiscoveryCard'
import { spacing } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import type { CategoriesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<CategoriesStackParamList, 'Categories'>

// A category is "featured" (gets the full stat-card treatment) when it has
// either real social proof (people have ranked it) or a personalized reason
// to answer it now (the viewer's matches answer it more than average).
function featuredScore(c: any) {
  return (c.matchAnswerMultiplier ?? 0) * 1000 + c.popularityCount
}

export function CategoriesScreen({ navigation }: Props) {
  const categories = useCategories()
  const myLists = useMyLists()
  const isDesktop = useIsDesktop()

  const completedLists = useMemo(() => (myLists.data ?? []).filter((l: any) => l.isComplete), [myLists.data])
  const completedCategoryIds = useMemo(() => new Set(completedLists.map((l: any) => l.categoryId)), [completedLists])

  const incomplete = useMemo(() => {
    const list = (categories.data ?? []).filter((c: any) => !completedCategoryIds.has(c.id))
    return list.slice().sort((a, b) => featuredScore(b) - featuredScore(a))
  }, [categories.data, completedCategoryIds])

  const featured = incomplete.slice(0, 2)
  const discovery = incomplete.slice(2)

  const isLoading = categories.isLoading || myLists.isLoading

  function goToListBuilder(categorySlug: string, shortLabel: string) {
    navigation.navigate('ListBuilder', { categorySlug, shortLabel })
  }

  return (
    <ScreenContainer padded={false} width="wide">
      {isLoading ? (
        <ScrollView style={{ paddingHorizontal: spacing.lg }}>
          <CategoryCarouselSkeleton />
          <CategoryCarouselSkeleton />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <TasteProfileHero completedLists={completedLists} totalCategories={categories.data?.length ?? 0} />

          {completedLists.length > 0 ? (
            <CompletedListsGrid
              lists={completedLists}
              onPressList={(list) => goToListBuilder(list.category.slug, list.category.shortLabel)}
            />
          ) : null}

          {featured.length > 0 ? (
            <View style={styles.section}>
              <Typography variant="heading" style={styles.sectionHeading}>
                Answer these next
              </Typography>
              <View style={styles.grid}>
                {featured.map((category: any) => (
                  <View key={category.id} style={isDesktop ? styles.featuredCellDesktop : styles.featuredCellMobile}>
                    <CategoryStatCard category={category} onPress={() => goToListBuilder(category.slug, category.shortLabel)} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {discovery.length > 0 ? (
            <View style={styles.section}>
              <Typography variant="heading" style={styles.sectionHeading}>
                More to explore
              </Typography>
              <View style={styles.grid}>
                {discovery.map((category: any) => (
                  <View key={category.id} style={[styles.discoveryCell, { width: isDesktop ? '25%' : '50%' }]}>
                    <CategoryDiscoveryCard category={category} onPress={() => goToListBuilder(category.slug, category.shortLabel)} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {categories.data?.length === 0 ? <EmptyState title="No categories yet" subtitle="Check back soon — new ones ship often." /> : null}
        </ScrollView>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionHeading: { marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  featuredCellMobile: { width: '100%', paddingHorizontal: spacing.xs },
  featuredCellDesktop: { width: '50%', paddingHorizontal: spacing.xs },
  discoveryCell: { paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
})
