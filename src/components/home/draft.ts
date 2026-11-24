// Editable draft shown in the confirmation card, plus validation rules.
// Fields are kept as strings while editing; they're converted on save.

import { isValidISODate, todayISO } from '@/lib/dates';
import { MAX_AMOUNT, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH } from '@/lib/limits';
import type { NewExpense, NewTask } from '@/lib/store';
import type { Category, ParseResult, Task } from '@/lib/types';

export { MAX_AMOUNT, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH };

export type DraftKind = 'expense' | 'task';

export interface Draft {
  kind: DraftKind;
  // expense
  amount: string;
  category: Category;
  note: string;
  date: string;
  // task
  title: string;
  due: string | null;
}

export type DraftField = 'amount' | 'note' | 'date' | 'title' | 'due';
export type DraftErrors = Partial<Record<DraftField, string>>;

export function emptyDraft(kind: DraftKind = 'expense'): Draft {
  return { kind, amount: '', category: 'Other', note: '', date: todayISO(), title: '', due: null };
}

export function draftFromParse(result: ParseResult): Draft {
  if (result.kind === 'expense') {
    return {
      ...emptyDraft('expense'),
      amount: formatAmountInput(result.amount),
      category: result.category,
      note: result.note,
      date: result.date,
      // Pre-fill the other side so toggling kinds doesn't lose context.
      title: result.note,
    };
  }
  return { ...emptyDraft('task'), title: result.title, due: result.due, note: result.title };
}

export function draftFromTask(task: Pick<Task, 'title' | 'due'>): Draft {
  return { ...emptyDraft('task'), title: task.title, due: task.due, note: task.title };
}

/** Switch kind, carrying the description across if the other side is empty. */
export function switchKind(draft: Draft, kind: DraftKind): Draft {
  if (draft.kind === kind) return draft;
  if (kind === 'task' && !draft.title.trim()) return { ...draft, kind, title: draft.note };
  if (kind === 'expense' && !draft.note.trim()) return { ...draft, kind, note: draft.title };
  return { ...draft, kind };
}

function formatAmountInput(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** "$1,234.50" -> 1234.5. Returns NaN if it isn't a plain number. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return NaN;
  return Number(cleaned);
}

export function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};

  if (draft.kind === 'expense') {
    const amount = parseAmount(draft.amount);
    if (!draft.amount.trim()) errors.amount = 'Enter an amount.';
    else if (!Number.isFinite(amount)) errors.amount = 'Use numbers only, like 12.50.';
    else if (amount <= 0) errors.amount = 'Amount must be more than 0.';
    else if (amount > MAX_AMOUNT) errors.amount = 'That amount is too large.';
    // Compare with a tolerance: 4.35 * 100 === 434.99999999999994 in floating point.
    else if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
      errors.amount = 'Use at most 2 decimal places.';
    }

    if (draft.note.trim().length > MAX_NOTE_LENGTH) {
      errors.note = `Keep the note under ${MAX_NOTE_LENGTH} characters.`;
    }
    if (!isValidISODate(draft.date)) errors.date = 'Pick a valid date (YYYY-MM-DD).';
  } else {
    const title = draft.title.trim();
    if (!title) errors.title = 'Give the task a name.';
    else if (title.length > MAX_TITLE_LENGTH) {
      errors.title = `Keep it under ${MAX_TITLE_LENGTH} characters.`;
    }
    if (draft.due !== null && !isValidISODate(draft.due)) {
      errors.due = 'Pick a valid date (YYYY-MM-DD) or choose "No date".';
    }
  }

  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Call only after validateDraft returned no errors. */
export function toNewExpense(draft: Draft): NewExpense {
  return {
    amount: Math.round(parseAmount(draft.amount) * 100) / 100,
    category: draft.category,
    note: draft.note.trim(),
    date: draft.date,
  };
}

/** Call only after validateDraft returned no errors. */
export function toNewTask(draft: Draft): NewTask {
  return { title: draft.title.trim(), due: draft.due };
}
