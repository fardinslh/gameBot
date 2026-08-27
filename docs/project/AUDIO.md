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

`AudioProvider` owns one `GameAudioManager`. Master/Music/SFX toggles and volumes remain device-local under `crown-coin-audio-v1`. The manager preserves first-gesture unlock, 600 ms music crossfade, visibility suspend/resume, safe media failure handling, and persisted-Battle-event SFX timing. Audio never decides or blocks gameplay.

`MUSIC_TRACKS` maps the approved Kingdom B and Battle A loops. Every `SFX_ASSETS` key maps exactly one approved local file. `pickSfxAsset` remains variant-ready for future explicitly approved alternatives.

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

`npm run test:client-experience` checks the complete approved-choice contract, production mapping, runtime catalog, and metadata. `npm run validate:audio-lab` checks all 24 approved assets for file presence, MP3 metadata, decoded peak headroom, browser loading, the completed lab state, and 320/375/390 mobile overflow.

Final relative-mix review in the full game on headphones, desktop speakers, phone speakers, and later Bale WebView remains a launch check.
