// ============================================================
// AgriSweep — Connection Pill
// One small, consistent indicator of the link to the sweeper.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSize } from '../constants/theme';
import { ConnectionStatus } from '../types';

const LOOK: Record<ConnectionStatus, { label: string; dot: string }> = {
  online: { label: 'Live', dot: Colors.moss },
  connecting: { label: 'Connecting', dot: Colors.amber },
  offline: { label: 'Offline', dot: Colors.faint },
  error: { label: 'Not connected', dot: Colors.comb },
};

export default function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const look = LOOK[status];
  return (
    <View style={styles.pill} accessibilityLabel={`Sweeper link: ${look.label}`}>
      <View style={[styles.dot, { backgroundColor: look.dot }]} />
      <Text style={styles.label}>{look.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.steel,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.xs,
    color: Colors.ink,
  },
});
