// ============================================================
// AgriSweep — Settings Screen (Screen 3)
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Settings as SettingsIcon,
  Wifi,
  Wind,
  Radar,
  Cog,
  Bell,
  Smartphone,
  ChevronRight,
  RotateCcw,
  Trash2,
  FlaskConical,
  Shield,
  Database,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  XCircle,
  Cpu,
  ScanEye,
  Info,
} from 'lucide-react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp, SettingsSaveResult } from '../../hooks/useAppContext';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import ScreenHeader from '../../components/ScreenHeader';
import ConnectionPill from '../../components/ConnectionPill';
import { Segmented, SwitchRow } from '../../components/FormControls';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts, Shadows, Spacing } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { DetectorConfig, FirebasePingResult } from '../../types';
import { detectorReady } from '../../services/detector';
import { CALIBRATION_RUN_MS, rateFromTest } from '../../utils/travel';
import { notify, confirmDestructive } from '../../utils/dialogs';

interface SettingRowProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  description?: string;
  danger?: boolean;
}

function SettingRow({ label, value, icon, onPress, rightElement, description, danger }: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={styles.settingRowLeft}>
        {icon && <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>{icon}</View>}
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
      </View>
      <View style={styles.settingRowRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {rightElement}
        {onPress && !rightElement && (
          <ChevronRight size={18} color={Colors.textTertiary} />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

interface NumberFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  suffix: string;
}

function NumberField({ label, value, onChangeText, placeholder, suffix }: NumberFieldProps) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numberInputWrap}>
        <TextInput
          style={styles.numberInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
    </View>
  );
}

type PingState = { status: 'idle' } | { status: 'testing' } | { status: 'done'; result: FirebasePingResult };

function describeSave(what: string, result: SettingsSaveResult): string {
  if (result.syncedToDevice) return `${what} saved and synced to the device (/system/config).`;
  if (result.error) return `${what} saved on this device, but syncing to the ESP32 failed: ${result.error}`;
  return `${what} saved.`;
}

function parseNumber(text: string): number {
  return parseFloat(text.replace(',', '.'));
}

export default function SettingsScreen() {
  const {
    firebaseConfig,
    setFirebaseConfig,
    testFirebaseConnection,
    connectionError,
    deviceStatus,
    connectionStatus,
    sensorThresholds,
    setSensorThresholds,
    cleaningSettings,
    setCleaningSettings,
    detectorConfig,
    setDetectorConfig,
    jog,
  } = useApp();
  const [measuredCm, setMeasuredCm] = useState('');

  // AI detector (stored on this phone only)
  const [detector, setDetector] = useState<DetectorConfig>(detectorConfig);
  const [showApiKey, setShowApiKey] = useState(false);
  useEffect(() => setDetector(detectorConfig), [detectorConfig]);
  const detectorDirty = JSON.stringify(detector) !== JSON.stringify(detectorConfig);

  // Firebase connection inputs
  const [dbUrl, setDbUrl] = useState(firebaseConfig.databaseUrl);
  const [authToken, setAuthToken] = useState(firebaseConfig.authToken);
  const [showToken, setShowToken] = useState(false);
  const [ping, setPing] = useState<PingState>({ status: 'idle' });

  // Threshold inputs
  const [mq135Warning, setMQ135Warning] = useState(sensorThresholds.mq135.warningThreshold.toString());
  const [mq135Critical, setMQ135Critical] = useState(sensorThresholds.mq135.criticalThreshold.toString());
  const [ultrasonicWarning, setUltrasonicWarning] = useState(sensorThresholds.ultrasonic.warningDistanceCm.toString());
  const [ultrasonicCritical, setUltrasonicCritical] = useState(sensorThresholds.ultrasonic.criticalDistanceCm.toString());
  const [scraperRuntime, setScraperRuntime] = useState((cleaningSettings.maxScraperRuntimeMs / 1000).toString());

  // Keep inputs in sync once persisted settings finish loading
  useEffect(() => {
    setDbUrl(firebaseConfig.databaseUrl);
    setAuthToken(firebaseConfig.authToken);
  }, [firebaseConfig]);

  useEffect(() => {
    setMQ135Warning(sensorThresholds.mq135.warningThreshold.toString());
    setMQ135Critical(sensorThresholds.mq135.criticalThreshold.toString());
    setUltrasonicWarning(sensorThresholds.ultrasonic.warningDistanceCm.toString());
    setUltrasonicCritical(sensorThresholds.ultrasonic.criticalDistanceCm.toString());
  }, [sensorThresholds]);

  useEffect(() => {
    setScraperRuntime((cleaningSettings.maxScraperRuntimeMs / 1000).toString());
  }, [cleaningSettings.maxScraperRuntimeMs]);

  const inputConfig = { databaseUrl: dbUrl, authToken };
  const hasUnsavedConnection =
    dbUrl.trim() !== firebaseConfig.databaseUrl || authToken.trim() !== firebaseConfig.authToken;

  const runTest = async () => {
    setPing({ status: 'testing' });
    const result = await testFirebaseConnection(inputConfig);
    setPing({ status: 'done', result });
  };

  const handleSaveConnection = async () => {
    if (!dbUrl.trim()) {
      notify('Missing URL', 'Enter your Firebase Realtime Database URL first.');
      return;
    }
    await setFirebaseConfig(inputConfig);
    await runTest();
  };

  const handleMQ135Save = async () => {
    const warning = parseNumber(mq135Warning);
    const critical = parseNumber(mq135Critical);
    if (isNaN(warning) || isNaN(critical) || warning <= 0 || critical > APP_CONFIG.mq135GaugeMaxPpm || warning >= critical) {
      notify(
        'Invalid Value',
        `Thresholds must satisfy 0 < warning < danger ≤ ${APP_CONFIG.mq135GaugeMaxPpm} PPM.`
      );
      return;
    }
    const result = await setSensorThresholds({
      ...sensorThresholds,
      mq135: { ...sensorThresholds.mq135, warningThreshold: warning, criticalThreshold: critical },
    });
    notify('Saved', describeSave('Ammonia thresholds', result));
  };

  const handleUltrasonicSave = async () => {
    const warning = parseNumber(ultrasonicWarning);
    const critical = parseNumber(ultrasonicCritical);
    const ref = sensorThresholds.ultrasonic.referenceDistanceCm;
    if (isNaN(warning) || isNaN(critical) || critical <= 0 || warning <= critical || warning >= ref) {
      notify('Invalid Value', `Distances must satisfy 0 < full < warning < ${ref} cm (bin depth).`);
      return;
    }
    const result = await setSensorThresholds({
      ...sensorThresholds,
      ultrasonic: { ...sensorThresholds.ultrasonic, warningDistanceCm: warning, criticalDistanceCm: critical },
    });
    notify('Saved', describeSave('Bin level thresholds', result));
  };

  const handleTimingSave = async () => {
    const runtime = parseNumber(scraperRuntime);
    if (isNaN(runtime) || runtime < 1 || runtime > 120) {
      notify('Invalid Value', 'The safety cut-off must be between 1 and 120 seconds.');
      return;
    }
    const result = await setCleaningSettings({
      ...cleaningSettings,
      maxScraperRuntimeMs: Math.round(runtime * 1000),
    });
    notify('Saved', describeSave('Safety cut-off', result));
  };

  const handleCalibrate = async () => {
    const cm = parseNumber(measuredCm);
    if (isNaN(cm) || cm <= 0 || cm > 500) {
      notify('Check the distance', 'Enter how many centimetres the scraper moved during the test.');
      return;
    }
    const rate = Math.round(rateFromTest(cm, CALIBRATION_RUN_MS, cleaningSettings.scraperSpeedPercent) * 100) / 100;
    const result = await setCleaningSettings({ ...cleaningSettings, travelCmPerSec: rate });
    setMeasuredCm('');
    notify('Saved', describeSave(`Travel rate ${rate} cm/s`, result));
  };

  const handleDetectorSave = async () => {
    const problem = detectorReady(detector);
    if (problem) {
      notify('Check the detector', problem);
      return;
    }
    await setDetectorConfig(detector);
    notify('Saved', 'Detector settings saved on this phone. Open the Camera Station to use them.');
  };

  const handleResetSettings = () => {
    confirmDestructive(
      'Reset All Settings',
      'This will restore all settings (including the Firebase connection) to their defaults. This action cannot be undone.',
      'Reset',
      async () => {
        try {
          await AsyncStorage.clear();
          notify('Done', 'All settings have been reset. Please restart the app.');
        } catch {}
      }
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader title="Settings" subtitle="Connection, sensors, camera and safety." right={<ConnectionPill status={connectionStatus} />} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Firebase Hardware Connection */}
        <Card title="Sweeper connection" subtitle="The ESP32 and this app meet in your Firebase Realtime Database.">
          {connectionError && (
            <View style={styles.errorBox}>
              <XCircle size={14} color={Colors.errorDark} />
              <Text style={styles.errorBoxText}>{connectionError}</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Database URL</Text>
          <TextInput
            style={styles.textInput}
            value={dbUrl}
            onChangeText={(v) => {
              setDbUrl(v);
              setPing({ status: 'idle' });
            }}
            placeholder="https://your-project-default-rtdb.firebaseio.com"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Auth token / database secret (optional)</Text>
          <View style={styles.tokenRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={authToken}
              onChangeText={(v) => {
                setAuthToken(v);
                setPing({ status: 'idle' });
              }}
              placeholder="Leave blank if rules allow public access"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showToken}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowToken((v) => !v)}>
              {showToken ? <EyeOff size={18} color={Colors.textSecondary} /> : <Eye size={18} color={Colors.textSecondary} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>Only needed if your database rules require it.</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, ping.status === 'testing' && styles.btnDisabled]}
              onPress={runTest}
              disabled={ping.status === 'testing'}
            >
              {ping.status === 'testing' ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Zap size={16} color={Colors.primary} />
              )}
              <Text style={styles.secondaryBtnText}>Test</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveConnection}>
              <Wifi size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{hasUnsavedConnection ? 'Save and connect' : 'Reconnect'}</Text>
            </TouchableOpacity>
          </View>

          {ping.status === 'done' && (
            <View style={[styles.pingResult, ping.result.ok ? styles.pingOk : styles.pingFail]}>
              {ping.result.ok ? <CheckCircle2 size={16} color={Colors.success} /> : <XCircle size={16} color={Colors.error} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.pingTitle, { color: ping.result.ok ? Colors.primaryDark : Colors.errorDark }]}>
                  {ping.result.ok ? `Reached in ${ping.result.latencyMs} ms` : 'Could not connect'}
                </Text>
                <Text style={styles.pingDetail}>
                  {ping.result.ok
                    ? ping.result.hasSystemNode
                      ? 'The sweeper has sent data. You are ready to go.'
                      : 'The database answers, but the sweeper has not sent anything yet. Power on the ESP32.'
                    : ping.result.error}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Device */}
        <Card title="Device">
          <SettingRow label="Device name" value={deviceStatus.deviceInfo.name} />
          <SettingRow label="Database" value={deviceStatus.deviceInfo.deviceId} />
          <SettingRow label="Firmware" value={deviceStatus.deviceInfo.firmwareVersion || 'Unknown'} />
          <SettingRow
            label="Last heard from"
            value={
              deviceStatus.lastCommunicationTime
                ? new Date(deviceStatus.lastCommunicationTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'No data yet'
            }
          />
        </Card>

        {/* MQ-135 Settings */}
        <Card title="Ammonia sensor" subtitle="MQ-135, estimated ppm">
          <View style={styles.fieldRow}>
            <NumberField label="Warning at" value={mq135Warning} onChangeText={setMQ135Warning} placeholder="20" suffix="ppm" />
            <NumberField label="Danger at" value={mq135Critical} onChangeText={setMQ135Critical} placeholder="50" suffix="ppm" />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.saveFull]} onPress={handleMQ135Save}>
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>
            The firmware maps the 12-bit ADC linearly to 0–100 PPM. Values are estimates until the sensor is calibrated (Rs/Ro curve).
            The warning level is also written to /system/config/ammoniaWarningThreshold.
          </Text>
        </Card>

        {/* HC-SR04 Settings */}
        <Card title="Waste bin level" subtitle="HC-SR04 above the bin">
          <SettingRow
            label="Bin Depth (reference)"
            value={`${sensorThresholds.ultrasonic.referenceDistanceCm} cm`}
            description="Clearance when the bin is empty. Matches MAX_BIN_DEPTH_CM in the firmware."
          />
          <View style={[styles.fieldRow, { marginTop: Spacing.md }]}>
            <NumberField label="Warning at ≤" value={ultrasonicWarning} onChangeText={setUltrasonicWarning} placeholder="15" suffix="cm" />
            <NumberField label="Full at ≤" value={ultrasonicCritical} onChangeText={setUltrasonicCritical} placeholder="5" suffix="cm" />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.saveFull]} onPress={handleUltrasonicSave}>
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>
        </Card>

        {/* Scraper travel */}
        <Card title="Scraper travel" subtitle="Distance is set by run time, so measure your build once.">
          <Text style={styles.calibrationRate}>{cleaningSettings.travelCmPerSec.toFixed(2)} cm/s</Text>
          <Text style={styles.helpText}>
            Travel rate at full speed. The app turns every distance into a run time with it.
          </Text>
          <Text style={styles.stepText}>1. Mark where the scraper is, then run a {CALIBRATION_RUN_MS / 1000}-second test at the current speed ({cleaningSettings.scraperSpeedPercent}%).</Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, styles.saveFull, connectionStatus !== 'online' && styles.btnDisabled]}
            onPress={() => jog('forward', 0, CALIBRATION_RUN_MS)}
            disabled={connectionStatus !== 'online'}
          >
            <Text style={styles.secondaryBtnText}>Run {CALIBRATION_RUN_MS / 1000}-second test toward the bin</Text>
          </TouchableOpacity>
          <Text style={styles.stepText}>2. Measure how far it moved and enter it.</Text>
          <View style={styles.fieldRow}>
            <NumberField label="It moved" value={measuredCm} onChangeText={setMeasuredCm} placeholder="18.5" suffix="cm" />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.saveFull]} onPress={handleCalibrate}>
            <Text style={styles.primaryBtnText}>Save travel rate</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>Measure again if you change the belt, pulley or motor, or if strokes stop short or run long.</Text>

          <View style={[styles.fieldRow, { marginTop: Spacing.lg }]}>
            <NumberField label="Safety cut-off" value={scraperRuntime} onChangeText={setScraperRuntime} placeholder="15" suffix="s" />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.saveFull]} onPress={handleTimingSave}>
            <Text style={styles.primaryBtnText}>Save cut-off</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>The motor never runs longer than this in one go, whatever distance is set.</Text>

          <SwitchRow
            label="Ask before starting"
            description="Confirm before a manual cycle or turning on the pump."
            value={cleaningSettings.requireConfirmation}
            onChange={(v) => void setCleaningSettings({ ...cleaningSettings, requireConfirmation: v })}
            last
          />
        </Card>

        {/* AI detector */}
        <Card title="Camera detector" subtitle="Used by the camera phone. Stored on this phone only.">
          <Segmented
            value={detector.provider}
            onChange={(provider) => setDetector({ ...detector, provider })}
            options={[
              { value: 'simulated', label: 'Test detector' },
              { value: 'roboflow', label: 'Roboflow model' },
            ]}
          />
          {detector.provider === 'simulated' ? (
            <Text style={styles.helpText}>
              Pretends to see droppings when you switch it on in the camera screen. Use it to try your trigger settings before a model is trained.
            </Text>
          ) : (
            <>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Model ID</Text>
              <TextInput
                style={styles.textInput}
                value={detector.modelId}
                onChangeText={(modelId) => setDetector({ ...detector, modelId })}
                placeholder="chicken-droppings/1"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>API key</Text>
              <View style={styles.tokenRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={detector.apiKey}
                  onChangeText={(apiKey) => setDetector({ ...detector, apiKey })}
                  placeholder="Roboflow private API key"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showApiKey}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowApiKey((v) => !v)}>
                  {showApiKey ? <EyeOff size={18} color={Colors.textSecondary} /> : <Eye size={18} color={Colors.textSecondary} />}
                </TouchableOpacity>
              </View>
              <View style={[styles.fieldRow, { marginTop: Spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Class name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={detector.targetClass}
                    onChangeText={(targetClass) => setDetector({ ...detector, targetClass })}
                    placeholder="poop"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Endpoint</Text>
              <TextInput
                style={styles.textInput}
                value={detector.endpoint}
                onChangeText={(endpoint) => setDetector({ ...detector, endpoint })}
                placeholder="https://detect.roboflow.com"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.helpText}>
                Train an object-detection model on photos of the cage floor, label droppings with the class name above, then paste the
                model ID (project/version) and API key here. The key never leaves this phone.
              </Text>
            </>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, styles.saveFull, !detectorDirty && styles.btnDisabled]}
            onPress={handleDetectorSave}
            disabled={!detectorDirty}
          >
            <Text style={styles.primaryBtnText}>{detectorDirty ? 'Save detector' : 'Saved'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, styles.saveFull]} onPress={() => router.push('/station')}>
            <ScanEye size={16} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Open camera screen</Text>
          </TouchableOpacity>
        </Card>

        {/* Application Settings */}
        <Card title="Application">
          <SettingRow
            label="About AgriSweep"
            description="Project, hardware and ESP32 wiring map"
            icon={<Info size={16} color={Colors.primary} />}
            onPress={() => router.push('/about')}
          />
          <SettingRow label="App version" value={APP_CONFIG.version} />
          <SettingRow
            label="Reset all settings"
            icon={<RotateCcw size={16} color={Colors.error} />}
            onPress={handleResetSettings}
            danger
          />
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(181, 52, 43, 0.3)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorBoxText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.errorDark,
    fontFamily: Fonts.bold,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: FontSize.sm,
    color: Colors.text,
    fontFamily: Fonts.regular,
  },
  tokenRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  eyeBtn: {
    width: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: 'rgba(47, 90, 69, 0.35)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveFull: {
    flex: 0,
    marginTop: Spacing.md,
  },
  pingResult: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  pingOk: {
    backgroundColor: Colors.successLight,
    borderColor: 'rgba(47, 90, 69, 0.3)',
  },
  pingFail: {
    backgroundColor: Colors.errorLight,
    borderColor: 'rgba(181, 52, 43, 0.3)',
  },
  pingTitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
  pingDetail: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  numberField: {
    flex: 1,
  },
  numberInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },
  numberInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: Colors.text,
    fontFamily: Fonts.bold,
  },
  suffix: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontFamily: Fonts.bold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    minHeight: 52,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: 'rgba(47, 90, 69, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: Colors.errorLight,
    borderColor: 'rgba(181, 52, 43, 0.25)',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  settingLabelDanger: {
    color: Colors.error,
  },
  settingDescription: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  settingRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    maxWidth: 170,
    textAlign: 'right',
    fontFamily: Fonts.regular,
  },
  calibrationRate: {
    fontFamily: Fonts.display,
    fontSize: FontSize.xxxl,
    color: Colors.ink,
  },
  stepText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.ink,
    marginTop: Spacing.md,
  },
  helpText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
    paddingVertical: Spacing.sm,
  },
  bottomPadding: {
    height: 24,
  },
});
