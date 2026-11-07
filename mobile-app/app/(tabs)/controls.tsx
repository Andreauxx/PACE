// ============================================================
// AgriSweep — Controls
// The ink panel is the machine: start/stop and speed together.
// Jog, pump and emergency stop follow underneath.
// ============================================================

import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Play, Square, ArrowLeft, ArrowRight, Droplets, CircleAlert } from 'lucide-react-native';
import { useApp } from '../../hooks/useAppContext';
import ScreenHeader from '../../components/ScreenHeader';
import ConnectionPill from '../../components/ConnectionPill';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmergencyStopButton from '../../components/EmergencyStopButton';
import { SliderField, SwitchRow, Chip } from '../../components/FormControls';
import { BorderRadius, Colors, Fonts, FontSize, Spacing } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { CleaningCycleStage } from '../../types';
import { notify } from '../../utils/dialogs';
import { JOG_STEPS_CM, STROKE_RANGE_CM, cmPerSecond, formatSeconds, msForDistance } from '../../utils/travel';

const STAGE_LABEL: Record<CleaningCycleStage, string> = {
  idle: 'Ready',
  starting: 'Starting',
  scraper_forward: 'Sweeping to the bin',
  scraper_pause: 'Pausing at the bin',
  scraper_reverse: 'Returning home',
  pump_active: 'Rinsing',
  completing: 'Finishing',
  completed: 'Done',
  failed: 'Cycle failed',
  emergency_stopped: 'Emergency stop on',
};

const SPEED_PRESETS = [
  { label: 'Slow', value: 40 },
  { label: 'Normal', value: 70 },
  { label: 'Fast', value: 100 },
];

const SPRAY_SECONDS = [5, 10, 20, 30];

type Pending = 'start' | 'pump' | 'release' | null;

export default function ControlsScreen() {
  const {
    connectionStatus,
    connectionError,
    commandError,
    deviceStatus,
    cleaningSettings,
    setCleaningSettings,
    automationSettings,
    startCleaning,
    stopCleaning,
    scraperForward,
    scraperReverse,
    scraperStop,
    pumpOn,
    pumpOff,
    emergencyStop,
    resetEmergencyStop,
  } = useApp();
  const [pending, setPending] = useState<Pending>(null);

  const { scraper, pump } = deviceStatus;
  const live = connectionStatus === 'online';
  const eStopped = scraper.stage === 'emergency_stopped';
  const locked = !live || eStopped;
  const running =
    scraper.running || !['idle', 'completed', 'emergency_stopped', 'failed'].includes(scraper.stage);
  const jogLocked = locked || running;

  const confirmOr = (action: Exclude<Pending, null>, run: () => void) => {
    if (cleaningSettings.requireConfirmation || action === 'release') setPending(action);
    else run();
  };

  const runPending = () => {
    if (pending === 'start') startCleaning();
    if (pending === 'pump') pumpOn();
    if (pending === 'release') resetEmergencyStop();
    setPending(null);
  };

  const save = async (patch: Partial<typeof cleaningSettings>) => {
    const result = await setCleaningSettings({ ...cleaningSettings, ...patch });
    if (result.error) notify('Saved on this phone only', `The sweeper did not receive it: ${result.error}`);
  };

  const discDisabled = running ? !live : locked;
  const { scraperSpeedPercent: speed, travelCmPerSec: rate } = cleaningSettings;
  const strokeMs = msForDistance(cleaningSettings.strokeDistanceCm, speed, rate);
  const jogMs = msForDistance(cleaningSettings.jogDistanceCm, speed, rate);
  const overCutoff = strokeMs > cleaningSettings.maxScraperRuntimeMs;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Controls" subtitle="Start, steer and rinse the sweeper." right={<ConnectionPill status={connectionStatus} />} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!live && (
          <Pressable style={styles.notice} onPress={() => router.push('/settings')}>
            <CircleAlert size={18} color={Colors.amberDark} />
            <Text style={styles.noticeText}>
              {connectionStatus === 'connecting'
                ? 'Connecting to the sweeper. Controls unlock when it answers.'
                : `${connectionError ?? 'The sweeper is not connected.'} Tap to open Settings.`}
            </Text>
          </Pressable>
        )}

        {/* ---- The machine ---- */}
        <View style={styles.machine}>
          <View style={styles.machineTop}>
            <Text style={styles.machineName}>Sweeper</Text>
            <Text style={[styles.machineState, eStopped && { color: '#EDB1AA' }, running && { color: Colors.straw }]}>
              {STAGE_LABEL[scraper.stage]}
            </Text>
          </View>

          <View style={styles.discWrap}>
            <Pressable
              onPress={() => (running ? stopCleaning() : confirmOr('start', startCleaning))}
              disabled={discDisabled}
              accessibilityRole="button"
              accessibilityLabel={running ? 'Stop the sweeper' : 'Start cleaning'}
              style={({ pressed }) => [
                styles.disc,
                running ? styles.discStop : styles.discGo,
                discDisabled && styles.discOff,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              {running ? (
                <Square size={30} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={36} color={Colors.ink} fill={Colors.ink} style={{ marginLeft: 4 }} />
              )}
              <Text style={[styles.discLabel, running && { color: '#FFFFFF' }]}>{running ? 'Stop' : 'Start'}</Text>
            </Pressable>
            <Text style={styles.discHint}>
              {running
                ? 'Stops the cycle and sends the scraper home.'
                : `Sweeps to the bin and back${cleaningSettings.rinseAfterSweep ? ', then rinses' : ''}.`}
            </Text>
          </View>

          <View style={styles.machineRule} />

          <SliderField
            onDark
            label="Speed"
            value={cleaningSettings.scraperSpeedPercent}
            min={APP_CONFIG.minScraperSpeedPercent}
            max={100}
            step={5}
            format={(v) => `${Math.round(v)}%`}
            onCommit={(v) => void save({ scraperSpeedPercent: Math.round(v) })}
          />
          <View style={styles.presetRow}>
            {SPEED_PRESETS.map((p) => {
              const on = cleaningSettings.scraperSpeedPercent === p.value;
              return (
                <Pressable
                  key={p.value}
                  style={[styles.preset, on && styles.presetOn]}
                  onPress={() => void save({ scraperSpeedPercent: p.value })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.machineNote}>
            Below {APP_CONFIG.minScraperSpeedPercent}% the motor can stall under a heavy load. A new speed applies from the next stroke.
          </Text>

          <View style={[styles.machineRule, { marginTop: Spacing.lg }]} />
          <SliderField
            onDark
            label="Stroke distance"
            value={cleaningSettings.strokeDistanceCm}
            min={STROKE_RANGE_CM.min}
            max={STROKE_RANGE_CM.max}
            step={STROKE_RANGE_CM.step}
            format={(v) => `${Math.round(v)} cm`}
            onCommit={(v) => void save({ strokeDistanceCm: Math.round(v) })}
          />
          <Text style={styles.machineNote}>
            Each cycle sweeps {cleaningSettings.strokeDistanceCm} cm toward the bin and comes back the same distance. At{' '}
            {speed}% that is about {formatSeconds(strokeMs)} each way.
          </Text>
          {overCutoff && (
            <Text style={[styles.machineNote, { color: '#EDB1AA' }]}>
              This is longer than the {formatSeconds(cleaningSettings.maxScraperRuntimeMs)} safety cut-off, so the stroke will stop
              early. Raise the cut-off in Settings or shorten the stroke.
            </Text>
          )}
          {automationSettings.mode === 'automatic' && (
            <Text style={styles.machineNote}>Automatic mode is on, so the camera or schedule may also start cycles.</Text>
          )}
        </View>

        {/* ---- Jog ---- */}
        <Card title="Move by hand" subtitle={`Each press moves ${cleaningSettings.jogDistanceCm} cm (about ${formatSeconds(jogMs)}), then stops.`}>
          <View style={[styles.chipRow, { marginBottom: Spacing.md }]}>
            {JOG_STEPS_CM.map((cm) => (
              <Chip key={cm} label={`${cm} cm`} active={cleaningSettings.jogDistanceCm === cm} onPress={() => void save({ jogDistanceCm: cm })} />
            ))}
          </View>
          <View style={styles.jogRow}>
            <JogButton label={`Home ${cleaningSettings.jogDistanceCm} cm`} icon={<ArrowLeft size={20} color={jogLocked ? Colors.faint : Colors.ink} />} onPress={scraperReverse} disabled={jogLocked} active={scraper.direction === 'reverse'} />
            <JogButton label="Stop" icon={<Square size={17} color={locked ? Colors.faint : Colors.ink} />} onPress={scraperStop} disabled={locked} />
            <JogButton label={`Bin ${cleaningSettings.jogDistanceCm} cm`} icon={<ArrowRight size={20} color={jogLocked ? Colors.faint : Colors.ink} />} onPress={scraperForward} disabled={jogLocked} active={scraper.direction === 'forward'} />
          </View>
        </Card>

        {/* ---- Pump ---- */}
        <Card title="Water pump" headerRight={<StatusBadge label={pump.active ? 'Spraying' : 'Off'} variant={pump.active ? 'info' : 'neutral'} />}>
          <Pressable
            style={({ pressed }) => [styles.pumpBtn, pump.active && styles.pumpBtnOn, locked && styles.pumpBtnOff, pressed && { opacity: 0.85 }]}
            onPress={() => (pump.active ? pumpOff() : confirmOr('pump', pumpOn))}
            disabled={locked}
          >
            <Droplets size={20} color={pump.active ? '#FFFFFF' : Colors.rinse} />
            <Text style={[styles.pumpText, pump.active && { color: '#FFFFFF' }]}>
              {pump.active ? 'Stop spraying' : `Spray for ${cleaningSettings.pumpDurationMs / 1000} seconds`}
            </Text>
          </Pressable>
          <Text style={styles.groupLabel}>Spray time</Text>
          <View style={styles.chipRow}>
            {SPRAY_SECONDS.map((s) => (
              <Chip key={s} label={`${s} s`} active={cleaningSettings.pumpDurationMs === s * 1000} onPress={() => void save({ pumpDurationMs: s * 1000 })} />
            ))}
          </View>
          <SwitchRow
            label="Rinse after each sweep"
            description="Sprays once the scraper is back home."
            value={cleaningSettings.rinseAfterSweep}
            onChange={(v) => void save({ rinseAfterSweep: v })}
            last
          />
        </Card>

        <EmergencyStopButton engaged={eStopped} onPress={emergencyStop} onRelease={() => confirmOr('release', resetEmergencyStop)} />

        {commandError && <Text style={styles.error}>{commandError}</Text>}
      </ScrollView>

      <ConfirmDialog
        visible={pending === 'start'}
        title="Start cleaning?"
        message={`The scraper sweeps to the bin at ${cleaningSettings.scraperSpeedPercent}% speed and returns home${
          cleaningSettings.rinseAfterSweep ? ', then rinses the floor' : ''
        }. Make sure the track is clear.`}
        confirmLabel="Start cleaning"
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        visible={pending === 'pump'}
        title="Spray water?"
        message={`The pump sprays for ${cleaningSettings.pumpDurationMs / 1000} seconds.`}
        confirmLabel="Spray"
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        visible={pending === 'release'}
        title="Release emergency stop?"
        message="Check that the cage and track are clear. The motor and pump will accept commands again."
        confirmLabel="Release"
        tone="danger"
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

function JogButton({ label, icon, onPress, disabled, active }: { label: string; icon: React.ReactNode; onPress: () => void; disabled: boolean; active?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.jog, active && styles.jogActive, disabled && styles.jogOff, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.jogText, disabled && { color: Colors.faint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
  notice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: Colors.strawTint,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noticeText: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSize.sm, lineHeight: 20, color: Colors.amberDark },

  machine: {
    backgroundColor: Colors.ink,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  machineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  machineName: { fontFamily: Fonts.display, fontSize: FontSize.xxl, color: '#FFFFFF', letterSpacing: 0.3 },
  machineState: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: 'rgba(255, 255, 255, 0.7)' },
  discWrap: { alignItems: 'center', paddingVertical: Spacing.xl },
  disc: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 8,
  },
  discGo: { backgroundColor: Colors.straw, borderColor: 'rgba(229, 179, 35, 0.3)' },
  discStop: { backgroundColor: Colors.comb, borderColor: 'rgba(181, 52, 43, 0.35)' },
  discOff: { backgroundColor: Colors.inkSoft, borderColor: 'transparent' },
  discLabel: { fontFamily: Fonts.display, fontSize: FontSize.xxl, color: Colors.ink, letterSpacing: 1 },
  discHint: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  machineRule: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', marginBottom: Spacing.sm },
  presetRow: { flexDirection: 'row', gap: Spacing.sm },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetOn: { backgroundColor: Colors.straw },
  presetText: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: 'rgba(255, 255, 255, 0.85)' },
  presetTextOn: { color: Colors.ink },
  machineNote: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: Spacing.md,
  },

  jogRow: { flexDirection: 'row', gap: Spacing.sm },
  jog: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  jogActive: { borderColor: Colors.straw, borderWidth: 2, backgroundColor: Colors.strawTint },
  jogOff: { backgroundColor: Colors.sunken, borderColor: Colors.lineSoft },
  jogText: { fontFamily: Fonts.bold, fontSize: FontSize.xs, color: Colors.ink },

  pumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.rinseTint,
  },
  pumpBtnOn: { backgroundColor: Colors.rinse },
  pumpBtnOff: { opacity: 0.45 },
  pumpText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.rinse },
  groupLabel: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.ink, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  error: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.combDark,
    marginTop: Spacing.md,
    lineHeight: 20,
  },
});
