---
title: Check known limitations and issues
navLabel: Known Issues
contentType: Troubleshooting
---

# Check known limitations and issues

The current baseline passes unit, integration, browser, type, lint, and production build checks. The list separates accepted limitations from confirmed defects.

## Known limitations

### Audio has no human listening sign-off

Automated checks verify file presence, duration/size budgets, browser playback calls, context switching, and settings persistence. This environment cannot prove subjective loudness, mix quality, or speaker/device behavior; a human must audibly verify both music tracks and focused SFX before launch.

### Bale lifecycle is not integrated

Onboarding recovery and audio visibility handling work in Web browsers. Bale launch parameters, authenticated identity, lifecycle/reconnect behavior, device autoplay policy, and real-device audio remain unimplemented and untested.

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

### Disposable-account shield farming remains possible

A user can create disposable fresh development identities and farm system opponents during the 24-hour shield. This is an acceptable but monitored risk for the initial small cohort. Verified Bale identity, analytics, and production abuse controls are not implemented; no invasive device fingerprinting is used.

### System-opponent tuning is temporary

The 30-opponent, six-tier pool is production-intent cold-start infrastructure, but names, Trophy ranges, Hero levels, and replenishment resource targets remain soft-launch tuning rather than live-ops content.

### Rate limits are process-local

`RaidRateLimiter` stores counters in memory. Multiple API processes would enforce independent limits.

### Balance values remain temporary

Production, costs, timers, capacity growth, Hero curves, effects, Raid loot, and Trophy bounds are working config rather than final economy tuning.

### Old comparison assets remain in the repository

Older terrain files consume repository space but do not load at runtime. They remain for comparison and rollback.

## Analytics limitations

- Rate limiting is process-local until multi-instance topology needs a distributed limiter.
- Offline delivery is best-effort/session-scoped; closing a tab can lose client-only events.
- Retention is directional below mature-cohort thresholds.
- Historical players are not synthetically backfilled with `player_created`.

## Confirmed bugs

No open reproducible gameplay bug is documented for the Launch-Safety PvP baseline. Add a bug here only with reproduction steps, affected commit, and expected behavior.
