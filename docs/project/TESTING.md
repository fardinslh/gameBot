---
title: Validate Crown & Coin changes
navLabel: Testing
contentType: How-to
---

# Validate Crown & Coin changes

Choose validation by the affected boundary. Authoritative logic needs unit and integration coverage; visual changes need browser screenshots at the supported mobile sizes.

## Static and production checks

| Command | Coverage |
| --- | --- |
| `npm run typecheck` | Builds packages and type-checks shared, platform, API, and client |
| `npm run lint` | Current client lint alias, TypeScript no-emit check |
| `npm run build` | Shared/platform TypeScript builds, Nest production build, Next production build |

## Automated API tests

| Command | Coverage at verified baseline |
| --- | --- |
| `npm test` | 39 unit tests in 12 files: economy/Hero/battle/progression, analytics, system-opponent config, shield, bounded passes, ranking and top-five selection |
| `npm run test:integration` | 47 tests in 5 files: economy, Heroes, Raid/Revenge, onboarding persistence/transitions, analytics, transactions and concurrency |
| `npm run test:client-analytics` | 2 client analytics contract tests |
| `npm run test:client-experience` | 10 audio runtime, Battle-SFX mapping, audition-catalog, and bilingual Guide-content tests |

Integration tests need the configured PostgreSQL database. They create isolated development players and write test rows.

## Runtime and browser validation

These scripts require the API and client to be running unless the command states otherwise:

| Command | Main checks |
| --- | --- |
| `npm run validate:runtime` | Applies migrations, starts/checks API, PostgreSQL and Redis health, client reachability, 320-pixel Persian layout |
| `npm run validate:client` | Five-building Castle 1 scene, all active taps, Collect, Mine upgrade persistence/completion, RTL, mobile overflow |
| `npm run validate:heroes` | Three starters, portraits, detail, team reorder/save/reload, Hero upgrade charge, Kingdom return smoke test |
| `npm run validate:raid` | New-player shield/system offer, Match Offer, victory and defeat, Pixi playback, snapshots/events, settlement, Kingdom HUD refresh, mobile locales |
| `npm run validate:revenge` | Incoming Raid badge, inbox, preview, Revenge battle/result, used state, mobile locales |
| `npm run validate:visual` | Castle 1 world, bounded pan, active detail, locked exclusion, 54-pixel nav, asset budgets |
| `npm run validate:progression` | Stages 1 through 5 with 5/6/7/8/9 buildings, expansion areas, camera bounds, Mine point, effects, screenshots |
| `npm run validate:player-experience` | Fresh Persian 320 flow through Collect/Upgrade/Raid/completion, skip persistence, eight Guide sections, technical audio triggers/settings, 320/375/390 RTL/LTR |
| `npm run validate:audio-lab` | Starts or reuses a development client; checks all 24 approved assets, decoded peak headroom, the completed Audio Lab state, and 320/375/390 layout |
| `node scripts/validate-building-art.mjs` | Detailed building placement, source registration, layers, mobile screenshots, and asset checks |

Browser scripts locate installed Edge or Chrome through known Windows paths and use Playwright Core. They fail on browser console errors and horizontal overflow.

## Mobile matrix

Visual, Hero, Raid, Revenge, and progression scripts use:

- 320 by 568
- 375 by 812
- 390 by 844

They cover English left-to-right and Persian right-to-left where relevant. Keep bottom navigation height at 54 pixels unless a scoped product change approves another value.

## Manual acceptance paths

For Kingdom changes, inspect Castle 1 and Castle 5, pan to both world extremes, tap every active building, and verify HUD/sheet clearance. For Hero changes, save a reordered team and refresh. For Raid or Revenge changes, complete a battle, inspect the stored replay, and return to Kingdom to confirm balances.

For player experience, use a fresh identity, choose Start, perform a real Collect, start a real Farm upgrade, complete a standard Raid, return to Kingdom, then refresh and confirm `COMPLETED`. Separately skip with another identity and confirm persistence.

For audio selection, run the client in development, open `/dev/audio`, compare every required A/B/C group, and record the human choice in [the audition guide](AUDIO_AUDITION.md). A local shortlist is not production approval. Automated audio validation is technical only; listen on real target devices before launch.

## Analytics validation

Run `npm test` for taxonomy/report windows, `npm run test:integration` for database dedupe/rollback/system exclusion, `npm run analytics:check` for live integrity, and `npm run analytics:report -- --json` for an operator report. Fixtures are explicit and cleaned up.

## Documentation validation

`npm run validate:docs` checks the required canonical files, root AI entry links, baseline marker, README entry, and forbidden placeholder markers. It does not prove prose accuracy; compare formulas and routes against source before changing this documentation.
