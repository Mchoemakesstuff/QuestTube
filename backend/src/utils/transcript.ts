/**
 * Transcript Utility
 * Fetches YouTube transcripts using Supadata API.
 */

interface TranscriptResult {
    success: boolean;
    text?: string;
    error?: string;
}

/**
 * Fetches the transcript for a YouTube video using Supadata API.
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
    const apiKey = process.env.SUPADATA_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'SUPADATA_API_KEY not configured',
        };
    }

    console.log(`Fetching transcript for video: ${videoId} via Supadata`);

    try {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetch(
            `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(youtubeUrl)}`,
            {
                headers: {
                    'x-api-key': apiKey,
                },
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Supadata API error:', response.status, errorData);
            return {
                success: false,
                error: `Failed to fetch transcript: ${response.status}`,
            };
        }

        const data = await response.json();

        // Supadata returns an array of transcript segments
        if (!data || !Array.isArray(data.content)) {
            console.log('Supadata response:', JSON.stringify(data).substring(0, 200));
            return {
                success: false,
                error: 'Transcript not available for this video',
            };
        }

        // Combine all segments into one text
        const text = data.content.map((segment: any) => segment.text).join(' ');

        console.log(`Transcript fetched successfully: ${text.length} characters`);

        return {
            success: true,
            text,
        };
    } catch (error) {
        console.error('Transcript fetch error:', error);
        return {
            success: false,
            error: `Error fetching transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}
