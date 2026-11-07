// ============================================================
// AgriSweep — Automation, Schedule & AI Detection Types
// ============================================================

import { OperatingMode } from './device';

/** What asked for a cleaning cycle. Written to /system/lastTrigger. */
export type TriggerSource = 'manual' | 'schedule' | 'ai' | 'sensor';

export interface TriggerRecord {
  source: TriggerSource;
  at: number;
  detail: string | null;
}

export interface ScheduleSlot {
  id: string;
  /** 24h clock, "HH:mm". */
  time: string;
  enabled: boolean;
}

export interface AutomationSchedule {
  enabled: boolean;
  slots: ScheduleSlot[];
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
}

/** How picky the camera AI is before it starts a cycle. */
export interface AiTriggerSettings {
  enabled: boolean;
  /** 0–100. Detections below this confidence are ignored. */
  minConfidencePercent: number;
  /** Droppings that must be visible in one frame. */
  minDetections: number;
  /** 0–100. Share of the image the droppings must cover (0 = ignore). */
  minCoveragePercent: number;
  /** Frames in a row that must pass before cleaning starts. */
  consecutiveFrames: number;
  /** Seconds between camera snapshots. */
  captureIntervalSec: number;
}

export interface SensorTriggerSettings {
  ammoniaEnabled: boolean;
  ammoniaPpm: number;
  /** Block automatic cycles while the waste bin reads full. */
  pauseWhenBinFull: boolean;
}

/** Synced to /system/automation so every phone (and the firmware) sees the same rules. */
export interface AutomationSettings {
  mode: OperatingMode;
  /** Minimum gap between two automatic cycles, in minutes. */
  cooldownMin: number;
  schedule: AutomationSchedule;
  ai: AiTriggerSettings;
  sensors: SensorTriggerSettings;
}

/** Shared runner bookkeeping, stored at /system/automationState. */
export interface AutomationState {
  lastAutoTriggerAt: number | null;
  lastScheduleKey: string | null;
}

/** Detector credentials. Kept on the camera phone only — never written to Firebase. */
export type DetectorProvider = 'simulated' | 'roboflow';

export interface DetectorConfig {
  provider: DetectorProvider;
  /** e.g. https://detect.roboflow.com or https://serverless.roboflow.com */
  endpoint: string;
  /** Roboflow "project/version", e.g. chicken-droppings/2 */
  modelId: string;
  apiKey: string;
  /** Class name the model uses for droppings. Empty = accept every class. */
  targetClass: string;
}

/** One bounding box, normalised to 0–1 of the image size (x/y = top-left). */
export interface Detection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
}

export interface FrameEvaluation {
  /** Detections that passed the confidence + class filter. */
  accepted: Detection[];
  maxConfidence: number;
  coveragePercent: number;
  /** True when this frame alone meets the trigger rules. */
  hit: boolean;
}

/** Published by the camera station to /system/vision. */
export interface VisionStatus {
  online: boolean;
  lastSeen: number | null;
  lastFrameAt: number | null;
  detections: number;
  maxConfidence: number;
  coveragePercent: number;
  streak: number;
  provider: DetectorProvider | null;
  error: string | null;
}
