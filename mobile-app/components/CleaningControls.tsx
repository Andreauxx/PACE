// ============================================================
// AgriSweep — Modern Cleaning Controls Component
// ============================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Play,
  Square,
  ArrowRight,
  ArrowLeft,
  Droplets,
  DropletOff,
  Sliders,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { ConnectionStatus, CleaningCycleStage } from '../types';
import ConfirmDialog from './ConfirmDialog';
import EmergencyStopButton from './EmergencyStopButton';

interface CleaningControlsProps {
  connectionStatus: ConnectionStatus;
  isDemoMode: boolean;
  scraperRunning: boolean;
  scraperStage: CleaningCycleStage;
  pumpActive: boolean;
  requireConfirmation: boolean;
  commandError: string | null;
  onStartCleaning: () => void;
  onStopCleaning: () => void;
  onScraperForward: () => void;
  onScraperReverse: () => void;
  onScraperStop: () => void;
  onPumpOn: () => void;
  onPumpOff: () => void;
  onEmergencyStop: () => void;
  onResetEmergencyStop: () => void;
}

interface ControlButtonProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  small?: boolean;
}

type PendingAction = 'start' | 'pump' | 'release' | null;

function ControlButton({ label, icon, onPress, variant = 'secondary', disabled, small }: ControlButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <TouchableOpacity
      style={[
        styles.controlBtn,
        isPrimary && styles.btnPrimary,
        isDanger && styles.btnDanger,
        small && styles.controlBtnSmall,
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      {icon}
      <Text
        style={[
          styles.controlLabel,
          (isPrimary || isDanger) && styles.labelInverse,
          small && styles.controlLabelSmall,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CleaningControls({
  connectionStatus,
  isDemoMode,
  scraperRunning,
  scraperStage,
  pumpActive,
  requireConfirmation,
  commandError,
  onStartCleaning,
  onStopCleaning,
  onScraperForward,
  onScraperReverse,
  onScraperStop,
  onPumpOn,
  onPumpOff,
  onEmergencyStop,
  onResetEmergencyStop,
}: CleaningControlsProps) {
  const [pending, setPending] = useState<PendingAction>(null);

  const canCommand = connectionStatus === 'online' || connectionStatus === 'demo';
  const isEStopped = scraperStage === 'emergency_stopped';
  const isDisabled = !canCommand || isEStopped;
  const isRunning =
    scraperRunning ||
    (scraperStage !== 'idle' && scraperStage !== 'completed' && scraperStage !== 'emergency_stopped');
  const jogDisabled = isDisabled || isRunning;

  const withConfirmation = (action: Exclude<PendingAction, null>, run: () => void) => {
    if (requireConfirmation || action === 'release') setPending(action);
    else run();
  };

  const confirmPending = () => {
    if (pending === 'start') onStartCleaning();
    if (pending === 'pump') onPumpOn();
    if (pending === 'release') onResetEmergencyStop();
    setPending(null);
  };

  const iconColor = (disabled: boolean, color: string) => (disabled ? Colors.textTertiary : color);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconBox}>
            <Sliders size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Manual Controls</Text>
            <Text style={styles.sectionSubtitle}>
              {isDemoMode ? 'Simulated actuators' : 'Writes to Firebase /system/controls'}
            </Text>
          </View>
        </View>

        {isDemoMode && (
          <View style={styles.demoBadge}>
            <Text style={styles.demoText}>SIMULATED</Text>
          </View>
        )}
      </View>

      {/* Primary cycle control */}
      <View style={styles.primaryRow}>
        {!isRunning ? (
          <ControlButton
            label="START CLEANING CYCLE"
            icon={<Play size={18} color={isDisabled ? Colors.textTertiary : '#FFFFFF'} fill={isDisabled ? Colors.textTertiary : '#FFFFFF'} />}
            onPress={() => withConfirmation('start', onStartCleaning)}
            variant="primary"
            disabled={isDisabled}
          />
        ) : (
          <ControlButton
            label="STOP CLEANING CYCLE"
            icon={<Square size={18} color="#FFFFFF" fill="#FFFFFF" />}
            onPress={onStopCleaning}
            variant="danger"
            disabled={!canCommand}
          />
        )}
      </View>

      <View style={styles.controlsSection}>
        <Text style={styles.groupLabel}>Scraper Motor Jog</Text>
        <View style={styles.buttonRow}>
          <ControlButton
            label="Reverse"
            icon={<ArrowLeft size={15} color={iconColor(jogDisabled, Colors.info)} />}
            onPress={onScraperReverse}
            disabled={jogDisabled}
            small
          />
          <ControlButton
            label="Stop"
            icon={<Square size={15} color={iconColor(isDisabled, Colors.text)} />}
            onPress={onScraperStop}
            disabled={isDisabled}
            small
          />
          <ControlButton
            label="Forward"
            icon={<ArrowRight size={15} color={iconColor(jogDisabled, Colors.primary)} />}
            onPress={onScraperForward}
            disabled={jogDisabled}
            small
          />
        </View>

        <Text style={styles.groupLabel}>Water Spray Pump</Text>
        <View style={styles.buttonRow}>
          <ControlButton
            label="Pump ON"
            icon={<Droplets size={15} color={iconColor(isDisabled || pumpActive, Colors.info)} />}
            onPress={() => withConfirmation('pump', onPumpOn)}
            disabled={isDisabled || pumpActive}
            small
          />
          <ControlButton
            label="Pump OFF"
            icon={<DropletOff size={15} color={iconColor(isDisabled || !pumpActive, Colors.textSecondary)} />}
            onPress={onPumpOff}
            disabled={isDisabled || !pumpActive}
            small
          />
        </View>
      </View>

      <EmergencyStopButton
        engaged={isEStopped}
        onPress={onEmergencyStop}
        onRelease={() => withConfirmation('release', onResetEmergencyStop)}
      />

      {commandError && (
        <View style={styles.errorBar}>
          <AlertTriangle size={14} color="#B91C1C" />
          <Text style={styles.errorText}>{commandError}</Text>
        </View>
      )}

      {!canCommand && (
        <Text style={styles.disabledNote}>
          {connectionStatus === 'connecting'
            ? 'Connecting to Firebase… controls unlock once the link is live.'
            : 'Hardware controls are disabled while the database is unreachable. E-Stop will still be attempted.'}
        </Text>
      )}

      <ConfirmDialog
        visible={pending === 'start'}
        title="Start Cleaning Cycle"
        message="The scraper will sweep waste to the chute, return home, then rinse with the water pump. Make sure the track is clear."
        confirmLabel="Start Cycle"
        icon={<Play size={22} color={Colors.primary} />}
        isDemoMode={isDemoMode}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        visible={pending === 'pump'}
        title="Activate Water Pump"
        message="The water spray pump will run for the configured duration."
        confirmLabel="Turn On"
        icon={<Droplets size={22} color={Colors.primary} />}
        isDemoMode={isDemoMode}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        visible={pending === 'release'}
        title="Release Emergency Stop"
        message="Confirm the cage and scraper track are clear. Actuators will accept commands again after release."
        confirmLabel="Release"
        tone="danger"
        icon={<RotateCcw size={22} color={Colors.error} />}
        isDemoMode={isDemoMode}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadows.sm,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  demoBadge: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  demoText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: '#7C3AED',
    letterSpacing: 0.8,
  },
  primaryRow: {
    marginBottom: Spacing.lg,
  },
  controlsSection: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  groupLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  controlBtnSmall: {
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
    paddingVertical: 16,
    borderRadius: 16,
    ...Shadows.glow,
  },
  btnDanger: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
    paddingVertical: 16,
    borderRadius: 16,
  },
  btnDisabled: {
    backgroundColor: Colors.disabledBg,
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  controlLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  controlLabelSmall: {
    fontSize: FontSize.xs,
  },
  labelInverse: {
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  labelDisabled: {
    color: Colors.textTertiary,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#B91C1C',
    fontWeight: FontWeight.semibold,
  },
  disabledNote: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontWeight: FontWeight.medium,
    lineHeight: 16,
  },
});
