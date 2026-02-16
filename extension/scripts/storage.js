/**
 * QuestTube - Storage Module
 * Handles chrome.storage.local operations
 */

const STORAGE_KEYS = {
    QUIZ_ATTEMPTS: 'quizAttempts',
    CONCEPT_MODEL: 'conceptModel',
    SETTINGS: 'settings',
    // Gamification
    PLAYER_STATS: 'playerStats',
    // Last quiz wrong answers (for popup review)
    LAST_WRONG_ANSWERS: 'lastWrongAnswers',
};

/**
 * Save a quiz attempt
 */
async function saveQuizAttempt(attempt) {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.QUIZ_ATTEMPTS);
        const attempts = data[STORAGE_KEYS.QUIZ_ATTEMPTS] || [];

        attempts.push({
            ...attempt,
            timestamp: new Date().toISOString(),
        });

        await chrome.storage.local.set({
            [STORAGE_KEYS.QUIZ_ATTEMPTS]: attempts,
        });

        return true;
    } catch (error) {
        console.error('Failed to save quiz attempt:', error);
        return false;
    }
}

/**
 * Get quiz history for a video
 */
async function getQuizHistory(videoId) {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.QUIZ_ATTEMPTS);
        const attempts = data[STORAGE_KEYS.QUIZ_ATTEMPTS] || [];

        return attempts.filter(a => a.videoId === videoId);
    } catch (error) {
        console.error('Failed to get quiz history:', error);
        return [];
    }
}

/**
 * Update concept model with weak concepts
 */
async function updateConceptModel(weakConcepts, spacingSchedule) {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.CONCEPT_MODEL);
        const model = data[STORAGE_KEYS.CONCEPT_MODEL] || {};

        for (const schedule of spacingSchedule) {
            const existing = model[schedule.concept] || {
                strengthScore: 0,
                reviewCount: 0,
                lastReviewed: null,
                dueDates: [],
            };

            model[schedule.concept] = {
                ...existing,
                strengthScore: Math.max(0, existing.strengthScore - 1),
                lastReviewed: new Date().toISOString(),
                dueDates: [...existing.dueDates, schedule.nextReviewDate],
            };
        }

        await chrome.storage.local.set({
            [STORAGE_KEYS.CONCEPT_MODEL]: model,
        });

        return model;
    } catch (error) {
        console.error('Failed to update concept model:', error);
        return {};
    }
}

/**
 * Get concepts due for review
 */
async function getDueConcepts() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.CONCEPT_MODEL);
        const model = data[STORAGE_KEYS.CONCEPT_MODEL] || {};
        const now = new Date();

        const due = [];
        for (const [concept, info] of Object.entries(model)) {
            const dueDates = info.dueDates || [];
            const isDue = dueDates.some(d => new Date(d) <= now);
            if (isDue) {
                due.push({ concept, ...info });
            }
        }

        return due;
    } catch (error) {
        console.error('Failed to get due concepts:', error);
        return [];
    }
}

/**
 * Get prior weak concepts for interleaving
 */
async function getPriorWeakConcepts(limit = 5) {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.CONCEPT_MODEL);
        const model = data[STORAGE_KEYS.CONCEPT_MODEL] || {};

        // Sort by lowest strength score
        const concepts = Object.entries(model)
            .map(([concept, info]) => ({ concept, ...info }))
            .sort((a, b) => a.strengthScore - b.strengthScore)
            .slice(0, limit)
            .map(c => c.concept);

        return concepts;
    } catch (error) {
        console.error('Failed to get weak concepts:', error);
        return [];
    }
}

/**
 * Get player stats (XP, level, coins, streak)
 */
async function getPlayerStats() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.PLAYER_STATS);
        return data[STORAGE_KEYS.PLAYER_STATS] || {
            xp: 0,
            level: 1,
            coins: 0,
            streak: 0,
            lastPlayedDate: null,
            totalQuizzes: 0,
        };
    } catch (error) {
        console.error('Failed to get player stats:', error);
        return { xp: 0, level: 1, coins: 0, streak: 0, lastPlayedDate: null, totalQuizzes: 0 };
    }
}

/**
 * Calculate XP needed for next level
 * Level 1 requires 100 XP to reach Level 2
 * Level 2 requires 200 XP to reach Level 3
 * Formula: Level * 100
 */
function getXPToNextLevel(level) {
    return level * 100;
}

/**
 * Add XP and handle level up
 */
async function addXP(amount) {
    try {
        const stats = await getPlayerStats();
        const oldLevel = stats.level;

        stats.xp += amount;

        // Progressive leveling loop
        let xpToNext = getXPToNextLevel(stats.level);
        while (stats.xp >= xpToNext) {
            stats.xp -= xpToNext;
            stats.level++;
            xpToNext = getXPToNextLevel(stats.level);
        }

        const leveledUp = stats.level > oldLevel;

        await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
        return {
            stats,
            leveledUp,
            oldLevel,
            newLevel: stats.level,
            xpEarned: amount
        };
    } catch (error) {
        console.error('Failed to add XP:', error);
        return { stats: null, leveledUp: false };
    }
}

/**
 * Add coins
 */
async function addCoins(amount) {
    try {
        const stats = await getPlayerStats();
        stats.coins += amount;
        await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
        return {
            stats,
            coinsEarned: amount
        };
    } catch (error) {
        console.error('Failed to add coins:', error);
        return null;
    }
}

/**
 * Update daily streak
 */
async function updateStreak() {
    try {
        const stats = await getPlayerStats();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (stats.lastPlayedDate === today) {
            // Already played today
            return stats;
        } else if (stats.lastPlayedDate === yesterday) {
            // Streak continues
            stats.streak += 1;
        } else {
            // Streak broken, reset to 1
            stats.streak = 1;
        }

        stats.lastPlayedDate = today;
        stats.totalQuizzes += 1;

        await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
        return stats;
    } catch (error) {
        console.error('Failed to update streak:', error);
        return null;
    }
}

/**
 * Save wrong answers from the most recent quiz (replaces previous)
 * @param {{ videoId: string, videoTitle: string, wrongAnswers: Array<{ text: string, timestampSeconds: number|null }> }} data
 */
async function saveWrongAnswers(data) {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEYS.LAST_WRONG_ANSWERS]: {
                videoId: data.videoId,
                videoTitle: data.videoTitle,
                wrongAnswers: data.wrongAnswers,
                savedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Failed to save wrong answers:', error);
    }
}

/**
 * Get wrong answers from the most recent quiz
 */
async function getWrongAnswers() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.LAST_WRONG_ANSWERS);
        return data[STORAGE_KEYS.LAST_WRONG_ANSWERS] || null;
    } catch (error) {
        console.error('Failed to get wrong answers:', error);
        return null;
    }
}

// Export for use in other scripts
window.QuestTubeStorage = {
    saveQuizAttempt,
    getQuizHistory,
    updateConceptModel,
    getDueConcepts,
    getPriorWeakConcepts,
    // Gamification
    getPlayerStats,
    addXP,
    getXPToNextLevel,
    addCoins,
    updateStreak,
    // Wrong answer review
    saveWrongAnswers,
    getWrongAnswers,
};
