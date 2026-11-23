import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { CATEGORIES, type Category, type Expense, type Task } from './types';

const EXPENSES_KEY = 'littlelife.expenses.v1';
const TASKS_KEY = 'littlelife.tasks.v1';

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>;
export type NewTask = { title: string; due: string | null };

interface StoreValue {
  expenses: Expense[];
  tasks: Task[];
  loaded: boolean;
  addExpense: (input: NewExpense) => Expense;
  deleteExpense: (id: string) => void;
  addTask: (input: NewTask) => Task;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function isExpense(x: unknown): x is Expense {
  const e = x as Expense;
  return (
    !!e &&
    typeof e.id === 'string' &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    CATEGORIES.includes(e.category as Category) &&
    typeof e.note === 'string' &&
    typeof e.date === 'string' &&
    ISO_RE.test(e.date) &&
    typeof e.createdAt === 'number'
  );
}

function isTask(x: unknown): x is Task {
  const t = x as Task;
  return (
    !!t &&
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    (t.due === null || (typeof t.due === 'string' && ISO_RE.test(t.due))) &&
    typeof t.done === 'boolean' &&
    (t.doneAt === null || typeof t.doneAt === 'number') &&
    typeof t.createdAt === 'number'
  );
}

/** Read a JSON array from storage; anything missing or corrupted becomes []. */
async function loadList<T>(key: string, guard: (x: unknown) => x is T): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch (err) {
    console.warn(`[store] failed to load ${key}`, err);
    return [];
  }
}

async function saveList(key: string, list: unknown[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    console.warn(`[store] failed to save ${key}`, err);
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [e, t] = await Promise.all([
        loadList(EXPENSES_KEY, isExpense),
        loadList(TASKS_KEY, isTask),
      ]);
      if (cancelled) return;
      setExpenses(e);
      setTasks(t);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change, but never before hydration (would wipe saved data).
  useEffect(() => {
    if (loaded) void saveList(EXPENSES_KEY, expenses);
  }, [expenses, loaded]);

  useEffect(() => {
    if (loaded) void saveList(TASKS_KEY, tasks);
  }, [tasks, loaded]);

  const addExpense = useCallback((input: NewExpense): Expense => {
    const expense: Expense = { ...input, id: makeId(), createdAt: Date.now() };
    setExpenses((prev) => [expense, ...prev]);
    return expense;
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addTask = useCallback((input: NewTask): Task => {
    const task: Task = {
      id: makeId(),
      title: input.title,
      due: input.due,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
    };
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t,
      ),
    );
  }, []);

  const value = useMemo<StoreValue>(
    () => ({ expenses, tasks, loaded, addExpense, deleteExpense, addTask, deleteTask, toggleTask }),
    [expenses, tasks, loaded, addExpense, deleteExpense, addTask, deleteTask, toggleTask],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
