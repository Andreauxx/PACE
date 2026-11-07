// ============================================================
// AgriSweep — Form Controls
// Slider, segmented picker, switch row and chip.
// Straw marks values that change how the machine moves;
// ink marks a chosen option.
// ============================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors, Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';

// ---- SliderField ----

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  /** Called once when the finger lifts, so each drag is one save. */
  onCommit: (v: number) => void;
  hint?: string;
  disabled?: boolean;
  accent?: string;
  /** Light text and track for use on the ink panel. */
  onDark?: boolean;
}

export function SliderField({ label, value, min, max, step, format, onCommit, hint, disabled, accent = Colors.straw, onDark }: SliderFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <View style={[styles.sliderField, disabled && styles.dim]}>
      <View style={styles.sliderTop}>
        <Text style={[styles.sliderLabel, onDark && styles.onDark]}>{label}</Text>
        <Text style={[styles.sliderValue, onDark && styles.onDark]}>{format(draft)}</Text>
      </View>
      <Slider
        style={styles.slider}
        value={draft}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={onDark ? 'rgba(255, 255, 255, 0.25)' : Colors.line}
        thumbTintColor={onDark ? Colors.straw : Colors.ink}
        onValueChange={setDraft}
        onSlidingComplete={(v) => {
          setDraft(v);
          if (v !== value) onCommit(v);
        }}
        accessibilityLabel={label}
      />
      <View style={styles.sliderScale}>
        <Text style={[styles.scaleText, onDark && styles.onDarkFaint]}>{format(min)}</Text>
        {hint ? <Text style={[styles.hint, onDark && styles.onDarkFaint]}>{hint}</Text> : null}
        <Text style={[styles.scaleText, onDark && styles.onDarkFaint]}>{format(max)}</Text>
      </View>
    </View>
  );
}

// ---- Segmented ----

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: (active: boolean) => React.ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, disabled }: SegmentedProps<T>) {
  return (
    <View style={[styles.segment, disabled && styles.dim]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {opt.icon?.(active)}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---- SwitchRow ----

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  last?: boolean;
}

export function SwitchRow({ label, description, value, onChange, icon, disabled, last }: SwitchRowProps) {
  return (
    <View style={[styles.switchRow, last && styles.switchRowLast]}>
      {icon ? <View style={styles.switchIcon}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description ? <Text style={styles.switchDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: Colors.line, true: Colors.barnLight }}
        thumbColor={value ? Colors.barnDark : '#FFFFFF'}
        accessibilityLabel={label}
      />
    </View>
  );
}

// ---- Chip ----

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function Chip({ label, active, onPress, disabled }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, disabled && styles.dim]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dim: {
    opacity: 0.4,
  },
  onDark: {
    color: '#FFFFFF',
  },
  onDarkFaint: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sliderField: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sliderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.md,
  },
  sliderLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.ink,
  },
  sliderValue: {
    fontFamily: Fonts.display,
    fontSize: FontSize.xl,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -4,
  },
  scaleText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.faint,
  },
  hint: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.faint,
    paddingHorizontal: Spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.sunken,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm + 2,
  },
  segmentBtnActive: {
    backgroundColor: Colors.ink,
  },
  segmentText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lineSoft,
  },
  switchRowLast: {
    borderBottomWidth: 0,
  },
  switchIcon: {
    width: 22,
    alignItems: 'center',
  },
  switchLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    lineHeight: 19,
    color: Colors.ink,
  },
  switchDesc: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.xs,
    color: Colors.faint,
    marginTop: 2,
    lineHeight: 17,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.steel,
  },
  chipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
