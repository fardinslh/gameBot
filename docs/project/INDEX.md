---
title: Crown & Coin
navLabel: Project Context
contentType: Landing
---

# Crown & Coin

Crown & Coin is a portrait mobile medieval strategy game. The current build combines a server-authoritative Kingdom economy, persistent building and Hero progression, deterministic Raid battles, and a Revenge return loop.

## Current verified repository state

- **Branch**: `main`
- **Last verified against commit**: `2a272e294dd652c1e789cde64c89bbcbc6aad202`
- **Baseline commit message**: `feat: add missions achievements and daily rewards`
- **Verification date**: 2026-08-29
- **Remote**: `https://github.com/fardinslh/gameBot.git`

This baseline includes completed Retention 01A, Retention 01B, and Retention 02 work. Retention 03 Hero Expansion is next and has not started.

## Platform direction

The product direction is retention-first: bounded content and progression phases precede Bale staging, production readiness, and closed test. Telegram and broader Web remain later platform concerns. `PlatformAccount` and placeholder adapters prepare boundaries only; authentication, payments, and external delivery remain unimplemented. See [retention roadmap](RETENTION_ROADMAP.md).

## Technology stack

- **Monorepo**: npm workspaces, TypeScript 5.9
- **Client**: Next.js 16, React 19, PixiJS 8, Lucide React
- **API**: NestJS 11, Prisma 6
- **Database**: PostgreSQL 17 in local Docker Compose
- **Infrastructure**: Redis 7.4 and a BullMQ queue handle; no gameplay worker or queued job exists
- **Testing**: Vitest and browser validation through Playwright Core with a local Chromium browser
- **Assets**: local WebP terrain, buildings, Castle, and Hero portraits

## Current core loop

```text
Kingdom
  -> collect server-timed production
  -> upgrade Castle and buildings
  -> upgrade Heroes and arrange a three-Hero Raid Team
  -> request a server Match Offer
  -> start an authoritative deterministic Raid
  -> receive loot and Trophy settlement
  -> inspect defense history and use an eligible Revenge
  -> return to Kingdom
```

The client renders server responses. It never calculates balances, upgrade completion, battle winners, loot, or Trophy settlement.

## Current major systems

- [Product and player experience](PRODUCT.md)
- [Technical architecture](ARCHITECTURE.md)
- [Exact implementation status](CURRENT_STATE.md)
- [System dependency map](GAME_SYSTEMS.md)
- [Kingdom world and Pixi rendering](KINGDOM.md)
- [Economy and upgrades](ECONOMY.md)
- [Heroes and Raid Team](HEROES.md)
- [Raid and deterministic battle](RAID_AND_BATTLE.md)
- [Revenge and notifications](REVENGE_AND_NOTIFICATIONS.md)
- [Building and Kingdom progression](PROGRESSION.md)
- [Visible building evolution](BUILDING_EVOLUTION.md)
- [Missions, achievements, and Daily Return](RETENTION_SYSTEMS.md)
- [Retention-first roadmap](RETENTION_ROADMAP.md)
- [Prisma data model and migrations](DATA_MODEL.md)
- [HTTP API inventory](API_REFERENCE.md)
- [First-party analytics](ANALYTICS.md)
- [Onboarding and permanent Game Guide](PLAYER_EXPERIENCE.md)
- [Music, SFX, and audio settings](AUDIO.md)
- [Audio candidate audition and approval](AUDIO_AUDITION.md)
- [Frontend architecture](FRONTEND.md)
- [Assets and visual constraints](ASSETS_AND_VISUALS.md)
- [Local development](LOCAL_DEVELOPMENT.md)
- [Tests and browser validation](TESTING.md)
- [Security and integrity rules](SECURITY_AND_INTEGRITY.md)
- [Architecture decisions](DECISIONS.md)
- [Roadmap and deferred scope](ROADMAP.md)
- [Known limitations](KNOWN_ISSUES.md)
- [AI product and planning partner handoff](PLANNER_HANDOFF.md)
- [AI coding agent handoff](AI_HANDOFF.md)

## Current development status

- **Completed**: repository foundation, Pixi Kingdom slice, server economy, Hero roster and Raid Team, authoritative Raid and battle playback, defense inbox, Revenge, building progression and effects, progressive Kingdom expansion through Stage 5, Retention 01A/01B visual progression, Retention 02 missions/achievements/Daily Return, first-party analytics, onboarding, Game Guide, and audio runtime
- **Completed**: Audio Quality Selection Gate; all 24 owner choices are mapped
- **Next**: Retention 03 — Hero Expansion, only when explicitly scoped
- **Not started**: Bale Mini App Integration
- **Planned**: platform delivery and social/live-ops concepts require a future scoped phase
- **Deferred**: Guild, Shop, Season, leaderboard, payments, Telegram integration, and additional building gameplay

## Product constraints

- Keep economy, progression, battle, loot, and rewards server-authoritative
- Keep the game core independent from Bale, Telegram, and Web transport details
- Use PixiJS for interactive game worlds and React for HUD, navigation, sheets, and state orchestration
- Keep Castle as the Kingdom visual hero and gameplay unlock authority
- Treat Kingdom Level as status metadata, not an unlock gate
- Keep major gameplay buildings separate from the terrain texture
- Preserve negative space and omit locked future silhouettes from the active world
- Use irregular terrain integration instead of generic circular building pads
- Reuse the deterministic battle engine for Raid and Revenge

## Reading order

### AI product / planning partner

1. [Planner handoff](PLANNER_HANDOFF.md)
2. [Current state](CURRENT_STATE.md)
3. [Product definition](PRODUCT.md)
4. [Architecture decisions](DECISIONS.md)
5. [Retention roadmap](RETENTION_ROADMAP.md) and [roadmap](ROADMAP.md)
6. The relevant system document from the reference list above

### AI coding agent

1. [AI handoff](AI_HANDOFF.md)
2. [Current state](CURRENT_STATE.md)
3. [Decisions](DECISIONS.md)
4. The document for the system being changed
5. [Testing](TESTING.md)

### Backend developer

1. [Architecture](ARCHITECTURE.md)
2. [Data model](DATA_MODEL.md)
3. [Economy](ECONOMY.md)
4. [Raid and battle](RAID_AND_BATTLE.md)
5. [Security and integrity](SECURITY_AND_INTEGRITY.md)

### Frontend or game developer

1. [Frontend](FRONTEND.md)
2. [Kingdom](KINGDOM.md)
3. [Assets and visuals](ASSETS_AND_VISUALS.md)
4. [Testing](TESTING.md)

### Game designer

1. [Product](PRODUCT.md)
2. [Current state](CURRENT_STATE.md)
3. [Game systems](GAME_SYSTEMS.md)
4. [Progression](PROGRESSION.md)
5. [Roadmap](ROADMAP.md)

## Documentation maintenance policy

Update the matching file in this directory when a commit changes architecture, API routes, database models, gameplay formulas, phase status, visual progression, or a major product decision. Trivial formatting and behavior-preserving refactors do not require documentation edits. Treat code and migrations as the final authority when documentation disagrees with the implementation.
