# PR: UI — Neumorphic HUD (Tailwind)

## Summary

Introduce a Tailwind-only neumorphic refresh for the HUD, AI console and mask hotbar.

- Adds accessible `LiquidBar` component (animated, respects prefers-reduced-motion)
- Restyles Vitals / Identity / Data Fragments into neumorphic cards
- Upgrades S.E.R.A console (glass, monospace header, aria-live)
- Larger, touch-friendly mask hotbar with improved tooltips

## Files changed

- `components/UIOverlay.tsx` — primary UI changes (behavior preserved)
- `.github/copilot-instructions.md` — documentation updates

> Note: `components/GameCanvas.tsx` contains formatting-only changes in this branch (no logic change).

## Why

Mobile-first, softer visual language that matches the game's tone and improves touch usability while preserving the existing render/performance model (canvas remains the render surface).

## QA checklist (required)

- [ ] Run `npm install && npm run dev` and confirm app loads
- [ ] Open mobile viewport (iPhone SE / 375px) — mask hotbar is centered bottom and tappable
- [ ] Confirm keyboard hotkeys (1/2/3/4/0, Space) still work
- [ ] Verify `aiMessage` updates and is announced (aria-live)
- [ ] Toggle `prefers-reduced-motion` — animations stop
- [ ] Collect memory pickup and reach victory — stats update correctly
- [ ] Lighthouse smoke: check accessibility and performance (no regressions)

## Screenshots (suggested for PR)

- Mobile HUD (mask hotbar visible)
- Desktop HUD with S.E.R.A console
- Reduced-motion enabled (show static state)

## Rollback notes

Revert `components/UIOverlay.tsx` — no cross-file migrations.

## Suggested reviewers

- UI / frontend maintainer
- Game mechanics owner (quick sanity check on keyboard behavior)

---

Prepared for branch: `ui/neumorphism-tailwind`
