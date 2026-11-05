// ============================================================
// AgriSweep — Cleaning Type Definitions
// ============================================================

export type CleaningStatus = 'completed' | 'interrupted' | 'failed' | 'in_progress';
export type CleaningMode = 'automatic' | 'manual';

export interface CleaningCycle {
  id: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  mode: CleaningMode;
  scraperActivated: boolean;
  pumpActivated: boolean;
  status: CleaningStatus;
  errorReason: string | null;
  stages: CleaningStageRecord[];
}

export interface CleaningStageRecord {
  stage: string;
  startTime: number;
  endTime: number | null;
  status: 'completed' | 'failed' | 'skipped';
}

export interface CleaningSchedule {
  enabled: boolean;
  intervalHours: number;
  startTime: string; // HH:mm
  daysOfWeek: number[]; // 0=Sun, 6=Sat
}

export interface CleaningSettings {
  mode: CleaningMode;
  schedule: CleaningSchedule;
  maxScraperRuntimeMs: number;
  pumpDurationMs: number;
  motorTimeoutMs: number;
  cooldownMs: number;
  limitSwitchMonitoring: boolean;
  requireConfirmation: boolean;
  emergencyStopEnabled: boolean;
}

export interface CleaningStats {
  totalCycles: number;
  completedCycles: number;
  failedCycles: number;
  averageDurationMs: number;
  completionRate: number;
  cyclesToday: number;
  totalCleaningTimeToday: number;
  lastCleaningResult: CleaningStatus | null;
}
