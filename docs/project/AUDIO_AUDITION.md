---
title: Audition Crown & Coin audio candidates
navLabel: Audio Audition
contentType: How-to
---

# Audio Audition

## Completed approval gate

Run `npm run dev`, then open `http://localhost:3000/dev/audio`. The route is development-only and returns 404 in production. All 24 owner-approved groups are mapped into gameplay, so no candidate or shortlist control remains in the lab.

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
| Panel Open | B | Shield Wall | B |
| Defeat | A | UI Tap | A |
| Arrow Impact | C | Magic Impact | A |
| Hero Defeated | A | Incoming Attack | A |
| Revenge Available | A |  |  |

Victory A is mapped as a five-second sting. Find Enemy A is mapped as two un-stretched pulses separated by 280 ms. Exact provenance and technical metadata live in `public/assets/audio/approved/APPROVED_MANIFEST.json`; pending metadata lives in `public/assets/audio/candidates/AUDITION_MANIFEST.json`.

## Final mix checklist

- Review relative levels in the real Kingdom, menu, and battle contexts.
- Confirm frequent UI sounds do not cause fatigue.
- Confirm impacts remain distinct on phone speakers.
- Repeat the check inside the later Bale WebView.
