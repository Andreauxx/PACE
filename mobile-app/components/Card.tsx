// ============================================================
// AgriSweep — Panel
// Flat steel panel. Hierarchy comes from fill, not shadow.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';

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
      {(title || headerRight) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
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
    backgroundColor: Colors.steel,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    flex: 1,
  },
  icon: {
    marginTop: 1,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
    lineHeight: 21,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.faint,
    marginTop: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
