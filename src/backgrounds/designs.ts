export type BackgroundId = "steps" | "glow" | "mesh";

/** Slider values for one background, keyed by control. */
export type BackgroundParams = Record<string, number>;

export type BackgroundControl = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
};

export type BackgroundDesign = {
  id: BackgroundId;
  number: string;
  label: string;
  description: string;
  /** Whether the design carries film grain, which makes the grain options apply. */
  grain: boolean;
  controls: BackgroundControl[];
  defaults: BackgroundParams;
};

/** Seconds for one seamless pass. Every movement completes whole cycles in it. */
export const LOOP_DEFAULT = 8;

// The three frames of the Figma "Social Media" file, section 92:7808. At t = 0
// each background renders exactly as designed; the controls only add motion.
export const BACKGROUNDS: BackgroundDesign[] = [
  {
    id: "steps",
    number: "01",
    label: "Steps",
    description:
      "The stepped pixel pattern climbs while the orange glow sweeps across it, sliding the lilac-to-orange gradient through the stairs.",
    grain: false,
    controls: [
      { key: "drift", label: "Stair drift", min: -3, max: 3, step: 1, unit: " / loop" },
      { key: "sweep", label: "Glow sweep", min: 0, max: 100, step: 1, unit: "%" },
      { key: "morph", label: "Step morph", min: 0, max: 100, step: 1, unit: "%" },
      { key: "glowSize", label: "Glow size", min: 60, max: 140, step: 1, unit: "%" },
    ],
    defaults: { drift: 1, sweep: 35, morph: 0, glowSize: 100 },
  },
  {
    id: "glow",
    number: "02",
    label: "Glow",
    description:
      "Two soft highlights orbit opposite corners of the brand orange and breathe in and out beneath the grain.",
    grain: true,
    controls: [
      { key: "orbit", label: "Orbit", min: 0, max: 100, step: 1, unit: "%" },
      { key: "breathe", label: "Breathe", min: 0, max: 40, step: 1, unit: "%" },
      { key: "glowSize", label: "Glow size", min: 60, max: 160, step: 1, unit: "%" },
      { key: "grain", label: "Grain", min: 0, max: 60, step: 1, unit: "%" },
    ],
    defaults: { orbit: 40, breathe: 12, glowSize: 100, grain: 30 },
  },
  {
    id: "mesh",
    number: "03",
    label: "Mesh",
    description:
      "Blue, violet and orange light fields drift and turn through each other like a slow mesh gradient.",
    grain: true,
    controls: [
      { key: "flow", label: "Flow", min: 0, max: 100, step: 1, unit: "%" },
      { key: "swirl", label: "Swirl", min: 0, max: 45, step: 1, unit: "°" },
      { key: "grain", label: "Grain", min: 0, max: 60, step: 1, unit: "%" },
    ],
    defaults: { flow: 45, swirl: 12, grain: 22 },
  },
];

export const BACKGROUND_DEFAULTS = Object.fromEntries(
  BACKGROUNDS.map((design) => [design.id, design.defaults]),
) as Record<BackgroundId, BackgroundParams>;
