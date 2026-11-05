// ============================================================
// AgriSweep — Trend Badge
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { FontSize, FontWeight, BorderRadius } from '../constants/theme';
import { Trend } from '../utils/sensors';

interface TrendBadgeProps {
  trend: Trend;
  /** When true, a rising trend is shown in warning colours (e.g. gas, waste level). */
  risingIsBad?: boolean;
}

const BAD = { bg: '#FFFBEB', border: 'rgba(245, 158, 11, 0.3)', icon: '#D97706', text: '#B45309' };
const GOOD = { bg: '#ECFDF5', border: 'rgba(16, 185, 129, 0.3)', icon: '#059669', text: '#047857' };
const NEUTRAL = { bg: '#F8FAFC', border: 'rgba(148, 163, 184, 0.25)', icon: '#64748B', text: '#64748B' };

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
    fontWeight: FontWeight.semibold,
  },
});
