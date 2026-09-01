---
title: Call the Game API
navLabel: API Reference
contentType: Reference
---

# Call the Game API

The NestJS API listens on port `3001` by default. Responses use shared types from `packages/shared/src/index.ts`.

## Common request rules

`X-Dev-Player-Id` selects an isolated Web development identity. Without the header, `DEV_PLAYER_ID` or `local-crown-player` supplies the identity. This mechanism is development scaffolding, not authentication.

Economy mutations, Hero upgrade, troop training, Shop purchase, Raid start, Revenge start, Engagement session/Decree claim, and every Retention reward claim require `Idempotency-Key` with 8 through 100 characters. Team/formation save, Engagement heartbeat, Shop equip, search, and inbox read do not require one because they do not grant or charge a replayable reward.

## Health

| Method | Path | Purpose | Response |
| --- | --- | --- | --- |
| `GET` | `/health` | Query PostgreSQL and ping Redis unless disabled | `HealthResponse` |

## Kingdom

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/kingdom` | Bootstrap player state, reconcile upgrades, return complete Kingdom | `KingdomStateResponse` |
| `GET` | `/kingdom/buildings` | Alias for complete building/progression status | `KingdomStateResponse` |
| `PUT` | `/kingdom/identity` | Validate and persist Kingdom name, ruler title, and free heraldry choice | `UpdateKingdomIdentityRequest`; `KingdomIdentityState` |
| `POST` | `/kingdom/collect` | Collect capped production and record ledger rows | Idempotency key; `CollectResponse` |
| `POST` | `/kingdom/buildings/:buildingId/upgrade` | Validate ownership/unlock/cost and start an upgrade | Idempotency key; `UpgradeResponse` |
| `POST` | `/kingdom/buildings/:buildingId/upgrade/collect` | Reconcile a due upgrade or reject an active timer | Idempotency key; `UpgradeResponse` |

The client submits a persistent Building UUID in `buildingId`, not a building type or Pixi visual ID.

`KingdomStateResponse.kingdomGoals` is authoritative presentation data. It contains Castle level, real Castle-2-through-5 building milestones, the next real district unlock or `null`, `allDistrictsUnlocked`, current/next effect basis points, and a transformation projection with the current realm state plus at most one next and one future milestone. Reserved `ADVANCED_PVP` configuration is not exposed. `progression` remains the authoritative Kingdom Level/XP state. These fields create no mission, reward, claim, or client-authoritative unlock endpoint.

Identity names are normalized and must contain 2 through 24 safe visible characters. Allowed ruler titles are `LORD`, `LADY`, and `WARDEN`; allowed heraldry keys are `GOLDEN_LION`, `VERDANT_STAG`, and `CRIMSON_FALCON`. Existing players receive Prisma defaults.

## Heroes

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/heroes` | Return roster, server-derived stats, team, balances, and costs | `HeroesResponse` |
| `GET` | `/heroes/team` | Return ordered Raid Team | `RaidTeamResponse` |
| `PUT` | `/heroes/team` | Save exactly three unique owned Hero IDs | `{ heroIds: string[3] }`; `RaidTeamResponse` |
| `POST` | `/heroes/:playerHeroId/upgrade` | Charge discounted Gold and increment level | Idempotency key; `HeroUpgradeResponse` |

## Army and Commanders

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/army` | Reconcile due training and return capacity, troops, formation, and Commanders | `ArmyResponse` |
| `POST` | `/army/train` | Validate and charge one 1–25 unit training order | `{ troopType, quantity }`, idempotency key; `ArmyTrainResponse` |
| `PUT` | `/army/formation` | Save exactly three validated Commander-led squads | `{ slots: ArmyFormationSlotInput[3] }`; `ArmyResponse` |

Army mutations accept no cost, duration, completion timestamp, capacity, Commander stats, combat power, or resulting count. Castle level temporarily controls capacity. Raid and Revenge load this authoritative state for new rules-version-2 battles.

## Raid and battle

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/raid` | Return current Army, power, balances, player level, Trophies, server time, and New Kingdom Shield state | `RaidOverviewResponse` |
| `POST` | `/raid/search` | Select a safe real/system defender and create a 180-second Match Offer | `RaidSearchResponse` |
| `POST` | `/raid/start` | Validate and consume one Match Offer, resolve and settle battle | `{ matchOfferId }`, idempotency key; `BattleReplayResponse` |
| `GET` | `/raid/history` | Return up to 20 recent participant summaries | `RaidHistoryResponse` |
| `GET` | `/battles/:battleId` | Return stored replay to attacker or defender | `BattleReplayResponse` |

`POST /raid/start` accepts no defender ID, stats, damage, result, loot, or Trophy values. Search binds the attacker's battle-relevant Army fingerprint; start returns `MATCH_OFFER_ARMY_CHANGED` when that Army changed or the offer predates fingerprint storage, before consuming or settling the offer.

`RaidOverviewResponse.newPlayerProtection` contains authoritative `active` and `expiresAt` values. Search offers include internal opponent `kind: REAL | SYSTEM`; this does not grant the client target-selection authority.

## PvE Campaign

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/campaign` | Return Broken Frontier stage state, best stars, locks, rewards, milestones, and server time | `CampaignStateResponse` |
| `POST` | `/campaign/stages/:stageKey/start` | Validate the authoritative Army and stage gate, resolve one Battle v2 attempt, and settle any first-clear reward | Empty body, idempotency key; `CampaignStartResponse` |
| `POST` | `/campaign/rewards/:requiredStars/claim` | Claim one reached 9/18/27-star milestone | Empty body, idempotency key; `CampaignRewardClaimResponse` |

Campaign starts accept no NPC, Army, outcome, stars, or reward input. Claims accept no amount. Both mutations use the Player advisory lock and economy request replay boundary. Campaign battles never grant Trophy, PvP loot, Revenge, notifications, shield changes, or permanent troop loss.

## Defense inbox and Revenge

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/raid/inbox` | Return recent defenses, unread count, and Revenge state | `DefenseInboxResponse` |
| `POST` | `/raid/inbox/read` | Mark incoming Raid/Revenge notifications read | `{ readCount: number }` |
| `GET` | `/raid/revenge/:revengeTargetId` | Validate target and return current-Armies/current-loot preview | `RevengePreviewResponse` |
| `POST` | `/raid/revenge/start` | Consume one target and settle a Revenge battle | `{ revengeTargetId }`, idempotency key; `BattleReplayResponse` |

## Retention

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/retention` | Return server-time Daily/Weekly assignments, derived progress, Daily bonus, Achievement tiers, and Daily Return cycle | `RetentionStateResponse` |
| `POST` | `/retention/missions/:missionId/claim` | Claim one completed, current-period mission | Idempotency key; `RetentionClaimResponse` |
| `POST` | `/retention/daily/bonus/claim` | Claim the bonus after all three Daily missions complete | Idempotency key; `RetentionClaimResponse` |
| `POST` | `/retention/achievements/:achievementKey/:tier/claim` | Claim the next completed tier in one Achievement family | Idempotency key; `RetentionClaimResponse` |
| `POST` | `/retention/daily-return/claim` | Claim today's next reward in the seven-claim cycle | Idempotency key; `RetentionClaimResponse` |

Retention claim routes accept no request body. Progress, UTC period, eligibility, sequence, amounts, balance results, and claim time are server-derived. Claims use the same Player advisory lock, economy request replay protection, PostgreSQL transaction, and immutable ledger boundary as existing economy rewards.

## Engagement

| Method | Route | Behavior | Response |
| --- | --- | --- | --- |
| `GET` | `/engagement` | Compose one current goal, contextual progress, Decree state, and affordable upgrade from authoritative systems | `EngagementOverviewResponse` |
| `POST` | `/engagement/session` | Open an idempotent foreground session and optionally return changes after five minutes away | `EngagementSessionResponse` |
| `POST` | `/engagement/heartbeat` | Record server-owned foreground activity without changing progression | `{ serverTime }` |
| `POST` | `/engagement/royal-decree/claim` | Settle completed Royal Decree I once | `RoyalDecreeClaimResponse` |

## Shop

| Method | Path | Purpose | Requirements and response |
| --- | --- | --- | --- |
| `GET` | `/shop` | Return Gem balance, cosmetics, ownership/equip state, live finish offers, and Gem sources | `ShopStateResponse` |
| `POST` | `/shop/purchases` | Purchase a catalog cosmetic or finish an owned active timer | `{ itemKey, targetId? }`, idempotency key; `ShopPurchaseResponse` |
| `PUT` | `/shop/cosmetics/profile-crest` | Equip Default or an owned permanent Crest | `{ itemKey }`; `EquipProfileCrestResponse` |

Purchase requests accept no price, discount, Gem deduction, balance, remaining time, target result, or entitlement. Unknown DTO fields are stripped. The server derives catalog state and target ownership in the locked transaction.

## Internal-only modules

`NotificationService` has no controller. Redis and BullMQ expose no HTTP route. Platform adapters expose no authentication, notification, or payment controller.

## Onboarding

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/onboarding` | Return or history-reconcile persistent onboarding state |
| `POST` | `/onboarding/start` | Move a new player from Welcome to the real Collect step |
| `POST` | `/onboarding/skip` | Persist Skip without rewards, activation, or synthetic gameplay |
| `GET` | `/onboarding/advisor-tips` | Return durable one-time contextual advisor keys already seen |
| `POST` | `/onboarding/advisor-tips/:tipKey` | Idempotently mark one supported contextual advisor tip seen |

Supported advisor keys are `HEROES_INTRO`, `CASTLE_PROGRESSION`, `NEW_KINGDOM_SHIELD`, `DEFENSE_INBOX`, `REVENGE`, and `CAMPAIGN_INTRO`. They are presentation state only and grant no gameplay authority.

The client cannot post a step or completion. Successful Collect, building Upgrade start, and standard Raid settlement advance the state inside server-owned write paths.

## `POST /analytics/events`

Accepts 1-20 `app_open`, `app_resume`, `screen_opened`, `retention_screen_opened`, `onboarding_started`, or `onboarding_step_seen` events with UUID event/session IDs. Player/platform are server-resolved. Optional locale, app version, sanitized acquisition source, client timestamp, and properties up to 2 KB are supported. Returns `accepted`, `duplicates`, and `rejected`; server-only names such as `onboarding_completed` fail validation.

## Error families

Shared contracts define `EconomyErrorCode`, `HeroErrorCode`, `ArmyErrorCode`, `RaidErrorCode`, and `RetentionErrorCode`. Services use domain errors for ownership, state, expiry, funds, completion, capacity, formation validity, claim order, idempotency, rate limits, and transaction conflicts. NestJS global validation strips unknown DTO fields and transforms validated input.
