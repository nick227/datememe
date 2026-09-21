import { ActivityIndicator, View } from 'react-native'
import { spacing } from '../../theme'
import { Typography } from '../Typography'
import { Button } from '../Button'

type Props = {
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  hasNextPage: boolean
  hasContent: boolean
  onRetry: () => void
  endMessage: string
}

/**
 * The three states a genuinely-infinite feed needs beyond "loading the first
 * page": fetching more, a failed fetch (retryable, not a full-page error —
 * everything already on screen stays put), and true end-of-content (the
 * backend has no more eligible, unseen items — not a synthetic stop).
 */
export function FeedListFooter({ isFetchingNextPage, isFetchNextPageError, hasNextPage, hasContent, onRetry, endMessage }: Props) {
  if (isFetchingNextPage) {
    return (
      <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }
  if (isFetchNextPageError) {
    return (
      <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
        <Typography variant="bodyMuted" style={{ marginBottom: spacing.sm }}>
          Couldn't load more.
        </Typography>
        <Button label="Try again" variant="secondary" onPress={onRetry} />
      </View>
    )
  }
  if (!hasNextPage && hasContent) {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
        <Typography variant="bodyMuted">{endMessage}</Typography>
      </View>
    )
  }
  return null
}
