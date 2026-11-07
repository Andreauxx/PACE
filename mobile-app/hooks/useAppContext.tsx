// ============================================================
// AgriSweep — App Context
// Central state management for device status, sensor readings,
// and settings across all screens.
//
// Live mode  → firebaseService (ESP32 via Firebase RTDB)
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService, normalizeDatabaseUrl } from '../services/firebaseService';
import { APP_CONFIG } from '../constants/config';
import {
  appendDataPoint,
  classifyAmmonia,
  classifyDistance,
  computeTrend,
  distanceFromBinCapacity,
  binCapacityFromDistance,
  BIN_MAX_DEPTH_CM,
} from '../utils/sensors';
import { computeAnalytics, computeCleaningStats } from '../utils/cleaningStats';
import { defaultAutomationSettings, normalizeAutomation } from '../utils/automation';
import { defaultDetectorConfig } from '../services/detector';
import { DEFAULT_TRAVEL_CM_PER_SEC, msForDistance } from '../utils/travel';
import {
  DeviceStatus,
  ConnectionStatus,
  CleaningCycleStage,
  MQ135Reading,
  UltrasonicReading,
  ScraperDirection,
  SensorDataPoint,
  CleaningCycle,
  CleaningStats,
  CleaningStatus,
  EventLogEntry,
  EventSeverity,
  EventType,
  AnalyticsSummary,
  CleaningSettings,
  SensorThresholds,
  FirebaseCommandPatch,
  FirebaseConfig,
  JogCommand,
  FirebaseConnectionState,
  FirebasePingResult,
  FirebaseSystemSnapshot,
  AutomationSettings,
  AutomationState,
  DetectorConfig,
  TriggerRecord,
  TriggerSource,
  VisionStatus,
} from '../types';

export interface SettingsSaveResult {
  /** True when the change was also written to `/system/config` on the device. */
  syncedToDevice: boolean;
  error: string | null;
}

interface AppState {
  // Mode

  // Firebase (live hardware)
  firebaseConfig: FirebaseConfig;
  setFirebaseConfig: (config: FirebaseConfig) => Promise<void>;
  testFirebaseConnection: (config?: FirebaseConfig) => Promise<FirebasePingResult>;
  connectionError: string | null;
  commandError: string | null;

  // Device
  deviceStatus: DeviceStatus;
  connectionStatus: ConnectionStatus;

  // Sensors
  mq135Reading: MQ135Reading;
  ultrasonicReading: UltrasonicReading;
  mq135History: SensorDataPoint[];
  ultrasonicHistory: SensorDataPoint[];

  // Cleaning
  cleaningHistory: CleaningCycle[];
  cleaningStats: CleaningStats;
  eventLog: EventLogEntry[];
  analyticsSummary: AnalyticsSummary;

  // Settings
  sensorThresholds: SensorThresholds;
  setSensorThresholds: (t: SensorThresholds) => Promise<SettingsSaveResult>;
  cleaningSettings: CleaningSettings;
  setCleaningSettings: (s: CleaningSettings) => Promise<SettingsSaveResult>;

  // Automation (schedule, AI camera, sensor triggers)
  automationSettings: AutomationSettings;
  setAutomationSettings: (a: AutomationSettings) => Promise<SettingsSaveResult>;
  automationState: AutomationState;
  recordAutomationState: (patch: Partial<AutomationState>) => void;
  detectorConfig: DetectorConfig;
  setDetectorConfig: (c: DetectorConfig) => Promise<void>;
  visionStatus: VisionStatus | null;
  publishVision: (v: VisionStatus) => void;
  lastTrigger: TriggerRecord | null;

  // Actions
  /** Starts a cycle and records who asked for it. Resolves false if the command failed. */
  requestCleaning: (source: TriggerSource, detail?: string | null) => Promise<boolean>;
  startCleaning: () => void;
  stopCleaning: () => void;
  scraperForward: () => void;
  scraperReverse: () => void;
  /** Timed move used by calibration and by distance jogs. */
  jog: (direction: 'forward' | 'reverse', distanceCm?: number, durationMs?: number) => void;
  scraperStop: () => void;
  pumpOn: () => void;
  pumpOff: () => void;
  emergencyStop: () => void;
  resetEmergencyStop: () => void;
  refreshData: () => void;
}

const defaultSensorThresholds: SensorThresholds = {
  mq135: {
    warningThreshold: APP_CONFIG.defaultMQ135WarningThreshold,
    criticalThreshold: APP_CONFIG.defaultMQ135CriticalThreshold,
    displayMode: 'calibrated',
    refreshIntervalMs: APP_CONFIG.defaultMQ135RefreshInterval,
  },
  ultrasonic: {
    mountPosition: 'above',
    referenceDistanceCm: APP_CONFIG.defaultUltrasonicReferenceDistance,
    warningDistanceCm: APP_CONFIG.defaultUltrasonicWarningDistance,
    criticalDistanceCm: APP_CONFIG.defaultUltrasonicCriticalDistance,
    refreshIntervalMs: APP_CONFIG.defaultUltrasonicRefreshInterval,
    timeoutMs: APP_CONFIG.defaultUltrasonicTimeout,
  },
};

const defaultCleaningSettings: CleaningSettings = {
  scraperSpeedPercent: APP_CONFIG.defaultScraperSpeedPercent,
  strokeDistanceCm: 60,
  jogDistanceCm: 10,
  travelCmPerSec: DEFAULT_TRAVEL_CM_PER_SEC,
  maxScraperRuntimeMs: APP_CONFIG.defaultMaxScraperRuntime,
  pumpDurationMs: APP_CONFIG.defaultPumpDuration,
  rinseAfterSweep: true,
  requireConfirmation: true,
};

/** Keeps only known fields so settings saved by older builds load cleanly. */
function normalizeCleaningSettings(raw: Partial<CleaningSettings>): CleaningSettings {
  const d = defaultCleaningSettings;
  const n = (v: unknown, f: number) => (typeof v === 'number' && Number.isFinite(v) ? v : f);
  const b = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
  return {
    scraperSpeedPercent: Math.min(
      100,
      Math.max(APP_CONFIG.minScraperSpeedPercent, n(raw.scraperSpeedPercent, d.scraperSpeedPercent))
    ),
    strokeDistanceCm: n(raw.strokeDistanceCm, d.strokeDistanceCm),
    jogDistanceCm: n(raw.jogDistanceCm, d.jogDistanceCm),
    travelCmPerSec: n(raw.travelCmPerSec, d.travelCmPerSec),
    maxScraperRuntimeMs: n(raw.maxScraperRuntimeMs, d.maxScraperRuntimeMs),
    pumpDurationMs: n(raw.pumpDurationMs, d.pumpDurationMs),
    rinseAfterSweep: b(raw.rinseAfterSweep, d.rinseAfterSweep),
    requireConfirmation: b(raw.requireConfirmation, d.requireConfirmation),
  };
}

const emptyAutomationState: AutomationState = { lastAutoTriggerAt: null, lastScheduleKey: null };

const TRIGGER_LABEL: Record<TriggerSource, string> = {
  manual: 'Start cleaning cycle',
  schedule: 'Scheduled cleaning cycle',
  ai: 'AI-detected droppings: cleaning cycle',
  sensor: 'Sensor-triggered cleaning cycle',
};

const defaultFirebaseConfig: FirebaseConfig = {
  databaseUrl: 'https://pace-6c54c-default-rtdb.asia-southeast1.firebasedatabase.app',
  authToken: '',
};

const CLEANING_STAGES: readonly CleaningCycleStage[] = [
  'idle',
  'starting',
  'scraper_forward',
  'scraper_pause',
  'scraper_reverse',
  'pump_active',
  'completing',
  'completed',
  'failed',
  'emergency_stopped',
];

// All actuator requests cleared — used by stop and emergency stop.
const ALL_ACTUATORS_OFF: FirebaseCommandPatch = {
  manualCleanTrigger: false,
  'controls/jog': null,
  'controls/manualPumpTrigger': false,
};

function isCleaningStage(value: string | null | undefined): value is CleaningCycleStage {
  return CLEANING_STAGES.some((stage) => stage === value);
}

function connectionFromFirebase(state: FirebaseConnectionState): ConnectionStatus {
  switch (state) {
    case 'online':
      return 'online';
    case 'offline':
      return 'offline';
    case 'error':
      return 'error';
    default:
      return 'connecting';
  }
}

function isSnapshotCleaning(snap: FirebaseSystemSnapshot | null): boolean {
  return snap?.status?.toLowerCase() === 'cleaning';
}

/** Earlier builds stored MQ-135 thresholds as raw ADC (0–4095); the app now uses PPM. */
function migrateThresholds(t: SensorThresholds): SensorThresholds {
  if (t.mq135.warningThreshold > APP_CONFIG.mq135GaugeMaxPpm || t.mq135.criticalThreshold > APP_CONFIG.mq135GaugeMaxPpm) {
    return { ...t, mq135: { ...defaultSensorThresholds.mq135 } };
  }
  return t;
}

function databaseHost(url: string): string {
  const match = normalizeDatabaseUrl(url).match(/^https?:\/\/([^/.]+)/i);
  return match ? match[1] : 'Not configured';
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

interface LiveCommandMeta {
  lastCommand: string | null;
  lastCommandTime: number | null;
}

interface LiveCycle {
  startTime: number;
  pumpActivated: boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [firebaseConfig, setFirebaseConfigState] = useState<FirebaseConfig>(defaultFirebaseConfig);
  const [sensorThresholds, setSensorThresholds] = useState<SensorThresholds>(defaultSensorThresholds);
  const [cleaningSettings, setCleaningSettings] = useState<CleaningSettings>(defaultCleaningSettings);
  const [automationSettings, setAutomationSettingsState] = useState<AutomationSettings>(defaultAutomationSettings);
  const [detectorConfig, setDetectorConfigState] = useState<DetectorConfig>(defaultDetectorConfig);

  // Shared sensor history (reset when switching modes)
  const [mq135History, setMQ135History] = useState<SensorDataPoint[]>([]);
  const [ultrasonicHistory, setUltrasonicHistory] = useState<SensorDataPoint[]>([]);

  const [localVision, setLocalVision] = useState<VisionStatus | null>(null);

  // Live-mode state
  const [firebaseState, setFirebaseState] = useState<FirebaseConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<FirebaseSystemSnapshot | null>(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<number | null>(null);
  const [liveCommand, setLiveCommand] = useState<LiveCommandMeta>({ lastCommand: null, lastCommandTime: null });
  const [livePumpActivatedAt, setLivePumpActivatedAt] = useState<number | null>(null);
  const [liveCleaningHistory, setLiveCleaningHistory] = useState<CleaningCycle[]>([]);
  const [liveEventLog, setLiveEventLog] = useState<EventLogEntry[]>([]);

  // Refs read from long-lived Firebase listeners
  const thresholdsRef = useRef(sensorThresholds);
  const prevSnapshotRef = useRef<FirebaseSystemSnapshot | null>(null);
  const liveCycleRef = useRef<LiveCycle | null>(null);
  const automationRef = useRef(automationSettings);
  const cleaningSettingsRef = useRef(cleaningSettings);
  cleaningSettingsRef.current = cleaningSettings;
  // Ignore our own writes echoing back on the stream for a moment.
  const lastAutomationWriteRef = useRef(0);
  thresholdsRef.current = sensorThresholds;
  automationRef.current = automationSettings;

  // ---- Persistence ----

  useEffect(() => {
    (async () => {
      try {
        const [threshStr, cleanStr, fbStr, liveHistStr, autoStr, detectorStr] = await Promise.all([
          AsyncStorage.getItem(APP_CONFIG.storageKeys.sensorThresholds),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.cleaningSettings),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.firebaseConfig),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.liveCleaningHistory),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.automation),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.detectorConfig),
        ]);
        if (threshStr) {
          const stored = JSON.parse(threshStr) as SensorThresholds;
          const migrated = migrateThresholds(stored);
          setSensorThresholds(migrated);
          if (migrated !== stored) {
            await AsyncStorage.setItem(APP_CONFIG.storageKeys.sensorThresholds, JSON.stringify(migrated));
          }
        }
        if (cleanStr) setCleaningSettings(normalizeCleaningSettings(JSON.parse(cleanStr) as Partial<CleaningSettings>));
        if (autoStr) setAutomationSettingsState(normalizeAutomation(JSON.parse(autoStr)));
        if (detectorStr) setDetectorConfigState({ ...defaultDetectorConfig, ...(JSON.parse(detectorStr) as DetectorConfig) });
        if (fbStr) {
          const parsed = JSON.parse(fbStr) as Partial<FirebaseConfig>;
          setFirebaseConfigState({
            databaseUrl: normalizeDatabaseUrl(parsed.databaseUrl || '') || defaultFirebaseConfig.databaseUrl,
            authToken: parsed.authToken ?? defaultFirebaseConfig.authToken,
          });
        }
        if (liveHistStr) setLiveCleaningHistory(JSON.parse(liveHistStr) as CleaningCycle[]);
      } catch (e) {
        console.warn('Failed to load settings:', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setFirebaseConfig = useCallback(async (config: FirebaseConfig) => {
    const next: FirebaseConfig = {
      databaseUrl: normalizeDatabaseUrl(config.databaseUrl),
      authToken: config.authToken.trim(),
    };
    setFirebaseConfigState(next);
    try {
      await AsyncStorage.setItem(APP_CONFIG.storageKeys.firebaseConfig, JSON.stringify(next));
    } catch {}
  }, []);

  const testFirebaseConnection = useCallback(
    (config?: FirebaseConfig) => firebaseService.ping(config ?? firebaseConfig),
    [firebaseConfig]
  );

  const updateThresholds = useCallback(async (t: SensorThresholds): Promise<SettingsSaveResult> => {
    setSensorThresholds(t);
    try {
      await AsyncStorage.setItem(APP_CONFIG.storageKeys.sensorThresholds, JSON.stringify(t));
    } catch {}
    if (!firebaseService.isConfigured()) return { syncedToDevice: false, error: null };
    try {
      await firebaseService.writeConfig({
        ammoniaWarningThreshold: t.mq135.warningThreshold,
        binWarningDistanceCm: t.ultrasonic.warningDistanceCm,
      });
      return { syncedToDevice: true, error: null };
    } catch (e) {
      return { syncedToDevice: false, error: errorMessage(e) };
    }
  }, []);

  const updateCleaningSettings = useCallback(async (s: CleaningSettings): Promise<SettingsSaveResult> => {
    setCleaningSettings(s);
    try {
      await AsyncStorage.setItem(APP_CONFIG.storageKeys.cleaningSettings, JSON.stringify(s));
    } catch {}
    if (!firebaseService.isConfigured()) return { syncedToDevice: false, error: null };
    try {
      await firebaseService.writeConfig({
        scraperSpeedPercent: s.scraperSpeedPercent,
        strokeDistanceCm: s.strokeDistanceCm,
        strokeTimeMs: msForDistance(s.strokeDistanceCm, s.scraperSpeedPercent, s.travelCmPerSec),
        jogDistanceCm: s.jogDistanceCm,
        travelCmPerSec: s.travelCmPerSec,
        maxScraperRuntimeMs: s.maxScraperRuntimeMs,
        pumpDurationMs: s.pumpDurationMs,
        rinseAfterSweep: s.rinseAfterSweep,
      });
      return { syncedToDevice: true, error: null };
    } catch (e) {
      return { syncedToDevice: false, error: errorMessage(e) };
    }
  }, []);

  const updateAutomationSettings = useCallback(async (a: AutomationSettings): Promise<SettingsSaveResult> => {
    const next = normalizeAutomation(a);
    automationRef.current = next;
    lastAutomationWriteRef.current = Date.now();
    setAutomationSettingsState(next);
    try {
      await AsyncStorage.setItem(APP_CONFIG.storageKeys.automation, JSON.stringify(next));
    } catch {}
    if (!firebaseService.isConfigured()) return { syncedToDevice: false, error: null };
    try {
      await firebaseService.writeAutomation(next);
      return { syncedToDevice: true, error: null };
    } catch (e) {
      return { syncedToDevice: false, error: errorMessage(e) };
    }
  }, []);

  const setDetectorConfig = useCallback(async (c: DetectorConfig) => {
    const next: DetectorConfig = {
      ...c,
      endpoint: c.endpoint.trim(),
      modelId: c.modelId.trim(),
      apiKey: c.apiKey.trim(),
      targetClass: c.targetClass.trim(),
    };
    setDetectorConfigState(next);
    try {
      await AsyncStorage.setItem(APP_CONFIG.storageKeys.detectorConfig, JSON.stringify(next));
    } catch {}
  }, []);

  // ---- Live (Firebase) mode ----

  const logLiveEvent = useCallback(
    (type: EventType, severity: EventSeverity, message: string, source: EventLogEntry['source'] = 'device') => {
      const now = Date.now();
      const entry: EventLogEntry = {
        id: `live-${now}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        severity,
        message,
        timestamp: now,
        source,
      };
      setLiveEventLog((prev) => [entry, ...prev].slice(0, APP_CONFIG.maxEventLogEntries));
    },
    []
  );

  const recordLiveCycle = useCallback((cycle: CleaningCycle) => {
    setLiveCleaningHistory((prev) => {
      const next = [cycle, ...prev].slice(0, APP_CONFIG.maxHistoryEntries);
      AsyncStorage.setItem(APP_CONFIG.storageKeys.liveCleaningHistory, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleLiveData = useCallback(
    (snap: FirebaseSystemSnapshot) => {
      const now = Date.now();
      const prev = prevSnapshotRef.current;
      const thresholds = thresholdsRef.current;
      prevSnapshotRef.current = snap;
      setLiveSnapshot(snap);
      setLastLiveUpdate(now);

      // Another phone changed the automation rules: adopt them here too.
      // If the database has none yet, publish this phone's rules.
      if (!snap.automation && !prev) {
        firebaseService.writeAutomation(automationRef.current).catch(() => {});
      } else if (snap.automation && now - lastAutomationWriteRef.current > 3000) {
        const remote = normalizeAutomation(snap.automation);
        if (JSON.stringify(remote) !== JSON.stringify(automationRef.current)) {
          automationRef.current = remote;
          setAutomationSettingsState(remote);
          AsyncStorage.setItem(APP_CONFIG.storageKeys.automation, JSON.stringify(remote)).catch(() => {});
        }
      }

      // Sensor history — append when the reading changed or on the firmware's 5s cadence
      const appendIfNew = (history: SensorDataPoint[], value: number) => {
        const last = history[history.length - 1];
        if (last && last.value === value && now - last.timestamp < APP_CONFIG.defaultMQ135RefreshInterval) {
          return history;
        }
        return appendDataPoint(history, { value, timestamp: now }, APP_CONFIG.maxSensorDataPoints);
      };
      if (snap.ammoniaLevel !== null) {
        const ppm = snap.ammoniaLevel;
        setMQ135History((h) => appendIfNew(h, ppm));
      }
      const distance = snap.distanceCm ?? (snap.binCapacity !== null ? distanceFromBinCapacity(snap.binCapacity) : null);
      if (distance !== null) {
        setUltrasonicHistory((h) => appendIfNew(h, Math.round(distance * 10) / 10));
      }

      if (!prev) return; // First snapshot only establishes the baseline for transition events

      // Ammonia threshold crossings
      if (snap.ammoniaLevel !== null && prev.ammoniaLevel !== null) {
        const before = classifyAmmonia(prev.ammoniaLevel, thresholds);
        const after = classifyAmmonia(snap.ammoniaLevel, thresholds);
        if (before !== after && after !== 'normal') {
          logLiveEvent(
            'sensor_warning',
            after === 'critical' ? 'error' : 'warning',
            `Ammonia ${after === 'critical' ? 'DANGER' : 'warning'}: ${snap.ammoniaLevel.toFixed(1)} PPM`
          );
        }
      }

      // Cleaning cycle start / finish, as reported by `/system/status`
      const wasCleaning = isSnapshotCleaning(prev);
      const nowCleaning = isSnapshotCleaning(snap);
      if (!wasCleaning && nowCleaning) {
        liveCycleRef.current = { startTime: now, pumpActivated: false };
        logLiveEvent('cleaning_started', 'info', 'Cleaning cycle started on device');
      }
      if (liveCycleRef.current && snap.pump.active) liveCycleRef.current.pumpActivated = true;
      if (wasCleaning && !nowCleaning && liveCycleRef.current) {
        const cycle = liveCycleRef.current;
        liveCycleRef.current = null;
        const fault = snap.scraper.fault ?? snap.pump.fault;
        const status: CleaningStatus = snap.controls.emergencyStop ? 'interrupted' : fault ? 'failed' : 'completed';
        const errorReason = snap.controls.emergencyStop ? 'Emergency stop activated' : fault;
        recordLiveCycle({
          id: `live-cycle-${cycle.startTime}`,
          startTime: cycle.startTime,
          endTime: now,
          duration: now - cycle.startTime,
          mode:
            snap.lastTrigger && snap.lastTrigger.at >= cycle.startTime - 60_000
              ? snap.lastTrigger.source === 'manual'
                ? 'manual'
                : 'automatic'
              : 'manual',
          scraperActivated: true,
          pumpActivated: cycle.pumpActivated,
          status,
          errorReason,
          stages: [],
        });
        logLiveEvent(
          status === 'completed' ? 'cleaning_completed' : 'cleaning_failed',
          status === 'completed' ? 'info' : 'error',
          status === 'completed' ? 'Cleaning cycle completed' : `Cleaning cycle ${status}: ${errorReason ?? 'unknown'}`
        );
      }

      // Actuator transitions
      if (snap.pump.active === true && prev.pump.active !== true) {
        setLivePumpActivatedAt(now);
        logLiveEvent('pump_activated', 'info', 'Water pump activated');
      } else if (snap.pump.active === false && prev.pump.active === true) {
        logLiveEvent('pump_deactivated', 'info', 'Water pump deactivated');
      }
      const newFault = (snap.scraper.fault !== prev.scraper.fault && snap.scraper.fault) || (snap.pump.fault !== prev.pump.fault && snap.pump.fault);
      if (newFault) logLiveEvent('actuator_fault', 'error', `Actuator fault: ${newFault}`);
      if (snap.controls.emergencyStop && !prev.controls.emergencyStop) {
        logLiveEvent('emergency_stop', 'critical', 'EMERGENCY STOP engaged');
      }
    },
    [logLiveEvent, recordLiveCycle]
  );

  useEffect(() => {
    if (!hydrated) return;

    setMQ135History([]);
    setUltrasonicHistory([]);
    setLiveSnapshot(null);
    setLastLiveUpdate(null);
    setCommandError(null);
    prevSnapshotRef.current = null;
    liveCycleRef.current = null;

    let previousState: FirebaseConnectionState | null = null;
    firebaseService.configure(firebaseConfig);
    const offState = firebaseService.onStateChange((state, error) => {
      setFirebaseState(state);
      setConnectionError(error);
      if (state === 'online' && previousState !== 'online') {
        logLiveEvent('device_connected', 'info', 'Connected to Firebase Realtime Database', 'app');
      } else if (previousState === 'online' && (state === 'offline' || state === 'error')) {
        logLiveEvent('device_disconnected', 'warning', `Connection lost: ${error ?? 'unknown reason'}`, 'app');
      }
      previousState = state;
    });
    const offData = firebaseService.onData(handleLiveData);
    firebaseService.start();

    return () => {
      offData();
      offState();
      firebaseService.stop();
    };
  }, [hydrated, firebaseConfig, handleLiveData, logLiveEvent]);

  const sendLive = useCallback(
    async (command: string, patch: FirebaseCommandPatch, description: string): Promise<boolean> => {
      setLiveCommand({ lastCommand: command, lastCommandTime: Date.now() });
      try {
        await firebaseService.sendCommand(patch);
        setCommandError(null);
        logLiveEvent(
          command === 'emergency_stop' ? 'emergency_stop' : 'system_info',
          command === 'emergency_stop' ? 'critical' : 'info',
          `Command sent: ${description}`,
          'app'
        );
        return true;
      } catch (e) {
        const msg = errorMessage(e);
        setCommandError(`${description} failed: ${msg}`);
        logLiveEvent('actuator_fault', 'error', `Command "${description}" failed: ${msg}`, 'app');
        return false;
      }
    },
    [logLiveEvent]
  );

  // ---- Automation bookkeeping ----

  const recordAutomationState = useCallback((patch: Partial<AutomationState>) => {
    firebaseService.writeAutomationState(patch).catch((e: unknown) => setCommandError(errorMessage(e)));
  }, []);

  const publishVision = useCallback((v: VisionStatus) => {
    setLocalVision(v); // instant feedback on the station itself
    // A failed heartbeat shows up elsewhere as the station going stale.
    firebaseService.writeVision(v).catch(() => {});
  }, []);

  // ---- Unified actions ----

  const requestCleaning = useCallback(
    async (source: TriggerSource, detail: string | null = null): Promise<boolean> => {
      const trigger: TriggerRecord = { source, at: Date.now(), detail };
      const label = detail ? `${TRIGGER_LABEL[source]} (${detail})` : TRIGGER_LABEL[source];
      return sendLive('start_cleaning', { manualCleanTrigger: true, lastTrigger: trigger }, label);
    },
    [sendLive]
  );

  const startCleaning = useCallback(() => {
    void requestCleaning('manual');
  }, [requestCleaning]);

  const stopCleaning = useCallback(() => {
    void sendLive('stop_cleaning', ALL_ACTUATORS_OFF, 'Stop cleaning cycle');
  }, [sendLive]);

  /** Moves the scraper a set distance (default: the jog distance), or for an exact time when given. */
  const jog = useCallback(
    (direction: 'forward' | 'reverse', distanceCm?: number, durationMs?: number) => {
      const cs = cleaningSettingsRef.current;
      const cm = distanceCm ?? cs.jogDistanceCm;
      const ms = durationMs ?? msForDistance(cm, cs.scraperSpeedPercent, cs.travelCmPerSec);
      const move: JogCommand = { direction, distanceCm: cm, durationMs: Math.min(ms, cs.maxScraperRuntimeMs), at: Date.now() };
      const where = direction === 'forward' ? 'toward the bin' : 'back home';
      void sendLive(
        direction === 'forward' ? 'scraper_forward' : 'scraper_reverse',
        { 'controls/jog': move },
        durationMs ? `Test run ${where} for ${Math.round(ms / 1000)} s` : `Move ${cm} cm ${where}`
      );
    },
    [sendLive]
  );

  const scraperForward = useCallback(() => jog('forward'), [jog]);
  const scraperReverse = useCallback(() => jog('reverse'), [jog]);

  const scraperStop = useCallback(() => {
    void sendLive('scraper_stop', { 'controls/jog': null }, 'Scraper stop');
  }, [sendLive]);

  const pumpOn = useCallback(() => {
    void sendLive('pump_on', { 'controls/manualPumpTrigger': true }, 'Pump on');
  }, [sendLive]);

  const pumpOff = useCallback(() => {
    void sendLive('pump_off', { 'controls/manualPumpTrigger': false }, 'Pump off');
  }, [sendLive]);

  const emergencyStop = useCallback(() => {
    void sendLive('emergency_stop', { ...ALL_ACTUATORS_OFF, 'controls/emergencyStop': true }, 'Emergency stop');
  }, [sendLive]);

  const resetEmergencyStop = useCallback(() => {
    void sendLive('reset_emergency_stop', { 'controls/emergencyStop': false }, 'Release emergency stop');
  }, [sendLive]);

  const refreshData = useCallback(() => {
    firebaseService.refresh().catch((e: unknown) => setConnectionError(errorMessage(e)));
  }, []);

  // ---- Derived state ----

  const connectionStatus: ConnectionStatus = connectionFromFirebase(firebaseState);

  const deviceStatus = useMemo<DeviceStatus>(() => {

    const snap = liveSnapshot;
    const cleaning = isSnapshotCleaning(snap);
    const reportedStage = snap?.scraper.stage;
    const reportedDirection = snap?.scraper.direction;
    const direction: ScraperDirection =
      reportedDirection === 'forward' || reportedDirection === 'reverse' ? reportedDirection : 'stopped';
    const stage: CleaningCycleStage = snap?.controls.emergencyStop
      ? 'emergency_stopped'
      : isCleaningStage(reportedStage)
      ? reportedStage
      : cleaning
      ? 'starting'
      : 'idle';
    const lastLiveCycle = liveCleaningHistory.find((c) => c.status === 'completed');

    return {
      connectionStatus,
      operatingMode: automationSettings.mode,
      lastCommunicationTime: lastLiveUpdate,
      lastCleaningCycleTime: snap?.lastCleaningCycleTime ?? lastLiveCycle?.endTime ?? null,
      scraper: {
        // Current firmware only reports `/system/status`; fall back to it when `/system/scraper` is absent.
        running: snap?.scraper.running ?? cleaning,
        direction,
        stage,
        lastCommand: liveCommand.lastCommand,
        lastCommandTime: liveCommand.lastCommandTime,
        fault: snap?.scraper.fault ?? null,
        runtimeMs: 0,
        maxRuntimeMs: snap?.config.maxScraperRuntimeMs ?? cleaningSettings.maxScraperRuntimeMs,
      },
      pump: {
        active: snap?.pump.active ?? false,
        lastActivationTime: livePumpActivatedAt,
        configuredRuntimeMs: snap?.config.pumpDurationMs ?? cleaningSettings.pumpDurationMs,
        runtimeMs: snap?.pump.runtimeMs ?? 0,
        fault: snap?.pump.fault ?? null,
      },
      deviceInfo: {
        name: 'AgriSweep ESP32',
        deviceId: databaseHost(firebaseConfig.databaseUrl),
        firmwareVersion: null,
        ipAddress: null,
        macAddress: null,
      },
      uptime: null,
    };
  }, [
    connectionStatus,
    liveSnapshot,
    lastLiveUpdate,
    liveCommand,
    livePumpActivatedAt,
    liveCleaningHistory,
    cleaningSettings.maxScraperRuntimeMs,
    cleaningSettings.pumpDurationMs,
    firebaseConfig.databaseUrl,
    automationSettings.mode,
  ]);

  const mq135Reading = useMemo<MQ135Reading>(() => {
    const trend = computeTrend(mq135History, 1);
    const ppm = liveSnapshot?.ammoniaLevel ?? null;
    return {
      value: ppm ?? 0,
      rawAdc: liveSnapshot?.ammoniaRaw ?? (ppm !== null ? Math.round((ppm / APP_CONFIG.mq135GaugeMaxPpm) * 4095) : 0),
      calibratedValue: ppm,
      displayMode: 'calibrated',
      timestamp: lastLiveUpdate ?? Date.now(),
      unit: 'ppm',
      status: ppm === null ? 'unavailable' : classifyAmmonia(ppm, sensorThresholds),
      trend: ppm === null ? 'unknown' : trend,
    };
  }, [liveSnapshot, lastLiveUpdate, mq135History, sensorThresholds]);

  const ultrasonicReading = useMemo<UltrasonicReading>(() => {
    // Rising distance = falling waste level, so the trend is inverted for display.
    const distanceTrend = computeTrend(ultrasonicHistory, 0.5);
    const trend = distanceTrend === 'rising' ? 'falling' : distanceTrend === 'falling' ? 'rising' : distanceTrend;
    const snap = liveSnapshot;
    const distance =
      snap?.distanceCm ?? (snap?.binCapacity !== null && snap?.binCapacity !== undefined ? distanceFromBinCapacity(snap.binCapacity) : null);
    const capacity = snap?.binCapacity ?? (distance !== null ? binCapacityFromDistance(distance) : null);
    return {
      value: distance ?? 0,
      distanceCm: distance !== null ? Math.round(distance * 10) / 10 : 0,
      accumulationPercent: capacity !== null ? Math.round(capacity) : null,
      mountPosition: 'above',
      referenceDistanceCm: BIN_MAX_DEPTH_CM,
      timestamp: lastLiveUpdate ?? Date.now(),
      unit: 'cm',
      status: distance === null ? 'unavailable' : classifyDistance(distance, sensorThresholds),
      trend: distance === null ? 'unknown' : trend,
    };
  }, [liveSnapshot, lastLiveUpdate, ultrasonicHistory, sensorThresholds]);

  const liveStats = useMemo(() => computeCleaningStats(liveCleaningHistory), [liveCleaningHistory]);
  const liveAnalytics = useMemo(
    () => computeAnalytics(liveCleaningHistory, liveEventLog),
    [liveCleaningHistory, liveEventLog]
  );

  return (
    <AppContext.Provider
      value={{
        firebaseConfig,
        setFirebaseConfig,
        testFirebaseConnection,
        connectionError,
        commandError,
        deviceStatus,
        connectionStatus,
        mq135Reading,
        ultrasonicReading,
        mq135History,
        ultrasonicHistory,
        cleaningHistory: liveCleaningHistory,
        cleaningStats: liveStats,
        eventLog: liveEventLog,
        analyticsSummary: liveAnalytics,
        sensorThresholds,
        setSensorThresholds: updateThresholds,
        cleaningSettings,
        setCleaningSettings: updateCleaningSettings,
        automationSettings,
        setAutomationSettings: updateAutomationSettings,
        automationState: liveSnapshot?.automationState ?? emptyAutomationState,
        recordAutomationState,
        detectorConfig,
        setDetectorConfig,
        visionStatus: liveSnapshot?.vision ?? localVision,
        publishVision,
        lastTrigger: liveSnapshot?.lastTrigger ?? null,
        requestCleaning,
        startCleaning,
        stopCleaning,
        scraperForward,
        scraperReverse,
        jog,
        scraperStop,
        pumpOn,
        pumpOff,
        emergencyStop,
        resetEmergencyStop,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
