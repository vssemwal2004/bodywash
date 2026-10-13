# NIRA — 3D scroll landing page (body wash)

A product landing page where a 3D bottle rotates, travels and changes colour as you scroll.
Plain HTML/CSS/JS — no build step. Three.js renders the bottle, Lenis smooths the scroll.

Screenshots of every section (desktop + mobile) are in [`preview/`](preview/).

## Run it

ES modules don't load from `file://`, so serve the folder:

```bash
python -m http.server 5173      # then open http://localhost:5173
# or: npx serve .               # or VS Code "Live Server"
```

An internet connection is needed for the CDN (Three.js, Lenis, Google Fonts).

## How it works

| Section | What the bottle does |
|---|---|
| Hero | Rises and unwinds into place after the loader; follows the mouse slightly |
| 01 Formula | Swings right and turns 180° to show the **back label** (ingredients) |
| 02 Design | Section pins; scroll drives one full **360° turn**; degree counter + callouts track progress |
| 03 Scents | Section pins; each third of the scroll switches scent — bottle, label, **rim light, glow and accent colour** morph |
| 04 Ritual | Tilts like it's pouring, beside the 3 steps |
| 05 Shop | Faces front; scent chips and size toggle restyle/rescale the bottle live |

**Look:** dark studio. The bottle reflects a custom "softbox" environment (`studioEnvironment()` in
`js/main.js`), rim lights and the halo behind it take the scent's colour, and dust specks drift in the light.

**No text over the bottle.** The 3D canvas sits *behind* the page, and every text column is sized from
the bottle's on-screen width (`--bottle-half` / `--clear` in `css/style.css`, derived from the pose
scales in `POSES`). Section copy also fades out as it leaves, so only one section's text is ever on
screen while the bottle travels. If you change a pose's `x` or `s`, adjust the matching CSS guard.

**Scroll → 3D mapping** (`js/main.js`): each `<section>` names a pose with `data-pose`
(or `data-pose-start`/`data-pose-end` for pinned sections). On load/resize the script measures
where each section sits, builds a list of `{scrollY → pose}` keyframes, and every frame
interpolates between the two surrounding keyframes. The bottle then *damps* toward that target,
which gives it inertia instead of being glued to the scrollbar.

## Files

```
index.html        content + section → pose wiring
css/style.css     layout, theme tokens, mobile rules
js/main.js        scene, scroll keyframes, UI sync, interactions  ← edit POSES here
js/bottle.js      procedural bottle + canvas-drawn labels
js/variants.js    scents, colours, ingredient lists, sizes/prices ← edit product data here
```

## Customising

- **Brand / copy** — `index.html`, and the label text in `js/bottle.js` (`drawFront`, `drawBack`).
- **Scents & colours** — `js/variants.js`. `css` keys become CSS variables (`accent` → `--accent`).
- **Motion** — tweak `POSES` in `js/main.js`; add a section with `data-pose="yourPose"` and a matching entry.
- **Pinned length** — `.spin { height }` / `.scents { height }` in CSS: taller = slower animation.

### Using your real product model

The procedural bottle is a stand-in. For a real product, get a `.glb` (Blender, a 3D artist, or a
photogrammetry scan with e.g. Polycam/RealityScan), compress it (`npx gltf-transform optimize in.glb out.glb`),
then in `js/bottle.js` replace the generated meshes with:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gltf = await new GLTFLoader().loadAsync('assets/bottle.glb');
model.add(gltf.scene); // scale/centre it to roughly 3 units tall
```

Keep the `{ group, setVariant, setSize, update, redraw }` interface and the rest of the page works unchanged.

## Before you ship

- **All product claims are placeholders** (sulfate-free, pH 5.5, ingredients, recyclability, prices,
  shipping). Replace them with verified facts for your actual product — cosmetic claims are regulated.
- **Test on a mid-range Android phone**, not only a laptop. If it stutters: lower the dust count
  (`makeDust`), cap pixel ratio at 1.5, or reduce lathe segments.
- **Layout check:** open `/?debug` and call `__nira.bottleRect()` in the console to get the bottle's
  on-screen box — useful for confirming nothing overlaps it after you change copy or poses.
- **Check Lighthouse** (Performance, Accessibility). `prefers-reduced-motion` is respected; the page
  still works without WebGL (the bottle is simply hidden).
- **Measure whether the 3D helps**: compare scroll depth and "Add to bag" clicks against a simple
  static-image version of the page. Heavy 3D that doesn't lift conversion is just cost.
