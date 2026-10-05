import { useMemo } from "react";
import {
  calcGeneratorDuration,
  cubicBezier,
  motion,
  spring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react";
import { ASSEMBLE_OFFSETS, PARTS, partStyle, type Part } from "./logoParts";
import { useStudyPlayback } from "./useStudyPlayback";

export type PieceStudy = "assemble" | "cascade" | "reveal";

const SETTLE_EASE = cubicBezier(0.22, 1, 0.36, 1);
const SWEEP_EASE = cubicBezier(0.65, 0, 0.35, 1);

/** Rest on the finished mark before a loop starts over. */
const REST = 0.8;

/**
 * How one piece travels to rest. `at` maps seconds since the piece started to
 * progress from 0 to 1 (a spring may briefly pass 1); `length` is when it has
 * fully settled.
 */
type SettleCurve = {
  at: (elapsed: number) => number;
  length: number;
};

function springCurve(duration: number, bounce: number): SettleCurve {
  const generator = spring({ keyframes: [0, 1], visualDuration: duration, bounce });
  const length = calcGeneratorDuration(generator) / 1000;
  return {
    length,
    at: (elapsed) =>
      elapsed <= 0 ? 0 : elapsed >= length ? 1 : generator.next(elapsed * 1000).value,
  };
}

function tweenCurve(duration: number): SettleCurve {
  return {
    length: duration,
    at: (elapsed) => SETTLE_EASE(Math.min(1, Math.max(0, elapsed / duration))),
  };
}

type PieceTimeline = {
  curve: SettleCurve;
  starts: number[];
  sweepEnd: number;
  /** When the last piece has fully come to rest. */
  settled: number;
  total: number;
};

export function buildPieceTimeline({
  study,
  count,
  duration,
  stagger,
  overshoot,
}: {
  study: PieceStudy;
  count: number;
  duration: number;
  stagger: number;
  overshoot: number;
}): PieceTimeline {
  const curve =
    study === "cascade" ? springCurve(duration, overshoot / 100) : tweenCurve(duration);
  const starts = Array.from({ length: count }, (_, index) => index * stagger);
  const lastStart = starts[starts.length - 1] ?? 0;
  const sweepEnd = study === "reveal" ? duration * 0.9 : 0;

  // Overshoot is a live slider, so the playback length must not depend on it:
  // if it did, every drag event would restart the study. A critically damped
  // spring is the slowest to settle across the slider's 0–30% range, so it
  // bounds every bounce the slider can produce.
  const settleWindow = study === "cascade" ? springCurve(duration, 0).length : duration;

  return {
    curve,
    starts,
    sweepEnd,
    settled: Math.max(sweepEnd, lastStart + curve.length),
    total: Math.max(sweepEnd, lastStart + settleWindow) + REST,
  };
}

function Piece({
  part,
  index,
  study,
  clock,
  start,
  curve,
  distance,
  overshoot,
  logoColor,
}: {
  part: Part;
  index: number;
  study: PieceStudy;
  clock: MotionValue<number>;
  start: number;
  curve: SettleCurve;
  distance: number;
  overshoot: number;
  logoColor: string;
}) {
  const offset = ASSEMBLE_OFFSETS[index];
  const from =
    study === "assemble"
      ? {
          x: offset.x * distance,
          y: offset.y * distance,
          rotate: offset.rotate * (0.4 + overshoot / 30),
          scale: 0.94,
        }
      : study === "cascade"
        ? { x: 0, y: -distance, rotate: 0, scale: 0.96 }
        : { x: -Math.min(distance * 0.22, 18), y: 0, rotate: 0, scale: 1 };

  const progress = useTransform(clock, (time) => curve.at(time - start));
  const x = useTransform(progress, (value) => from.x * (1 - value));
  const y = useTransform(progress, (value) => from.y * (1 - value));
  const rotate = useTransform(progress, (value) => from.rotate * (1 - value));
  const scale = useTransform(progress, (value) => from.scale + (1 - from.scale) * value);
  const opacity = useTransform(progress, (value) => Math.min(1, value));

  return (
    <motion.div
      className="logo-part"
      style={{ ...partStyle(part), color: logoColor, x, y, rotate, scale, opacity }}
    >
      <svg viewBox={`0 0 ${part.width} ${part.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={part.path} fill="currentColor" />
      </svg>
    </motion.div>
  );
}

export default function PieceLogo({
  study,
  clock,
  duration,
  stagger,
  distance,
  overshoot,
  scale,
  logoColor,
  loop,
  replayKey,
  reduceMotion,
  paused,
}: {
  study: PieceStudy;
  clock: MotionValue<number>;
  duration: number;
  stagger: number;
  distance: number;
  overshoot: number;
  scale: number;
  logoColor: string;
  loop: boolean;
  replayKey: number;
  reduceMotion: boolean;
  paused: boolean;
}) {
  const timeline = useMemo(
    () => buildPieceTimeline({ study, count: PARTS.length, duration, stagger, overshoot }),
    [study, duration, stagger, overshoot],
  );

  const opacity = useStudyPlayback({
    clock,
    total: timeline.total,
    loop,
    replayKey,
    reduceMotion,
    paused,
  });

  // Only the sweep masks the wordmark. The other studies travel in from
  // outside its bounds, so clipping them would cut pieces off mid-flight.
  const sweep = useTransform(clock, (time) => {
    const progress =
      timeline.sweepEnd > 0
        ? SWEEP_EASE(Math.min(1, Math.max(0, time / timeline.sweepEnd)))
        : 1;
    return `inset(0 ${(1 - progress) * 100}% 0 0)`;
  });

  return (
    <motion.div
      className="logo-scale"
      style={
        {
          "--logo-scale": scale / 100,
          opacity,
          clipPath: study === "reveal" ? sweep : undefined,
        } as MotionStyle
      }
      aria-label="Tiugo"
      role="img"
    >
      <div className="logo">
        {PARTS.map((part, index) => (
          <Piece
            key={part.name}
            part={part}
            index={index}
            study={study}
            clock={clock}
            start={timeline.starts[index]}
            curve={timeline.curve}
            distance={distance}
            overshoot={overshoot}
            logoColor={logoColor}
          />
        ))}
      </div>
    </motion.div>
  );
}
