# QuestTube

**Turn any YouTube video into an RPG-style quiz. Learn by testing, not watching.**

> Chrome extension + Node.js backend powered by Google Gemini 2.0 Flash. Built around retrieval practice, spaced repetition, and gamification.

![Demo video coming soon]

---

## What It Does

QuestTube is a Chrome extension that injects a "Quest Available!" button into YouTube watch pages. Click it after watching a video, pick your difficulty (Slime Meadow, Dungeon Crawl, or Boss Arena), and fight through AI-generated quiz questions. Earn XP, level up, collect coins, and maintain streaks. Wrong answers get scheduled for spaced review — the extension pings you days later to reinforce what you missed.

**The problem:** People watch hours of educational YouTube and retain almost nothing. Passive consumption creates an illusion of learning.

**The fix:** Retrieval practice (testing yourself) is the single most effective study technique. QuestTube makes it frictionless.

---

## Features

### Learning Science
- **Retrieval Practice** — Questions test understanding, not memorization
- **Spaced Repetition** — Wrong answers trigger review notifications at 1, 3, 7, and 14 day intervals
- **Interleaving** — New quizzes weave in 1-2 questions from your weakest concepts
- **Immediate Feedback** — Instant visual feedback with correct answers highlighted
- **Desirable Difficulty** — Boss mode is hard on purpose. Hard now = better retention later

### Gamification
- **XP & Leveling** — 1 XP per 1% score. Progressive leveling curve
- **Coins** — 10 for passing (≥70%), 20 for perfect (100%)
- **Combo System** — Consecutive correct answers build a multiplier with fire-glow animation at 5+
- **Daily Streaks** — Consecutive days tracked, resets on gaps
- **Rank System** — S/A/B/C/D based on score

### Technical Highlights
- **Zero audio files** — All sounds synthesized at runtime with Web Audio API (correct chime, wrong buzzer, level-up fanfare, 3 procedural background music tracks)
- **Dual transcript strategy** — Supadata API primary, youtube-transcript npm fallback
- **Deterministic grading fallback** — If Gemini fails, local substring matching kicks in. Never blocks the user
- **YouTube SPA navigation handling** — MutationObserver + popstate events for seamless video-to-video transitions
- **Resilient error handling** — Every external dependency has a fallback path

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Extension | Manifest V3, vanilla JS, Chrome Storage API |
| Backend | Fastify 5, TypeScript, Zod validation |
| AI | Google Gemini 2.0 Flash (quiz generation + grading) |
| Transcripts | Supadata API (primary) + youtube-transcript (fallback) |
| Audio | Web Audio API — 100% procedural, zero assets |
| Fonts | Press Start 2P, VT323, Silkscreen |
| Scheduling | Chrome Alarms API + Notifications API |

---

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/Mchoemakesstuff/QuestTube.git
cd QuestTube
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPADATA_API_KEY=your_supadata_key_here  # optional
PORT=3000
```

Start the backend:
```bash
npm run dev
```

Backend will run on `http://localhost:3000`.

### 3. Load the extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo

### 4. Test it
1. Go to any YouTube video
2. Watch a bit of it (or skip to the end)
3. Click the **"Quest Available!"** button that appears in the player controls
4. Pick a difficulty and start your quest

---

## How It Works

1. **Content script** detects YouTube watch pages and injects the quest button
2. User clicks it → modal overlay appears with three difficulty modes
3. Backend fetches video transcript (Supadata API → youtube-transcript fallback)
4. Transcript + difficulty sent to Gemini 2.0 Flash for quiz generation
5. Questions come back with per-question timestamps
6. User answers with instant Duolingo-style feedback (hearts pop, combo builds, XP floats)
7. On submit, Gemini grades the answers (or deterministic fallback if API fails)
8. Victory screen shows score, rank, XP, coins, level-up banner
9. Wrong answers saved with timestamps → click one to jump back in the video
10. Weak concepts scheduled for spaced review via Chrome Alarms

---

## Project Structure

```
QuestTube/
├── extension/              # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content.js          # Injected into YouTube pages
│   ├── popup/              # Extension popup UI
│   ├── styles/             # CSS for quiz modal, animations
│   └── assets/             # Pixel-art images
├── backend/                # Node.js API
│   ├── src/
│   │   ├── routes/         # /api/quiz endpoints
│   │   ├── services/       # Gemini client, transcript fetcher
│   │   └── server.ts       # Fastify server
│   ├── package.json
│   └── tsconfig.json
├── product_spec.md         # Original design doc
├── CASE_STUDY.md           # Portfolio case study
└── README.md               # You are here
```

---

## API Endpoints

### `POST /api/quiz/generate`
Generate a quiz from a video transcript.

**Request:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "transcriptText": "Full transcript...",
  "difficulty": "medium",
  "questionCount": 8,
  "priorWeakConcepts": ["concept1", "concept2"]  // optional
}
```

**Response:**
```json
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "explanation": "Because...",
      "timestamp": "00:03:45"
    }
  ]
}
```

### `POST /api/quiz/submit`
Grade user answers and generate follow-up recommendations.

**Request:**
```json
{
  "quiz": { /* quiz object */ },
  "userAnswers": { "q1": "B", "q2": "A" },
  "confidenceRatings": { "q1": "high", "q2": "low" }
}
```

**Response:**
```json
{
  "score": 75,
  "results": [
    {
      "questionId": "q1",
      "correct": true,
      "userAnswer": "B",
      "correctAnswer": "B"
    }
  ],
  "weakConcepts": ["neural networks", "backpropagation"],
  "nextReviewSchedule": {
    "neural networks": "2026-02-24",
    "backpropagation": "2026-02-24"
  }
}
```

### `GET /api/health`
Health check endpoint.

---

## Demo Video

Coming soon. Check back in a few days.

---

## Why I Built This

I watch a lot of educational YouTube. Lex Fridman, Andrej Karpathy, 3Blue1Brown. I'd finish a 2-hour podcast and feel smart, then realize the next day I couldn't explain a single concept to anyone. Passive consumption is a trap.

The science is clear: retrieval practice (testing yourself) beats re-reading by a mile. But nobody's going to pause a YouTube video and make flashcards. The friction is too high.

I built QuestTube to make retrieval practice as frictionless as hitting "play next." Turn the video you just watched into a quiz, get instant feedback, and actually remember what you learned.

---

## License

MIT — do whatever you want with this.

---

## Credits

Built by [Maxson Choe](https://github.com/Mchoemakesstuff) in February 2026.

Powered by Google Gemini 2.0 Flash (free tier — 15 RPM, 1.5K requests/day).
