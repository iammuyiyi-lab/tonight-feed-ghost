export type AudioTrack = 'cover' | 'feeding' | 'rain' | 'transform' | 'ending' | 'none';

interface MusicBoxNote {
  f: number; // frequency in Hz
  t: number; // start time offset in seconds
  d?: number; // duration in seconds
  v?: number; // volume
}

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
   * Unlock Web Audio API on user gesture.
   */
  public async unlock(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.70, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.bgmEnabled ? 0.28 : 0, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? 0.60 : 0, this.ctx.currentTime);
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
      this.bgmGain.gain.setTargetAtTime(bgm ? 0.28 : 0, t, 0.1);
      this.sfxGain.gain.setTargetAtTime(sfx ? 0.60 : 0, t, 0.1);
    }
  }

  // --- BGM Synthesis ---
  public playTrack(track: AudioTrack): void {
    if (this.currentTrack === track && this.loopTimer !== null) return;
    this.stopTrack();
    this.currentTrack = track;
    if (track === 'none') return;

    if (!this.ctx || !this.isUnlocked || this.ctx.state !== 'running') {
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
   * Pure, gentle, warm Music Box / Celesta lullabies.
   * Completely clean sine waves with delicate acoustic strike and natural exponential decay.
   * Zero distortion, zero harshness, zero dissonant drone.
   */
  private scheduleTrackCycle(track: AudioTrack): number {
    if (!this.ctx || !this.bgmGain) return 6;
    const now = this.ctx.currentTime;

    switch (track) {
      case 'cover': {
        // C01 & Title: Gentle Music Box Lullaby (G Major, 32.0s loop)
        const totalDuration = 32.0;

        const notes: MusicBoxNote[] = [
          // Bar 1 (G)
          { f: 196.00, t: 0.0, d: 2.2, v: 0.14 }, // G3
          { f: 392.00, t: 0.0, d: 2.2, v: 0.20 }, // G4
          { f: 293.66, t: 0.5, d: 1.6, v: 0.12 }, // D4
          { f: 493.88, t: 1.0, d: 1.6, v: 0.13 }, // B4
          { f: 392.00, t: 1.5, d: 1.4, v: 0.16 }, // G4

          // Bar 2 (D/F#)
          { f: 293.66, t: 2.0, d: 2.0, v: 0.14 }, // D4
          { f: 587.33, t: 2.0, d: 2.0, v: 0.21 }, // D5
          { f: 369.99, t: 2.5, d: 1.6, v: 0.12 }, // F#4
          { f: 440.00, t: 3.0, d: 1.6, v: 0.12 }, // A4
          { f: 523.25, t: 3.2, d: 1.2, v: 0.16 }, // C5
          { f: 493.88, t: 3.6, d: 1.2, v: 0.16 }, // B4

          // Bar 3 (Em)
          { f: 164.81, t: 4.0, d: 2.2, v: 0.14 }, // E3
          { f: 493.88, t: 4.0, d: 2.0, v: 0.20 }, // B4
          { f: 246.94, t: 4.5, d: 1.6, v: 0.12 }, // B3
          { f: 329.63, t: 5.0, d: 1.6, v: 0.13 }, // E4
          { f: 392.00, t: 5.2, d: 1.4, v: 0.18 }, // G4
          { f: 329.63, t: 5.6, d: 1.4, v: 0.16 }, // E4

          // Bar 4 (Bm)
          { f: 246.94, t: 6.0, d: 2.0, v: 0.14 }, // B3
          { f: 369.99, t: 6.0, d: 1.8, v: 0.18 }, // F#4
          { f: 293.66, t: 6.5, d: 1.6, v: 0.12 }, // D4
          { f: 369.99, t: 7.0, d: 1.6, v: 0.12 }, // F#4
          { f: 440.00, t: 7.0, d: 1.8, v: 0.18 }, // A4

          // Bar 5 (C)
          { f: 261.63, t: 8.0, d: 2.2, v: 0.14 }, // C4
          { f: 659.25, t: 8.0, d: 2.0, v: 0.21 }, // E5
          { f: 329.63, t: 8.5, d: 1.6, v: 0.12 }, // E4
          { f: 392.00, t: 9.0, d: 1.6, v: 0.12 }, // G4
          { f: 587.33, t: 9.2, d: 1.3, v: 0.18 }, // D5
          { f: 523.25, t: 9.6, d: 1.3, v: 0.18 }, // C5

          // Bar 6 (G/B)
          { f: 246.94, t: 10.0, d: 2.0, v: 0.14 }, // B3
          { f: 587.33, t: 10.0, d: 2.0, v: 0.20 }, // D5
          { f: 293.66, t: 10.5, d: 1.6, v: 0.12 }, // D4
          { f: 392.00, t: 11.0, d: 1.6, v: 0.12 }, // G4
          { f: 493.88, t: 11.0, d: 1.6, v: 0.18 }, // B4

          // Bar 7 (Am7)
          { f: 220.00, t: 12.0, d: 2.2, v: 0.14 }, // A3
          { f: 523.25, t: 12.0, d: 2.0, v: 0.20 }, // C5
          { f: 261.63, t: 12.5, d: 1.6, v: 0.12 }, // C4
          { f: 329.63, t: 13.0, d: 1.6, v: 0.12 }, // E4
          { f: 493.88, t: 13.0, d: 1.3, v: 0.17 }, // B4
          { f: 440.00, t: 13.5, d: 1.4, v: 0.18 }, // A4

          // Bar 8 (D7)
          { f: 293.66, t: 14.0, d: 2.0, v: 0.14 }, // D4
          { f: 440.00, t: 14.0, d: 1.8, v: 0.19 }, // A4
          { f: 369.99, t: 14.5, d: 1.6, v: 0.12 }, // F#4
          { f: 440.00, t: 15.0, d: 1.6, v: 0.12 }, // A4
          { f: 493.88, t: 15.0, d: 1.6, v: 0.19 }, // B4

          // Bar 9 (C - Melodic peak)
          { f: 261.63, t: 16.0, d: 2.2, v: 0.14 }, // C4
          { f: 783.99, t: 16.0, d: 2.2, v: 0.22 }, // G5
          { f: 329.63, t: 16.5, d: 1.6, v: 0.12 }, // E4
          { f: 392.00, t: 17.0, d: 1.6, v: 0.12 }, // G4
          { f: 659.25, t: 17.2, d: 1.6, v: 0.19 }, // E5

          // Bar 10 (D)
          { f: 293.66, t: 18.0, d: 2.0, v: 0.14 }, // D4
          { f: 739.99, t: 18.0, d: 2.0, v: 0.21 }, // F#5
          { f: 369.99, t: 18.5, d: 1.6, v: 0.12 }, // F#4
          { f: 440.00, t: 19.0, d: 1.6, v: 0.12 }, // A4
          { f: 587.33, t: 19.2, d: 1.6, v: 0.18 }, // D5

          // Bar 11 (Em)
          { f: 164.81, t: 20.0, d: 2.2, v: 0.14 }, // E3
          { f: 659.25, t: 20.0, d: 2.0, v: 0.20 }, // E5
          { f: 246.94, t: 20.5, d: 1.6, v: 0.12 }, // B3
          { f: 329.63, t: 21.0, d: 1.6, v: 0.12 }, // E4
          { f: 493.88, t: 21.2, d: 1.6, v: 0.18 }, // B4

          // Bar 12 (Bm)
          { f: 246.94, t: 22.0, d: 2.0, v: 0.14 }, // B3
          { f: 587.33, t: 22.0, d: 2.0, v: 0.19 }, // D5
          { f: 293.66, t: 22.5, d: 1.6, v: 0.12 }, // D4
          { f: 440.00, t: 23.0, d: 1.6, v: 0.18 }, // A4

          // Bar 13 (C)
          { f: 261.63, t: 24.0, d: 2.2, v: 0.14 }, // C4
          { f: 659.25, t: 24.0, d: 1.8, v: 0.20 }, // E5
          { f: 329.63, t: 24.5, d: 1.6, v: 0.12 }, // E4
          { f: 587.33, t: 25.0, d: 1.3, v: 0.18 }, // D5
          { f: 523.25, t: 25.5, d: 1.3, v: 0.18 }, // C5

          // Bar 14 (D7)
          { f: 293.66, t: 26.0, d: 2.0, v: 0.14 }, // D4
          { f: 493.88, t: 26.0, d: 1.8, v: 0.19 }, // B4
          { f: 369.99, t: 26.5, d: 1.6, v: 0.12 }, // F#4
          { f: 440.00, t: 27.0, d: 1.8, v: 0.18 }, // A4

          // Bar 15 (G)
          { f: 196.00, t: 28.0, d: 2.2, v: 0.14 }, // G3
          { f: 392.00, t: 28.0, d: 1.8, v: 0.19 }, // G4
          { f: 293.66, t: 28.5, d: 1.6, v: 0.12 }, // D4
          { f: 493.88, t: 29.0, d: 1.6, v: 0.13 }, // B4
          { f: 587.33, t: 29.2, d: 2.0, v: 0.21 }, // D5

          // Bar 16 (G - Sweet lingering chime)
          { f: 783.99, t: 30.0, d: 2.8, v: 0.22 }, // G5 (Gentle chime lingering into silence)
        ];

        notes.forEach((n) => this.playMusicBoxNote(n.f, now + n.t, n.d ?? 1.8, n.v ?? 0.18));
        return totalDuration;
      }

      case 'feeding': {
        // C02: Soft, warm 3-beat sweet milk lullaby in C Major (24.0s)
        const totalDuration = 24.0;

        const notes: MusicBoxNote[] = [
          // Phrase 1 (C -> G/B -> Am7 -> Em)
          { f: 261.63, t: 0.0, d: 2.0, v: 0.15 }, { f: 523.25, t: 0.0, d: 2.2, v: 0.20 },
          { f: 329.63, t: 0.7, d: 1.4, v: 0.12 }, { f: 392.00, t: 1.4, d: 1.4, v: 0.12 },
          { f: 246.94, t: 2.2, d: 2.0, v: 0.14 }, { f: 493.88, t: 2.2, d: 2.0, v: 0.19 },
          { f: 293.66, t: 2.9, d: 1.4, v: 0.12 }, { f: 392.00, t: 3.6, d: 1.4, v: 0.12 },
          { f: 220.00, t: 4.4, d: 2.0, v: 0.14 }, { f: 440.00, t: 4.4, d: 2.0, v: 0.19 },
          { f: 261.63, t: 5.1, d: 1.4, v: 0.12 }, { f: 329.63, t: 5.8, d: 1.4, v: 0.12 },
          { f: 164.81, t: 6.6, d: 2.0, v: 0.14 }, { f: 392.00, t: 6.6, d: 2.0, v: 0.18 },
          { f: 246.94, t: 7.3, d: 1.4, v: 0.12 }, { f: 329.63, t: 8.0, d: 1.4, v: 0.12 },

          // Phrase 2 (F -> C/E -> Dm7 -> G7)
          { f: 174.61, t: 8.8, d: 2.0, v: 0.14 }, { f: 349.23, t: 8.8, d: 1.8, v: 0.18 },
          { f: 261.63, t: 9.5, d: 1.4, v: 0.12 }, { f: 440.00, t: 10.2, d: 1.5, v: 0.18 },
          { f: 164.81, t: 11.0, d: 2.0, v: 0.14 }, { f: 329.63, t: 11.0, d: 1.8, v: 0.18 },
          { f: 261.63, t: 11.7, d: 1.4, v: 0.12 }, { f: 392.00, t: 12.4, d: 1.5, v: 0.18 },
          { f: 146.83, t: 13.2, d: 2.0, v: 0.14 }, { f: 293.66, t: 13.2, d: 1.8, v: 0.18 },
          { f: 220.00, t: 13.9, d: 1.4, v: 0.12 }, { f: 349.23, t: 14.6, d: 1.5, v: 0.18 },
          { f: 196.00, t: 15.4, d: 2.0, v: 0.14 }, { f: 392.00, t: 15.4, d: 2.0, v: 0.19 },
          { f: 246.94, t: 16.1, d: 1.4, v: 0.12 }, { f: 293.66, t: 16.8, d: 1.4, v: 0.12 },

          // Phrase 3 (Sweet resolution to high C chime)
          { f: 261.63, t: 17.6, d: 2.0, v: 0.15 }, { f: 523.25, t: 17.6, d: 2.0, v: 0.20 },
          { f: 329.63, t: 18.3, d: 1.4, v: 0.12 }, { f: 659.25, t: 19.0, d: 2.0, v: 0.21 },
          { f: 196.00, t: 19.8, d: 2.0, v: 0.14 }, { f: 587.33, t: 19.8, d: 2.0, v: 0.20 },
          { f: 246.94, t: 20.5, d: 1.4, v: 0.12 }, { f: 493.88, t: 21.2, d: 1.8, v: 0.19 },
          { f: 261.63, t: 22.0, d: 2.5, v: 0.16 }, { f: 523.25, t: 22.0, d: 2.8, v: 0.22 },
        ];

        notes.forEach((n) => this.playMusicBoxNote(n.f, now + n.t, n.d ?? 1.8, n.v ?? 0.18));
        return totalDuration;
      }

      case 'transform': {
        // C03: Dreamy, sparkling celestial music box (G Major, 24.0s)
        const totalDuration = 24.0;

        const notes: MusicBoxNote[] = [
          { f: 392.00, t: 0.0, d: 1.8, v: 0.18 }, // G4
          { f: 493.88, t: 0.6, d: 1.6, v: 0.17 }, // B4
          { f: 587.33, t: 1.2, d: 2.0, v: 0.20 }, // D5
          { f: 659.25, t: 2.0, d: 1.8, v: 0.20 }, // E5
          { f: 587.33, t: 2.8, d: 1.6, v: 0.18 }, // D5
          { f: 493.88, t: 3.4, d: 1.6, v: 0.17 }, // B4

          { f: 440.00, t: 4.2, d: 1.8, v: 0.18 }, // A4
          { f: 523.25, t: 4.8, d: 1.6, v: 0.17 }, // C5
          { f: 659.25, t: 5.4, d: 2.0, v: 0.20 }, // E5
          { f: 587.33, t: 6.2, d: 1.8, v: 0.18 }, // D5
          { f: 440.00, t: 7.0, d: 1.6, v: 0.17 }, // A4

          { f: 392.00, t: 8.0, d: 1.8, v: 0.18 }, // G4
          { f: 493.88, t: 8.6, d: 1.6, v: 0.17 }, // B4
          { f: 783.99, t: 9.2, d: 2.2, v: 0.22 }, // G5 (Starlight spark)
          { f: 659.25, t: 10.2, d: 1.8, v: 0.19 },// E5
          { f: 587.33, t: 11.0, d: 1.8, v: 0.18 },// D5

          { f: 523.25, t: 12.0, d: 1.8, v: 0.18 },// C5
          { f: 493.88, t: 12.8, d: 1.6, v: 0.17 },// B4
          { f: 440.00, t: 13.6, d: 1.8, v: 0.18 },// A4
          { f: 392.00, t: 14.6, d: 2.2, v: 0.20 },// G4

          { f: 587.33, t: 16.0, d: 1.8, v: 0.18 },// D5
          { f: 659.25, t: 16.8, d: 1.8, v: 0.19 },// E5
          { f: 783.99, t: 17.6, d: 2.2, v: 0.22 },// G5
          { f: 880.00, t: 18.6, d: 1.8, v: 0.20 },// A5
          { f: 783.99, t: 19.4, d: 2.0, v: 0.20 },// G5
          { f: 587.33, t: 20.2, d: 1.8, v: 0.18 },// D5

          { f: 493.88, t: 21.2, d: 2.0, v: 0.18 },// B4
          { f: 392.00, t: 22.2, d: 2.6, v: 0.22 },// G4
        ];

        notes.forEach((n) => this.playMusicBoxNote(n.f, now + n.t, n.d ?? 1.8, n.v ?? 0.18));
        return totalDuration;
      }

      case 'ending': {
        // C04: Tender, heartwarming midnight lullaby (G Major, 28.0s)
        const totalDuration = 28.0;

        const notes: MusicBoxNote[] = [
          // Slow, peaceful, reverberant bedtime bells
          { f: 392.00, t: 0.0, d: 2.6, v: 0.20 },  // G4
          { f: 196.00, t: 0.0, d: 2.6, v: 0.14 },  // G3
          { f: 493.88, t: 1.6, d: 2.2, v: 0.19 },  // B4
          { f: 587.33, t: 3.2, d: 2.8, v: 0.22 },  // D5
          { f: 293.66, t: 3.2, d: 2.8, v: 0.13 },  // D4

          { f: 659.25, t: 5.6, d: 2.4, v: 0.21 },  // E5
          { f: 587.33, t: 7.2, d: 2.0, v: 0.19 },  // D5
          { f: 493.88, t: 8.8, d: 2.6, v: 0.20 },  // B4
          { f: 246.94, t: 8.8, d: 2.6, v: 0.13 },  // B3

          { f: 440.00, t: 11.2, d: 2.4, v: 0.19 }, // A4
          { f: 523.25, t: 12.8, d: 2.2, v: 0.19 }, // C5
          { f: 659.25, t: 14.4, d: 2.6, v: 0.22 }, // E5
          { f: 261.63, t: 14.4, d: 2.6, v: 0.14 }, // C4

          { f: 587.33, t: 16.8, d: 2.4, v: 0.20 }, // D5
          { f: 493.88, t: 18.4, d: 2.2, v: 0.18 }, // B4
          { f: 440.00, t: 20.0, d: 2.6, v: 0.19 }, // A4
          { f: 293.66, t: 20.0, d: 2.6, v: 0.13 }, // D4

          { f: 392.00, t: 22.4, d: 2.6, v: 0.20 }, // G4
          { f: 587.33, t: 24.0, d: 2.6, v: 0.21 }, // D5
          { f: 783.99, t: 25.6, d: 3.5, v: 0.23 }, // G5 (Distant peaceful chime lingering...)
        ];

        notes.forEach((n) => this.playMusicBoxNote(n.f, now + n.t, n.d ?? 2.0, n.v ?? 0.18));
        return totalDuration;
      }

      default:
        return 4;
    }
  }

  /**
   * Pure, delicate, warm sound synthesis for physical touch and sweet bells.
   */
  private playMusicBoxNote(
    freq: number,
    startTime: number,
    duration: number = 1.8,
    volume: number = 0.18
  ): void {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const now = startTime;
      const osc1 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Soft warm low-pass filter: rounds off any digital hardness
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.Q.setValueAtTime(0.5, now);

      // Pure fundamental sine wave
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Delicate mechanical tine ping: tiny harmonic 2x, very quiet, decays in 0.08s
      const osc2 = this.ctx.createOscillator();
      const osc2Gain = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);
      osc2Gain.gain.setValueAtTime(0.0001, now);
      osc2Gain.gain.linearRampToValueAtTime(volume * 0.16, now + 0.004);
      osc2Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      // Main note envelope: soft attack (0.006s) -> natural lingering exponential decay
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(gain);
      gain.connect(filter);

      osc2.connect(osc2Gain);
      osc2Gain.connect(filter);

      filter.connect(this.bgmGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.stop(now + duration + 0.05);
    } catch (e) {
      // Audio node scheduling guard
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
          const bufferSize = Math.floor(this.ctx.sampleRate * 0.20);
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
          filter.frequency.exponentialRampToValueAtTime(350, now + 0.20);
          filter.Q.setValueAtTime(1.6, now);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.20);

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

          gain.gain.setValueAtTime(0.38, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.16);
          break;
        }

        case 'boop': {
          // Soft tactile button boop: 340Hz -> 480Hz
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(340, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

          gain.gain.setValueAtTime(0.30, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.11);
          break;
        }

        case 'poke': {
          // Soft tactile squish poke sound
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(170, now);
          osc.frequency.exponentialRampToValueAtTime(105, now + 0.09);

          gain.gain.setValueAtTime(0.32, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

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

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.60);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.sfxGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.62);
          osc2.stop(now + 0.62);
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
            gain.gain.setValueAtTime(0.20, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(t);
            osc.stop(t + 0.36);
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

          gain.gain.setValueAtTime(0.45, now);
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

          gain.gain.setValueAtTime(0.48, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.22);
          break;
        }

        default:
          this.playMusicBoxNote(440, now, 0.15, 0.20);
          break;
      }
    } catch (e) {
      // Guard
    }
  }
}
