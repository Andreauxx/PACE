// AgriSweep ESP32 controller — uses the app's Firebase structure under /system
// Board: ESP32 Dev Module (Arduino-ESP32 core 2.x or 3.x)
// Library needed: ArduinoJson (by Benoit Blanchon, v7) — Library Manager
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <time.h>

// ================= EDIT THESE =================
const char *WIFI_SSID = "Huawei PURA 80";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char *DB_URL = "https://"
                     "pace-6c54c-default-rtdb.asia-southeast1.firebasedatabase."
                     "app"; // no trailing slash

#define USE_LCD 1
#define USE_HCSR04 1 // 1 = enabled (TRIG=32, ECHO=33 via 1k/2k divider)
#define USE_MQ135 1  // 1 = enabled (AO=34 via 10k/20k divider)
#define USE_PUMP 1   // Set to 1 once 12V pump relay is connected to GPIO23

const bool BIN_IS_FORWARD =
    true; // flip if the blade moves AWAY from the bin on a sweep
// ==============================================

// Pins (motor PWM swapped because the motor wiring is reversed)
const int PIN_RPWM = 26, PIN_LPWM = 25, PIN_R_EN = 27, PIN_L_EN = 14;
const int PIN_RELAY = 23; // active-LOW relay
const int PIN_TRIG = 32, PIN_ECHO = 33, PIN_MQ = 34;

// Timing
const uint32_t POLL_MS = 2000, BEAT_MS = 10000, ESTOP_POLL_MS = 500;
const uint32_t SPRAY_PRE_MS = 3000; // 3 seconds water spray before sweep
const uint32_t SOAK_WAIT_MS =
    5000;                       // 5 seconds wait to let water soften droppings
const uint32_t PAUSE_MS = 1500; // 1.5 seconds pause at bin to drop waste
const uint32_t RETURN_EXTRA_MS = 500;
const long TZ_OFFSET_S = 8 * 3600; // Philippines, for schedule slots

// Settings from /system/config and /system/automation (defaults until first
// read)
struct Config {
  int speedPct = 70;
  uint32_t strokeMs = 22600;
  float jogCm = 10;
  float cmPerSec = 5.3;
  uint32_t maxRunMs = 35000;
  uint32_t pumpMs = 5000;
  bool rinse = false;
} cfg;
String mode = "manual";
int cooldownMin = 30;
bool schedOn = false;
uint64_t lastAutoAt = 0;
String lastSchedKey = "";

// State
enum Stage {
  ST_IDLE,
  ST_SPRAY,  // 1. Water spray before sweep
  ST_SOAK,   // 2. Soak wait (5s) to soften droppings
  ST_SWEEP,  // 3. Sweeping forward to bin
  ST_PAUSE,  // 4. Pausing at bin to drop waste
  ST_RETURN, // 5. Returning home
  ST_JOG,
  ST_FAULT,
  ST_ESTOP
};
enum Dir { D_STOP, D_FWD, D_REV };
Stage stage = ST_IDLE;
Dir motorDir = D_STOP;
int curPwm = 0;
uint32_t phaseStart = 0, phaseLen = 0, cycleStart = 0;
String faultMsg = "", curSource = "";
bool pumpOn = false;
uint32_t pumpStart = 0, pumpLen = 0;
bool pendingRinse = false;
uint32_t lastPoll = 0, lastBeat = 0, lastEstopPoll = 0;
bool dirty = true; // status needs to be written

#if USE_LCD
LiquidCrystal_I2C *lcd = nullptr;
#endif

// ---------- helpers ----------
uint64_t nowMs() {
  time_t t = time(nullptr);
  return t > 1700000000 ? (uint64_t)t * 1000ULL : 0;
}
Dir binDir() { return BIN_IS_FORWARD ? D_FWD : D_REV; }
Dir homeDir() { return BIN_IS_FORWARD ? D_REV : D_FWD; }
int speedPwm() { return constrain(map(cfg.speedPct, 0, 100, 0, 255), 60, 255); }

const char *statusText() {
  switch (stage) {
  case ST_IDLE:
    return "Idle";
  case ST_SPRAY:
    return "Pre-wetting";
  case ST_SOAK:
    return "Soaking";
  case ST_SWEEP:
  case ST_PAUSE:
    return "Cleaning";
  case ST_RETURN:
    return "Returning";
  case ST_JOG:
    return "Jogging";
  case ST_FAULT:
    return "Fault";
  default:
    return "Emergency stop";
  }
}
const char *stageText() {
  switch (stage) {
  case ST_IDLE:
    return "idle";
  case ST_SPRAY:
    return "pump_active";
  case ST_SOAK:
    return "starting";
  case ST_SWEEP:
    return "scraper_forward";
  case ST_PAUSE:
    return "scraper_pause";
  case ST_RETURN:
    return "scraper_reverse";
  case ST_JOG:
    return "scraper_forward";
  case ST_FAULT:
    return "failed";
  default:
    return "emergency_stopped";
  }
}
const char *dirText() {
  return motorDir == D_STOP ? "stopped"
                            : (motorDir == binDir() ? "forward" : "reverse");
}

// ---------- PWM ----------
void pwmSetup() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_RPWM, 20000, 8);
  ledcAttach(PIN_LPWM, 20000, 8);
#else
  ledcSetup(0, 20000, 8);
  ledcAttachPin(PIN_RPWM, 0);
  ledcSetup(1, 20000, 8);
  ledcAttachPin(PIN_LPWM, 1);
#endif
}
void wR(int d) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_RPWM, d);
#else
  ledcWrite(0, d);
#endif
}
void wL(int d) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_LPWM, d);
#else
  ledcWrite(1, d);
#endif
}

// ---------- motor ----------
void motorOff() {
  wR(0);
  wL(0);
  digitalWrite(PIN_R_EN, LOW);
  digitalWrite(PIN_L_EN, LOW);
  motorDir = D_STOP;
  curPwm = 0;
}
void motorRun(Dir d, int pwm) {
  if (motorDir != D_STOP && motorDir != d) {
    motorOff();
    delay(300);
  }
  digitalWrite(PIN_R_EN, HIGH);
  digitalWrite(PIN_L_EN, HIGH);
  for (int p = curPwm; p < pwm; p += 10) {
    if (d == D_FWD)
      wR(p);
    else
      wL(p);
    delay(10);
  }
  if (d == D_FWD) {
    wL(0);
    wR(pwm);
  } else {
    wR(0);
    wL(pwm);
  }
  motorDir = d;
  curPwm = pwm;
}

// ---------- pump (active-LOW: release pin = OFF) ----------
void pumpSet(bool on, uint32_t ms = 0) {
  if (on) {
    pinMode(PIN_RELAY, OUTPUT);
    digitalWrite(PIN_RELAY, LOW);
    pumpStart = millis();
    pumpLen = min(ms, (uint32_t)15000);
  } else {
    pinMode(PIN_RELAY, INPUT);
  }
  pumpOn = on;
  dirty = true;
  Serial.println(on ? "PUMP ON" : "PUMP OFF");
}

// ---------- Firebase REST (one reused TLS connection) ----------
WiFiClientSecure tls;
HTTPClient http;
bool db(const char *method, const String &path, const String &body,
        String *out) {
  if (WiFi.status() != WL_CONNECTED)
    return false;
  http.setReuse(true);
  http.setTimeout(3000);
  if (!http.begin(tls, String(DB_URL) + path + ".json"))
    return false;
  http.addHeader("Content-Type", "application/json");
  int code = http.sendRequest(method, body);
  bool ok = code >= 200 && code < 300;
  if (ok && out)
    *out = http.getString();
  if (!ok)
    Serial.printf("DB %s %s -> %d\n", method, path.c_str(), code);
  http.end();
  return ok;
}

void writeStatus(const char *extraJson = nullptr) {
  JsonDocument d;
  d["status"] = statusText();
  d["lastUpdated"] = nowMs();
  JsonObject s = d["scraper"].to<JsonObject>();
  s["running"] = (motorDir != D_STOP) || stage == ST_PAUSE ||
                 stage == ST_SPRAY || stage == ST_SOAK;
  s["direction"] = dirText();
  s["stage"] = stageText();
  if (faultMsg.length())
    s["fault"] = faultMsg;
  else
    s["fault"] = nullptr;
  JsonObject p = d["pump"].to<JsonObject>();
  p["active"] = pumpOn;
  p["runtimeMs"] = pumpOn ? millis() - pumpStart : 0;
  p["fault"] = nullptr;
#if USE_HCSR04
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  long us = pulseIn(PIN_ECHO, HIGH, 30000);
  if (us > 0) {
    float dist = round(us * 0.0343f / 2.0f * 10) / 10.0;
    d["distanceCm"] = dist;
    float cap = 0;
    if (dist <= 5.0f) cap = 100.0f;
    else if (dist >= 50.0f) cap = 0.0f;
    else cap = 100.0f - ((dist - 5.0f) / (50.0f - 5.0f) * 100.0f);
    float capRounded = round(cap * 10) / 10.0f;
    d["binCapacity"] = capRounded;
    d["bin_capacity_percent"] = capRounded;
  }
#endif
#if USE_MQ135
  int raw = analogRead(PIN_MQ);
  d["ammoniaRaw"] = raw;
  // Convert 12-bit ADC (0-4095) to estimated PPM (0-100 ppm scale)
  float ppm = round(((raw / 4095.0f) * 100.0f) * 10) / 10.0f;
  d["ammoniaLevel"] = ppm;
  d["ammonia_ppm"] = ppm;
#endif
  String b;
  serializeJson(d, b);
  if (extraJson) {
    b.remove(b.length() - 1);
    b += ",";
    b += extraJson;
    b += "}";
  }
  db("PATCH", "/system", b, nullptr);
  lastBeat = millis();
  dirty = false;
}

// ---------- cycle ----------
void beginPhase(Stage s, Dir d, uint32_t len) {
  stage = s;
  phaseStart = millis();
  phaseLen = len;
  if (d == D_STOP)
    motorOff();
  else
    motorRun(d, speedPwm());
  Serial.printf("-> %s (%lu ms)\n", stageText(), (unsigned long)len);
  dirty = true;
}
void startCycle(const String &source) {
  curSource = source;
  faultMsg = "";
  cycleStart = millis();
  writeStatus("\"manualCleanTrigger\":false"); // acknowledge: app sees
                                               // scraper.running = true
  if (USE_PUMP) {
    pumpSet(true, SPRAY_PRE_MS);
    beginPhase(ST_SPRAY, D_STOP, SPRAY_PRE_MS);
  } else {
    beginPhase(ST_SWEEP, binDir(), cfg.strokeMs);
  }
}
void finishCycle() {
  motorOff();
  stage = ST_IDLE;
  uint32_t dur = millis() - cycleStart;
  Serial.printf("CYCLE DONE (%lu ms)\n", (unsigned long)dur);
  char extra[48];
  snprintf(extra, sizeof extra, "\"lastCleaningCycleTime\":%llu",
           (unsigned long long)nowMs());
  writeStatus(extra);
  JsonDocument h;
  h["source"] = curSource;
  h["result"] = "ok";
  h["durationMs"] = dur;
  h["finishedAt"] = nowMs();
  String b;
  serializeJson(h, b);
  db("POST", "/system/history", b, nullptr);
  if (cfg.rinse)
    pumpSet(true, cfg.pumpMs);
}
void enterFault(const char *why) {
  motorOff();
  pumpSet(false);
  faultMsg = why;
  stage = ST_FAULT;
  Serial.printf("FAULT: %s\n", why);
  writeStatus();
}

// ---------- read /system and act (only while the motor is stopped) ----------
void handleSystem(JsonDocument &d) {
  JsonObject c = d["config"];
  if (!c.isNull()) {
    cfg.speedPct = c["scraperSpeedPercent"] | cfg.speedPct;
    cfg.strokeMs = c["strokeTimeMs"] | cfg.strokeMs;
    cfg.jogCm = c["jogDistanceCm"] | cfg.jogCm;
    cfg.cmPerSec = c["travelCmPerSec"] | cfg.cmPerSec;
    cfg.maxRunMs = c["maxScraperRuntimeMs"] | cfg.maxRunMs;
    cfg.pumpMs = c["pumpDurationMs"] | cfg.pumpMs;
    cfg.rinse = c["rinseAfterSweep"] | cfg.rinse;
  }
  JsonObject a = d["automation"];
  mode = String((const char *)(a["mode"] | "manual"));
  cooldownMin = a["cooldownMin"] | cooldownMin;
  schedOn = a["schedule"]["enabled"] | false;
  lastAutoAt = d["automationState"]["lastAutoTriggerAt"] | (uint64_t)0;
  lastSchedKey =
      String((const char *)(d["automationState"]["lastScheduleKey"] | ""));

  JsonObject ctl = d["controls"];
  bool estop = ctl["emergencyStop"] | false;

  // Emergency stop (also the way to clear a FAULT: press STOP, then release it)
  if (estop) {
    if (stage != ST_ESTOP) {
      motorOff();
      pumpSet(false);
      stage = ST_ESTOP;
      faultMsg = "";
      dirty = true;
      Serial.println("EMERGENCY STOP");
    }
    if (d["manualCleanTrigger"] | false)
      db("PATCH", "/system", "{\"manualCleanTrigger\":false}", nullptr);
    return;
  }
  if (stage == ST_ESTOP) {
    stage = ST_IDLE;
    dirty = true;
    Serial.println("E-stop released");
  }
  if (stage == ST_FAULT)
    return;

  // Pump button
  if (ctl["manualPumpTrigger"] | false) {
    pumpSet(true, cfg.pumpMs);
    db("PATCH", "/system/controls", "{\"manualPumpTrigger\":false}", nullptr);
  }

  // Jog: the app writes { direction, distanceCm, durationMs, at } or a plain
  // string
  JsonVariant jogVal = ctl["jog"];
  const char *jogDir = nullptr;
  uint32_t jogMs = 0;
  if (jogVal.is<JsonObject>()) {
    jogDir = jogVal["direction"] | (const char *)nullptr;
    jogMs = jogVal["durationMs"] | (uint32_t)0;
  } else if (jogVal.is<const char *>()) {
    jogDir = jogVal.as<const char *>();
  }
  if (jogDir && stage == ST_IDLE) {
    String j = String(jogDir);
    j.toLowerCase();
    Dir d2 = (j.startsWith("for") || j == "right") ? binDir() : homeDir();
    if (!jogMs)
      jogMs =
          cfg.cmPerSec > 0 ? (uint32_t)(cfg.jogCm / cfg.cmPerSec * 1000) : 1500;
    db("PATCH", "/system/controls", "{\"jog\":null}", nullptr);
    beginPhase(ST_JOG, d2, min(jogMs, (uint32_t)5000));
    writeStatus();
    return;
  }

  // Clean trigger (from the app button or the AI page)
  if ((d["manualCleanTrigger"] | false) && stage == ST_IDLE) {
    const char *src = d["lastTrigger"]["source"] | "manual";
    startCycle(src);
    return;
  }

  // Schedule (runs on the ESP32 itself)
  if (schedOn && mode != "manual" && stage == ST_IDLE && nowMs()) {
    time_t t = time(nullptr) + TZ_OFFSET_S;
    struct tm lt;
    gmtime_r(&t, &lt);
    char hhmm[6];
    snprintf(hhmm, sizeof hhmm, "%02d:%02d", lt.tm_hour, lt.tm_min);
    bool dayOk = false;
    for (JsonVariant v : a["schedule"]["daysOfWeek"].as<JsonArray>())
      if (v.as<int>() == lt.tm_wday)
        dayOk = true;
    if (dayOk) {
      for (JsonObject s : a["schedule"]["slots"].as<JsonArray>()) {
        if (!(s["enabled"] | false) ||
            String((const char *)(s["time"] | "")) != hhmm)
          continue;
        char key[48];
        snprintf(key, sizeof key, "%04d-%02d-%02d-%s", lt.tm_year + 1900,
                 lt.tm_mon + 1, lt.tm_mday, (const char *)(s["id"] | "slot"));
        if (lastSchedKey == key)
          continue;
        if (nowMs() - lastAutoAt < (uint64_t)cooldownMin * 60000ULL) {
          Serial.println("Schedule skipped: cooldown");
          continue;
        }
        String b = String("{\"automationState/lastScheduleKey\":\"") + key +
                   "\",\"automationState/lastAutoTriggerAt\":" +
                   String((unsigned long long)nowMs()) +
                   ",\"lastTrigger\":{\"source\":\"schedule\",\"at\":" +
                   String((unsigned long long)nowMs()) + ",\"detail\":\"" +
                   hhmm + "\"}}";
        db("PATCH", "/system", b, nullptr);
        startCycle("schedule");
        return;
      }
    }
  }
}

void pollSystem() {
  String r;
  if (!db("GET", "/system", "", &r))
    return;
  JsonDocument d;
  if (deserializeJson(d, r)) {
    Serial.println("JSON parse error");
    return;
  }
  handleSystem(d);
}

// Only this runs while the motor is moving: a tiny read of the stop flag
void pollEstopWhileMoving() {
  String r;
  if (db("GET", "/system/controls/emergencyStop", "", &r) &&
      r.startsWith("true")) {
    motorOff();
    pumpSet(false);
    stage = ST_ESTOP;
    Serial.println("EMERGENCY STOP (while moving)");
    writeStatus();
  }
}

// ---------- LCD ----------
void lcdUpdate() {
#if USE_LCD
  if (!lcd)
    return;
  static uint32_t last = 0;
  if (millis() - last < 500)
    return;
  last = millis();
  String a =
      String(statusText()) + (pumpOn ? " PUMP" : "") + "                ";
  String b =
      stage == ST_FAULT
          ? faultMsg
          : String(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "No WiFi");
  b += "                ";
  lcd->setCursor(0, 0);
  lcd->print(a.substring(0, 16));
  lcd->setCursor(0, 1);
  lcd->print(b.substring(0, 16));
#endif
}

// ---------- Wi-Fi ----------
void wifiConnect() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) {
    delay(300);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK " + WiFi.localIP().toString());
    configTime(0, 0, "pool.ntp.org", "time.google.com");
  } else
    Serial.println(" FAILED (will retry)");
}

// ---------- Serial (bench testing) ----------
void handleSerial() {
  if (!Serial.available())
    return;
  String s = Serial.readStringUntil('\n');
  s.trim();
  s.toUpperCase();
  if (s == "GO") {
    if (stage == ST_IDLE)
      startCycle("serial");
  } else if (s == "S") {
    motorOff();
    pumpSet(false);
    stage = ST_IDLE;
    faultMsg = "";
    dirty = true;
  } else if (s == "RESET") {
    if (stage == ST_FAULT) {
      stage = ST_IDLE;
      faultMsg = "";
      dirty = true;
    }
  } else if (s == "P")
    pumpSet(true, cfg.pumpMs);
  else if (s == "TEST") {
    Serial.println("\n--- SENSOR HARDWARE TEST ---");
#if USE_HCSR04
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);
    long us = pulseIn(PIN_ECHO, HIGH, 30000);
    if (us > 0) {
      float dist = round(us * 0.0343f / 2.0f * 10) / 10.0;
      float cap = (dist <= 5.0f) ? 100.0f : ((dist >= 50.0f) ? 0.0f : 100.0f - ((dist - 5.0f) / 45.0f * 100.0f));
      Serial.printf("[OK] HC-SR04 Distance: %.1f cm (Bin Full: %.1f%%) | Echo: %ld us\n", dist, cap, us);
    } else {
      Serial.println("[FAIL] HC-SR04: No echo! Check 5V, GND, TRIG (GPIO32), and ECHO (GPIO33 via divider).");
    }
#else
    Serial.println("[OFF] USE_HCSR04 is set to 0");
#endif
#if USE_MQ135
    int raw = analogRead(PIN_MQ);
    float ppm = (raw / 4095.0f) * 100.0f;
    Serial.printf("[OK] MQ-135 Raw ADC: %d / 4095 | Est Ammonia: %.1f ppm\n", raw, ppm);
    if (raw < 50) Serial.println("  -> Note: Reading is near 0. If it stays 0, check 5V heater power and AO wiring.");
#else
    Serial.println("[OFF] USE_MQ135 is set to 0");
#endif
    Serial.println("----------------------------\n");
  } else if (s.startsWith("F ") || s.startsWith("R ")) {
    if (stage != ST_IDLE)
      return;
    stage = ST_JOG;
    phaseStart = millis();
    phaseLen = 3000;
    motorRun(s[0] == 'F' ? D_FWD : D_REV,
             constrain(s.substring(2).toInt(), 0, 255));
  } else
    Serial.println("Commands: GO | S | TEST | P | F 180 | R 180 | RESET");
}

// ---------- setup / loop ----------
void setup() {
  pinMode(PIN_RELAY, INPUT); // pump OFF at boot
  pinMode(PIN_R_EN, OUTPUT);
  pinMode(PIN_L_EN, OUTPUT);
  digitalWrite(PIN_R_EN, LOW);
  digitalWrite(PIN_L_EN, LOW);
  pwmSetup();
  motorOff();
  Serial.begin(115200);
#if USE_HCSR04
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
#endif
#if USE_LCD
  Wire.begin(21, 22);
  for (uint8_t addr : {0x27, 0x3F}) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      lcd = new LiquidCrystal_I2C(addr, 16, 2);
      lcd->init();
      lcd->backlight();
      break;
    }
  }
#endif
  tls.setInsecure();
  wifiConnect();
  for (int i = 0; i < 20 && !nowMs(); i++)
    delay(250); // wait for clock
  // Safety: a clean request left over from before boot is cleared, never run
  db("PATCH", "/system", "{\"manualCleanTrigger\":false}", nullptr);
  writeStatus();
  Serial.println("Ready. Type HELP for commands.");
}

void loop() {
  handleSerial();

  // pump auto-off
  if (pumpOn && millis() - pumpStart >= pumpLen)
    pumpSet(false);

  // motion state machine
  if (stage == ST_SPRAY || stage == ST_SOAK || stage == ST_SWEEP ||
      stage == ST_RETURN || stage == ST_JOG || stage == ST_PAUSE) {
    uint32_t el = millis() - phaseStart;
    if (millis() - cycleStart > cfg.maxRunMs * 2 + 15000 && stage != ST_JOG)
      enterFault("runtime limit");
    else if (stage != ST_PAUSE && stage != ST_SPRAY && stage != ST_SOAK &&
             stage != ST_JOG && el > cfg.maxRunMs)
      enterFault("phase timeout");
    else if (el >= phaseLen) {
      if (stage == ST_SPRAY) {
        pumpSet(false);
        beginPhase(ST_SOAK, D_STOP, SOAK_WAIT_MS);
      } else if (stage == ST_SOAK) {
        beginPhase(ST_SWEEP, binDir(), cfg.strokeMs);
      } else if (stage == ST_SWEEP) {
        beginPhase(ST_PAUSE, D_STOP, PAUSE_MS);
      } else if (stage == ST_PAUSE) {
        beginPhase(ST_RETURN, homeDir(), cfg.strokeMs + RETURN_EXTRA_MS);
      } else if (stage == ST_RETURN) {
        finishCycle();
      } else {
        motorOff();
        stage = ST_IDLE;
        dirty = true;
      } // jog done
    }
    if (motorDir != D_STOP && millis() - lastEstopPoll >= ESTOP_POLL_MS) {
      lastEstopPoll = millis();
      pollEstopWhileMoving();
    }
  }

  // network (full read only while the motor is stopped)
  if (WiFi.status() != WL_CONNECTED) {
    static uint32_t lastTry = 0;
    if (motorDir == D_STOP && millis() - lastTry > 20000) {
      lastTry = millis();
      wifiConnect();
    }
  } else if (motorDir == D_STOP) {
    if (millis() - lastPoll >= POLL_MS) {
      lastPoll = millis();
      pollSystem();
    }
    if (dirty || millis() - lastBeat >= BEAT_MS)
      writeStatus();
  }
  lcdUpdate();
}
