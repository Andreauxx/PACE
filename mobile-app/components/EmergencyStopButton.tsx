// ============================================================
// AgriSweep — Emergency Stop
// Comb red is reserved for this. One press stops the motor and
// pump with no confirmation; releasing it is confirmed.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { OctagonX, RotateCcw } from 'lucide-react-native';
import { BorderRadius, Colors, Fonts, FontSize, Spacing } from '../constants/theme';

interface EmergencyStopButtonProps {
  engaged: boolean;
  onPress: () => void;
  onRelease: () => void;
  disabled?: boolean;
}

export default function EmergencyStopButton({ engaged, onPress, onRelease, disabled }: EmergencyStopButtonProps) {
  if (engaged) {
    return (
      <View style={styles.engaged}>
        <View style={styles.row}>
          <OctagonX size={26} color="#FFFFFF" strokeWidth={2.4} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Emergency stop is on</Text>
            <Text style={styles.sub}>Motor and pump are off. Check the cage before releasing.</Text>
          </View>
        </View>
        <Pressable
          onPress={onRelease}
          style={({ pressed }) => [styles.release, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Release emergency stop"
        >
          <RotateCcw size={16} color={Colors.combDark} />
          <Text style={styles.releaseText}>Release emergency stop</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Emergency stop"
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <OctagonX size={28} color="#FFFFFF" strokeWidth={2.4} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Emergency stop</Text>
        <Text style={styles.sub}>Stops the scraper and pump at once</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.comb,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
  },
  pressed: {
    backgroundColor: Colors.combDark,
  },
  disabled: {
    opacity: 0.5,
  },
  engaged: {
    backgroundColor: Colors.combDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  label: {
    fontFamily: Fonts.display,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  release: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
  },
  releaseText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.combDark,
  },
});
