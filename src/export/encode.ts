import { GIFEncoder, applyPalette, quantize } from "gifenc";

function canvasPixels(frame: HTMLCanvasElement): Uint8Array {
  const context = frame.getContext("2d");
  if (!context) throw new Error("Could not read export frame.");
  return new Uint8Array(context.getImageData(0, 0, frame.width, frame.height).data);
}

export async function encodeGif(
  frames: HTMLCanvasElement[],
  fps: number,
  transparent: boolean,
): Promise<Blob> {
  const encoder = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const first = frames[0];
  if (!first) throw new Error("No frames to encode.");

  frames.forEach((frame, index) => {
    const data = canvasPixels(frame);
    const palette = quantize(data, 256, { format: transparent ? "rgba4444" : "rgb565" });
    const indexPixels = applyPalette(data, palette, transparent ? "rgba4444" : "rgb565");
    encoder.writeFrame(indexPixels, frame.width, frame.height, {
      palette,
      delay,
      first: index === 0,
      transparent,
      repeat: 0,
    });
  });

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
  frames: HTMLCanvasElement[],
  fps: number,
  mimeType: string,
): Promise<Blob> {
  const first = frames[0];
  if (!first) throw new Error("No frames to encode.");

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
  for (const frame of frames) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(frame, 0, 0);
    track.requestFrame?.();
    await new Promise((resolve) => window.setTimeout(resolve, interval));
  }

  recorder.stop();
  stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
  return stopped;
}

export async function encodeMp4(frames: HTMLCanvasElement[], fps: number) {
  try {
    return await recordFrames(frames, fps, pickMime("mp4"));
  } catch {
    const blob = await recordFrames(frames, fps, pickMime("webm"));
    return blob;
  }
}

export function encodeWebm(frames: HTMLCanvasElement[], fps: number) {
  return recordFrames(frames, fps, pickMime("webm"));
}
