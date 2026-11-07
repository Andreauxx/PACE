// ============================================================
// AgriSweep — Design Tokens
//
// Palette from the coop: galvanized cage wire, barn green,
// straw, comb red and rinse water.
//   Straw      → anything that makes the machine move
//   Comb red   → stop, full bin, faults — nothing else
//   Rinse blue → the water pump — nothing else
//
// Type: Big Shoulders Display (condensed, industrial signage)
// for titles, status lines and numbers; Atkinson Hyperlegible
// (built for low-vision reading) for everything else, so the
// app stays readable in a dim barn.
// ============================================================

import { Platform } from 'react-native';

const palette = {
  galvanized: '#DDE2E0',
  steel: '#F5F6F3',
  sunken: '#E9ECEA',
  ink: '#1F2A24',
  inkSoft: '#2E3B33',
  barn: '#2F5A45',
  barnLight: '#4C7A60',
  barnDark: '#1F3D2F',
  barnTint: '#E2EAE3',
  straw: '#E5B323',
  strawLight: '#F2D27A',
  strawTint: '#F7EDCB',
  comb: '#B5342B',
  combDark: '#8C241D',
  combTint: '#F3DFDC',
  rinse: '#2D6E93',
  rinseTint: '#DCE8EF',
  amber: '#B97F0E',
  amberDark: '#86600A',
  moss: '#3E7D4F',
  mossTint: '#E0ECE2',
  line: '#C8CFCB',
  lineSoft: '#E1E5E2',
  muted: '#4A5650',
  faint: '#69736D',
};

export const Colors = {
  ...palette,

  // Roles (kept for existing components)
  primary: palette.barn,
  primaryLight: palette.barnLight,
  primaryDark: palette.barnDark,
  primarySurface: palette.barnTint,
  primaryGlow: 'rgba(47, 90, 69, 0.18)',

  accent: palette.straw,
  accentLight: palette.strawLight,
  accentDark: palette.amberDark,

  background: palette.galvanized,
  surface: palette.steel,
  surfaceElevated: '#FFFFFF',
  card: palette.steel,

  text: palette.ink,
  textSecondary: palette.muted,
  textTertiary: palette.faint,
  textInverse: '#FFFFFF',
  textOnStraw: palette.ink,

  success: palette.moss,
  successLight: palette.mossTint,
  warning: palette.amber,
  warningLight: palette.strawTint,
  warningDark: palette.amberDark,
  error: palette.comb,
  errorLight: palette.combTint,
  errorDark: palette.combDark,
  info: palette.rinse,
  infoLight: palette.rinseTint,

  online: palette.moss,
  connecting: palette.amber,
  offline: palette.faint,

  sensorNormal: palette.moss,
  sensorElevated: palette.amber,
  sensorWarning: '#C7661A',
  sensorCritical: palette.comb,
  sensorUnavailable: '#9AA39E',

  cleaningIdle: palette.faint,
  cleaningActive: palette.barn,
  cleaningCompleted: palette.moss,
  cleaningFailed: palette.comb,

  border: palette.line,
  borderLight: palette.lineSoft,
  divider: palette.lineSoft,
  shadow: 'transparent',
  shadowDark: 'transparent',
  overlay: 'rgba(31, 42, 36, 0.55)',
  disabled: '#B4BCB8',
  disabledBg: '#E4E7E5',

  tabBarBg: palette.steel,
  tabBarActive: palette.ink,
  tabBarInactive: palette.faint,

  emergency: palette.comb,
  emergencyBg: palette.combTint,

  chartLine1: palette.barn,
  chartLine2: palette.rinse,
  chartGrid: palette.lineSoft,
  chartThreshold: palette.amber,
};

export const Fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  display: 'BigShouldersDisplay_800ExtraBold',
  displayBold: 'BigShouldersDisplay_700Bold',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Radius follows hierarchy: pills > panels > controls > ticks.
export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

// Scale ≈ 1.2 for text, jumping for display numbers.
export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 19,
  xl: 23,
  xxl: 28,
  xxxl: 36,
  display: 48,
};

/** Kept for components that still pass fontWeight (e.g. SVG text). */
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// Flat design: hierarchy comes from fill and line, not drop shadows.
const flat = { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
export const Shadows = { sm: flat, md: flat, lg: flat, glow: flat };

export const SvgFontFamily = Platform.select({
  web: '"Atkinson Hyperlegible", system-ui, sans-serif',
  default: Fonts.bold,
});
