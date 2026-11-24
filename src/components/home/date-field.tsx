import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  formatRelativeDay,
  isValidISODate,
  todayISO,
  tomorrowISO,
  yesterdayISO,
} from '@/lib/dates';
import { borderWidth, colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { PressableScale } from './pressable-scale';

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Expense dates offer "Yesterday"; task due dates offer "No date". */
  mode: 'expense' | 'due';
  accent: string;
  accentSoft: string;
  error?: string;
};

/** Quick-pick chips plus a free-form YYYY-MM-DD field. No native picker needed. */
export function DateField({ value, onChange, mode, accent, accentSoft, error }: Props) {
  const today = todayISO();
  const tomorrow = tomorrowISO();
  const chips: { label: string; value: string | null }[] =
    mode === 'expense'
      ? [
          { label: 'Yesterday', value: yesterdayISO() },
          { label: 'Today', value: today },
        ]
      : [
          { label: 'No date', value: null },
          { label: 'Today', value: today },
          { label: 'Tomorrow', value: tomorrow },
        ];

  const valid = value !== null && isValidISODate(value);
  const isChip = chips.some((c) => c.value === value);

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {chips.map((chip) => {
          const selected = chip.value === value;
          return (
            <PressableScale
              key={chip.label}
              onPress={() => onChange(chip.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                selected && { backgroundColor: accentSoft, borderColor: accent },
              ]}>
              <Text style={[styles.chipText, selected && { color: accent }]}>{chip.label}</Text>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={value ?? ''}
          onChangeText={(t) => onChange(t.trim() === '' && mode === 'due' ? null : t.trim())}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedText}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          maxLength={10}
          style={[styles.input, error ? styles.inputError : null]}
          accessibilityLabel={mode === 'expense' ? 'Date' : 'Due date'}
        />
        {valid && !isChip ? <Text style={styles.hint}>{formatRelativeDay(value)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: borderWidth.medium,
    borderColor: colors.surfaceAlt,
  },
  chipText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.mutedText },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: borderWidth.medium,
    borderColor: colors.surfaceAlt,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  hint: { fontSize: fontSize.small, color: colors.mutedText },
});
