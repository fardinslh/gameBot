import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, 'apps/game-client/public/assets/audio/approved/music/loop-ready');
const manifest = JSON.parse(readFileSync(path.join(directory, 'LOOP_MANIFEST.json'), 'utf8'));
let checks = 0;

if (manifest.runtimeUsesNativeLoop !== false) throw new Error('Production music must not use native AudioBuffer looping.');
checks += 1;

for (const [context, track] of Object.entries(manifest.tracks)) {
  const file = path.resolve(directory, track.runtime);
  if (statSync(file).size <= 0) throw new Error(`${context}: approved source file is empty.`);
  checks += 1;

  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }));
  const duration = Number(probe.format.duration);
  const stream = probe.streams[0];
  if (Math.abs(duration - track.sourceDuration) > 0.06) throw new Error(`${context}: duration ${duration} does not match approved source ${track.sourceDuration}.`);
  if (Number(stream.sample_rate) !== track.sampleRate || stream.channels !== track.channels || stream.codec_name !== track.codec) throw new Error(`${context}: unexpected stream format.`);
  checks += 2;

  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1'], { maxBuffer: 100 * 1024 * 1024 });
  if (pcm.status !== 0 || pcm.stdout.length < 16) throw new Error(`${context}: PCM decode failed.`);
  const decodedFrames = pcm.stdout.length / (4 * track.channels);
  const decodedDuration = decodedFrames / track.sampleRate;
  const loopEnd = Math.min(track.loopEnd, decodedDuration);
  if (!(track.loopStart >= 0 && track.loopStart < loopEnd && track.crossfadeSeconds > 0 && track.crossfadeSeconds < loopEnd - track.loopStart)) throw new Error(`${context}: invalid decoded loop timing.`);
  checks += 1;

  const loopStartFrame = Math.floor(track.loopStart * track.sampleRate);
  const loopFrames = Math.floor((loopEnd - track.loopStart) * track.sampleRate);
  const crossfadeFrames = Math.floor(track.crossfadeSeconds * track.sampleRate);
  const intervalFrames = loopFrames - crossfadeFrames;
  const starts = [0, intervalFrames, intervalFrames * 2, intervalFrames * 3];
  if (starts.some((start, index) => index > 0 && start - starts[index - 1] !== intervalFrames)) throw new Error(`${context}: scheduler intervals drift.`);
  checks += 1;

  for (let transition = 0; transition < 3; transition += 1) {
    let energy = 0;
    for (let frame = 0; frame < crossfadeFrames; frame += 1) {
      const position = frame / Math.max(1, crossfadeFrames - 1);
      const fadeOut = Math.cos(position * Math.PI / 2);
      const fadeIn = Math.sin(position * Math.PI / 2);
      for (let channel = 0; channel < track.channels; channel += 1) {
        const tailIndex = ((loopStartFrame + loopFrames - crossfadeFrames + frame) * track.channels + channel) * 4;
        const headIndex = ((loopStartFrame + frame) * track.channels + channel) * 4;
        const mixed = pcm.stdout.readFloatLE(tailIndex) * fadeOut + pcm.stdout.readFloatLE(headIndex) * fadeIn;
        energy += mixed * mixed;
      }
    }
    const rms = Math.sqrt(energy / (crossfadeFrames * track.channels));
    if (rms < 0.0001) throw new Error(`${context}: transition ${transition + 1} produces an effectively silent overlap.`);
    checks += 1;
  }

  const midpoint = 0.5;
  const power = Math.cos(midpoint * Math.PI / 2) ** 2 + Math.sin(midpoint * Math.PI / 2) ** 2;
  if (Math.abs(power - 1) > 1e-6) throw new Error(`${context}: equal-power curve is invalid.`);
  checks += 1;

  console.log(`${context}: decoded=${decodedDuration.toFixed(6)}s loopEnd=${loopEnd.toFixed(6)}s crossfade=${track.crossfadeSeconds.toFixed(1)}s starts=${starts.map((frame) => (frame / track.sampleRate).toFixed(6)).join(',')}`);
}

console.log(`Audio crossfade validation passed: ${checks} checks, 2 tracks, 3 overlapping transitions each.`);
console.log('Audible quality: NOT AUDIBLY VERIFIED. Product-owner listening still required.');
