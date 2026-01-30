# Copilot Instructions for Hành Trình Về Nhà

- **Purpose**: Single-page Vite + React 19 canvas runner game themed around masks (persona) and memory collection.
- **Entrypoint**: [index.tsx](../index.tsx) mounts [App.tsx](../App.tsx) into `#root`.
- **Core layout**: [App.tsx](../App.tsx) owns global game UI state (health, integrity, mask, level index, memories, AI message, game state) and passes setters to [components/GameCanvas.tsx](../components/GameCanvas.tsx) and display props to [components/UIOverlay.tsx](../components/UIOverlay.tsx).

## Build & Run

- Install deps: `npm install` (Node.js required).
- Dev server: `npm run dev` (Vite on port 3000, host 0.0.0.0).
- Build: `npm run build`; Preview: `npm run preview`.
- Env: place `GEMINI_API_KEY=<key>` in .env.local; Vite injects as `process.env.GEMINI_API_KEY` (defined in [vite.config.ts](../vite.config.ts)).

## Gameplay & Simulation

- Game loop: `requestAnimationFrame` tick in [GameCanvas.tsx](../components/GameCanvas.tsx); `update()` mutates refs, `draw()` renders to canvas.
- Levels: `LEVELS` array in [GameCanvas.tsx](../components/GameCanvas.tsx) defines 5 stages (color themes, obstacle types, required mask, narrative message, lengths). `generateLevel()` resets player and obstacles per stage.
- Controls: Arrow keys/`WASD` for move+jump; `Space` also jumps; `1/2/3/4/0` switch masks. UI mask buttons dispatch synthetic keyboard events to reuse handlers.
- Masks alter physics: CHILD → faster, bouncy; STUDENT → low gravity, slower; WORKER → heavy, faster, stronger jump and can destroy spikes/blocks; SOCIAL → only gating; NONE (true self) prevents integrity drain.
- Stats: Health and Integrity drop on damage/mask misuse; Integrity regenerates only when mask is NONE. Game over if health or integrity ≤0; victory after final level.
- Obstacles: walls (require specific mask or cause damage on collision), spikes (damage), blocks (solid), memory pickups (increment `memoriesCollected` up to `TOTAL_MEMORIES` in [types.ts](../types.ts)), goal triggers next level or victory.
- AI flavor text: `triggerAI()` throttles contextual S.E.R.A messages; `aiMessage` shown in overlay.

## UI & Styling

- [UIOverlay.tsx](../components/UIOverlay.tsx) renders start/game-over/victory overlays and HUD (health, integrity, memory count, AI console, mask hotbar). Uses Tailwind-style utility classes; no extra styling files present.
- HUD uses `pointer-events-none` except for mask buttons and start/restart buttons.

## Patterns & Conventions

- Shared mutable state stored in React `useRef` within canvas; React state used only for values displayed by UI overlay to avoid rerender overhead.
- Canvas physics constants default in [components/GameCanvas.tsx](../components/GameCanvas.tsx) (BASE_GRAVITY/SPEED/JUMP) while canonical values are also exported from [types.ts](../types.ts); keep consistency if adding new features.
- Level camera follows player with smoothing; shake/glitch effects tied to low health and obstacle destruction.
- Adding new masks/levels: extend `MaskType`/`LEVELS`; ensure `UIOverlay` mask list and wall `reqMask` handling stay in sync.

## Testing & Debugging Tips

- No automated tests; manual play via dev server. For debugging physics, tweak constants near top of [GameCanvas.tsx](../components/GameCanvas.tsx) and use AI messages or UI overlays to expose state.
