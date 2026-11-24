import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { formatRelativeDay, isOverdue, todayISO } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

interface TaskRowProps {
  task: Task;
  justMoved: boolean;
  onPress: (task: Task) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

interface TextLineMetrics {
  width: number;
  y: number;
  height: number;
}

const CHECKBOX_SIZE = spacing.xl + spacing.xxs; // 26
const CHECK_HOLD_MS = 340;
const CHECK_EXIT_MS = 180;
const UNCHECK_HOLD_MS = 220;
const UNCHECK_EXIT_MS = 160;
const ENTER_MS = 220;

function StrikeLine({
  line,
  index,
  total,
  progress,
}: {
  line: TextLineMetrics;
  index: number;
  total: number;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const start = index / total;
    const end = (index + 1) / total;
    const width = interpolate(
      progress.value,
      [start, end],
      [0, line.width],
      Extrapolation.CLAMP,
    );
    return {
      width,
      opacity: width > 0.5 ? 1 : 0,
    };
  }, [line.width, index, total]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.strikeBar,
        { top: line.y + line.height * 0.52 },
        animatedStyle,
      ]}
    />
  );
}

function FallbackStrikeLine({ progress }: { progress: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    const pct = interpolate(progress.value, [0, 1], [0, 100], Extrapolation.CLAMP);
    return {
      width: `${pct}%`,
      opacity: progress.value > 0.01 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.strikeBar, styles.fallbackStrikeBar, animatedStyle]}
    />
  );
}

export function TaskRow({ task, justMoved, onPress, onToggle, onDelete }: TaskRowProps) {
  const [lines, setLines] = useState<TextLineMetrics[]>([]);
  const pendingRef = useRef(false);
  const prevDoneRef = useRef(task.done);
  const didEnterRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkProgress = useSharedValue(task.done ? 1 : 0);
  const checkboxScale = useSharedValue(1);
  const ringProgress = useSharedValue(0);
  const strikeProgress = useSharedValue(task.done ? 1 : 0);

  const rowOpacity = useSharedValue(justMoved ? 0 : 1);
  const rowTranslateY = useSharedValue(justMoved ? (task.done ? -spacing.md : spacing.md) : 0);
  const rowScale = useSharedValue(justMoved ? 0.96 : 1);

  const clearTimers = useCallback(() => {
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (justMoved && !didEnterRef.current) {
      didEnterRef.current = true;
      rowOpacity.value = withTiming(1, {
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
      });
      rowTranslateY.value = withSpring(0, { damping: 18, stiffness: 280, mass: 0.8 });
      rowScale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.8 });
    }
  }, [justMoved, rowOpacity, rowScale, rowTranslateY]);

  useEffect(() => {
    if (prevDoneRef.current === task.done) return;
    prevDoneRef.current = task.done;
    pendingRef.current = false;
    checkProgress.value = task.done ? 1 : 0;
    strikeProgress.value = task.done ? 1 : 0;
    checkboxScale.value = 1;
    ringProgress.value = 0;
    rowOpacity.value = 1;
    rowTranslateY.value = 0;
    rowScale.value = 1;
  }, [
    task.done,
    checkProgress,
    strikeProgress,
    checkboxScale,
    ringProgress,
    rowOpacity,
    rowTranslateY,
    rowScale,
  ]);

  useEffect(() => clearTimers, [clearTimers]);

  const handleTextLayout = useCallback<NonNullable<TextProps['onTextLayout']>>((event) => {
    const measured = event.nativeEvent.lines.map((line) => ({
      width: line.width,
      y: line.y,
      height: line.height,
    }));
    setLines((prev) => {
      if (
        prev.length === measured.length &&
        prev.every(
          (item, i) =>
            Math.abs(item.width - measured[i].width) < 0.5 &&
            Math.abs(item.y - measured[i].y) < 0.5 &&
            Math.abs(item.height - measured[i].height) < 0.5,
        )
      ) {
        return prev;
      }
      return measured;
    });
  }, []);

  const handleCheckboxPress = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    clearTimers();

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (!task.done) {
      // Completing: springy checkbox fill + burst ring + left-to-right strikethrough + beat + glide into Done
      checkboxScale.value = withSequence(
        withTiming(0.82, { duration: 55, easing: Easing.out(Easing.quad) }),
        withSpring(1.22, { damping: 9, stiffness: 420, mass: 0.65 }),
        withSpring(1, { damping: 14, stiffness: 320 }),
      );
      checkProgress.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
      ringProgress.value = 0;
      ringProgress.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      strikeProgress.value = withDelay(
        55,
        withTiming(1, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        }),
      );

      exitTimerRef.current = setTimeout(() => {
        rowOpacity.value = withTiming(0, {
          duration: CHECK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        });
        rowTranslateY.value = withTiming(spacing.md, {
          duration: CHECK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        });
        rowScale.value = withTiming(0.96, {
          duration: CHECK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        });
      }, CHECK_HOLD_MS);

      commitTimerRef.current = setTimeout(() => {
        onToggle(task.id);
      }, CHECK_HOLD_MS + CHECK_EXIT_MS);
    } else {
      // Unchecking: springy uncheck + strikethrough retract + glide back to Upcoming
      checkboxScale.value = withSequence(
        withTiming(0.84, { duration: 55, easing: Easing.out(Easing.quad) }),
        withSpring(1.12, { damping: 12, stiffness: 380, mass: 0.7 }),
        withSpring(1, { damping: 15, stiffness: 300 }),
      );
      checkProgress.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
      strikeProgress.value = withTiming(0, {
        duration: 170,
        easing: Easing.out(Easing.cubic),
      });

      exitTimerRef.current = setTimeout(() => {
        rowOpacity.value = withTiming(0, {
          duration: UNCHECK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        });
        rowTranslateY.value = withTiming(-spacing.md, {
          duration: UNCHECK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        });
        rowScale.value = withTiming(0.96, {
          duration: UNCHECK_EXIT_MS,
          easing: Easing.in(Easing.cubic),
        });
      }, UNCHECK_HOLD_MS);

      commitTimerRef.current = setTimeout(() => {
        onToggle(task.id);
      }, UNCHECK_HOLD_MS + UNCHECK_EXIT_MS);
    }
  }, [
    task.done,
    task.id,
    clearTimers,
    checkboxScale,
    checkProgress,
    ringProgress,
    strikeProgress,
    rowOpacity,
    rowTranslateY,
    rowScale,
    onToggle,
  ]);

  const handleRowPress = useCallback(() => {
    if (pendingRef.current) return;
    onPress(task);
  }, [onPress, task]);

  const handleLongPress = useCallback(() => {
    if (pendingRef.current) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    Alert.alert('Delete task?', `Remove "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(task.id),
      },
    ]);
  }, [task.id, task.title, onDelete]);

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateY: rowTranslateY.value }, { scale: rowScale.value }],
  }));

  const checkboxAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      checkProgress.value,
      [0, 1],
      [colors.surface, colors.task],
    ),
    borderColor: interpolateColor(
      checkProgress.value,
      [0, 1],
      [colors.border, colors.task],
    ),
    transform: [{ scale: checkboxScale.value }],
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkProgress.value,
    transform: [
      {
        scale: interpolate(checkProgress.value, [0, 0.5, 1], [0.4, 0.9, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const burstRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringProgress.value, [0, 0.15, 1], [0, 0.55, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(ringProgress.value, [0, 1], [0.8, 1.75], Extrapolation.CLAMP),
      },
    ],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      strikeProgress.value,
      [0, 1],
      [colors.text, colors.mutedText],
    ),
  }));

  const overdue = !task.done && isOverdue(task.due);
  const isToday = !task.done && task.due !== null && task.due === todayISO();
  const dueLabel = task.due ? formatRelativeDay(task.due) : null;

  return (
    <Animated.View style={[styles.wrapper, rowAnimatedStyle]}>
      <View style={[styles.card, task.done && styles.cardDone]}>
        <Pressable
          onPress={handleCheckboxPress}
          onLongPress={handleLongPress}
          delayLongPress={380}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={
            task.done ? `Mark ${task.title} as upcoming` : `Complete ${task.title}`
          }
          accessibilityHint="Long press to delete this task"
          style={styles.checkboxTouchTarget}>
          <View style={styles.checkboxAnchor}>
            <Animated.View pointerEvents="none" style={[styles.burstRing, burstRingStyle]} />
            <Animated.View style={[styles.checkbox, checkboxAnimatedStyle]}>
              <Animated.View style={checkmarkAnimatedStyle}>
                <Ionicons
                  name="checkmark"
                  size={fontSize.body}
                  color={colors.onPrimary}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </Pressable>

        <Pressable
          onPress={handleRowPress}
          onLongPress={handleLongPress}
          delayLongPress={380}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${task.title}`}
          accessibilityHint="Tap to edit, or long press to delete this task"
          style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}>
          <View style={styles.titleBox}>
            <Animated.Text
              onTextLayout={handleTextLayout}
              style={[styles.title, titleAnimatedStyle]}>
              {task.title}
            </Animated.Text>
            {lines.length > 0 ? (
              lines.map((line, index) => (
                <StrikeLine
                  key={`${index}-${Math.round(line.y)}-${Math.round(line.width)}`}
                  line={line}
                  index={index}
                  total={lines.length}
                  progress={strikeProgress}
                />
              ))
            ) : (
              <FallbackStrikeLine progress={strikeProgress} />
            )}
          </View>

          {dueLabel ? (
            <View style={styles.dueRow}>
              {overdue ? (
                <Ionicons
                  name="time-outline"
                  size={fontSize.caption}
                  color={colors.warning}
                />
              ) : null}
              <Text
                style={[
                  styles.dueText,
                  overdue && styles.dueOverdue,
                  isToday && styles.dueToday,
                ]}>
                {dueLabel}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardDone: {
    backgroundColor: colors.surfaceAlt,
  },
  checkboxTouchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
  },
  checkboxAnchor: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstRing: {
    position: 'absolute',
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: radius.pill,
    borderWidth: spacing.xxs,
    borderColor: colors.task,
    backgroundColor: colors.taskSoft,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: radius.pill,
    borderWidth: spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  bodyPressed: {
    opacity: 0.72,
  },
  titleBox: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    position: 'relative',
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  strikeBar: {
    position: 'absolute',
    left: 0,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedText,
  },
  fallbackStrikeBar: {
    top: '50%',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dueText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.mutedText,
  },
  dueToday: {
    color: colors.task,
    fontWeight: fontWeight.semibold,
  },
  dueOverdue: {
    color: colors.warning,
    fontWeight: fontWeight.semibold,
  },
});
