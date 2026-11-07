// ============================================================
// AgriSweep — Modern Sensor Card Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts, Shadows, Spacing } from '../constants/theme';
import StatusBadge from './StatusBadge';
import { SensorStatus } from '../types';

interface SensorCardProps {
  title: string;
  icon: React.ReactNode;
  value: string;
  unit: string;
  timestamp: number;
  status: SensorStatus;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  subtitle?: string;
  extra?: React.ReactNode;
}

const statusBadgeVariant: Record<SensorStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  normal: 'success',
  elevated: 'warning',
  warning: 'warning',
  critical: 'error',
  unavailable: 'neutral',
};

const statusLabels: Record<SensorStatus, string> = {
  normal: 'Optimal',
  elevated: 'Elevated',
  warning: 'Warning',
  critical: 'Critical',
  unavailable: 'Offline',
};

function TrendBadge({ trend }: { trend: string }) {
  if (trend === 'rising') {
    return (
      <View style={[styles.trendBadge, { backgroundColor: Colors.warningLight, borderColor: 'rgba(185, 127, 14, 0.3)' }]}>
        <TrendingUp size={13} color={Colors.warningDark} strokeWidth={2.5} />
        <Text style={[styles.trendText, { color: Colors.warningDark }]}>Rising</Text>
      </View>
    );
  }
  if (trend === 'falling') {
    return (
      <View style={[styles.trendBadge, { backgroundColor: Colors.infoLight, borderColor: 'rgba(45, 110, 147, 0.3)' }]}>
        <TrendingDown size={13} color={Colors.info} strokeWidth={2.5} />
        <Text style={[styles.trendText, { color: Colors.info }]}>Falling</Text>
      </View>
    );
  }
  return (
    <View style={[styles.trendBadge, { backgroundColor: Colors.sunken, borderColor: 'rgba(105, 115, 109, 0.25)' }]}>
      <Minus size={13} color={Colors.textTertiary} strokeWidth={2.5} />
      <Text style={[styles.trendText, { color: Colors.textTertiary }]}>Stable</Text>
    </View>
  );
}

export default function SensorCard({
  title,
  icon,
  value,
  unit,
  timestamp,
  status,
  trend,
  subtitle,
  extra,
}: SensorCardProps) {
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>{icon}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        <StatusBadge label={statusLabels[status]} variant={statusBadgeVariant[status]} />
      </View>

      <View style={styles.body}>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        <TrendBadge trend={trend} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.timestamp}>Updated: {timeStr}</Text>
      </View>

      {extra && <View style={styles.extra}>{extra}</View>}
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
    marginBottom: Spacing.md,
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
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 34,
    fontFamily: Fonts.display,
    color: Colors.text,
    letterSpacing: -1,
  },
  unit: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  trendText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontFamily: Fonts.regular,
  },
  extra: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
