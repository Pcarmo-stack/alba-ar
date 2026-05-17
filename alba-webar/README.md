# ALBA · Trigo con Naranja — WebAR

A camera-first WebAR experience built with **A-Frame** + **MindAR**, optimised for
mobile Safari (iOS) reliability.

---

## ⚠️ ONE manual step before this works

MindAR doesn't track raw PNGs — it tracks a compiled **`.mind`** descriptor.
I can't run the compiler here, so do this once (takes ~30 seconds):

1. Open the MindAR image compiler:
   <https://hiukim.github.io/mind-ar-js-doc/tools/compile>
2. Drag in **`assets/target-image.png`**.
3. Click **Start** and wait for it to finish.
4. Click **Download** → save the file as **`targets.mind`** in the **project root**
   (same folder as `index.html`).

That's it. No other manual step.

---

## Run locally

WebAR requires HTTPS (or localhost) because the browser only grants camera
access in a secure context.

```bash
# from project root
npx serve .
# or
python3 -m http.server 8080
```

Then open the URL on your phone. For testing on a real iPhone over your LAN,
the easiest path is to tunnel localhost over HTTPS:

```bash
npx localtunnel --port 8080
# or
npx ngrok http 8080
```

Open the HTTPS URL on the iPhone, allow camera access, and point at the can.

---

## Deploy

Drop the whole folder onto any static host that serves HTTPS:

- **Netlify**: drag-and-drop the folder at app.netlify.com/drop
- **Vercel**: `vercel --prod`
- **GitHub Pages**: push to a repo, enable Pages
- **Cloudflare Pages**: connect repo or upload

No build step. No backend. No environment variables.

---

## Architecture

The experience follows one non-negotiable rule:

> **The real-world camera feed must always remain visible
> once AR has started.**

How that's enforced:

- A **single `<a-scene>`** is mounted at page load and never removed.
- MindAR starts with `autoStart: false` and is kicked off in JS on the
  user's first tap (iOS gesture requirement for camera + video).
- All UI states (intro, "detected" pill, cards, end screen) are **HTML overlays
  with `position: fixed`** layered above the scene. Hiding an overlay reveals
  the camera; showing one never tears down the scene.
- The AR video lives inside the scene as `<a-video>` anchored to the marker
  — it's **never** played fullscreen.

### iOS video unlock pattern

Safari blocks programmatic `video.play()` unless it has happened once during
a user gesture. The fix, executed on the **Start** tap:

```js
videoEl.muted = true;
videoEl.playsInline = true;
videoEl.play()              // gestured play
  .then(() => {
    videoEl.pause();        // immediately pause
    videoEl.currentTime = 0;
  });
```

After this, `videoEl.play()` works programmatically when the marker is found.

### Files

```
.
├── index.html       ← single-scene markup + overlays
├── style.css        ← vintage botanical aesthetic
├── main.js          ← AR lifecycle, iOS unlock, simple linear flow
├── targets.mind     ← YOU compile this (see top of README)
├── README.md
└── assets/
    ├── alba-text.png
    ├── brewery.png
    ├── can.png
    ├── landscape.jpg
    ├── sun-mountains.png
    ├── sun-rays.png
    ├── target-image.png      ← source for targets.mind
    ├── valley-video.mp4
    ├── valley-video.webm
    └── wheat-orange.png
```

---

## UX flow

```
[INTRO]
  Comenzar tap → camera turns on, video unlocked
        │
        ▼
[AR LIVE]
  marker found → "Detectada" pill + tap hint appear
        │
  user taps → video plays anchored to can
        │
  video ends (or double-tap to skip)
        │
        ▼
[CARDS]
  three story cards over the still-running camera
        │
  "Continuar" tap
        │
        ▼
[END]
  ALBA logo, can, "Volver a ver" replay (re-enters AR moment
  without rebooting the scene)
```

If the marker is lost mid-experience the video pauses, but **the camera and
scene keep running**. Re-acquiring the marker resumes the flow.

---

## Console logs (for debugging on a tethered device)

| Log                       | Meaning                                          |
|---------------------------|--------------------------------------------------|
| `AR: initialized`         | MindAR system found, about to start              |
| `AR: started`             | Camera live                                      |
| `AR: target found`        | Marker entered frame                             |
| `AR: target lost`         | Marker left frame                                |
| `VIDEO: unlocked`         | iOS gesture-unlock succeeded                     |
| `VIDEO: play success`     | Playback running                                 |
| `VIDEO: play failed`      | First attempt failed, retry pending              |
| `VIDEO: retry triggered`  | Second attempt firing 300ms later                |
| `VIDEO: ended`            | Video finished naturally — cards will appear     |

To see these logs on a real iPhone, connect it via USB and open Safari →
Develop → [your phone] → [page].

---

## Tweaking

- **Video plane size**: edit the `width` / `height` on `#ar-video-plane`
  in `index.html`. Current values are **1.0 × 1.778** (9:16, matching the
  source video at 720×1280). If you swap in a landscape clip, flip these
  (e.g. `width="1.778" height="1"` for 16:9).
- **Tracking smoothness**: tune `filterMinCF`, `filterBeta`, `missTolerance`
  on the `mindar-image` attribute in `index.html`. Lower `filterMinCF`
  smoother but laggier; higher `missTolerance` more forgiving when the
  marker briefly leaves frame.
- **Marker**: re-compile `targets.mind` with a different source image if you
  swap labels.
