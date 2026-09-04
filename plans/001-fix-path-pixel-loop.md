# 001 — Synchronize Path + pixel looping

- **Status**: DONE — `Path + pixel` now runs on one shared clock in `src/PathDrawLogo.tsx`
- **Commit**: unborn branch (no commits)
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 2 files, roughly 100–150 lines moved/refactored

## Problem

`Path + pixel` gives its wrapper, each SVG path, and the accent square separate repeating animations. Their durations differ, so their loop periods differ and the elements drift out of phase.

```tsx
// src/App.tsx:267–272 — current wrapper clock
transition={{
  duration,
  delay: drawDelay * 0.75,
  ease: [0.22, 1, 0.36, 1],
  repeat,
  repeatDelay: 0.9,
}}
```

```tsx
// src/App.tsx:295–300 — current path clock
transition={{
  duration: Math.max(0.35, duration * (1.05 + (1 - traceStrength) * 0.65)),
  delay: drawDelay,
  ease: [0.37, 0, 0.2, 1],
  repeat,
  repeatDelay: 0.9,
}}
```

```tsx
// src/App.tsx:317–322 — current accent clock
transition={{
  duration: Math.max(0.28, duration * 0.7),
  delay: reduceMotion ? 0 : Math.max(0.06, stagger * 2.2),
  ease: [0.2, 1, 0.3, 1],
  repeat,
  repeatDelay: 0.9,
}}
```

Because `duration`, derived path duration, and accent duration are unequal, `repeatDelay: 0.9` cannot keep the three timelines synchronized.

## Target

Create one `MotionValue<number>` clock for the complete study. Animate it linearly from `0` to a computed total duration and apply `repeat: loop ? Infinity : 0` only once. Derive wrapper translation/opacity, path length/fill/stroke opacity, and accent translation/opacity with `useTransform`.

Use these curves:

```ts
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);
```

- Entering opacity/translation: `EASE_OUT`.
- On-screen path drawing: `EASE_IN_OUT`.
- Keep the current `0.9s` idle period once, at the end of the shared timeline.
- On loop restart, all paths, wrappers, and the accent must return to frame zero together.

## Repo conventions to follow

`src/DrawShiftLogo.tsx:163–197` already implements the correct shared-clock architecture:

```tsx
const timeline = useMemo(
  () => buildTimeline({ count: parts.length, duration, stagger, hold, slide }),
  [parts.length, duration, stagger, hold, slide],
);

const clock = useMotionValue(0);

useEffect(() => {
  clock.set(0);
  const playback = animate(clock, timeline.total, {
    duration: timeline.total,
    ease: "linear",
    repeat: loop ? Infinity : 0,
  });

  return () => playback.stop();
}, [clock, timeline.total, loop, replayKey, reduceMotion]);
```

Follow this pattern rather than introducing a second timing model.

## Steps

1. Create `src/PathDrawLogo.tsx` and move the current `study === "pathdraw"` implementation out of `Logo` in `src/App.tsx`.
2. Add a `buildTimeline` function that calculates each part’s start/end times and one total equal to the latest end time plus `0.9s`.
3. Create one `clock = useMotionValue(0)` and one `animate(clock, timeline.total, { duration: timeline.total, ease: "linear", repeat })` effect.
4. Replace wrapper `initial`/`animate` transitions with `useTransform(clock, ...)` values for transform and opacity.
5. Replace each path’s independent repeat with `useTransform` values for `pathLength`, `fillOpacity`, and `strokeOpacity`.
6. Replace the accent’s independent repeat with values derived from the same clock.
7. In reduced-motion mode, set the clock to `timeline.total` and do not start playback.
8. Render `PathDrawLogo` from `App.tsx` with the existing props and delete the old conditional branch.

## Boundaries

- Do NOT change the visual sequence, SVG paths, Figma geometry, slider ranges, or labels.
- Do NOT modify `DrawShiftLogo.tsx` or `tiugoPaths.ts`.
- Do NOT add dependencies.
- If the cited implementation no longer matches the unborn-branch state, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm run build`; TypeScript and Vite must finish with exit code 0.
- **Feel check**:
  - Open study `04 · Path + pixel`, enable Loop, and watch at least five complete cycles.
  - The path, wrapper, and accent must start each cycle on the same frame with no cumulative drift.
  - Toggle Loop during playback; the current cycle may finish or restart once, but must never create concurrent clocks.
  - Set DevTools Animations playback to 10% and verify all parts return to their initial state at the same boundary.
  - Toggle `prefers-reduced-motion`; the completed logo should render immediately without translation or drawing.
- **Done when**: five loop cycles remain frame-identical and only one repeating `animate()` call exists for the study.
