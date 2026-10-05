import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useMotionValue, useReducedMotion } from "motion/react";
import DrawShiftLogo from "./DrawShiftLogo";
import ExportPanel, { type ExportPlayback } from "./ExportPanel";
import PathDrawLogo from "./PathDrawLogo";
import PieceLogo from "./PieceLogo";
import type { Study } from "./logoParts";
import { nextFrame } from "./export/download";

/**
 * Inputs that define the animation clock, committed as one atomic unit.
 * `drawStrength` belongs here because it stretches the per-letter draw window,
 * not just the stroke weight.
 */
type TimelineParameters = {
  duration: number;
  stagger: number;
  hold: number;
  slide: number;
  drawStrength: number;
};

const TIMELINE_DEFAULTS: TimelineParameters = {
  duration: 0.8,
  stagger: 0.08,
  hold: 0.25,
  slide: 0.65,
  drawStrength: 84,
};

const COLORS = {
  paper: "#f8f7f3",
  orange: "#ff5a00",
  ink: "#121212",
  white: "#ffffff",
} as const;

type ControlId =
  | "duration"
  | "stagger"
  | "distance"
  | "overshoot"
  | "scale"
  | "pixelShift"
  | "drawStrength"
  | "hold"
  | "slide";

const STUDIES: {
  id: Study;
  number: string;
  label: string;
  description: string;
  controls: ControlId[];
}[] = [
  {
    id: "assemble",
    number: "01",
    label: "Gather",
    description: "The pieces arrive from the logo’s natural directions and settle together.",
    controls: ["duration", "stagger", "distance", "overshoot", "scale"],
  },
  {
    id: "cascade",
    number: "02",
    label: "Soft cascade",
    description: "A compact vertical rhythm with a restrained, sequential landing.",
    controls: ["duration", "stagger", "distance", "overshoot", "scale"],
  },
  {
    id: "reveal",
    number: "03",
    label: "Sweep",
    description: "The wordmark is exposed left-to-right while each character resolves.",
    controls: ["duration", "stagger", "distance", "scale"],
  },
  {
    id: "pathdraw",
    number: "04",
    label: "Path + pixel",
    description:
      "Letters are drawn from their real vector paths while the T pixel nudges into its final offset.",
    controls: ["duration", "stagger", "pixelShift", "drawStrength", "scale"],
  },
  {
    id: "drawshift",
    number: "05",
    label: "Draw & shift",
    description:
      "The straight letterforms draw themselves, ink in, then the T, u and g squares slide right together into the final stepped mark.",
    controls: ["duration", "stagger", "hold", "slide", "overshoot", "drawStrength", "scale"],
  },
];

const COMMIT_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  // One interaction should produce one commit, so the first of
  // pointerup/keyup/blur to fire wins and the rest are ignored.
  const pending = useRef(false);

  const commit = () => {
    if (!onCommit || !pending.current) return;
    pending.current = false;
    onCommit();
  };

  return (
    <label className="range-control">
      <span className="range-label">
        <span>{label}</span>
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          pending.current = true;
          onChange(Number(event.target.value));
        }}
        onPointerUp={commit}
        onBlur={commit}
        onKeyUp={(event) => {
          if (COMMIT_KEYS.has(event.key)) commit();
        }}
      />
    </label>
  );
}

export default function App() {
  const [study, setStudy] = useState<Study>("drawshift");
  const [distance, setDistance] = useState(72);
  const [overshoot, setOvershoot] = useState(12);
  const [scale, setScale] = useState(100);
  const [pixelShift, setPixelShift] = useState(8);
  const [loop, setLoop] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState<string>(COLORS.paper);
  const [logoColor, setLogoColor] = useState<string>(COLORS.ink);

  // Timing inputs rebuild the animation clock, so a live update mid-drag would
  // snap playback back to frame zero on every pointer move. Drafts drive the
  // visible controls; playback only picks them up once an interaction ends.
  const [draftTimeline, setDraftTimeline] = useState<TimelineParameters>(TIMELINE_DEFAULTS);
  const [playbackTimeline, setPlaybackTimeline] =
    useState<TimelineParameters>(TIMELINE_DEFAULTS);

  const reduceMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // Every study plays on this one clock. Export pauses playback and steps the
  // clock to each frame's exact time, so recordings never depend on how fast
  // the browser can take a snapshot.
  const clock = useMotionValue(0);
  const [exporting, setExporting] = useState(false);

  const exportPlayback = useMemo<ExportPlayback>(
    () => ({
      begin: async () => {
        setExporting(true);
        await nextFrame();
      },
      seek: async (seconds) => {
        clock.set(seconds);
        await nextFrame();
      },
      end: () => setExporting(false),
    }),
    [clock],
  );

  const { duration, stagger, hold, slide, drawStrength } = playbackTimeline;

  const activeStudy = useMemo(
    () => STUDIES.find((item) => item.id === study) ?? STUDIES[0],
    [study],
  );

  const replay = () => setReplayKey((value) => value + 1);

  const commitTimeline = () => {
    setPlaybackTimeline(draftTimeline);
    setReplayKey((value) => value + 1);
  };

  const setDraft = (key: keyof TimelineParameters) => (value: number) =>
    setDraftTimeline((current) => ({ ...current, [key]: value }));

  const resetParameters = () => {
    setDistance(72);
    setOvershoot(12);
    setScale(100);
    setPixelShift(8);
    setBackgroundColor(COLORS.paper);
    setLogoColor(COLORS.ink);
    setDraftTimeline(TIMELINE_DEFAULTS);
    setPlaybackTimeline(TIMELINE_DEFAULTS);
    setReplayKey((value) => value + 1);
  };

  const controls: Record<ControlId, React.ReactNode> = {
    duration: <RangeControl key="duration" label="Duration" value={draftTimeline.duration} min={0.3} max={1.8} step={0.05} unit="s" onChange={setDraft("duration")} onCommit={commitTimeline} />,
    stagger: <RangeControl key="stagger" label="Stagger" value={draftTimeline.stagger} min={0} max={0.3} step={0.01} unit="s" onChange={setDraft("stagger")} onCommit={commitTimeline} />,
    distance: <RangeControl key="distance" label="Travel" value={distance} min={12} max={160} step={1} unit="px" onChange={setDistance} />,
    overshoot: <RangeControl key="overshoot" label="Overshoot" value={overshoot} min={0} max={30} step={1} unit="%" onChange={setOvershoot} />,
    scale: <RangeControl key="scale" label="Logo size" value={scale} min={65} max={120} step={1} unit="%" onChange={setScale} />,
    pixelShift: <RangeControl key="pixelShift" label="Pixel nudge" value={pixelShift} min={0} max={20} step={1} unit="px" onChange={setPixelShift} />,
    drawStrength: <RangeControl key="drawStrength" label="Path draw" value={draftTimeline.drawStrength} min={20} max={100} step={1} unit="%" onChange={setDraft("drawStrength")} onCommit={commitTimeline} />,
    hold: <RangeControl key="hold" label="Hold before shift" value={draftTimeline.hold} min={0} max={1.2} step={0.05} unit="s" onChange={setDraft("hold")} onCommit={commitTimeline} />,
    slide: <RangeControl key="slide" label="Square slide" value={draftTimeline.slide} min={0.2} max={1.6} step={0.05} unit="s" onChange={setDraft("slide")} onCommit={commitTimeline} />,
  };

  return (
    <main>
      <header className="site-header">
        <div className="brand-lockup">
          <span className="brand-mark">T</span>
          <span>Tiugo motion lab</span>
        </div>
        <span className="status">
          <i />
          Study {activeStudy.number} · Wordmark
        </span>
      </header>

      <section className="intro">
        <p className="eyebrow">Logo animation studies</p>
        <h1>Find the motion<br />inside the mark.</h1>
        <p className="lede">
          Five restrained directions for the Tiugo wordmark. Tune the character,
          then replay it until the timing feels inevitable.
        </p>
      </section>

      <section className="workbench">
        <div className="preview-column">
          <div className="preview-toolbar">
            <div>
              <span className="preview-number">{activeStudy.number}</span>
              <h2>{activeStudy.label}</h2>
            </div>
            <div className="playback">
              <label className="loop-toggle">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(event) => setLoop(event.target.checked)}
                />
                <span className="toggle-track"><span /></span>
                Loop
              </label>
              <button className="replay-button" onClick={replay}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M16 6.4A7 7 0 1 1 10 3M10 3l2.7-2M10 3l2.4 2.5" />
                </svg>
                Replay
              </button>
            </div>
          </div>

          <div
            className="stage"
            ref={stageRef}
            style={{
              backgroundColor,
              color: logoColor,
              "--stage-grid": backgroundColor === COLORS.orange
                ? "rgba(255, 255, 255, 0.14)"
                : "rgba(17, 17, 15, 0.045)",
              "--stage-guide": backgroundColor === COLORS.orange
                ? "rgba(255, 255, 255, 0.5)"
                : "rgba(255, 90, 0, 0.42)",
            } as CSSProperties}
          >
            <div className="stage-grid" />
            <div className="export-capture" ref={captureRef}>
            {study === "drawshift" ? (
              <DrawShiftLogo
                clock={clock}
                duration={duration}
                stagger={stagger}
                hold={hold}
                slide={slide}
                overshoot={overshoot}
                lineWeight={1 + (100 - drawStrength) / 25}
                scale={scale}
                logoColor={logoColor}
                loop={loop}
                replayKey={replayKey}
                reduceMotion={reduceMotion}
                paused={exporting}
              />
            ) : study === "pathdraw" ? (
              <PathDrawLogo
                clock={clock}
                duration={duration}
                stagger={stagger}
                pixelShift={pixelShift}
                drawStrength={drawStrength}
                scale={scale}
                logoColor={logoColor}
                loop={loop}
                replayKey={replayKey}
                reduceMotion={reduceMotion}
                paused={exporting}
              />
            ) : (
              <PieceLogo
                study={study}
                clock={clock}
                duration={duration}
                stagger={stagger}
                distance={distance}
                overshoot={overshoot}
                scale={scale}
                logoColor={logoColor}
                replayKey={replayKey}
                loop={loop}
                reduceMotion={reduceMotion}
                paused={exporting}
              />
            )}
            </div>
            <span className="stage-note" style={{ color: logoColor }}>
              Exact vector geometry · Figma source
            </span>
          </div>

          <p className="study-description">{activeStudy.description}</p>
        </div>

        <aside className="controls">
          <div className="controls-heading">
            <p className="eyebrow">Parameters</p>
            <button onClick={resetParameters}>Reset</button>
          </div>
          <div className="range-list">
            {activeStudy.controls.map((id) => controls[id])}
          </div>
          <div className="appearance-controls">
            <p className="eyebrow">Appearance</p>
            <div className="color-option">
              <span>Background</span>
              <div className="color-swatches" role="group" aria-label="Background color">
                <button
                  type="button"
                  className={backgroundColor === COLORS.paper ? "active" : ""}
                  aria-label="Paper background"
                  aria-pressed={backgroundColor === COLORS.paper}
                  onClick={() => setBackgroundColor(COLORS.paper)}
                >
                  <i style={{ background: COLORS.paper }} />
                  Paper
                </button>
                <button
                  type="button"
                  className={backgroundColor === COLORS.orange ? "active" : ""}
                  aria-label="Orange background, hex FF5A00"
                  aria-pressed={backgroundColor === COLORS.orange}
                  onClick={() => setBackgroundColor(COLORS.orange)}
                >
                  <i style={{ background: COLORS.orange }} />
                  Orange
                </button>
              </div>
            </div>
            <div className="color-option">
              <span>Logo</span>
              <div className="color-swatches" role="group" aria-label="Logo color">
                <button
                  type="button"
                  className={logoColor === COLORS.ink ? "active" : ""}
                  aria-pressed={logoColor === COLORS.ink}
                  onClick={() => setLogoColor(COLORS.ink)}
                >
                  <i style={{ background: COLORS.ink }} />
                  Ink
                </button>
                <button
                  type="button"
                  className={logoColor === COLORS.white ? "active" : ""}
                  aria-pressed={logoColor === COLORS.white}
                  onClick={() => setLogoColor(COLORS.white)}
                >
                  <i className="light" style={{ background: COLORS.white }} />
                  White
                </button>
              </div>
            </div>
          </div>
          <p className="controls-note">
            Motion automatically resolves to the resting logo. Reduced-motion
            preferences are respected.
          </p>
          <ExportPanel
            stageRef={stageRef}
            captureRef={captureRef}
            study={study}
            studyLabel={activeStudy.label}
            timings={{ duration, stagger, hold, slide, drawStrength, distance, overshoot, pixelShift }}
            backgroundColor={backgroundColor}
            logoColor={logoColor}
            playback={exportPlayback}
          />
        </aside>
      </section>

      <nav className="study-picker" aria-label="Animation studies">
        {STUDIES.map((item) => (
          <button
            key={item.id}
            className={study === item.id ? "active" : ""}
            onClick={() => {
              setStudy(item.id);
              setReplayKey((value) => value + 1);
            }}
          >
            <span>{item.number}</span>
            <strong>{item.label}</strong>
            <i aria-hidden="true">↗</i>
          </button>
        ))}
      </nav>
    </main>
  );
}
