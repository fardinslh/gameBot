---
title: Play and extend the PvE Campaign
navLabel: PvE Campaign
contentType: Reference
---

# Play and extend the PvE Campaign

Retention 04 adds one permanent PvE chapter, **The Broken Frontier** (`BROKEN_FRONTIER`). Players enter it through the existing Raid destination and switch between Raid and Campaign. The bottom navigation still has five items.

## Chapter One

The chapter contains nine ordered stages:

| Stage | Castle gate | Enemy formation | Commander level | First-clear reward |
| --- | ---: | --- | ---: | --- |
| `FRONTIER_01` | 1 | 12 Infantry, 8 Infantry, 5 Archers | 1 | 800 Gold, 400 Food |
| `FRONTIER_02` | 1 | 10 Archers, 12 Archers, 6 Infantry | 1 | 600 Food, 500 Wood |
| `FRONTIER_03` | 1 | 14 Cavalry, 9 Cavalry, 8 Archers | 1 | 900 Gold, 600 Stone |
| `FRONTIER_04` | 2 | 18 Infantry, 14 Archers, 8 Cavalry | 2 | 1,200 Gold, 800 Food |
| `FRONTIER_05` | 2 | 12 Cavalry, 18 Infantry, 12 Archers | 2 | 900 Wood, 700 Stone |
| `FRONTIER_06` | 2 | 20 Archers, 12 Cavalry, 15 Infantry | 3 | 1,600 Gold, 1,000 Food |
| `FRONTIER_07` | 3 | 24 Infantry, 16 Archers, 18 Cavalry | 4 | 1,900 Gold, 1,200 Wood |
| `FRONTIER_08` | 3 | 18 Cavalry, 24 Archers, 20 Infantry | 4 | 1,500 Food, 1,200 Stone |
| `FRONTIER_09` | 3 | 28 Infantry, 24 Archers, 22 Cavalry | 5 | 3,500 Gold, 2,000 Food, 1,500 Wood, 1,500 Stone |

Stage 1 opens when its Castle gate passes. Stages 2 through 9 require the prior stage to have at least one star. The API returns `LOCKED`, `AVAILABLE`, or `CLEARED`; the client does not infer those states.

Players can retry stages without stamina, cooldowns, or Gems. A loss grants zero stars. A win grants one star for each attacker squad still alive at battle end. The server stores the highest result from zero through three and never lowers it.

## Rewards

The server grants each stage reward once, on the first win. Later wins can improve stars but cannot repeat the resource grant.

Players claim chapter milestones through explicit API requests:

- 9 stars: 1,500 Gold and 750 Food
- 18 stars: 2,500 Gold, 1,200 Food, and 1,000 Wood
- 27 stars: 5,000 Gold, 2,000 Food, 1,500 Wood, and 1,500 Stone

Campaign rewards grant no Gems. `EconomyRequest`, the Player advisory lock, database uniqueness, and immutable `EconomyTransaction` rows protect all grants.

## Battle boundary

Campaign uses the Army Battle rules-version-2 simulator. Each attempt persists one `Battle` with:

- `type: CAMPAIGN`
- `campaignStageKey`
- six `BattleArmySquadSnapshot` rows
- the deterministic seed and event stream
- zero loot and zero Trophy deltas

Campaign creates no Match Offer, Revenge target, notification, inbox entry, Raid history row, shield change, anti-farm record, permanent troop loss, or Raid mission progress. Stored rules-version-1 Hero battles and normal Raid/Revenge rules-version-2 battles keep their existing behavior.

## Durable opponents

Nine Web platform identities use `campaign:broken_frontier:01` through `campaign:broken_frontier:09`. Runtime bootstrap repairs their Kingdom, Heroes, troops, and formations from [campaign config](../../apps/game-api/src/campaign/campaign.config.ts). `Player.systemOpponentKind` distinguishes `CAMPAIGN` from `RAID`, and Raid matchmaking accepts only configured Raid opponents.

## Persistence

`PlayerCampaignStage` stores best stars, attempt count, first clear, and last play time for one Player and stage. `CampaignRewardClaim` stores one Player, chapter, and milestone claim. The migration adds both models, Campaign Battle metadata, Campaign economy enums, and database checks for stars, attempts, and milestone values.

## API

- `GET /campaign`
- `POST /campaign/stages/:stageKey/start` with `Idempotency-Key`
- `POST /campaign/rewards/:milestoneStars/claim` with `Idempotency-Key`

Mutation routes accept no combat, reward, cost, time, progress, or result data in the body.

## Client

The Raid screen opens in Raid mode. The Campaign tab loads a React/CSS winding route with nine nodes, localized chapter and enemy names, chapter stars, milestone chests, a stage sheet, and a compact counter legend. The client reuses `BattleScene` for playback. The result panel shows attempt stars, best stars, and the first-clear reward only when the server granted it.

Aren presents `CAMPAIGN_INTRO` once through the existing advisor-tip persistence. Persian uses RTL text while the ordered Battle lanes and Campaign route keep stable geometry.

## Validation

Run `npm run validate:campaign`. It covers config, opponent bootstrap, gates, stars, rewards, idempotency, concurrency, PvP isolation, Battle v2 persistence, mobile layout, bilingual direction, battle playback, result, milestone, and boss views. Browser captures live under `artifacts/retention-04-campaign/`.

The Campaign map uses local UI primitives and existing Hero/troop art. Automated checks accept layout and behavior. The owner still needs to approve the Campaign map art direction.
