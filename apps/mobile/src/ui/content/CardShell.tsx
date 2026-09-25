import type { ReactNode } from 'react'
import { type ViewStyle, type StyleProp } from 'react-native'
import { Box } from '../../theme'
import { PressableScale } from '../PressableScale'

type BaseProps = { children: ReactNode; style?: StyleProp<ViewStyle> }

function CardShellMedia({ children, style }: BaseProps) {
  return (
    <Box position="relative" style={style as any}>
      {children}
    </Box>
  )
}

function CardShellBody({ children, style }: BaseProps) {
  return (
    <Box flex={1} padding="md" flexDirection="column" style={style as any}>
      {children}
    </Box>
  )
}

function CardShellInsight({ children, style }: BaseProps) {
  return (
    <Box marginTop="xs" justifyContent="center" style={style as any}>
      {children}
    </Box>
  )
}

function CardShellActionRow({ children, style }: BaseProps) {
  return (
    <Box paddingTop="sm" flexDirection="row" alignItems="center" justifyContent="space-between" style={style as any}>
      {children}
    </Box>
  )
}

type CardShellProps = BaseProps & {
  onPress?: () => void
  testID?: string
  containerStyle?: StyleProp<ViewStyle>
}

export function CardShell({ children, onPress, testID, style, containerStyle }: CardShellProps) {
  if (!onPress) {
    return (
      <Box
        backgroundColor="surface"
        borderWidth={1}
        borderColor="ink"
        flex={1}
        flexDirection="column"
        overflow="hidden"
        style={[containerStyle, style as any]}
        testID={testID}
      >
        {children}
      </Box>
    )
  }

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      style={containerStyle}
      scaleTo={0.98}
      duration={100}
      haptic="light"
    >
      <Box
        backgroundColor="surface"
        borderWidth={1}
        borderColor="ink"
        flex={1}
        flexDirection="column"
        overflow="hidden"
        style={style as any}
      >
        {children}
      </Box>
    </PressableScale>
  )
}

CardShell.Media = CardShellMedia
CardShell.Body = CardShellBody
CardShell.Insight = CardShellInsight
CardShell.ActionRow = CardShellActionRow
