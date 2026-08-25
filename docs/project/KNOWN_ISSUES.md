---
title: Check known limitations and issues
navLabel: Known Issues
contentType: Troubleshooting
---

# Check known limitations and issues

The current baseline passes unit, integration, browser, type, lint, and production build checks. The list separates accepted limitations from confirmed defects.

## Known limitations

### Development identity has no authentication

`PlayerContextService` trusts `X-Dev-Player-Id` or `DEV_PLAYER_ID`. This setup supports local isolation and browser tests. It cannot protect a production account.

### Platform adapters reject real operations

Bale, Telegram, and Web placeholder adapters reject authentication, user lookup, notification send, and payment creation. Platform enum values and environment names do not indicate working integration.

### Notifications remain database-only

The API stores notification records and uses them for inbox unread state. No notification feed controller, delivery worker, bot transport, or push channel exists.

### BullMQ has no gameplay work

The API creates a `game-jobs` queue handle when Redis is enabled. No producer or worker uses it. Upgrade completion happens during reads and explicit completion collection.

### Higher appearance variants use fallback art

Buildings return `STONE` at level 5 and `FORTIFIED` at level 10. Missing stage 2 and stage 3 files cause the loader to keep Stage 1 art.

### Some local building assets are unused

Barracks, Granary, Tavern, and Stable assets and future layout entries exist. The active scene and server shared building list exclude them.

### Development matchmaking uses seeded opponents

Raid search creates five persistent development opponents when needed. Production matchmaking population and anti-bot policy remain undefined.

### Rate limits are process-local

`RaidRateLimiter` stores counters in memory. Multiple API processes would enforce independent limits.

### Balance values remain temporary

Production, costs, timers, capacity growth, Hero curves, effects, Raid loot, and Trophy bounds are working config rather than final economy tuning.

### Old comparison assets remain in the repository

Older terrain files consume repository space but do not load at runtime. They remain for comparison and rollback.

## Confirmed bugs

No open reproducible gameplay bug is documented at commit `8b05b7330739ef0648736718fc0f3868a81eb7d5`. Add a bug here only with reproduction steps, affected commit, and expected behavior.
