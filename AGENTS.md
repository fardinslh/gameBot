# Crown & Coin agent instructions

Crown & Coin is a portrait mobile medieval strategy game with a React HUD, PixiJS worlds, and a NestJS authoritative game server. Read [docs/project/INDEX.md](docs/project/INDEX.md) and [docs/project/AI_HANDOFF.md](docs/project/AI_HANDOFF.md) before making a substantial change. Then read the system document that matches the task. Current code, Prisma migrations, and shared contracts are the ultimate source of truth when prose differs.

Preserve these invariants:

- The API is authoritative for economy, progression, Heroes, Raid, battle, and Revenge.
- React owns interface state; PixiJS owns world rendering and world interaction.
- Keep the approved Kingdom terrain, Castle focal point, building IDs, world coordinates, sprite anchors, 54px mobile navigation, and bilingual RTL/LTR behavior stable unless the task explicitly changes them.
- Do not add Bale, Telegram, Guild, Season, payments, or monetization without an explicit scoped request.
- Treat Prisma migrations and shared contracts as public compatibility boundaries.

Use the smallest validation set appropriate to the changed area. Run `npm run validate:docs` after documentation changes, and update `docs/project/` whenever architecture, APIs, data models, commands, or project state change.
