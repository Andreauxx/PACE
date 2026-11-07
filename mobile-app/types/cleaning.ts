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

export interface CleaningSettings {
  /** Scraper motor PWM duty, 0–100 %. Applies to cycles and jog. */
  scraperSpeedPercent: number;
  /** How far one cleaning stroke travels toward the bin (and back). */
  strokeDistanceCm: number;
  /** How far one press of a jog button moves the scraper. */
  jogDistanceCm: number;
  /** Measured travel rate at 100 % speed; converts distance into run time. */
  travelCmPerSec: number;
  /** Backup cut-off: the motor never runs longer than this in one go. */
  maxScraperRuntimeMs: number;
  pumpDurationMs: number;
  /** Run the water pump automatically after each sweep. */
  rinseAfterSweep: boolean;
  requireConfirmation: boolean;
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
