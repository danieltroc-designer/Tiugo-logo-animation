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
  tiugoPaths.ts         straight and final letterforms from Figma
  logoParts.ts          per-part geometry for the piece-based studies
  export/               frame capture, video/GIF encoding, Lottie generation
plans/                  motion audit findings and their implementation notes
```
