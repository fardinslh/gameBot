export interface CrossfadeLoopConfig {
  loopStart: number;
  loopEnd: number;
  crossfadeSeconds: number;
}

export interface CrossfadeLoopStartOptions {
  when?: number;
  offset?: number;
  stopAfterSeconds?: number;
}

interface LoopInstance {
  source: AudioBufferSourceNode;
  fade: GainNode;
  startTime: number;
  endTime: number;
}

const CURVE_SAMPLES = 128;

export const EQUAL_POWER_FADE_IN = createCurve((position) => Math.sin(position * Math.PI / 2));
export const EQUAL_POWER_FADE_OUT = createCurve((position) => Math.cos(position * Math.PI / 2));

export function loopInterval(config: CrossfadeLoopConfig): number {
  return config.loopEnd - config.loopStart - config.crossfadeSeconds;
}

export class CrossfadeLoopPlayer {
  private readonly output: GainNode;
  private readonly instances = new Set<LoopInstance>();
  private lastScheduledStart = 0;
  private stopTime = Number.POSITIVE_INFINITY;
  private started = false;
  private stopped = false;

  constructor(
    private readonly context: AudioContext,
    private readonly buffer: AudioBuffer,
    private readonly config: CrossfadeLoopConfig,
    destination: AudioNode,
  ) {
    const duration = config.loopEnd - config.loopStart;
    if (config.loopStart < 0 || config.loopEnd > buffer.duration || duration <= 0) throw new Error('Invalid music loop points');
    if (config.crossfadeSeconds <= 0 || config.crossfadeSeconds >= duration) throw new Error('Invalid music loop crossfade');
    this.output = context.createGain();
    this.output.connect(destination);
  }

  start(options: CrossfadeLoopStartOptions = {}): void {
    if (this.started) throw new Error('Crossfade loop player already started');
    this.started = true;
    const when = options.when ?? this.context.currentTime;
    const offset = options.offset ?? this.config.loopStart;
    const firstDuration = this.config.loopEnd - offset;
    if (offset < this.config.loopStart || firstDuration <= this.config.crossfadeSeconds) throw new Error('Invalid initial loop offset');
    if (options.stopAfterSeconds !== undefined) this.stopTime = when + options.stopAfterSeconds;

    this.scheduleInstance(when, offset, firstDuration, false);
    const nextStart = when + firstDuration - this.config.crossfadeSeconds;
    this.scheduleInstance(nextStart, this.config.loopStart, this.config.loopEnd - this.config.loopStart, true);
    this.lastScheduledStart = nextStart;
  }

  setOutputGain(value: number, when: number, duration = 0): void {
    const gain = this.output.gain;
    gain.cancelScheduledValues(when);
    gain.setValueAtTime(gain.value, when);
    if (duration > 0) gain.linearRampToValueAtTime(value, when + duration);
    else gain.setValueAtTime(value, when);
  }

  fadeOutAndStop(when: number, duration: number): void {
    if (this.stopped) return;
    this.stopped = true;
    this.setOutputGain(0, when, duration);
    this.stopTime = when + duration;
    for (const instance of this.instances) this.stopSource(instance.source, this.stopTime);
  }

  stop(when = this.context.currentTime): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stopTime = when;
    for (const instance of this.instances) this.stopSource(instance.source, when);
    if (when <= this.context.currentTime) this.output.disconnect();
  }

  get instanceCount(): number { return this.instances.size; }

  private scheduleInstance(startTime: number, offset: number, duration: number, fadeIn: boolean): void {
    if (this.stopped || startTime >= this.stopTime) return;
    const source = this.context.createBufferSource();
    const fade = this.context.createGain();
    const endTime = Math.min(startTime + duration, this.stopTime);
    source.buffer = this.buffer;
    source.loop = false;
    source.connect(fade);
    fade.connect(this.output);

    if (fadeIn) {
      fade.gain.setValueAtTime(0, startTime);
      fade.gain.setValueCurveAtTime(EQUAL_POWER_FADE_IN, startTime, this.config.crossfadeSeconds);
      fade.gain.setValueAtTime(1, startTime + this.config.crossfadeSeconds);
    } else {
      fade.gain.setValueAtTime(1, startTime);
    }

    const fadeOutStart = startTime + duration - this.config.crossfadeSeconds;
    if (fadeOutStart < this.stopTime) {
      fade.gain.setValueAtTime(1, fadeOutStart);
      fade.gain.setValueCurveAtTime(EQUAL_POWER_FADE_OUT, fadeOutStart, this.config.crossfadeSeconds);
      fade.gain.setValueAtTime(0, fadeOutStart + this.config.crossfadeSeconds);
    }

    const instance: LoopInstance = { source, fade, startTime, endTime };
    this.instances.add(instance);
    source.onended = () => this.handleEnded(instance);
    source.start(startTime, offset, endTime - startTime);
    this.stopSource(source, endTime);
  }

  private handleEnded(instance: LoopInstance): void {
    if (!this.instances.delete(instance)) return;
    instance.source.disconnect();
    instance.fade.disconnect();
    if (this.stopped) {
      if (this.instances.size === 0) this.output.disconnect();
      return;
    }

    const nextStart = this.lastScheduledStart + loopInterval(this.config);
    if (nextStart < this.stopTime) {
      this.scheduleInstance(nextStart, this.config.loopStart, this.config.loopEnd - this.config.loopStart, true);
      this.lastScheduledStart = nextStart;
    } else if (this.instances.size === 0) {
      this.stopped = true;
      this.output.disconnect();
    }
  }

  private stopSource(source: AudioBufferSourceNode, when: number): void {
    try { source.stop(when); } catch { /* source already stopped */ }
  }
}

function createCurve(sample: (position: number) => number): Float32Array {
  return Float32Array.from({ length: CURVE_SAMPLES }, (_, index) => sample(index / (CURVE_SAMPLES - 1)));
}
