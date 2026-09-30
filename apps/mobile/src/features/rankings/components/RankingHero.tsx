import { StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { SmartImage } from '../../../ui/content/SmartImage'
import { spacing } from '../../../theme'
import { rankingsLabel } from '../rankingStory'

export type RankingFace = {
  profileId: string
  displayName: string
  avatarUrl?: string | null
}

type Props = {
  takeCount: number
  faces: RankingFace[]
}

const FACE = 22

export function RankingHero({ takeCount, faces }: Props) {
  return (
    <View testID="poll-results.hero" style={styles.hero}>
      <Typography variant="bodyMuted">{rankingsLabel(takeCount)}</Typography>
      <View style={styles.faces}>
        {faces.slice(0, 3).map((face) => (
          <SmartImage
            key={face.profileId}
            testID={`poll-results.face.${face.profileId}`}
            uri={face.avatarUrl}
            fallbackText={face.displayName}
            width={FACE}
            height={FACE}
            round
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  faces: { flexDirection: 'row', gap: 4 },
})
