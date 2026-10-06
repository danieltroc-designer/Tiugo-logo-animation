import { loadBackgroundAssets, renderBackground, type BackgroundScene } from "../backgrounds/render";
import type { FrameSource } from "./encode";

/**
 * Renders one seamless loop of a background straight to a canvas, frame by
 * frame. Frames are spread evenly over the loop, so the last frame flows back
 * into the first when the file repeats.
 */
export async function backgroundFrames(
  scene: Omit<BackgroundScene, "time">,
  width: number,
  height: number,
  fps: number,
): Promise<FrameSource> {
  const assets = await loadBackgroundAssets();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create an export canvas.");

  const count = Math.max(1, Math.round(scene.loopSeconds * fps));
  return {
    count,
    frame: (index) => {
      renderBackground(ctx, width, height, { ...scene, time: (index / count) * scene.loopSeconds }, assets);
      return canvas;
    },
  };
}
