import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/home/confirm-sheet';
import { draftFromParse, emptyDraft, toNewExpense, toNewTask, type Draft } from '@/components/home/draft';
import { MicButton } from '@/components/home/mic-button';
import { PressableScale } from '@/components/home/pressable-scale';
import { Toast, type ToastData } from '@/components/home/toast';
import { useVoiceInput } from '@/components/home/use-voice-input';
import { ApiClientError, parseText } from '@/lib/api';
import { MAX_INPUT_LENGTH as MAX_LENGTH } from '@/lib/limits';
import { useStore } from '@/lib/store';
import {
  borderWidth,
  colors,
  controlSize,
  fontSize,
  fontWeight,
  iconSize,
  letterSpacing,
  lineHeight,
  radius,
  spacing,
} from '@/theme';

const TOAST_MS = 1800;
const INPUT_MIN_HEIGHT = 96;
const INPUT_MAX_HEIGHT = 180;
const RECORDING_DOT_SIZE = spacing.sm + spacing.xxs; // 10

const EXAMPLES = ['Spent $12 on lunch', 'Groceries $48 yesterday', 'Finish my homework tomorrow'];

/** Best guess for the manual-entry card when parsing failed. */
function guessKind(text: string): Draft['kind'] {
  return /\d/.test(text) ? 'expense' : 'task';
}

export default function HomeScreen() {
  const { addExpense, addTask } = useStore();

  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [notice, setNotice] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastData | null>(null);

  const onTranscript = useCallback((spoken: string) => {
    setMessage(null);
    // Put the words in the input for editing. Never auto-send.
    setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${spoken}` : spoken).slice(0, MAX_LENGTH));
  }, []);
  const voice = useVoiceInput({ onTranscript, onError: setMessage });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const trimmed = text.trim();
  const busy = parsing || voice.state !== 'idle';
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !busy;

  const handleSend = async () => {
    if (!canSend) return;
    Keyboard.dismiss();
    setMessage(null);
    setParsing(true);
    try {
      const result = await parseText(trimmed);
      setDraft(draftFromParse(result));
      setNotice(null);
    } catch (err) {
      const reason = err instanceof ApiClientError ? err.message : 'Something went wrong.';
      setDraft(emptyDraft(guessKind(trimmed)));
      setNotice(`${reason} You can fill it in yourself below.`);
    } finally {
      setParsing(false);
      setSheetOpen(true);
    }
  };

  const handleSave = (final: Draft) => {
    if (final.kind === 'expense') {
      addExpense(toNewExpense(final));
      setToast({ id: Date.now(), message: 'Added to Ledger', tone: 'expense' });
    } else {
      addTask(toNewTask(final));
      setToast({ id: Date.now(), message: 'Added to To-do', tone: 'task' });
    }
    setText('');
    setSheetOpen(false);
  };

  // Cancel keeps the typed text so the user can tweak and resend.
  const handleCancel = () => setSheetOpen(false);

  const nearLimit = text.length >= MAX_LENGTH - 50;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Hi there 👋</Text>
            <Text style={styles.title}>What&apos;s happening?</Text>
            <Text style={styles.subtitle}>
              Spent something or need to do something? Tell me and I&apos;ll sort it into your Ledger or
              To-do. You can check it before it&apos;s saved.
            </Text>
          </View>

          <View style={[styles.card, voice.state === 'recording' && styles.cardRecording]}>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                if (message) setMessage(null);
              }}
              placeholder={'Try "Spent $20 on groceries" or "Call mom tomorrow"'}
              placeholderTextColor={colors.mutedText}
              multiline
              maxLength={MAX_LENGTH}
              editable={!parsing}
              style={styles.input}
              accessibilityLabel="What happened or what do you need to do?"
              submitBehavior="blurAndSubmit"
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />

            <View style={styles.cardFooter}>
              {voice.state === 'recording' ? (
                <View style={styles.recordingLabel}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    Listening… {Math.floor(voice.durationMillis / 1000)}s · tap to stop
                  </Text>
                </View>
              ) : voice.state === 'transcribing' ? (
                <Text style={styles.footerHint}>Writing that down…</Text>
              ) : (
                <Text style={[styles.footerHint, nearLimit && styles.counterWarn]}>
                  {nearLimit ? `${text.length}/${MAX_LENGTH}` : ''}
                </Text>
              )}

              <View style={styles.buttons}>
                <MicButton state={voice.state} onPress={voice.toggle} disabled={parsing} />
                <PressableScale
                  onPress={handleSend}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  accessibilityState={{ disabled: !canSend, busy: parsing }}
                  style={styles.sendButton}>
                  {parsing ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Ionicons name="arrow-up" size={iconSize.lg} color={colors.onPrimary} />
                  )}
                </PressableScale>
              </View>
            </View>
          </View>

          {parsing ? (
            <Animated.Text entering={FadeIn} exiting={FadeOut} style={styles.thinking}>
              ✨ Figuring it out…
            </Animated.Text>
          ) : null}

          {message ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.message} accessibilityLiveRegion="polite">
              <Ionicons name="information-circle" size={iconSize.md} color={colors.warning} />
              <Text style={styles.messageText}>{message}</Text>
              <Pressable onPress={() => setMessage(null)} hitSlop={spacing.md} accessibilityLabel="Dismiss message">
                <Ionicons name="close" size={iconSize.sm} color={colors.mutedText} />
              </Pressable>
            </Animated.View>
          ) : null}

          <View style={styles.examples}>
            <Text style={styles.examplesLabel}>Try one</Text>
            <View style={styles.exampleChips}>
              {EXAMPLES.map((example) => (
                <PressableScale
                  key={example}
                  onPress={() => {
                    setText(example);
                    setMessage(null);
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityHint="Fills the input with this example"
                  style={styles.exampleChip}>
                  <Text style={styles.exampleText}>{example}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </Pressable>
      </ScrollView>

      <ConfirmSheet
        visible={sheetOpen}
        initialDraft={draft}
        notice={notice}
        onCancel={handleCancel}
        onSave={handleSave}
      />

      <Toast toast={toast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  greeting: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.primary },
  title: { fontSize: fontSize.heading, fontWeight: fontWeight.heavy, color: colors.text },
  subtitle: { fontSize: fontSize.body, color: colors.mutedText, lineHeight: lineHeight.body, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardRecording: { borderColor: colors.danger },
  input: {
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
    color: colors.text,
    textAlignVertical: 'top',
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  footerHint: { flex: 1, fontSize: fontSize.small, color: colors.mutedText },
  counterWarn: { color: colors.warning },
  recordingLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recordingDot: { width: RECORDING_DOT_SIZE, height: RECORDING_DOT_SIZE, borderRadius: radius.pill, backgroundColor: colors.danger },
  recordingText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.danger },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sendButton: {
    width: controlSize,
    height: controlSize,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thinking: { fontSize: fontSize.body, color: colors.primary, fontWeight: fontWeight.semibold, textAlign: 'center' },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  messageText: { flex: 1, fontSize: fontSize.small, color: colors.text, lineHeight: lineHeight.small },
  examples: { gap: spacing.sm, marginTop: spacing.sm },
  examplesLabel: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.label,
  },
  exampleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exampleChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  exampleText: { fontSize: fontSize.small, fontWeight: fontWeight.semibold, color: colors.primary },
});
