# Crown & Coin

Crown & Coin is a portrait-oriented medieval strategy game. Through Phase 07.1, the client presents a pan-enabled, unlock-driven Kingdom with nine persistent progression buildings while preserving the authoritative Phase 03–06 gameplay loop. Guilds, payments, Bale/platform authentication, and external delivery remain out of scope.

## Architecture

```text
apps/
  game-client/       Next.js React HUD/game UI + PixiJS Kingdom/Battle scenes
  game-api/          NestJS authoritative economy/Hero/Raid API + Prisma
packages/
  shared/            API contracts shared by client and server
  platform/          Future platform adapter contract
infrastructure/      Local infrastructure notes
docker-compose.yml   PostgreSQL + Redis development services
```

The browser requests actions and renders authoritative responses. It never commits balances, production, prices, timers, levels, or upgrade results. `EconomyService` runs every mutation in a PostgreSQL transaction and takes a transaction-scoped advisory lock for the development player. Idempotency keys make network retries replay the stored response instead of granting rewards or charging resources twice.

The Kingdom client remains separated by responsibility:

```text
KingdomPage
├── KingdomScene          PixiJS world, hit areas, upgrade/timer indicators
├── useKingdomState       API state, server clock offset, action synchronization
├── PlayerHud             server player level, profile, language, API status
├── ResourceHud           authoritative balances
├── CollectControl        informational live preview + Collect action
├── BuildingDetailSheet   server production, costs, requirements, timer
└── BottomNavigation      Kingdom + unchanged coming-soon feedback
```

The game shell switches the enabled `Kingdom`, `Raid`, and `Heroes` views. The compact 54px navigation remains shared; Guild and Shop still show Coming Soon. The Hero client is isolated under `apps/game-client/src/features/heroes/`:

```text
HeroesPage
├── useHeroState          API state, Raid Team draft, upgrade synchronization
├── RaidTeamPanel         three tap-selectable ordered slots + save action
├── HeroCard              portrait-first roster summary + slot assignment
├── HeroDetailSheet       server stats, skill, Gold cost, upgrade action
└── Hero API              GET roster, save team, upgrade Hero
```

## Prerequisites and start

- Node.js 20.9 or newer
- npm 10 or newer
- Docker Desktop or another Docker Compose-compatible runtime

From the repository root:

```bash
docker compose up -d
copy .env.example .env
npm install
npm run prisma:deploy
npm run dev
```

On macOS/Linux use `cp .env.example .env`. `npm run prisma:migrate` creates a new development migration; normal setup should apply the committed migrations with `npm run prisma:deploy`.

URLs:

- Client: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health
- Kingdom: http://localhost:3001/kingdom
- Heroes: http://localhost:3001/heroes
- Raid: http://localhost:3001/raid

The health endpoint checks PostgreSQL and, in the normal Docker flow, Redis. If Docker is unavailable, `npx prisma dev -d -n crown-coin` can provide a local PostgreSQL TCP URL. Put that URL in `.env`; because Phase 03 correctness does not use BullMQ, `SKIP_REDIS_FOR_DEVELOPMENT="true"` may be used only for this fallback. Never enable that flag in a normal/production environment.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma and the API |
| `REDIS_URL` | Redis used by existing queue-ready infrastructure |
| `PORT` | NestJS port, default `3001` |
| `CLIENT_ORIGIN` | Allowed browser origin |
| `NEXT_PUBLIC_API_URL` | Client API base URL |
| `DEV_PLAYER_ID` | Single reusable Web development identity until real auth exists |
| `ECONOMY_TIMER_MULTIPLIER` | Development/test upgrade-time scale; `1` is normal |
| `SKIP_REDIS_FOR_DEVELOPMENT` | Optional local fallback only; omitted by default |

Platform token placeholders remain empty and must never contain committed secrets.

## Economy model

The migration `20260823030000_server_authoritative_economy` adds persistent `GOLD`, the Grand Market, `lastCollectedAt`, integer production remainders, `EconomyTransaction`, and `EconomyRequest`. It also adds database constraints for one building of each type per Kingdom and one active upgrade per building.

All displayed resources use integer smallest units stored as PostgreSQL `BIGINT`. Production rates and costs are rounded to integers once on the server. Fractional production is retained per building as an integer numerator remainder, preventing refresh/collection spam from losing or creating resources. Offline time is based only on server timestamps and clamped from zero to eight hours.

Current temporary balancing in `apps/game-api/src/economy/economy.config.ts`:

| Building | Produces/hour L1 | Growth | L1 upgrade cost | Cost growth | Base time | Time growth | Max |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Castle | — | — | 1000 Gold, 500 Wood, 500 Stone | 1.35 | 20s | 1.25 | 20 |
| Farm | 500 Food | 1.18 | 350 Gold, 120 Wood | 1.22 | 10s | 1.20 | 20 |
| Lumber Mill | 420 Wood | 1.18 | 400 Gold, 100 Food | 1.22 | 12s | 1.20 | 20 |
| Mine | 300 Stone | 1.18 | 450 Gold, 100 Food, 180 Wood | 1.22 | 14s | 1.20 | 20 |
| Grand Market | 380 Gold | 1.18 | 200 Food, 150 Wood, 120 Stone | 1.22 | 16s | 1.20 | 20 |
| Academy | — | — | 1200 Gold, 500 Wood, 700 Stone | 1.28 | 30s | 1.22 | 20 |
| Blacksmith | — | — | 900 Gold, 400 Wood, 600 Stone | 1.26 | 25s | 1.21 | 20 |
| Watchtower | — | — | 700 Gold, 550 Wood, 450 Stone | 1.24 | 22s | 1.20 | 20 |
| Workshop | — | — | 800 Gold, 700 Wood, 350 Stone | 1.25 | 24s | 1.20 | 20 |

Starting balances are 8000 Gold, 5000 Food, 5000 Wood, 3500 Stone, and 120 Gems. Levels 1–3 require Castle 1; levels 4–6 require Castle 2, continuing in three-level bands.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/kingdom` | Bootstrap if needed, reconcile upgrades, return the complete Kingdom state |
| `GET` | `/kingdom/buildings` | Return the authoritative building/progression status payload |
| `POST` | `/kingdom/collect` | Transactionally collect capped offline production |
| `POST` | `/kingdom/buildings/:buildingId/upgrade` | Validate, charge, log, and start one upgrade |
| `POST` | `/kingdom/buildings/:buildingId/upgrade/collect` | Authoritatively finish and collect a due upgrade |
| `GET` | `/heroes` | Bootstrap missing starter content and return owned Heroes, Raid Team, balances, and server-derived stats |
| `GET` | `/heroes/team` | Return the persisted ordered three-slot Raid Team |
| `PUT` | `/heroes/team` | Validate and persist exactly three unique owned Hero IDs |
| `POST` | `/heroes/:playerHeroId/upgrade` | Idempotently charge Gold, log the economy transaction, and increase Hero level |
| `GET` | `/raid` | Return Trophy rating, current authoritative team, power, and balances |
| `POST` | `/raid/search` | Match by Trophy/team power and issue one short-lived server Match Offer |
| `POST` | `/raid/start` | Validate one Match Offer, simulate, persist, and settle the Raid exactly once |
| `GET` | `/raid/history` | Return the participant's recent persisted Raid summaries |
| `GET` | `/battles/:battleId` | Return an authorized authoritative replay from stored snapshots/events |

Economy-changing requests require an `Idempotency-Key` header between 8 and 100 characters. An optional `X-Dev-Player-Id` selects an isolated development identity; otherwise the centralized `DEV_PLAYER_ID` value is used.

Example manual flow:

```bash
curl http://localhost:3001/kingdom
curl -X POST -H "Idempotency-Key: collect-001" http://localhost:3001/kingdom/collect
curl -X POST -H "Idempotency-Key: upgrade-001" http://localhost:3001/kingdom/buildings/BUILDING_ID/upgrade
curl http://localhost:3001/heroes
curl -X PUT -H "Content-Type: application/json" -d "{\"heroIds\":[\"HERO_1\",\"HERO_2\",\"HERO_3\"]}" http://localhost:3001/heroes/team
curl -X POST -H "Idempotency-Key: hero-upgrade-001" http://localhost:3001/heroes/PLAYER_HERO_ID/upgrade
```

Use the Farm `id` returned by `GET /kingdom` for `BUILDING_ID`. Set `ECONOMY_TIMER_MULTIPLIER="0.1"` before starting the API to make early manual timers ten times faster. There is no timer-skip endpoint.

## Hero architecture and temporary balance

The migration `20260823040000_hero_system` adds:

- `HeroDefinition`: shared content identity, archetype, base stats, integer growth basis points, skill, portrait path, order, and enabled state.
- `PlayerHero`: one owned progression row per Player and definition, with persistent level/XP.
- `RaidTeam`: one active Raid Team per Player.
- `RaidTeamSlot`: normalized ordered slots with database uniqueness for both slot and Hero.
- `HERO_UPGRADE` values in `EconomyTransactionReason` and `EconomyAction`.

The migration seeds the three definitions and backfills every existing Player with missing starter ownership and a Knight/Ranger/Mage team without changing Kingdom, resources, upgrades, or economy history. Runtime bootstrap repeats this safely with unique constraints and `createMany(..., skipDuplicates)` so refreshes and restarts cannot duplicate Heroes.

Centralized temporary content lives in `apps/game-api/src/heroes/hero.config.ts`:

| Hero | Class | L1 HP | L1 ATK | L1 DEF | Growth HP / ATK / DEF | Skill |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Knight | Tank | 1500 | 110 | 170 | 1.11 / 1.07 / 1.10 | Shield Wall |
| Ranger | Single-Target DPS | 1050 | 170 | 90 | 1.08 / 1.11 / 1.07 | Power Shot |
| Mage | AOE / Burst | 850 | 210 | 70 | 1.07 / 1.13 / 1.06 | Arcane Blast |

Stats use integer basis-point exponentiation with controlled half-up rounding:

```text
stat(level) = round(baseStat × growthBps^(level - 1) / 10000^(level - 1))
power = round(HP × 0.2 + ATK × 2 + DEF × 1.5)
upgradeGold(level) = ceil(300 × 1.35^(level - 1))
maximumLevel = 20
```

The client never submits level, stats, power, cost, balance, or ownership. Hero upgrades take the same PostgreSQL player advisory lock as Phase 03, conditionally decrement the GOLD balance, create one `EconomyTransaction(HERO_UPGRADE)` with before/delta/after/reference values, increment level, and persist an idempotent response in `EconomyRequest`.

## Phase 05 Raid architecture

The client submits only a `matchOfferId` and an idempotency key. It never submits a defender ID, Hero stats, damage, winner, loot, Trophy delta, or duration. `/raid/search` derives team power from the Phase 04 calculator and searches configurable passes: ±150 Trophy/±15% power, ±300/±30%, a wider non-repeat fallback, then a population-safe repeat fallback. The last five offered defenders are avoided where possible. Offers expire after 180 seconds and are single-use.

`POST /raid/start` snapshots all six Heroes (key, slot, level, HP, ATK, DEF, power, skill), creates a cryptographic server seed, and runs rules version `1` immediately. The persisted event stream is the only combat input used by Pixi playback, so historical replays do not change after Hero upgrades.

| Rule | Temporary value |
| --- | --- |
| Basic damage | `max(25, ATK - round(DEF × 0.35))`, then seeded 95–105% variance |
| Critical | seeded 10% chance, ×1.5 |
| Attack interval | Knight 1.4s, Ranger 1.2s, Mage 1.5s |
| Shield Wall | 35% reduction for 2.5s, 5.0s cooldown |
| Power Shot | 180% focused damage, 4.0s cooldown |
| Arcane Blast | 100% damage to every living enemy, 5.5s cooldown |
| Targeting | first living slot |
| Safety timeout | 30 logical seconds; remaining HP ratio resolves it |
| Replay duration | event timeline scaled to 8–15 seconds |

All randomness comes from `seeded-random.ts`; authoritative engine code does not call `Math.random()`. Battle rows store the seed, rules version, result, six snapshots, ordered events, Trophy values, loot, and timestamps.

### Loot, Trophy, and transaction safety

Gems are never raidable. Final loot is recalculated during settlement as the minimum of the exposed 30%, the amount above the reserve, and the cap:

| Resource | Cap | Defender reserve |
| --- | ---: | ---: |
| Gold | 8,000 | 2,000 |
| Food | 6,000 | 1,000 |
| Wood | 5,000 | 1,000 |
| Stone | 4,000 | 800 |

The temporary rating formula lightly adjusts for rating difference: winners gain 15–30 and losers lose 5–20, with a floor of zero. Battle persistence, offer consumption, Trophy changes, balance transfer, and the idempotent response share one PostgreSQL transaction. Both existing economy advisory locks are acquired in stable Player-ID order. Conditional decrements prevent negative defender balances. Each transfer writes paired `RAID_REWARD`/`RAID_LOSS` rows with exact before/delta/after values and `referenceId = battleId`.

### Development opponents and debugging

The server idempotently bootstraps real domain rows for `Iron Wolf` (Lv1/~850), `Silver Fox` (Lv1/~920), `Lion Heart` (Lv2/~1000), `Black Raven` (Lv2/~1100), and `Storm Keep` (Lv3/~1220). Stable `raid-fixture:*` Web IDs prevent duplicates. Fixtures use normal Player, Kingdom, balance, Hero, and Raid Team models.

Call `GET /battles/BATTLE_ID` as either participant to inspect the persisted seed, rules version, snapshots, ordered events, result, loot, duration, and Trophy deltas. Re-running `simulateBattle` with those snapshots/seed/version produces the same result.

Manual Raid flow:

1. Open `http://localhost:3000/?lang=fa&section=raid` (or `lang=en`).
2. Find an opponent, inspect the offer, and optionally find another.
3. Confirm the three-Hero team/power or use **Edit Team**.
4. Attack, watch the Pixi replay, and inspect Victory/Defeat, loot, and Trophy delta.
5. Return to Kingdom and verify the freshly fetched HUD; refresh to confirm persistence.

## Phase 06 defense inbox and Revenge

A successful standard `RAID` against a real Player creates one `RevengeTarget` for the defender. It references the source Battle, expires after 24 hours, can be consumed once, and transitions through `AVAILABLE`, `USED`, `EXPIRED`, or `INVALID`. A `REVENGE` Battle never creates another target, which prevents reciprocal Revenge chains.

The preview and start endpoints use the target Player's current valid Raid Team and current protected balances. Revenge start locks both Players in stable ID order and locks the target row, then reuses the Phase 05 snapshot, deterministic simulation, event persistence, loot/Trophy settlement, and replay response inside one idempotent transaction.

Phase 06 routes:

- `GET /raid/inbox` — compact defender-perspective history and unread count
- `POST /raid/inbox/read` — persistent read state
- `GET /raid/revenge/:revengeTargetId` — server-authoritative preview
- `POST /raid/revenge/start` — idempotent settlement
- `GET /battles/:battleId` — participant-only Battle Detail data

`NotificationService` stores structured `PLAYER_RAIDED`, `REVENGE_AVAILABLE`, and exactly-once `UPGRADE_COMPLETE` records. Deep-link intent is platform-neutral JSON such as `{ "screen": "INBOX", "battleId": "…" }`, `{ "screen": "REVENGE", "revengeTargetId": "…" }`, or `{ "screen": "BUILDING", "buildingId": "…" }`; no Bale URL or transport is implemented.

The Kingdom visual pass keeps the existing Pixi coordinates and hit areas. It adds inexpensive masonry/timber/detail geometry and grounding cues, strengthens the Castle gate and hierarchy, reduces upgrade/timer badges, and compacts the Collect chip. The terrain texture and all procedural building artwork remain temporary and replaceable.

## Phase 06.5–06.6 visual production world

The Kingdom uses a bounded vertical camera instead of compressing the world into a single 320px frame. Direct pointer/touch dragging moves only the Pixi world container; the React HUD, Collect, sheets, and exact 54px navigation remain fixed. The initial camera keeps the uppermost active building below the HUD controls while preserving the Castle as the focal point.

The approved Phase 06.6 coordinates remain unchanged. Phase 07 promotes Academy, Blacksmith, Watchtower, and Workshop from local future definitions into server-backed progression buildings; Barracks, Granary, Tavern, and Stable remain future-only assets.

## Phase 07 Kingdom progression

The normalized `Building` + `BuildingUpgrade` model now covers Castle, Farm, Lumber Mill, Mine, Grand Market, Academy, Blacksmith, Watchtower, and Workshop. Existing players are idempotently backfilled at level 1. Upgrade cost, duration, maximum level, Castle requirements, building unlocks, storage capacity, and appearance variants are server-derived from centralized configuration.

`GET /kingdom` returns current/next level, authoritative cost and remaining time, upgrade timestamps, unlock state, appearance variant, storage capacities, and calculated Kingdom progression (`level`, total `xp`, and the next requirement). Production collection discards rewards beyond the Castle-derived storage limit without lowering legacy balances. Academy unlocks at Castle 3, Blacksmith at Castle 5, and advanced PvP availability is declared at Castle 7; the rules remain data-driven and do not change Phase 05/06 battle settlement.

Phase 07.1 mounts only server-unlocked Pixi buildings. Castle level 1 renders exactly Castle, Farm, Lumber Mill, Mine, and Grand Market; Watchtower, Academy, Workshop, and Blacksmith join at Castle levels 2, 3, 4, and 5. Locked buildings have no sprite, hit area, accessibility target, texture request, or camera-bound impact. Runtime unlocks use a restrained reveal while retaining every approved world coordinate.

Academy adds 1% production per level above 1, Blacksmith discounts Hero upgrade Gold by 1%, Watchtower adds one percentage point of Raid protection, and Workshop reduces future building-upgrade duration by 1%; every effect caps at 15%. All effects use centralized basis-point configuration and deterministic integer rounding. Academy is applied before storage caps, Blacksmith uses the same cost for display/affordability/charge/ledger, Watchtower flows through the shared search/settlement/Revenge loot calculator, and Workshop never changes an already-started timer. Kingdom XP is `sum(max(0, building level - 1) * 100)` with 900 XP per level and no Castle override.

Building detail sheets expose localized structured current/next effects. Stage 2/3 artwork still falls back to the existing Stage 1 asset until final skins are produced.

The visual approach is layered: `terrain/kingdom-base-v3.webp` is an optimized local 1024×1536 environment with no baked gameplay-looking structures and distinct irregular Farm, Lumber, Mine, and Market ground treatments. The approved Castle and four secondary buildings load as separate Pixi sprites with deterministic placement, hit areas, selection, indicators, glow, flags, and smoke. `kingdom-base-v2.webp` and the earlier `kingdom-expansion-v1.webp` remain available only for comparison and rollback.

## Validation and tests

```bash
npm run prisma:generate
npm run prisma:deploy
npm test                  # pure production/config tests
npm run test:integration # real PostgreSQL transactions and concurrency
npm run typecheck
npm run build
npm run lint
npm run validate:client  # requires API + client; browser Collect/upgrade/RTL/mobile flow
npm run validate:heroes  # requires API + client; Hero/team/upgrade/RTL/mobile/Kingdom flow
npm run validate:raid    # full match/battle/result/Kingdom flow + mobile screenshots
npm run validate:revenge # incoming badge/log/preview/Revenge/result + Phase 06 screenshots
npm run validate:visual  # expanded world/pan/locked/detail/RTL/mobile screenshots and asset budget
npm run validate:progression # 5/6/7/8/9 runtime mounts, effect details, and Phase 07.1 screenshots
```

Tests preserve all Phase 03/04 coverage and add deterministic Battle replay, HP/timing bounds, all three skills, Shield Wall reduction, defeated-Hero behavior, loot protection/caps, Trophy bounds, Match Offer ownership/expiry/single use, idempotent settlement, replay authorization, same-offer concurrency, shared-defender concurrency, non-negative balances, and paired ledger reconciliation.

Phase 06 integration coverage adds defender-perspective inbox data, persistent read state, structured/deep-link notifications, eligible/expired/foreign/used Revenge guards, shared-engine replay, idempotent retry, loop prevention, simultaneous Revenge serialization, and concurrent Raid/Revenge balance integrity. Self-Revenge is guarded in the service and by the database `RevengeTarget_not_self` constraint.

`npm run validate:revenge` creates two isolated development Player contexts, resolves a real standard Raid, switches to the defender, verifies the Kingdom badge and Battle Log, starts Revenge through its preview, captures shared Battle playback/result, confirms `USED`, checks notification cardinality, and validates English LTR/Persian RTL at 320×568, 375×812, and 390×844 with the unchanged 54px navigation and no browser console errors. Screenshots are written under `artifacts/phase-06-*.png`.

`npm run validate:visual` verifies the five active Pixi structures, zero rendered future structures, bounded pan movement, an active-building detail sheet, English LTR/Persian RTL, 320×568 / 375×812 / 390×844, the unchanged 54px navigation, horizontal overflow, browser console errors, and a 700KB/150KB terrain/Castle asset budget. It writes screenshots under `artifacts/phase-06-5-*.png`.

`npm run validate:raid` validates 320×568, 375×812, and 390×844 in English LTR and Persian RTL, the unchanged 54px navigation, server Match Offers, Pixi HP/event playback, both Victory and Defeat results, post-Raid Kingdom HUD synchronization, persisted six-Hero snapshots/events, and browser console errors. It writes ignored screenshots under `artifacts/phase-05-*.png`.

`npm run validate:client` checks all five Pixi buildings, server-backed HUD balances, Collect feedback, refresh persistence during an upgrade, completion, English LTR, Persian RTL, widths 320/375/390, horizontal overflow, and browser console errors. It writes an ignored screenshot to `artifacts/phase-03-kingdom-fa.png`.

`npm run validate:heroes` checks the three server-backed starter Heroes, local portraits, Hero Detail, Raid Team reorder/save/reload, Hero upgrade, Gold HUD synchronization, Hero level persistence, 320×568 / 375×812 / 390×844 in English and Persian, the unchanged compact navigation, browser console errors, and a return-to-Kingdom Pixi/Collect smoke test.

Manual Phase 04 validation:

1. Open `http://localhost:3000/?lang=fa&section=heroes`.
2. Verify Knight, Ranger, and Mage portraits/stats and the three ordered Raid Team slots.
3. Tap a slot, assign a Hero, save, and refresh to verify order persistence.
4. Open Knight, upgrade for 300 Gold, and verify level/stats/Gold before and after refresh.
5. Switch to Kingdom and verify Pixi buildings, Collect, building detail, and upgrade remain functional.

## Temporary assets and current scope

`apps/game-client/public/assets/kingdom/terrain/kingdom-base-v3.webp`, `castle-production-v1.webp`, the secondary/future building sprites, and the 640×640 WebP portraits in `apps/game-client/public/assets/heroes/` are local, optimized, replaceable art. The older `kingdom-base-v2.webp` and `kingdom-expansion-v1.webp` are retained but no longer loaded by the game. The Battle scene reuses local portraits and lightweight Pixi effects; no shaders, particle systems, or per-frame React state were added. Phase 03–06 server state and mechanics are unchanged.
