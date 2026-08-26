---
title: Understand the system architecture
navLabel: Architecture
contentType: Conceptual
---

# Understand the system architecture

The repository separates transport, client presentation, authoritative domain logic, shared contracts, and persistence. npm workspaces compile the packages and applications from one root.

## Runtime architecture

```text
Web development identity
        |
        v
Next.js 16 + React 19
  React HUD, pages, hooks, API clients
  PixiJS Kingdom and Battle scenes
        |
        | JSON over HTTP
        v
NestJS 11 Game API
  Kingdom/Economy | Heroes | Raid/Revenge | Notifications
        |
        +---------------------+
        |                     |
        v                     v
PostgreSQL via Prisma     Redis via ioredis
authoritative state       health + BullMQ queue handle
                              |
                              v
                         no worker or gameplay jobs yet
```

## Monorepo boundaries

| Path | Responsibility |
| --- | --- |
| `apps/game-client` | Next.js application, React UI, localization, Pixi rendering, browser state hooks |
| `apps/game-api` | NestJS controllers, server domain services, Prisma, battle engine, infrastructure modules |
| `packages/shared` | TypeScript request/response and domain contracts shared by client and API |
| `packages/platform` | Platform-neutral authentication, user, notification, and payment adapter interfaces |
| `infrastructure` | Local infrastructure notes |
| `scripts` | Runtime, browser, visual, and documentation validation |

## Client boundary

React owns navigation, HUD, sheets, API synchronization, language direction, and mobile layout. PixiJS owns the Kingdom world and battle playback canvas. React passes server-derived scene state into Pixi; Pixi reports taps through stable gameplay IDs.

`apps/game-client/src/game/rendering/pixi-runtime.ts` creates each Pixi application with antialiasing, automatic density, transparent background, and device resolution capped at `2`.

## API boundary

Controllers accept IDs and idempotency keys, then delegate to services. Clients cannot submit resource balances, levels, Hero stats, battle damage, winners, loot, Trophy deltas, or timer completion.

`apps/game-api/src/economy/economy.service.ts` bootstraps Web development players and serializes player mutations with PostgreSQL advisory transaction locks. `HeroService` uses the same player lock. `RaidService` locks both participants in sorted order before settlement.

## Shared contracts

`packages/shared/src/index.ts` defines the API surface for resources, buildings, Heroes, Raid, battle playback, inbox, Revenge, and errors. Update this package with both API and client consumers when a response changes.

`packages/platform/src/index.ts` defines platform interfaces. `apps/game-api/src/platform/placeholder.adapters.ts` rejects authentication, user lookup, notifications, and payments for every current adapter. `openAppContext` reports an unconfigured platform.

## Persistence and infrastructure

Prisma maps the PostgreSQL schema. Migrations contain constraints that Prisma cannot express, including partial uniqueness for active upgrades and check constraints for level ranges.

Redis participates in API startup and health checks unless `SKIP_REDIS_FOR_DEVELOPMENT=true`. `JobsService` creates a BullMQ queue named `game-jobs`, but no current service enqueues jobs and no worker consumes them.

## Analytics boundary

`AnalyticsModule` owns ingestion, validation, deduplication, event definitions, and reporting. React emits only lifecycle/screen transitions through a bounded best-effort queue. Economy, Hero, and Raid emit canonical server events beside authoritative writes. Analytics never feeds balances, unlocks, matchmaking, combat, or rewards.

## Platform independence

Domain services resolve a temporary `WEB` development identity through `PlayerContextService`. They do not call Bale or Telegram SDKs. Future platform authentication should map verified external accounts to `Player` before domain services execute; it should not fork economy, Hero, or battle rules by platform.
