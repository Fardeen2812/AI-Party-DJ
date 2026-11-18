"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import YouTube from "react-youtube";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Sliders,
  Sparkles,
  Search,
  Music,
  Crown,
  Radio,
  Clock,
  Compass,
} from "lucide-react";
import { djFx } from "@/lib/dj-audio-fx";

export interface AutoAuxTrack {
  order: number;
  title: string;
  artist: string;
  estimated_hook_start_sec: number;
  videoId: string;
  hookStart: number;
  hookEnd: number;
  hookDuration?: number;
  isTrending?: boolean;
  trendingBadge?: string;
  category?: string;
  phase?: string;
  hookSource: string;
  durationSec: number;
  energy: number;
  sourceUrl: string;
}

interface AutoDjPlayerProps {
  tracks: AutoAuxTrack[];
  currentVibe: string;
  onChangeVibe: (vibe: string) => void;
  isGenerating: boolean;
}

export default function AutoDjPlayer({
  tracks,
  currentVibe,
  onChangeVibe,
  isGenerating,
}: AutoDjPlayerProps) {
  // Independent track indexing for Deck A & Deck B (zero skipping)
  const [deckATrackIdx, setDeckATrackIdx] = useState(0);
  const [deckBTrackIdx, setDeckBTrackIdx] = useState(1);
  const [activeDeck, setActiveDeck] = useState<"A" | "B">("A");

  const [isPlaying, setIsPlaying] = useState(true);
  const [playFullSong, setPlayFullSong] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);

  // Crossfade state
  const [crossfader, setCrossfader] = useState<number>(0); // 0 = 100% Deck A, 100 = 100% Deck B
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [crossfadeSec, setCrossfadeSec] = useState(4); // 4-second smooth crossfade

  // Ceremony category tabs & search
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Background YouTube player refs (Audio Only engines)
  const playerRefA = useRef<any>(null);
  const playerRefB = useRef<any>(null);
  const crossfadeTimerRef = useRef<any>(null);

  // Active & cued tracks
  const trackA = tracks[deckATrackIdx] || tracks[0];
  const trackB = tracks[deckBTrackIdx] || tracks[1] || tracks[0];
  const activeTrack = activeDeck === "A" ? trackA : trackB;
  const cuedTrack = activeDeck === "A" ? trackB : trackA;
  const currentActiveIdx = activeDeck === "A" ? deckATrackIdx : deckBTrackIdx;

  // Duration in seconds (1 to 2 mins: 80s to 120s)
  const activeHookDuration = activeTrack?.hookDuration || 95;
  const activeHookEnd = (activeTrack?.hookStart || 0) + activeHookDuration;
  const activeCurrentTime = activeDeck === "A" ? currentTimeA : currentTimeB;
  const remainingSec = Math.max(0, Math.ceil(activeHookEnd - activeCurrentTime));

  // Reset when tracklist updates
  useEffect(() => {
    setDeckATrackIdx(0);
    setDeckBTrackIdx(tracks.length > 1 ? 1 : 0);
    setActiveDeck("A");
    setCrossfader(0);
    setIsCrossfading(false);
    setPlayFullSong(false);
  }, [tracks]);

  // Smooth Crossfade Transition between Deck A and Deck B
  const triggerCrossfade = useCallback(() => {
    if (isCrossfading || tracks.length < 2) return;

    setIsCrossfading(true);
    djFx.playLaser(); // Harmonic transition chime

    const targetDeck = activeDeck === "A" ? "B" : "A";
    const outgoingPlayer = activeDeck === "A" ? playerRefA.current : playerRefB.current;
    const incomingPlayer = targetDeck === "A" ? playerRefA.current : playerRefB.current;
    const targetTrack = targetDeck === "A" ? trackA : trackB;

    // Start incoming deck playing from hookStart at volume 0
    if (incomingPlayer && targetTrack) {
      try {
        incomingPlayer.seekTo(targetTrack.hookStart, true);
        incomingPlayer.setVolume(0);
        incomingPlayer.playVideo();
      } catch (err) {
        console.warn("Incoming player error:", err);
      }
    }

    const steps = 30;
    const intervalMs = (crossfadeSec * 1000) / steps;
    let step = 0;

    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);

    crossfadeTimerRef.current = setInterval(() => {
      step++;
      const progress = step / steps; // 0.0 -> 1.0

      if (activeDeck === "A") {
        const volA = Math.round((1 - progress) * 100);
        const volB = Math.round(progress * 100);
        try {
          outgoingPlayer?.setVolume(volA);
          incomingPlayer?.setVolume(volB);
        } catch {}
        setCrossfader(Math.round(progress * 100));
      } else {
        const volB = Math.round((1 - progress) * 100);
        const volA = Math.round(progress * 100);
        try {
          outgoingPlayer?.setVolume(volB);
          incomingPlayer?.setVolume(volA);
        } catch {}
        setCrossfader(Math.round((1 - progress) * 100));
      }

      if (step >= steps) {
        clearInterval(crossfadeTimerRef.current);
        try {
          outgoingPlayer?.pauseVideo();
        } catch {}

        if (activeDeck === "A") {
          setActiveDeck("B");
          setCrossfader(100);
          const nextForDeckA = (deckBTrackIdx + 1) % tracks.length;
          setDeckATrackIdx(nextForDeckA);
        } else {
          setActiveDeck("A");
          setCrossfader(0);
          const nextForDeckB = (deckATrackIdx + 1) % tracks.length;
          setDeckBTrackIdx(nextForDeckB);
        }

        setIsCrossfading(false);
      }
    }, intervalMs);
  }, [activeDeck, trackA, trackB, deckATrackIdx, deckBTrackIdx, isCrossfading, tracks.length, crossfadeSec]);

  // Polling loop for playback timing & auto-crossfade trigger
  useEffect(() => {
    const timer = setInterval(async () => {
      const activePlayer = activeDeck === "A" ? playerRefA.current : playerRefB.current;
      if (!activePlayer || !activeTrack) return;

      try {
        const now = await activePlayer.getCurrentTime();
        if (typeof now === "number") {
          if (activeDeck === "A") setCurrentTimeA(now);
          else setCurrentTimeB(now);

          // Auto-trigger crossfade 4 seconds before hook ends
          if (!playFullSong && !isCrossfading && now >= activeHookEnd - crossfadeSec) {
            triggerCrossfade();
          }
        }
      } catch {}
    }, 200);

    return () => clearInterval(timer);
  }, [activeDeck, activeTrack, activeHookEnd, playFullSong, isCrossfading, crossfadeSec, triggerCrossfade]);

  // User manually selects a track from the queue
  const selectTrackDirectly = (idx: number) => {
    if (activeDeck === "A") {
      setDeckATrackIdx(idx);
      setDeckBTrackIdx((idx + 1) % tracks.length);
      if (playerRefA.current && tracks[idx]) {
        try {
          playerRefA.current.seekTo(tracks[idx].hookStart, true);
          playerRefA.current.setVolume(100);
          playerRefA.current.playVideo();
        } catch {}
      }
    } else {
      setDeckBTrackIdx(idx);
      setDeckATrackIdx((idx + 1) % tracks.length);
      if (playerRefB.current && tracks[idx]) {
        try {
          playerRefB.current.seekTo(tracks[idx].hookStart, true);
          playerRefB.current.setVolume(100);
          playerRefB.current.playVideo();
        } catch {}
      }
    }
    djFx.playVinylScratch();
  };

  const togglePlay = () => {
    const activePlayer = activeDeck === "A" ? playerRefA.current : playerRefB.current;
    if (!activePlayer) return;
    try {
      if (isPlaying) {
        activePlayer.pauseVideo();
        setIsPlaying(false);
      } else {
        activePlayer.playVideo();
        setIsPlaying(true);
      }
    } catch {}
  };

  const formatSec = (s: number) => {
    const safe = Math.max(0, Math.floor(s || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatMinSecHuman = (s: number) => {
    const safe = Math.max(0, Math.floor(s || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  // Filtered tracks for the 35-song queue
  const displayedTracks = useMemo(() => {
    return tracks.filter((t, idx) => {
      if (filterCategory === "ENTRANCE" && (idx < 0 || idx > 7)) return false;
      if (filterCategory === "ROMANCE" && (idx < 8 || idx > 19)) return false;
      if (filterCategory === "SANGEET" && (idx < 20 || idx > 27)) return false;
      if (filterCategory === "CLIMAX" && idx < 28) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesArtist = t.artist.toLowerCase().includes(q);
        return matchesTitle || matchesArtist;
      }
      return true;
    });
  }, [tracks, filterCategory, searchQuery]);

  if (!activeTrack) return null;

  const volA = Math.round(100 - crossfader);
  const volB = Math.round(crossfader);

  return (
    <div className="space-y-8 pb-24">
      {/* ======================================================== */}
      {/* INVISIBLE ZERO-DATA AUDIO ENGINES (NO VIDEO OVERHEAD)     */}
      {/* ======================================================== */}
      <div className="absolute -left-[9999px] top-0 w-1 h-1 opacity-0 pointer-events-none overflow-hidden">
        <YouTube
          videoId={trackA?.videoId || "jXwg9l9D51A"}
          opts={{
            width: "1",
            height: "1",
            playerVars: {
              autoplay: 1,
              controls: 0,
              rel: 0,
              start: trackA?.hookStart || 0,
            },
          }}
          onReady={(event: any) => {
            playerRefA.current = event.target;
            event.target.setVolume(activeDeck === "A" ? 100 : 0);
            event.target.seekTo(trackA?.hookStart || 0, true);
            if (activeDeck === "A") event.target.playVideo();
          }}
        />
        <YouTube
          videoId={trackB?.videoId || "hR8FEdC6aAs"}
          opts={{
            width: "1",
            height: "1",
            playerVars: {
              autoplay: 1,
              controls: 0,
              rel: 0,
              start: trackB?.hookStart || 0,
            },
          }}
          onReady={(event: any) => {
            playerRefB.current = event.target;
            event.target.setVolume(activeDeck === "B" ? 100 : 0);
            event.target.seekTo(trackB?.hookStart || 0, true);
            if (activeDeck === "B") event.target.playVideo();
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* AESTHETIC ANALOG TURNTABLE AUDIO CONSOLE (NO VIBE-CODE)   */}
      {/* ======================================================== */}
      <div className="relative rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-b from-[#10121a] via-[#0b0c13] to-[#07080e] p-6 sm:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
        {/* Ambient Candlelight / Gold Glow Background */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-gradient-to-b from-amber-500/10 via-amber-700/5 to-transparent blur-3xl" />

        {/* Master Console Status Header */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-3 w-3 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </div>
            <div>
              <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-amber-200/80">
                CEREMONY AUDIO MASTER • ZERO-VIDEO STREAM
              </p>
              <h2 className="text-sm font-semibold tracking-wide text-slate-100">
                Deck {activeDeck} Active — Track #{currentActiveIdx + 1} of {tracks.length}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-500/[0.08] border border-amber-500/30 px-3.5 py-1 text-xs font-mono text-amber-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-400/80" />
              Duration: {formatMinSecHuman(activeHookDuration)}
            </span>

            <button
              type="button"
              onClick={() => setPlayFullSong((prev) => !prev)}
              className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                playFullSong
                  ? "bg-amber-400/20 text-amber-200 border border-amber-400/40"
                  : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-slate-200 hover:border-white/20"
              }`}
            >
              {playFullSong ? "Full Song Active" : "1–2 Min Rotation"}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* DUAL HANDCRAFTED ANALOG VINYL PLATTERS + AUDIO STAGE      */}
        {/* ======================================================== */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* DECK A: ANALOG TURNTABLE */}
          <div
            className={`lg:col-span-4 rounded-3xl border p-5 transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden ${
              activeDeck === "A"
                ? "border-amber-400/40 bg-[#12141e]/90 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
                : "border-white/[0.06] bg-[#0c0d14]/70 opacity-60"
            }`}
          >
            {/* Deck Header */}
            <div className="w-full flex items-center justify-between border-b border-white/[0.06] pb-2 mb-4">
              <span className="text-[11px] font-mono tracking-widest text-amber-200/90 font-bold uppercase">
                DECK A {activeDeck === "A" ? "• BROADCASTING" : "• CUED"}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{volA}% VOL</span>
            </div>

            {/* Realistic Vinyl Platter */}
            <div className="relative w-48 h-48 sm:w-52 sm:h-52 my-2 flex items-center justify-center">
              {/* Outer Turntable Platter Rim with Strobe Dots */}
              <div className="absolute inset-0 rounded-full bg-[#1b1d28] border-2 border-[#2b2d3d] shadow-2xl flex items-center justify-center">
                {/* Vinyl Record Body */}
                <div
                  className={`w-[92%] h-[92%] rounded-full bg-[#0a0a0c] border border-white/10 shadow-[inset_0_0_30px_rgba(0,0,0,0.95)] flex items-center justify-center relative overflow-hidden ${
                    activeDeck === "A" && isPlaying ? "animate-vinyl-spin" : ""
                  }`}
                  style={{
                    background:
                      "radial-gradient(circle, #18191f 0%, #0d0e12 40%, #060608 70%, #020203 100%)",
                  }}
                >
                  {/* Concentric Sound Grooves */}
                  <div className="absolute inset-2 rounded-full border border-white/[0.04]" />
                  <div className="absolute inset-4 rounded-full border border-white/[0.05]" />
                  <div className="absolute inset-7 rounded-full border border-white/[0.04]" />
                  <div className="absolute inset-10 rounded-full border border-white/[0.06]" />
                  <div className="absolute inset-14 rounded-full border border-white/[0.04]" />

                  {/* Golden Center Label */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-900/90 via-[#3a2810] to-amber-700/80 border-2 border-amber-400/40 shadow-inner flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[8px] font-mono font-bold tracking-widest text-amber-200 uppercase">
                      33⅓ RPM
                    </span>
                    <p className="text-[9px] font-serif font-bold text-amber-100 truncate w-full">
                      {trackA?.title}
                    </p>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-amber-300/40 mt-1" />
                  </div>
                </div>
              </div>

              {/* Tonearm Stylus Mechanism */}
              <div
                className={`absolute -right-1 top-2 w-16 h-28 pointer-events-none transition-transform duration-700 origin-top-right ${
                  activeDeck === "A" && isPlaying ? "rotate-[14deg]" : "rotate-[-10deg]"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 border border-black shadow absolute right-1 top-1" />
                <div className="w-0.5 h-20 bg-gradient-to-b from-amber-200 to-amber-500/80 absolute right-1.5 top-2 shadow" />
                <div className="w-2.5 h-3.5 bg-amber-300 rounded-sm absolute right-0.5 bottom-6 shadow border border-amber-600" />
              </div>
            </div>

            {/* Track Info */}
            <div className="w-full pt-3 text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80">
                {trackA?.phase || "Royal Entrance"}
              </span>
              <h3 className="text-sm font-bold text-white truncate">{trackA?.title}</h3>
              <p className="text-xs text-slate-400 truncate">{trackA?.artist}</p>
            </div>
          </div>

          {/* CENTER DJ CONSOLE: CROSSFADER & ANALOG VU METERS */}
          <div className="lg:col-span-4 rounded-3xl border border-white/[0.08] bg-[#0c0d16]/90 p-5 flex flex-col justify-between space-y-5">
            <div className="text-center border-b border-white/[0.06] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300/90 font-medium flex items-center justify-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                ACOUSTIC DUAL-DECK CONSOLE
              </span>
            </div>

            {/* Organic Audio Frequency Visualizer */}
            <div className="rounded-2xl bg-black/60 border border-white/[0.06] p-4 text-center space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Phase Window:</span>
                <span className="text-amber-200 font-bold">
                  {formatSec(activeTrack?.hookStart || 0)} → {formatSec(activeHookEnd)}
                </span>
              </div>

              {/* Sine Wave Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-8 py-1">
                <span className={`w-1 rounded-full bg-amber-400/80 ${isPlaying ? "wave-bar-1" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-300 ${isPlaying ? "wave-bar-2" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-500 ${isPlaying ? "wave-bar-3" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-200 ${isPlaying ? "wave-bar-4" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-400 ${isPlaying ? "wave-bar-5" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-300 ${isPlaying ? "wave-bar-6" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-500 ${isPlaying ? "wave-bar-7" : "h-1"}`} />
                <span className={`w-1 rounded-full bg-amber-200 ${isPlaying ? "wave-bar-8" : "h-1"}`} />
              </div>

              {/* Status Message */}
              <p className="text-sm font-semibold tracking-tight text-white">
                {isCrossfading ? (
                  <span className="text-amber-300 animate-pulse flex items-center justify-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Blending Seamlessly...
                  </span>
                ) : playFullSong ? (
                  <span className="text-slate-300">Continuous Full Play</span>
                ) : (
                  <span>
                    Transition In <span className="text-amber-300 font-mono">{formatMinSecHuman(remainingSec)}</span>
                  </span>
                )}
              </p>
            </div>

            {/* REAL-TIME CROSSFADER SLIDER */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={activeDeck === "A" ? "text-amber-300 font-bold" : "text-slate-500"}>
                  DECK A: {volA}%
                </span>
                <span className="text-slate-400 tracking-wider">
                  {crossfader === 0 ? "MASTER A" : crossfader === 100 ? "MASTER B" : `CROSSFADE ${crossfader}%`}
                </span>
                <span className={activeDeck === "B" ? "text-amber-300 font-bold" : "text-slate-500"}>
                  DECK B: {volB}%
                </span>
              </div>

              {/* Elegant Knurled Brass Crossfader Slider */}
              <div className="relative h-7 w-full rounded-full bg-black/90 border border-white/[0.12] p-1 flex items-center shadow-inner">
                <div
                  className="h-5 w-10 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_2px_10px_rgba(212,175,55,0.5)] border border-amber-100/40 transition-all duration-150 absolute"
                  style={{
                    left: `calc(${crossfader}% - ${crossfader * 0.4}px)`,
                  }}
                />
              </div>
            </div>

            {/* DJ Transport Controls */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={triggerCrossfade}
                disabled={isCrossfading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 py-3 px-4 text-xs font-semibold text-slate-950 shadow-[0_4px_20px_rgba(212,175,55,0.25)] hover:brightness-110 disabled:opacity-50 transition active:scale-[0.98]"
              >
                <Sparkles className="h-3.5 w-3.5 text-slate-950" />
                Crossfade Now
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] py-3 px-4 text-xs font-semibold text-white hover:bg-white/[0.08] transition active:scale-[0.98]"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5 text-amber-300" /> : <Play className="h-3.5 w-3.5 text-amber-300" />}
                {isPlaying ? "Pause" : "Resume"}
              </button>
            </div>

            {/* Tactile Ambient FX Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400 text-center block">
                CEREMONY SOUND ACCENTS
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => djFx.playAirhorn()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-95 transition"
                >
                  Chime
                </button>
                <button
                  type="button"
                  onClick={() => djFx.playVinylScratch()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-95 transition"
                >
                  Rewind
                </button>
                <button
                  type="button"
                  onClick={() => djFx.playBassDrop()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-95 transition"
                >
                  Sub Drop
                </button>
                <button
                  type="button"
                  onClick={() => djFx.playLaser()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-95 transition"
                >
                  Sweep
                </button>
              </div>
            </div>
          </div>

          {/* DECK B: ANALOG TURNTABLE */}
          <div
            className={`lg:col-span-4 rounded-3xl border p-5 transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden ${
              activeDeck === "B"
                ? "border-amber-400/40 bg-[#12141e]/90 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
                : "border-white/[0.06] bg-[#0c0d14]/70 opacity-60"
            }`}
          >
            {/* Deck Header */}
            <div className="w-full flex items-center justify-between border-b border-white/[0.06] pb-2 mb-4">
              <span className="text-[11px] font-mono tracking-widest text-amber-200/90 font-bold uppercase">
                DECK B {activeDeck === "B" ? "• BROADCASTING" : "• CUED NEXT"}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{volB}% VOL</span>
            </div>

            {/* Realistic Vinyl Platter */}
            <div className="relative w-48 h-48 sm:w-52 sm:h-52 my-2 flex items-center justify-center">
              {/* Outer Turntable Platter Rim */}
              <div className="absolute inset-0 rounded-full bg-[#1b1d28] border-2 border-[#2b2d3d] shadow-2xl flex items-center justify-center">
                {/* Vinyl Record Body */}
                <div
                  className={`w-[92%] h-[92%] rounded-full bg-[#0a0a0c] border border-white/10 shadow-[inset_0_0_30px_rgba(0,0,0,0.95)] flex items-center justify-center relative overflow-hidden ${
                    activeDeck === "B" && isPlaying ? "animate-vinyl-spin" : ""
                  }`}
                  style={{
                    background:
                      "radial-gradient(circle, #18191f 0%, #0d0e12 40%, #060608 70%, #020203 100%)",
                  }}
                >
                  {/* Concentric Sound Grooves */}
                  <div className="absolute inset-2 rounded-full border border-white/[0.04]" />
                  <div className="absolute inset-4 rounded-full border border-white/[0.05]" />
                  <div className="absolute inset-7 rounded-full border border-white/[0.04]" />
                  <div className="absolute inset-10 rounded-full border border-white/[0.06]" />
                  <div className="absolute inset-14 rounded-full border border-white/[0.04]" />

                  {/* Golden Center Label */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-900/90 via-[#3a2810] to-amber-700/80 border-2 border-amber-400/40 shadow-inner flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[8px] font-mono font-bold tracking-widest text-amber-200 uppercase">
                      33⅓ RPM
                    </span>
                    <p className="text-[9px] font-serif font-bold text-amber-100 truncate w-full">
                      {trackB?.title}
                    </p>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-amber-300/40 mt-1" />
                  </div>
                </div>
              </div>

              {/* Tonearm Stylus Mechanism */}
              <div
                className={`absolute -right-1 top-2 w-16 h-28 pointer-events-none transition-transform duration-700 origin-top-right ${
                  activeDeck === "B" && isPlaying ? "rotate-[14deg]" : "rotate-[-10deg]"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 border border-black shadow absolute right-1 top-1" />
                <div className="w-0.5 h-20 bg-gradient-to-b from-amber-200 to-amber-500/80 absolute right-1.5 top-2 shadow" />
                <div className="w-2.5 h-3.5 bg-amber-300 rounded-sm absolute right-0.5 bottom-6 shadow border border-amber-600" />
              </div>
            </div>

            {/* Track Info */}
            <div className="w-full pt-3 text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80">
                {trackB?.phase || "Ring Ceremony"}
              </span>
              <h3 className="text-sm font-bold text-white truncate">{trackB?.title}</h3>
              <p className="text-xs text-slate-400 truncate">{trackB?.artist}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 35-TRACK ROYAL SUFI ENGAGEMENT QUEUE                      */}
      {/* ======================================================== */}
      <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#090a12]/95 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Crown className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-serif font-bold tracking-wide text-white">
                Engagement Ceremony Repertoire ({tracks.length} Curated Works)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Featuring Bol Na Halke Halke, Ali Sethi, Garvit-Priyansh, Zain Zohaib &amp; Classical Coke Studio
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500/[0.08] border border-amber-500/30 px-3.5 py-1 text-xs font-mono text-amber-300">
              1–2 Mins Trend Rotation
            </span>
            <span className="rounded-full bg-white/[0.04] border border-white/[0.08] px-3.5 py-1 text-xs font-mono text-slate-300">
              Zero Video Overhead
            </span>
          </div>
        </div>

        {/* Phase Navigation Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: `All Works (${tracks.length})` },
              { id: "ENTRANCE", label: "Royal Entrance (1–8)" },
              { id: "ROMANCE", label: "Ring Ceremony (9–20)" },
              { id: "SANGEET", label: "Sangeet Mehfil (21–28)" },
              { id: "CLIMAX", label: "Sufi Climax (29–35)" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  filterCategory === cat.id
                    ? "bg-amber-400/20 text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                    : "bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Clean Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or artist..."
              className="rounded-full border border-white/[0.08] bg-black/60 pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400/50 focus:outline-none"
            />
          </div>
        </div>

        {/* 35-Song List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
          {displayedTracks.map((t) => {
            const trueIdx = tracks.findIndex((item) => item.videoId === t.videoId);
            const isPlayingThis = trueIdx === currentActiveIdx;
            const isCuedNext = trueIdx === (activeDeck === "A" ? deckBTrackIdx : deckATrackIdx);
            const durationForTrack = t.hookDuration || 95;

            return (
              <button
                key={`${t.videoId}-${t.title}`}
                type="button"
                onClick={() => selectTrackDirectly(trueIdx >= 0 ? trueIdx : 0)}
                className={`w-full text-left flex items-center justify-between gap-3.5 rounded-2xl border p-4 transition-all duration-200 group ${
                  isPlayingThis
                    ? "border-amber-400/70 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-transparent shadow-[0_0_25px_rgba(212,175,55,0.15)]"
                    : isCuedNext
                    ? "border-amber-500/30 bg-amber-500/[0.03]"
                    : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-semibold ${
                      isPlayingThis
                        ? "bg-amber-400 text-slate-950 shadow-md font-bold"
                        : isCuedNext
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-white/[0.04] text-slate-400 group-hover:text-white"
                    }`}
                  >
                    {isPlayingThis ? "▶" : isCuedNext ? "NEXT" : trueIdx >= 0 ? trueIdx + 1 : t.order}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm font-semibold ${isPlayingThis ? "text-amber-200" : "text-slate-100"}`}>
                        {t.title}
                      </p>
                      {t.phase && (
                        <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-mono text-slate-400 border border-white/[0.06]">
                          {t.phase}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">{t.artist}</p>
                    <p className="mt-1 font-mono text-[10px] text-amber-300/80 flex items-center gap-2">
                      <span>
                        Cue: {formatSec(t.hookStart)} → {formatSec(t.hookStart + durationForTrack)}
                      </span>
                      <span className="text-amber-400 font-bold">({formatMinSecHuman(durationForTrack)} Drop)</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-block font-mono text-xs font-semibold text-amber-300/90 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    {t.energy}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
