// One confirmation dialog for destructive actions, used by every delete path.
// React Native's Alert.alert is a no-op on web (its callbacks never fire), so
// web uses window.confirm, exactly as the Ledger's expense row always has.

import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the destructive button (native only). Defaults to "Delete". */
  confirmLabel?: string;
}

/** Resolves true only if the user explicitly confirmed. */
export function confirmDestructive({
  title,
  message,
  confirmLabel = 'Delete',
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      // Android: tapping outside the dialog dismisses it without pressing a button.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
