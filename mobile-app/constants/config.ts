// ============================================================
// AgriSweep — Application Configuration
// ============================================================

export const APP_CONFIG = {
  name: 'AgriSweep',
  version: '1.0.0',
  subtitle: 'Intelligent Cage Waste Management',
  description:
    'Mobile monitoring and control interface for an automated poultry-cage waste collection and cleaning system.',

  // Default communication settings
  connectionTimeoutMs: 5000,
  commandTimeoutMs: 10000,
  maxRetries: 3,

  // Firebase Realtime Database (live hardware mode)
  firebaseStreamWatchdogMs: 45000, // RTDB sends keep-alives every ~30s
  firebasePollIntervalMs: 3000, // fallback when SSE streaming is unavailable
  firebaseMaxBackoffMs: 30000,

  // Default sensor settings
  // The ESP32 firmware maps the MQ-135 ADC reading to an estimated 0–100 PPM scale.
  mq135GaugeMaxPpm: 100,
  defaultMQ135WarningThreshold: 20, // ppm
  defaultMQ135CriticalThreshold: 50, // ppm
  defaultMQ135RefreshInterval: 5000, // ms

  defaultUltrasonicRefreshInterval: 5000, // ms
  defaultUltrasonicTimeout: 30, // ms
  defaultUltrasonicReferenceDistance: 50, // cm
  defaultUltrasonicWarningDistance: 15, // cm
  defaultUltrasonicCriticalDistance: 5, // cm

  // Default cleaning settings
  defaultScraperSpeedPercent: 70,
  minScraperSpeedPercent: 30, // below this the worm-gear motor tends to stall
  defaultMaxScraperRuntime: 30000, // ms — must exceed the longest stroke at the slowest speed you use
  defaultPumpDuration: 5000, // ms

  // Estimated end-to-end belt travel time, used to animate the scraper carriage
  liveScraperTravelMs: 5000, // ms — one stroke at 100 % speed (animation only)

  // Data retention
  maxHistoryEntries: 500,
  maxEventLogEntries: 1000,
  maxSensorDataPoints: 360, // 1 hour at 10s intervals

  // AsyncStorage keys
  storageKeys: {
    settings: '@agrisweep_settings',
    deviceConfig: '@agrisweep_device_config',
    sensorThresholds: '@agrisweep_sensor_thresholds',
    cleaningSettings: '@agrisweep_cleaning_settings',
    notificationPrefs: '@agrisweep_notification_prefs',
    theme: '@agrisweep_theme',
    history: '@agrisweep_history',
    firebaseConfig: '@agrisweep_firebase_config',
    liveCleaningHistory: '@agrisweep_live_cleaning_history',
    automation: '@agrisweep_automation',
    detectorConfig: '@agrisweep_detector_config',
  },
} as const;

// Matches the "AgriSweep Wiring Map" sheet (ESP32-WROOM DevKit).
export const HARDWARE_COMPONENTS = [
  {
    id: 'esp32',
    name: 'ESP32-WROOM DevKit',
    pins: 'VIN ← 5 V · 3V3 → BTS7960 VCC',
    description:
      'Main controller. Reads the sensors, times every scraper stroke, drives the motor driver and pump relay, shows status on the LCD and talks to the app through Firebase Realtime Database.',
    icon: 'Cpu',
  },
  {
    id: 'bts7960',
    name: 'BTS7960 (IBT-2) Motor Driver',
    pins: 'RPWM 25 · LPWM 26 · R_EN 27 · L_EN 14',
    description:
      'H-bridge for the scraper motor. PWM on RPWM drives toward the bin, PWM on LPWM drives back home; the duty cycle is the speed set in the app. Powered from the 12 V block.',
    icon: 'Zap',
  },
  {
    id: 'motor',
    name: '12 V Worm-Gear Motor + GT2 Belt',
    pins: 'M+ / M− on the BTS7960',
    description:
      'Pulls the scraper along the GT2 belt to push droppings into the bin. There are no end switches: distance is set by run time from the measured travel rate. Swap M+ and M− if it runs the wrong way.',
    icon: 'Settings',
  },
  {
    id: 'pump',
    name: 'Relay + 12 V Water Pump',
    pins: 'Relay IN 23 · COM ← 12 V · NO → pump +',
    description:
      'Relay switches 12 V to the pump for rinsing after a sweep or on demand. Active HIGH: the pump runs while GPIO23 is HIGH.',
    icon: 'Droplets',
  },
  {
    id: 'hcsr04',
    name: 'HC-SR04 Ultrasonic',
    pins: 'TRIG 32 · ECHO 33 via 1k/2k divider',
    description:
      'Looks down into the waste bin and measures how full it is. The divider keeps the 5 V echo pulse safe for the ESP32.',
    icon: 'Radar',
  },
  {
    id: 'mq135',
    name: 'MQ-135 Gas Sensor',
    pins: 'AO 34 via 10k/20k divider',
    description:
      'Gas response used as an ammonia estimate. Needs a few minutes of warm-up; values are estimates until calibrated.',
    icon: 'Wind',
  },
  {
    id: 'lcd',
    name: '16×2 I²C LCD',
    pins: 'SDA 21 · SCL 22 · 0x27 / 0x3F',
    description: 'On-device status display so the system can be checked without the phone.',
    icon: 'Monitor',
  },
  {
    id: 'power',
    name: '12 V 5 A Supply + Buck to 5 V',
    pins: 'Fuse 5 A → E-stop switch → 12 V block',
    description:
      'Hardware E-stop switch cuts all 12 V. The buck converter (set to 5.0 V first) feeds the ESP32, LCD, relay and sensors. All grounds join at one block.',
    icon: 'Plug',
  },
  {
    id: 'camera',
    name: 'Camera Phone',
    pins: 'Wi-Fi · Camera Station screen',
    description:
      'An Android phone mounted over the cage runs the AI droppings detector, the cleaning schedule and the sensor triggers.',
    icon: 'Camera',
  },
] as const;

export interface WiringRow {
  from: string;
  to: string;
  note?: string;
}

export interface WiringGroup {
  title: string;
  rows: WiringRow[];
}

export const WIRING_MAP: WiringGroup[] = [
  {
    title: 'BTS7960 motor driver',
    rows: [
      { from: 'RPWM', to: 'GPIO25', note: 'Forward speed (PWM)' },
      { from: 'LPWM', to: 'GPIO26', note: 'Reverse speed (PWM)' },
      { from: 'R_EN', to: 'GPIO27', note: 'Enable' },
      { from: 'L_EN', to: 'GPIO14', note: 'Enable' },
      { from: 'VCC', to: '3V3', note: 'Logic supply' },
      { from: 'B+ / B−', to: '12 V / GND', note: 'Thick wire' },
      { from: 'R_IS / L_IS', to: '—', note: 'Not connected' },
    ],
  },
  {
    title: 'Relay and pump',
    rows: [
      { from: 'Relay IN', to: 'GPIO23', note: 'Active HIGH' },
      { from: 'Relay VCC', to: '5 V' },
      { from: 'Relay COM', to: '12 V', note: 'Thick wire' },
      { from: 'Relay NO', to: 'Pump +' },
      { from: 'Pump −', to: 'GND' },
    ],
  },
  {
    title: 'HC-SR04 ultrasonic',
    rows: [
      { from: 'TRIG', to: 'GPIO32' },
      { from: 'ECHO', to: '1 kΩ → GPIO33', note: '2 kΩ GPIO33 → GND' },
      { from: 'VCC', to: '5 V' },
    ],
  },
  {
    title: 'MQ-135 gas sensor',
    rows: [
      { from: 'AO', to: '10 kΩ → GPIO34', note: '20 kΩ GPIO34 → GND' },
      { from: 'VCC', to: '5 V', note: 'Heater' },
      { from: 'DO', to: '—', note: 'Not used' },
    ],
  },
  {
    title: 'I²C LCD 16×2',
    rows: [
      { from: 'SDA', to: 'GPIO21' },
      { from: 'SCL', to: 'GPIO22' },
      { from: 'VCC', to: '5 V', note: 'Address 0x27 or 0x3F' },
    ],
  },
  {
    title: 'Power',
    rows: [
      { from: 'Adapter +', to: 'Fuse 5 A → E-stop', note: 'E-stop cuts all 12 V' },
      { from: 'Buck OUT+', to: '5 V block', note: 'Set to 5.0 V first' },
      { from: 'ESP32 VIN', to: '5 V block' },
      { from: 'All GND', to: 'One GND block' },
    ],
  },
];
