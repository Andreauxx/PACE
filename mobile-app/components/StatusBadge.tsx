// ============================================================
// AgriSweep — Modern Status Badge Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'demo';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  showDot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string; border: string }> = {
  success: {
    bg: '#ECFDF5',
    text: '#047857',
    dot: '#10B981',
    border: 'rgba(16, 185, 129, 0.25)',
  },
  warning: {
    bg: '#FFFBEB',
    text: '#B45309',
    dot: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  error: {
    bg: '#FEF2F2',
    text: '#B91C1C',
    dot: '#EF4444',
    border: 'rgba(239, 68, 68, 0.25)',
  },
  info: {
    bg: '#F0F9FF',
    text: '#0369A1',
    dot: '#0284C7',
    border: 'rgba(2, 132, 199, 0.25)',
  },
  neutral: {
    bg: '#F8FAFC',
    text: '#475569',
    dot: '#94A3B8',
    border: 'rgba(148, 163, 184, 0.25)',
  },
  demo: {
    bg: '#F5F3FF',
    text: '#6D28D9',
    dot: '#8B5CF6',
    border: 'rgba(139, 92, 246, 0.25)',
  },
};

export default function StatusBadge({
  label,
  variant = 'neutral',
  size = 'sm',
  icon,
  showDot = true,
}: StatusBadgeProps) {
  const cfg = variantStyles[variant];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        isSmall && styles.badgeSm,
      ]}
    >
      {icon ? (
        icon
      ) : showDot ? (
        <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      ) : null}
      <Text style={[styles.label, { color: cfg.text }, isSmall && styles.labelSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  labelSm: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
