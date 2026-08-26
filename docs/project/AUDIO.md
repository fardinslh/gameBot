---
title: Operate Crown & Coin audio
navLabel: Audio
contentType: Reference
---

# Audio

## Architecture and safety

`AudioProvider` owns one `GameAudioManager` for the app session. React components request a music context or named SFX; they do not create independent background-music loops. Audio is presentation-only and can never decide or block gameplay.

The manager waits for the first pointer or keyboard gesture before playback. If autoplay or an asset fails, the promise is contained, one warning is logged per asset, and the game continues. Kingdom/Hero/Raid overview use the Kingdom context; active Battle playback uses the Battle context. A 600 ms low-cost crossfade changes contexts without restarting music on ordinary renders. Hidden documents pause music and SFX; visible documents resume the current context after unlock.

## Settings

The top HUD speaker control opens device-local settings:

- Master enabled and volume
- Music enabled and volume
- SFX enabled and volume

Defaults are enabled, but no sound plays before a user gesture. Settings are normalized, bounded from 0 to 1, and stored under `crown-coin-audio-v1` in `localStorage`. They are intentionally not server-synchronized.

## Music assets

| File | Context | Duration | Approximate size |
| --- | --- | ---: | ---: |
| `music/kingdom-hearth.mp3` | warm medieval Kingdom loop | 72 s | 577 KB |
| `music/battle-march.mp3` | faster martial Battle loop | 48 s | 385 KB |

Both tracks were composed specifically for Crown & Coin by deterministic additive synthesis in `scripts/generate-audio-assets.mjs`. They contain no third-party recording, sample, ripped game audio, or copyrighted melody. The project owns the generated work and clears it for commercial Crown & Coin use. `public/assets/audio/ASSET_MANIFEST.json` is the machine-readable provenance record.

## SFX mapping

| SFX | Trigger |
| --- | --- |
| `ui_tap` | section navigation and compact confirmations |
| `panel_open` | Guide, settings, and inbox open |
| `back` | close/return actions |
| `collect` | successful server Collect |
| `upgrade_start` | successful server building-upgrade start |
| `upgrade_complete` | authoritative upgrade completion collection |
| `building_select` | Pixi building selection |
| `hero_select` | Hero detail selection |
| `hero_upgrade` | successful Hero upgrade |
| `find_enemy` | successful Match Offer search |
| `attack_start` | Raid or Revenge start request |
| `sword_hit` | Knight/basic persisted Damage event |
| `arrow_shot` / `arrow_impact` | Power Shot cast / Ranger Damage event |
| `magic_cast` / `magic_impact` | Arcane Blast cast / Mage Damage event |
| `shield_wall` | persisted Shield Wall skill cast |
| `hero_defeated` | persisted Hero defeated event |
| `victory` / `defeat` | Battle playback completion result |
| `incoming_attack` | unread incoming attack discovered |
| `revenge_available` | an available Revenge discovered |

Battle sounds use the existing `BattleEventState.timeMs` sequence. No second combat timeline, simulation, or per-frame sound loop exists.

## Loading, size, and replacement

Music loads by context and SFX loads on demand; all 22 SFX total about 142 KB and range from about 2 KB to 15 KB. The two music files total under 1 MB. Assets are local MP3 for WebView compatibility. Regenerate the originals with `node scripts/generate-audio-assets.mjs`, or replace a file and update `audio-manager.ts`, the manifest, this document, and the browser/audio tests together.

## Validation and limitations

Automated validation proves local files, nonzero sizes, budgets, browser play routing, Battle-event mapping, settings persistence, and safe load behavior. A headless browser cannot prove perceived loudness or sound quality, so the current tracks and mix are **not audibly verified** by Codex. Bale WebView background/resume, device speakers, interruptions, and final mixing still require real-device validation after Bale integration. There is no voice acting and the focused launch library intentionally contains only two music contexts.
