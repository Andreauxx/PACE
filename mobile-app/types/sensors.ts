// ============================================================
// AgriSweep — Sensor Type Definitions
// ============================================================

export type SensorStatus = 'normal' | 'elevated' | 'warning' | 'critical' | 'unavailable';

export type MQ135DisplayMode = 'raw_adc' | 'calibrated';

export type UltrasonicMountPosition = 'above' | 'below';

export interface SensorReading {
  value: number;
  timestamp: number;
  unit: string;
}

export interface MQ135Reading extends SensorReading {
  rawAdc: number;
  calibratedValue: number | null;
  displayMode: MQ135DisplayMode;
  status: SensorStatus;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
}

export interface UltrasonicReading extends SensorReading {
  distanceCm: number;
  accumulationPercent: number | null;
  mountPosition: UltrasonicMountPosition;
  referenceDistanceCm: number;
  status: SensorStatus;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
}

export interface SensorThresholds {
  mq135: {
    warningThreshold: number;
    criticalThreshold: number;
    displayMode: MQ135DisplayMode;
    refreshIntervalMs: number;
  };
  ultrasonic: {
    mountPosition: UltrasonicMountPosition;
    referenceDistanceCm: number;
    warningDistanceCm: number;
    criticalDistanceCm: number;
    refreshIntervalMs: number;
    timeoutMs: number;
  };
}

export interface SensorDataPoint {
  value: number;
  timestamp: number;
}

export interface SensorHistory {
  mq135: SensorDataPoint[];
  ultrasonic: SensorDataPoint[];
}
