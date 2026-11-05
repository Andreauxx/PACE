// ============================================================
// AgriSweep — Tactical Emergency Stop
// High-visibility E-stop with a pulsing red halo. Fires on a
// single press with no confirmation; releasing it is confirmed.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { OctagonX, RotateCcw, ShieldAlert } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';

interface EmergencyStopButtonProps {
  engaged: boolean;
  onPress: () => void;
  onRelease: () => void;
  disabled?: boolean;
}

export default function EmergencyStopButton({ engaged, onPress, onRelease, disabled }: EmergencyStopButtonProps) {
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    halo.setValue(0);
    if (disabled) return;
    const loop = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: engaged ? 900 : 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [halo, engaged, disabled]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  if (engaged) {
    return (
      <View style={styles.engagedPanel}>
        <Animated.View style={[styles.halo, styles.haloEngaged, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
        <View style={styles.engagedHeader}>
          <ShieldAlert size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.engagedTitle}>EMERGENCY STOP ENGAGED</Text>
            <Text style={styles.engagedSubtitle}>Motor and pump de-energized. Inspect the cage before releasing.</Text>
          </View>
        </View>
        <Pressable
          onPress={onRelease}
          style={({ pressed }) => [styles.releaseBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Release emergency stop"
        >
          <RotateCcw size={15} color="#BE123C" />
          <Text style={styles.releaseText}>Release E-Stop</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!disabled && <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Emergency stop"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, disabled && styles.buttonDisabled]}
      >
        <View style={styles.hazardStripe} />
        <View style={styles.iconRing}>
          <OctagonX size={26} color={disabled ? '#94A3B8' : '#FFFFFF'} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>EMERGENCY STOP</Text>
          <Text style={[styles.sublabel, disabled && styles.labelDisabled]}>Instant cut-off · scraper motor + water pump</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: Colors.emergency,
  },
  haloEngaged: {
    borderRadius: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.emergency,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#9F1239',
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonPressed: {
    backgroundColor: '#BE123C',
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: Colors.disabledBg,
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  hazardStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#FACC15',
  },
  iconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  sublabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  labelDisabled: {
    color: Colors.textTertiary,
  },
  engagedPanel: {
    backgroundColor: '#9F1239',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FACC15',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  engagedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  engagedTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  engagedSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    lineHeight: 16,
  },
  releaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
  },
  releaseText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#BE123C',
  },
});
