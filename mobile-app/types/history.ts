// ============================================================
// AgriSweep — History / Event Log Type Definitions
// ============================================================

export type EventType =
  | 'device_connected'
  | 'device_disconnected'
  | 'sensor_warning'
  | 'sensor_unavailable'
  | 'cleaning_started'
  | 'cleaning_completed'
  | 'cleaning_failed'
  | 'pump_activated'
  | 'pump_deactivated'
  | 'scraper_limit_reached'
  | 'motor_timeout'
  | 'actuator_fault'
  | 'settings_changed'
  | 'emergency_stop'
  | 'system_info';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface EventLogEntry {
  id: string;
  type: EventType;
  severity: EventSeverity;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
  source: 'device' | 'app' | 'demo';
}

export type TimeRange = 'last_hour' | 'last_24h' | 'last_7d' | 'custom';

export interface HistoryFilter {
  timeRange: TimeRange;
  customStartDate?: number;
  customEndDate?: number;
  eventTypes?: EventType[];
  searchQuery?: string;
}

export interface AnalyticsSummary {
  totalCleaningCycles: number;
  averageCycleDuration: number;
  completionRate: number;
  sensorWarningCount: number;
  deviceUptime: number | null;
  dailyCycles: { date: string; count: number }[];
  weeklyCycles: { week: string; count: number }[];
}
