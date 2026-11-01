/* Открытки — card engine. Every card is drawn procedurally on a 1080×1350 canvas, so no third-party images are used.
   A card is fully described by a small object {h: holiday, d: design, p: palette, s: seed, n: name, t: text, f: font, fr: from},
   which is what travels inside a shared link. */
"use strict";
const W = 1080, H = 1350, TAU = Math.PI * 2;

/* ---------- helpers ---------- */
function rng32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hexRgb(h){ const n = parseInt(h.slice(1, 7), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function rgba(h, a){ const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, k){ const c = hexRgb(h).map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))); return "#" + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join(""); }
function lin(ctx, x0, y0, x1, y1, stops){ const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / (stops.length - 1), s)); return g; }
function vbg(ctx, cols){ ctx.fillStyle = lin(ctx, 0, 0, 0, H, cols); ctx.fillRect(0, 0, W, H); }
function glow(ctx, x, y, r, col, a = .5){ const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
function vignette(ctx, a){ const g = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .85); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function rr(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const inside = (x, y, a, m = 0) => a && x > a[0] - m && x < a[0] + a[2] + m && y > a[1] - m && y < a[1] + a[3] + m;
const GOLD = ["#9a6b22", "#f6d38b", "#c8963e", "#fff1c1", "#a67c2e"];
const gold = (ctx, x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, GOLD);

function bokeh(ctx, r, n, col, rmin, rmax, a, avoid){
  for(let i = 0; i < n; i++){ const x = r() * W, y = r() * H, s = rmin + r() * (rmax - rmin); if(inside(x, y, avoid, 20)) continue; glow(ctx, x, y, s, col, a * (.4 + r() * .6)); }
}
function confetti(ctx, r, n, cols, box, size = 1, avoid){
  for(let i = 0; i < n; i++){
    const x = box[0] + r() * box[2], y = box[1] + r() * box[3]; if(inside(x, y, avoid, 30)) continue;
    const c = cols[i % cols.length], s = (12 + r() * 16) * size, t = r();
    ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU); ctx.fillStyle = c; ctx.strokeStyle = c;
    if(t < .45) ctx.fillRect(-s / 2, -s / 4, s, s / 2.2);
    else if(t < .72){ ctx.beginPath(); ctx.arc(0, 0, s / 3, 0, TAU); ctx.fill(); }
    else { ctx.lineWidth = s / 4.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s / 2, -s / 2, 0, 0); ctx.quadraticCurveTo(s / 2, s / 2, s, 0); ctx.stroke(); }
    ctx.restore();
  }
}
function sparkle(ctx, x, y, r, col){
  glow(ctx, x, y, r * 1.8, col, .35);
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.quadraticCurveTo(0, 0, 0, r); ctx.quadraticCurveTo(0, 0, -r, 0); ctx.quadraticCurveTo(0, 0, 0, -r); ctx.fill(); ctx.restore();
}
function sparkles(ctx, r, n, col, box, rmin, rmax, avoid){ for(let i = 0; i < n; i++){ const x = box[0] + r() * box[2], y = box[1] + r() * box[3]; if(inside(x, y, avoid, 10)) continue; sparkle(ctx, x, y, rmin + r() * (rmax - rmin), col); } }
function star5(ctx, x, y, R, col, rot = -Math.PI / 2){
  ctx.beginPath(); for(let i = 0; i < 10; i++){ const rad = i % 2 ? R * .42 : R, a = rot + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function stars(ctx, r, n, box, col = "#ffffff", avoid){ for(let i = 0; i < n; i++){ const x = box[0] + r() * box[2], y = box[1] + r() * box[3]; if(inside(x, y, avoid)) continue; ctx.fillStyle = rgba(col, .35 + r() * .65); ctx.beginPath(); ctx.arc(x, y, .8 + r() * 2.6, 0, TAU); ctx.fill(); } }

/* ---------- motifs ---------- */
function petals(ctx, n, len, wide, col, col2, off){
  for(let i = 0; i < n; i++){
    ctx.save(); ctx.rotate(off + i * TAU / n);
    const g = ctx.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, col2); g.addColorStop(1, col);
    ctx.fillStyle = g; const w = len * wide; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -len * .3, -w * .95, -len * .95, 0, -len); ctx.bezierCurveTo(w * .95, -len * .95, w, -len * .3, 0, 0); ctx.fill();
    ctx.restore();
  }
}
/* kind: rose | daisy | blossom */
function flower(ctx, x, y, R, col, kind = "rose", rot = 0, center){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = R * .18; ctx.shadowOffsetY = R * .06;
  if(kind === "daisy"){ petals(ctx, 16, R, .2, col, shade(col, -.12), 0); ctx.shadowColor = "transparent"; petals(ctx, 16, R * .82, .18, shade(col, .2), shade(col, -.05), TAU / 32); center = center || "#ffc93c"; }
  else if(kind === "blossom"){ petals(ctx, 5, R, .62, col, shade(col, .45), 0); center = center || "#ffd166"; }
  else {
    petals(ctx, 6, R, .72, shade(col, -.12), shade(col, -.35), 0); ctx.shadowColor = "transparent";
    petals(ctx, 5, R * .78, .74, col, shade(col, -.2), .5);
    petals(ctx, 4, R * .55, .78, shade(col, .12), shade(col, -.15), 1.1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * .32); g.addColorStop(0, shade(col, -.45)); g.addColorStop(1, shade(col, .05));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * .3, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -.5), .5); ctx.lineWidth = R * .035; ctx.beginPath(); ctx.arc(R * .03, R * .02, R * .17, .3, 4.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(-R * .02, 0, R * .08, 2, 6); ctx.stroke();
  }
  if(center){ ctx.shadowColor = "transparent"; const g = ctx.createRadialGradient(-R * .05, -R * .05, 0, 0, 0, R * .25); g.addColorStop(0, shade(center, .4)); g.addColorStop(1, shade(center, -.15)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * (kind === "daisy" ? .26 : .2), 0, TAU); ctx.fill(); }
  ctx.restore();
}
function leaf(ctx, x, y, len, ang, col){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = lin(ctx, 0, -len * .3, len, len * .3, [shade(col, -.2), shade(col, .18)]);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .45, -len * .36, len, 0); ctx.quadraticCurveTo(len * .45, len * .36, 0, 0); ctx.fill();
  ctx.strokeStyle = rgba("#ffffff", .22); ctx.lineWidth = Math.max(1.5, len * .02); ctx.beginPath(); ctx.moveTo(len * .05, 0); ctx.quadraticCurveTo(len * .5, -len * .04, len * .92, 0); ctx.stroke();
  ctx.restore();
}
/* a cluster of flowers + leaves around (cx, cy) */
function bouquet(ctx, r, cx, cy, R, n, cols, leafCol, kinds = ["rose"], size = 1){
  for(let i = 0; i < n * 1.6; i++){ const a = r() * TAU, d = R * (.55 + r() * .55); leaf(ctx, cx + Math.cos(a) * d * .5, cy + Math.sin(a) * d * .5, (90 + r() * 80) * size, a, leafCol); }
  const pts = []; for(let i = 0; i < n; i++){ const a = r() * TAU, d = Math.sqrt(r()) * R; pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, (62 + r() * 46) * size, cols[i % cols.length], kinds[i % kinds.length]]); }
  pts.sort((a, b) => a[1] - b[1]).forEach(p => flower(ctx, p[0], p[1], p[2], p[3], p[4], r() * TAU));
}
function balloon(ctx, x, y, R, col, r, str){
  ctx.strokeStyle = str; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + R * 1.2);
  ctx.bezierCurveTo(x + R * .35, y + R * 1.7, x - R * .35, y + R * 2.2, x + (r() - .5) * R * .5, y + R * 2.9); ctx.stroke();
  const g = ctx.createRadialGradient(x - R * .35, y - R * .45, R * .05, x, y, R * 1.25); g.addColorStop(0, shade(col, .6)); g.addColorStop(.35, col); g.addColorStop(1, shade(col, -.38));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R * .88, R * 1.06, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(col, -.25); ctx.beginPath(); ctx.moveTo(x, y + R * 1.02); ctx.lineTo(x - R * .12, y + R * 1.2); ctx.lineTo(x + R * .12, y + R * 1.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(x - R * .38, y - R * .45, R * .12, R * .26, -.5, 0, TAU); ctx.fill();
}
function heartPath(ctx, x, y, s){
  ctx.beginPath(); ctx.moveTo(x, y + s * .45);
  ctx.bezierCurveTo(x - s * .2, y + s * .3, x - s * .55, y + s * .05, x - s * .5, y - s * .18);
  ctx.bezierCurveTo(x - s * .45, y - s * .45, x - s * .08, y - s * .48, x, y - s * .22);
  ctx.bezierCurveTo(x + s * .08, y - s * .48, x + s * .45, y - s * .45, x + s * .5, y - s * .18);
  ctx.bezierCurveTo(x + s * .55, y + s * .05, x + s * .2, y + s * .3, x, y + s * .45); ctx.closePath();
}
function heart(ctx, x, y, s, col, rot = 0){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(-s * .2, -s * .2, s * .05, 0, 0, s * .7); g.addColorStop(0, shade(col, .45)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.3));
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = s * .12; ctx.shadowOffsetY = s * .05;
  heartPath(ctx, 0, 0, s); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.ellipse(-s * .25, -s * .2, s * .07, s * .13, -.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function snowflake(ctx, x, y, R, col, lw){
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round";
  for(let i = 0; i < 6; i++){ ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R);
    ctx.moveTo(0, -R * .55); ctx.lineTo(-R * .25, -R * .78); ctx.moveTo(0, -R * .55); ctx.lineTo(R * .25, -R * .78);
    ctx.moveTo(0, -R * .3); ctx.lineTo(-R * .15, -R * .44); ctx.moveTo(0, -R * .3); ctx.lineTo(R * .15, -R * .44); ctx.stroke(); }
  ctx.restore();
}
function cloud(ctx, x, y, s, col, a = 1){
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col;
  [[0, 0, 1], [-.95, .25, .7], [.95, .28, .66], [-.45, -.42, .74], [.48, -.36, .7], [0, .38, .8]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, k * s, 0, TAU); ctx.fill(); });
  ctx.restore();
}
function bunting(ctx, y0, sag, cols, x0 = -30, x1 = W + 30, fh = 110, fw = 84){
  const q = t => { const mx = (x0 + x1) / 2, my = y0 + sag * 2; const u = 1 - t; return [u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y0]; };
  ctx.strokeStyle = "rgba(90,60,60,.55)"; ctx.lineWidth = 3; ctx.beginPath(); for(let t = 0; t <= 1.001; t += .02){ const [x, y] = q(t); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  const n = Math.round((x1 - x0) / (fw * 1.2));
  for(let i = 0; i < n; i++){ const [x, y] = q((i + .5) / n); ctx.fillStyle = lin(ctx, x - fw / 2, y, x + fw / 2, y + fh, [cols[i % cols.length], shade(cols[i % cols.length], -.18)]);
    ctx.shadowColor = "rgba(0,0,0,.15)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.moveTo(x - fw / 2, y); ctx.lineTo(x + fw / 2, y); ctx.lineTo(x, y + fh); ctx.closePath(); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(x, y + fh * .3, fw * .1, 0, TAU); ctx.fill(); }
}
function gift(ctx, x, y, w, h, col, rib){
  ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
  ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [shade(col, -.22), col, shade(col, -.12)]); ctx.fillRect(x, y, w, h); ctx.shadowColor = "transparent";
  ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [shade(col, -.1), shade(col, .2), shade(col, -.05)]); ctx.fillRect(x - w * .05, y - h * .2, w * 1.1, h * .22);
  ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [shade(rib, -.15), rib, shade(rib, -.1)]); ctx.fillRect(x + w * .44, y - h * .2, w * .12, h * 1.2);
  const bx = x + w / 2, by = y - h * .2;
  ctx.fillStyle = rib; [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(bx + d * w * .16, by - w * .07, w * .17, w * .09, d * -.5, 0, TAU); ctx.fill(); });
  ctx.fillStyle = shade(rib, -.2); ctx.beginPath(); ctx.arc(bx, by, w * .055, 0, TAU); ctx.fill();
}
function cake(ctx, r, cx, base, w, p){
  ctx.fillStyle = lin(ctx, cx - w * .7, 0, cx + w * .7, 0, ["#d9d9e3", "#ffffff", "#cfd0dc"]); ctx.beginPath(); ctx.ellipse(cx, base, w * .7, 36, 0, 0, TAU); ctx.fill();
  let y = base - 6;
  [[w, 200, p.cake], [w * .7, 160, p.cake2]].forEach(([tw, th, cols], ti) => {
    const x = cx - tw / 2, top = y - th;
    ctx.fillStyle = lin(ctx, x, 0, x + tw, 0, [shade(cols[1], -.1), cols[0], cols[1]]); ctx.beginPath(); ctx.rect(x, top, tw, th); ctx.ellipse(cx, y, tw / 2, 24, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = p.icing; ctx.fillRect(x, top, tw, 34);
    const k = ti ? 7 : 9; for(let j = 0; j < k; j++){ const dx = x + tw * (j + .5) / k, dl = 30 + r() * 46, dw = tw / k * .5; ctx.fillRect(dx - dw / 2, top + 20, dw, dl); ctx.beginPath(); ctx.arc(dx, top + 20 + dl, dw / 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = lin(ctx, x, 0, x + tw, 0, [shade(p.icing, -.06), p.icing, shade(p.icing, -.08)]); ctx.beginPath(); ctx.ellipse(cx, top, tw / 2, 24, 0, 0, TAU); ctx.fill();
    for(let j = 0; j < (ti ? 8 : 11); j++){ const dx = x + 26 + (tw - 52) * j / (ti ? 7 : 10); ctx.fillStyle = p.dots[j % p.dots.length]; ctx.beginPath(); ctx.arc(dx, top + th * .66, 9, 0, TAU); ctx.fill(); }
    y = top + 4;
  });
  const n = 5, tw = w * .7;
  for(let i = 0; i < n; i++){
    const x = cx - tw * .36 + tw * .72 * i / (n - 1), top = y - 104 + (i % 2) * 10;
    ctx.fillStyle = p.candle[i % p.candle.length]; rr(ctx, x - 10, top, 20, 110, 5); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 4; for(let s = 0; s < 4; s++){ ctx.beginPath(); ctx.moveTo(x - 10, top + 18 + s * 24); ctx.lineTo(x + 10, top + 8 + s * 24); ctx.stroke(); }
    glow(ctx, x, top - 30, 70, "#ffb703", .45);
    const g = ctx.createRadialGradient(x, top - 22, 2, x, top - 28, 26); g.addColorStop(0, "#fff8d6"); g.addColorStop(.5, "#ffd166"); g.addColorStop(1, "#ff7b00");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, top - 62); ctx.bezierCurveTo(x + 18, top - 30, x + 16, top - 8, x, top - 6); ctx.bezierCurveTo(x - 16, top - 8, x - 18, top - 30, x, top - 62); ctx.fill();
  }
}
function tree(ctx, x, base, h, col, snow = "#ffffff"){
  const lv = 4; for(let i = 0; i < lv; i++){ const t = i / lv, w = h * (.62 - t * .12), y1 = base - h * t * .78, y0 = y1 - h * .42;
    ctx.fillStyle = lin(ctx, x - w / 2, 0, x + w / 2, 0, [shade(col, -.25), col, shade(col, -.15)]); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + w / 2, y1); ctx.lineTo(x - w / 2, y1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = snow; ctx.lineWidth = Math.max(3, h * .025); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, y1 - 2); ctx.quadraticCurveTo(x, y1 - h * .06, x + w / 2 - 4, y1 - 2); ctx.stroke(); }
}
function ornament(ctx, x, top, len, R, col, band){
  ctx.strokeStyle = "rgba(255,240,200,.75)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + len); ctx.stroke();
  const cy = top + len + R + 14;
  ctx.fillStyle = gold(ctx, x - 16, 0, x + 16, 0); ctx.fillRect(x - R * .22, top + len, R * .44, 18);
  const g = ctx.createRadialGradient(x - R * .35, cy - R * .4, R * .05, x, cy, R * 1.1); g.addColorStop(0, shade(col, .6)); g.addColorStop(.4, col); g.addColorStop(1, shade(col, -.45));
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = R * .4; ctx.shadowOffsetY = R * .15;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, R, 0, TAU); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.save(); ctx.beginPath(); ctx.arc(x, cy, R, 0, TAU); ctx.clip();
  ctx.strokeStyle = band; ctx.lineWidth = R * .09; ctx.beginPath(); for(let i = 0; i <= 12; i++){ const xx = x - R + i * R / 6, yy = cy + (i % 2 ? -R * .12 : R * .12); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
  ctx.fillStyle = band; for(let i = 0; i < 5; i++){ ctx.beginPath(); ctx.arc(x - R * .7 + i * R * .35, cy - R * .38, R * .05, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(x - R * .4, cy - R * .4, R * .12, R * .22, -.7, 0, TAU); ctx.fill();
}
function firework(ctx, r, x, y, R, col){
  glow(ctx, x, y, R * 1.2, col, .25);
  const n = 34; ctx.lineCap = "round";
  for(let i = 0; i < n; i++){ const a = i * TAU / n + r() * .1, l = R * (.65 + r() * .35);
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, col);
    ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * l * .25, y + Math.sin(a) * l * .25); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    ctx.fillStyle = shade(col, .5); ctx.beginPath(); ctx.arc(x + Math.cos(a) * (l + 10), y + Math.sin(a) * (l + 10) + 4, 4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
}
function tulip(ctx, x, y, s, col, ang){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.fillStyle = lin(ctx, 0, -s, 0, s * .6, [shade(col, .25), shade(col, -.3)]);
  [-1, 1].forEach(d => { ctx.beginPath(); ctx.moveTo(0, s * .55); ctx.bezierCurveTo(d * -s * .78, s * .45, d * -s * .72, -s * .4, d * -s * .38, -s * .92); ctx.quadraticCurveTo(d * -s * .12, -s * .35, 0, -s * .2); ctx.closePath(); ctx.fill(); });
  ctx.shadowColor = "transparent";
  ctx.fillStyle = lin(ctx, 0, -s, 0, s * .6, [shade(col, .45), col, shade(col, -.2)]);
  ctx.beginPath(); ctx.moveTo(0, s * .6); ctx.bezierCurveTo(-s * .52, s * .42, -s * .46, -s * .5, 0, -s); ctx.bezierCurveTo(s * .46, -s * .5, s * .52, s * .42, 0, s * .6); ctx.fill();
  ctx.strokeStyle = rgba("#ffffff", .25); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, s * .45); ctx.quadraticCurveTo(-s * .08, -s * .2, 0, -s * .85); ctx.stroke();
  ctx.restore();
}
function blade(ctx, x, y, h, bend, w, col){ ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x + bend * .4, y - h * .6, x + bend, y - h); ctx.quadraticCurveTo(x + bend * .3, y - h * .55, x + w, y); ctx.closePath(); ctx.fill(); }
function grass(ctx, r, y, n, cols, hmin = 60, hmax = 160){ for(let i = 0; i < n; i++){ const x = r() * W; blade(ctx, x, y + 10, hmin + r() * (hmax - hmin), (r() - .5) * 80, 5 + r() * 6, cols[i % cols.length]); } }
function egg(ctx, x, y, s, col, deco, ang){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const path = () => { ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * .62, -s, s * .76, s * .35, 0, s * .75); ctx.bezierCurveTo(-s * .76, s * .35, -s * .62, -s, 0, -s); };
  const g = ctx.createRadialGradient(-s * .25, -s * .35, s * .05, 0, 0, s * 1.05); g.addColorStop(0, shade(col, .55)); g.addColorStop(.45, col); g.addColorStop(1, shade(col, -.35));
  ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; path(); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = "transparent";
  ctx.save(); path(); ctx.clip(); ctx.strokeStyle = deco; ctx.fillStyle = deco; ctx.lineWidth = s * .06;
  ctx.beginPath(); for(let i = 0; i <= 14; i++){ const xx = -s + i * s / 7, yy = -s * .05 + (i % 2 ? -s * .12 : s * .12); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
  [-.42, .32].forEach(yy => { ctx.beginPath(); ctx.moveTo(-s, s * yy); ctx.lineTo(s, s * yy); ctx.stroke(); });
  for(let i = 0; i < 6; i++){ ctx.beginPath(); ctx.arc(-s * .5 + i * s * .2, s * .1 + s * .08, s * .045, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.ellipse(-s * .25, -s * .5, s * .08, s * .18, -.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function laurel(ctx, cx, cy, R, side, col){
  for(let i = 0; i < 9; i++){ const a = Math.PI / 2 + side * (.35 + i * .2), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    leaf(ctx, x, y, 58 - i * 2, a + side * 1.9, col); leaf(ctx, x, y, 52 - i * 2, a + side * 1.1 + Math.PI, col); }
}
function flourish(ctx, x, y, sx, sy, st){
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); ctx.strokeStyle = st; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 150); ctx.bezierCurveTo(0, 50, 30, 0, 150, 0); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(22, 120); ctx.bezierCurveTo(22, 60, 50, 22, 120, 22); ctx.stroke();
  ctx.beginPath(); ctx.arc(46, 46, 16, 0, TAU * .8); ctx.stroke();
  ctx.fillStyle = st; ctx.beginPath(); ctx.moveTo(46, 14); ctx.lineTo(54, 28); ctx.lineTo(46, 42); ctx.lineTo(38, 28); ctx.closePath(); ctx.fill();
  [[150, 0], [0, 150]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 6, 0, TAU); ctx.fill(); });
  ctx.restore();
}
function cup(ctx, x, y, s, col){
  ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.beginPath(); ctx.ellipse(x, y + s * .62, s * .95, s * .16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = lin(ctx, x - s, 0, x + s, 0, ["#e6e2dc", "#ffffff", "#d9d4cc"]); ctx.beginPath(); ctx.ellipse(x, y + s * .55, s * .9, s * .15, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = s * .1; ctx.beginPath(); ctx.arc(x + s * .55, y + s * .05, s * .22, -1.3, 1.3); ctx.stroke();
  ctx.fillStyle = lin(ctx, x - s * .6, 0, x + s * .6, 0, [shade(col, -.2), shade(col, .25), shade(col, -.1)]);
  ctx.beginPath(); ctx.moveTo(x - s * .58, y - s * .32); ctx.lineTo(x + s * .58, y - s * .32); ctx.bezierCurveTo(x + s * .56, y + s * .3, x + s * .38, y + s * .52, x, y + s * .52); ctx.bezierCurveTo(x - s * .38, y + s * .52, x - s * .56, y + s * .3, x - s * .58, y - s * .32); ctx.fill();
  ctx.fillStyle = "#6f4e37"; ctx.beginPath(); ctx.ellipse(x, y - s * .32, s * .58, s * .1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#c69c72"; ctx.beginPath(); heartPath(ctx, x, y - s * .32, s * .26); ctx.save(); ctx.scale(1, 1); ctx.restore(); ctx.globalAlpha = .7; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = s * .045; ctx.lineCap = "round";
  [-.25, 0, .25].forEach(dx => { ctx.beginPath(); ctx.moveTo(x + dx * s, y - s * .48); ctx.bezierCurveTo(x + dx * s - s * .15, y - s * .7, x + dx * s + s * .15, y - s * .85, x + dx * s, y - s * 1.05); ctx.stroke(); });
}
function butterfly(ctx, x, y, s, col, ang){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  [-1, 1].forEach(d => { ctx.fillStyle = lin(ctx, 0, -s, d * s, s, [shade(col, .3), col]); ctx.beginPath(); ctx.ellipse(d * s * .45, -s * .3, s * .48, s * .38, d * .5, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(col, -.1); ctx.beginPath(); ctx.ellipse(d * s * .32, s * .25, s * .3, s * .24, d * -.4, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(d * s * .55, -s * .38, s * .08, 0, TAU); ctx.fill(); });
  ctx.fillStyle = "#3d2c2e"; ctx.beginPath(); ctx.ellipse(0, 0, s * .07, s * .45, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#3d2c2e"; ctx.lineWidth = 2; [-1, 1].forEach(d => { ctx.beginPath(); ctx.moveTo(0, -s * .4); ctx.quadraticCurveTo(d * s * .1, -s * .7, d * s * .25, -s * .75); ctx.stroke(); });
  ctx.restore();
}
function crescent(ctx, x, y, R, col){
  glow(ctx, x, y, R * 3, col, .35);
  const c = document.createElement("canvas"); c.width = c.height = Math.ceil(R * 2 + 4); const m = c.getContext("2d");
  const g = m.createRadialGradient(R * .7, R * .7, R * .1, R + 2, R + 2, R); g.addColorStop(0, "#fffbe6"); g.addColorStop(1, col);
  m.fillStyle = g; m.beginPath(); m.arc(R + 2, R + 2, R, 0, TAU); m.fill();
  m.globalCompositeOperation = "destination-out"; m.beginPath(); m.arc(R + 2 + R * .45, R + 2 - R * .25, R * .88, 0, TAU); m.fill();
  ctx.drawImage(c, x - R - 2, y - R - 2);
}
function rings(ctx, cx, cy, R){
  const ring = (x, a0, a1) => { ctx.strokeStyle = gold(ctx, x - R, cy - R, x + R, cy + R); ctx.lineWidth = R * .2; ctx.beginPath(); ctx.arc(x, cy, R, a0, a1); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = R * .04; ctx.beginPath(); ctx.arc(x, cy, R * 1.06, a0 + .2, Math.min(a1, a0 + 1.4)); ctx.stroke(); };
  ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ring(cx - R * .55, 0, TAU); ring(cx + R * .55, 0, TAU); ctx.shadowColor = "transparent";
  ring(cx - R * .55, -.6, .6);
  const dx = cx + R * .55, dy = cy - R * 1.1;
  ctx.fillStyle = lin(ctx, dx - 30, dy - 30, dx + 30, dy + 30, ["#ffffff", "#cde8ff", "#ffffff", "#a8d0ff"]);
  ctx.beginPath(); ctx.moveTo(dx - 30, dy); ctx.lineTo(dx - 18, dy - 22); ctx.lineTo(dx + 18, dy - 22); ctx.lineTo(dx + 30, dy); ctx.lineTo(dx, dy + 32); ctx.closePath(); ctx.fill();
  sparkle(ctx, dx + 34, dy - 30, 22, "#ffffff");
}

/* ---------- designs ---------- */
const DESIGNS = {
  balloons: { name: "Шарики", pals: [
    { bg: ["#ffe1ea", "#fff3e2"], b: ["#ff5d8f", "#ffb703", "#4cc9f0", "#9b5de5", "#06d6a0", "#ff7b54"], str: "rgba(150,100,120,.5)", title: "#d6336c", name: "#6a1b9a", body: "#4a3546" },
    { bg: ["#1d1b4f", "#43186b"], b: ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#f78c6b", "#c77dff"], str: "rgba(255,255,255,.45)", title: "#ffd166", name: "#ffffff", body: "#ece8ff" },
    { bg: ["#d8f3ff", "#fef9ef"], b: ["#3a86ff", "#ff006e", "#fb5607", "#ffbe0b", "#8338ec", "#06d6a0"], str: "rgba(60,80,120,.45)", title: "#3a0ca3", name: "#ff006e", body: "#2b2d42" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 16, "#ffffff", 30, 120, .25);
      const n = 7, bs = []; for(let i = 0; i < n; i++) bs.push([90 + i * (W - 180) / (n - 1) + (r() - .5) * 50, 150 + r() * 120 + (i % 2) * 70, 74 + r() * 34, p.b[i % p.b.length]]);
      bs.sort((a, b) => a[2] - b[2]).forEach(([x, y, R, c]) => balloon(ctx, x, y, R, c, r, p.str));
      const area = [110, 640, 860, 610]; confetti(ctx, r, 90, p.b, [0, 560, W, 790], 1, area);
      return { area, title: p.title, name: p.name, body: p.body };
    } },
  party: { name: "Конфетти", pals: [
    { bg: "#7b1e5a", glow: "#ff5d8f", c: ["#ffd166", "#ffffff", "#06d6a0", "#4cc9f0", "#ff9f1c"], title: "#ffd166", name: "#ffffff", body: "#ffe8f3" },
    { bg: "#0d1b4c", glow: "#3a86ff", c: ["#ffd166", "#ff006e", "#ffffff", "#8ecae6", "#fb8500"], title: "#ffd166", name: "#ffffff", body: "#e3ecff" },
    { bg: "#0b3d3a", glow: "#2ec4b6", c: ["#ffbf69", "#ffffff", "#cbf3f0", "#ff6b6b", "#ffd166"], title: "#ffbf69", name: "#ffffff", body: "#e7fffb" } ],
    draw(ctx, r, p){
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H); glow(ctx, W / 2, H * .45, 760, p.glow, .55); vignette(ctx, .35);
      const area = [140, 340, 800, 680];
      for(let k = 0; k < 2; k++){ const x0 = k ? W + 20 : -20; ctx.strokeStyle = p.c[k]; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath();
        for(let t = 0; t <= 1; t += .02){ const x = x0 + (k ? -1 : 1) * t * 420, y = -20 + t * 300 + Math.sin(t * 16) * 26; t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      confetti(ctx, r, 260, p.c, [0, 0, W, H], 1.05, area); sparkles(ctx, r, 16, "#fff3c4", [0, 0, W, H], 10, 26, area);
      return { area, title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.35)" };
    } },
  cake: { name: "Торт", pals: [
    { bg: ["#fff0f3", "#ffe5d9"], cake: ["#f8c8dc", "#f497b6"], cake2: ["#fff1e6", "#f6d5b8"], icing: "#ffffff", dots: ["#ff5d8f", "#4cc9f0", "#ffb703"], candle: ["#4cc9f0", "#ffb703", "#ff5d8f", "#9b5de5"], flags: ["#ff5d8f", "#ffd166", "#4cc9f0", "#9b5de5", "#06d6a0"], title: "#c9184a", name: "#7b2cbf", body: "#5a3d4b" },
    { bg: ["#2b2040", "#4a2c5e"], cake: ["#6f3e2f", "#4e2a1e"], cake2: ["#8a5a44", "#6f3e2f"], icing: "#ffe9f0", dots: ["#ffd166", "#ff8fab", "#ffffff"], candle: ["#ffd166", "#ff8fab", "#8ecae6"], flags: ["#ffd166", "#ff8fab", "#8ecae6", "#cdb4db"], title: "#ffd166", name: "#ffffff", body: "#f3e8ff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 14, "#ffffff", 30, 100, .2); bunting(ctx, 30, 70, p.flags);
      cake(ctx, r, W / 2, H - 60, 500, p);
      return { area: [110, 190, 860, 560], title: p.title, name: p.name, body: p.body };
    } },
  gifts: { name: "Подарки", pals: [
    { bg: ["#e9f5ff", "#fff0f6"], g: [["#ef476f", "#ffd166"], ["#118ab2", "#ffffff"], ["#9b5de5", "#f15bb5"]], c: ["#ef476f", "#ffd166", "#118ab2", "#9b5de5"], title: "#ef476f", name: "#3a0ca3", body: "#2b2d42" },
    { bg: ["#123524", "#0a1f15"], g: [["#c1121f", "#f6d38b"], ["#f6d38b", "#c1121f"], ["#2d6a4f", "#f6d38b"]], c: ["#f6d38b", "#ffffff", "#c1121f"], title: "#f6d38b", name: "#ffffff", body: "#e8f5ec" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 12, "#ffffff", 40, 120, .2);
      const area = [110, 200, 860, 640]; confetti(ctx, r, 90, p.c, [0, 0, W, 900], 1, area); sparkles(ctx, r, 10, "#fff3c4", [0, 0, W, 900], 10, 22, area);
      gift(ctx, 150, 1010, 300, 260, p.g[0][0], p.g[0][1]); gift(ctx, 640, 1060, 260, 210, p.g[2][0], p.g[2][1]); gift(ctx, 400, 1090, 300, 220, p.g[1][0], p.g[1][1]);
      return { area, title: p.title, name: p.name, body: p.body };
    } },
  roses: { name: "Розы", pals: [
    { bg: ["#3b0d1f", "#6a1b35"], f: ["#e63e6d", "#ff8fab", "#f7c4d4", "#c9184a"], leaf: "#2d6a4f", title: "#f6d38b", name: "#ffffff", body: "#ffe3ec", dark: 1 },
    { bg: ["#fff8f0", "#fde8e8"], f: ["#f28482", "#f5cac3", "#e5989b", "#ffb4a2"], leaf: "#52796f", title: "#b5179e", name: "#6d2e46", body: "#4f3a46" },
    { bg: ["#0f1e3d", "#1d2f5c"], f: ["#ffffff", "#e9ecef", "#cdb4db", "#ffc8dd"], leaf: "#4f772d", title: "#f6d38b", name: "#ffffff", body: "#e7ecff", dark: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); if(p.dark) vignette(ctx, .3);
      bouquet(ctx, r, 120, 120, 200, 9, p.f, p.leaf, ["rose"], 1.25); bouquet(ctx, r, W - 120, H - 120, 210, 10, p.f, p.leaf, ["rose"], 1.3);
      sparkles(ctx, r, 10, p.dark ? "#f6d38b" : "#ffffff", [0, 0, W, H], 8, 18, [150, 380, 780, 640]);
      return { area: [150, 330, 780, 700], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.4)" : null };
    } },
  winter: { name: "Зимний вечер", pals: [
    { sky: ["#0b1d3a", "#1f3c73", "#3d6aa8"], hill: "#eef6ff", tree: "#1b4332", title: "#ffffff", name: "#ffd166", body: "#e6f0ff" },
    { sky: ["#2b1055", "#7597de", "#c3d5f5"], hill: "#ffffff", tree: "#2d6a4f", title: "#ffffff", name: "#ffe8a3", body: "#f2f5ff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); stars(ctx, r, 120, [0, 0, W, 800]); glow(ctx, 860, 170, 230, "#fff6d5", .45);
      ctx.fillStyle = "#fff6d5"; ctx.beginPath(); ctx.arc(860, 170, 62, 0, TAU); ctx.fill();
      const hill = (y, amp, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, y); ctx.bezierCurveTo(W * .3, y - amp, W * .6, y + amp, W, y - amp * .4); ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); };
      hill(1060, 70, shade(p.hill, -.12)); [[160, 1080, 210], [300, 1060, 150], [830, 1000, 230], [960, 1040, 170]].forEach(([x, b, h]) => tree(ctx, x, b, h, p.tree));
      hill(1170, 50, p.hill); tree(ctx, 560, 1200, 120, p.tree);
      for(let i = 0; i < 40; i++){ const x = r() * W, y = r() * 1050; if(inside(x, y, [120, 200, 840, 760])) continue; snowflake(ctx, x, y, 8 + r() * 22, "rgba(255,255,255,.85)", 2 + r() * 2); }
      stars(ctx, r, 160, [0, 0, W, H], "#ffffff", [120, 200, 840, 760]);
      return { area: [120, 220, 840, 720], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,30,.55)" };
    } },
  baubles: { name: "Ёлочные игрушки", pals: [
    { bg: "#0f3d2e", glow: "#1f7a55", balls: ["#d62828", "#f6bd60", "#e9edc9", "#c1121f", "#f6bd60"], band: "#fff3c4", needle: ["#1b4332", "#2d6a4f", "#40916c"], title: "#f6d38b", name: "#ffffff", body: "#eaf6ee" },
    { bg: "#5c0b1a", glow: "#a4161a", balls: ["#f6d38b", "#2d6a4f", "#ffffff", "#f6d38b", "#40916c"], band: "#7a0c1e", needle: ["#1b4332", "#2d6a4f", "#40916c"], title: "#f6d38b", name: "#ffffff", body: "#ffeaea" } ],
    draw(ctx, r, p){
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H); glow(ctx, W / 2, H * .55, 820, p.glow, .55); vignette(ctx, .4);
      const xs = [130, 300, 470, 640, 810, 960], ls = [160, 300, 110, 250, 140, 320];
      xs.forEach((x, i) => ornament(ctx, x, 40, ls[i], 52 + (i % 3) * 14, p.balls[i % p.balls.length], p.band));
      for(let i = 0; i < 520; i++){ const x = r() * W, y = 10 + Math.sin(x / 140) * 26 + r() * 50, a = Math.PI / 2 + (r() - .5) * 2.2, l = 30 + r() * 40;
        ctx.strokeStyle = p.needle[i % 3]; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
      const area = [120, 600, 840, 660]; sparkles(ctx, r, 22, "#fff3c4", [0, 300, W, H - 300], 8, 22, area); stars(ctx, r, 120, [0, 200, W, H - 200], "#fff3c4", area);
      return { area, title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.4)" };
    } },
  fireworks: { name: "Салют", pals: [
    { sky: ["#05051a", "#1a1446", "#3b1e5a"], c: ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#f78c6b", "#c77dff"], city: "#0b0a1f", win: "#ffd166", title: "#ffd166", name: "#ffffff", body: "#ece8ff" },
    { sky: ["#001219", "#005f73", "#0a9396"], c: ["#ee9b00", "#e9d8a6", "#ae2012", "#94d2bd", "#ffffff"], city: "#001219", win: "#e9d8a6", title: "#e9d8a6", name: "#ffffff", body: "#e6fbff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); stars(ctx, r, 140, [0, 0, W, H]);
      [[200, 220, 170], [560, 150, 200], [900, 260, 160], [130, 560, 110], [960, 600, 120]].forEach(([x, y, R], i) => firework(ctx, r, x, y, R, p.c[i % p.c.length]));
      ctx.fillStyle = p.city; let x = 0; while(x < W){ const w = 60 + r() * 90, h = 90 + r() * 170; ctx.fillRect(x, H - h, w + 2, h);
        ctx.fillStyle = p.win; for(let wy = H - h + 16; wy < H - 20; wy += 28) for(let wx = x + 10; wx < x + w - 14; wx += 22) if(r() < .35){ ctx.globalAlpha = .5 + r() * .5; ctx.fillRect(wx, wy, 10, 14); }
        ctx.globalAlpha = 1; ctx.fillStyle = p.city; x += w; }
      return { area: [110, 480, 860, 610], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.5)" };
    } },
  hearts: { name: "Сердечки", pals: [
    { bg: ["#ffd6e0", "#ffb3c6"], h: ["#ff4d6d", "#ff758f", "#c9184a", "#ffffff"], plaque: "rgba(255,255,255,.78)", title: "#c9184a", name: "#800f2f", body: "#590d22" },
    { bg: ["#a4133c", "#590d22"], h: ["#ff758f", "#ff4d6d", "#ffb3c1", "#ffffff"], title: "#ffd6e0", name: "#ffffff", body: "#ffe5ec", dark: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); const area = [150, 380, 780, 620];
      glow(ctx, W / 2, H / 2, 600, "#ffffff", p.dark ? .12 : .4);
      for(let i = 0; i < 46; i++){ const x = r() * W, y = r() * H, s = 30 + r() * 140; if(inside(x, y, area, s * .3)) continue; heart(ctx, x, y, s, p.h[i % p.h.length], (r() - .5) * .8); }
      return { area, title: p.title, name: p.name, body: p.body, plaque: p.plaque, shadow: p.dark ? "rgba(0,0,0,.35)" : null };
    } },
  tulips: { name: "Тюльпаны", pals: [
    { bg: ["#fff7f0", "#ffe8ee"], t: ["#ff4d6d", "#ff8fab", "#ffb703", "#c77dff", "#f15bb5"], stem: "#40916c", rib: "#ff8fab", big: "#ffd6e0", title: "#d6336c", name: "#7b2cbf", body: "#4f3a46" },
    { bg: ["#e8f6ef", "#fdf6ff"], t: ["#ff006e", "#ffbe0b", "#fb5607", "#8338ec", "#ff5d8f"], stem: "#2d6a4f", rib: "#8338ec", big: "#d8f3dc", title: "#8338ec", name: "#d00062", body: "#2b2d42" } ],
    draw(ctx, r, p, c){
      vbg(ctx, p.bg); bokeh(ctx, r, 12, "#ffffff", 40, 120, .5);
      if(c && c.h === "mar8"){ ctx.font = "900 560px Georgia, serif"; ctx.textAlign = "center"; ctx.fillStyle = rgba(p.big, .6); ctx.fillText("8", W / 2, 760); }
      const heads = []; for(let i = 0; i < 9; i++){ const t = i / 8; heads.push([270 + t * 540 + (r() - .5) * 40, 930 + Math.abs(t - .5) * 160 + (r() - .5) * 60, p.t[i % p.t.length]]); }
      const base = [W / 2, 1290];
      [[-1, 360], [1, 360], [-1, 300], [1, 280]].forEach(([d, l], i) => { const x0 = base[0] + d * 20; ctx.fillStyle = lin(ctx, 0, base[1] - l, 0, base[1], [shade(p.stem, .2), p.stem]); ctx.beginPath(); ctx.moveTo(x0, H); ctx.quadraticCurveTo(x0 + d * 160, base[1] - l * .5, x0 + d * (150 + i * 30), base[1] - l); ctx.quadraticCurveTo(x0 + d * 60, base[1] - l * .45, x0 + d * 40, H); ctx.fill(); });
      ctx.lineCap = "round"; heads.forEach(([x, y]) => { ctx.strokeStyle = p.stem; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(base[0] + (x - base[0]) * .1, H); ctx.quadraticCurveTo(base[0] + (x - base[0]) * .3, 1150, x, y + 40); ctx.stroke(); });
      heads.sort((a, b) => a[1] - b[1]).forEach(([x, y, col]) => tulip(ctx, x, y, 72, col, (x - base[0]) / 1400));
      ctx.fillStyle = p.rib; ctx.fillRect(base[0] - 70, 1225, 140, 34); [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(base[0] + d * 64, 1222, 60, 30, d * -.4, 0, TAU); ctx.fill(); });
      const area = [110, 190, 860, 650]; sparkles(ctx, r, 8, "#ffffff", [0, 0, W, 900], 10, 20, area);
      return { area, title: p.title, name: p.name, body: p.body };
    } },
  emblem: { name: "Звёзды", pals: [
    { bg: ["#0b2545", "#13315c", "#134074"], title: "#ffffff", name: "#ffd166", body: "#e0e8f5", leaf: "#c8963e" },
    { bg: ["#1b4332", "#081c15"], title: "#ffffff", name: "#f6d38b", body: "#e5f3ea", leaf: "#c8963e" } ],
    draw(ctx, r, p, c){
      vbg(ctx, p.bg); vignette(ctx, .35);
      ctx.save(); ctx.globalAlpha = .08; ctx.fillStyle = "#ffffff"; for(let i = 0; i < 9; i++){ ctx.beginPath(); ctx.moveTo(W / 2, 330); ctx.arc(W / 2, 330, 1600, i * .7, i * .7 + .25); ctx.fill(); } ctx.restore();
      laurel(ctx, W / 2, 300, 210, -1, p.leaf); laurel(ctx, W / 2, 300, 210, 1, p.leaf);
      if(c && c.h === "feb23"){ ctx.font = "800 250px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 20; ctx.fillStyle = gold(ctx, 400, 200, 700, 420); ctx.fillText("23", W / 2, 310); ctx.shadowColor = "transparent"; ctx.textBaseline = "alphabetic"; }
      else { ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 20; star5(ctx, W / 2, 300, 150, gold(ctx, 400, 150, 700, 450)); ctx.shadowColor = "transparent"; }
      const area = [110, 560, 860, 690];
      for(let i = 0; i < 26; i++){ const x = r() * W, y = r() * H; if(inside(x, y, area, 40) || inside(x, y, [260, 60, 560, 480])) continue; star5(ctx, x, y, 8 + r() * 22, rgba("#f6d38b", .4 + r() * .6), r() * TAU); }
      return { area, title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.4)" };
    } },
  sunrise: { name: "Солнечное утро", pals: [
    { sky: ["#ffcf99", "#ffe8cc", "#fff8e7"], sun: "#ffb347", cloud: "#ffffff", cup: "#e76f51", title: "#d1495b", name: "#8a3b12", body: "#5a3e2b" },
    { sky: ["#cdb4db", "#ffc8dd", "#fff1f6"], sun: "#ffafcc", cloud: "#ffffff", cup: "#7b2cbf", title: "#9d4edd", name: "#c9184a", body: "#4a3456" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky);
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = "#ffffff"; for(let i = 0; i < 16; i++){ ctx.beginPath(); ctx.moveTo(W / 2, 1180); ctx.arc(W / 2, 1180, 1500, Math.PI + i * .2, Math.PI + i * .2 + .09); ctx.fill(); } ctx.restore();
      const sx = W / 2 + (r() - .5) * 260;
      glow(ctx, sx, 1180, 600, p.sun, .7); ctx.fillStyle = lin(ctx, 0, 950, 0, 1300, [shade(p.sun, .4), p.sun]); ctx.beginPath(); ctx.arc(sx, 1180, 200 + r() * 60, 0, TAU); ctx.fill();
      for(let i = 0; i < 5; i++){ const top = i > 2; cloud(ctx, 80 + r() * (W - 160), top ? 110 + r() * 140 : 1060 + r() * 110, top ? 40 + r() * 30 : 60 + r() * 45, p.cloud, .6 + r() * .3); }
      ctx.fillStyle = rgba("#ffffff", .7); ctx.fillRect(0, H - 120, W, 120);
      const cl = r() < .5; cup(ctx, cl ? 230 + r() * 60 : 790 + r() * 60, 1180, 110 + r() * 25, p.cup);
      for(let i = 0; i < 3; i++) butterfly(ctx, 120 + r() * (W - 240), 120 + r() * 120, 22 + r() * 10, ["#ff8fab", "#ffd166", "#bde0fe"][i], (r() - .5));
      return { area: [110, 200, 860, 680], title: p.title, name: p.name, body: p.body };
    } },
  night: { name: "Звёздная ночь", pals: [
    { sky: ["#0d1b2a", "#1b263b", "#2e1f5e"], moon: "#ffe8a3", cloud: "#5a4b8a", title: "#ffe8a3", name: "#ffffff", body: "#e6e9ff" },
    { sky: ["#03045e", "#023e8a", "#0077b6"], moon: "#fff3b0", cloud: "#48cae4", title: "#fff3b0", name: "#ffffff", body: "#e3f6ff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); const area = [110, 500, 860, 620];
      stars(ctx, r, 260, [0, 0, W, H]); sparkles(ctx, r, 16, "#fffbe6", [0, 0, W, H], 6, 18, area);
      crescent(ctx, 760, 270, 130, p.moon);
      cloud(ctx, 160, 1240, 130, p.cloud, .55); cloud(ctx, 520, 1290, 150, p.cloud, .5); cloud(ctx, 900, 1230, 130, p.cloud, .55); cloud(ctx, 300, 1310, 120, shade(p.cloud, .2), .5);
      return { area, title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.45)" };
    } },
  wedding: { name: "Кольца", pals: [
    { bg: ["#fffaf3", "#f6ede2"], f: ["#ffffff", "#f8e1e7", "#f5cac3", "#ffffff"], leaf: "#84a98c", title: "#9c6644", name: "#6b4226", body: "#5c4a3d" },
    { bg: ["#1f2a44", "#3d3b6e"], f: ["#ffffff", "#e8e8f5", "#d8c7ff", "#ffffff"], leaf: "#6b9080", title: "#f6d38b", name: "#ffffff", body: "#ecebff", dark: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 14, p.dark ? "#f6d38b" : "#ffffff", 30, 110, p.dark ? .12 : .6);
      bouquet(ctx, r, 90, 90, 170, 8, p.f, p.leaf, ["rose", "rose", "blossom"], 1.05); bouquet(ctx, r, W - 100, H - 100, 190, 9, p.f, p.leaf, ["rose", "blossom", "rose"], 1.1);
      rings(ctx, W / 2, 360, 120);
      return { area: [160, 560, 760, 560], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.4)" : null };
    } },
  easter: { name: "Пасхальные яйца", pals: [
    { bg: ["#f1faee", "#d8f3dc"], eggs: ["#ef476f", "#ffd166", "#118ab2", "#9b5de5", "#06d6a0"], deco: "#ffffff", grass: ["#52b788", "#40916c", "#74c69d", "#2d6a4f"], title: "#2d6a4f", name: "#9d0208", body: "#3a5a40" },
    { bg: ["#fff1e6", "#fde2e4"], eggs: ["#d62828", "#f77f00", "#fcbf49", "#c1121f", "#e85d04"], deco: "#fff3c4", grass: ["#90be6d", "#6a994e", "#a7c957", "#386641"], title: "#9d0208", name: "#6a040f", body: "#4a2c2a" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 12, "#ffffff", 40, 120, .6);
      [[-1, 0], [1, W]].forEach(([d, x0]) => { ctx.strokeStyle = "#7f5539"; ctx.lineWidth = 6; ctx.lineCap = "round"; for(let k = 0; k < 2; k++){ ctx.beginPath(); ctx.moveTo(x0, 40 + k * 90); const ex = x0 - d * (300 + k * 60), ey = 160 + k * 120; ctx.quadraticCurveTo(x0 - d * 150, 30 + k * 90, ex, ey); ctx.stroke();
        for(let t = .15; t < 1; t += .13){ const u = 1 - t, bx = u * u * x0 + 2 * u * t * (x0 - d * 150) + t * t * ex, by = u * u * (40 + k * 90) + 2 * u * t * (30 + k * 90) + t * t * ey; ctx.fillStyle = lin(ctx, bx, by - 14, bx, by + 14, ["#ffffff", "#d9d9d9"]); ctx.beginPath(); ctx.ellipse(bx, by + 12, 11, 18, d * .3, 0, TAU); ctx.fill(); } } });
      grass(ctx, r, 1350, 160, p.grass, 80, 200);
      [[300, 1170, 110], [520, 1140, 130], [740, 1175, 115], [410, 1250, 95], [640, 1255, 100]].forEach(([x, y, s], i) => egg(ctx, x, y, s, p.eggs[i % p.eggs.length], p.deco, (i - 2) * .15));
      grass(ctx, r, 1350, 90, p.grass, 40, 120);
      return { area: [110, 300, 860, 640], title: p.title, name: p.name, body: p.body };
    } },
  wreath: { name: "Цветочный венок", pals: [
    { bg: ["#fdf6ec", "#f7e7da"], f: ["#f4978e", "#f8ad9d", "#fbc4ab", "#ffffff", "#e5989b"], leaf: "#6a994e", title: "#b23a48", name: "#5f0f40", body: "#4a3b3b" },
    { bg: ["#1b1b2f", "#2a2a4a"], f: ["#cdb4db", "#ffffff", "#ffc8dd", "#bde0fe", "#e0aaff"], leaf: "#52796f", title: "#f6d38b", name: "#ffffff", body: "#ececff", dark: 1 },
    { bg: ["#fefae0", "#f0f7da"], f: ["#ffb703", "#ffffff", "#fb8500", "#ffd166", "#ffffff"], leaf: "#588157", title: "#bc6c25", name: "#283618", body: "#3a3a2a" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); if(p.dark) vignette(ctx, .3);
      const cx = W / 2, cy = 690, rx = 420, ry = 540;
      for(let a = 0; a < TAU; a += .085){ const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; leaf(ctx, x, y, 70 + r() * 40, a + Math.PI / 2 + (r() - .5) * 1.2, p.leaf); leaf(ctx, x, y, 60 + r() * 30, a - Math.PI / 2 + (r() - .5) * 1.2, p.leaf); }
      const fl = []; for(let a = 0; a < TAU; a += .16){ const w = Math.abs(Math.sin(a)); if(r() > .35 + w * .5) continue; fl.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 46 + r() * 34 + w * 12, p.f[fl.length % p.f.length], r() < .5 ? "rose" : r() < .5 ? "daisy" : "blossom"]); }
      fl.forEach(f => flower(ctx, f[0], f[1], f[2], f[3], f[4], r() * TAU));
      return { area: [230, 320, 620, 740], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.4)" : null };
    } },
  frame: { name: "Золотая рамка", pals: [
    { bg: ["#0b3d2e", "#062a20"], title: "#f6d38b", name: "#fff3d6", body: "#efe3c8" },
    { bg: ["#5c0f1f", "#300811"], title: "#f6d38b", name: "#fff3d6", body: "#f3dfd2" },
    { bg: ["#0e1f3d", "#071226"], title: "#f6d38b", name: "#fff3d6", body: "#e3e7f3" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); glow(ctx, W / 2, H * .42, 700, "#ffffff", .08); vignette(ctx, .45);
      const G = gold(ctx, 0, 0, W, H);
      ctx.strokeStyle = G; ctx.lineWidth = 7; rr(ctx, 50, 50, W - 100, H - 100, 24); ctx.stroke(); ctx.lineWidth = 2.5; rr(ctx, 78, 78, W - 156, H - 156, 16); ctx.stroke();
      [[90, 90, 1, 1], [W - 90, 90, -1, 1], [90, H - 90, 1, -1], [W - 90, H - 90, -1, -1]].forEach(([x, y, sx, sy]) => flourish(ctx, x, y, sx, sy, G));
      for(let i = 0; i < 220; i++){ const x = 100 + r() * (W - 200), y = 100 + r() * (H - 200); ctx.fillStyle = rgba("#f6d38b", r() * .55); ctx.beginPath(); ctx.arc(x, y, .8 + r() * 2.4, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = G; ctx.lineWidth = 2; [[300, 230], [300, 1120]].forEach(([w, y]) => { ctx.beginPath(); ctx.moveTo(W / 2 - w, y); ctx.lineTo(W / 2 - 24, y); ctx.moveTo(W / 2 + 24, y); ctx.lineTo(W / 2 + w, y); ctx.stroke(); ctx.fillStyle = G; ctx.beginPath(); ctx.moveTo(W / 2, y - 12); ctx.lineTo(W / 2 + 12, y); ctx.lineTo(W / 2, y + 12); ctx.lineTo(W / 2 - 12, y); ctx.closePath(); ctx.fill(); });
      return { area: [150, 280, 780, 800], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.35)" };
    } },
  meadow: { name: "Ромашки", pals: [
    { sky: ["#a2d2ff", "#cdeafe", "#fef9ef"], hill: ["#95d5b2", "#52b788"], f: ["#ffffff", "#ffffff", "#ffafcc", "#cdb4db"], bf: ["#ff8fab", "#ffb703", "#8ecae6"], grass: ["#52b788", "#40916c", "#74c69d"], title: "#1d3557", name: "#e63946", body: "#2b2d42" },
    { sky: ["#ffd6a5", "#fdffb6", "#fffcf2"], hill: ["#caffbf", "#9bf6ff"], f: ["#ffffff", "#ffd6a5", "#ffffff", "#ffc6ff"], bf: ["#bdb2ff", "#ffadad", "#a0c4ff"], grass: ["#80b918", "#55a630", "#aacc00"], title: "#bc4749", name: "#386641", body: "#3d3d3d" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); glow(ctx, 900, 160, 260, "#fff3b0", .8); ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(900, 160, 70, 0, TAU); ctx.fill();
      cloud(ctx, 200, 170, 60, "#ffffff", .85); cloud(ctx, 600, 110, 45, "#ffffff", .7);
      ctx.fillStyle = p.hill[0]; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 1030); ctx.quadraticCurveTo(W * .4, 940, W, 1010); ctx.lineTo(W, H); ctx.fill();
      ctx.fillStyle = p.hill[1]; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 1120); ctx.quadraticCurveTo(W * .6, 1040, W, 1110); ctx.lineTo(W, H); ctx.fill();
      grass(ctx, r, H, 120, p.grass, 60, 180);
      const fl = []; for(let i = 0; i < 18; i++) fl.push([r() * W, 1080 + r() * 260, 30 + r() * 34, p.f[i % p.f.length]]);
      fl.sort((a, b) => a[1] - b[1]).forEach(([x, y, s, c]) => { ctx.strokeStyle = "#40916c"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, H); ctx.stroke(); flower(ctx, x, y, s, c, "daisy", r()); });
      butterfly(ctx, 170, 860, 46, p.bf[0], -.3); butterfly(ctx, 930, 760, 38, p.bf[1], .4);
      return { area: [110, 260, 860, 600], title: p.title, name: p.name, body: p.body };
    } },
  baby: { name: "Малыш", pals: [
    { bg: ["#dff3ff", "#fff6e0"], acc: ["#8ecae6", "#ffd166", "#bde0fe", "#a2d2ff"], title: "#3a86ff", name: "#1d3557", body: "#33415c" },
    { bg: ["#ffe4ec", "#fff6e5"], acc: ["#ffafcc", "#ffd166", "#cdb4db", "#ffc8dd"], title: "#e05780", name: "#7b2cbf", body: "#4a3456" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bunting(ctx, 20, 60, p.acc, -30, W + 30, 90, 70);
      [[180, 260, 70], [880, 330, 80], [140, 1160, 110], [540, 1250, 140], [940, 1170, 110]].forEach(([x, y, s]) => cloud(ctx, x, y, s, "#ffffff", .95));
      [[230, 140, 220], [840, 140, 250]].forEach(([x, top, len], i) => { ctx.strokeStyle = "rgba(120,120,150,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + len); ctx.stroke(); star5(ctx, x, top + len + 30, 36, p.acc[(i + 1) % p.acc.length]); });
      crescent(ctx, 540, 360, 60, "#ffe8a3");
      const area = [130, 470, 820, 680]; sparkles(ctx, r, 14, "#ffffff", [0, 0, W, H], 8, 18, area);
      return { area, title: p.title, name: p.name, body: p.body };
    } },
  garland: { name: "Флажки", pals: [
    { bg: ["#fdf0d5", "#f7d6b4"], flags: ["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#264653"], c: ["#e63946", "#2a9d8f", "#e9c46a", "#264653"], title: "#e63946", name: "#264653", body: "#3d2f2f" },
    { bg: ["#e0fbfc", "#c2dfe3"], flags: ["#ee6c4d", "#3d5a80", "#98c1d9", "#f4d35e", "#ff8fab"], c: ["#ee6c4d", "#3d5a80", "#f4d35e", "#ff8fab"], title: "#3d5a80", name: "#ee6c4d", body: "#293241" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 10, "#ffffff", 40, 120, .4);
      bunting(ctx, 10, 90, p.flags); bunting(ctx, 150, 60, p.flags.slice().reverse(), -30, W + 30, 90, 70);
      const area = [110, 430, 860, 680]; confetti(ctx, r, 140, p.c, [0, 300, W, H - 300], 1, area);
      return { area, title: p.title, name: p.name, body: p.body };
    } },
  school: { name: "Школа", pals: [
    { bg: ["#fef6e4", "#f3d2c1"], books: ["#e63946", "#457b9d", "#2a9d8f", "#f4a261"], leaves: ["#e76f51", "#f4a261", "#e9c46a", "#d62828"], title: "#1d3557", name: "#e63946", body: "#2b2d42" },
    { bg: ["#1f4e3d", "#163a2e"], books: ["#e63946", "#f1faee", "#a8dadc", "#f4a261"], leaves: ["#f4a261", "#e9c46a", "#e76f51", "#ffd166"], title: "#f1faee", name: "#ffd166", body: "#e9f5ee", chalk: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); if(p.chalk){ for(let i = 0; i < 40; i++){ ctx.strokeStyle = "rgba(255,255,255,.04)"; ctx.lineWidth = 30 + r() * 60; ctx.beginPath(); const y = r() * H; ctx.moveTo(0, y); ctx.lineTo(W, y + (r() - .5) * 200); ctx.stroke(); } ctx.strokeStyle = "#8d6e4a"; ctx.lineWidth = 34; ctx.strokeRect(17, 17, W - 34, H - 34); }
      const area = [120, 300, 840, 640];
      for(let i = 0; i < 16; i++){ const x = r() * W, y = r() * H; if(inside(x, y, area, 40) || (x < 520 && y > 980)) continue; leaf(ctx, x, y, 50 + r() * 50, r() * TAU, p.leaves[i % p.leaves.length]); }
      const bx = 820, by = 150; ctx.save(); ctx.translate(bx, by); ctx.rotate(.3);
      ctx.fillStyle = "#c1121f"; [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(d * 50, -96, 54, 24, d * -.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(d * 8, -90); ctx.lineTo(d * 40, -20); ctx.lineTo(d * 22, -26); ctx.closePath(); ctx.fill(); });
      ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
      ctx.fillStyle = gold(ctx, -90, -80, 90, 100); ctx.beginPath(); ctx.moveTo(-18, -80); ctx.quadraticCurveTo(-60, -70, -62, 0); ctx.quadraticCurveTo(-66, 60, -96, 86); ctx.lineTo(96, 86); ctx.quadraticCurveTo(66, 60, 62, 0); ctx.quadraticCurveTo(60, -70, 18, -80); ctx.closePath(); ctx.fill();
      ctx.shadowColor = "transparent"; ctx.fillStyle = "#a67c2e"; ctx.beginPath(); ctx.arc(0, 100, 20, 0, TAU); ctx.fill(); ctx.fillStyle = "#c1121f"; ctx.beginPath(); ctx.arc(0, -96, 14, 0, TAU); ctx.fill();
      ctx.restore();
      let y = H - 60; [[480, 70], [440, 64], [500, 76], [420, 60]].forEach(([w, h], i) => { const x = 40 + (i % 2) * 24, col = p.books[i % p.books.length];
        ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.fillRect(x + 8, y - h + 8, w, h); ctx.fillStyle = "#fffdf5"; ctx.fillRect(x + 10, y - h + 6, w - 20, h - 12);
        ctx.fillStyle = lin(ctx, x, 0, x + w, 0, [shade(col, -.2), col, shade(col, -.1)]); ctx.fillRect(x, y - h, w, 14); ctx.fillRect(x, y - 14, w, 14); ctx.fillRect(x + w - 22, y - h, 22, h);
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(x + w - 16, y - h * .7, 10, h * .4); y -= h; });
      [["#ffd166", -0.5], ["#06d6a0", -.3]].forEach(([c, a], i) => { ctx.save(); ctx.translate(600 + i * 70, 1250); ctx.rotate(a); ctx.fillStyle = c; ctx.fillRect(-14, -220, 28, 220); ctx.fillStyle = "#f6d5a8"; ctx.beginPath(); ctx.moveTo(-14, -220); ctx.lineTo(14, -220); ctx.lineTo(0, -270); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#333"; ctx.beginPath(); ctx.moveTo(-5, -255); ctx.lineTo(5, -255); ctx.lineTo(0, -270); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ff8fab"; ctx.fillRect(-14, -10, 28, 10); ctx.restore(); });
      return { area, title: p.title, name: p.name, body: p.body, shadow: p.chalk ? "rgba(0,0,0,.3)" : null };
    } },
  pancakes: { name: "Блины", pals: [
    { bg: ["#fff3c4", "#ffd9a0"], sun: "#ffb703", plate: "#4895ef", title: "#c1121f", name: "#7f4f24", body: "#4a3426" },
    { bg: ["#cfe8ff", "#fff1d6"], sun: "#ffbe0b", plate: "#e63946", title: "#d00000", name: "#3a0ca3", body: "#2b2d42" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg);
      ctx.save(); ctx.translate(W / 2, 250); for(let i = 0; i < 18; i++){ ctx.rotate(TAU / 18); ctx.fillStyle = rgba(p.sun, .35); ctx.beginPath(); ctx.moveTo(-18, -140); ctx.lineTo(0, -230 - (i % 2) * 40); ctx.lineTo(18, -140); ctx.closePath(); ctx.fill(); } ctx.restore();
      glow(ctx, W / 2, 250, 260, p.sun, .6); ctx.fillStyle = lin(ctx, 0, 130, 0, 370, [shade(p.sun, .45), p.sun]); ctx.beginPath(); ctx.arc(W / 2, 250, 120, 0, TAU); ctx.fill();
      const cx = W / 2, base = 1250;
      ctx.fillStyle = lin(ctx, cx - 340, 0, cx + 340, 0, [shade(p.plate, -.2), shade(p.plate, .3), shade(p.plate, -.1)]); ctx.beginPath(); ctx.ellipse(cx, base, 340, 70, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(cx, base - 6, 280, 52, 0, 0, TAU); ctx.fill();
      for(let i = 0; i < 9; i++){ const y = base - 22 - i * 20, w = 250 - i * 2 + (r() - .5) * 14;
        ctx.fillStyle = lin(ctx, 0, y - 30, 0, y + 30, ["#f9d276", "#e9a23b", "#c97a20"]); ctx.beginPath(); ctx.ellipse(cx + (r() - .5) * 10, y, w, 34, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(160,90,20,.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, y - 4, w - 30, 22, 0, .2, 2.9); ctx.stroke(); }
      const ty = base - 22 - 8 * 20;
      ctx.fillStyle = "rgba(255,230,140,.85)"; ctx.beginPath(); ctx.ellipse(cx, ty - 4, 210, 28, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = lin(ctx, cx - 50, 0, cx + 50, 0, ["#fff3b0", "#ffe066"]); ctx.save(); ctx.translate(cx, ty - 26); ctx.rotate(.2); ctx.fillRect(-46, -26, 92, 46); ctx.restore();
      [[cx - 150, ty + 4], [cx + 160, ty + 8]].forEach(([x, y]) => { ctx.fillStyle = "rgba(230,150,30,.8)"; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x, y + 70, x + 14, y); ctx.fill(); });
      [[200, 1150], [880, 1170], [250, 1240]].forEach(([x, y]) => { ctx.fillStyle = "#c1121f"; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(x - 6, y - 6, 5, 0, TAU); ctx.fill(); });
      return { area: [110, 430, 860, 560], title: p.title, name: p.name, body: p.body };
    } },
  house: { name: "Уютный дом", pals: [
    { sky: ["#a2d2ff", "#e2f0ff", "#fff8ef"], wall: "#f4a261", roof: "#9b2226", grass: ["#52b788", "#40916c", "#74c69d"], title: "#9b2226", name: "#1d3557", body: "#2b2d42" },
    { sky: ["#1b263b", "#415a77", "#778da9"], wall: "#e9c46a", roof: "#6d2e46", grass: ["#2d6a4f", "#1b4332", "#40916c"], title: "#ffd166", name: "#ffffff", body: "#eef2ff", night: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); if(p.night){ stars(ctx, r, 140, [0, 0, W, 800]); crescent(ctx, 860, 160, 60, "#ffe8a3"); } else { cloud(ctx, 200, 160, 60, "#fff", .9); cloud(ctx, 840, 220, 50, "#fff", .8); }
      ctx.fillStyle = p.grass[0]; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 1150); ctx.quadraticCurveTo(W / 2, 1090, W, 1150); ctx.lineTo(W, H); ctx.fill();
      const hx = W / 2, base = 1200, hw = 380, hh = 230;
      ctx.fillStyle = "#6c584c"; ctx.fillRect(hx + 90, base - hh - 190, 50, 110);
      for(let i = 0; i < 3; i++) cloud(ctx, hx + 115 + i * 30, base - hh - 220 - i * 50, 22 + i * 8, "#ffffff", .7 - i * .15);
      ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      ctx.fillStyle = lin(ctx, hx - hw / 2, 0, hx + hw / 2, 0, [shade(p.wall, -.12), p.wall, shade(p.wall, -.06)]); ctx.fillRect(hx - hw / 2, base - hh, hw, hh);
      ctx.fillStyle = lin(ctx, 0, base - hh - 170, 0, base - hh, [shade(p.roof, .15), p.roof]); ctx.beginPath(); ctx.moveTo(hx - hw / 2 - 40, base - hh + 6); ctx.lineTo(hx, base - hh - 170); ctx.lineTo(hx + hw / 2 + 40, base - hh + 6); ctx.closePath(); ctx.fill();
      ctx.shadowColor = "transparent";
      const win = (x, y) => { glow(ctx, x + 35, y + 35, 90, "#ffd166", p.night ? .5 : .2); ctx.fillStyle = "#ffe8a3"; ctx.fillRect(x, y, 70, 70); ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.strokeRect(x, y, 70, 70); ctx.beginPath(); ctx.moveTo(x + 35, y); ctx.lineTo(x + 35, y + 70); ctx.moveTo(x, y + 35); ctx.lineTo(x + 70, y + 35); ctx.stroke(); };
      win(hx - 150, base - hh + 50); win(hx + 80, base - hh + 50);
      ctx.fillStyle = "#7f5539"; rr(ctx, hx - 40, base - 150, 80, 150, 12); ctx.fill(); ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(hx + 22, base - 72, 6, 0, TAU); ctx.fill();
      heart(ctx, hx, base - hh - 70, 60, "#ff4d6d");
      [[150, 1210, 190], [930, 1220, 170]].forEach(([x, b, h]) => tree(ctx, x, b, h, "#2d6a4f", p.night ? "#d8e2dc" : "#95d5b2"));
      grass(ctx, r, H, 110, p.grass, 40, 110);
      return { area: [110, 220, 860, 480], title: p.title, name: p.name, body: p.body, shadow: p.night ? "rgba(0,0,0,.4)" : null };
    } }

};

/* ---------- holidays ---------- */
const HOLIDAYS = [
  { id: "bday", name: "День рождения", emoji: "🎂", title: "С днём рождения", designs: ["balloons", "cake", "party", "gifts", "roses", "garland", "wreath"], wishes: [
    "Пусть этот год будет щедрым на радость, тёплые встречи и приятные сюрпризы. Здоровья, любви и исполнения всех желаний!",
    "Пусть сердце радостью согрето,\nА дом наполнен добротой,\nИ будет каждый день, как лето, —\nСчастливый, яркий, золотой!",
    "Желаю, чтобы каждый день начинался с улыбки, а рядом всегда были любимые люди. Пусть мечты сбываются легко!",
    "Крепкого здоровья, удачи во всех делах и побольше поводов для счастья. Пусть всё задуманное получается!" ] },
  { id: "ny", name: "Новый год", emoji: "🎄", date: [1, 1], title: "С Новым годом", designs: ["winter", "baubles", "fireworks", "gifts", "frame"], wishes: [
    "Пусть Новый год принесёт в дом тепло, здоровье и уют, а все мечты сбудутся под бой курантов!",
    "Пусть снег кружится за окном,\nА в доме — свет и смех,\nИ Новый год приносит в дом\nУдачу и успех!",
    "Желаю, чтобы год был добрым, спокойным и счастливым. Больше радостных встреч и маленьких чудес каждый день!",
    "Пусть всё плохое останется в старом году, а впереди ждут только хорошие новости!" ] },
  { id: "xmas", name: "Рождество", emoji: "⭐", date: [1, 7], title: "С Рождеством", designs: ["baubles", "winter", "frame", "night"], wishes: [
    "Светлого Рождества! Пусть в сердце живут мир и любовь, а в доме — тепло и согласие.",
    "Пусть в Рождество звезда зажжётся\nИ свет прольёт на каждый дом,\nПусть сердце радостно забьётся\nИ будет счастье жить в твоём!",
    "Пусть Рождественская звезда освещает путь, а близкие всегда будут рядом. Добра и благополучия!" ] },
  { id: "feb14", name: "День влюблённых", emoji: "💕", date: [2, 14], title: "С Днём влюблённых", designs: ["hearts", "roses", "wreath", "night"], wishes: [
    "Ты — моё самое большое счастье. Спасибо, что ты есть!",
    "Сердечко это — для тебя,\nВ нём нежность, свет и теплота,\nПусть будет каждый день, любя,\nСчастливым, как мечта!",
    "Пусть любовь согревает, вдохновляет и дарит крылья. С праздником любви!" ] },
  { id: "feb23", name: "23 Февраля", emoji: "⭐", date: [2, 23], title: "С Днём защитника Отечества", designs: ["emblem", "frame", "party"], wishes: [
    "Крепкого здоровья, силы духа, надёжных друзей и уверенности в каждом дне!",
    "Желаю мужества, удачи и мира. Пусть рядом всегда будут любящие люди, а все цели достигаются легко!",
    "Будь сильным, смелым и здоровым,\nИ пусть удача ждёт в пути,\nПусть каждый день приносит новый\nПовод вперёд смелей идти!" ] },
  { id: "mar8", name: "8 Марта", emoji: "🌷", date: [3, 8], title: "С 8 Марта", designs: ["tulips", "roses", "wreath", "meadow"], wishes: [
    "Пусть весна дарит цветы, улыбки и вдохновение, а каждый день будет наполнен нежностью и радостью!",
    "Пусть в жизни будет, как весной,\nТепло, светло и ясно,\nИ счастье ходит за тобой,\nИ всё вокруг прекрасно!",
    "Оставайся такой же прекрасной, нежной и любимой! Здоровья, тепла и исполнения желаний." ] },
  { id: "easter", name: "Пасха", emoji: "🥚", easter: true, title: "Христос Воскресе", designs: ["easter", "meadow", "wreath"], wishes: [
    "Светлой Пасхи! Мира, добра и тепла вашему дому.",
    "Пусть в сердце живут вера, надежда и любовь, а в доме — радость и согласие. С праздником!",
    "С праздником Светлой Пасхи! Пусть этот день принесёт покой, радость и тёплые встречи с близкими." ] },
  { id: "mom", name: "День матери", emoji: "💐", title: "С Днём матери", designs: ["wreath", "roses", "tulips", "meadow"], wishes: [
    "Мама, спасибо за любовь, заботу и тепло. Ты — самый родной человек на свете! Здоровья и счастья.",
    "Мамочка, родная, милая,\nСпасибо за тепло и свет,\nБудь всегда счастливой, сильною,\nЖиви без горя и без бед!" ] },
  { id: "wedding", name: "Свадьба", emoji: "💍", title: "С днём свадьбы", designs: ["wedding", "wreath", "hearts", "frame"], wishes: [
    "Совет да любовь! Пусть ваша семья будет крепкой, дом — полной чашей, а любовь с годами только сильнее.",
    "Пусть будет в доме вашем лад,\nУют, тепло и радость,\nИ пусть любви вашей заряд\nНе знает слова «старость»!",
    "Поздравляем с самым красивым днём! Счастья, взаимопонимания и долгих лет вместе." ] },
  { id: "anniv", name: "Годовщина", emoji: "🥂", title: "С годовщиной", designs: ["frame", "roses", "hearts", "fireworks"], wishes: [
    "Пусть каждый новый год вместе будет ещё счастливее предыдущего. Любви, нежности и тепла!",
    "Поздравляю с годовщиной! Пусть ваша история продолжается долго и радостно." ] },
  { id: "baby", name: "Рождение малыша", emoji: "🍼", title: "С рождением малыша", designs: ["baby", "balloons", "garland"], wishes: [
    "Поздравляем с появлением маленького чуда! Пусть малыш растёт здоровым, счастливым и радует каждый день.",
    "Пусть в доме всегда звучит детский смех, а сердце будет наполнено любовью!" ] },
  { id: "morning", cat: "daily", name: "Доброе утро", emoji: "☀️", title: "Доброе утро", designs: ["sunrise", "meadow", "wreath"], wishes: [
    "Пусть этот день будет лёгким, светлым и удачным! Улыбнись — у тебя всё получится.",
    "Шлю тебе солнечный привет и чашечку хорошего настроения! Прекрасного дня!",
    "Проснись, открой глаза скорей —\nТебя встречает новый день,\nПусть будет он светлей, теплей,\nА все заботы — в тень!" ] },
  { id: "night", cat: "daily", name: "Спокойной ночи", emoji: "🌙", title: "Спокойной ночи", designs: ["night", "winter", "baby"], wishes: [
    "Пусть ночь будет тихой, а сны — сладкими и добрыми. Отдыхай и набирайся сил!",
    "Закрывай глазки, пусть приснится что-то очень хорошее. Сладких снов!" ] },
  { id: "evening", cat: "daily", name: "Добрый вечер", emoji: "🌇", title: "Добрый вечер", designs: ["night", "sunrise", "candles"], wishes: [
    "Пусть этот вечер будет тёплым и уютным, а все заботы останутся позади. Отдыхай!",
    "Добрый вечер! Пусть он подарит тишину, приятные разговоры и хорошее настроение." ] },
  { id: "weekend", cat: "daily", name: "Хороших выходных", emoji: "🌼", title: "Хороших выходных", designs: ["meadow", "sunrise", "garland"], wishes: [
    "Пусть выходные будут тёплыми, спокойными и радостными. Отдыхай и наслаждайся каждой минутой!",
    "Желаю отличных выходных: хорошей погоды, приятных встреч и много поводов для улыбки!" ] },
  { id: "love", cat: "just", name: "Люблю", emoji: "❤️", title: "Я тебя люблю", nameFirst: true, designs: ["hearts", "roses", "night", "wreath"], wishes: [
    "Ты делаешь каждый мой день светлее. Спасибо, что ты рядом!",
    "Просто хочу напомнить: ты — самый важный человек в моей жизни." ] },
  { id: "thanks", cat: "just", name: "Спасибо", emoji: "🙏", title: "Спасибо", nameFirst: true, designs: ["wreath", "frame", "meadow", "roses"], wishes: [
    "От всего сердца спасибо за доброту, помощь и внимание! Это очень ценно для меня.",
    "Благодарю за то, что ты есть! Пусть добро, которое ты даришь, всегда возвращается." ] },
  { id: "health", cat: "just", name: "Выздоравливай", emoji: "🌻", title: "Выздоравливай", nameFirst: true, designs: ["meadow", "sunrise", "wreath"], wishes: [
    "Скорее поправляйся! Пусть силы и хорошее настроение возвращаются с каждым днём.",
    "Желаю крепкого здоровья и бодрости. Береги себя и возвращайся в строй с новыми силами!" ] },
  { id: "goodday", cat: "daily", name: "Хорошего дня", emoji: "🌤", daily: true, title: "Хорошего дня", designs: ["meadow", "sunrise", "wreath", "garland"], wishes: [
    "Пусть сегодня всё получается легко, а настроение будет солнечным с утра до вечера!",
    "Желаю спокойного, светлого и удачного дня. Пусть он принесёт только хорошие новости!" ] },
  { id: "monday", cat: "daily", name: "Хорошей недели", emoji: "🗓", daily: true, title: "Хорошей недели", designs: ["sunrise", "meadow", "garland"], wishes: [
    "Пусть неделя начнётся легко и пройдёт успешно. Удачи во всех делах и побольше приятных моментов!",
    "Новая неделя — новые возможности! Пусть всё задуманное сбудется." ] },
  { id: "friday", cat: "daily", name: "С пятницей", emoji: "🎉", daily: true, title: "С пятницей", designs: ["party", "garland", "sunrise"], wishes: [
    "Ура, пятница! Пусть вечер будет весёлым, а выходные — тёплыми и радостными.",
    "Неделя позади — впереди отдых! Хорошего настроения и приятных планов на выходные." ] },
  { id: "jubilee", name: "Юбилей", emoji: "🏆", title: "С юбилеем", designs: ["frame", "fireworks", "roses", "balloons"], wishes: [
    "Поздравляем с юбилеем! Крепкого здоровья, бодрости, любви близких и долгих счастливых лет.",
    "Пусть годы будут мудростью, а каждый новый день — радостью. С юбилеем!" ] },
  { id: "sep1", name: "1 Сентября", emoji: "📚", date: [9, 1], title: "С Днём знаний", designs: ["school", "balloons", "garland"], wishes: [
    "Пусть учёба будет интересной, оценки — отличными, а друзья — верными. Удачного учебного года!",
    "С 1 Сентября! Новых знаний, ярких открытий и радости от каждого дня." ] },
  { id: "teacher", name: "День учителя", emoji: "🍎", title: "С Днём учителя", designs: ["school", "wreath", "frame"], wishes: [
    "Спасибо за знания, терпение и доброе сердце! Пусть ученики радуют, а работа приносит вдохновение.",
    "С праздником! Здоровья, сил и благодарных учеников." ] },
  { id: "grad", name: "Выпускной", emoji: "🎓", title: "С выпускным", designs: ["school", "party", "fireworks"], wishes: [
    "Поздравляем с выпускным! Пусть впереди ждёт яркая дорога, интересное дело и исполнение мечты.",
    "Новая жизнь начинается! Смело вперёд — у тебя всё получится." ] },
  { id: "medic", name: "День медика", emoji: "🩺", nth: [6, 0, 3], title: "С Днём медицинского работника", designs: ["wreath", "meadow", "frame"], wishes: [
    "Спасибо за заботу, профессионализм и доброе сердце! Крепкого здоровья вам и вашим близким.",
    "С праздником! Пусть благодарность пациентов вдохновляет, а сил всегда хватает." ] },
  { id: "builder", name: "День строителя", emoji: "🏗", nth: [8, 0, 2], title: "С Днём строителя", designs: ["house", "emblem", "frame"], wishes: [
    "С профессиональным праздником! Надёжных проектов, удачи и крепкого здоровья.",
    "Пусть всё построенное стоит веками, а работа приносит радость и достаток." ] },
  { id: "family", name: "День семьи", emoji: "👨‍👩‍👧", date: [7, 8], title: "С Днём семьи, любви и верности", designs: ["wreath", "hearts", "house", "meadow"], wishes: [
    "Пусть в доме всегда будут любовь, тепло и согласие, а семья — самой надёжной опорой.",
    "Желаю семейного счастья, взаимопонимания и радостных моментов вместе!" ] },
  { id: "angel", name: "День ангела", emoji: "😇", title: "С Днём ангела", designs: ["wreath", "night", "frame"], wishes: [
    "Пусть Ангел-хранитель оберегает от бед, а жизнь будет наполнена светом и добром.",
    "С именинами! Мира в душе, здоровья и тепла близких." ] },
  { id: "housewarming", name: "Новоселье", emoji: "🏡", title: "С новосельем", designs: ["house", "garland", "balloons"], wishes: [
    "Пусть новый дом будет уютным и тёплым, полным смеха, гостей и счастливых дней!",
    "С новосельем! Пусть в этих стенах живут радость, любовь и достаток." ] },
  { id: "maslenitsa", name: "Масленица", emoji: "🥞", maslenitsa: true, title: "С Масленицей", designs: ["pancakes", "garland", "sunrise"], wishes: [
    "Пусть Масленица принесёт весеннее тепло, вкусные блины и весёлые встречи!",
    "Масленица идёт — блины несёт! Пусть все печали уйдут вместе с зимой." ] },
  { id: "elders", name: "День пожилых людей", emoji: "🌷", date: [10, 1], title: "С Днём пожилых людей", designs: ["wreath", "meadow", "roses"], wishes: [
    "Крепкого здоровья, бодрости духа и любви родных. Спасибо за вашу мудрость и тепло!",
    "Пусть каждый день будет светлым и спокойным, а рядом всегда будут близкие." ] },
  { id: "miss", cat: "just", name: "Скучаю", emoji: "🥺", title: "Я скучаю", nameFirst: true, designs: ["hearts", "night", "watercolor"], wishes: [
    "Очень скучаю по тебе! Считаю дни до нашей встречи и обнимаю крепко-крепко.",
    "Без тебя всё не так. Просто хочу сказать: я скучаю и очень жду встречи." ] },
  { id: "hug", cat: "just", name: "Обнимаю", emoji: "🤗", title: "Обнимаю тебя", nameFirst: true, designs: ["hearts", "watercolor", "lavender"], wishes: [
    "Отправляю тебе самые тёплые объятия! Пусть они согреют и поднимут настроение.",
    "Крепко обнимаю! Пусть сегодня тебе будет тепло, спокойно и радостно." ] },
  { id: "sorry", cat: "just", name: "Прости", emoji: "🙏", title: "Прости меня", nameFirst: true, designs: ["roses", "watercolor", "minimal"], wishes: [
    "Прости меня, пожалуйста. Мне очень жаль — ты очень дорогой для меня человек.",
    "Мне жаль, что так вышло. Давай забудем обиды и снова будем улыбаться." ] },
  { id: "cheer", cat: "just", name: "Не грусти", emoji: "🌈", title: "Не грусти", nameFirst: true, designs: ["rainbow", "sunrise", "meadow"], wishes: [
    "Не грусти! Всё обязательно наладится, а я всегда рядом и верю в тебя.",
    "Пусть все тучи разойдутся, а впереди будет только солнце. Улыбнись!" ] },
  { id: "proud", cat: "just", name: "Горжусь тобой", emoji: "🏆", title: "Я горжусь тобой", nameFirst: true, designs: ["luxe", "fireworks", "emblem"], wishes: [
    "Ты большой молодец! Я так горжусь тобой и твоими успехами.",
    "У тебя получилось! Это настоящая победа, и она заслуженная. Горжусь!" ] },
  { id: "firstsnow", cat: "just", name: "С первым снегом", emoji: "❄️", title: "С первым снегом", designs: ["winter", "night", "minimal"], wishes: [
    "С первым снегом! Пусть он принесёт свежесть, волшебство и предвкушение праздников.",
    "Первый снег — к чуду! Загадай желание, пока падают снежинки." ] },
  { id: "newcar", cat: "just", name: "С новой машиной", emoji: "🚗", title: "С новой машиной", designs: ["luxe", "fireworks", "neon"], wishes: [
    "Поздравляю с новой машиной! Пусть дороги будут ровными, а каждая поездка — приятной.",
    "Ровных дорог, зелёного света и полного бака! Пусть машина служит долго и радует каждый день." ] },
  { id: "retire", cat: "just", name: "С выходом на пенсию", emoji: "🌻", title: "С выходом на пенсию", designs: ["meadow", "sunrise", "wreath"], wishes: [
    "Поздравляем с заслуженным отдыхом! Пусть впереди будет много свободного времени, здоровья и радостных дней.",
    "Начинается новая счастливая глава! Время для себя, семьи, путешествий и любимых дел." ] },
  { id: "grandchild", cat: "just", name: "С рождением внука", emoji: "👶", title: "С рождением внука", designs: ["baby", "balloons", "rainbow"], wishes: [
    "Поздравляем с рождением внука! Пусть малыш растёт здоровым и приносит много радости.",
    "Теперь вы бабушка и дедушка — самое тёплое звание на свете! Счастья вашей большой семье." ] },
  { id: "metday", cat: "just", name: "День знакомства", emoji: "💞", title: "С днём нашего знакомства", designs: ["hearts", "candles", "night"], wishes: [
    "Ровно в этот день мы встретились — и моя жизнь стала ярче. Спасибо, что ты есть!",
    "С днём нашего знакомства! Пусть впереди будет ещё много счастливых лет вместе." ] },
  { id: "oldny", name: "Старый Новый год", emoji: "🎄", date: [1, 14], title: "Со Старым Новым годом", designs: ["winter", "baubles", "fireworks"], wishes: [
    "Со Старым Новым годом! Пусть праздник продлится, а все добрые желания сбудутся.",
    "Ещё один повод загадать желание! Счастья, здоровья и удачи в новом году." ] },
  { id: "epiphany", name: "Крещение", emoji: "🕊", date: [1, 19], title: "С Крещением Господним", designs: ["winter", "night", "frame"], wishes: [
    "С Крещением Господним! Пусть этот светлый праздник очистит душу и принесёт благодать в дом.",
    "Мира, здоровья и Божьей помощи во всех добрых делах! Со светлым праздником Крещения." ] },
  { id: "tatiana", name: "Татьянин день", emoji: "🎓", date: [1, 25], title: "С Татьяниным днём", designs: ["wreath", "school", "winter"], wishes: [
    "С Татьяниным днём! Всем Татьянам — счастья и любви, а студентам — лёгкой сессии!",
    "С Днём студента! Пусть знания даются легко, а студенческие годы будут яркими." ] },
  { id: "apr1", name: "1 апреля", emoji: "🤡", date: [4, 1], title: "С Днём смеха", designs: ["party", "balloons", "rainbow"], wishes: [
    "С Днём смеха! Пусть улыбок будет больше, чем серьёзных дел, а шутки — только добрыми!",
    "Смейся чаще — это бесплатно и очень полезно для здоровья!" ] },
  { id: "may1", name: "1 Мая", emoji: "🌷", date: [5, 1], title: "С 1 Мая", designs: ["tulips", "meadow", "sunrise"], wishes: [
    "С Праздником весны и труда! Пусть работа приносит радость, а весна — вдохновение.",
    "Мир, труд, май! Тёплых дней, хорошего отдыха и весеннего настроения." ] },
  { id: "victory", name: "День Победы", emoji: "🎖", date: [5, 9], title: "С Днём Победы", designs: ["fireworks", "emblem", "frame"], wishes: [
    "С Днём Победы! Вечная память героям и мирного неба над головой.",
    "Низкий поклон ветеранам и светлая память всем, кто подарил нам мир. С праздником Победы!" ] },
  { id: "trinity", name: "Троица", emoji: "🌿", easterOffset: 49, title: "Со Святой Троицей", designs: ["meadow", "wreath", "sunrise"], wishes: [
    "Со Святой Троицей! Пусть в доме будут мир, любовь и согласие, а душа наполнится светом.",
    "Светлого праздника Троицы! Здоровья, тепла и Божьей благодати вам и вашим близким." ] },
  { id: "children", name: "День защиты детей", emoji: "🧸", date: [6, 1], title: "С Днём защиты детей", designs: ["balloons", "rainbow", "baby"], wishes: [
    "С Днём защиты детей! Пусть каждый ребёнок растёт в любви, заботе и счастье.",
    "Пусть детство будет ярким, беззаботным и полным чудес!" ] },
  { id: "independence", name: "День Независимости", emoji: "🇧🇾", date: [7, 3], title: "С Днём Независимости", designs: ["fireworks", "emblem", "luxe"], wishes: [
    "С Днём Независимости! Мира, благополучия и процветания нашей родной земле.",
    "Пусть над родной землёй всегда будет мирное небо, а в каждом доме — счастье и достаток." ] },
  { id: "kupala", name: "Купалье", emoji: "🔥", date: [7, 7], title: "С Купальем", designs: ["meadow", "night", "wreath"], wishes: [
    "С праздником Купалья! Пусть найдётся свой цветок папоротника, а все мечты сбудутся.",
    "Тёплой летней ночи, ярких костров и самых смелых желаний!" ] },
  { id: "honeyspas", name: "Медовый Спас", emoji: "🍯", date: [8, 14], title: "С Медовым Спасом", designs: ["meadow", "autumn", "sunrise"], wishes: [
    "С Медовым Спасом! Пусть жизнь будет сладкой, как мёд, а здоровье — крепким.",
    "Сладкой жизни, тёплых встреч и мира в доме!" ] },
  { id: "applespas", name: "Яблочный Спас", emoji: "🍎", date: [8, 19], title: "С Яблочным Спасом", designs: ["autumn", "meadow", "wreath"], wishes: [
    "С Яблочным Спасом! Пусть урожай будет богатым, а жизнь — сладкой и наливной.",
    "Здоровья, достатка и мира вашему дому в этот светлый праздник!" ] },
  { id: "unity", name: "День народного единства", emoji: "🤝", date: [9, 17], title: "С Днём народного единства", designs: ["emblem", "sunrise", "luxe"], wishes: [
    "С Днём народного единства! Мира, согласия и благополучия каждому дому.",
    "Пусть нас объединяют добро, уважение и любовь к родной земле!" ] },
  { id: "pokrov", name: "Покров", emoji: "⛪", date: [10, 14], title: "С Покровом Пресвятой Богородицы", designs: ["autumn", "frame", "wreath"], wishes: [
    "С Покровом Пресвятой Богородицы! Пусть Её покров хранит вас и ваших близких.",
    "Мира, любви и благодати вашему дому в этот светлый праздник!" ] },
  { id: "father", name: "День отца", emoji: "👨", date: [10, 21], title: "С Днём отца", designs: ["emblem", "luxe", "sunrise"], wishes: [
    "Папа, с Днём отца! Спасибо за твою силу, заботу и мудрость. Ты лучший!",
    "Поздравляем всех пап! Крепкого здоровья, терпения и радости за своих детей." ] },
  { id: "oct7", name: "7 ноября", emoji: "🎉", date: [11, 7], title: "С праздником 7 ноября", designs: ["fireworks", "emblem", "luxe"], wishes: [
    "С праздником 7 ноября! Мира, тепла и хорошего настроения.",
    "Пусть праздничный день будет наполнен радостью, встречами и добрыми словами!" ] },
  { id: "cxmas", name: "Рождество (25 декабря)", emoji: "🎅", date: [12, 25], title: "С Рождеством Христовым", designs: ["baubles", "winter", "frame"], wishes: [
    "С Рождеством! Пусть этот светлый праздник принесёт в дом мир, любовь и чудо.",
    "Веселого Рождества! Тепла, уюта и исполнения самых добрых желаний." ] },
  { id: "ceaster", name: "Пасха (католическая)", emoji: "🐣", ceaster: true, title: "С Пасхой", designs: ["easter", "tulips", "meadow"], wishes: [
    "С Пасхой! Пусть этот праздник принесёт весеннюю радость, надежду и мир в каждый дом.",
    "Светлой Пасхи! Любви, тепла и добра вам и вашим близким." ] }
];
const HOL = Object.fromEntries(HOLIDAYS.map(h => [h.id, h]));

/* ---------- fonts ---------- */
const FONTS = {
  lobster:  { n: "Lobster", t: "{s}px Lobster", b: "{s}px Kurale", s: "italic {s}px Kurale", k: 1, kb: 1 },
  marck:    { n: "Marck Script", t: "{s}px 'Marck Script'", b: "{s}px Kurale", s: "{s}px 'Marck Script'", k: 1.05, kb: 1 },
  bad:      { n: "Bad Script", t: "{s}px 'Bad Script'", b: "{s}px 'Bad Script'", s: "{s}px 'Bad Script'", k: .95, kb: 1 },
  caveat:   { n: "Caveat", t: "700 {s}px Caveat", b: "500 {s}px Caveat", s: "700 {s}px Caveat", k: 1.15, kb: 1.25 },
  playfair: { n: "Playfair Display", t: "italic 700 {s}px 'Playfair Display'", b: "{s}px 'Playfair Display'", s: "italic {s}px 'Playfair Display'", k: .9, kb: .95 },
  comfortaa:{ n: "Comfortaa", t: "700 {s}px Comfortaa", b: "500 {s}px Comfortaa", s: "700 {s}px Comfortaa", k: .78, kb: .88 },
  amatic:   { n: "Amatic SC", t: "700 {s}px 'Amatic SC'", b: "{s}px Kurale", s: "700 {s}px 'Amatic SC'", k: 1.3, kb: 1 },
  pacifico: { n: "Pacifico", t: "{s}px Pacifico", b: "{s}px Kurale", s: "{s}px Pacifico", k: .82, kb: 1 },
  greatvibes:{ n: "Great Vibes", t: "{s}px 'Great Vibes'", b: "italic 500 {s}px 'Cormorant Garamond'", s: "{s}px 'Great Vibes'", k: 1.15, kb: 1.12 },
  comforter:{ n: "Comforter", t: "{s}px Comforter", b: "italic 500 {s}px 'Cormorant Garamond'", s: "{s}px Comforter", k: 1.25, kb: 1.12 },
  yeseva:   { n: "Yeseva One", t: "{s}px 'Yeseva One'", b: "{s}px Lora", s: "italic {s}px Lora", k: .85, kb: .95 },
  poiret:   { n: "Poiret One", t: "{s}px 'Poiret One'", b: "{s}px 'Poiret One'", s: "{s}px 'Poiret One'", k: 1, kb: 1.08 },
  ruslan:   { n: "Ruslan Display", t: "{s}px 'Ruslan Display'", b: "{s}px 'PT Serif'", s: "italic {s}px 'PT Serif'", k: .78, kb: .95 },
  pangolin: { n: "Pangolin", t: "{s}px Pangolin", b: "{s}px Pangolin", s: "{s}px Pangolin", k: .95, kb: .98 },
  underdog: { n: "Underdog", t: "{s}px Underdog", b: "{s}px Neucha", s: "{s}px Underdog", k: .9, kb: 1.05 },
  doodle:   { n: "Rubik Doodle Shadow", t: "{s}px 'Rubik Doodle Shadow'", b: "{s}px Nunito", s: "700 {s}px Nunito", k: .8, kb: .95 },
  ponomar:  { n: "Ponomar", t: "{s}px Ponomar", b: "{s}px 'PT Serif'", s: "{s}px Ponomar", k: 1.05, kb: .95 },
  prata:    { n: "Prata", t: "{s}px Prata", b: "italic {s}px Lora", s: "italic {s}px Lora", k: .82, kb: .95 }
};
/* fonts for the greeting text, chosen separately from the title */
const BODY = {
  auto:      { n: "Как у заголовка" },
  kurale:    { n: "Kurale", b: "{s}px Kurale", kb: 1 },
  lora:      { n: "Lora", b: "{s}px Lora", kb: .95 },
  ptserif:   { n: "PT Serif", b: "{s}px 'PT Serif'", kb: .95 },
  cormorant: { n: "Cormorant", b: "italic 500 {s}px 'Cormorant Garamond'", kb: 1.12 },
  alice:     { n: "Alice", b: "{s}px Alice", kb: 1 },
  philosopher:{ n: "Philosopher", b: "{s}px Philosopher", kb: 1 },
  nunito:    { n: "Nunito", b: "600 {s}px Nunito", kb: .95 },
  montserrat:{ n: "Montserrat", b: "500 {s}px Montserrat", kb: .88 },
  comfortaa: { n: "Comfortaa", b: "500 {s}px Comfortaa", kb: .88 },
  neucha:    { n: "Neucha", b: "{s}px Neucha", kb: 1.08 },
  pangolin:  { n: "Pangolin", b: "{s}px Pangolin", kb: .98 },
  caveat:    { n: "Caveat", b: "500 {s}px Caveat", kb: 1.25 },
  badscript: { n: "Bad Script", b: "{s}px 'Bad Script'", kb: 1 },
  marmelad:  { n: "Marmelad", b: "{s}px Marmelad", kb: .98 },
  shantell:  { n: "Shantell", b: "500 {s}px 'Shantell Sans'", kb: .92 }
};
function fontSpecs(c){ const F = FONTS[c.f] || FONTS.lobster, B = BODY[c.bf]; return [F.t, F.b, F.s, B && B.b].filter(Boolean).map(x => x.replace("{s}", 40)); }
function ensureFonts(c){ return Promise.all(fontSpecs(c).map(x => document.fonts.load(x, "Аа").catch(() => {}))); }
async function loadFonts(){ try{ await ensureFonts({ f: "lobster" }); }catch(e){} }

/* ---------- text ---------- */
function wrap(ctx, text, maxW){
  const out = [];
  String(text).split("\n").forEach(par => {
    const words = par.split(/\s+/).filter(Boolean); let line = "";
    if(!words.length){ out.push(""); return; }
    words.forEach(w => { const t = line ? line + " " + w : w; if(ctx.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function titleLines(h, name){
  name = (name || "").trim();
  if(!name) return [{ t: h.title + "!", k: "title" }];
  return h.nameFirst ? [{ t: name + ",", k: "name" }, { t: h.title.charAt(0).toLowerCase() + h.title.slice(1) + "!", k: "title" }]
                     : [{ t: h.title + ",", k: "title" }, { t: name + "!", k: "name" }];
}
function drawText(ctx, L, c, reveal){
  const F = FONTS[c.f] || FONTS.lobster, h = HOL[c.h] || HOLIDAYS[0];
  const [ax, ay, aw, ah] = L.area, cx = ax + aw / 2;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const fnt = (tpl, s) => tpl.replace("{s}", Math.round(s));
  const blocks = [];
  titleLines(h, c.n).forEach(ln => {
    if(ln.k === "name"){ let s = 150 * F.k * (L.ts || 1); ctx.font = fnt(F.t, s); while(ctx.measureText(ln.t).width > aw && s > 50){ s -= 4; ctx.font = fnt(F.t, s); } blocks.push({ font: ctx.font, lines: [ln.t], lh: s * 1.12, col: L.name, hand: 1 }); }
    else { let s = 88 * F.k * (L.ts || 1); ctx.font = fnt(F.t, s); let lines = wrap(ctx, ln.t, aw); while(lines.length > 2 && s > 50){ s -= 4; ctx.font = fnt(F.t, s); lines = wrap(ctx, ln.t, aw); } blocks.push({ font: ctx.font, lines, lh: s * 1.14, col: L.title, hand: 1 }); }
  });
  const used = blocks.reduce((a, b) => a + b.lh * b.lines.length, 0);
  const body = (c.t || "").trim(), from = (c.fr || "").trim();
  const BF = BODY[c.bf] && BODY[c.bf].b ? BODY[c.bf] : null, bodyTpl = BF ? BF.b : F.b;
  let bs = 52 * (BF ? BF.kb : F.kb);
  if(body){
    let lines; for(; bs >= 24; bs -= 2){ ctx.font = fnt(bodyTpl, bs); lines = wrap(ctx, body, aw * .96); if(used + 36 + lines.length * bs * 1.34 + (from ? bs * 2 : 0) <= ah) break; }
    blocks.push({ font: ctx.font, lines, lh: bs * 1.34, col: L.body, gap: L.divider ? 70 : 36, div: !!L.divider });
  }
  if(from){ const s = Math.min(bs * 1.12, 54 * F.kb); ctx.font = fnt(F.s, s); blocks.push({ font: ctx.font, lines: wrap(ctx, from, aw), lh: s * 1.3, col: L.from || L.title, gap: body ? 26 : 36 }); }
  const total = blocks.reduce((a, b) => a + (b.gap || 0) + b.lh * b.lines.length, 0);
  let y = L.anchor === "top" ? ay : L.anchor === "bottom" ? ay + Math.max(0, ah - total) : ay + Math.max(0, (ah - total) / 2);
  if(L.plaque){ ctx.save(); ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fillStyle = L.plaque; rr(ctx, ax - 50, y - 50, aw + 100, total + 90, 36); ctx.fill(); ctx.restore();
    if(L.tape){ ctx.save(); ctx.translate(cx, y - 50); ctx.rotate(-.04); ctx.fillStyle = "rgba(240,160,180,.78)"; ctx.fillRect(-110, -24, 220, 48); ctx.fillStyle = "rgba(255,255,255,.35)"; for(let i = -100; i < 110; i += 26) ctx.fillRect(i, -24, 10, 48); ctx.restore(); } }
  ctx.save();
  if(L.shadow){ ctx.shadowColor = L.shadow; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; }
  let rT = 0;
  blocks.forEach((b, bi) => {
    y += b.gap || 0; if(b.div && typeof phDivider === "function" && (reveal == null || reveal > 1.2)){ ctx.save(); ctx.shadowColor = "transparent"; phDivider(ctx, cx, y - b.gap / 2 + 6, L.divider); ctx.restore(); } ctx.font = b.font; ctx.fillStyle = b.col;
    if(L.glow && typeof b.col === "string"){ ctx.shadowColor = b.col; ctx.shadowBlur = 26; ctx.shadowOffsetY = 0; }
    b.lines.forEach(t => { y += b.lh;
      if(reveal == null){ ctx.fillText(t, cx, y - b.lh * .24); return; }
      const dur = b.hand ? .9 : .45, k = Math.max(0, Math.min(1, (reveal - .25 - rT) / dur)); rT += b.hand ? .8 : .3; if(k <= 0) return;
      if(b.hand){ const tw = ctx.measureText(t).width + 60, x0 = cx - tw / 2, e = k < 1 ? k * (2 - k) : 1;
        ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20, y - b.lh * 1.3, tw * e + 20, b.lh * 1.6); ctx.clip(); ctx.fillText(t, cx, y - b.lh * .24); ctx.restore();
        if(k < 1){ ctx.save(); const px = x0 + tw * e, py = y - b.lh * .55; const g = ctx.createRadialGradient(px, py, 0, px, py, 34); g.addColorStop(0, "rgba(255,250,220,.95)"); g.addColorStop(1, "rgba(255,230,150,0)"); ctx.fillStyle = g; ctx.shadowColor = "transparent"; ctx.beginPath(); ctx.arc(px, py, 34, 0, 6.283); ctx.fill(); ctx.restore(); }
        return; }
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save(); ctx.globalAlpha = e; ctx.fillText(t, cx, y - b.lh * .24 + (1 - e) * 24); ctx.restore(); });
  });
  ctx.restore();
}

/* ---------- public ---------- */
function designOf(c){ return DESIGNS[c.d] || DESIGNS[(HOL[c.h] || HOLIDAYS[0]).designs[0]]; }
/* photo in a polaroid frame at the top of the text area; the text moves below it */
function drawPhoto(ctx, L, img){
  const [ax, ay, aw, ah] = L.area, ph = Math.min(aw * .62, ah * .5, 470), pw = ph * .9, cx = ax + aw / 2, top = ay - 10;
  ctx.save(); ctx.translate(cx, top + ph / 2 + 16); ctx.rotate(-.035);
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(-pw / 2 - 18, -ph / 2 - 18, pw + 36, ph + 58); ctx.shadowColor = "transparent";
  const s = Math.max(pw / img.width, ph / img.height), sw = pw / s, sh = ph / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -pw / 2, -ph / 2, pw, ph);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.save(); ctx.translate(0, -ph / 2 - 18); ctx.rotate(.05); ctx.fillRect(-60, -16, 120, 34); ctx.restore();
  ctx.restore();
  L.area = [ax, top + ph + 70, aw, Math.max(220, ah - ph - 80)];
}
/* business mode: logo + company name on a small plaque at the bottom */
function drawBrand(ctx, b){
  if(!b || (!b.logo && !b.name)) return;
  ctx.save(); ctx.font = "700 34px Nunito, sans-serif"; const tw = b.name ? Math.min(ctx.measureText(b.name).width, 620) : 0, lg = b.logo ? 70 : 0;
  const w = lg + tw + (lg && tw ? 20 : 0) + 56, h = 96, x = (W - w) / 2, y = H - h - 26;
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6; ctx.fillStyle = "rgba(255,255,255,.92)"; rr(ctx, x, y, w, h, 48); ctx.fill(); ctx.shadowColor = "transparent";
  let cx = x + 28;
  if(b.logo){ const s = Math.min(lg / b.logo.width, lg / b.logo.height); ctx.drawImage(b.logo, cx + (lg - b.logo.width * s) / 2, y + (h - b.logo.height * s) / 2, b.logo.width * s, b.logo.height * s); cx += lg + 20; }
  if(b.name){ ctx.fillStyle = "#2d1e2f"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(b.name, cx, y + h / 2 + 2, 620); }
  ctx.restore();
}
function drawScene(ctx, c){
  const d = designOf(c), p = d.pals[(c.p || 0) % d.pals.length], r = rng32(c.s || 1);
  ctx.save(); ctx.textAlign = "left"; const L = d.draw(ctx, r, p, c); ctx.restore();
  if(c.img && !d.frame) drawPhoto(ctx, L, c.img);
  if(c.brand && (c.brand.logo || c.brand.name)){ drawBrand(ctx, c.brand); L.area = [L.area[0], L.area[1], L.area[2], Math.min(L.area[3], 1200 - L.area[1])]; }
  return L;
}
/* small app watermark in the bottom-right corner; WATERMARK=false (or c.nowm for a future paid version) turns it off */
let WATERMARK = true;
function drawWatermark(ctx){
  ctx.save(); ctx.font = "800 25px Nunito, sans-serif"; const tw = ctx.measureText("Открытки").width, w = tw + 74, h = 50, x = W - w - 24, y = H - h - 24;
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillStyle = "rgba(255,255,255,.82)"; rr(ctx, x, y, w, h, 25); ctx.fill(); ctx.shadowColor = "transparent";
  const ex = x + 14, ey = y + 14; ctx.fillStyle = lin(ctx, ex, ey, ex + 34, ey + 24, ["#ff5f8f", "#ffb347"]); rr(ctx, ex, ey, 34, 23, 5); ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(ex + 3, ey + 4); ctx.lineTo(ex + 17, ey + 14); ctx.lineTo(ex + 31, ey + 4); ctx.stroke();
  ctx.fillStyle = "#e2557a"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("Открытки", ex + 44, y + h / 2 + 1);
  ctx.restore();
}
/* stickers: emoji or text badges ("t:Ура!"), positioned in card coordinates */
const BADGE_COLS = [["#ff5f8f", "#ffb347"], ["#7b2cbf", "#e2557a"], ["#06d6a0", "#118ab2"], ["#ffd166", "#ff8a5c"], ["#e7b65a", "#a67c2e"]];
function drawStickers(ctx, list){
  (list || []).forEach(st => { ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.r || 0);
    if(String(st.k).startsWith("t:")){ const txt = st.k.slice(2), fs = st.s * .42; ctx.font = `400 ${fs}px Lobster, cursive`; const tw = ctx.measureText(txt).width, w = tw + fs * 1.1, h = fs * 1.55;
      const cols = BADGE_COLS[(st.c || 0) % BADGE_COLS.length]; ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = fs * .3; ctx.shadowOffsetY = fs * .08;
      ctx.fillStyle = lin(ctx, -w / 2, 0, w / 2, 0, cols); rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = fs * .07; rr(ctx, -w / 2 + fs * .12, -h / 2 + fs * .12, w - fs * .24, h - fs * .24, h / 2); ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, 0, fs * .05); }
    else { ctx.font = `${st.s}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = st.s * .08; ctx.shadowOffsetY = st.s * .03; ctx.fillText(st.k, 0, st.s * .04); }
    ctx.restore(); });
}
function drawCard(ctx, c, opt = {}){ const L = drawScene(ctx, c); drawText(ctx, L, c); drawStickers(ctx, c.st); if(opt.wm !== false && WATERMARK && !c.nowm) drawWatermark(ctx); }
function renderCard(c, scale = 1){
  const cv = document.createElement("canvas"); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const ctx = cv.getContext("2d"); if(scale !== 1) ctx.scale(scale, scale); drawCard(ctx, c, { wm: scale >= .5 }); return cv;
}
function orthodoxEaster(y){ const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7; const m = Math.floor((d + e + 114) / 31), day = (d + e + 114) % 31 + 1; const dt = new Date(y, m - 1, day); dt.setDate(dt.getDate() + 13); return dt; }
function nextDate(h, now = new Date()){
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for(const y of [today.getFullYear(), today.getFullYear() + 1]){ const d = holidayDate(h, y); if(d && d >= today) return { date: d, days: Math.round((d - today) / 864e5) }; }
  return null;
}

/* nth weekday of month: [month 1-12, weekday 0=Sun, n] */
function nthWeekday(y, m, wd, n){ const d = new Date(y, m - 1, 1); const add = (wd - d.getDay() + 7) % 7; d.setDate(1 + add + (n - 1) * 7); return d; }
function holidayDate(h, y){
  if(h.easter) return orthodoxEaster(y);
  if(h.easterOffset){ const e = orthodoxEaster(y); e.setDate(e.getDate() + h.easterOffset); return e; }
  if(h.ceaster){ const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451), mo = Math.floor((hh + l - 7 * m + 114) / 31), da = (hh + l - 7 * m + 114) % 31 + 1; return new Date(y, mo - 1, da); }
  if(h.maslenitsa){ const e = orthodoxEaster(y); e.setDate(e.getDate() - 55); return e; }
  if(h.nth) return nthWeekday(y, h.nth[0], h.nth[1], h.nth[2]);
  if(h.date) return new Date(y, h.date[0] - 1, h.date[1]);
  return null;
}
/* the card shown on the home screen today */
function cardOfDay(now = new Date()){
  const today = HOLIDAYS.find(h => { const d = holidayDate(h, now.getFullYear()); return d && d.toDateString() === now.toDateString(); });
  const wd = now.getDay(), hr = now.getHours();
  const id = today ? today.id : wd === 5 ? "friday" : (wd === 6 || wd === 0) ? "weekend" : hr < 12 ? (wd === 1 ? "monday" : "morning") : hr >= 21 || hr < 5 ? "night" : hr >= 17 ? "evening" : "goodday";
  const h = HOL[id], seed = now.getFullYear() * 1000 + now.getMonth() * 40 + now.getDate();
  return { h: id, d: h.designs[seed % h.designs.length], p: seed % 3, s: seed, n: "", t: h.wishes[seed % h.wishes.length], f: ["lobster", "marck", "playfair", "caveat"][seed % 4], fr: "" };
}

/* ---------- extra motifs for the 2nd style pack ---------- */
function wcBlob(ctx, r, x, y, R, col, a){
  for(let k = 0; k < 3; k++){
    const n = 22, pts = []; const ox = (r() - .5) * R * .3, oy = (r() - .5) * R * .3, rr0 = R * (1 - k * .18);
    for(let i = 0; i < n; i++){ const t = i / n * TAU; pts.push([x + ox + Math.cos(t) * rr0 * (.75 + r() * .4), y + oy + Math.sin(t) * rr0 * (.75 + r() * .4)]); }
    ctx.beginPath(); for(let i = 0; i <= n; i++){ const p = pts[i % n], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; i ? ctx.quadraticCurveTo(p[0], p[1], mx, my) : ctx.moveTo(mx, my); } ctx.closePath();
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr0 * 1.1); g.addColorStop(0, rgba(col, a * .55)); g.addColorStop(.75, rgba(col, a)); g.addColorStop(1, rgba(shade(col, -.15), a * 1.2));
    ctx.fillStyle = g; ctx.fill();
  }
}
function splatter(ctx, r, n, cols, box, avoid){ for(let i = 0; i < n; i++){ const x = box[0] + r() * box[2], y = box[1] + r() * box[3]; if(inside(x, y, avoid, 20)) continue; ctx.fillStyle = rgba(cols[i % cols.length], .35 + r() * .45); ctx.beginPath(); ctx.arc(x, y, 1.5 + r() * r() * 9, 0, TAU); ctx.fill(); } }
function mapleLeaf(ctx, x, y, s, col, rot){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const pts = [[0,-1],[.18,-.55],[.45,-.72],[.38,-.3],[.82,-.38],[.6,-.05],[.95,.12],[.45,.25],[.42,.5],[.12,.32],[0,.62],[-.12,.32],[-.42,.5],[-.45,.25],[-.95,.12],[-.6,-.05],[-.82,-.38],[-.38,-.3],[-.45,-.72],[-.18,-.55]];
  ctx.fillStyle = lin(ctx, -s, -s, s, s, [shade(col, .25), col, shade(col, -.25)]);
  ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a * s, b * s) : ctx.moveTo(a * s, b * s)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(shade(col, -.4), .5); ctx.lineWidth = s * .04; ctx.beginPath(); ctx.moveTo(0, s * .9); ctx.lineTo(0, -s * .8); ctx.moveTo(0, s * .1); ctx.lineTo(s * .7, -s * .25); ctx.moveTo(0, s * .1); ctx.lineTo(-s * .7, -s * .25); ctx.moveTo(0, s * .2); ctx.lineTo(s * .4, s * .4); ctx.moveTo(0, s * .2); ctx.lineTo(-s * .4, s * .4); ctx.stroke();
  ctx.restore();
}
function lineFlower(ctx, x, y, s, col, lw){
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * .1, -s * .4, -s * .15, -s * .8, s * .05, -s * 1.25); ctx.stroke();
  [[-.35, 1], [-.65, -1], [-.9, 1]].forEach(([t, d]) => { const yy = s * t, xx = Math.sin(t * 3) * s * .05; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + d * s * .3, yy - s * .05, xx + d * s * .42, yy - s * .22); ctx.quadraticCurveTo(xx + d * s * .2, yy - s * .2, xx, yy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xx + d * s * .05, yy - s * .04); ctx.lineTo(xx + d * s * .3, yy - s * .15); ctx.stroke(); });
  ctx.translate(s * .05, -s * 1.32);
  for(let i = 0; i < 6; i++){ ctx.save(); ctx.rotate(i * TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-s * .14, -s * .08, -s * .12, -s * .3, 0, -s * .3); ctx.bezierCurveTo(s * .12, -s * .3, s * .14, -s * .08, 0, 0); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, s * .045, 0, TAU); ctx.stroke();
  ctx.restore();
}
function flute(ctx, x, y, s, rot, liquid){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const bowl = () => { ctx.beginPath(); ctx.moveTo(-s * .22, -s); ctx.lineTo(s * .22, -s); ctx.bezierCurveTo(s * .24, -s * .45, s * .16, -s * .12, 0, -s * .05); ctx.bezierCurveTo(-s * .16, -s * .12, -s * .24, -s * .45, -s * .22, -s); ctx.closePath(); };
  ctx.save(); bowl(); ctx.clip(); ctx.fillStyle = lin(ctx, 0, -s * .8, 0, 0, [shade(liquid, .35), liquid, shade(liquid, -.15)]); ctx.fillRect(-s * .3, -s * .78, s * .6, s * .8);
  ctx.fillStyle = "rgba(255,255,255,.85)"; for(let i = 0; i < 14; i++){ ctx.beginPath(); ctx.arc((Math.sin(i * 7.1) * .14) * s, -s * (.12 + (i * .047)), s * (.008 + (i % 3) * .005), 0, TAU); ctx.fill(); } ctx.restore();
  bowl(); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = s * .018; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = s * .03; ctx.beginPath(); ctx.moveTo(0, -s * .05); ctx.lineTo(0, s * .42); ctx.stroke();
  ctx.lineWidth = s * .02; ctx.beginPath(); ctx.ellipse(0, s * .44, s * .16, s * .035, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = s * .012; ctx.beginPath(); ctx.moveTo(-s * .15, -s * .9); ctx.quadraticCurveTo(-s * .17, -s * .5, -s * .08, -s * .2); ctx.stroke();
  ctx.restore();
}
function candle(ctx, x, base, w, h, col){
  ctx.fillStyle = lin(ctx, x - w / 2, 0, x + w / 2, 0, [shade(col, -.2), shade(col, .2), shade(col, -.15)]); rr(ctx, x - w / 2, base - h, w, h, 10); ctx.fill();
  ctx.fillStyle = shade(col, .3); ctx.beginPath(); ctx.ellipse(x, base - h, w / 2, w * .12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(col, .15); ctx.beginPath(); ctx.moveTo(x + w * .3, base - h); ctx.quadraticCurveTo(x + w * .38, base - h + 40, x + w * .32, base - h + 70); ctx.quadraticCurveTo(x + w * .26, base - h + 40, x + w * .2, base - h + 4); ctx.fill();
  ctx.strokeStyle = "#3a2a20"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x, base - h - 18); ctx.stroke();
  glow(ctx, x, base - h - 50, 220, "#ffb347", .45); glow(ctx, x, base - h - 50, 70, "#fff1c1", .6);
  const fy = base - h - 16, g = ctx.createRadialGradient(x, fy - 26, 2, x, fy - 30, 34); g.addColorStop(0, "#fffbe6"); g.addColorStop(.45, "#ffd166"); g.addColorStop(1, "#ff7b00");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, fy - 84); ctx.bezierCurveTo(x + 24, fy - 40, x + 20, fy - 6, x, fy - 2); ctx.bezierCurveTo(x - 20, fy - 6, x - 24, fy - 40, x, fy - 84); ctx.fill();
}
function bulbWire(ctx, y0, sag, cols, x0 = -40, x1 = W + 40, n = 12){
  const q = t => { const mx = (x0 + x1) / 2, my = y0 + sag * 2, u = 1 - t; return [u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y0]; };
  ctx.strokeStyle = "rgba(40,40,30,.85)"; ctx.lineWidth = 3; ctx.beginPath(); for(let t = 0; t <= 1.001; t += .02){ const [x, y] = q(t); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  for(let i = 0; i < n; i++){ const [x, y] = q((i + .5) / n), c = cols[i % cols.length];
    glow(ctx, x, y + 34, 110, c, .45); ctx.fillStyle = "#2b2b2b"; ctx.fillRect(x - 7, y, 14, 14);
    const g = ctx.createRadialGradient(x - 4, y + 26, 2, x, y + 32, 22); g.addColorStop(0, "#ffffff"); g.addColorStop(.4, shade(c, .5)); g.addColorStop(1, c);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 34, 13, 21, 0, 0, TAU); ctx.fill(); }
}

const DESIGNS2 = {
  watercolor: { name: "Акварель", pals: [
    { bg: "#fffaf5", c: ["#f4978e", "#f8ad9d", "#fbc4ab", "#e5989b", "#b5838d"], title: "#b23a48", name: "#6d2e46", body: "#4f3a46" },
    { bg: "#f7f9ff", c: ["#a2d2ff", "#bde0fe", "#cdb4db", "#ffc8dd", "#8ecae6"], title: "#3d5a80", name: "#7b2cbf", body: "#33415c" },
    { bg: "#fbfff7", c: ["#b7e4c7", "#95d5b2", "#ffe5a5", "#ffd6a5", "#74c69d"], title: "#2d6a4f", name: "#bc4749", body: "#3a3a2a" } ],
    draw(ctx, r, p){
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      for(let i = 0; i < 220; i++){ ctx.fillStyle = rgba("#8a7a6a", r() * .04); ctx.fillRect(r() * W, r() * H, 2 + r() * 40, 1 + r() * 2); }
      ctx.save(); ctx.globalCompositeOperation = "multiply";
      [[60, 80, 300], [300, 30, 200], [40, 380, 170], [W - 60, H - 90, 320], [W - 320, H - 30, 210], [W - 40, H - 420, 180], [W - 80, 120, 120], [90, H - 150, 140]].forEach(([x, y, R], i) => wcBlob(ctx, r, x, y, R, p.c[i % p.c.length], .32));
      ctx.restore();
      const area = [150, 320, 780, 700]; splatter(ctx, r, 90, p.c, [0, 0, W, H], area);
      ctx.strokeStyle = gold(ctx, 0, 0, W, 0); ctx.lineWidth = 2; [[300, 290], [300, 1060]].forEach(([w, y]) => { ctx.beginPath(); ctx.moveTo(W / 2 - w / 2, y); ctx.lineTo(W / 2 + w / 2, y); ctx.stroke(); });
      return { area, title: p.title, name: p.name, body: p.body };
    } },
  neon: { name: "Неон", pals: [
    { bg: "#0b0820", wall: "#160f33", a: "#ff2bd6", b: "#22e4ff", c: "#ffe14d", title: "#ff7be8", name: "#7af4ff", body: "#f2ecff" },
    { bg: "#05140f", wall: "#0a2219", a: "#39ff88", b: "#ff3d6e", c: "#ffe14d", title: "#8dffb8", name: "#ff8aa5", body: "#e9fff3" } ],
    draw(ctx, r, p){
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = rgba("#ffffff", .035); ctx.lineWidth = 2; for(let y = 0; y < H; y += 60){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); for(let x = (y / 60) % 2 ? 0 : 60; x < W; x += 120){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke(); } }
      glow(ctx, W / 2, H / 2, 700, p.a, .16);
      const neon = (fn, col, w) => { ctx.save(); ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.shadowColor = col; [[w * 3, 40, .5], [w, 18, 1], [w * .4, 0, 1]].forEach(([lw, b, a], i) => { ctx.lineWidth = lw; ctx.shadowBlur = b; ctx.globalAlpha = a; if(i === 2) ctx.strokeStyle = "#ffffff"; fn(); ctx.stroke(); }); ctx.restore(); };
      neon(() => rr(ctx, 70, 70, W - 140, H - 140, 50), p.a, 8);
      const shapes = [
        (x, y) => heartPath(ctx, x, y, 150),
        (x, y) => { ctx.beginPath(); for(let i = 0; i < 10; i++){ const rad = i % 2 ? 30 : 72, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); },
        (x, y) => { ctx.beginPath(); ctx.moveTo(x - 160, y); for(let i = 0; i < 6; i++) ctx.quadraticCurveTo(x - 160 + i * 54 + 27, y - 40 + (i % 2) * 80, x - 160 + (i + 1) * 54, y); },
        (x, y) => { ctx.beginPath(); ctx.arc(x, y, 60, 0, TAU); ctx.moveTo(x, y - 60); ctx.lineTo(x, y + 60); ctx.moveTo(x - 60, y); ctx.lineTo(x + 60, y); },
        (x, y) => { ctx.beginPath(); ctx.moveTo(x - 70, y + 40); ctx.lineTo(x - 70, y - 30); ctx.lineTo(x - 35, y); ctx.lineTo(x, y - 50); ctx.lineTo(x + 35, y); ctx.lineTo(x + 70, y - 30); ctx.lineTo(x + 70, y + 40); ctx.closePath(); },
        (x, y) => { ctx.beginPath(); ctx.moveTo(x - 50, y + 60); ctx.lineTo(x - 50, y - 50); ctx.lineTo(x + 50, y - 70); ctx.lineTo(x + 50, y + 40); ctx.moveTo(x - 50, y - 15); ctx.lineTo(x + 50, y - 35); ctx.arc(x - 70, y + 60, 20, 0, TAU); ctx.moveTo(x + 50, y + 40); ctx.arc(x + 30, y + 40, 20, 0, TAU); },
        (x, y) => { ctx.beginPath(); for(let i = 0; i < 4; i++){ const a = i * Math.PI / 2; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 70, y + Math.sin(a) * 70); } ctx.moveTo(x + 30, y); ctx.arc(x, y, 30, 0, TAU); }
      ];
      const order = shapes.map((f, i) => [r(), f]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      [[200, 220], [880, 220], [220, 1130], [860, 1130]].forEach(([x, y], i) => neon(() => order[i](x + (r() - .5) * 30, y + (r() - .5) * 30), [p.b, p.c, p.a][Math.floor(r() * 3)], 6));
      return { area: [150, 340, 780, 700], title: p.title, name: p.name, body: p.body, glow: 1 };
    } },
  luxe: { name: "Золото на чёрном", pals: [
    { bg: ["#111111", "#000000"], title: "gold", name: "gold", body: "#efe3c8" },
    { bg: ["#1a1030", "#07040f"], title: "gold", name: "gold", body: "#ece4ff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); glow(ctx, W / 2, H * .45, 650, "#f6d38b", .1);
      for(let i = 0; i < 900; i++){ const y = Math.pow(r(), 1.6) * H * .5, x = r() * W; ctx.fillStyle = rgba("#f6d38b", r() * .8); ctx.beginPath(); ctx.arc(x, y, .6 + r() * 2.2, 0, TAU); ctx.fill(); }
      for(let i = 0; i < 70; i++){ const x = r() * W, y = H - Math.pow(r(), 1.5) * 420; ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU); ctx.fillStyle = gold(ctx, -14, -6, 14, 6); ctx.fillRect(-14, -5, 28, 10); ctx.restore(); }
      const G = gold(ctx, 0, 200, W, 1100); ctx.strokeStyle = G; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(W / 2, 690, 420, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, 690, 420, Math.PI * .08, Math.PI * .92); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(W / 2, 690, 440, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, 690, 440, Math.PI * .15, Math.PI * .85); ctx.stroke();
      sparkles(ctx, r, 14, "#fff1c1", [0, 0, W, H], 10, 26, [220, 360, 640, 680]);
      return { area: [190, 370, 700, 640], title: gold(ctx, 190, 370, 890, 600), name: gold(ctx, 190, 450, 890, 700), body: p.body, shadow: "rgba(0,0,0,.6)" };
    } },
  minimal: { name: "Минимализм", pals: [
    { bg: "#f6f1ea", line: "#7d8b6a", acc: "#d4a373", title: "#5c6b4a", name: "#2f3a26", body: "#4a4a40" },
    { bg: "#fbefef", line: "#c9737f", acc: "#e8b4b8", title: "#a64d5d", name: "#5e2a33", body: "#5a4448" },
    { bg: "#eef3f7", line: "#4f6d8a", acc: "#a3c4dc", title: "#3e5871", name: "#1f2f40", body: "#3c4a57" } ],
    draw(ctx, r, p){
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = rgba(p.line, .5); ctx.lineWidth = 2; ctx.strokeRect(60, 60, W - 120, H - 120);
      const flip = r() < .5; ctx.save(); if(flip){ ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.fillStyle = rgba(p.acc, .35); ctx.beginPath(); ctx.arc(200 + r() * 70, 1100 + r() * 60, 110 + r() * 50, 0, TAU); ctx.fill();
      lineFlower(ctx, 180 + r() * 40, 1290, 210 + r() * 60, p.line, 4); lineFlower(ctx, 280 + r() * 30, 1290, 140 + r() * 50, p.line, 3.5);
      ctx.save(); ctx.translate(W - 170 + (r() - .5) * 40, 240); ctx.scale(-1, 1); lineFlower(ctx, 0, 140, 150 + r() * 50, rgba(p.line, .7), 3); ctx.restore();
      for(let i = 0; i < 3; i++){ ctx.fillStyle = p.acc; ctx.beginPath(); ctx.arc(W - 150 + i * 26, H - 150, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
      return { area: [180, 270, 720, 650], title: p.title, name: p.name, body: p.body };
    } },
  papercut: { name: "Бумажные слои", pals: [
    { sky: ["#ffd6a5", "#ffadad"], layers: ["#ffc2b4", "#ff9e9e", "#f08080", "#d1495b", "#8e2c48"], sun: "#fff3b0", title: "#8e2c48", name: "#ffffff", body: "#ffffff" },
    { sky: ["#caf0f8", "#90e0ef"], layers: ["#90e0ef", "#48cae4", "#00b4d8", "#0077b6", "#03045e"], sun: "#ffffff", title: "#03045e", name: "#ffffff", body: "#ffffff" },
    { sky: ["#e9f5db", "#cfe1b9"], layers: ["#b5c99a", "#97a97c", "#718355", "#4f6b3a", "#2d4122"], sun: "#fff8dc", title: "#2d4122", name: "#ffffff", body: "#ffffff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); glow(ctx, 760, 300, 260, p.sun, .7); ctx.fillStyle = p.sun; ctx.beginPath(); ctx.arc(760, 300, 95, 0, TAU); ctx.fill();
      cloud(ctx, 250, 230, 50, "#ffffff", .8);
      p.layers.forEach((col, i) => { const base = 470 + i * 130, amp = 70 - i * 6, ph = r() * 6;
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = -8; ctx.fillStyle = lin(ctx, 0, base - amp, 0, H, [shade(col, .1), col]);
        ctx.beginPath(); ctx.moveTo(0, H); for(let x = 0; x <= W; x += 20) ctx.lineTo(x, base + Math.sin(x / (170 - i * 12) + ph) * amp + Math.sin(x / 63 + ph * 2) * amp * .25); ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); ctx.restore(); });
      return { area: [130, 700, 820, 580], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.35)" };
    } },
  lights: { name: "Огоньки", pals: [
    { bg: ["#0d1b3e", "#1d1347"], c: ["#ffd166", "#ff6b9d", "#7bf1a8", "#7cc4ff", "#ff9f43"], title: "#ffd166", name: "#ffffff", body: "#eef0ff" },
    { bg: ["#2a0f1e", "#12060d"], c: ["#ffe08a", "#ffcf6e", "#fff3c4", "#ffb347"], title: "#ffe08a", name: "#ffffff", body: "#fff3e6" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 30, p.c[0], 20, 90, .18, [150, 380, 780, 640]); bokeh(ctx, r, 20, p.c[1], 20, 80, .14, [150, 380, 780, 640]);
      bulbWire(ctx, -20, 80, p.c, -40, W + 40, 11); bulbWire(ctx, 150, 60, p.c.slice().reverse(), -40, W + 40, 9);
      bulbWire(ctx, H - 230, 50, p.c, -40, W + 40, 10);
      return { area: [140, 400, 800, 620], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.5)" };
    } },
  champagne: { name: "Шампанское", pals: [
    { bg: ["#3d0f22", "#1c0711"], liq: "#f6d38b", title: "#f6d38b", name: "#ffffff", body: "#ffeef4" },
    { bg: ["#0f1d3d", "#060c1c"], liq: "#f6d38b", title: "#f6d38b", name: "#ffffff", body: "#e8eeff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); glow(ctx, W / 2, 330, 420, "#f6d38b", .25);
      for(let i = 0; i < 300; i++){ const x = r() * W, y = r() * H; if(inside(x, y, [140, 560, 800, 650])) continue; ctx.fillStyle = rgba("#f6d38b", r() * .7); ctx.beginPath(); ctx.arc(x, y, .7 + r() * 2.3, 0, TAU); ctx.fill(); }
      flute(ctx, W / 2 - 60, 470, 380, -.24, p.liq); flute(ctx, W / 2 + 60, 470, 380, .24, p.liq);
      ctx.strokeStyle = "rgba(255,241,193,.8)"; ctx.lineWidth = 3; ctx.lineCap = "round"; for(let i = 0; i < 9; i++){ const a = -Math.PI / 2 + (i - 4) * .22; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * 60, 120 + Math.sin(a) * 60 + 30); ctx.lineTo(W / 2 + Math.cos(a) * 110, 120 + Math.sin(a) * 110 + 30); ctx.stroke(); }
      sparkle(ctx, W / 2, 150, 26, "#fff1c1");
      for(let i = 0; i < 50; i++){ const x = r() * W, y = H - r() * 300; ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU); ctx.fillStyle = r() < .5 ? "#f6d38b" : "#ffffff"; ctx.fillRect(-10, -4, 20, 8); ctx.restore(); }
      return { area: [140, 600, 800, 600], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.5)" };
    } },
  candles: { name: "Свечи", pals: [
    { bg: ["#2b1a14", "#120a07"], c: ["#fff4e0", "#f6e3c8", "#ffe9d6"], petal: "#c9184a", title: "#ffd6a5", name: "#ffffff", body: "#fff1e0" },
    { bg: ["#1e1530", "#0b0714"], c: ["#f3e8ff", "#e9dcff", "#fff4fb"], petal: "#ff8fab", title: "#ffd6a5", name: "#ffffff", body: "#f6f0ff" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 24, "#ffb347", 20, 90, .2, [140, 180, 800, 640]);
      candle(ctx, 300, 1290, 150, 320, p.c[0]); candle(ctx, 780, 1290, 140, 250, p.c[1]); candle(ctx, 540, 1310, 170, 390, p.c[2]);
      for(let i = 0; i < 22; i++){ const x = r() * W, y = 1230 + r() * 110; ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU); ctx.fillStyle = lin(ctx, -20, -12, 20, 12, [shade(p.petal, .3), p.petal]); ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      return { area: [140, 170, 800, 600], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.5)" };
    } },
  sakura: { name: "Сакура", pals: [
    { sky: ["#fff0f5", "#e0f2ff"], br: "#5e3a2e", f: ["#ffc8dd", "#ffafcc", "#ffe5ec"], title: "#c9184a", name: "#590d22", body: "#4a3a40" },
    { sky: ["#2b2d42", "#4a4e69"], br: "#1b1b2a", f: ["#ffc8dd", "#ffafcc", "#ffffff"], title: "#ffc8dd", name: "#ffffff", body: "#f1ecff", dark: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); if(p.dark) crescent(ctx, 860, 1060, 70, "#fff3b0");
      const branch = (x0, y0, pts, w) => { ctx.strokeStyle = p.br; ctx.lineCap = "round"; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); pts.forEach(q => ctx.quadraticCurveTo(...q)); ctx.stroke(); };
      branch(-20, 40, [[200, 120, 380, 110], [520, 100, 640, 210]], 30); branch(220, 105, [[300, 220, 280, 330]], 14); branch(420, 110, [[470, 30, 600, 20]], 12); branch(640, 210, [[720, 260, 760, 360]], 10);
      const spots = [[60, 70], [150, 110], [240, 140], [290, 250], [270, 330], [380, 100], [470, 50], [590, 25], [520, 120], [610, 200], [700, 260], [750, 350], [330, 190], [440, 160]];
      spots.forEach(([x, y], i) => { for(let k = 0; k < 2; k++) flower(ctx, x + (r() - .5) * 50, y + (r() - .5) * 40, 30 + r() * 18, p.f[(i + k) % p.f.length], "blossom", r() * TAU, "#ff8fab"); });
      for(let i = 0; i < 45; i++){ const x = r() * W, y = 300 + r() * (H - 300); if(inside(x, y, [140, 470, 800, 640])) continue; ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU); ctx.fillStyle = rgba(p.f[i % 3], .9); ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      return { area: [140, 470, 800, 640], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.4)" : null };
    } },
  lavender: { name: "Лаванда", pals: [
    { sky: ["#ffcfd2", "#f1c0e8", "#cfbaf0"], field: ["#b19cd9", "#9d7ad2", "#7b5cc4"], title: "#5a189a", name: "#3c096c", body: "#3d2c5a" },
    { sky: ["#a3c4f3", "#cfbaf0", "#fde4cf"], field: ["#c3a6ff", "#a57cf2", "#8a5fe0"], title: "#3c096c", name: "#7b2cbf", body: "#2d2340" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); glow(ctx, W / 2, 760, 380, "#fff3b0", .7); ctx.fillStyle = "#fff6d5"; ctx.beginPath(); ctx.arc(W / 2, 770, 90, Math.PI, 0); ctx.fill();
      ctx.fillStyle = lin(ctx, 0, 770, 0, H, [shade(p.field[0], .35), "#7a9a5a", "#4f772d"]); ctx.fillRect(0, 770, W, H - 770);
      const vx = W / 2, vy = 770;
      for(let k = -9; k <= 9; k++){ const xb = W / 2 + k * 170;
        ctx.fillStyle = lin(ctx, 0, vy, 0, H, [shade(p.field[0], .3), p.field[1], p.field[2]]);
        ctx.beginPath(); ctx.moveTo(vx + k * 4, vy); ctx.lineTo(xb - 55, H); ctx.lineTo(xb + 55, H); ctx.lineTo(vx + k * 4 + 3, vy); ctx.closePath(); ctx.fill(); }
      for(let i = 0; i < 260; i++){ const k = Math.floor(r() * 19) - 9, t = .45 + r() * .55, y = vy + t * (H - vy), x = vx + k * 4 + (W / 2 + k * 170 - vx - k * 4) * t + (r() - .5) * 90 * t, h = 30 + t * 90;
        ctx.strokeStyle = "#3f6b2a"; ctx.lineWidth = 2 + t * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - .5) * 8, y - h); ctx.stroke();
        for(let j = 0; j < 6; j++){ ctx.fillStyle = p.field[(i + j) % 3]; ctx.beginPath(); ctx.ellipse(x + (j % 2 ? 2 : -2) * t, y - h + j * h * .07, 3 + t * 3.5, 5 + t * 6, j % 2 ? .3 : -.3, 0, TAU); ctx.fill(); } }
      butterfly(ctx, 860, 640, 34, "#ffffff", .3);
      return { area: [110, 150, 860, 560], title: p.title, name: p.name, body: p.body };
    } },
  autumn: { name: "Осенние листья", pals: [
    { bg: ["#fff1e0", "#ffd8b1"], c: ["#e76f51", "#f4a261", "#e9c46a", "#d62828", "#bc6c25"], title: "#9c2c13", name: "#6a2c0f", body: "#4a2f1f" },
    { bg: ["#3d2b1f", "#1f150e"], c: ["#e76f51", "#f4a261", "#e9c46a", "#d62828", "#ffb703"], title: "#ffb703", name: "#ffffff", body: "#fff1e0", dark: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); glow(ctx, W / 2, H / 2, 600, "#ffffff", p.dark ? .05 : .4);
      const area = [150, 350, 780, 640];
      for(let i = 0; i < 46; i++){ const x = r() * W, y = r() * H; if(inside(x, y, area, 30)) continue; mapleLeaf(ctx, x, y, 34 + r() * 52, p.c[i % p.c.length], r() * TAU); }
      for(let i = 0; i < 20; i++){ const x = r() * W, y = r() * H; if(inside(x, y, area, 20)) continue; leaf(ctx, x, y, 50 + r() * 40, r() * TAU, p.c[(i + 2) % p.c.length]); }
      return { area, title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.45)" : null };
    } },
  sea: { name: "Море", pals: [
    { sky: ["#8ecae6", "#cdeefc", "#fff6e5"], sea: ["#219ebc", "#126782", "#023047"], sand: "#f5deb3", title: "#023047", name: "#fb8500", body: "#14343f" },
    { sky: ["#ffafcc", "#ffd6a5", "#fff1d6"], sea: ["#5fa8d3", "#1b4965", "#0d2c40"], sand: "#f6d7b0", title: "#1b4965", name: "#e85d75", body: "#2b2d42" } ],
    draw(ctx, r, p){
      const sunx = r() < .5 ? 160 + r() * 140 : 760 + r() * 140; vbg(ctx, p.sky); glow(ctx, sunx, 160, 240, "#fff3b0", .8); ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(sunx, 160, 60 + r() * 20, 0, TAU); ctx.fill();
      for(let i = 0; i < 3; i++) cloud(ctx, 100 + r() * (W - 200), 120 + r() * 160, 35 + r() * 25, "#ffffff", .7 + r() * .2);
      ctx.strokeStyle = "#2b2d42"; ctx.lineWidth = 4; ctx.lineCap = "round"; Array.from({ length: 2 + Math.floor(r() * 3) }, () => [150 + r() * (W - 300), 250 + r() * 100, 20 + r() * 14]).forEach(([x, y, s]) => { ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x - s / 2, y - s / 2, x, y); ctx.quadraticCurveTo(x + s / 2, y - s / 2, x + s, y); ctx.stroke(); });
      p.sea.forEach((c, i) => { const y0 = 900 + i * 80; ctx.fillStyle = lin(ctx, 0, y0, 0, y0 + 200, [c, shade(c, -.2)]); ctx.beginPath(); ctx.moveTo(0, H); for(let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 90 + i * 2) * 14); ctx.lineTo(W, H); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; ctx.beginPath(); for(let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 90 + i * 2) * 14); ctx.stroke(); });
      ctx.fillStyle = lin(ctx, 0, 1150, 0, H, [shade(p.sand, .2), p.sand]); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 1200); ctx.quadraticCurveTo(W * .5, 1110, W, 1180); ctx.lineTo(W, H); ctx.fill();
      const left = r() < .5; ctx.save(); ctx.translate(left ? 230 + r() * 80 : 780 + r() * 80, 1250 + r() * 30); ctx.rotate(r() * TAU); star5(ctx, 0, 0, 52, "#f77f00"); ctx.fillStyle = "#fcbf49"; for(let i = 0; i < 5; i++){ const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 4, 0, TAU); ctx.fill(); } ctx.restore();
      ctx.save(); ctx.translate(left ? 780 + r() * 80 : 230 + r() * 80, 1265 + r() * 20); ctx.rotate((r() - .5) * .6); ctx.fillStyle = "#ffcdb2"; ctx.beginPath(); ctx.moveTo(0, 20); for(let i = 0; i <= 8; i++){ const a = Math.PI + i * Math.PI / 8; ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#e5989b"; ctx.lineWidth = 3; for(let i = 1; i < 8; i++){ const a = Math.PI + i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); ctx.stroke(); } ctx.restore();
      return { area: [110, 370, 860, 500], title: p.title, name: p.name, body: p.body };
    } },
  rainbow: { name: "Радуга", pals: [
    { bg: ["#e0f7ff", "#fff8e7"], title: "#ef476f", name: "#3a0ca3", body: "#2b2d42" },
    { bg: ["#fff0f6", "#f3f0ff"], title: "#9b5de5", name: "#f15bb5", body: "#3d2c5a" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg);
      ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 46; ctx.beginPath(); ctx.arc(W / 2, 560, 420 - i * 44, Math.PI, 0); ctx.stroke(); });
      cloud(ctx, 150, 560, 90, "#ffffff"); cloud(ctx, W - 150, 560, 90, "#ffffff");
      for(let i = 0; i < 14; i++){ const x = r() * W, y = 640 + r() * 690; if(inside(x, y, [130, 640, 820, 560])) continue; star5(ctx, x, y, 14 + r() * 18, ["#ffca3a", "#ff595e", "#1982c4", "#8ac926"][i % 4], r()); }
      return { area: [130, 650, 820, 560], title: p.title, name: p.name, body: p.body };
    } }
};
Object.assign(DESIGNS, DESIGNS2);
const MORE_DESIGNS = { bday: ["watercolor", "neon", "luxe", "lights", "champagne", "rainbow", "minimal"], ny: ["lights", "champagne", "luxe", "neon"], xmas: ["lights", "minimal", "papercut"], feb14: ["candles", "neon", "watercolor", "minimal"], feb23: ["luxe", "papercut"], mar8: ["watercolor", "sakura", "minimal", "lavender"], easter: ["sakura", "watercolor"], mom: ["watercolor", "sakura", "lavender", "minimal"], wedding: ["watercolor", "champagne", "candles", "minimal", "luxe"], anniv: ["champagne", "candles", "luxe"], baby: ["rainbow", "watercolor"], morning: ["sea", "lavender", "papercut", "sakura"], night: ["candles", "lights", "papercut"], weekend: ["sea", "papercut", "lavender"], love: ["candles", "neon", "watercolor"], thanks: ["watercolor", "minimal", "lavender"], health: ["rainbow", "sakura", "sea"], goodday: ["sea", "lavender", "minimal", "papercut"], monday: ["papercut", "minimal"], friday: ["neon", "lights", "champagne"], jubilee: ["luxe", "champagne", "watercolor"], sep1: ["autumn", "rainbow"], teacher: ["autumn", "watercolor", "minimal"], grad: ["neon", "luxe", "champagne"], medic: ["minimal", "watercolor"], builder: ["papercut"], family: ["watercolor", "papercut"], angel: ["watercolor", "candles"], housewarming: ["lights", "papercut"], elders: ["autumn", "lavender", "watercolor"] };
Object.entries(MORE_DESIGNS).forEach(([h, ds]) => { if(HOL[h]) ds.forEach(d => { if(!HOL[h].designs.includes(d)) HOL[h].designs.push(d); }); });

/* ---------- cats (original drawings) ---------- */
function pawPrint(ctx, x, y, s, col, rot){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, s * .25, s * .42, s * .34, 0, 0, TAU); ctx.fill();
  [[-.48, -.2, .15], [-.18, -.48, .16], [.18, -.48, .16], [.48, -.2, .15]].forEach(([a, b, k]) => { ctx.beginPath(); ctx.ellipse(a * s, b * s, k * s, k * 1.25 * s, a * .5, 0, TAU); ctx.fill(); });
  ctx.restore();
}
function yarn(ctx, x, y, R, col){
  ctx.fillStyle = lin(ctx, x - R, y - R, x + R, y + R, [shade(col, .3), col, shade(col, -.25)]); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip(); ctx.strokeStyle = rgba(shade(col, -.35), .6); ctx.lineWidth = R * .07;
  for(let i = -3; i <= 3; i++){ ctx.beginPath(); ctx.ellipse(x + i * R * .25, y, R * .25, R * 1.1, .5, 0, TAU); ctx.stroke(); } ctx.restore();
  ctx.strokeStyle = col; ctx.lineWidth = R * .07; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + R * .7, y + R * .7); ctx.bezierCurveTo(x + R * 1.5, y + R * 1.3, x + R * 1.8, y + R * .2, x + R * 2.6, y + R * .9); ctx.stroke();
}
/* o: {fur, shade, inner, eye, closed, sleep, tabby, muzzle} */
function catHead(ctx, x, y, s, o, rot = 0){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const fur = o.fur, dk = o.shade || shade(fur, -.25);
  [-1, 1].forEach(d => { ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(d * s * .9, -s * .25); ctx.quadraticCurveTo(d * s * .95, -s * 1.05, d * s * .62, -s * 1.02); ctx.quadraticCurveTo(d * s * .35, -s * .8, d * s * .15, -s * .62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.inner; ctx.beginPath(); ctx.moveTo(d * s * .78, -s * .38); ctx.quadraticCurveTo(d * s * .82, -s * .88, d * s * .62, -s * .88); ctx.quadraticCurveTo(d * s * .42, -s * .74, d * s * .3, -s * .6); ctx.closePath(); ctx.fill(); });
  const g = ctx.createRadialGradient(-s * .25, -s * .35, s * .1, 0, 0, s * 1.15); g.addColorStop(0, shade(fur, .18)); g.addColorStop(1, dk);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s, s * .82, 0, 0, TAU); ctx.fill();
  if(o.tabby){ ctx.strokeStyle = rgba(shade(fur, -.4), .7); ctx.lineWidth = s * .07; ctx.lineCap = "round"; [-.18, 0, .18].forEach(dx => { ctx.beginPath(); ctx.moveTo(dx * s, -s * .78); ctx.lineTo(dx * s * .8, -s * .5); ctx.stroke(); });
    [-1, 1].forEach(d => { ctx.beginPath(); ctx.moveTo(d * s * .98, s * .02); ctx.lineTo(d * s * .75, s * .05); ctx.moveTo(d * s * .96, s * .2); ctx.lineTo(d * s * .76, s * .18); ctx.stroke(); }); }
  if(o.muzzle){ ctx.fillStyle = o.muzzle; ctx.beginPath(); ctx.ellipse(-s * .17, s * .32, s * .26, s * .2, 0, 0, TAU); ctx.ellipse(s * .17, s * .32, s * .26, s * .2, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "rgba(255,120,140,.35)"; [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(d * s * .6, s * .25, s * .15, s * .09, 0, 0, TAU); ctx.fill(); });
  if(o.closed || o.sleep){ ctx.strokeStyle = "#2b1d1d"; ctx.lineWidth = s * .065; ctx.lineCap = "round"; [-1, 1].forEach(d => { ctx.beginPath(); if(o.sleep) ctx.arc(d * s * .38, -s * .06, s * .14, .25, Math.PI - .25); else ctx.arc(d * s * .38, s * .04, s * .15, Math.PI + .3, -.3); ctx.stroke(); }); }
  else [-1, 1].forEach(d => { const ex = d * s * .38, ey = -s * .04;
    ctx.fillStyle = o.eye; ctx.beginPath(); ctx.ellipse(ex, ey, s * .17, s * .21, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1b1b1b"; ctx.beginPath(); ctx.ellipse(ex, ey + s * .02, s * .11, s * .17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ex - s * .05, ey - s * .07, s * .055, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ex + s * .05, ey + s * .07, s * .025, 0, TAU); ctx.fill(); });
  ctx.fillStyle = "#f28aa0"; ctx.beginPath(); ctx.moveTo(-s * .09, s * .16); ctx.quadraticCurveTo(0, s * .12, s * .09, s * .16); ctx.quadraticCurveTo(s * .02, s * .28, 0, s * .28); ctx.quadraticCurveTo(-s * .02, s * .28, -s * .09, s * .16); ctx.fill();
  ctx.strokeStyle = "#3a2a2a"; ctx.lineWidth = s * .035; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, s * .28); ctx.quadraticCurveTo(-s * .06, s * .38, -s * .16, s * .33); ctx.moveTo(0, s * .28); ctx.quadraticCurveTo(s * .06, s * .38, s * .16, s * .33); ctx.stroke();
  ctx.strokeStyle = rgba(o.whisk || "#ffffff", .85); ctx.lineWidth = s * .02; [-1, 1].forEach(d => [[-.02, -.08], [.06, 0], [.14, .1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(d * s * .45, s * (.22 + a)); ctx.lineTo(d * s * 1.25, s * (.12 + b + a)); ctx.stroke(); }));
  ctx.restore();
}
function catPaw(ctx, x, y, s, fur){
  ctx.fillStyle = lin(ctx, x, y - s * .25, x, y + s * .25, [shade(fur, .15), shade(fur, -.15)]); ctx.beginPath(); ctx.ellipse(x, y, s * .3, s * .2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(shade(fur, -.45), .6); ctx.lineWidth = s * .03; [-.1, .1].forEach(d => { ctx.beginPath(); ctx.moveTo(x + d * s, y + s * .02); ctx.lineTo(x + d * s, y + s * .17); ctx.stroke(); });
}
const CATS = { ginger: { fur: "#f4a259", inner: "#ffc2b4", eye: "#7cc46a", tabby: 1, whisk: "#ffffff" }, grey: { fur: "#9aa5b1", inner: "#ffc2d1", eye: "#f2c14e", tabby: 1, muzzle: "#eef1f4" }, black: { fur: "#3a3a46", inner: "#f5a3b8", eye: "#9be15d", muzzle: "#ffffff", whisk: "#ffffff" }, white: { fur: "#fbf8f3", shade: "#d8d2c8", inner: "#ffc2d1", eye: "#6ec1e4", whisk: "#c9c0b5" }, cream: { fur: "#f3dcc0", inner: "#ffc2d1", eye: "#5aa9e6", tabby: 0, muzzle: "#fffaf3", whisk: "#ffffff" } };
const DESIGNS3 = {
  cats: { name: "Котики выглядывают", pals: [
    { bg: ["#ffe5ec", "#fff4e6"], ledge: "#ffb4c6", cats: ["ginger", "grey", "black"], acc: ["#ff8fab", "#ffd166", "#9bd0f5"], title: "#d6336c", name: "#5a189a", body: "#4a3546" },
    { bg: ["#e3f6f0", "#fffbe6"], ledge: "#86d3b8", cats: ["white", "ginger", "grey"], acc: ["#ff9f80", "#ffd166", "#8ecae6"], title: "#1b7f63", name: "#e05a2b", body: "#2d4038" },
    { bg: ["#2c2457", "#4b3b8f"], ledge: "#8b7ad8", cats: ["black", "cream", "grey"], acc: ["#ffd166", "#ff8fab", "#a0e7e5"], title: "#ffd166", name: "#ffffff", body: "#efeaff", dark: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); bokeh(ctx, r, 12, "#ffffff", 30, 100, p.dark ? .08 : .4);
      const area = [110, 180, 860, 700];
      for(let i = 0; i < 16; i++){ const x = r() * W, y = r() * 1000; if(inside(x, y, area, 40)) continue; pawPrint(ctx, x, y, 24 + r() * 16, rgba(p.acc[i % 3], p.dark ? .35 : .45), r() * TAU); }
      for(let i = 0; i < 10; i++){ const x = r() * W, y = r() * 1000; if(inside(x, y, area, 30)) continue; heart(ctx, x, y, 22 + r() * 22, p.acc[i % 3], (r() - .5) * .6); }
      yarn(ctx, 130, 960, 46, p.acc[0]); yarn(ctx, 905, 930, 38, p.acc[2]);
      const pos = [[240, 1140, 150, -.12], [540, 1112, 170, 0], [840, 1140, 150, .12]];
      pos.forEach(([x, y, s, rot], i) => catHead(ctx, x, y, s, CATS[p.cats[i]], rot));
      const top = H - 150; ctx.fillStyle = lin(ctx, 0, top, 0, H, [shade(p.ledge, .2), p.ledge, shade(p.ledge, -.12)]); ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = -6; rr(ctx, -20, top, W + 40, 200, 40); ctx.fill(); ctx.shadowColor = "transparent";
      ctx.fillStyle = rgba("#ffffff", .25); ctx.fillRect(0, top + 14, W, 8);
      pos.forEach(([x, , s], i) => { const f = CATS[p.cats[i]].fur; catPaw(ctx, x - s * .45, top + 6, s, f); catPaw(ctx, x + s * .45, top + 6, s, f); });
      return { area, title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.35)" : null };
    } },
  catnap: { name: "Спящий котик", pals: [
    { sky: ["#1b1f4b", "#3b2f7a", "#6a4c93"], cloud: "#d9d4ff", cat: "grey", title: "#ffe8a3", name: "#ffffff", body: "#eeeaff", night: 1 },
    { sky: ["#ffd6e0", "#ffe8d6", "#fff8ef"], cloud: "#ffffff", cat: "ginger", title: "#d1495b", name: "#7b2cbf", body: "#4a3546" },
    { sky: ["#bde0fe", "#e0f0ff", "#fdfcff"], cloud: "#ffffff", cat: "white", title: "#3d5a80", name: "#e05780", body: "#2b3a55" } ],
    draw(ctx, r, p){
      vbg(ctx, p.sky); const area = [120, 170, 840, 570];
      if(p.night){ stars(ctx, r, 200, [0, 0, W, 1000], "#ffffff", area); sparkles(ctx, r, 12, "#fff6d5", [0, 0, W, 900], 6, 16, area); crescent(ctx, 880, 150, 70, "#ffe8a3"); }
      else { glow(ctx, 880, 150, 220, "#fff3b0", .7); ctx.fillStyle = "#ffe8a3"; ctx.beginPath(); ctx.arc(880, 150, 60, 0, TAU); ctx.fill(); bokeh(ctx, r, 10, "#ffffff", 30, 90, .5, area); }
      [[150, 1250, 120], [930, 1250, 120], [540, 1300, 200], [330, 1200, 150], [760, 1200, 150], [540, 1180, 170]].forEach(([x, y, s]) => cloud(ctx, x, y, s, p.cloud, .97));
      const C = CATS[p.cat], cx = 560, cy = 1020;
      ctx.shadowColor = "rgba(0,0,0,.15)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      ctx.fillStyle = lin(ctx, cx - 240, cy - 120, cx + 240, cy + 120, [shade(C.fur, .15), C.fur, C.shade || shade(C.fur, -.2)]); ctx.beginPath(); ctx.ellipse(cx, cy, 245, 135, 0, 0, TAU); ctx.fill(); ctx.shadowColor = "transparent";
      if(C.tabby){ ctx.strokeStyle = rgba(shade(C.fur, -.35), .55); ctx.lineWidth = 16; ctx.lineCap = "round"; [-60, 0, 60, 120].forEach(dx => { ctx.beginPath(); ctx.arc(cx + dx, cy - 160, 120, 1.25, 1.75); ctx.stroke(); }); }
      ctx.strokeStyle = C.fur; ctx.lineWidth = 54; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx + 220, cy + 30); ctx.bezierCurveTo(cx + 260, cy + 150, cx - 60, cy + 175, cx - 230, cy + 110); ctx.stroke();
      ctx.strokeStyle = C.shade || shade(C.fur, -.15); ctx.lineWidth = 54; ctx.beginPath(); ctx.moveTo(cx - 180, cy + 125); ctx.lineTo(cx - 232, cy + 110); ctx.stroke();
      catPaw(ctx, cx - 120, cy + 105, 150, C.fur); catPaw(ctx, cx - 30, cy + 112, 150, C.fur);
      catHead(ctx, cx - 210, cy - 40, 125, { ...C, sleep: 1 }, -.35);
      ctx.fillStyle = p.night ? "#ffe8a3" : p.title; ctx.font = "700 60px Nunito, sans-serif"; ctx.textAlign = "left"; [["z", 0, 0, 1], ["z", 40, -50, .8], ["Z", 90, -110, 1.1]].forEach(([t, dx, dy, k]) => { ctx.save(); ctx.translate(cx - 90 + dx, cy - 95 + dy); ctx.scale(k, k); ctx.fillText(t, 0, 0); ctx.restore(); });
      return { area, title: p.title, name: p.name, body: p.body, shadow: p.night ? "rgba(0,0,0,.4)" : null };
    } }
};
Object.assign(DESIGNS, DESIGNS3);
["bday", "love", "friday", "weekend", "goodday", "thanks", "health", "baby", "feb14", "mar8", "monday", "housewarming"].forEach(h => { if(HOL[h] && !HOL[h].designs.includes("cats")) HOL[h].designs.splice(Math.min(2, HOL[h].designs.length), 0, "cats"); });
["night", "morning", "love", "health", "goodday", "weekend", "baby"].forEach(h => { if(HOL[h] && !HOL[h].designs.includes("catnap")) HOL[h].designs.splice(Math.min(1, HOL[h].designs.length), 0, "catnap"); });

/* ---------- 3D styles (scenes in 3d.js, loaded on demand) ---------- */
function bg3d(ctx, r, p){ vbg(ctx, p.bg); if(p.glow) glow(ctx, W / 2, H * .45, 760, p.glow, .45); if(p.bokeh) bokeh(ctx, r, 26, p.bokeh, 20, 110, .22); if(p.dark) vignette(ctx, .35); }
function put3d(ctx, c){ const img = window.Card3D && Card3D.get(c, true); if(img){ ctx.drawImage(img, 0, 0, W, H); return img; } return null; }
const DESIGNS4 = {
  baubles3d: { name: "3D ёлочные шары", scene: "baubles3d", pals: [
    { bg: ["#0f3d2e", "#03140d"], glow: "#2e8b57", bokeh: "#f6d38b", dark: 1, b: ["#b5121b", "#e7b65a", "#eef1f5", "#8c0b14", "#d4af37", "#b5121b"], k: 0, title: "#f6d38b", name: "#ffffff", body: "#eaf6ee" },
    { bg: ["#0e1f45", "#040917"], glow: "#3a6fd8", bokeh: "#a9d6ff", dark: 1, b: ["#3a86ff", "#dfe3ea", "#8ecae6", "#e7b65a", "#1d4ed8", "#c0c7d6"], k: 1, title: "#cfe6ff", name: "#ffffff", body: "#eaf1ff" },
    { bg: ["#5c0b1a", "#1a0307"], glow: "#c1121f", bokeh: "#ffd6a5", dark: 1, b: ["#e7b65a", "#1f6f50", "#f5f5f5", "#d4af37", "#2d6a4f", "#e7b65a"], k: 2, title: "#f6d38b", name: "#ffffff", body: "#ffeaea" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); put3d(ctx, c); stars(ctx, r, 120, [0, 400, W, H - 400], "#fff3c4", [120, 600, 840, 660]); sparkles(ctx, r, 10, "#fff3c4", [0, 300, W, H - 300], 8, 20, [120, 600, 840, 660]);
      return { area: [120, 610, 840, 660], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.5)" }; } },
  gifts3d: { name: "3D подарки", scene: "gifts3d", pals: [
    { bg: ["#fdf0f4", "#efd9e3"], g: ["#b5121b", "#f1d27a", "#1d3557", "#eef1f5", "#2a9d8f", "#ffd166"], title: "#b5121b", name: "#1d3557", body: "#3a2f3a" },
    { bg: ["#14233f", "#060c19"], glow: "#2d4f8f", bokeh: "#f6d38b", dark: 1, g: ["#b5121b", "#f1d27a", "#eef1f5", "#b5121b", "#1f6f50", "#f1d27a"], title: "#f6d38b", name: "#ffffff", body: "#eef2ff" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); if(!p.dark) bokeh(ctx, r, 14, "#ffffff", 40, 120, .5); put3d(ctx, c); if(p.dark) for(let i = 0; i < 70; i++){ ctx.fillStyle = rgba("#ffffff", .5 + r() * .5); ctx.beginPath(); ctx.arc(r() * W, r() * 900, 1 + r() * 3, 0, TAU); ctx.fill(); }
      return { area: [110, 170, 860, 620], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.5)" : null }; } },
  balloons3d: { name: "3D шары", scene: "balloons3d", pals: [
    { bg: ["#ffe9f0", "#fff6ea"], b: ["#ff4d8d", "#ffb703", "#4cc9f0", "#9b5de5", "#06d6a0", "#ff7b54"], k: 0, str: "#e8c9d3", title: "#d6336c", name: "#5a189a", body: "#4a3546" },
    { bg: ["#16142c", "#2d1d52"], glow: "#7b5cff", dark: 1, b: ["#e7b65a", "#e9a495", "#dfe3ea", "#e7b65a", "#e9a495", "#dfe3ea"], k: 0, str: "#d8d0ee", title: "#f6d38b", name: "#ffffff", body: "#efeaff" },
    { bg: ["#e6f4ff", "#fffaf0"], b: ["#3a86ff", "#ff006e", "#ffbe0b", "#8338ec", "#fb5607", "#06d6a0"], k: 1, str: "#c6d4e6", title: "#3a0ca3", name: "#ff006e", body: "#2b2d42" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); bokeh(ctx, r, 12, "#ffffff", 40, 120, p.dark ? .08 : .4); put3d(ctx, c); confetti(ctx, r, 70, p.b, [0, 600, W, 750], 1, [110, 660, 860, 600]);
      return { area: [110, 660, 860, 600], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.4)" : null }; } },
  hearts3d: { name: "3D сердца", scene: "hearts3d", pals: [
    { bg: ["#5c0b1a", "#22040b"], glow: "#c1121f", dark: 1, h: ["#d00000", "#ff4d6d", "#9d0208"], k: 0, title: "#ffd6e0", name: "#ffffff", body: "#ffe5ec" },
    { bg: ["#ffe5ec", "#ffc2d1"], h: ["#ff4d6d", "#ff8fab", "#c9184a"], k: 1, title: "#c9184a", name: "#800f2f", body: "#590d22" },
    { bg: ["#111111", "#000000"], glow: "#7a5a2a", dark: 1, h: ["#b5121b", "#e7b65a", "#9d0208"], k: 1, title: "#f6d38b", name: "#ffffff", body: "#efe3c8" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); put3d(ctx, c); sparkles(ctx, r, 10, "#fff1f4", [0, 0, W, H], 8, 18, [180, 380, 720, 620]);
      return { area: [190, 380, 700, 600], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.5)" : null }; } },
  numbers3d: { name: "3D золотые цифры", scene: "numbers3d", pals: [
    { bg: ["#0b0b1a", "#1d1235"], glow: "#6a4c93", dark: 1, acc: "#e9a495", title: "#f6d38b", name: "#ffffff", body: "#efeaff" },
    { bg: ["#06302c", "#011513"], glow: "#1f7a6a", dark: 1, acc: "#dfe3ea", title: "#f6d38b", name: "#ffffff", body: "#e6fff8" },
    { bg: ["#fff6ec", "#f2e2d0"], acc: "#c9184a", title: "#9c6644", name: "#5c3d2e", body: "#4a3a30" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); if(p.dark){ for(let i = 0; i < 300; i++){ ctx.fillStyle = rgba("#f6d38b", r() * .5); ctx.beginPath(); ctx.arc(r() * W, r() * H, .6 + r() * 2, 0, TAU); ctx.fill(); } } else bokeh(ctx, r, 14, "#ffffff", 40, 110, .6); put3d(ctx, c);
      return { area: [110, 600, 860, 680], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.5)" : null }; } },
  stars3d: { name: "3D звёзды", scene: "stars3d", pals: [
    { bg: ["#0c1a3a", "#030814"], glow: "#2d4f8f", dark: 1, title: "#f6d38b", name: "#ffffff", body: "#e8eeff" },
    { bg: ["#0b3d2e", "#03140d"], glow: "#2e8b57", dark: 1, title: "#f6d38b", name: "#ffffff", body: "#eaf6ee" },
    { bg: ["#fbf6ee", "#efe3d3"], star: "#d9a441", title: "#7f5539", name: "#3d2c1e", body: "#4a3a2a" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); if(p.dark) stars(ctx, r, 160, [0, 0, W, H], "#ffffff", [190, 380, 700, 620]); put3d(ctx, c);
      return { area: [190, 380, 700, 620], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.5)" : null }; } },
  cake3d: { name: "3D торт", scene: "cake3d", pals: [
    { bg: ["#fff0f3", "#ffe1d4"], cream: "#fff8f0", t1: "#f497b6", t2: "#ffd6e0", berry: "#c1121f", cnd: ["#4cc9f0", "#ffd166", "#ff8fab", "#9b5de5"], title: "#c9184a", name: "#7b2cbf", body: "#5a3d4b" },
    { bg: ["#2b2040", "#140d22"], glow: "#7b5cff", dark: 1, cream: "#ffe9f0", t1: "#5a3220", t2: "#7a4a30", berry: "#d00000", cnd: ["#f1d27a", "#ff8fab", "#8ecae6", "#f1d27a"], title: "#ffd166", name: "#ffffff", body: "#f3e8ff" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); bokeh(ctx, r, 12, "#ffffff", 30, 100, p.dark ? .08 : .4); const img = put3d(ctx, c);
      if(img && img.flames) img.flames.forEach(([x, y]) => { glow(ctx, x, y, 80, "#ffb347", .4); glow(ctx, x, y, 28, "#fff1c1", .8); });
      return { area: [110, 140, 860, 560], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.5)" : null }; } },
  rings3d: { name: "3D кольца", scene: "rings3d", pals: [
    { bg: ["#fffaf3", "#efe3d6"], title: "#9c6644", name: "#6b4226", body: "#5c4a3d" },
    { bg: ["#1f2a44", "#0a1120"], glow: "#4a5d8f", dark: 1, r2: "#dfe3ea", title: "#f6d38b", name: "#ffffff", body: "#ecebff" } ],
    draw(ctx, r, p, c){ bg3d(ctx, r, p); bokeh(ctx, r, 14, p.dark ? "#f6d38b" : "#ffffff", 30, 110, p.dark ? .12 : .6); put3d(ctx, c);
      return { area: [140, 640, 800, 600], title: p.title, name: p.name, body: p.body, shadow: p.dark ? "rgba(0,0,0,.4)" : null }; } }
};
Object.assign(DESIGNS, DESIGNS4);
async function prepareCard(c, scale = 1){
  await ensureFonts(c);
  const d = DESIGNS[c.d];
  if(d && d.scene){ try{ if(!window.Card3D) await import(new URL("3d.js", document.baseURI).href); await window.Card3D.prepare(c, scale); }catch(e){ console.warn("3D", e); } }
}

/* ---------- folk & retro styles ---------- */
function brushPetal(ctx, x, y, len, ang, w, dark, light){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, dark); g.addColorStop(.55, dark); g.addColorStop(1, light);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * .3, -w * 1.2, len * .85, -w * .9, len, 0); ctx.bezierCurveTo(len * .8, w * .7, len * .3, w * .9, 0, 0); ctx.fill(); ctx.restore();
}
function gzhelRose(ctx, x, y, R, d, l){
  for(let i = 0; i < 8; i++){ const a = i / 8 * TAU; brushPetal(ctx, x + Math.cos(a) * R * .25, y + Math.sin(a) * R * .25, R, a, R * .38, d, l); }
  for(let i = 0; i < 6; i++){ const a = i / 6 * TAU + .4; brushPetal(ctx, x, y, R * .6, a, R * .26, d, l); }
  ctx.fillStyle = d; ctx.beginPath(); ctx.arc(x, y, R * .16, 0, TAU); ctx.fill();
  for(let i = 0; i < 9; i++){ const a = i / 9 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * .28, y + Math.sin(a) * R * .28, R * .035, 0, TAU); ctx.fill(); }
}
function curl(ctx, x, y, s, ang, col, lw){ ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.beginPath(); for(let t = 0; t < 14; t += .2){ const rr0 = s * (1 - t / 16), px = Math.cos(t) * rr0 * (t / 14), py = Math.sin(t) * rr0 * (t / 14); t ? ctx.lineTo(px + s * t / 14, py) : ctx.moveTo(px, py); } ctx.stroke(); ctx.restore(); }
function gzhelBouquet(ctx, r, x, y, k, d, l){
  for(let i = 0; i < 10; i++){ const a = r() * TAU; brushPetal(ctx, x, y, (90 + r() * 70) * k, a, 22 * k, d, l); }
  for(let i = 0; i < 6; i++){ const a = r() * TAU; curl(ctx, x + Math.cos(a) * 120 * k, y + Math.sin(a) * 120 * k, 40 * k, a, d, 4 * k); }
  gzhelRose(ctx, x, y, 95 * k, d, l); gzhelRose(ctx, x + 120 * k, y + 70 * k, 50 * k, d, l); gzhelRose(ctx, x - 90 * k, y + 110 * k, 42 * k, d, l);
  for(let i = 0; i < 18; i++){ const a = r() * TAU, dd = (150 + r() * 60) * k; ctx.fillStyle = d; ctx.beginPath(); ctx.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, (4 + r() * 5) * k, 0, TAU); ctx.fill(); }
}
function rowan(ctx, x, y, n, R, col, r){ for(let i = 0; i < n; i++){ const a = r() * TAU, d = Math.sqrt(r()) * R * 2.2, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
  const g = ctx.createRadialGradient(bx - R * .3, by - R * .3, R * .1, bx, by, R); g.addColorStop(0, shade(col, .45)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.45));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.arc(bx, by + R * .55, R * .14, 0, TAU); ctx.fill(); } }
function khLeaf(ctx, x, y, len, ang, gold){ ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * .35, -len * .32, len * .8, -len * .2, len, 0); ctx.bezierCurveTo(len * .75, len * .12, len * .35, len * .2, 0, 0); ctx.fill();
  ctx.strokeStyle = "rgba(60,20,0,.6)"; ctx.lineWidth = Math.max(1.5, len * .03); ctx.beginPath(); ctx.moveTo(len * .1, 0); ctx.quadraticCurveTo(len * .5, -len * .08, len * .9, 0); ctx.stroke(); ctx.restore(); }
function khVine(ctx, r, pts, gold, red, k = 1){
  ctx.strokeStyle = gold; ctx.lineWidth = 7 * k; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for(let i = 1; i < pts.length - 1; i++){ const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } ctx.lineTo(...pts[pts.length - 1]); ctx.stroke();
  for(let i = 1; i < pts.length; i++){ const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, a = Math.atan2(y1 - y0, x1 - x0);
    curl(ctx, mx, my, 55 * k, a + (i % 2 ? -1.2 : 1.2), gold, 4 * k); khLeaf(ctx, x0, y0, 70 * k, a + (i % 2 ? .9 : -.9), gold); khLeaf(ctx, mx, my, 55 * k, a + (i % 2 ? -1.6 : 1.6), gold);
    for(let j = 0; j < 5; j++){ const t = r(); ctx.strokeStyle = gold; ctx.lineWidth = 2.5 * k; ctx.beginPath(); const sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t; ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + (r() - .5) * 40 * k, sy - 30 * k, sx + (r() - .5) * 50 * k, sy - 50 * k); ctx.stroke(); }
    if(i % 2) rowan(ctx, mx, my + 25 * k, 7, 14 * k, red, r); }
}
function paperTexture(ctx, r, n, col, a){ for(let i = 0; i < n; i++){ ctx.fillStyle = rgba(col, r() * a); ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); } }
function halftone(ctx, col, a, step = 14){ ctx.fillStyle = rgba(col, a); for(let y = 0; y < H; y += step) for(let x = (y / step) % 2 ? step / 2 : 0; x < W; x += step){ const k = .5 + .5 * Math.sin(x / 140 + y / 210); ctx.beginPath(); ctx.arc(x, y, 1.2 + k * 1.8, 0, TAU); ctx.fill(); } }
const DESIGNS5 = {
  gzhel: { name: "Гжель", pals: [
    { bg: ["#ffffff", "#eef3fb"], d: "#163d8f", l: "#a9c5f5", title: "#163d8f", name: "#0d2a6b", body: "#1c2f5a" },
    { bg: ["#163d8f", "#0b2560"], d: "#ffffff", l: "#7fa8ee", title: "#ffffff", name: "#ffffff", body: "#e6eeff", inv: 1 } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg);
      ctx.strokeStyle = p.d; ctx.lineWidth = 12; ctx.strokeRect(40, 40, W - 80, H - 80); ctx.lineWidth = 3; ctx.strokeRect(62, 62, W - 124, H - 124);
      ctx.fillStyle = p.d; for(let x = 90; x < W - 60; x += 46){ ctx.beginPath(); ctx.arc(x, 62, 9, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(x, H - 62, 9, Math.PI, 0); ctx.fill(); }
      gzhelBouquet(ctx, r, 250, 250, 1.35, p.d, p.l); gzhelBouquet(ctx, r, W - 215, H - 215, 1.3, p.d, p.l);
      for(let i = 0; i < 4; i++){ brushPetal(ctx, W - 160, 180 + i * 50, 80, -.6 + i * .3, 16, p.d, p.l); brushPetal(ctx, 170, H - 200 - i * 50, 80, 2.6 - i * .3, 16, p.d, p.l); }
      return { area: [150, 470, 780, 440], title: p.title, name: p.name, body: p.body };
    } },
  khokhloma: { name: "Хохлома", pals: [
    { bg: ["#1a100a", "#080402"], gold: "#e0a91f", red: "#c1121f", title: "#f1c24b", name: "#ffffff", body: "#f7e7c4" },
    { bg: ["#8e1414", "#5a0808"], gold: "#f1c24b", red: "#1a0d08", title: "#ffd76a", name: "#ffffff", body: "#ffeccc" } ],
    draw(ctx, r, p){
      vbg(ctx, p.bg); vignette(ctx, .35);
      const G = lin(ctx, 0, 0, W, H, ["#a8740f", p.gold, "#fff0b0", p.gold, "#a8740f"]);
      ctx.strokeStyle = G; ctx.lineWidth = 6; rr(ctx, 46, 46, W - 92, H - 92, 30); ctx.stroke();
      khVine(ctx, r, [[60, 300], [220, 210], [400, 260], [560, 170], [740, 240], [900, 160], [1040, 230]], G, p.red);
      khVine(ctx, r, [[40, 1180], [220, 1110], [400, 1170], [580, 1090], [760, 1160], [940, 1080], [1060, 1130]], G, p.red);
      [[200, 1140], [880, 1110]].forEach(([x, y]) => { for(let i = 0; i < 9; i++) brushPetal(ctx, x, y, 80, i / 9 * TAU, 26, p.red, shade(p.red, .35)); ctx.fillStyle = G; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); });
      return { area: [130, 380, 820, 620], title: p.title, name: p.name, body: p.body, shadow: "rgba(0,0,0,.5)" };
    } },
  retro: { name: "Ретро-открытка", pals: [
    { paper: "#f1e3c6", c: ["#c8553d", "#2a7f8f", "#e0a83a", "#5b7f3a"], ray: "#e8c98f", title: "#b23a2a", name: "#2a5f6f", body: "#4a3a2a" },
    { paper: "#e9eef0", c: ["#d1495b", "#00798c", "#edae49", "#30638e"], ray: "#cfdde3", title: "#00798c", name: "#d1495b", body: "#2f3b40" } ],
    draw(ctx, r, p, c){
      ctx.fillStyle = "#fbf6ea"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = p.paper; rr(ctx, 36, 36, W - 72, H - 72, 18); ctx.fill();
      ctx.save(); rr(ctx, 36, 36, W - 72, H - 72, 18); ctx.clip();
      ctx.fillStyle = rgba(p.ray, .7); for(let i = 0; i < 24; i++){ ctx.beginPath(); ctx.moveTo(W / 2, 330); ctx.arc(W / 2, 330, 1700, i * TAU / 24, i * TAU / 24 + TAU / 48); ctx.fill(); }
      halftone(ctx, p.c[0], .08);
      const winter = ["ny", "xmas"].includes(c && c.h);
      if(winter){ ctx.strokeStyle = "#2f5a3a"; ctx.lineWidth = 12; ctx.lineCap = "round"; for(let i = 0; i < 2; i++){ const x0 = i ? W - 40 : 40; ctx.beginPath(); ctx.moveTo(x0, 60); ctx.quadraticCurveTo(W / 2, 180, i ? 150 : W - 150, 70); ctx.stroke(); }
        for(let i = 0; i < 300; i++){ const t = r(), side = r() < .5; const x = side ? 40 + t * (W - 190) : W - 40 - t * (W - 190), y = 60 + Math.sin(t * Math.PI) * 110 + (r() - .5) * 40; ctx.strokeStyle = r() < .5 ? "#2f5a3a" : "#45784f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - .5) * 30, y + 20 + r() * 20); ctx.stroke(); }
        [[200, 230, 0], [420, 270, 1], [650, 260, 2], [870, 220, 3]].forEach(([x, y, i]) => { ctx.strokeStyle = "rgba(80,60,40,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 90); ctx.lineTo(x, y - 40); ctx.stroke(); ctx.fillStyle = p.c[i]; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(x - 12, y - 12, 10, 0, TAU); ctx.fill(); ctx.fillStyle = "#c9a227"; ctx.fillRect(x - 10, y - 50, 20, 12); });
        for(let i = 0; i < 40; i++){ const x = r() * W, y = 400 + r() * 900; if(inside(x, y, [140, 430, 800, 640])) continue; snowflake(ctx, x, y, 10 + r() * 14, "rgba(255,255,255,.9)", 3); } }
      else { [[170, 220, 70], [300, 160, 50], [W - 180, 230, 72], [W - 310, 165, 48]].forEach(([x, y, s], i) => { ctx.save(); ctx.translate(x, y); for(let L = 0; L < 3; L++){ ctx.fillStyle = shade(p.c[i % 4], L * .18); for(let k = 0; k < 10; k++){ ctx.save(); ctx.rotate(k * TAU / 10 + L * .3); ctx.beginPath(); ctx.ellipse(0, -s * (1 - L * .28) * .55, s * .22 * (1 - L * .2), s * (1 - L * .28) * .5, 0, 0, TAU); ctx.fill(); ctx.restore(); } } ctx.fillStyle = "#e0a83a"; ctx.beginPath(); ctx.arc(0, 0, s * .2, 0, TAU); ctx.fill(); ctx.restore(); });
        for(let i = 0; i < 6; i++) leaf(ctx, 120 + i * 30, 300 + (i % 2) * 20, 90, -.4 + i * .5, p.c[3]); }
      ctx.fillStyle = p.c[0]; const by = H - 230; ctx.beginPath(); ctx.moveTo(120, by); ctx.lineTo(W - 120, by); ctx.lineTo(W - 160, by + 50); ctx.lineTo(W - 120, by + 100); ctx.lineTo(120, by + 100); ctx.lineTo(160, by + 50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(p.c[0], -.3); [[120, by + 100, 160, by + 120], [W - 120, by + 100, W - 160, by + 120]].forEach(([a, b2, c2, d2]) => { ctx.beginPath(); ctx.moveTo(a, b2); ctx.lineTo(c2, b2); ctx.lineTo(c2, d2); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = "#fbf3df"; ctx.font = "700 44px 'PT Serif', Georgia, serif"; ctx.textAlign = "center"; ctx.fillText((HOL[c && c.h] || HOLIDAYS[0]).title.toUpperCase(), W / 2, by + 65, W - 360);
      paperTexture(ctx, r, 1600, "#5a4630", .12); ctx.restore();
      ctx.strokeStyle = "rgba(120,90,60,.35)"; ctx.lineWidth = 2; rr(ctx, 36, 36, W - 72, H - 72, 18); ctx.stroke();
      return { area: [140, 420, 800, 620], title: p.title, name: p.name, body: p.body };
    } },
  vintage: { name: "Винтаж", pals: [
    { paper: ["#f3e7d3", "#e6d2b5"], f: ["#c98b8b", "#e3b5a4", "#b56576", "#efd9c6"], leaf: "#7d8b6a", ink: "#7a4e2d", title: "#8a3b2e", name: "#4a2c1e", body: "#4a3a2a" },
    { paper: ["#e9e4d6", "#d6cdb8"], f: ["#9aa5b8", "#c9b1bd", "#7d8597", "#e8ddd0"], leaf: "#6b7b6a", ink: "#4a5568", title: "#4a5568", name: "#2d3748", body: "#3b3b3b" } ],
    draw(ctx, r, p){
      vbg(ctx, p.paper); paperTexture(ctx, r, 2600, "#6b5338", .1);
      const v = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8); v.addColorStop(0, "rgba(120,80,40,0)"); v.addColorStop(1, "rgba(120,80,40,.35)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.55)"; for(let x = 0; x < W; x += 36){ ctx.beginPath(); ctx.arc(x + 18, 0, 22, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(x + 18, H, 22, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,.4)"; for(let x = 0; x < W; x += 36){ ctx.beginPath(); ctx.arc(x + 18, 30, 5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x + 18, H - 30, 5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = p.ink; ctx.lineWidth = 2; rr(ctx, 80, 80, W - 160, H - 160, 12); ctx.stroke(); [[96, 96, 1, 1], [W - 96, 96, -1, 1], [96, H - 96, 1, -1], [W - 96, H - 96, -1, -1]].forEach(([x, y, a, b]) => flourish(ctx, x, y, a * .8, b * .8, p.ink));
      ctx.save(); ctx.globalAlpha = .9; bouquet(ctx, r, W / 2, 250, 120, 7, p.f, p.leaf, ["rose", "rose", "blossom"], .9); bouquet(ctx, r, W / 2, H - 230, 110, 6, p.f, p.leaf, ["rose", "blossom"], .8); ctx.restore();
      ctx.fillStyle = "rgba(240,225,200,.25)"; ctx.fillRect(0, 0, W, H);
      return { area: [160, 420, 760, 560], title: p.title, name: p.name, body: p.body };
    } }
};
Object.assign(DESIGNS, DESIGNS5);

/* ---------- style groups: holiday -> group -> variants ---------- */
const GROUPS = [
  { id: "3d", name: "3D", emoji: "✨", sub: "Объёмные, как настоящие", designs: ["baubles3d", "gifts3d", "balloons3d", "hearts3d", "numbers3d", "stars3d", "cake3d", "rings3d"] },
  { id: "classic", name: "Рисованные", emoji: "🎨", sub: "Яркие иллюстрации", designs: ["balloons", "cake", "party", "gifts", "roses", "winter", "baubles", "fireworks", "hearts", "tulips", "emblem", "sunrise", "night", "wedding", "easter", "wreath", "frame", "meadow", "school", "pancakes", "house", "garland"] },
  { id: "soft", name: "Нежные", emoji: "🌸", sub: "Акварель, пастель, природа", designs: ["watercolor", "minimal", "sakura", "lavender", "autumn", "sea", "papercut"] },
  { id: "glam", name: "Гламур", emoji: "💎", sub: "Золото, неон, огни", designs: ["luxe", "neon", "lights", "champagne", "candles"] },
  { id: "folk", name: "Народные и ретро", emoji: "🪆", sub: "Гжель, хохлома, винтаж", designs: ["gzhel", "khokhloma", "retro", "vintage"] },
  { id: "cute", name: "Милые", emoji: "🐱", sub: "Котики и малыши", designs: ["cats", "catnap", "rainbow", "baby"] }
];
GROUPS.forEach(g => g.designs.forEach(d => { if(DESIGNS[d]) DESIGNS[d].group = g.id; }));
const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));
/* which 3D and folk styles suit which holiday (others stay reachable under "Все стили этой группы") */
const MORE2 = {
  ny: ["baubles3d", "numbers3d", "gifts3d", "stars3d", "gzhel", "khokhloma", "retro"], xmas: ["baubles3d", "stars3d", "gifts3d", "vintage", "gzhel", "retro"],
  bday: ["balloons3d", "cake3d", "gifts3d", "hearts3d", "khokhloma", "gzhel", "retro", "vintage"], feb14: ["hearts3d", "rings3d", "vintage"], love: ["hearts3d", "rings3d", "vintage"],
  wedding: ["rings3d", "hearts3d", "vintage", "gzhel"], anniv: ["rings3d", "hearts3d", "stars3d", "vintage"], mar8: ["numbers3d", "hearts3d", "gzhel", "retro", "vintage"],
  feb23: ["numbers3d", "stars3d", "retro"], jubilee: ["stars3d", "balloons3d", "gifts3d", "cake3d", "khokhloma", "vintage"], sep1: ["numbers3d", "balloons3d", "retro"],
  grad: ["stars3d", "balloons3d"], baby: ["balloons3d", "hearts3d"], friday: ["balloons3d"], family: ["hearts3d", "khokhloma", "gzhel"], mom: ["hearts3d", "gzhel", "vintage"],
  easter: ["gzhel", "khokhloma", "vintage"], maslenitsa: ["khokhloma", "gzhel", "retro"], thanks: ["gzhel", "vintage", "hearts3d"], housewarming: ["khokhloma", "gifts3d"],
  elders: ["vintage", "gzhel"], teacher: ["vintage", "retro"], angel: ["vintage", "stars3d"], medic: ["hearts3d"], builder: ["stars3d", "retro"], goodday: ["retro"], morning: ["retro"]
};
Object.entries(MORE2).forEach(([h, ds]) => { if(HOL[h]) ds.forEach(d => { if(DESIGNS[d] && !HOL[h].designs.includes(d)) HOL[h].designs.push(d); }); });
/* variants of a group for a holiday: the holiday's own designs first, then the rest of the group; each design × each colour */
function groupDesigns(hid, gid){ const own = (HOL[hid] || HOLIDAYS[0]).designs.filter(d => DESIGNS[d] && DESIGNS[d].group === gid); return own.concat(GROUP[gid].designs.filter(d => DESIGNS[d] && !own.includes(d))); }
function groupsFor(hid){ return GROUPS.map(g => ({ g, own: (HOL[hid] || HOLIDAYS[0]).designs.filter(d => DESIGNS[d] && DESIGNS[d].group === g.id).length })).sort((a, b) => (b.own > 0) - (a.own > 0)); }
