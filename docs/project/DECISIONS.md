---
title: Preserve architecture and product decisions
navLabel: Decisions
contentType: Reference
---

# Preserve architecture and product decisions

These active decisions explain constraints that code alone may not reveal. Change a decision only through a scoped task that updates implementation and documentation together.

## ADR-001: Keep economy server-authoritative

- **Decision**: The API owns production, balances, costs, storage, levels, and timers
- **Reason**: A persistent strategy economy cannot trust browser state or local time
- **Consequences**: Clients submit intent and IDs; services validate, transact, and return complete authoritative state
- **Status**: Active

## ADR-002: Separate player identity from platform accounts

- **Decision**: `Player` owns game state and `PlatformAccount` maps external platform identities
- **Reason**: Bale, Telegram, and Web should reach one platform-independent game core
- **Consequences**: Platform authentication must resolve a Player before domain execution; domain tables do not store platform SDK payloads
- **Status**: Active, with Web development identity only

## ADR-003: Use PixiJS for worlds and React for interface state

- **Decision**: Pixi renders Kingdom and battle canvases; React renders HUD, navigation, sheets, and API state
- **Reason**: Pixi handles game-scene transforms and animation while React handles accessible application controls
- **Consequences**: Keep gameplay IDs at the boundary and avoid per-frame React rendering
- **Status**: Active

## ADR-004: Calculate battle results on the server

- **Decision**: The API snapshots teams, generates the seed, simulates rules, and persists results/events
- **Reason**: Client-calculated winners or rewards would break replay and settlement integrity
- **Consequences**: The browser plays stored events and cannot submit damage, winner, loot, or Trophy deltas
- **Status**: Active

## ADR-005: Reuse one battle engine for Revenge

- **Decision**: Raid and Revenge call `resolveBattle` and `simulateBattle`
- **Reason**: A second engine would split rules, persistence, and settlement behavior
- **Consequences**: Battle type changes target eligibility and loop behavior, not combat math
- **Status**: Active

## ADR-006: Use Castle as gameplay unlock authority

- **Decision**: Building and feature unlock rules read Castle level
- **Reason**: Players need one visible progression gate
- **Consequences**: Kingdom Level cannot unlock buildings; `ADVANCED_PVP` at Castle 7 remains metadata until a feature consumes it
- **Status**: Active

## ADR-007: Use Kingdom Level as status metadata

- **Decision**: Kingdom Level derives from total upgraded building levels
- **Reason**: The value summarizes broad Kingdom investment without competing with Castle gates
- **Consequences**: API responses may show a Kingdom Level different from Castle level
- **Status**: Active

## ADR-008: Keep gameplay buildings separate from base terrain

- **Decision**: The base map contains environment and work-ground cues; Pixi loads gameplay buildings as sprites
- **Reason**: Unlocking, selection, z-order, hit areas, level art, and replacement need independent assets
- **Consequences**: Do not bake Castle or active buildings into future terrain exports
- **Status**: Active

## ADR-009: Preserve a clean early Kingdom

- **Decision**: Castle 1 mounts exactly Castle, Farm, Lumber Mill, Mine, and Grand Market
- **Reason**: Negative space preserves hierarchy and mobile readability
- **Consequences**: Locked buildings create no silhouette, badge, texture load, hit area, accessibility target, or camera-bound contribution
- **Status**: Active

## ADR-010: Expand the Kingdom through staged areas

- **Decision**: Castle levels 2 through 5 add environmental context with Watchtower, Academy, Workshop, and Blacksmith
- **Reason**: Progression should change the world composition rather than insert isolated sprites around Castle
- **Consequences**: Presentation config stays separate from server unlock rules; local treatments remain irregular and restrained
- **Status**: Active

## ADR-011: Avoid generic building pads

- **Decision**: Terrain integration uses building-specific paths, work yards, rock, timber, vegetation, and contact grounding
- **Reason**: Circular platforms weaken the established medieval environment and make structures look like UI pieces
- **Consequences**: Visual reviews must inspect the actual terrain and mobile screenshots
- **Status**: Active

## ADR-012: Delay platform coupling

- **Decision**: Bale and Telegram adapters remain placeholders until a platform phase defines verified authentication and delivery
- **Reason**: Premature SDK calls would leak transport assumptions into economy and battle code
- **Consequences**: Current platform methods reject unsupported operations; Web development identity remains non-production
- **Status**: Active

## ADR-013: Store transaction and replay evidence

- **Decision**: Economy mutations create ledger rows and battles store snapshots, seed, rules version, and events
- **Reason**: Debugging, idempotency, and historical playback need durable evidence
- **Consequences**: Future cleanup jobs must preserve integrity and retention requirements before deleting these records
- **Status**: Active
