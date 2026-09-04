# Animation improvement plans

Plans generated from the standard `/improve-animations` audit. The repository is on an unborn branch with no commit hash; each plan records that explicitly.

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Synchronize Path + pixel looping](001-fix-path-pixel-loop.md) | HIGH | DONE |
| 002 | [Make morph overshoot visible](002-make-morph-overshoot-real.md) | MEDIUM | DONE |
| 003 | [Commit timeline sliders before replay](003-commit-slider-playback.md) | MEDIUM | DONE |
| 004 | [Scope reduced-motion behavior](004-scope-reduced-motion.md) | MEDIUM | DONE |

All four landed together in the order below. `npm run build` exits 0.
Plan 003 deviates from its written spec by one field; the reason is recorded in
that plan's implementation note.

## Recommended execution order

1. **001 — Synchronize Path + pixel looping**: fixes the only HIGH-severity visible defect and establishes one-clock timing for both advanced studies.
2. **003 — Commit timeline sliders before replay**: stabilizes playback while tuning and should land after the shared-clock refactor.
3. **002 — Make morph overshoot visible**: isolated Draw & shift polish; easier to feel-check after playback controls are stable.
4. **004 — Scope reduced-motion behavior**: independent CSS fix; may be executed in parallel, but verify all refactored study components afterward.

## Dependencies

- Plan 003 should follow Plan 001 so its commit/replay behavior is verified against the final shared-clock Path + pixel implementation.
- Plans 002 and 004 have no code dependency on Plan 001.
- Plan 004’s final verification covers all studies and should run after any parallel branches are combined.

## Scope deliberately excluded

The user chose not to plan the three additive opportunities: parameter-list transitions, description crossfades, and study-button press feedback. Findings 5–8 from the audit also remain unplanned.
