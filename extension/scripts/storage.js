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
    // Shop
    SHOP_INVENTORY: 'shopInventory',
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
            longestStreak: 0,
            streakFreezes: 0,
            lastPlayedDate: null,
            totalQuizzes: 0,
            floor: 1,
            deepestFloor: 1,
        };
    } catch (error) {
        console.error('Failed to get player stats:', error);
        return { xp: 0, level: 1, coins: 0, streak: 0, longestStreak: 0, streakFreezes: 0, lastPlayedDate: null, totalQuizzes: 0, floor: 1, deepestFloor: 1 };
    }
}

/**
 * Get streak tier from streak count
 * 0 = no flame, 1 = Ember (1-2), 2 = Spark (3-6), 3 = Blaze (7-13), 4 = Inferno (14+)
 */
function getStreakTier(streak) {
    if (streak >= 14) return 4;
    if (streak >= 7) return 3;
    if (streak >= 3) return 2;
    if (streak >= 1) return 1;
    return 0;
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
 * @returns {{ stats: object, streakEvent: string }}
 * streakEvent: "incremented" | "maintained" | "frozen" | "reset" | "started"
 */
async function updateStreak() {
    try {
        const stats = await getPlayerStats();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        let streakEvent;

        stats.totalQuizzes += 1;

        if (stats.lastPlayedDate === today) {
            streakEvent = 'maintained';
            await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
            return { stats, streakEvent };
        } else if (stats.lastPlayedDate === yesterday) {
            stats.streak += 1;
            streakEvent = 'incremented';
        } else if (!stats.lastPlayedDate) {
            stats.streak = 1;
            streakEvent = 'started';
        } else if (stats.streakFreezes > 0) {
            // Would have broken, but a shield saves it
            stats.streakFreezes -= 1;
            streakEvent = 'frozen';
        } else {
            stats.streak = 1;
            streakEvent = 'reset';
        }

        // Track longest streak
        if (stats.streak > (stats.longestStreak || 0)) {
            stats.longestStreak = stats.streak;
        }

        stats.lastPlayedDate = today;

        await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
        return { stats, streakEvent };
    } catch (error) {
        console.error('Failed to update streak:', error);
        return { stats: null, streakEvent: 'maintained' };
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

/**
 * Shop item catalog
 */
const SHOP_ITEMS = [
    // Titles — displayed under level badge
    { id: 'title_scholar',  category: 'title', name: 'Scholar',  price: 25,  preview: 'Scholar' },
    { id: 'title_warrior',  category: 'title', name: 'Warrior',  price: 25,  preview: 'Warrior' },
    { id: 'title_sage',     category: 'title', name: 'Sage',     price: 50,  preview: 'Sage' },
    { id: 'title_champion', category: 'title', name: 'Champion', price: 75,  preview: 'Champion' },
    { id: 'title_legend',   category: 'title', name: 'Legend',   price: 100, preview: 'Legend' },
    // Themes — popup background tint
    { id: 'theme_crimson',  category: 'theme', name: 'Crimson Keep',   price: 50,  preview: '#2e1a1a' },
    { id: 'theme_emerald',  category: 'theme', name: 'Emerald Grove',  price: 50,  preview: '#1a2e1a' },
    { id: 'theme_twilight', category: 'theme', name: 'Twilight Realm', price: 75,  preview: '#2a1a2e' },
    { id: 'theme_golden',   category: 'theme', name: 'Golden Palace',  price: 100, preview: '#2e2a1a' },
    // Button skins — Enter Quest button gradient
    { id: 'btn_flame',  category: 'button', name: 'Flame',  price: 40, preview: 'linear-gradient(180deg, #f97316 0%, #dc2626 100%)' },
    { id: 'btn_ice',    category: 'button', name: 'Ice',    price: 40, preview: 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)' },
    { id: 'btn_royal',  category: 'button', name: 'Royal',  price: 60, preview: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)' },
    { id: 'btn_shadow', category: 'button', name: 'Shadow', price: 80, preview: 'linear-gradient(180deg, #6b7280 0%, #1f2937 100%)' },
    // Consumables — stackable, not equippable
    { id: 'consumable_freeze', category: 'consumable', name: 'Streak Shield', price: 30, preview: null },
];

/**
 * Get shop inventory (owned items + equipped items)
 */
async function getShopInventory() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.SHOP_INVENTORY);
        return data[STORAGE_KEYS.SHOP_INVENTORY] || {
            owned: [],
            equipped: { title: null, theme: null, button: null },
        };
    } catch (error) {
        console.error('Failed to get shop inventory:', error);
        return { owned: [], equipped: { title: null, theme: null, button: null } };
    }
}

/**
 * Purchase a shop item (deducts coins)
 * @returns {{ success: boolean, error?: string, inventory?: object, stats?: object }}
 */
async function purchaseItem(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return { success: false, error: 'Item not found' };

    const stats = await getPlayerStats();
    if (stats.coins < item.price) return { success: false, error: 'Not enough coins' };

    stats.coins -= item.price;

    // Consumables stack instead of going into owned array
    if (item.category === 'consumable') {
        if (itemId === 'consumable_freeze') {
            stats.streakFreezes = (stats.streakFreezes || 0) + 1;
        }
        await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
        return { success: true, inventory: await getShopInventory(), stats };
    }

    const inventory = await getShopInventory();
    if (inventory.owned.includes(itemId)) return { success: false, error: 'Already owned' };

    inventory.owned.push(itemId);

    await chrome.storage.local.set({
        [STORAGE_KEYS.PLAYER_STATS]: stats,
        [STORAGE_KEYS.SHOP_INVENTORY]: inventory,
    });

    return { success: true, inventory, stats };
}

/**
 * Equip/unequip a shop item
 */
async function equipItem(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return null;

    const inventory = await getShopInventory();
    if (!inventory.owned.includes(itemId)) return null;

    // Toggle: if already equipped, unequip
    if (inventory.equipped[item.category] === itemId) {
        inventory.equipped[item.category] = null;
    } else {
        inventory.equipped[item.category] = itemId;
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.SHOP_INVENTORY]: inventory });
    return inventory;
}

/**
 * Map a floor number to a zone (biome) for visual theming
 */
function getFloorZone(floor) {
    if (floor <= 5)  return { name: 'Meadow',  zone: 'meadow',  color: '#4ade80' };
    if (floor <= 15) return { name: 'Caverns', zone: 'cave',    color: '#fbbf24' };
    if (floor <= 30) return { name: 'Dungeon', zone: 'dungeon', color: '#a78bfa' };
    return              { name: 'Abyss',   zone: 'abyss',   color: '#ef4444' };
}

/**
 * Update persistent floor after a quiz
 * Score < 50%: -1 floor | 50-69%: stay | 70-84%: +1 | 85-94%: +2 | 95-100%: +3
 * Positive advancement multiplied by mode: easy x1, intermediate x2, boss x3
 */
async function updateFloor(score, mode) {
    try {
        const stats = await getPlayerStats();
        const oldFloor = stats.floor || 1;

        let base;
        if (score >= 95)      base = 3;
        else if (score >= 85) base = 2;
        else if (score >= 70) base = 1;
        else if (score >= 50) base = 0;
        else                  base = -1;

        const multiplier = { easy: 1, intermediate: 2, boss: 3 };
        const advance = base > 0 ? base * (multiplier[mode] || 1) : base;

        stats.floor = Math.max(1, (stats.floor || 1) + advance);
        stats.deepestFloor = Math.max(stats.deepestFloor || 1, stats.floor);

        await chrome.storage.local.set({ [STORAGE_KEYS.PLAYER_STATS]: stats });
        return {
            oldFloor,
            newFloor: stats.floor,
            floorsAdvanced: stats.floor - oldFloor,
            deepestFloor: stats.deepestFloor,
        };
    } catch (error) {
        console.error('Failed to update floor:', error);
        return { oldFloor: 1, newFloor: 1, floorsAdvanced: 0, deepestFloor: 1 };
    }
}

/**
 * Get floor-based reward multiplier: +10% per 5 floors, capped at 2x
 */
function getFloorBonus(floor) {
    return 1 + Math.min(Math.floor((floor || 1) / 5) * 0.1, 1.0);
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
    getStreakTier,
    // Wrong answer review
    saveWrongAnswers,
    getWrongAnswers,
    // Floor progression
    getFloorZone,
    updateFloor,
    getFloorBonus,
    // Shop
    SHOP_ITEMS,
    getShopInventory,
    purchaseItem,
    equipItem,
};
