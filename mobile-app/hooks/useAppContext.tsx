// ============================================================
// AgriSweep — App Context
// Central state management for device status, sensor readings,
// demo / live mode, and settings across all screens.
//
// Demo mode  → demoService (simulated, never reaches hardware)
// Live mode  → firebaseService (ESP32 via Firebase RTDB)
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { demoService } from '../services/demoService';
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
  FirebaseConnectionState,
  FirebasePingResult,
  FirebaseSystemSnapshot,
} from '../types';

export interface SettingsSaveResult {
  /** True when the change was also written to `/system/config` on the device. */
  syncedToDevice: boolean;
  error: string | null;
}

interface AppState {
  // Mode
  isDemoMode: boolean;
  setDemoMode: (v: boolean) => void;

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

  // Actions
  startCleaning: () => void;
  stopCleaning: () => void;
  scraperForward: () => void;
  scraperReverse: () => void;
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
  mode: 'manual',
  schedule: {
    enabled: false,
    intervalHours: 6,
    startTime: '06:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  maxScraperRuntimeMs: APP_CONFIG.defaultMaxScraperRuntime,
  pumpDurationMs: APP_CONFIG.defaultPumpDuration,
  motorTimeoutMs: APP_CONFIG.defaultMotorTimeout,
  cooldownMs: APP_CONFIG.defaultCooldown,
  limitSwitchMonitoring: true,
  requireConfirmation: true,
  emergencyStopEnabled: true,
};

const defaultFirebaseConfig: FirebaseConfig = { databaseUrl: '', authToken: '' };

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
  'controls/manualScraperForward': false,
  'controls/manualScraperReverse': false,
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
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [firebaseConfig, setFirebaseConfigState] = useState<FirebaseConfig>(defaultFirebaseConfig);
  const [sensorThresholds, setSensorThresholds] = useState<SensorThresholds>(defaultSensorThresholds);
  const [cleaningSettings, setCleaningSettings] = useState<CleaningSettings>(defaultCleaningSettings);

  // Shared sensor history (reset when switching modes)
  const [mq135History, setMQ135History] = useState<SensorDataPoint[]>([]);
  const [ultrasonicHistory, setUltrasonicHistory] = useState<SensorDataPoint[]>([]);

  // Demo-mode state
  const [demoDeviceStatus, setDemoDeviceStatus] = useState<DeviceStatus>(demoService.getDeviceStatus());
  const [demoMQ135, setDemoMQ135] = useState<MQ135Reading>(demoService.getMQ135Reading());
  const [demoUltrasonic, setDemoUltrasonic] = useState<UltrasonicReading>(demoService.getUltrasonicReading());
  const [demoCleaningHistory, setDemoCleaningHistory] = useState<CleaningCycle[]>([]);
  const [demoCleaningStats, setDemoCleaningStats] = useState<CleaningStats>(demoService.getCleaningStats());
  const [demoEventLog, setDemoEventLog] = useState<EventLogEntry[]>([]);
  const [demoAnalytics, setDemoAnalytics] = useState<AnalyticsSummary>(demoService.getAnalyticsSummary());

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
  const isDemoModeRef = useRef(isDemoMode);
  const thresholdsRef = useRef(sensorThresholds);
  const prevSnapshotRef = useRef<FirebaseSystemSnapshot | null>(null);
  const liveCycleRef = useRef<LiveCycle | null>(null);
  isDemoModeRef.current = isDemoMode;
  thresholdsRef.current = sensorThresholds;

  // ---- Persistence ----

  useEffect(() => {
    (async () => {
      try {
        const [demoStr, threshStr, cleanStr, fbStr, liveHistStr] = await Promise.all([
          AsyncStorage.getItem(APP_CONFIG.storageKeys.demoMode),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.sensorThresholds),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.cleaningSettings),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.firebaseConfig),
          AsyncStorage.getItem(APP_CONFIG.storageKeys.liveCleaningHistory),
        ]);
        if (demoStr !== null) setIsDemoMode(JSON.parse(demoStr) as boolean);
        if (threshStr) {
          const stored = JSON.parse(threshStr) as SensorThresholds;
          const migrated = migrateThresholds(stored);
          setSensorThresholds(migrated);
          if (migrated !== stored) {
            await AsyncStorage.setItem(APP_CONFIG.storageKeys.sensorThresholds, JSON.stringify(migrated));
          }
        }
        if (cleanStr) setCleaningSettings({ ...defaultCleaningSettings, ...(JSON.parse(cleanStr) as CleaningSettings) });
        if (fbStr) setFirebaseConfigState({ ...defaultFirebaseConfig, ...(JSON.parse(fbStr) as FirebaseConfig) });
        if (liveHistStr) setLiveCleaningHistory(JSON.parse(liveHistStr) as CleaningCycle[]);
      } catch (e) {
        console.warn('Failed to load settings:', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setDemoMode = useCallback(async (v: boolean) => {
    setIsDemoMode(v);
    try {
      await AsyncStorage.setItem(APP_CONFIG.storageKeys.demoMode, JSON.stringify(v));
    } catch {}
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
    if (isDemoModeRef.current || !firebaseService.isConfigured()) return { syncedToDevice: false, error: null };
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
    if (isDemoModeRef.current || !firebaseService.isConfigured()) return { syncedToDevice: false, error: null };
    try {
      await firebaseService.writeConfig({
        maxScraperRuntimeMs: s.maxScraperRuntimeMs,
        pumpDurationMs: s.pumpDurationMs,
      });
      return { syncedToDevice: true, error: null };
    } catch (e) {
      return { syncedToDevice: false, error: errorMessage(e) };
    }
  }, []);

  useEffect(() => {
    demoService.configure({
      pumpDurationMs: cleaningSettings.pumpDurationMs,
      maxScraperRuntimeMs: cleaningSettings.maxScraperRuntimeMs,
    });
  }, [cleaningSettings.pumpDurationMs, cleaningSettings.maxScraperRuntimeMs]);

  // ---- Demo mode ----

  const syncDemoRecords = useCallback(() => {
    setDemoCleaningHistory(demoService.getCleaningHistory());
    setDemoCleaningStats(demoService.getCleaningStats());
    setDemoEventLog(demoService.getEventLog());
  }, []);

  const loadDemoData = useCallback(() => {
    setDemoDeviceStatus(demoService.getDeviceStatus());
    setDemoMQ135(demoService.getMQ135Reading());
    setDemoUltrasonic(demoService.getUltrasonicReading());
    setMQ135History(demoService.getMQ135History(1));
    setUltrasonicHistory(demoService.getUltrasonicHistory(1));
    setDemoAnalytics(demoService.getAnalyticsSummary());
    syncDemoRecords();
  }, [syncDemoRecords]);

  useEffect(() => {
    if (!hydrated || !isDemoMode) return;
    loadDemoData();

    const unsubscribe = demoService.subscribe((status) => {
      setDemoDeviceStatus(status);
      syncDemoRecords();
    });

    const interval = setInterval(() => {
      const mq = demoService.getMQ135Reading();
      const us = demoService.getUltrasonicReading();
      setDemoMQ135(mq);
      setDemoUltrasonic(us);
      setMQ135History((h) => appendDataPoint(h, { value: mq.value, timestamp: mq.timestamp }, APP_CONFIG.maxSensorDataPoints));
      setUltrasonicHistory((h) =>
        appendDataPoint(h, { value: us.distanceCm, timestamp: us.timestamp }, APP_CONFIG.maxSensorDataPoints)
      );
    }, APP_CONFIG.defaultMQ135RefreshInterval);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [hydrated, isDemoMode, loadDemoData, syncDemoRecords]);

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
          mode: snap.operatingMode?.toLowerCase() === 'automatic' ? 'automatic' : 'manual',
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
      if (snap.scraper.limitSwitchForward && !prev.scraper.limitSwitchForward) {
        logLiveEvent('scraper_limit_reached', 'info', 'Forward (chute) limit switch triggered');
      }
      if (snap.scraper.limitSwitchReverse && !prev.scraper.limitSwitchReverse) {
        logLiveEvent('scraper_limit_reached', 'info', 'Reverse (home) limit switch triggered');
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
    if (!hydrated || isDemoMode) return;

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
  }, [hydrated, isDemoMode, firebaseConfig, handleLiveData, logLiveEvent]);

  const sendLive = useCallback(
    async (command: string, patch: FirebaseCommandPatch, description: string) => {
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
      } catch (e) {
        const msg = errorMessage(e);
        setCommandError(`${description} failed: ${msg}`);
        logLiveEvent('actuator_fault', 'error', `Command "${description}" failed: ${msg}`, 'app');
      }
    },
    [logLiveEvent]
  );

  // ---- Unified actions ----

  const startCleaning = useCallback(() => {
    if (isDemoMode) setDemoDeviceStatus(demoService.simulateStartCleaning());
    else void sendLive('start_cleaning', { manualCleanTrigger: true }, 'Start cleaning cycle');
  }, [isDemoMode, sendLive]);

  const stopCleaning = useCallback(() => {
    if (isDemoMode) {
      setDemoDeviceStatus(demoService.simulateStopCleaning());
      syncDemoRecords();
    } else {
      void sendLive('stop_cleaning', ALL_ACTUATORS_OFF, 'Stop cleaning cycle');
    }
  }, [isDemoMode, sendLive, syncDemoRecords]);

  const scraperForward = useCallback(() => {
    if (isDemoMode) setDemoDeviceStatus(demoService.simulateScraperForward());
    else
      void sendLive(
        'scraper_forward',
        { 'controls/manualScraperForward': true, 'controls/manualScraperReverse': false },
        'Scraper forward'
      );
  }, [isDemoMode, sendLive]);

  const scraperReverse = useCallback(() => {
    if (isDemoMode) setDemoDeviceStatus(demoService.simulateScraperReverse());
    else
      void sendLive(
        'scraper_reverse',
        { 'controls/manualScraperForward': false, 'controls/manualScraperReverse': true },
        'Scraper reverse'
      );
  }, [isDemoMode, sendLive]);

  const scraperStop = useCallback(() => {
    if (isDemoMode) setDemoDeviceStatus(demoService.simulateScraperStop());
    else
      void sendLive(
        'scraper_stop',
        { 'controls/manualScraperForward': false, 'controls/manualScraperReverse': false },
        'Scraper stop'
      );
  }, [isDemoMode, sendLive]);

  const pumpOn = useCallback(() => {
    if (isDemoMode) setDemoDeviceStatus(demoService.simulatePumpOn());
    else void sendLive('pump_on', { 'controls/manualPumpTrigger': true }, 'Pump on');
  }, [isDemoMode, sendLive]);

  const pumpOff = useCallback(() => {
    if (isDemoMode) setDemoDeviceStatus(demoService.simulatePumpOff());
    else void sendLive('pump_off', { 'controls/manualPumpTrigger': false }, 'Pump off');
  }, [isDemoMode, sendLive]);

  const emergencyStop = useCallback(() => {
    if (isDemoMode) {
      setDemoDeviceStatus(demoService.simulateEmergencyStop());
      syncDemoRecords();
    } else {
      void sendLive('emergency_stop', { ...ALL_ACTUATORS_OFF, 'controls/emergencyStop': true }, 'EMERGENCY STOP');
    }
  }, [isDemoMode, sendLive, syncDemoRecords]);

  const resetEmergencyStop = useCallback(() => {
    if (isDemoMode) {
      setDemoDeviceStatus(demoService.simulateResetEmergencyStop());
      syncDemoRecords();
    } else {
      void sendLive('reset_emergency_stop', { 'controls/emergencyStop': false }, 'Release emergency stop');
    }
  }, [isDemoMode, sendLive, syncDemoRecords]);

  const refreshData = useCallback(() => {
    if (isDemoMode) {
      loadDemoData();
    } else {
      firebaseService.refresh().catch((e: unknown) => setConnectionError(errorMessage(e)));
    }
  }, [isDemoMode, loadDemoData]);

  // ---- Derived state ----

  const connectionStatus: ConnectionStatus = isDemoMode ? 'demo' : connectionFromFirebase(firebaseState);

  const deviceStatus = useMemo<DeviceStatus>(() => {
    if (isDemoMode) return { ...demoDeviceStatus, connectionStatus };

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
      operatingMode: snap?.operatingMode?.toLowerCase() === 'automatic' ? 'automatic' : 'manual',
      lastCommunicationTime: lastLiveUpdate,
      lastCleaningCycleTime: snap?.lastCleaningCycleTime ?? lastLiveCycle?.endTime ?? null,
      scraper: {
        // Current firmware only reports `/system/status`; fall back to it when `/system/scraper` is absent.
        running: snap?.scraper.running ?? cleaning,
        direction,
        stage,
        limitSwitches: {
          forward: snap?.scraper.limitSwitchForward ?? false,
          reverse: snap?.scraper.limitSwitchReverse ?? false,
        },
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
    isDemoMode,
    demoDeviceStatus,
    connectionStatus,
    liveSnapshot,
    lastLiveUpdate,
    liveCommand,
    livePumpActivatedAt,
    liveCleaningHistory,
    cleaningSettings.maxScraperRuntimeMs,
    cleaningSettings.pumpDurationMs,
    firebaseConfig.databaseUrl,
  ]);

  const mq135Reading = useMemo<MQ135Reading>(() => {
    const trend = computeTrend(mq135History, 1);
    if (isDemoMode) {
      return { ...demoMQ135, status: classifyAmmonia(demoMQ135.value, sensorThresholds), trend };
    }
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
  }, [isDemoMode, demoMQ135, liveSnapshot, lastLiveUpdate, mq135History, sensorThresholds]);

  const ultrasonicReading = useMemo<UltrasonicReading>(() => {
    // Rising distance = falling waste level, so the trend is inverted for display.
    const distanceTrend = computeTrend(ultrasonicHistory, 0.5);
    const trend = distanceTrend === 'rising' ? 'falling' : distanceTrend === 'falling' ? 'rising' : distanceTrend;
    if (isDemoMode) {
      return {
        ...demoUltrasonic,
        status: classifyDistance(demoUltrasonic.distanceCm, sensorThresholds),
        trend,
      };
    }
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
  }, [isDemoMode, demoUltrasonic, liveSnapshot, lastLiveUpdate, ultrasonicHistory, sensorThresholds]);

  const liveStats = useMemo(() => computeCleaningStats(liveCleaningHistory), [liveCleaningHistory]);
  const liveAnalytics = useMemo(
    () => computeAnalytics(liveCleaningHistory, liveEventLog),
    [liveCleaningHistory, liveEventLog]
  );

  return (
    <AppContext.Provider
      value={{
        isDemoMode,
        setDemoMode,
        firebaseConfig,
        setFirebaseConfig,
        testFirebaseConnection,
        connectionError: isDemoMode ? null : connectionError,
        commandError: isDemoMode ? null : commandError,
        deviceStatus,
        connectionStatus,
        mq135Reading,
        ultrasonicReading,
        mq135History,
        ultrasonicHistory,
        cleaningHistory: isDemoMode ? demoCleaningHistory : liveCleaningHistory,
        cleaningStats: isDemoMode ? demoCleaningStats : liveStats,
        eventLog: isDemoMode ? demoEventLog : liveEventLog,
        analyticsSummary: isDemoMode ? demoAnalytics : liveAnalytics,
        sensorThresholds,
        setSensorThresholds: updateThresholds,
        cleaningSettings,
        setCleaningSettings: updateCleaningSettings,
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
