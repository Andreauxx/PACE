// ============================================================
// AgriSweep — Home
// Opens with one sentence: what the cage needs right now.
// Below it, the instruments: bin tank, ammonia, scraper track.
// ============================================================

import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Square, Settings as SettingsIcon } from 'lucide-react-native';
import { useApp } from '../../hooks/useAppContext';
import AmmoniaGauge from '../../components/AmmoniaGauge';
import BinLevelTank from '../../components/BinLevelTank';
import ScraperVisualizer from '../../components/ScraperVisualizer';
import ConfirmDialog from '../../components/ConfirmDialog';
import ConnectionPill from '../../components/ConnectionPill';
import { BorderRadius, Colors, Fonts, FontSize, Spacing } from '../../constants/theme';
import { cmPerSecond } from '../../utils/travel';
import { CleaningCycleStage, TriggerSource } from '../../types';
import { STATION_STALE_MS, formatNextRun, nextScheduledRun } from '../../utils/automation';

const SOURCE_LABEL: Record<TriggerSource, string> = {
  manual: 'you',
  schedule: 'the schedule',
  ai: 'the camera',
  sensor: 'the ammonia sensor',
};

const RUNNING_LINE: Partial<Record<CleaningCycleStage, string>> = {
  starting: 'Starting up',
  scraper_forward: 'Sweeping toward the bin',
  scraper_pause: 'Pausing at the bin',
  scraper_reverse: 'Returning home',
  pump_active: 'Rinsing the floor',
  completing: 'Finishing up',
};

function timeAgo(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '0s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

type Tone = 'calm' | 'moving' | 'alert' | 'idle';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    firebaseConfig,
    deviceStatus,
    connectionStatus,
    connectionError,
    mq135Reading,
    ultrasonicReading,
    sensorThresholds,
    cleaningSettings,
    cleaningStats,
    automationSettings,
    visionStatus,
    lastTrigger,
    startCleaning,
    stopCleaning,
    emergencyStop,
    refreshData,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { scraper } = deviceStatus;
  const live = connectionStatus === 'online';
  const configured = firebaseConfig.databaseUrl.length > 0;
  const eStopped = scraper.stage === 'emergency_stopped';
  const running = scraper.running || !!RUNNING_LINE[scraper.stage];
  const stationOnline = !!visionStatus?.lastSeen && Date.now() - visionStatus.lastSeen < STATION_STALE_MS;
  const nextRun = nextScheduledRun(automationSettings.schedule, new Date());

  // ---- The one sentence ----
  let headline: string;
  let detail: string;
  let tone: Tone;
  if (!configured) {
    headline = 'Not connected';
    detail = 'Add your Firebase database in Settings to see and control the sweeper.';
    tone = 'idle';
  } else if (connectionStatus === 'connecting') {
    headline = 'Connecting';
    detail = 'Reaching the sweeper through Firebase.';
    tone = 'idle';
  } else if (!live) {
    headline = 'Sweeper offline';
    detail = connectionError ?? 'Check that the ESP32 is powered and on Wi-Fi.';
    tone = 'alert';
  } else if (eStopped) {
    headline = 'Emergency stop on';
    detail = 'Release it on the Controls tab once the track is clear.';
    tone = 'alert';
  } else if (running) {
    headline = 'Sweeping now';
    detail = `${RUNNING_LINE[scraper.stage] ?? 'Running'} at ${cleaningSettings.scraperSpeedPercent}% speed.`;
    tone = 'moving';
  } else if (ultrasonicReading.status === 'critical') {
    headline = 'Bin is full';
    detail = automationSettings.sensors.pauseWhenBinFull
      ? 'Empty the waste bin. Automatic cleaning waits until it is emptied.'
      : 'Empty the waste bin before the next cycle.';
    tone = 'alert';
  } else if (stationOnline && (visionStatus?.detections ?? 0) > 0) {
    headline = 'Droppings spotted';
    detail = `The camera sees ${visionStatus?.detections}. ${
      automationSettings.mode === 'automatic' && automationSettings.ai.enabled
        ? `Cleaning starts after ${automationSettings.ai.consecutiveFrames} snapshots in a row.`
        : 'Start a cycle when you are ready.'
    }`;
    tone = 'alert';
  } else if (mq135Reading.status === 'critical' || mq135Reading.status === 'warning') {
    headline = 'Ammonia is high';
    detail = `${mq135Reading.value.toFixed(0)} ppm in the cage. A cleaning cycle should help.`;
    tone = 'alert';
  } else {
    headline = 'Cage is clean';
    detail = `Last cleaned ${timeAgo(deviceStatus.lastCleaningCycleTime)}.${
      automationSettings.schedule.enabled ? ` Next scheduled ${formatNextRun(nextRun).toLowerCase()}.` : ''
    }`;
    tone = 'calm';
  }

  const onRefresh = () => {
    setRefreshing(true);
    refreshData();
    setTimeout(() => setRefreshing(false), 800);
  };

  const start = () => (cleaningSettings.requireConfirmation ? setConfirming(true) : startCleaning());

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.ink} />}
      >
        <View style={styles.topRow}>
          <Text style={styles.brand}>AgriSweep</Text>
          <ConnectionPill status={connectionStatus} />
        </View>

        {/* ---- Hero ---- */}
        <View style={styles.hero}>
          <View style={[styles.toneBar, styles[`tone_${tone}`]]} />
          <Text style={styles.headline} accessibilityRole="header">
            {headline}
          </Text>
          <Text style={styles.detail}>{detail}</Text>

          {!configured ? (
            <Pressable style={({ pressed }) => [styles.btn, styles.btnInk, styles.setupBtn, pressed && styles.pressed]} onPress={() => router.push('/settings')}>
              <SettingsIcon size={18} color="#FFFFFF" />
              <Text style={styles.btnInkText}>Set up connection</Text>
            </Pressable>
          ) : (
            <View style={styles.actions}>
              {running ? (
                <Pressable style={({ pressed }) => [styles.btn, styles.btnInk, styles.grow, pressed && styles.pressed]} onPress={stopCleaning} disabled={!live}>
                  <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.btnInkText}>Stop sweeper</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.btn, styles.btnStraw, styles.grow, (!live || eStopped) && styles.btnOff, pressed && styles.pressed]}
                  onPress={start}
                  disabled={!live || eStopped}
                >
                  <Play size={17} color={Colors.ink} fill={Colors.ink} />
                  <Text style={styles.btnStrawText}>Start cleaning</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnComb, pressed && styles.pressed]}
                onPress={emergencyStop}
                accessibilityLabel="Emergency stop"
              >
                <Text style={styles.btnCombText}>Stop all</Text>
              </Pressable>
            </View>
          )}
          {lastTrigger && live ? (
            <Text style={styles.footnote}>
              Last cycle started by {SOURCE_LABEL[lastTrigger.source]}, {timeAgo(lastTrigger.at)}.
            </Text>
          ) : null}
        </View>

        {/* ---- Instruments ---- */}
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

        <AmmoniaGauge
          ppm={mq135Reading.status === 'unavailable' ? null : mq135Reading.value}
          rawAdc={mq135Reading.rawAdc}
          warningThreshold={sensorThresholds.mq135.warningThreshold}
          criticalThreshold={sensorThresholds.mq135.criticalThreshold}
          status={mq135Reading.status}
          trend={mq135Reading.trend}
          timestamp={mq135Reading.timestamp}
        />

        <ScraperVisualizer
          scraper={scraper}
          strokeDistanceCm={cleaningSettings.strokeDistanceCm}
          cmPerSecond={cmPerSecond(cleaningSettings.travelCmPerSec, cleaningSettings.scraperSpeedPercent)}
        />

        {/* ---- Today ---- */}
        <View style={styles.today}>
          <Text style={styles.todayTitle}>Today</Text>
          <View style={styles.todayRow}>
            <Figure value={String(cleaningStats.cyclesToday)} label={cleaningStats.cyclesToday === 1 ? 'cycle' : 'cycles'} />
            <Figure value={formatDuration(cleaningStats.totalCleaningTimeToday)} label="sweeping" />
            <Figure value={cleaningStats.averageDurationMs ? formatDuration(cleaningStats.averageDurationMs) : '–'} label="per cycle" />
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirming}
        title="Start cleaning?"
        message={`The scraper sweeps to the bin at ${cleaningSettings.scraperSpeedPercent}% speed and returns home${
          cleaningSettings.rinseAfterSweep ? ', then rinses the floor' : ''
        }. Make sure the track is clear.`}
        confirmLabel="Start cleaning"
        onConfirm={() => {
          setConfirming(false);
          startCleaning();
        }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  brand: {
    fontFamily: Fonts.displayBold,
    fontSize: FontSize.lg,
    color: Colors.barn,
    letterSpacing: 0.6,
  },
  hero: {
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  toneBar: { width: 40, height: 5, borderRadius: 3, marginBottom: Spacing.md },
  tone_calm: { backgroundColor: Colors.moss },
  tone_moving: { backgroundColor: Colors.straw },
  tone_alert: { backgroundColor: Colors.comb },
  tone_idle: { backgroundColor: Colors.faint },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 56,
    lineHeight: 56,
    color: Colors.ink,
    letterSpacing: 0.2,
  },
  detail: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 23,
    color: Colors.muted,
    marginTop: Spacing.sm,
    maxWidth: 340,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  grow: { flex: 1 },
  btnStraw: { backgroundColor: Colors.straw },
  btnStrawText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.ink },
  btnInk: { backgroundColor: Colors.ink },
  setupBtn: { marginTop: Spacing.xl },
  btnInkText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: '#FFFFFF' },
  btnComb: { backgroundColor: Colors.comb },
  btnCombText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: '#FFFFFF' },
  btnOff: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  footnote: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.faint,
    marginTop: Spacing.md,
  },
  today: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  todayTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  todayRow: { flexDirection: 'row', gap: Spacing.xl },
  figure: {},
  figureValue: { fontFamily: Fonts.display, fontSize: FontSize.xxxl, color: Colors.ink, lineHeight: 40 },
  figureLabel: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint },
});
