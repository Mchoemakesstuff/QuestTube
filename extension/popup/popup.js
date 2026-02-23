/**
 * YouTube Quizzer - Popup Script
 * Displays stats, due reviews, and achievements
 */

document.addEventListener('DOMContentLoaded', async () => {
    typeWriter('QuestTube', 'mainTitle', 150);
    await loadStats();
    await loadWrongAnswers();
    await loadBadges();
    await loadShop();
    await loadMap();
    applyEquippedCosmetics();
    setupNavTabs();

    document.getElementById('enterQuestBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
            chrome.tabs.sendMessage(tab.id, { type: 'START_REVIEW_QUIZ' });
            window.close();
        } else {
            // Flash the button red briefly to indicate no YouTube video
            const btn = document.getElementById('enterQuestBtn');
            btn.textContent = 'Open a YouTube video first!';
            btn.style.background = 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)';
            btn.style.borderColor = '#b91c1c';
            setTimeout(() => {
                btn.textContent = 'Enter Quest';
                btn.style.background = '';
                btn.style.borderColor = '';
            }, 2000);
        }
    });
});

/**
 * Setup nav tab switching
 */
function setupNavTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const pageName = tab.dataset.page;
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Show correct page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const page = document.getElementById(`page-${pageName}`);
            if (page) page.classList.add('active');
        });
    });
}

async function typeWriter(text, elementId, speed = 100) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = '';
    element.classList.add('typewriter-cursor');

    for (let i = 0; i < text.length; i++) {
        element.textContent += text.charAt(i);
        await new Promise(resolve => setTimeout(resolve, speed));
    }
}

/**
 * Load quiz statistics
 */
async function loadStats() {
    try {
        // Get all stats from storage
        const data = await chrome.storage.local.get('playerStats');
        const stats = data.playerStats || {
            xp: 0,
            level: 1,
            coins: 0,
            streak: 0,
            longestStreak: 0,
            streakFreezes: 0,
            totalQuizzes: 0
        };

        // Update HUD
        document.querySelector('.level-badge').textContent = `LV ${stats.level}`;
        document.getElementById('streakCount').textContent = stats.streak;
        document.getElementById('coinCount').textContent = stats.coins;

        // Update streak flame tier in HUD
        const streakTier = typeof QuestTubeStorage !== 'undefined'
            ? QuestTubeStorage.getStreakTier(stats.streak)
            : (stats.streak >= 14 ? 4 : stats.streak >= 7 ? 3 : stats.streak >= 3 ? 2 : stats.streak >= 1 ? 1 : 0);
        const flameEl = document.getElementById('streakFlame');
        if (flameEl) {
            if (streakTier > 0) {
                flameEl.innerHTML = `<span class="popup-flame tier-${streakTier}"></span>`;
            } else {
                flameEl.textContent = 'Streak';
            }
        }

        // Calculate XP progress
        const xpNeeded = stats.level * 100;
        const xpProgress = Math.min(100, Math.round((stats.xp / xpNeeded) * 100));
        document.getElementById('xpBar').style.width = `${xpProgress}%`;

        // Update tile stats
        document.getElementById('quizCount').textContent = stats.totalQuizzes;

        // Best streak + floor
        const bestStreakEl = document.getElementById('bestStreak');
        if (bestStreakEl) bestStreakEl.textContent = stats.longestStreak || 0;
        const floorEl = document.getElementById('currentFloor');
        if (floorEl) floorEl.textContent = stats.floor || 1;

        // Calculate Average Score from attempts
        const attemptsData = await chrome.storage.local.get('quizAttempts');
        const attempts = attemptsData.quizAttempts || [];

        if (attempts.length > 0) {
            const avgScore = Math.round(
                attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length
            );
            document.getElementById('avgScore').textContent = `${avgScore}%`;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

/**
 * Load and render achievement badges
 */
async function loadBadges() {
    try {
        const achievements = typeof QUEST_ACHIEVEMENTS !== 'undefined' ? QUEST_ACHIEVEMENTS : [];
        const data = await chrome.storage.local.get('achievements');
        const unlocked = data.achievements || {};

        const total = achievements.length;
        const unlockedCount = achievements.filter(a => unlocked[a.id]).length;

        // Update counters
        const countEl = document.getElementById('badgeCount');
        if (countEl) countEl.textContent = `${unlockedCount}/${total}`;
        const unlockedEl = document.getElementById('badgeUnlocked');
        if (unlockedEl) unlockedEl.textContent = unlockedCount;
        const totalEl = document.getElementById('badgeTotal');
        if (totalEl) totalEl.textContent = total;

        // Render badge grid
        const grid = document.getElementById('badgeGrid');
        if (!grid) return;

        grid.innerHTML = achievements.map(ach => {
            const isUnlocked = !!unlocked[ach.id];
            const tierCls = ach.tier === 'legendary' ? 'tier-legendary' : '';
            const iconHtml = isUnlocked
                ? `<span class="badge-px badge-px-${ach.icon}"></span>`
                : '?';
            return `
                <div class="badge-tile ${isUnlocked ? 'unlocked' : 'locked'} ${tierCls}"
                     style="--badge-color: ${ach.color}">
                    <div class="badge-icon">${iconHtml}</div>
                    <div class="badge-name">${isUnlocked ? ach.name : '???'}</div>
                    <div class="badge-desc">${isUnlocked ? ach.desc : 'Locked'}</div>
                </div>`;
        }).join('');
    } catch (error) {
        console.error('Failed to load badges:', error);
    }
}


/**
 * Load and render the shop
 */
async function loadShop() {
    try {
        const items = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : [];
        const data = await chrome.storage.local.get(['shopInventory', 'playerStats']);
        const inventory = data.shopInventory || { owned: [], equipped: { title: null, theme: null, button: null } };
        const stats = data.playerStats || { coins: 0 };

        // Update shop coin display
        const shopCoins = document.getElementById('shopCoinCount');
        if (shopCoins) shopCoins.textContent = stats.coins;

        const categories = { title: 'shopTitles', theme: 'shopThemes', button: 'shopButtons' };

        for (const [cat, containerId] of Object.entries(categories)) {
            const container = document.getElementById(containerId);
            if (!container) continue;

            const catItems = items.filter(i => i.category === cat);
            container.innerHTML = catItems.map(item => {
                const isOwned = inventory.owned.includes(item.id);
                const isEquipped = inventory.equipped[cat] === item.id;
                const canAfford = stats.coins >= item.price;
                const cls = isEquipped ? 'equipped' : isOwned ? 'owned' : (!canAfford ? 'locked' : '');

                let previewHtml = '';
                if (cat === 'title') {
                    previewHtml = `<div class="shop-item-preview" style="font-size:6px;color:#a78bfa;">${item.preview[0]}</div>`;
                } else if (cat === 'theme') {
                    previewHtml = `<div class="shop-item-preview theme-swatch" style="background:${item.preview};"></div>`;
                } else if (cat === 'button') {
                    previewHtml = `<div class="shop-item-preview btn-swatch" style="background:${item.preview};"></div>`;
                }

                const statusText = isEquipped ? 'EQUIPPED' : isOwned ? 'OWNED' : '';
                const equipText = isEquipped ? 'UNEQUIP' : 'EQUIP';

                return `
                    <div class="shop-item ${cls}" data-item-id="${item.id}" data-owned="${isOwned}" data-can-afford="${canAfford}">
                        ${previewHtml}
                        <div class="shop-item-info">
                            <div class="shop-item-name">${item.name}</div>
                            <div class="shop-item-status">${statusText}</div>
                        </div>
                        <div class="shop-item-price">
                            <img src="../assets/coin.png" style="width:14px;height:14px;image-rendering:pixelated;">
                            ${item.price}
                        </div>
                        <div class="shop-item-equip">${equipText}</div>
                    </div>`;
            }).join('');
        }

        // Consumables section
        const consumableContainer = document.getElementById('shopConsumables');
        if (consumableContainer) {
            const consumableItems = items.filter(i => i.category === 'consumable');
            consumableContainer.innerHTML = consumableItems.map(item => {
                const canAfford = stats.coins >= item.price;
                const cls = !canAfford ? 'locked' : '';
                const shieldCount = stats.streakFreezes || 0;

                return `
                    <div class="shop-item ${cls}" data-item-id="${item.id}" data-owned="false" data-can-afford="${canAfford}" data-consumable="true">
                        <div class="shop-item-preview" style="font-size:12px;color:#38bdf8;">S</div>
                        <div class="shop-item-info">
                            <div class="shop-item-name">${item.name}</div>
                            <div class="shop-item-status">Owned: ${shieldCount}</div>
                        </div>
                        <div class="shop-item-price">
                            <img src="../assets/coin.png" style="width:14px;height:14px;image-rendering:pixelated;">
                            ${item.price}
                        </div>
                    </div>`;
            }).join('');
        }

        // Click handler for shop items
        const shopPage = document.getElementById('page-shop');
        if (shopPage && !shopPage._shopHandler) {
            shopPage._shopHandler = true;
            shopPage.addEventListener('click', async (e) => {
                const row = e.target.closest('.shop-item');
                if (!row) return;

                const itemId = row.dataset.itemId;
                const isOwned = row.dataset.owned === 'true';

                const isConsumable = row.dataset.consumable === 'true';

                if (isConsumable || !isOwned) {
                    const canAfford = row.dataset.canAfford === 'true';
                    if (!canAfford) return;

                    // Use storage.js purchaseItem for proper handling (consumables + regular)
                    if (typeof QuestTubeStorage !== 'undefined' && QuestTubeStorage.purchaseItem) {
                        const result = await QuestTubeStorage.purchaseItem(itemId);
                        if (!result.success) return;
                        document.getElementById('coinCount').textContent = result.stats.coins;
                    } else {
                        // Fallback: direct storage write (non-consumable only)
                        const result = await chrome.storage.local.get(['shopInventory', 'playerStats']);
                        const inv = result.shopInventory || { owned: [], equipped: { title: null, theme: null, button: null } };
                        const st = result.playerStats || { coins: 0 };
                        const items2 = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : [];
                        const item = items2.find(i => i.id === itemId);
                        if (!item || st.coins < item.price) return;
                        if (item.category !== 'consumable' && inv.owned.includes(itemId)) return;
                        st.coins -= item.price;
                        if (!inv.owned.includes(itemId)) inv.owned.push(itemId);
                        await chrome.storage.local.set({ shopInventory: inv, playerStats: st });
                        document.getElementById('coinCount').textContent = st.coins;
                    }
                    await loadStats();
                    await loadShop();
                } else {
                    // Toggle equip
                    const result = await chrome.storage.local.get('shopInventory');
                    const inv = result.shopInventory || { owned: [], equipped: { title: null, theme: null, button: null } };
                    const items2 = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : [];
                    const item = items2.find(i => i.id === itemId);
                    if (!item) return;

                    if (inv.equipped[item.category] === itemId) {
                        inv.equipped[item.category] = null;
                    } else {
                        inv.equipped[item.category] = itemId;
                    }
                    await chrome.storage.local.set({ shopInventory: inv });
                    await loadShop();
                    applyEquippedCosmetics();
                }
            });
        }
    } catch (error) {
        console.error('Failed to load shop:', error);
    }
}

/**
 * Apply equipped cosmetics to the popup UI
 */
async function applyEquippedCosmetics() {
    try {
        const data = await chrome.storage.local.get('shopInventory');
        const inventory = data.shopInventory || { owned: [], equipped: { title: null, theme: null, button: null } };
        const items = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : [];

        // Title
        const titleEl = document.getElementById('playerTitle');
        if (titleEl) {
            const titleItem = items.find(i => i.id === inventory.equipped.title);
            titleEl.textContent = titleItem ? titleItem.preview : '';
        }

        // Theme
        if (inventory.equipped.theme) {
            const themeItem = items.find(i => i.id === inventory.equipped.theme);
            if (themeItem) {
                document.body.style.backgroundColor = themeItem.preview;
            }
        } else {
            document.body.style.backgroundColor = '';
        }

        // Button skin
        const btn = document.getElementById('enterQuestBtn');
        if (btn) {
            if (inventory.equipped.button) {
                const btnItem = items.find(i => i.id === inventory.equipped.button);
                if (btnItem) {
                    btn.style.background = btnItem.preview;
                    // Adjust border color to match
                    const match = btnItem.preview.match(/#([a-f0-9]{6})\s*100%/i);
                    if (match) btn.style.borderColor = `#${match[1]}`;
                }
            } else {
                btn.style.background = '';
                btn.style.borderColor = '';
            }
        }
    } catch (error) {
        console.error('Failed to apply cosmetics:', error);
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Load wrong answers from last quiz and render in the review panel
 */
async function loadWrongAnswers() {
    try {
        const data = await chrome.storage.local.get('lastWrongAnswers');
        const info = data.lastWrongAnswers;
        if (!info || !Array.isArray(info.wrongAnswers) || info.wrongAnswers.length === 0) return;

        const panel = document.getElementById('reviewPanel');
        const titleEl = document.getElementById('reviewVideoTitle');
        const listEl = document.getElementById('reviewList');

        titleEl.textContent = info.videoTitle || 'Unknown video';

        listEl.innerHTML = info.wrongAnswers.map(wa => {
            const truncated = wa.text.length > 50 ? wa.text.slice(0, 47) + '...' : wa.text;
            const ts = wa.timestampSeconds;
            const hasTs = typeof ts === 'number' && ts >= 0;
            const timeLabel = hasTs
                ? `${Math.floor(ts / 60)}:${String(Math.floor(ts % 60)).padStart(2, '0')}`
                : null;
            return `
                <div class="review-row" ${hasTs ? `data-video="${info.videoId}" data-seconds="${ts}"` : ''}>
                    <span class="review-q">${escapeHtml(truncated)}</span>
                    ${timeLabel ? `<span class="review-ts">${timeLabel}</span>` : ''}
                </div>`;
        }).join('');

        // Click handler — navigate to video at timestamp
        listEl.addEventListener('click', async (e) => {
            const row = e.target.closest('.review-row');
            if (!row || !row.dataset.video) return;

            const videoId = row.dataset.video;
            const seconds = Number(row.dataset.seconds);
            const url = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`;

            // Try to find an existing tab with this video, otherwise open new
            const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/watch*' });
            const existing = tabs.find(t => t.url && t.url.includes(`v=${videoId}`));

            if (existing) {
                await chrome.tabs.update(existing.id, { active: true, url });
            } else {
                await chrome.tabs.create({ url });
            }
            window.close();
        });

        panel.style.display = '';
    } catch (error) {
        console.error('Failed to load wrong answers:', error);
    }
}
