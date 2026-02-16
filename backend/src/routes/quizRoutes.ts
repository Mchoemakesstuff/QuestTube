import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fetchTranscript } from '../utils/transcript';
import { generateQuizFromTranscript, gradeQuizAnswers } from '../utils/gemini';

/**
 * Register quiz routes
 */
export async function quizRoutes(fastify: FastifyInstance) {
    const generateQuizHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = request.body as any;
            const {
                videoId,
                title,
                questionCount = 8,
                difficulty = 'intermediate',
                priorWeakConcepts = []
            } = body;

            if (!videoId) {
                return reply.status(400).send({ error: 'videoId is required' });
            }

            console.log(`=== Generating quiz for video: ${videoId} ===`);

            // Step 1: Fetch transcript via Supadata
            console.log('Step 1: Fetching transcript...');
            const transcriptResult = await fetchTranscript(videoId);

            if (!transcriptResult.success || !transcriptResult.text) {
                const statusCode = Number(transcriptResult.statusCode) || 404;
                return reply.status(statusCode).send({
                    error: transcriptResult.error || 'Transcript not available for this video'
                });
            }

            console.log(`Transcript fetched: ${transcriptResult.text.length} characters`);

            // Prefer timestamped transcript so Gemini can provide per-question timestamps
            const transcriptForQuiz = transcriptResult.timestampedText || transcriptResult.text;

            // Step 2: Generate quiz using Gemini
            console.log('Step 2: Generating quiz with Gemini...');
            const quiz = await generateQuizFromTranscript(
                videoId,
                title || 'YouTube Video',
                transcriptForQuiz,
                questionCount,
                difficulty,
                priorWeakConcepts
            );

            console.log(`=== Quiz generated successfully: ${quiz.questions.length} questions ===`);
            return reply.send(quiz);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: 'Failed to generate quiz',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };

    /**
     * POST /api/quiz/generate
     * Fetches transcript and generates quiz using Gemini AI
     */
    fastify.post('/api/quiz/generate', generateQuizHandler);

    /**
     * POST /api/quiz
     * Alias for quiz generation used by some frontend clients.
     */
    fastify.post('/api/quiz', generateQuizHandler);

    /**
     * POST /api/quiz/submit
     * Grades a quiz submission using Gemini AI
     */
    fastify.post('/api/quiz/submit', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = request.body as any;
            const { videoId, quiz, userAnswers } = body;

            if (!quiz || !userAnswers) {
                return reply.status(400).send({ error: 'quiz and userAnswers are required' });
            }

            console.log(`=== Grading quiz for video: ${videoId} ===`);

            // Grade the quiz using Gemini
            const result = await gradeQuizAnswers(quiz, userAnswers);

            console.log(`=== Quiz graded: ${result.score}% ===`);
            return reply.send(result);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: 'Failed to submit quiz',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    /**
     * GET /api/transcript/:videoId
     * Utility endpoint to test transcript fetching
     */
    fastify.get('/api/transcript/:videoId', async (request: FastifyRequest<{ Params: { videoId: string } }>, reply: FastifyReply) => {
        const { videoId } = request.params;

        const result = await fetchTranscript(videoId);

        if (!result.success) {
            const statusCode = Number(result.statusCode) || 404;
            return reply.status(statusCode).send({ error: result.error });
        }

        return reply.send({
            videoId,
            transcript: result.text,
            length: result.text?.length || 0,
        });
    });
}
