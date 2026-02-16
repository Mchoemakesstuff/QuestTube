import { z } from 'zod';

// ============================================
// Request Schemas
// ============================================

export const GenerateQuizRequestSchema = z.object({
    videoId: z.string().min(1),
    title: z.string().min(1),
    transcriptText: z.string().min(1),
    questionCount: z.number().int().min(3).max(15).optional().default(8),
    difficulty: z.enum(['easy', 'intermediate', 'boss']).optional().default('intermediate'),
    priorWeakConcepts: z.array(z.string()).optional().default([]),
});

export type GenerateQuizRequest = z.infer<typeof GenerateQuizRequestSchema>;

export const ConfidenceRating = z.enum(['low', 'medium', 'high']);

export const UserAnswerSchema = z.object({
    questionIndex: z.number().int().min(0),
    answer: z.string(),
    confidence: ConfidenceRating,
});

export const SubmitQuizRequestSchema = z.object({
    videoId: z.string().min(1),
    quiz: z.any(), // Will be validated as QuizSchema
    userAnswers: z.array(UserAnswerSchema),
});

export type SubmitQuizRequest = z.infer<typeof SubmitQuizRequestSchema>;

// ============================================
// Quiz Structure Schemas
// ============================================

export const QuestionType = z.enum(['free_recall', 'multiple_choice', 'short_answer']);

export const MCQOptionSchema = z.object({
    label: z.string(), // A, B, C, D
    text: z.string(),
});

export const QuestionSchema = z.object({
    type: QuestionType,
    text: z.string(),
    options: z.array(MCQOptionSchema).optional(), // Only for MCQ
    correctAnswer: z.string(),
    feedback: z.string(),
    concepts: z.array(z.string()), // Concepts tested by this question
    timestampSeconds: z.number().optional(), // Approx video timestamp where concept is discussed
});

export type Question = z.infer<typeof QuestionSchema>;

export const QuizSchema = z.object({
    videoId: z.string(),
    title: z.string(),
    questions: z.array(QuestionSchema),
    generatedAt: z.string(),
});

export type Quiz = z.infer<typeof QuizSchema>;

// ============================================
// Response Schemas
// ============================================

export const QuestionFeedbackSchema = z.object({
    questionIndex: z.number(),
    isCorrect: z.boolean(),
    userAnswer: z.string(),
    correctAnswer: z.string(),
    feedback: z.string(),
    conceptsMissed: z.array(z.string()),
});

export const SpacingScheduleSchema = z.object({
    concept: z.string(),
    nextReviewDate: z.string(), // ISO date string
    intervalDays: z.number(),
});

export const SubmitQuizResponseSchema = z.object({
    score: z.number(), // 0-100
    totalQuestions: z.number(),
    correctCount: z.number(),
    questionFeedback: z.array(QuestionFeedbackSchema),
    weakConcepts: z.array(z.string()),
    followUpQuestions: z.array(QuestionSchema),
    spacingSchedule: z.array(SpacingScheduleSchema),
});

export type SubmitQuizResponse = z.infer<typeof SubmitQuizResponseSchema>;
