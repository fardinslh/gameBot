import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, '.audio-source-cache');
const output = resolve(root, 'apps/game-client/public/assets/audio/candidates');

const sources = {
  rpg: { author: 'artisticdude', license: 'CC0 1.0', page: 'https://opengameart.org/content/rpg-sound-pack' },
  workshop: { author: 'rubberduck', license: 'CC0 1.0', page: 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx' },
  ui: { author: 'Robin Lamb', license: 'CC0 1.0', page: 'https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications' },
  weapons: { author: 'Vehicle', license: 'CC0 1.0', page: 'https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library' },
  swishes: { author: 'artisticdude', license: 'CC0 1.0', page: 'https://opengameart.org/content/swishes-sound-pack' },
  hawks: { author: 'Tuomo Untinen', license: 'CC-BY 3.0', page: 'https://opengameart.org/content/rpg-sound-package' },
  bow: { author: 'dorkster / qubodup', license: 'CC-BY-SA 3.0', page: 'https://opengameart.org/content/bow-arrow-shot' },
  iremos: { author: 'beardalaxy', license: 'CC0 1.0', page: 'https://opengameart.org/content/iremos-forest-theme-loop' },
  tower: { author: 'RandomMind', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-the-old-tower-inn' },
  once: { author: 'TAD', license: 'CC0 1.0', page: 'https://opengameart.org/content/once-upon-a-time-loop' },
  pursuit: { author: 'Emma_MA', license: 'CC0 1.0', page: 'https://opengameart.org/content/determined-pursuit-epic-orchestra-loop' },
  drums: { author: 'William Hector', license: 'CC0 1.0', page: 'https://opengameart.org/content/horde-war-drums-loop' },
  hope: { author: 'MintoDog', license: 'CC0 1.0', page: 'https://opengameart.org/content/hopeorchestral-battle-music' },
  victory: { author: 'RandomMind', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-victory-theme' },
  defeat: { author: 'RandomMind', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-defeat-theme' },
  fanfare: { author: 'ARoachIFoundOnMyPillow', license: 'CC0 1.0', page: 'https://opengameart.org/content/victory-fanfare' },
};

const p = (...parts) => parts.join('/');
const rpg = (...parts) => p('extracted/rpg_sound_pack/RPG Sound Pack', ...parts);
const workshop = (name) => p('extracted/100-CC0-wood-metal-SFX', name);
const ui = (name) => p('extracted/ui_wav/ui_wav', name);
const weapons = (name) => p('extracted/weapons-apparel/sfx', name);
const hawks = (...parts) => p('extracted/soundpack/soundpack', ...parts);
const swish = (number) => p('extracted/swishes/swishes', `swish-${number}.wav`);

const groups = [
  group('kingdom-music', 'Kingdom Music', 'music', [
    c('A', 'kingdom-a.ogg', 'iremos', 'Seamless source loop; transcode and loudness preparation.'),
    c('B', 'kingdom-b.wav', 'tower', 'Official loop version; transcode and loudness preparation.'),
    c('C', 'kingdom-c.mp3', 'once', 'Source loop; transcode and loudness preparation.'),
  ]),
  group('battle-music', 'Battle Music', 'music', [
    c('A', 'battle-a.wav', 'pursuit', 'Seamless source loop; transcode and loudness preparation.'),
    c('B', 'battle-b.wav', 'drums', 'Source drum loop; transcode and loudness preparation.'),
    c('C', 'battle-c.ogg', 'hope', 'Loopable source; transcode and loudness preparation.'),
  ]),
  group('collect', 'Collect', 'sfx', [
    c('A', rpg('inventory', 'coin.wav'), 'rpg'), c('B', rpg('inventory', 'coin2.wav'), 'rpg'), c('C', rpg('inventory', 'coin3.wav'), 'rpg'),
  ]),
  group('upgrade-start', 'Upgrade Start', 'sfx', [
    c('A', workshop('wood_hammer_01.ogg'), 'workshop'), c('B', workshop('hammer_02.ogg'), 'workshop'), c('C', hawks('Envinroment', 'smith1.wav'), 'hawks'),
  ]),
  group('upgrade-complete', 'Upgrade Complete', 'sfx', [
    c('A', hawks('Envinroment', 'build1.wav'), 'hawks'), c('B', hawks('Envinroment', 'smith2.wav'), 'hawks'), c('C', ui('chimes.wav'), 'ui'),
  ]),
  group('hero-upgrade', 'Hero Upgrade', 'sfx', [
    c('A', hawks('spells', 'levelup.wav'), 'hawks'), c('B', ui('ding_deep.wav'), 'ui'), c('C', rpg('battle', 'magic1.wav'), 'rpg'),
  ]),
  group('attack-start', 'Attack Start', 'sfx', [
    c('A', rpg('battle', 'sword-unsheathe2.wav'), 'rpg'), c('B', hawks('combat', 'swing.wav'), 'hawks'), c('C', ui('dum.wav'), 'ui'),
  ]),
  group('sword-hit', 'Sword Hit', 'sfx', [
    c('A', weapons('sword-knife-clash-06.wav'), 'weapons'), c('B', weapons('sword-knife-clash-17.wav'), 'weapons'), c('C', weapons('sword-knife-clash-30.wav'), 'weapons'),
  ]),
  group('arrow-shot', 'Arrow Shot', 'sfx', [
    c('A', hawks('combat', 'bow.wav'), 'hawks'), c('B', 'arrow-shoot.ogg', 'bow'), c('C', swish(4), 'swishes'),
  ]),
  group('magic-cast', 'Magic Cast', 'sfx', [
    c('A', hawks('spells', 'darkness.wav'), 'hawks'), c('B', hawks('spells', 'smite.wav'), 'hawks'), c('C', rpg('battle', 'spell.wav'), 'rpg'),
  ]),
  group('shield-wall', 'Shield Wall', 'sfx', [
    c('A', weapons('sword-knife-clash-10.wav'), 'weapons'), c('B', workshop('metal_slam_01.ogg'), 'workshop'), c('C', hawks('combat', 'hit.wav'), 'hawks'),
  ]),
  group('victory', 'Victory', 'sfx', [
    c('A', 'medieval-victory.mp3', 'victory', 'First 3 seconds, fade-out, loudness preparation.', 3),
    c('B', 'fanfare.mp3', 'fanfare', 'First 3 seconds, fade-out, loudness preparation.', 3),
    c('C', ui('chimes.wav'), 'ui'),
  ]),
  group('defeat', 'Defeat', 'sfx', [
    c('A', 'medieval-defeat.mp3', 'defeat', 'First 3 seconds, fade-out, loudness preparation.', 3),
    c('B', ui('negative_sound.wav'), 'ui'), c('C', ui('negative_sound2.wav'), 'ui'),
  ]),
  group('ui-tap', 'UI Tap', 'sfx', [c('A', ui('click_1.wav'), 'ui'), c('B', ui('click_2.wav'), 'ui')]),
  group('panel-open', 'Panel Open', 'sfx', [c('A', hawks('inventory', 'scroll.wav'), 'hawks'), c('B', rpg('interface', 'interface4.wav'), 'rpg')]),
  group('back', 'Back / Close', 'sfx', [c('A', ui('click_3.wav'), 'ui'), c('B', rpg('interface', 'interface1.wav'), 'rpg')]),
  group('building-select', 'Building Select', 'sfx', [c('A', rpg('inventory', 'wood-small.wav'), 'rpg'), c('B', workshop('wood_hit_04.ogg'), 'workshop')]),
  group('hero-select', 'Hero Select', 'sfx', [c('A', weapons('belt-buckle-01.wav'), 'weapons'), c('B', rpg('interface', 'interface2.wav'), 'rpg')]),
  group('find-enemy', 'Find Enemy', 'sfx', [c('A', ui('alarm2.wav'), 'ui'), c('B', hawks('inventory', 'scroll.wav'), 'hawks')]),
  group('arrow-impact', 'Arrow Impact', 'sfx', [c('A', hawks('combat', 'hit.wav'), 'hawks'), c('B', workshop('wood_hit_02.ogg'), 'workshop')]),
  group('magic-impact', 'Magic Impact', 'sfx', [c('A', hawks('spells', 'shock.wav'), 'hawks'), c('B', hawks('spells', 'smite.wav'), 'hawks')]),
  group('hero-defeated', 'Hero Defeated', 'sfx', [c('A', ui('dum.wav'), 'ui'), c('B', ui('negative_sound2.wav'), 'ui')]),
  group('incoming-attack', 'Incoming Attack', 'sfx', [c('A', ui('alarm.wav'), 'ui'), c('B', ui('ding_deep.wav'), 'ui')]),
  group('revenge-available', 'Revenge Available', 'sfx', [c('A', ui('alarm2.wav'), 'ui'), c('B', ui('chimes.wav'), 'ui')]),
];

mkdirSync(output, { recursive: true });
const manifest = { generatedAt: '2026-08-26', status: 'PENDING_HUMAN_APPROVAL', productionMappingChanged: false, candidates: [] };

for (const group of groups) {
  const groupDir = resolve(output, group.id);
  mkdirSync(groupDir, { recursive: true });
  for (const candidate of group.candidates) {
    const sourcePath = resolve(cache, candidate.input);
    if (!existsSync(sourcePath)) throw new Error(`Missing source: ${candidate.input}`);
    const filename = `${group.id}-${candidate.letter.toLowerCase()}.mp3`;
    const destination = resolve(groupDir, filename);
    const filter = group.kind === 'music'
      ? 'loudnorm=I=-24:TP=-2:LRA=11,alimiter=limit=0.89:attack=5:release=50'
      : `${candidate.maxSeconds ? `afade=t=out:st=${Math.max(0.2, candidate.maxSeconds - 0.25)}:d=0.25,` : ''}loudnorm=I=-18:TP=-1.5:LRA=7,alimiter=limit=0.89:attack=5:release=50`;
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath];
    if (candidate.maxSeconds) args.push('-t', String(candidate.maxSeconds));
    args.push('-af', filter, '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', group.kind === 'music' ? '128k' : '112k', destination);
    const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`ffmpeg failed for ${group.id} ${candidate.letter}`);
    const source = sources[candidate.source];
    const probe = spawnSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', destination], { encoding: 'utf8' });
    if (probe.status !== 0) throw new Error(`ffprobe failed for ${group.id} ${candidate.letter}`);
    const metadata = JSON.parse(probe.stdout);
    const stream = metadata.streams.find((entry) => entry.codec_type === 'audio');
    manifest.candidates.push({
      group: group.id,
      label: group.label,
      kind: group.kind,
      candidate: candidate.letter,
      filename: `/assets/audio/candidates/${group.id}/${filename}`,
      sourceFile: candidate.input,
      source: 'OpenGameArt.org',
      author: source.author,
      license: source.license,
      sourceReference: source.page,
      modifications: candidate.modifications ?? 'Transcoded to MP3, sample-rate standardized, and loudness prepared for audition.',
      productionSafe: 'YES',
      approval: 'PENDING',
      durationSeconds: Number(Number(metadata.format.duration).toFixed(3)),
      codec: stream.codec_name,
      bitrate: Number(metadata.format.bit_rate),
      sizeBytes: statSync(destination).size,
    });
  }
}

writeFileSync(resolve(output, 'AUDITION_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${manifest.candidates.length} audition candidates across ${groups.length} groups.`);

function group(id, label, kind, candidates) { return { id, label, kind, candidates }; }
function c(letter, input, source, modifications, maxSeconds) { return { letter, input, source, modifications, maxSeconds }; }
