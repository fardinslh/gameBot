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
| Core building visual evolution | Implemented | Castle, Farm, Lumber Mill, Mine, and Grand Market derive five major tiers plus a visible minor step at every level |
| Theme-ready building evolution architecture | Implemented | Visual requests resolve Building Type + Building Level + Kingdom Theme through one catalog; `DEFAULT` is the only implemented theme |
| Selectable Kingdom Themes | Not implemented | No selection UI, persistence, ownership, or API exists |
| Historical Theme assets | Not implemented | Planned historically-inspired eras have no generated or registered production catalogs |
| Theme ownership | Not implemented | No Prisma field, inventory, entitlement, or account state exists |
| Theme Shop integration | Not implemented | Retention 05 Shop and Gems remains future work |
| Theme Season integration | Not implemented | Season remains future work; no reward or pass system exists |
| Advanced building visual evolution | Not implemented | Academy, Blacksmith, Watchtower, and Workshop remain Retention 01B |
| Progressive expansion | Implemented | Five visual stages derived from Castle level; locked content does not mount |
| First-session onboarding | Implemented | Aren-led, target-aware Welcome through first Raid/Result, server-persisted completion/skip, and five durable contextual tips |
| Permanent Game Guide | Implemented | Aren identity plus eight bilingual sections available from the compact Player HUD |
| Audio engine | Implemented | Scheduled dual-source equal-power loop overlap, shared music bus, explicit decoded loop points, 600 ms context crossfade, safe HTMLAudio fallback, 22 SFX triggers, and visibility handling |
| Production audio selection | Approved | All 24 explicit owner choices are mapped; the development-only Audio Lab records the completed gate |
| Audio settings | Implemented | Master, Music, and SFX toggles/volumes persisted per browser device |
| Appearance progression | Implemented for core | Levels 1–20 deterministically select Early, Developed, Advanced, Fortified, or Prestige art; advanced buildings retain legacy fallback |
| Missions / Achievements / Daily Return | Not implemented | Retention 02 only |
| PvE Campaign | Not implemented | Retention 04 only |
| Hero Expansion | Not implemented | Retention 03 only; the three current Heroes remain unchanged |
| Heroes | Implemented | Knight, Ranger, Mage, persistent levels and server-derived stats |
| Raid Team | Implemented | Exactly three unique owned Heroes in ordered persistent slots |
| Matchmaking | Implemented | Three bounded real-player passes, top-five pool selection, recent-eight memory, six-hour anti-farm, system fallback |
| New Kingdom Shield | Implemented | Persistent 24-hour `Player.createdAt` protection; protected players attack system opponents and cannot be normal real defenders |
| System opponents | Implemented | 30 persistent domain-backed opponents in six tiers with locked threshold replenishment and social exclusions |
| Battle | Implemented | Server-seeded deterministic three-versus-three engine and persisted replay |
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

## Current Hero roster

| Hero | Class | Skill |
| --- | --- | --- |
| Knight | Tank | Shield Wall |
| Ranger | Single-target DPS | Power Shot |
| Mage | Area burst | Arcane Blast |

Runtime bootstrap grants all three Heroes and fills Raid Team slots 1 through 3 for new or backfilled players.

## Current API feature set

The API exposes health, Kingdom state and mutations, Hero roster/team/upgrade, Raid overview/search/start/history, defense inbox/read, Revenge preview/start, and participant-only battle replay. Raid overview/search also expose authoritative `newPlayerProtection`; offers identify `REAL` or `SYSTEM` for internal client state. [API reference](API_REFERENCE.md) lists every route.

## Current migrations

Twelve ordered migrations exist:

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

## Active retention gate

Retention 01A engineering and its DEFAULT theme-ready architecture are complete; owner visual approval is pending. Retention 01B is next. Theme Foundation is planned only after Shop/Gem Economy. Selectable themes, Missions, Hero expansion, PvE, Shop, Guild, Leaderboards, and Bale have not started. Existing Aren and real-device audio quality gates remain open.

## Persian RTL and bidirectional text

The game shell now owns one locale boundary for Kingdom, Heroes, Raid, Battle Log, sheets, onboarding, Guide, errors, and overlays. It sets semantic `lang`/`dir` attributes and synchronizes the document root when `?lang=fa` or `?lang=en` changes. Player names use automatic Unicode isolation; numeric amounts, levels, timers, signed Trophy deltas, and percentages use explicit left-to-right isolation. Pixi Kingdom and Battle coordinates remain left-to-right internally and are not mirrored.

`/dev/rtl` is a development-only mixed-content fixture. `npm run validate:rtl` checks semantic DOM and computed direction in a real browser, no horizontal overflow, English regression, and the supported 320x568, 375x812, and 390x844 viewports.

## Validation entry points

Run `npm run validate:building-evolution` and `npm run capture:building-evolution` for core visual progression, plus the normal test, type, lint, build, Kingdom, player-experience, Raid, and Revenge regressions. See [testing](TESTING.md).
