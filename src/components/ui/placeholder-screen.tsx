import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '@/theme';

export function PlaceholderScreen({ title, emoji, accent }: { title: string; emoji: string; accent: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  badge: { width: 88, height: 88, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: fontSize.display },
  title: { fontSize: fontSize.heading, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fontSize.body, color: colors.mutedText },
});
