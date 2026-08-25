# Crown & Coin context

Crown & Coin is a portrait mobile medieval strategy game with a React/PixiJS client and authoritative NestJS server. Read [docs/project/INDEX.md](docs/project/INDEX.md) and [docs/project/AI_HANDOFF.md](docs/project/AI_HANDOFF.md) before major work. Current code, Prisma migrations, and shared contracts are the ultimate source of truth.

Preserve server authority, the approved Kingdom and Castle composition, fixed world coordinates, 54px mobile navigation, and RTL/LTR behavior unless the task explicitly changes them. Bale, Telegram, Guild, Season, payments, and monetization remain deferred. Run the validations named by the handoff for the changed area, and update the canonical documentation in the same commit when architecture, APIs, models, formulas, visuals, or project state materially change.

For meaningful work, read `.private/PROJECT_MASTER_PLAN.md` and the latest `.private/AI_WORK_LOG.md` entries when accessible. After validation and the tracked commit or push, update relevant canonical and private planning files, then append the exact commit, results, limitations, and next step to `.private/AI_WORK_LOG.md`. Never force-add `.private/`; formatting-only edits do not require a log entry. The full protocol lives in [docs/project/AI_HANDOFF.md](docs/project/AI_HANDOFF.md).
