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
| `npm test` | 66 tests in 20 files for economy/Hero/Army/Campaign/Shop config, battle/progression goals and effects, analytics, system-opponent config, shield, bounded passes, ranking, and top-five selection |
| `npm run test:integration` | 84 tests in 9 files: economy, Heroes, Army bootstrap/training/formation, versioned Raid/Revenge including Army-offer cutover, Campaign, Shop authority/ledger/entitlement/concurrency/rollback, onboarding/advisor tips, analytics, and Retention |
| `npm run validate:army` | Exact troop config/capacity plus focused PostgreSQL bootstrap, system-player repair, economy, idempotency, concurrency, completion, ownership, and formation coverage |
| `npm run test:client-analytics` | 2 client analytics contract tests |
| `npm run test:client-experience` | 43 scheduler timing, overlapping-loop lifecycle, bus/mute/context/fallback, Battle-SFX, audition-catalog, bilingual advisor/Guide-content, and target-positioning tests |
| `npm run validate:building-evolution` | 30 client tests covering DEFAULT registration, all 20 visual levels across nine active buildings, theme paths, adjacent differences, transitions, construction, stable selection/hit areas, and collision-proof status stacks, plus 45 WebP integrity/budget checks |
| `npm run audit:building-textures` | Sharp metadata and alpha scan for all 45 DEFAULT textures, including opaque bounds and DPR-2 source/display ratios at 320/375/390 and 100/150/200% |
| `npm run test:rtl --workspace @crown-and-coin/game-client` | 7 unit/render tests for locale-direction mapping, semantic game-root attributes, Persian/English numeral formatting and parsing, `<bdi>` isolation, and punctuation outside placeholders |

Integration tests need the configured PostgreSQL database. They create isolated development players and write test rows.

## Runtime and browser validation

These scripts require the API and client to be running unless the command states otherwise:

| Command | Main checks |
| --- | --- |
| `npm run validate:runtime` | Applies migrations, starts/checks API, PostgreSQL and Redis health, client reachability, 320-pixel Persian layout |
| `npm run validate:client` | Five-building Castle 1 scene, all active taps, Collect, Mine upgrade persistence/completion, RTL, mobile overflow |
| `npm run validate:heroes` | Three starters, portraits, detail, team reorder/save/reload, Hero upgrade charge, Kingdom return smoke test |
| `npm run validate:raid` | New-player shield/system offer, Army Match Offer and changed-Army rejection/fresh-search recovery, immediate training HUD balances, deterministic victory/defeat, three-lane Pixi playback, six Army snapshots/events, settlement, Kingdom HUD refresh, mobile locales |
| `npm run validate:revenge` | Incoming Raid badge, inbox, preview, Revenge battle/result, used state, mobile locales |
| `npm run validate:visual` | Castle 1 world, bounded pan, active detail, locked exclusion, 54-pixel nav, asset budgets |
| `npm run validate:progression` | Stages 1 through 5 with 5/6/7/8/9 buildings, lazy advanced assets, camera bounds, Mine point, public milestone/effect contract, hidden feature-metadata exclusion, Kingdom Progress UI, effects, screenshots |
| `npm run validate:player-experience` | Fresh Persian authoritative Collect/Upgrade/Raid/Battle/Result flows at 320/375/390, CTA/advisor non-overlap, refresh and skip persistence, nine Guide sections, technical audio triggers/settings, and RTL/LTR |
| `npm run validate:campaign` | Campaign config and integration authority plus Persian/English 320/375/390 map, lock, detail, Battle, result, stars, milestone, overflow, console, and screenshot validation |
| `npm run validate:retention` | Daily Return, three Daily missions, nine Achievement families, Persian RTL, English LTR, exact 54px navigation, no overflow, and clean console at 320/375/390 |
| `npm run validate:shop` | Shop config and 12 integration cases plus Persian/English 320/375/390 purchase/equip/persistence, live Building/training offers, forged-price defense, uncapped Gem HUD, screenshots, overflow, navigation, and console validation |
| `npm run validate:economy-hud` | Controlled normal/full/overflow storage, capacity-aware Collect, 900ms exact count-up, positive gains, reduced motion, Persian/English 320/375/390, 54px navigation, overflow, screenshots, and browser console |
| `npm run validate:rtl` | Real-browser semantic/computed RTL/LTR, document metadata, isolated names/numbers/timers/signed values, English regression, mobile overflow, and required screenshots |
| `npm run validate:typography` | Runs the RTL suite plus computed Vazirmatn/system-font separation, a 10px visible production text floor, control-clipping checks, 54px navigation, and Persian/English Kingdom, Building, Army, Commander, Raid, Battle, Campaign map/detail screenshots |
| `npm run validate:audio-lab` | Starts or reuses a development client; checks all 24 approved assets, decoded peak headroom, the completed Audio Lab state, and 320/375/390 layout |
| `npm run validate:audio-loops` | Decodes both approved music sources and checks 19 format/timing/equal-power rules across three overlapping transitions per track |
| `node scripts/validate-building-art.mjs` | Detailed building placement, source registration, layers, mobile screenshots, and asset checks |
| `npm run capture:building-evolution` | Development Lab levels 1/5/9/13/17/20, isolated 1-vs-20 sheets, exact status-stack assertions for nine buildings/four inspectable states, optional 200% fidelity/badge captures, and 320/375/390/520 Persian Kingdom captures |

Browser scripts locate installed Edge or Chrome through known Windows paths and use Playwright Core. They fail on browser console errors and horizontal overflow.

## Mobile matrix

Visual, Hero, Raid, Revenge, progression, and Retention scripts use:

- 320 by 568
- 375 by 812
- 390 by 844

They cover English left-to-right and Persian right-to-left where relevant. Keep bottom navigation height at 54 pixels unless a scoped product change approves another value.

For localization changes, also open `/dev/rtl` in development. Verify the Persian paragraph, final punctuation, mixed player names, `12,500`, `+18`, `-12`, `12:05`, parentheses, and the English comparison. Source-string matching is not an RTL validator; acceptance requires semantic DOM plus computed browser direction.

For typography changes, run `npm run validate:typography`. Inspect the generated files under `artifacts/typography-audit/`, especially Persian 320x568. Automation can prove font resolution, size floors, clipping, overflow, navigation height, and console cleanliness; it cannot approve visual taste. Keep **OWNER TYPOGRAPHY REVIEW PENDING** until the owner reviews screenshots or a real device.

## Manual acceptance paths

For Kingdom changes, inspect Castle 1 and Castle 5, pan to both world extremes, tap every active building, and verify HUD/sheet clearance. For Hero changes, save a reordered team and refresh. For Raid or Revenge changes, complete a battle, inspect the stored replay, and return to Kingdom to confirm balances.

For storage/Collect changes, verify production below room, partial room, exact full, preserved overflow, resume-after-spend, and uncapped Gems. During successful Collect, confirm displayed values count from the previous authoritative balance to the exact response balance, only positive resources show `+gain`, Persian digits remain localized, and reduced motion snaps without counting.

For building evolution, open `/dev/buildings`, confirm `Theme DEFAULT`, compare every quick tier for all nine active buildings, then use N vs N+1 at representative minor upgrades including 1→2, 6→7, and 19→20. Toggle Construction and inspect 100/150/200%. Verify Lv. 1/8/12/20 references in the 320/375/390 viewport-equivalent panels. Inspect Castle Kingdom Progress at Castle 1 and 5. In the exact-production status fixture, inspect every active building in normal, upgrade, active, and selected-plus-upgrade states; `data-status-overlap` must remain `false` and `data-status-stack-aligned` must remain `true` whenever an indicator is visible. Owner judgment—not passing automation—approves art quality.

For Army, open `/dev/army` in development. Confirm starter counts 20/15/10, capacity 60/45/0/15 at Castle 1, the Knight/Ranger/Mage default formation, squad/Army power, and per-unit costs/time. Start five Infantry through the API, confirm a 10-second authoritative order and one Food/Gold charge, refresh before and after completion, then save and reload a valid formation. Complete a normal Raid and Revenge and verify rules version 2, six Army snapshots, visible remaining-unit losses, no permanent troop deduction, and a historical rules-version-1 replay.

For player experience, use a fresh identity, choose Start, perform a real Collect, open Farm, confirm the complete Aren unit does not overlap the full Upgrade CTA, start the upgrade, follow Raid/Find/Attack, complete Battle/Result, return to Kingdom, then refresh and confirm `COMPLETED`. Confirm the five contextual tips each appear once, and separately verify skip persistence. Capture Aren Welcome, Collect, Upgrade, Raid, Find Enemy, Heroes counsel, and Guide at the supported mobile sizes.

For audio selection, run the client in development, open `/dev/audio`, compare every required A/B/C group, and record the human choice in [the audition guide](AUDIO_AUDITION.md). A local shortlist is not production approval. For loop acceptance, press **Test Kingdom Loop** at least three times. It starts eight seconds before the boundary and uses the exact production scheduler. Automated audio validation is technical only; listen on real target devices before launch.

## Analytics validation

Run `npm test` for taxonomy/report windows, `npm run test:integration` for database dedupe/rollback/system exclusion, `npm run analytics:check` for live integrity, and `npm run analytics:report -- --json` for an operator report. Fixtures are explicit and cleaned up.

## Documentation validation

`npm run validate:docs` checks the required canonical files, root AI entry links, baseline marker, README entry, and forbidden placeholder markers. It does not prove prose accuracy; compare formulas and routes against source before changing this documentation.
