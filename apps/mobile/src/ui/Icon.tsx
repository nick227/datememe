import {
  ArrowLeft,
  ChevronLeft,
  ChevronDown,
  Check,
  Flame,
  Heart,
  Lock,
  MessageCircle,
  MoreVertical,
  Play,
  Plus,
  Send,
  Settings,
  X,
} from 'lucide-react-native'
import { colors } from '../theme'

// Explicit per-icon imports rather than lucide-react-native's dynamic `icons[name]`
// namespace lookup — that giant barrel object doesn't survive Metro's production
// export bundling reliably (crashes with "Cannot read properties of undefined"
// the moment any screen tries to render an icon in the exported web build).
const ICON_MAP = { ArrowLeft, ChevronLeft, ChevronDown, Check, Flame, Heart, Lock, MessageCircle, MoreVertical, Play, Plus, Send, Settings, X }

export type IconName = keyof typeof ICON_MAP

type Props = {
  name: IconName
  color?: string
  size?: number
  strokeWidth?: number
}

export function Icon({ name, color = colors.ink, size = 24, strokeWidth = 2 }: Props) {
  const LucideIcon = ICON_MAP[name]

  if (!LucideIcon) {
    return null
  }

  return <LucideIcon color={color} size={size} strokeWidth={strokeWidth} />
}
