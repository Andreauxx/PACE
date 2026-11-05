// ============================================================
// AgriSweep — Modern App Header Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Leaf, FlaskConical, Database } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { ConnectionStatus } from '../types';

interface AppHeaderProps {
  connectionStatus: ConnectionStatus;
  isDemoMode: boolean;
}

const connectionConfig: Record<ConnectionStatus, { label: string; color: string; bg: string; border: string }> = {
  online: {
    label: 'Online',
    color: '#34D399',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(52, 211, 153, 0.35)',
  },
  connecting: {
    label: 'Connecting',
    color: '#FBBF24',
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(251, 191, 36, 0.35)',
  },
  offline: {
    label: 'Offline',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.25)',
  },
  error: {
    label: 'Link Error',
    color: '#FCA5A5',
    bg: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(252, 165, 165, 0.35)',
  },
  demo: {
    label: 'Demo Mode',
    color: '#C084FC',
    bg: 'rgba(168, 85, 247, 0.15)',
    border: 'rgba(192, 132, 252, 0.35)',
  },
};

export default function AppHeader({ connectionStatus, isDemoMode }: AppHeaderProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const cfg = connectionConfig[connectionStatus];

  return (
    <View style={styles.header}>
      {/* Subtle top ambient glow */}
      <View style={styles.ambientGlow} />

      <View style={styles.headerTop}>
        <View style={styles.brandRow}>
          <View style={styles.logoContainer}>
            <Leaf size={22} color="#10B981" strokeWidth={2.5} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.appName}>AgriSweep</Text>
              <View style={styles.proTag}>
                <Text style={styles.proTagText}>PRO</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Automated Cage Waste System</Text>
          </View>
        </View>

        <View
          style={[
            styles.connectionBadge,
            { backgroundColor: cfg.bg, borderColor: cfg.border },
          ]}
        >
          <View style={[styles.liveDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.connectionText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
      </View>

      <View style={styles.headerBottom}>
        <View style={styles.telemetryChip}>
          <Text style={styles.dateText}>
            {dateStr} • {timeStr}
          </Text>
        </View>

        {isDemoMode ? (
          <View style={styles.demoBanner}>
            <FlaskConical size={11} color="#C084FC" strokeWidth={2.5} />
            <Text style={styles.demoText}>SIMULATED TELEMETRY</Text>
          </View>
        ) : (
          <View style={styles.liveBanner}>
            <Database size={11} color="#6EE7B7" strokeWidth={2.5} />
            <Text style={styles.liveText}>FIREBASE RTDB</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#064E3B', // Rich deep emerald slate
    paddingHorizontal: Spacing.xl,
    paddingTop: 54,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.md,
  },
  ambientGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  proTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  proTagText: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    color: '#34D399',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.70)',
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  headerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  telemetryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  dateText: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: FontWeight.medium,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  demoText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: '#E9D5FF',
    letterSpacing: 0.8,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.3)',
  },
  liveText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: '#D1FAE5',
    letterSpacing: 0.8,
  },
});
