import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet, type SheetOutcome } from '@/components/home/confirm-sheet';
import { draftFromTask, emptyDraft, toNewTask, type Draft } from '@/components/home/draft';
import { PressableScale } from '@/components/home/pressable-scale';
import { buildTaskSections, type TaskSection } from '@/components/todo/sections';
import { TaskRow } from '@/components/todo/task-row';
import { TodoEmptyState } from '@/components/todo/todo-empty-state';
import { TodoSummary } from '@/components/todo/todo-summary';
import { Notice } from '@/components/ui/notice';
import { StorageNotice } from '@/components/ui/storage-notice';
import { confirmDestructive } from '@/lib/confirm';
import { useStore } from '@/lib/store';
import { useToday } from '@/lib/today';
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
  const { tasks, status, addTask, updateTask, toggleTask, deleteTask } = useStore();
  const today = useToday();
  const [recentlyMovedIds, setRecentlyMovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Tasks whose check / uncheck animation is playing; the commit is scheduled here.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Created lazily and always null-checked. Fast Refresh keeps a ref's value
  // across edits, so these refs can hold whatever an earlier version stored
  // (e.g. null). Never assume they hold a Map.
  const moveTimersRef = useRef<TimerMap | null>(null);
  const commitTimersRef = useRef<TimerMap | null>(null);
  const mountedRef = useRef(false);

  const getMoveTimers = useCallback((): TimerMap => {
    if (!moveTimersRef.current) moveTimersRef.current = new Map();
    return moveTimersRef.current;
  }, []);

  const getCommitTimers = useCallback((): TimerMap => {
    if (!commitTimersRef.current) commitTimersRef.current = new Map();
    return commitTimersRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Read at cleanup time on purpose: we want every timer started after mount.
      const moveTimers = moveTimersRef.current;
      if (moveTimers) {
        for (const timer of moveTimers.values()) clearTimeout(timer);
        moveTimers.clear();
      }
      // A check-off the user already saw must not be lost: commit it now.
      const commitTimers = commitTimersRef.current;
      if (commitTimers) {
        for (const [id, timer] of commitTimers) {
          clearTimeout(timer);
          void toggleTask(id);
        }
        commitTimers.clear();
      }
    };
  }, [toggleTask]);

  const setInSet = useCallback(
    (setter: typeof setPendingIds, id: string, present: boolean) =>
      setter((prev) => {
        if (prev.has(id) === present) return prev;
        const next = new Set(prev);
        if (present) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );

  const commitToggle = useCallback(
    async (id: string) => {
      commitTimersRef.current?.delete(id);
      // Mark first so the row that mounts in its new section plays its entry.
      setInSet(setRecentlyMovedIds, id, true);
      const result = await toggleTask(id);
      if (!mountedRef.current) return;
      setInSet(setPendingIds, id, false);
      if (!result.ok) {
        setInSet(setRecentlyMovedIds, id, false);
        setActionError(result.message);
        return;
      }
      const timers = getMoveTimers();
      const existing = timers.get(id);
      if (existing !== undefined) clearTimeout(existing);
      timers.set(
        id,
        setTimeout(() => {
          moveTimersRef.current?.delete(id);
          setInSet(setRecentlyMovedIds, id, false);
        }, MOVE_HIGHLIGHT_MS),
      );
    },
    [toggleTask, getMoveTimers, setInSet],
  );

  const handleToggle = useCallback(
    (id: string, commitDelayMs: number) => {
      const timers = getCommitTimers();
      if (timers.has(id)) return;
      setActionError(null);
      setInSet(setPendingIds, id, true);
      timers.set(
        id,
        setTimeout(() => void commitToggle(id), commitDelayMs),
      );
    },
    [getCommitTimers, commitToggle, setInSet],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setActionError(null);
      const result = await deleteTask(id);
      if (!result.ok && mountedRef.current) setActionError(result.message);
    },
    [deleteTask],
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

  // Close the sheet only after the write succeeded; otherwise it keeps the draft
  // and shows the error.
  const handleSaveSheet = useCallback(
    async (final: Draft): Promise<SheetOutcome> => {
      if (!sheet) return { ok: true };
      const payload = toNewTask(final);
      const result =
        sheet.mode === 'create'
          ? await addTask(payload)
          : await updateTask(sheet.task.id, payload);
      if (!result.ok) return { ok: false, message: result.message };
      setSheet(null);
      return { ok: true };
    },
    [sheet, addTask, updateTask],
  );

  const handleDeleteFromSheet = useCallback(async (): Promise<SheetOutcome | null> => {
    if (!sheet || sheet.mode !== 'edit') return null;
    const target = sheet.task;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const confirmed = await confirmDestructive({
      title: 'Delete task?',
      message: `Remove "${target.title}"?`,
    });
    if (!confirmed) return null;
    const result = await deleteTask(target.id);
    if (!result.ok) return { ok: false, message: result.message };
    setSheet(null);
    return { ok: true };
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
        pending={pendingIds.has(item.id)}
        today={today}
        onPress={handleOpenEdit}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
    ),
    [recentlyMovedIds, pendingIds, today, handleOpenEdit, handleToggle, handleDelete],
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
      {status.tasks !== 'loading' ? (
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
              <StorageNotice lists={['tasks']} />
              {actionError ? (
                <Notice message={actionError} onDismiss={() => setActionError(null)} />
              ) : null}
              {tasks.length > 0 ? (
                <TodoSummary upcomingCount={upcomingCount} doneCount={doneCount} />
              ) : null}
            </View>
          }
          // Don't show "wide open" when the saved list just couldn't be read.
          ListEmptyComponent={status.tasks === 'error' ? undefined : <TodoEmptyState />}
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
