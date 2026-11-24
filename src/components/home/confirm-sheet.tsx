import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/lib/types';
import {
  borderWidth,
  colors,
  fontSize,
  fontWeight,
  iconSize,
  letterSpacing,
  lineHeight,
  radius,
  spacing,
} from '@/theme';
import { DateField } from './date-field';
import {
  hasErrors,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  switchKind,
  validateDraft,
  type Draft,
  type DraftKind,
} from './draft';
import { PressableScale } from './pressable-scale';

type Props = {
  visible: boolean;
  /** Draft to start from each time the sheet opens. */
  initialDraft: Draft;
  /** Shown at the top, e.g. when parsing failed and the user is entering manually. */
  notice?: string | null;
  /** Lock the sheet to a single kind (hides the Expense / Task toggle). */
  lockedKind?: DraftKind;
  /** Custom heading shown at the top of the sheet. */
  title?: string;
  /** Optional delete action shown in edit mode. */
  onDelete?: () => void;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
};

const CATEGORY_EMOJI: Record<(typeof CATEGORIES)[number], string> = {
  Food: '🍜',
  Groceries: '🛒',
  Transport: '🚌',
  Shopping: '🛍️',
  Bills: '🧾',
  Fun: '🎉',
  Other: '✨',
};

const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 5;

export function ConfirmSheet({
  visible,
  initialDraft,
  notice,
  lockedKind,
  title,
  onDelete,
  onCancel,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(() =>
    lockedKind ? { ...initialDraft, kind: lockedKind } : initialDraft,
  );
  const [showErrors, setShowErrors] = useState(false);

  // Reset whenever the sheet is opened with a new draft.
  useEffect(() => {
    if (visible) {
      setDraft(lockedKind ? { ...initialDraft, kind: lockedKind } : initialDraft);
      setShowErrors(false);
    }
  }, [visible, initialDraft, lockedKind]);

  const errors = validateDraft(draft);
  const visibleErrors = showErrors ? errors : {};
  const isExpense = draft.kind === 'expense';
  const accent = isExpense ? colors.expense : colors.task;
  const accentSoft = isExpense ? colors.expenseSoft : colors.taskSoft;
  const heading = title ?? (notice ? 'Add it yourself' : 'Does this look right?');

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const setKind = (kind: DraftKind) => {
    if (lockedKind || kind === draft.kind) return;
    Haptics.selectionAsync().catch(() => {});
    setDraft((d) => switchKind(d, kind));
  };

  const handleSave = () => {
    if (hasErrors(errors)) {
      setShowErrors(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSave(draft);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Backdrop: tap to cancel. */}
        <Pressable style={styles.flex} onPress={onCancel} accessibilityLabel="Close" accessibilityRole="button">
          <View style={styles.backdrop} />
        </Pressable>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.heading}>{heading}</Text>

            {notice ? (
              <View style={styles.notice}>
                <Ionicons name="information-circle" size={iconSize.md} color={colors.warning} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {/* Expense / Task toggle */}
            {!lockedKind ? (
              <View style={styles.toggle} accessibilityRole="tablist">
                {(['expense', 'task'] as const).map((kind) => {
                  const selected = draft.kind === kind;
                  const kindAccent = kind === 'expense' ? colors.expense : colors.task;
                  return (
                    <PressableScale
                      key={kind}
                      pressedScale={0.97}
                      onPress={() => setKind(kind)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      style={[styles.toggleItem, selected && { backgroundColor: kindAccent }]}>
                      <Ionicons
                        name={kind === 'expense' ? 'wallet' : 'checkbox'}
                        size={iconSize.sm}
                        color={selected ? colors.onPrimary : colors.mutedText}
                      />
                      <Text style={[styles.toggleText, selected && { color: colors.onPrimary }]}>
                        {kind === 'expense' ? 'Expense' : 'Task'}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            {isExpense ? (
              <>
                <Field label="Amount" error={visibleErrors.amount}>
                  <View style={[styles.amountRow, visibleErrors.amount ? styles.inputError : null]}>
                    <Text style={[styles.currency, { color: accent }]}>$</Text>
                    <TextInput
                      value={draft.amount}
                      onChangeText={(amount) => update({ amount })}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedText}
                      keyboardType="decimal-pad"
                      style={styles.amountInput}
                      accessibilityLabel="Amount"
                    />
                  </View>
                </Field>

                <Field label="Category">
                  <View style={styles.chips}>
                    {CATEGORIES.map((category) => {
                      const selected = draft.category === category;
                      return (
                        <PressableScale
                          key={category}
                          onPress={() => update({ category })}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={[
                            styles.chip,
                            selected && { backgroundColor: accentSoft, borderColor: accent },
                          ]}>
                          <Text style={[styles.chipText, selected && { color: accent }]}>
                            {CATEGORY_EMOJI[category]} {category}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Note" error={visibleErrors.note}>
                  <TextInput
                    value={draft.note}
                    onChangeText={(note) => update({ note })}
                    placeholder="What was it for?"
                    placeholderTextColor={colors.mutedText}
                    maxLength={MAX_NOTE_LENGTH + 20}
                    style={[styles.input, visibleErrors.note ? styles.inputError : null]}
                    accessibilityLabel="Note"
                  />
                </Field>

                <Field label="Date" error={visibleErrors.date}>
                  <DateField
                    mode="expense"
                    value={draft.date}
                    onChange={(date) => update({ date: date ?? '' })}
                    accent={accent}
                    accentSoft={accentSoft}
                    error={visibleErrors.date}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Task" error={visibleErrors.title}>
                  <TextInput
                    value={draft.title}
                    onChangeText={(title) => update({ title })}
                    placeholder="What needs doing?"
                    placeholderTextColor={colors.mutedText}
                    maxLength={MAX_TITLE_LENGTH + 20}
                    style={[styles.input, visibleErrors.title ? styles.inputError : null]}
                    accessibilityLabel="Task title"
                  />
                </Field>

                <Field label="Due" error={visibleErrors.due}>
                  <DateField
                    mode="due"
                    value={draft.due}
                    onChange={(due) => update({ due })}
                    accent={accent}
                    accentSoft={accentSoft}
                    error={visibleErrors.due}
                  />
                </Field>
              </>
            )}

            <View style={styles.actions}>
              <PressableScale
                onPress={onCancel}
                accessibilityRole="button"
                style={[styles.button, styles.cancelButton]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </PressableScale>
              <PressableScale
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel={isExpense ? 'Save expense' : 'Save task'}
                style={[styles.button, styles.saveButton, { backgroundColor: accent }]}>
                <Ionicons name="checkmark" size={iconSize.md} color={colors.onPrimary} />
                <Text style={styles.saveText}>Save</Text>
              </PressableScale>
            </View>

            {onDelete ? (
              <PressableScale
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel={isExpense ? 'Delete expense' : 'Delete task'}
                style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={iconSize.sm} color={colors.danger} />
                <Text style={styles.deleteText}>Delete</Text>
              </PressableScale>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.text, opacity: 0.3 },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.lg },
  heading: { fontSize: fontSize.title, fontWeight: fontWeight.heavy, color: colors.text },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: fontSize.small, color: colors.text, lineHeight: lineHeight.small },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  toggleText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.mutedText },
  field: { gap: spacing.sm },
  label: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: borderWidth.medium,
    borderColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
  },
  currency: { fontSize: fontSize.heading, fontWeight: fontWeight.heavy, marginRight: spacing.xs },
  amountInput: {
    flex: 1,
    fontSize: fontSize.heading,
    fontWeight: fontWeight.bold,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  input: {
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
  errorText: { fontSize: fontSize.small, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: borderWidth.medium,
    borderColor: colors.surfaceAlt,
  },
  chipText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
  },
  cancelButton: { backgroundColor: colors.surfaceAlt },
  cancelText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.mutedText },
  saveButton: {},
  saveText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.onPrimary },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  deleteText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.danger },
});
