---
title: Call the Game API
navLabel: API Reference
contentType: Reference
---

# Call the Game API

The NestJS API listens on port `3001` by default. Responses use shared types from `packages/shared/src/index.ts`.

## Common request rules

`X-Dev-Player-Id` selects an isolated Web development identity. Without the header, `DEV_PLAYER_ID` or `local-crown-player` supplies the identity. This mechanism is development scaffolding, not authentication.

Economy mutations, Hero upgrade, Raid start, and Revenge start require `Idempotency-Key` with 8 through 100 characters. Team save, search, and inbox read do not require one because they do not grant or charge a replayable reward.

## Health

| Method | Path | Purpose | Response |
| --- | --- | --- | --- |
| `GET` | `/health` | Query PostgreSQL and ping Redis unless disabled | `HealthResponse` |

## Kingdom

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/kingdom` | Bootstrap player state, reconcile upgrades, return complete Kingdom | `KingdomStateResponse` |
| `GET` | `/kingdom/buildings` | Alias for complete building/progression status | `KingdomStateResponse` |
| `POST` | `/kingdom/collect` | Collect capped production and record ledger rows | Idempotency key; `CollectResponse` |
| `POST` | `/kingdom/buildings/:buildingId/upgrade` | Validate ownership/unlock/cost and start an upgrade | Idempotency key; `UpgradeResponse` |
| `POST` | `/kingdom/buildings/:buildingId/upgrade/collect` | Reconcile a due upgrade or reject an active timer | Idempotency key; `UpgradeResponse` |

The client submits a persistent Building UUID in `buildingId`, not a building type or Pixi visual ID.

## Heroes

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/heroes` | Return roster, server-derived stats, team, balances, and costs | `HeroesResponse` |
| `GET` | `/heroes/team` | Return ordered Raid Team | `RaidTeamResponse` |
| `PUT` | `/heroes/team` | Save exactly three unique owned Hero IDs | `{ heroIds: string[3] }`; `RaidTeamResponse` |
| `POST` | `/heroes/:playerHeroId/upgrade` | Charge discounted Gold and increment level | Idempotency key; `HeroUpgradeResponse` |

## Raid and battle

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/raid` | Return current team, power, balances, player level, Trophies, server time, and New Kingdom Shield state | `RaidOverviewResponse` |
| `POST` | `/raid/search` | Select a safe real/system defender and create a 180-second Match Offer | `RaidSearchResponse` |
| `POST` | `/raid/start` | Validate and consume one Match Offer, resolve and settle battle | `{ matchOfferId }`, idempotency key; `BattleReplayResponse` |
| `GET` | `/raid/history` | Return up to 20 recent participant summaries | `RaidHistoryResponse` |
| `GET` | `/battles/:battleId` | Return stored replay to attacker or defender | `BattleReplayResponse` |

`POST /raid/start` accepts no defender ID, stats, damage, result, loot, or Trophy values.

`RaidOverviewResponse.newPlayerProtection` contains authoritative `active` and `expiresAt` values. Search offers include internal opponent `kind: REAL | SYSTEM`; this does not grant the client target-selection authority.

## Defense inbox and Revenge

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/raid/inbox` | Return recent defenses, unread count, and Revenge state | `DefenseInboxResponse` |
| `POST` | `/raid/inbox/read` | Mark incoming Raid/Revenge notifications read | `{ readCount: number }` |
| `GET` | `/raid/revenge/:revengeTargetId` | Validate target and return current-team/current-loot preview | `RevengePreviewResponse` |
| `POST` | `/raid/revenge/start` | Consume one target and settle a Revenge battle | `{ revengeTargetId }`, idempotency key; `BattleReplayResponse` |

## Internal-only modules

`NotificationService` has no controller. Redis and BullMQ expose no HTTP route. Platform adapters expose no authentication, notification, or payment controller.

## Error families

Shared contracts define `EconomyErrorCode`, `HeroErrorCode`, and `RaidErrorCode`. Services use domain errors for ownership, state, expiry, funds, team validity, idempotency, rate limits, and transaction conflicts. NestJS global validation strips unknown DTO fields and transforms validated input.
