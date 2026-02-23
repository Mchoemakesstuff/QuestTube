/**
 * YouTube Quizzer - Background Script (Service Worker)
 * Handles alarms and notifications for spaced review
 */

console.log('YouTube Quizzer: Background script loaded');

// ── Dev auto-reload ──────────────────────────────────────
// Polls dev-reload.mjs server for file changes and reloads the extension.
// Safe in production: if the dev server isn't running, polling silently stops.
(function devAutoReload() {
  const DEV_RELOAD_URL = 'http://localhost:3001';
  const POLL_MS = 1500;
  let lastTs = null;
  let failures = 0;

  async function poll() {
    try {
      const res = await fetch(DEV_RELOAD_URL, { cache: 'no-store' });
      const data = await res.json();
      failures = 0;
      if (lastTs !== null && data.ts !== lastTs) {
        console.log('[dev-reload] File change detected, reloading extension...');
        chrome.runtime.reload();
        return; // reload kills the service worker
      }
      lastTs = data.ts;
    } catch (_) {
      failures++;
      // Stop polling after 5 consecutive failures (dev server not running)
      if (failures >= 5) return;
    }
    setTimeout(poll, POLL_MS);
  }

  poll();
})();

function encodeConcept(concept) {
    return encodeURIComponent(String(concept || '').trim());
}

function decodeConcept(encodedConcept) {
    try {
        return decodeURIComponent(String(encodedConcept || ''));
    } catch (error) {
        return String(encodedConcept || '');
    }
}

function getConceptFromAlarmName(alarmName) {
    return decodeConcept(String(alarmName || '').replace(/^review-/, ''));
}

function getNotificationIdForConcept(concept) {
    return `review-notification-${encodeConcept(concept)}-${Date.now()}`;
}

function getConceptFromNotificationId(notificationId) {
    const match = String(notificationId || '').match(/^review-notification-(.+)-\d+$/);
    if (!match) return '';
    return decodeConcept(match[1]);
}

// Setup alarm listener for spaced review
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('YouTube Quizzer: Alarm triggered', alarm.name);

    if (alarm.name.startsWith('review-')) {
        handleReviewAlarm(alarm);
    }
});

/**
 * Handle review alarm - show notification
 */
async function handleReviewAlarm(alarm) {
    const concept = getConceptFromAlarmName(alarm.name);

    chrome.notifications.create(getNotificationIdForConcept(concept), {
        type: 'basic',
        iconUrl: 'assets/icon128.png',
        title: 'Time to Review!',
        message: `It's time to review: ${concept}. Spaced practice strengthens memory!`,
        buttons: [
            { title: 'Review Now' },
            { title: 'Remind Later' },
        ],
        priority: 2,
    });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    const concept = getConceptFromNotificationId(notificationId);

    if (buttonIndex === 0) {
        // Review Now - open popup
        chrome.action.openPopup();
    } else {
        // Remind Later - set alarm for 1 hour later
        const safeConcept = concept || 'general-review';
        chrome.alarms.create(`review-${encodeConcept(safeConcept)}`, { delayInMinutes: 60 });
    }

    chrome.notifications.clear(notificationId);
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.action.openPopup();
    chrome.notifications.clear(notificationId);
});

/**
 * Schedule review alarms based on spacing schedule
 * Called from content script via messaging
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCHEDULE_REVIEWS') {
        scheduleReviews(message.spacingSchedule);
        sendResponse({ success: true });
    }

    if (message.type === 'GET_DUE_REVIEWS') {
        getDueReviews().then(sendResponse);
        return true; // Keep channel open for async response
    }
});

/**
 * Schedule alarms for spaced reviews
 */
function scheduleReviews(spacingSchedule) {
    for (const item of spacingSchedule) {
        const reviewDate = new Date(item.nextReviewDate);
        const now = new Date();
        const delayMinutes = Math.max(1, (reviewDate - now) / (1000 * 60));
        const concept = String(item.concept || '').trim();
        if (!concept) {
            continue;
        }

        chrome.alarms.create(`review-${encodeConcept(concept)}`, {
            delayInMinutes: delayMinutes,
        });

        console.log(`YouTube Quizzer: Scheduled review for "${concept}" in ${Math.round(delayMinutes)} minutes`);
    }
}

/**
 * Get due reviews from storage
 */
async function getDueReviews() {
    try {
        const data = await chrome.storage.local.get('conceptModel');
        const model = data.conceptModel || {};
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
        console.error('YouTube Quizzer: Error getting due reviews', error);
        return [];
    }
}
