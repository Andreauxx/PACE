// ============================================================
// AgriSweep — Modern Actuator Status Card Component
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';
import StatusBadge from './StatusBadge';

interface ActuatorCardProps {
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
  details: { label: string; value: string }[];
  fault?: string | null;
  isDemoMode?: boolean;
}

export default function ActuatorCard({
  title,
  icon,
  isActive,
  activeLabel,
  inactiveLabel,
  details,
  fault,
  isDemoMode,
}: ActuatorCardProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    if (!isActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isActive]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>{icon}</View>
          <View>
            <Text style={styles.title}>{title}</Text>
            {isDemoMode && <Text style={styles.demoLabel}>Simulated Actuator</Text>}
          </View>
        </View>
        <StatusBadge
          label={isActive ? activeLabel : inactiveLabel}
          variant={isActive ? 'success' : 'neutral'}
        />
      </View>

      {isActive && (
        <View style={styles.activeStrip}>
          <Animated.View style={[styles.activePulseDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Text style={styles.activeStripText}>Actuator Engaged & Running</Text>
        </View>
      )}

      <View style={styles.detailsGrid}>
        {details.map((d, i) => (
          <View key={i} style={styles.detailItem}>
            <Text style={styles.detailLabel}>{d.label}</Text>
            <Text style={styles.detailValue}>{d.value}</Text>
          </View>
        ))}
      </View>

      {fault && (
        <View style={styles.faultBar}>
          <Text style={styles.faultText}>⚠ {fault}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.lg,
    ...Shadows.sm,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#ECFDF5',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  demoLabel: {
    fontSize: FontSize.xs,
    color: Colors.demo,
    fontWeight: FontWeight.medium,
  },
  activeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  activePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeStripText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#047857',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailItem: {
    minWidth: '45%',
    flex: 1,
  },
  detailLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: FontWeight.medium,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  faultBar: {
    marginTop: Spacing.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  faultText: {
    fontSize: FontSize.xs,
    color: '#B91C1C',
    fontWeight: FontWeight.semibold,
  },
});
