import { Box, colors } from '../../theme'
import { Typography } from '../Typography'

type Props = {
  label: string
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'primary'
  icon?: string
  position?: 'top-left'
}

export function MicroBadge({ label, variant = 'neutral', icon, position }: Props) {
  let bgColor = colors.surface
  let textColor = colors.ink
  let borderColor = colors.ink

  switch (variant) {
    case 'accent':
      bgColor = colors.accent
      textColor = colors.white
      borderColor = colors.accent
      break
    case 'success':
      bgColor = colors.success
      textColor = colors.white
      borderColor = colors.success
      break
    case 'warning':
      bgColor = colors.wheat
      textColor = colors.ink
      borderColor = colors.inkMuted
      break
    case 'primary':
      bgColor = colors.primary
      textColor = colors.background || colors.white
      borderColor = colors.primary
      break
    case 'neutral':
    default:
      bgColor = colors.surface
      textColor = colors.ink
      borderColor = colors.ink
  }

  const absoluteProps = position === 'top-left' ? { position: 'absolute' as const, top: 8, left: 8 } : {}

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      backgroundColor={bgColor as any}
      borderWidth={1}
      borderColor={borderColor as any}
      paddingHorizontal="xs"
      paddingVertical={2}
      borderRadius={4}
      gap="xs"
      {...absoluteProps}
    >
      {icon ? (
        <Typography variant="label" style={{ color: textColor, fontSize: 10, lineHeight: 12 }}>
          {icon}
        </Typography>
      ) : null}
      <Typography variant="label" style={{ color: textColor, fontSize: 10, lineHeight: 12, fontWeight: '800' }}>
        {label.toUpperCase()}
      </Typography>
    </Box>
  )
}
