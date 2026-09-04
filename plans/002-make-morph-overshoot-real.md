# 002 — Make morph overshoot visible

- **Status**: DONE — overshoot measured at 0.867 SVG units past target at the 30% maximum
- **Commit**: unborn branch (no commits)
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, roughly 20–35 lines

## Problem

The `Draw & shift` Overshoot control modifies a cubic Bézier so it can produce progress greater than `1`, but `lerpPath` clamps that value to the final path. The control therefore cannot create the promised settle.

```ts
// src/DrawShiftLogo.tsx:25–27 — current
if (from === to) return from;
if (t <= 0) return from;
if (t >= 1) return to;
```

```ts
// src/DrawShiftLogo.tsx:170–181 — current
const shiftEase = useMemo(
  () => cubicBezier(0.22, 1 + overshoot / 60, 0.36, 1),
  [overshoot],
);

const morph = useTransform(
  clock,
  [timeline.shiftStart, timeline.shiftEnd],
  [0, 1],
  { ease: shiftEase, clamp: true },
);
```

Any eased value at or above `1` becomes the exact final geometry early, so the square cannot travel beyond the destination and settle back.

## Target

Model overshoot explicitly as a three-keyframe path interpolation:

```ts
const overshootProgress = 1 + (overshoot / 100) * 0.25;
const settleAt =
  timeline.shiftStart + (timeline.shiftEnd - timeline.shiftStart) * 0.72;

const morph = useTransform(
  clock,
  [timeline.shiftStart, settleAt, timeline.shiftEnd],
  [0, overshootProgress, 1],
  {
    ease: [
      cubicBezier(0.77, 0, 0.175, 1),
      cubicBezier(0.23, 1, 0.32, 1),
    ],
    clamp: true,
  },
);
```

At the maximum UI value of `30%`, path progress peaks at `1.075`; because the Figma square shift is about `11.5` SVG units, the visible spatial overshoot stays below one SVG unit. At `0%`, the middle value is exactly `1`, so there is no overshoot.

`lerpPath` must permit progress above `1`:

```ts
if (from === to) return from;
if (t <= 0) return from;
// no `t >= 1` early return; exact t=1 interpolation still equals `to`
```

## Repo conventions to follow

- Keep `lerpPath` as the single path-number interpolation helper in `src/DrawShiftLogo.tsx`.
- Keep one shared timeline clock; do not create a second independent animation.
- Preserve `cubicBezier` from `motion/react`, already imported at `src/DrawShiftLogo.tsx:4`.

## Steps

1. Remove only the `if (t >= 1) return to;` guard from `lerpPath`.
2. Replace `shiftEase` with the explicit `overshootProgress` and `settleAt` values shown above.
3. Change `morph` to the three-point input/output ranges and exact two-curve easing array shown above.
4. Add unit coverage for `lerpPath` if a test runner exists by execution time: verify `t=0`, `t=1`, and `t=1.075`. If no test runner exists, do not add one solely for this plan.
5. Keep the existing `Overshoot` slider range `0–30%` unchanged.

## Boundaries

- Do NOT alter the Figma path strings in `src/tiugoPaths.ts`.
- Do NOT change draw, fill, hold, slide, or loop timing.
- Do NOT add a physics library or a second clock.
- Do NOT change other studies.
- If the cited implementation no longer matches the unborn-branch state, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm run build`; TypeScript and Vite must finish with exit code 0.
- **Feel check**:
  - Open `05 · Draw & shift`, set Overshoot to `0%`, and observe a direct shift with no pass beyond the destination.
  - Set Overshoot to `30%`, use 10% DevTools playback speed, and verify all three squares pass slightly beyond their final positions at 72% of the slide, then settle back together.
  - The overshoot must stay subtle—less than one SVG unit at the maximum setting.
  - Replay three times and confirm the exact final Figma shape is restored every time.
- **Done when**: `0%` and `30%` look visibly different in slow motion, all three squares remain synchronized, and the final `d` values equal the final Figma paths.
