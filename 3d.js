/* Открытки — 3D scenes rendered with Three.js (physically based materials, studio reflections, soft shadows).
   A scene is rendered once per card+size into a transparent canvas and cached; cards.js composites it
   between the 2D background and the text. Loaded on demand (only when a 3D style is used). */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const CW = 1080, CH = 1350, VH = 3.75, VW = VH * CW / CH; // visible half-height/width at z=0 (camera z=14, fov 30)
let renderer, envTex, font = null, fontP = null;
const cache = new Map(), MAX = 10;

function init(){
  if(renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
}
function loadFont(){
  if(font) return Promise.resolve(font);
  if(!fontP) fontP = new Promise((res, rej) => new FontLoader().load("https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json", f => { font = f; res(f); }, undefined, rej));
  return fontP;
}
/* card pixel coords -> world (z = 0 plane) */
const wx = x => (x / CW - .5) * 2 * VW, wy = y => VH - y / CH * 2 * VH;

/* ---------- materials ---------- */
const M = {
  glossy: (c, r = .16) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: .05, clearcoat: 1, clearcoatRoughness: .04 }),
  metal: (c, r = .2) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 1, roughness: r }),
  glitter: c => new THREE.MeshPhysicalMaterial({ color: c, metalness: .9, roughness: .5, clearcoat: .6, clearcoatRoughness: .3 }),
  satin: c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .42, sheen: 1, sheenRoughness: .35, sheenColor: new THREE.Color("#ffffff") }),
  matte: c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 }),
  glass: (c = "#ffffff") => new THREE.MeshPhysicalMaterial({ color: c, transmission: 1, ior: 2.2, thickness: .6, roughness: 0, metalness: 0, specularIntensity: 1, envMapIntensity: 2.2 })
};
const GOLD = "#e7b65a", SILVER = "#dfe3ea", ROSE = "#e9a495";
function heartShape(s){ const h = new THREE.Shape(); h.moveTo(0, -s * .9); h.bezierCurveTo(-s * .35, -s * .55, -s * 1.1, -s * .15, -s * 1, s * .35); h.bezierCurveTo(-s * .9, s * .95, -s * .15, s * 1.05, 0, s * .5); h.bezierCurveTo(s * .15, s * 1.05, s * .9, s * .95, s * 1, s * .35); h.bezierCurveTo(s * 1.1, -s * .15, s * .35, -s * .55, 0, -s * .9); return h; }
function starShape(R, k = .45){ const s = new THREE.Shape(); for(let i = 0; i < 10; i++){ const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * k : R; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; }
const extrude = (shape, depth, bevel) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 6, curveSegments: 24 }); g.center(); return g; };
function floor(scene, y, op = .28){ const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: op })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); }
function keyLight(scene, x = -4, y = 7, z = 8, i = 2.2, shadow = true){
  const d = new THREE.DirectionalLight("#ffffff", i); d.position.set(x, y, z); d.castShadow = shadow;
  if(shadow){ d.shadow.mapSize.set(1024, 1024); const s = d.shadow.camera; s.left = -6; s.right = 6; s.top = 6; s.bottom = -6; s.near = 1; s.far = 30; d.shadow.radius = 6; d.shadow.bias = -.0004; }
  scene.add(d); scene.add(new THREE.HemisphereLight("#ffffff", "#444466", .35));
}
const add = (scene, geo, mat, x, y, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
function ornament(scene, x, top, len, R, mat, capMat){
  add(scene, new THREE.CylinderGeometry(.007, .007, len, 6), M.metal("#f3d9a0", .3), x, top - len / 2, 0, false);
  const cy = top - len - R * .95;
  add(scene, new THREE.SphereGeometry(R, 64, 48), mat, x, cy);
  add(scene, new THREE.CylinderGeometry(R * .24, R * .24, R * .22, 32), capMat, x, cy + R * .98);
  const ring = add(scene, new THREE.TorusGeometry(R * .09, R * .025, 12, 24), capMat, x, cy + R * 1.14); ring.rotation.y = Math.PI / 2;
}

/* ---------- scenes ---------- */
const SCENES = {
  baubles3d(scene, r, p){
    keyLight(scene, -3, 6, 9, 2.4, false);
    const needle = new THREE.CylinderGeometry(.006, .014, .42, 4), nm = new THREE.MeshStandardMaterial({ color: "#1f5a3a", roughness: .7 });
    const N = 1100, inst = new THREE.InstancedMesh(needle, nm, N), o = new THREE.Object3D(), col = new THREE.Color();
    for(let i = 0; i < N; i++){ const t = r(), x = -VW * 1.1 + t * VW * 2.2, y = VH - .05 + Math.sin(t * 7) * .1 + (r() - .5) * .25;
      o.position.set(x, y, (r() - .5) * .6); o.rotation.set((r() - .5) * 2.4, r() * 6, Math.PI / 2 + (r() - .5) * 2.6); o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, col.set(["#1b4d33", "#2c6b45", "#3f8a58", "#173f2b"][i % 4])); }
    scene.add(inst);
    const xs = [-2.45, -1.55, -.6, .45, 1.45, 2.4], ls = [.35, 1.35, .15, 1.05, .45, 1.55], rs = [.5, .44, .62, .5, .56, .42];
    xs.forEach((x, i) => { const kind = (i + p.k) % 3, c = p.b[i % p.b.length]; ornament(scene, x + (r() - .5) * .12, VH - .15, ls[i] + r() * .15, rs[i], kind === 0 ? M.glossy(c) : kind === 1 ? M.metal(c, .12) : M.glitter(c), M.metal(GOLD, .25)); });
    for(let i = 0; i < 9; i++) add(scene, new THREE.SphereGeometry(.07, 24, 16), M.metal(GOLD, .15), -VW + i * VW / 4 + (r() - .5) * .3, VH - .18 + (r() - .5) * .15, .25, false);
  },
  gifts3d(scene, r, p){
    keyLight(scene, -4, 8, 7, 2.6, true); floor(scene, -VH + .55, .3);
    const fy = -VH + .55;
    const box = (x, w, h, d, ry, c, rib) => { const g = new THREE.Group(); scene.add(g); g.position.set(x, fy, 0); g.rotation.y = ry;
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, .05), M.glossy(c, .32)); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
      const lid = new THREE.Mesh(new RoundedBoxGeometry(w * 1.06, h * .2, d * 1.06, 4, .04), M.glossy(c, .28)); lid.position.y = h * .92; lid.castShadow = true; g.add(lid);
      const rm = M.satin(rib);
      [[w * 1.08, h * 1.04, d * .14], [w * .14, h * 1.04, d * 1.08]].forEach(([a, b2, c2]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(a, b2, c2), rm); s.position.y = h * .52; g.add(s); });
      [-1, 1].forEach(dd => { const t = new THREE.Mesh(new THREE.TorusGeometry(w * .17, w * .05, 16, 40), rm); t.scale.set(1, .65, 1); t.position.set(dd * w * .16, h * 1.08 + w * .06, 0); t.rotation.set(0, 0, dd * .5); t.castShadow = true; g.add(t); });
      const k = new THREE.Mesh(new THREE.SphereGeometry(w * .07, 24, 16), rm); k.position.y = h * 1.05; g.add(k); };
    box(0, 1.75, 1.35, 1.5, .35, p.g[0], p.g[1]); box(-1.85, 1.15, 1.05, 1.15, -.45, p.g[2], p.g[3]); box(1.9, 1.25, .85, 1.1, .6, p.g[4], p.g[5]);
    for(let i = 0; i < 8; i++){ const s = add(scene, new THREE.SphereGeometry(.09 + r() * .07, 24, 16), M.metal(i % 2 ? GOLD : SILVER, .12), (r() - .5) * 5.4, fy + .1, (r() - .2) * 1.6); s.position.y = fy + .1; }
  },
  balloons3d(scene, r, p){
    keyLight(scene, -3, 6, 9, 2.2, false);
    const pts = [[-2.3, 2.45], [-1.2, 2.85], [-.2, 2.35], [.9, 2.9], [2.0, 2.5], [-1.65, 1.75], [1.4, 1.7], [.3, 1.55]];
    pts.forEach(([x, y], i) => { const R = .55 + r() * .12, c = p.b[i % p.b.length], foil = (i + p.k) % 3 === 0;
      const s = add(scene, new THREE.SphereGeometry(R, 64, 48), foil ? M.metal(c, .14) : M.glossy(c, .1), x + (r() - .5) * .2, y, (r() - .5) * 1.2, false); s.scale.set(1, 1.18, 1);
      add(scene, new THREE.ConeGeometry(R * .14, R * .22, 16), foil ? M.metal(c, .2) : M.glossy(c), s.position.x, y - R * 1.2, s.position.z, false).rotation.x = Math.PI;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s.position.x, y - R * 1.3, s.position.z), new THREE.Vector3(s.position.x + .2, y - R * 2, s.position.z), new THREE.Vector3(s.position.x - .15, y - R * 2.8, s.position.z), new THREE.Vector3(s.position.x + .05, .6, s.position.z)]);
      add(scene, new THREE.TubeGeometry(curve, 40, .008, 6), M.glossy(p.str || "#ffffff"), 0, 0, 0, false); });
  },
  hearts3d(scene, r, p){
    keyLight(scene, -3, 5, 9, 2.4, false);
    const spots = [[-2.2, 2.9, .7], [2.3, 2.7, .6], [-.1, 3.05, .42], [-2.5, .9, .45], [2.55, .6, .5], [-2.1, -2.6, .62], [2.2, -2.8, .75], [0, -3.05, .45], [-.95, 2.35, .32], [1.1, 2.2, .35], [-1.1, -2.2, .3], [1.15, -2.3, .34]];
    spots.forEach(([x, y, s], i) => { const kind = (i + p.k) % 3; const m = add(scene, extrude(heartShape(s), s * .45, s * .22), kind === 0 ? M.glossy(p.h[i % p.h.length], .12) : kind === 1 ? M.metal(i % 2 ? GOLD : ROSE, .16) : M.glossy(p.h[(i + 1) % p.h.length], .2), x, y, (r() - .5) * 1.4, false);
      m.rotation.set((r() - .5) * .6, (r() - .5) * 1.1, (r() - .5) * .7); });
  },
  async numbers3d(scene, r, p, c){
    keyLight(scene, -3, 5, 9, 2.6, false);
    const f = await loadFont(); const now = new Date();
    const txt = c.h === "mar8" ? "8" : c.h === "feb23" ? "23" : c.h === "sep1" ? "1" : String(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear());
    const g = new TextGeometry(txt, { font: f, size: txt.length > 2 ? 1.25 : 1.9, height: .5, curveSegments: 14, bevelEnabled: true, bevelThickness: .07, bevelSize: .05, bevelSegments: 6 }); g.center();
    const t = add(scene, g, M.metal(p.num || GOLD, .18), 0, 2.05, 0, false); t.rotation.x = -.08; t.rotation.y = .12;
    for(let i = 0; i < 26; i++){ const a = r() * Math.PI * 2, d = 1.7 + r() * 1.6, x = Math.cos(a) * d * 1.05, y = 2.05 + Math.sin(a) * d * .55; if(Math.abs(x) > VW - .2) continue;
      if(i % 3 === 0){ const s = add(scene, extrude(starShape(.14 + r() * .12), .06, .03), M.metal(i % 2 ? GOLD : SILVER, .2), x, y, (r() - .5) * 1.5, false); s.rotation.set(r(), r(), r()); }
      else add(scene, new THREE.SphereGeometry(.05 + r() * .08, 24, 16), M.metal([GOLD, SILVER, p.acc || ROSE][i % 3], .12), x, y, (r() - .5) * 1.5, false); }
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => new THREE.Vector3(-2.9 + i * .72, .55 + Math.sin(i * 1.3) * .25, Math.cos(i * 1.1) * .5)));
    add(scene, new THREE.TubeGeometry(curve, 120, .035, 10), M.metal(p.acc || ROSE, .25), 0, 0, 0, false);
  },
  stars3d(scene, r, p){
    keyLight(scene, -3, 5, 9, 2.6, false);
    const spots = [[-2.2, 2.8, .62], [2.25, 2.6, .5], [0, 3.05, .32], [-2.5, 0, .32], [2.5, -.2, .36], [-2.1, -2.7, .55], [2.2, -2.8, .66], [-.9, 2.3, .26], [1.05, 2.15, .28], [-.6, -3.0, .3], [.8, -2.9, .24]];
    spots.forEach(([x, y, s], i) => { const m = add(scene, extrude(starShape(s), s * .3, s * .14), M.metal(i % 3 === 2 ? SILVER : p.star || GOLD, .18), x, y, (r() - .5) * 1.2, false); m.rotation.set((r() - .5) * .7, (r() - .5) * .9, r() * 1.2); });
    for(let i = 0; i < 18; i++){ const x = (r() - .5) * 5.6, y = (r() > .5 ? 1 : -1) * (2 + r() * 1.5); add(scene, new THREE.SphereGeometry(.05 + r() * .07, 24, 16), M.glossy("#fbf7f0", .08), x, y, (r() - .5), false); }
  },
  cake3d(scene, r, p){
    keyLight(scene, -4, 8, 7, 2.4, true); floor(scene, -VH + .75, .25); scene.scale.setScalar(.86); scene.position.y = -.35;
    const fy = -VH + .75, cream = M.glossy(p.cream, .35);
    add(scene, new THREE.CylinderGeometry(2.05, 2.1, .12, 64), M.glossy("#ffffff", .2), 0, fy + .06);
    add(scene, new THREE.CylinderGeometry(1.55, 1.55, 1.0, 64), M.glossy(p.t1, .45), 0, fy + .62);
    add(scene, new THREE.TorusGeometry(1.52, .09, 16, 64), cream, 0, fy + 1.1).rotation.x = Math.PI / 2;
    add(scene, new THREE.CylinderGeometry(1.08, 1.08, .85, 64), M.glossy(p.t2, .45), 0, fy + 1.55);
    add(scene, new THREE.TorusGeometry(1.06, .08, 16, 64), cream, 0, fy + 1.97).rotation.x = Math.PI / 2;
    for(let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; add(scene, new THREE.SphereGeometry(.1, 20, 14), cream, Math.cos(a) * 1.5, fy + .2, Math.sin(a) * 1.5); }
    for(let i = 0; i < 7; i++){ const a = i / 7 * Math.PI * 2 + .3; add(scene, new THREE.SphereGeometry(.11, 24, 16), M.glossy(p.berry, .15), Math.cos(a) * .78, fy + 2.05, Math.sin(a) * .78); }
    const flames = [];
    [-.55, -.18, .18, .55].forEach((x, i) => { const z = i % 2 ? .25 : -.2; add(scene, new THREE.CylinderGeometry(.055, .055, .62, 20), M.glossy(p.cnd[i % p.cnd.length], .3), x, fy + 2.3, z);
      const fl = add(scene, new THREE.SphereGeometry(.07, 20, 14), new THREE.MeshBasicMaterial({ color: "#ffd27a" }), x, fy + 2.72, z, false); fl.scale.set(1, 1.9, 1); flames.push(fl);
      const pl = new THREE.PointLight("#ffb347", .9, 3); pl.position.copy(fl.position); scene.add(pl); });
    return { flames };
  },
  rings3d(scene, r, p){
    keyLight(scene, -3, 5, 9, 2.4, false);
    const a = add(scene, new THREE.TorusGeometry(.95, .17, 48, 128), M.metal(p.r1 || GOLD, .14), -.62, 1.95, 0, false); a.rotation.set(.25, .55, 0);
    const b = add(scene, new THREE.TorusGeometry(.95, .17, 48, 128), M.metal(p.r2 || ROSE, .14), .62, 1.95, 0, false); b.rotation.set(-.25, -.55, .1);
    add(scene, new THREE.CylinderGeometry(.16, .1, .16, 6), M.metal(p.r2 || ROSE, .2), .9, 2.92, .55, false);
    const gem = new THREE.LatheGeometry([new THREE.Vector2(0, -.3), new THREE.Vector2(.3, .02), new THREE.Vector2(.22, .14), new THREE.Vector2(0, .15)], 10);
    const gm = new THREE.MeshPhysicalMaterial({ color: "#f4fbff", metalness: .15, roughness: 0, flatShading: true, clearcoat: 1, envMapIntensity: 3.2, iridescence: .6, iridescenceIOR: 1.8 });
    const d = add(scene, gem, gm, .9, 3.22, .55, false); d.rotation.set(.35, .4, -.15);
    for(let i = 0; i < 16; i++){ const x = (r() - .5) * 5.6, y = (r() > .4 ? -1 : 1) * (2.3 + r() * 1.2); if(y > 0 && Math.abs(x) < 2) continue; add(scene, new THREE.SphereGeometry(.06 + r() * .08, 24, 16), M.glossy("#fbf7f0", .06), x, y, (r() - .5), false); }
  }
};

async function render(c, scale){
  init();
  const w = Math.round(CW * scale), h = Math.round(CH * scale);
  renderer.setSize(w, h, false);
  const scene = new THREE.Scene(); scene.environment = envTex;
  const cam = new THREE.PerspectiveCamera(30, CW / CH, .1, 100); cam.position.set(0, 0, 14); cam.lookAt(0, 0, 0);
  const d = DESIGNS[c.d], p = d ? d.pals[(c.p || 0) % d.pals.length] : {};
  const r = rng32((c.s || 1) * 7 + 3);
  const extra = (await SCENES[d.scene](scene, r, p, c)) || {};
  renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
  const out = document.createElement("canvas"); out.width = w; out.height = h; out.getContext("2d").drawImage(renderer.domElement, 0, 0);
  if(extra.flames){ scene.updateMatrixWorld(true); out.flames = extra.flames.map(m => { const q = m.getWorldPosition(new THREE.Vector3()).project(cam); return [(q.x + 1) / 2 * CW, (1 - q.y) / 2 * CH]; }); }
  scene.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material) [].concat(o.material).forEach(m => m.dispose()); });
  return out;
}
const keyOf = (c, scale) => [c.d, c.p || 0, c.s || 1, c.h, scale >= .6 ? "L" : "S"].join("|");
let queue = Promise.resolve();
window.Card3D = {
  /* frees the GPU (e.g. before recording a video); the next render re-creates the renderer */
  release(){ if(renderer){ renderer.dispose(); renderer.forceContextLoss(); renderer = null; envTex = null; } },
  get(c, wantLarge = true){ return cache.get(keyOf(c, wantLarge ? 1 : .3)) || cache.get(keyOf(c, wantLarge ? .3 : 1)) || null; },
  prepare(c, scale = 1){
    const k = keyOf(c, scale); if(cache.has(k)) return Promise.resolve(cache.get(k));
    const job = queue.then(async () => { if(cache.has(k)) return cache.get(k); const img = await render(c, scale >= .6 ? 1 : .3);
      cache.set(k, img); if(cache.size > MAX) cache.delete(cache.keys().next().value); return img; });
    queue = job.catch(() => {}); return job;
  }
};
