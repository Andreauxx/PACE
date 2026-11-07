// ============================================================
// AgriSweep — Status Badge
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSize, BorderRadius } from '../constants/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  showDot?: boolean;
}

const LOOK: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: Colors.mossTint, text: Colors.barnDark, dot: Colors.moss },
  warning: { bg: Colors.strawTint, text: Colors.amberDark, dot: Colors.amber },
  error: { bg: Colors.combTint, text: Colors.combDark, dot: Colors.comb },
  info: { bg: Colors.rinseTint, text: Colors.rinse, dot: Colors.rinse },
  neutral: { bg: Colors.sunken, text: Colors.muted, dot: Colors.faint },
};

export default function StatusBadge({ label, variant = 'neutral', size = 'sm', icon, showDot = true }: StatusBadgeProps) {
  const look = LOOK[variant];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }, size === 'md' && styles.badgeMd]}>
      {icon ? icon : showDot ? <View style={[styles.dot, { backgroundColor: look.dot }]} /> : null}
      <Text style={[styles.label, { color: look.text }, size === 'md' && styles.labelMd]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.xs,
  },
  labelMd: {
    fontSize: FontSize.sm,
  },
});
