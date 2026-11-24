import { useState } from 'react';
import { View } from 'react-native';

import { confirmDestructive } from '@/lib/confirm';
import { LIST_LABEL, useStore, type ListLoadError, type ListName } from '@/lib/store';
import { spacing } from '@/theme';
import { Notice, type NoticeAction } from './notice';

function messageFor(list: ListName, error: ListLoadError | null): string {
  const label = LIST_LABEL[list];
  if (error?.kind === 'corrupt' && error.backupKey) {
    return `Your saved ${label} couldn't be read. A backup copy was kept on this phone and nothing was deleted. Try again, or start fresh with an empty ${label}.`;
  }
  if (error?.kind === 'corrupt') {
    return `Your saved ${label} couldn't be read, and a backup copy couldn't be made. Nothing was changed or deleted. Please try again.`;
  }
  return `Couldn't read your saved ${label}. Nothing was changed or deleted. Please try again.`;
}

/**
 * Non-blocking message shown when a list failed to load, with "Try again" (and,
 * once a backup exists, "Start fresh"). Renders nothing while every list is fine.
 */
export function StorageNotice({ lists }: { lists: ListName[] }) {
  const { status, loadError, retryLoad, startFresh } = useStore();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const failing = lists.filter((list) => status[list] === 'error');
  if (failing.length === 0) return null;

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setActionError(null);
    try {
      setActionError(await task());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {failing.map((list) => {
        const error = loadError[list];
        const actions: NoticeAction[] = [
          {
            label: 'Try again',
            disabled: busy,
            onPress: () =>
              void run(async () => {
                await retryLoad(list);
                return null;
              }),
          },
        ];
        if (error?.kind === 'corrupt' && error.backupKey) {
          actions.push({
            label: 'Start fresh',
            disabled: busy,
            onPress: () =>
              void run(async () => {
                const confirmed = await confirmDestructive({
                  title: `Start a new ${LIST_LABEL[list]}?`,
                  message: `Your old ${LIST_LABEL[list]} stays saved as a backup on this phone, but it won't be shown in the app.`,
                  confirmLabel: 'Start fresh',
                });
                if (!confirmed) return null;
                const result = await startFresh(list);
                return result.ok ? null : result.message;
              }),
          });
        }
        return <Notice key={list} message={messageFor(list, error)} actions={actions} />;
      })}
      {actionError ? <Notice message={actionError} onDismiss={() => setActionError(null)} /> : null}
    </View>
  );
}
