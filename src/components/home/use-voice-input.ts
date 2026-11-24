import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * idle -> preparing (permission + recorder setup) -> recording -> transcribing -> idle.
 * The mic is locked in every state except idle and recording.
 */
export type VoiceState = 'idle' | 'preparing' | 'recording' | 'transcribing';

const RECORDING_STOP_FAILED_MESSAGE = "Couldn't finish the recording, so nothing was sent. Please try again.";

interface Options {
  /** Called with the transcript. Never auto-sends; the caller puts it in the input. */
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

/** Leave recording mode so later audio isn't routed to the earpiece. */
function restoreAudioMode(): void {
  setAudioModeAsync({ allowsRecording: false }).catch((err) => devWarn('restoring audio mode failed', err));
}

export function useVoiceInput({ onTranscript, onError }: Options) {
  const recorder = useAudioRecorder(SPEECH_PRESET);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [state, setStateValue] = useState<VoiceState>('idle');
  // Mirrors `state` synchronously, so taps arriving before the next render
  // (or the auto-stop effect) can't start or stop twice.
  const stateRef = useRef<VoiceState>('idle');

  const setState = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const stop = useCallback(async () => {
    if (stateRef.current !== 'recording') return;
    setState('transcribing');

    let stopped = true;
    try {
      await recorder.stop();
    } catch (err) {
      stopped = false;
      devWarn('stop failed', err);
    }
    restoreAudioMode();

    // A failed stop can leave an unfinished file; never upload it.
    if (!stopped) {
      setState('idle');
      onError(RECORDING_STOP_FAILED_MESSAGE);
      return;
    }

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
  }, [recorder, onTranscript, onError, setState]);

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle') return;
    // Lock immediately: permission prompts and preparation take a while.
    setState('preparing');

    let audioModeSet = false;
    let prepared = false;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        devWarn('microphone permission not granted', permission);
        setState('idle');
        onError(MIC_DENIED_MESSAGE);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      audioModeSet = true;
      await recorder.prepareToRecordAsync();
      prepared = true;
      recorder.record();
      setState('recording');
    } catch (err) {
      devWarn('start failed', err);
      if (prepared) {
        // Release the prepared recorder so the next attempt starts clean.
        await recorder.stop().catch((stopErr: unknown) => devWarn('cleanup stop failed', stopErr));
      }
      if (audioModeSet) restoreAudioMode();
      setState('idle');
      onError(RECORDING_START_FAILED_MESSAGE);
    }
  }, [recorder, onError, setState]);

  const toggle = useCallback(() => {
    if (stateRef.current === 'recording') void stop();
    else if (stateRef.current === 'idle') void start();
    // preparing / transcribing: locked, ignore the tap.
  }, [start, stop]);

  // Auto-stop at the time limit.
  useEffect(() => {
    if (state === 'recording' && recorderState.durationMillis >= MAX_RECORDING_MS) {
      void stop();
    }
  }, [state, recorderState.durationMillis, stop]);

  return { state, toggle, durationMillis: recorderState.durationMillis };
}
