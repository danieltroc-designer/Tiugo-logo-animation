import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { MotionValue } from "motion/react";
import type { BackgroundId, BackgroundParams } from "./backgrounds/designs";
import {
  loadBackgroundAssets,
  renderBackground,
  type BackgroundAssets,
} from "./backgrounds/render";
import { useStudyPlayback } from "./useStudyPlayback";

export default function BackgroundStage({
  clock,
  background,
  label,
  params,
  aspect,
  loopSeconds,
  showLogo,
  logoScale,
  grainMotion,
  loop,
  replayKey,
  reduceMotion,
  paused,
}: {
  clock: MotionValue<number>;
  background: BackgroundId;
  label: string;
  params: BackgroundParams;
  /** Width over height of the artboard. */
  aspect: number;
  loopSeconds: number;
  showLogo: boolean;
  logoScale: number;
  grainMotion: boolean;
  loop: boolean;
  replayKey: number;
  reduceMotion: boolean;
  paused: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<BackgroundAssets | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadBackgroundAssets().then((loaded) => {
      if (mounted) setAssets(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Every movement completes whole cycles within the loop, so the last frame
  // meets the first and the loop needs no fade.
  useStudyPlayback({
    clock,
    total: loopSeconds,
    loop,
    replayKey,
    reduceMotion,
    paused,
    fadeOnLoop: false,
  });

  // The clock subscription below outlives renders, so it reads the latest
  // inputs from here rather than closing over stale ones.
  const scene = useRef({ background, params, loopSeconds, showLogo, logoScale, grainMotion, assets });
  const draw = useRef(() => {});

  // Changing a setting redraws immediately, even while playback is stopped.
  useLayoutEffect(() => {
    scene.current = { background, params, loopSeconds, showLogo, logoScale, grainMotion, assets };
    draw.current();
  }, [background, params, loopSeconds, showLogo, logoScale, grainMotion, assets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    draw.current = () => {
      const { assets: loaded, ...current } = scene.current;
      if (!loaded) return;
      renderBackground(ctx, canvas.width, canvas.height, { ...current, time: clock.get() }, loaded);
    };

    // Also fires when the artboard changes shape, which re-lays the design out.
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      draw.current();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const unsubscribe = clock.on("change", () => draw.current());

    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [clock]);

  return (
    <div className="background-artboard" style={{ "--artboard-aspect": aspect } as CSSProperties}>
      <canvas
        ref={canvasRef}
        className="background-canvas"
        role="img"
        aria-label={showLogo ? `Tiugo logo on the ${label} background` : `${label} background`}
      />
    </div>
  );
}
