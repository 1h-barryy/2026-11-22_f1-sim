import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

interface TodoSummaryProps {
  upcomingCount: number;
  doneCount: number;
}

export function TodoSummary({ upcomingCount, doneCount }: TodoSummaryProps) {
  const total = upcomingCount + doneCount;
  const ratio = total > 0 ? doneCount / total : 0;
  const progress = useSharedValue(ratio);

  useEffect(() => {
    progress.value = withTiming(ratio, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [ratio, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const allDone = upcomingCount === 0 && doneCount > 0;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>
            {allDone ? 'All caught up!' : `${upcomingCount} ${upcomingCount === 1 ? 'task' : 'tasks'} left`}
          </Text>
          <Text style={styles.sublabel}>
            {doneCount} of {total} completed
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.round(ratio * 100)}%</Text>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.taskSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.heavy,
  },
  sublabel: {
    color: colors.mutedText,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
  },
  badge: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: colors.task,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.task,
  },
});
