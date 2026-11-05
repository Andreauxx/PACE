// ============================================================
// AgriSweep — Cleaning Statistics Helpers
// Derives dashboard stats and analytics from recorded cycles
// (used in live mode, where there is no pre-baked demo data).
// ============================================================

import { AnalyticsSummary, CleaningCycle, CleaningStats, EventLogEntry } from '../types';

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function localDateKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeCleaningStats(history: CleaningCycle[], now: number = Date.now()): CleaningStats {
  const finished = history.filter((c) => c.status !== 'in_progress');
  const completed = finished.filter((c) => c.status === 'completed');
  const durations = finished.map((c) => c.duration ?? 0).filter((d) => d > 0);
  const today = finished.filter((c) => isSameLocalDay(c.startTime, now));

  return {
    totalCycles: finished.length,
    completedCycles: completed.length,
    failedCycles: finished.length - completed.length,
    averageDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    completionRate: finished.length ? completed.length / finished.length : 0,
    cyclesToday: today.length,
    totalCleaningTimeToday: today.reduce((sum, c) => sum + (c.duration ?? 0), 0),
    lastCleaningResult: finished[0]?.status ?? null,
  };
}

export function computeAnalytics(
  history: CleaningCycle[],
  events: EventLogEntry[],
  now: number = Date.now()
): AnalyticsSummary {
  const stats = computeCleaningStats(history, now);
  const dailyCycles: AnalyticsSummary['dailyCycles'] = [];
  for (let d = 6; d >= 0; d--) {
    const key = localDateKey(now - d * 86400000);
    dailyCycles.push({ date: key, count: history.filter((c) => localDateKey(c.startTime) === key).length });
  }

  return {
    totalCleaningCycles: stats.totalCycles,
    averageCycleDuration: stats.averageDurationMs,
    completionRate: stats.completionRate,
    sensorWarningCount: events.filter((e) => e.type === 'sensor_warning').length,
    deviceUptime: null,
    dailyCycles,
    weeklyCycles: [],
  };
}
