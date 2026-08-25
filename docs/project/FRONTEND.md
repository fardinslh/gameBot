---
title: Work with the game client
navLabel: Frontend
contentType: Reference
---

# Work with the game client

The client uses one Next.js route and switches game sections inside a client-side shell. Feature hooks synchronize authoritative API state; Pixi renders game-world canvases.

## Application shell

`apps/game-client/src/app/page.tsx` reads `lang` and `section` query parameters. Supported initial sections are `kingdom`, `heroes`, and `raid`. `GameShell` owns the active section and opens the Raid inbox from Kingdom.

Bottom navigation contains five items:

- Kingdom: enabled
- Raid: enabled
- Heroes: enabled
- Guild: disabled with Coming Soon feedback
- Shop: disabled with Coming Soon feedback

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
```

`GameShell` imports feature pages but does not contain their server logic.

## State hooks

`useKingdomState` loads Kingdom state, tracks server/client clock offset, refreshes on tab visibility, updates once per second for timers, collects production, starts upgrades, and calls the completion endpoint after `finishAt`.

`useHeroState` loads roster/team state, maintains an ordered local draft, persists the team, upgrades Heroes, and updates balances from responses.

`useRaidState` coordinates overview, Match Offer, battle playback, inbox, Revenge preview, replay detail, and post-battle refresh. Its analytics adapter currently logs client events rather than sending them to a production analytics backend.

## API clients

Feature API clients read `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001`. They disable fetch caching, translate domain error bodies, and generate browser UUID idempotency keys for protected mutations.

The production authentication boundary remains absent. Browser API clients do not attach a real platform credential.

## Pixi boundaries

Kingdom Pixi receives building lock, level, appearance, indicator, and expansion stage state. It sends selected visual IDs to React. Battle Pixi receives a complete replay and emits only visual completion.

Avoid per-frame React state for Pixi motion. Use the Pixi ticker, browser timers for event playback, and React state for durable UI transitions.

## Localization and direction

`apps/game-client/src/i18n/config.ts` supports `en` and `fa`. English defaults to left-to-right; Persian sets right-to-left on `.game-viewport`. Both languages use the same component tree.

Kingdom world coordinates, battle layout, image assets, and numeric scene geometry stay left-to-right internally. CSS logical properties and selected direction handle UI mirroring.

## Mobile layout

Kingdom, Heroes, and Raid shells use a maximum width of 520 pixels and maximum height of 920 pixels. Desktop centers the mobile viewport. The client uses `100svh`, safe-area insets, fixed HUD layers, and scrollable content only where a feature requires it.

Browser validations cover:

- 320 by 568
- 375 by 812
- 390 by 844

Preserve no-horizontal-overflow checks, 44-pixel action targets where practical, and the 54-pixel bottom navigation.
