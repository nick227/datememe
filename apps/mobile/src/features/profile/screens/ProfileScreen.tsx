import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCurrentUser, useMyLists } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { Button } from '../../../ui/Button'
import { EmptyState } from '../../../ui/EmptyState'
import { Skeleton } from '../../../ui/Skeleton'
import { Typography } from '../../../ui/Typography'
import { openPoll } from '../../../navigation/openPoll'
import { ProfileListRow } from '../components/ProfileListRow'
import { ProfilePhotoEditor } from '../components/ProfilePhotoEditor'
import { ProfileDetailsEditor } from '../components/ProfileDetailsEditor'
import { ProfileAccountSettings } from '../components/ProfileAccountSettings'
import { colors, spacing } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>

export function ProfileScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const lists = useMyLists()
  const profile = me.data?.profile
  const completedLists = (lists.data ?? []).filter(list => list.isComplete && list.items?.length)

  function openList(list: typeof completedLists[number], mode: 'edit' | 'results') {
    openPoll(navigation, mode, { categorySlug: list.category.slug, shortLabel: list.category.shortLabel })
  }

  return (
    <ScreenContainer testID="screen.profile" padded={false} width="full">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.header}>
            {profile?.username ? <Typography style={styles.username}>@{profile.username}</Typography> : null}
          </View>
          {me.isLoading ? <Skeleton variant="rect" width="100%" height={320} /> : profile ? (
            <>
              <ProfilePhotoEditor key={`photos-${profile.id}`} avatarUrl={profile.avatarUrl} photos={profile.photos} />
              <View style={styles.section}><ProfileDetailsEditor key={`details-${profile.id}`} profile={profile} /></View>
              <View style={styles.section}><ProfileAccountSettings onPremium={() => navigation.navigate('Paywall')} onVerify={() => navigation.navigate('VerifyEmail')} onAdmin={() => navigation.navigate('Admin')} /></View>
              <View style={styles.section}>
                <View style={styles.headingRow}><Typography variant="title">Your favorites</Typography></View>
                <View style={styles.stack}>
                  <EmptyState title="Favorites coming soon" subtitle="This section is being moved here from Discover." />
                </View>
              </View>
              <View style={styles.section}>
                <View style={styles.headingRow}><Typography variant="title">Your lists</Typography>{lists.isSuccess ? <Typography variant="bodyMuted">{completedLists.length} {completedLists.length === 1 ? 'list' : 'lists'}</Typography> : null}</View>
                <View style={styles.listTable}>
                  {lists.isLoading ? <><Skeleton variant="rect" width="100%" height={48} /><Skeleton variant="rect" width="100%" height={48} /></> : lists.isError ? <><Typography>Could not load your lists.</Typography><Button label="Try again" variant="secondary" onPress={() => { void lists.refetch() }} /></> : completedLists.length ? completedLists.map(list => (
                    <ProfileListRow key={list.id} testID={`profile-list.${list.id}`} title={list.category.shortLabel} imageUrl={list.category.imageUrl} onEdit={() => openList(list, 'edit')} onResults={() => openList(list, 'results')} />
                  )) : <><EmptyState testID="profile.empty" title="Your taste belongs here" subtitle="Take your first poll to start sharing what you love." /><Button label="Explore polls" onPress={() => { navigation.getParent()?.navigate('Lists') }} /></>}
                </View>
              </View>
            </>
          ) : <View style={styles.stack}><EmptyState title="Could not load your profile" subtitle="Try again to manage your photos and details." /><Button label="Try again" onPress={() => { void me.refetch() }} /></View>}
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.section },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.xxl },
  username: { color: colors.accent, fontSize: 13 },
  section: { marginTop: spacing.xxl, paddingTop: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.xl },
  stack: { gap: spacing.xl },
  listTable: { marginTop: spacing.md },
})
