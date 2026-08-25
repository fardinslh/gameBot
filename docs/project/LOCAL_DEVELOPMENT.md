---
title: Run Crown & Coin locally
navLabel: Local Development
contentType: How-to
---

# Run Crown & Coin locally

Run the Next.js client and NestJS API on your machine while Docker supplies PostgreSQL and Redis.

## Prerequisites

- Node.js 20.9 or newer
- npm 10 or newer
- Docker Desktop or another Docker Compose-compatible runtime
- Microsoft Edge or Google Chrome for browser validation scripts

## Install and start

From the repository root on Windows:

```powershell
docker compose up -d
Copy-Item .env.example .env
npm install
npm run prisma:deploy
npm run dev
```

On macOS or Linux, replace `Copy-Item` with `cp`.

Open these URLs:

- Client: `http://localhost:3000`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/health`
- Persian client: `http://localhost:3000/?lang=fa`
- Heroes: `http://localhost:3000/?lang=en&section=heroes`
- Raid: `http://localhost:3000/?lang=en&section=raid`

`npm run dev` builds shared packages, then starts Next.js and NestJS watchers. `npm start` runs built application servers and requires a prior build.

## Docker services

`docker-compose.yml` starts:

- PostgreSQL 17 on port `5432` with named volume `crown_postgres_data`
- Redis 7.4 on port `6379` with append-only persistence in `crown_redis_data`

Application processes run on the host for hot reload. The Compose file does not build client or API containers.

## Environment variables

Copy names and purposes only. Never commit populated credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma PostgreSQL connection |
| `REDIS_URL` | Redis connection for startup, health, and BullMQ queue handle |
| `PORT` | NestJS port, default `3001` |
| `CLIENT_ORIGIN` | Allowed browser origin, default `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Browser API base URL |
| `DEV_PLAYER_ID` | Reusable Web development identity |
| `ECONOMY_TIMER_MULTIPLIER` | Positive development timer multiplier, default `1` |
| `SKIP_REDIS_FOR_DEVELOPMENT` | Optional local Redis bypass, never a production setting |
| `BALE_BOT_TOKEN` | Reserved platform secret, unused by current code |
| `BALE_BOT_USERNAME` | Reserved platform identity, unused by current code |
| `TELEGRAM_BOT_TOKEN` | Reserved platform secret, unused by current code |

## Prisma commands

```powershell
npm run prisma:generate
npm run prisma:deploy
```

Use `npm run prisma:migrate` only when authoring a new development migration. Normal clone setup applies committed migrations with `prisma:deploy`.

## Redis-free fallback

Set `SKIP_REDIS_FOR_DEVELOPMENT=true` only when local development cannot run Redis. The API skips Redis connection and health checks, and `JobsService.queue` becomes `null`. Current gameplay does not enqueue jobs.

You still need PostgreSQL. A local Prisma PostgreSQL process can replace Docker if its generated connection URL is assigned to `DATABASE_URL`.

## Development identities

The API accepts `X-Dev-Player-Id` and otherwise uses `DEV_PLAYER_ID`. Browser validation scripts use isolated IDs where needed. This header offers no trust boundary; do not expose this development mode as production authentication.

## Timer testing

Set `ECONOMY_TIMER_MULTIPLIER=0.1` before starting the API to reduce new upgrade durations. The setting does not alter a timer already stored in `BuildingUpgrade.completesAt`.
