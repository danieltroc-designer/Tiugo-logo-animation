import { GIFEncoder, applyPalette, quantize } from "gifenc";

/**
 * Frames for an encoder, read one at a time. A source may reuse one canvas
 * for every frame, so long recordings don't have to hold them all in memory.
 */
export type FrameSource = {
  count: number;
  frame: (index: number) => HTMLCanvasElement | Promise<HTMLCanvasElement>;
};

export function frameList(frames: HTMLCanvasElement[]): FrameSource {
  return { count: frames.length, frame: (index) => frames[index] };
}

type Progress = (progress: number) => void;

function canvasPixels(frame: HTMLCanvasElement): Uint8Array {
  const context = frame.getContext("2d");
  if (!context) throw new Error("Could not read export frame.");
  return new Uint8Array(context.getImageData(0, 0, frame.width, frame.height).data);
}

export async function encodeGif(
  source: FrameSource,
  fps: number,
  transparent: boolean,
  onProgress?: Progress,
): Promise<Blob> {
  const encoder = GIFEncoder();
  if (!source.count) throw new Error("No frames to encode.");

  // GIF stores delays in whole centiseconds, so a 15 fps frame (6.67cs) can't
  // be written exactly. Rounding against the running total alternates 6 and 7,
  // which keeps the GIF the same length as the animation.
  const delayAt = (index: number) =>
    (Math.round(((index + 1) * 100) / fps) - Math.round((index * 100) / fps)) * 10;

  for (let index = 0; index < source.count; index += 1) {
    const frame = await source.frame(index);
    const data = canvasPixels(frame);
    const palette = quantize(data, 256, { format: transparent ? "rgba4444" : "rgb565" });
    const indexPixels = applyPalette(data, palette, transparent ? "rgba4444" : "rgb565");
    encoder.writeFrame(indexPixels, frame.width, frame.height, {
      palette,
      delay: delayAt(index),
      first: index === 0,
      transparent,
      repeat: 0,
    });
    onProgress?.((index + 1) / source.count);
  }

  encoder.finish();
  return new Blob([encoder.bytes() as BlobPart], { type: "image/gif" });
}

function pickMime(kind: "mp4" | "webm"): string {
  const candidates =
    kind === "mp4"
      ? ["video/mp4;codecs=avc1.42E01E", "video/mp4"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

  const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  if (!supported) {
    throw new Error(`${kind.toUpperCase()} recording is not supported in this browser.`);
  }
  return supported;
}

async function recordFrames(
  source: FrameSource,
  fps: number,
  mimeType: string,
  onProgress?: Progress,
): Promise<Blob> {
  if (!source.count) throw new Error("No frames to encode.");
  const first = await source.frame(0);

  const canvas = document.createElement("canvas");
  canvas.width = first.width;
  canvas.height = first.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create an encoder canvas.");

  const stream = canvas.captureStream(fps);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("The browser could not finish recording."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
  });

  recorder.start();
  const interval = 1000 / fps;
  const start = performance.now();
  for (let index = 0; index < source.count; index += 1) {
    const frame = index === 0 ? first : await source.frame(index);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(frame, 0, 0);
    track.requestFrame?.();
    onProgress?.((index + 1) / source.count);
    // The recorder timestamps frames as they arrive, so wait for each frame's
    // slot on an absolute schedule. Waiting a fixed interval after every draw
    // would let timer overshoot accumulate into a slower video.
    const untilNextFrame = start + (index + 1) * interval - performance.now();
    await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, untilNextFrame)));
  }

  recorder.stop();
  stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
  return stopped;
}

export async function encodeMp4(source: FrameSource, fps: number, onProgress?: Progress) {
  try {
    return await recordFrames(source, fps, pickMime("mp4"), onProgress);
  } catch {
    const blob = await recordFrames(source, fps, pickMime("webm"), onProgress);
    return blob;
  }
}

export function encodeWebm(source: FrameSource, fps: number, onProgress?: Progress) {
  return recordFrames(source, fps, pickMime("webm"), onProgress);
}
