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

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

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
    questionCount: number = 6,
    priorWeakConcepts: string[] = []
): Promise<GeneratedQuiz> {
    const gemini = getModel();

    // Truncate transcript if too long (keep first 15000 chars)
    const truncatedTranscript = transcriptText.length > 15000
        ? transcriptText.substring(0, 15000) + '...'
        : transcriptText;

    const prompt = `You are an educational quiz generator. Based on the following transcript from a video titled "${title}", generate ${questionCount} quiz questions.

TRANSCRIPT:
${truncatedTranscript}

${priorWeakConcepts.length > 0 ? `
IMPORTANT: The student has previously struggled with these concepts, so include 1-2 questions that reinforce them:
${priorWeakConcepts.join(', ')}
` : ''}

Create 100% multiple-choice questions based on the ACTUAL content of the transcript.
- All questions must be multiple_choice with 4 options.
- Ensure one option is clearly correct based on the video context.

IMPORTANT: All questions MUST be directly based on the transcript content. Do not make up information.

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
            "concept": "specific topic"
        }
    ]
}

Return ONLY the JSON, no markdown formatting or explanation.`;

    try {
        console.log('Generating quiz with Gemini...');
        const result = await gemini.generateContent(prompt);
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

        // Log Token Usage
        const usage = response.usageMetadata;
        if (usage) {
            const usageEntry = {
                timestamp: new Date().toISOString(),
                type: 'generate_quiz',
                videoId,
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
        const result = await gemini.generateContent(prompt);
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
