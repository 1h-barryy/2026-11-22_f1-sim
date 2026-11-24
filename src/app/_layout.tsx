import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider } from '@/lib/store';
import { TodayProvider } from '@/lib/today';
import { colors } from '@/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <TodayProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </ThemeProvider>
        </TodayProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
