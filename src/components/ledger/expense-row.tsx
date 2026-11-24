import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { confirmDestructive } from '@/lib/confirm';
import type { Category, Expense } from '@/lib/types';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatAmount = currency.format;

const categoryColors: Record<Category, string> = {
  Food: colors.expense,
  Groceries: colors.success,
  Transport: colors.task,
  Shopping: colors.primary,
  Bills: colors.warning,
  Fun: colors.danger,
  Other: colors.mutedText,
};

const entering = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const exiting = FadeOut.duration(140).reduceMotion(ReduceMotion.System);
const layout = LinearTransition.duration(180).reduceMotion(ReduceMotion.System);

export function ExpenseRow({ expense, onDelete }: { expense: Expense; onDelete: (id: string) => void }) {
  const amount = formatAmount(expense.amount);
  function confirmDelete() {
    void confirmDestructive({
      title: 'Delete expense?',
      message: `Remove ${expense.note || expense.category} (${amount}) from your ledger?`,
    }).then((confirmed) => {
      if (confirmed) onDelete(expense.id);
    });
  }

  return (
    <Animated.View entering={entering} exiting={exiting} layout={layout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[expense.note, expense.category, amount].filter(Boolean).join(', ')}
        accessibilityHint="Long press to delete this expense"
        accessibilityActions={[{ name: 'delete', label: 'Delete expense' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'delete') confirmDelete();
        }}
        onLongPress={confirmDelete}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.details}>
          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: categoryColors[expense.category] }]} />
            <Text style={styles.category}>{expense.category}</Text>
          </View>
          {expense.note ? <Text style={styles.note}>{expense.note}</Text> : null}
        </View>
        <Text style={styles.amount}>{amount}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  details: { flex: 1, alignItems: 'flex-start', gap: spacing.xs },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.pill,
  },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill },
  category: { color: colors.text, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  note: { color: colors.text, fontSize: fontSize.body },
  amount: {
    color: colors.text, fontSize: fontSize.bodyLarge, fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'], flexShrink: 1,
  },
});
