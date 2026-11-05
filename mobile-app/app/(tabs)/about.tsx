// ============================================================
// AgriSweep — About Screen (Screen 4)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import {
  Info,
  Cpu,
  Wind,
  Radar,
  Sliders,
  Cog,
  ShieldCheck,
  Droplets,
  Smartphone,
  CheckCircle2,
  Workflow,
  ArrowRight,
  Layers,
  Sparkles,
  Users,
  Plus,
  Trash2,
  Edit2,
  Terminal,
  Activity,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../hooks/useAppContext';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  Shadows,
} from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

interface Contributor {
  id: string;
  name: string;
  role: string;
}

const DEFAULT_CONTRIBUTORS: Contributor[] = [
  { id: '1', name: 'Lead IoT Engineer', role: 'Firmware & Circuit Architecture' },
  { id: '2', name: 'Software Architect', role: 'Mobile App & State Engineering' },
  { id: '3', name: 'Mechanical Designer', role: 'GT2 Belt & Worm-Gear Scraper Mechanism' },
  { id: '4', name: 'Agricultural Researcher', role: 'Poultry Sanitation & Sensor Analysis' },
];

const CONTRIBUTORS_STORAGE_KEY = '@agrisweep_contributors';

export default function AboutScreen() {
  const { connectionStatus, isDemoMode } = useApp();

  const [contributors, setContributors] = useState<Contributor[]>(DEFAULT_CONTRIBUTORS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState('');

  // Load saved contributors from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(CONTRIBUTORS_STORAGE_KEY);
        if (saved) {
          setContributors(JSON.parse(saved));
        }
      } catch (err) {
        console.warn('Failed to load contributors:', err);
      }
    })();
  }, []);

  const saveContributors = async (newList: Contributor[]) => {
    setContributors(newList);
    try {
      await AsyncStorage.setItem(CONTRIBUTORS_STORAGE_KEY, JSON.stringify(newList));
    } catch (err) {
      console.warn('Failed to save contributors:', err);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setNameInput('');
    setRoleInput('');
    setModalVisible(true);
  };

  const handleOpenEdit = (c: Contributor) => {
    setEditingId(c.id);
    setNameInput(c.name);
    setRoleInput(c.role);
    setModalVisible(true);
  };

  const handleSaveContributor = () => {
    if (!nameInput.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid contributor name.');
      return;
    }
    if (editingId) {
      const updated = contributors.map((c) =>
        c.id === editingId
          ? { ...c, name: nameInput.trim(), role: roleInput.trim() || 'Contributor' }
          : c
      );
      saveContributors(updated);
    } else {
      const newEntry: Contributor = {
        id: Date.now().toString(),
        name: nameInput.trim(),
        role: roleInput.trim() || 'Team Member',
      };
      saveContributors([...contributors, newEntry]);
    }
    setModalVisible(false);
  };

  const handleDeleteContributor = (id: string) => {
    Alert.alert(
      'Remove Contributor',
      'Are you sure you want to remove this contributor from the project credits?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const filtered = contributors.filter((c) => c.id !== id);
            saveContributors(filtered);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.ambientGlow} />
        <View style={styles.headerTop}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <Info size={20} color="#10B981" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.headerTitle}>About AgriSweep</Text>
              <Text style={styles.headerSubtitle}>Architecture, specs & project team</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Project Introduction Card */}
        <Card
          title="Project Overview"
          icon={<Sparkles size={18} color={Colors.primary} />}
          headerRight={
            <StatusBadge
              label={isDemoMode ? 'Demo Mode' : connectionStatus.toUpperCase()}
              variant={connectionStatus === 'online' ? 'success' : isDemoMode ? 'demo' : 'neutral'}
            />
          }
        >
          <View style={styles.introContainer}>
            <Text style={styles.brandTitle}>AgriSweep</Text>
            <Text style={styles.brandSubtitle}>
              Intelligent Automated Cage Waste Management System
            </Text>
            <Text style={styles.introBody}>
              AgriSweep is the dedicated mobile monitoring and control interface for an automated
              poultry-cage waste collection and sanitation system driven by an ESP32 microcontroller.
            </Text>
            <Text style={styles.introBody}>
              The project is engineered to reduce manual waste collection labor, monitor critical
              environmental indicators and waste accumulation levels, and maintain reliable,
              repeatable cage cleaning cycles through belt-driven linear scraping and automated washing.
            </Text>
          </View>
        </Card>

        {/* System Workflow (SENSE -> ANALYZE -> DECIDE -> CLEAN -> RECORD) */}
        <Card
          title="How the System Works"
          subtitle="Autonomous Sanitation Pipeline"
          icon={<Workflow size={18} color={Colors.primary} />}
        >
          <View style={styles.workflowContainer}>
            {/* Step 1 */}
            <View style={styles.workflowStep}>
              <View style={[styles.stepBadge, { backgroundColor: Colors.infoLight }]}>
                <Text style={[styles.stepBadgeText, { color: Colors.info }]}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>SENSE</Text>
                <Text style={styles.stepDescription}>
                  The ESP32 reads analog response from the MQ-135 sensor and acoustic pulse timing from
                  the HC-SR04 ultrasonic sensor.
                </Text>
              </View>
            </View>

            <View style={styles.workflowConnector} />

            {/* Step 2 */}
            <View style={styles.workflowStep}>
              <View style={[styles.stepBadge, { backgroundColor: Colors.warningLight }]}>
                <Text style={[styles.stepBadgeText, { color: Colors.warningDark }]}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>ANALYZE</Text>
                <Text style={styles.stepDescription}>
                  Firmware evaluates sensor readings against user-defined warning and accumulation
                  thresholds while checking safety limit-switch states.
                </Text>
              </View>
            </View>

            <View style={styles.workflowConnector} />

            {/* Step 3 */}
            <View style={styles.workflowStep}>
              <View style={[styles.stepBadge, { backgroundColor: Colors.primarySurface }]}>
                <Text style={[styles.stepBadgeText, { color: Colors.primary }]}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>DECIDE</Text>
                <Text style={styles.stepDescription}>
                  The controller checks if automated schedule criteria are met or receives an
                  authenticated mobile command to trigger a cleaning cycle.
                </Text>
              </View>
            </View>

            <View style={styles.workflowConnector} />

            {/* Step 4 */}
            <View style={styles.workflowStep}>
              <View style={[styles.stepBadge, { backgroundColor: Colors.accentLight }]}>
                <Text style={[styles.stepBadgeText, { color: Colors.primaryDark }]}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>CLEAN</Text>
                <Text style={styles.stepDescription}>
                  BTS7960 drives the 12V 80 RPM worm-gear motor along the GT2 linear belt, while the
                  submersible pump supplies washing water if enabled.
                </Text>
              </View>
            </View>

            <View style={styles.workflowConnector} />

            {/* Step 5 */}
            <View style={styles.workflowStep}>
              <View style={[styles.stepBadge, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.stepBadgeText, { color: Colors.success }]}>5</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>RECORD</Text>
                <Text style={styles.stepDescription}>
                  Sensors, cleaning execution durations, end-limit trips, and error logs are stored in
                  operational history for review and analytics.
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Hardware Architecture Overview */}
        <Card
          title="Hardware Architecture"
          subtitle="Integrated Components & Sensor Suite"
          icon={<Layers size={18} color={Colors.primary} />}
        >
          <View style={styles.hardwareGrid}>
            {/* ESP32 */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Cpu size={20} color={Colors.primary} />
                <Text style={styles.hardwareName}>ESP32 Microcontroller</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Central embedded controller executing real-time sensor polling, actuator safety
                routines, limit switch interlocks, and wireless communication.
              </Text>
            </View>

            {/* MQ-135 */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Wind size={20} color={Colors.info} />
                <Text style={styles.hardwareName}>MQ-135 Gas Sensor</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Monitors air quality responses (ammonia/sulfide indicators) in the poultry housing
                environment using a 12-bit analog-to-digital reading.
              </Text>
            </View>

            {/* HC-SR04 */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Radar size={20} color={Colors.accent} />
                <Text style={styles.hardwareName}>HC-SR04 Ultrasonic</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Provides surface distance measurements (cm) above the waste collection area to detect
                manure accumulation buildup without physical contact.
              </Text>
            </View>

            {/* BTS7960 */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Sliders size={20} color={Colors.warningDark} />
                <Text style={styles.hardwareName}>BTS7960 Motor Driver</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                High-current 43A H-bridge driver delivering bidirectional PWM control to the DC scraper
                motor with optocoupler electrical isolation.
              </Text>
            </View>

            {/* Worm Gear Motor */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Cog size={20} color={Colors.primaryDark} />
                <Text style={styles.hardwareName}>12V 80 RPM DC Motor</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                High-torque worm-gear motor providing mechanical force to push heavy waste loads while
                preventing back-driving when stationary.
              </Text>
            </View>

            {/* GT2 Scraper */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Activity size={20} color={Colors.accentDark} />
                <Text style={styles.hardwareName}>GT2 Belt Linear Scraper</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Linear guide and reinforced timing belt drive that moves the mechanical wiper blade
                smoothly across the poultry cage waste tray.
              </Text>
            </View>

            {/* Limit Switches */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <ShieldCheck size={20} color={Colors.error} />
                <Text style={styles.hardwareName}>End Limit Switches</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Hardware boundary sensors installed at both ends of the tray to automatically reverse
                or halt the scraper, preventing motor stalls and belt damage.
              </Text>
            </View>

            {/* Water Pump */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Droplets size={20} color={Colors.info} />
                <Text style={styles.hardwareName}>DC Water Pump</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Submersible 12V fluid pump delivering timed water spray during automated cleaning cycles
                for cage surface rinsing.
              </Text>
            </View>

            {/* Mobile App */}
            <View style={styles.hardwareItem}>
              <View style={styles.hardwareHeader}>
                <Smartphone size={20} color={Colors.primary} />
                <Text style={styles.hardwareName}>Mobile Application</Text>
              </View>
              <Text style={styles.hardwareDesc}>
                Cross-platform monitoring and control application built on React Native & Expo, providing
                telemetry charts, manual overrides, and diagnostics.
              </Text>
            </View>
          </View>
        </Card>

        {/* Project Objectives */}
        <Card
          title="Project Objectives"
          subtitle="Design Goals & Scope"
          icon={<CheckCircle2 size={18} color={Colors.primary} />}
        >
          <View style={styles.objectivesList}>
            <View style={styles.objectiveRow}>
              <CheckCircle2 size={18} color={Colors.accent} style={styles.checkIcon} />
              <Text style={styles.objectiveText}>
                Automate the mechanical collection of poultry-cage waste.
              </Text>
            </View>

            <View style={styles.objectiveRow}>
              <CheckCircle2 size={18} color={Colors.accent} style={styles.checkIcon} />
              <Text style={styles.objectiveText}>
                Reduce manual cleaning effort and frequency of cage entries.
              </Text>
            </View>

            <View style={styles.objectiveRow}>
              <CheckCircle2 size={18} color={Colors.accent} style={styles.checkIcon} />
              <Text style={styles.objectiveText}>
                Monitor selected air quality indicators and waste accumulation metrics.
              </Text>
            </View>

            <View style={styles.objectiveRow}>
              <CheckCircle2 size={18} color={Colors.accent} style={styles.checkIcon} />
              <Text style={styles.objectiveText}>
                Provide responsive manual and automated cleaning controls with hardware safety interlocks.
              </Text>
            </View>

            <View style={styles.objectiveRow}>
              <CheckCircle2 size={18} color={Colors.accent} style={styles.checkIcon} />
              <Text style={styles.objectiveText}>
                Maintain a chronological record of cleaning cycles and operational events.
              </Text>
            </View>

            <View style={styles.objectiveRow}>
              <CheckCircle2 size={18} color={Colors.accent} style={styles.checkIcon} />
              <Text style={styles.objectiveText}>
                Improve operational visibility and simplify farm equipment troubleshooting.
              </Text>
            </View>
          </View>
        </Card>

        {/* Technical Information Card */}
        <Card
          title="Technical Information"
          subtitle="System & Build Details"
          icon={<Terminal size={18} color={Colors.primary} />}
        >
          <View style={styles.infoTable}>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Application Name</Text>
              <Text style={styles.infoVal}>AgriSweep</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Application Version</Text>
              <Text style={styles.infoVal}>v{APP_CONFIG.version}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Hardware Platform</Text>
              <Text style={styles.infoVal}>ESP32 DevKit V1 (Xtensa Dual-Core)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Firmware Core</Text>
              <Text style={styles.infoVal}>Arduino ESP32 / FreeRTOS</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Communication Mode</Text>
              <Text style={styles.infoVal}>{isDemoMode ? 'Simulated Demo' : 'REST / WebSocket'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Backend Integration</Text>
              <Text style={styles.infoVal}>Firebase RTDB / Modular REST API</Text>
            </View>
          </View>
        </Card>

        {/* Project Contributors Section (Editable) */}
        <Card
          title="Project Contributors & Credits"
          subtitle="Engineering & Research Team"
          icon={<Users size={18} color={Colors.primary} />}
          headerRight={
            <TouchableOpacity style={styles.addButton} onPress={handleOpenAdd}>
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          }
        >
          <View style={styles.contributorsList}>
            {contributors.map((c) => (
              <View key={c.id} style={styles.contributorItem}>
                <View style={styles.contributorInfo}>
                  <Text style={styles.contributorName}>{c.name}</Text>
                  <Text style={styles.contributorRole}>{c.role}</Text>
                </View>
                <View style={styles.contributorActions}>
                  <TouchableOpacity
                    onPress={() => handleOpenEdit(c)}
                    style={styles.actionIconButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Edit2 size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteContributor(c.id)}
                    style={styles.actionIconButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            AgriSweep is engineered for intelligent, reliable agricultural sanitation.
          </Text>
        </View>
      </ScrollView>

      {/* Edit/Add Contributor Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit Contributor' : 'Add Contributor'}
            </Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Jane Doe"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.modalLabel}>Role / Focus Area</Text>
            <TextInput
              style={styles.modalInput}
              value={roleInput}
              onChangeText={setRoleInput}
              placeholder="e.g. Embedded Firmware Lead"
              placeholderTextColor={Colors.textTertiary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleSaveContributor}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  introContainer: {
    gap: Spacing.sm,
  },
  brandTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#047857',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: '#059669',
    marginBottom: Spacing.xs,
  },
  introBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  workflowContainer: {
    gap: Spacing.xs,
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  stepBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#047857',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  stepDescription: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  workflowConnector: {
    width: 2,
    height: 14,
    backgroundColor: '#E2E8F0',
    marginLeft: 13,
  },
  hardwareGrid: {
    gap: Spacing.md,
  },
  hardwareItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  hardwareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hardwareName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  hardwareDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  objectivesList: {
    gap: Spacing.md,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkIcon: {
    marginTop: 2,
  },
  objectiveText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  infoTable: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoKey: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  infoVal: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 4,
  },
  addButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#047857',
  },
  contributorsList: {
    gap: Spacing.sm,
  },
  contributorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  contributorInfo: {
    flex: 1,
  },
  contributorName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  contributorRole: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contributorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionIconButton: {
    padding: Spacing.xs,
  },
  footerNote: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  modalCancelBtn: {
    backgroundColor: Colors.background,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
  },
  modalSaveText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.semibold,
  },
});
