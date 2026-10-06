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

/** The wordmark on a background, as a share of its size in the Figma frames. */
export const LOGO_SIZE_DEFAULT = 50;

export type BackgroundFormat = "wide" | "square";

/** Width over height. The Figma frames are 16:9; square is laid out from them. */
export const FORMAT_ASPECT: Record<BackgroundFormat, number> = {
  wide: 16 / 9,
  square: 1,
};

// The three frames of the Figma "Social Media" file, section 92:7808. In 16:9,
// with the logo at full size and each Glow size at 100%, the first frame
// renders exactly as designed.
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
      { key: "orbit", label: "Orbit", min: 0, max: 150, step: 1, unit: "%" },
      { key: "breathe", label: "Breathe", min: 0, max: 50, step: 1, unit: "%" },
      { key: "glowSize", label: "Glow size", min: 60, max: 220, step: 1, unit: "%" },
      { key: "grain", label: "Grain", min: 0, max: 60, step: 1, unit: "%" },
    ],
    // Larger and livelier than the static frame. Above ~130% the glows start
    // to wash out the orange; 100% reproduces the Figma composition.
    defaults: { orbit: 80, breathe: 20, glowSize: 120, grain: 30 },
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
