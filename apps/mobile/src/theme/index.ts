// Datememe brand tokens — stark black & white, one loud red accent, sharp
// corners, thick black borders instead of soft shadows. Not cute; internet-
// meme-template energy. Key names are kept stable where existing code
// already references them (colors.primary, colors.primarySoft, etc.) so this
// cascades through every consumer without needing per-file edits for color
// alone — colors.primary now means "the primary UI emphasis color" (black),
// distinct from colors.accent (the one red pop, used sparingly — logo, small
// highlights — not buttons or badges).

import { createTheme, createBox, createText } from '@shopify/restyle'

export const colors = {
  primary: '#000000',
  primaryPressed: '#333333',
  primarySoft: '#F0F0F0',
  accent: '#0022ffff',
  accentPressed: '#2e1921ff',
  ink: '#000000',
  inkMuted: '#595959',
  border: '#242424ff',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F0F0',
  canvas: '#FFFFFF',
  danger: '#FF3131',
  success: '#00C853',
  overlay: 'rgba(0,0,0,0.75)',
  white: '#FFFFFF',
  wheat: '#f7ead1',
  transparent: 'transparent',
}

export const radius = {
  sm: 12,
  md: 14,
  lg: 18,
  pill: 999,
  rail: 12,
  grid: 14,
  spotlight: 18,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  // Major-section rhythm on a browse feed (Lists/Discover) — reduced per UI polish
  section: 36,
}

export const CANVAS_WIDTH = 1200

export const borderWidth = {
  thin: 1,
  thick: 2,
}

export const modalHeight = 250;

export const type = {
  wordmark: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.ink, letterSpacing: -0.5, textTransform: 'uppercase' as const },
  display: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, color: colors.ink, letterSpacing: -0.3, lineHeight: 36 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.ink, letterSpacing: -0.5, lineHeight: 32 },
  heading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.ink, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: colors.ink, lineHeight: 22 },
  bodyMuted: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.inkMuted, lineHeight: 20 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.inkMuted, letterSpacing: 1.0, textTransform: 'uppercase' as const },
  button: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.white, letterSpacing: 0.2 },
  iconButton: { fontSize: 24, color: colors.ink, width: 24, textAlign: 'center' as const },
}

export const theme = createTheme({
  colors: {
    ...colors,
  },
  spacing: {
    ...spacing,
    '-xs': -spacing.xs,
    '-sm': -spacing.sm,
    '-md': -spacing.md,
    '-lg': -spacing.lg,
    '-xl': -spacing.xl,
    '-xxl': -spacing.xxl,
    '-section': -spacing.section,
  },
  breakpoints: {
    phone: 0,
    tablet: 768,
    large: 1024,
  },
  borderRadii: {
    ...radius,
  },
  textVariants: {
    defaults: {
      color: 'ink',
      fontFamily: 'PlusJakartaSans_400Regular',
    },
    // Remap type to use color keys for Restyle
    wordmark: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: 'ink', letterSpacing: -0.5, textTransform: 'uppercase' },
    display: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, color: 'ink', letterSpacing: -0.3, lineHeight: 36 },
    title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: 'ink', letterSpacing: -0.5, lineHeight: 32 },
    heading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: 'ink', letterSpacing: -0.2, lineHeight: 24 },
    body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: 'ink', lineHeight: 22 },
    bodyMuted: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: 'inkMuted', lineHeight: 20 },
    label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: 'inkMuted', letterSpacing: 1.0, textTransform: 'uppercase' },
    button: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: 'white', letterSpacing: 0.2 },
  },
})

export type Theme = typeof theme
export const Box = createBox<Theme>()
export const Text = createText<Theme>()
