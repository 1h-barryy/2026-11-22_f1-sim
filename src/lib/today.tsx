// A shared "today" (YYYY-MM-DD, local time) that refreshes at local midnight
// and whenever the app comes back to the foreground, so labels like Today /
// Tomorrow / overdue and the Ledger's month total never go stale on screen.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { todayISO } from './dates';

const TodayContext = createContext<string | null>(null);

function msUntilNextMidnight(): number {
  const now = new Date();
  // One second past midnight, so we land safely on the new day.
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

export function TodayProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Same string => React skips the re-render, so refreshing often is cheap.
    const refresh = () => {
      setToday(todayISO());
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextMidnight());
    };
    refresh();

    // JS timers pause in the background; re-check on every return to the foreground.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return <TodayContext.Provider value={today}>{children}</TodayContext.Provider>;
}

/** Today's local date as YYYY-MM-DD. Updates at midnight and on foreground. */
export function useToday(): string {
  return useContext(TodayContext) ?? todayISO();
}
