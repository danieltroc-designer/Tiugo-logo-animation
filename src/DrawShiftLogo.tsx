import { useEffect, useMemo } from "react";
import {
  animate,
  cubicBezier,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { TIUGO_PATHS, TIUGO_VIEWBOX, type TiugoPath } from "./tiugoPaths";

const NUMBER_PATTERN = "-?\\d*\\.?\\d+(?:e[-+]?\\d+)?";
const DRAW_EASE = cubicBezier(0.37, 0, 0.2, 1);

/** Left-to-right reading order, which is how the wordmark draws. */
const DRAW_ORDER = ["T", "iDot", "iStem", "u", "g", "o"];

/** Squares accelerate out of the hold, then settle back from the overshoot. */
const SHIFT_OUT_EASE = cubicBezier(0.77, 0, 0.175, 1);
const SETTLE_EASE = cubicBezier(0.23, 1, 0.32, 1);

/**
 * The straight and final frames export the same command skeleton, so
 * interpolating their numbers pairwise slides the three moving squares without
 * distorting any letter. Only T, u and g have differing numbers.
 *
 * t may exceed 1, which extrapolates past the final frame so the squares can
 * overshoot their landing position before settling.
 */
export function lerpPath(from: string, to: string, t: number): string {
  if (from === to) return from;
  if (t <= 0) return from;
  if (t === 1) return to;

  const target = to.match(new RegExp(NUMBER_PATTERN, "gi"));
  if (!target) return from;

  let index = 0;
  return from.replace(new RegExp(NUMBER_PATTERN, "gi"), (raw) => {
    const a = Number(raw);
    const b = Number(target[index++] ?? raw);
    return (a + (b - a) * t).toFixed(3);
  });
}

type LetterTiming = {
  drawStart: number;
  drawEnd: number;
  fillStart: number;
  fillEnd: number;
};

type Timeline = {
  letters: LetterTiming[];
  shiftStart: number;
  shiftEnd: number;
  total: number;
};

export function buildTimeline({
  count,
  duration,
  stagger,
  hold,
  slide,
}: {
  count: number;
  duration: number;
  stagger: number;
  hold: number;
  slide: number;
}): Timeline {
  const letters: LetterTiming[] = Array.from({ length: count }, (_, index) => {
    const drawStart = index * stagger;
    const drawEnd = drawStart + duration;
    return {
      drawStart,
      drawEnd,
      fillStart: drawStart + duration * 0.85,
      fillEnd: drawEnd + duration * 0.3,
    };
  });

  const inkedAt = Math.max(...letters.map((letter) => letter.fillEnd));
  const shiftStart = inkedAt + hold;
  const shiftEnd = shiftStart + slide;

  return { letters, shiftStart, shiftEnd, total: shiftEnd + 0.7 };
}

function Letter({
  part,
  clock,
  timing,
  morph,
  lineWeight,
  logoColor,
}: {
  part: TiugoPath;
  clock: MotionValue<number>;
  timing: LetterTiming;
  morph: MotionValue<number>;
  lineWeight: number;
  logoColor: string;
}) {
  const pathLength = useTransform(
    clock,
    [timing.drawStart, timing.drawEnd],
    [0, 1],
    { ease: DRAW_EASE, clamp: true },
  );
  const strokeOpacity = useTransform(
    clock,
    [timing.fillStart, timing.fillEnd],
    [1, 0],
    { clamp: true },
  );
  const fillOpacity = useTransform(
    clock,
    [timing.fillStart, timing.fillEnd],
    [0, 1],
    { clamp: true },
  );
  const d = useTransform(morph, (progress) =>
    lerpPath(part.straight, part.final, progress),
  );

  return (
    <motion.path
      d={d}
      fill={logoColor}
      stroke={logoColor}
      strokeWidth={lineWeight}
      strokeLinejoin="round"
      style={{ pathLength, strokeOpacity, fillOpacity }}
    />
  );
}

export default function DrawShiftLogo({
  duration,
  stagger,
  hold,
  slide,
  overshoot,
  lineWeight,
  scale,
  logoColor,
  loop,
  replayKey,
  reduceMotion,
}: {
  duration: number;
  stagger: number;
  hold: number;
  slide: number;
  overshoot: number;
  lineWeight: number;
  scale: number;
  logoColor: string;
  loop: boolean;
  replayKey: number;
  reduceMotion: boolean;
}) {
  const parts = useMemo(
    () =>
      DRAW_ORDER.map((id) => TIUGO_PATHS.find((part) => part.id === id)).filter(
        (part): part is TiugoPath => Boolean(part),
      ),
    [],
  );

  const timeline = useMemo(
    () => buildTimeline({ count: parts.length, duration, stagger, hold, slide }),
    [parts.length, duration, stagger, hold, slide],
  );

  const clock = useMotionValue(0);

  // Overshoot is a real keyframe past the destination rather than an easing
  // that exceeds 1, because the eased value feeds path interpolation directly.
  // At the slider maximum this peaks at 1.075, which is under one SVG unit of
  // travel on an ~11.5 unit shift.
  const overshootProgress = 1 + (overshoot / 100) * 0.25;
  const settleAt = timeline.shiftStart + (timeline.shiftEnd - timeline.shiftStart) * 0.72;

  const morph = useTransform(
    clock,
    [timeline.shiftStart, settleAt, timeline.shiftEnd],
    [0, overshootProgress, 1],
    {
      ease: [SHIFT_OUT_EASE, SETTLE_EASE],
      clamp: true,
    },
  );

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

  return (
    <div
      className="logo-scale"
      style={{ "--logo-scale": scale / 100 } as React.CSSProperties}
      role="img"
      aria-label="Tiugo"
    >
      <div className="logo logo--exact">
        <svg
          className="logo-draw-svg"
          viewBox={`0 0 ${TIUGO_VIEWBOX.width} ${TIUGO_VIEWBOX.height}`}
          aria-hidden="true"
        >
          {parts.map((part, index) => (
            <Letter
              key={part.id}
              part={part}
              clock={clock}
              timing={timeline.letters[index]}
              morph={morph}
              lineWeight={lineWeight}
              logoColor={logoColor}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
