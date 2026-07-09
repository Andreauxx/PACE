# Automated Chicken Manure Collection System — Mobile App

Expo + React Native (TypeScript) companion app for the ESP32-based
collection system. Dark "instrumentation panel" UI: a radial gauge for
ammonia (MQ-135) and a silo-style fill indicator for bin capacity
(HC-SR04), backed by Firebase Realtime Database.

## 1. Install

```bash
npx create-expo-app ChickenManureApp -t expo-template-blank-typescript
cd ChickenManureApp

# Copy in App.tsx, firebaseConfig.ts, types.ts, theme.ts, and screens/*

npx expo install firebase
npx expo install @react-navigation/native @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npx expo install react-native-gesture-handler
npx expo install @expo/vector-icons
npx expo install react-native-svg
npx expo install @react-native-community/slider

npx expo start
```

Scan the QR code with Expo Go on your phone.

Fill in your real project values in `firebaseConfig.ts` (Firebase
Console → Project Settings → General → Your apps → Web app). Make sure
`databaseURL` points at your **Realtime Database**, not Firestore.

## 2. Firebase Realtime Database structure

Set these Rules → Data tabs up (or seed with the JSON below via the
Console's "Import JSON" on the root node):

```json
{
  "system": {
    "ammonia_ppm": 12.4,
    "bin_capacity_percent": 63,
    "status": "idle",
    "manual_override": false,
    "last_ping": 1751871234000
  },
  "logs": {
    "-Nabc123example1": {
      "timestamp": 1751871234000,
      "type": "manual_clean",
      "message": "Manual Clean Triggered from mobile app"
    },
    "-Nabc123example2": {
      "timestamp": 1751867634000,
      "type": "ammonia_warning",
      "message": "Ammonia reached 22.3 ppm"
    },
    "-Nabc123example3": {
      "timestamp": 1751864034000,
      "type": "auto_clean",
      "message": "Auto Clean completed — bin capacity reached 90%"
    }
  },
  "settings": {
    "ammonia_warning_threshold": 20,
    "ammonia_danger_threshold": 30,
    "auto_clean_enabled": true
  }
}
```

### Node reference

| Path | Written by | Read by | Notes |
|---|---|---|---|
| `system/ammonia_ppm` | ESP32 (MQ-135) | Home | float, ppm |
| `system/bin_capacity_percent` | ESP32 (HC-SR04) | Home | 0–100 |
| `system/status` | ESP32 | Home | `"idle" \| "cleaning"` |
| `system/manual_override` | App | ESP32 | app sets `true`, ESP32 clears it back to `false` once the motor cycle finishes |
| `system/last_ping` | ESP32 heartbeat | Settings | ESP32 should write `Date.now()`-equivalent (millis since epoch) every 5–10s |
| `logs/{pushId}` | ESP32 or App | History | one entry per event (`auto_clean`, `manual_clean`, `ammonia_warning`, `ammonia_danger`, `system`) |
| `settings/ammonia_warning_threshold` | App | ESP32 + Home | ppm value that turns the gauge amber |
| `settings/ammonia_danger_threshold` | App | ESP32 + Home | ppm value that turns the gauge crimson and should trigger `ammonia_danger` logs |
| `settings/auto_clean_enabled` | App | ESP32 | ESP32 should poll/listen and skip automatic cycles when `false` |

### Suggested Realtime Database rules (tighten before your actual defense/demo)

```json
{
  "rules": {
    "system": { ".read": true, ".write": true },
    "logs": { ".read": true, ".write": true },
    "settings": { ".read": true, ".write": true }
  }
}
```

## 3. ESP32 firmware responsibilities (for your write-up)

- Publish `system/ammonia_ppm` and `system/bin_capacity_percent` on a
  short interval (e.g. every 2s).
- Publish `system/last_ping` on every loop/heartbeat so the app can
  compute online/offline in `SettingsScreen.tsx`.
- Watch `system/manual_override`: when `true`, drive the BTS7960 motor
  driver, then set `status` to `"cleaning"` → `"idle"` and clear
  `manual_override` back to `false` when done.
- Push a `logs/{pushId}` entry for every automatic cycle, manual
  trigger it detects, and ammonia threshold crossing (comparing its
  live reading against `settings/ammonia_warning_threshold` /
  `ammonia_danger_threshold`).

## 4. File overview

```
App.tsx                 Bottom tab navigator + dark theme wiring
firebaseConfig.ts        Firebase v9 modular SDK init (fill in your keys)
theme.ts                 Color / spacing / typography tokens
types.ts                 Shared TypeScript types for the DB shape
screens/HomeScreen.tsx    Ammonia gauge, capacity silo, status, override button
screens/HistoryScreen.tsx FlatList of /logs, newest first
screens/SettingsScreen.tsx Threshold sliders, auto-clean toggle, ESP32 status
```
