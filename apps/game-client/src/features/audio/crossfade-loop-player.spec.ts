import { describe, expect, it, vi } from 'vitest';
import { CrossfadeLoopPlayer, EQUAL_POWER_FADE_IN, EQUAL_POWER_FADE_OUT, loopInterval } from './crossfade-loop-player';

interface FakeSource {
  buffer: AudioBuffer | null;
  loop: boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

function gainParam() {
  const param = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn((value: number) => { param.value = value; }),
    linearRampToValueAtTime: vi.fn(),
    setValueCurveAtTime: vi.fn(),
  };
  return param;
}

function harness() {
  const sources: FakeSource[] = [];
  const gains: Array<{ gain: ReturnType<typeof gainParam>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime: 10,
    createBufferSource: vi.fn(() => {
      const source: FakeSource = { buffer: null, loop: false, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
      sources.push(source);
      return source;
    }),
    createGain: vi.fn(() => {
      const node = { gain: gainParam(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    }),
  };
  const config = { loopStart: 0, loopEnd: 50, crossfadeSeconds: 4 };
  const player = new CrossfadeLoopPlayer(context as unknown as AudioContext, { duration: 50 } as AudioBuffer, config, {} as AudioNode);
  return { gains, player, sources };
}

describe('CrossfadeLoopPlayer timing', () => {
  it('calculates effective interval from loop duration minus overlap', () => {
    expect(loopInterval({ loopStart: 0, loopEnd: 50, crossfadeSeconds: 4 })).toBe(46);
  });

  it('starts first instance once and schedules next before its end', () => {
    const h = harness(); h.player.start({ when: 10 });
    expect(h.sources).toHaveLength(2);
    expect(h.sources[0].start).toHaveBeenCalledWith(10, 0, 50);
    expect(h.sources[1].start).toHaveBeenCalledWith(56, 0, 50);
    expect(h.sources.every((source) => source.loop === false)).toBe(true);
  });

  it('creates exact four-second overlap and stops previous source at loop end', () => {
    const h = harness(); h.player.start({ when: 10 });
    expect(h.sources[0].stop).toHaveBeenCalledWith(60);
    expect(60 - h.sources[1].start.mock.calls[0][0]).toBe(4);
  });

  it('uses complementary 128-sample equal-power curves', () => {
    const h = harness(); h.player.start({ when: 10 });
    expect(EQUAL_POWER_FADE_IN).toHaveLength(128);
    expect(EQUAL_POWER_FADE_OUT).toHaveLength(128);
    expect(EQUAL_POWER_FADE_IN[0]).toBeCloseTo(0);
    expect(EQUAL_POWER_FADE_IN.at(-1)).toBeCloseTo(1);
    expect(EQUAL_POWER_FADE_OUT[0]).toBeCloseTo(1);
    expect(EQUAL_POWER_FADE_OUT.at(-1)).toBeCloseTo(0);
    expect(h.gains[1].gain.setValueCurveAtTime).toHaveBeenCalledWith(EQUAL_POWER_FADE_OUT, 56, 4);
    expect(h.gains[2].gain.setValueCurveAtTime).toHaveBeenCalledWith(EQUAL_POWER_FADE_IN, 56, 4);
  });

  it('schedules third loop from audio-clock math after first ends', () => {
    const h = harness(); h.player.start({ when: 10 }); h.sources[0].onended?.();
    expect(h.sources).toHaveLength(3);
    expect(h.sources[2].start).toHaveBeenCalledWith(102, 0, 50);
    expect(h.player.instanceCount).toBe(2);
  });

  it('keeps two tracked instances while expired nodes disconnect', () => {
    const h = harness(); h.player.start({ when: 10 }); h.sources[0].onended?.(); h.sources[1].onended?.();
    expect(h.sources).toHaveLength(4);
    expect(h.player.instanceCount).toBe(2);
    expect(h.sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(h.sources[1].disconnect).toHaveBeenCalledTimes(1);
  });

  it('uses same scheduler for short boundary preview offset', () => {
    const h = harness(); h.player.start({ when: 10, offset: 42, stopAfterSeconds: 16 });
    expect(h.sources[0].start).toHaveBeenCalledWith(10, 42, 8);
    expect(h.sources[1].start).toHaveBeenCalledWith(14, 0, 12);
    expect(h.sources[0].stop).toHaveBeenCalledWith(18);
    expect(h.sources[1].stop).toHaveBeenCalledWith(26);
  });

  it('destroy-style stop cancels every current and future source', () => {
    const h = harness(); h.player.start({ when: 10 }); h.player.stop(12);
    expect(h.sources.every((source) => source.stop.mock.calls.some(([time]) => time === 12))).toBe(true);
    h.sources[0].onended?.();
    expect(h.sources).toHaveLength(2);
  });
});
