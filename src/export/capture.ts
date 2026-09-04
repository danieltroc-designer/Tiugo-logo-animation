import { toCanvas } from "html-to-image";
import { evenSize, nextFrame, wait } from "./download";

export type CaptureOptions = {
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  background: string;
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
  const interval = 1000 / options.fps;
  const frames: HTMLCanvasElement[] = [];

  for (let index = 0; index < frameCount; index += 1) {
    const snapshot = await toCanvas(source, {
      pixelRatio: 2,
      cacheBust: false,
      skipFonts: true,
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

    const dest = fitRect(snapshot.width, snapshot.height, width, height, Math.round(width * 0.08));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(snapshot, dest.x, dest.y, dest.width, dest.height);
    frames.push(frame);

    options.onProgress?.((index + 1) / frameCount);
    if (index < frameCount - 1) await wait(interval);
  }

  await nextFrame();
  return frames;
}
