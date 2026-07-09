#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// ==========================================
// CONFIGURATION
// ==========================================
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define API_KEY "YOUR_FIREBASE_API_KEY"
#define DATABASE_URL "YOUR_FIREBASE_DATABASE_URL"

// ==========================================
// PIN DEFINITIONS
// ==========================================
#define MQ135_PIN 34         // Analog pin for Ammonia sensor
#define TRIG_PIN 5           // HC-SR04 Trigger (Digital out)
#define ECHO_PIN 18          // HC-SR04 Echo (Digital in)

#define MOTOR_RPWM 26        // BTS7960 Right PWM
#define MOTOR_LPWM 27        // BTS7960 Left PWM
#define MOTOR_EN 14          // BTS7960 Enable (L_EN and R_EN tied together)

// ==========================================
// FIREBASE GLOBALS
// ==========================================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ==========================================
// SYSTEM STATE & TIMERS
// ==========================================
unsigned long sendDataPrevMillis = 0;
const long sendDataInterval = 5000; // Send sensor data every 5 seconds

float ammoniaPPM = 0.0;
float binCapacityPercent = 0.0;
bool isCleaning = false;

// Function Prototypes
void readSensors();
void handleMotorScrapeCycle();

void setup() {
  Serial.begin(115200);

  // Initialize Pins
  pinMode(MQ135_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  pinMode(MOTOR_RPWM, OUTPUT);
  pinMode(MOTOR_LPWM, OUTPUT);
  pinMode(MOTOR_EN, OUTPUT);
  
  // Ensure motor is off at startup
  digitalWrite(MOTOR_RPWM, LOW);
  digitalWrite(MOTOR_LPWM, LOW);
  digitalWrite(MOTOR_EN, HIGH); // Enable the motor driver IC

  // 1. Connect to WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi connected. IP Address: ");
  Serial.println(WiFi.localIP());

  // 2. Configure Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Sign in anonymously for simple access (Ensure Firebase Realtime DB rules allow read/write)
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth Successful");
  } else {
    Serial.printf("Firebase Error: %s\n", config.signer.signupError.message.c_str());
  }

  // Assign the callback function for the long running token generation task
  config.token_status_callback = tokenStatusCallback; 

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Initialize Firebase System State
  Firebase.RTDB.setString(&fbdo, "/system/status", "Idle");
  Firebase.RTDB.setBool(&fbdo, "/system/manualCleanTrigger", false);
}

void loop() {
  // Task 1: Read Sensors and Push to Firebase periodically
  if (Firebase.ready() && (millis() - sendDataPrevMillis > sendDataInterval || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();
    
    readSensors();
    
    // Push updated sensor data to Firebase
    Firebase.RTDB.setFloat(&fbdo, "/system/ammoniaLevel", ammoniaPPM);
    Firebase.RTDB.setFloat(&fbdo, "/system/binCapacity", binCapacityPercent);
  }

  // Task 2: Listen for the "Manual Clean" Trigger from the React Native App
  if (Firebase.ready() && !isCleaning) {
    // Read the boolean trigger value
    if (Firebase.RTDB.getBool(&fbdo, "/system/manualCleanTrigger")) {
      bool triggerValue = fbdo.boolData();
      
      if (triggerValue == true) {
        Serial.println(">>> Manual Clean Triggered via Mobile App! <<<");
        isCleaning = true;
        
        // Update Firebase status so the UI knows the system is active
        Firebase.RTDB.setString(&fbdo, "/system/status", "Cleaning");
        
        // Execute the heavy-duty scraping action
        handleMotorScrapeCycle();
        
        // Reset the trigger and state back to Idle
        Firebase.RTDB.setBool(&fbdo, "/system/manualCleanTrigger", false);
        Firebase.RTDB.setString(&fbdo, "/system/status", "Idle");
        
        isCleaning = false;
        Serial.println("Cleaning Cycle Complete. System returned to Idle state.");
      }
    }
  }
  
  delay(100); // Small loop delay for system stability
}

void readSensors() {
  // ---------------------------------------------------------
  // 1. Read Ammonia Levels via MQ-135 (Analog)
  // ---------------------------------------------------------
  int analogValue = analogRead(MQ135_PIN);
  // Note: For a true project defense, implement a load resistor calibration curve (Ro/Rs).
  // This linearly maps the ESP32's 12-bit ADC (0-4095) to an estimated PPM range (e.g., 0-100) for demo purposes.
  ammoniaPPM = map(analogValue, 0, 4095, 0, 100); 
  
  // ---------------------------------------------------------
  // 2. Read Bin Capacity via HC-SR04 (Ultrasonic)
  // ---------------------------------------------------------
  // Trigger a 10us HIGH pulse
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Read the echo duration (in microseconds)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // Timeout after 30ms
  
  // Calculate distance in cm (Speed of sound = 343m/s or 0.0343 cm/us)
  float distanceCm = duration * 0.0343 / 2.0; 
  
  // Map distance to a percentage (Calibration depends on physical bin height)
  // Example: Bin is 50cm deep (0% full), waste up to 5cm from sensor is 100% full.
  const float MAX_BIN_DEPTH_CM = 50.0;
  const float MIN_SAFE_DIST_CM = 5.0;
  
  if (distanceCm == 0 || distanceCm >= MAX_BIN_DEPTH_CM) {
    binCapacityPercent = 0.0;
  } else if (distanceCm <= MIN_SAFE_DIST_CM) {
    binCapacityPercent = 100.0;
  } else {
    binCapacityPercent = 100.0 - ((distanceCm - MIN_SAFE_DIST_CM) / (MAX_BIN_DEPTH_CM - MIN_SAFE_DIST_CM) * 100.0);
  }

  Serial.printf("Sensor Update -> Ammonia: %.2f ppm | Bin Cap: %.2f %% (Dist: %.1f cm)\n", ammoniaPPM, binCapacityPercent, distanceCm);
}

void handleMotorScrapeCycle() {
  // ---------------------------------------------------------
  // Driving the 12V 80RPM Worm Gear Motor via BTS7960
  // ESP32 3.3V logic signals are natively compatible with the BTS7960 optocoupler inputs.
  // ---------------------------------------------------------
  
  // Phase 1: Move Scraper Forward (Pushing waste)
  Serial.println("Actuator: Motor Moving Forward...");
  analogWrite(MOTOR_RPWM, 255); // Full power CW
  analogWrite(MOTOR_LPWM, 0);
  
  // WARNING: In a real physical build, use limit switches instead of blind delays.
  delay(5000); // Wait for scraper to reach the end of the belt
  
  // Phase 2: Stop and allow mechanical stress to dissipate
  Serial.println("Actuator: Braking...");
  analogWrite(MOTOR_RPWM, 0);
  analogWrite(MOTOR_LPWM, 0);
  delay(1500);
  
  // Phase 3: Move Scraper Backward (Return to start position)
  Serial.println("Actuator: Motor Moving Backward...");
  analogWrite(MOTOR_RPWM, 0);
  analogWrite(MOTOR_LPWM, 255); // Full power CCW
  
  delay(5000); // Return time
  
  // Phase 4: Final Stop
  Serial.println("Actuator: Cycle Finished. Motor Disabled.");
  analogWrite(MOTOR_RPWM, 0);
  analogWrite(MOTOR_LPWM, 0);
}
