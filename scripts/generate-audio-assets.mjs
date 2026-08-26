import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps', 'game-client', 'public', 'assets', 'audio');
const musicDir = join(out, 'music');
const sfxDir = join(out, 'sfx');
const sampleRate = 22_050;
mkdirSync(musicDir, { recursive: true });
mkdirSync(sfxDir, { recursive: true });

let seed = 0xC0FFEE;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000);
const note = (midi) => 440 * (2 ** ((midi - 69) / 12));

function addTone(buffer, start, duration, frequency, gain, timbre = 'lute') {
  const first = Math.max(0, Math.floor(start * sampleRate));
  const count = Math.min(buffer.length - first, Math.floor(duration * sampleRate));
  for (let i = 0; i < count; i += 1) {
    const time = i / sampleRate;
    const attack = Math.min(1, time / 0.025);
    const decay = timbre === 'lute' ? Math.exp(-time * 3.8) : Math.min(1, (duration - time) / 0.18);
    const phase = Math.PI * 2 * frequency * time;
    const wave = timbre === 'horn'
      ? Math.sin(phase) + 0.34 * Math.sin(phase * 2) + 0.14 * Math.sin(phase * 3)
      : timbre === 'flute'
        ? Math.sin(phase) + 0.13 * Math.sin(phase * 2)
        : Math.sin(phase) + 0.42 * Math.sin(phase * 2) + 0.18 * Math.sin(phase * 3);
    buffer[first + i] += wave * gain * attack * Math.max(0, decay);
  }
}

function addNoise(buffer, start, duration, gain, color = 'white') {
  const first = Math.max(0, Math.floor(start * sampleRate));
  const count = Math.min(buffer.length - first, Math.floor(duration * sampleRate));
  let previous = 0;
  for (let i = 0; i < count; i += 1) {
    const time = i / sampleRate;
    const raw = random() * 2 - 1;
    previous = color === 'brown' ? previous * 0.94 + raw * 0.06 : raw;
    buffer[first + i] += previous * gain * Math.exp(-time * (color === 'brown' ? 4 : 9));
  }
}

function addDrum(buffer, start, gain = 0.3) {
  const first = Math.floor(start * sampleRate);
  const count = Math.min(buffer.length - first, Math.floor(0.5 * sampleRate));
  for (let i = 0; i < count; i += 1) {
    const time = i / sampleRate;
    const frequency = 105 - time * 115;
    buffer[first + i] += Math.sin(Math.PI * 2 * frequency * time) * gain * Math.exp(-time * 9);
  }
  addNoise(buffer, start, 0.18, gain * 0.12, 'brown');
}

function reverb(buffer, delaySeconds = 0.19, amount = 0.16) {
  const delay = Math.floor(delaySeconds * sampleRate);
  for (let i = delay; i < buffer.length; i += 1) buffer[i] += buffer[i - delay] * amount;
}

function normalize(buffer, peak = 0.88) {
  let maximum = 0;
  for (const value of buffer) maximum = Math.max(maximum, Math.abs(value));
  const scale = maximum > 0 ? peak / maximum : 1;
  for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.tanh(buffer[i] * scale * 1.08) / Math.tanh(1.08);
}

function kingdomMusic() {
  const duration = 72;
  const buffer = new Float32Array(duration * sampleRate);
  const beat = 60 / 72;
  const chords = [[50,57,62], [53,57,60], [48,55,60], [50,55,58]];
  for (let bar = 0; bar < Math.ceil(duration / (beat * 4)); bar += 1) {
    const chord = chords[bar % chords.length];
    const barStart = bar * beat * 4;
    addTone(buffer, barStart, beat * 4.2, note(chord[0] - 12), 0.075, 'flute');
    for (let step = 0; step < 8; step += 1) addTone(buffer, barStart + step * beat / 2, beat * 1.2, note(chord[step % 3]), 0.105, 'lute');
    if (bar % 2 === 0) {
      const melody = [62,65,67,69,67,65,62,60];
      for (let step = 0; step < 8; step += 1) addTone(buffer, barStart + step * beat / 2, beat * 0.72, note(melody[(bar + step) % melody.length]), 0.045, 'flute');
    }
    if (bar % 2 === 0) addDrum(buffer, barStart, 0.09);
  }
  reverb(buffer, 0.22, 0.18);
  normalize(buffer, 0.76);
  return buffer;
}

function battleMusic() {
  const duration = 48;
  const buffer = new Float32Array(duration * sampleRate);
  const beat = 60 / 116;
  const roots = [38,38,41,36,38,43,41,36];
  for (let bar = 0; bar < Math.ceil(duration / (beat * 4)); bar += 1) {
    const root = roots[bar % roots.length];
    const barStart = bar * beat * 4;
    addTone(buffer, barStart, beat * 4.1, note(root), 0.12, 'horn');
    addTone(buffer, barStart + beat * 2, beat * 2, note(root + 7), 0.075, 'horn');
    for (let step = 0; step < 8; step += 1) {
      addTone(buffer, barStart + step * beat / 2, beat * 0.58, note(root + 12 + [0,7,3,7][step % 4]), 0.09, 'lute');
      addDrum(buffer, barStart + step * beat / 2, step % 2 === 0 ? 0.25 : 0.13);
    }
  }
  reverb(buffer, 0.13, 0.12);
  normalize(buffer, 0.82);
  return buffer;
}

function sfx(recipe) {
  const buffer = new Float32Array(Math.ceil(recipe.duration * sampleRate));
  recipe.render(buffer);
  if (recipe.reverb) reverb(buffer, recipe.reverb, 0.14);
  normalize(buffer, 0.82);
  return buffer;
}

const recipes = {
  'ui-tap': { duration: .16, render: (b) => { addTone(b, 0, .12, 740, .4, 'lute'); } },
  'panel-open': { duration: .34, render: (b) => { addTone(b, 0, .25, 392, .25, 'flute'); addTone(b, .07, .25, 587, .22, 'flute'); }, reverb: .09 },
  back: { duration: .24, render: (b) => { addTone(b, 0, .2, 520, .3, 'lute'); addTone(b, .06, .16, 330, .23, 'lute'); } },
  collect: { duration: .65, render: (b) => { [0, .09, .18, .28].forEach((t, i) => addTone(b, t, .35, [660,784,988,1174][i], .22, 'lute')); }, reverb: .13 },
  'upgrade-start': { duration: .82, render: (b) => { addNoise(b, 0, .4, .18, 'brown'); [196,247,294].forEach((f, i) => addTone(b, i * .13, .58, f, .2, 'horn')); }, reverb: .16 },
  'upgrade-complete': { duration: 1.15, render: (b) => { [392,494,587,784].forEach((f, i) => addTone(b, i * .16, .7, f, .22, i < 2 ? 'lute' : 'flute')); }, reverb: .19 },
  'building-select': { duration: .25, render: (b) => { addNoise(b, 0, .1, .12, 'brown'); addTone(b, .025, .2, 280, .28, 'lute'); } },
  'hero-select': { duration: .38, render: (b) => { addTone(b, 0, .3, 220, .32, 'horn'); addTone(b, .05, .27, 330, .19, 'horn'); }, reverb: .11 },
  'hero-upgrade': { duration: .9, render: (b) => { [220,330,440,660].forEach((f, i) => addTone(b, i * .12, .55, f, .22, 'horn')); }, reverb: .16 },
  'find-enemy': { duration: .72, render: (b) => { [330,392,330].forEach((f, i) => addTone(b, i * .2, .42, f, .25, 'horn')); }, reverb: .14 },
  'attack-start': { duration: 1.05, render: (b) => { addDrum(b, 0, .45); addDrum(b, .26, .34); addTone(b, .05, .85, 147, .3, 'horn'); }, reverb: .12 },
  'sword-hit': { duration: .3, render: (b) => { addNoise(b, 0, .16, .5); addTone(b, 0, .22, 980, .18, 'lute'); } },
  'arrow-shot': { duration: .34, render: (b) => { addNoise(b, 0, .24, .24); addTone(b, 0, .25, 1250, .16, 'flute'); } },
  'arrow-impact': { duration: .25, render: (b) => { addNoise(b, 0, .18, .44, 'brown'); addTone(b, 0, .14, 210, .2, 'lute'); } },
  'magic-cast': { duration: .65, render: (b) => { [440,554,659,880].forEach((f, i) => addTone(b, i * .06, .48, f, .17, 'flute')); }, reverb: .12 },
  'magic-impact': { duration: .48, render: (b) => { addNoise(b, 0, .35, .32); addTone(b, 0, .42, 92, .38, 'horn'); addTone(b, .05, .3, 740, .15, 'flute'); }, reverb: .1 },
  'shield-wall': { duration: .72, render: (b) => { addTone(b, 0, .62, 147, .34, 'horn'); addTone(b, .04, .58, 220, .27, 'horn'); addNoise(b, 0, .24, .2); }, reverb: .14 },
  'hero-defeated': { duration: .68, render: (b) => { [220,196,147,110].forEach((f, i) => addTone(b, i * .11, .35, f, .23, 'horn')); } },
  victory: { duration: 1.75, render: (b) => { [294,370,440,587,740].forEach((f, i) => addTone(b, i * .19, .9, f, .24, 'horn')); addDrum(b, 0, .25); }, reverb: .2 },
  defeat: { duration: 1.45, render: (b) => { [294,262,220,147].forEach((f, i) => addTone(b, i * .22, .7, f, .25, 'horn')); }, reverb: .18 },
  'incoming-attack': { duration: 1.05, render: (b) => { addDrum(b, 0, .4); addDrum(b, .28, .36); addDrum(b, .56, .32); addTone(b, 0, .9, 130, .2, 'horn'); } },
  'revenge-available': { duration: 1.2, render: (b) => { [196,233,294,392].forEach((f, i) => addTone(b, i * .17, .65, f, .24, 'horn')); addDrum(b, 0, .24); }, reverb: .15 },
};

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const output = Buffer.alloc(44 + dataSize);
  output.write('RIFF', 0); output.writeUInt32LE(36 + dataSize, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24); output.writeUInt32LE(sampleRate * 2, 28); output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34);
  output.write('data', 36); output.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return output;
}

function encode(name, samples, directory, bitrate) {
  const wav = join(directory, `${name}.wav`);
  const mp3 = join(directory, `${name}.mp3`);
  writeFileSync(wav, wavBuffer(samples));
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', bitrate, '-ar', '22050', '-ac', '1', mp3], { stdio: 'inherit' });
  rmSync(wav, { force: true });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
}

encode('kingdom-hearth', kingdomMusic(), musicDir, '72k');
encode('battle-march', battleMusic(), musicDir, '72k');
for (const [name, recipe] of Object.entries(recipes)) encode(name, sfx(recipe), sfxDir, '64k');

writeFileSync(join(out, 'ASSET_MANIFEST.json'), `${JSON.stringify({
  generatedAt: '2026-08-26',
  creator: 'Crown & Coin project',
  method: 'Original deterministic procedural synthesis; no external samples or copyrighted melodies.',
  rights: 'Project-owned original work. Cleared for commercial use in Crown & Coin.',
  music: {
    'kingdom-hearth.mp3': { context: 'Kingdom', durationSeconds: 72 },
    'battle-march.mp3': { context: 'Battle', durationSeconds: 48 },
  },
  sfx: Object.keys(recipes).map((name) => `${name}.mp3`),
}, null, 2)}\n`);
