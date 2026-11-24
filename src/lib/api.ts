// Client for the Expo Router API routes in src/app/api/.
// Relative URLs are resolved against the dev server origin (window.location on
// native is polyfilled by Expo Router).
// Every failure becomes an ApiClientError with a message that is safe to show.

import { deviceTimeZone, todayISO } from './dates';
import { CATEGORIES, type Category, type ParseResult } from './types';

const TIMEOUT_MS = 15_000;
/** Uploading audio plus server-side transcription takes longer than parsing text. */
const TRANSCRIBE_TIMEOUT_MS = 30_000;

/**
 * - network: the request never got a response (offline, wrong host, bad request body).
 * - timeout: no response in time.
 * - http: the server answered with an error status (see `status`).
 * - invalid: the server answered 2xx but the body was unusable.
 */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid';

export class ApiClientError extends Error {
  /** HTTP status, or 0 when there was no response. */
  readonly status: number;
  readonly kind: ApiErrorKind;
  constructor(message: string, status: number, kind: ApiErrorKind = status === 0 ? 'network' : 'http') {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.kind = kind;
  }
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const TIMEOUT_MESSAGE = 'That took too long. Check your connection and try again.';

/** Log the real cause in development only; users only ever see friendly messages. */
function devWarn(context: string, err: unknown): void {
  if (__DEV__) console.warn(`[api] ${context}:`, err);
}

/** Resolve "/api/..." against the dev server (or configured) origin, like Expo's fetch polyfill does. */
function resolveUrl(path: string): string {
  const origin = typeof window !== 'undefined' ? window.location?.origin : undefined;
  if (!origin) return path;
  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

function errorFromResponse(status: number, body: unknown): ApiClientError {
  const serverMessage = (body as { error?: unknown } | null)?.error;
  return new ApiClientError(
    typeof serverMessage === 'string' && serverMessage ? serverMessage : GENERIC_MESSAGE,
    status,
    'http',
  );
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: controller.signal });
  } catch (err) {
    devWarn(`fetch ${path} failed`, err);
    // expo/fetch throws its own FetchError (not an AbortError) on abort, so check the signal.
    const timedOut = controller.signal.aborted;
    throw new ApiClientError(
      timedOut ? TIMEOUT_MESSAGE : NETWORK_MESSAGE,
      0,
      timedOut ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body; handled below.
  }

  if (!res.ok) throw errorFromResponse(res.status, body);
  if (body === null) throw new ApiClientError(GENERIC_MESSAGE, res.status, 'invalid');
  return body;
}

/**
 * POST a multipart form with XMLHttpRequest.
 *
 * Why not fetch: in Expo SDK 58 the global fetch is expo/fetch, which only
 * accepts Blob/string FormData parts and throws "Unsupported FormDataPart
 * implementation" for React Native's { uri, name, type } file parts. React
 * Native's XMLHttpRequest uploads those natively, streaming the file from disk.
 * The multipart Content-Type (with boundary) is set automatically; never set it by hand.
 */
function uploadForm(path: string, form: FormData, timeoutMs: number): Promise<unknown> {
  const url = resolveUrl(path);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        // Non-JSON body; handled below.
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        if (__DEV__) {
          console.warn(`[api] POST ${url} -> HTTP ${xhr.status}:`, xhr.responseText.slice(0, 300));
        }
        reject(errorFromResponse(xhr.status, body));
        return;
      }
      if (body === null) {
        devWarn(`POST ${url} returned a non-JSON body`, xhr.responseText.slice(0, 300));
        reject(new ApiClientError(GENERIC_MESSAGE, xhr.status, 'invalid'));
        return;
      }
      resolve(body);
    };
    xhr.onerror = () => {
      devWarn(`POST ${url} network error`, { status: xhr.status, responseText: xhr.responseText });
      reject(new ApiClientError(NETWORK_MESSAGE, 0, 'network'));
    };
    xhr.ontimeout = () => {
      devWarn(`POST ${url} timed out after ${timeoutMs}ms`, null);
      reject(new ApiClientError(TIMEOUT_MESSAGE, 0, 'timeout'));
    };

    try {
      xhr.send(form);
    } catch (err) {
      devWarn(`POST ${url} could not be sent`, err);
      reject(new ApiClientError(NETWORK_MESSAGE, 0, 'network'));
    }
  });
}

function isParseResult(x: unknown): x is ParseResult {
  const r = x as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return false;
  if (r.kind === 'expense') {
    return (
      typeof r.amount === 'number' &&
      CATEGORIES.includes(r.category as Category) &&
      typeof r.note === 'string' &&
      typeof r.date === 'string'
    );
  }
  if (r.kind === 'task') {
    return typeof r.title === 'string' && (r.due === null || typeof r.due === 'string');
  }
  return false;
}

/** POST /api/parse with { text, today, timeZone } and return a validated ParseResult. */
export async function parseText(text: string): Promise<ParseResult> {
  const body = await request('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, today: todayISO(), timeZone: deviceTimeZone() }),
  });
  if (!isParseResult(body)) {
    devWarn('/api/parse returned an unexpected shape', body);
    throw new ApiClientError("Couldn't understand the AI's answer. Please try again.", 200, 'invalid');
  }
  return body;
}

/** Friendly message when voice input is unavailable on the server. */
export const TRANSCRIBE_UNAVAILABLE_MESSAGE =
  "Voice input isn't set up yet. You can still type, or tap the mic on your keyboard to dictate.";

const TRANSCRIBE_NETWORK_MESSAGE =
  "Couldn't reach the server to transcribe your recording. Check your connection and try again.";
const TRANSCRIBE_TIMEOUT_MESSAGE = 'Transcription took too long. Please try again.';
const TRANSCRIBE_FAILED_MESSAGE = 'Transcription failed. Please try again.';

const AUDIO_MIME: Record<string, string> = {
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  caf: 'audio/x-caf',
  wav: 'audio/wav',
  webm: 'audio/webm',
  '3gp': 'audio/3gpp',
};

/** POST /api/transcribe with the recorded file and return the transcript text. */
export async function transcribeAudio(fileUri: string): Promise<string> {
  // React Native needs a file:// URI; expo-audio normally returns one, but be safe.
  const uri = fileUri.startsWith('/') ? `file://${fileUri}` : fileUri;
  const name = uri.split('/').pop()?.split('?')[0] || 'recording.m4a';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const type = AUDIO_MIME[ext] ?? 'audio/m4a';

  const form = new FormData();
  // Field name must match the server route: form.get('file').
  form.append('file', { uri, name, type } as unknown as Blob);

  let body: unknown;
  try {
    body = await uploadForm('/api/transcribe', form, TRANSCRIBE_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof ApiClientError)) {
      devWarn('transcribe failed unexpectedly', err);
      throw new ApiClientError(TRANSCRIBE_FAILED_MESSAGE, 0, 'invalid');
    }
    if (err.kind === 'network') throw new ApiClientError(TRANSCRIBE_NETWORK_MESSAGE, 0, 'network');
    if (err.kind === 'timeout') throw new ApiClientError(TRANSCRIBE_TIMEOUT_MESSAGE, 0, 'timeout');
    if (err.status === 501) throw new ApiClientError(TRANSCRIBE_UNAVAILABLE_MESSAGE, 501, 'http');
    // The route's own error messages are already friendly; fall back to a clear "failed".
    const message = err.message && err.message !== GENERIC_MESSAGE ? err.message : TRANSCRIBE_FAILED_MESSAGE;
    throw new ApiClientError(message, err.status, err.kind);
  }

  const text = (body as { text?: unknown }).text;
  if (typeof text !== 'string') {
    devWarn('/api/transcribe returned an unexpected shape', body);
    throw new ApiClientError(TRANSCRIBE_FAILED_MESSAGE, 200, 'invalid');
  }
  return text;
}
