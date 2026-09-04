# 004 — Scope reduced-motion behavior

- **Status**: DONE — universal override removed; no `@keyframes` existed, so nothing depended on it
- **Commit**: unborn branch (no commits)
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, roughly 15–25 lines

## Problem

The global reduced-motion rule removes every transition, including useful color, toggle, focus, and press feedback:

```css
/* src/styles.css:622–630 — current */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  .logo-part {
    will-change: auto;
  }
}
```

Reduced motion should remove spatial movement while retaining short opacity/color feedback that communicates state. The logo components already branch with `useReducedMotion()`, so the universal CSS override is redundant for their main motion.

## Target

Remove the universal `transition-duration`, `animation-duration`, and `animation-iteration-count` reset. Keep non-spatial UI feedback at `100–160ms`; use the strong ease-out curve from the audit:

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .logo-part,
  .logo-path-slot,
  .t-pixel-accent {
    will-change: auto;
  }

  .replay-button:hover,
  .study-picker button:hover i {
    transform: none;
  }

  .replay-button,
  .study-picker button,
  .study-picker i,
  .toggle-track,
  .toggle-track span {
    transition-duration: 160ms;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  }
}
```

The JavaScript behavior remains authoritative:

- `Logo` uses `useReducedMotion()` and renders final states.
- `DrawShiftLogo` sets its clock to `timeline.total` and does not start playback.
- Opacity and color feedback remains available for controls and selection changes.

## Repo conventions to follow

Reduced-motion handling already has two layers:

- Component-level JS in `src/App.tsx:213–214` and `src/DrawShiftLogo.tsx:184–188`.
- CSS cleanup in the final media query of `src/styles.css`.

Keep that division: JS owns logo timelines; CSS owns interaction transforms and layer-promotion cleanup.

## Steps

1. In `src/styles.css`, delete the universal reduced-motion selector and its three duration/iteration declarations.
2. Keep `scroll-behavior: auto`, scoped to `html`.
3. Extend the layer-promotion cleanup to `.logo-path-slot` and `.t-pixel-accent`.
4. Remove hover translation from `.replay-button` and `.study-picker i` only under reduced motion.
5. Preserve interaction color/opacity feedback with the exact `160ms cubic-bezier(0.23, 1, 0.32, 1)` rule above.
6. Confirm no CSS keyframe animation elsewhere depends on the deleted universal rule; the current audit found none.

## Boundaries

- Do NOT change `useReducedMotion` branches in React unless verification reveals they no longer produce the final logo.
- Do NOT remove color, opacity, focus-ring, toggle, or selection feedback.
- Do NOT use `transition: none`.
- Do NOT add dependencies or change normal-motion timing.
- If the cited implementation no longer matches the unborn-branch state, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm run build`; TypeScript and Vite must finish with exit code 0.
- **Feel check**:
  - In DevTools Rendering, emulate `prefers-reduced-motion: reduce`.
  - Load every logo study; each must show its complete final frame immediately with no drawing, translation, rotation, or scale entrance.
  - Toggle Loop; no logo movement should begin.
  - Hover Replay and study cards; colors may change over 160ms, but elements must not translate.
  - Click Replay and the Loop toggle; press/toggle feedback must remain perceptible.
  - Disable reduced motion and confirm all normal study animation returns.
- **Done when**: spatial logo/hover movement is absent under reduced motion, while control state changes still have brief color/opacity feedback.
