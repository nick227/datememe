import { Box, colors } from '../../theme'
import { Typography } from '../Typography'

type Props = {
  label: string
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'primary'
  icon?: string
  position?: 'top-left'
}

export function MicroBadge({ label, variant = 'neutral', icon, position }: Props) {
  let bgColor: keyof typeof colors = 'surface'
  let textColor = colors.ink
  let borderColor: keyof typeof colors = 'ink'

  switch (variant) {
    case 'accent':
      bgColor = 'accent'
      textColor = colors.white
      borderColor = 'accent'
      break
    case 'success':
      bgColor = 'success'
      textColor = colors.white
      borderColor = 'success'
      break
    case 'warning':
      bgColor = 'wheat'
      textColor = colors.ink
      borderColor = 'inkMuted'
      break
    case 'primary':
      bgColor = 'primary'
      textColor = colors.white
      borderColor = 'primary'
      break
    case 'neutral':
    default:
      bgColor = 'surface'
      textColor = colors.ink
      borderColor = 'ink'
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
      style={{ paddingVertical: 2, borderRadius: 4 }}
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
