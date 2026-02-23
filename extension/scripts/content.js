/**
 * YouTube Quizzer - Content Script
 * Injects quiz button and handles YouTube integration
 */

(function () {
    'use strict';

    let quizModal = null;
    let quizButton = null;
    let videoElement = null;
    let currentVideoId = null;
    const questSound = new SoundManager();

    /**
     * Initialize the content script
     */
    function init() {
        console.log('YouTube Quizzer: Initializing...');

        // Inject Google Fonts via <link> so they actually load (CSS @import gets blocked by CSP)
        if (!document.querySelector('link[data-ytq-fonts]')) {
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&display=swap';
            fontLink.setAttribute('data-ytq-fonts', '1');
            document.head.appendChild(fontLink);
        }

        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }

        // Handle YouTube SPA navigation
        observeNavigations();

        // Listen for review quiz launch requests from popup.
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message?.type === 'START_REVIEW_QUIZ') {
                const concept = typeof message.concept === 'string' ? message.concept.trim() : '';
                startQuiz({ forcedWeakConcepts: concept ? [concept] : [] })
                    .then((success) => sendResponse({
                        success: Boolean(success),
                        error: success ? undefined : 'Failed to start review quiz',
                    }));
                return true;
            }
            return false;
        });
    }

    /**
     * Setup the extension on current page
     */
    function setup() {
        const videoId = getVideoId();
        if (!videoId) return;

        if (videoId !== currentVideoId) {
            currentVideoId = videoId;
            cleanup();
            injectQuizButton();
            attachVideoListeners();
        }
    }

    /**
     * Observe YouTube navigation (SPA)
     */
    function observeNavigations() {
        // YouTube dispatches this custom event on SPA navigations
        window.addEventListener('yt-navigate-finish', setup);

        // Fallback for popstate (back/forward)
        window.addEventListener('popstate', setup);

        // Secondary fallback: lightweight MutationObserver on <title> only,
        // in case yt-navigate-finish is ever dropped by YouTube
        const observer = new MutationObserver(() => {
            const videoId = getVideoId();
            if (videoId && videoId !== currentVideoId) {
                setup();
            }
        });

        const titleEl = document.querySelector('title');
        if (titleEl) {
            observer.observe(titleEl, { childList: true });
        }
    }

    /**
     * Extract video ID from URL
     */
    function getVideoId() {
        const url = new URL(window.location.href);
        return url.searchParams.get('v');
    }

    /**
     * Get video title
     */
    function getVideoTitle() {
        const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata');
        return titleElement?.textContent?.trim() || 'YouTube Video';
    }

    /**
     * Detect stale content scripts after extension reload/update.
     * In that state, runtime API access throws "Extension context invalidated".
     */
    function isExtensionContextInvalidated() {
        if (typeof chrome === 'undefined') return false;

        try {
            if (!chrome.runtime) return true;
            // Accessing runtime.id throws in invalidated contexts.
            void chrome.runtime.id;
            return false;
        } catch (error) {
            return true;
        }
    }

    /**
     * Inject the "Quiz me now" button
     */
    function injectQuizButton() {
        // Try multiple selectors for player controls
        const selectors = [
            '.ytp-right-controls',
            '.ytp-chrome-controls .ytp-right-controls',
            '#movie_player .ytp-right-controls',
        ];

        const checkControls = setInterval(() => {
            // First check if we already have a button
            if (document.querySelector('.ytq-quiz-button')) {
                clearInterval(checkControls);
                return;
            }

            // Try to find controls
            let controls = null;
            for (const selector of selectors) {
                controls = document.querySelector(selector);
                if (controls) break;
            }

            if (controls) {
                clearInterval(checkControls);
                createButton(controls, 'controls');
            }
        }, 500);

        // After 5 seconds, if still no button, create a floating button
        setTimeout(() => {
            clearInterval(checkControls);
            if (!document.querySelector('.ytq-quiz-button')) {
                console.log('YouTube Quizzer: Controls not found, creating floating button');
                createFloatingButton();
            }
        }, 5000);
    }

    /**
     * Create the quiz button
     */
    function createButton(container, type) {
        quizButton = document.createElement('button');
        quizButton.className = 'ytq-quiz-button';
        quizButton.textContent = 'Quest Available!';
        quizButton.addEventListener('click', handleQuizClick);

        if (type === 'controls') {
            container.insertBefore(quizButton, container.firstChild);
        } else {
            container.appendChild(quizButton);
        }
        console.log('YouTube Quizzer: Button injected (' + type + ')');
    }

    /**
     * Create a floating button as fallback
     */
    function createFloatingButton() {
        quizButton = document.createElement('button');
        quizButton.className = 'ytq-quiz-button floating';
        quizButton.textContent = 'Quest Available!';
        quizButton.addEventListener('click', handleQuizClick);
        document.body.appendChild(quizButton);
        console.log('YouTube Quizzer: Floating button created');
    }

    /**
     * Attach listeners to video element
     */
    function attachVideoListeners() {
        const checkVideo = setInterval(() => {
            videoElement = document.querySelector('video.html5-main-video');
            if (videoElement) {
                clearInterval(checkVideo);

                videoElement.addEventListener('ended', handleVideoEnd);
                console.log('YouTube Quizzer: Video listener attached');
            }
        }, 500);

        setTimeout(() => clearInterval(checkVideo), 10000);
    }

    /**
     * Handle video end event
     */
    function handleVideoEnd() {
        console.log('YouTube Quizzer: Video ended');
        // Show quiz prompt
        showQuizPrompt();
    }

    /**
     * Handle quiz button click
     */
    async function handleQuizClick() {
        console.log('YouTube Quizzer: Quiz button clicked');
        // Pause the video when starting a quest
        const video = document.querySelector('video');
        if (video && !video.paused) {
            video.pause();
        }
        questSound.playQuestChime();
        await startQuiz();
    }

    /**
     * Show quiz prompt at video end
     */
    function showQuizPrompt() {
        // Auto-start quiz (can be changed to show a prompt first)
        startQuiz();
    }

    /**
     * Start the quiz flow
     */
    async function startQuiz(options = {}) {
        if (isExtensionContextInvalidated()) {
            console.warn('YouTube Quizzer: Extension context invalidated, refreshing tab...');
            window.location.reload();
            return false;
        }

        const videoId = getVideoId();
        const title = getVideoTitle();

        if (!videoId) {
            console.error('YouTube Quizzer: No videoId found');
            return false;
        }

        try {
            if (!window.YouTubeQuizzerModal) {
                throw new Error('Quiz UI failed to load. Refresh YouTube and try again.');
            }

            if (!window.YouTubeQuizzerAPI) {
                throw new Error('Quiz API client failed to load. Refresh YouTube and try again.');
            }

            quizModal = new window.YouTubeQuizzerModal();
            quizModal.show();

            const modeConfig = await quizModal.showModeSelection();
            if (!modeConfig) {
                quizModal.hide();
                return false;
            }

            // Get prior weak concepts for interleaving
            const forcedWeakConcepts = Array.isArray(options.forcedWeakConcepts)
                ? options.forcedWeakConcepts.filter(Boolean)
                : [];
            let priorWeakConcepts = forcedWeakConcepts;
            if (priorWeakConcepts.length === 0 && window.QuestTubeStorage) {
                priorWeakConcepts = await window.QuestTubeStorage.getPriorWeakConcepts();
            }

            // Re-check context before making API call (catches stale scripts after extension reload)
            if (isExtensionContextInvalidated()) {
                quizModal.hide();
                window.location.reload();
                return false;
            }

            // Generate quiz — use mock data in demo mode, otherwise call API
            const quiz = modeConfig.demo
                ? getDemoQuiz(videoId, title, modeConfig)
                : await window.YouTubeQuizzerAPI.generateQuiz(videoId, title, priorWeakConcepts, modeConfig);

            // Show quiz
            quizModal.showQuiz(quiz);

            // Setup submit handler
            quizModal.onSubmit = async (answers) => {
                const results = modeConfig.demo
                    ? getDemoResults(quiz, answers)
                    : await window.YouTubeQuizzerAPI.submitQuiz(videoId, quiz, answers);

                // Post-submit persistence should never block result rendering
                try {
                    if (window.QuestTubeStorage) {
                        await window.QuestTubeStorage.saveQuizAttempt({
                            videoId,
                            title,
                            score: results.score,
                            weakConcepts: results.weakConcepts,
                        });

                        const streakResult = await window.QuestTubeStorage.updateStreak();
                        results.streakEvent = streakResult.streakEvent;
                        results.streakCount = streakResult.stats?.streak || 0;

                        await window.QuestTubeStorage.updateConceptModel(
                            results.weakConcepts,
                            results.spacingSchedule
                        );

                        // Floor-based reward multiplier
                        const preStats = await window.QuestTubeStorage.getPlayerStats();
                        const floorBonus = window.QuestTubeStorage.getFloorBonus(preStats.floor);

                        // Award XP: 1 XP per 1% Score, scaled by floor bonus
                        const xpEarned = Math.round(results.score * floorBonus);
                        const xpResult = await window.QuestTubeStorage.addXP(xpEarned);

                        // Add Coins: 10 coins for passing (>70%), 20 for perfect, scaled by floor
                        let baseCoins = 0;
                        if (results.score >= 70) baseCoins = 10;
                        if (results.score === 100) baseCoins = 20;
                        let coinsEarned = Math.round(baseCoins * floorBonus);
                        if (coinsEarned > 0) {
                            const coinsResult = await window.QuestTubeStorage.addCoins(coinsEarned);
                            coinsEarned = Number(coinsResult?.coinsEarned || 0);
                        }

                        results.xpResult = xpResult;
                        results.coinsEarned = coinsEarned;

                        // Update persistent floor progression
                        const floorResult = await window.QuestTubeStorage.updateFloor(
                            results.score,
                            modeConfig.mode
                        );
                        results.floorResult = floorResult;

                        // Save wrong answers for popup review
                        const feedback = Array.isArray(results.questionFeedback) ? results.questionFeedback : [];
                        const wrongAnswers = feedback
                            .filter(fb => !fb.isCorrect)
                            .map(fb => {
                                const q = quiz.questions?.[fb.questionIndex];
                                return {
                                    text: q?.text || `Question ${fb.questionIndex + 1}`,
                                    timestampSeconds: typeof q?.timestampSeconds === 'number' ? q.timestampSeconds : null,
                                };
                            });
                        await window.QuestTubeStorage.saveWrongAnswers({ videoId, videoTitle: title, wrongAnswers });
                    }

                    if (Array.isArray(results.spacingSchedule) && results.spacingSchedule.length > 0) {
                        chrome.runtime.sendMessage({
                            type: 'SCHEDULE_REVIEWS',
                            spacingSchedule: results.spacingSchedule,
                        }).catch((scheduleError) => {
                            console.error('YouTube Quizzer: Failed to schedule reviews', scheduleError);
                        });
                    }

                    // Check for newly unlocked achievements
                    if (window.QuestTubeAchievements) {
                        const freshStats = await window.QuestTubeStorage.getPlayerStats();
                        const newBadges = await window.QuestTubeAchievements.checkQuestAchievements({
                            score: results.score,
                            mode: modeConfig.mode,
                            maxCombo: quizModal.maxCombo || 0,
                            stats: freshStats,
                        });
                        if (newBadges.length > 0) {
                            results.newAchievements = newBadges;
                        }
                    }
                } catch (postSubmitError) {
                    console.error('YouTube Quizzer: Post-submit processing failed', postSubmitError);
                }

                quizModal.showResults(results);
            };

            // Setup retry handler
            quizModal.onRetry = () => startQuiz();

        } catch (error) {
            console.error('YouTube Quizzer: Error starting quiz', error);
            const message = error instanceof Error ? error.message : 'Failed to launch quiz';
            if (quizModal && typeof quizModal.showError === 'function') {
                quizModal.showError(message);
            } else {
                alert(message);
            }
            return false;
        }

        return true;
    }

    /**
     * Cleanup on navigation
     */
    function cleanup() {
        if (quizButton) {
            quizButton.remove();
            quizButton = null;
        }
        if (quizModal) {
            quizModal.hide();
            quizModal = null;
        }
        if (videoElement) {
            videoElement.removeEventListener('ended', handleVideoEnd);
            videoElement = null;
        }
    }

    /**
     * Demo mode — mock quiz data for UI testing without API calls
     */
    function getDemoQuiz(videoId, title, modeConfig) {
        const count = modeConfig.questionCount || 5;
        const questions = [];
        const pool = [
            {
                type: 'multiple_choice',
                text: 'What is the main topic discussed in this video?',
                options: [
                    { label: 'A', text: 'Machine learning basics' },
                    { label: 'B', text: 'Cooking techniques' },
                    { label: 'C', text: 'Space exploration' },
                    { label: 'D', text: 'Ancient history' },
                ],
                correctAnswer: 'A',
                feedback: 'The video primarily covers machine learning.',
                concepts: ['main topic'],
            },
            {
                type: 'multiple_choice',
                text: 'Which framework was mentioned as the most popular?',
                options: [
                    { label: 'A', text: 'Django' },
                    { label: 'B', text: 'React' },
                    { label: 'C', text: 'Flask' },
                    { label: 'D', text: 'Vue' },
                ],
                correctAnswer: 'B',
                feedback: 'React was highlighted as the most popular.',
                concepts: ['frameworks'],
            },
            {
                type: 'short_answer',
                text: 'What protocol is used for secure web communication?',
                correctAnswer: 'HTTPS',
                feedback: 'HTTPS encrypts data in transit.',
                concepts: ['security'],
            },
            {
                type: 'free_recall',
                text: 'In your own words, explain why testing is important in software development.',
                correctAnswer: 'Testing catches bugs early, ensures code works as expected, prevents regressions, and gives developers confidence to refactor.',
                feedback: 'Testing is a core practice in professional development.',
                concepts: ['testing'],
            },
            {
                type: 'multiple_choice',
                text: 'What does "DRY" stand for in programming?',
                options: [
                    { label: 'A', text: 'Do Repeat Yourself' },
                    { label: 'B', text: 'Don\'t Repeat Yourself' },
                    { label: 'C', text: 'Data Runs Yearly' },
                    { label: 'D', text: 'Debug Run Yield' },
                ],
                correctAnswer: 'B',
                feedback: 'DRY = Don\'t Repeat Yourself.',
                concepts: ['principles'],
            },
            {
                type: 'short_answer',
                text: 'What language is Chrome extensions primarily written in?',
                correctAnswer: 'JavaScript',
                feedback: 'Chrome extensions use JavaScript, HTML, and CSS.',
                concepts: ['web tech'],
            },
            {
                type: 'multiple_choice',
                text: 'Which data structure uses FIFO ordering?',
                options: [
                    { label: 'A', text: 'Stack' },
                    { label: 'B', text: 'Queue' },
                    { label: 'C', text: 'Tree' },
                    { label: 'D', text: 'Graph' },
                ],
                correctAnswer: 'B',
                feedback: 'Queues follow First In, First Out.',
                concepts: ['data structures'],
            },
            {
                type: 'free_recall',
                text: 'Describe the difference between authentication and authorization.',
                correctAnswer: 'Authentication verifies who you are (identity), while authorization determines what you are allowed to do (permissions).',
                feedback: 'These are distinct security concepts.',
                concepts: ['security'],
            },
            {
                type: 'multiple_choice',
                text: 'What is the time complexity of binary search?',
                options: [
                    { label: 'A', text: 'O(n)' },
                    { label: 'B', text: 'O(n²)' },
                    { label: 'C', text: 'O(log n)' },
                    { label: 'D', text: 'O(1)' },
                ],
                correctAnswer: 'C',
                feedback: 'Binary search halves the search space each step.',
                concepts: ['algorithms'],
            },
            {
                type: 'short_answer',
                text: 'What does API stand for?',
                correctAnswer: 'Application Programming Interface',
                feedback: 'APIs define how software components interact.',
                concepts: ['fundamentals'],
            },
            {
                type: 'multiple_choice',
                text: 'Which HTTP method is used to update a resource?',
                options: [
                    { label: 'A', text: 'GET' },
                    { label: 'B', text: 'POST' },
                    { label: 'C', text: 'PUT' },
                    { label: 'D', text: 'DELETE' },
                ],
                correctAnswer: 'C',
                feedback: 'PUT is the standard method for updating resources.',
                concepts: ['HTTP'],
            },
            {
                type: 'free_recall',
                text: 'Explain what a closure is in JavaScript.',
                correctAnswer: 'A closure is a function that retains access to variables from its outer (enclosing) scope even after the outer function has returned.',
                feedback: 'Closures are fundamental to JS.',
                concepts: ['JavaScript'],
            },
        ];

        for (let i = 0; i < count; i++) {
            questions.push(pool[i % pool.length]);
        }

        return {
            videoId,
            title: title || 'Demo Quiz',
            questions,
            generatedAt: new Date().toISOString(),
        };
    }

    function getDemoResults(quiz, answers) {
        const total = quiz.questions.length;
        const feedback = quiz.questions.map((q, i) => {
            const userAns = answers[i]?.answer || '';
            const isCorrect = userAns.toLowerCase().trim() === (q.correctAnswer || '').toLowerCase().trim();
            return {
                questionIndex: i,
                isCorrect,
                userAnswer: userAns,
                correctAnswer: q.correctAnswer,
                feedback: q.feedback || '',
                conceptsMissed: isCorrect ? [] : (q.concepts || []),
            };
        });
        const correctCount = feedback.filter(f => f.isCorrect).length;
        const score = Math.round((correctCount / total) * 100);
        return {
            score,
            totalQuestions: total,
            correctCount,
            questionFeedback: feedback,
            weakConcepts: feedback.filter(f => !f.isCorrect).flatMap(f => f.conceptsMissed),
            followUpQuestions: [],
            spacingSchedule: [],
        };
    }

    // Start
    init();
})();
