import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRow, formatAmount } from '@/components/ledger/expense-row';
import { Notice } from '@/components/ui/notice';
import { StorageNotice } from '@/components/ui/storage-notice';
import { formatRelativeDay, parseISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { useToday } from '@/lib/today';
import type { Expense } from '@/lib/types';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export default function LedgerScreen() {
  const { expenses, status, deleteExpense } = useStore();
  const [actionError, setActionError] = useState<string | null>(null);
  // Refreshes at local midnight and on foreground, so the month total rolls over.
  const today = useToday();
  const month = today.slice(0, 7);
  const monthLabel = (parseISODate(today) ?? new Date()).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const handleDelete = useCallback(
    async (id: string) => {
      setActionError(null);
      const result = await deleteExpense(id);
      if (!result.ok) setActionError(result.message);
    },
    [deleteExpense],
  );
  const { total, sections } = useMemo(() => {
    const days = new Map<string, Expense[]>();
    let cents = 0;
    for (const expense of expenses) {
      if (expense.date.startsWith(month)) cents += Math.round(expense.amount * 100);
      const entries = days.get(expense.date);
      if (entries) entries.push(expense);
      else days.set(expense.date, [expense]);
    }
    return {
      total: cents / 100,
      sections: Array.from(days, ([key, entries]) => ({
        key,
        data: entries.sort((a, b) => b.createdAt - a.createdAt),
      })).sort((a, b) => b.key.localeCompare(a.key)),
    };
  }, [expenses, month]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {status.expenses !== 'loading' ? (
        <SectionList
          sections={sections}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>Ledger</Text>
              <StorageNotice lists={['expenses']} />
              {actionError ? (
                <Notice message={actionError} onDismiss={() => setActionError(null)} />
              ) : null}
              <View style={styles.summary}>
                <Text style={styles.month}>{monthLabel} spending</Text>
                <Text style={styles.total}>{formatAmount(total)}</Text>
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text accessibilityRole="header" style={styles.day}>{formatRelativeDay(section.key, today)}</Text>
          )}
          renderItem={({ item }) => <ExpenseRow expense={item} onDelete={handleDelete} />}
          ListEmptyComponent={
            // Don't claim "starts here" when the saved ledger just couldn't be read.
            status.expenses === 'error' ? undefined : (
            <View style={styles.empty}>
              <Text accessible={false} style={styles.emoji}>🌱</Text>
              <Text style={styles.emptyTitle}>Your ledger starts here</Text>
              <Text style={styles.hint}>Add your first expense from Home.</Text>
            </View>
            )
          }
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.expense}
            accessibilityLabel="Loading expenses"
          />
          <Text style={styles.loadingText}>Loading your expenses…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  header: { gap: spacing.lg },
  title: { color: colors.text, fontSize: fontSize.heading, fontWeight: fontWeight.heavy },
  summary: { backgroundColor: colors.expenseSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  month: { color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  total: { color: colors.text, fontSize: fontSize.display, fontWeight: fontWeight.heavy, fontVariant: ['tabular-nums'] },
  day: { color: colors.text, fontSize: fontSize.bodyLarge, fontWeight: fontWeight.bold, marginTop: spacing.xl, marginBottom: spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.mutedText, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  empty: { paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: fontSize.display },
  emptyTitle: { color: colors.text, fontSize: fontSize.title, fontWeight: fontWeight.bold, textAlign: 'center' },
  hint: { color: colors.mutedText, fontSize: fontSize.body, fontWeight: fontWeight.regular, textAlign: 'center' },
});
