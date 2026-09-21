// Datememe brand tokens — stark black & white, one loud red accent, sharp
// corners, thick black borders instead of soft shadows. Not cute; internet-
// meme-template energy. Key names are kept stable where existing code
// already references them (colors.primary, colors.primarySoft, etc.) so this
// cascades through every consumer without needing per-file edits for color
// alone — colors.primary now means "the primary UI emphasis color" (black),
// distinct from colors.accent (the one red pop, used sparingly — logo, small
// highlights — not buttons or badges).

export const colors = {
  primary: '#000000',
  primaryPressed: '#333333',
  primarySoft: '#F0F0F0',
  accent: '#FF3131',
  accentPressed: '#D42121',
  ink: '#000000',
  inkMuted: '#595959',
  border: '#000000',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F0F0',
  canvas: '#FFFFFF',
  danger: '#FF3131',
  overlay: 'rgba(0,0,0,0.75)',
  white: '#FFFFFF',
}

export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  pill: 0,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  // Major-section rhythm on a browse feed (Lists/Discover) — deliberately a
  // step above xxl: modules need room to read as distinct beats, not just
  // another card in the same stack.
  section: 64,
}

// The browse canvas for feed pages (Lists/Discover) — wider than the 960px
// `wide` ScreenContainer tier so Rails/Grids/Rivers have room to establish
// scale contrast; text content still aligns to this same left/right edge.
export const CANVAS_WIDTH = 1280

export const borderWidth = {
  thin: 1,
  thick: 2,
}

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
