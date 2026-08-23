# Crown & Coin

Crown & Coin is the technical foundation for a portrait-oriented mobile strategy game. Bale Mini App support is the first delivery target, but game identity, UI, and server code do not depend on Bale. Telegram and standalone web adapters can be implemented later without replacing the internal player identity.

This repository contains foundation work only. Battle, guild, payment, shop economy, and final PixiJS gameplay scenes are intentionally out of scope.

## Architecture

```text
apps/
  game-client/       Next.js mobile game shell and localization
  game-api/          NestJS authoritative game API and Prisma schema
packages/
  shared/            Cross-application API and platform types
  platform/          PlatformAdapter contract
infrastructure/      Local infrastructure notes
docker-compose.yml   PostgreSQL and Redis for development
```

The API is authoritative. Clients never own permanent balances, rewards, timers, purchases, or results. The resource amounts shown in the current shell are explicitly labeled preview data.

`Player` is the internal identity. `PlatformAccount` links a Bale, Telegram, or Web external account to a player; external platform IDs are never used as player primary keys.

## Prerequisites

- Node.js 20.9 or newer
- npm 10 or newer
- Docker Desktop (or another Docker Compose-compatible runtime)

## Installation

From the repository root:

```bash
docker compose up -d
copy .env.example .env
npm install
npm run prisma:migrate
npm run dev
```

On macOS or Linux, use `cp .env.example .env` instead of `copy`.

`npm run dev` builds the two internal packages, then starts the client and API together with watch mode.

## Environment

The example file includes safe local defaults for PostgreSQL, Redis, the client/API origins, and empty platform token placeholders. Do not commit `.env` or real bot tokens.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma |
| `REDIS_URL` | Redis connection shared by cache-ready infrastructure and BullMQ |
| `PORT` | NestJS port; defaults to `3001` |
| `CLIENT_ORIGIN` | Allowed browser origin for API CORS |
| `NEXT_PUBLIC_API_URL` | API base URL used by the game client |
| `BALE_BOT_TOKEN`, `BALE_BOT_USERNAME` | Reserved Bale adapter configuration |
| `TELEGRAM_BOT_TOKEN` | Reserved placeholder; Telegram is not integrated |

## Database

Generate Prisma Client after schema changes:

```bash
npm run prisma:generate
```

Create and apply a development migration:

```bash
npm run prisma:migrate
```

Apply committed migrations in a non-development environment:

```bash
npm run prisma:deploy
```

The initial migration creates `Player`, `PlatformAccount`, `Kingdom`, `ResourceBalance`, `Building`, and `BuildingUpgrade`.

## Development commands

```bash
npm run dev          # client + API
npm run typecheck    # all TypeScript projects
npm run build        # packages + production client/API builds
npm run lint         # configured workspace checks
```

PixiJS is installed and its lazy runtime bootstrap lives in `apps/game-client/src/game/rendering/pixi-runtime.ts`. It is deliberately not mounted yet; the final Kingdom scene belongs to a later phase.

## URLs

- Game client: http://localhost:3000
- API: http://localhost:3001
- Health check: http://localhost:3001/health

Verify the API after the services start:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"status":"ok"}
```

The health endpoint checks both PostgreSQL and Redis before returning `ok`. The client also calls this endpoint and displays its current connection state.
