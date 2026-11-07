# AgriSweep — Automated Poultry Cage Cleaning

AgriSweep is a mobile app for a belt-driven scraper that clears chicken droppings from under a cage. An ESP32 drives the scraper motor and water pump. The app controls it through Firebase Realtime Database, and a second phone acts as an AI camera that starts a cleaning cycle when it sees droppings.

This repository holds the **mobile app** (`mobile-app/`) and the **Firebase data layout** (`firebase_db_structure.json`). The ESP32 firmware is not in this repository. It must read and write the paths listed under [Firebase paths](#firebase-paths).

## App screens

| Tab | What it does |
|---|---|
| **Home** | Connection, ammonia gauge, bin level, live scraper animation, automation summary, quick E-stop |
| **Controls** | Start/stop sweeper, **scraper speed** (30–100 %), **stroke distance** in cm, move by hand a set distance (2–20 cm), **water pump** with spray duration, rinse after sweep, emergency stop |
| **Automation** | Manual / Automatic mode, **AI droppings trigger sensitivity**, **cleaning schedule** (times + days), ammonia trigger, pause when bin is full |
| **History** | Charts, cleaning cycles, event log, CSV export |
| **Settings** | Firebase connection, sensor thresholds, scraper travel calibration and safety cut-off, AI detector setup, About & wiring map |

**Camera Station** (opened from Automation or Settings) is a full-screen mode for a phone mounted over the cage. It:

1. takes a snapshot every few seconds and runs the droppings detector,
2. starts a cycle when the AI rule is met (confidence, number of droppings, floor coverage, snapshots in a row),
3. runs the cleaning schedule and the ammonia trigger,
4. reports its status to `/system/vision` so other phones can see it is watching.

Every automatic start is blocked while the emergency stop is engaged, while a cycle is already running, during the cooldown between automatic cycles, and (optionally) while the bin is full.

### AI detector

- **Simulated:** works with no model. A "Simulate droppings" switch lets you test the trigger rules.
- **Roboflow model:** train an object-detection model on photos of the cage floor and label droppings with one class (default `poop`). Then put the model ID (`project/version`) and API key in Settings → AI Droppings Detector. The key is stored only on the camera phone.

## Wiring (ESP32-WROOM DevKit)

| Part | Pin | ESP32 |
|---|---|---|
| BTS7960 | RPWM (toward bin) | GPIO25 |
| BTS7960 | LPWM (toward home) | GPIO26 |
| BTS7960 | R_EN / L_EN | GPIO27 / GPIO14 |
| BTS7960 | VCC | 3V3 |
| Pump relay | IN (active HIGH) | GPIO23 |
| HC-SR04 | TRIG | GPIO32 |
| HC-SR04 | ECHO via 1 kΩ, 2 kΩ to GND | GPIO33 |
| MQ-135 | AO via 10 kΩ, 20 kΩ to GND | GPIO34 |
| I²C LCD 16×2 | SDA / SCL | GPIO21 / GPIO22 |

Power: 12 V 5 A adapter → 5 A fuse → E-stop switch → 12 V block (BTS7960 B+, buck input, relay COM). The buck converter is set to 5.0 V **before** connecting anything and feeds ESP32 VIN, the LCD, the relay and the sensors. All grounds join at one block. The full table is in the app under Settings → About AgriSweep.

## Stroke distance without end switches

There are no limit switches, so the scraper's distance is controlled by time:
**run time = distance ÷ (travel rate × speed)**. Measure the travel rate once in
Settings → Scraper travel: run the 5-second test, measure how far the scraper
moved and enter it. Re-measure after changing the belt, pulley or motor. Each
cycle starts from home, so start with the scraper at the home end.

## Firebase paths

Everything lives under `/system`. See `firebase_db_structure.json` for a complete example.

| Path | Written by | Meaning |
|---|---|---|
| `status`, `ammoniaLevel`, `ammoniaRaw`, `distanceCm`, `binCapacity`, `lastUpdated` | ESP32 | Telemetry |
| `scraper/*`, `pump/*` | ESP32 | Running, direction, stage, faults |
| `manualCleanTrigger` | App → ESP32 | `true` = start one cycle; ESP32 sets it back to `false` |
| `lastTrigger` | App | `{ source: manual \| schedule \| ai \| sensor, at, detail }` |
| `controls/jog` | App → ESP32 | `{ direction: forward \| reverse, distanceCm, durationMs, at }`. Run the motor that way for `durationMs`, then set `jog` to `null`. `null` from the app = stop. |
| `controls/manualPumpTrigger` | App → ESP32 | Pump on for `pumpDurationMs` |
| `controls/emergencyStop` | App → ESP32 | Stop everything until released |
| `config/scraperSpeedPercent` | App → ESP32 | PWM duty 0–100 % for cycles and jog |
| `config/strokeDistanceCm`, `config/strokeTimeMs` | App → ESP32 | How far one cycle sweeps, and the matching run time at the current speed. Run forward for `strokeTimeMs`, then back for the same time. |
| `config/travelCmPerSec`, `config/jogDistanceCm` | App → ESP32 | Measured travel rate at 100 % speed, and the move-by-hand step |
| `config/maxScraperRuntimeMs` | App → ESP32 | Safety cut-off: never run the motor longer than this in one go |
| `config/pumpDurationMs`, `config/rinseAfterSweep` | App → ESP32 | Pump timing |
| `automation/*` | App | Mode, schedule, AI and sensor trigger rules |
| `automationState/*` | Camera station | Last automatic start and last schedule slot run |
| `vision/*` | Camera station | Heartbeat and latest detection result |

## Running the app

```bash
cd mobile-app
npm install
npm start
```

Scan the QR code with Expo Go, or press `w` for the web preview. Run `npx tsc --noEmit` to type-check.
The app starts in **Demo Mode**. Switch to **Live Hardware** in Settings and enter your Realtime Database URL to connect to the ESP32.
