// ============================================================
// AgriSweep — Scraper Mechanism Visualizer
//
//   [HOME / REV LIMIT] <====== [CARRIAGE] ======> [FWD LIMIT]
//
// The firmware does not report carriage position, so position
// is estimated client-side from direction + belt travel time and
// snapped to an end whenever its limit switch reports triggered.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { ArrowLeftRight, ChevronsRight, ChevronsLeft, Pause, OctagonX, AlertTriangle, Loader } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { ScraperState } from '../types';

interface ScraperVisualizerProps {
  scraper: ScraperState;
  /** Estimated time for a full end-to-end pass, used to animate the carriage. */
  travelTimeMs: number;
  isDemoMode: boolean;
}

const CARRIAGE_WIDTH = 64;
const TOOTH_PITCH = 8;
const RAIL_HEIGHT = 70;

type VisualState = 'forward' | 'reverse' | 'active' | 'parked' | 'estop' | 'fault';

const stateConfig: Record<VisualState, { label: string; color: string; bg: string }> = {
  forward: { label: 'SWEEPING → CHUTE', color: '#047857', bg: '#ECFDF5' },
  reverse: { label: '← RETURNING HOME', color: '#0369A1', bg: '#F0F9FF' },
  active: { label: 'CYCLE ACTIVE', color: '#047857', bg: '#ECFDF5' },
  parked: { label: 'PARKED', color: '#475569', bg: '#F8FAFC' },
  estop: { label: 'E-STOP', color: '#BE123C', bg: '#FFE4E6' },
  fault: { label: 'FAULT', color: '#B91C1C', bg: '#FEF2F2' },
};

function formatStage(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ScraperVisualizer({ scraper, travelTimeMs, isDemoMode }: ScraperVisualizerProps) {
  const [railWidth, setRailWidth] = useState(0);
  const initial = scraper.limitSwitches.forward ? 1 : 0;
  const position = useRef(new Animated.Value(initial)).current;
  const positionRef = useRef(initial);
  const belt = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const visual: VisualState =
    scraper.stage === 'emergency_stopped'
      ? 'estop'
      : scraper.fault
      ? 'fault'
      : scraper.running && scraper.direction === 'forward'
      ? 'forward'
      : scraper.running && scraper.direction === 'reverse'
      ? 'reverse'
      : scraper.running
      ? 'active'
      : 'parked';
  const moving = visual === 'forward' || visual === 'reverse';

  useEffect(() => {
    const id = position.addListener(({ value }) => {
      positionRef.current = value;
    });
    return () => position.removeListener(id);
  }, [position]);

  // Carriage position
  useEffect(() => {
    position.stopAnimation();
    const current = positionRef.current;
    let target: number | null = null;
    let duration = 250;

    if (scraper.running && scraper.direction === 'forward') {
      target = 1;
      duration = (1 - current) * travelTimeMs;
    } else if (scraper.running && scraper.direction === 'reverse') {
      target = 0;
      duration = current * travelTimeMs;
    } else if (scraper.limitSwitches.forward) {
      target = 1;
    } else if (scraper.limitSwitches.reverse) {
      target = 0;
    }
    if (target === null) return;

    const anim = Animated.timing(position, {
      toValue: target,
      duration: Math.max(1, duration),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [
    position,
    scraper.running,
    scraper.direction,
    scraper.limitSwitches.forward,
    scraper.limitSwitches.reverse,
    travelTimeMs,
  ]);

  // Belt teeth motion
  useEffect(() => {
    belt.stopAnimation();
    belt.setValue(0);
    if (!moving) return;
    const loop = Animated.loop(
      Animated.timing(belt, { toValue: 1, duration: 260, easing: Easing.linear, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, [belt, moving]);

  // Pulse for active / fault states
  useEffect(() => {
    pulse.setValue(0);
    if (visual === 'parked') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, visual]);

  const travel = Math.max(0, railWidth - CARRIAGE_WIDTH);
  const carriageX = position.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const beltShift = belt.interpolate({
    inputRange: [0, 1],
    outputRange: [0, visual === 'reverse' ? -TOOTH_PITCH : TOOTH_PITCH],
  });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const toothCount = Math.ceil((railWidth + TOOTH_PITCH * 4) / TOOTH_PITCH);

  const cfg = stateConfig[visual];
  const carriageColor =
    visual === 'estop' || visual === 'fault'
      ? Colors.emergency
      : visual === 'parked'
      ? '#334155'
      : visual === 'reverse'
      ? Colors.info
      : Colors.primary;
  const CarriageIcon =
    visual === 'forward'
      ? ChevronsRight
      : visual === 'reverse'
      ? ChevronsLeft
      : visual === 'estop'
      ? OctagonX
      : visual === 'fault'
      ? AlertTriangle
      : visual === 'active'
      ? Loader
      : Pause;

  const positionLabel = scraper.limitSwitches.forward
    ? 'Chute (FWD limit)'
    : scraper.limitSwitches.reverse
    ? 'Home (REV limit)'
    : moving
    ? 'In transit'
    : 'Mid-track';

  const onRailLayout = (e: LayoutChangeEvent) => setRailWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <ArrowLeftRight size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Scraper Mechanism</Text>
            <Text style={styles.subtitle}>
              GT2 belt · BTS7960 drive{isDemoMode ? ' · simulated' : ''}
            </Text>
          </View>
        </View>
        <View style={[styles.stateChip, { backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }]}>
          {visual !== 'parked' && <Animated.View style={[styles.stateDot, { backgroundColor: cfg.color, opacity: pulseOpacity }]} />}
          <Text style={[styles.stateText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Track */}
      <View style={styles.trackRow}>
        <LimitSwitch side="REV" caption="HOME" triggered={scraper.limitSwitches.reverse} />

        <View style={styles.rail} onLayout={onRailLayout}>
          {/* Belt: top run (toothed) + bottom return run, with pulleys */}
          <View style={styles.beltTop}>
            <Animated.View style={[styles.teethStrip, { transform: [{ translateX: beltShift }] }]}>
              {Array.from({ length: toothCount }, (_, i) => (
                <View key={i} style={styles.tooth} />
              ))}
            </Animated.View>
          </View>
          <View style={styles.beltBottom} />
          <View style={[styles.pulley, { left: -9 }]} />
          <View style={[styles.pulley, { right: -9 }]} />

          {/* Carriage */}
          {railWidth > 0 && (
            <Animated.View style={[styles.carriage, { backgroundColor: carriageColor, transform: [{ translateX: carriageX }] }]}>
              {visual !== 'parked' && (
                <Animated.View style={[styles.carriageGlow, { borderColor: carriageColor, opacity: pulseOpacity }]} />
              )}
              <View style={[styles.blade, visual === 'reverse' ? styles.bladeLeft : styles.bladeRight]} />
              <CarriageIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
            </Animated.View>
          )}
        </View>

        <LimitSwitch side="FWD" caption="CHUTE" triggered={scraper.limitSwitches.forward} />
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Detail label="Stage" value={formatStage(scraper.stage)} />
        <Detail label="Position" value={positionLabel} />
        <Detail label="Direction" value={formatStage(scraper.direction)} />
        <Detail
          label="Last command"
          value={
            scraper.lastCommand
              ? `${formatStage(scraper.lastCommand)}${
                  scraper.lastCommandTime
                    ? ` · ${new Date(scraper.lastCommandTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : ''
                }`
              : 'None'
          }
        />
      </View>

      {scraper.fault && (
        <View style={styles.faultBar}>
          <AlertTriangle size={14} color="#B91C1C" />
          <Text style={styles.faultText}>{scraper.fault}</Text>
        </View>
      )}
    </View>
  );
}

function LimitSwitch({ side, caption, triggered }: { side: string; caption: string; triggered: boolean }) {
  return (
    <View style={styles.limit}>
      <View style={[styles.limitBody, triggered && styles.limitBodyActive]}>
        <View style={[styles.led, triggered && styles.ledActive]} />
        <View style={[styles.lever, triggered && styles.leverActive]} />
      </View>
      <Text style={[styles.limitSide, triggered && styles.limitSideActive]}>{side}</Text>
      <Text style={styles.limitCaption}>{caption}</Text>
      <Text style={[styles.limitState, triggered && styles.limitStateActive]}>{triggered ? 'HIT' : 'CLEAR'}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
    fontWeight: FontWeight.medium,
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 10,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.6,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  rail: {
    flex: 1,
    height: RAIL_HEIGHT,
    justifyContent: 'center',
  },
  beltTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: RAIL_HEIGHT / 2 - 12,
    height: 7,
    backgroundColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
  },
  teethStrip: {
    flexDirection: 'row',
    position: 'absolute',
    left: -TOOTH_PITCH * 2,
    top: 0,
    bottom: 0,
  },
  tooth: {
    width: TOOTH_PITCH / 2,
    marginRight: TOOTH_PITCH / 2,
    height: '100%',
    backgroundColor: '#64748B',
  },
  beltBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: RAIL_HEIGHT / 2 + 10,
    height: 3,
    backgroundColor: '#334155',
    borderRadius: 2,
  },
  pulley: {
    position: 'absolute',
    top: RAIL_HEIGHT / 2 - 14,
    width: 18,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#475569',
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  carriage: {
    position: 'absolute',
    left: 0,
    top: RAIL_HEIGHT / 2 - 24,
    width: CARRIAGE_WIDTH,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  carriageGlow: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    left: -5,
    right: -5,
    borderRadius: 14,
    borderWidth: 2,
  },
  blade: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  bladeRight: {
    right: -3,
  },
  bladeLeft: {
    left: -3,
  },
  limit: {
    width: 46,
    alignItems: 'center',
  },
  limitBody: {
    width: 30,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  limitBodyActive: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    ...Shadows.glow,
  },
  led: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
  },
  ledActive: {
    backgroundColor: '#34D399',
  },
  lever: {
    position: 'absolute',
    top: -6,
    width: 2,
    height: 8,
    backgroundColor: '#64748B',
    transform: [{ rotate: '20deg' }],
  },
  leverActive: {
    backgroundColor: '#34D399',
    transform: [{ rotate: '0deg' }],
  },
  limitSide: {
    fontSize: 10,
    fontWeight: FontWeight.extrabold,
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  limitSideActive: {
    color: '#34D399',
  },
  limitCaption: {
    fontSize: 8,
    fontWeight: FontWeight.semibold,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  limitState: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    color: '#64748B',
  },
  limitStateActive: {
    color: '#34D399',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  detail: {
    minWidth: '45%',
    flex: 1,
  },
  detailLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: FontWeight.medium,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  faultBar: {
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
  faultText: {
    fontSize: FontSize.xs,
    color: '#B91C1C',
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
});
