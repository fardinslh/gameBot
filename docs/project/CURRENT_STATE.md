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
| Kingdom | Implemented | Pixi world, bounded vertical pan, HUD, Collect, building selection, detail sheets, RTL/LTR |
| Economy | Implemented | PostgreSQL balances, production, storage caps, ledger, idempotency, advisory locks |
| Buildings | Implemented | Nine persistent types, levels 1 to 20, one active upgrade per building |
| Progressive expansion | Implemented | Five visual stages derived from Castle level; locked content does not mount |
| Appearance progression | Partial | `WOOD`, `STONE`, `FORTIFIED` state works; stages 2 and 3 fall back to stage 1 art |
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

Ten ordered migrations exist:

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

## Launch-readiness analytics foundation complete

Append-only first-party analytics, transactional server instrumentation, bounded client delivery, session/resume/screen tracking, activation-relative D1/D3/D7 reports, acquisition/engagement breakdowns, integrity checks, migration, and tests are complete. Bale integration has not started and is next.

## Validation entry points

Run `npm test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, and `npm run build` for code changes. Browser flows live under `validate:client`, `validate:heroes`, `validate:raid`, `validate:revenge`, `validate:visual`, and `validate:progression`. See [testing](TESTING.md) for prerequisites and coverage.
