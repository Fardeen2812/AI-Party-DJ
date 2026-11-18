import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { findYouTubeVideoAndHook } from "@/lib/youtube-hook";
import curatedData from "@/lib/curated-tracks.json";

export interface GeminiTrackSpec {
  title: string;
  artist: string;
  estimated_hook_start_sec: number;
}

const MODELS_TO_TRY = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

function getCuratedTracksForVibe(vibe: string) {
  const normalized = vibe.toLowerCase();
  const dict = curatedData as Record<string, any[]>;

  for (const [key, list] of Object.entries(dict)) {
    if (key.toLowerCase().includes(normalized) || normalized.includes(key.toLowerCase())) {
      return list;
    }
  }

  return (
    dict["💍 Royal Engagement Ceremony (35 Tracks)"] ||
    dict["✨ Zain Zohaib & Trending Sufi Reels"] ||
    []
  );
}

async function generateWithGemini(apiKey: string, prompt: string): Promise<GeminiTrackSpec[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        artist: { type: SchemaType.STRING },
        estimated_hook_start_sec: { type: SchemaType.NUMBER },
      },
      required: ["title", "artist", "estimated_hook_start_sec"],
    },
  };

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      return JSON.parse(rawText);
    } catch (err: any) {
      console.warn(`Model ${modelName} error:`, err?.message || err);
      continue;
    }
  }

  throw new Error("Gemini quota or service temporary limitation");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vibe = (body?.vibe || "💍 Royal Engagement Ceremony (35 Tracks)").trim();

    const apiKey = process.env.GEMINI_API_KEY;

    let tracks = null;

    if (apiKey) {
      try {
        const prompt = `You are AutoAux, an elite Royal Engagement Ceremony DJ specializing in Classical Coke Studio, Sufi ghazals, Ali Sethi, Garvit-Priyansh, and Zain Zohaib acoustic music.
Generate a strict JSON array of songs matching: "${vibe}".
Order them in an ascending energy progression from entrance blessings to romantic ring ceremony and joyful sangeet.
Include beloved favorites like Bol Na Halke Halke (Flute Instrumental), Gulon Main Rang, Kaafi Hai Na, Kaahe Mose, Alfaaz, Tu Jhoom, Pasoori, Kahani Suno 2.0, Latthay Di Chaadar, Ye Jo Halka Halka Suroor (Nusrat), Kali Kali Zulfon (Nusrat), Mera Piya Ghar Aaya (Nusrat), Dam Mast Qalandar (Nusrat), and Faasle where appropriate.
Each item must have:
- "title": exact song name
- "artist": primary performer
- "estimated_hook_start_sec": timestamp in seconds where the chorus drops`;

        const parsedSongs = await generateWithGemini(apiKey, prompt);

        if (parsedSongs && parsedSongs.length > 0) {
          tracks = await Promise.all(
            parsedSongs.map(async (song, idx) => {
              const hookData = await findYouTubeVideoAndHook(
                song.title,
                song.artist,
                song.estimated_hook_start_sec
              );
              return {
                ...song,
                ...hookData,
                order: idx + 1,
                hookDuration: 95,
                isTrending: true,
                trendingBadge: "Ceremony Selection (1m 35s)",
                energy: Math.min(100, Math.round(60 + idx * 2.2)),
              };
            })
          );
        }
      } catch (err) {
        console.warn("Falling back to curated collection:", err);
      }
    }

    if (!tracks || tracks.length === 0) {
      tracks = getCuratedTracksForVibe(vibe);
    }

    return NextResponse.json({
      vibe,
      tracks,
      count: tracks.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate DJ set" },
      { status: 500 }
    );
  }
}
