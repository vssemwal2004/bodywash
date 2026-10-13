import * as THREE from 'three';

// World-unit dimensions. The label radius sits just outside the body to avoid z-fighting.
const BODY_R = 0.66;
const LABEL_R = BODY_R + 0.006;
const LABEL_H = 1.4;
const LABEL_Y = -0.28;
const FRONT_ARC = 2.3; // radians of the circumference the front label wraps
const BACK_ARC = 2.0;
const TAU = Math.PI * 2;

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = 'Inter, system-ui, sans-serif';

/**
 * A procedural pump bottle — no external model required.
 * To use a real product scan instead, load a .glb with GLTFLoader and add it to `group`
 * (see README). The rest of the page only talks to `group`, `setVariant`, `setSize`, `update`.
 */
export function createBottle(renderer) {
  const group = new THREE.Group();
  const model = new THREE.Group();
  model.position.y = -0.2; // centre the body + pump silhouette on the group origin
  group.add(model);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: '#79ae8f',
    roughness: 0.38, // satin base…
    metalness: 0,
    clearcoat: 1, // …under a glossy coat, so the studio softboxes read as crisp streaks
    clearcoatRoughness: 0.04,
  });
  const capMat = new THREE.MeshPhysicalMaterial({ color: '#f3efe7', roughness: 0.4, metalness: 0, clearcoat: 0.5 });

  model.add(new THREE.Mesh(new THREE.LatheGeometry(bodyProfile().getPoints(16), 128), bodyMat));
  addPump(model, capMat);

  const front = makeLabel(1100, 1000, -FRONT_ARC / 2, FRONT_ARC);
  const back = makeLabel(950, 1000, Math.PI - BACK_ARC / 2, BACK_ARC);
  model.add(front.mesh, back.mesh);

  function makeLabel(w, h, thetaStart, thetaLength) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.5,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      alphaTest: 0.5, // the canvas has rounded corners; cut them out of the cylinder patch
    });
    const geo = new THREE.CylinderGeometry(LABEL_R, LABEL_R, LABEL_H, 96, 1, true, thetaStart, thetaLength);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = LABEL_Y;
    return { mesh, texture, ctx: canvas.getContext('2d') };
  }

  const target = { body: new THREE.Color(), cap: new THREE.Color(), capMetal: 0 };
  let variant = null;
  let sizeLabel = '250 ML  ·  8.4 FL OZ';

  function redraw() {
    if (!variant) return;
    drawFront(front.ctx, variant, sizeLabel);
    drawBack(back.ctx, variant, sizeLabel);
    front.texture.needsUpdate = true;
    back.texture.needsUpdate = true;
  }

  return {
    group,
    redraw,
    setVariant(v) {
      variant = v;
      target.body.set(v.bottle);
      target.cap.set(v.cap);
      target.capMetal = v.capMetal;
      redraw();
    },
    setSize(label) {
      sizeLabel = label;
      redraw();
    },
    // Colours ease toward the active variant so scent changes feel like a dissolve, not a cut.
    update(dt) {
      const k = 1 - Math.exp(-dt * 4);
      bodyMat.color.lerp(target.body, k);
      capMat.color.lerp(target.cap, k);
      capMat.metalness += (target.capMetal - capMat.metalness) * k;
      capMat.roughness = 0.4 - 0.15 * capMat.metalness;
    },
  };
}

/* ------------------------------------------------------------------ geometry */

// Half-profile of the bottle (x = radius, y = height), spun around Y by LatheGeometry.
function bodyProfile() {
  const p = new THREE.Path();
  p.moveTo(0, -1.25);
  p.lineTo(BODY_R - 0.16, -1.25);
  p.quadraticCurveTo(BODY_R, -1.25, BODY_R, -1.09);
  p.lineTo(BODY_R, 0.5);
  p.quadraticCurveTo(BODY_R, 0.98, 0.3, 1.06); // shoulder
  p.quadraticCurveTo(0.25, 1.07, 0.25, 1.12);
  p.lineTo(0.25, 1.26); // neck
  p.lineTo(0, 1.26);
  return p;
}

function addPump(model, mat) {
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.22, 64), mat);
  collar.position.y = 1.36;
  model.add(collar);

  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 8, 64), mat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 1.29 + i * 0.07;
    model.add(rib);
  }

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 32), mat);
  stem.position.y = 1.56;
  model.add(stem);

  const head = new THREE.Path();
  head.moveTo(0, 1.64);
  head.lineTo(0.2, 1.64);
  head.quadraticCurveTo(0.24, 1.64, 0.24, 1.69);
  head.lineTo(0.24, 1.74);
  head.quadraticCurveTo(0.24, 1.82, 0.12, 1.83);
  head.lineTo(0, 1.83);
  model.add(new THREE.Mesh(new THREE.LatheGeometry(head.getPoints(12), 64), mat));

  const nozzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 8, 24), mat);
  nozzle.rotation.z = -Math.PI / 2 - 0.05;
  nozzle.position.set(0.36, 1.755, 0);
  model.add(nozzle);
}

/* ------------------------------------------------------------------ labels */

function drawFront(ctx, v, sizeLabel) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = v.label;
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, 64);
  ctx.fill();

  ctx.strokeStyle = v.labelInk;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(40, 40, W - 80, H - 80, 44);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = v.labelInk;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 400 46px ${SERIF}`;
  ctx.fillText(`N°${v.no}`, W / 2, 125);
  ctx.font = `400 290px ${SERIF}`;
  ctx.fillText('NIRA', W / 2, 305);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(W / 2 - 60, 432, 120, 2);
  ctx.globalAlpha = 1;
  spaced(ctx, 'BOTANICAL BODY WASH', W / 2, 482, `600 28px ${SANS}`, 10);

  drawSprig(ctx, W / 2, 600, v.labelAccent, 0.75);

  ctx.fillStyle = v.labelInk;
  ctx.font = `italic 400 76px ${SERIF}`;
  ctx.fillText(v.name, W / 2, 730);
  spaced(ctx, v.claims, W / 2, 815, `500 24px ${SANS}`, 6);
  ctx.globalAlpha = 0.65;
  spaced(ctx, sizeLabel, W / 2, 870, `500 24px ${SANS}`, 6);
  ctx.globalAlpha = 1;
}

function drawBack(ctx, v, sizeLabel) {
  const { width: W, height: H } = ctx.canvas;
  const pad = 80;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = v.label;
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, 64);
  ctx.fill();

  ctx.fillStyle = v.labelInk;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  spaced(ctx, 'INGREDIENTS', pad, 140, `600 28px ${SANS}`, 8);
  ctx.font = `400 27px ${SANS}`;
  let y = wrap(ctx, v.inci, pad, 195, W - pad * 2, 40);

  ctx.globalAlpha = 0.3;
  ctx.fillRect(pad, y, W - pad * 2, 2);
  ctx.globalAlpha = 1;
  y += 60;

  spaced(ctx, 'DIRECTIONS', pad, y, `600 28px ${SANS}`, 8);
  ctx.font = `400 27px ${SANS}`;
  wrap(
    ctx,
    'Pump onto wet skin or a loofah, work into a lather and rinse well. For external use only. Avoid contact with eyes.',
    pad,
    y + 55,
    W - pad * 2,
    40,
  );

  drawBarcode(ctx, pad, H - 230, 300, 120, v.id);
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText('8 901234 567890', pad, H - 82);

  ctx.textAlign = 'right';
  ctx.font = `400 76px ${SERIF}`;
  ctx.fillText('NIRA', W - pad, H - 125);
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText(sizeLabel.split('·')[0].trim(), W - pad, H - 82);
}

function drawSprig(ctx, x, y, color, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 75);
  ctx.quadraticCurveTo(8, 0, 0, -70);
  ctx.stroke();
  const leaves = [[0, -70, 0], [2, -30, -0.85], [3, -25, 0.85], [4, 15, -0.95], [4, 20, 0.95]];
  for (const [lx, ly, a] of leaves) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -24, 12, 26, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Deterministic fake barcode so each variant's back label looks stable between redraws.
function drawBarcode(ctx, x, y, w, h, seed) {
  let s = [...seed].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let cx = x; cx < x + w; ) {
    const bw = 2 + Math.floor(rnd() * 4) * 2;
    if (rnd() > 0.35) ctx.fillRect(cx, y, bw, h);
    cx += bw + 3;
  }
}

function spaced(ctx, text, x, y, font, tracking) {
  ctx.font = font;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${tracking}px`;
    // letterSpacing adds trailing space after the last glyph; nudge centred text back.
    ctx.fillText(text, ctx.textAlign === 'center' ? x + tracking / 2 : x, y);
    ctx.letterSpacing = '0px';
  } else {
    ctx.fillText(text, x, y);
  }
}

function wrap(ctx, text, x, y, maxW, lineH) {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}
