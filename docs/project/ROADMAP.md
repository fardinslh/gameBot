---
title: Read the project roadmap
navLabel: Roadmap
contentType: Reference
---

# Read the project roadmap

The roadmap records implemented milestones and bounded deferred areas. It does not authorize a new phase.

## Completed

- **Foundation**: npm monorepo, Next.js client, NestJS API, PostgreSQL, Redis connection, shared contracts, platform interfaces
- **Kingdom slice**: mobile HUD, Pixi scene, five active structures, detail interaction, localization
- **Authoritative economy**: production, Collect, ledger, idempotency, upgrades, storage
- **Heroes**: three starters, progression, Raid Team persistence
- **Raid and battle**: Match Offers, deterministic server battle, playback, loot, Trophies, history
- **Defense and Revenge**: inbox, structured notifications, target lifecycle, Revenge settlement
- **Kingdom progression**: nine persistent buildings, Castle gates, XP, appearance state, four effects
- **Progressive expansion**: five visual stages, active-only rendering, area reveals, Mine reposition
- **Project handoff documentation**: canonical developer and AI context under `docs/project`
- **Launch-Safety PvP**: 30 system opponents, six tiers, bounded matchmaking, new-player shield, anti-farm cooldown, safe replenishment

## Current and next

The next recommended scoped task is **First-Party Analytics Foundation**. It is not implemented by the Launch-Safety PvP pass and must not be inferred from server logs.

Final stage 2 and stage 3 building artwork remains a known visual follow-up. The loader already supports those files; no current phase authorizes asset generation.

## Later product areas

The repository contains planning boundaries for:

- Verified Bale Mini App authentication and platform context
- Verified Telegram Mini App authentication and platform context
- External notification delivery through a platform adapter
- Production Web identity and session security
- Social systems such as Guild or Alliance
- Season and leaderboard systems
- Shop and payment design
- Shareable battle reports

These items need product decisions before implementation. Current code does not define their behavior or data models.

## Deferred complexity

Additional Heroes, equipment, crafting, rarity, recruitment, research trees, live-ops jobs, and new active building types remain deferred. Do not infer them from unused assets, enums, or interface placeholders.
