# ALBA · WebAR

A browser-based AR experience for **Alba — Trigo con Naranja** by Cerveceria de Zarra.

The flow:

1. **Intro** — Megrim "ALBA" mark, "Scan to enter" button
2. **Scanning** — live camera with a scan frame; user points at an Alba can
3. **Detected** — white card prompts "Tap to continue" + "No app needed"
4. **Valley** — the can stays in view while the orange-grove scene fades in around it (real world still visible)
5. **Cards** — four story cards tap-through: ALBA (the beer) → NARANJA (the ingredient) → ZARRA (the valley) → AITOR (the brewer)
6. **Community** — popup with "7,243 people already gathered around this mesa · Leave your trace? · Join the community / Maybe later"

Real world is visible through every state. Mixed-reality the whole way.

Built with **[MindAR.js](https://github.com/hiukim/mind-ar-js)** + **[A-Frame](https://aframe.io)**. Fonts: **Megrim** + **Nunito**. No build step. One HTML file.

---

## Quick start

### 1. Compile the can's tracking image

1. Open: <https://hiukim.github.io/mind-ar-js-doc/tools/compile>
2. Upload `assets/target-image.png` (already prepared)
3. Click **Start**, wait ~30 s, click **Download**
4. Drop the resulting `targets.mind` next to `index.html`

### 2. Test it

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` on your computer for UI testing. For real AR on phone, use ngrok (or any tunnel) → open the HTTPS URL on your phone.

### 3. Deploy

**Netlify Drop** (simplest):

1. **Unzip** the project first (if it came as a zip).
2. Go to <https://app.netlify.com/drop>.
3. Drag the **`webar-alba` folder itself** — the one containing `index.html` at its top level. Do **not** drag the parent folder, and do **not** drag the zip.
4. If the URL gives a 404, click your latest deploy → "Browse deploy files" — `index.html` must be at the root, not inside a `webar-alba/` subfolder.

Other hosts that work: Vercel, Cloudflare Pages, GitHub Pages, anywhere static with HTTPS.

---

## Editing copy and content

All text lives in a single `CONTENT` object at the top of `<script>` in `index.html`. No need to touch markup to change words:

```js
const CONTENT = {
  intro:     { mark: 'ALBA', sub: 'Trigo con Naranja', cta: 'Scan to enter', hint: '...' },
  scan:      { hint: 'Find the can', sub: 'Frame it within' },
  detected:  { title: 'Welcome', sub: '...', cta: 'Tap to continue', tag: 'No app needed' },
  valley:    { hint: 'Tap to continue' },
  cards: {
    tap: 'Tap to continue',
    items: [
      { number: '01', label: 'The beer',       title: 'ALBA',
        desc:  'Soft wheat, bright citrus, mid-morning sun.',
        color: 'orange', image: './assets/can.png' },
      { number: '02', label: 'The ingredient', title: 'NARANJA', ... color: 'olive',  ... },
      { number: '03', label: 'The valley',     title: 'ZARRA',   ... color: 'amber',  ... },
      { number: '04', label: 'The brewer',     title: 'AITOR',   ... color: 'sage',   ... },
    ],
  },
  community: { num: '7,243', line: '...', title: 'Leave your trace?',
               cta: 'Join the community', skip: 'Maybe later',
               joinUrl: 'https://www.cerveceriadezarra.es' },
};
```

- **Change a word** → edit the string in `CONTENT`, save, reload.
- **Swap a card image** → drop a new PNG into `assets/`, point `image:` at it. Transparent backgrounds look best.
- **Add a 5th card** → just append another object to `CONTENT.cards.items`. The progress dots and tap-through logic adapt automatically.
- **Change the join button's destination** → edit `community.joinUrl`.

## Editing colours and theme

All colours are CSS variables at the very top of `<style>`:

```css
:root {
  --orange:  #E48043;   /* Card 1, primary CTA */
  --olive:   #9C963A;   /* Card 2 */
  --amber:   #D9A032;   /* Card 3 */
  --sage:    #8FA38C;   /* Card 4 */
  --cream:   #F5E8D0;   /* Popup body */
  --teal:    #4B7E8F;   /* Popup border */
  ...
  --font-display: 'Megrim', cursive;
  --font-body:    'Nunito', system-ui, sans-serif;
}
```

To change a card's colour, edit one variable. To re-skin the whole experience, edit them all.

## Testing without a real can

Open the page with `?debug` in the URL:

```
http://localhost:8000/?debug
```

You'll get:

- a **Skip detect →** button bottom-right in the scanning state
- keyboard navigation: **→ / Space** advances state, **←** goes back

This lets you click through the whole flow on a laptop without compiling a `.mind` file or pointing a camera at a real can.

## Files

```
webar-alba/
├── index.html               whole experience: HTML + CSS + JS + AR scene
├── targets.mind             ← you compile this from assets/target-image.png
├── README.md
└── assets/
    ├── target-image.png     trains the can detector (compile → targets.mind)
    ├── can.png              transparent-backed can (Card 1)
    ├── wheat-orange.png     wheat+orange ornament (Card 2 + AR overlay)
    ├── sun-mountains.png    valley sketch (Card 3 + AR accent)
    ├── brewery.png          brewery sketch (Card 4 + AR overlay)
    ├── landscape.jpg        full valley scene (AR backdrop + community popup bg)
    ├── sun-rays.png         radial dawn glow (AR backdrop)
    └── (orange-bunch.png unused — drop it into Card 5 if you add one)
```

## Detection tips

- Hold the can ~15–40 cm from the camera with the label roughly facing the lens.
- MindAR's tracking is fuzzy by design — it'll lock onto the label even at angles. You're not locked to a single fixed graphic perspective.
- Once the user has tapped through "Detected", **the cards and popup are HTML overlays, not AR-anchored**. They stay readable and tappable even if the user puts the can down. The AR-anchored part is just the brief valley scene.

## Caveat about can tracking

This still uses planar image tracking — the **can's label** is the marker. If you point at a totally different can, it won't fire `targetFound`. True "any cylindrical can" detection requires real object recognition (paid stacks like 8th Wall / Niantic Lightship). For a branded scan-and-watch like this one, planar tracking is the standard approach and works very well.

## Browser support

- iOS Safari 11+ (14.3+ recommended)
- Android Chrome / Edge / Samsung Internet
- Desktop Chrome / Edge / Firefox / Safari (uses webcam)

Doesn't work in: Instagram / Facebook / TikTok in-app browsers (no `getUserMedia`). Tell users to open the link in their normal browser.

## Credits

Artwork from `AR.fig` (Cerveceria de Zarra brand mockups, design by m.korsmit.mk).
Tech: [MindAR](https://github.com/hiukim/mind-ar-js) MIT, [A-Frame](https://aframe.io) MIT.
