import { useEffect, useMemo } from "react";
import { animate, cubicBezier, transform, useTransform, type MotionValue } from "motion/react";

/** Fade from the resting mark to an empty stage before a loop starts over. */
export const LOOP_EXIT = 0.32;
/** Empty beat between that fade and the next entrance. */
export const LOOP_GAP = 0.18;

const EXIT_EASE = cubicBezier(0.37, 0, 0.63, 1);

/**
 * Plays a study's clock from 0 to `total`, which covers its entrance plus a
 * rest on the final pose. Every study runs on one clock like this, so all of
 * its parts restart on the same frame.
 *
 * When looping, each pass also fades the mark out and leaves a short empty
 * beat, so the next entrance starts from a clean stage instead of cutting
 * straight from the finished logo to nothing.
 *
 * While `paused`, playback stops entirely and the caller drives the clock,
 * which is how export renders each frame at an exact time.
 *
 * Returns the opacity for the study's wrapper.
 */
export function useStudyPlayback({
  clock,
  total,
  loop,
  replayKey,
  reduceMotion,
  paused,
}: {
  clock: MotionValue<number>;
  total: number;
  loop: boolean;
  replayKey: number;
  reduceMotion: boolean;
  paused: boolean;
}): MotionValue<number> {
  const looping = loop && !reduceMotion && !paused;

  useEffect(() => {
    if (paused) return;

    if (reduceMotion) {
      clock.set(total);
      return;
    }

    const cycle = looping ? total + LOOP_EXIT + LOOP_GAP : total;
    clock.set(0);
    const playback = animate(clock, cycle, {
      duration: cycle,
      ease: "linear",
      repeat: looping ? Infinity : 0,
    });

    return () => playback.stop();
  }, [clock, total, looping, replayKey, reduceMotion, paused]);

  const fadeOut = useMemo(
    () => transform([total, total + LOOP_EXIT], [1, 0], { ease: EXIT_EASE, clamp: true }),
    [total],
  );

  return useTransform(clock, (time) => (looping ? fadeOut(time) : 1));
}
