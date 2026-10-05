import { toCanvas } from "html-to-image";
import { evenSize, nextFrame } from "./download";

/**
 * Extra room recorded around the logo box on each side, as a fraction of its
 * size. Gather and Soft cascade travel in from outside the wordmark, so a
 * snapshot of the box alone would cut those pieces off at its edge.
 */
const BLEED = 0.5;

export type CaptureOptions = {
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  background: string;
  /** Moves the animation to an exact time and resolves once that frame has rendered. */
  seek: (seconds: number) => Promise<void>;
  onProgress?: (progress: number) => void;
};

function fitRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
  padding: number,
) {
  const availableWidth = destWidth - padding * 2;
  const availableHeight = destHeight - padding * 2;
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (destWidth - width) / 2,
    y: (destHeight - height) / 2,
    width,
    height,
  };
}

export async function captureFrames(
  source: HTMLElement,
  options: CaptureOptions,
): Promise<HTMLCanvasElement[]> {
  const width = evenSize(options.width);
  const height = evenSize(options.height);
  const frameCount = Math.max(1, Math.round(options.durationSeconds * options.fps));
  const frames: HTMLCanvasElement[] = [];

  const boxWidth = source.offsetWidth;
  const boxHeight = source.offsetHeight;
  const bleedX = Math.round(boxWidth * BLEED);
  const bleedY = Math.round(boxHeight * BLEED);

  // The logo box keeps the same place in the frame as it always has; the
  // bleed around it simply extends past, and the frame edges crop it.
  const dest = fitRect(boxWidth, boxHeight, width, height, Math.round(width * 0.08));
  const toFrame = dest.width / boxWidth;

  // Each frame is rendered at its own timestamp rather than sampled from live
  // playback. A snapshot takes tens of milliseconds, so sampling in real time
  // would skip ahead and record the motion faster than it plays.
  for (let index = 0; index < frameCount; index += 1) {
    await options.seek(index / options.fps);
    const snapshot = await toCanvas(source, {
      pixelRatio: 2,
      cacheBust: false,
      skipFonts: true,
      width: boxWidth + bleedX * 2,
      height: boxHeight + bleedY * 2,
      style: { padding: `${bleedY}px ${bleedX}px`, boxSizing: "border-box" },
      backgroundColor: options.background === "transparent" ? undefined : options.background,
    });

    const frame = document.createElement("canvas");
    frame.width = width;
    frame.height = height;
    const context = frame.getContext("2d");
    if (!context) throw new Error("Could not create an export canvas.");

    if (options.background !== "transparent") {
      context.fillStyle = options.background;
      context.fillRect(0, 0, width, height);
    } else {
      context.clearRect(0, 0, width, height);
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      snapshot,
      dest.x - bleedX * toFrame,
      dest.y - bleedY * toFrame,
      (boxWidth + bleedX * 2) * toFrame,
      (boxHeight + bleedY * 2) * toFrame,
    );
    frames.push(frame);

    options.onProgress?.((index + 1) / frameCount);
  }

  await nextFrame();
  return frames;
}
