import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, 'apps/game-client/public/assets/audio/approved/music/loop-ready');
const manifest = JSON.parse(readFileSync(path.join(directory, 'LOOP_MANIFEST.json'), 'utf8'));
let checks = 0;

for (const [context, track] of Object.entries(manifest.tracks)) {
  const file = path.join(directory, track.derived);
  if (statSync(file).size <= 0) throw new Error(`${context}: derived file is empty.`);
  checks += 1;
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }));
  const duration = Number(probe.format.duration);
  const stream = probe.streams[0];
  if (Math.abs(duration - track.loopEnd) > 0.06) throw new Error(`${context}: duration ${duration} does not match loopEnd ${track.loopEnd}.`);
  if (!(track.loopStart >= 0 && track.loopStart < track.loopEnd && track.loopEnd <= duration + 0.05)) throw new Error(`${context}: invalid loop points.`);
  if (Number(stream.sample_rate) !== track.sampleRate || stream.channels !== track.channels || stream.codec_name !== track.codec) throw new Error(`${context}: unexpected stream format.`);
  checks += 3;
  const threeBoundaries = track.loopEnd * 3 + 0.25;
  const render = spawnSync('ffmpeg', ['-hide_banner', '-stream_loop', '3', '-i', file, '-t', String(threeBoundaries), '-af', 'silencedetect=noise=-45dB:d=0.5', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], { encoding: 'utf8' });
  if (render.status !== 0) throw new Error(`${context}: ffmpeg boundary decode failed: ${render.stderr}`);
  const diagnostic = render.stderr;
  if (/silence_(?:start|end)/.test(diagnostic)) throw new Error(`${context}: >=0.5s silence detected while crossing three loop boundaries.`);
  checks += 1;
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1'], { maxBuffer: 100 * 1024 * 1024 });
  if (pcm.status !== 0 || pcm.stdout.length < 16) throw new Error(`${context}: PCM boundary decode failed.`);
  const decodedDuration = pcm.stdout.length / (4 * track.channels * track.sampleRate);
  if (track.loopEnd > decodedDuration + (1 / track.sampleRate)) throw new Error(`${context}: loopEnd exceeds decoded PCM duration ${decodedDuration}.`);
  const lastFrame = pcm.stdout.length - 8;
  const boundaryJump = Math.max(
    Math.abs(pcm.stdout.readFloatLE(0) - pcm.stdout.readFloatLE(lastFrame)),
    Math.abs(pcm.stdout.readFloatLE(4) - pcm.stdout.readFloatLE(lastFrame + 4)),
  );
  if (boundaryJump > 0.2) throw new Error(`${context}: boundary sample jump ${boundaryJump.toFixed(6)} is too large.`);
  checks += 1;
  console.log(`${context}: duration=${duration.toFixed(6)}s decoded=${decodedDuration.toFixed(6)}s boundaryJump=${boundaryJump.toFixed(6)}`);
}

console.log(`Audio loop validation passed: ${checks} checks, 2 tracks, 3 consecutive boundaries each.`);
console.log('Audible quality: NOT AUDIBLY VERIFIED. Product-owner listening still required.');
