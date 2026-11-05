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
  defaultMaxScraperRuntime: 15000, // ms
  defaultPumpDuration: 5000, // ms
  defaultMotorTimeout: 20000, // ms
  defaultCooldown: 30000, // ms

  // Estimated end-to-end belt travel time, used to animate the scraper carriage
  demoScraperTravelMs: 4000, // ms
  liveScraperTravelMs: 5000, // ms — matches the firmware's forward/return delay

  // Data retention
  maxHistoryEntries: 500,
  maxEventLogEntries: 1000,
  maxSensorDataPoints: 360, // 1 hour at 10s intervals

  // AsyncStorage keys
  storageKeys: {
    settings: '@agrisweep_settings',
    demoMode: '@agrisweep_demo_mode',
    deviceConfig: '@agrisweep_device_config',
    sensorThresholds: '@agrisweep_sensor_thresholds',
    cleaningSettings: '@agrisweep_cleaning_settings',
    notificationPrefs: '@agrisweep_notification_prefs',
    theme: '@agrisweep_theme',
    history: '@agrisweep_history',
    firebaseConfig: '@agrisweep_firebase_config',
    liveCleaningHistory: '@agrisweep_live_cleaning_history',
  },
} as const;

export const HARDWARE_COMPONENTS = [
  {
    id: 'esp32',
    name: 'ESP32 Microcontroller',
    description:
      'Central controller and WiFi communication interface. Reads sensors, drives actuators, and communicates with the mobile application via Firebase Realtime Database.',
    icon: 'Cpu',
  },
  {
    id: 'mq135',
    name: 'MQ-135 Gas Sensor',
    description:
      'Provides a gas-response measurement associated with air quality in the poultry environment. Outputs an analog voltage proportional to detected gas concentrations. Raw ADC values require calibration for specific gas identification.',
    icon: 'Wind',
  },
  {
    id: 'hcsr04',
    name: 'HC-SR04 Ultrasonic Sensor',
    description:
      'Measures distance to a surface using ultrasonic pulses. When mounted appropriately, can indicate accumulation levels by comparing current distance with a configured reference.',
    icon: 'Radar',
  },
  {
    id: 'bts7960',
    name: 'BTS7960 Motor Driver',
    description:
      'High-current H-bridge motor driver that controls the direction and speed of the DC scraper motor. Supports forward and reverse operation via separate PWM inputs.',
    icon: 'Zap',
  },
  {
    id: 'motor',
    name: '12V 80RPM DC Worm-Gear Motor',
    description:
      'Drives the mechanical scraper along the GT2 belt. The worm-gear design provides high torque for moving accumulated waste toward the collection area.',
    icon: 'Settings',
  },
  {
    id: 'scraper',
    name: 'GT2 Belt-Driven Linear Scraper',
    description:
      'A mechanical scraper assembly that travels along a GT2 timing belt to sweep accumulated waste toward the collection point. End positions are detected by limit switches.',
    icon: 'ArrowRightLeft',
  },
  {
    id: 'limits',
    name: 'Limit Switches',
    description:
      'Mechanical switches positioned at the end-travel points of the scraper. They signal the controller to stop the motor when the scraper reaches either extreme, preventing mechanical damage.',
    icon: 'ToggleRight',
  },
  {
    id: 'pump',
    name: 'DC Water Pump',
    description:
      'Supplies cleaning water when the cleaning function is enabled. Activated after the scraper cycle completes to wash the cage surface. Controlled independently from the scraper motor.',
    icon: 'Droplets',
  },
  {
    id: 'app',
    name: 'AgriSweep Mobile Application',
    description:
      'React Native mobile interface providing real-time monitoring, manual controls, historical analytics, and configurable settings for the cleaning system.',
    icon: 'Smartphone',
  },
] as const;
