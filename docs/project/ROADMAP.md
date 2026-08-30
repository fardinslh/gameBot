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
- **First-Party Analytics**: canonical events, activation/retention reports, integrity tooling
- **Pre-Bale Player Experience implementation**: persistent first session, permanent bilingual Guide, audio engine, and persistent audio controls
- **Player Experience repair**: older Aren advisor candidate, target-aware action coaching, durable contextual counsel, derived seamless-loop masters, and buffered Web Audio playback
- **Retention 01A — Visible Kingdom Growth**: five major raster tiers plus every-level modular evolution for Castle and the four core economy buildings
- **Retention 01A architecture correction**: DEFAULT visual evolution now resolves through an explicit Kingdom Theme domain and namespaced catalog
- **Retention 01B — Advanced Building Evolution and Goals**: Academy, Blacksmith, Watchtower, and Workshop now share five raster tiers/every-level evolution; Castle detail exposes authoritative progression goals
- **Retention 03A — Army & Commander Foundation**: persistent Infantry/Archer/Cavalry ownership, one authoritative training order, Castle-derived capacity, three-squad formation, and existing Heroes as Commanders
- **Retention 03B — Army Battle v2**: authoritative Army power and snapshots, deterministic squad combat, versioned replay, Raid/Revenge cutover, system Army tiers, and portrait playback

## Current and next

The **Player Experience repair and Retention 01A, 01B, 02, 03A, and 03B are complete in engineering**. Retention 04 PvE Campaign / Adventure is next and has not started. Owner visual approval of the building and troop art, Aren approval, audible loop review, and real-device mix remain human checks. Bale Mini App Integration is intentionally delayed until the bounded retention roadmap is complete.

The approved launch sequence is:

```text
First-Party Analytics (complete)
  -> Pre-Bale Player Experience implementation (complete)
  -> Audio Quality Selection Gate (complete; 24 mapped)
  -> Player Experience repair (engineering complete; human checks open)
  -> Retention 01A Visible Kingdom Growth (implemented; owner art approval pending)
  -> Retention 01B Advanced Building Evolution + Goals (implemented; owner art approval pending)
  -> Retention 02 Missions / Achievements / Daily Return (implemented)
  -> Retention 03A Army & Commander Foundation (implemented)
  -> Retention 03B Army Battle v2 (implemented)
  -> Retention 04 PvE Campaign / Adventure (next)
  -> Retention 04 PvE Campaign
  -> Retention 05 Shop + Gems
  -> Retention 05B Kingdom Themes Foundation + First Historical Theme
  -> Retention 06 Guild MVP
  -> Retention 07 Guild Cooperation
  -> Retention 08 Leaderboards / Competitive Meta
  -> Retention 09 Content / Balance / Retention QA
  -> Bale Mini App Integration (staging)
  -> Production Readiness
  -> Closed Bale Test
  -> Soft Launch
```

Do not infer that Bale is implemented from platform placeholders. It requires its own scoped integration and device validation.

All nine active buildings, authoritative Kingdom progression goals, Retention 02 return loops, and Retention 03 Army/Commander Battle expansion are implemented. Retention 04 PvE Campaign / Adventure is next; do not start it automatically. New Raid and Revenge use Army Battle rules version 2 while stored Hero rules-version-1 replay remains compatible. See [Army and Commanders](ARMY_AND_COMMANDERS.md) and the [retention roadmap](RETENTION_ROADMAP.md).

Retention 05B is a future bounded milestone after Shop/Gem architecture and before Guild. It may add theme selection, ownership, and one complete historically-inspired cosmetic pack. This architecture correction does not implement that milestone.

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

## Completed foundation, open human review gate

Canonical analytics, Aren-led onboarding, the permanent Guide, and the buffered audio runtime are implemented. Audio selection is approved; audible loop/device review, Aren visual approval, and the pending mobile screenshot run keep the human pre-Bale quality gate open. Monetization, Guild, Season, and new gameplay remain deferred.

## Deferred complexity

Additional troop classes, permanent casualties, Hospital, Barracks activation, additional Heroes, equipment, crafting, rarity, recruitment, research trees, live-ops jobs, and new active building types remain deferred. Do not infer them from unused assets, enums, or interface placeholders.
