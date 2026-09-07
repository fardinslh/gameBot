/**
 * AmbientSoundtrack - Procedural atmospheric soundscape generator for kingdom tranquility.
 * Synthesizes gentle breezes, distant forest birds, and hearth warmth using Web Audio API nodes.
 * Requires 0 external asset downloads, zero network latency, and low CPU footprint.
 */

export interface AmbientAudioOptions {
  volume?: number;
  enabled?: boolean;
}

export class AmbientSoundtrack {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private birdTimerId: ReturnType<typeof setTimeout> | null = null;
  private isPlaying = false;
  private enabled = true;
  private volume = 0.35;

  constructor(options?: AmbientAudioOptions) {
    if (options?.volume !== undefined) this.volume = options.volume;
    if (options?.enabled !== undefined) this.enabled = options.enabled;
  }

  public setAudioContext(ctx: AudioContext): void {
    if (this.ctx === ctx) return;
    this.stop();
    this.ctx = ctx;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.15, this.ctx.currentTime, 0.1);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    } else if (!this.isPlaying) {
      this.start();
    }
  }

  public start(): void {
    if (!this.enabled || this.isPlaying || !this.ctx) return;

    try {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      this.isPlaying = true;
      this.setupAudioGraph();
      this.startWindBreeze();
      this.scheduleNextBirdChirp();
    } catch {
      // Audio autoplay policy or context error
    }
  }

  public stop(): void {
    this.isPlaying = false;

    if (this.birdTimerId !== null) {
      clearTimeout(this.birdTimerId);
      this.birdTimerId = null;
    }

    if (this.windSource) {
      try {
        this.windSource.stop();
        this.windSource.disconnect();
      } catch {}
      this.windSource = null;
    }

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }
  }

  private setupAudioGraph(): void {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume * 0.15, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Wind filter (gentle lowpass for breeze effect)
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
  }

  private startWindBreeze(): void {
    if (!this.ctx || !this.windFilter) return;

    try {
      // Generate 4 seconds of looping pinkish noise buffer
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 4;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.15;
      }

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;
      this.windSource.connect(this.windFilter);
      this.windSource.start(0);
    } catch {}
  }

  private scheduleNextBirdChirp(): void {
    if (!this.isPlaying || !this.enabled) return;

    // Random interval between 6 and 14 seconds
    const delay = 6_000 + Math.random() * 8_000;
    this.birdTimerId = setTimeout(() => {
      this.playProceduralBirdChirp();
      this.scheduleNextBirdChirp();
    }, delay);
  }

  private playProceduralBirdChirp(): void {
    if (!this.ctx || !this.masterGain || !this.enabled || !this.isPlaying) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Pleasant high sweet bird chirp (2.8kHz to 3.6kHz)
      const baseFreq = 2600 + Math.random() * 800;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 700, now + 0.07);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 200, now + 0.14);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }
}
