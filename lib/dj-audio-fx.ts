// Web Audio API DJ Sound FX Engine
class DjAudioFxEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // 1. Classic Dancehall DJ Airhorn
  playAirhorn() {
    const ctx = this.getContext();
    if (!ctx) return;

    const pitches = [466.16, 554.37, 622.25]; // Bb4, Db5, Eb5 fanfare chord
    const bursts = [0, 0.14, 0.28, 0.46]; // Multi-blast pattern

    bursts.forEach((startOffset, burstIdx) => {
      const duration = burstIdx === bursts.length - 1 ? 0.35 : 0.1;
      pitches.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
        osc.frequency.exponentialRampToValueAtTime(
          freq * 1.03,
          ctx.currentTime + startOffset + duration
        );

        gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + startOffset + duration
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration + 0.05);
      });
    });
  }

  // 2. Turntable Vinyl Scratch & Backspin
  playVinylScratch() {
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 14;

    const now = ctx.currentTime;
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.4);
  }

  // 3. 808 Sub-Bass Drop
  playBassDrop() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.9);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.0);
  }

  // 4. Laser / Hype Transition Zap
  playLaser() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.22);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }
}

export const djFx = new DjAudioFxEngine();
