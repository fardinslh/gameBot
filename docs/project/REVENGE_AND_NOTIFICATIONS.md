---
title: Understand Revenge and notifications
navLabel: Revenge and Notifications
contentType: Reference
---

# Understand Revenge and notifications

A successful incoming standard Raid can create one defender-owned Revenge opportunity. Notifications store the return-loop context in platform-neutral JSON.

## Defense inbox

`GET /raid/inbox` returns the 20 most recent battles where the caller defended. Each entry contains the attacker, battle type, time, defense result, loot lost, defender Trophy delta, Revenge status, target ID, and expiry.

Before reading inbox data, the API changes due `AVAILABLE` targets to `EXPIRED`. The unread count includes unread `PLAYER_RAIDED` notifications. `POST /raid/inbox/read` marks unread `PLAYER_RAIDED` and `REVENGE_AVAILABLE` notifications as read.

## Revenge target creation

`RaidService.resolveBattle` creates a target only when:

- Battle type is `RAID`
- The attacker wins
- The defender is a real Player, not a system opponent

The target belongs to the defender, points at the original attacker, and expires after 24 hours. `sourceBattleId` is unique, so one source battle cannot create two targets.

## Revenge validation

Preview and start require target ownership, distinct players, `AVAILABLE` state, and future expiry. Start also verifies that the source is a standard Raid won by the original attacker against the Revenge owner.

`POST /raid/revenge/start` locks both players in sorted order and acquires a row lock on the `RevengeTarget`. It returns a stored response for an idempotent retry, otherwise resolves a `REVENGE` battle and marks the target `USED` in one transaction.

Revenge reads both players' current Army Formations and current balances. It does not reuse the source battle snapshots or source loot. It reuses the same Army snapshot format, rules-version-2 battle engine, event persistence, loot calculator, Trophy calculator, ledger, and replay response as Raid. Historical rules-version-1 battle detail remains readable.

## Loop prevention

A `REVENGE` battle cannot create another `RevengeTarget`. The service only enters target creation for `BattleType.RAID`. This rule prevents alternating Revenge chains.

## Notification records

`NotificationService.createNotification` upserts by unique `sourceKey`, which makes each domain notification exactly once.

| Type | Created by | Deep-link intent |
| --- | --- | --- |
| `PLAYER_RAIDED` | Standard Raid against a real defender | `{ screen: 'INBOX', battleId }` |
| `REVENGE_AVAILABLE` | Attacker victory with a created target | `{ screen: 'REVENGE', revengeTargetId }` |
| `UPGRADE_COMPLETE` | Building upgrade reconciliation | `{ screen: 'BUILDING', buildingId }` |

Payloads store structured context such as names, IDs, loot, Trophy change, level, and expiry. `deliveryStatus` only supports `STORED`.

## Current delivery boundary

No notification controller exposes a general notification feed. The defense inbox queries battle data and notification counts, then marks incoming types through `NotificationService`.

Bale and Telegram delivery remain unimplemented. Placeholder adapters reject `sendNotification`; no bot token, platform URL, webhook, or queue worker participates in notification delivery.
