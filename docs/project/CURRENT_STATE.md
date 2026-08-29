---
title: Check the current implementation state
navLabel: Current State
contentType: Reference
---

# Check the current implementation state

This snapshot includes the Launch-Safety PvP implementation. The labels distinguish working behavior from prepared interfaces and absent systems.

## Feature status

| Area | Status | Current implementation |
| --- | --- | --- |
| Kingdom | Implemented | Pixi world, bounded vertical pan, HUD, Collect, building selection, detail sheets, semantic RTL/LTR, and isolated mixed-direction values |
| Economy | Implemented | PostgreSQL balances, production, storage caps, ledger, idempotency, advisory locks |
| Buildings | Implemented | Nine persistent types, levels 1 to 20, one active upgrade per building |
| Active building visual evolution | Implemented | All nine active buildings derive five major raster tiers plus a visible minor step at every level; all 45 assets pass effective-resolution audit through moderate 200% inspection |
| World building status stack | Implemented | One DPR-aware screen-space Pixi stack keeps the compact upgrade/active indicator centered above the level badge with a fixed gap while following pan, resize, tier changes, and unlock scale |
| Theme-ready building evolution architecture | Implemented | Visual requests resolve Building Type + Building Level + Kingdom Theme through one catalog; `DEFAULT` is the only implemented theme |
| Selectable Kingdom Themes | Not implemented | No selection UI, persistence, ownership, or API exists |
| Historical Theme assets | Not implemented | Planned historically-inspired eras have no generated or registered production catalogs |
| Theme ownership | Not implemented | No Prisma field, inventory, entitlement, or account state exists |
| Theme Shop integration | Not implemented | Retention 05 Shop and Gems remains future work |
| Theme Season integration | Not implemented | Season remains future work; no reward or pass system exists |
| Advanced building visual evolution | Implemented | Academy, Blacksmith, Watchtower, and Workshop use optimized local tier assets at levels 1/5/9/13/17 with cumulative minor steps and level-20 capstones |
| Kingdom Progress goals | Implemented | Castle detail opens a bilingual server-authored summary of Kingdom Level/XP, Castle milestones, next real district unlock, and current/next advanced effects |
| Progressive expansion | Implemented | Five visual stages derived from Castle level; locked content does not mount |
| First-session onboarding | Implemented | Aren-led, target-aware Welcome through first Raid/Result, server-persisted completion/skip, and five durable contextual tips |
| Permanent Game Guide | Implemented | Aren identity plus eight bilingual sections available from the compact Player HUD |
| Audio engine | Implemented | Scheduled dual-source equal-power loop overlap, shared music bus, explicit decoded loop points, 600 ms context crossfade, safe HTMLAudio fallback, 22 SFX triggers, and visibility handling |
| Production audio selection | Approved | All 24 explicit owner choices are mapped; the development-only Audio Lab records the completed gate |
| Audio settings | Implemented | Master, Music, and SFX toggles/volumes persisted per browser device |
| Appearance progression | Implemented for all active buildings | Levels 1–20 deterministically select Early, Developed, Advanced, Fortified, or Prestige art across all nine active buildings |
| Missions / Achievements / Daily Return | Implemented | Three deterministic Daily and Weekly assignments, nine permanent tiered Achievement families, a seven-claim Daily Return cycle, explicit transactional claims, and bilingual mobile UI |
| Army Foundation | Implemented | Infantry, Archer, Cavalry ownership; one training order; Castle-derived capacity; three-squad formation; existing Heroes as Commanders |
| Army Battle | Not implemented | Retention 03B; current production combat does not read Army state |
| PvE Campaign | Not implemented | Retention 04 only, after Retention 03B |
| Heroes | Implemented | Knight, Ranger, Mage, persistent levels and server-derived stats |
| Commanders | Implemented for formation | Existing Knight, Ranger, and Mage can each command one Army Formation squad; no duplicate Commander rows or class locks |
| Raid Team | Implemented | Exactly three unique owned Heroes in ordered persistent slots |
| Matchmaking | Implemented | Three bounded real-player passes, top-five pool selection, recent-eight memory, six-hour anti-farm, system fallback |
| New Kingdom Shield | Implemented | Persistent 24-hour `Player.createdAt` protection; protected players attack system opponents and cannot be normal real defenders |
| System opponents | Implemented | 30 persistent domain-backed opponents in six tiers with locked threshold replenishment and social exclusions |
| Hero Raid Battle | Implemented | Current production Raid/Revenge remain server-seeded Hero battles using rules version 1 and persisted replay |
| Permanent troop casualties | Not implemented | Retention 03 uses battle-state casualties only; trained roster counts are not deleted by PvP |
| Loot | Implemented | Gold, Food, Wood, Stone only; protection, reserves, caps, paired ledger rows |
| Trophy | Implemented | Rating-aware bounded deltas with zero floor |
| Battle history | Implemented | Recent participant summaries and participant-only replay detail |
| Defense inbox | Implemented | Incoming battle view, unread count, persistent read action |
| Revenge | Implemented | 24-hour, owner-bound, single-use target with loop prevention |
| Notifications | Partial | Stored structured records and read state; no public notification controller or external delivery |
| Advanced PvP | Partial | Castle 7 unlock metadata exists; no separate advanced PvP feature exists |
| Redis/BullMQ jobs | Partial | Connection, health check, and queue handle exist; no producer or worker exists |
| Guild | Not implemented | Disabled navigation item only |
| Shop | Not implemented | Disabled navigation item only |
| Season | Not implemented | No schema, API, or client feature |
| Leaderboard | Not implemented | No schema, API, or client feature |
| Bale | Not implemented | Enum, environment placeholders, and rejecting adapter only |
| Telegram | Not implemented | Enum, environment placeholder, and rejecting adapter only |
| Payments | Not implemented | Platform interface and `PURCHASE` ledger reason only |

## Active building types

The authoritative building list in `packages/shared/src/index.ts` contains:

- Castle
- Farm
- Lumber Mill
- Mine
- Grand Market
- Academy
- Blacksmith
- Watchtower
- Workshop

The Prisma enum also contains `BARRACKS` and `WALL`, but the shared Kingdom API does not expose them as active gameplay buildings. Client assets and future layout entries exist for Barracks, Granary, Tavern, and Stable; the active scene does not render them.

Barracks remains inactive during Retention 03A. Army capacity temporarily derives from Castle level; no Barracks row, world sprite, unlock milestone, economy config, or visual evolution was activated.

## Current Hero roster

| Hero | Class | Skill |
| --- | --- | --- |
| Knight | Tank | Shield Wall |
| Ranger | Single-target DPS | Power Shot |
| Mage | Area burst | Arcane Blast |

Runtime bootstrap grants all three Heroes and fills Raid Team slots 1 through 3 for new or backfilled players.

The same persistent Heroes also serve as Army Commanders. The default Army Formation assigns Knight to 20 Infantry, Ranger to 15 Archers, and Mage to 10 Cavalry. This starter assignment is editable and creates no permanent Hero-to-troop class lock.

## Current API feature set

The API exposes health, Kingdom state and mutations, Hero roster/team/upgrade, Army state/training/formation, Raid overview/search/start/history, defense inbox/read, Revenge preview/start, participant-only battle replay, and authoritative Retention state/claims. Kingdom bootstrap includes authoritative progression goals without exposing unused `ADVANCED_PVP` metadata. Raid overview/search also expose authoritative `newPlayerProtection`; offers identify `REAL` or `SYSTEM` for internal client state. [API reference](API_REFERENCE.md) lists every route.

## Current migrations

Fifteen ordered migrations exist:

1. `20260823000000_initial_foundation`
2. `20260823030000_server_authoritative_economy`
3. `20260823040000_hero_system`
4. `20260823050000_core_pvp_raid`
5. `20260823060000_revenge_notifications`
6. `20260825070000_kingdom_progression`
7. `20260825070100_kingdom_building_backfill`
8. `20260825070200_building_progression_constraints`
9. `20260826090000_launch_safe_raid`
10. `20260826100000_first_party_analytics`
11. `20260826110000_pre_bale_player_experience`
12. `20260827090000_advisor_tip_progress`
13. `20260829080000_retention_02`
14. `20260829090000_army_commander_foundation`
15. `20260829090100_army_commander_slot_cascade`

## Active retention gate

Retention 01A, 01B, 02, and 03A engineering are complete. Army persistence, training, Castle-derived capacity, and Commander-led formation now exist in parallel with the unchanged Hero Raid flow. Retention 03B Army Battle v2 is next and not started. Current Raid/Revenge remain rules version 1, Barracks remains inactive, and PvE remains after 03B. The collision-proof status stack, Castle Y 665 composition, Pixi coordinates, 54px navigation, Retention 02, and existing gameplay remain unchanged. Owner art, Aren, Persian-device, and real-device audio checks remain open. Shop, Guild, Leaderboards, and Bale have not started.

## Persian RTL and bidirectional text

The game shell now owns one locale boundary for Kingdom, Heroes, Raid, Battle Log, sheets, onboarding, Guide, errors, and overlays. It sets semantic `lang`/`dir` attributes and synchronizes the document root when `?lang=fa` or `?lang=en` changes. Player names use automatic Unicode isolation; numeric amounts, levels, timers, signed Trophy deltas, and percentages use explicit left-to-right isolation. Pixi Kingdom and Battle coordinates remain left-to-right internally and are not mirrored.

`/dev/rtl` is a development-only mixed-content fixture. `npm run validate:rtl` checks semantic DOM and computed direction in a real browser, no horizontal overflow, English regression, and the supported 320x568, 375x812, and 390x844 viewports.

## Validation entry points

Run `npm run validate:army` for Army configuration and authoritative integration coverage. Use the normal test, integration, type, lint, build, Kingdom, Hero, Raid, Revenge, Retention, and documentation regressions as described in [testing](TESTING.md).
