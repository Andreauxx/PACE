// ============================================================
// AgriSweep — Device Type Definitions
// ============================================================

export type ConnectionStatus = 'online' | 'connecting' | 'offline' | 'error' | 'demo';

export type OperatingMode = 'automatic' | 'manual';

export type ScraperDirection = 'forward' | 'reverse' | 'stopped';

export type CleaningCycleStage =
  | 'idle'
  | 'starting'
  | 'scraper_forward'
  | 'scraper_pause'
  | 'scraper_reverse'
  | 'pump_active'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'emergency_stopped';

export type CommandStatus = 'pending' | 'acknowledged' | 'rejected' | 'timeout';

export interface LimitSwitchState {
  forward: boolean;
  reverse: boolean;
}

export interface ScraperState {
  running: boolean;
  direction: ScraperDirection;
  stage: CleaningCycleStage;
  limitSwitches: LimitSwitchState;
  lastCommand: string | null;
  lastCommandTime: number | null;
  fault: string | null;
  runtimeMs: number;
  maxRuntimeMs: number;
}

export interface PumpState {
  active: boolean;
  lastActivationTime: number | null;
  configuredRuntimeMs: number;
  runtimeMs: number;
  fault: string | null;
}

export interface DeviceInfo {
  name: string;
  deviceId: string;
  firmwareVersion: string | null;
  ipAddress: string | null;
  macAddress: string | null;
}

export interface DeviceStatus {
  connectionStatus: ConnectionStatus;
  operatingMode: OperatingMode;
  lastCommunicationTime: number | null;
  lastCleaningCycleTime: number | null;
  scraper: ScraperState;
  pump: PumpState;
  deviceInfo: DeviceInfo;
  uptime: number | null;
}

export interface DeviceCommand {
  type:
    | 'start_cleaning'
    | 'stop_cleaning'
    | 'scraper_forward'
    | 'scraper_reverse'
    | 'scraper_stop'
    | 'pump_on'
    | 'pump_off'
    | 'emergency_stop'
    | 'set_mode'
    | 'update_config';
  payload?: Record<string, unknown>;
  timestamp: number;
  status: CommandStatus;
  id: string;
}

export interface PendingCommand {
  command: DeviceCommand;
  sentAt: number;
  timeoutMs: number;
}
