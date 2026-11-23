export type Category = 'Food' | 'Groceries' | 'Transport' | 'Shopping' | 'Bills' | 'Fun' | 'Other';

export const CATEGORIES: readonly Category[] = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Fun',
  'Other',
];

export interface Expense {
  id: string;
  amount: number;
  category: Category;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  due: string | null; // YYYY-MM-DD
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

export type ParseResult =
  | { kind: 'expense'; amount: number; category: Category; note: string; date: string }
  | { kind: 'task'; title: string; due: string | null };

export interface ApiError {
  error: string;
}
