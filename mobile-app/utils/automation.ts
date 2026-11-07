// ============================================================
// AgriSweep — Automation Rules
// Pure functions used by the Camera Station runner and the
// Automation screen, so the rules shown to the user are exactly
// the rules that fire.
// ============================================================

import {
  AiTriggerSettings,
  AutomationSchedule,
  AutomationSettings,
  Detection,
  FrameEvaluation,
  JsonObject,
  JsonValue,
} from '../types';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** A schedule slot stays "due" for this long, so a briefly busy station doesn't miss it. */
export const SCHEDULE_GRACE_MS = 5 * 60 * 1000;

/** The camera station counts as online if it reported within this window. */
export const STATION_STALE_MS = 90 * 1000;

export const defaultAutomationSettings: AutomationSettings = {
  mode: 'manual',
  cooldownMin: 30,
  schedule: {
    enabled: false,
    slots: [
      { id: 'slot-morning', time: '06:00', enabled: true },
      { id: 'slot-evening', time: '18:00', enabled: true },
    ],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  ai: {
    enabled: false,
    minConfidencePercent: 60,
    minDetections: 2,
    minCoveragePercent: 0,
    consecutiveFrames: 3,
    captureIntervalSec: 5,
  },
  sensors: {
    ammoniaEnabled: false,
    ammoniaPpm: 35,
    pauseWhenBinFull: true,
  },
};

export type AiPreset = 'sensitive' | 'balanced' | 'strict';

export const AI_PRESETS: Record<AiPreset, Pick<AiTriggerSettings, 'minConfidencePercent' | 'minDetections' | 'minCoveragePercent' | 'consecutiveFrames'>> = {
  sensitive: { minConfidencePercent: 40, minDetections: 1, minCoveragePercent: 0, consecutiveFrames: 2 },
  balanced: { minConfidencePercent: 60, minDetections: 2, minCoveragePercent: 0, consecutiveFrames: 3 },
  strict: { minConfidencePercent: 80, minDetections: 4, minCoveragePercent: 3, consecutiveFrames: 5 },
};

export function matchingPreset(ai: AiTriggerSettings): AiPreset | null {
  for (const [name, p] of Object.entries(AI_PRESETS) as [AiPreset, (typeof AI_PRESETS)[AiPreset]][]) {
    if (
      p.minConfidencePercent === ai.minConfidencePercent &&
      p.minDetections === ai.minDetections &&
      p.minCoveragePercent === ai.minCoveragePercent &&
      p.consecutiveFrames === ai.consecutiveFrames
    ) {
      return name;
    }
  }
  return null;
}

// ---- Merging untrusted data (Firebase / storage) with defaults ----

function isObj(v: JsonValue | undefined | unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Accepts anything (stored JSON, a Firebase node) and returns valid settings. */
export function normalizeAutomation(raw: unknown): AutomationSettings {
  const d = defaultAutomationSettings;
  if (!isObj(raw)) return d;
  const schedule = isObj(raw.schedule) ? raw.schedule : {};
  const ai = isObj(raw.ai) ? raw.ai : {};
  const sensors = isObj(raw.sensors) ? raw.sensors : {};

  // Firebase turns arrays into objects keyed by index, so accept both.
  const rawSlots = Array.isArray(schedule.slots)
    ? schedule.slots
    : isObj(schedule.slots)
    ? Object.values(schedule.slots)
    : null;
  const slots = rawSlots
    ? rawSlots
        .filter(isObj)
        .filter((s) => typeof s.time === 'string' && TIME_RE.test(s.time))
        .map((s, i) => ({
          id: typeof s.id === 'string' ? s.id : `slot-${i}`,
          time: s.time as string,
          enabled: bool(s.enabled, true),
        }))
    : d.schedule.slots;
  const rawDays = Array.isArray(schedule.daysOfWeek)
    ? schedule.daysOfWeek
    : isObj(schedule.daysOfWeek)
    ? Object.values(schedule.daysOfWeek)
    : null;
  const days = rawDays
    ? rawDays.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 6)
    : d.schedule.daysOfWeek;

  return {
    mode: raw.mode === 'automatic' ? 'automatic' : 'manual',
    cooldownMin: num(raw.cooldownMin, d.cooldownMin, 0, 24 * 60),
    schedule: {
      enabled: bool(schedule.enabled, d.schedule.enabled),
      slots: sortSlots(slots),
      daysOfWeek: [...new Set(days)].sort(),
    },
    ai: {
      enabled: bool(ai.enabled, d.ai.enabled),
      minConfidencePercent: num(ai.minConfidencePercent, d.ai.minConfidencePercent, 10, 99),
      minDetections: Math.round(num(ai.minDetections, d.ai.minDetections, 1, 50)),
      minCoveragePercent: num(ai.minCoveragePercent, d.ai.minCoveragePercent, 0, 100),
      consecutiveFrames: Math.round(num(ai.consecutiveFrames, d.ai.consecutiveFrames, 1, 30)),
      captureIntervalSec: num(ai.captureIntervalSec, d.ai.captureIntervalSec, 2, 120),
    },
    sensors: {
      ammoniaEnabled: bool(sensors.ammoniaEnabled, d.sensors.ammoniaEnabled),
      ammoniaPpm: num(sensors.ammoniaPpm, d.sensors.ammoniaPpm, 1, 100),
      pauseWhenBinFull: bool(sensors.pauseWhenBinFull, d.sensors.pauseWhenBinFull),
    },
  };
}

// ---- Schedule ----

export function sortSlots<T extends { time: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.time.localeCompare(b.time));
}

function slotDate(base: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns the run key ("YYYY-MM-DD HH:mm") of a slot that is due now and not yet run, else null. */
export function dueScheduleKey(schedule: AutomationSchedule, now: Date, lastKey: string | null): string | null {
  if (!schedule.enabled || !schedule.daysOfWeek.includes(now.getDay())) return null;
  for (const slot of schedule.slots) {
    if (!slot.enabled) continue;
    const at = slotDate(now, slot.time);
    const diff = now.getTime() - at.getTime();
    if (diff >= 0 && diff < SCHEDULE_GRACE_MS) {
      const key = `${dateKey(now)} ${slot.time}`;
      if (key !== lastKey) return key;
    }
  }
  return null;
}

/** Next time a scheduled cycle will be requested, looking up to a week ahead. */
export function nextScheduledRun(schedule: AutomationSchedule, now: Date): Date | null {
  const slots = schedule.slots.filter((s) => s.enabled);
  if (!schedule.enabled || slots.length === 0 || schedule.daysOfWeek.length === 0) return null;
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    if (!schedule.daysOfWeek.includes(day.getDay())) continue;
    for (const slot of sortSlots(slots)) {
      const at = slotDate(day, slot.time);
      if (at.getTime() > now.getTime()) return at;
    }
  }
  return null;
}

export function formatClock(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatNextRun(at: Date | null, now: Date = new Date()): string {
  if (!at) return 'Not scheduled';
  const sameDay = dateKey(at) === dateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = formatClock(`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`);
  if (sameDay) return `Today, ${time}`;
  if (dateKey(at) === dateKey(tomorrow)) return `Tomorrow, ${time}`;
  return `${DAY_LABELS[at.getDay()]}, ${time}`;
}

export function shiftTime(time: string, deltaMinutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + deltaMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ---- AI frame evaluation ----

export function evaluateFrame(detections: Detection[], ai: AiTriggerSettings, targetClass: string): FrameEvaluation {
  const target = targetClass.trim().toLowerCase();
  const minConf = ai.minConfidencePercent / 100;
  const accepted = detections.filter(
    (d) => d.confidence >= minConf && (target === '' || d.label.toLowerCase() === target)
  );
  const maxConfidence = accepted.reduce((max, d) => Math.max(max, d.confidence), 0);
  // Summed box area (boxes rarely overlap much for droppings), capped at 100 %.
  const coveragePercent = Math.min(100, accepted.reduce((sum, d) => sum + d.width * d.height, 0) * 100);
  const hit = accepted.length >= ai.minDetections && coveragePercent >= ai.minCoveragePercent;
  return { accepted, maxConfidence, coveragePercent, hit };
}

/** Plain-language summary of the AI rule, shown under the sliders. */
export function describeAiRule(ai: AiTriggerSettings, cooldownMin: number): string {
  const seconds = Math.round(ai.consecutiveFrames * ai.captureIntervalSec);
  const coverage = ai.minCoveragePercent > 0 ? ` with at least ${ai.minCoveragePercent}% pad dirtiness` : '';
  return (
    `Cleans when ${ai.minDetections} or more droppings${coverage} are seen at ${ai.minConfidencePercent}%+ confidence ` +
    `in ${ai.consecutiveFrames} snapshot${ai.consecutiveFrames === 1 ? '' : 's'} in a row (about ${seconds}s), ` +
    `at most once every ${cooldownMin} min.`
  );
}

// ---- Shared safety gate for every automatic trigger ----

export interface AutoGateInput {
  settings: AutomationSettings;
  now: number;
  emergencyStopped: boolean;
  cleaning: boolean;
  binFull: boolean;
  lastAutoTriggerAt: number | null;
  linkReady: boolean;
}

export type GateResult = { ok: true } | { ok: false; reason: string };

export function canAutoTrigger(input: AutoGateInput): GateResult {
  const { settings, now } = input;
  if (settings.mode !== 'automatic') return { ok: false, reason: 'Automatic mode is off' };
  if (!input.linkReady) return { ok: false, reason: 'No link to the device' };
  if (input.emergencyStopped) return { ok: false, reason: 'Emergency stop is engaged' };
  if (input.cleaning) return { ok: false, reason: 'A cycle is already running' };
  if (settings.sensors.pauseWhenBinFull && input.binFull) return { ok: false, reason: 'Waste bin is full' };
  if (input.lastAutoTriggerAt !== null) {
    const waitMs = settings.cooldownMin * 60_000 - (now - input.lastAutoTriggerAt);
    if (waitMs > 0) return { ok: false, reason: `Cooling down (${Math.ceil(waitMs / 60_000)} min left)` };
  }
  return { ok: true };
}
