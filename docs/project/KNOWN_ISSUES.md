---
title: Check known limitations and issues
navLabel: Known Issues
contentType: Troubleshooting
---

# Check known limitations and issues

The current repair passes unit, integration, audio-boundary, type, lint, documentation, and production build checks. Browser automation normally covers the mobile flow, but no browser binding was available for this run. The list separates accepted limitations from confirmed defects.

## Known limitations

### Production audio still needs real-device mix review

The product owner approved all 24 licensed production choices. Derived 2.5-second circular-crossfade loop masters pass three-boundary technical validation, but were **not audibly verified**. The owner must listen through at least three Kingdom and Battle boundaries and review the complete mix on headphones, desktop speakers, a real phone, and later Bale WebView.

### Aren art and browser screenshots need owner/manual review

The older Aren portrait is a current generated candidate, not final owner-approved art. Target geometry unit tests pass at 320x568, 375x812, and 390x844, but no in-app/connected browser was available for this repair run, so the required screenshots and real tap flow remain manually unverified.

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
