import { useState, type RefObject } from "react";
import type { Study } from "./logoParts";
import { captureFrames } from "./export/capture";
import { downloadBlob, nextFrame } from "./export/download";
import { encodeGif, encodeMp4, encodeWebm } from "./export/encode";
import { buildLottie } from "./export/lottie";
import { getStudyDurationSeconds, slugForStudy, type TimingParams } from "./export/timings";

export type ExportFormat = "mp4" | "gif" | "webm" | "lottie";

const SIZES = [
  { id: "1080", label: "1920 × 1080", width: 1920, height: 1080 },
  { id: "720", label: "1280 × 720", width: 1280, height: 720 },
  { id: "square", label: "1080 × 1080", width: 1080, height: 1080 },
] as const;

type ExportPanelProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  captureRef: RefObject<HTMLDivElement | null>;
  study: Study;
  studyLabel: string;
  timings: TimingParams;
  backgroundColor: string;
  logoColor: string;
  onPrepare: () => Promise<void> | void;
};

export default function ExportPanel({
  stageRef,
  captureRef,
  study,
  studyLabel,
  timings,
  backgroundColor,
  logoColor,
  onPrepare,
}: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [sizeId, setSizeId] = useState<(typeof SIZES)[number]["id"]>("1080");
  const [transparent, setTransparent] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const size = SIZES.find((item) => item.id === sizeId) ?? SIZES[0];
  const background = transparent ? "transparent" : backgroundColor;
  const raster = format !== "lottie";

  const exportFile = async () => {
    if (busy) return;
    const slug = `${slugForStudy(study)}`;
    setBusy(true);
    setProgress(0);
    setStatus("Preparing…");

    try {
      if (format === "lottie") {
        const json = buildLottie(study, timings, { backgroundColor, logoColor });
        downloadBlob(
          new Blob([JSON.stringify(json)], { type: "application/json" }),
          `${slug}.json`,
        );
        setStatus(`Saved ${studyLabel} as Lottie JSON.`);
        return;
      }

      const stage = stageRef.current;
      const captureTarget = captureRef.current;
      if (!captureTarget || !stage) {
        throw new Error("The preview is not ready to capture yet.");
      }

      await onPrepare();
      stage.classList.add("stage--exporting");
      await nextFrame();
      await nextFrame();

      const fps = format === "gif" ? 15 : 30;
      const exportSize = format === "gif" && size.width > 1280 ? SIZES[1] : size;
      const durationSeconds = getStudyDurationSeconds(study, timings);
      setStatus("Recording frames…");
      const frames = await captureFrames(captureTarget, {
        durationSeconds,
        fps,
        width: exportSize.width,
        height: exportSize.height,
        background,
        onProgress: setProgress,
      });

      setStatus(format === "gif" ? "Encoding GIF…" : format === "mp4" ? "Encoding MP4…" : "Encoding WebM…");
      setProgress(1);

      const blob =
        format === "gif"
          ? await encodeGif(frames, fps, transparent)
          : format === "mp4"
            ? await encodeMp4(frames, fps)
            : await encodeWebm(frames, fps);

      const extension = blob.type.includes("webm") ? "webm" : format;
      downloadBlob(blob, `${slug}.${extension}`);
      setStatus(
        extension !== format
          ? `This browser exported WebM instead of MP4. Keynote and PowerPoint both open WebM, or convert it with HandBrake if you need MP4.`
          : `Saved ${frames.length} frames as ${extension.toUpperCase()}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      setStatus(message);
    } finally {
      stageRef.current?.classList.remove("stage--exporting");
      setBusy(false);
    }
  };

  return (
    <section className="export-panel" aria-label="Export animation">
      <div className="export-heading">
        <p className="eyebrow">Export</p>
        <span>One cycle of the current study, at the current parameters.</span>
      </div>

      <div className="export-formats" role="tablist" aria-label="File format">
        {(
          [
            ["mp4", "MP4", "Keynote / PowerPoint"],
            ["gif", "GIF", "Slides / Slack"],
            ["webm", "WebM", "Web / Figma"],
            ["lottie", "Lottie", "After Effects / web"],
          ] as const
        ).map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={format === id}
            className={format === id ? "active" : ""}
            onClick={() => setFormat(id)}
          >
            <strong>{label}</strong>
            <span>{hint}</span>
          </button>
        ))}
      </div>

      <div className="export-options">
        <label>
          Size
          <select
            value={sizeId}
            disabled={!raster || busy}
            onChange={(event) => setSizeId(event.target.value as typeof sizeId)}
          >
            {SIZES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="export-check">
          <input
            type="checkbox"
            checked={transparent}
            disabled={busy || format === "mp4" || format === "lottie"}
            onChange={(event) => setTransparent(event.target.checked)}
          />
          Transparent background
        </label>
      </div>

      <div className="export-actions">
        <button type="button" className="export-button" disabled={busy} onClick={() => void exportFile()}>
          {busy ? "Exporting…" : `Download ${format.toUpperCase()}`}
        </button>
        {busy ? (
          <div className="export-progress" aria-hidden="true">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}
        <p className="export-status">{status || (format === "mp4" ? "Best for presentations." : format === "lottie" ? "Vector JSON for LottieFiles or After Effects." : "Records the live preview.")}</p>
      </div>
    </section>
  );
}
