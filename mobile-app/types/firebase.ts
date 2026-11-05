// ============================================================
// AgriSweep — Firebase Realtime Database Type Definitions
// Mirrors firebase_db_structure.json and esp32_firmware.ino.
// ============================================================

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
  limitSwitchForward: boolean | null;
  limitSwitchReverse: boolean | null;
  fault: string | null;
}

export interface FirebasePumpNode {
  active: boolean | null;
  runtimeMs: number | null;
  fault: string | null;
}

export interface FirebaseControlsNode {
  manualScraperForward: boolean;
  manualScraperReverse: boolean;
  manualPumpTrigger: boolean;
  emergencyStop: boolean;
}

export interface FirebaseSystemConfig {
  maxScraperRuntimeMs: number;
  pumpDurationMs: number;
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
}

/** Writable paths, relative to `/system`. Sent as a single multi-path PATCH. */
export type FirebaseControlPath =
  | 'manualCleanTrigger'
  | 'controls/manualScraperForward'
  | 'controls/manualScraperReverse'
  | 'controls/manualPumpTrigger'
  | 'controls/emergencyStop';

export type FirebaseCommandPatch = Partial<Record<FirebaseControlPath, boolean>>;

export interface FirebasePingResult {
  ok: boolean;
  latencyMs: number | null;
  /** True when `/system` exists in the database (i.e. firmware has written to it). */
  hasSystemNode: boolean;
  error: string | null;
}
