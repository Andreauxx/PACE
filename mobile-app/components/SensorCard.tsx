// ============================================================
// AgriSweep — Modern Sensor Card Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';
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
      <View style={[styles.trendBadge, { backgroundColor: '#FFFBEB', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
        <TrendingUp size={13} color="#D97706" strokeWidth={2.5} />
        <Text style={[styles.trendText, { color: '#B45309' }]}>Rising</Text>
      </View>
    );
  }
  if (trend === 'falling') {
    return (
      <View style={[styles.trendBadge, { backgroundColor: '#F0F9FF', borderColor: 'rgba(2, 132, 199, 0.3)' }]}>
        <TrendingDown size={13} color="#0284C7" strokeWidth={2.5} />
        <Text style={[styles.trendText, { color: '#0369A1' }]}>Falling</Text>
      </View>
    );
  }
  return (
    <View style={[styles.trendBadge, { backgroundColor: '#F8FAFC', borderColor: 'rgba(148, 163, 184, 0.25)' }]}>
      <Minus size={13} color="#64748B" strokeWidth={2.5} />
      <Text style={[styles.trendText, { color: '#64748B' }]}>Stable</Text>
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.lg,
    ...Shadows.sm,
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
    width: 40,
    height: 40,
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
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    letterSpacing: -1,
  },
  unit: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
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
    fontWeight: FontWeight.semibold,
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
    fontWeight: FontWeight.medium,
  },
  extra: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
