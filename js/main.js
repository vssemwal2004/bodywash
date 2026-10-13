import * as THREE from 'three';
import { createBottle } from './bottle.js';
import { VARIANTS, VARIANT_ORDER, SIZES } from './variants.js';

const TAU = Math.PI * 2;
const root = document.documentElement;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Must match the compact-layout media query in style.css.
const compactQuery = matchMedia('(max-width: 759px), (max-aspect-ratio: 4/5)');

/* ---------------------------------------------------------------------------
 * Bottle poses. Sections reference these by name through data-pose (one pose,
 * reached when the section is centred) or data-pose-start / data-pose-end
 * (pinned sections: the bottle animates between the two while stuck).
 *
 *   x      fraction of half the viewport width: 0.5 = centre of the right half
 *   y      world units (the viewport is ~4.5 units tall)
 *   rx/ry/rz  radians — ry only increases, so the bottle always spins the
 *          same way as you scroll down
 *   s      scale. At s = 1 the bottle is ~68vh tall and ~29vh wide; the CSS
 *          column widths (--clear) are derived from that, so text never
 *          overlaps it. Change one, change the other.
 * ------------------------------------------------------------------------- */
const POSES = {
  hero:        { x: 0,    y: 0,     rx: 0.06, ry: -0.5,           rz: 0,     s: 1 },
  formula:     { x: 0.5,  y: -0.05, rx: 0.05, ry: Math.PI + 0.35, rz: 0.08,  s: 0.95 },
  spinStart:   { x: 0,    y: 0,     rx: 0.08, ry: TAU,            rz: 0,     s: 1 },
  spinEnd:     { x: 0,    y: 0,     rx: 0.08, ry: TAU * 2,        rz: 0,     s: 1 },
  scentsStart: { x: -0.5, y: 0,     rx: 0.05, ry: TAU * 2 - 0.35, rz: -0.05, s: 1 },
  scentsEnd:   { x: -0.5, y: 0,     rx: 0.05, ry: TAU * 2 + 0.35, rz: -0.05, s: 1 },
  ritual:      { x: 0.5,  y: 0.1,   rx: 0.12, ry: TAU * 2 + 0.6,  rz: 0.5,   s: 0.9 },
  shop:        { x: 0,    y: -0.05, rx: 0.05, ry: TAU * 3 - 0.45, rz: 0,     s: 1 },
};
const KEYS = ['x', 'y', 'rx', 'ry', 'rz', 's'];

/* --------------------------------------------------------------- 3D scene */

let gl = null;
try {
  gl = initScene();
} catch (err) {
  console.warn('WebGL unavailable — showing the page without the 3D bottle.', err);
  root.classList.add('no-webgl');
}

function initScene() {
  const canvas = $('#webgl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps product colours true, unlike ACES
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 8.5);
  scene.environment = studioEnvironment(renderer);

  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(4, 5, 6);
  // Rim lights take the scent colour, so the bottle's edges glow in its own hue.
  const rimL = new THREE.DirectionalLight(0xffffff, 3);
  rimL.position.set(-5, 2, -3);
  const rimR = new THREE.DirectionalLight(0xffffff, 2);
  rimR.position.set(5, 1, -4);
  scene.add(key, rimL, rimR);

  const bottle = createBottle(renderer);
  // Spin around the bottle's own axis first, then tilt — otherwise a tilted bottle wobbles as it spins.
  bottle.group.rotation.order = 'XZY';
  scene.add(bottle.group);

  const soft = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ map: soft, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  halo.position.z = -3.5;

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: soft, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, 'rgba(0,0,0,.85)'], [0.4, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']]),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 1; // after the light pool, so the dark core sits on top of it
  scene.add(halo, pool, shadow);

  const dust = makeDust(reduceMotion ? 0 : 260, soft);
  scene.add(dust.points);

  return { renderer, scene, camera, bottle, halo, pool, shadow, dust, rims: [rimL, rimR] };
}

// A dark "photo studio" rendered into an environment map: two tall strip softboxes, a top box and a
// back rim panel. Glossy surfaces reflect them as the long highlights you see in product shots.
function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x060606, side: THREE.BackSide })));
  const panel = (w, h, intensity, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(1.4, 9, 7, [-5, 1, 2.5]);
  panel(1.0, 9, 4, [5, 0.5, 1.5]);
  panel(7, 2, 2.5, [0, 7, 0]);
  panel(8, 3, 0.6, [0, -1, 7]);
  panel(2.5, 7, 2, [0, 1, -6]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Fine dust drifting through the light — reads as atmosphere without competing with the text.
function makeDust(count, map) {
  const rand = (a, b) => a + Math.random() * (b - a);
  const pos = new Float32Array(count * 3);
  const base = Array.from({ length: count }, () => ({ x: rand(-7, 7), y: rand(-4.5, 4.5), z: rand(-6, 2.5), v: rand(0.05, 0.18), p: rand(0, TAU) }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.035, map, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }),
  );
  const wrapY = (v) => ((((v + 4.5) % 9) + 9) % 9) - 4.5;
  return {
    points,
    update(dt, t, scroll) {
      base.forEach((d, i) => {
        d.y += d.v * dt;
        const depth = 0.4 + (d.z + 6) / 8.5; // nearer specks move more with scroll
        pos[i * 3] = d.x + Math.sin(t * 0.3 + d.p) * 0.2;
        pos[i * 3 + 1] = wrapY(d.y + scroll * 0.0009 * depth);
        pos[i * 3 + 2] = d.z;
      });
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------- variants / theme */

let currentVariant = null;
let currentSize = 250;
const WHITE = new THREE.Color(1, 1, 1);
const glowColor = new THREE.Color(VARIANTS.aloe.glow);
const glowTarget = new THREE.Color(VARIANTS.aloe.glow);

function applyVariant(id) {
  if (id === currentVariant) return;
  currentVariant = id;
  const v = VARIANTS[id];
  for (const [k, val] of Object.entries(v.css)) root.style.setProperty(`--${k}`, val);
  root.dataset.variant = id;
  glowTarget.set(v.glow);
  gl?.bottle.setVariant(v);
  $$('[data-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pick === id)));
  $('#shop-variant').textContent = v.name;
}

function applySize(ml) {
  currentSize = ml;
  const s = SIZES[ml];
  $$('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.size === ml)));
  $$('.js-price').forEach((el) => (el.textContent = s.price));
  gl?.bottle.setSize(s.label);
}

/* ------------------------------------------------------ scroll → keyframes */

let keyframes = [];
const ranges = { design: { start: 0, end: 1 }, scents: { start: 0, end: 1 } };
let maxScroll = 1;
let halfW = 1;
let compact = compactQuery.matches;

function measure() {
  const vh = innerHeight;
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  keyframes = [];
  for (const el of $$('[data-pose], [data-pose-start]')) {
    const t = top(el);
    if (el.dataset.poseStart) {
      keyframes.push({ at: t, pose: POSES[el.dataset.poseStart] });
      keyframes.push({ at: t + el.offsetHeight - vh, pose: POSES[el.dataset.poseEnd], linear: true });
    } else {
      // Desktop: pose lands when the section is centred. Compact: sections are taller than the
      // screen with the copy starting below the bottle, so land the pose at the section top.
      keyframes.push({ at: compact ? t : t + (el.offsetHeight - vh) / 2, pose: POSES[el.dataset.pose] });
    }
  }
  keyframes.sort((a, b) => a.at - b.at);
  for (const id of Object.keys(ranges)) {
    const el = document.getElementById(id);
    const t = top(el);
    ranges[id] = { start: t, end: t + el.offsetHeight - vh };
  }
  maxScroll = Math.max(1, root.scrollHeight - vh);
}

function samplePose(out, y) {
  const k = keyframes;
  if (!k.length) return Object.assign(out, POSES.hero);
  let i = 0;
  while (i < k.length - 1 && y >= k[i + 1].at) i++;
  const a = k[i];
  const b = k[Math.min(i + 1, k.length - 1)];
  let t = a === b || y <= a.at ? 0 : clamp((y - a.at) / Math.max(1, b.at - a.at), 0, 1);
  if (!b.linear) t = t * t * (3 - 2 * t); // smoothstep between sections; linear inside pinned ones
  for (const key of KEYS) out[key] = a.pose[key] + (b.pose[key] - a.pose[key]) * t;
  return out;
}

function resize() {
  compact = compactQuery.matches;
  if (gl) {
    gl.renderer.setSize(innerWidth, innerHeight, false);
    gl.camera.aspect = innerWidth / innerHeight;
    gl.camera.updateProjectionMatrix();
    const visibleH = 2 * gl.camera.position.z * Math.tan(THREE.MathUtils.degToRad(gl.camera.fov / 2));
    halfW = (visibleH * gl.camera.aspect) / 2;
  }
  measure();
}

/* ------------------------------------------------------------ DOM updates */

const ui = {
  nav: $('.nav'),
  bar: $('#progress-bar'),
  spin: $('#design'),
  deg: $('#deg'),
  callouts: $$('.callout'),
  scents: $$('.scent'),
  scentNav: $$('[data-scent-go]'),
  fades: $$('[data-fade]'),
};
let lastDeg = -1;
let lastScent = -1;

function updateUI(y) {
  ui.bar.style.transform = `scaleX(${clamp(y / maxScroll, 0, 1)})`;
  ui.nav.classList.toggle('is-scrolled', y > 40);

  // 360° section: degree counter, ring and callouts follow the pinned scroll progress.
  const d = ranges.design;
  const pd = clamp((y - d.start) / Math.max(1, d.end - d.start), 0, 1);
  const deg = Math.round(pd * 360);
  if (deg !== lastDeg) {
    lastDeg = deg;
    ui.deg.textContent = deg;
    ui.spin.style.setProperty('--p', pd.toFixed(4));
    ui.callouts.forEach((c) => c.classList.toggle('is-active', pd >= +c.dataset.from && pd < +c.dataset.to));
  }

  // Scents section: each third of the pinned scroll selects a scent. Before it the page shows the
  // first scent; after it, the last one (or the shopper's pick) sticks.
  const s = ranges.scents;
  if (y < s.start) {
    setScent(0);
  } else if (y <= s.end + innerHeight * 0.3) {
    const ps = clamp((y - s.start) / Math.max(1, s.end - s.start), 0, 0.999);
    setScent(Math.floor(ps * VARIANT_ORDER.length));
  }

  // Section text fades in as it arrives and out as it leaves, so only one section's copy is ever
  // on screen while the bottle travels between poses.
  const vh = innerHeight;
  for (const el of ui.fades) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -vh || r.top > 2 * vh) continue;
    const enter = clamp((vh * 0.92 - r.top) / (vh * 0.4), 0, 1);
    const exit = clamp((r.bottom - vh * 0.08) / (vh * 0.4), 0, 1);
    el.style.opacity = Math.min(enter, exit).toFixed(3);
  }
}

function setScent(i) {
  if (i === lastScent) return;
  lastScent = i;
  ui.scents.forEach((el, j) => el.classList.toggle('is-active', j === i));
  ui.scentNav.forEach((el, j) => el.setAttribute('aria-current', String(j === i)));
  applyVariant(VARIANT_ORDER[i]);
}

/* ---------------------------------------------------------- interactions */

let lenis = null;
if (!reduceMotion) {
  try {
    const { default: Lenis } = await import('lenis');
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  } catch (err) {
    console.warn('Smooth scrolling unavailable; using native scroll.', err);
  }
}
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' }));

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    scrollToY(el.getBoundingClientRect().top + scrollY);
  }),
);

// Jump to the middle of the chosen scent's third of the pinned scroll.
ui.scentNav.forEach((b) =>
  b.addEventListener('click', () => {
    const s = ranges.scents;
    scrollToY(s.start + ((+b.dataset.scentGo + 0.5) / VARIANT_ORDER.length) * (s.end - s.start));
  }),
);

$$('[data-pick]').forEach((b) => b.addEventListener('click', () => applyVariant(b.dataset.pick)));
$$('[data-size]').forEach((b) => b.addEventListener('click', () => applySize(+b.dataset.size)));

const toast = $('#toast');
const bagCount = $('#bag-count');
let bag = 0;
let toastTimer;
$('#add-to-cart').addEventListener('click', () => {
  bag += 1;
  bagCount.textContent = bag;
  bagCount.parentElement.classList.remove('bump');
  void bagCount.offsetWidth; // restart the bump animation
  bagCount.parentElement.classList.add('bump');
  toast.textContent = `Added ${VARIANTS[currentVariant].name} · ${currentSize} ml to your bag`;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
});

// Magnetic buttons: drift a little toward the cursor (mouse/trackpad only).
if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });
}

const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener(
  'pointermove',
  (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  },
  { passive: true },
);

// Headlines rise word by word: wrap each word in a clipping mask (keeps <em>/<br> intact).
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(' ');
            continue;
          }
          const mask = document.createElement('span');
          mask.className = 'w';
          const word = document.createElement('span');
          word.textContent = part;
          word.style.setProperty('--i', i++);
          mask.append(word);
          frag.append(mask);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
}
$$('[data-split]').forEach(splitWords);

const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }),
  { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
);
$$('.reveal, [data-split]').forEach((el) => io.observe(el));

addEventListener('resize', resize);
new ResizeObserver(measure).observe(document.body); // late fonts shift section offsets

/* ------------------------------------------------------------- main loop */

const target = { ...POSES.hero };
const cur = { ...POSES.hero };
let first = true;
let last = performance.now();
let elapsed = 0;
let introStart = Infinity;

function frame(now) {
  lenis?.raf(now);
  const dt = Math.min((now - last) / 1000, 0.1); // cap so returning to a background tab doesn't jump
  last = now;
  elapsed += dt;
  const y = scrollY;
  updateUI(y);

  if (gl) {
    samplePose(target, y);
    if (first) {
      Object.assign(cur, target);
      first = false;
    }
    // Exponential damping gives the bottle a little inertia behind the scroll.
    const k = 1 - Math.exp(-dt * (reduceMotion ? 30 : 5));
    for (const key of KEYS) cur[key] += (target[key] - cur[key]) * k;
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;

    // Entrance: the bottle rises and unwinds into place after the loader lifts.
    const intro = reduceMotion ? 1 : easeOut(clamp((elapsed - introStart) / 1.8, 0, 1));
    const float = reduceMotion ? 0 : Math.sin(elapsed * 1.1) * 0.05;
    // Compact (phone / portrait) layout: bottle centred in the upper half, text cards below.
    const scale = cur.s * SIZES[currentSize].scale * (compact ? 0.58 : 1) * (0.85 + 0.15 * intro);
    const x = compact ? 0 : cur.x * halfW;
    const yOff = compact ? 0.85 : 0;
    const by = cur.y + float + yOff - (1 - intro) * 0.8;

    const g = gl.bottle.group;
    g.position.set(x, by, 0);
    g.rotation.set(cur.rx + pointer.sy * 0.08, cur.ry + pointer.sx * 0.25 - (1 - intro) * 1.6, cur.rz + (reduceMotion ? 0 : Math.sin(elapsed * 0.7) * 0.02));
    g.scale.setScalar(scale);

    const floorY = -1.95 * (compact ? 0.58 : 1) + yOff;
    gl.halo.position.set(x * 0.85, by + 0.2, -3.5);
    gl.pool.position.set(x, floorY - 0.01, 0);
    gl.pool.scale.setScalar(scale);
    gl.shadow.position.set(x, floorY, 0);
    gl.shadow.scale.setScalar(scale * (1 - float));
    gl.halo.material.opacity = 0.5 * intro;
    gl.pool.material.opacity = 0.45 * intro;
    gl.shadow.material.opacity = intro;

    glowColor.lerp(glowTarget, 1 - Math.exp(-dt * 3));
    gl.halo.material.color.copy(glowColor);
    gl.pool.material.color.copy(glowColor);
    gl.rims.forEach((l) => l.color.copy(glowColor).lerp(WHITE, 0.35));

    gl.bottle.update(dt);
    gl.dust.update(dt, elapsed, y);
    gl.renderer.render(gl.scene, gl.camera);
  }
  requestAnimationFrame(frame);
}

applyVariant('aloe');
applySize(250);
resize();
requestAnimationFrame(frame);

// Debug hook (?debug): the bottle's on-screen bounding box, used by the layout overlap check.
if (new URLSearchParams(location.search).has('debug') && gl) {
  window.__nira = {
    bottleRect() {
      const box = new THREE.Box3().setFromObject(gl.bottle.group, true); // precise: from vertices
      const xs = [];
      const ys = [];
      for (const cx of [box.min.x, box.max.x])
        for (const cy of [box.min.y, box.max.y])
          for (const cz of [box.min.z, box.max.z]) {
            const p = new THREE.Vector3(cx, cy, cz).project(gl.camera);
            xs.push(((p.x + 1) / 2) * innerWidth);
            ys.push(((1 - p.y) / 2) * innerHeight);
          }
      return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    },
  };
}

/* --------------------------------------------------------------- loader */

const loaderNum = $('#loader-num');
const t0 = performance.now();
const LOADER_MS = reduceMotion ? 0 : 1100;
(function count() {
  const p = LOADER_MS ? Math.min(1, (performance.now() - t0) / LOADER_MS) : 1;
  loaderNum.textContent = String(Math.round(easeOut(p) * 100)).padStart(3, '0');
  if (p < 1) requestAnimationFrame(count);
})();

// Canvas labels need the web fonts; redraw once they're in, then lift the loader.
const fontsReady = Promise.all([
  document.fonts.load('400 100px "Instrument Serif"'),
  document.fonts.load('italic 400 100px "Instrument Serif"'),
  document.fonts.load('600 30px Inter'),
  document.fonts.load('400 30px Inter'),
]);
await Promise.all([
  new Promise((r) => setTimeout(r, LOADER_MS)),
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]),
]);
gl?.bottle.redraw();
measure();
root.classList.add('is-ready');
introStart = elapsed + 0.35; // let the loader curtain start moving first
