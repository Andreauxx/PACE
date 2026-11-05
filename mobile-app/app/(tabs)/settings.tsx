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
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp, SettingsSaveResult } from '../../hooks/useAppContext';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { ConnectionStatus, FirebasePingResult } from '../../types';
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

const connectionBadge: Record<ConnectionStatus, { label: string; variant: 'success' | 'demo' | 'warning' | 'error' | 'neutral' }> = {
  online: { label: 'Online', variant: 'success' },
  connecting: { label: 'Connecting', variant: 'warning' },
  offline: { label: 'Offline', variant: 'neutral' },
  error: { label: 'Error', variant: 'error' },
  demo: { label: 'Demo', variant: 'demo' },
};

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
    isDemoMode,
    setDemoMode,
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
  } = useApp();

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
  const [pumpDuration, setPumpDuration] = useState((cleaningSettings.pumpDurationMs / 1000).toString());

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
    setPumpDuration((cleaningSettings.pumpDurationMs / 1000).toString());
  }, [cleaningSettings.maxScraperRuntimeMs, cleaningSettings.pumpDurationMs]);

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

  const handleSelectMode = async (live: boolean) => {
    if (!live) {
      setDemoMode(true);
      return;
    }
    if (hasUnsavedConnection && dbUrl.trim()) await setFirebaseConfig(inputConfig);
    setDemoMode(false);
    if (dbUrl.trim()) await runTest();
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
    const pump = parseNumber(pumpDuration);
    if (isNaN(runtime) || runtime < 1 || runtime > 120) {
      notify('Invalid Value', 'Scraper runtime must be between 1 and 120 seconds.');
      return;
    }
    if (isNaN(pump) || pump < 1 || pump > 60) {
      notify('Invalid Value', 'Pump duration must be between 1 and 60 seconds.');
      return;
    }
    const result = await setCleaningSettings({
      ...cleaningSettings,
      maxScraperRuntimeMs: Math.round(runtime * 1000),
      pumpDurationMs: Math.round(pump * 1000),
    });
    notify('Saved', describeSave('Cycle timing', result));
  };

  const handleClearDemoData = () => {
    confirmDestructive('Clear Demo Data', 'This will reset all demo data. This action cannot be undone.', 'Clear', async () => {
      try {
        await AsyncStorage.removeItem(APP_CONFIG.storageKeys.history);
        notify('Done', 'Demo data cleared.');
      } catch {}
    });
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

  const badge = connectionBadge[connectionStatus];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.ambientGlow} />
        <View style={styles.headerTop}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <SettingsIcon size={20} color="#10B981" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.headerTitle}>System Settings</Text>
              <Text style={styles.headerSubtitle}>Hardware link, thresholds & operating limits</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Firebase Hardware Connection */}
        <Card
          title="Hardware Connection"
          subtitle="ESP32 ↔ Firebase Realtime Database"
          icon={<Database size={18} color={Colors.primary} />}
          headerRight={<StatusBadge label={badge.label} variant={badge.variant} size="sm" />}
        >
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentBtn, isDemoMode && styles.segmentBtnDemo]}
              onPress={() => handleSelectMode(false)}
              activeOpacity={0.8}
            >
              <FlaskConical size={15} color={isDemoMode ? '#FFFFFF' : Colors.textSecondary} />
              <Text style={[styles.segmentText, isDemoMode && styles.segmentTextActive]}>Demo Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, !isDemoMode && styles.segmentBtnLive]}
              onPress={() => handleSelectMode(true)}
              activeOpacity={0.8}
            >
              <Cpu size={15} color={!isDemoMode ? '#FFFFFF' : Colors.textSecondary} />
              <Text style={[styles.segmentText, !isDemoMode && styles.segmentTextActive]}>Live Hardware</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>
            {isDemoMode
              ? 'Simulated sensors and actuators. No commands reach the hardware.'
              : 'Telemetry streams live from /system. Controls write to /system/controls and /system/manualCleanTrigger.'}
          </Text>

          {!isDemoMode && connectionError && (
            <View style={styles.errorBox}>
              <XCircle size={14} color="#B91C1C" />
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
          <Text style={styles.helpText}>Sent as the ?auth= query parameter on every REST request.</Text>

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
              <Text style={styles.secondaryBtnText}>Test Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveConnection}>
              <Wifi size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{hasUnsavedConnection ? 'Save & Connect' : 'Reconnect'}</Text>
            </TouchableOpacity>
          </View>

          {ping.status === 'done' && (
            <View style={[styles.pingResult, ping.result.ok ? styles.pingOk : styles.pingFail]}>
              {ping.result.ok ? <CheckCircle2 size={16} color={Colors.success} /> : <XCircle size={16} color={Colors.error} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.pingTitle, { color: ping.result.ok ? '#047857' : '#B91C1C' }]}>
                  {ping.result.ok ? `Reachable · ${ping.result.latencyMs} ms` : 'Connection failed'}
                </Text>
                <Text style={styles.pingDetail}>
                  {ping.result.ok
                    ? ping.result.hasSystemNode
                      ? '/system node found. The ESP32 has published data.'
                      : 'Database reachable, but /system is empty. Power on the ESP32 to publish telemetry.'
                    : ping.result.error}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Device */}
        <Card title="Device" icon={<Cpu size={18} color={Colors.primary} />}>
          <SettingRow label="Device Name" value={deviceStatus.deviceInfo.name} />
          <SettingRow label={isDemoMode ? 'Device ID' : 'Database'} value={deviceStatus.deviceInfo.deviceId} />
          <SettingRow label="Firmware" value={deviceStatus.deviceInfo.firmwareVersion || 'Unknown'} />
          <SettingRow
            label="Last Communication"
            value={
              deviceStatus.lastCommunicationTime
                ? new Date(deviceStatus.lastCommunicationTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : isDemoMode
                ? 'Simulated'
                : 'No data yet'
            }
          />
        </Card>

        {/* MQ-135 Settings */}
        <Card title="Ammonia Gas Sensor" subtitle="MQ-135 · estimated PPM" icon={<Wind size={18} color={Colors.primary} />}>
          <View style={styles.fieldRow}>
            <NumberField label="Warning at" value={mq135Warning} onChangeText={setMQ135Warning} placeholder="20" suffix="ppm" />
            <NumberField label="Danger at" value={mq135Critical} onChangeText={setMQ135Critical} placeholder="50" suffix="ppm" />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.saveFull]} onPress={handleMQ135Save}>
            <Text style={styles.primaryBtnText}>Save Thresholds</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>
            The firmware maps the 12-bit ADC linearly to 0–100 PPM. Values are estimates until the sensor is calibrated (Rs/Ro curve).
            The warning level is also written to /system/config/ammoniaWarningThreshold.
          </Text>
        </Card>

        {/* HC-SR04 Settings */}
        <Card title="Waste Bin Level" subtitle="HC-SR04 ultrasonic" icon={<Radar size={18} color={Colors.primary} />}>
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
            <Text style={styles.primaryBtnText}>Save Thresholds</Text>
          </TouchableOpacity>
        </Card>

        {/* Cleaning Settings */}
        <Card title="Cleaning System" icon={<Cog size={18} color={Colors.primary} />}>
          <SettingRow
            label="Operating Mode"
            value={cleaningSettings.mode.charAt(0).toUpperCase() + cleaningSettings.mode.slice(1)}
            description="Automatic mode requires ESP32 firmware support. The mobile app does not initiate automatic cycles independently."
          />
          <SettingRow
            label="Require Confirmation"
            description="Ask before starting a cycle or turning on the pump."
            rightElement={
              <Switch
                value={cleaningSettings.requireConfirmation}
                onValueChange={(v) => {
                  void setCleaningSettings({ ...cleaningSettings, requireConfirmation: v });
                }}
                trackColor={{ false: Colors.disabled, true: Colors.accentLight }}
                thumbColor={cleaningSettings.requireConfirmation ? Colors.primary : '#f4f3f4'}
              />
            }
          />
          <SettingRow
            label="Limit Switch Monitoring"
            rightElement={
              <Switch
                value={cleaningSettings.limitSwitchMonitoring}
                onValueChange={(v) => {
                  void setCleaningSettings({ ...cleaningSettings, limitSwitchMonitoring: v });
                }}
                trackColor={{ false: Colors.disabled, true: Colors.accentLight }}
                thumbColor={cleaningSettings.limitSwitchMonitoring ? Colors.primary : '#f4f3f4'}
              />
            }
          />

          <View style={[styles.fieldRow, { marginTop: Spacing.md }]}>
            <NumberField label="Max scraper runtime" value={scraperRuntime} onChangeText={setScraperRuntime} placeholder="15" suffix="s" />
            <NumberField label="Pump duration" value={pumpDuration} onChangeText={setPumpDuration} placeholder="5" suffix="s" />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.saveFull]} onPress={handleTimingSave}>
            <Text style={styles.primaryBtnText}>Save Cycle Timing</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>Written to /system/config/maxScraperRuntimeMs and pumpDurationMs in live mode.</Text>

          <SettingRow
            label="Cooldown Between Cycles"
            value={`${cleaningSettings.cooldownMs / 1000}s`}
          />
          <SettingRow
            label="Emergency Stop"
            icon={<Shield size={16} color={Colors.error} />}
            rightElement={
              <Switch
                value={cleaningSettings.emergencyStopEnabled}
                onValueChange={(v) => {
                  void setCleaningSettings({ ...cleaningSettings, emergencyStopEnabled: v });
                }}
                trackColor={{ false: Colors.disabled, true: Colors.errorLight }}
                thumbColor={cleaningSettings.emergencyStopEnabled ? Colors.error : '#f4f3f4'}
              />
            }
            description="When enabled, the emergency stop button is visible on the Dashboard."
          />
        </Card>

        {/* Notification Preferences */}
        <Card title="Notifications" icon={<Bell size={18} color={Colors.primary} />}>
          <Text style={styles.helpText}>
            In-app notifications are displayed within AgriSweep. Push notifications require additional backend setup.
          </Text>
          <SettingRow label="Elevated Gas Reading" rightElement={<Switch value={true} disabled trackColor={{ false: Colors.disabled, true: Colors.accentLight }} thumbColor={Colors.primary} />} />
          <SettingRow label="Accumulation Threshold" rightElement={<Switch value={true} disabled trackColor={{ false: Colors.disabled, true: Colors.accentLight }} thumbColor={Colors.primary} />} />
          <SettingRow label="Cleaning Completed" rightElement={<Switch value={true} disabled trackColor={{ false: Colors.disabled, true: Colors.accentLight }} thumbColor={Colors.primary} />} />
          <SettingRow label="Cleaning Failed" rightElement={<Switch value={true} disabled trackColor={{ false: Colors.disabled, true: Colors.accentLight }} thumbColor={Colors.primary} />} />
          <SettingRow label="Device Disconnected" rightElement={<Switch value={true} disabled trackColor={{ false: Colors.disabled, true: Colors.accentLight }} thumbColor={Colors.primary} />} />
        </Card>

        {/* Application Settings */}
        <Card title="Application" icon={<Smartphone size={18} color={Colors.primary} />}>
          <SettingRow label="App Version" value={APP_CONFIG.version} />
          <SettingRow
            label="Clear Demo Data"
            icon={<Trash2 size={16} color={Colors.error} />}
            onPress={handleClearDemoData}
            danger
          />
          <SettingRow
            label="Reset All Settings"
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
  header: {
    backgroundColor: '#064E3B',
    paddingHorizontal: Spacing.xl,
    paddingTop: 54,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.md,
  },
  ambientGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.70)',
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnDemo: {
    backgroundColor: Colors.demo,
    ...Shadows.sm,
  },
  segmentBtnLive: {
    backgroundColor: Colors.primary,
    ...Shadows.glow,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorBoxText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#B91C1C',
    fontWeight: FontWeight.semibold,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
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
    fontWeight: FontWeight.medium,
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
    fontWeight: FontWeight.bold,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pingFail: {
    backgroundColor: Colors.errorLight,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  pingTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  pingDetail: {
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
    fontWeight: FontWeight.bold,
  },
  suffix: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semibold,
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
    borderColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: Colors.errorLight,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  settingLabelDanger: {
    color: '#DC2626',
  },
  settingDescription: {
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
    fontWeight: FontWeight.medium,
  },
  helpText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
    paddingVertical: Spacing.sm,
  },
  bottomPadding: {
    height: 24,
  },
});
