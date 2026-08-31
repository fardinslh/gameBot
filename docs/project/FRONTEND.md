---
title: Work with the game client
navLabel: Frontend
contentType: Reference
---

# Work with the game client

The client uses one Next.js route and switches game sections inside a client-side shell. Feature hooks synchronize authoritative API state; Pixi renders game-world canvases. Campaign is a compact mode inside the existing Raid destination, so the five-item 54px navigation remains unchanged.

## Application shell

`apps/game-client/src/app/page.tsx` reads `lang` and `section` query parameters. Supported initial sections are `kingdom`, `heroes`, `raid`, and `shop`. `GameShell` owns the active section and opens the Raid inbox from Kingdom.

Bottom navigation contains five items:

- Kingdom: enabled
- Raid: enabled
- Army: enabled (internal section ID remains `heroes` for compatibility)
- Guild: disabled with Coming Soon feedback
- Shop: enabled; authoritative Gem catalog, live convenience offers, permanent Profile Crests, custom confirmation, ownership, and equip state

CSS keeps the navigation at 54 pixels plus safe-area positioning.

## Feature organization

Each feature keeps components, hooks, and API calls under its own directory:

```text
features/kingdom
  api | components | data | domain | hooks | rendering
features/heroes
  api | components | hooks
features/raid
  analytics | api | components | hooks
features/experience
  onboarding API | provider | coach, welcome, Guide, and settings UI
features/retention
  API | authoritative state hook | compact entry | Daily/Weekly/Achievement sheet
features/audio
  manager | provider | Battle event mapping
features/rtl-lab
  development-only semantic mixed-content fixture
features/building-lab
  development-only nine-building tier, comparison, construction, fidelity, and status fixture
features/army-lab
  development-only real-API troop, queue, capacity, Commander, and formation inspector
```

`GameShell` imports feature pages but does not contain their server logic.

## State hooks

`useKingdomState` loads Kingdom state including authoritative `kingdomGoals`, tracks server/client clock offset, refreshes on tab visibility, updates once per second for timers, collects production, starts upgrades, and calls the completion endpoint after `finishAt`. Castle detail opens a compact React-owned Kingdom Progress sheet; it renders server-authored XP, milestones, next unlock, and effect progression without creating client-side progression state.

`useArmyState` loads Army and Hero state, maintains a three-squad local formation draft, persists formation changes, starts troop training, upgrades Commanders, and updates balances from authoritative responses.

`useRaidState` coordinates overview, Match Offer, battle playback, inbox, Revenge preview, replay detail, and post-battle refresh. The experience provider refreshes persistent onboarding around successful actions; its UI remains non-blocking on API failure.

`useRetentionState` loads the complete authoritative Retention payload only while its Kingdom sheet is open, tracks server clock offset for UTC reset labels, sends bodyless idempotent claim requests, and refreshes Kingdom balances after rewards. Kingdom Collect and building-upgrade success dispatch a lightweight refresh signal; Hero and Raid history are re-derived when the feature is next opened. No progress counter lives in React.

`useShopState` loads the complete authoritative catalog and dynamic offers, submits item intent with a browser UUID idempotency key, and replaces local Shop state only from server responses. `ShopPage` owns the premium React screen and confirmation UI. Building Detail and Army training reuse the same hook for contextual completion; neither calculates price or completion. The equipped Crest is returned through Kingdom state and changes only the Player header presentation.

`AudioProvider` owns a single session manager. Stable callbacks avoid restarting music when settings change. The manager waits for a user gesture, crossfades between Kingdom and Battle contexts, suspends with page visibility, and catches media failures.

The compact Kingdom header gives the game title primary emphasis, keeps the localized ruler title secondary, and presents Kingdom Level as a crest-attached numeric chip without increasing HUD height. Each capped Resource HUD cell exposes `normal`, `full`, or `overflow` through `data-capacity-state` and pairs the authoritative balance with compact localized capacity wording. Gems have no capacity state. `CollectControl` uses BigInt per-resource remaining room before aggregating its estimate and distinguishes genuine zero accrual from storage-blocked production. A successful Collect applies authoritative state immediately, then animates only displayed balances with an ease-out count-up and transient positive per-resource gains; refreshes and non-Collect mutations cancel the presentation layer, while reduced motion snaps to the final values.

## API clients

Feature API clients read `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001`. They disable fetch caching, translate domain error bodies, and generate browser UUID idempotency keys for protected mutations.

The production authentication boundary remains absent. Browser API clients do not attach a real platform credential.

`/dev/army` exists only in development and returns 404 in production. It calls the real Army API and is not linked from production navigation. Production uses the Army screen and local optimized Infantry/Archer/Cavalry WebP art. Battle Pixi coordinates are fixed portrait lanes and remain independent of Kingdom world coordinates and RTL direction.

## Pixi boundaries

Kingdom Pixi receives building lock, level, appearance, indicator, and expansion stage state. It resolves the current DEFAULT raster tier for every active building and sends selected visual IDs to React. Battle Pixi receives a complete replay and emits only visual completion.

Kingdom level chips live in a non-interactive screen-space Pixi overlay, separate from building containers. Their position derives from existing per-building anchors plus building/world/camera transforms and snaps to renderer resolution. This preserves constant 42 by 22 CSS-pixel presentation during pan, resize, tier replacement, and unlock animation without changing world coordinates or tap areas.

Avoid per-frame React state for Pixi motion. Use the Pixi ticker, browser timers for event playback, and React state for durable UI transitions.

## Localization and direction

`apps/game-client/src/i18n/config.ts` supports `en` and `fa`. `getLocaleDirection` is the single direction rule: English maps to `ltr` and Persian maps to `rtl`. `LocalizedGameRoot` wraps the shared section shell, owns semantic `lang` and `dir`, and synchronizes `document.documentElement` after query-parameter locale changes. Both languages use the same component tree.

`BidiValue` renders external names with `<bdi dir="auto">` and numeric/timer/signed values with `<bdi dir="ltr">`. `BidiTemplate` keeps localized sentence punctuation in the parent direction while isolating interpolated tokens. Use these primitives for player-supplied names, IDs, amounts, levels, percentages, Trophy deltas, timers, and mixed-script placeholders; do not concatenate those values into a Persian sentence.

Kingdom world coordinates, Battle Pixi layout, ordered team/loot grids, image assets, and numeric scene geometry stay left-to-right internally. CSS logical properties handle semantic UI mirroring. Explicit `direction: ltr` is permitted only for spatial or ordered game content that must not mirror.

### Typography and readability

The root layout imports the locally installed `@fontsource-variable/vazirmatn` variable WOFF2 package. It is SIL Open Font License 1.1 software from the Vazirmatn project and is bundled at build time; the client makes no runtime font request to Google Fonts or another CDN. Persian resolves to `Vazirmatn Variable`; English resolves to the existing modern system sans stack. Decorative Georgia/Times headings remain an English-only display choice through `--font-display` and never render Persian headings.

Production gameplay typography uses the shared CSS scale: `--text-micro` 9px, `--text-caption` 10px, `--text-small` 11px, `--text-body` 12px, `--text-body-strong` 13px, `--text-section-compact` 14px, `--text-section` 15px, `--text-title-compact` 17px, `--text-title` 18px, and `--text-display` 24px. Persian caption/body tokens receive a restrained 0.5px compensation. Visible production gameplay text has a 10px floor; the 9px token is reserved for genuinely tertiary future metadata and is not used by current production surfaces. Labels use a 1.25 line height, body copy 1.5, and headings 1.2, with Persian label/copy values raised to 1.3/1.55. Prefer wrapping, scrolling, or layout adjustment over shrinking gameplay text below the floor.

Localized numeric runs keep `BidiValue`, Persian digits, tabular numeric behavior, and left-to-right isolation. The Kingdom scene waits for the local Persian face before its initial Pixi text draw and before a runtime switch to Persian. Pixi world-level badges render only the localized numeral because Canvas text does not inherit DOM bidi behavior; full localized Level wording remains in the React Building Detail sheet. Badge locale/font changes do not alter screen-space anchoring, DPR rendering, status-stack geometry, world coordinates, or hit areas.

## Mobile layout

Kingdom, Army, and Raid shells use a maximum width of 520 pixels and maximum height of 920 pixels. Desktop centers the mobile viewport. The client uses `100svh`, safe-area insets, fixed HUD layers, and scrollable content only where a feature requires it. The Retention sheet is a React-owned scroll surface above Kingdom and stops before the unchanged 54px navigation.

Browser validations cover:

- 320 by 568
- 375 by 812
- 390 by 844

Preserve no-horizontal-overflow checks, 44-pixel action targets where practical, and the 54-pixel bottom navigation.
