---
title: Check known limitations and issues
navLabel: Known Issues
contentType: Troubleshooting
---

# Check known limitations and issues

The current theme-ready evolution correction, unified building status stack, Castle composition correction, and Persian RTL corrective pass have targeted automated coverage. The list separates accepted limitations from confirmed defects.

## Known limitations

### Persian still needs final human device review

Automated semantic and visual checks now pass for Kingdom HUD, Building Detail, Aren, Heroes/Detail, Raid opponent, Battle Log, long Persian copy, mixed names, signed values, timers, and English regression at 320x568, 375x812, and 390x844. Final launch acceptance still requires a Persian-speaking human to inspect the target Bale device font, shaping, truncation, and copy tone. This is a human quality gate, not a known semantic RTL defect.

### Production audio still needs real-device mix review

The product owner approved all 24 licensed production choices. Production now uses scheduled overlapping sources with 128-sample equal-power curves: Kingdom overlaps for 3.5 seconds and Battle for 2.5 seconds. Scheduler and three-transition decoded-PCM checks pass, but the new overlap remains **not audibly verified**. The owner must use **Test Kingdom Loop** on `/dev/audio` for at least three transitions, then review the complete mix on headphones, desktop speakers, a real phone, and later Bale WebView.

### Aren art needs owner/manual review

The older Aren portrait is a current generated candidate, not final owner-approved art. Target geometry and the authoritative Collect → Upgrade → Raid → Battle → Result browser flow pass at 320x568, 375x812, and 390x844. Final owner review of the portrait and Persian copy remains required; the former Upgrade-target overlap is closed.

### Building evolution fidelity needs owner approval

Retention 01A and 01B contain five generated/curated raster tiers for all nine active buildings and pass metadata, effective-resolution, Lab, 200% inspection, and mobile capture gates. These are production-integrated candidates, not owner-approved final art. Review `/dev/buildings` at levels 1/5/9/13/17/20, N/N+1, and 100/150/200%. **ADVANCED BUILDING ART: OWNER APPROVAL PENDING.**

### Kingdom Themes are architecture-only

Building evolution accepts an explicit Theme and resolves through the `default` asset namespace, but `DEFAULT` is the only implemented catalog. No historical assets, selection UI, persistence, ownership, entitlement, Shop, Season, or gameplay unlock exists. Planned historical IDs must not be presented as available content.

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
