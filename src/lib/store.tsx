// App data store: expenses and tasks, persisted to AsyncStorage.
//
// Safety rules (see REVIEW.md, Section 2 #1, #4, #5):
// - "No saved data" (key missing) and "read failed" are different. A failed or
//   unparseable read marks that list as `error`, and nothing is ever written to
//   its key until a later read succeeds. Unparseable bytes are copied to a
//   backup key first.
// - Mutations are rejected until the list has loaded.
// - Every mutation writes to disk first and only then updates state. It resolves
//   to { ok: true } after the write succeeded, or { ok: false, message } with a
//   message that is safe to show. Writes to the same list run one at a time.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { isValidISODate } from './dates';
import { CATEGORIES, type Category, type Expense, type Task } from './types';

const KEYS = {
  expenses: 'littlelife.expenses.v1',
  tasks: 'littlelife.tasks.v1',
} as const;

export type ListName = keyof typeof KEYS;
export type ListStatus = 'loading' | 'ready' | 'error';

export interface ListLoadError {
  /** read: storage threw. corrupt: the saved value isn't a readable list. */
  kind: 'read' | 'corrupt';
  /** Where the unreadable value was copied, or null if no copy could be made. */
  backupKey: string | null;
}

export type StoreResult<T = void> = { ok: true; value: T } | { ok: false; message: string };

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>;
export type NewTask = { title: string; due: string | null };
export type TaskChanges = Partial<NewTask>;

type Lists = { expenses: Expense[]; tasks: Task[] };

interface StoreValue {
  expenses: Expense[];
  tasks: Task[];
  status: Record<ListName, ListStatus>;
  loadError: Record<ListName, ListLoadError | null>;
  /** True once both lists finished their first load attempt (ready or error). */
  loaded: boolean;
  /** Read a list from storage again after a failure. */
  retryLoad: (list: ListName) => Promise<void>;
  /** Replace an unreadable list with an empty one. Only allowed once a backup exists. */
  startFresh: (list: ListName) => Promise<StoreResult>;
  addExpense: (input: NewExpense) => Promise<StoreResult<Expense>>;
  deleteExpense: (id: string) => Promise<StoreResult>;
  addTask: (input: NewTask) => Promise<StoreResult<Task>>;
  updateTask: (id: string, changes: TaskChanges) => Promise<StoreResult>;
  deleteTask: (id: string) => Promise<StoreResult>;
  toggleTask: (id: string) => Promise<StoreResult>;
}

const StoreContext = createContext<StoreValue | null>(null);

export const LIST_LABEL: Record<ListName, string> = { expenses: 'ledger', tasks: 'to-do list' };

const SAVE_FAILED_MESSAGE =
  "Couldn't save to your phone's storage, so nothing was changed. Please try again.";

function notReadyMessage(list: ListName, status: ListStatus): string {
  return status === 'loading'
    ? `Your ${LIST_LABEL[list]} is still loading. Try again in a moment.`
    : `Your saved ${LIST_LABEL[list]} couldn't be loaded, so nothing can be saved to it yet. Use "Try again" on the storage message first.`;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isExpense(x: unknown): x is Expense {
  const e = x as Expense;
  return (
    !!e &&
    typeof e.id === 'string' &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    CATEGORIES.includes(e.category as Category) &&
    typeof e.note === 'string' &&
    isValidISODate(e.date) &&
    typeof e.createdAt === 'number'
  );
}

function isTask(x: unknown): x is Task {
  const t = x as Task;
  return (
    !!t &&
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    (t.due === null || isValidISODate(t.due)) &&
    typeof t.done === 'boolean' &&
    (t.doneAt === null || typeof t.doneAt === 'number') &&
    typeof t.createdAt === 'number'
  );
}

const GUARDS = { expenses: isExpense, tasks: isTask } as const;

function devWarn(context: string, err: unknown): void {
  if (__DEV__) console.warn(`[store] ${context}`, err);
}

// Remember backups made this session so retries don't pile up identical copies.
const backups = new Map<string, { raw: string; backupKey: string }>();

/** Copy an unreadable raw value to a new key. Returns the key, or null if that failed. */
async function backupRaw(key: string, raw: string): Promise<string | null> {
  const existing = backups.get(key);
  if (existing && existing.raw === raw) return existing.backupKey;
  const backupKey = `${key}.backup.${Date.now()}`;
  try {
    await AsyncStorage.setItem(backupKey, raw);
    backups.set(key, { raw, backupKey });
    return backupKey;
  } catch (err) {
    devWarn(`failed to back up ${key}`, err);
    return null;
  }
}

type LoadOutcome<T> = { ok: true; items: T[] } | { ok: false; error: ListLoadError };

async function loadList<T>(key: string, guard: (x: unknown) => x is T): Promise<LoadOutcome<T>> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (err) {
    devWarn(`failed to read ${key}`, err);
    return { ok: false, error: { kind: 'read', backupKey: null } };
  }

  // Nothing saved yet: a genuinely empty list.
  if (raw === null || raw === '') return { ok: true, items: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!Array.isArray(parsed)) {
    devWarn(`${key} is not a readable list`, raw.slice(0, 200));
    return { ok: false, error: { kind: 'corrupt', backupKey: await backupRaw(key, raw) } };
  }

  const items = parsed.filter(guard);
  if (items.length < parsed.length) {
    // Some entries are unreadable. The next write would drop them, so keep a copy
    // of the original first; if that copy can't be made, refuse to load.
    devWarn(`${key}: ${parsed.length - items.length} unreadable entries`, null);
    const backupKey = await backupRaw(key, raw);
    if (!backupKey) return { ok: false, error: { kind: 'corrupt', backupKey: null } };
  }
  return { ok: true, items };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<Lists>({ expenses: [], tasks: [] });
  const [status, setStatus] = useState<Record<ListName, ListStatus>>({
    expenses: 'loading',
    tasks: 'loading',
  });
  const [loadError, setLoadError] = useState<Record<ListName, ListLoadError | null>>({
    expenses: null,
    tasks: null,
  });

  // Latest committed values, read by mutations (which run outside render).
  const listsRef = useRef<Lists>({ expenses: [], tasks: [] });
  const statusRef = useRef<Record<ListName, ListStatus>>({ expenses: 'loading', tasks: 'loading' });
  const loadErrorRef = useRef<Record<ListName, ListLoadError | null>>({ expenses: null, tasks: null });
  // Per-list operation queues, so two quick edits can't overwrite each other.
  const queuesRef = useRef<Record<ListName, Promise<unknown>>>({
    expenses: Promise.resolve(),
    tasks: Promise.resolve(),
  });

  const setListStatus = useCallback((list: ListName, next: ListStatus) => {
    statusRef.current = { ...statusRef.current, [list]: next };
    setStatus(statusRef.current);
  }, []);

  const setListError = useCallback((list: ListName, next: ListLoadError | null) => {
    loadErrorRef.current = { ...loadErrorRef.current, [list]: next };
    setLoadError(loadErrorRef.current);
  }, []);

  const commitList = useCallback(<K extends ListName>(list: K, items: Lists[K]) => {
    listsRef.current = { ...listsRef.current, [list]: items };
    setLists(listsRef.current);
  }, []);

  /** Run `task` after every earlier operation on the same list has finished. */
  const enqueue = useCallback(<T,>(list: ListName, task: () => Promise<T>): Promise<T> => {
    const run = queuesRef.current[list].then(task, task);
    queuesRef.current[list] = run.catch(() => undefined);
    return run;
  }, []);

  const load = useCallback(
    (list: ListName) =>
      enqueue(list, async () => {
        setListStatus(list, 'loading');
        const outcome = await loadList<Expense | Task>(KEYS[list], GUARDS[list]);
        if (outcome.ok) {
          commitList(list, outcome.items as Lists[typeof list]);
          setListError(list, null);
          setListStatus(list, 'ready');
        } else {
          setListError(list, outcome.error);
          setListStatus(list, 'error');
        }
      }),
    [enqueue, setListStatus, setListError, commitList],
  );

  useEffect(() => {
    void load('expenses');
    void load('tasks');
  }, [load]);

  /**
   * Compute the next list from the latest saved one, write it, then commit it.
   * Never writes unless the list loaded successfully.
   */
  const mutate = useCallback(
    <K extends ListName, R>(
      list: K,
      compute: (prev: Lists[K]) => { next: Lists[K]; value: R } | { error: string },
    ): Promise<StoreResult<R>> =>
      enqueue(list, async (): Promise<StoreResult<R>> => {
        const current = statusRef.current[list];
        if (current !== 'ready') return { ok: false, message: notReadyMessage(list, current) };

        const out = compute(listsRef.current[list]);
        if ('error' in out) return { ok: false, message: out.error };

        try {
          await AsyncStorage.setItem(KEYS[list], JSON.stringify(out.next));
        } catch (err) {
          devWarn(`failed to save ${KEYS[list]}`, err);
          return { ok: false, message: SAVE_FAILED_MESSAGE };
        }
        commitList(list, out.next);
        return { ok: true, value: out.value };
      }),
    [enqueue, commitList],
  );

  const retryLoad = useCallback((list: ListName) => load(list), [load]);

  const startFresh = useCallback(
    (list: ListName) =>
      enqueue(list, async (): Promise<StoreResult> => {
        if (statusRef.current[list] !== 'error') return { ok: true, value: undefined };
        const error = loadErrorRef.current[list];
        if (!error || error.kind !== 'corrupt' || !error.backupKey) {
          return { ok: false, message: "No backup copy exists yet, so the saved data can't be replaced." };
        }
        try {
          await AsyncStorage.setItem(KEYS[list], '[]');
        } catch (err) {
          devWarn(`failed to reset ${KEYS[list]}`, err);
          return { ok: false, message: SAVE_FAILED_MESSAGE };
        }
        commitList(list, []);
        setListError(list, null);
        setListStatus(list, 'ready');
        return { ok: true, value: undefined };
      }),
    [enqueue, commitList, setListError, setListStatus],
  );

  const addExpense = useCallback(
    (input: NewExpense) =>
      mutate('expenses', (prev) => {
        const expense: Expense = { ...input, id: makeId(), createdAt: Date.now() };
        return { next: [expense, ...prev], value: expense };
      }),
    [mutate],
  );

  const deleteExpense = useCallback(
    (id: string) =>
      mutate('expenses', (prev) => ({ next: prev.filter((e) => e.id !== id), value: undefined })),
    [mutate],
  );

  const addTask = useCallback(
    (input: NewTask) =>
      mutate('tasks', (prev) => {
        const task: Task = {
          id: makeId(),
          title: input.title,
          due: input.due,
          done: false,
          doneAt: null,
          createdAt: Date.now(),
        };
        return { next: [task, ...prev], value: task };
      }),
    [mutate],
  );

  const updateTask = useCallback(
    (id: string, changes: TaskChanges) =>
      mutate('tasks', (prev) => {
        if (!prev.some((t) => t.id === id)) return { error: 'That task no longer exists.' };
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(changes.title !== undefined ? { title: changes.title } : {}),
                ...(changes.due !== undefined ? { due: changes.due } : {}),
              }
            : t,
        );
        return { next, value: undefined };
      }),
    [mutate],
  );

  const deleteTask = useCallback(
    (id: string) =>
      mutate('tasks', (prev) => ({ next: prev.filter((t) => t.id !== id), value: undefined })),
    [mutate],
  );

  const toggleTask = useCallback(
    (id: string) =>
      mutate('tasks', (prev) => {
        if (!prev.some((t) => t.id === id)) return { error: 'That task no longer exists.' };
        const next = prev.map((t) =>
          t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t,
        );
        return { next, value: undefined };
      }),
    [mutate],
  );

  const loaded = status.expenses !== 'loading' && status.tasks !== 'loading';

  const value = useMemo<StoreValue>(
    () => ({
      expenses: lists.expenses,
      tasks: lists.tasks,
      status,
      loadError,
      loaded,
      retryLoad,
      startFresh,
      addExpense,
      deleteExpense,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
    }),
    [
      lists,
      status,
      loadError,
      loaded,
      retryLoad,
      startFresh,
      addExpense,
      deleteExpense,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
