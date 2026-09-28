import type { ReactNode } from 'react'
import { type ViewStyle, type StyleProp } from 'react-native'
import { Box } from '../../theme'
import { Surface, type SurfaceVariant } from '../Surface'

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
  variant?: SurfaceVariant
}

export function CardShell({ children, onPress, testID, style, containerStyle, radius = 'sm', noBorder, variant }: CardShellProps) {
  const surfaceVariant = variant || (noBorder ? 'raised' : 'bordered')

  return (
    <Surface
      variant={surfaceVariant}
      radius={radius}
      onPress={onPress}
      testID={testID}
      style={[containerStyle, style as any]}
    >
      <Box flex={1} flexDirection="column">
        {children}
      </Box>
    </Surface>
  )
}

CardShell.Media = CardShellMedia
CardShell.Body = CardShellBody
CardShell.Insight = CardShellInsight
CardShell.ActionRow = CardShellActionRow
