---
title: Audition Crown & Coin audio candidates
navLabel: Audio Audition
contentType: How-to
---

# Audio Audition

## Human approval gate

Run the client with `npm run dev`, then open `http://localhost:3000/dev/audio`. This route is development-only, is absent from game navigation, and returns 404 in production. Listen on headphones, desktop speakers, and a real phone. The local Shortlist action is a note only; it never changes production mappings.

The SFX tab includes non-mutating Collect, Upgrade, Battle, and Result quick tests. Each button plays the locally shortlisted candidate for that action, or Candidate A as an audition fallback. It does not call the API or change gameplay state.

Report one letter per group. A production mapping commit must cite the owner's explicit choices. Until then every row remains **PENDING**.

| Group | A | B | C | Approved |
| --- | --- | --- | --- | --- |
| Kingdom Music | `kingdom-music-a.mp3` | `kingdom-music-b.mp3` | `kingdom-music-c.mp3` | PENDING |
| Battle Music | `battle-music-a.mp3` | `battle-music-b.mp3` | `battle-music-c.mp3` | PENDING |
| Collect | `collect-a.mp3` | `collect-b.mp3` | `collect-c.mp3` | PENDING |
| Upgrade Start | `upgrade-start-a.mp3` | `upgrade-start-b.mp3` | `upgrade-start-c.mp3` | PENDING |
| Upgrade Complete | `upgrade-complete-a.mp3` | `upgrade-complete-b.mp3` | `upgrade-complete-c.mp3` | PENDING |
| Hero Upgrade | `hero-upgrade-a.mp3` | `hero-upgrade-b.mp3` | `hero-upgrade-c.mp3` | PENDING |
| Attack Start | `attack-start-a.mp3` | `attack-start-b.mp3` | `attack-start-c.mp3` | PENDING |
| Sword Hit | `sword-hit-a.mp3` | `sword-hit-b.mp3` | `sword-hit-c.mp3` | PENDING |
| Arrow Shot | `arrow-shot-a.mp3` | `arrow-shot-b.mp3` | `arrow-shot-c.mp3` | PENDING |
| Magic Cast | `magic-cast-a.mp3` | `magic-cast-b.mp3` | `magic-cast-c.mp3` | PENDING |
| Shield Wall | `shield-wall-a.mp3` | `shield-wall-b.mp3` | `shield-wall-c.mp3` | PENDING |
| Victory | `victory-a.mp3` | `victory-b.mp3` | `victory-c.mp3` | PENDING |
| Defeat | `defeat-a.mp3` | `defeat-b.mp3` | `defeat-c.mp3` | PENDING |
| UI Tap | `ui-tap-a.mp3` | `ui-tap-b.mp3` | — | PENDING |
| Panel Open | `panel-open-a.mp3` | `panel-open-b.mp3` | — | PENDING |
| Back / Close | `back-a.mp3` | `back-b.mp3` | — | PENDING |
| Building Select | `building-select-a.mp3` | `building-select-b.mp3` | — | PENDING |
| Hero Select | `hero-select-a.mp3` | `hero-select-b.mp3` | — | PENDING |
| Find Enemy | `find-enemy-a.mp3` | `find-enemy-b.mp3` | — | PENDING |
| Arrow Impact | `arrow-impact-a.mp3` | `arrow-impact-b.mp3` | — | PENDING |
| Magic Impact | `magic-impact-a.mp3` | `magic-impact-b.mp3` | — | PENDING |
| Hero Defeated | `hero-defeated-a.mp3` | `hero-defeated-b.mp3` | — | PENDING |
| Incoming Attack | `incoming-attack-a.mp3` | `incoming-attack-b.mp3` | — | PENDING |
| Revenge Available | `revenge-available-a.mp3` | `revenge-available-b.mp3` | — | PENDING |

## Listening checklist

- Kingdom loop: calm, grounded, prestigious, repeatable, no obvious seam
- Battle loop: supports an 8–15 second fight without masking hits
- Collect/Upgrade: physical and satisfying, never casino-like
- Sword/Arrow/Magic/Shield: readable on phone speakers and mature in tone
- Victory: earned and restrained; Defeat: serious and non-humiliating
- Relative mix: music behind gameplay, UI subtle, skills brief, no clipping

After selecting, explicitly identify whether Sword Hit should use two or three approved variants and whether Arrow Impact, Magic Impact, and UI Tap should use both candidates. Do not randomize music.
