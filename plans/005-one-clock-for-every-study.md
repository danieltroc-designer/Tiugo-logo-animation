# 005 — One clock for every study, and frame-exact export

- **Status**: DONE
- **Commit**: on top of `55a1177`
- **Severity**: HIGH
- **Category**: Correctness, interruptibility, export fidelity

Findings came from frame-by-frame contact sheets of every study, rendered by
stepping a virtual clock rather than watching real-time playback.

## Problems

1. **Gather and Soft cascade were clipped to the logo's bounding box.** The
   wrapper animated `clipPath: inset(0 0% 0 0)` for every piece study, not just
   Sweep. Pieces travelling in from outside the box were cut off mid-flight: the
   T lost its crossbar for the first ~0.3s of Soft cascade, the i dot was hidden
   entirely, and the o and the g descender were sliced flat in Gather.
2. **Loops restarted piece by piece.** Studies 01–03 gave each piece its own
   repeating transition, so on every loop the pieces blinked out and flew back
   in one at a time, and the complete logo held for only ~0.4s. Sweep set
   `repeat: 0` on its pieces, so from the second loop on only the wipe repeated
   and the letters no longer resolved.
3. **Every loop cut from the finished logo straight to an empty stage.**
4. **Exports ran fast.** Capture sampled live playback in real time and waited
   a fixed 33ms after each snapshot, so frames were ~50ms apart and the video
   played ~1.5× faster than the preview, then held a frozen tail. The first
   snapshot also stalls for up to a second.
5. **Exports clipped Gather and Soft cascade** even after fix 1, because the
   snapshot covered only the logo box.
6. **GIF and video timing drifted.** GIF delays are whole centiseconds, so 15fps
   frames were written as 70ms (5% slow); video waited a fixed interval after
   each draw, so timer overshoot accumulated.

## What changed

- `PieceLogo.tsx` moves studies 01–03 out of `App.tsx` onto one clock, like
  studies 04 and 05. Soft cascade samples Motion's `spring` generator, so it
  keeps the same spring. Only Sweep applies a clip path.
- `useStudyPlayback.ts` is the single playback effect for all five studies.
  When looping, each pass fades the mark out over 0.32s and leaves a 0.18s
  empty beat before the next entrance.
- The clock lives in `App.tsx`. Export pauses playback and seeks the clock to
  `frame / fps` before each snapshot, and no longer switches Loop off.
- Capture records a bleed of half the logo box on every side while keeping the
  box where it always sat in the frame.
- GIF delays round against the running total (60/70ms alternating at 15fps);
  video frames are paced against absolute deadlines.

Soft cascade's loop length uses the settle time of a critically damped spring,
which bounds every bounce in the Overshoot slider's 0–30% range. That keeps the
live Overshoot slider from restarting playback on every drag event.

## Verification

- `npm run build` exits 0.
- Contact sheets before and after for every study at default parameters:
  single-pass motion is unchanged apart from the clipping, and loops restart
  with all pieces on the same frame.
- Reduced motion (emulated): all five studies show the exact final mark at t=0
  and stay still with Loop on.
- GIF exports of Draw & shift, Gather, and Soft cascade: frame `k` matches the
  preview at `k / 15` seconds, total delay equals the frame count ÷ 15, and the
  Draw & shift framing is unchanged (max pixel difference 8/255 from GIF
  quantisation).
- MP4/WebM were not recorded end to end; that path shares the capture code and
  only its frame pacing changed.

## Not addressed

- Lottie export does not match the preview: travel is not scaled to the
  1920×1080 composition, Path + pixel shows its fill from frame zero and omits
  the pixel square, Soft cascade uses an ease rather than the spring, Sweep has
  no wipe mask, and Draw & shift has no overshoot.
- Path + pixel's square is 13×13 at a fixed spot inside the T stem rather than
  the real 27×27 foot, so it reads as a dark blot over the half-inked T at
  ~0.6s before disappearing into the fill.
- Draw & shift's overshoot peaks at 0.3 SVG units at the default 12% (0.86 at
  30%), well under a pixel at 1×.
