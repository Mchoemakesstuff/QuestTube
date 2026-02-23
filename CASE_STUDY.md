# QuestTube — Portfolio Case Study

**Brain dump written mid-build, Feb 2025. Portfolio Asset #2.**

---

## The Problem

People watch hours of YouTube educational content and retain almost nothing. You finish a 20-minute video on neural networks, feel smart for about 15 minutes, then can't explain a single concept to anyone the next day. Passive consumption creates an illusion of learning.

The science is clear: retrieval practice (testing yourself) is the single most effective study technique. But nobody's going to pause a YouTube video and make flashcards. The friction is too high.

## The Solution

QuestTube is a Chrome extension that turns any YouTube video into an RPG-style quiz. Watch a video, click "Quest Available!" in the player controls, pick your difficulty, and fight through AI-generated questions about what you just watched. Earn XP, level up, collect coins, maintain streaks. Wrong answers get scheduled for spaced review — the extension pings you days later to reinforce what you missed.

It's Duolingo meets YouTube, with a retro pixel-art RPG skin.

## How It Actually Works

### Architecture (two pieces)

**Chrome Extension (Manifest V3, vanilla JS)** — injected into YouTube watch pages. No build step, no framework. Handles all UI, gamification state, and Chrome storage.

**Node.js Backend (Fastify + TypeScript)** — runs on localhost:3000. Fetches video transcripts, sends them to Google Gemini 2.0 Flash for quiz generation and AI grading. Three endpoints total.

### The Flow

1. User watches a YouTube video
2. Content script detects the page, injects a pixel-art "Quest Available!" button into YouTube's player controls
3. User clicks it → full-screen modal overlay appears
4. **Mode Select**: three difficulties — Slime Meadow (5 easy Qs), Dungeon Crawl (8 mid Qs), Boss Arena (12 hard Qs). Each has its own procedurally-generated background music that plays on hover
5. Backend fetches the transcript (Supadata API primary, youtube-transcript npm fallback), sends it to Gemini with difficulty-specific prompt engineering
6. Questions come back with per-question timestamps tied to the transcript
7. User answers questions with instant Duolingo-style feedback — hearts pop for correct, broken hearts for wrong, combo multiplier builds, floating XP numbers, particle bursts
8. On submit, Gemini grades the answers (with deterministic fallback if the API fails)
9. Victory Report shows score, rank (S/A/B/C/D), XP earned, coins, level-up banner if applicable
10. Wrong answers are saved with video timestamps — click one in the popup to jump back to that exact moment in the video
11. Weak concepts get scheduled for spaced review via Chrome Alarms → system notifications days later

### Tech Stack

| Layer | Tech |
|-------|------|
| Extension | Manifest V3, vanilla JS, Chrome Storage API |
| Backend | Fastify 5, TypeScript, Zod validation |
| AI | Google Gemini 2.0 Flash (generation + grading) |
| Transcripts | Supadata API (primary) + youtube-transcript (fallback) |
| Audio | Web Audio API — 100% procedural, zero audio files |
| Fonts | Press Start 2P, VT323, Silkscreen |
| Scheduling | Chrome Alarms API + Notifications API |

## Learning Science Built In

This isn't just a quiz generator. Specific cognitive science principles are implemented:

**Retrieval Practice (Testing Effect)** — The core mechanic. Every question forces active recall instead of passive re-reading. Gemini is prompted to test *understanding*, not whether you heard specific words.

**Spaced Repetition** — Wrong answers are tracked as "weak concepts" with strength scores. Review notifications fire at 1, 3, 7, and 14 day intervals. The concept model persists across sessions.

**Interleaving** — Before generating a new quiz, the extension pulls your 5 weakest concepts from storage and passes them to Gemini with instructions to weave 1-2 reinforcement questions into the new quiz. You're reviewing old gaps while learning new material.

**Immediate Corrective Feedback** — No waiting until the end. Each question gets instant visual feedback: correct answer highlighted, wrong answer shown, explanation in the feedback bar. This prevents error reinforcement.

**Desirable Difficulty** — Boss mode is explicitly designed so a casual viewer scores ≤50%. Distractors use partial truths, reversed cause-effect, and common misconceptions. Easy mode isn't trivial either — it still requires 1-2 genuinely tricky questions.

## Engineering Decisions Worth Talking About

**Zero Audio Files** — Every sound in the app is synthesized at runtime with the Web Audio API. The correct-answer chime, the incorrect buzzer, the level-up fanfare, and three unique background music tracks for each difficulty mode — all generated from oscillators, gain envelopes, and noise buffers. Zero HTTP requests for audio.

**Dual Transcript Strategy** — Supadata API is the primary transcript source with retry logic (exponential backoff, respects Retry-After headers). Falls back to the youtube-transcript npm package which scrapes YouTube's internal timedtext endpoint. Both paths produce plain text AND timestamped versions — the timestamps flow all the way through to per-question "jump to this moment" buttons in the results screen.

**Deterministic Grading Fallback** — If Gemini fails to grade (rate limit, network error, malformed JSON), a local fallback runs: letter normalization for MCQ, substring matching for open-ended. The results screen always renders. AI failure degrades gracefully, never blocks the user.

**LLM JSON Sanitization** — Gemini doesn't always return clean JSON. Three cleanup passes before parsing: strip trailing commas, remove control characters, regex-extract the outermost `{...}` object. This makes the pipeline resilient to Gemini wrapping JSON in markdown or adding explanation text.

**YouTube SPA Compatibility** — YouTube is a full SPA that navigates without page reloads. A MutationObserver on `document.body` detects navigation, compares video IDs, and cleans up/reinitializes the extension for each new video. Also handles `popstate` events for back/forward navigation.

**Post-Submit Pipeline Isolation** — After grading, six storage operations run (save attempt, update streak, update concept model, add XP, add coins, save wrong answers). The entire pipeline is wrapped in a try/catch that cannot block the results screen from rendering. Storage failures are logged but never shown to the user.

## Gamification System

- **XP**: 1 XP per 1% score (80% = 80 XP). Progressive leveling: Level N → N+1 costs N×100 XP
- **Coins**: 10 for passing (≥70%), 20 for perfect (100%)
- **Combo System**: consecutive correct answers build a multiplier. Score = 100 + (combo × 25) per question. At 5+ combo, the badge gets a fire-glow animation. Breaking a combo triggers a visible break animation
- **Daily Streak**: increments on consecutive calendar days, resets on gap. Protected against same-day double-counting
- **Rank System**: S (≥95%), A (≥85%), B (≥70%), C (≥50%), D (<50%)

## What Makes This a Portfolio Piece

1. **Full-stack AI integration** — not just calling an API. Prompt engineering for three difficulty tiers, structured JSON output, fallback handling, token usage tracking
2. **Applied cognitive science** — retrieval practice, spaced repetition, interleaving, and desirable difficulty aren't buzzwords here, they're implemented features with real data structures backing them
3. **Browser extension architecture** — content scripts, service workers, Chrome storage, alarms, notifications, SPA navigation handling, CSP workarounds
4. **Procedural audio engine** — entire sound system from oscillators, no assets
5. **Pixel-art UI** — CSS-only hearts, particle systems, combo animations, scroll unfurl effects, starfield backgrounds. Retro aesthetic executed consistently across every screen
6. **Resilient engineering** — every external dependency (Gemini, transcript APIs, Chrome storage) has a fallback path. The app degrades gracefully at every layer

## Current State

Working end-to-end. User can watch a YouTube video, take a quiz at three difficulty levels, get AI-graded results with gamification, review mistakes by jumping to video timestamps, and receive spaced review notifications. The extension popup shows stats, streak, coins, and wrong answers from the last quiz.

Built with Gemini 2.0 Flash free tier (15 RPM, 1.5K requests/day). No billing required.
