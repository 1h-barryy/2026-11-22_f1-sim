import type { Task } from '@/lib/types';

export type TaskSectionKey = 'upcoming' | 'done';

export interface TaskSection {
  key: TaskSectionKey;
  title: 'Upcoming' | 'Done';
  data: Task[];
}

function compareUpcoming(a: Task, b: Task): number {
  if (a.due && b.due) {
    const cmp = a.due.localeCompare(b.due);
    if (cmp !== 0) return cmp;
  } else if (a.due && !b.due) {
    return -1;
  } else if (!a.due && b.due) {
    return 1;
  }
  return b.createdAt - a.createdAt;
}

function compareDone(a: Task, b: Task): number {
  const doneDiff = (b.doneAt ?? 0) - (a.doneAt ?? 0);
  if (doneDiff !== 0) return doneDiff;
  return b.createdAt - a.createdAt;
}

export function buildTaskSections(tasks: Task[]): {
  sections: TaskSection[];
  upcomingCount: number;
  doneCount: number;
} {
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks) {
    if (task.done) done.push(task);
    else upcoming.push(task);
  }

  upcoming.sort(compareUpcoming);
  done.sort(compareDone);

  const sections: TaskSection[] = [];
  if (upcoming.length > 0) {
    sections.push({ key: 'upcoming', title: 'Upcoming', data: upcoming });
  }
  if (done.length > 0) {
    sections.push({ key: 'done', title: 'Done', data: done });
  }

  return {
    sections,
    upcomingCount: upcoming.length,
    doneCount: done.length,
  };
}
