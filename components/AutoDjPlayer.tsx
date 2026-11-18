"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import YouTube from "react-youtube";
import {
  Play,
  Pause,
  Sliders,
  Sparkles,
  Search,
  Music,
  Crown,
  Radio,
  Clock,
  X,
  Plus,
  Zap,
  Check,
  Volume2,
  RefreshCw,
  Flame,
  Layers,
  ChevronRight,
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
  hookSource?: string;
  durationSec?: number;
  energy: number;
  sourceUrl: string;
  thumbnail?: string;
}

interface AutoDjPlayerProps {
  tracks: AutoAuxTrack[];
  currentVibe: string;
  onChangeVibe: (vibe: string) => void;
  isGenerating: boolean;
  onTracksChange?: (newTracks: AutoAuxTrack[]) => void;
}

export default function AutoDjPlayer({
  tracks: initialTracks,
  currentVibe,
  onChangeVibe,
  isGenerating,
  onTracksChange,
}: AutoDjPlayerProps) {
  // Local tracklist that can receive dynamic live additions from YouTube search
  const [localTracks, setLocalTracks] = useState<AutoAuxTrack[]>(initialTracks);

  // Independent track indexing for Deck A & Deck B
  const [deckATrackIdx, setDeckATrackIdx] = useState(0);
  const [deckBTrackIdx, setDeckBTrackIdx] = useState(1);
  const [activeDeck, setActiveDeck] = useState<"A" | "B">("A");

  const [isPlaying, setIsPlaying] = useState(true);
  const [playFullSong, setPlayFullSong] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);

  // Mobile viewport tab selector (Deck A vs Deck B view on small screens)
  const [mobileDeckTab, setMobileDeckTab] = useState<"A" | "B">("A");

  // Crossfade state
  const [crossfader, setCrossfader] = useState<number>(0); // 0 = 100% Deck A, 100 = 100% Deck B
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [crossfadeSec, setCrossfadeSec] = useState(2); // Snappy 2-second crossfade

  // Ceremony category tabs & local search
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // YouTube Live Search Modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [ytSearchQuery, setYtSearchQuery] = useState("");
  const [isYtSearching, setIsYtSearching] = useState(false);
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Background YouTube player refs (Audio Only engines)
  const playerRefA = useRef<any>(null);
  const playerRefB = useRef<any>(null);
  const crossfadeTimerRef = useRef<any>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Sync internal tracklist when props update
  useEffect(() => {
    setLocalTracks(initialTracks);
    setDeckATrackIdx(0);
    setDeckBTrackIdx(initialTracks.length > 1 ? 1 : 0);
    setActiveDeck("A");
    setCrossfader(0);
    setIsCrossfading(false);
    setPlayFullSong(false);
  }, [initialTracks]);

  // Keep mobile deck tab in sync with broadcasting deck
  useEffect(() => {
    setMobileDeckTab(activeDeck);
  }, [activeDeck]);

  // Helper to show temporary toasts
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Active & cued tracks
  const trackA = localTracks[deckATrackIdx] || localTracks[0];
  const trackB = localTracks[deckBTrackIdx] || localTracks[1] || localTracks[0];
  const activeTrack = activeDeck === "A" ? trackA : trackB;
  const cuedTrack = activeDeck === "A" ? trackB : trackA;
  const currentActiveIdx = activeDeck === "A" ? deckATrackIdx : deckBTrackIdx;

  // Duration in seconds (1 to 2 mins: 80s to 120s)
  const activeHookDuration = activeTrack?.hookDuration || 95;
  const activeHookEnd = (activeTrack?.hookStart || 0) + activeHookDuration;
  const activeCurrentTime = activeDeck === "A" ? currentTimeA : currentTimeB;
  const remainingSec = Math.max(0, Math.ceil(activeHookEnd - activeCurrentTime));

  // Detect Mobile / Touch devices
  const checkIsMobile = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    );
  }, []);

  // ==========================================================
  // MOBILE-OPTIMIZED INSTANT SMOOTH CROSSFADE
  // ==========================================================
  const triggerCrossfade = useCallback(() => {
    if (isCrossfading || localTracks.length < 2) return;

    setIsCrossfading(true);
    djFx.playLaser(); // Harmonic transition chime

    const targetDeck = activeDeck === "A" ? "B" : "A";
    const targetTrack = targetDeck === "A" ? trackA : trackB;
    const isMobile = checkIsMobile();

    // ON MOBILE PHONES:
    // iOS and Android mobile browsers restrict simultaneous unmuted iframe playback.
    // To prevent the dreaded 4-second silence and manual resume freeze, we use
    // the currently active, unlocked audio engine to immediately load the next song
    // while playing a seamless DJ transition sound effect!
    if (isMobile) {
      djFx.playVinylScratch();

      const activePlayer = activeDeck === "A" ? playerRefA.current : playerRefB.current;
      if (activePlayer && targetTrack) {
        try {
          activePlayer.loadVideoById({
            videoId: targetTrack.videoId,
            startSeconds: targetTrack.hookStart || 0,
          });
          activePlayer.setVolume(100);
          activePlayer.playVideo();
        } catch (err) {
          console.warn("Mobile playback switch:", err);
        }
      }

      // Smooth visual crossfader animation
      const durationMs = 800;
      const startTime = Date.now();
      const startVal = crossfader;
      const endVal = targetDeck === "B" ? 100 : 0;

      const animateSlider = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        setCrossfader(Math.round(startVal + (endVal - startVal) * progress));

        if (progress < 1) {
          requestAnimationFrame(animateSlider);
        } else {
          setActiveDeck(targetDeck);
          if (targetDeck === "A") {
            const nextIdx = (deckATrackIdx + 1) % localTracks.length;
            setDeckBTrackIdx(nextIdx);
            setCrossfader(0);
          } else {
            const nextIdx = (deckBTrackIdx + 1) % localTracks.length;
            setDeckATrackIdx(nextIdx);
            setCrossfader(100);
          }
          setIsCrossfading(false);
          setIsPlaying(true);
        }
      };
      requestAnimationFrame(animateSlider);
      return;
    }

    // ON DESKTOP BROWSERS:
    // Smooth 2-second dual-deck crossfade between Player A and Player B
    const outgoingPlayer = activeDeck === "A" ? playerRefA.current : playerRefB.current;
    const incomingPlayer = targetDeck === "A" ? playerRefA.current : playerRefB.current;

    if (incomingPlayer && targetTrack) {
      try {
        incomingPlayer.seekTo(targetTrack.hookStart || 0, true);
        incomingPlayer.setVolume(0);
        incomingPlayer.playVideo();
      } catch (err) {
        console.warn("Incoming player error:", err);
      }
    }

    const steps = 20;
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
          const nextForDeckA = (deckBTrackIdx + 1) % localTracks.length;
          setDeckATrackIdx(nextForDeckA);
        } else {
          setActiveDeck("A");
          setCrossfader(0);
          const nextForDeckB = (deckATrackIdx + 1) % localTracks.length;
          setDeckBTrackIdx(nextForDeckB);
        }

        setIsCrossfading(false);
      }
    }, intervalMs);
  }, [
    activeDeck,
    trackA,
    trackB,
    deckATrackIdx,
    deckBTrackIdx,
    isCrossfading,
    localTracks.length,
    crossfadeSec,
    crossfader,
    checkIsMobile,
  ]);

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

          // Auto-trigger crossfade 2 seconds before hook ends
          if (!playFullSong && !isCrossfading && now >= activeHookEnd - crossfadeSec) {
            triggerCrossfade();
          }
        }
      } catch {}
    }, 250);

    return () => clearInterval(timer);
  }, [activeDeck, activeTrack, activeHookEnd, playFullSong, isCrossfading, crossfadeSec, triggerCrossfade]);

  // User manually selects a track from the queue
  const selectTrackDirectly = (idx: number) => {
    const selected = localTracks[idx];
    if (!selected) return;

    djFx.playVinylScratch();

    if (activeDeck === "A") {
      setDeckATrackIdx(idx);
      setDeckBTrackIdx((idx + 1) % localTracks.length);
      if (playerRefA.current) {
        try {
          playerRefA.current.loadVideoById({
            videoId: selected.videoId,
            startSeconds: selected.hookStart || 0,
          });
          playerRefA.current.setVolume(100);
          playerRefA.current.playVideo();
          setIsPlaying(true);
        } catch {}
      }
    } else {
      setDeckBTrackIdx(idx);
      setDeckATrackIdx((idx + 1) % localTracks.length);
      if (playerRefB.current) {
        try {
          playerRefB.current.loadVideoById({
            videoId: selected.videoId,
            startSeconds: selected.hookStart || 0,
          });
          playerRefB.current.setVolume(100);
          playerRefB.current.playVideo();
          setIsPlaying(true);
        } catch {}
      }
    }
    setHasStartedPlayback(true);
  };

  // Cue a track to the opposite deck without interrupting current playback
  const cueToNextDeck = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cued = localTracks[idx];
    if (!cued) return;

    if (activeDeck === "A") {
      setDeckBTrackIdx(idx);
      if (playerRefB.current && !checkIsMobile()) {
        try {
          playerRefB.current.cueVideoById({
            videoId: cued.videoId,
            startSeconds: cued.hookStart || 0,
          });
        } catch {}
      }
    } else {
      setDeckATrackIdx(idx);
      if (playerRefA.current && !checkIsMobile()) {
        try {
          playerRefA.current.cueVideoById({
            videoId: cued.videoId,
            startSeconds: cued.hookStart || 0,
          });
        } catch {}
      }
    }
    djFx.playAirhorn();
    showToast(`Cued "${cued.title}" onto Deck ${activeDeck === "A" ? "B" : "A"}!`);
  };

  // Toggle play / pause
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
        setHasStartedPlayback(true);
      }
    } catch {}
  };

  // First touch unlock for mobile devices
  const handleMobileInitialStart = () => {
    djFx.playLaser();
    const activePlayer = activeDeck === "A" ? playerRefA.current : playerRefB.current;
    if (activePlayer) {
      try {
        activePlayer.playVideo();
      } catch {}
    }
    setIsPlaying(true);
    setHasStartedPlayback(true);
  };

  // ==========================================================
  // LIVE YOUTUBE SEARCH & ADD TO NEXT QUEUE
  // ==========================================================
  const handleLiveYouTubeSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsYtSearching(true);
    try {
      const res = await fetch("/api/search-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        setYtSearchResults(data.results);
      } else {
        showToast(data.error || "Search returned no tracks");
      }
    } catch (err: any) {
      showToast("Unable to reach YouTube live search");
    } finally {
      setIsYtSearching(false);
    }
  };

  // Add song directly as NEXT UP in queue (right after current playing song)
  const addTrackToPlayNext = (track: any) => {
    const newTrack: AutoAuxTrack = {
      order: currentActiveIdx + 2,
      title: track.title,
      artist: track.artist,
      estimated_hook_start_sec: track.hookStart || 30,
      videoId: track.videoId,
      hookStart: track.hookStart || 30,
      hookEnd: (track.hookStart || 30) + (track.hookDuration || 95),
      hookDuration: track.hookDuration || 95,
      isTrending: true,
      trendingBadge: "⚡ Added Live Next Up",
      category: "LIVE",
      phase: "Live Request",
      durationSec: track.durationSec || 240,
      energy: track.energy || 85,
      sourceUrl: track.sourceUrl,
      thumbnail: track.thumbnail,
    };

    const nextIndex = currentActiveIdx + 1;
    const updated = [
      ...localTracks.slice(0, nextIndex),
      newTrack,
      ...localTracks.slice(nextIndex),
    ];

    setLocalTracks(updated);
    if (onTracksChange) onTracksChange(updated);

    // Immediately cue this track onto the opposite deck!
    if (activeDeck === "A") {
      setDeckBTrackIdx(nextIndex);
      if (playerRefB.current && !checkIsMobile()) {
        try {
          playerRefB.current.cueVideoById({
            videoId: newTrack.videoId,
            startSeconds: newTrack.hookStart,
          });
        } catch {}
      }
    } else {
      setDeckATrackIdx(nextIndex);
      if (playerRefA.current && !checkIsMobile()) {
        try {
          playerRefA.current.cueVideoById({
            videoId: newTrack.videoId,
            startSeconds: newTrack.hookStart,
          });
        } catch {}
      }
    }

    djFx.playAirhorn();
    showToast(`⚡ Added "${newTrack.title}" to Play Next! Cued on Deck ${activeDeck === "A" ? "B" : "A"}`);
    setIsSearchModalOpen(false);
  };

  // Append song to the end of the ceremony queue
  const addTrackToEndOfQueue = (track: any) => {
    const newTrack: AutoAuxTrack = {
      order: localTracks.length + 1,
      title: track.title,
      artist: track.artist,
      estimated_hook_start_sec: track.hookStart || 30,
      videoId: track.videoId,
      hookStart: track.hookStart || 30,
      hookEnd: (track.hookStart || 30) + (track.hookDuration || 95),
      hookDuration: track.hookDuration || 95,
      isTrending: true,
      trendingBadge: "🎶 Live YouTube Queue",
      category: "LIVE",
      phase: "Live Request",
      durationSec: track.durationSec || 240,
      energy: track.energy || 85,
      sourceUrl: track.sourceUrl,
      thumbnail: track.thumbnail,
    };

    const updated = [...localTracks, newTrack];
    setLocalTracks(updated);
    if (onTracksChange) onTracksChange(updated);

    djFx.playLaser();
    showToast(`✨ Added "${newTrack.title}" to Ceremony Repertoire (#${updated.length})`);
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

  // Filtered tracks for the queue list
  const displayedTracks = useMemo(() => {
    return localTracks.filter((t, idx) => {
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
  }, [localTracks, filterCategory, searchQuery]);

  if (!activeTrack) return null;

  const volA = Math.round(100 - crossfader);
  const volB = Math.round(crossfader);

  return (
    <div className="space-y-6 sm:space-y-8 pb-24">
      {/* ======================================================== */}
      {/* TOAST NOTIFICATION BANNER                                */}
      {/* ======================================================== */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] px-4 py-3 rounded-2xl bg-[#1a1c2b] border border-amber-400/50 shadow-[0_10px_35px_rgba(0,0,0,0.8)] text-amber-200 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-fade-in backdrop-blur-xl">
          <div className="flex items-center gap-2.5 truncate">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* INLINE STREAMING AUDIO ENGINES (PLAYSINLINE FOR MOBILE)  */}
      {/* ======================================================== */}
      <div
        className="fixed bottom-0 right-0 w-24 h-24 opacity-[0.001] pointer-events-none -z-50 overflow-hidden"
        aria-hidden="true"
      >
        <YouTube
          videoId={trackA?.videoId || "eqqn1bPPp1M"}
          opts={{
            width: "100",
            height: "100",
            playerVars: {
              autoplay: 1,
              controls: 0,
              rel: 0,
              playsinline: 1,
              enablejsapi: 1,
              start: trackA?.hookStart || 0,
            },
          }}
          onReady={(event: any) => {
            playerRefA.current = event.target;
            try {
              event.target.setVolume(activeDeck === "A" ? 100 : 0);
              event.target.seekTo(trackA?.hookStart || 0, true);
              if (activeDeck === "A") event.target.playVideo();
            } catch {}
          }}
          onStateChange={(e: any) => {
            if (activeDeck === "A") {
              if (e.data === 1) setIsPlaying(true);
              else if (e.data === 2) setIsPlaying(false);
            }
          }}
        />
        <YouTube
          videoId={trackB?.videoId || "hR8FEdC6aAs"}
          opts={{
            width: "100",
            height: "100",
            playerVars: {
              autoplay: 1,
              controls: 0,
              rel: 0,
              playsinline: 1,
              enablejsapi: 1,
              start: trackB?.hookStart || 0,
            },
          }}
          onReady={(event: any) => {
            playerRefB.current = event.target;
            try {
              event.target.setVolume(activeDeck === "B" ? 100 : 0);
              event.target.seekTo(trackB?.hookStart || 0, true);
              if (activeDeck === "B") event.target.playVideo();
            } catch {}
          }}
          onStateChange={(e: any) => {
            if (activeDeck === "B") {
              if (e.data === 1) setIsPlaying(true);
              else if (e.data === 2) setIsPlaying(false);
            }
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* MOBILE TAP-TO-START BANNER (OVERCOMES AUTOPLAY RESTRICTION) */}
      {/* ======================================================== */}
      {!hasStartedPlayback && (
        <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/70 via-[#181926] to-amber-900/40 p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="h-10 w-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-lg font-bold">
              <Play className="h-5 w-5 fill-current ml-0.5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                Audio Stream Ready • Tap to Unleash Mehfil Sound
              </h4>
              <p className="text-xs text-amber-200/80">
                Optimized for phones &amp; speakers with zero-video bandwidth and instant DJ crossfade.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMobileInitialStart}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs sm:text-sm font-bold shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition"
          >
            Start Audio Stream Now
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* AESTHETIC ANALOG TURNTABLE AUDIO CONSOLE                  */}
      {/* ======================================================== */}
      <div className="relative rounded-3xl sm:rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-b from-[#10121a] via-[#0b0c13] to-[#07080e] p-4 sm:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
        {/* Ambient Candlelight / Gold Glow Background */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-gradient-to-b from-amber-500/10 via-amber-700/5 to-transparent blur-3xl" />

        {/* Master Console Status Header */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-white/[0.08] pb-4 mb-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-3 w-3 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] uppercase text-amber-200/80">
                CEREMONY AUDIO MASTER • ZERO-VIDEO STREAM
              </p>
              <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100">
                Deck {activeDeck} Active — Track #{currentActiveIdx + 1} of {localTracks.length}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* LIVE YOUTUBE SEARCH BUTTON */}
            <button
              type="button"
              onClick={() => {
                setYtSearchQuery("");
                setYtSearchResults([]);
                setIsSearchModalOpen(true);
              }}
              className="rounded-full bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(220,38,38,0.35)] hover:brightness-110 active:scale-95 transition flex items-center gap-1.5"
            >
              <Radio className="h-3.5 w-3.5 text-white" />
              <span>Search YouTube Live</span>
            </button>

            <span className="rounded-full bg-amber-500/[0.08] border border-amber-500/30 px-3 py-1 text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-400/80" />
              {formatMinSecHuman(activeHookDuration)}
            </span>

            <button
              type="button"
              onClick={() => setPlayFullSong((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                playFullSong
                  ? "bg-amber-400/20 text-amber-200 border border-amber-400/40"
                  : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-slate-200"
              }`}
            >
              {playFullSong ? "Full Song" : "1–2 Min"}
            </button>
          </div>
        </div>

        {/* Mobile Tab Pill for Small Screens */}
        <div className="flex lg:hidden items-center justify-center gap-2 pb-4">
          <button
            type="button"
            onClick={() => setMobileDeckTab("A")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
              mobileDeckTab === "A"
                ? "bg-amber-500/20 border border-amber-400/60 text-amber-200 shadow-md"
                : "bg-white/[0.03] border border-white/[0.06] text-slate-400"
            }`}
          >
            <span>DECK A</span>
            {activeDeck === "A" && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
            <span className="text-[10px] text-slate-500">({volA}%)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileDeckTab("B")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
              mobileDeckTab === "B"
                ? "bg-amber-500/20 border border-amber-400/60 text-amber-200 shadow-md"
                : "bg-white/[0.03] border border-white/[0.06] text-slate-400"
            }`}
          >
            <span>DECK B</span>
            {activeDeck === "B" && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
            <span className="text-[10px] text-slate-500">({volB}%)</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* DUAL HANDCRAFTED ANALOG VINYL PLATTERS + AUDIO STAGE      */}
        {/* ======================================================== */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
          {/* DECK A: ANALOG TURNTABLE */}
          <div
            className={`lg:col-span-4 rounded-3xl border p-4 sm:p-5 transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden ${
              mobileDeckTab === "B" ? "hidden lg:flex" : "flex"
            } ${
              activeDeck === "A"
                ? "border-amber-400/40 bg-[#12141e]/90 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
                : "border-white/[0.06] bg-[#0c0d14]/70 opacity-70"
            }`}
          >
            {/* Deck Header */}
            <div className="w-full flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
              <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-amber-200/90 font-bold uppercase">
                DECK A {activeDeck === "A" ? "• BROADCASTING" : "• CUED NEXT"}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">{volA}% VOL</span>
            </div>

            {/* Realistic Vinyl Platter */}
            <div
              onClick={() => {
                if (activeDeck !== "A") triggerCrossfade();
                else togglePlay();
              }}
              className="relative w-40 h-40 sm:w-52 sm:h-52 my-2 flex items-center justify-center cursor-pointer select-none active:scale-95 transition-transform"
            >
              {/* Outer Turntable Platter Rim */}
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

                  {/* Golden Center Label */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-900/90 via-[#3a2810] to-amber-700/80 border-2 border-amber-400/40 shadow-inner flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[7px] sm:text-[8px] font-mono font-bold tracking-widest text-amber-200 uppercase">
                      33⅓ RPM
                    </span>
                    <p className="text-[8px] sm:text-[9px] font-serif font-bold text-amber-100 truncate w-full">
                      {trackA?.title}
                    </p>
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-slate-900 border border-amber-300/40 mt-1" />
                  </div>
                </div>
              </div>

              {/* Tonearm Stylus Mechanism */}
              <div
                className={`absolute -right-1 top-2 w-14 sm:w-16 h-24 sm:h-28 pointer-events-none transition-transform duration-700 origin-top-right ${
                  activeDeck === "A" && isPlaying ? "rotate-[14deg]" : "rotate-[-10deg]"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 border border-black shadow absolute right-1 top-1" />
                <div className="w-0.5 h-16 sm:h-20 bg-gradient-to-b from-amber-200 to-amber-500/80 absolute right-1.5 top-2 shadow" />
                <div className="w-2.5 h-3.5 bg-amber-300 rounded-sm absolute right-0.5 bottom-6 shadow border border-amber-600" />
              </div>
            </div>

            {/* Track Info */}
            <div className="w-full pt-2 text-left">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-amber-400/80">
                {trackA?.phase || "Ceremony Selection"}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">{trackA?.title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">{trackA?.artist}</p>
            </div>
          </div>

          {/* CENTER DJ CONSOLE: CROSSFADER & ANALOG VU METERS */}
          <div className="lg:col-span-4 rounded-3xl border border-white/[0.08] bg-[#0c0d16]/90 p-4 sm:p-5 flex flex-col justify-between space-y-4 sm:space-y-5">
            <div className="text-center border-b border-white/[0.06] pb-2">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300/90 font-medium flex items-center justify-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                ACOUSTIC DUAL-DECK CONSOLE
              </span>
            </div>

            {/* Organic Audio Frequency Visualizer */}
            <div className="rounded-2xl bg-black/60 border border-white/[0.06] p-3.5 text-center space-y-2">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400">
                <span>Phase Window:</span>
                <span className="text-amber-200 font-bold">
                  {formatSec(activeTrack?.hookStart || 0)} → {formatSec(activeHookEnd)}
                </span>
              </div>

              {/* Sine Wave Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-7 py-1">
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
              <p className="text-xs sm:text-sm font-semibold tracking-tight text-white">
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
                <span
                  onClick={() => {
                    setCrossfader(0);
                    setActiveDeck("A");
                  }}
                  className={`cursor-pointer ${activeDeck === "A" ? "text-amber-300 font-bold" : "text-slate-500"}`}
                >
                  DECK A: {volA}%
                </span>
                <span className="text-slate-400 tracking-wider">
                  {crossfader === 0 ? "MASTER A" : crossfader === 100 ? "MASTER B" : `CROSSFADE ${crossfader}%`}
                </span>
                <span
                  onClick={() => {
                    setCrossfader(100);
                    setActiveDeck("B");
                  }}
                  className={`cursor-pointer ${activeDeck === "B" ? "text-amber-300 font-bold" : "text-slate-500"}`}
                >
                  DECK B: {volB}%
                </span>
              </div>

              {/* Knurled Brass Crossfader Slider (Clickable & Touch-Friendly) */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                  setCrossfader(pos);
                  if (pos > 50 && activeDeck !== "B") setActiveDeck("B");
                  else if (pos <= 50 && activeDeck !== "A") setActiveDeck("A");
                }}
                className="relative h-7 w-full rounded-full bg-black/90 border border-white/[0.12] p-1 flex items-center shadow-inner cursor-pointer select-none"
              >
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
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 py-3.5 px-3 text-xs sm:text-sm font-bold text-slate-950 shadow-[0_4px_20px_rgba(212,175,55,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50 transition touch-manipulation min-h-[48px]"
              >
                <Sparkles className="h-4 w-4 text-slate-950 shrink-0" />
                <span>Crossfade Now</span>
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] py-3.5 px-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/[0.08] active:scale-95 transition touch-manipulation min-h-[48px]"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 text-amber-300 shrink-0" />
                ) : (
                  <Play className="h-4 w-4 text-amber-300 shrink-0" />
                )}
                <span>{isPlaying ? "Pause" : "Resume"}</span>
              </button>
            </div>

            {/* Tactile Ambient FX Buttons */}
            <div className="space-y-1 pt-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400 text-center block">
                CEREMONY SOUND ACCENTS
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => djFx.playAirhorn()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-90 transition min-h-[40px] touch-manipulation"
                >
                  Chime
                </button>
                <button
                  type="button"
                  onClick={() => djFx.playVinylScratch()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-90 transition min-h-[40px] touch-manipulation"
                >
                  Rewind
                </button>
                <button
                  type="button"
                  onClick={() => djFx.playBassDrop()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-90 transition min-h-[40px] touch-manipulation"
                >
                  Sub Drop
                </button>
                <button
                  type="button"
                  onClick={() => djFx.playLaser()}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-[10px] font-mono text-slate-300 hover:border-amber-400/40 hover:text-amber-200 active:scale-90 transition min-h-[40px] touch-manipulation"
                >
                  Sweep
                </button>
              </div>
            </div>
          </div>

          {/* DECK B: ANALOG TURNTABLE */}
          <div
            className={`lg:col-span-4 rounded-3xl border p-4 sm:p-5 transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden ${
              mobileDeckTab === "A" ? "hidden lg:flex" : "flex"
            } ${
              activeDeck === "B"
                ? "border-amber-400/40 bg-[#12141e]/90 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
                : "border-white/[0.06] bg-[#0c0d14]/70 opacity-70"
            }`}
          >
            {/* Deck Header */}
            <div className="w-full flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
              <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-amber-200/90 font-bold uppercase">
                DECK B {activeDeck === "B" ? "• BROADCASTING" : "• CUED NEXT"}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">{volB}% VOL</span>
            </div>

            {/* Realistic Vinyl Platter */}
            <div
              onClick={() => {
                if (activeDeck !== "B") triggerCrossfade();
                else togglePlay();
              }}
              className="relative w-40 h-40 sm:w-52 sm:h-52 my-2 flex items-center justify-center cursor-pointer select-none active:scale-95 transition-transform"
            >
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

                  {/* Golden Center Label */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-900/90 via-[#3a2810] to-amber-700/80 border-2 border-amber-400/40 shadow-inner flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[7px] sm:text-[8px] font-mono font-bold tracking-widest text-amber-200 uppercase">
                      33⅓ RPM
                    </span>
                    <p className="text-[8px] sm:text-[9px] font-serif font-bold text-amber-100 truncate w-full">
                      {trackB?.title}
                    </p>
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-slate-900 border border-amber-300/40 mt-1" />
                  </div>
                </div>
              </div>

              {/* Tonearm Stylus Mechanism */}
              <div
                className={`absolute -right-1 top-2 w-14 sm:w-16 h-24 sm:h-28 pointer-events-none transition-transform duration-700 origin-top-right ${
                  activeDeck === "B" && isPlaying ? "rotate-[14deg]" : "rotate-[-10deg]"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 border border-black shadow absolute right-1 top-1" />
                <div className="w-0.5 h-16 sm:h-20 bg-gradient-to-b from-amber-200 to-amber-500/80 absolute right-1.5 top-2 shadow" />
                <div className="w-2.5 h-3.5 bg-amber-300 rounded-sm absolute right-0.5 bottom-6 shadow border border-amber-600" />
              </div>
            </div>

            {/* Track Info */}
            <div className="w-full pt-2 text-left">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-amber-400/80">
                {trackB?.phase || "Ceremony Selection"}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">{trackB?.title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">{trackB?.artist}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CEREMONY REPERTOIRE QUEUE & LIVE SEARCH TRIGGER           */}
      {/* ======================================================== */}
      <div className="rounded-3xl sm:rounded-[2.5rem] border border-white/[0.08] bg-[#090a12]/95 p-4 sm:p-8 shadow-2xl space-y-5 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-white/[0.06] pb-4 sm:pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Crown className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm sm:text-base font-serif font-bold tracking-wide text-white">
                Engagement Ceremony Repertoire ({localTracks.length} Curated Works)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Bol Na Halke Halke (Instrumental), Nusrat Fateh Ali Khan, Ali Sethi, Kaifi Khalil &amp; Classical Coke Studio
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setYtSearchQuery("");
                setYtSearchResults([]);
                setIsSearchModalOpen(true);
              }}
              className="rounded-full bg-amber-500/[0.1] border border-amber-400/40 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 text-amber-400" />
              <span>Add From YouTube</span>
            </button>
            <span className="rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-mono text-slate-300 hidden sm:inline-block">
              Zero Video Overhead
            </span>
          </div>
        </div>

        {/* Phase Navigation Tabs & Local Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: "ALL", label: `All (${localTracks.length})` },
              { id: "ENTRANCE", label: "Entrance (1–8)" },
              { id: "ROMANCE", label: "Romance (9–20)" },
              { id: "SANGEET", label: "Sangeet (21–28)" },
              { id: "CLIMAX", label: "Climax (29+)" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`rounded-full px-3 py-1 sm:px-4 sm:py-1.5 text-xs font-medium transition ${
                  filterCategory === cat.id
                    ? "bg-amber-400/20 text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                    : "bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queue or artist..."
              className="w-full sm:w-64 rounded-full border border-white/[0.08] bg-black/60 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Repertoire Track Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 max-h-[580px] overflow-y-auto pr-1">
          {displayedTracks.map((t) => {
            const trueIdx = localTracks.findIndex((item) => item.videoId === t.videoId);
            const isPlayingThis = trueIdx === currentActiveIdx;
            const isCuedNext = trueIdx === (activeDeck === "A" ? deckBTrackIdx : deckATrackIdx);
            const durationForTrack = t.hookDuration || 95;

            return (
              <div
                key={`${t.videoId}-${t.title}-${trueIdx}`}
                onClick={() => selectTrackDirectly(trueIdx >= 0 ? trueIdx : 0)}
                className={`w-full text-left flex items-center justify-between gap-3 rounded-2xl border p-3 sm:p-4 transition-all duration-200 group cursor-pointer ${
                  isPlayingThis
                    ? "border-amber-400/70 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-transparent shadow-[0_0_25px_rgba(212,175,55,0.15)]"
                    : isCuedNext
                    ? "border-amber-500/40 bg-amber-500/[0.04]"
                    : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-semibold ${
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
                      <p
                        className={`truncate text-xs sm:text-sm font-semibold ${
                          isPlayingThis ? "text-amber-200" : "text-slate-100"
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.phase && (
                        <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[8px] sm:text-[9px] font-mono text-slate-400 border border-white/[0.06]">
                          {t.phase}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] sm:text-xs text-slate-400">{t.artist}</p>
                    <p className="mt-0.5 font-mono text-[9px] sm:text-[10px] text-amber-300/80 flex items-center gap-2">
                      <span>
                        Cue: {formatSec(t.hookStart)} → {formatSec(t.hookStart + durationForTrack)}
                      </span>
                      <span className="text-amber-400 font-bold">({formatMinSecHuman(durationForTrack)} Drop)</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {!isPlayingThis && !isCuedNext && (
                    <button
                      type="button"
                      onClick={(e) => cueToNextDeck(trueIdx, e)}
                      title="Cue this track next"
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 transition"
                    >
                      Cue Next
                    </button>
                  )}
                  <span className="font-mono text-[11px] sm:text-xs font-semibold text-amber-300/90 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    {t.energy}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {displayedTracks.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="text-slate-400 text-sm">No songs matching &quot;{searchQuery}&quot; in local queue.</p>
            <button
              type="button"
              onClick={() => {
                setYtSearchQuery(searchQuery);
                setIsSearchModalOpen(true);
                handleLiveYouTubeSearch(searchQuery);
              }}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-red-600 to-amber-500 text-white text-xs font-semibold shadow-lg hover:brightness-110 transition"
            >
              Search &quot;{searchQuery}&quot; live on YouTube
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* LIVE YOUTUBE SEARCH & ADD TO QUEUE MODAL                 */}
      {/* ======================================================== */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-3xl border border-amber-500/30 bg-[#0c0d16] p-5 sm:p-7 shadow-[0_20px_90px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                    Search Live YouTube Repertoire
                  </h3>
                  <p className="text-xs text-slate-400">
                    Search any track, qawwali, or remix to add straight into your ceremony queue.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/[0.04] text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLiveYouTubeSearch(ytSearchQuery);
              }}
              className="flex gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={ytSearchQuery}
                  onChange={(e) => setYtSearchQuery(e.target.value)}
                  placeholder="Enter song name, artist, or YouTube query (e.g. Kaifi Khalil, Nusrat live)..."
                  className="w-full rounded-2xl border border-white/[0.12] bg-black/70 pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isYtSearching || !ytSearchQuery.trim()}
                className="px-5 sm:px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 text-white text-xs sm:text-sm font-semibold shadow-lg hover:brightness-110 disabled:opacity-50 transition flex items-center gap-2 shrink-0"
              >
                {isYtSearching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>Search</span>
              </button>
            </form>

            {/* Quick Inspiration Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase text-slate-500 mr-1">Trending:</span>
              {[
                "Nusrat Fateh Ali Khan Live",
                "Kahani Suno 2.0 Kaifi",
                "Ali Sethi Ghazal",
                "Coke Studio Sufi",
                "Bollywood Wedding Remix",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setYtSearchQuery(chip);
                    handleLiveYouTubeSearch(chip);
                  }}
                  className="rounded-full bg-white/[0.03] border border-white/[0.08] px-3 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-amber-200 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]">
              {isYtSearching ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="h-8 w-8 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                  <p className="text-xs text-amber-200/80 font-mono">
                    Tuning into live YouTube frequencies...
                  </p>
                </div>
              ) : ytSearchResults.length > 0 ? (
                ytSearchResults.map((res: any) => (
                  <div
                    key={res.videoId}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {res.thumbnail ? (
                        <div className="relative h-12 w-16 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                          <img
                            src={res.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[9px] font-mono text-white">
                            {res.timestamp}
                          </span>
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                          <Music className="h-5 w-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate">
                          {res.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{res.artist}</p>
                        <span className="text-[9px] font-mono text-amber-300/80">
                          Drop Cue: ~{res.hookStart}s ({formatMinSecHuman(res.hookDuration || 95)})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => addTrackToPlayNext(res)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-bold shadow hover:brightness-110 active:scale-95 transition flex items-center gap-1.5"
                      >
                        <Zap className="h-3.5 w-3.5 fill-current" />
                        <span>Play Next</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => addTrackToEndOfQueue(res)}
                        className="px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.04] text-slate-200 text-xs font-medium hover:border-white/30 hover:text-white active:scale-95 transition"
                      >
                        + Queue
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 space-y-2">
                  <Music className="h-8 w-8 text-slate-600" />
                  <p className="text-xs sm:text-sm">Search any track to inject it live into the queue.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
