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
        // YouTube uses History API for navigation
        const observer = new MutationObserver(() => {
            const videoId = getVideoId();
            if (videoId && videoId !== currentVideoId) {
                setup();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Also listen for popstate
        window.addEventListener('popstate', setup);
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

            // Generate quiz (Gemini analyzes video directly - no transcript needed)
            const quiz = await window.YouTubeQuizzerAPI.generateQuiz(
                videoId,
                title,
                priorWeakConcepts,
                modeConfig
            );

            // Show quiz
            quizModal.showQuiz(quiz);

            // Setup submit handler
            quizModal.onSubmit = async (answers) => {
                const results = await window.YouTubeQuizzerAPI.submitQuiz(videoId, quiz, answers);

                // Post-submit persistence should never block result rendering
                try {
                    if (window.QuestTubeStorage) {
                        await window.QuestTubeStorage.saveQuizAttempt({
                            videoId,
                            title,
                            score: results.score,
                            weakConcepts: results.weakConcepts,
                        });

                        await window.QuestTubeStorage.updateStreak();

                        await window.QuestTubeStorage.updateConceptModel(
                            results.weakConcepts,
                            results.spacingSchedule
                        );

                        // Award XP: 1 XP per 1% Score (e.g. 80% = 80 XP)
                        const xpEarned = Math.round(results.score);
                        const xpResult = await window.QuestTubeStorage.addXP(xpEarned);

                        // Add Coins: 10 coins for passing (>70%), 20 for perfect
                        let coinsEarned = 0;
                        if (results.score >= 70) coinsEarned = 10;
                        if (results.score === 100) coinsEarned = 20;
                        if (coinsEarned > 0) {
                            const coinsResult = await window.QuestTubeStorage.addCoins(coinsEarned);
                            coinsEarned = Number(coinsResult?.coinsEarned || 0);
                        }

                        results.xpResult = xpResult;
                        results.coinsEarned = coinsEarned;

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

    // Start
    init();
})();
