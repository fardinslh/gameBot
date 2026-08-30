---
title: Preserve security and game-state integrity
navLabel: Security and Integrity
contentType: Reference
---

# Preserve security and game-state integrity

Current integrity controls protect local authoritative game state. Production authentication, distributed rate limiting, and platform delivery remain pending.

## Server authority

The API decides balances, time, production, costs, storage, unlocks, levels, Hero stats, troop counts, training time/completion, Army capacity, formation validity, Match Offers, battle outcomes, loot, Trophies, Retention progress/periods/eligibility, and rewards. Clients send action intent and persistent IDs.

Do not accept client-computed amounts, durations, target players, combat stats, event streams, or outcomes in future endpoints.

## Idempotency

`EconomyRequest` stores mutation responses by player, key, and action. Collect, building upgrade start/completion, Hero upgrade, troop training, Raid start, and Revenge start validate keys between 8 and 100 characters.

A retry with the same tuple returns the stored response. Unique constraints prevent two stored responses for one action key. Mission, Daily bonus, Achievement, and Daily Return claims use dedicated `EconomyAction` values, the same key validation, and database uniqueness on their semantic claim identity.

## Transaction locking

Economy, Hero, and Army mutations acquire `pg_advisory_xact_lock(hashtext(platform:externalUserId))`. Army reads reconcile a due training order under the same lock; its conditional status transition grants trained troops exactly once. Raid and Revenge resolve both participant identities, sort by player ID, then acquire both locks in that order. Stable ordering prevents two concurrent battles from deadlocking by reversing participants.

Revenge start also locks its target row with `FOR UPDATE`. System-opponent replenishment uses the same stable platform-identity advisory lock before it re-reads or changes balances, preventing concurrent searches from double-granting resources. Services retry serialization conflicts where applicable.

## Resource ledger

Every authoritative balance mutation records before, delta, after, reason, and reference in `EconomyTransaction`. Raid transfers write paired loss and reward records with one Battle ID. Conditional decrements prevent negative charged or looted balances.

Troop training computes cost and duration from server configuration, conditionally debits resources, records `TROOP_TRAINING` ledger rows, creates one active order, and stores the idempotent response in the same transaction. The client cannot submit prices, duration, ready counts, capacity, or completion.

## Battle integrity

The server creates the seed and fixes `rulesVersion`. New battles store six Army squad snapshots and ordered events; historical version-1 battles retain six Hero snapshots. Playback dispatches by stored version and never reads current formation or Hero state.

Match Offers bind attacker and defender, expire after 180 seconds, and become single-use. Search also binds a stable SHA-256 fingerprint of the attacker's ordered formation, troop quantities, Commander ownership/key, and Commander levels. Under the participant locks, start returns a prior idempotent response first, then reconciles and compares the current attacker Army before any settlement side effect. Changed and pre-cutover null-fingerprint offers are rejected; the defender remains current at start. The endpoint also validates caller ownership and rejects self attacks. Real matchmaking is bounded to ±450 Trophy and ±40% power at its widest; protected or recently farmed real defenders cannot be selected, and the fallback is a server-owned system opponent.

## Launch protection boundaries

`Player.isSystemOpponent` is a server-owned database field and is never inferred from display name or accepted from the client. New-player protection is derived from persistent `Player.createdAt` for 24 hours. Its API countdown is paired with server time. System replenishment is ledgered, system Trophy values remain stable, and system defenders are excluded from human notification/Revenge creation.

## Revenge integrity

Revenge targets bind owner, target, and source battle. SQL and service checks reject self-Revenge. Expiry, source battle direction/result, status, row lock, and one-to-one Battle relation enforce single use. Revenge battles do not create more targets.

## Notification integrity

Unique `sourceKey` values make `PLAYER_RAIDED`, `REVENGE_AVAILABLE`, and `UPGRADE_COMPLETE` records exactly once. Deep-link intents contain domain IDs rather than platform URLs.

## Analytics integrity and privacy

Clients cannot choose player identity or emit progression events. Ingestion enforces batch, UUID, taxonomy, length, 2 KB property, and process-local rate bounds. Stable dedupe keys prevent replay inflation. System opponents are excluded from human milestones. Raw URLs, launch/auth payloads, credentials, and security/reward authority are not analytics properties.

## Retention integrity

The client cannot post progress, completion, UTC period, day index, reward amount, balance, or claim timestamp. Progress is reconstructed from immutable economy requests/transactions, upgrades, battles, buildings, and Trophy history. Claim endpoints accept no body, acquire the Player advisory lock, re-evaluate eligibility in the write transaction, and settle balance, ledger, claim row, idempotent response, and analytics together. Current-period checks reject stale or foreign mission IDs; tier ordering rejects skipped Achievement claims.

Campaign stage gates, NPC Armies, results, stars, and rewards are server-owned. Start and milestone claims accept no authority-bearing body, run under the Player advisory lock, and replay by idempotency key. `SystemOpponentKind` separates Campaign NPCs from Raid matchmaking. Campaign resolution cannot create Trophy, loot-transfer, Revenge, notification, shield, anti-farm, or permanent-casualty state.

## Current security gaps

- `X-Dev-Player-Id` is caller-controlled and provides no authentication
- Bale and Telegram payload verification do not exist
- Web sessions, cookies, access tokens, and account linking do not exist
- The Raid rate limiter uses process memory and does not coordinate multiple API instances
- CORS reads one configured origin but the project has no production deployment policy
- BullMQ has no worker security or job validation because no jobs exist
- External notification delivery and payment verification do not exist
- Administrative tools and audit access controls do not exist
- Disposable fresh-account system-opponent farming is an acceptable but monitored soft-launch risk; no device fingerprinting exists

Keep these gaps labeled as pending. Do not claim production security from the current development identity.
