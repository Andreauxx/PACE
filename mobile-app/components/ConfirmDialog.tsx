// ============================================================
// AgriSweep — Confirmation Dialog
// Modal-based so it works on iOS, Android and web
// (React Native Web's Alert.alert does nothing).
// ============================================================

import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { BorderRadius, Colors, Fonts, FontSize, Spacing } from '../constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** primary = starts something moving (straw); danger = comb red. */
  tone?: 'primary' | 'danger';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ visible, title, message, confirmLabel, tone = 'primary', icon, onConfirm, onCancel }: ConfirmDialogProps) {
  const danger = tone === 'danger';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Inner Pressable swallows taps so they don't dismiss the dialog */}
        <Pressable style={styles.dialog} onPress={() => {}}>
          <View style={styles.titleRow}>
            {icon}
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, danger ? styles.danger : styles.go, pressed && styles.pressed]}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmText, danger && { color: '#FFFFFF' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: Colors.steel,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: FontSize.xxl,
    color: Colors.ink,
  },
  message: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: Colors.sunken,
  },
  go: {
    backgroundColor: Colors.straw,
  },
  danger: {
    backgroundColor: Colors.comb,
  },
  pressed: {
    opacity: 0.85,
  },
  cancelText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  confirmText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Colors.ink,
  },
});
