import ytSearch from "yt-search";

export interface HydratedHookResult {
  videoId: string;
  hookStart: number;
  hookEnd: number;
  hookSource: "YouTube Most Replayed" | "Gemini Hook Fallback";
  durationSec: number;
  sourceUrl: string;
}

/**
 * Searches YouTube using YouTube Data API v3 (or yt-search) to get the official videoId,
 * then checks the video's 'Most Replayed' heatmap peak (or falls back to Gemini's
 * estimated_hook_start_sec) to set hookStart and hookEnd (hookStart + 45 seconds).
 */
export async function findYouTubeVideoAndHook(
  title: string,
  artist: string,
  estimatedHookStartSec: number
): Promise<HydratedHookResult> {
  const query = `${title} ${artist} official video`;
  let videoId = "";
  let durationSec = 240;

  // 1. Try YouTube Data API v3 first if YOUTUBE_API_KEY is present
  const ytApiKey = process.env.YOUTUBE_API_KEY;
  if (ytApiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(
        query
      )}&key=${ytApiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (data?.items?.[0]?.id?.videoId) {
          videoId = data.items[0].id.videoId;
        }
      }
    } catch {
      // Fall back to yt-search
    }
  }

  // Fallback to yt-search if videoId not resolved
  if (!videoId) {
    try {
      const searchResult = await ytSearch(query);
      const firstVideo = searchResult?.videos?.[0];
      if (firstVideo) {
        videoId = firstVideo.videoId;
        durationSec = firstVideo.seconds || 240;
      }
    } catch {
      videoId = "5Eqb_-j3FDA"; // Pasoori default safe fallback
    }
  }

  // 2. Scrape YouTube's 'Most Replayed' heatmap peak with a 2-second timeout
  let hookStart = Math.max(10, Math.round(estimatedHookStartSec || 40));
  let hookSource: "YouTube Most Replayed" | "Gemini Hook Fallback" =
    "Gemini Hook Fallback";

  if (videoId) {
    try {
      const watchRes = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(2000),
        }
      );
      if (watchRes.ok) {
        const html = await watchRes.text();
        const markerRegex =
          /"heatMarkerRenderer":\{"timeRangeStartMillis":(\d+),"markerDurationMillis":(\d+),"heatMarkerIntensityScoreNormalized":([0-9.]+)\}/g;
        let match: RegExpExecArray | null;
        let bestScore = -1;
        let bestStartSec = hookStart;

        while ((match = markerRegex.exec(html)) !== null) {
          const startSec = Math.round(parseInt(match[1], 10) / 1000);
          const score = parseFloat(match[3]);
          if (startSec >= 8 && score > bestScore) {
            bestScore = score;
            bestStartSec = startSec;
          }
        }

        if (bestScore > 0) {
          hookStart = bestStartSec;
          hookSource = "YouTube Most Replayed";
        }
      }
    } catch {
      // Keep Gemini estimated hook
    }
  }

  return {
    videoId: videoId || "5Eqb_-j3FDA",
    hookStart,
    hookEnd: hookStart + 45,
    hookSource,
    durationSec,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId || "5Eqb_-j3FDA"}`,
  };
}
