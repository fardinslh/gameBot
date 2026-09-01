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

## ADR-014: Keep Kingdom Themes cosmetic and catalog-driven

- **Decision**: Building presentation resolves from Building Type + Building Level + Kingdom Theme through one catalog; `DEFAULT` is the only implemented Theme
- **Reason**: Future full architectural packs must not require renderer rewrites or create alternate gameplay balance
- **Consequences**: Theme can replace art and visual metadata but cannot change production, storage, effects, Hero stats, Raid/Battle power, loot, Trophies, costs, durations, PvP strength, or resources. Selection, ownership, and persistence remain future work
- **Status**: Active architecture; future Theme Foundation is not implemented

## ADR-015: Treat historical themes as inspired cosmetic interpretations

- **Decision**: Future Achaemenid, Parthian, Sasanian, Seljuk, Ilkhanid, Timurid, Safavid, Zand, and Qajar packs are historically inspired rather than museum-grade reconstruction claims
- **Reason**: Fantasy progression tiers and production structures require coherent artistic interpretation where exact archaeological references may not exist
- **Consequences**: Future packs need consistent period cues and respectful review without claiming exact reconstruction. Distribution may include gameplay unlocks, direct cosmetic purchase, Season/Pass rewards, or collection rewards; no Theme grants gameplay power
- **Status**: Planned content direction only; no historical assets or commerce implemented

## ADR-016: Make long-term combat Army-first with Heroes as Commanders

- **Decision**: Crown & Coin's long-term combat fantasy is Army-first Kingdom strategy. Infantry, Archers, and Cavalry form three squads led by existing Player Heroes as Commanders.
- **Reason**: The Player is a Kingdom ruler. Military forces should visibly and mechanically represent Kingdom power instead of turning the product into a three-character Hero-collection RPG.
- **Consequences**: Army is a first-class authoritative domain; Knight, Ranger, and Mage persistence remains intact; `RaidTeam` and Hero Battle rules version 1 remain historically compatible; new Raid/Revenge use Army Battle rules version 2; Barracks activation remains separately scoped; Army Battle v2 causes no permanent troop-roster loss.
- **Status**: Active. Retention 03A foundation and Retention 03B combat implemented.

## ADR-017: Reuse Battle v2 for isolated PvE Campaign progression

- **Decision**: Campaign stages use configured durable NPC Armies and the existing deterministic Army Battle rules-version-2 engine. Progress stores permanent best stars, one-time first-clear settlement, and unique chapter milestone claims.
- **Reason**: A bounded PvE path should deepen the existing Army investment without creating a second combat engine or weakening server authority.
- **Consequences**: Campaign has its own Battle type, NPC discriminator, state, APIs, analytics, and reward reasons. It creates no Match Offer, PvP loot, Trophy, Revenge, notification, shield, anti-farm, stamina, permanent casualty, or Gem reward. The UI remains inside the existing Raid destination and does not add a sixth navigation item.
- **Status**: Active. Retention 04 Broken Frontier implemented; owner art-direction review remains pending.

## ADR-018: Keep Gems authoritative, uncapped, and non-pay-to-win

- **Decision**: Gems are Crown & Coin's premium in-game currency and remain in `ResourceBalance`/`EconomyTransaction`, without a storage cap. Current free faucets remain Retention-based. Retention 05 sinks are three permanent Profile-Crest cosmetics and optional Building/training timer convenience through generic permanent entitlements.
- **Reason**: The first spending loop must be auditable, useful, and reusable without allowing a client to price purchases or letting premium currency buy Battle outcomes.
- **Consequences**: Every spend derives price server-side, locks the Player, creates `ShopPurchase` evidence and `SHOP_GEM_SPEND` ledger history, and fulfills atomically. Gems cannot directly buy Battle results or Trophies. No paid random loot exists. Real-money Gem acquisition remains forbidden until verified platform commerce is separately implemented. Generic entitlements may support cosmetic Retention 05B Theme ownership, but no Theme content is implemented here.
- **Status**: Active. Retention 05 implemented; owner Shop visual review remains pending.

## ADR-019: Preserve explicit reward overflow while limiting passive production

- **Decision**: Gold, Food, Wood, and Stone use Castle-derived capacity for passive production, but explicit earned rewards may overflow. Existing overflow is never clamped; production pauses for that resource until spending creates room. Gems remain uncapped.
- **Reason**: A Player must receive the complete reward they earned even when storage is full, while Building production still respects progression capacity.
- **Consequences**: The HUD keeps normal/full/overflow as internal state but presents capped resources as `current / capacity` plus hourly production or compact full text. Collect estimates remaining room per resource, and the server remains the sole authority for final gains and balances.
- **Status**: Active.
