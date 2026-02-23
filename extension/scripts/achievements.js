/**
 * QuestTube - Achievement Definitions & Logic
 * Shared between content scripts and popup
 */

const QUEST_ACHIEVEMENTS = [
  // Quest count
  { id: 'first_quest', name: 'First Steps', desc: 'Complete your first quest', tier: 'common', color: '#4ade80', icon: 'boot' },
  { id: 'quests_10', name: 'Adventurer', desc: 'Complete 10 quests', tier: 'uncommon', color: '#e9a820', icon: 'sword' },
  { id: 'quests_25', name: 'Veteran', desc: 'Complete 25 quests', tier: 'rare', color: '#f97316', icon: 'shield' },
  // Score
  { id: 'perfect', name: 'Flawless', desc: 'Score 100% on any quest', tier: 'rare', color: '#a78bfa', icon: 'gem' },
  // Boss
  { id: 'boss_clear', name: 'Boss Slayer', desc: 'Clear a Boss Arena quest', tier: 'uncommon', color: '#e9a820', icon: 'skull' },
  { id: 'boss_master', name: 'Boss Master', desc: 'Score 95%+ on Boss Arena', tier: 'legendary', color: '#ef4444', icon: 'crown' },
  // Streak
  { id: 'streak_3', name: 'On Fire', desc: '3-day streak', tier: 'common', color: '#4ade80', icon: 'flame1' },
  { id: 'streak_7', name: 'Dedicated', desc: '7-day streak', tier: 'uncommon', color: '#e9a820', icon: 'flame2' },
  { id: 'streak_14', name: 'Unstoppable', desc: '14-day streak', tier: 'legendary', color: '#ef4444', icon: 'flame3' },
  // Level
  { id: 'level_5', name: 'Rising Star', desc: 'Reach Level 5', tier: 'uncommon', color: '#e9a820', icon: 'star' },
  { id: 'level_10', name: 'Elite', desc: 'Reach Level 10', tier: 'rare', color: '#f97316', icon: 'medal' },
  // Coins
  { id: 'coins_100', name: 'Treasure Hunter', desc: 'Collect 100 coins', tier: 'uncommon', color: '#e9a820', icon: 'chest' },
];

/**
 * Check all achievements against current context and unlock newly earned ones.
 * @param {{ score: number, mode: string, maxCombo: number, stats: object }} ctx
 * @returns {Promise<Array>} Newly unlocked achievements
 */
async function checkQuestAchievements(ctx) {
  const data = await chrome.storage.local.get('achievements');
  const unlocked = data.achievements || {};
  const newlyUnlocked = [];

  const checks = {
    first_quest: () => ctx.stats.totalQuizzes >= 1,
    quests_10:   () => ctx.stats.totalQuizzes >= 10,
    quests_25:   () => ctx.stats.totalQuizzes >= 25,
    perfect:     () => ctx.score === 100,
    boss_clear:  () => ctx.mode === 'boss',
    boss_master: () => ctx.mode === 'boss' && ctx.score >= 95,
    streak_3:    () => ctx.stats.streak >= 3,
    streak_7:    () => ctx.stats.streak >= 7,
    streak_14:   () => ctx.stats.streak >= 14,
    level_5:     () => ctx.stats.level >= 5,
    level_10:    () => ctx.stats.level >= 10,
    coins_100:   () => ctx.stats.coins >= 100,
  };

  for (const ach of QUEST_ACHIEVEMENTS) {
    if (unlocked[ach.id]) continue;
    const check = checks[ach.id];
    if (check && check()) {
      unlocked[ach.id] = { unlockedAt: new Date().toISOString() };
      newlyUnlocked.push(ach);
    }
  }

  if (newlyUnlocked.length > 0) {
    await chrome.storage.local.set({ achievements: unlocked });
  }

  return newlyUnlocked;
}

// Export
if (typeof window !== 'undefined') {
  window.QuestTubeAchievements = {
    QUEST_ACHIEVEMENTS,
    checkQuestAchievements,
  };
}
