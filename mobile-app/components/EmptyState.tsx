// ============================================================
// AgriSweep — Empty State Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts, Spacing } from '../constants/theme';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
}

export default function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon || <Inbox size={40} color={Colors.textTertiary} strokeWidth={1.5} />}
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  message: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
