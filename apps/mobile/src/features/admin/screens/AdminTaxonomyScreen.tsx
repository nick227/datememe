import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminEntitiesByParent, useAdminEntityTypes, type components } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { EmptyState } from '../../../ui/EmptyState'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminTaxonomy'>
type AdminEntity = components['schemas']['AdminEntity']

const INDENT_PER_DEPTH = 18

function TreeRow({
  depth,
  label,
  expanded,
  onToggleExpand,
  onPressLabel,
  strikethrough,
  dimmed,
}: {
  depth: number
  label: string
  expanded: boolean
  onToggleExpand: () => void
  onPressLabel: () => void
  strikethrough?: boolean
  dimmed?: boolean
}) {
  return (
    <View style={[styles.row, { paddingLeft: spacing.sm + depth * INDENT_PER_DEPTH }]}>
      <Pressable hitSlop={8} onPress={onToggleExpand} style={styles.chevron}>
        <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={16} color={colors.inkMuted} />
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onPressLabel}>
        <Typography
          variant="body"
          style={[
            strikethrough && { textDecorationLine: 'line-through' },
            dimmed && { color: colors.inkMuted },
          ]}
        >
          {label}
        </Typography>
      </Pressable>
    </View>
  )
}

function EntityNode({
  entity,
  depth,
  navigation,
}: {
  entity: AdminEntity
  depth: number
  navigation: Props['navigation']
}) {
  const [expanded, setExpanded] = useState(false)
  const children = useAdminEntitiesByParent(entity.entityTypeId, entity.id, expanded)

  return (
    <View>
      <TreeRow
        depth={depth}
        label={entity.canonicalName}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        onPressLabel={() =>
          navigation.navigate('AdminTaxonomyEntity', {
            id: entity.id,
            entityTypeId: entity.entityTypeId,
            canonicalName: entity.canonicalName,
            slug: entity.slug,
            parentId: entity.parentId,
            status: entity.status,
          })
        }
        strikethrough={entity.status === 'REJECTED'}
        dimmed={entity.status === 'PENDING'}
      />
      {expanded ? (
        children.isLoading ? (
          <Skeleton height={20} style={{ marginLeft: spacing.sm + (depth + 1) * INDENT_PER_DEPTH, marginBottom: spacing.xs }} />
        ) : (
          (children.data ?? []).map((child) => <EntityNode key={child.id} entity={child} depth={depth + 1} navigation={navigation} />)
        )
      ) : null}
    </View>
  )
}

function TypeNode({ type, navigation }: { type: components['schemas']['AdminEntityType']; navigation: Props['navigation'] }) {
  const [expanded, setExpanded] = useState(false)
  const entities = useAdminEntitiesByParent(type.id, null, expanded)

  return (
    <View style={styles.typeCard}>
      <TreeRow
        depth={0}
        label={type.label}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        onPressLabel={() => navigation.navigate('AdminTaxonomyType', { typeId: type.id })}
        dimmed={!type.isActive}
      />
      {expanded ? (
        entities.isLoading ? (
          <Skeleton height={20} style={{ marginLeft: spacing.sm + INDENT_PER_DEPTH, marginBottom: spacing.xs }} />
        ) : entities.isError ? (
          <Typography variant="label" style={{ color: colors.danger, marginLeft: spacing.sm + INDENT_PER_DEPTH }}>Couldn&apos;t load.</Typography>
        ) : (
          (entities.data ?? []).map((entity) => <EntityNode key={entity.id} entity={entity} depth={1} navigation={navigation} />)
        )
      ) : null}
    </View>
  )
}

export function AdminTaxonomyScreen({ navigation }: Props) {
  const types = useAdminEntityTypes()
  const rootTypes = (types.data ?? []).filter((t) => !t.parentId)

  return (
    <ScreenContainer testID="screen.admin-taxonomy" width="wide">
      <TopNavigation testID="admin-taxonomy.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Taxonomy" subtitle="Types & values" />

      {types.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} />)}
        </View>
      ) : types.isError ? (
        <ErrorState testID="admin-taxonomy.error" subtitle="Couldn't load taxonomy." onRetry={() => types.refetch()} />
      ) : rootTypes.length === 0 ? (
        <EmptyState testID="admin-taxonomy.empty" title="No entity types" />
      ) : (
        <ScrollView>
          {rootTypes.map((type) => <TypeNode key={type.id} type={type} navigation={navigation} />)}
        </ScrollView>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  typeCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
