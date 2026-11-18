"use client";

import React, { useState } from "react";
import AutoDjPlayer, { AutoAuxTrack } from "@/components/AutoDjPlayer";
import curatedData from "@/lib/curated-tracks.json";
import { Sparkles, Music, Crown, Radio, Clock, ShieldCheck } from "lucide-react";

const PRESET_CHIPS = [
  "👑 Royal Engagement Ceremony (35 Tracks)",
  "🕊️ Classical Coke Studio & Ali Sethi",
  "✨ Zain Zohaib & Garvit-Priyansh Hits",
  "💍 Romantic Ring Ceremony & Duets",
  "🔥 Ecstatic Sufi Qawwali Climax",
];

const INITIAL_TRACKS: AutoAuxTrack[] =
  (curatedData as any)["💍 Royal Engagement Ceremony (35 Tracks)"] ||
  (curatedData as any)["✨ Zain Zohaib & Trending Sufi Reels"] ||
  [];

export default function AutoAuxPage() {
  const [vibeInput, setVibeInput] = useState("👑 Royal Engagement Ceremony (35 Tracks)");
  const [activeVibe, setActiveVibe] = useState("👑 Royal Engagement Ceremony (35 Tracks)");
  const [tracks, setTracks] = useState<AutoAuxTrack[]>(INITIAL_TRACKS);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const generateSet = async (targetVibe: string) => {
    setLoading(true);
    setNotice(null);
    setVibeInput(targetVibe);
    setActiveVibe(targetVibe);

    try {
      const res = await fetch("/api/generate-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe: targetVibe }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate set");
      }
      if (data.tracks && data.tracks.length > 0) {
        setTracks(data.tracks);
      }
    } catch (err: any) {
      const normalized = targetVibe.toLowerCase();
      const dict = curatedData as Record<string, any[]>;
      let fallbackList =
        dict["💍 Royal Engagement Ceremony (35 Tracks)"] ||
        dict["✨ Zain Zohaib & Trending Sufi Reels"];

      for (const [key, list] of Object.entries(dict)) {
        if (key.toLowerCase().includes(normalized) || normalized.includes(key.toLowerCase())) {
          fallbackList = list;
          break;
        }
      }

      setTracks(fallbackList as AutoAuxTrack[]);
      setNotice("Loaded handcrafted Royal Engagement ceremony program");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07080d] text-slate-100 px-3 py-5 sm:px-8 sm:py-8 selection:bg-amber-400 selection:text-slate-950 relative overflow-hidden">
      {/* Ambient Atmospheric Lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full bg-amber-700/5 blur-[150px]" />

      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 relative z-10">
        {/* Editorial Luxury Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 sm:gap-6 rounded-3xl sm:rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-r from-[#12141f] via-[#0d0f17] to-[#0a0b12] px-5 sm:px-8 py-5 sm:py-6 shadow-2xl backdrop-blur-2xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-candle-glow" />
              <p className="text-[9px] sm:text-[10px] font-mono tracking-[0.25em] uppercase text-amber-300/80">
                ROYAL ENGAGEMENT MEHFIL • CURATED SUFI EDITION
              </p>
            </div>
            <h1 className="text-xl sm:text-3xl font-serif font-bold tracking-tight text-white">
              AutoAux <span className="font-sans font-light text-amber-200/90 text-lg sm:text-2xl">// Acoustic DJ</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Featuring Bol Na Halke Halke (Flute Theme), Ustad Nusrat Fateh Ali Khan, Ali Sethi, Kaifi Khalil &amp; Classical Coke Studio • Zero-Video Audio Stream • 1–2 Min Dynamic Rotation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] px-3.5 py-1.5 sm:px-4 sm:py-2 text-amber-300 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              1–2 Min Rotation
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 sm:px-4 sm:py-2 text-slate-300 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Audio Only Stream
            </div>
          </div>
        </header>

        {/* Curation Console */}
        <section className="rounded-3xl sm:rounded-[2.5rem] border border-white/[0.08] bg-[#0c0d16]/90 p-4 sm:p-7 space-y-4 sm:space-y-5 shadow-xl backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (vibeInput.trim()) generateSet(vibeInput.trim());
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/80" />
              <input
                type="text"
                value={vibeInput}
                onChange={(e) => setVibeInput(e.target.value)}
                placeholder="Curate custom ceremony theme (e.g. Ali Sethi Ghazal, Garvit-Priyansh, Royal Sufi Mehfil)..."
                className="w-full rounded-2xl border border-white/[0.1] bg-black/70 pl-11 pr-4 py-3 sm:py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-amber-400/60 focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-slate-950 shadow-[0_4px_25px_rgba(212,175,55,0.25)] hover:brightness-110 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                  Harmonizing Repertoire...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  Curate 35-Track Program
                </>
              )}
            </button>
          </form>

          {/* Preset Program Pills */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 sm:mr-2">
              Ceremony Programs:
            </span>
            {PRESET_CHIPS.map((chip) => {
              const active = activeVibe === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => generateSet(chip)}
                  disabled={loading}
                  className={`rounded-full px-3 py-1 sm:px-4 sm:py-1.5 text-xs font-medium transition ${
                    active
                      ? "border border-amber-400/60 bg-amber-400/20 text-amber-200 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                      : "border border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {notice && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-2.5 text-xs text-amber-200 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              {notice}
            </div>
          )}
        </section>

        {/* Dual-Deck Acoustic Audio DJ Console */}
        <AutoDjPlayer
          tracks={tracks}
          currentVibe={activeVibe}
          onChangeVibe={generateSet}
          isGenerating={loading}
          onTracksChange={setTracks}
        />
      </div>
    </main>
  );
}
