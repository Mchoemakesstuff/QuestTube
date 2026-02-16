# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuestTube is a Chrome extension + backend system that generates AI-powered quizzes from YouTube videos. It implements learning science principles: retrieval practice, spaced repetition, confidence-based scheduling, and gamification (XP, levels, coins, streaks).

## Architecture

Two independent components communicate over HTTP:

**Backend** (`backend/`) — Fastify + TypeScript API on `localhost:3000`
- `src/server.ts` — Server bootstrap, registers CORS and routes
- `src/routes/quizRoutes.ts` — Three endpoints: generate quiz, submit quiz, fetch transcript
- `src/utils/gemini.ts` — Gemini 2.0 Flash integration for quiz generation and AI grading (with deterministic fallback)
- `src/utils/transcript.ts` — Fetches YouTube transcripts via Supadata API (primary) or youtube-transcript package (fallback)
- `src/schemas.ts` — Zod schemas for request/response validation

**Chrome Extension** (`extension/`) — Manifest V3, vanilla JS
- `content.js` — Injected into YouTube watch pages; detects video end, injects "Quiz me" button, launches modal
- `modal.js` — Quiz UI: mode selection, question rendering, results display, sound effects (Web Audio API)
- `api.js` — HTTP client for backend endpoints
- `storage.js` — Chrome storage.local wrapper; manages quiz attempts, concept model, player stats. Exposes `window.QuestTubeStorage`
- `background.js` — Service worker for scheduling review alarms and Chrome notifications
- `popup/` — Extension popup UI with particle effects

**Flow:** Video ends → content script launches modal → user selects difficulty → `api.js` calls `POST /api/quiz/generate` → backend fetches transcript, sends to Gemini, returns questions → user answers → `POST /api/quiz/submit` → backend grades via Gemini → results displayed → stats saved to Chrome storage → review alarms scheduled.

## Commands

All backend commands run from the `backend/` directory:

```bash
# Install dependencies
cd backend && npm install

# Development server (hot reload via nodemon + ts-node)
npm run dev

# Production build
npm run build    # tsc → dist/

# Start production server
npm start        # node dist/server.js
```

No build step for the extension — load unpacked from `extension/` in `chrome://extensions` with Developer mode enabled.

No test suite exists yet (`npm test` is a placeholder).

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check |
| POST | `/api/quiz/generate` (alias: `/api/quiz`) | Generate quiz from video transcript |
| POST | `/api/quiz/submit` | Grade quiz answers, extract weak concepts, calculate spacing |
| GET | `/api/transcript/:videoId` | Fetch transcript (utility/debug) |

## Environment Variables

Backend requires a `.env` file in `backend/`:
- `GEMINI_API_KEY` — Required. Google Gemini API key.
- `SUPADATA_API_KEY` — Optional. Enables Supadata transcript API (falls back to youtube-transcript).
- `PORT` — Optional. Defaults to 3000.

## 3-Layer Architecture Convention

This project follows a directive-driven pattern (see `gemini.md`):
1. **Directives** (`directives/`) — SOPs in Markdown defining goals, inputs, outputs, edge cases
2. **Orchestration** — AI agent layer for routing and decision-making
3. **Execution** — Deterministic code that does the actual work

Key rules: check `execution/` for existing tools before writing new scripts; update directives when you discover new constraints; escalate to the user after one failed attempt rather than iterating on brittle workarounds.

## Design Conventions

- Extension uses retro pixel art aesthetic with Press Start 2P, VT323, and Silkscreen fonts
- All quiz questions are currently multiple-choice (product spec calls for free-recall and short-answer too — not yet implemented)
- Gamification: 1 XP per 1% score, coins at 70%+ and 100% thresholds, level formula = currentLevel * 100 XP
- Spacing schedule: 1, 3, 7, 14 days based on correctness + confidence
