---
title: Operate Crown & Coin audio
navLabel: Audio
contentType: Reference
---

# Audio

## Current quality status

The audio engine is implemented and technically validated. The initial Codex-selected audio content was rejected by the product owner for inadequate quality. Every legacy production asset is classified **REPLACE**. Production selection is **PENDING HUMAN APPROVAL**; no audition candidate is mapped into gameplay automatically.

Use the development-only [Audio Audition](AUDIO_AUDITION.md) process before changing production mappings. `/dev/audio` returns the lab only under `next dev`; it is not linked from game navigation and production returns 404.

## Preserved engine architecture

`AudioProvider` owns one `GameAudioManager`. Master/Music/SFX toggles and volumes remain device-local under `crown-coin-audio-v1`. The manager preserves first-gesture unlock, 600 ms music crossfade, visibility suspend/resume, safe media failure handling, and persisted-Battle-event SFX timing. Music and audio never decide or block gameplay.

`SFX_ASSETS` now accepts arrays and avoids an immediate repeated file when multiple approved variants are mapped later. Current production entries intentionally remain one-item legacy arrays until the owner approves replacements.

## Legacy production audit

All rows share source `scripts/generate-audio-assets.mjs`, author `Crown & Coin project / Codex-generated`, project-owned commercial-use permission, mono MP3 at 22.05 kHz, and classification **REPLACE**.

| File | Role/current trigger | Duration | Size |
| --- | --- | ---: | ---: |
| `music/kingdom-hearth.mp3` | Kingdom music context | 72.000 s | 576,826 B |
| `music/battle-march.mp3` | active Battle music context | 48.000 s | 384,774 B |
| `sfx/ui-tap.mp3` | navigation/confirmation | 0.160 s | 2,132 B |
| `sfx/panel-open.mp3` | Guide/settings/inbox open | 0.342 s | 3,595 B |
| `sfx/back.mp3` | close/return | 0.240 s | 2,759 B |
| `sfx/collect.mp3` | successful Collect | 0.650 s | 5,894 B |
| `sfx/upgrade-start.mp3` | successful building upgrade start | 0.820 s | 7,357 B |
| `sfx/upgrade-complete.mp3` | authoritative upgrade completion | 1.152 s | 10,074 B |
| `sfx/building-select.mp3` | Pixi building selection | 0.250 s | 2,759 B |
| `sfx/hero-select.mp3` | Hero detail selection | 0.380 s | 3,804 B |
| `sfx/hero-upgrade.mp3` | successful Hero upgrade | 0.900 s | 7,984 B |
| `sfx/find-enemy.mp3` | successful Match Offer search | 0.720 s | 6,521 B |
| `sfx/attack-start.mp3` | Raid/Revenge start | 1.050 s | 9,238 B |
| `sfx/sword-hit.mp3` | persisted Knight/basic Damage | 0.300 s | 3,177 B |
| `sfx/arrow-shot.mp3` | persisted Power Shot cast | 0.342 s | 3,595 B |
| `sfx/arrow-impact.mp3` | persisted Ranger Damage | 0.250 s | 2,759 B |
| `sfx/magic-cast.mp3` | persisted Arcane Blast cast | 0.650 s | 5,894 B |
| `sfx/magic-impact.mp3` | persisted Mage Damage | 0.480 s | 4,640 B |
| `sfx/shield-wall.mp3` | persisted Shield Wall cast | 0.720 s | 6,521 B |
| `sfx/hero-defeated.mp3` | persisted Hero defeat | 0.681 s | 6,312 B |
| `sfx/victory.mp3` | attacker-win result | 1.750 s | 14,671 B |
| `sfx/defeat.mp3` | defeat result | 1.450 s | 12,372 B |
| `sfx/incoming-attack.mp3` | new incoming unread attack | 1.050 s | 9,238 B |
| `sfx/revenge-available.mp3` | new available Revenge | 1.200 s | 10,283 B |

The machine-readable audit is `public/assets/audio/ASSET_MANIFEST.json`.

## Audition candidate catalog

There are 61 local MP3 candidates across 24 groups. High-impact groups have A/B/C; the remaining groups have A/B. Candidates were transcoded to 44.1 kHz MP3 and prepared to a quieter music target or a readable SFX target. This is technical preparation, not an audio-quality endorsement.

### Music

| Group | Candidate | Duration | Size | Bitrate | Author | License |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Kingdom | A | 25.612 s | 410,896 B | 128 kbps | beardalaxy | CC0 1.0 |
| Kingdom | B | 49.951 s | 800,566 B | 128 kbps | RandomMind | CC0 1.0 |
| Kingdom | C | 57.652 s | 923,595 B | 128 kbps | TAD | CC0 1.0 |
| Battle | A | 108.000 s | 1,729,140 B | 128 kbps | Emma_MA | CC0 1.0 |
| Battle | B | 14.769 s | 237,443 B | 128 kbps | William Hector | CC0 1.0 |
| Battle | C | 69.818 s | 1,118,083 B | 128 kbps | MintoDog | CC0 1.0 |

Music candidates use source-declared loop versions. Loop quality still requires human audition for audible seams.

### SFX sources and rights

| Source pack/work | Author | License | Candidate use |
| --- | --- | --- | --- |
| RPG Sound Pack | artisticdude | CC0 1.0 | coins, UI, magic, unsheathe |
| 100 CC0 metal and wood SFX | rubberduck | CC0 1.0 | construction, metal, wood |
| UI Sound Effects | Robin Lamb | CC0 1.0 | tactile UI, notification, result |
| Fantasy Weapons and Apparel | Vehicle | CC0 1.0 | sword clashes, equipment texture |
| Swishes Sound Pack | artisticdude | CC0 1.0 | projectile/weapon air movement |
| RPG Sound Package | Tuomo Untinen | CC-BY 3.0 | bow, construction, spell, combat |
| Bow & Arrow Shot | dorkster / qubodup | CC-BY-SA 3.0 | bow release candidate |
| Medieval Victory/Defeat | RandomMind | CC0 1.0 | restrained result candidates |
| Victory Fanfare | ARoachIFoundOnMyPillow | CC0 1.0 | result candidate |

The full candidate manifest records filename, group, letter, source file, author, exact license, source URL, modifications, duration, codec, bitrate, size, production-safety result, and `approval: PENDING` for every file at `public/assets/audio/candidates/AUDITION_MANIFEST.json`. CC-BY and CC-BY-SA candidates require the recorded attribution/share-alike obligations if selected.

## Technical rejection log

- The initial 24 procedural assets: technically functional and legally safe, but product-owner quality rejection; all marked REPLACE.
- `Heartfelt Battle`: not admitted because its author describes it as riffing on a recognizable commercial-game theme.
- Pixabay search candidates: not admitted because the automated environment could not obtain the original files and per-download provenance reliably through the site challenge.
- An incorrectly resolved `80-CC0-RPG-SFX.zip` URL and a sword-clash archive response were invalid/non-audio downloads; neither entered the candidate catalog.
- Retro, MIDI, chiptune, casino, comedic, vocal, gore, unclear-license, or ripped-game candidates were excluded by direction before integration.

## Build and validation

`node scripts/build-audio-audition-candidates.mjs` rebuilds the curated transcodes when the licensed source cache is present. `npm run test:client-experience` validates catalog contracts; `npm run validate:audio-lab` checks all 61 files, decoded peak headroom, browser loading, music exclusivity, Stop/Replay, non-mutating gameplay-context SFX previews, settings persistence, and mobile overflow.

Automated checks cannot hear or judge quality. Headphones, desktop speakers, phone speakers, and later Bale WebView still require human listening.
