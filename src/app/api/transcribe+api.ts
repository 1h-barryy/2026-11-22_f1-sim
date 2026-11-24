// POST /api/transcribe
// Body: multipart/form-data with a `file` field (the recorded audio, e.g. .m4a)
// 200: { text: string } | 4xx/5xx: ApiError
//
// Forwards the audio to OpenAI's transcription endpoint. The API key and raw
// upstream errors never leave the server.

import type { ApiError } from '@/lib/types';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const UPSTREAM_TIMEOUT_MS = 20_000; // keep below the client's 30 s transcribe timeout
const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';

type ServerFormData = { get(name: string): unknown };

function fail(status: number, error: string): Response {
  return Response.json({ error } satisfies ApiError, { status });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TRANSCRIBE_MODEL;
  if (!apiKey || !model) {
    return fail(501, 'Transcription not configured');
  }

  // Cheap early reject before buffering the body (multipart adds a little overhead).
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) {
    return fail(413, 'That recording is too long. Try a shorter one.');
  }

  // The project's global FormData type is React Native's; on the server this is
  // the WHATWG FormData, so describe just what we use.
  let form: ServerFormData;
  try {
    form = (await request.formData()) as unknown as ServerFormData;
  } catch {
    return fail(400, 'Expected an audio file upload.');
  }

  const entry = form.get('file');
  if (!entry || typeof entry === 'string' || typeof (entry as Blob).size !== 'number') {
    return fail(400, 'Expected an audio file upload.');
  }
  const file = entry as Blob & { name?: string };
  if (file.size === 0) {
    return fail(400, 'The recording was empty. Try again.');
  }
  if (file.size > MAX_BYTES) {
    return fail(413, 'That recording is too long. Try a shorter one.');
  }

  const upstreamForm = new FormData();
  const name = typeof file.name === 'string' && file.name ? file.name : 'recording.m4a';
  upstreamForm.append('file', file, name);
  upstreamForm.append('model', model);
  upstreamForm.append('response_format', 'json');

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error('[api/transcribe] upstream request failed:', err instanceof Error ? err.name : err);
    return timedOut
      ? fail(504, 'Transcription took too long. Please try again.')
      : fail(502, "Couldn't reach the transcription service. Please try again.");
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error(`[api/transcribe] upstream ${upstream.status}:`, detail.slice(0, 500));
    if (upstream.status === 429) return fail(503, 'Transcription is busy right now. Please try again in a moment.');
    return fail(502, 'The transcription service had a problem. Please try again.');
  }

  let data: { text?: unknown };
  try {
    data = await upstream.json();
  } catch {
    return fail(502, 'The transcription service sent back something unexpected.');
  }

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) {
    return fail(422, "Didn't catch anything. Try again a little closer to the mic.");
  }
  return Response.json({ text });
}
