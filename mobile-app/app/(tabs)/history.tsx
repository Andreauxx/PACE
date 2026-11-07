// ============================================================
// AgriSweep — History & Analytics Screen (Screen 2)
// ============================================================

import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import {
  History as HistoryIcon,
  BarChart3,
  ListFilter,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader,
  Clock,
  Activity,
  TrendingUp,
  Wind,
  Radar,
  Droplets,
  Cog,
  Download,
} from 'lucide-react-native';
import { useApp } from '../../hooks/useAppContext';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import SensorChart from '../../components/SensorChart';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts, Shadows, Spacing } from '../../constants/theme';
import { CleaningCycle, CleaningStatus, EventLogEntry, EventSeverity, EventType, TimeRange } from '../../types';
import { cleaningCyclesToCsv, csvFilename, eventLogToCsv, exportCsv } from '../../utils/csv';
import { notify } from '../../utils/dialogs';

type IconComponent = typeof Activity;

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '1H', value: 'last_hour' },
  { label: '24H', value: 'last_24h' },
  { label: '7D', value: 'last_7d' },
];

const TAB_OPTIONS = ['Charts', 'Cleaning', 'Events', 'Analytics'] as const;
type TabOption = (typeof TAB_OPTIONS)[number];

function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig: Record<CleaningStatus, { variant: 'success' | 'warning' | 'error' | 'info'; icon: IconComponent }> = {
  completed: { variant: 'success', icon: CheckCircle2 },
  interrupted: { variant: 'warning', icon: AlertTriangle },
  failed: { variant: 'error', icon: XCircle },
  in_progress: { variant: 'info', icon: Loader },
};

const eventIcons: Record<EventType, IconComponent> = {
  device_connected: Activity,
  device_disconnected: Activity,
  sensor_warning: AlertTriangle,
  sensor_unavailable: AlertTriangle,
  cleaning_started: Cog,
  cleaning_completed: CheckCircle2,
  cleaning_failed: XCircle,
  pump_activated: Droplets,
  pump_deactivated: Droplets,
  motor_timeout: AlertTriangle,
  actuator_fault: XCircle,
  settings_changed: Activity,
  emergency_stop: XCircle,
  system_info: Activity,
};

const severityColors: Record<EventSeverity, string> = {
  info: Colors.info,
  warning: Colors.warning,
  error: Colors.error,
  critical: Colors.emergency,
};

export default function HistoryScreen() {
  const {
    mq135History,
    ultrasonicHistory,
    cleaningHistory,
    eventLog,
    analyticsSummary,
    sensorThresholds,
    refreshData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabOption>('Charts');
  const [timeRange, setTimeRange] = useState<TimeRange>('last_hour');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    refreshData();
    setTimeout(() => setRefreshing(false), 800);
  };

  const filteredMQ135 = useMemo(() => {
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      last_hour: 3600000,
      last_24h: 86400000,
      last_7d: 604800000,
      custom: 3600000,
    };
    const cutoff = now - ranges[timeRange];
    return mq135History.filter((d) => d.timestamp >= cutoff);
  }, [mq135History, timeRange]);

  const handleExport = async (kind: 'cleaning' | 'events') => {
    const csv = kind === 'cleaning' ? cleaningCyclesToCsv(cleaningHistory) : eventLogToCsv(eventLog);
    const filename = csvFilename(kind === 'cleaning' ? 'agrisweep-cleaning-log' : 'agrisweep-event-log');
    try {
      await exportCsv(filename, csv);
    } catch (e) {
      notify('Export Failed', e instanceof Error ? e.message : 'Could not export CSV.');
    }
  };

  const filteredUltrasonic = useMemo(() => {
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      last_hour: 3600000,
      last_24h: 86400000,
      last_7d: 604800000,
      custom: 3600000,
    };
    const cutoff = now - ranges[timeRange];
    return ultrasonicHistory.filter((d) => d.timestamp >= cutoff);
  }, [ultrasonicHistory, timeRange]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="History" subtitle="Readings, cleaning cycles and events." />

      {/* Segmented Tab Pill Bar */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          {TAB_OPTIONS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Charts Tab */}
        {activeTab === 'Charts' && (
          <>
            {/* Time Range Selector */}
            <View style={styles.timeRangeRow}>
              {TIME_RANGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.timeRangeBtn, timeRange === opt.value && styles.timeRangeBtnActive]}
                  onPress={() => setTimeRange(opt.value)}
                >
                  <Text style={[styles.timeRangeText, timeRange === opt.value && styles.timeRangeTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <SensorChart
              data={filteredMQ135}
              title="Ammonia (MQ-135)"
              unit="ppm"
              color={Colors.chartLine1}
              thresholds={[
                { value: sensorThresholds.mq135.warningThreshold, label: 'Warning', color: Colors.warning },
                { value: sensorThresholds.mq135.criticalThreshold, label: 'Danger', color: Colors.error },
              ]}
            />

            <SensorChart
              data={filteredUltrasonic}
              title="Bin Clearance (HC-SR04)"
              unit="cm"
              color={Colors.chartLine2}
              thresholds={[
                { value: sensorThresholds.ultrasonic.warningDistanceCm, label: 'Warning', color: Colors.warning },
                { value: sensorThresholds.ultrasonic.criticalDistanceCm, label: 'Full', color: Colors.error },
              ]}
            />
            <Text style={styles.chartHint}>Touch and drag across a chart to inspect individual readings.</Text>
          </>
        )}

        {/* Cleaning History Tab */}
        {activeTab === 'Cleaning' && (
          <>
            <ExportBar
              count={cleaningHistory.length}
              noun="cleaning cycle"
              onExport={() => handleExport('cleaning')}
            />
            {cleaningHistory.length === 0 ? (
              <EmptyState title="No Cleaning Records" message="Cleaning history will appear here when cycles are completed." />
            ) : (
              cleaningHistory.map((cycle) => (
                <CleaningCycleCard key={cycle.id} cycle={cycle} />
              ))
            )}
          </>
        )}

        {/* Events Tab */}
        {activeTab === 'Events' && (
          <>
            <ExportBar count={eventLog.length} noun="event" onExport={() => handleExport('events')} />
            {eventLog.length === 0 ? (
              <EmptyState title="No Events" message="System events will be logged here." />
            ) : (
              eventLog.map((event) => (
                <EventCard key={event.id} event={event} />
              ))
            )}
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'Analytics' && (
          <>
            <Card title="Summary" icon={<BarChart3 size={18} color={Colors.primary} />}>
              <View style={styles.analyticsGrid}>
                <AnalyticsStat label="Total Cycles" value={analyticsSummary.totalCleaningCycles.toString()} />
                <AnalyticsStat label="Avg Duration" value={formatDuration(analyticsSummary.averageCycleDuration)} />
                <AnalyticsStat
                  label="Completion Rate"
                  value={`${Math.round(analyticsSummary.completionRate * 100)}%`}
                />
                <AnalyticsStat label="Sensor Warnings" value={analyticsSummary.sensorWarningCount.toString()} />
              </View>
            </Card>

            <Card title="Daily Activity" icon={<Calendar size={18} color={Colors.primary} />}>
              {analyticsSummary.dailyCycles.map((day) => (
                <View key={day.date} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{day.date}</Text>
                  <View style={styles.dayBarContainer}>
                    <View
                      style={[
                        styles.dayBar,
                        { width: `${Math.min(100, (day.count / 6) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayCount}>{day.count}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Sub-components

function CleaningCycleCard({ cycle }: { cycle: CleaningCycle }) {
  const cfg = statusConfig[cycle.status];
  const StatusIcon = cfg.icon;

  return (
    <View style={styles.cycleCard}>
      <View style={styles.cycleHeader}>
        <View style={styles.cycleHeaderLeft}>
          <StatusIcon size={16} color={cfg.variant === 'success' ? Colors.success : cfg.variant === 'error' ? Colors.error : Colors.warning} />
          <Text style={styles.cycleTime}>{formatDate(cycle.startTime)}</Text>
        </View>
        <StatusBadge label={cycle.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} variant={cfg.variant} size="sm" />
      </View>

      <View style={styles.cycleDetails}>
        <View style={styles.cycleDetail}>
          <Text style={styles.cycleDetailLabel}>Duration</Text>
          <Text style={styles.cycleDetailValue}>{cycle.duration ? formatDuration(cycle.duration) : '—'}</Text>
        </View>
        <View style={styles.cycleDetail}>
          <Text style={styles.cycleDetailLabel}>Mode</Text>
          <Text style={styles.cycleDetailValue}>{cycle.mode.charAt(0).toUpperCase() + cycle.mode.slice(1)}</Text>
        </View>
        <View style={styles.cycleDetail}>
          <Text style={styles.cycleDetailLabel}>Scraper</Text>
          <Text style={styles.cycleDetailValue}>{cycle.scraperActivated ? 'Yes' : 'No'}</Text>
        </View>
        <View style={styles.cycleDetail}>
          <Text style={styles.cycleDetailLabel}>Pump</Text>
          <Text style={styles.cycleDetailValue}>{cycle.pumpActivated ? 'Yes' : 'No'}</Text>
        </View>
      </View>

      {cycle.errorReason && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{cycle.errorReason}</Text>
        </View>
      )}
    </View>
  );
}

function EventCard({ event }: { event: EventLogEntry }) {
  const Icon = eventIcons[event.type];
  const color = severityColors[event.severity];

  return (
    <View style={styles.eventCard}>
      <View style={[styles.eventIconBox, { backgroundColor: color + '18' }]}>
        <Icon size={14} color={color} />
      </View>
      <View style={styles.eventContent}>
        <Text style={styles.eventMessage}>{event.message}</Text>
        <View style={styles.eventMeta}>
          <Text style={styles.eventTime}>{formatDate(event.timestamp)}</Text>
          <Text style={styles.eventSource}>• {event.source}</Text>
        </View>
      </View>
    </View>
  );
}

function ExportBar({ count, noun, onExport }: { count: number; noun: string; onExport: () => void }) {
  return (
    <View style={styles.exportBar}>
      <Text style={styles.exportCount}>
        {count} {noun}
        {count === 1 ? '' : 's'}
      </Text>
      <TouchableOpacity
        style={[styles.exportBtn, count === 0 && styles.exportBtnDisabled]}
        onPress={onExport}
        disabled={count === 0}
        activeOpacity={0.8}
      >
        <Download size={14} color={count === 0 ? Colors.textTertiary : '#FFFFFF'} />
        <Text style={[styles.exportText, count === 0 && { color: Colors.textTertiary }]}>Export CSV</Text>
      </TouchableOpacity>
    </View>
  );
}

function AnalyticsStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.analyticsStat}>
      <Text style={styles.analyticsValue}>{value}</Text>
      <Text style={styles.analyticsLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBarWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  tabText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  timeRangeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  timeRangeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  timeRangeBtnActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: 'rgba(47, 90, 69, 0.35)',
  },
  timeRangeText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textTertiary,
  },
  timeRangeTextActive: {
    color: Colors.primaryDark,
    fontFamily: Fonts.bold,
  },
  chartHint: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
  exportBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  exportCount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadows.glow,
  },
  exportBtnDisabled: {
    backgroundColor: Colors.disabledBg,
    shadowOpacity: 0,
    elevation: 0,
  },
  exportText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  // Cleaning cycle card
  cycleCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cycleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cycleTime: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  cycleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Colors.sunken,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cycleDetail: {
    minWidth: '40%',
    flex: 1,
  },
  cycleDetailLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontFamily: Fonts.regular,
  },
  cycleDetailValue: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  errorBar: {
    marginTop: Spacing.md,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(181, 52, 43, 0.3)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.errorDark,
    fontFamily: Fonts.bold,
  },
  // Event card
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  eventIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventMessage: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontFamily: Fonts.regular,
    marginBottom: 3,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  eventTime: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  eventSource: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  // Analytics
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  analyticsStat: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: Colors.sunken,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 4,
    ...Shadows.sm,
  },
  analyticsValue: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.display,
    color: Colors.text,
  },
  analyticsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontFamily: Fonts.regular,
  },
  // Daily activity
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dayLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 80,
  },
  dayBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.background,
    borderRadius: 5,
    overflow: 'hidden',
  },
  dayBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 5,
  },
  dayCount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
    width: 24,
    textAlign: 'right',
  },
  bottomPadding: {
    height: 20,
  },
});
