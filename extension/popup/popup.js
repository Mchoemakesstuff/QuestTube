/**
 * YouTube Quizzer - Popup Script
 * Displays stats and due reviews
 */

document.addEventListener('DOMContentLoaded', async () => {
    typeWriter('QuestTube', 'mainTitle', 150);
    await loadStats();
    await loadWrongAnswers();

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
            totalQuizzes: 0
        };

        // Update HUD
        document.querySelector('.level-badge').textContent = `LV ${stats.level}`;
        document.getElementById('streakCount').textContent = stats.streak;
        document.getElementById('coinCount').textContent = stats.coins;

        // Calculate XP progress
        const xpNeeded = stats.level * 100;
        const xpProgress = Math.min(100, Math.round((stats.xp / xpNeeded) * 100));
        document.getElementById('xpBar').style.width = `${xpProgress}%`;

        // Update tile stats
        document.getElementById('quizCount').textContent = stats.totalQuizzes;

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
