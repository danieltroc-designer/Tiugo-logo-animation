# Tiugo logo motion lab

An interactive studio for exploring entrance animations for the Tiugo wordmark.
Five studies run side by side with live parameter controls, and any of them can
be exported for use in slides or video.

Built from the Figma rebranding file, using the exact vector geometry rather
than traced approximations.

## Running it

```bash
npm install
npm run dev
```

## The studies

| # | Study | Idea |
| --- | --- | --- |
| 01 | Gather | Pieces arrive from the wordmark's natural directions and settle together. |
| 02 | Soft cascade | A compact vertical rhythm with a restrained, sequential landing. |
| 03 | Sweep | The wordmark is exposed left to right as each character resolves. |
| 04 | Path + pixel | Letters draw from their real vector paths while the T pixel nudges into place. |
| 05 | Draw & shift | Straight letterforms draw, ink in, then the T, u and g squares slide into the final stepped mark. |

Study 05 is the one that matches the rebrand concept most directly: it starts
from the straight letterforms and morphs into the final shape by interpolating
the two Figma frames, which share an identical path skeleton. Only the three
moving squares differ, so the interpolation is an exact translation rather than
a distortion.

## Backgrounds

Switch the toolbar from **Logo** to **Background** to animate the three social
backgrounds from the Figma "Social Media" file (section `92:7808`) instead of
the wordmark, which then sits still on top as in the designs.

| # | Background | Figma frame | Motion |
| --- | --- | --- | --- |
| 01 | Steps | W1 | The stepped pixel pattern climbs while the orange glow sweeps across it. Step morph eases the blocks between stepped and straight, the same move as Draw & shift. |
| 02 | Glow | W2 | Two soft highlights sweep in from opposite corners of the brand orange towards the logo and back, breathing as they go. |
| 03 | Mesh | w3 | Blue, violet and orange light fields drift and turn through each other. |

Each background is drawn on a canvas from the design's own layers: the blurred
glows and blobs are the SVGs exported from Figma, the grain is its noise
texture, and the stair geometry is measured from the exported vector. Every
movement completes whole cycles within the loop length, so the last frame flows
back into the first. With the logo and Glow size at 100%, the first 16:9 frame
renders as designed; the defaults draw the logo at half that size and make the
Glow circles bigger and livelier. Figma's export of w3 leaves out a noise
effect, so its shade layer and grain are matched to Figma's render rather than
taken from the exported values.

**Format** switches between 16:9 and square. Square isn't a crop: Steps gains
rows of stairs, Glow keeps its circles at opposite corners and grows them with
the frame, and Mesh stretches its light fields to the new height.

In background mode the export panel renders one loop straight from the canvas
renderer as MP4, WebM or GIF: 1920 × 1080, 1280 × 720 or 3840 × 2160 in 16:9,
and 1080 × 1080 or 2160 × 2160 in square. The bitrate scales with the size, so
an 8 second 4K square loop of Glow is about 18 MB of MP4. Grain doesn't
compress in GIF, so Glow and Mesh GIFs (capped at 1280 × 720 or 1080 × 1080)
run to tens of megabytes.

## Exporting

The export panel writes MP4, WebM, GIF, and Lottie JSON. Video and GIF are
rendered from the live DOM one frame at a time: export pauses playback and
steps the study's clock to each frame's exact timestamp, so the recording plays
at the same speed as the preview no matter how long each snapshot takes. The
area around the logo is recorded too, so pieces that travel in from outside the
wordmark stay visible. Lottie is generated from the same timeline data as real
vector shape layers, which keeps it resolution independent and editable in
After Effects.

## Notes on the motion

Timing sliders commit on release rather than on every input event, so dragging
them does not restart playback mid-flight. Every study runs on a single shared
clock, which keeps all of its pieces in sync when looping.

When looping, each pass ends by fading the resting mark out and leaving a short
empty beat, so the next entrance starts from a clean stage instead of cutting
straight from the finished logo to nothing.

Reduced motion is handled in JavaScript per component: each study renders its
final frame immediately instead of animating. The CSS layer only removes
spatial movement from the surrounding UI and keeps short colour feedback, so
controls still read as interactive.

## Layout

```
src/
  App.tsx               controls, state, and the playback clock
  useStudyPlayback.ts   plays a study's clock, including the loop fade
  PieceLogo.tsx         studies 01–03
  PathDrawLogo.tsx      study 04
  DrawShiftLogo.tsx     study 05, including the path interpolation
  BackgroundStage.tsx   the canvas preview for background mode
  backgrounds/          the three Figma backgrounds: controls and renderer
  tiugoPaths.ts         straight and final letterforms from Figma
  logoParts.ts          per-part geometry for the piece-based studies
  export/               frame capture, video/GIF encoding, Lottie generation
plans/                  motion audit findings and their implementation notes
```
