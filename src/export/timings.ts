import { buildTimeline } from "../DrawShiftLogo";
import { buildPathDrawTimeline } from "../PathDrawLogo";
import { PARTS, type Study } from "../logoParts";

export type TimingParams = {
  duration: number;
  stagger: number;
  hold: number;
  slide: number;
  drawStrength: number;
  distance: number;
  overshoot: number;
  pixelShift: number;
};

/** Length of one playback plus a short hold on the final pose. */
export function getStudyDurationSeconds(study: Study, params: TimingParams): number {
  const holdEnd = 0.55;

  if (study === "drawshift") {
    return buildTimeline({
      count: 6,
      duration: params.duration,
      stagger: params.stagger,
      hold: params.hold,
      slide: params.slide,
    }).total + holdEnd;
  }

  if (study === "pathdraw") {
    // The study plays on one shared clock, so its own timeline is the source of
    // truth for how long a full pass takes.
    return buildPathDrawTimeline({
      count: PARTS.length,
      duration: params.duration,
      stagger: params.stagger,
      drawStrength: params.drawStrength,
    }).total;
  }

  if (study === "reveal") {
    return Math.max(params.duration * 0.9, params.duration + params.stagger * 5) + holdEnd;
  }

  return params.duration + params.stagger * 5 + holdEnd;
}

export function slugForStudy(study: Study): string {
  return `tiugo-${study}`;
}
