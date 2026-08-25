---
title: Preserve security and game-state integrity
navLabel: Security and Integrity
contentType: Reference
---

# Preserve security and game-state integrity

Current integrity controls protect local authoritative game state. Production authentication, distributed rate limiting, and platform delivery remain pending.

## Server authority

The API decides balances, time, production, costs, storage, unlocks, levels, Hero stats, Match Offers, battle outcomes, loot, Trophies, Revenge eligibility, and rewards. Clients send action intent and persistent IDs.

Do not accept client-computed amounts, durations, target players, combat stats, event streams, or outcomes in future endpoints.

## Idempotency

`EconomyRequest` stores mutation responses by player, key, and action. Collect, building upgrade start/completion, Hero upgrade, Raid start, and Revenge start validate keys between 8 and 100 characters.

A retry with the same tuple returns the stored response. Unique constraints prevent two stored responses for one action key.

## Transaction locking

Economy and Hero mutations acquire `pg_advisory_xact_lock(hashtext(platform:externalUserId))`. Raid and Revenge resolve both participant identities, sort by player ID, then acquire both locks in that order. Stable ordering prevents two concurrent battles from deadlocking by reversing participants.

Revenge start also locks its target row with `FOR UPDATE`. Services retry serialization conflicts up to three times.

## Resource ledger

Every authoritative balance mutation records before, delta, after, reason, and reference in `EconomyTransaction`. Raid transfers write paired loss and reward records with one Battle ID. Conditional decrements prevent negative charged or looted balances.

## Battle integrity

The server creates the seed and fixes `rulesVersion`. It stores six Hero snapshots and ordered events. Historical playback reads those records instead of current Hero state.

Match Offers bind attacker and defender, expire after 180 seconds, and become single-use. The start endpoint validates caller ownership and rejects self attacks.

## Revenge integrity

Revenge targets bind owner, target, and source battle. SQL and service checks reject self-Revenge. Expiry, source battle direction/result, status, row lock, and one-to-one Battle relation enforce single use. Revenge battles do not create more targets.

## Notification integrity

Unique `sourceKey` values make `PLAYER_RAIDED`, `REVENGE_AVAILABLE`, and `UPGRADE_COMPLETE` records exactly once. Deep-link intents contain domain IDs rather than platform URLs.

## Current security gaps

- `X-Dev-Player-Id` is caller-controlled and provides no authentication
- Bale and Telegram payload verification do not exist
- Web sessions, cookies, access tokens, and account linking do not exist
- The Raid rate limiter uses process memory and does not coordinate multiple API instances
- CORS reads one configured origin but the project has no production deployment policy
- BullMQ has no worker security or job validation because no jobs exist
- External notification delivery and payment verification do not exist
- Administrative tools and audit access controls do not exist

Keep these gaps labeled as pending. Do not claim production security from the current development identity.
