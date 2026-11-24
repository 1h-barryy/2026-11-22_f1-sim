// POST /api/parse
// Body: { text: string, today: "YYYY-MM-DD", timeZone: string }
// 200: ParseResult | 4xx/5xx: ApiError
//
// Turns one sentence into an expense or a task using the OpenAI Responses API
// with strict structured outputs. The output is still validated here before it
// reaches the client. The API key and raw upstream errors never leave the server.

import { isValidISODate, todayISO } from '@/lib/dates';
import { MAX_AMOUNT, MAX_INPUT_LENGTH, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH } from '@/lib/limits';
import { CATEGORIES, type ApiError, type Category, type ParseResult } from '@/lib/types';

const UPSTREAM_TIMEOUT_MS = 12_000;
const OPENAI_URL = 'https://api.openai.com/v1/responses';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function json(body: ParseResult | ApiError, status = 200): Response {
  return Response.json(body, { status });
}

function fail(status: number, error: string): Response {
  return json({ error }, status);
}

/** Shift an ISO date by whole days using UTC math (no DST surprises). */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * A small calendar from 7 days ago to 14 days ahead. Giving the model explicit
 * dates is far more reliable than asking a fast model to do date arithmetic.
 */
function buildCalendar(today: string): string {
  const lines: string[] = [];
  for (let i = -7; i <= 14; i++) {
    const iso = addDays(today, i);
    let tag = '';
    if (i === 0) tag = ' (today)';
    else if (i === 1) tag = ' (tomorrow)';
    else if (i === -1) tag = ' (yesterday)';
    lines.push(`${iso} ${weekdayOf(iso)}${tag}`);
  }
  return lines.join('\n');
}

function buildInstructions(today: string, timeZone: string): string {
  return `You turn one short message from a personal life-tracker app into EITHER an expense OR a task.

Today is ${today} (${weekdayOf(today)}). The user's time zone is ${timeZone}.
Calendar for resolving relative dates:
${buildCalendar(today)}

Decide the kind:
- "expense": the user spent, paid, bought, or was charged money, and an amount is given.
- "task": anything the user needs or wants to do, or anything else.

For an expense, set:
- amount: positive number, no currency symbol (e.g. "$20" -> 20, "4.50" -> 4.5).
- category: exactly one of ${CATEGORIES.join(', ')}.
  Food = restaurants, cafes, coffee, takeout, snacks. Groceries = supermarket and grocery shopping.
  Transport = transit, taxi, rideshare, fuel, parking. Shopping = clothes, electronics, household items.
  Bills = rent, utilities, phone, internet, subscriptions, insurance. Fun = movies, games, concerts, hobbies, travel.
  If none fits, use Other.
- note: a short description of what it was, 1 to 6 words, without the amount or date (e.g. "groceries", "lunch with Sam"). Empty string if nothing useful.
- date: YYYY-MM-DD of the day the money was spent. Use the calendar. Default to today. Past weekday names mean the most recent past one.
- title and due: null.

For a task, set:
- title: a short, clear to-do in sentence case, without the date words (e.g. "Finish my homework").
- due: YYYY-MM-DD from the calendar if a day is mentioned ("tomorrow", "Friday", "next Monday"), else null.
  A bare weekday means the next upcoming one (today if it is today). "Next <weekday>" means the one in the following week.
- amount, category, note, date: null.

Return only the JSON object.`;
}

// Strict structured outputs require an object root (no root anyOf), every field
// required, and additionalProperties: false. Unused fields are null.
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'amount', 'category', 'note', 'date', 'title', 'due'],
  properties: {
    kind: { type: 'string', enum: ['expense', 'task'] },
    amount: { type: ['number', 'null'] },
    category: {
      anyOf: [{ type: 'string', enum: [...CATEGORIES] }, { type: 'null' }],
    },
    note: { type: ['string', 'null'] },
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    title: { type: ['string', 'null'] },
    due: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
  },
} as const;

type RawResult = {
  kind?: unknown;
  amount?: unknown;
  category?: unknown;
  note?: unknown;
  date?: unknown;
  title?: unknown;
  due?: unknown;
};

/** Validate and normalize the model output. Returns null if unusable. */
function toParseResult(raw: RawResult, today: string): ParseResult | null {
  if (raw.kind === 'expense') {
    const amount = typeof raw.amount === 'number' ? raw.amount : Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;

    const category: Category = CATEGORIES.includes(raw.category as Category)
      ? (raw.category as Category)
      : 'Other';

    let date = today;
    if (raw.date !== null && raw.date !== undefined && raw.date !== '') {
      if (!isValidISODate(raw.date)) return null;
      date = raw.date;
    }

    const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_NOTE_LENGTH) : '';
    return { kind: 'expense', amount: Math.round(amount * 100) / 100, category, note, date };
  }

  if (raw.kind === 'task') {
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE_LENGTH) : '';
    if (!title) return null;

    let due: string | null = null;
    if (raw.due !== null && raw.due !== undefined && raw.due !== '') {
      if (!isValidISODate(raw.due)) return null;
      due = raw.due;
    }
    return { kind: 'task', title, due };
  }

  return null;
}

type ResponsesOutputItem = {
  type?: string;
  content?: { type?: string; text?: string; refusal?: string }[];
};

/** Pull the generated text out of a raw Responses API payload. */
function extractOutput(data: unknown): { text?: string; refused?: boolean } {
  const output = (data as { output?: ResponsesOutputItem[] })?.output;
  if (!Array.isArray(output)) return {};
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === 'refusal') return { refused: true };
      if (part?.type === 'output_text' && typeof part.text === 'string') return { text: part.text };
    }
  }
  return {};
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return fail(500, 'Server is not configured');
  }

  let body: { text?: unknown; today?: unknown; timeZone?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Request body must be JSON.');
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return fail(400, 'Please type or say something first.');
  if (text.length > MAX_INPUT_LENGTH) {
    return fail(400, `That's a bit long. Keep it under ${MAX_INPUT_LENGTH} characters.`);
  }

  // Fall back to the server's local date only if the client sent a bad `today`.
  const today = isValidISODate(body.today) ? body.today : todayISO();
  const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : 'UTC';

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: buildInstructions(today, timeZone),
        input: text,
        reasoning: { effort: 'none' },
        text: {
          format: {
            type: 'json_schema',
            name: 'life_entry',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        max_output_tokens: 400,
        store: false,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error('[api/parse] upstream request failed:', err instanceof Error ? err.name : err);
    return timedOut
      ? fail(504, 'The AI took too long to answer. Please try again.')
      : fail(502, "Couldn't reach the AI service. Please try again.");
  }

  if (!upstream.ok) {
    // Log details server-side only; the client gets a generic message.
    const detail = await upstream.text().catch(() => '');
    console.error(`[api/parse] upstream ${upstream.status}:`, detail.slice(0, 500));
    if (upstream.status === 429) return fail(503, 'The AI is busy right now. Please try again in a moment.');
    return fail(502, 'The AI service had a problem. Please try again.');
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return fail(502, 'The AI service sent back something unexpected.');
  }

  const { text: outputText, refused } = extractOutput(data);
  if (refused || !outputText) {
    return fail(422, "Couldn't turn that into an expense or a task. Try rephrasing it.");
  }

  let raw: RawResult;
  try {
    raw = JSON.parse(outputText);
  } catch {
    return fail(422, "Couldn't turn that into an expense or a task. Try rephrasing it.");
  }

  const result = toParseResult(raw, today);
  if (!result) {
    return fail(422, "Couldn't turn that into an expense or a task. Try rephrasing it.");
  }
  return json(result);
}
