export type AudioTrack = 'cover' | 'feeding' | 'rain' | 'transform' | 'ending' | 'none';

export class AudioDirector {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private currentTrack: AudioTrack = 'none';
  private loopTimer: number | null = null;
  private isUnlocked: boolean = false;
  private bgmEnabled: boolean = true;
  private sfxEnabled: boolean = true;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
          }
        } else {
          if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
            this.ctx.resume();
          }
        }
      });
    }
  }

  /**
   * Unlock Web Audio API on first user gesture.
   * Completely safe and idempotent.
   */
  public async unlock(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.bgmEnabled ? 0.36 : 0, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? 0.65 : 0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.isUnlocked = true;

      // If a background track is pending, start it immediately!
      if (this.currentTrack !== 'none' && this.loopTimer === null) {
        this.startTrackLoop(this.currentTrack);
      }

      return true;
    } catch (e) {
      console.warn('AudioContext failed to unlock:', e);
      return false;
    }
  }

  public setSettings(bgm: boolean, sfx: boolean): void {
    this.bgmEnabled = bgm;
    this.sfxEnabled = sfx;
    if (this.ctx && this.bgmGain && this.sfxGain) {
      const t = this.ctx.currentTime;
      this.bgmGain.gain.setTargetAtTime(bgm ? 0.36 : 0, t, 0.1);
      this.sfxGain.gain.setTargetAtTime(sfx ? 0.65 : 0, t, 0.1);
    }
  }

  // --- BGM Synthesis ---
  public playTrack(track: AudioTrack): void {
    if (this.currentTrack === track && this.loopTimer !== null) return;
    this.stopTrack();
    this.currentTrack = track;
    if (track === 'none') return;

    if (!this.ctx || !this.isUnlocked || this.ctx.state !== 'running') {
      // Auto-unlock if inside user interaction handler
      this.unlock().then(() => {
        if (this.currentTrack === track && this.loopTimer === null) {
          this.startTrackLoop(track);
        }
      });
      return;
    }

    this.startTrackLoop(track);
  }

  public stopTrack(): void {
    this.currentTrack = 'none';
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private startTrackLoop(track: AudioTrack): void {
    if (this.currentTrack !== track || !this.ctx || !this.bgmGain) return;

    const cycleDuration = this.scheduleTrackCycle(track);
    this.loopTimer = window.setTimeout(() => {
      this.startTrackLoop(track);
    }, Math.max(1000, (cycleDuration - 0.25) * 1000));
  }

  /**
   * Rich, multi-layered warm storybook composition per chapter.
   */
  private scheduleTrackCycle(track: AudioTrack): number {
    if (!this.ctx || !this.bgmGain) return 6;
    const now = this.ctx.currentTime;

    switch (track) {
      case 'cover': {
        // C01 & Title: Ghibli-inspired warm felt piano & music box in C Major (8 bars, 24.0s)
        const totalDuration = 24.0;

        // 1. Warm Acoustic Bass
        const bassNotes = [
          { f: 65.41, t: 0.0, d: 2.8 },  // C2
          { f: 110.00, t: 3.0, d: 2.8 }, // A2
          { f: 87.31, t: 6.0, d: 2.8 },  // F2
          { f: 98.00, t: 9.0, d: 2.8 },  // G2
          { f: 82.41, t: 12.0, d: 2.8 }, // E2
          { f: 110.00, t: 15.0, d: 2.8 },// A2 (Chromatic touch)
          { f: 73.42, t: 18.0, d: 2.8 }, // D2
          { f: 98.00, t: 21.0, d: 1.4 }, // G2
          { f: 65.41, t: 22.4, d: 2.4 }, // C2
        ];
        bassNotes.forEach((b) => this.playWarmBass(b.f, now + b.t, b.d, 0.26));

        // 2. Gentle Ambient Chord Pad (Warm cozy background)
        const pads = [
          { freqs: [164.81, 196.00, 246.94], t: 0.1, d: 2.9 }, // Cmaj7
          { freqs: [130.81, 164.81, 246.94], t: 3.1, d: 2.9 }, // Am9
          { freqs: [174.61, 220.00, 261.63], t: 6.1, d: 2.9 }, // Fmaj7
          { freqs: [196.00, 246.94, 293.66], t: 9.1, d: 2.9 }, // G7
          { freqs: [164.81, 196.00, 246.94], t: 12.1, d: 2.9 },// Em7
          { freqs: [220.00, 277.18, 329.63], t: 15.1, d: 2.9 },// A7
          { freqs: [174.61, 220.00, 261.63], t: 18.1, d: 2.9 },// Dm9
          { freqs: [196.00, 246.94, 261.63], t: 21.1, d: 2.8 },// G7 -> C
        ];
        pads.forEach((p) => this.playWarmPad(p.freqs, now + p.t, p.d, 0.05));

        // 3. Felt Piano & Music Box Arpeggios & Singing Melodies
        const melody = [
          // Bar 1 (Cmaj7)
          { f: 261.63, t: 0.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 329.63, t: 0.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 392.00, t: 1.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 493.88, t: 1.5, d: 1.8, v: 0.16, type: 'piano' as const },
          { f: 659.25, t: 1.8, d: 1.4, v: 0.22, type: 'bell' as const }, // E5
          { f: 587.33, t: 2.4, d: 1.2, v: 0.20, type: 'bell' as const }, // D5

          // Bar 2 (Am9)
          { f: 220.00, t: 3.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 261.63, t: 3.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 329.63, t: 4.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 493.88, t: 4.5, d: 1.8, v: 0.16, type: 'piano' as const },
          { f: 523.25, t: 4.8, d: 1.5, v: 0.22, type: 'bell' as const }, // C5
          { f: 493.88, t: 5.4, d: 1.2, v: 0.19, type: 'bell' as const }, // B4

          // Bar 3 (Fmaj7)
          { f: 174.61, t: 6.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 220.00, t: 6.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 261.63, t: 7.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 329.63, t: 7.5, d: 1.8, v: 0.16, type: 'piano' as const },
          { f: 440.00, t: 7.6, d: 1.2, v: 0.21, type: 'bell' as const }, // A4
          { f: 523.25, t: 8.1, d: 1.2, v: 0.21, type: 'bell' as const }, // C5
          { f: 659.25, t: 8.6, d: 1.4, v: 0.22, type: 'bell' as const }, // E5

          // Bar 4 (G7sus4 -> G7)
          { f: 196.00, t: 9.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 293.66, t: 9.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 349.23, t: 10.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 587.33, t: 9.8, d: 1.3, v: 0.22, type: 'bell' as const }, // D5
          { f: 523.25, t: 10.6, d: 1.0, v: 0.19, type: 'bell' as const }, // C5
          { f: 493.88, t: 11.2, d: 1.6, v: 0.21, type: 'bell' as const }, // B4

          // Bar 5 (Em7)
          { f: 164.81, t: 12.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 246.94, t: 12.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 293.66, t: 13.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 783.99, t: 13.6, d: 1.4, v: 0.22, type: 'bell' as const }, // G5
          { f: 659.25, t: 14.3, d: 1.4, v: 0.20, type: 'bell' as const }, // E5

          // Bar 6 (A7)
          { f: 220.00, t: 15.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 277.18, t: 15.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 329.63, t: 16.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 554.37, t: 16.2, d: 1.2, v: 0.22, type: 'bell' as const }, // C#5
          { f: 587.33, t: 16.8, d: 1.1, v: 0.20, type: 'bell' as const }, // D5
          { f: 659.25, t: 17.4, d: 1.4, v: 0.22, type: 'bell' as const }, // E5

          // Bar 7 (Dm9)
          { f: 146.83, t: 18.0, d: 1.8, v: 0.18, type: 'piano' as const },
          { f: 220.00, t: 18.5, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 261.63, t: 19.0, d: 1.8, v: 0.17, type: 'piano' as const },
          { f: 698.46, t: 19.5, d: 1.2, v: 0.22, type: 'bell' as const }, // F5
          { f: 659.25, t: 20.1, d: 1.1, v: 0.20, type: 'bell' as const }, // E5
          { f: 587.33, t: 20.6, d: 1.3, v: 0.20, type: 'bell' as const }, // D5

          // Bar 8 (G7 -> Cmaj7)
          { f: 392.00, t: 21.2, d: 1.2, v: 0.20, type: 'piano' as const }, // G4
          { f: 493.88, t: 21.8, d: 1.2, v: 0.21, type: 'piano' as const }, // B4
          { f: 523.25, t: 22.4, d: 2.2, v: 0.24, type: 'bell' as const },  // C5
        ];

        melody.forEach((m) => this.playWarmTone(m.f, now + m.t, m.d, m.v, this.bgmGain!, m.type));
        return totalDuration;
      }

      case 'feeding': {
        // C02: Sweet acoustic bedtime waltz (3/4 tempo, 21.6s)
        const totalDuration = 21.6;

        const waltzBass = [
          { f: 87.31, t: 0.0, d: 2.4 },  // F2
          { f: 82.41, t: 2.7, d: 2.4 },  // E2
          { f: 73.42, t: 5.4, d: 2.4 },  // D2
          { f: 65.41, t: 8.1, d: 2.4 },  // C2
          { f: 87.31, t: 10.8, d: 2.4 }, // F2
          { f: 98.00, t: 13.5, d: 2.4 }, // G2
          { f: 110.00, t: 16.2, d: 2.4 },// A2
          { f: 65.41, t: 18.9, d: 2.4 }, // C2
        ];
        waltzBass.forEach((b) => this.playWarmBass(b.f, now + b.t, b.d, 0.25));

        const waltzChords = [
          { f: 349.23, t: 0.9, d: 1.2 }, { f: 440.00, t: 1.8, d: 1.2 },
          { f: 329.63, t: 3.6, d: 1.2 }, { f: 392.00, t: 4.5, d: 1.2 },
          { f: 293.66, t: 6.3, d: 1.2 }, { f: 349.23, t: 7.2, d: 1.2 },
          { f: 261.63, t: 9.0, d: 1.2 }, { f: 329.63, t: 9.9, d: 1.2 },
          { f: 349.23, t: 11.7, d: 1.2 }, { f: 440.00, t: 12.6, d: 1.2 },
          { f: 392.00, t: 14.4, d: 1.2 }, { f: 493.88, t: 15.3, d: 1.2 },
          { f: 440.00, t: 17.1, d: 1.2 }, { f: 523.25, t: 18.0, d: 1.2 },
          { f: 261.63, t: 19.8, d: 1.5 }, { f: 392.00, t: 20.4, d: 1.5 },
        ];
        waltzChords.forEach((c) => this.playWarmTone(c.f, now + c.t, c.d, 0.12, this.bgmGain!, 'piano'));

        const waltzMelody = [
          { f: 523.25, t: 0.0, d: 1.4 }, // C5
          { f: 440.00, t: 1.5, d: 1.0 }, // A4
          { f: 392.00, t: 2.7, d: 1.8 }, // G4
          { f: 349.23, t: 5.4, d: 1.4 }, // F4
          { f: 293.66, t: 6.8, d: 1.1 }, // D4
          { f: 329.63, t: 8.1, d: 2.2 }, // E4
          { f: 440.00, t: 10.8, d: 1.4 },// A4
          { f: 493.88, t: 12.2, d: 1.2 },// B4
          { f: 587.33, t: 13.5, d: 2.0 },// D5
          { f: 523.25, t: 16.2, d: 1.5 },// C5
          { f: 392.00, t: 17.7, d: 1.0 },// G4
          { f: 523.25, t: 18.9, d: 2.5 },// C5
        ];
        waltzMelody.forEach((m) => this.playWarmTone(m.f, now + m.t, m.d, 0.22, this.bgmGain!, 'bell'));

        return totalDuration;
      }

      case 'transform': {
        // C03: Curious, whimsical storybook music box arpeggios (20.0s)
        const totalDuration = 20.0;

        const bassNotes = [
          { f: 73.42, t: 0.0, d: 2.4 },  // D2
          { f: 123.47, t: 2.5, d: 2.4 }, // B2
          { f: 98.00, t: 5.0, d: 2.4 },  // G2
          { f: 110.00, t: 7.5, d: 2.4 }, // A2
          { f: 92.50, t: 10.0, d: 2.4 }, // F#2
          { f: 123.47, t: 12.5, d: 2.4 },// B2
          { f: 82.41, t: 15.0, d: 2.4 }, // E2
          { f: 110.00, t: 17.5, d: 2.4 },// A2
        ];
        bassNotes.forEach((b) => this.playWarmBass(b.f, now + b.t, b.d, 0.25));

        const kalimba = [
          { f: 293.66, t: 0.0, d: 1.2 }, { f: 369.99, t: 0.4, d: 1.2 }, { f: 440.00, t: 0.8, d: 1.2 }, { f: 587.33, t: 1.4, d: 1.4 },
          { f: 246.94, t: 2.5, d: 1.2 }, { f: 293.66, t: 2.9, d: 1.2 }, { f: 369.99, t: 3.3, d: 1.2 }, { f: 493.88, t: 3.9, d: 1.4 },
          { f: 196.00, t: 5.0, d: 1.2 }, { f: 246.94, t: 5.4, d: 1.2 }, { f: 293.66, t: 5.8, d: 1.2 }, { f: 440.00, t: 6.4, d: 1.4 },
          { f: 220.00, t: 7.5, d: 1.2 }, { f: 277.18, t: 7.9, d: 1.2 }, { f: 329.63, t: 8.3, d: 1.2 }, { f: 493.88, t: 8.9, d: 1.4 },
          { f: 185.00, t: 10.0, d: 1.2 }, { f: 220.00, t: 10.4, d: 1.2 }, { f: 293.66, t: 10.8, d: 1.2 }, { f: 440.00, t: 11.4, d: 1.4 },
          { f: 246.94, t: 12.5, d: 1.2 }, { f: 293.66, t: 12.9, d: 1.2 }, { f: 369.99, t: 13.3, d: 1.2 }, { f: 587.33, t: 13.9, d: 1.4 },
          { f: 164.81, t: 15.0, d: 1.2 }, { f: 220.00, t: 15.4, d: 1.2 }, { f: 261.63, t: 15.8, d: 1.2 }, { f: 392.00, t: 16.4, d: 1.4 },
          { f: 220.00, t: 17.5, d: 1.2 }, { f: 293.66, t: 18.0, d: 1.2 }, { f: 440.00, t: 18.5, d: 1.4 }, { f: 587.33, t: 19.0, d: 1.8 },
        ];
        kalimba.forEach((k) => this.playWarmTone(k.f, now + k.t, k.d, 0.17, this.bgmGain!, 'bell'));

        return totalDuration;
      }

      case 'ending': {
        // C04: Tender, cinematic midnight lullaby (28.0s)
        const totalDuration = 28.0;

        const deepBass = [
          { f: 65.41, t: 0.0, d: 3.2 },  // C2
          { f: 61.74, t: 3.5, d: 3.2 },  // B1
          { f: 55.00, t: 7.0, d: 3.2 },  // A1
          { f: 49.00, t: 10.5, d: 3.2 }, // G1
          { f: 43.65, t: 14.0, d: 3.2 }, // F1
          { f: 41.20, t: 17.5, d: 3.2 }, // E1
          { f: 36.71, t: 21.0, d: 3.2 }, // D1
          { f: 49.00, t: 24.5, d: 3.2 }, // G1
        ];
        deepBass.forEach((b) => this.playWarmBass(b.f, now + b.t, b.d, 0.30));

        const stringPads = [
          { freqs: [130.81, 164.81, 196.00, 293.66], t: 0.2, d: 3.4 }, // Cadd9
          { freqs: [123.47, 164.81, 196.00, 246.94], t: 3.7, d: 3.4 }, // G/B
          { freqs: [110.00, 164.81, 220.00, 261.63], t: 7.2, d: 3.4 }, // Am7
          { freqs: [98.00, 164.81, 196.00, 246.94], t: 10.7, d: 3.4 }, // Em/G
          { freqs: [87.31, 130.81, 174.61, 261.63], t: 14.2, d: 3.4 }, // Fmaj7
          { freqs: [82.41, 130.81, 164.81, 196.00], t: 17.7, d: 3.4 }, // C/E
          { freqs: [73.42, 110.00, 146.83, 220.00], t: 21.2, d: 3.4 }, // Dm7
          { freqs: [98.00, 146.83, 196.00, 246.94], t: 24.7, d: 3.2 }, // Gsus4 -> G
        ];
        stringPads.forEach((p) => this.playWarmPad(p.freqs, now + p.t, p.d, 0.06));

        const musicBoxMelody = [
          { f: 523.25, t: 0.0, d: 2.0 },  // C5
          { f: 587.33, t: 1.8, d: 1.4 },  // D5
          { f: 659.25, t: 3.5, d: 2.2 },  // E5
          { f: 493.88, t: 5.2, d: 1.6 },  // B4
          { f: 440.00, t: 7.0, d: 2.5 },  // A4
          { f: 523.25, t: 8.8, d: 1.5 },  // C5
          { f: 392.00, t: 10.5, d: 3.0 }, // G4
          { f: 349.23, t: 14.0, d: 2.0 }, // F4
          { f: 440.00, t: 15.8, d: 1.5 }, // A4
          { f: 523.25, t: 17.5, d: 2.2 }, // C5
          { f: 587.33, t: 19.5, d: 1.4 }, // D5
          { f: 659.25, t: 21.0, d: 1.8 }, // E5
          { f: 587.33, t: 22.8, d: 1.6 }, // D5
          { f: 523.25, t: 24.5, d: 3.2 }, // C5 (Long peaceful chime)
        ];
        musicBoxMelody.forEach((m) => this.playWarmTone(m.f, now + m.t, m.d, 0.24, this.bgmGain!, 'bell'));

        return totalDuration;
      }

      default:
        return 4;
    }
  }

  /**
   * Warm vintage piano / felt bell tone synthesis.
   */
  private playWarmTone(
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    dest: GainNode,
    type: 'piano' | 'bell' | 'sine' = 'piano'
  ): void {
    if (!this.ctx) return;
    try {
      const now = startTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'bell' ? 2200 : 1300, now);
      filter.Q.setValueAtTime(0.7, now);

      osc1.type = type === 'bell' ? 'sine' : 'triangle';
      osc1.frequency.setValueAtTime(freq, now);

      // Subtle second harmonic for warmth and presence
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);

      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.setValueAtTime(type === 'bell' ? 0.35 : 0.22, now);
      osc2.connect(osc2Gain);
      osc2Gain.connect(filter);

      // Organic Envelope
      const attack = type === 'bell' ? 0.02 : 0.04;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.1);
      osc2.stop(now + duration + 0.1);
    } catch (e) {
      // Audio node scheduling guard
    }
  }

  /**
   * Soft, warm acoustic bass tone.
   */
  private playWarmBass(freq: number, startTime: number, duration: number, volume: number): void {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const now = startTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    } catch (e) {
      // Guard
    }
  }

  /**
   * Cozy ambient pad chord swell.
   */
  private playWarmPad(freqs: number[], startTime: number, duration: number, volume: number): void {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const now = startTime;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      filter.connect(gain);
      gain.connect(this.bgmGain);

      freqs.forEach((f) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + duration + 0.1);
      });
    } catch (e) {
      // Guard
    }
  }

  // --- Sound Effects ---
  public playSfx(name: string): void {
    if (!this.sfxEnabled) return;

    if (!this.ctx || !this.isUnlocked || this.ctx.state !== 'running') {
      this.unlock().then(() => {
        this.triggerSfx(name);
      });
      return;
    }

    this.triggerSfx(name);
  }

  private triggerSfx(name: string): void {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;

    try {
      switch (name) {
        case 'pageFlip': {
          // Soft filtered noise sweep like crisp book paper turning
          const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
          }
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(950, now);
          filter.frequency.exponentialRampToValueAtTime(350, now + 0.22);
          filter.Q.setValueAtTime(1.8, now);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.sfxGain);
          noise.start(now);
          break;
        }

        case 'swallow': {
          // Cute swallowing bubble pop: 220Hz -> 420Hz
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

          gain.gain.setValueAtTime(0.42, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.17);
          break;
        }

        case 'boop': {
          // Soft tactile button boop: 340Hz -> 480Hz
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(340, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }

        case 'poke': {
          // Soft tactile squish poke sound
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(170, now);
          osc.frequency.exponentialRampToValueAtTime(105, now + 0.09);

          gain.gain.setValueAtTime(0.36, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.11);
          break;
        }

        case 'chime': {
          // Pristine crystal dual-bell chime (E6: 1318.5Hz + B6: 1975.5Hz)
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(1318.5, now);
          osc2.frequency.setValueAtTime(1975.5, now);

          gain.gain.setValueAtTime(0.38, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.sfxGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.68);
          osc2.stop(now + 0.68);
          break;
        }

        case 'twinkle': {
          // Magical celestial sparkle arpeggio (C6, E6, G6, C7)
          const freqs = [1046.5, 1318.5, 1568.0, 2093.0];
          freqs.forEach((freq, idx) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            const t = now + idx * 0.07;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.24, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(t);
            osc.stop(t + 0.4);
          });
          break;
        }

        case 'clapper': {
          // Vintage wooden movie clapper snapshot
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);

          gain.gain.setValueAtTime(0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case 'stamp': {
          // Heavy ink stamp thud
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

          gain.gain.setValueAtTime(0.55, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.22);
          break;
        }

        default:
          this.playWarmTone(440, now, 0.1, 0.2, this.sfxGain, 'sine');
          break;
      }
    } catch (e) {
      // Guard
    }
  }
}
