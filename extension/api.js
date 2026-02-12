/**
 * YouTube Quizzer - API Integration
 * Handles communication with the backend API
 */

const API_BASE_URL = 'http://localhost:3000';

async function postJsonWithFallback(paths, payload, defaultErrorMessage) {
    let lastError = null;

    for (const path of paths) {
        try {
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let message = defaultErrorMessage;
                try {
                    const error = await response.json();
                    message = error.message || error.error || message;
                } catch (parseError) {
                    const text = await response.text();
                    if (text) message = text;
                }

                const endpointMissing = response.status === 404 || response.status === 405;
                if (endpointMissing) {
                    lastError = new Error(message);
                    continue;
                }

                throw new Error(message);
            }

            return await response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw (lastError || new Error(defaultErrorMessage));
}

/**
 * Fetch transcript for a video
 */
async function fetchTranscript(videoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transcript/${videoId}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch transcript');
        }

        return await response.json();
    } catch (error) {
        console.error('Transcript fetch error:', error);
        throw error;
    }
}

/**
 * Generate quiz from transcript
 */
async function generateQuiz(videoId, title, priorWeakConcepts = []) {
    try {
        return await postJsonWithFallback(
            ['/api/quiz', '/api/quiz/generate'],
            {
                videoId,
                title,
                questionCount: 6,
                priorWeakConcepts,
            },
            'Failed to generate quiz'
        );
    } catch (error) {
        console.error('Quiz generation error:', error);
        throw error;
    }
}

/**
 * Submit quiz answers for grading
 */
async function submitQuiz(videoId, quiz, userAnswers) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoId,
                quiz,
                userAnswers,
            }),
        });

        if (!response.ok) {
            let message = 'Failed to submit quiz';
            try {
                const error = await response.json();
                message = error.message || error.error || message;
            } catch (parseError) {
                const text = await response.text();
                if (text) message = text;
            }
            throw new Error(message);
        }

        return await response.json();
    } catch (error) {
        console.error('Quiz submission error:', error);
        throw error;
    }
}

// Export for use in other scripts
window.YouTubeQuizzerAPI = {
    fetchTranscript,
    generateQuiz,
    submitQuiz,
};
