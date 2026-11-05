// ============================================================
// AgriSweep — Dashboard Screen (Screen 1)
// ============================================================

import React from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import {
  Cog,
  Droplets,
  Activity,
  Clock,
  CheckCircle2,
  Timer,
  Zap,
  WifiOff,
  ChevronRight,
} from 'lucide-react-native';
import { useApp } from '../../hooks/useAppContext';
import AppHeader from '../../components/AppHeader';
import AmmoniaGauge from '../../components/AmmoniaGauge';
import BinLevelTank from '../../components/BinLevelTank';
import ScraperVisualizer from '../../components/ScraperVisualizer';
import ActuatorCard from '../../components/ActuatorCard';
import CleaningControls from '../../components/CleaningControls';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { ConnectionStatus } from '../../types';

const connectionBadge: Record<ConnectionStatus, { label: string; variant: 'success' | 'demo' | 'warning' | 'error' | 'neutral' }> = {
  online: { label: 'Online', variant: 'success' },
  connecting: { label: 'Connecting', variant: 'warning' },
  offline: { label: 'Offline', variant: 'neutral' },
  error: { label: 'Error', variant: 'error' },
  demo: { label: 'Demo Mode', variant: 'demo' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function DashboardScreen() {
  const {
    isDemoMode,
    deviceStatus,
    connectionStatus,
    connectionError,
    commandError,
    mq135Reading,
    ultrasonicReading,
    sensorThresholds,
    cleaningSettings,
    cleaningStats,
    startCleaning,
    stopCleaning,
    scraperForward,
    scraperReverse,
    scraperStop,
    pumpOn,
    pumpOff,
    emergencyStop,
    resetEmergencyStop,
    refreshData,
  } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refreshData();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshData]);

  const modeLabel = deviceStatus.operatingMode === 'automatic' ? 'Automatic' : 'Manual';

  return (
    <View style={styles.container}>
      <AppHeader connectionStatus={connectionStatus} isDemoMode={isDemoMode} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {!isDemoMode && connectionStatus !== 'online' && (
          <TouchableOpacity style={styles.linkBanner} onPress={() => router.push('/settings')} activeOpacity={0.8}>
            <View style={styles.linkBannerIcon}>
              <WifiOff size={16} color={connectionStatus === 'error' ? Colors.error : Colors.warningDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkBannerTitle}>
                {connectionStatus === 'connecting' ? 'Connecting to hardware…' : 'Hardware link unavailable'}
              </Text>
              <Text style={styles.linkBannerText}>
                {connectionError ?? 'Waiting for the Firebase Realtime Database stream.'}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* System Status Card */}
        <Card
          title="System Status"
          icon={<Activity size={18} color={Colors.primary} />}
          headerRight={
            <StatusBadge
              label={modeLabel}
              variant={deviceStatus.operatingMode === 'automatic' ? 'info' : 'neutral'}
            />
          }
        >
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Connection</Text>
              <StatusBadge
                label={connectionBadge[connectionStatus].label}
                variant={connectionBadge[connectionStatus].variant}
              />
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Cleaning System</Text>
              <StatusBadge
                label={
                  deviceStatus.scraper.running
                    ? 'Active'
                    : deviceStatus.scraper.stage === 'emergency_stopped'
                    ? 'E-Stopped'
                    : 'Idle'
                }
                variant={
                  deviceStatus.scraper.running
                    ? 'success'
                    : deviceStatus.scraper.stage === 'emergency_stopped'
                    ? 'error'
                    : 'neutral'
                }
              />
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Last Communication</Text>
              <Text style={styles.statusValue}>
                {formatTimeAgo(deviceStatus.lastCommunicationTime)}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Last Cleaning</Text>
              <Text style={styles.statusValue}>
                {formatTimeAgo(deviceStatus.lastCleaningCycleTime)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Sensor Cards */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Sensor Monitoring</Text>
        </View>

        <AmmoniaGauge
          ppm={mq135Reading.status === 'unavailable' ? null : mq135Reading.value}
          rawAdc={mq135Reading.rawAdc}
          warningThreshold={sensorThresholds.mq135.warningThreshold}
          criticalThreshold={sensorThresholds.mq135.criticalThreshold}
          status={mq135Reading.status}
          trend={mq135Reading.trend}
          timestamp={mq135Reading.timestamp}
        />

        <BinLevelTank
          accumulationPercent={ultrasonicReading.accumulationPercent}
          distanceCm={ultrasonicReading.distanceCm}
          referenceDistanceCm={ultrasonicReading.referenceDistanceCm}
          warningDistanceCm={sensorThresholds.ultrasonic.warningDistanceCm}
          criticalDistanceCm={sensorThresholds.ultrasonic.criticalDistanceCm}
          status={ultrasonicReading.status}
          trend={ultrasonicReading.trend}
          timestamp={ultrasonicReading.timestamp}
        />

        {/* Scraper Mechanism */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Scraper Mechanism</Text>
        </View>

        <ScraperVisualizer
          scraper={deviceStatus.scraper}
          isDemoMode={isDemoMode}
          travelTimeMs={isDemoMode ? APP_CONFIG.demoScraperTravelMs : APP_CONFIG.liveScraperTravelMs}
        />

        {/* Actuator Status */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Actuator Status</Text>
        </View>

        <ActuatorCard
          title="Scraper Motor"
          icon={<Cog size={18} color={deviceStatus.scraper.running ? Colors.success : Colors.textSecondary} />}
          isActive={deviceStatus.scraper.running}
          activeLabel="Running"
          inactiveLabel="Stopped"
          isDemoMode={isDemoMode}
          fault={deviceStatus.scraper.fault}
          details={[
            { label: 'Direction', value: deviceStatus.scraper.direction.charAt(0).toUpperCase() + deviceStatus.scraper.direction.slice(1) },
            { label: 'Driver', value: 'BTS7960 · 12V DC' },
            { label: 'Fwd Limit', value: deviceStatus.scraper.limitSwitches.forward ? 'Triggered' : 'Clear' },
            { label: 'Rev Limit', value: deviceStatus.scraper.limitSwitches.reverse ? 'Triggered' : 'Clear' },
            { label: 'Max Runtime', value: formatDuration(deviceStatus.scraper.maxRuntimeMs) },
          ]}
        />

        <ActuatorCard
          title="Water Pump"
          icon={<Droplets size={18} color={deviceStatus.pump.active ? Colors.info : Colors.textSecondary} />}
          isActive={deviceStatus.pump.active}
          activeLabel="ON"
          inactiveLabel="OFF"
          isDemoMode={isDemoMode}
          fault={deviceStatus.pump.fault}
          details={[
            { label: 'Status', value: deviceStatus.pump.active ? 'Water Cleaning Active' : 'Inactive' },
            { label: 'Last Activation', value: formatTimeAgo(deviceStatus.pump.lastActivationTime) },
            { label: 'Configured Duration', value: formatDuration(deviceStatus.pump.configuredRuntimeMs) },
          ]}
        />

        {/* Manual Controls */}
        <CleaningControls
          connectionStatus={connectionStatus}
          isDemoMode={isDemoMode}
          scraperRunning={deviceStatus.scraper.running}
          scraperStage={deviceStatus.scraper.stage}
          pumpActive={deviceStatus.pump.active}
          requireConfirmation={cleaningSettings.requireConfirmation}
          commandError={commandError}
          onStartCleaning={startCleaning}
          onStopCleaning={stopCleaning}
          onScraperForward={scraperForward}
          onScraperReverse={scraperReverse}
          onScraperStop={scraperStop}
          onPumpOn={pumpOn}
          onPumpOff={pumpOff}
          onEmergencyStop={emergencyStop}
          onResetEmergencyStop={resetEmergencyStop}
        />

        {/* Quick Statistics */}
        <Card
          title="Quick Statistics"
          icon={<Zap size={18} color="#059669" />}
          subtitle={isDemoMode ? 'Simulated operational telemetry' : undefined}
        >
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <CheckCircle2 size={18} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{cleaningStats.cyclesToday}</Text>
              <Text style={styles.statLabel}>Cycles Today</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#F0F9FF', borderColor: 'rgba(2, 132, 199, 0.2)' }]}>
                <Timer size={18} color="#0284C7" />
              </View>
              <Text style={styles.statValue}>{formatDuration(cleaningStats.totalCleaningTimeToday)}</Text>
              <Text style={styles.statLabel}>Total Time</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5', borderColor: 'rgba(5, 150, 105, 0.2)' }]}>
                <Clock size={18} color="#059669" />
              </View>
              <Text style={styles.statValue}>{formatDuration(cleaningStats.averageDurationMs)}</Text>
              <Text style={styles.statLabel}>Avg Duration</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#FFFBEB', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <Activity size={18} color="#D97706" />
              </View>
              <Text style={styles.statValue}>
                {cleaningStats.lastCleaningResult
                  ? cleaningStats.lastCleaningResult.charAt(0).toUpperCase() + cleaningStats.lastCleaningResult.slice(1)
                  : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Last Result</Text>
            </View>
          </View>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  linkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  linkBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  linkBannerText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#059669',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  statusGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: Spacing.md,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  statusValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },
  bottomPadding: {
    height: 24,
  },
});
