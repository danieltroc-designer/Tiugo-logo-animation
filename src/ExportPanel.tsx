import { useState, type RefObject } from "react";
import type { BackgroundFormat } from "./backgrounds/designs";
import type { Study } from "./logoParts";
import { captureFrames } from "./export/capture";
import { downloadBlob, nextFrame } from "./export/download";
import { encodeGif, encodeMp4, encodeWebm, frameList, type FrameSource } from "./export/encode";
import { buildLottie } from "./export/lottie";
import { getStudyDurationSeconds, slugForStudy, type TimingParams } from "./export/timings";

export type ExportFormat = "mp4" | "gif" | "webm" | "lottie";

const FORMATS = [
  ["mp4", "MP4", "Keynote / PowerPoint"],
  ["gif", "GIF", "Slides / Slack"],
  ["webm", "WebM", "Web / Figma"],
  ["lottie", "Lottie", "After Effects / web"],
] as const;

type ExportSize = { id: string; label: string; width: number; height: number };

const LOGO_SIZES: ExportSize[] = [
  { id: "1080", label: "1920 × 1080", width: 1920, height: 1080 },
  { id: "720", label: "1280 × 720", width: 1280, height: 720 },
  { id: "square", label: "1080 × 1080", width: 1080, height: 1080 },
];

// Backgrounds are laid out for their format rather than fitted into a frame,
// so each format offers its own sizes.
const BACKGROUND_SIZES: Record<BackgroundFormat, ExportSize[]> = {
  wide: [
    { id: "1080", label: "1920 × 1080", width: 1920, height: 1080 },
    { id: "720", label: "1280 × 720", width: 1280, height: 720 },
    { id: "2160", label: "3840 × 2160 · 4K", width: 3840, height: 2160 },
  ],
  square: [
    { id: "square", label: "1080 × 1080", width: 1080, height: 1080 },
    { id: "square-2160", label: "2160 × 2160 · 4K", width: 2160, height: 2160 },
  ],
};

const GIF_MAX_WIDTH = 1280;

/** GIFs stay at or under 1280 wide, at the largest size of the same shape. */
function gifSize(sizes: ExportSize[], size: ExportSize): ExportSize {
  if (size.width <= GIF_MAX_WIDTH) return size;
  const sameShape = sizes.filter(
    (item) => item.width <= GIF_MAX_WIDTH && item.width * size.height === item.height * size.width,
  );
  return sameShape.sort((a, b) => b.width - a.width)[0] ?? size;
}

/** Takes over the preview's clock so each frame can be rendered at an exact time. */
export type ExportPlayback = {
  /** Stops live playback. */
  begin: () => Promise<void>;
  /** Moves the animation to `seconds` and resolves once that frame has rendered. */
  seek: (seconds: number) => Promise<void>;
  /** Hands the clock back to live playback. */
  end: () => void;
};

/** A background loop, rendered straight from its canvas renderer at export size. */
export type BackgroundLoopExport = {
  label: string;
  slug: string;
  format: BackgroundFormat;
  /** Grain is per-pixel noise, which GIF can't compress. */
  grainy: boolean;
  frames: (width: number, height: number, fps: number) => Promise<FrameSource>;
};

type ExportPanelProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  captureRef: RefObject<HTMLDivElement | null>;
  study: Study;
  studyLabel: string;
  timings: TimingParams;
  backgroundColor: string;
  logoColor: string;
  playback: ExportPlayback;
  /** Set while the lab shows a background instead of a logo study. */
  backgroundLoop: BackgroundLoopExport | null;
};

export default function ExportPanel({
  stageRef,
  captureRef,
  study,
  studyLabel,
  timings,
  backgroundColor,
  logoColor,
  playback,
  backgroundLoop,
}: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [sizeId, setSizeId] = useState("1080");
  const [transparent, setTransparent] = useState(false);
  const [status, setStatus] = useState({ target: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Backgrounds are drawn with canvas effects Lottie can't express, so they
  // don't offer it. A choice that doesn't apply falls back rather than being
  // lost, and comes back when it applies again.
  const formats = backgroundLoop ? FORMATS.filter(([id]) => id !== "lottie") : FORMATS;
  const activeFormat: ExportFormat = backgroundLoop && format === "lottie" ? "mp4" : format;
  const sizes = backgroundLoop ? BACKGROUND_SIZES[backgroundLoop.format] : LOGO_SIZES;
  const size = sizes.find((item) => item.id === sizeId) ?? sizes[0];
  const canBeTransparent = !backgroundLoop && activeFormat !== "mp4" && activeFormat !== "lottie";
  const transparentOutput = transparent && canBeTransparent;
  const raster = activeFormat !== "lottie";

  // A message belongs to the export it describes, so it gives way to the hint
  // as soon as the format, size or subject changes.
  const subject = backgroundLoop ? `${backgroundLoop.slug}-${backgroundLoop.format}` : study;
  const target = `${activeFormat}:${size.id}:${subject}`;

  const exportFile = async () => {
    if (busy) return;
    const exportSize = activeFormat === "gif" ? gifSize(sizes, size) : size;
    // Background files carry their size, since the same loop is often made
    // at several.
    const slug = backgroundLoop
      ? `${backgroundLoop.slug}-${exportSize.width}x${exportSize.height}`
      : slugForStudy(study);
    const report = (text: string) => setStatus({ target, text });
    setBusy(true);
    setProgress(0);
    report("Preparing…");
    let steppingClock = false;

    try {
      if (activeFormat === "lottie") {
        const json = buildLottie(study, timings, { backgroundColor, logoColor });
        downloadBlob(
          new Blob([JSON.stringify(json)], { type: "application/json" }),
          `${slug}.json`,
        );
        report(`Saved ${studyLabel} as Lottie JSON.`);
        return;
      }

      const fps = activeFormat === "gif" ? 15 : 30;
      const formatLabel = activeFormat === "gif" ? "GIF" : activeFormat === "mp4" ? "MP4" : "WebM";
      let source: FrameSource;
      let onEncodeProgress: ((value: number) => void) | undefined;

      if (backgroundLoop) {
        // Background frames are rendered as they are encoded, so encoding is
        // what moves the progress bar.
        source = await backgroundLoop.frames(exportSize.width, exportSize.height, fps);
        onEncodeProgress = setProgress;
        report(activeFormat === "gif" ? "Encoding GIF…" : `Recording ${formatLabel}…`);
      } else {
        const stage = stageRef.current;
        const captureTarget = captureRef.current;
        if (!captureTarget || !stage) {
          throw new Error("The preview is not ready to capture yet.");
        }

        steppingClock = true;
        await playback.begin();
        stage.classList.add("stage--exporting");
        await nextFrame();

        report("Recording frames…");
        const frames = await captureFrames(captureTarget, {
          durationSeconds: getStudyDurationSeconds(study, timings),
          fps,
          width: exportSize.width,
          height: exportSize.height,
          background: transparentOutput ? "transparent" : backgroundColor,
          seek: playback.seek,
          onProgress: setProgress,
        });
        source = frameList(frames);

        report(`Encoding ${formatLabel}…`);
        setProgress(1);
      }

      const blob =
        activeFormat === "gif"
          ? await encodeGif(source, fps, transparentOutput, onEncodeProgress)
          : activeFormat === "mp4"
            ? await encodeMp4(source, fps, onEncodeProgress)
            : await encodeWebm(source, fps, onEncodeProgress);

      const extension = blob.type.includes("webm") ? "webm" : activeFormat;
      downloadBlob(blob, `${slug}.${extension}`);
      report(
        extension !== activeFormat
          ? `This browser exported WebM instead of MP4. Keynote and PowerPoint both open WebM, or convert it with HandBrake if you need MP4.`
          : `Saved ${source.count} frames as ${extension.toUpperCase()} (${(blob.size / 1_000_000).toFixed(1)} MB).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      report(message);
    } finally {
      stageRef.current?.classList.remove("stage--exporting");
      if (steppingClock) playback.end();
      setBusy(false);
    }
  };

  const hint =
    activeFormat === "mp4"
      ? "Best for presentations."
      : activeFormat === "lottie"
        ? "Vector JSON for LottieFiles or After Effects."
        : activeFormat === "gif" && backgroundLoop?.grainy
          ? "Grain doesn't compress in GIF, so this file will be large (tens of MB). MP4 is far smaller."
          : backgroundLoop
            ? "Renders the loop frame by frame."
            : "Records the live preview.";

  return (
    <section className="export-panel" aria-label="Export animation">
      <div className="export-heading">
        <p className="eyebrow">Export</p>
        <span>
          {backgroundLoop
            ? "One seamless loop of the current background, at the current parameters."
            : "One cycle of the current study, at the current parameters."}
        </span>
      </div>

      <div className="export-formats" role="tablist" aria-label="File format">
        {formats.map(([id, label, formatHint]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeFormat === id}
            className={activeFormat === id ? "active" : ""}
            onClick={() => setFormat(id)}
          >
            <strong>{label}</strong>
            <span>{formatHint}</span>
          </button>
        ))}
      </div>

      <div className="export-options">
        <label>
          Size
          <select
            value={size.id}
            disabled={!raster || busy}
            onChange={(event) => setSizeId(event.target.value)}
          >
            {sizes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {backgroundLoop ? null : (
          <label className="export-check">
            <input
              type="checkbox"
              checked={transparentOutput}
              disabled={busy || !canBeTransparent}
              onChange={(event) => setTransparent(event.target.checked)}
            />
            Transparent background
          </label>
        )}
      </div>

      <div className="export-actions">
        <button type="button" className="export-button" disabled={busy} onClick={() => void exportFile()}>
          {busy ? "Exporting…" : `Download ${activeFormat.toUpperCase()}`}
        </button>
        {busy ? (
          <div className="export-progress" aria-hidden="true">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}
        <p className="export-status">{status.target === target && status.text ? status.text : hint}</p>
      </div>
    </section>
  );
}
