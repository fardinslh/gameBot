---
title: Understand the Shop and Gem economy
navLabel: Shop and Gems
contentType: Reference
---

# Understand the Shop and Gem economy

Retention 05 enables the fifth navigation destination and introduces the first real Gem sinks. Gems are the premium in-game currency, but they are currently earned only through play. No payment, real-money Gem acquisition, paid random loot, Battle-outcome purchase, or Trophy purchase exists.

## Gem rules

- New players start with **120 Gems**.
- Gems remain a `ResourceBalance` resource and every spend creates an immutable `EconomyTransaction` with reason `SHOP_GEM_SPEND`.
- Gems have **no storage cap**. Gold, Food, Wood, and Stone retain Castle-derived limits.
- Current faucets are Daily Missions, Weekly Missions, the Daily-completion bonus, Achievement claims, and Daily Return. Raid, Revenge, and Broken Frontier Campaign rewards never grant or transfer Gems.
- Current sinks are three permanent Profile Crests and optional completion of an active Building Upgrade or troop-training order.

## Production catalog

| Item | Type | Price |
| --- | --- | ---: |
| `PROFILE_CREST_FOREST` | Permanent cosmetic | 40 Gems |
| `PROFILE_CREST_CRIMSON` | Permanent cosmetic | 70 Gems |
| `PROFILE_CREST_ROYAL` | Permanent cosmetic | 120 Gems |
| `BUILDING_FINISH` | Current active Building Upgrade | `ceil(remaining seconds / 60)`, minimum 1, maximum 50 Gems |
| `TROOP_TRAINING_FINISH` | Current active training order | `ceil(remaining seconds / 30)`, minimum 1, maximum 20 Gems |

Catalog entries and pricing functions live in `shop.config.ts`. The client receives display prices from `GET /shop` and submits only an item key plus an optional target ID. It never submits an accepted price, discount, balance, remaining duration, completion result, entitlement, or target owner.

## Purchase authority and evidence

`ShopService` resolves the authenticated development identity, acquires the existing per-player PostgreSQL advisory lock, reconciles naturally completed upgrades and training, reloads the target, derives its remaining time and price, validates ownership and Gem balance, and performs the entire purchase in one database transaction.

The transaction creates a `ShopPurchase` evidence row, conditionally debits Gems, creates the paired `EconomyTransaction`, fulfills the target or entitlement, builds the response, and stores the idempotent `EconomyRequest`. Any fulfillment failure rolls back all writes. Repeated requests with the same player, `SHOP_PURCHASE` action, and idempotency key return the stored response. Unique entitlement and purchase constraints prevent duplicate permanent ownership during concurrent requests.

Building and training finishes call the same shared completion helpers used by natural reconciliation. This preserves level changes, Castle mirroring, troop counts, completion notifications, and analytics without duplicating gameplay rules. A naturally completed or foreign target cannot be charged.

## Entitlements and Profile Crests

`PlayerEntitlement` stores generic permanent ownership with unique `(playerId, entitlementKey)` identity, source, and source reference. Retention 05 uses source `SHOP`. This boundary is intentionally reusable by Retention 05B, but no Kingdom Theme ownership or selection is implemented here.

`Player.equippedProfileCrest` stores `DEFAULT`, Forest, Crimson, or Royal. Equipping is free after ownership validation. The selected Crest changes only the compact Player header presentation; it grants no economy, Army, Battle, loot, Trophy, progression, or matchmaking effect.

## API and client

- `GET /shop` returns the authoritative Gem balance, cosmetic catalog/ownership/equip state, live eligible Building/training finish offers, Gem-source labels, and server time.
- `POST /shop/purchases` requires `Idempotency-Key` and accepts `{ itemKey, targetId? }`.
- `PUT /shop/cosmetics/profile-crest` accepts `{ itemKey }` and validates ownership.

React owns the Shop screen, custom confirmation dialog, localized feedback, and contextual Finish controls in Building Detail and Army training. Pixi Kingdom coordinates and interaction are unchanged. Persian RTL and English LTR share one layout; the compact bottom navigation remains 54px.

## Analytics and security

Server events are `shop_purchase_completed` and `shop_cosmetic_equipped`. Client events are `shop_opened` and `shop_purchase_failed`. Analytics never authorizes or fulfills a purchase.

Validation covers forged price fields, insufficient balance, disabled/unknown items, foreign targets, idempotent replay, double-buy concurrency, target completion races, natural-completion races, rollback after forced fulfillment failure, equip persistence, uncapped Gems, and mobile browser flows.

## Retention 05B boundary

Retention 05B — Kingdom Themes Foundation and First Historical Theme is next and **not started**. It may reuse the generic entitlement and Shop boundaries, but Retention 05 contains no Theme catalog, Theme purchase, Theme selection, Theme asset set, Guild, Bale, payment, or monetization integration.
