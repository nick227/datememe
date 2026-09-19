// Datememe brand tokens — coral + lavender on warm cream, per art/masthead.png.
// Key names are kept stable where existing code already references them
// (colors.primary, colors.primarySoft, etc.) so the reskin cascades through
// every consumer without needing per-file edits; only new keys are additive.

export const colors = {
  primary: '#F2543C',
  primaryPressed: '#D8432D',
  primarySoft: '#FFE4DC',
  lavender: '#8C7CF0',
  lavenderSoft: '#EFEAFF',
  canvas: '#FBF6EC',
  ink: '#241C33',
  inkMuted: '#6E6580',
  border: '#E9DFCF',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F0E4',
  sunshine: '#FFC845',
  mint: '#4FB88A',
  danger: '#D63A3A',
  overlay: 'rgba(36,28,51,0.75)',
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
  wordmark: { fontFamily: 'Baloo2_800ExtraBold', color: colors.ink, letterSpacing: -0.5 },
  display: { fontFamily: 'Baloo2_700Bold', fontSize: 30, color: colors.ink, letterSpacing: -0.3, lineHeight: 36 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.ink, letterSpacing: -0.5, lineHeight: 32 },
  heading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.ink, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: colors.ink, lineHeight: 22 },
  bodyMuted: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.inkMuted, lineHeight: 20 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.inkMuted, letterSpacing: 1.0, textTransform: 'uppercase' as const },
  button: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.white, letterSpacing: 0.2 },
  iconButton: { fontSize: 24, color: colors.ink, width: 24, textAlign: 'center' as const },
}
