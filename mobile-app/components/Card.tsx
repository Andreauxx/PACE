// ============================================================
// AgriSweep — Modern Card Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

export default function Card({ title, subtitle, icon, headerRight, children, style, noPadding }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {(title || icon || headerRight) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <View style={{ flex: 1 }}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {headerRight}
        </View>
      )}
      <View style={noPadding ? undefined : styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
    fontWeight: FontWeight.medium,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
