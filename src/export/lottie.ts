import { buildTimeline } from "../DrawShiftLogo";
import { ASSEMBLE_OFFSETS, PARTS, type Study } from "../logoParts";
import { TIUGO_PATHS, TIUGO_VIEWBOX } from "../tiugoPaths";
import { getStudyDurationSeconds, type TimingParams } from "./timings";

const FPS = 30;
const COMP_W = 1920;
const COMP_H = 1080;
const INK: [number, number, number, number] = [18 / 255, 18 / 255, 18 / 255, 1];

type LottieShape = {
  i: number[][];
  o: number[][];
  v: number[][];
  c: boolean;
};

function svgSubpathsToShapes(d: string): LottieShape[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const shapes: LottieShape[] = [];
  let i = 0;
  let command = "";
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let vertices: number[][] = [];
  let ins: number[][] = [];
  let outs: number[][] = [];

  const pushPoint = (x: number, y: number, incoming: number[] = [0, 0], outgoing: number[] = [0, 0]) => {
    vertices.push([x, y]);
    ins.push(incoming);
    outs.push(outgoing);
  };

  const closeShape = () => {
    if (vertices.length >= 2) {
      shapes.push({ i: ins, o: outs, v: vertices, c: true });
    }
    vertices = [];
    ins = [];
    outs = [];
  };

  const take = (count: number) => {
    const values = tokens.slice(i, i + count).map(Number);
    i += count;
    return values;
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[A-Za-z]$/.test(token)) {
      command = token;
      i += 1;
      if (command === "Z" || command === "z") {
        cx = startX;
        cy = startY;
        closeShape();
      }
      continue;
    }

    if (command === "M") {
      const [x, y] = take(2);
      closeShape();
      cx = x;
      cy = y;
      startX = x;
      startY = y;
      pushPoint(x, y);
      command = "L";
    } else if (command === "L") {
      const [x, y] = take(2);
      pushPoint(x, y);
      cx = x;
      cy = y;
    } else if (command === "H") {
      const [x] = take(1);
      pushPoint(x, cy);
      cx = x;
    } else if (command === "V") {
      const [y] = take(1);
      pushPoint(cx, y);
      cy = y;
    } else if (command === "C") {
      const [x1, y1, x2, y2, x, y] = take(6);
      if (outs.length) outs[outs.length - 1] = [x1 - cx, y1 - cy];
      pushPoint(x, y, [x2 - x, y2 - y], [0, 0]);
      cx = x;
      cy = y;
    } else {
      i += 1;
    }
  }

  closeShape();
  return shapes;
}

function keyframe(time: number, value: unknown) {
  return {
    t: Math.max(0, Math.round(time * FPS)),
    s: Array.isArray(value) ? value : [value],
    i: { x: [0.23], y: [1] },
    o: { x: [0.32], y: [0] },
  };
}

function compositionLayout() {
  const scale = Math.min((COMP_W * 0.72) / TIUGO_VIEWBOX.width, (COMP_H * 0.52) / TIUGO_VIEWBOX.height);
  const x = (COMP_W - TIUGO_VIEWBOX.width * scale) / 2;
  const y = (COMP_H - TIUGO_VIEWBOX.height * scale) / 2;
  return { scale, x, y };
}

function wrap(layers: unknown[], duration: number, name: string) {
  return {
    v: "5.9.0",
    fr: FPS,
    ip: 0,
    op: Math.round(duration * FPS),
    w: COMP_W,
    h: COMP_H,
    nm: name,
    ddd: 0,
    assets: [],
    layers,
  };
}

function identityTransform(x: number, y: number, scalePercent: number) {
  return {
    a: { a: 0, k: [0, 0] },
    p: { a: 0, k: [x, y] },
    s: { a: 0, k: [scalePercent, scalePercent] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
  };
}

function drawShiftLottie(params: TimingParams) {
  const timeline = buildTimeline({
    count: 6,
    duration: params.duration,
    stagger: params.stagger,
    hold: params.hold,
    slide: params.slide,
  });
  const duration = timeline.total + 0.55;
  const { scale, x, y } = compositionLayout();
  const order = ["T", "iDot", "iStem", "u", "g", "o"];
  const parts = order
    .map((id) => TIUGO_PATHS.find((part) => part.id === id))
    .filter((part): part is (typeof TIUGO_PATHS)[number] => Boolean(part));

  const layers = parts.map((part, index) => {
    const timing = timeline.letters[index];
    const startShapes = svgSubpathsToShapes(part.straight);
    const endShapes = svgSubpathsToShapes(part.final);
    const morphing = part.straight !== part.final;

    const groups = startShapes.map((start, shapeIndex) => {
      const end = endShapes[shapeIndex] ?? start;
      const path = morphing
        ? {
            ty: "sh",
            nm: part.label,
            ks: {
              a: 1,
              k: [
                keyframe(timeline.shiftStart, [start]),
                keyframe(timeline.shiftEnd, [end]),
              ],
            },
          }
        : { ty: "sh", nm: part.label, ks: { a: 0, k: start } };

      return {
        ty: "gr",
        nm: part.label,
        it: [
          path,
          {
            ty: "st",
            nm: "Stroke",
            c: { a: 0, k: INK },
            o: { a: 1, k: [keyframe(timing.fillStart, 100), keyframe(timing.fillEnd, 0)] },
            w: { a: 0, k: 1.4 },
            lc: 2,
            lj: 2,
          },
          {
            ty: "fl",
            nm: "Fill",
            c: { a: 0, k: INK },
            o: { a: 1, k: [keyframe(timing.fillStart, 0), keyframe(timing.fillEnd, 100)] },
            r: 1,
          },
          {
            ty: "tm",
            nm: "Trim",
            s: { a: 0, k: 0 },
            e: { a: 1, k: [keyframe(timing.drawStart, 0), keyframe(timing.drawEnd, 100)] },
            o: { a: 0, k: 0 },
            m: 1,
          },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
            sk: { a: 0, k: 0 },
            sa: { a: 0, k: 0 },
          },
        ],
      };
    });

    return {
      ddd: 0,
      ind: index + 1,
      ty: 4,
      nm: part.label,
      sr: 1,
      ks: identityTransform(x, y, scale * 100),
      ao: 0,
      shapes: groups,
      ip: 0,
      op: Math.round(duration * FPS),
      st: 0,
      bm: 0,
    };
  });

  return wrap(layers, duration, "Tiugo draw and shift");
}

function pieceLottie(study: Study, params: TimingParams) {
  const duration = getStudyDurationSeconds(study, params);
  const { scale, x, y } = compositionLayout();

  const layers = PARTS.map((part, index) => {
    const offset = ASSEMBLE_OFFSETS[index];
    const delay = study === "pathdraw" ? index * params.stagger * 0.65 : index * params.stagger;
    const restX = x + part.left * scale;
    const restY = y + part.top * scale;
    let fromX = restX;
    let fromY = restY;
    let fromRotate = 0;
    let fromScale = 100;

    if (study === "assemble") {
      fromX += offset.x * params.distance;
      fromY += offset.y * params.distance;
      fromRotate = offset.rotate * (0.4 + params.overshoot / 30);
      fromScale = 94;
    } else if (study === "cascade") {
      fromY -= params.distance;
      fromScale = 96;
    } else if (study === "reveal") {
      fromX -= Math.min(params.distance * 0.22, 18);
    } else if (study === "pathdraw") {
      fromX += offset.x * (params.pixelShift * 0.55);
      fromY += offset.y * (params.pixelShift * 0.55);
    }

    const shapes = svgSubpathsToShapes(part.path);
    const extras =
      study === "pathdraw"
        ? [
            {
              ty: "st",
              c: { a: 0, k: INK },
              o: { a: 1, k: [keyframe(delay, 95), keyframe(delay + params.duration, 0)] },
              w: { a: 0, k: 1.2 },
              lc: 2,
              lj: 2,
            },
            {
              ty: "tm",
              s: { a: 0, k: 0 },
              e: { a: 1, k: [keyframe(delay, 0), keyframe(delay + params.duration, 100)] },
              o: { a: 0, k: 0 },
              m: 1,
            },
          ]
        : [];

    return {
      ddd: 0,
      ind: index + 1,
      ty: 4,
      nm: part.name,
      sr: 1,
      ks: {
        a: { a: 0, k: [0, 0] },
        p: {
          a: 1,
          k: [keyframe(delay, [fromX, fromY]), keyframe(delay + params.duration, [restX, restY])],
        },
        s: {
          a: 1,
          k: [keyframe(delay, [fromScale, fromScale]), keyframe(delay + params.duration, [100, 100])],
        },
        r: {
          a: 1,
          k: [keyframe(delay, fromRotate), keyframe(delay + params.duration, 0)],
        },
        o: {
          a: 1,
          k: [keyframe(delay, 0), keyframe(delay + Math.min(0.2, params.duration * 0.35), 100)],
        },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: part.name,
          it: [
            ...shapes.map((shape, shapeIndex) => ({
              ty: "sh",
              nm: `${part.name} ${shapeIndex + 1}`,
              ks: { a: 0, k: shape },
            })),
            { ty: "fl", c: { a: 0, k: INK }, o: { a: 0, k: 100 }, r: 1 },
            ...extras,
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100 * scale, 100 * scale] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
            },
          ],
        },
      ],
      ip: 0,
      op: Math.round(duration * FPS),
      st: 0,
      bm: 0,
    };
  });

  return wrap(layers, duration, `Tiugo ${study}`);
}

export function buildLottie(study: Study, params: TimingParams) {
  if (study === "drawshift") return drawShiftLottie(params);
  return pieceLottie(study, params);
}
