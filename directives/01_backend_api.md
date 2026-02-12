# Directive: Backend API

## Goal
Implement the core backend API endpoints for quiz generation and submission.

## Inputs
- `product_spec.md`: Technical architecture and endpoint definitions.

## Instructions

### 1. Create Zod Schemas (`src/schemas.ts`)
Define request/response schemas:
- `GenerateQuizRequestSchema`
- `QuizSchema` (questions array with type, text, options, correctAnswer, feedback, concepts)
- `SubmitQuizRequestSchema`
- `SubmitQuizResponseSchema`

### 2. Create Transcript Utility (`src/utils/transcript.ts`)
- Function `fetchTranscript(videoId: string): Promise<string>`
- Fetch from `https://video.google.com/timedtext?lang=en&v=VIDEO_ID`
- Parse XML to plain text

### 3. Create Quiz Routes (`src/routes/quizRoutes.ts`)
- `POST /api/quiz/generate`
  - Validate with Zod
  - Call AI (placeholder for now) to generate quiz JSON
  - Return validated quiz
- `POST /api/quiz/submit`
  - Validate with Zod
  - Grade answers, extract weak concepts
  - Calculate spacing schedule
  - Return results

### 4. Update Server (`src/server.ts`)
- Register quiz routes

### 5. Add Dev Script (`package.json`)
- Add `"dev": "nodemon --exec ts-node src/server.ts"`

## Outputs
- Working `/api/quiz/generate` and `/api/quiz/submit` endpoints
- Zod validation on all requests/responses

## Edge Cases
- Missing transcript → return error message
- AI returns invalid JSON → retry with repair prompt
