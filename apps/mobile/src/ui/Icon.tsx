import { icons } from 'lucide-react-native'
import { colors } from '../theme'

type Props = {
  name: keyof typeof icons
  color?: string
  size?: number
  strokeWidth?: number
}

export function Icon({ name, color = colors.ink, size = 24, strokeWidth = 2 }: Props) {
  const LucideIcon = icons[name]

  if (!LucideIcon) {
    return null
  }

  return <LucideIcon color={color} size={size} strokeWidth={strokeWidth} />
}
