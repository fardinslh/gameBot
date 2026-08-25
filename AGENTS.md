# Crown & Coin agent instructions

Crown & Coin is a portrait mobile medieval strategy game with a React HUD, PixiJS worlds, and a NestJS authoritative game server. Read [docs/project/INDEX.md](docs/project/INDEX.md) and [docs/project/AI_HANDOFF.md](docs/project/AI_HANDOFF.md) before making a substantial change. Then read the system document that matches the task. Current code, Prisma migrations, and shared contracts are the ultimate source of truth when prose differs.

Preserve these invariants:

- The API is authoritative for economy, progression, Heroes, Raid, battle, and Revenge.
- React owns interface state; PixiJS owns world rendering and world interaction.
- Keep the approved Kingdom terrain, Castle focal point, building IDs, world coordinates, sprite anchors, 54px mobile navigation, and bilingual RTL/LTR behavior stable unless the task explicitly changes them.
- Do not add Bale, Telegram, Guild, Season, payments, or monetization without an explicit scoped request.
- Treat Prisma migrations and shared contracts as public compatibility boundaries.

Use the smallest validation set appropriate to the changed area. Run `npm run validate:docs` after documentation changes, and update `docs/project/` whenever architecture, APIs, data models, commands, or project state change.

## Meaningful-work completion protocol

Every AI agent that completes meaningful work must update project history before finishing. Meaningful work includes a phase or sub-phase, feature, important bug fix, architecture or balance change, gameplay or world change, roadmap or launch change, security change, significant refactor, or major art and user experience pass. Typos and formatting-only edits do not need an entry.

Before work:

1. Read current Git HEAD, [docs/project/INDEX.md](docs/project/INDEX.md), and the relevant system documents.
2. Read `.private/PROJECT_MASTER_PLAN.md` and the latest `.private/AI_WORK_LOG.md` entries when local access permits.
3. Verify the implementation in code before relying on prose.

After work:

1. Run validations appropriate to the changed area.
2. Commit and push validated tracked changes when the project workflow requires it.
3. Update canonical project documentation for material changes.
4. Update the private master plan, product decisions, and launch checklist when their state changes.
5. Append a meaningful entry to `.private/AI_WORK_LOG.md` with the exact final commit, validation results, limitations, and next step.

Because `.private/` is ignored, commit tracked changes before recording their final commit SHA in the private files. Never force-add private files, amend a public commit to include them, or claim meaningful work complete without the history entry.
