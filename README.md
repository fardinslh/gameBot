# Crown & Coin

Crown & Coin is a portrait-oriented medieval strategy game. Phase 04 adds a persistent, server-authoritative Hero roster and three-slot Raid Team on top of the validated PixiJS Kingdom and Phase 03 economy. PvP, battle simulation, loot, guilds, payments, platform authentication, and final artwork remain out of scope.

## Architecture

```text
apps/
  game-client/       Next.js React HUD/Hero UI + PixiJS Kingdom scene
  game-api/          NestJS authoritative economy/Hero API + Prisma
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

The game shell now switches only the enabled `Kingdom` and `Heroes` views. The compact 54px navigation remains shared; Raid, Guild, and Shop still show Coming Soon. The Hero client is isolated under `apps/game-client/src/features/heroes/`:

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

Starting balances are 8000 Gold, 5000 Food, 5000 Wood, 3500 Stone, and 120 Gems. Levels 1–3 require Castle 1; levels 4–6 require Castle 2, continuing in three-level bands.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/kingdom` | Bootstrap if needed, reconcile upgrades, return the complete Kingdom state |
| `POST` | `/kingdom/collect` | Transactionally collect capped offline production |
| `POST` | `/kingdom/buildings/:buildingId/upgrade` | Validate, charge, log, and start one upgrade |
| `GET` | `/heroes` | Bootstrap missing starter content and return owned Heroes, Raid Team, balances, and server-derived stats |
| `GET` | `/heroes/team` | Return the persisted ordered three-slot Raid Team |
| `PUT` | `/heroes/team` | Validate and persist exactly three unique owned Hero IDs |
| `POST` | `/heroes/:playerHeroId/upgrade` | Idempotently charge Gold, log the economy transaction, and increase Hero level |

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
```

Tests cover zero/normal/negative elapsed time, the eight-hour cap, per-building production, fractional precision, deterministic bootstrap, immediate/retried/concurrent Collect, transaction accuracy, upgrade charging, insufficient resources, ownership, Castle gates, maximum level, simultaneous upgrades, early completion rejection, valid completion, and idempotent reconciliation.

`npm run validate:client` checks all five Pixi buildings, server-backed HUD balances, Collect feedback, refresh persistence during an upgrade, completion, English LTR, Persian RTL, widths 320/375/390, horizontal overflow, and browser console errors. It writes an ignored screenshot to `artifacts/phase-03-kingdom-fa.png`.

`npm run validate:heroes` checks the three server-backed starter Heroes, local portraits, Hero Detail, Raid Team reorder/save/reload, Hero upgrade, Gold HUD synchronization, Hero level persistence, 320×568 / 375×812 / 390×844 in English and Persian, the unchanged compact navigation, browser console errors, and a return-to-Kingdom Pixi/Collect smoke test.

Manual Phase 04 validation:

1. Open `http://localhost:3000/?lang=fa&section=heroes`.
2. Verify Knight, Ranger, and Mage portraits/stats and the three ordered Raid Team slots.
3. Tap a slot, assign a Hero, save, and refresh to verify order persistence.
4. Open Knight, upgrade for 300 Gold, and verify level/stats/Gold before and after refresh.
5. Switch to Kingdom and verify Pixi buildings, Collect, building detail, and upgrade remain functional.

## Temporary assets and current scope

`apps/game-client/public/assets/kingdom/kingdom-terrain-v1.webp`, the procedural buildings, and the 640×640 WebP portraits in `apps/game-client/public/assets/heroes/` are replaceable temporary art. Pixi coordinates, Kingdom artwork, the Phase 02 world design, Phase 03 HUD proportions, production, Collect, and building upgrade behavior are unchanged. Hero skills are informational/configuration-ready only; battle behavior starts no earlier than Phase 05.
