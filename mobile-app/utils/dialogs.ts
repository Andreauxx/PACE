// ============================================================
// AgriSweep — Cross-platform dialogs
// React Native Web's Alert.alert is a no-op, so fall back to the
// browser's native dialogs on web.
// ============================================================

import { Alert, Platform } from 'react-native';

export function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
