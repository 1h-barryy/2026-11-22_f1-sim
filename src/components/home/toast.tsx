import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderWidth, colors, fontSize, fontWeight, iconSize, radius, spacing } from '@/theme';

export interface ToastData {
  id: number;
  message: string;
  tone: 'expense' | 'task';
}

/** A small pill that pops in at the top of the screen. The parent controls how long it stays. */
export function Toast({ toast }: { toast: ToastData | null }) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  const accent = toast.tone === 'expense' ? colors.expense : colors.task;
  return (
    <Animated.View
      key={toast.id}
      entering={ZoomIn.springify().damping(14)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top: insets.top + spacing.sm }]}>
      <Ionicons name="checkmark-circle" size={iconSize.lg} color={accent} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
});
