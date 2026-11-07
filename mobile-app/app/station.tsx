// ============================================================
// AgriSweep — Camera Station
// Run this screen on a phone mounted over the cage. It:
//   1. snapshots the cage floor every few seconds,
//   2. runs the droppings detector and applies the AI trigger rules,
//   3. runs the cleaning schedule and the ammonia trigger,
//   4. publishes its status to /system/vision as a heartbeat.
// Every automatic start goes through canAutoTrigger(), which
// refuses while the E-stop is engaged or a cycle is running.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, Pause, ScanEye, CalendarClock, Wind, Camera as CameraIcon, CircleAlert } from 'lucide-react-native';
import { useApp } from '../hooks/useAppContext';
import { detect, detectorReady, setSimulatedDroppings } from '../services/detector';
import {
  canAutoTrigger,
  dueScheduleKey,
  evaluateFrame,
  formatNextRun,
  nextScheduledRun,
} from '../utils/automation';
import { Detection, TriggerSource, VisionStatus } from '../types';
import { Colors, FontSize, FontWeight, Fonts, Spacing } from '../constants/theme';

const RULE_TICK_MS = 15_000;
const MAX_LOG = 8;

interface LogLine {
  id: number;
  at: number;
  text: string;
  tone: 'info' | 'good' | 'warn';
}

export default function StationScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const {
    automationSettings,
    detectorConfig,
    deviceStatus,
    connectionStatus,
    mq135Reading,
    publishVision,
  } = app;

  const [permission, requestPermission] = useCameraPermissions();
  const [running, setRunning] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [boxes, setBoxes] = useState<{ accepted: Detection[]; rejected: Detection[] }>({ accepted: [], rejected: [] });
  const [frame, setFrame] = useState<{ streak: number; count: number; maxConf: number; latency: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [simDirty, setSimDirty] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const streakRef = useRef(0);
  const busyRef = useRef(false);
  const lastLocalTriggerRef = useRef<number | null>(null);
  const lastGateReasonRef = useRef<string | null>(null);
  const logIdRef = useRef(0);

  // Long-lived timers read the latest values through this ref.
  const live = useRef(app);
  live.current = app;

  const simulated = detectorConfig.provider === 'simulated';
  const setupProblem = detectorReady(detectorConfig);
  const needsCamera = !simulated;
  const cameraAllowed = permission?.granted ?? false;

  useEffect(() => setSimulatedDroppings(simDirty), [simDirty]);
  useEffect(() => () => setSimulatedDroppings(false), []);

  const addLog = useCallback((text: string, tone: LogLine['tone'] = 'info') => {
    logIdRef.current += 1;
    const line = { id: logIdRef.current, at: Date.now(), text, tone };
    setLog((prev) => [line, ...prev].slice(0, MAX_LOG));
  }, []);

  /** Shared gate + trigger for AI, schedule and sensor sources. */
  const tryTrigger = useCallback(
    async (source: TriggerSource, detail: string): Promise<{ ok: boolean; reason?: string }> => {
      const s = live.current;
      const stage = s.deviceStatus.scraper.stage;
      const lastAuto = Math.max(s.automationState.lastAutoTriggerAt ?? 0, lastLocalTriggerRef.current ?? 0) || null;
      const gate = canAutoTrigger({
        settings: s.automationSettings,
        now: Date.now(),
        emergencyStopped: stage === 'emergency_stopped',
        cleaning: s.deviceStatus.scraper.running || !['idle', 'completed', 'failed', 'emergency_stopped'].includes(stage),
        binFull: s.ultrasonicReading.status === 'critical',
        lastAutoTriggerAt: lastAuto,
        linkReady: s.connectionStatus === 'online',
      });
      if (!gate.ok) return { ok: false, reason: gate.reason };
      const sent = await s.requestCleaning(source, detail);
      if (!sent) return { ok: false, reason: 'Command failed to send' };
      const at = Date.now();
      lastLocalTriggerRef.current = at;
      s.recordAutomationState({ lastAutoTriggerAt: at });
      return { ok: true };
    },
    []
  );

  // ---- Heartbeat when paused / leaving ----

  const publish = useCallback(
    (patch: Partial<VisionStatus>) => {
      const s = live.current;
      publishVision({
        online: true,
        lastSeen: Date.now(),
        lastFrameAt: s.visionStatus?.lastFrameAt ?? null,
        detections: 0,
        maxConfidence: 0,
        coveragePercent: 0,
        streak: streakRef.current,
        provider: s.detectorConfig.provider,
        error: null,
        ...patch,
      });
    },
    [publishVision]
  );

  useEffect(() => {
    if (!running) publish({ online: false });
  }, [running, publish]);

  useEffect(() => () => publish({ online: false, streak: 0 }), [publish]);

  // ---- AI loop ----

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      const s = live.current;
      const intervalMs = s.automationSettings.ai.captureIntervalSec * 1000;
      const problem = detectorReady(s.detectorConfig);

      if (!busyRef.current && !problem) {
        busyRef.current = true;
        try {
          let base64: string | null = null;
          if (s.detectorConfig.provider !== 'simulated') {
            if (!cameraRef.current) throw new Error('Camera is not ready yet.');
            const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.4, shutterSound: false });
            base64 = pic?.base64 ?? null;
          }
          const result = await detect(base64, s.detectorConfig);
          if (cancelled) return;

          const ai = s.automationSettings.ai;
          const evaluation = evaluateFrame(result.detections, ai, s.detectorConfig.targetClass);
          streakRef.current = evaluation.hit ? streakRef.current + 1 : 0;
          const rejected = result.detections.filter((d) => !evaluation.accepted.includes(d));
          setBoxes({ accepted: evaluation.accepted, rejected });
          setFrame({
            streak: streakRef.current,
            count: evaluation.accepted.length,
            maxConf: evaluation.maxConfidence,
            latency: result.latencyMs,
          });
          setError(null);
          publish({
            lastFrameAt: Date.now(),
            detections: evaluation.accepted.length,
            maxConfidence: evaluation.maxConfidence,
            coveragePercent: Math.round(evaluation.coveragePercent * 10) / 10,
            streak: streakRef.current,
          });

          if (ai.enabled && streakRef.current >= ai.consecutiveFrames) {
            const detail = `${evaluation.accepted.length} droppings, ${Math.round(evaluation.maxConfidence * 100)}%`;
            const outcome = await tryTrigger('ai', detail);
            if (outcome.ok) {
              addLog(`Droppings confirmed (${detail}). Cleaning started.`, 'good');
              streakRef.current = 0;
              lastGateReasonRef.current = null;
            } else if (outcome.reason !== lastGateReasonRef.current) {
              addLog(`Droppings seen, cycle held: ${outcome.reason}.`, 'warn');
              lastGateReasonRef.current = outcome.reason ?? null;
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Detection failed';
          setError(msg);
          publish({ error: msg });
        } finally {
          busyRef.current = false;
        }
      } else if (problem) {
        setError(problem);
        publish({ error: problem });
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    addLog(`Watching with the ${live.current.detectorConfig.provider === 'simulated' ? 'test detector' : 'Roboflow model'}.`);
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [running, publish, tryTrigger, addLog]);

  // ---- Schedule + sensor rules ----

  useEffect(() => {
    if (!running) return;
    const check = async () => {
      const s = live.current;
      if (s.automationSettings.mode !== 'automatic') return;

      const key = dueScheduleKey(s.automationSettings.schedule, new Date(), s.automationState.lastScheduleKey);
      if (key) {
        const outcome = await tryTrigger('schedule', key.slice(11));
        if (outcome.ok) {
          s.recordAutomationState({ lastScheduleKey: key });
          addLog(`Scheduled cleaning (${key.slice(11)}) started.`, 'good');
        } else if (outcome.reason?.startsWith('Cooling') || outcome.reason === 'Waste bin is full') {
          s.recordAutomationState({ lastScheduleKey: key });
          addLog(`Scheduled cleaning ${key.slice(11)} skipped: ${outcome.reason}.`, 'warn');
        }
      }

      const sensors = s.automationSettings.sensors;
      const ammonia = s.mq135Reading;
      if (sensors.ammoniaEnabled && ammonia.status !== 'unavailable' && ammonia.value >= sensors.ammoniaPpm) {
        const outcome = await tryTrigger('sensor', `${ammonia.value.toFixed(0)} ppm`);
        if (outcome.ok) addLog(`Ammonia at ${ammonia.value.toFixed(0)} ppm. Cleaning started.`, 'good');
      }
    };
    void check();
    const id = setInterval(() => void check(), RULE_TICK_MS);
    return () => clearInterval(id);
  }, [running, tryTrigger, addLog]);

  // ---- Render ----

  const ai = automationSettings.ai;
  const auto = automationSettings.mode === 'automatic';
  const eStopped = deviceStatus.scraper.stage === 'emergency_stopped';
  const nextRun = nextScheduledRun(automationSettings.schedule, new Date());
  const showCamera = cameraAllowed;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/automation'))} accessibilityLabel="Close station">
          <X size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Camera Station</Text>
          <Text style={styles.subtitle}>
            {simulated ? 'Test detector' : detectorConfig.modelId || 'Roboflow model'}, every {ai.captureIntervalSec} s
          </Text>
        </View>
        <TouchableOpacity style={[styles.runBtn, !running && styles.runBtnPaused]} onPress={() => setRunning((r) => !r)}>
          {running ? <Pause size={16} color="#FFFFFF" /> : <Play size={16} color="#FFFFFF" />}
          <Text style={styles.runText}>{running ? 'Pause' : 'Resume'}</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Viewfinder ---- */}
      <View style={styles.viewfinder}>
        {showCamera ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" animateShutter={false} onCameraReady={() => setCameraReady(true)} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <CameraIcon size={36} color="rgba(255, 255, 255, 0.35)" />
            <Text style={styles.placeholderText}>
              {needsCamera ? 'Camera access is needed to watch the cage.' : 'Simulated feed. Allow the camera to see the live view.'}
            </Text>
            {!cameraAllowed && (
              <TouchableOpacity style={styles.permBtn} onPress={() => void requestPermission()}>
                <Text style={styles.permText}>Allow camera</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Detection boxes */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {boxes.rejected.map((d, i) => (
            <View key={`r${i}`} style={[styles.box, styles.boxRejected, boxStyle(d)]} />
          ))}
          {boxes.accepted.map((d, i) => (
            <View key={`a${i}`} style={[styles.box, boxStyle(d)]}>
              <Text style={styles.boxLabel}>{Math.round(d.confidence * 100)}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.hud} pointerEvents="none">
          <View style={[styles.hudChip, frame && frame.count > 0 && styles.hudChipHot]}>
            <ScanEye size={13} color="#FFFFFF" />
            <Text style={styles.hudText}>
              {frame ? `${frame.count} seen · ${Math.round(frame.maxConf * 100)}%` : running ? 'Starting…' : 'Paused'}
            </Text>
          </View>
          <View style={styles.hudChip}>
            <Text style={styles.hudText}>
              Streak {frame?.streak ?? 0}/{ai.consecutiveFrames}
            </Text>
          </View>
        </View>
        {needsCamera && !cameraReady && cameraAllowed && <Text style={styles.warming}>Starting camera…</Text>}
      </View>

      {/* ---- Status panel ---- */}
      <ScrollView style={styles.panel} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }}>
        {(error || setupProblem) && (
          <View style={styles.alert}>
            <CircleAlert size={15} color="#EDB1AA" />
            <Text style={styles.alertText}>{setupProblem ?? error}</Text>
          </View>
        )}
        {!auto && (
          <View style={styles.alert}>
            <CircleAlert size={15} color={Colors.strawLight} />
            <Text style={[styles.alertText, { color: Colors.strawLight }]}>
              Manual mode: the station only watches. Switch to Automatic on the Automation tab to let it clean.
            </Text>
          </View>
        )}
        {eStopped && (
          <View style={styles.alert}>
            <CircleAlert size={15} color="#EDB1AA" />
            <Text style={styles.alertText}>Emergency stop is engaged. No cycles will start.</Text>
          </View>
        )}

        <Row icon={<ScanEye size={15} color={Colors.straw} />} label="AI trigger" value={ai.enabled ? `On · ${ai.minConfidencePercent}%+ · ${ai.minDetections}+ seen` : 'Off'} />
        <Row icon={<CalendarClock size={15} color={Colors.straw} />} label="Next scheduled" value={formatNextRun(nextRun)} />
        <Row
          icon={<Wind size={15} color={Colors.straw} />}
          label="Ammonia trigger"
          value={
            automationSettings.sensors.ammoniaEnabled
              ? `${mq135Reading.status === 'unavailable' ? '–' : mq135Reading.value.toFixed(0)} / ${automationSettings.sensors.ammoniaPpm} ppm`
              : 'Off'
          }
        />
        <Row label="Sweeper link" value={connectionStatus === 'online' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting' : 'Not connected'} />
        {frame && <Row label="Detector time" value={`${frame.latency} ms`} />}

        {simulated && (
          <View style={styles.simRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.simLabel}>Simulate droppings</Text>
              <Text style={styles.simDesc}>Makes the fake detector "see" a dirty floor to test your trigger rules.</Text>
            </View>
            <Switch value={simDirty} onValueChange={setSimDirty} trackColor={{ false: Colors.textSecondary, true: Colors.primaryLight }} thumbColor="#FFFFFF" />
          </View>
        )}

        <Text style={styles.logTitle}>Activity</Text>
        {log.length === 0 && <Text style={styles.logEmpty}>Nothing yet.</Text>}
        {log.map((l) => (
          <View key={l.id} style={styles.logRow}>
            <Text style={styles.logTime}>{new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={[styles.logText, l.tone === 'good' && { color: Colors.straw }, l.tone === 'warn' && { color: Colors.strawLight }]}>{l.text}</Text>
          </View>
        ))}
        <Text style={styles.footnote}>Keep this phone plugged in. The screen stays on while the station is open.</Text>
      </ScrollView>
    </View>
  );
}

function boxStyle(d: Detection) {
  return {
    left: `${d.x * 100}%` as const,
    top: `${d.y * 100}%` as const,
    width: `${d.width * 100}%` as const,
    height: `${d.height * 100}%` as const,
  };
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.row}>
      {icon ?? <View style={{ width: 15 }} />}
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ink },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: FontSize.lg, fontFamily: Fonts.bold },
  subtitle: { color: 'rgba(255, 255, 255, 0.6)', fontSize: FontSize.xs, marginTop: 1 },
  runBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  runBtnPaused: { backgroundColor: Colors.textSecondary },
  runText: { color: '#FFFFFF', fontSize: FontSize.sm, fontFamily: Fonts.bold },
  viewfinder: { aspectRatio: 4 / 3, width: '100%', backgroundColor: Colors.text, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  placeholderText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: FontSize.sm, textAlign: 'center' },
  permBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  permText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: FontSize.sm },
  box: { position: 'absolute', borderWidth: 2, borderColor: Colors.straw, borderRadius: 6, backgroundColor: 'rgba(229, 179, 35, 0.12)' },
  boxRejected: { borderColor: 'rgba(255, 255, 255, 0.35)', borderStyle: 'dashed', backgroundColor: 'transparent' },
  boxLabel: { position: 'absolute', top: -18, left: -2, backgroundColor: Colors.primary, color: '#FFFFFF', fontSize: 10, fontFamily: Fonts.bold, paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  hud: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: Spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  hudChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(31, 42, 36, 0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  hudChipHot: { backgroundColor: 'rgba(47, 90, 69, 0.85)' },
  hudText: { color: '#FFFFFF', fontSize: FontSize.xs, fontFamily: Fonts.bold },
  warming: { position: 'absolute', top: Spacing.md, alignSelf: 'center', color: 'rgba(255, 255, 255, 0.7)', fontSize: FontSize.xs },
  panel: { flex: 1 },
  alert: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.sm },
  alertText: { flex: 1, color: '#EDB1AA', fontSize: FontSize.xs, lineHeight: 17, fontFamily: Fonts.bold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.06)' },
  rowLabel: { color: 'rgba(255, 255, 255, 0.6)', fontSize: FontSize.sm, flex: 1 },
  rowValue: { color: '#FFFFFF', fontSize: FontSize.sm, fontFamily: Fonts.bold, textAlign: 'right', flexShrink: 1 },
  simRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md, backgroundColor: 'rgba(47, 90, 69, 0.1)', borderRadius: 12, padding: Spacing.md },
  simLabel: { color: '#FFFFFF', fontSize: FontSize.sm, fontFamily: Fonts.bold },
  simDesc: { color: 'rgba(255, 255, 255, 0.6)', fontSize: FontSize.xs, marginTop: 2 },
  logTitle: { color: 'rgba(255, 255, 255, 0.5)', fontSize: FontSize.xs, fontFamily: Fonts.bold, letterSpacing: 1, textTransform: 'uppercase', marginTop: Spacing.xl, marginBottom: Spacing.sm },
  logEmpty: { color: 'rgba(255, 255, 255, 0.4)', fontSize: FontSize.xs },
  logRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 4 },
  logTime: { color: 'rgba(255, 255, 255, 0.4)', fontSize: FontSize.xs, fontVariant: ['tabular-nums'], width: 56 },
  logText: { flex: 1, color: 'rgba(255, 255, 255, 0.85)', fontSize: FontSize.xs, lineHeight: 16 },
  footnote: { color: 'rgba(255, 255, 255, 0.35)', fontSize: FontSize.xs, marginTop: Spacing.xl, textAlign: 'center' },
});
