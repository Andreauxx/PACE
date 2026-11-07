// ============================================================
// AgriSweep — Sensor Chart Component
// SVG line chart with gradient fill, threshold reference lines
// and a touch / drag scrubber.
// ============================================================

import React, { useId, useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { BorderRadius, Colors, FontSize, FontWeight, Fonts, Shadows, Spacing, SvgFontFamily } from '../constants/theme';
import { SensorDataPoint } from '../types';

export interface ChartThreshold {
  value: number;
  label: string;
  color: string;
}

interface SensorChartProps {
  data: SensorDataPoint[];
  title: string;
  unit: string;
  color?: string;
  thresholds?: ChartThreshold[];
  height?: number;
  decimals?: number;
}

const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const TOOLTIP_WIDTH = 104;

function formatClock(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function nearestIndex(data: SensorDataPoint[], timestamp: number): number {
  let lo = 0;
  let hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].timestamp < timestamp) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].timestamp - timestamp) < Math.abs(data[lo].timestamp - timestamp)) return lo - 1;
  return lo;
}

export default function SensorChart({
  data,
  title,
  unit,
  color = Colors.chartLine1,
  thresholds = [],
  height = 190,
  decimals = 1,
}: SensorChartProps) {
  const gradientId = `grad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  const geometry = useMemo(() => {
    if (data.length < 2) return null;
    const values = data.map((d) => d.value);
    const domain = [...values, ...thresholds.map((t) => t.value)];
    const rawMin = Math.min(...domain);
    const rawMax = Math.max(...domain);
    const pad = (rawMax - rawMin) * 0.1 || 1;
    const minVal = Math.max(0, rawMin - pad);
    const maxVal = rawMax + pad;
    const range = maxVal - minVal || 1;
    const minTime = data[0].timestamp;
    const maxTime = data[data.length - 1].timestamp;
    const timeRange = maxTime - minTime || 1;

    const toX = (t: number) => PAD_LEFT + ((t - minTime) / timeRange) * plotWidth;
    const toY = (v: number) => PAD_TOP + plotHeight - ((v - minVal) / range) * plotHeight;

    const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.timestamp)} ${toY(d.value)}`).join(' ');
    const area = `${line} L ${toX(maxTime)} ${PAD_TOP + plotHeight} L ${toX(minTime)} ${PAD_TOP + plotHeight} Z`;
    const yTicks = Array.from({ length: 5 }, (_, i) => minVal + (range / 4) * i);
    const xTicks = Array.from({ length: 4 }, (_, i) => minTime + (timeRange / 3) * i);

    const sum = values.reduce((a, b) => a + b, 0);
    const stats = {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      latest: values[values.length - 1],
    };

    return { toX, toY, line, area, yTicks, xTicks, minTime, timeRange, minVal, maxVal, stats };
  }, [data, thresholds, plotWidth, plotHeight]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const scrubTo = (e: GestureResponderEvent) => {
    if (!geometry || plotWidth <= 0) return;
    const x = Math.min(Math.max(e.nativeEvent.locationX - PAD_LEFT, 0), plotWidth);
    const t = geometry.minTime + (x / plotWidth) * geometry.timeRange;
    setScrubIndex(nearestIndex(data, t));
  };

  const scrubPoint = scrubIndex !== null && geometry ? data[scrubIndex] : null;
  const latest = data[data.length - 1];
  const fmt = (v: number) => v.toFixed(decimals);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.unitLabel}>{unit}</Text>
      </View>

      <View style={{ height }} onLayout={onLayout}>
        {!geometry || width === 0 ? (
          <View style={[styles.emptyChart, { height }]}>
            <Text style={styles.emptyText}>
              {data.length < 2 ? 'Collecting data… the chart appears after two readings.' : ''}
            </Text>
          </View>
        ) : (
          <>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity={0.32} />
                  <Stop offset="1" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {/* Grid + Y labels */}
              {geometry.yTicks.map((v, i) => (
                <React.Fragment key={`y-${i}`}>
                  <Line
                    x1={PAD_LEFT}
                    y1={geometry.toY(v)}
                    x2={PAD_LEFT + plotWidth}
                    y2={geometry.toY(v)}
                    stroke={Colors.chartGrid}
                    strokeWidth={1}
                  />
                  <SvgText fontFamily={SvgFontFamily} x={PAD_LEFT - 6} y={geometry.toY(v) + 3} fill={Colors.textTertiary} fontSize={9} textAnchor="end">
                    {Math.round(v)}
                  </SvgText>
                </React.Fragment>
              ))}

              {/* X labels */}
              {geometry.xTicks.map((t, i) => (
                <SvgText fontFamily={SvgFontFamily}
                  key={`x-${i}`}
                  x={geometry.toX(t)}
                  y={PAD_TOP + plotHeight + 17}
                  fill={Colors.textTertiary}
                  fontSize={9}
                  textAnchor={i === 0 ? 'start' : i === geometry.xTicks.length - 1 ? 'end' : 'middle'}
                >
                  {formatClock(t)}
                </SvgText>
              ))}

              {/* Area + line */}
              <Path d={geometry.area} fill={`url(#${gradientId})`} />
              <Path d={geometry.line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />

              {/* Threshold reference lines */}
              {thresholds.map((t) => {
                const y = geometry.toY(t.value);
                return (
                  <React.Fragment key={`th-${t.label}`}>
                    <Line x1={PAD_LEFT} y1={y} x2={PAD_LEFT + plotWidth} y2={y} stroke={t.color} strokeWidth={1.5} strokeDasharray="6,4" />
                    <Rect x={PAD_LEFT + plotWidth - 70} y={y - 15} width={70} height={13} rx={4} fill={t.color} opacity={0.14} />
                    <SvgText fontFamily={SvgFontFamily} x={PAD_LEFT + plotWidth - 4} y={y - 5} fill={t.color} fontSize={9} fontWeight="700" textAnchor="end">
                      {`${t.label} ${fmt(t.value)}`}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Latest point */}
              {!scrubPoint && (
                <>
                  <Circle cx={geometry.toX(latest.timestamp)} cy={geometry.toY(latest.value)} r={7} fill={color} opacity={0.2} />
                  <Circle cx={geometry.toX(latest.timestamp)} cy={geometry.toY(latest.value)} r={4} fill={color} stroke={Colors.card} strokeWidth={2} />
                </>
              )}

              {/* Scrubber */}
              {scrubPoint && (
                <>
                  <Line
                    x1={geometry.toX(scrubPoint.timestamp)}
                    y1={PAD_TOP}
                    x2={geometry.toX(scrubPoint.timestamp)}
                    y2={PAD_TOP + plotHeight}
                    stroke={Colors.textSecondary}
                    strokeWidth={1}
                  />
                  <Circle cx={geometry.toX(scrubPoint.timestamp)} cy={geometry.toY(scrubPoint.value)} r={5} fill={color} stroke={Colors.card} strokeWidth={2} />
                </>
              )}
            </Svg>

            {scrubPoint && (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  {
                    left: Math.min(
                      Math.max(geometry.toX(scrubPoint.timestamp) - TOOLTIP_WIDTH / 2, 0),
                      width - TOOLTIP_WIDTH
                    ),
                  },
                ]}
              >
                <Text style={styles.tooltipValue}>
                  {fmt(scrubPoint.value)} <Text style={styles.tooltipUnit}>{unit}</Text>
                </Text>
                <Text style={styles.tooltipTime}>
                  {new Date(scrubPoint.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>
            )}

            {/* Touch layer — ScrollView may take over vertical drags */}
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => true}
              onResponderGrant={scrubTo}
              onResponderMove={scrubTo}
              onResponderRelease={() => setScrubIndex(null)}
              onResponderTerminate={() => setScrubIndex(null)}
              onResponderTerminationRequest={() => true}
            />
          </>
        )}
      </View>

      {geometry && (
        <View style={styles.statsRow}>
          <Stat label="Min" value={fmt(geometry.stats.min)} />
          <Stat label="Avg" value={fmt(geometry.stats.avg)} />
          <Stat label="Max" value={fmt(geometry.stats.max)} />
          <Stat label="Latest" value={fmt(geometry.stats.latest)} color={color} />
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
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
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  unitLabel: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontFamily: Fonts.bold,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(47, 90, 69, 0.25)',
    overflow: 'hidden',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    width: TOOLTIP_WIDTH,
    backgroundColor: Colors.text,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...Shadows.md,
  },
  tooltipValue: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.display,
    color: '#FFFFFF',
  },
  tooltipUnit: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textTertiary,
  },
  tooltipTime: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.disabled,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: FontSize.md,
    fontFamily: Fonts.display,
    color: Colors.text,
    marginTop: 2,
  },
});
