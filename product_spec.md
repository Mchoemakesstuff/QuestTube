# YouTube Quizzer - Product Specification

## Product Goal (non-negotiable)
This is not a “quiz generator.” It is a learning system built around:
- Retrieval practice (testing effect)
- Spaced repetition / distributed practice
- Immediate corrective feedback (especially for multiple choice)
- Desirable difficulty + avoiding illusions of learning
- Optional interleaving across videos/topics

## Core User Flow
1. User watches a YouTube video.
2. At video end (or “Quiz me now”), show a modal quiz.
3. User answers.
4. On submit, show:
    - score + per-question feedback
    - weak concepts extracted from mistakes
    - Suggested Follow-up Questions (5–10) targeting weak concepts
5. System schedules spaced re-quiz prompts (in-extension notifications) based on performance:
    - default schedule: +1 day, +3 days, +7 days, +14 days
    - adapt: if user misses concept → bring it sooner; if correct with high confidence → push farther
6. No summaries. No fluff.

## Learning Science → Concrete UX Rules
**A) Use retrieval practice properly (not “review”)**
- First question in the quiz should be free recall (“List 3 key ideas from the video in your own words.”).
- Then do a mix:
    - 2–3 multiple choice (diagnostic)
    - 2–3 short answer (concept explanation / application)
- Require a confidence rating per question: Low / Medium / High.

**B) Feedback rules**
- Always show corrective feedback after submission:
    - MCQ: show correct choice + one-sentence “why”
    - Short answer: show ideal answer + rubric points missed
- If MCQ: shuffle answers and include plausible distractors, but prevent “poisoning” by always giving feedback.

**C) Spacing rules (retention system)**
- Store concepts the user struggled with.
- Schedule re-quizzes on a spaced schedule (start tight, expand).
- Use a simple adaptive algorithm:
    - incorrect OR low confidence → next review sooner (e.g., 1 day)
    - correct + medium confidence → 3 days
    - correct + high confidence → 7+ days

**D) Interleaving (optional but designed in)**
- When user has multiple videos in history, include 1–2 questions from prior weak concepts in the new quiz.

**E) Avoid “learning vs performance” traps**
- The UI must explicitly label: “Harder now = better later.”
- Do not let users replace retrieval with re-reading; keep the system quiz-first.

## Technical Architecture

### Frontend: Chrome Extension (Manifest V3)
- **Content script** on `youtube.com/watch*`
    - Detect video end via `<video>` element `ended` event.
    - Add “Quiz me now” button near player controls.
- **Modal UI** overlays YouTube page:
    - quiz rendering
    - confidence selection
    - submit
    - results + follow-ups
    - “Schedule review” toggle
- **Storage** (`chrome.storage.local`):
    - `quiz attempts`: `{videoId, timestamp, score, weakConcepts, nextReviewDates}`
    - `concept model`: `{concept, strengthScore, lastReviewed, dueDates}`
- **Scheduling**:
    - Use `chrome.alarms` + `chrome.notifications` for review prompts.
    - Clicking notification opens YouTube Quizzer popup to run the due review quiz.

### Backend API (Node.js + Fastify + TypeScript)
- **Endpoints**:
    - `POST /api/quiz/generate`
        - input: `{ videoId, title, transcriptText, questionCount?: number, priorWeakConcepts?: string[] }`
        - output: quiz JSON (strict schema)
    - `POST /api/quiz/submit`
        - input: `{ quiz, userAnswers, confidenceRatings }`
        - output: grading + weak concepts + follow-up questions + recommended spacing schedule
- **Validation**:
    - Use `zod` for request/response schemas.
    - AI responses must be strict JSON; validate or retry with “return JSON only” repair prompt.

### Transcript (captions-only MVP)
- Fetch captions via timedtext endpoint: `https://video.google.com/timedtext?lang=en&v=VIDEO_ID`
- Parse XML to plain text.
- If no transcript: show “Transcript not available yet”.
