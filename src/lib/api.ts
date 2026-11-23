// Client contract for the Expo Router API routes (src/app/api/*+api.ts).
// Bodies are stubs; a later step implements them.

import type { ParseResult } from './types';
import { deviceTimeZone, todayISO } from './dates';

/**
 * POST /api/parse
 * body: { text: string, today: string (YYYY-MM-DD), timeZone: string }
 * 200: ParseResult | 4xx/5xx: ApiError
 */
export async function parseText(text: string): Promise<ParseResult> {
  void { text, today: todayISO(), timeZone: deviceTimeZone() };
  throw new Error('Not implemented');
}

/**
 * POST /api/transcribe
 * body: multipart/form-data with the recorded audio file
 * 200: { text: string } | 4xx/5xx: ApiError
 */
export async function transcribeAudio(fileUri: string): Promise<string> {
  void fileUri;
  throw new Error('Not implemented');
}
