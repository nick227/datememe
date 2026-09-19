// Design tokens matching art/screen-idea.png (the "Pick your top 5 90s bands" mockup):
// indigo primary, soft lavender surfaces for selected state, pill-shaped controls.

export const colors = {
  primary: '#6C63FF',
  primaryPressed: '#5A52E0',
  primarySoft: '#EEECFF',
  ink: '#161832',
  inkMuted: '#6B7089',
  border: '#E7E7F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5FA',
  danger: '#E1493F',
  success: '#2FAE6B',
  white: '#FFFFFF',
}

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const type = {
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.ink, letterSpacing: -0.5, lineHeight: 32 },
  heading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.ink, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: colors.ink, lineHeight: 22 },
  bodyMuted: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.inkMuted, lineHeight: 20 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.inkMuted, letterSpacing: 1.0, textTransform: 'uppercase' as const },
  button: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.white, letterSpacing: 0.2 },
  iconButton: { fontSize: 24, color: colors.ink, width: 24, textAlign: 'center' as const },
}
