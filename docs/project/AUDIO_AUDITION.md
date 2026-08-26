---
title: Audition Crown & Coin audio candidates
navLabel: Audio Audition
contentType: How-to
---

# Audio Audition

## Partial approval gate

Run `npm run dev`, then open `http://localhost:3000/dev/audio`. The route is development-only and returns 404 in production. The owner's 15 approved groups are mapped into gameplay and no longer appear in the lab. Shortlist remains a device-local listening note; it never changes production.

Listen on headphones, desktop speakers, and a real phone. Report one letter per remaining group. Panel Open remains in round 1 because the owner did not provide a decision; the eight rejected groups use entirely new round-2 candidates.

| Pending group | A | B | C |
| --- | --- | --- | --- |
| Panel Open | `panel-open-a.mp3` | `panel-open-b.mp3` | — |
| Shield Wall | `shield-wall-a-r2.mp3` | `shield-wall-b-r2.mp3` | `shield-wall-c-r2.mp3` |
| Defeat | `defeat-a-r2.mp3` | `defeat-b-r2.mp3` | `defeat-c-r2.mp3` |
| UI Tap | `ui-tap-a-r2.mp3` | `ui-tap-b-r2.mp3` | `ui-tap-c-r2.mp3` |
| Arrow Impact | `arrow-impact-a-r2.mp3` | `arrow-impact-b-r2.mp3` | `arrow-impact-c-r2.mp3` |
| Magic Impact | `magic-impact-a-r2.mp3` | `magic-impact-b-r2.mp3` | `magic-impact-c-r2.mp3` |
| Hero Defeated | `hero-defeated-a-r2.mp3` | `hero-defeated-b-r2.mp3` | `hero-defeated-c-r2.mp3` |
| Incoming Attack | `incoming-attack-a-r2.mp3` | `incoming-attack-b-r2.mp3` | `incoming-attack-c-r2.mp3` |
| Revenge Available | `revenge-available-a-r2.mp3` | `revenge-available-b-r2.mp3` | `revenge-available-c-r2.mp3` |

Pending gameplay actions are intentionally silent. No rejected legacy asset or unapproved candidate is used as a fallback.

## Recorded owner approvals

| Group | Choice | Group | Choice |
| --- | --- | --- | --- |
| Kingdom Music | B | Battle Music | A |
| Collect | B | Upgrade Start | C |
| Upgrade Complete | C | Hero Upgrade | A |
| Attack Start | A | Sword Hit | A |
| Arrow Shot | B | Magic Cast | C |
| Victory | A | Back / Close | A |
| Building Select | A | Hero Select | A |
| Find Enemy | A |  |  |

Victory A is mapped as a five-second sting. Find Enemy A is mapped as two un-stretched pulses separated by 280 ms. Exact provenance and technical metadata live in `public/assets/audio/approved/APPROVED_MANIFEST.json`; pending metadata lives in `public/assets/audio/candidates/AUDITION_MANIFEST.json`.

## Listening checklist

- Shield and impacts must remain distinct on phone speakers.
- UI Tap must be subtle enough for frequent use.
- Defeat and Hero Defeated must feel serious, not comedic or humiliating.
- Incoming Attack and Revenge must attract attention without masking the UI.
- Panel Open must suit frequent menu use without fatigue.
