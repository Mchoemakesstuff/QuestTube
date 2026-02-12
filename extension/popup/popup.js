/**
 * YouTube Quizzer - Popup Script
 * Displays stats and due reviews
 */

document.addEventListener('DOMContentLoaded', async () => {
    typeWriter('QuestTube', 'mainTitle', 150);
    await loadStats();
    await loadDueReviews();
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

/**
 * Load due reviews
 */
async function loadDueReviews() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_DUE_REVIEWS' });
        const dueList = document.getElementById('dueList');

        if (response && response.length > 0) {
            dueList.innerHTML = response.map(item => `
        <div class="quest-item">
          <div class="quest-info">
            <span class="quest-name">${escapeHtml(item.concept)}</span>
          </div>
          <button class="quest-action-btn" data-concept="${escapeHtml(item.concept)}">FIGHT!</button>
        </div>
      `).join('');

            // Add click handlers
            dueList.querySelectorAll('.quest-action-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const concept = btn.dataset.concept;
                    if (!concept) return;

                    btn.disabled = true;
                    btn.textContent = 'LOADING...';

                    try {
                        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (!activeTab?.id) {
                            throw new Error('No active tab found');
                        }

                        const response = await chrome.tabs.sendMessage(activeTab.id, {
                            type: 'START_REVIEW_QUIZ',
                            concept,
                        });

                        if (!response?.success) {
                            throw new Error(response?.error || 'Could not start review quiz in this tab');
                        }

                        window.close();
                    } catch (error) {
                        console.error('Failed to start due review:', error);
                        alert('Open a YouTube watch page in this tab, then press FIGHT again.');
                        btn.disabled = false;
                        btn.textContent = 'FIGHT!';
                    }
                });
            });
        }
    } catch (error) {
        console.error('Failed to load due reviews:', error);
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
