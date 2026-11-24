# Little Life

A playful, AI-powered life tracker: speak or type an expense or a task, and the app turns it into a ledger entry or a to-do. See [SPEC.md](SPEC.md).

## Concept

> _TODO (author): write this section._

## Tech stack

- [Expo](https://expo.dev) SDK 58 + React Native, running in **Expo Go** (no dev build required)
- Expo Router for navigation and for the backend (API routes in `src/app/api/`)
- AsyncStorage for on-device persistence
- OpenAI API to parse text into an expense or task and for speech-to-text

## Setup

Requirements: Node.js (LTS), npm, and the Expo Go app on your phone.

```bash
npm install
cp .env.example .env   # then fill in the keys
```

## Environment variables

Set these in `.env` at the repo root. They are read only by the server-side API routes and are never bundled into the app. `.env` is git-ignored.

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Key used by `/api/parse` and `/api/transcribe` |
| `OPENAI_MODEL` | yes | Model ID `/api/parse` uses to turn text into an expense or task (example in `.env.example`) |
| `OPENAI_TRANSCRIBE_MODEL` | yes, for voice input | Model ID `/api/transcribe` uses for speech-to-text. If it is unset, the mic shows a friendly "not set up" message and typing still works |

## Running

From the repo root:

```bash
npx expo start -c
```

Scan the QR code with the iPhone Camera to open the app in Expo Go. The phone and computer must be on the same network so the app can reach the API routes on the dev server.

Checks:

```bash
npx tsc --noEmit   # typecheck
npx expo-doctor    # dependency / config health
```

## Project structure

```
.
├── app.json              Expo config (web.output = "server" enables API routes)
├── assets/               App icon, splash, and other images
├── docs/                 Notes, acceptance criteria, screenshots
├── prompt_log.md         Log of prompts used to build the app
├── SPEC.md               Product spec (source of truth)
└── src/
    ├── app/              Routes only (Expo Router)
    │   ├── _layout.tsx   Root layout: SafeAreaProvider + StoreProvider
    │   ├── (tabs)/       Home, Ledger, To-do tabs
    │   └── api/          Server API routes: parse+api.ts, transcribe+api.ts
    ├── components/
    │   ├── ui/           Shared UI pieces
    │   ├── home/         Home-screen components
    │   ├── ledger/       Ledger-screen components
    │   └── todo/         To-do-screen components
    ├── lib/
    │   ├── api.ts        Client for the API routes
    │   ├── dates.ts      Local-time date helpers
    │   ├── limits.ts     Input limits shared by client and API routes
    │   ├── store.tsx     React context store, persisted to AsyncStorage
    │   └── types.ts      Shared types
    └── theme.ts          Colors, spacing, radius, font sizes
```

File names are kebab-case. Import from `src/` with the `@/` alias (for example `@/lib/store`).

## What I learned

> _TODO (author): write this section._
