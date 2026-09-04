import { useEffect, useMemo, type CSSProperties } from "react";
import {
  animate,
  cubicBezier,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ASSEMBLE_OFFSETS,
  LOGO_HEIGHT,
  LOGO_WIDTH,
  PARTS,
  partStyle,
  type Part,
} from "./logoParts";

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);
const IDLE_TAIL = 0.9;
const INK = "#121212";

type PartTiming = {
  enterStart: number;
  enterEnd: number;
  drawStart: number;
  drawEnd: number;
};

type Timeline = {
  parts: PartTiming[];
  accentStart: number;
  accentEnd: number;
  total: number;
};

export function buildPathDrawTimeline({
  count,
  duration,
  stagger,
  drawStrength,
}: {
  count: number;
  duration: number;
  stagger: number;
  drawStrength: number;
}): Timeline {
  const traceStrength = drawStrength / 100;
  const drawDuration = Math.max(0.35, duration * (1.05 + (1 - traceStrength) * 0.65));

  const parts: PartTiming[] = Array.from({ length: count }, (_, index) => {
    const drawStart = index * stagger * 0.65;
    return {
      enterStart: drawStart * 0.75,
      enterEnd: drawStart * 0.75 + duration,
      drawStart,
      drawEnd: drawStart + drawDuration,
    };
  });

  const accentStart = Math.max(0.06, stagger * 2.2);
  const accentEnd = accentStart + Math.max(0.28, duration * 0.7);
  const lastEnd = Math.max(
    accentEnd,
    ...parts.map((part) => Math.max(part.enterEnd, part.drawEnd)),
  );

  return { parts, accentStart, accentEnd, total: lastEnd + IDLE_TAIL };
}

function Letter({
  part,
  index,
  clock,
  timing,
  pixelShift,
  strokeWidth,
}: {
  part: Part;
  index: number;
  clock: MotionValue<number>;
  timing: PartTiming;
  pixelShift: number;
  strokeWidth: number;
}) {
  const offset = ASSEMBLE_OFFSETS[index];
  const fromX = offset.x * (pixelShift * 0.55);
  const fromY = offset.y * (pixelShift * 0.55);

  const x = useTransform(clock, [timing.enterStart, timing.enterEnd], [fromX, 0], {
    ease: EASE_OUT,
    clamp: true,
  });
  const y = useTransform(clock, [timing.enterStart, timing.enterEnd], [fromY, 0], {
    ease: EASE_OUT,
    clamp: true,
  });
  const opacity = useTransform(
    clock,
    [timing.enterStart, timing.enterStart + (timing.enterEnd - timing.enterStart) * 0.4],
    [0, 1],
    { ease: EASE_OUT, clamp: true },
  );

  const pathLength = useTransform(clock, [timing.drawStart, timing.drawEnd], [0, 1], {
    ease: EASE_IN_OUT,
    clamp: true,
  });
  const fillOpacity = useTransform(
    clock,
    [timing.drawStart + (timing.drawEnd - timing.drawStart) * 0.55, timing.drawEnd],
    [0, 1],
    { ease: EASE_OUT, clamp: true },
  );
  const strokeOpacity = useTransform(
    clock,
    [timing.drawStart + (timing.drawEnd - timing.drawStart) * 0.55, timing.drawEnd],
    [0.95, 0],
    { ease: EASE_OUT, clamp: true },
  );

  return (
    <motion.div className="logo-path-slot" style={{ ...partStyle(part), x, y, opacity }}>
      <svg
        viewBox={`0 0 ${part.width} ${part.height}`}
        className="logo-draw-svg"
        aria-hidden="true"
      >
        <motion.path
          d={part.path}
          fill={INK}
          stroke={INK}
          strokeWidth={strokeWidth}
          style={{ pathLength, fillOpacity, strokeOpacity }}
        />
      </svg>
    </motion.div>
  );
}

export default function PathDrawLogo({
  duration,
  stagger,
  pixelShift,
  drawStrength,
  scale,
  loop,
  replayKey,
  reduceMotion,
}: {
  duration: number;
  stagger: number;
  pixelShift: number;
  drawStrength: number;
  scale: number;
  loop: boolean;
  replayKey: number;
  reduceMotion: boolean;
}) {
  const timeline = useMemo(
    () => buildPathDrawTimeline({ count: PARTS.length, duration, stagger, drawStrength }),
    [duration, stagger, drawStrength],
  );

  const clock = useMotionValue(0);
  const strokeWidth = 0.95 + (1 - drawStrength / 100) * 0.8;

  const accentX = useTransform(
    clock,
    [timeline.accentStart, timeline.accentEnd],
    [-pixelShift, 0],
    { ease: EASE_OUT, clamp: true },
  );
  const accentY = useTransform(
    clock,
    [timeline.accentStart, timeline.accentEnd],
    [-pixelShift, 0],
    { ease: EASE_OUT, clamp: true },
  );
  const accentOpacity = useTransform(
    clock,
    [timeline.accentStart, timeline.accentStart + (timeline.accentEnd - timeline.accentStart) * 0.4],
    [0, 1],
    { ease: EASE_OUT, clamp: true },
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
      style={{ "--logo-scale": scale / 100 } as CSSProperties}
      role="img"
      aria-label="Tiugo"
    >
      <div className="logo logo-path">
        {PARTS.map((part, index) => (
          <Letter
            key={part.name}
            part={part}
            index={index}
            clock={clock}
            timing={timeline.parts[index]}
            pixelShift={pixelShift}
            strokeWidth={strokeWidth}
          />
        ))}
        <motion.div
          className="t-pixel-accent"
          style={{
            left: `${(66 / LOGO_WIDTH) * 100}%`,
            top: `${(137 / LOGO_HEIGHT) * 100}%`,
            width: `${(13 / LOGO_WIDTH) * 100}%`,
            height: `${(13 / LOGO_HEIGHT) * 100}%`,
            x: accentX,
            y: accentY,
            opacity: accentOpacity,
          }}
        />
      </div>
    </div>
  );
}
