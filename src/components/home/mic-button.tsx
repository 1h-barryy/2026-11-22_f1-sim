import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, controlSize, iconSize, radius } from '@/theme';
import { PressableScale } from './pressable-scale';
import type { VoiceState } from './use-voice-input';

const SIZE = controlSize;

export function MicButton({
  state,
  onPress,
  disabled,
}: {
  state: VoiceState;
  onPress: () => void;
  disabled?: boolean;
}) {
  const recording = state === 'recording';
  const pulse = useSharedValue(0);
  const active = useSharedValue(0);

  useEffect(() => {
    if (recording) {
      active.value = 1;
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      active.value = 0;
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [recording, pulse, active]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: active.value * 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <PressableScale
        onPress={onPress}
        disabled={disabled || state === 'transcribing'}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Record voice'}
        accessibilityState={{ busy: state === 'transcribing' }}
        style={[styles.button, recording ? styles.buttonRecording : styles.buttonIdle]}>
        {state === 'transcribing' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons
            name={recording ? 'stop' : 'mic'}
            size={recording ? iconSize.md : iconSize.lg}
            color={recording ? colors.onPrimary : colors.primary}
          />
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIdle: { backgroundColor: colors.primarySoft },
  buttonRecording: { backgroundColor: colors.danger },
});
