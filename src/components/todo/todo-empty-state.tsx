import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

const BADGE_SIZE = spacing.xxxl + spacing.xl; // 72

export function TodoEmptyState() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="checkmark-done" size={fontSize.display} color={colors.task} />
      </View>
      <Text style={styles.title}>Your list is wide open</Text>
      <Text style={styles.hint}>
        Add a task from Home by typing or speaking — it will appear right here.
      </Text>
      <Pressable
        onPress={() => router.navigate('/')}
        accessibilityRole="button"
        accessibilityLabel="Go to Home to add a task"
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        <Ionicons name="sparkles" size={fontSize.small} color={colors.onPrimary} />
        <Text style={styles.ctaText}>Add one from Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.xl,
    backgroundColor: colors.taskSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  hint: {
    color: colors.mutedText,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.task,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: colors.onPrimary,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
});
