// ============================================================
// AgriSweep — Confirmation Dialog
// Modal-based so it works on iOS, Android and web
// (React Native Web's Alert.alert does nothing).
// ============================================================

import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { AlertTriangle, FlaskConical } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  isDemoMode?: boolean;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  isDemoMode,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const accent = tone === 'danger' ? Colors.error : Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Inner Pressable swallows taps so they don't dismiss the dialog */}
        <Pressable style={styles.dialog} onPress={() => {}}>
          <View style={[styles.iconBox, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
            {icon ?? <AlertTriangle size={22} color={accent} />}
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {isDemoMode && (
            <View style={styles.demoNote}>
              <FlaskConical size={13} color="#7C3AED" />
              <Text style={styles.demoText}>Demo mode: simulated hardware only.</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: accent }, pressed && styles.pressed]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5F3FF',
  },
  demoText: {
    fontSize: FontSize.xs,
    color: '#6D28D9',
    fontWeight: FontWeight.semibold,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  cancelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  confirmText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
