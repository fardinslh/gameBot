---
title: Operate Crown & Coin audio
navLabel: Audio
contentType: Reference
---

# Audio

## Current quality status

The audio engine is implemented and technically validated. The product owner has approved 15 groups from the licensed audition catalog. Those exact choices are stored under `public/assets/audio/approved` and are the only audio assets mapped into gameplay.

Nine groups remain pending: UI Tap, Panel Open, Shield Wall, Defeat, Arrow Impact, Magic Impact, Hero Defeated, Incoming Attack, and Revenge Available. Pending gameplay actions are intentionally silent until the owner approves a candidate. The original procedural catalog remains classified **REPLACE** and is retained only for audit compatibility.

Use the development-only [Audio Audition](AUDIO_AUDITION.md) route at `/dev/audio` for the remaining decisions. It is available only under `next dev`, is absent from game navigation, and returns 404 in production.

## Runtime architecture

`AudioProvider` owns one `GameAudioManager`. Master/Music/SFX toggles and volumes remain device-local under `crown-coin-audio-v1`. The manager preserves first-gesture unlock, 600 ms music crossfade, visibility suspend/resume, safe media failure handling, and persisted-Battle-event SFX timing. Audio never decides or blocks gameplay.

`MUSIC_TRACKS` maps the approved Kingdom B and Battle A loops. `SFX_ASSETS` maps the 13 approved SFX and uses empty arrays for pending actions. `pickSfxAsset` returns `undefined` for a pending action, making silence explicit rather than falling back to rejected content.

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

Victory was rebuilt from its selected full CC0 source as a five-second sting. Find Enemy uses the selected sound twice with a 280 ms gap and no time stretching.

## Rights and provenance

The machine-readable approved manifest records source, author, license, source URL, modifications, approval date, duration, codec, bitrate, and file size. Round-2 sources include JC Sounds Fantasy SFX Pack Vol 1 (CC-BY 4.0), 10 Impact/Shield Blocks (CC0), War Horns (CC0), 16 Button Clicks (CC0), Game Over II (CC0), Icy Game Over (CC0), and Muffled Distant Explosion/log drum (CC0).

CC-BY and CC-BY-SA assets retain their attribution obligations in the manifests. The technical metadata is an audit record, not a claim that automated tooling can judge subjective quality.

## Validation

`npm run test:client-experience` checks the approved choice contract, pending-group reduction, production mapping, runtime silence for pending actions, and metadata. `npm run validate:audio-lab` checks all 26 pending candidates plus all 15 approved assets for file presence, MP3 metadata, decoded peak headroom, browser loading, Stop/Replay behavior, context previews, settings persistence, and 320/375/390 mobile overflow.

Human listening on headphones, desktop speakers, phone speakers, and later Bale WebView remains required for the nine pending groups.
