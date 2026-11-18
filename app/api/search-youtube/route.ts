import { NextRequest, NextResponse } from "next/server";
import ytSearch from "yt-search";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body?.query || "").trim();

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    let results: any[] = [];

    // 1. Try YouTube Data API v3 if API key exists
    if (apiKey) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(
          query
        )}&key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.items)) {
            results = data.items
              .filter((item: any) => item?.id?.videoId)
              .map((item: any) => {
                const videoId = item.id.videoId;
                const title = item.snippet?.title || "Unknown Title";
                const artist = item.snippet?.channelTitle || "YouTube Artist";
                const thumbnail =
                  item.snippet?.thumbnails?.medium?.url ||
                  item.snippet?.thumbnails?.default?.url ||
                  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

                return {
                  videoId,
                  title: decodeHTMLEntities(title),
                  artist: decodeHTMLEntities(artist),
                  thumbnail,
                  durationSec: 240,
                  timestamp: "4:00",
                  hookStart: 35,
                  hookEnd: 130,
                  hookDuration: 95,
                  isTrending: true,
                  trendingBadge: "Live YouTube Pick",
                  phase: "Live Request",
                  energy: 82,
                  sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
                };
              });
          }
        }
      } catch (e) {
        // Fall through to yt-search
      }
    }

    // 2. Fall back to yt-search
    if (results.length === 0) {
      try {
        const searchRes = await ytSearch(query);
        const videos = searchRes?.videos || [];

        results = videos.slice(0, 8).map((v: any) => {
          const duration = v.seconds || 240;
          // Calculate an intelligent hook start (around 20-30% into song, clamped between 20s and 60s)
          const hookStart = Math.min(60, Math.max(20, Math.floor(duration * 0.22)));
          const hookDuration = Math.min(110, Math.max(75, Math.floor(duration - hookStart - 20)));

          return {
            videoId: v.videoId,
            title: decodeHTMLEntities(v.title),
            artist: decodeHTMLEntities(v.author?.name || "YouTube Creator"),
            thumbnail: v.thumbnail || v.image || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
            durationSec: duration,
            timestamp: v.timestamp || "3:30",
            hookStart,
            hookEnd: hookStart + (hookDuration > 0 ? hookDuration : 95),
            hookDuration: hookDuration > 0 ? hookDuration : 95,
            isTrending: true,
            trendingBadge: "Live YouTube Pick",
            phase: "Live Request",
            energy: 85,
            sourceUrl: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
          };
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: err?.message || "YouTube search failed" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ query, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}
