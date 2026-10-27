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
    // Lazy initialize on first interaction
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

  public async unlock(): Promise<boolean> {
    if (this.isUnlocked && this.ctx) return true;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmEnabled ? 0.4 : 0, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? 0.6 : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.isUnlocked = true;
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
      this.bgmGain.gain.setTargetAtTime(bgm ? 0.4 : 0, t, 0.1);
      this.sfxGain.gain.setTargetAtTime(sfx ? 0.6 : 0, t, 0.1);
    }
  }

  // --- BGM Synthesis ---
  public playTrack(track: AudioTrack): void {
    if (this.currentTrack === track) return;
    this.stopTrack();
    this.currentTrack = track;
    if (track === 'none' || !this.ctx || !this.isUnlocked) return;

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

    const barDuration = this.scheduleTrackBar(track);
    this.loopTimer = window.setTimeout(() => {
      this.startTrackLoop(track);
    }, (barDuration - 0.2) * 1000);
  }

  private scheduleTrackBar(track: AudioTrack): number {
    if (!this.ctx || !this.bgmGain) return 4;
    const now = this.ctx.currentTime;

    switch (track) {
      case 'cover': {
        // Melancholy, warm retro piano / music box (F major 7 / D minor 9)
        const notes = [
          { f: 261.63, t: 0.0, d: 2.5 }, // C4
          { f: 349.23, t: 0.8, d: 2.0 }, // F4
          { f: 392.00, t: 1.6, d: 1.8 }, // G4
          { f: 440.00, t: 2.4, d: 2.2 }, // A4
          { f: 329.63, t: 3.2, d: 2.0 }, // E4
          { f: 293.66, t: 4.2, d: 2.8 }, // D4
        ];
        notes.forEach((n) => this.playWarmTone(n.f, now + n.t, n.d, 0.22, this.bgmGain!));
        return 6.0;
      }
      case 'feeding': {
        // Soft acoustic swing / gentle clarinet style
        const notes = [
          { f: 220.00, t: 0.0, d: 1.2 }, // A3
          { f: 277.18, t: 0.5, d: 0.9 }, // C#4
          { f: 329.63, t: 1.0, d: 1.2 }, // E4
          { f: 440.00, t: 1.5, d: 1.0 }, // A4
          { f: 415.30, t: 2.0, d: 1.2 }, // G#4
          { f: 329.63, t: 2.6, d: 1.0 }, // E4
          { f: 293.66, t: 3.2, d: 1.5 }, // D4
        ];
        notes.forEach((n) => this.playWarmTone(n.f, now + n.t, n.d, 0.18, this.bgmGain!, 'triangle'));
        return 4.5;
      }
      case 'rain': {
        // Light bouncing waltz
        const notes = [
          { f: 392.00, t: 0.0, d: 0.6 },
          { f: 440.00, t: 0.4, d: 0.6 },
          { f: 523.25, t: 0.8, d: 0.8 },
          { f: 440.00, t: 1.2, d: 0.6 },
          { f: 392.00, t: 1.6, d: 0.6 },
          { f: 329.63, t: 2.0, d: 1.2 },
        ];
        notes.forEach((n) => this.playWarmTone(n.f, now + n.t, n.d, 0.16, this.bgmGain!, 'sine'));
        return 3.0;
      }
      case 'transform': {
        // Curious music box arpeggios
        const notes = [
          { f: 440.00, t: 0.0, d: 0.8 },
          { f: 554.37, t: 0.3, d: 0.8 },
          { f: 659.25, t: 0.6, d: 0.8 },
          { f: 880.00, t: 0.9, d: 1.2 },
          { f: 783.99, t: 1.5, d: 1.0 },
          { f: 659.25, t: 2.1, d: 1.5 },
        ];
        notes.forEach((n) => this.playWarmTone(n.f, now + n.t, n.d, 0.20, this.bgmGain!, 'sine'));
        return 3.8;
      }
      case 'ending': {
        // Warm tender quiet chords
        const chords = [
          { freq: [261.63, 329.63, 392.00, 493.88], t: 0.0, d: 3.5 }, // Cmaj7
          { freq: [220.00, 261.63, 329.63, 392.00], t: 3.5, d: 3.5 }, // Am7
          { freq: [174.61, 220.00, 261.63, 349.23], t: 7.0, d: 3.5 }, // Fmaj7
          { freq: [196.00, 246.94, 293.66, 392.00], t: 10.5, d: 3.5 }, // G7
        ];
        chords.forEach((c) => {
          c.freq.forEach((f) => {
            this.playWarmTone(f, now + c.t, c.d, 0.12, this.bgmGain!, 'sine');
          });
        });
        return 14.0;
      }
      default:
        return 4;
    }
  }

  private playWarmTone(
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    dest: GainNode,
    type: OscillatorType = 'sine'
  ): void {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, startTime);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    } catch (e) {
      // Audio node scheduling guard
    }
  }

  // --- Sound Effects ---
  public playSfx(name: string): void {
    if (!this.ctx || !this.sfxGain || !this.isUnlocked || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;

    try {
      switch (name) {
        case 'pageFlip': {
          // Soft filtered noise sweep like paper turning
          const bufferSize = this.ctx.sampleRate * 0.25;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
          }
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.exponentialRampToValueAtTime(400, now + 0.25);
          filter.Q.setValueAtTime(2.0, now);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.sfxGain);
          noise.start(now);
          break;
        }

        case 'swallow':
        case 'boop': {
          // Cute swallowing boop: 240Hz -> 380Hz
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.16);
          break;
        }

        case 'poke': {
          // Soft tactile poke sound
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'burp': {
          // Tiny comic burp: low bouncy wobble
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.linearRampToValueAtTime(85, now + 0.2);

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(320, now);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.24);
          break;
        }

        case 'catch':
        case 'chime': {
          // Bell chime
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(880, now);
          osc2.frequency.setValueAtTime(1320, now);

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.sfxGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.46);
          osc2.stop(now + 0.46);
          break;
        }

        case 'stamp': {
          // Heavy ink stamp thud
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

          gain.gain.setValueAtTime(0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.21);
          break;
        }

        case 'twinkle': {
          // Magical stars
          [784, 988, 1175, 1568].forEach((freq, idx) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            const t = now + idx * 0.08;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(t);
            osc.stop(t + 0.32);
          });
          break;
        }

        case 'clapper': {
          // Movie clapper wood clap
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        default:
          this.playWarmTone(440, now, 0.1, 0.2, this.sfxGain);
          break;
      }
    } catch (e) {
      // Audio error guard
    }
  }
}
