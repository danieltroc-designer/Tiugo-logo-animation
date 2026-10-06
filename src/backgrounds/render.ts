import { TIUGO_PATHS, TIUGO_VIEWBOX } from "../tiugoPaths";
import type { BackgroundId, BackgroundParams } from "./designs";

/**
 * All three Figma frames are 3840 × 2160, and designs are placed in that
 * space. Other shapes keep the width and change the height.
 */
export const FRAME = { width: 3840, height: 2160 } as const;

const asset = (file: string) => `${import.meta.env.BASE_URL}assets/backgrounds/${file}`;

// Blurred shapes are rasterised once at this fraction of their design size.
// They are so soft that scaling them back up loses no visible detail, and it
// keeps a frame cheap enough to redraw at 60fps.
const SPRITE_SCALE = 1 / 8;

// Glow and Mesh are nothing but blurs hundreds of pixels wide, so they are
// composed at a quarter of the output resolution and scaled up in one draw.
// Only the grain and the logo need full resolution.
const SOFT_SCALE = 1 / 4;

// The blurred layers exported from Figma, at their exported sizes. Each SVG is
// centred on its shape, so a sprite is placed by its centre.
const SPRITES = {
  stepsGlow: { file: "steps-glow.svg", width: 7036.68, height: 7132.5 },
  glowOrb: { file: "glow-orb.svg", width: 3503.84, height: 3503.84 },
  meshBlob04: { file: "mesh-blob-04.svg", width: 5461.76, height: 3349.61 },
  meshBlob05: { file: "mesh-blob-05.svg", width: 5049.58, height: 3833.04 },
  meshBlob06: { file: "mesh-blob-06.svg", width: 6953.28, height: 5119.56 },
} as const;

type SpriteId = keyof typeof SPRITES;

type Sprite = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export type BackgroundAssets = {
  noise: HTMLImageElement;
  sprites: Record<SpriteId, Sprite>;
};

// Waits for the load event rather than decode(): Chrome holds decode() back
// for raster images while the tab is hidden, which would leave the stage blank.
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}.`));
    image.src = src;
  });
}

async function rasterise(id: SpriteId): Promise<Sprite> {
  const { file, width, height } = SPRITES[id];
  const image = await loadImage(asset(file));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * SPRITE_SCALE);
  canvas.height = Math.ceil(height * SPRITE_SCALE);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, width, height };
}

let assetsPromise: Promise<BackgroundAssets> | null = null;

export function loadBackgroundAssets(): Promise<BackgroundAssets> {
  assetsPromise ??= (async () => {
    const ids = Object.keys(SPRITES) as SpriteId[];
    const [noise, ...sprites] = await Promise.all([
      loadImage(asset("noise.png")),
      ...ids.map(rasterise),
    ]);
    return {
      noise,
      sprites: Object.fromEntries(ids.map((id, index) => [id, sprites[index]])) as Record<
        SpriteId,
        Sprite
      >,
    };
  })();
  return assetsPromise;
}

export type BackgroundScene = {
  background: BackgroundId;
  params: BackgroundParams;
  /** Seconds into the loop. */
  time: number;
  loopSeconds: number;
  showLogo: boolean;
  /** The wordmark's size as a share of its size in the Figma frames. */
  logoScale: number;
  grainMotion: boolean;
};

/**
 * The frame being drawn, in design units. It is always 3840 wide; its height
 * follows the output's shape, so 16:9 is the Figma frame and square is 3840
 * tall. Each design lays itself out for that height rather than stretching.
 */
type Frame = { width: number; height: number };

type Draw = (
  ctx: CanvasRenderingContext2D,
  scene: BackgroundScene,
  phase: number,
  frame: Frame,
  assets: BackgroundAssets,
) => void;

/** Buffers kept per output canvas, rebuilt when its size changes. */
type RenderCache = {
  width: number;
  height: number;
  soft: HTMLCanvasElement;
  /** The noise tile pre-scaled to output pixels, so grain is drawn 1:1. */
  grain: HTMLCanvasElement;
};

const caches = new WeakMap<CanvasRenderingContext2D, RenderCache>();

function cacheFor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  assets: BackgroundAssets,
): RenderCache {
  const cached = caches.get(ctx);
  if (cached && cached.width === width && cached.height === height) return cached;

  const soft = document.createElement("canvas");
  soft.width = Math.max(1, Math.round(width * SOFT_SCALE));
  soft.height = Math.max(1, Math.round(height * SOFT_SCALE));

  // Resampling the noise image every frame is the single most expensive thing
  // a frame could do, so it is scaled once here instead.
  const scale = width / FRAME.width;
  const grain = document.createElement("canvas");
  grain.width = Math.max(1, Math.round(GRAIN_TILE.width * scale));
  grain.height = Math.max(1, Math.round(GRAIN_TILE.height * scale));
  grain.getContext("2d")?.drawImage(assets.noise, 0, 0, grain.width, grain.height);

  const cache = { width, height, soft, grain };
  caches.set(ctx, cache);
  return cache;
}

const DEG = Math.PI / 180;

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  { rotate = 0, skewX = 0, scale = 1 }: { rotate?: number; skewX?: number; scale?: number } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.transform(1, 0, Math.tan(skewX), 1, 0, 0);
  ctx.scale(scale, scale);
  ctx.drawImage(sprite.canvas, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
  ctx.restore();
}

/** A repeatable 0–1 value per grain frame, so exports re-render identically. */
function hash(n: number) {
  const value = Math.sin(n * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const GRAIN_FPS = 24;

/** The design tiles the 1440 × 900 noise texture at 2880 × 1800 units. */
const GRAIN_TILE = { width: 2880, height: 1800 };

// Overlay-blends the noise across the whole output, in output pixels. The
// design anchors the tiles one unit above the frame; moving grain jumps the
// tiles to a new offset 24 times a second, like film grain.
function drawGrain(
  ctx: CanvasRenderingContext2D,
  scene: BackgroundScene,
  cache: RenderCache,
) {
  const amount = (scene.params.grain ?? 0) / 100;
  if (amount <= 0) return;

  const { grain, width, height } = cache;
  // The one-unit lift lands between output pixels at most sizes, which
  // softens the grain exactly as Figma's own render does. Moving grain jumps
  // by whole pixels on top of it, so its softness never flickers.
  const lift = width / FRAME.width;
  let x = 0;
  let y = -lift;
  if (scene.grainMotion) {
    const grainFrame = Math.floor(scene.time * GRAIN_FPS);
    x = -Math.round(hash(grainFrame) * grain.width);
    y = -Math.round(hash(grainFrame + 7919) * grain.height) - lift;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = amount;
  for (let top = y; top < height; top += grain.height) {
    for (let left = x; left < width; left += grain.width) {
      ctx.drawImage(grain, left, top);
    }
  }
  ctx.restore();
}

// 01 Steps — Figma frame W1 (92:7737).
const STEPS = {
  background: "#1a1a1a",
  stairs: "#d890f4",
  /** Top edge of the pattern within the frame. */
  top: -1180,
  /** Vertical pitch of one row of stepped blocks. */
  band: 460.4286,
  /** Each block is two offset rectangles; the lower one sits this far down. */
  stepDrop: 165.9,
  rowHeight: 294.542,
  // Rows alternate between two templates, measured from the exported vector
  // (92:7739). Columns narrow by 1/12 each; `shift` is how far the lower
  // rectangle of each block steps sideways.
  templates: [
    {
      x: [0, 589.084, 1129.07, 1619.98, 2061.8, 2454.51, 2814.51, 3125.4, 3408.18, 3641.35],
      width: [294.542, 270.009, 245.44, 220.91, 196.37, 171.8, 147.27, 122.74, 98.17, 73.64],
      shift: [125.013, 116.836, 108.65, 100.48, 92.3, 84.12, 75.94, 67.77, 59.55, 51.38],
    },
    {
      x: [294.542, 859.093, 1374.54, 1840.89, 2258.17, 2626.35, 2964.09, 3254.51, 3506.35, 3714.99],
      width: [294.542, 270.007, 245.44, 220.91, 196.37, 171.8, 147.27, 122.73, 98.16, 73.63],
      shift: [125.013, 116.836, 108.62, 100.48, 92.26, 84.08, 75.91, 67.76, 59.55, 51.37],
    },
  ],
  /** Centre of the orange glow that is masked into the stairs (92:7743). */
  glow: { x: 4193.12, y: 1794.05 },
  /** How far the glow travels left at 100% sweep. */
  sweepReach: 2600,
};

const drawSteps: Draw = (ctx, scene, phase, frame, assets) => {
  const { params } = scene;
  ctx.fillStyle = STEPS.background;
  ctx.fillRect(0, 0, frame.width, frame.height);

  // Two bands make one full cycle of the checkerboard. Drift moves a whole
  // number of cycles per loop, so the last frame lines up with the first.
  const cycle = STEPS.band * 2;
  const travel = -params.drift * cycle * (scene.time / scene.loopSeconds);
  const offset = ((travel % cycle) + cycle) % cycle;
  // Step morph eases each block from stepped to straight and back, the same
  // move the logo's squares make in Draw & shift.
  const step = 1 - (params.morph / 100) * ((1 - Math.cos(phase)) / 2);

  // A taller frame simply gets more rows of the same pattern.
  const stairs = new Path2D();
  for (
    let band = 0, y = STEPS.top + offset - cycle;
    y < frame.height;
    band += 1, y += STEPS.band
  ) {
    const template = STEPS.templates[band % 2];
    for (let column = 0; column < template.x.length; column += 1) {
      const width = template.width[column];
      // The design mirrors the vector horizontally, so columns widen to the right.
      const x = FRAME.width - template.x[column] - width;
      stairs.rect(x, y, width, STEPS.rowHeight);
      stairs.rect(x - template.shift[column] * step, y + STEPS.stepDrop, width, STEPS.rowHeight);
    }
  }

  ctx.fillStyle = STEPS.stairs;
  ctx.fill(stairs);

  // The glow keeps its place relative to the frame's height.
  const glowY = STEPS.glow.y * (frame.height / FRAME.height);
  const sweep = params.sweep / 100;
  ctx.save();
  ctx.clip(stairs);
  drawSprite(
    ctx,
    assets.sprites.stepsGlow,
    STEPS.glow.x - sweep * STEPS.sweepReach * ((1 - Math.cos(phase)) / 2),
    glowY + sweep * 260 * Math.sin(phase),
    { rotate: 90 * DEG, scale: params.glowSize / 100 },
  );
  ctx.restore();
};

// 02 Glow — Figma frame W2 (92:7753).
const GLOW = {
  background: "#ff5a00",
  // Ellipse 9 and Ellipse 10, each held at its distance from its own corner
  // (`corner` 0 is top-left, 1 is bottom-right), so a square frame keeps the
  // composition. `phase` places each orbit's centre diagonally inward from
  // its corner, so the glow sweeps in towards the logo and back out again
  // without leaving the frame.
  orbs: [
    { x: 301.378, y: 301.911, corner: 0, phase: -135 * DEG },
    { x: 3257.378, y: 1720.622, corner: 1, phase: 45 * DEG },
  ],
  /** Orbit radius at 100%. */
  orbitReach: 900,
};

const drawGlow: Draw = (ctx, scene, phase, frame, assets) => {
  const { params } = scene;
  ctx.fillStyle = GLOW.background;
  ctx.fillRect(0, 0, frame.width, frame.height);

  // A taller frame has more area to light, so the glows and their orbits grow
  // with the square root of the frame's area. That keeps the same share of the
  // frame lit: a square frame gets glows about 1.33× the 16:9 size.
  const fit = Math.sqrt(frame.height / FRAME.height);
  const radius = (params.orbit / 100) * GLOW.orbitReach * fit;
  GLOW.orbs.forEach((orb, index) => {
    const angle = phase + orb.phase;
    const breathe = 1 + (params.breathe / 100) * Math.sin(phase + index * Math.PI);
    const x = orb.x + orb.corner * (frame.width - FRAME.width);
    const y = orb.y + orb.corner * (frame.height - FRAME.height);
    drawSprite(
      ctx,
      assets.sprites.glowOrb,
      x + radius * (Math.cos(angle) - Math.cos(orb.phase)),
      y + radius * (Math.sin(angle) - Math.sin(orb.phase)),
      { scale: (params.glowSize / 100) * breathe * fit },
    );
  });
};

// 03 Mesh — Figma frame w3 (92:7766).
const MESH = {
  // "Gradient 18" overhangs the 3840 × 2160 artboard.
  width: 4261.4,
  height: 2663.375,
  top: "#bbb3ff",
  bottom: "#2439c6",
  // Back to front, as layered in Figma. Centres come from each blob's
  // bounding box; `cycles` are whole loops per pass, which keeps it seamless.
  blobs: [
    { sprite: "meshBlob06", x: 564.84, y: 2433.53, rotate: 39.9, skewX: 23.61, cycles: [1, 1], phase: 0.6 },
    { sprite: "meshBlob05", x: 4460.2, y: 1572.99, rotate: -168.26, skewX: 0, cycles: [1, 2], phase: 2.4 },
    { sprite: "meshBlob04", x: 2038.87, y: 90.55, rotate: 149.4, skewX: 6.53, cycles: [2, 1], phase: 4.1 },
  ] as const,
  // Rectangle 63: a black overlay layer. Figma's export lists it at 20%, but
  // Figma's own render, which also applies a noise effect the export leaves
  // out, matches 10% (with the grain at 22%) to within ~3 levels per channel.
  shade: { width: 3837.8, height: 2157, opacity: 0.1 },
  /** Drift radius at 100% flow. */
  flowReach: 900,
};

const drawMesh: Draw = (ctx, scene, phase, frame, assets) => {
  const { params } = scene;
  // Nothing in the mesh has an edge, so a taller frame stretches it vertically
  // rather than revealing where its light fields end.
  ctx.save();
  ctx.scale(1, frame.height / FRAME.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, MESH.height);
  gradient.addColorStop(0, MESH.top);
  gradient.addColorStop(1, MESH.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, MESH.width, MESH.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, MESH.width, MESH.height);

  const reach = (params.flow / 100) * MESH.flowReach;
  const swirl = params.swirl * DEG;
  for (const blob of MESH.blobs) {
    const [cyclesX, cyclesY] = blob.cycles;
    // Each offset is measured from its value at t = 0, so the first frame is
    // the exact Figma composition.
    const dx = reach * (Math.sin(cyclesX * phase + blob.phase) - Math.sin(blob.phase));
    const dy = reach * 0.7 * (Math.cos(cyclesY * phase + blob.phase) - Math.cos(blob.phase));
    const turn = swirl * (Math.sin(phase + blob.phase) - Math.sin(blob.phase));
    drawSprite(ctx, assets.sprites[blob.sprite], blob.x + dx, blob.y + dy, {
      rotate: blob.rotate * DEG + turn,
      skewX: blob.skewX * DEG,
    });
  }

  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = MESH.shade.opacity;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MESH.shade.width, MESH.shade.height);
  ctx.restore();
};

// `soft` designs are drawn into the quarter-resolution buffer. Steps has hard
// pixel edges, so it is drawn at full resolution, and it is cheap anyway.
const DESIGNS: Record<BackgroundId, { draw: Draw; soft: boolean }> = {
  steps: { draw: drawSteps, soft: false },
  glow: { draw: drawGlow, soft: true },
  mesh: { draw: drawMesh, soft: true },
};

// The white wordmark sits at the same place in all three frames, 1940.957
// units wide and centred (to within half a unit) on the frame.
const LOGO = {
  x: 949.043 + 1940.957 / 2,
  y: 718.4915 + 722.832 / 2,
  scale: 1940.957 / TIUGO_VIEWBOX.width,
};
let logoPaths: Path2D[] | null = null;

function drawLogo(ctx: CanvasRenderingContext2D, frame: Frame, size: number) {
  logoPaths ??= TIUGO_PATHS.map((part) => new Path2D(part.final));
  const scale = LOGO.scale * size;
  ctx.save();
  // Kept centred in any frame shape, and scaled about its own centre.
  ctx.translate(
    LOGO.x + (frame.width - FRAME.width) / 2,
    LOGO.y + (frame.height - FRAME.height) / 2,
  );
  ctx.scale(scale, scale);
  ctx.translate(-TIUGO_VIEWBOX.width / 2, -TIUGO_VIEWBOX.height / 2);
  ctx.fillStyle = "#fff";
  for (const path of logoPaths) ctx.fill(path);
  ctx.restore();
}

/** Draws one frame of a background, laid out for the canvas's shape and size. */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: BackgroundScene,
  assets: BackgroundAssets,
) {
  const cache = cacheFor(ctx, width, height, assets);
  const { draw, soft } = DESIGNS[scene.background];
  const phase = (2 * Math.PI * scene.time) / scene.loopSeconds;
  const frame = { width: FRAME.width, height: FRAME.width * (height / width) };
  const scale = width / frame.width;
  const buffer = soft ? cache.soft.getContext("2d") : null;

  ctx.save();
  if (buffer) {
    buffer.setTransform(cache.soft.width / frame.width, 0, 0, cache.soft.height / frame.height, 0, 0);
    draw(buffer, scene, phase, frame, assets);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cache.soft, 0, 0, width, height);
  } else {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx, scene, phase, frame, assets);
  }

  drawGrain(ctx, scene, cache);

  if (scene.showLogo) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawLogo(ctx, frame, scene.logoScale);
  }
  ctx.restore();
}
