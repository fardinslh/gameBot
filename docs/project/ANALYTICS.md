---
title: Operate first-party analytics
navLabel: Analytics
summary: Canonical events, safe ingestion, activation, retention, and reporting.
---

# First-Party Analytics

## Authority and scope

The game API and PostgreSQL are canonical. `AnalyticsEvent` is append-only observational data, never economy/reward/security authority. Client delivery is best-effort and never blocks gameplay.

## Event contract

Events carry a UUID, server-resolved player, `SERVER` or `CLIENT` source, string name, schema version, platform, optional session/locale/app version/acquisition source, bounded JSON, server `occurredAt`, and optional informational `clientOccurredAt`. Unique dedupe keys make retries safe.

Server events: `player_created`, `collect_completed`, `first_collect`, `building_upgrade_started`, `first_upgrade`, `hero_upgrade_completed`, `raid_search`, `raid_started`, `raid_finished`, `raid_win`, `raid_loss`, `first_raid_completed`, `revenge_started`, `revenge_finished`, `daily_return_available`, `daily_return_claimed`, `daily_mission_completed`, `daily_mission_claimed`, `daily_all_completed`, `weekly_mission_completed`, `weekly_mission_claimed`, `achievement_completed`, and `achievement_claimed`.

Client events: `app_open`, `app_resume`, `screen_opened`, `retention_screen_opened`, `onboarding_started`, `onboarding_step_seen`. Server-only onboarding event: `onboarding_completed`.

Onboarding completion is a funnel milestone, not the activation definition. Activation and D1/D3/D7 retention remain anchored to the server-owned `first_raid_completed` event.

System opponents never receive human milestones. Critical server events share the authoritative gameplay transaction where practical.

## Ingestion and privacy

`POST /analytics/events` accepts 1-20 events. Player/platform are server-resolved; unknown fields including client `playerId` are stripped. Event/session IDs are UUIDs. Properties are limited to 2 KB with bounded keys/strings. A process-local limiter provides basic abuse protection.

The browser has one session UUID and a maximum 50-event `sessionStorage` queue. It flushes without blocking on start, next event, qualifying resume, and restored connectivity; no polling. Resume requires 30 seconds hidden. Screen transitions cover Kingdom, Heroes, Raid, Battle, Defense Inbox, and Result.

Acquisition reads sanitized `utm_source`, then `utm_campaign`, then `DIRECT`. Raw URLs, launch/auth payloads, credentials, and reward-sensitive values are not stored.

## Reporting

```bash
npm run analytics:report -- --json
npm run analytics:report -- --from 2026-08-01 --to 2026-09-01 --platform WEB --locale fa --source DIRECT
npm run analytics:check
```

Funnel: `player_created -> first_collect -> first_upgrade -> raid_search -> first_raid_completed`. Activation is `first_raid_completed`.

Retention uses server time relative to activation: D1 +24h to before +48h; D3 +72h to before +96h; D7 +168h to before +192h. Only mature activated cohorts enter denominators. Qualifying activity is `app_open` or collect, building/Hero upgrade, Raid search/finish, or Revenge finish. Screen/maintenance events do not qualify. D1 below 100 and D7 below 150 are directional only.

Reports include overall/daily funnel and activation, acquisition, retention, raids per activated player, win/loss, real/system share, Revenge attempts/completions, and collect/upgrade engagement. Retention 02 events are stored for later product analysis; they do not change the existing D1/D3/D7 definition or automatically add report sections.

## Tests and fixtures

Unit tests cover taxonomy and retention boundaries. Integration tests cover duplicates, system exclusion, property rejection, and transaction rollback. Fixtures are explicit and cleaned up; normal startup creates no synthetic analytics.
