// ============================================================
// AgriSweep — Waste Bin Level Reservoir (HC-SR04)
// Tank-style fill indicator with ultrasonic beam and clearance.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radar } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Fonts, Shadows, Spacing } from '../constants/theme';
import { SensorStatus } from '../types';
import { Trend, binCapacityFromDistance, clamp } from '../utils/sensors';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import StatusBadge from './StatusBadge';
import TrendBadge from './TrendBadge';

interface BinLevelTankProps {
  accumulationPercent: number | null;
  distanceCm: number;
  referenceDistanceCm: number;
  warningDistanceCm: number;
  criticalDistanceCm: number;
  status: SensorStatus;
  trend: Trend;
  timestamp: number;
}

const TANK_HEIGHT = 168;

const fillColor: Record<SensorStatus, { fill: string; surface: string }> = {
  normal: { fill: Colors.primaryLight, surface: Colors.straw },
  elevated: { fill: Colors.warning, surface: Colors.warning },
  warning: { fill: Colors.warning, surface: Colors.warning },
  critical: { fill: Colors.error, surface: Colors.error },
  unavailable: { fill: Colors.disabled, surface: Colors.border },
};

const statusLabel: Record<SensorStatus, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  warning: 'Empty soon',
  critical: 'Bin full',
  unavailable: 'No data',
};

const statusVariant: Record<SensorStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  normal: 'success',
  elevated: 'warning',
  warning: 'warning',
  critical: 'error',
  unavailable: 'neutral',
};

export default function BinLevelTank({
  accumulationPercent,
  distanceCm,
  referenceDistanceCm,
  warningDistanceCm,
  criticalDistanceCm,
  status,
  trend,
  timestamp,
}: BinLevelTankProps) {
  const hasData = accumulationPercent !== null && status !== 'unavailable';
  const level = useAnimatedNumber(hasData ? clamp(accumulationPercent, 0, 100) : 0);
  const colors = fillColor[status];
  const warningLevel = binCapacityFromDistance(warningDistanceCm, referenceDistanceCm);
  const criticalLevel = binCapacityFromDistance(criticalDistanceCm, referenceDistanceCm);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Radar size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Waste bin</Text>
            <Text style={styles.subtitle}>Measured from above by the HC-SR04</Text>
          </View>
        </View>
        <StatusBadge label={statusLabel[status]} variant={statusVariant[status]} />
      </View>

      <View style={styles.body}>
        {/* Tank */}
        <View style={styles.tankColumn}>
          <View style={styles.sensorHead}>
            <View style={styles.sensorEye} />
            <View style={styles.sensorEye} />
          </View>
          <View style={styles.tank}>
            {/* Fill */}
            <View style={[styles.fill, { height: `${level}%`, backgroundColor: colors.fill }]}>
              <View style={[styles.fillSurface, { backgroundColor: colors.surface }]} />
            </View>

            {/* Ultrasonic beam from sensor down to waste surface */}
            {hasData && <View style={[styles.beam, { height: `${100 - level}%` }]} />}

            {/* Graduations */}
            {[25, 50, 75].map((g) => (
              <View key={g} style={[styles.graduation, { bottom: `${g}%` }]}>
                <View style={styles.graduationTick} />
                <Text style={styles.graduationLabel}>{g}</Text>
              </View>
            ))}

            {/* Threshold markers */}
            <View style={[styles.threshold, { bottom: `${warningLevel}%`, borderColor: Colors.warning }]} />
            <View style={[styles.threshold, { bottom: `${criticalLevel}%`, borderColor: Colors.error }]} />
          </View>
        </View>

        {/* Readout */}
        <View style={styles.readout}>
          <Text style={styles.percentLabel}>Fill level</Text>
          <View style={styles.percentRow}>
            <Text style={styles.percent}>{hasData ? Math.round(level) : '—'}</Text>
            <Text style={styles.percentUnit}>%</Text>
          </View>

          <View style={styles.metrics}>
            <Metric label="Clearance to sensor" value={hasData ? `${distanceCm.toFixed(1)} cm` : '—'} emphasis />
            <Metric label="Warning at" value={`≤ ${warningDistanceCm} cm`} dotColor={Colors.warning} />
            <Metric label="Full at" value={`≤ ${criticalDistanceCm} cm`} dotColor={Colors.error} />
            <Metric label="Bin depth" value={`${referenceDistanceCm} cm`} />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TrendBadge trend={trend} risingIsBad />
        <Text style={styles.timestamp}>
          {hasData
            ? `Updated ${new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Awaiting sensor data'}
        </Text>
      </View>
    </View>
  );
}

function Metric({ label, value, emphasis, dotColor }: { label: string; value: string; emphasis?: boolean; dotColor?: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricLabelRow}>
        {dotColor && <View style={[styles.metricDot, { backgroundColor: dotColor }]} />}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, emphasis && styles.metricValueEmphasis]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
    fontFamily: Fonts.regular,
  },
  body: {
    flexDirection: 'row',
    gap: Spacing.xl,
    alignItems: 'flex-end',
  },
  tankColumn: {
    alignItems: 'center',
  },
  sensorHead: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 3,
  },
  sensorEye: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textTertiary,
    borderWidth: 2,
    borderColor: Colors.disabled,
  },
  tank: {
    width: 96,
    height: TANK_HEIGHT,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: Colors.disabled,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
  },
  fillSurface: {
    height: 4,
    width: '100%',
    opacity: 0.9,
  },
  beam: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(45, 110, 147, 0.35)',
  },
  graduation: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: -6,
  },
  graduationTick: {
    width: 10,
    height: 1.5,
    backgroundColor: 'rgba(105, 115, 109, 0.5)',
  },
  graduationLabel: {
    fontSize: 9,
    color: 'rgba(74, 86, 80, 0.8)',
    fontFamily: Fonts.bold,
  },
  threshold: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    opacity: 0.8,
  },
  readout: {
    flex: 1,
  },
  percentLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.textTertiary,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: Spacing.md,
  },
  percent: {
    fontSize: 44,
    fontFamily: Fonts.display,
    color: Colors.text,
    letterSpacing: -1.5,
  },
  percentUnit: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
  metrics: {
    gap: Spacing.sm,
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
  },
  metricValue: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontFamily: Fonts.bold,
  },
  metricValueEmphasis: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.display,
    color: Colors.info,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontFamily: Fonts.regular,
  },
});
