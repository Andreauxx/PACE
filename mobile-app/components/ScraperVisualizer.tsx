// ============================================================
// AgriSweep — Scraper Track
//
//   Home ──────[ carriage ]────────── Bin
//   0 cm                         stroke cm
//
// There are no end switches and the firmware does not report
// position, so the carriage is placed by dead reckoning: it
// moves at the calibrated travel rate while the motor runs and
// stays put when it stops. It resets to home whenever a full
// cycle finishes.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { ChevronsRight, ChevronsLeft, OctagonX, AlertTriangle } from 'lucide-react-native';
import { BorderRadius, Colors, Fonts, FontSize, Spacing } from '../constants/theme';
import { ScraperState } from '../types';
import StatusBadge from './StatusBadge';

interface ScraperVisualizerProps {
  scraper: ScraperState;
  strokeDistanceCm: number;
  /** Travel rate at the current speed. */
  cmPerSecond: number;
}

const CARRIAGE = 44;
const TRACK_HEIGHT = 56;

export default function ScraperVisualizer({ scraper, strokeDistanceCm, cmPerSecond }: ScraperVisualizerProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useRef(new Animated.Value(0)).current; // 0 = home, 1 = bin end of the stroke
  const positionRef = useRef(0);
  const [positionCm, setPositionCm] = useState(0);

  const eStopped = scraper.stage === 'emergency_stopped';
  const moving = scraper.direction === 'forward' || scraper.direction === 'reverse';
  const fullStrokeMs = (strokeDistanceCm / Math.max(cmPerSecond, 0.01)) * 1000;

  useEffect(() => {
    const id = position.addListener(({ value }) => {
      positionRef.current = value;
      setPositionCm(Math.round(value * strokeDistanceCm));
    });
    return () => position.removeListener(id);
  }, [position, strokeDistanceCm]);

  useEffect(() => {
    position.stopAnimation();
    const current = positionRef.current;
    let target: number | null = null;
    if (scraper.direction === 'forward') target = 1;
    else if (scraper.direction === 'reverse') target = 0;
    if (target === null) return; // motor stopped: the carriage stays where it is
    const anim = Animated.timing(position, {
      toValue: target,
      duration: Math.max(1, Math.abs(target - current) * fullStrokeMs),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [position, scraper.direction, scraper.stage, scraper.running, fullStrokeMs]);

  const travel = Math.max(0, trackWidth - CARRIAGE);
  const x = position.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });

  const badge = eStopped
    ? { label: 'Stopped', variant: 'error' as const }
    : scraper.fault
    ? { label: 'Fault', variant: 'error' as const }
    : scraper.direction === 'forward'
    ? { label: 'To the bin', variant: 'warning' as const }
    : scraper.direction === 'reverse'
    ? { label: 'Going home', variant: 'info' as const }
    : { label: 'Parked', variant: 'neutral' as const };

  const carriageColor = eStopped || scraper.fault ? Colors.comb : moving ? Colors.straw : Colors.steel;
  const Icon = eStopped ? OctagonX : scraper.fault ? AlertTriangle : scraper.direction === 'reverse' ? ChevronsLeft : ChevronsRight;
  const iconColor = eStopped || scraper.fault ? '#FFFFFF' : Colors.ink;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Scraper track</Text>
          <Text style={styles.subtitle}>Position is estimated from the travel rate.</Text>
        </View>
        <StatusBadge label={badge.label} variant={badge.variant} />
      </View>

      <View style={styles.track} onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width - Spacing.md * 2)}>
        <View style={styles.rail} />
        {trackWidth > 0 && (
          <Animated.View style={[styles.carriage, { backgroundColor: carriageColor, transform: [{ translateX: x }] }]}>
            <Icon size={20} color={iconColor} strokeWidth={2.4} />
          </Animated.View>
        )}
      </View>
      <View style={styles.scale}>
        <Text style={styles.scaleText}>Home</Text>
        <Text style={styles.scaleText}>Bin, {strokeDistanceCm} cm</Text>
      </View>

      <View style={styles.readout}>
        <View>
          <Text style={styles.big}>{positionCm} cm</Text>
          <Text style={styles.small}>from home, about</Text>
        </View>
        <View>
          <Text style={styles.big}>{cmPerSecond.toFixed(1)} cm/s</Text>
          <Text style={styles.small}>at this speed</Text>
        </View>
      </View>

      {scraper.fault && <Text style={styles.fault}>{scraper.fault}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.steel,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  title: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.ink },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint, marginTop: 1 },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: Colors.ink,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  carriage: {
    position: 'absolute',
    left: Spacing.md,
    width: CARRIAGE,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scaleText: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint },
  readout: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.md },
  big: { fontFamily: Fonts.display, fontSize: FontSize.xl, color: Colors.ink },
  small: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.faint },
  fault: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: Colors.combDark, marginTop: Spacing.md },
});
