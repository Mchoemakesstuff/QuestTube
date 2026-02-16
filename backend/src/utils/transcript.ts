/**
 * Transcript Utility
 * Fetches YouTube transcripts using Supadata API with fallback to youtube-transcript.
 */

import { YoutubeTranscript } from 'youtube-transcript';

interface TranscriptResult {
    success: boolean;
    text?: string;
    timestampedText?: string;
    error?: string;
    statusCode?: number;
}

function formatTimestamp(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Delay helper for retries.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch transcript using Supadata.
 */
async function fetchWithSupadata(videoId: string, apiKey: string): Promise<TranscriptResult> {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const maxAttempts = 3;
    let lastStatus = 500;
    let lastErrorText = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const response = await fetch(
            `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(youtubeUrl)}`,
            {
                headers: {
                    'x-api-key': apiKey,
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            if (!data || !Array.isArray(data.content)) {
                return {
                    success: false,
                    statusCode: 404,
                    error: 'Transcript not available for this video',
                };
            }

            const text = data.content
                .map((segment: { text?: string }) => segment?.text || '')
                .join(' ')
                .trim();

            if (!text) {
                return {
                    success: false,
                    statusCode: 404,
                    error: 'Transcript not available for this video',
                };
            }

            // Build timestamped version if segments have startTime
            const timestampedText = data.content
                .map((segment: { text?: string; startTime?: number }) => {
                    const t = segment?.text || '';
                    const start = segment?.startTime;
                    if (typeof start === 'number' && !isNaN(start)) {
                        return `[${formatTimestamp(start)}] ${t}`;
                    }
                    return t;
                })
                .join(' ')
                .trim();

            return {
                success: true,
                text,
                timestampedText: timestampedText !== text ? timestampedText : undefined,
            };
        }

        lastStatus = response.status;
        lastErrorText = await response.text();
        const isRetryable = response.status === 429 || response.status >= 500;

        if (!isRetryable || attempt === maxAttempts) {
            break;
        }

        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const fallbackDelayMs = 500 * Math.pow(2, attempt - 1);
        const delayMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(250, retryAfterSeconds * 1000)
            : fallbackDelayMs;

        console.warn(`Supadata retryable error (${response.status}), retrying in ${delayMs}ms`);
        await sleep(delayMs);
    }

    return {
        success: false,
        statusCode: lastStatus,
        error: `Failed to fetch transcript: ${lastStatus}${lastErrorText ? ` (${lastErrorText.slice(0, 120)})` : ''}`,
    };
}

/**
 * Fallback transcript fetcher using youtube-transcript package.
 */
async function fetchWithYoutubeTranscript(videoId: string): Promise<TranscriptResult> {
    try {
        const segments = await YoutubeTranscript.fetchTranscript(videoId);
        if (!Array.isArray(segments) || segments.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Transcript not available for this video',
            };
        }

        const text = segments
            .map((segment: { text?: string }) => segment?.text || '')
            .join(' ')
            .trim();

        if (!text) {
            return {
                success: false,
                statusCode: 404,
                error: 'Transcript not available for this video',
            };
        }

        // Build timestamped version using offset (ms)
        const timestampedText = segments
            .map((segment: { text?: string; offset?: number }) => {
                const t = segment?.text || '';
                const offsetMs = segment?.offset;
                if (typeof offsetMs === 'number' && !isNaN(offsetMs)) {
                    return `[${formatTimestamp(offsetMs / 1000)}] ${t}`;
                }
                return t;
            })
            .join(' ')
            .trim();

        console.log(`Transcript fetched with youtube-transcript: ${text.length} characters`);

        return {
            success: true,
            text,
            timestampedText: timestampedText !== text ? timestampedText : undefined,
        };
    } catch (error) {
        console.error('youtube-transcript fetch error:', error);
        return {
            success: false,
            statusCode: 404,
            error: `Transcript not available: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Fetches the transcript for a YouTube video.
 * Primary: Supadata (if key configured)
 * Fallback: youtube-transcript package
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
    const apiKey = process.env.SUPADATA_API_KEY;

    if (apiKey) {
        console.log(`Fetching transcript for video: ${videoId} via Supadata`);
        const supadataResult = await fetchWithSupadata(videoId, apiKey);
        if (supadataResult.success) {
            console.log(`Transcript fetched successfully via Supadata: ${supadataResult.text?.length || 0} characters`);
            return supadataResult;
        }

        console.warn(`Supadata transcript failed: ${supadataResult.error}. Falling back to youtube-transcript.`);
    } else {
        console.warn('SUPADATA_API_KEY not configured, using youtube-transcript fallback.');
    }

    return fetchWithYoutubeTranscript(videoId);
}
