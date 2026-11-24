import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';

import { ApiClientError, transcribeAudio } from '@/lib/api';

/** Mono, lower bit-rate m4a: plenty for speech and keeps uploads small. */
const SPEECH_PRESET: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

/** Stop automatically so a forgotten recording can't grow past the upload limit. */
const MAX_RECORDING_MS = 60_000;

export const MIC_DENIED_MESSAGE =
  'Microphone access is off. Turn it on in Settings, or type / use your keyboard mic instead.';
const RECORDING_SAVE_FAILED_MESSAGE = "Couldn't save the recording. Please try again.";
const RECORDING_START_FAILED_MESSAGE =
  "Couldn't start recording. You can still type, or use your keyboard's mic.";
const TRANSCRIBE_FAILED_MESSAGE = 'Transcription failed. Please try again.';

function devWarn(context: string, err: unknown): void {
  if (__DEV__) console.warn(`[voice] ${context}:`, err);
}

export type VoiceState = 'idle' | 'recording' | 'transcribing';

interface Options {
  /** Called with the transcript. Never auto-sends; the caller puts it in the input. */
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

export function useVoiceInput({ onTranscript, onError }: Options) {
  const recorder = useAudioRecorder(SPEECH_PRESET);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [state, setState] = useState<VoiceState>('idle');

  const stop = useCallback(async () => {
    setState('transcribing');
    try {
      await recorder.stop();
    } catch (err) {
      devWarn('stop failed', err);
    }
    // Leave recording mode so later audio isn't routed to the earpiece.
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});

    const uri = recorder.uri;
    if (!uri) {
      devWarn('recorder.uri is empty after stop', recorder.uri);
      setState('idle');
      onError(RECORDING_SAVE_FAILED_MESSAGE);
      return;
    }
    try {
      const text = await transcribeAudio(uri);
      onTranscript(text);
    } catch (err) {
      // api.ts already logged the underlying cause; this adds which recording it was.
      devWarn(`transcription of ${uri} failed`, err);
      // ApiClientError messages already distinguish "couldn't reach the server",
      // "took too long", "not set up" and "transcription failed".
      onError(err instanceof ApiClientError ? err.message : TRANSCRIBE_FAILED_MESSAGE);
    } finally {
      setState('idle');
    }
  }, [recorder, onTranscript, onError]);

  const start = useCallback(async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        devWarn('microphone permission not granted', permission);
        onError(MIC_DENIED_MESSAGE);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch (err) {
      devWarn('start failed', err);
      setState('idle');
      onError(RECORDING_START_FAILED_MESSAGE);
    }
  }, [recorder, onError]);

  const toggle = useCallback(() => {
    if (state === 'recording') void stop();
    else if (state === 'idle') void start();
  }, [state, start, stop]);

  // Auto-stop at the time limit.
  useEffect(() => {
    if (state === 'recording' && recorderState.durationMillis >= MAX_RECORDING_MS) {
      void stop();
    }
  }, [state, recorderState.durationMillis, stop]);

  return { state, toggle, durationMillis: recorderState.durationMillis };
}
