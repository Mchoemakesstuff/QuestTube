# Directive: Chrome Extension

## Goal
Build a Chrome Extension (Manifest V3) that overlays a quiz modal on YouTube watch pages.

## Inputs
- `product_spec.md`: Frontend architecture and UX rules.
- Backend API running at `http://localhost:3000`.

## Instructions

### 1. Content Script (`content.js`)
- Detect `youtube.com/watch*` pages.
- Listen for video `ended` event on `<video>` element.
- Inject "Quiz me now" button near player controls.
- On button click OR video end, show quiz modal.

### 2. Modal UI (`modal.js` + `modal.css`)
- Overlay modal with semi-transparent backdrop.
- Sections:
  - Quiz questions (free recall first, then MCQ/short answer).
  - Confidence selector per question (Low/Medium/High).
  - Submit button.
  - Results view (score, feedback, weak concepts, follow-ups).
  - "Schedule Review" toggle.
- Design principles:
  - Dark theme to match YouTube.
  - "Harder now = better later" messaging.
  - Smooth animations.

### 3. API Integration (`api.js`)
- `generateQuiz(videoId, title, transcript)` → POST `/api/quiz/generate`
- `submitQuiz(quiz, answers)` → POST `/api/quiz/submit`
- `fetchTranscript(videoId)` → GET `/api/transcript/:videoId`

### 4. Storage (`storage.js`)
- Save quiz attempts: `{videoId, timestamp, score, weakConcepts, nextReviewDates}`
- Save concept model: `{concept, strengthScore, lastReviewed, dueDates}`
- Use `chrome.storage.local`.

### 5. Background Script (`background.js`)
- Set up `chrome.alarms` for spaced review prompts.
- Listen for alarm → show `chrome.notifications`.
- On notification click → open popup with due review quiz.

## Outputs
- Working extension loadable in Chrome via `chrome://extensions`.
- Quiz modal overlays YouTube videos.
- Grades quizzes and shows feedback.

## Edge Cases
- No transcript available → show error message.
- API offline → show retry option.
- User navigates away during quiz → save progress?
