// ============================================================
// AgriSweep — Ammonia Radial Gauge (MQ-135)
// 240° SVG gauge with Normal / Warning / Danger zones.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Wind } from 'lucide-react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts, Shadows, Spacing, SvgFontFamily } from '../constants/theme';
import { APP_CONFIG } from '../constants/config';
import { SensorStatus } from '../types';
import { Trend, clamp } from '../utils/sensors';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import StatusBadge from './StatusBadge';
import TrendBadge from './TrendBadge';

interface AmmoniaGaugeProps {
  ppm: number | null;
  warningThreshold: number;
  criticalThreshold: number;
  status: SensorStatus;
  trend: Trend;
  timestamp: number;
  rawAdc?: number;
  maxPpm?: number;
}

const SIZE = 240;
const CX = SIZE / 2;
const CY = 122;
const R = 92;
const STROKE = 16;
const START_DEG = 150;
const SWEEP_DEG = 240;

export const ammoniaStatusColor: Record<SensorStatus, string> = {
  normal: Colors.sensorNormal,
  elevated: Colors.sensorElevated,
  warning: Colors.warning,
  critical: Colors.sensorCritical,
  unavailable: Colors.sensorUnavailable,
};

const statusLabel: Record<SensorStatus, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  warning: 'Warning',
  critical: 'Danger',
  unavailable: 'No data',
};

const statusBadgeVariant: Record<SensorStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  normal: 'success',
  elevated: 'warning',
  warning: 'warning',
  critical: 'error',
  unavailable: 'neutral',
};

function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function arcPath(fromDeg: number, toDeg: number, radius: number): string {
  const a = polar(fromDeg, radius);
  const b = polar(toDeg, radius);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

export default function AmmoniaGauge({
  ppm,
  warningThreshold,
  criticalThreshold,
  status,
  trend,
  timestamp,
  rawAdc,
  maxPpm = APP_CONFIG.mq135GaugeMaxPpm,
}: AmmoniaGaugeProps) {
  const animated = useAnimatedNumber(ppm ?? 0);
  const toDeg = (v: number) => START_DEG + (clamp(v, 0, maxPpm) / maxPpm) * SWEEP_DEG;
  const color = ammoniaStatusColor[status];
  const valueDeg = toDeg(animated);
  const knob = polar(valueDeg, R);
  const hasData = ppm !== null && status !== 'unavailable';

  const zones = [
    { from: 0, to: warningThreshold, color: Colors.sensorNormal },
    { from: warningThreshold, to: criticalThreshold, color: Colors.warning },
    { from: criticalThreshold, to: maxPpm, color: Colors.sensorCritical },
  ];
  const ticks = [0, warningThreshold, criticalThreshold, maxPpm];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Wind size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ammonia (NH₃)</Text>
            <Text style={styles.subtitle}>MQ-135 Gas Sensor · estimated PPM</Text>
          </View>
        </View>
        <StatusBadge label={statusLabel[status]} variant={statusBadgeVariant[status]} />
      </View>

      <View style={styles.gaugeWrap}>
        <Svg width={SIZE} height={SIZE * 0.8} viewBox={`0 0 ${SIZE} ${SIZE * 0.8}`}>
          {/* Zone ring */}
          {zones.map((z) => (
            <Path
              key={z.color}
              d={arcPath(toDeg(z.from), toDeg(z.to), R + STROKE / 2 + 7)}
              stroke={z.color}
              strokeWidth={4}
              strokeLinecap="butt"
              fill="none"
              opacity={0.85}
            />
          ))}

          {/* Track */}
          <Path d={arcPath(START_DEG, START_DEG + SWEEP_DEG, R)} stroke={Colors.border} strokeWidth={STROKE} strokeLinecap="round" fill="none" />

          {/* Value arc + glow */}
          {hasData && animated > 0.05 && (
            <>
              <Path d={arcPath(START_DEG, valueDeg, R)} stroke={color} strokeWidth={STROKE + 10} strokeLinecap="round" fill="none" opacity={0.15} />
              <Path d={arcPath(START_DEG, valueDeg, R)} stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
            </>
          )}

          {/* Threshold ticks */}
          {ticks.map((t) => {
            const inner = polar(toDeg(t), R - STROKE / 2 - 4);
            const outer = polar(toDeg(t), R - STROKE / 2 - 10);
            const label = polar(toDeg(t), R - STROKE / 2 - 22);
            return (
              <React.Fragment key={`tick-${t}`}>
                <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={Colors.textTertiary} strokeWidth={1.5} />
                <SvgText fontFamily={SvgFontFamily} x={label.x} y={label.y + 3} fontSize={9} fontWeight="600" fill={Colors.textTertiary} textAnchor="middle">
                  {Math.round(t)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Knob */}
          {hasData && <Circle cx={knob.x} cy={knob.y} r={9} fill={Colors.surface} stroke={color} strokeWidth={4} />}

          {/* Readout */}
          <SvgText fontFamily={SvgFontFamily} x={CX} y={CY + 2} fontSize={44} fontWeight="800" fill={Colors.text} textAnchor="middle">
            {hasData ? animated.toFixed(1) : '—'}
          </SvgText>
          <SvgText fontFamily={SvgFontFamily} x={CX} y={CY + 22} fontSize={11} fontWeight="700" fill={Colors.textSecondary} textAnchor="middle" letterSpacing={1.5}>
            PPM NH₃
          </SvgText>
          <SvgText fontFamily={SvgFontFamily} x={CX} y={CY + 48} fontSize={11} fontWeight="800" fill={color} textAnchor="middle" letterSpacing={1.2}>
            {statusLabel[status]}
          </SvgText>
        </Svg>
      </View>

      <View style={styles.legend}>
        <LegendChip color={Colors.sensorNormal} label="Normal" range={`< ${warningThreshold}`} active={status === 'normal'} />
        <LegendChip color={Colors.warning} label="Warning" range={`${warningThreshold}–${criticalThreshold}`} active={status === 'warning' || status === 'elevated'} />
        <LegendChip color={Colors.sensorCritical} label="Danger" range={`> ${criticalThreshold}`} active={status === 'critical'} />
      </View>

      <View style={styles.footer}>
        <TrendBadge trend={trend} risingIsBad />
        <Text style={styles.timestamp}>
          {rawAdc !== undefined && hasData ? `ADC ${rawAdc} · ` : ''}
          {hasData ? `Updated ${new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Awaiting sensor data'}
        </Text>
      </View>
    </View>
  );
}

function LegendChip({ color, label, range, active }: { color: string; label: string; range: string; active: boolean }) {
  return (
    <View style={[styles.legendChip, active && { borderColor: color, backgroundColor: `${color}14` }]}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View>
        <Text style={[styles.legendLabel, active && { color: Colors.text }]}>{label}</Text>
        <Text style={styles.legendRange}>{range} ppm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
    fontFamily: Fonts.regular,
  },
  gaugeWrap: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  legendChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
  legendRange: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Fonts.regular,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontFamily: Fonts.regular,
  },
});
