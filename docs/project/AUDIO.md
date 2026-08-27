---
title: Operate Crown & Coin audio
navLabel: Audio
contentType: Reference
---

# Audio

## Current quality status

The audio engine is implemented and technically validated. The product owner has approved all 24 groups from the licensed audition catalog. Those exact choices are stored under `public/assets/audio/approved` and mapped into gameplay. The original procedural catalog remains classified **REPLACE** and is retained only for audit compatibility.

The development-only [Audio Audition](AUDIO_AUDITION.md) route at `/dev/audio` now shows that selection is complete. It is available only under `next dev`, is absent from game navigation, and returns 404 in production.

## Runtime architecture

`AudioProvider` owns one `GameAudioManager`. Master/Music/SFX toggles and volumes remain device-local under `crown-coin-audio-v1`. Music uses one lazily created Web Audio `AudioContext`, decoded `AudioBuffer` caches, and `CrossfadeLoopPlayer`. Every loop instance is a non-looping scheduled `AudioBufferSourceNode`; production never sets `source.loop = true`. Before one instance ends, the scheduler starts the next from `loopStart` and overlaps their gains. Context changes separately crossfade for 600 ms. Same-context renders and volume changes do not recreate music. Visibility suspends/resumes the audio clock and existing schedule. Audio never decides or blocks gameplay.

The graph is `source -> LoopFadeGain -> ContextGain -> MusicBusGain -> destination`. Per-instance gains own loop envelopes. Per-player context gain owns Kingdom/Battle changes. Shared music bus owns Master/Music mute and volume, so settings never overwrite overlap curves. If Web Audio initialization, fetch, decode, or loop validation fails, the manager falls back to one conservative looping `HTMLAudioElement`; this compatibility fallback cannot promise crossfaded looping. SFX intentionally retain lightweight `HTMLAudioElement` playback.

`MUSIC_TRACKS` maps the unchanged approved Kingdom B and Battle A files with explicit timing. Scheduling clamps configured `loopEnd` to decoded `AudioBuffer.duration`, avoiding reliance on MP3 container duration when decoded PCM differs. Every `SFX_ASSETS` key maps exactly one approved local file. `pickSfxAsset` remains variant-ready for future explicitly approved alternatives.

## Overlapping loop schedule

The approved source files remain unchanged. Both are stereo 44.1 kHz MP3. Decoded PCM duration is 49.951383 seconds for Kingdom and 108 seconds for Battle. Runtime decodes the complete file, then schedules from decoded timing.

For source start `T`, loop start `S`, loop end `E`, and overlap `X`, the next source starts at `T + (E - S) - X` from buffer offset `S`. Tail gain follows `cos(t * PI / 2)` while head gain follows `sin(t * PI / 2)`, using 128-sample `setValueCurveAtTime` curves. Old source stops at `T + (E - S)`. First playback starts only one audible copy; second copy begins later at the overlap point.

| Context | Runtime source | loopStart | loopEnd | overlap | next-start interval |
| --- | --- | ---: | ---: | ---: | ---: |
| Kingdom | `approved/music/kingdom.mp3` | 0 | 49.951383 s | 3.5 s | 46.451383 s |
| Battle | `approved/music/battle.mp3` | 0 | 108 s | 2.5 s | 105.5 s |

`loop-ready/LOOP_MANIFEST.json` is the timing/provenance record. Previous baked-crossfade files remain there only as legacy rollback artifacts and are not loaded by production.

## Development boundary preview

Run `npm run dev`, open `/dev/audio`, and press **Test Kingdom Loop**. The control uses `GameAudioManager.previewLoopBoundary`, therefore the same production scheduler and equal-power curves. It begins eight seconds before Kingdom `loopEnd`, performs the real 3.5-second overlap, and continues eight seconds past the old source end. Press it at least three times for owner approval.

## Approved production mapping

| Runtime role | Owner choice | Production file |
| --- | --- | --- |
| Kingdom Music | B | `approved/music/kingdom.mp3` |
| Battle Music | A | `approved/music/battle.mp3` |
| Collect | B | `approved/sfx/collect.mp3` |
| Upgrade Start | C | `approved/sfx/upgrade-start.mp3` |
| Upgrade Complete | C | `approved/sfx/upgrade-complete.mp3` |
| Hero Upgrade | A | `approved/sfx/hero-upgrade.mp3` |
| Attack Start | A | `approved/sfx/attack-start.mp3` |
| Sword Hit | A | `approved/sfx/sword-hit.mp3` |
| Arrow Shot | B | `approved/sfx/arrow-shot.mp3` |
| Magic Cast | C | `approved/sfx/magic-cast.mp3` |
| Victory | A | `approved/sfx/victory.mp3` |
| Back / Close | A | `approved/sfx/back.mp3` |
| Building Select | A | `approved/sfx/building-select.mp3` |
| Hero Select | A | `approved/sfx/hero-select.mp3` |
| Find Enemy | A | `approved/sfx/find-enemy.mp3` |
| Panel Open | B | `approved/sfx/panel-open.mp3` |
| Shield Wall | B | `approved/sfx/shield-wall.mp3` |
| Defeat | A | `approved/sfx/defeat.mp3` |
| UI Tap | A | `approved/sfx/ui-tap.mp3` |
| Arrow Impact | C | `approved/sfx/arrow-impact.mp3` |
| Magic Impact | A | `approved/sfx/magic-impact.mp3` |
| Hero Defeated | A | `approved/sfx/hero-defeated.mp3` |
| Incoming Attack | A | `approved/sfx/incoming-attack.mp3` |
| Revenge Available | A | `approved/sfx/revenge-available.mp3` |

Victory was rebuilt from its selected full CC0 source as a five-second sting. Find Enemy uses the selected sound twice with a 280 ms gap and no time stretching.

## Rights and provenance

The machine-readable approved manifest records source, author, license, source URL, modifications, approval date, duration, codec, bitrate, and file size. Round-2 sources include JC Sounds Fantasy SFX Pack Vol 1 (CC-BY 4.0), 10 Impact/Shield Blocks (CC0), War Horns (CC0), 16 Button Clicks (CC0), Game Over II (CC0), Icy Game Over (CC0), and Muffled Distant Explosion/log drum (CC0).

CC-BY and CC-BY-SA assets retain their attribution obligations in the manifests. The technical metadata is an audit record, not a claim that automated tooling can judge subjective quality.

## Validation

`npm run test:client-experience` checks scheduler math, first/second/third instances, exact overlap, equal-power envelopes, bounded node lifecycle, cancellation, music bus isolation, mute, suspend/resume, fallback, Battle-SFX mapping, and unaffected player experience. `npm run validate:audio-loops` decodes approved originals, checks exact PCM timing, verifies three scheduled overlap transitions per track, and rejects silent overlap windows. `npm run validate:audio-lab` validates the development route and boundary control.

The loop boundaries are **NOT AUDIBLY VERIFIED** in the automated environment. Product-owner listening across at least three consecutive Kingdom and Battle loops, real-device mix review, and later Bale WebView behavior remain launch checks.
