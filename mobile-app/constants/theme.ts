// ============================================================
// AgriSweep — Design System Theme Constants
// ============================================================

// ============================================================
// AgriSweep — Modern Design System Theme Constants
// ============================================================

import { Platform } from 'react-native';

export const Colors = {
  // Primary brand: Modern Emerald & Clean Tech Mint
  primary: '#059669',          // Modern Jewel Emerald
  primaryLight: '#10B981',     // Luminous Neo-Mint
  primaryDark: '#047857',      // Deep Forest Emerald
  primarySurface: '#ECFDF5',   // Soft Mint Porcelain
  primaryGlow: 'rgba(16, 185, 129, 0.20)',

  // Accent / fresh mint highlights
  accent: '#10B981',
  accentLight: '#34D399',
  accentDark: '#059669',

  // Background: Crisp slate porcelain canvas
  background: '#F8FAFC',       // Clean, high-end, bright slate
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',

  // Typography: High-contrast modern Slate
  text: '#0F172A',             // Slate 900
  textSecondary: '#475569',    // Slate 600
  textTertiary: '#94A3B8',     // Slate 400
  textInverse: '#FFFFFF',

  // Status Colors
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningDark: '#D97706',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  errorDark: '#DC2626',
  info: '#0284C7',
  infoLight: '#F0F9FF',

  // Connection states
  online: '#10B981',
  connecting: '#F59E0B',
  offline: '#94A3B8',
  demo: '#8B5CF6',             // Sleek Violet Indigo

  // Sensor states
  sensorNormal: '#10B981',
  sensorElevated: '#F59E0B',
  sensorWarning: '#F97316',
  sensorCritical: '#EF4444',
  sensorUnavailable: '#94A3B8',

  // Cleaning states
  cleaningIdle: '#64748B',
  cleaningActive: '#059669',
  cleaningCompleted: '#10B981',
  cleaningFailed: '#EF4444',

  // UI elements: Crisp, subtle borders and glass tokens
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#F1F5F9',
  shadow: 'rgba(15, 23, 42, 0.06)',
  shadowDark: 'rgba(15, 23, 42, 0.12)',
  overlay: 'rgba(15, 23, 42, 0.60)',
  disabled: '#CBD5E1',
  disabledBg: '#F1F5F9',

  // Tab bar
  tabBarBg: '#FFFFFF',
  tabBarActive: '#059669',
  tabBarInactive: '#94A3B8',

  // Emergency
  emergency: '#E11D48',
  emergencyBg: '#FFE4E6',

  // Chart
  chartLine1: '#059669',
  chartLine2: '#0284C7',
  chartGrid: '#F1F5F9',
  chartThreshold: '#F59E0B',
};

export const DarkColors = {
  ...Colors,
  background: '#090D16',
  surface: '#111827',
  surfaceElevated: '#1F2937',
  card: '#111827',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#1E293B',
  borderLight: '#1E293B',
  divider: '#1E293B',
  shadow: 'rgba(0, 0, 0, 0.4)',
  shadowDark: 'rgba(0, 0, 0, 0.6)',
  tabBarBg: '#111827',
  primarySurface: 'rgba(16, 185, 129, 0.12)',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  infoLight: 'rgba(2, 132, 199, 0.15)',
  disabledBg: '#1E293B',
  chartGrid: '#1E293B',
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

export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
  glow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
};

// SVG <Text> doesn't inherit the page font on web (falls back to serif).
export const SvgFontFamily = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: undefined,
});
