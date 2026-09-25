import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useAdminEntitySubmissions,
  useAdminReports,
  useAdminReviewEntitySubmission,
  useAdminReviewReport,
  useFetchAdminEntities,
} from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { SelectField } from '../../../ui/SelectField'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminModeration'>

type SubTab = 'submissions' | 'reports'

const SUBMISSION_STATUS_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Merged', value: 'MERGED' },
]

const REPORT_STATUS_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Reviewed', value: 'REVIEWED' },
  { label: 'Actioned', value: 'ACTIONED' },
]

const MAX_MERGE_CANDIDATES_SHOWN = 25

function StatusPill({ label, tone }: { label: string; tone: 'pending' | 'good' | 'bad' | 'neutral' }) {
  const backgroundByTone = { pending: colors.primarySoft, good: colors.surfaceMuted, bad: colors.surfaceMuted, neutral: colors.surfaceMuted }
  const textByTone = { pending: colors.primary, good: colors.ink, bad: colors.danger, neutral: colors.inkMuted }
  return (
    <View style={[styles.pill, { backgroundColor: backgroundByTone[tone] }]}>
      <Typography variant="label" style={{ color: textByTone[tone] }}>{label}</Typography>
    </View>
  )
}

export function AdminModerationScreen({ navigation }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('submissions')
  const [submissionStatus, setSubmissionStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED'>('PENDING')
  const [reportStatus, setReportStatus] = useState<'PENDING' | 'REVIEWED' | 'ACTIONED'>('PENDING')
  const sheet = useActionSheet()

  const submissions = useAdminEntitySubmissions(submissionStatus)
  const reports = useAdminReports(reportStatus)
  const reviewSubmission = useAdminReviewEntitySubmission()
  const reviewReport = useAdminReviewReport()
  const fetchEntities = useFetchAdminEntities()

  function showError(title: string) {
    sheet.show({ title, message: 'Try again in a moment.', buttons: [{ testID: 'admin-moderation.dialog.ok', text: 'OK' }] })
  }

  function doReviewSubmission(id: string, action: 'APPROVE' | 'REJECT' | 'MERGE', mergeIntoEntityId?: string) {
    reviewSubmission.mutate({ id, action, mergeIntoEntityId }, { onError: () => showError('Could not review submission') })
  }

  async function handleMergePicker(submission: NonNullable<typeof submissions.data>['pages'][number]['submissions'][number]) {
    let entities
    try {
      entities = await fetchEntities(submission.entityTypeId)
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Could not load merge candidates')
      return
    }
    const candidates = entities.filter((e) => e.status === 'APPROVED' && e.id !== submission.submittedEntity.id)
    if (candidates.length === 0) {
      sheet.show({ title: 'No merge candidates', message: 'No approved entities of this type to merge into yet.', buttons: [{ testID: 'admin-moderation.dialog.ok', text: 'OK' }] })
      return
    }
    const shown = candidates.slice(0, MAX_MERGE_CANDIDATES_SHOWN)
    sheet.show({
      title: 'Merge into…',
      message: candidates.length > shown.length
        ? `Showing the first ${shown.length} of ${candidates.length} approved entities.`
        : undefined,
      buttons: [
        ...shown.map((c) => ({ testID: `admin-moderation.dialog.merge.${c.id}`, text: c.canonicalName, onPress: () => doReviewSubmission(submission.id, 'MERGE', c.id) })),
        { testID: 'admin-moderation.dialog.cancel', text: 'Cancel', style: 'cancel' as const },
      ],
    })
  }

  function handleSubmissionActions(submission: NonNullable<typeof submissions.data>['pages'][number]['submissions'][number]) {
    sheet.show({
      title: submission.rawText,
      message: submission.suggestedMatch ? `Possible match: ${submission.suggestedMatch.canonicalName}` : undefined,
      buttons: [
        { testID: 'admin-moderation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'admin-moderation.dialog.approve', text: 'Approve', onPress: () => doReviewSubmission(submission.id, 'APPROVE') },
        { testID: 'admin-moderation.dialog.merge-into-existing', text: 'Merge into existing…', onPress: () => void handleMergePicker(submission) },
        { testID: 'admin-moderation.dialog.reject', text: 'Reject', style: 'destructive', onPress: () => confirmReject(submission.id) },
      ],
    })
  }

  function confirmReject(id: string) {
    sheet.show({
      title: 'Reject this submission?',
      message: 'The submitted entity will be marked rejected and hidden from search.',
      buttons: [
        { testID: 'admin-moderation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'admin-moderation.dialog.reject', text: 'Reject', style: 'destructive', onPress: () => doReviewSubmission(id, 'REJECT') },
      ],
    })
  }

  function handleReportActions(report: NonNullable<typeof reports.data>['pages'][number]['reports'][number]) {
    sheet.show({
      title: report.reason,
      message: report.details ?? undefined,
      buttons: [
        { testID: 'admin-moderation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'admin-moderation.dialog.mark-reviewed', text: 'Mark reviewed', onPress: () => reviewReport.mutate({ id: report.id, status: 'REVIEWED' }, { onError: () => showError('Could not review report') }) },
        { testID: 'admin-moderation.dialog.mark-actioned', text: 'Mark actioned…', style: 'destructive', onPress: () => confirmActioned(report.id) },
      ],
    })
  }

  function confirmActioned(id: string) {
    sheet.show({
      title: 'Mark this report as actioned?',
      message: 'Use this once you have actually taken action against the reported profile/message (e.g. a ban).',
      buttons: [
        { testID: 'admin-moderation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'admin-moderation.dialog.mark-actioned', text: 'Mark actioned', style: 'destructive', onPress: () => reviewReport.mutate({ id, status: 'ACTIONED' }, { onError: () => showError('Could not review report') }) },
      ],
    })
  }

  const submissionRows = submissions.data?.pages.flatMap((p) => p.submissions) ?? []
  const reportRows = reports.data?.pages.flatMap((p) => p.reports) ?? []

  return (
    <ScreenContainer testID="screen.admin-moderation" width="wide">
      <TopNavigation testID="admin-moderation.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Moderation" />

      <View style={styles.segmented}>
        <Pressable testID="admin-moderation.tab.submissions" style={[styles.segment, subTab === 'submissions' && styles.segmentActive]} onPress={() => setSubTab('submissions')}>
          <Typography variant="label" style={subTab === 'submissions' ? styles.segmentTextActive : styles.segmentText}>Submissions</Typography>
        </Pressable>
        <Pressable testID="admin-moderation.tab.reports" style={[styles.segment, subTab === 'reports' && styles.segmentActive]} onPress={() => setSubTab('reports')}>
          <Typography variant="label" style={subTab === 'reports' ? styles.segmentTextActive : styles.segmentText}>Reports</Typography>
        </Pressable>
      </View>

      {subTab === 'submissions' ? (
        <SelectField testID="admin-moderation.submission-status"
          value={submissionStatus}
          options={SUBMISSION_STATUS_OPTIONS}
          onSelect={(v) => setSubmissionStatus(v as typeof submissionStatus)}
          placeholder="Status"
        />
      ) : (
        <SelectField testID="admin-moderation.report-status"
          value={reportStatus}
          options={REPORT_STATUS_OPTIONS}
          onSelect={(v) => setReportStatus(v as typeof reportStatus)}
          placeholder="Status"
        />
      )}

      {subTab === 'submissions' ? (
        submissions.isLoading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}
          </View>
        ) : submissions.isError ? (
          <ErrorState testID="admin-moderation.error" subtitle="Couldn't load submissions." onRetry={() => submissions.refetch()} />
        ) : (
          <FlatList
            data={submissionRows}
            keyExtractor={(item) => item.id}
            onEndReached={() => submissions.hasNextPage && submissions.fetchNextPage()}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<EmptyState testID="admin-moderation.empty" title="Nothing here" subtitle="No submissions in this state." />}
            renderItem={({ item }) => (
              <Pressable testID={`admin-moderation.submission.${item.id}`} style={styles.row} onPress={() => item.status === 'PENDING' && handleSubmissionActions(item)}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body">{item.rawText}</Typography>
                  <Typography variant="bodyMuted" style={{ marginTop: 2 }}>
                    {item.entityType.label} · {item.submittedByProfile ? `@${item.submittedByProfile.username}` : 'unknown'}
                  </Typography>
                  {item.suggestedMatch ? (
                    <Typography variant="label" style={{ color: colors.primary, marginTop: 2 }}>
                      Possible match: {item.suggestedMatch.canonicalName}
                    </Typography>
                  ) : null}
                </View>
                <StatusPill
                  label={item.status}
                  tone={item.status === 'PENDING' ? 'pending' : item.status === 'APPROVED' ? 'good' : item.status === 'REJECTED' ? 'bad' : 'neutral'}
                />
                {item.status === 'PENDING' && <Icon name="ChevronRight" size={18} color={colors.inkMuted} />}
              </Pressable>
            )}
          />
        )
      ) : reports.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}
        </View>
      ) : reports.isError ? (
        <ErrorState testID="admin-moderation.error" subtitle="Couldn't load reports." onRetry={() => reports.refetch()} />
      ) : (
        <FlatList
          data={reportRows}
          keyExtractor={(item) => item.id}
          onEndReached={() => reports.hasNextPage && reports.fetchNextPage()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState testID="admin-moderation.empty" title="Nothing here" subtitle="No reports in this state." />}
          renderItem={({ item }) => (
            <Pressable testID={`admin-moderation.report.${item.id}`} style={styles.row} onPress={() => item.status === 'PENDING' && handleReportActions(item)}>
              <View style={{ flex: 1 }}>
                <Typography variant="body">{item.reason}</Typography>
                <Typography variant="bodyMuted" style={{ marginTop: 2 }}>
                  {item.targetType === 'PROFILE' ? `@${item.targetProfile?.username ?? 'unknown'}` : 'Message'} · reported by @{item.reporter.username}
                </Typography>
                {item.targetType === 'MESSAGE' && item.targetMessage?.body ? (
                  <Typography variant="label" style={{ color: colors.inkMuted, fontStyle: 'italic', marginTop: 2 }} numberOfLines={2}>
                    &quot;{item.targetMessage.body}&quot;
                  </Typography>
                ) : null}
              </View>
              <StatusPill label={item.status} tone={item.status === 'PENDING' ? 'pending' : item.status === 'ACTIONED' ? 'bad' : 'neutral'} />
              {item.status === 'PENDING' && <Icon name="ChevronRight" size={18} color={colors.inkMuted} />}
            </Pressable>
          )}
        />
      )}

      <ActionSheet testID="admin-moderation.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.ink },
  segmentTextActive: { color: colors.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  separator: { height: 1, backgroundColor: colors.border },
  pill: {
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
})
