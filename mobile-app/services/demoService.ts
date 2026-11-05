// ============================================================
// AgriSweep — Demo Service
// Provides deterministic sample data and a simulated scraper
// mechanism for UI exploration when no ESP32 is connected.
//
// SAFETY: This service is fully isolated from the Firebase
// service. No commands sent through this service can reach
// actual hardware.
// ============================================================

import {
  DeviceStatus,
  ScraperState,
  PumpState,
  MQ135Reading,
  UltrasonicReading,
  SensorDataPoint,
  CleaningCycle,
  CleaningCycleStage,
  CleaningStageRecord,
  CleaningStats,
  CleaningStatus,
  EventLogEntry,
  EventSeverity,
  EventType,
  AnalyticsSummary,
} from '../types';
import { APP_CONFIG } from '../constants/config';
import { BIN_MAX_DEPTH_CM, binCapacityFromDistance, clamp } from '../utils/sensors';

// ---- Deterministic seed data ----

const DEMO_DEVICE_STATUS: DeviceStatus = {
  connectionStatus: 'demo',
  operatingMode: 'manual',
  lastCommunicationTime: null,
  lastCleaningCycleTime: Date.now() - 3600000, // 1 hour ago
  scraper: {
    running: false,
    direction: 'stopped',
    stage: 'idle',
    limitSwitches: { forward: false, reverse: true }, // parked at home
    lastCommand: null,
    lastCommandTime: null,
    fault: null,
    runtimeMs: 0,
    maxRuntimeMs: APP_CONFIG.defaultMaxScraperRuntime,
  },
  pump: {
    active: false,
    lastActivationTime: null,
    configuredRuntimeMs: APP_CONFIG.defaultPumpDuration,
    runtimeMs: 0,
    fault: null,
  },
  deviceInfo: {
    name: 'AgriSweep Demo Unit',
    deviceId: 'DEMO-001',
    firmwareVersion: '1.0.0-demo',
    ipAddress: null,
    macAddress: null,
  },
  uptime: null,
};

// Estimated ammonia (PPM) oscillating through normal, warning and danger zones over the day.
function demoAmmoniaPpmAt(t: number): number {
  const minuteOfDay = (t / 60000) % 1440;
  const ppm = 24 + Math.sin(minuteOfDay / 100) * 20 + Math.cos(minuteOfDay / 37) * 9;
  return Math.round(clamp(ppm, 1.5, APP_CONFIG.mq135GaugeMaxPpm) * 10) / 10;
}

function demoDistanceAt(t: number): number {
  const minuteOfDay = (t / 60000) % 1440;
  const distance = 30 + Math.sin(minuteOfDay / 80) * 15 + Math.cos(minuteOfDay / 23) * 5;
  return clamp(Math.round(distance * 10) / 10, 2, BIN_MAX_DEPTH_CM);
}

function generateDemoMQ135(): MQ135Reading {
  const now = Date.now();
  const ppm = demoAmmoniaPpmAt(now);
  return {
    value: ppm,
    // Same linear mapping the firmware uses (0–4095 ADC → 0–100 PPM).
    rawAdc: Math.round((ppm / APP_CONFIG.mq135GaugeMaxPpm) * 4095),
    calibratedValue: ppm,
    displayMode: 'calibrated',
    timestamp: now,
    unit: 'ppm',
    status: 'normal', // classified against user thresholds in AppContext
    trend: 'unknown',
  };
}

function generateDemoUltrasonic(): UltrasonicReading {
  const now = Date.now();
  const distanceCm = demoDistanceAt(now);
  return {
    value: distanceCm,
    distanceCm,
    accumulationPercent: Math.round(binCapacityFromDistance(distanceCm)),
    mountPosition: 'above',
    referenceDistanceCm: BIN_MAX_DEPTH_CM,
    timestamp: now,
    unit: 'cm',
    status: 'normal', // classified against user thresholds in AppContext
    trend: 'unknown',
  };
}

function generateHistory(hours: number, intervalMs: number, valueAt: (t: number) => number): SensorDataPoint[] {
  const points: SensorDataPoint[] = [];
  const now = Date.now();
  for (let t = now - hours * 3600000; t <= now; t += intervalMs) {
    points.push({ value: valueAt(t), timestamp: t });
  }
  return points;
}

function generateDemoCleaningHistory(): CleaningCycle[] {
  const now = Date.now();
  const cycles: CleaningCycle[] = [];

  // Generate sample cleaning cycles over the past 3 days
  for (let i = 0; i < 12; i++) {
    const startTime = now - (i * 6 + 2) * 3600000;
    const duration = 10000 + Math.floor(Math.random() * 8000);
    const isCompleted = i !== 3; // One cycle "failed" for variety

    cycles.push({
      id: `demo-cycle-${i}`,
      startTime,
      endTime: startTime + duration,
      duration,
      mode: i % 3 === 0 ? 'automatic' : 'manual',
      scraperActivated: true,
      pumpActivated: i % 2 === 0,
      status: isCompleted ? 'completed' : 'failed',
      errorReason: isCompleted ? null : 'Motor timeout during forward pass (DEMO)',
      stages: [
        {
          stage: 'scraper_forward',
          startTime,
          endTime: startTime + duration * 0.4,
          status: 'completed',
        },
        {
          stage: 'scraper_reverse',
          startTime: startTime + duration * 0.4,
          endTime: startTime + duration * 0.7,
          status: isCompleted ? 'completed' : 'failed',
        },
        {
          stage: 'pump_active',
          startTime: startTime + duration * 0.7,
          endTime: startTime + duration,
          status: isCompleted && i % 2 === 0 ? 'completed' : 'skipped',
        },
      ],
    });
  }

  return cycles;
}

function generateDemoEventLog(): EventLogEntry[] {
  const now = Date.now();
  const events: EventLogEntry[] = [];

  const templates: Omit<EventLogEntry, 'id' | 'timestamp'>[] = [
    { type: 'system_info', severity: 'info', message: 'Demo mode activated', source: 'app' },
    { type: 'cleaning_completed', severity: 'info', message: 'Cleaning cycle completed successfully (DEMO)', source: 'demo' },
    { type: 'sensor_warning', severity: 'warning', message: 'Ammonia above 20 PPM warning threshold (DEMO)', source: 'demo' },
    { type: 'cleaning_started', severity: 'info', message: 'Manual cleaning cycle started (DEMO)', source: 'demo' },
    { type: 'pump_activated', severity: 'info', message: 'Water pump activated for 5s (DEMO)', source: 'demo' },
    { type: 'pump_deactivated', severity: 'info', message: 'Water pump deactivated (DEMO)', source: 'demo' },
    { type: 'scraper_limit_reached', severity: 'info', message: 'Forward limit switch triggered (DEMO)', source: 'demo' },
    { type: 'cleaning_failed', severity: 'error', message: 'Cleaning cycle interrupted: motor timeout (DEMO)', source: 'demo' },
    { type: 'settings_changed', severity: 'info', message: 'Warning threshold updated (DEMO)', source: 'app' },
    { type: 'device_disconnected', severity: 'warning', message: 'Device connection lost (DEMO)', source: 'demo' },
    { type: 'device_connected', severity: 'info', message: 'Device reconnected (DEMO)', source: 'demo' },
  ];

  for (let i = 0; i < templates.length; i++) {
    events.push({
      ...templates[i],
      id: `demo-event-${i}`,
      timestamp: now - i * 1800000 - Math.floor(Math.random() * 600000),
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function generateDemoAnalytics(): AnalyticsSummary {
  const now = Date.now();
  const dailyCycles = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date(now - d * 86400000);
    dailyCycles.push({
      date: date.toISOString().split('T')[0],
      count: 2 + Math.floor(Math.random() * 3),
    });
  }

  return {
    totalCleaningCycles: 42,
    averageCycleDuration: 13500,
    completionRate: 0.905,
    sensorWarningCount: 7,
    deviceUptime: null,
    dailyCycles,
    weeklyCycles: [
      { week: 'Week 1', count: 18 },
      { week: 'Week 2', count: 24 },
    ],
  };
}

function generateDemoCleaningStats(): CleaningStats {
  return {
    totalCycles: 42,
    completedCycles: 38,
    failedCycles: 4,
    averageDurationMs: 13500,
    completionRate: 0.905,
    cyclesToday: 3,
    totalCleaningTimeToday: 40500,
    lastCleaningResult: 'completed',
  };
}

// ---- Demo Service Class ----

const MOTION_TICK_MS = 100;
const SCRAPER_PAUSE_MS = 800;

type MotionDirection = 'forward' | 'reverse';

interface ActiveCycle {
  id: string;
  startTime: number;
  stages: CleaningStageRecord[];
  pumpActivated: boolean;
}

class DemoService {
  private deviceStatus: DeviceStatus;
  // Simulated carriage position: 0 = home / reverse limit, 1 = forward limit.
  private position = 0;
  private motionTimer: ReturnType<typeof setInterval> | null = null;
  private stepTimeout: ReturnType<typeof setTimeout> | null = null;
  private pumpSimTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(status: DeviceStatus) => void>();
  private activeCycle: ActiveCycle | null = null;
  private cleaningHistory: CleaningCycle[];
  private cleaningStats: CleaningStats;
  private eventLog: EventLogEntry[];

  constructor() {
    this.deviceStatus = structuredCloneStatus(DEMO_DEVICE_STATUS);
    this.cleaningHistory = generateDemoCleaningHistory();
    this.cleaningStats = generateDemoCleaningStats();
    this.eventLog = generateDemoEventLog();
  }

  /** Called whenever the simulated hardware changes state on its own (timers, limit switches). */
  subscribe(listener: (status: DeviceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  configure(options: { pumpDurationMs: number; maxScraperRuntimeMs: number }): void {
    this.deviceStatus = {
      ...this.deviceStatus,
      scraper: { ...this.deviceStatus.scraper, maxRuntimeMs: options.maxScraperRuntimeMs },
      pump: { ...this.deviceStatus.pump, configuredRuntimeMs: options.pumpDurationMs },
    };
  }

  getDeviceStatus(): DeviceStatus {
    return { ...this.deviceStatus };
  }

  getMQ135Reading(): MQ135Reading {
    return generateDemoMQ135();
  }

  getUltrasonicReading(): UltrasonicReading {
    return generateDemoUltrasonic();
  }

  getMQ135History(hours: number = 1): SensorDataPoint[] {
    const interval = hours <= 1 ? 10000 : hours <= 24 ? 60000 : 300000;
    return generateHistory(hours, interval, demoAmmoniaPpmAt);
  }

  getUltrasonicHistory(hours: number = 1): SensorDataPoint[] {
    const interval = hours <= 1 ? 10000 : hours <= 24 ? 60000 : 300000;
    return generateHistory(hours, interval, demoDistanceAt);
  }

  getCleaningHistory(): CleaningCycle[] {
    return [...this.cleaningHistory];
  }

  getCleaningStats(): CleaningStats {
    return { ...this.cleaningStats };
  }

  getEventLog(): EventLogEntry[] {
    return [...this.eventLog];
  }

  getAnalyticsSummary(): AnalyticsSummary {
    return generateDemoAnalytics();
  }

  // ---- Simulated controls — only update internal state ----

  simulateStartCleaning(): DeviceStatus {
    if (this.activeCycle || this.deviceStatus.scraper.stage === 'emergency_stopped') {
      return this.getDeviceStatus();
    }
    const now = Date.now();
    this.activeCycle = { id: `demo-cycle-live-${now}`, startTime: now, stages: [], pumpActivated: false };
    this.markCommand('start_cleaning');
    this.logEvent('cleaning_started', 'info', 'Manual cleaning cycle started (DEMO)');

    // Forward sweep → pause at chute → return home → water rinse → done
    this.beginStage('scraper_forward');
    this.drive('forward', () => {
      this.endStage('completed');
      this.beginStage('scraper_pause');
      this.patchScraper({ stage: 'scraper_pause' });
      this.stepTimeout = setTimeout(() => {
        this.endStage('completed');
        this.beginStage('scraper_reverse');
        this.drive('reverse', () => {
          this.endStage('completed');
          this.beginStage('pump_active');
          if (this.activeCycle) this.activeCycle.pumpActivated = true;
          this.patchScraper({ stage: 'pump_active' }, false);
          this.setPump(true);
          this.pumpSimTimeout = setTimeout(() => {
            this.endStage('completed');
            this.finishCycle('completed', null);
            this.patchScraper({ stage: 'completed' }, false);
            this.setPump(false);
          }, this.deviceStatus.pump.configuredRuntimeMs);
        });
      }, SCRAPER_PAUSE_MS);
    });

    return this.getDeviceStatus();
  }

  simulateStopCleaning(): DeviceStatus {
    this.haltAll();
    this.markCommand('stop_cleaning');
    if (this.activeCycle) {
      this.endStage('failed');
      this.finishCycle('interrupted', 'Stopped by operator (DEMO)');
    }
    this.patchScraper({ stage: 'idle' }, false);
    return this.getDeviceStatus();
  }

  simulateScraperForward(): DeviceStatus {
    if (this.deviceStatus.scraper.stage === 'emergency_stopped') return this.getDeviceStatus();
    this.markCommand('scraper_forward');
    this.drive('forward');
    return this.getDeviceStatus();
  }

  simulateScraperReverse(): DeviceStatus {
    if (this.deviceStatus.scraper.stage === 'emergency_stopped') return this.getDeviceStatus();
    this.markCommand('scraper_reverse');
    this.drive('reverse');
    return this.getDeviceStatus();
  }

  simulateScraperStop(): DeviceStatus {
    this.stopMotion();
    this.markCommand('scraper_stop');
    this.patchScraper({ running: false, direction: 'stopped', stage: 'idle' }, false);
    return this.getDeviceStatus();
  }

  simulatePumpOn(): DeviceStatus {
    if (this.deviceStatus.scraper.stage === 'emergency_stopped') return this.getDeviceStatus();
    this.markCommand('pump_on');
    this.setPump(true, false);
    if (this.pumpSimTimeout) clearTimeout(this.pumpSimTimeout);
    this.pumpSimTimeout = setTimeout(() => this.setPump(false), this.deviceStatus.pump.configuredRuntimeMs);
    return this.getDeviceStatus();
  }

  simulatePumpOff(): DeviceStatus {
    if (this.pumpSimTimeout) clearTimeout(this.pumpSimTimeout);
    this.markCommand('pump_off');
    this.setPump(false, false);
    return this.getDeviceStatus();
  }

  simulateEmergencyStop(): DeviceStatus {
    this.haltAll();
    this.markCommand('emergency_stop');
    if (this.activeCycle) {
      this.endStage('failed');
      this.finishCycle('interrupted', 'Emergency stop activated (DEMO)');
    }
    this.logEvent('emergency_stop', 'critical', 'EMERGENCY STOP — all actuators de-energized (DEMO)');
    this.patchScraper({ stage: 'emergency_stopped' }, false);
    return this.getDeviceStatus();
  }

  simulateResetEmergencyStop(): DeviceStatus {
    this.markCommand('reset_emergency_stop');
    this.logEvent('system_info', 'info', 'Emergency stop released (DEMO)');
    this.patchScraper({ stage: 'idle', fault: null }, false);
    return this.getDeviceStatus();
  }

  reset(): void {
    this.haltAll();
    this.activeCycle = null;
    this.position = 0;
    this.deviceStatus = structuredCloneStatus(DEMO_DEVICE_STATUS);
  }

  // ---- Internal simulation ----

  private drive(direction: MotionDirection, onArrive?: () => void): void {
    this.stopMotion();
    const step = MOTION_TICK_MS / APP_CONFIG.demoScraperTravelMs;
    const startedAt = Date.now();

    this.patchScraper(
      {
        running: true,
        direction,
        stage: direction === 'forward' ? 'scraper_forward' : 'scraper_reverse',
        runtimeMs: 0,
        fault: null,
      },
      false
    );

    this.motionTimer = setInterval(() => {
      const prevLimits = this.limitsFor(this.position);
      this.position = clamp(this.position + (direction === 'forward' ? step : -step), 0, 1);
      const limits = this.limitsFor(this.position);
      const arrived = direction === 'forward' ? limits.forward : limits.reverse;

      if (arrived) {
        this.stopMotion();
        this.logEvent(
          'scraper_limit_reached',
          'info',
          `${direction === 'forward' ? 'Forward (chute)' : 'Reverse (home)'} limit switch triggered (DEMO)`
        );
        this.patchScraper({
          running: false,
          direction: 'stopped',
          stage: onArrive ? this.deviceStatus.scraper.stage : 'idle',
          limitSwitches: limits,
          runtimeMs: Date.now() - startedAt,
        });
        onArrive?.();
      } else if (prevLimits.forward !== limits.forward || prevLimits.reverse !== limits.reverse) {
        // Carriage left a limit switch
        this.patchScraper({ limitSwitches: limits });
      }
    }, MOTION_TICK_MS);
  }

  private stopMotion(): void {
    if (this.motionTimer) clearInterval(this.motionTimer);
    this.motionTimer = null;
  }

  private haltAll(): void {
    this.stopMotion();
    if (this.stepTimeout) clearTimeout(this.stepTimeout);
    if (this.pumpSimTimeout) clearTimeout(this.pumpSimTimeout);
    this.stepTimeout = null;
    this.pumpSimTimeout = null;
    this.deviceStatus = {
      ...this.deviceStatus,
      scraper: { ...this.deviceStatus.scraper, running: false, direction: 'stopped' },
      pump: { ...this.deviceStatus.pump, active: false },
    };
  }

  private limitsFor(position: number): ScraperState['limitSwitches'] {
    return { forward: position >= 1, reverse: position <= 0 };
  }

  private setPump(active: boolean, notify: boolean = true): void {
    const pump: PumpState = {
      ...this.deviceStatus.pump,
      active,
      lastActivationTime: active ? Date.now() : this.deviceStatus.pump.lastActivationTime,
    };
    this.deviceStatus = { ...this.deviceStatus, pump };
    this.logEvent(
      active ? 'pump_activated' : 'pump_deactivated',
      'info',
      active
        ? `Water pump activated for ${Math.round(pump.configuredRuntimeMs / 1000)}s (DEMO)`
        : 'Water pump deactivated (DEMO)'
    );
    if (notify) this.emit();
  }

  private patchScraper(patch: Partial<ScraperState>, notify: boolean = true): void {
    this.deviceStatus = {
      ...this.deviceStatus,
      scraper: { ...this.deviceStatus.scraper, ...patch },
    };
    if (notify) this.emit();
  }

  private markCommand(command: string): void {
    this.patchScraper({ lastCommand: command, lastCommandTime: Date.now() }, false);
  }

  private beginStage(stage: CleaningCycleStage): void {
    this.activeCycle?.stages.push({ stage, startTime: Date.now(), endTime: null, status: 'completed' });
  }

  private endStage(status: CleaningStageRecord['status']): void {
    const current = this.activeCycle?.stages[this.activeCycle.stages.length - 1];
    if (current && current.endTime === null) {
      current.endTime = Date.now();
      current.status = status;
    }
  }

  private finishCycle(status: CleaningStatus, errorReason: string | null): void {
    const cycle = this.activeCycle;
    if (!cycle) return;
    this.activeCycle = null;
    const endTime = Date.now();
    const duration = endTime - cycle.startTime;

    this.cleaningHistory = [
      {
        id: cycle.id,
        startTime: cycle.startTime,
        endTime,
        duration,
        mode: 'manual',
        scraperActivated: true,
        pumpActivated: cycle.pumpActivated,
        status,
        errorReason,
        stages: cycle.stages,
      },
      ...this.cleaningHistory,
    ];

    const s = this.cleaningStats;
    const totalCycles = s.totalCycles + 1;
    const completedCycles = s.completedCycles + (status === 'completed' ? 1 : 0);
    this.cleaningStats = {
      totalCycles,
      completedCycles,
      failedCycles: s.failedCycles + (status === 'completed' ? 0 : 1),
      averageDurationMs: Math.round((s.averageDurationMs * s.totalCycles + duration) / totalCycles),
      completionRate: completedCycles / totalCycles,
      cyclesToday: s.cyclesToday + 1,
      totalCleaningTimeToday: s.totalCleaningTimeToday + duration,
      lastCleaningResult: status,
    };

    if (status === 'completed') {
      this.deviceStatus = { ...this.deviceStatus, lastCleaningCycleTime: endTime };
      this.logEvent('cleaning_completed', 'info', 'Cleaning cycle completed successfully (DEMO)');
    } else {
      this.logEvent('cleaning_failed', 'error', `Cleaning cycle interrupted: ${errorReason ?? 'unknown'}`);
    }
  }

  private logEvent(type: EventType, severity: EventSeverity, message: string): void {
    const now = Date.now();
    const entry: EventLogEntry = {
      id: `demo-event-${now}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      severity,
      message,
      timestamp: now,
      source: 'demo',
    };
    this.eventLog = [entry, ...this.eventLog].slice(0, APP_CONFIG.maxEventLogEntries);
  }

  private emit(): void {
    const status = this.getDeviceStatus();
    this.listeners.forEach((cb) => cb(status));
  }
}

function structuredCloneStatus(status: DeviceStatus): DeviceStatus {
  return {
    ...status,
    scraper: { ...status.scraper, limitSwitches: { ...status.scraper.limitSwitches } },
    pump: { ...status.pump },
    deviceInfo: { ...status.deviceInfo },
  };
}

export const demoService = new DemoService();
export default demoService;
