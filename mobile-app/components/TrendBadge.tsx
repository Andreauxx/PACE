// ============================================================
// AgriSweep — Trend Badge
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts } from '../constants/theme';
import { Trend } from '../utils/sensors';

interface TrendBadgeProps {
  trend: Trend;
  /** When true, a rising trend is shown in warning colours (e.g. gas, waste level). */
  risingIsBad?: boolean;
}

const BAD = { bg: Colors.warningLight, border: 'rgba(185, 127, 14, 0.3)', icon: Colors.warningDark, text: Colors.warningDark };
const GOOD = { bg: Colors.primarySurface, border: 'rgba(47, 90, 69, 0.3)', icon: Colors.primary, text: Colors.primaryDark };
const NEUTRAL = { bg: Colors.sunken, border: 'rgba(105, 115, 109, 0.25)', icon: Colors.textTertiary, text: Colors.textTertiary };

export default function TrendBadge({ trend, risingIsBad = false }: TrendBadgeProps) {
  const label = trend === 'rising' ? 'Rising' : trend === 'falling' ? 'Falling' : trend === 'stable' ? 'Stable' : 'No trend';
  const palette =
    trend === 'rising' ? (risingIsBad ? BAD : GOOD) : trend === 'falling' ? (risingIsBad ? GOOD : BAD) : NEUTRAL;
  const Icon = trend === 'rising' ? TrendingUp : trend === 'falling' ? TrendingDown : Minus;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Icon size={13} color={palette.icon} strokeWidth={2.5} />
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
});
