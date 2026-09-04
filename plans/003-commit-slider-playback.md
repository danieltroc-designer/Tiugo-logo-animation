# 003 — Commit timeline sliders before replay

- **Status**: DONE — deviation: `drawStrength` was added to `TimelineParameters` (see note below)
- **Commit**: unborn branch (no commits)
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 2 files, roughly 50–80 lines

## Problem

Four sliders update timeline inputs on every `input` event:

```tsx
// src/App.tsx:419–427 — current
duration: <RangeControl ... value={duration} ... onChange={setDuration} />,
stagger: <RangeControl ... value={stagger} ... onChange={setStagger} />,
hold: <RangeControl ... value={hold} ... onChange={setHold} />,
slide: <RangeControl ... value={slide} ... onChange={setSlide} />,
```

Those values rebuild `timeline.total`, which is an effect dependency:

```tsx
// src/DrawShiftLogo.tsx:184–197 — current
useEffect(() => {
  if (reduceMotion) {
    clock.set(timeline.total);
    return;
  }

  clock.set(0);
  const playback = animate(clock, timeline.total, {
    duration: timeline.total,
    ease: "linear",
    repeat: loop ? Infinity : 0,
  });

  return () => playback.stop();
}, [clock, timeline.total, loop, replayKey, reduceMotion]);
```

Dragging a range thumb emits many updates, repeatedly stops playback, and snaps the preview to zero. This makes parameter tuning feel broken rather than responsive.

## Target

Display draft slider values immediately, but commit timing values to playback only when the user finishes interacting:

- Pointer interaction: commit on `pointerup`.
- Keyboard interaction: commit on `keyup` after Arrow, PageUp, PageDown, Home, or End.
- Blur: commit as a fallback.
- `Replay` uses the most recently committed values.
- Non-timeline visual sliders may remain live.

Use a dedicated object so timing commits are atomic:

```ts
type TimelineParameters = {
  duration: number;
  stagger: number;
  hold: number;
  slide: number;
};

const [draftTimeline, setDraftTimeline] = useState<TimelineParameters>(defaults);
const [playbackTimeline, setPlaybackTimeline] =
  useState<TimelineParameters>(defaults);
```

`DrawShiftLogo` must receive `playbackTimeline`. The visible controls must read and update `draftTimeline`. On commit:

```ts
const commitTimeline = () => {
  setPlaybackTimeline(draftTimeline);
  setReplayKey((value) => value + 1);
};
```

## Repo conventions to follow

- Keep `RangeControl` as the single range-input component in `src/App.tsx`.
- Keep explicit state in `App`; do not introduce a form library.
- Preserve Replay’s existing `replayKey` remount/restart convention.
- Keep range output values updating live while dragging.

## Steps

1. Extend `RangeControl` with an optional `onCommit?: () => void`.
2. Call `onCommit` from `onPointerUp`, `onBlur`, and relevant `onKeyUp` events. Guard duplicate events in the same interaction so one drag causes one commit/replay.
3. Replace the four independent timing states with `draftTimeline` and `playbackTimeline` objects, or equivalent atomic state with the same behavior.
4. Render Duration, Stagger, Hold, and Square slide from draft values and update only draft state during `onChange`.
5. Pass committed values to `Logo`/`DrawShiftLogo`. For studies where immediate preview is preferred, commit when entering that study or through the same `onCommit` mechanism—do not create study-specific hidden values.
6. Update Reset to set both draft and playback values to defaults in one action and trigger exactly one replay.
7. Verify changing Logo size, Travel, Path draw, Pixel nudge, or Overshoot does not unexpectedly restart Draw & shift unless its implementation genuinely requires a new playback.

## Boundaries

- Do NOT change slider ranges, steps, labels, or visual styling.
- Do NOT debounce with an arbitrary timeout.
- Do NOT create a global state store or add dependencies.
- Do NOT alter the logo animation sequence.
- If the cited implementation no longer matches the unborn-branch state, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm run build`; TypeScript and Vite must finish with exit code 0.
- **Feel check**:
  - Start `05 · Draw & shift`; while it runs, drag Duration continuously for two seconds.
  - The numeric output must follow the thumb without repeatedly snapping animation to frame zero.
  - Release the thumb; playback should restart once with the new duration.
  - Repeat using Arrow keys; each completed keyboard adjustment should commit predictably without concurrent clocks.
  - Enable Loop, adjust Hold, and verify one old playback stops before one new playback starts.
  - Use Replay and confirm it uses the visible values.
- **Done when**: one slider interaction causes at most one playback restart, displayed and committed values converge on release, and no stale timeline remains active.

## Implementation note

`TimelineParameters` carries five values, not the four listed above. Plan 001
moved `Path + pixel` onto a shared clock whose length depends on `drawStrength`,
so leaving that slider live reintroduced exactly the restart-on-every-move
problem this plan exists to fix. It now commits through the same `onCommit`
mechanism, which is the escape hatch this plan's step 5 allows. The visible
trade-off is that stroke weight in `Draw & shift` updates on release rather
than during the drag.
