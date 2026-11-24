import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { borderWidth, colors, fontSize, fontWeight, iconSize, lineHeight, radius, spacing } from '@/theme';

export interface NoticeAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface NoticeProps {
  message: string;
  tone?: 'error' | 'info';
  actions?: NoticeAction[];
  onDismiss?: () => void;
}

/** A small, non-blocking inline message with optional actions (e.g. "Try again"). */
export function Notice({ message, tone = 'error', actions, onDismiss }: NoticeProps) {
  const isError = tone === 'error';
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, isError && styles.boxError]}>
      <View style={styles.row}>
        <Ionicons
          name={isError ? 'alert-circle' : 'information-circle'}
          size={iconSize.md}
          color={isError ? colors.danger : colors.warning}
        />
        <Text style={styles.text}>{message}</Text>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message">
            <Ionicons name="close" size={iconSize.sm} color={colors.mutedText} />
          </Pressable>
        ) : null}
      </View>
      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!action.disabled }}
              style={({ pressed }) => [
                styles.action,
                pressed && styles.actionPressed,
                action.disabled && styles.actionDisabled,
              ]}>
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  boxError: { borderColor: colors.danger },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, fontSize: fontSize.small, lineHeight: lineHeight.small, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: iconSize.md + spacing.sm },
  action: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionPressed: { opacity: 0.7 },
  actionDisabled: { opacity: 0.45 },
  actionText: { fontSize: fontSize.small, fontWeight: fontWeight.bold, color: colors.text },
});
