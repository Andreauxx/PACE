// ============================================================
// AgriSweep — Automation Screen
// Operating mode, AI camera trigger sensitivity, cleaning
// schedule and sensor triggers. Rules are synced to
// /system/automation and executed by the Camera Station phone.
// ============================================================

import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import {
  Bot,
  Hand,
  Camera,
  CalendarClock,
  Wind,
  ScanEye,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Timer,
  Video,
  Info,
} from 'lucide-react-native';
import { useApp } from '../../hooks/useAppContext';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import { SliderField, Segmented, SwitchRow, Chip } from '../../components/FormControls';
import { Colors, FontSize, FontWeight, Fonts, Spacing } from '../../constants/theme';
import { AutomationSettings, TriggerSource } from '../../types';
import {
  AI_PRESETS,
  AiPreset,
  DAY_LABELS,
  STATION_STALE_MS,
  describeAiRule,
  formatClock,
  formatNextRun,
  matchingPreset,
  nextScheduledRun,
  shiftTime,
  sortSlots,
} from '../../utils/automation';
import { notify } from '../../utils/dialogs';

const MAX_SLOTS = 8;

const SOURCE_LABEL: Record<TriggerSource, string> = {
  manual: 'Manual (app)',
  schedule: 'Schedule',
  ai: 'Camera AI',
  sensor: 'Ammonia sensor',
};

function timeAgo(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}

/** Re-renders every 30 s so "next run" and station freshness stay current. */
function useTick(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export default function AutomationScreen() {
  const { automationSettings: a, setAutomationSettings, visionStatus, lastTrigger } = useApp();
  const now = useTick(30_000);

  const save = async (next: AutomationSettings) => {
    const result = await setAutomationSettings(next);
    if (result.error) notify('Saved on this phone only', `Could not sync to Firebase: ${result.error}`);
  };
  const patchAi = (p: Partial<AutomationSettings['ai']>) => void save({ ...a, ai: { ...a.ai, ...p } });
  const patchSchedule = (p: Partial<AutomationSettings['schedule']>) => void save({ ...a, schedule: { ...a.schedule, ...p } });
  const patchSensors = (p: Partial<AutomationSettings['sensors']>) => void save({ ...a, sensors: { ...a.sensors, ...p } });

  const auto = a.mode === 'automatic';
  const stationOnline = !!visionStatus?.lastSeen && now - visionStatus.lastSeen < STATION_STALE_MS;
  const nextRun = nextScheduledRun(a.schedule, new Date(now));
  const preset = matchingPreset(a.ai);

  const addSlot = () => {
    if (a.schedule.slots.length >= MAX_SLOTS) return;
    const last = sortSlots(a.schedule.slots).at(-1);
    const time = last ? shiftTime(last.time, 120) : '06:00';
    patchSchedule({ slots: sortSlots([...a.schedule.slots, { id: `slot-${Date.now()}`, time, enabled: true }]) });
  };

  const updateSlot = (id: string, patch: { time?: string; enabled?: boolean }) =>
    patchSchedule({ slots: sortSlots(a.schedule.slots.map((s) => (s.id === id ? { ...s, ...patch } : s))) });

  const toggleDay = (day: number) => {
    const has = a.schedule.daysOfWeek.includes(day);
    patchSchedule({ daysOfWeek: has ? a.schedule.daysOfWeek.filter((d) => d !== day) : [...a.schedule.daysOfWeek, day].sort() });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Automation"
        subtitle="When the sweeper may start on its own."
        right={<StatusBadge label={auto ? 'Automatic' : 'Manual'} variant={auto ? 'success' : 'neutral'} />}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ---- Mode ---- */}
        <Card title="Mode">
          <Segmented
            value={a.mode}
            onChange={(mode) => void save({ ...a, mode })}
            options={[
              { value: 'manual', label: 'Manual', icon: (on) => <Hand size={15} color={on ? '#FFFFFF' : Colors.textSecondary} /> },
              { value: 'automatic', label: 'Automatic', icon: (on) => <Bot size={15} color={on ? '#FFFFFF' : Colors.textSecondary} /> },
            ]}
          />
          <Text style={styles.help}>
            {auto
              ? 'The camera, schedule and sensor triggers below can start cycles on their own. The emergency stop always overrides them.'
              : 'Cycles only start when you press Start on the Controls tab. Your automation rules are kept for later.'}
          </Text>
          <SliderField
            label="Minimum gap between automatic cycles"
            value={a.cooldownMin}
            min={5}
            max={240}
            step={5}
            format={(v) => (v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v} min`)}
            onCommit={(v) => void save({ ...a, cooldownMin: v })}
            disabled={!auto}
          />
        </Card>

        {/* ---- Camera station ---- */}
        <Card
          title="Camera station"
          subtitle="A phone pointed at the cage floor"
          headerRight={<StatusBadge label={stationOnline ? 'Watching' : 'Offline'} variant={stationOnline ? 'success' : 'neutral'} />}
        >
          <View style={styles.statGrid}>
            <Stat label="Droppings seen" value={stationOnline ? String(visionStatus?.detections ?? 0) : '–'} />
            <Stat label="Top confidence" value={stationOnline ? `${Math.round((visionStatus?.maxConfidence ?? 0) * 100)}%` : '–'} />
            <Stat label="Streak" value={stationOnline ? `${visionStatus?.streak ?? 0}/${a.ai.consecutiveFrames}` : '–'} />
            <Stat label="Last frame" value={timeAgo(visionStatus?.lastFrameAt ?? null)} />
          </View>
          {visionStatus?.error && stationOnline ? <Text style={styles.errorText}>{visionStatus.error}</Text> : null}
          <View style={styles.lastTrigger}>
            <Timer size={14} color={Colors.textSecondary} />
            <Text style={styles.lastTriggerText}>
              Last cycle requested by{' '}
              <Text style={styles.bold}>{lastTrigger ? SOURCE_LABEL[lastTrigger.source] : '—'}</Text>
              {lastTrigger ? ` · ${timeAgo(lastTrigger.at)}` : ''}
              {lastTrigger?.detail ? ` · ${lastTrigger.detail}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/station')} activeOpacity={0.85}>
            <Camera size={17} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Use this phone as the camera</Text>
          </TouchableOpacity>
          <Text style={styles.help}>
            The camera phone also runs the schedule and the ammonia trigger. Keep it plugged in with this screen open.
          </Text>
        </Card>

        {/* ---- AI trigger ---- */}
        <Card title="Camera trigger" subtitle="How sure the camera must be before it cleans">
          <SwitchRow
            label="Clean when droppings are detected"
            value={a.ai.enabled}
            onChange={(enabled) => patchAi({ enabled })}
            last
          />
          <View style={[!a.ai.enabled && styles.dim]} pointerEvents={a.ai.enabled ? 'auto' : 'none'}>
            <Text style={styles.groupLabel}>Sensitivity</Text>
            <Segmented<AiPreset>
              value={preset}
              onChange={(p) => patchAi(AI_PRESETS[p])}
              options={[
                { value: 'sensitive', label: 'Sensitive' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'strict', label: 'Strict' },
              ]}
            />
            {!preset && <Text style={styles.customTag}>Custom settings</Text>}

            <SliderField
              label="Minimum AI confidence"
              value={a.ai.minConfidencePercent}
              min={30}
              max={95}
              step={5}
              format={(v) => `${v}%`}
              hint="higher = fewer false alarms"
              onCommit={(v) => patchAi({ minConfidencePercent: v })}
            />
            <SliderField
              label="Droppings needed in view"
              value={a.ai.minDetections}
              min={1}
              max={10}
              step={1}
              format={(v) => `${v}`}
              onCommit={(v) => patchAi({ minDetections: v })}
            />
            <SliderField
              label="Pad dirtiness threshold (coverage)"
              value={a.ai.minCoveragePercent}
              min={0}
              max={100}
              step={1}
              format={(v) => (v === 0 ? 'Off (any count)' : `${v}% dirty`)}
              hint="e.g. 20% triggers when 20% of pad is dirty"
              onCommit={(v) => patchAi({ minCoveragePercent: v })}
            />
            <SliderField
              label="Snapshots in a row"
              value={a.ai.consecutiveFrames}
              min={1}
              max={10}
              step={1}
              format={(v) => `${v}`}
              hint="filters out passing birds"
              onCommit={(v) => patchAi({ consecutiveFrames: v })}
            />
            <SliderField
              label="Snapshot every"
              value={a.ai.captureIntervalSec}
              min={2}
              max={30}
              step={1}
              format={(v) => `${v}s`}
              onCommit={(v) => patchAi({ captureIntervalSec: v })}
            />
            <View style={styles.ruleBox}>
              <Info size={14} color={Colors.primaryDark} />
              <Text style={styles.ruleText}>{describeAiRule(a.ai, a.cooldownMin)}</Text>
            </View>
          </View>
        </Card>

        {/* ---- Schedule ---- */}
        <Card
          title="Schedule"
          subtitle={a.schedule.enabled ? `Next: ${formatNextRun(nextRun, new Date(now))}` : 'Off'}
          >
          <SwitchRow label="Clean on a schedule" value={a.schedule.enabled} onChange={(enabled) => patchSchedule({ enabled })} last />
          <View style={[!a.schedule.enabled && styles.dim]} pointerEvents={a.schedule.enabled ? 'auto' : 'none'}>
            <Text style={styles.groupLabel}>Days</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, day) => (
                <Chip key={label} label={label} active={a.schedule.daysOfWeek.includes(day)} onPress={() => toggleDay(day)} />
              ))}
            </View>

            <Text style={styles.groupLabel}>Times</Text>
            {a.schedule.slots.length === 0 && <Text style={styles.help}>No times yet. Add one below.</Text>}
            {a.schedule.slots.map((slot) => (
              <View key={slot.id} style={[styles.slot, !slot.enabled && styles.slotOff]}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => updateSlot(slot.id, { time: shiftTime(slot.time, -15) })}
                  onLongPress={() => updateSlot(slot.id, { time: shiftTime(slot.time, -60) })}
                  accessibilityLabel="15 minutes earlier"
                >
                  <ChevronLeft size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.slotTime}>{formatClock(slot.time)}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => updateSlot(slot.id, { time: shiftTime(slot.time, 15) })}
                  onLongPress={() => updateSlot(slot.id, { time: shiftTime(slot.time, 60) })}
                  accessibilityLabel="15 minutes later"
                >
                  <ChevronRight size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[styles.slotToggle, slot.enabled && styles.slotToggleOn]}
                  onPress={() => updateSlot(slot.id, { enabled: !slot.enabled })}
                >
                  <Text style={[styles.slotToggleText, slot.enabled && { color: '#FFFFFF' }]}>{slot.enabled ? 'On' : 'Off'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => patchSchedule({ slots: a.schedule.slots.filter((s) => s.id !== slot.id) })}
                  accessibilityLabel="Remove time"
                >
                  <Trash2 size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {a.schedule.slots.length < MAX_SLOTS && (
              <TouchableOpacity style={styles.addBtn} onPress={addSlot}>
                <Plus size={16} color={Colors.primaryDark} />
                <Text style={styles.addText}>Add time</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.help}>Tap the arrows to move by 15 minutes, hold them to move by an hour.</Text>
          </View>
        </Card>

        {/* ---- Sensor triggers ---- */}
        <Card title="Sensor triggers" subtitle="Ammonia and bin level">
          <SwitchRow
            label="Clean when ammonia is high"
            description="Starts a cycle when the MQ-135 reading passes the level below."
            value={a.sensors.ammoniaEnabled}
            onChange={(ammoniaEnabled) => patchSensors({ ammoniaEnabled })}
          />
          <SliderField
            label="Ammonia level"
            value={a.sensors.ammoniaPpm}
            min={10}
            max={100}
            step={5}
            format={(v) => `${v} ppm`}
            hint="estimated"
            onCommit={(v) => patchSensors({ ammoniaPpm: v })}
            disabled={!a.sensors.ammoniaEnabled}
          />
          <SwitchRow
            label="Pause automation when the bin is full"
            description="Skips automatic cycles until the waste bin is emptied. Manual Start still works."
            value={a.sensors.pauseWhenBinFull}
            onChange={(pauseWhenBinFull) => patchSensors({ pauseWhenBinFull })}
            last
          />
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  dim: { opacity: 0.4 },
  help: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 17, marginTop: Spacing.sm },
  bold: { fontFamily: Fonts.bold, color: Colors.text },
  errorText: { fontSize: FontSize.xs, color: Colors.error, fontFamily: Fonts.bold, marginTop: Spacing.sm },
  groupLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  customTag: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', marginTop: 6 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontFamily: Fonts.display, color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2, fontFamily: Fonts.regular },
  lastTrigger: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: Spacing.md },
  lastTriggerText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontFamily: Fonts.bold },
  ruleBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(47, 90, 69, 0.25)',
    padding: Spacing.md,
  },
  ruleText: { flex: 1, fontSize: FontSize.xs, color: Colors.primaryDark, lineHeight: 17, fontFamily: Fonts.regular },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: Spacing.sm,
  },
  slotOff: { opacity: 0.55 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  slotTime: { fontSize: FontSize.lg, fontFamily: Fonts.display, color: Colors.text, minWidth: 92, textAlign: 'center', fontVariant: ['tabular-nums'] },
  slotToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  slotToggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primaryDark },
  slotToggleText: { fontSize: FontSize.xs, fontFamily: Fonts.bold, color: Colors.textSecondary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(47, 90, 69, 0.45)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  addText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.primaryDark },
});
