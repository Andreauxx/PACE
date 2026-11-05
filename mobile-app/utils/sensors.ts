// ============================================================
// AgriSweep — Sensor Helpers
// Shared by demo and live (Firebase) modes so both classify
// readings identically.
// ============================================================

import { SensorDataPoint, SensorStatus, SensorThresholds } from '../types';

// Bin geometry used by the firmware's HC-SR04 → capacity mapping
// (see readSensors() in esp32_firmware.ino).
export const BIN_MAX_DEPTH_CM = 50;
export const BIN_MIN_SAFE_DIST_CM = 5;

export type Trend = 'rising' | 'falling' | 'stable' | 'unknown';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function classifyAmmonia(ppm: number, thresholds: SensorThresholds): SensorStatus {
  if (ppm >= thresholds.mq135.criticalThreshold) return 'critical';
  if (ppm >= thresholds.mq135.warningThreshold) return 'warning';
  return 'normal';
}

export function classifyDistance(distanceCm: number, thresholds: SensorThresholds): SensorStatus {
  if (distanceCm <= thresholds.ultrasonic.criticalDistanceCm) return 'critical';
  if (distanceCm <= thresholds.ultrasonic.warningDistanceCm) return 'warning';
  return 'normal';
}

/** Same mapping as the firmware: 50 cm clearance = 0% full, ≤5 cm = 100% full. */
export function binCapacityFromDistance(distanceCm: number, maxDepthCm: number = BIN_MAX_DEPTH_CM): number {
  if (distanceCm <= 0 || distanceCm >= maxDepthCm) return 0;
  if (distanceCm <= BIN_MIN_SAFE_DIST_CM) return 100;
  return clamp(100 - ((distanceCm - BIN_MIN_SAFE_DIST_CM) / (maxDepthCm - BIN_MIN_SAFE_DIST_CM)) * 100, 0, 100);
}

/** Inverse of binCapacityFromDistance, for firmware that only publishes `binCapacity`. */
export function distanceFromBinCapacity(percent: number, maxDepthCm: number = BIN_MAX_DEPTH_CM): number {
  const p = clamp(percent, 0, 100);
  return BIN_MIN_SAFE_DIST_CM + ((100 - p) / 100) * (maxDepthCm - BIN_MIN_SAFE_DIST_CM);
}

/** Compares the mean of the newest samples against the samples just before them. */
export function computeTrend(history: SensorDataPoint[], tolerance: number, window: number = 3): Trend {
  if (history.length < window * 2) return 'unknown';
  const mean = (pts: SensorDataPoint[]) => pts.reduce((sum, p) => sum + p.value, 0) / pts.length;
  const recent = mean(history.slice(-window));
  const previous = mean(history.slice(-window * 2, -window));
  if (recent - previous > tolerance) return 'rising';
  if (previous - recent > tolerance) return 'falling';
  return 'stable';
}

export function appendDataPoint(
  history: SensorDataPoint[],
  point: SensorDataPoint,
  maxPoints: number
): SensorDataPoint[] {
  const last = history[history.length - 1];
  if (last && last.timestamp === point.timestamp) return history;
  const next = [...history, point];
  return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
}
