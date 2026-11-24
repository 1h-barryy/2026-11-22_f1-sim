import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/home/confirm-sheet';
import { draftFromTask, emptyDraft, toNewTask, type Draft } from '@/components/home/draft';
import { PressableScale } from '@/components/home/pressable-scale';
import { buildTaskSections, type TaskSection } from '@/components/todo/sections';
import { TaskRow } from '@/components/todo/task-row';
import { TodoEmptyState } from '@/components/todo/todo-empty-state';
import { TodoSummary } from '@/components/todo/todo-summary';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import {
  colors,
  controlSize,
  fontSize,
  fontWeight,
  iconSize,
  radius,
  spacing,
} from '@/theme';

const MOVE_HIGHLIGHT_MS = 380;
const FALLBACK_TASK_DRAFT = emptyDraft('task');

type TimerMap = Map<string, ReturnType<typeof setTimeout>>;

type SheetState =
  | { mode: 'create'; draft: Draft }
  | { mode: 'edit'; task: Task; draft: Draft };

export default function TodoScreen() {
  const { tasks, loaded, addTask, updateTask, toggleTask, deleteTask } = useStore();
  const [recentlyMovedIds, setRecentlyMovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // Created lazily and always null-checked. Fast Refresh keeps a ref's value
  // across edits, so this ref can hold whatever an earlier version stored (e.g.
  // null). Never assume it holds a Map.
  const moveTimersRef = useRef<TimerMap | null>(null);

  const getMoveTimers = useCallback((): TimerMap => {
    if (!moveTimersRef.current) moveTimersRef.current = new Map();
    return moveTimersRef.current;
  }, []);

  useEffect(() => {
    return () => {
      // Read at cleanup time on purpose: we want every timer started after mount.
      const timers = moveTimersRef.current;
      if (!timers) return;
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      const timers = getMoveTimers();
      const existing = timers.get(id);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      setRecentlyMovedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      toggleTask(id);
      const timer = setTimeout(() => {
        moveTimersRef.current?.delete(id);
        setRecentlyMovedIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, MOVE_HIGHLIGHT_MS);
      timers.set(id, timer);
    },
    [toggleTask, getMoveTimers],
  );

  const handleOpenCreate = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setSheet({ mode: 'create', draft: emptyDraft('task') });
  }, []);

  const handleOpenEdit = useCallback((task: Task) => {
    setSheet({ mode: 'edit', task, draft: draftFromTask(task) });
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheet(null);
  }, []);

  const handleSaveSheet = useCallback(
    (final: Draft) => {
      if (!sheet) return;
      const payload = toNewTask(final);
      if (sheet.mode === 'create') {
        addTask(payload);
      } else {
        updateTask(sheet.task.id, payload);
      }
      setSheet(null);
    },
    [sheet, addTask, updateTask],
  );

  const handleDeleteFromSheet = useCallback(() => {
    if (!sheet || sheet.mode !== 'edit') return;
    const target = sheet.task;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    Alert.alert('Delete task?', `Remove "${target.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(target.id);
          setSheet(null);
        },
      },
    ]);
  }, [sheet, deleteTask]);

  const { sections, upcomingCount, doneCount } = useMemo(
    () => buildTaskSections(tasks),
    [tasks],
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Task, TaskSection>) => (
      <TaskRow
        task={item}
        justMoved={recentlyMovedIds.has(item.id)}
        onPress={handleOpenEdit}
        onToggle={handleToggle}
        onDelete={deleteTask}
      />
    ),
    [recentlyMovedIds, handleOpenEdit, handleToggle, deleteTask],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TaskSection }) => (
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {section.title}
        </Text>
        <View
          style={[
            styles.countPill,
            section.key === 'upcoming' ? styles.countPillUpcoming : styles.countPillDone,
          ]}>
          <Text
            style={[
              styles.countText,
              section.key === 'upcoming' ? styles.countTextUpcoming : styles.countTextDone,
            ]}>
            {section.data.length}
          </Text>
        </View>
      </View>
    ),
    [],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {loaded ? (
        <SectionList<Task, TaskSection>
          sections={sections}
          keyExtractor={(item) => `${item.id}-${item.done ? 'done' : 'upcoming'}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={styles.title}>
                  To-do
                </Text>
                <PressableScale
                  onPress={handleOpenCreate}
                  accessibilityRole="button"
                  accessibilityLabel="Add task"
                  style={styles.addButton}>
                  <Ionicons name="add" size={iconSize.lg} color={colors.onPrimary} />
                </PressableScale>
              </View>
              {tasks.length > 0 ? (
                <TodoSummary upcomingCount={upcomingCount} doneCount={doneCount} />
              ) : null}
            </View>
          }
          ListEmptyComponent={<TodoEmptyState />}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.task}
            accessibilityLabel="Loading tasks"
          />
          <Text style={styles.loadingText}>Loading your tasks…</Text>
        </View>
      )}

      <ConfirmSheet
        visible={sheet !== null}
        initialDraft={sheet?.draft ?? FALLBACK_TASK_DRAFT}
        lockedKind="task"
        title={sheet?.mode === 'edit' ? 'Edit task' : 'New task'}
        onDelete={sheet?.mode === 'edit' ? handleDeleteFromSheet : undefined}
        onCancel={handleCloseSheet}
        onSave={handleSaveSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  header: {
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.heading,
    fontWeight: fontWeight.heavy,
  },
  addButton: {
    width: controlSize,
    height: controlSize,
    borderRadius: radius.pill,
    backgroundColor: colors.task,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
  },
  countPill: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  countPillUpcoming: {
    backgroundColor: colors.taskSoft,
  },
  countPillDone: {
    backgroundColor: colors.surfaceAlt,
  },
  countText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  countTextUpcoming: {
    color: colors.task,
  },
  countTextDone: {
    color: colors.mutedText,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.mutedText,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
});
