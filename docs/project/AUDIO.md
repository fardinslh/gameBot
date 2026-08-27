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

`AudioProvider` owns one `GameAudioManager`. Master/Music/SFX toggles and volumes remain device-local under `crown-coin-audio-v1`. Music uses one lazily created Web Audio `AudioContext`, decoded `AudioBuffer` caches, looping `AudioBufferSourceNode`s, and per-source `GainNode`s. Context changes crossfade for 600 ms and schedule the old source to stop. Same-context renders and volume changes do not recreate music. Visibility suspends/resumes the intended context. Audio never decides or blocks gameplay.

If Web Audio initialization, fetch, decode, or loop validation fails, the manager falls back to one conservative looping `HTMLAudioElement`. SFX intentionally retain lightweight `HTMLAudioElement` playback.

`MUSIC_TRACKS` maps the approved Kingdom B and Battle A compositions through derived loop-ready files and explicit timing. Every `SFX_ASSETS` key maps exactly one approved local file. `pickSfxAsset` remains variant-ready for future explicitly approved alternatives.

## Loop-ready derivation

The approved source files remain unchanged. Both are stereo 44.1 kHz MP3. `ffprobe` reports Kingdom as 49.951383 seconds and Battle as 108 seconds, with MP3 stream start at 0.025057 seconds. `silencedetect` found no silence of at least 150 ms at -45 dB. The audible restart risk came from incompatible musical tail/head material plus non-sample-accurate `HTMLAudioElement.loop`, not a large baked-in silent region.

Each derived master replaces the final 2.5 seconds with a circular linear crossfade from the approved tail into the approved first 2.5 seconds. The loop jump therefore returns to the musical point reached at the render end instead of restarting after an outro.

| Context | Approved source | Derived runtime file | loopStart | loopEnd |
| --- | --- | --- | ---: | ---: |
| Kingdom | `approved/music/kingdom.mp3` | `approved/music/loop-ready/kingdom-loop.mp3` | 0 | 47.451383 s |
| Battle | `approved/music/battle.mp3` | `approved/music/loop-ready/battle-loop.mp3` | 0 | 105.5 s |

`loop-ready/LOOP_MANIFEST.json` is the provenance/timing record. The source selection did not change.

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

`npm run test:client-experience` checks music lifecycle, loop metadata, fallback, the approved-choice contract, Battle-SFX mapping, and advisor positioning. `npm run validate:audio-loops` checks both derived files, stream format, duration, nonzero size, loop bounds, and three consecutive decoded boundaries without a 0.5-second silent gap. `npm run validate:audio-lab` continues to validate the approved catalog.

The loop boundaries are **NOT AUDIBLY VERIFIED** in the automated environment. Product-owner listening across at least three consecutive Kingdom and Battle loops, real-device mix review, and later Bale WebView behavior remain launch checks.
