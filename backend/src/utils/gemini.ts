/**
 * Gemini Utility
 * Uses Google's Gemini API for quiz generation from transcripts.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

interface QuizQuestion {
    type: 'free_recall' | 'multiple_choice' | 'short_answer';
    text: string;
    options?: { label: string; text: string }[];
    correctAnswer: string;
    concept: string;
    sourceQuote?: string;
    timestampSeconds?: number;
}

interface TranscriptSegment {
    seconds: number;
    text: string;
}

/**
 * Parse a timestamped transcript (e.g. "[1:30] some words [1:35] more words")
 * into individual segments with their start time in seconds.
 */
function parseTimestampedTranscript(timestampedText: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const regex = /\[(\d+):(\d{2})\]/g;
    const markers: { matchEnd: number; seconds: number }[] = [];
    let match;

    while ((match = regex.exec(timestampedText)) !== null) {
        const minutes = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        markers.push({ matchEnd: match.index + match[0].length, seconds: minutes * 60 + secs });
    }

    for (let i = 0; i < markers.length; i++) {
        const start = markers[i].matchEnd;
        // Text runs until the next timestamp marker (or end of string)
        const nextMarkerStart = i + 1 < markers.length
            ? timestampedText.lastIndexOf('[', markers[i + 1].matchEnd)
            : timestampedText.length;
        const text = timestampedText.substring(start, nextMarkerStart).trim();
        if (text) {
            segments.push({ seconds: markers[i].seconds, text });
        }
    }

    return segments;
}

/**
 * Given a quote from Gemini and the original timestamped transcript,
 * find the real timestamp by locating the quote in the transcript text.
 */
function findTimestampForQuote(quote: string, timestampedText: string): number | undefined {
    if (!quote || !timestampedText) return undefined;

    const segments = parseTimestampedTranscript(timestampedText);
    if (segments.length === 0) return undefined;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedQuote = norm(quote);
    const quoteWords = normalizedQuote.split(' ').filter(Boolean);
    if (quoteWords.length === 0) return undefined;

    let bestScore = 0;
    let bestTimestamp: number | undefined;

    // Check individual segments
    for (const seg of segments) {
        const nSeg = norm(seg.text);
        if (nSeg.includes(normalizedQuote)) return seg.seconds;

        const segWords = new Set(nSeg.split(' ').filter(Boolean));
        const score = quoteWords.filter(w => segWords.has(w)).length / quoteWords.length;
        if (score > bestScore) { bestScore = score; bestTimestamp = seg.seconds; }
    }

    // Try matching across adjacent segment pairs (quote may span a boundary)
    for (let i = 0; i < segments.length - 1; i++) {
        const combined = norm(segments[i].text + ' ' + segments[i + 1].text);
        if (combined.includes(normalizedQuote)) return segments[i].seconds;

        const combinedWords = new Set(combined.split(' ').filter(Boolean));
        const score = quoteWords.filter(w => combinedWords.has(w)).length / quoteWords.length;
        if (score > bestScore) { bestScore = score; bestTimestamp = segments[i].seconds; }
    }

    return bestScore >= 0.5 ? bestTimestamp : undefined;
}

interface GeneratedQuiz {
    videoId: string;
    title: string;
    questions: QuizQuestion[];
}

interface GradedResult {
    score: number;
    correctCount: number;
    totalQuestions: number;
    questionFeedback: {
        questionIndex: number;
        isCorrect: boolean;
        userAnswer: string;
        correctAnswer: string;
        feedback: string;
    }[];
    weakConcepts: string[];
    spacingSchedule: {
        concept: string;
        nextReviewDate: string;
    }[];
}

type QuizDifficulty = 'easy' | 'intermediate' | 'boss';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function normalizeDifficulty(value: unknown): QuizDifficulty {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'easy') return 'easy';
    if (normalized === 'boss') return 'boss';
    return 'intermediate';
}

function getDifficultyInstruction(difficulty: QuizDifficulty): string {
    if (difficulty === 'easy') {
        return [
            'Difficulty: EASY (but NOT trivial)',
            '- Most questions: test the biggest ideas and direct claims from the video.',
            '- Include 1-2 questions that are genuinely tricky — require connecting two points or noticing a subtle detail.',
            '- Distractors MUST be from the same domain and sound plausible to someone who watched casually.',
            '  Example: if the answer is "TCP", distractors could be "UDP", "HTTP", "QUIC" — NOT "banana" or "Microsoft Word".',
            '- Never use obviously absurd or off-topic distractors. Every option should feel like it COULD be correct.'
        ].join('\n');
    }

    if (difficulty === 'boss') {
        return [
            'Difficulty: BOSS (genuinely hard)',
            '- Use a MIX of question types: ~40% multiple_choice, ~30% short_answer, ~30% free_recall.',
            '- multiple_choice: hard MC with subtle, closely-related distractors. Exactly 4 options (A/B/C/D).',
            '- short_answer: answer is a precise 1-3 word term, name, or value. No options array.',
            '- free_recall: ask the student to explain or describe in their own words. correctAnswer is a model answer for comparison.',
            '- Questions should require deep understanding: WHY something works, WHEN it fails, HOW concepts compare.',
            '- Ask about implications, trade-offs, edge cases, and what the speaker explicitly warned against or distinguished.',
            '- At least half the questions should require inference or synthesis across multiple points in the transcript.',
            '- For MC: distractors should be things the speaker ALMOST said, or that sound correct if you only half-understood.',
            '  Use partial truths, common misconceptions, and reversed cause-effect as distractors.',
            '- A student who merely skimmed the video should get ≤50% correct. Reward actual attention and thought.'
        ].join('\n');
    }

    return [
        'Difficulty: INTERMEDIATE',
        '- Mix direct recall (~40%) with conceptual reasoning (~60%): "why", "how", "what happens if", comparisons.',
        '- Include 2-3 questions that require connecting or contrasting ideas from different parts of the transcript.',
        '- Distractors must be closely related to the correct answer — same category, similar terminology, plausible misunderstandings.',
        '  A student should need to actually KNOW the material to distinguish the correct answer from distractors.',
        '- Never use filler distractors that are obviously wrong to anyone who knows the topic exists.'
    ].join('\n');
}

function getModel(): GenerativeModel {
    if (!model) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    return model;
}

async function callWithRetry(gemini: GenerativeModel, prompt: string, maxRetries = 3): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await gemini.generateContent(prompt);
        } catch (err: any) {
            const status = err?.status ?? err?.statusCode ?? err?.code;
            const msg = String(err?.message || '');
            const is429 = status === 429 || status === '429' || msg.includes('429') || msg.includes('Resource exhausted');
            if (is429 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt + 1) * 2000; // 4s, 8s, 16s
                console.warn(`Rate limited (429). Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
}

function parseJsonObjectFromText(text: string): any {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON object found in model response');
    }

    const cleaned = jsonMatch[0]
        .replace(/,\s*]/g, ']')
        .replace(/,\s*}/g, '}')
        .replace(/[\x00-\x1F]/g, ' ');

    return JSON.parse(cleaned);
}

function buildSpacingSchedule(weakConcepts: string[]): { concept: string; nextReviewDate: string }[] {
    const now = new Date();
    const intervals = [1, 3, 7, 14];
    return weakConcepts.map((concept, i) => {
        const intervalDays = intervals[Math.min(i, intervals.length - 1)];
        return {
            concept,
            nextReviewDate: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
        };
    });
}

function normalizeText(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeChoice(value: string): string {
    return String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .trim();
}

function isCorrectFallback(question: QuizQuestion, userAnswer: string): boolean {
    const answer = String(userAnswer || '').trim();
    if (!answer) return false;

    if (question.type === 'multiple_choice') {
        return normalizeChoice(answer) === normalizeChoice(question.correctAnswer);
    }

    const normalizedUser = normalizeText(answer);
    const normalizedCorrect = normalizeText(question.correctAnswer);
    if (!normalizedUser || !normalizedCorrect) return false;
    if (normalizedUser === normalizedCorrect) return true;
    return normalizedUser.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedUser);
}

function buildFallbackGradedResult(
    quiz: GeneratedQuiz,
    userAnswers: { questionIndex: number; answer: string; confidence: string }[]
): GradedResult {
    const questionFeedback = quiz.questions.map((question, questionIndex) => {
        const userAnswer = userAnswers.find((a) => a.questionIndex === questionIndex)?.answer || '';
        const isCorrect = isCorrectFallback(question, userAnswer);
        return {
            questionIndex,
            isCorrect,
            userAnswer,
            correctAnswer: question.correctAnswer,
            feedback: isCorrect
                ? 'Answer accepted based on expected answer key.'
                : `Expected answer: ${question.correctAnswer}`,
        };
    });

    const correctCount = questionFeedback.filter((entry) => entry.isCorrect).length;
    const totalQuestions = quiz.questions.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const weakConcepts = Array.from(new Set(
        questionFeedback
            .filter((entry) => !entry.isCorrect)
            .map((entry) => quiz.questions[entry.questionIndex]?.concept)
            .filter((concept): concept is string => Boolean(concept && concept.trim()))
    ));

    const finalWeakConcepts = weakConcepts.length > 0 || score === 100
        ? weakConcepts
        : ['General Review'];

    return {
        score,
        correctCount,
        totalQuestions,
        questionFeedback,
        weakConcepts: finalWeakConcepts,
        spacingSchedule: buildSpacingSchedule(finalWeakConcepts),
    };
}

/**
 * Generate a quiz from transcript text
 */
export async function generateQuizFromTranscript(
    videoId: string,
    title: string,
    transcriptText: string,
    questionCount: number = 8,
    difficulty: QuizDifficulty = 'intermediate',
    priorWeakConcepts: string[] = []
): Promise<GeneratedQuiz> {
    const gemini = getModel();
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const safeQuestionCount = Math.max(3, Math.min(15, Number(questionCount) || 8));

    // Truncate transcript if too long (keep first 15000 chars)
    const truncatedTranscript = transcriptText.length > 15000
        ? transcriptText.substring(0, 15000) + '...'
        : transcriptText;

    const prompt = `You are an expert educational quiz designer who creates questions that genuinely test understanding. Based on the transcript from "${title}", generate ${safeQuestionCount} quiz questions.

TRANSCRIPT:
${truncatedTranscript}

STEP 1: Identify the core ideas, arguments, distinctions, and "aha moments" in the transcript.
STEP 2: For each question, choose a concept worth remembering long-term. Skip trivia, throwaway lines, and minor details unless central to the topic.
STEP 3: Write questions that test whether the student UNDERSTOOD the material, not just whether they heard specific words.

${priorWeakConcepts.length > 0 ? `
The student previously struggled with these concepts — include 1-2 questions reinforcing them:
${priorWeakConcepts.join(', ')}
` : ''}

${getDifficultyInstruction(normalizedDifficulty)}

DISTRACTOR RULES (critical — applies to multiple_choice questions):
- Every distractor MUST be from the same domain/category as the correct answer.
- Distractors should be things a student might confuse with the correct answer if they didn't fully understand.
- Use: related concepts, partial truths, reversed relationships, common misconceptions, things mentioned elsewhere in the video but wrong for THIS question.
- NEVER use: obviously absurd options, off-topic filler, options from a completely different field, joke answers.
- Test: if a stranger who knows the general topic but didn't watch the video would score >70%, your distractors are too weak.

QUESTION VARIETY — use a mix of these question styles:
- "According to the video, what is X?" (direct recall)
- "Why does the speaker say X is important?" (reasoning)
- "What distinguishes X from Y?" (comparison)
- "What would happen if X?" (application/inference)
- "Which of these is NOT true according to the video?" (attention to detail)

FORMAT:
${normalizedDifficulty === 'boss' ? `- Use a mix of question types: multiple_choice, short_answer, and free_recall.
- For multiple_choice: exactly 4 options (A/B/C/D), correctAnswer is the option label (e.g. "B").
- For short_answer: NO options array, correctAnswer is the exact expected answer (1-3 words).
- For free_recall: NO options array, correctAnswer is a model answer the student's response will be compared against.` : `- All questions must be multiple_choice with exactly 4 options (A/B/C/D).
- Exactly one option must be correct based on the video content.`}
- Include a short concept label per question.
- For each question, include a "sourceQuote" field: copy a SHORT verbatim snippet (5-15 words) from the transcript that the question is based on. This must be an exact substring from the transcript — do NOT paraphrase.
- All questions MUST be based on actual transcript content. Do not invent information.

Return ONLY valid JSON in this exact format:
{
    "questions": [
        {
            "type": "multiple_choice",
            "text": "According to the video, what is...?",
            "options": [
                {"label": "A", "text": "First option"},
                {"label": "B", "text": "Second option"},
                {"label": "C", "text": "Third option"},
                {"label": "D", "text": "Fourth option"}
            ],
            "correctAnswer": "B",
            "concept": "specific topic",
            "sourceQuote": "exact words copied from the transcript"
        }${normalizedDifficulty === 'boss' ? `,
        {
            "type": "short_answer",
            "text": "What protocol does the speaker say is used for...?",
            "correctAnswer": "TCP",
            "concept": "networking basics",
            "sourceQuote": "we use TCP for reliable delivery"
        },
        {
            "type": "free_recall",
            "text": "Explain why the speaker argues that X is better than Y.",
            "correctAnswer": "The speaker explains that X provides faster throughput because...",
            "concept": "performance trade-offs",
            "sourceQuote": "X is better than Y because of the throughput"
        }` : ''}
    ]
}

Return ONLY the JSON, no markdown formatting or explanation.`;

    try {
        console.log('Generating quiz with Gemini...');
        const result = await callWithRetry(gemini, prompt);
        const response = result.response;
        const text = response.text();

        // Parse JSON from response - with cleanup for common LLM quirks
        let jsonText = text.match(/\{[\s\S]*\}/)?.[0];
        if (!jsonText) {
            throw new Error('Failed to parse quiz response - no JSON found');
        }

        // Clean up common JSON issues from LLM outputs
        jsonText = jsonText
            .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
            .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
            .replace(/[\x00-\x1F]/g, ' '); // Remove control characters

        const parsed = JSON.parse(jsonText);
        console.log(`Quiz generated: ${parsed.questions?.length || 0} questions`);

        // Resolve sourceQuote → timestampSeconds by finding quotes in the transcript
        if (Array.isArray(parsed.questions)) {
            for (const q of parsed.questions) {
                if (typeof q.sourceQuote === 'string' && q.sourceQuote.trim()) {
                    const resolved = findTimestampForQuote(q.sourceQuote, truncatedTranscript);
                    if (resolved !== undefined) {
                        q.timestampSeconds = resolved;
                        console.log(`  Timestamp resolved: "${q.sourceQuote.slice(0, 40)}..." → ${resolved}s`);
                    } else {
                        console.log(`  Timestamp not found for: "${q.sourceQuote.slice(0, 40)}..."`);
                    }
                }
                // Don't send sourceQuote to the client — it was just for matching
                delete q.sourceQuote;
            }
        }

        // Log Token Usage
        const usage = response.usageMetadata;
        if (usage) {
            const usageEntry = {
                timestamp: new Date().toISOString(),
                type: 'generate_quiz',
                videoId,
                difficulty: normalizedDifficulty,
                questionCount: safeQuestionCount,
                promptTokens: usage.promptTokenCount,
                responseTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount
            };
            console.log('Token Usage:', usageEntry);

            // Append to log file (simple implementation)
            try {
                const fs = require('fs');
                const path = require('path');
                const logPath = path.join(process.cwd(), 'usage_log.json');

                let logs = [];
                if (fs.existsSync(logPath)) {
                    const content = fs.readFileSync(logPath, 'utf8');
                    try { logs = JSON.parse(content); } catch (e) { }
                }
                logs.push(usageEntry);
                fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

                // Calculate Total
                const total = logs.reduce((acc: number, entry: any) => acc + (entry.totalTokens || 0), 0);
                console.log(`TOTAL TOKENS USED SO FAR: ${total}`);
            } catch (err) {
                console.error('Failed to write usage log:', err);
            }
        }

        return {
            videoId,
            title,
            questions: parsed.questions,
        };
    } catch (error) {
        console.error('Gemini quiz generation error:', error);
        throw new Error(`Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Grade quiz answers using Gemini
 */
export async function gradeQuizAnswers(
    quiz: GeneratedQuiz,
    userAnswers: { questionIndex: number; answer: string; confidence: string }[]
): Promise<GradedResult> {
    const gemini = getModel();
    const fallback = buildFallbackGradedResult(quiz, userAnswers);

    const questionsWithAnswers = quiz.questions.map((q, i) => {
        const ua = userAnswers.find(a => a.questionIndex === i);
        return {
            question: q.text,
            type: q.type,
            correctAnswer: q.correctAnswer,
            userAnswer: ua?.answer || '',
            confidence: ua?.confidence || 'low',
            concept: q.concept,
        };
    });

    const prompt = `Grade these quiz answers. For each question, determine if the answer is correct (be lenient with spelling and phrasing for free_recall and short_answer).

Questions and answers:
${JSON.stringify(questionsWithAnswers, null, 2)}

Return ONLY valid JSON in this exact format:
{
    "results": [
        {
            "questionIndex": 0,
            "isCorrect": true,
            "feedback": "Brief explanation of why the answer is correct/incorrect"
        }
    ],
    "weakConcepts": ["concept1", "concept2"]
}

weakConcepts should list concepts where the student answered incorrectly or with low confidence.
Return ONLY the JSON, no markdown formatting.`;

    try {
        console.log('Grading quiz with Gemini...');
        const result = await callWithRetry(gemini, prompt);
        const response = result.response;
        const text = response.text();
        const parsed = parseJsonObjectFromText(text);

        // Log Token Usage
        const usage = response.usageMetadata;
        if (usage) {
            const usageEntry = {
                timestamp: new Date().toISOString(),
                type: 'grade_quiz',
                totalQuestions: quiz.questions.length,
                promptTokens: usage.promptTokenCount,
                responseTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount
            };
            console.log('Token Usage:', usageEntry);

            try {
                const fs = require('fs');
                const path = require('path');
                const logPath = path.join(process.cwd(), 'usage_log.json');

                let logs = [];
                if (fs.existsSync(logPath)) {
                    const content = fs.readFileSync(logPath, 'utf8');
                    try { logs = JSON.parse(content); } catch (e) { }
                }
                logs.push(usageEntry);
                fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

                const total = logs.reduce((acc: number, entry: any) => acc + (entry.totalTokens || 0), 0);
                console.log(`TOTAL TOKENS USED SO FAR: ${total}`);
            } catch (err) {
                console.error('Failed to write usage log:', err);
            }
        }

        const parsedResults = Array.isArray(parsed?.results) ? parsed.results : [];
        const resultByIndex = new Map<number, { isCorrect: boolean; feedback: string }>();

        for (const entry of parsedResults) {
            const index = Number(entry?.questionIndex);
            if (!Number.isInteger(index) || index < 0 || index >= quiz.questions.length) {
                continue;
            }
            if (resultByIndex.has(index)) {
                continue;
            }

            resultByIndex.set(index, {
                isCorrect: Boolean(entry?.isCorrect),
                feedback: typeof entry?.feedback === 'string' && entry.feedback.trim()
                    ? entry.feedback.trim()
                    : (Boolean(entry?.isCorrect) ? 'Correct answer.' : 'Review this concept.'),
            });
        }

        const questionFeedback = quiz.questions.map((question, index) => {
            const userAnswer = userAnswers.find((a) => a.questionIndex === index)?.answer || '';
            const modelResult = resultByIndex.get(index);
            if (modelResult) {
                return {
                    questionIndex: index,
                    isCorrect: modelResult.isCorrect,
                    userAnswer,
                    correctAnswer: question.correctAnswer,
                    feedback: modelResult.feedback,
                };
            }
            return fallback.questionFeedback[index];
        });

        const correctCount = questionFeedback.filter((entry) => entry.isCorrect).length;
        const score = quiz.questions.length > 0 ? Math.round((correctCount / quiz.questions.length) * 100) : 0;

        const parsedWeakConcepts = Array.isArray(parsed?.weakConcepts)
            ? parsed.weakConcepts
                .filter((concept: unknown): concept is string => typeof concept === 'string')
                .map((concept: string) => concept.trim())
                .filter(Boolean)
            : [];

        const derivedWeakConcepts = Array.from(new Set(
            questionFeedback
                .filter((entry) => !entry.isCorrect)
                .map((entry) => quiz.questions[entry.questionIndex]?.concept)
                .filter((concept): concept is string => Boolean(concept && concept.trim()))
        ));

        const weakConcepts = parsedWeakConcepts.length > 0 ? parsedWeakConcepts : derivedWeakConcepts;
        const spacingSchedule = buildSpacingSchedule(weakConcepts);

        console.log(`Quiz graded: ${score}% (${correctCount}/${quiz.questions.length})`);

        return {
            score,
            correctCount,
            totalQuestions: quiz.questions.length,
            questionFeedback,
            weakConcepts,
            spacingSchedule,
        };
    } catch (error) {
        console.error('Gemini grading error:', error);
        console.warn('Falling back to deterministic grading so results screen can still render.');
        return fallback;
    }
}
