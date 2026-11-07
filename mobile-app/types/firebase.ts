// ============================================================
// AgriSweep — Firebase Realtime Database Type Definitions
// Mirrors firebase_db_structure.json and esp32_firmware.ino.
// ============================================================

import { AutomationState, TriggerRecord, VisionStatus } from './automation';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type FirebaseConnectionState = 'idle' | 'connecting' | 'online' | 'offline' | 'error';

export interface FirebaseConfig {
  databaseUrl: string;
  authToken: string;
}

export interface FirebaseScraperNode {
  running: boolean | null;
  direction: string | null;
  stage: string | null;
  fault: string | null;
}

export interface FirebasePumpNode {
  active: boolean | null;
  runtimeMs: number | null;
  fault: string | null;
}

/** One timed move. The firmware runs the motor for durationMs, then sets /system/controls/jog to null. */
export interface JogCommand {
  direction: 'forward' | 'reverse';
  distanceCm: number;
  durationMs: number;
  at: number;
}

export interface FirebaseControlsNode {
  jog: JogCommand | null;
  manualPumpTrigger: boolean;
  emergencyStop: boolean;
}

export interface FirebaseSystemConfig {
  scraperSpeedPercent: number;
  strokeDistanceCm: number;
  /** Stroke run time at the current speed, so the firmware needs no maths. */
  strokeTimeMs: number;
  jogDistanceCm: number;
  travelCmPerSec: number;
  maxScraperRuntimeMs: number;
  pumpDurationMs: number;
  rinseAfterSweep: boolean;
  ammoniaWarningThreshold: number;
  binWarningDistanceCm: number;
}

/** Typed, null-safe view of the `/system` node. Missing fields are `null`. */
export interface FirebaseSystemSnapshot {
  status: string | null;
  operatingMode: string | null;
  ammoniaRaw: number | null;
  ammoniaLevel: number | null;
  distanceCm: number | null;
  binCapacity: number | null;
  lastUpdated: number | null;
  lastCleaningCycleTime: number | null;
  manualCleanTrigger: boolean;
  scraper: FirebaseScraperNode;
  pump: FirebasePumpNode;
  controls: FirebaseControlsNode;
  config: Partial<FirebaseSystemConfig>;
  /** Raw /system/automation, validated later against app defaults. */
  automation: JsonObject | null;
  automationState: AutomationState;
  vision: VisionStatus | null;
  lastTrigger: TriggerRecord | null;
}

/** Writable paths, relative to `/system`. Sent as a single multi-path PATCH. */
export type FirebaseControlPath =
  | 'manualCleanTrigger'
  | 'controls/manualPumpTrigger'
  | 'controls/emergencyStop';

export type FirebaseCommandPatch = Partial<Record<FirebaseControlPath, boolean>> & {
  lastTrigger?: TriggerRecord;
  'controls/jog'?: JogCommand | null;
};

export interface FirebasePingResult {
  ok: boolean;
  latencyMs: number | null;
  /** True when `/system` exists in the database (i.e. firmware has written to it). */
  hasSystemNode: boolean;
  error: string | null;
}
