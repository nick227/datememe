import { Text, View } from 'react-native'
import { colors, type } from '../theme'

const SIZES = {
  sm: 20,
  md: 32,
  lg: 44,
}

export function Logo({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const fontSize = SIZES[size]
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={[type.wordmark, { fontSize, color: colors.primary }]}>date</Text>
      <Text style={[type.wordmark, { fontSize, color: colors.lavender }]}>meme</Text>
    </View>
  )
}
