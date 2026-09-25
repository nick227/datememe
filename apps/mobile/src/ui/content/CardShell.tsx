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
  radius?: keyof typeof import('../../theme').radius
  noBorder?: boolean
}

export function CardShell({ children, onPress, testID, style, containerStyle, radius = 'sm', noBorder }: CardShellProps) {
  const shadowStyle = noBorder ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 } as any,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  } : {}

  if (!onPress) {
    return (
      <Box
        backgroundColor="surface"
        borderWidth={noBorder ? 0 : 1}
        borderColor={noBorder ? 'transparent' : 'ink'}
        borderRadius={radius as any}
        flex={1}
        flexDirection="column"
        overflow="hidden"
        style={[shadowStyle, containerStyle, style as any]}
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
      style={[shadowStyle, containerStyle]}
      scaleTo={0.98}
      duration={100}
      haptic="light"
    >
      <Box
        backgroundColor="surface"
        borderWidth={noBorder ? 0 : 1}
        borderColor={noBorder ? 'transparent' : 'ink'}
        borderRadius={radius as any}
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
