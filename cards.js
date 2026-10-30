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
      glow(ctx, W / 2, 1180, 600, p.sun, .7); ctx.fillStyle = lin(ctx, 0, 950, 0, 1300, [shade(p.sun, .4), p.sun]); ctx.beginPath(); ctx.arc(W / 2, 1180, 230, 0, TAU); ctx.fill();
      cloud(ctx, 170, 1130, 90, p.cloud, .9); cloud(ctx, 900, 1080, 70, p.cloud, .85); cloud(ctx, 220, 150, 60, p.cloud, .7); cloud(ctx, 870, 220, 50, p.cloud, .6);
      ctx.fillStyle = rgba("#ffffff", .7); ctx.fillRect(0, H - 120, W, 120);
      cup(ctx, 820, 1180, 120, p.cup);
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
  { id: "morning", name: "Доброе утро", emoji: "☀️", title: "Доброе утро", designs: ["sunrise", "meadow", "wreath"], wishes: [
    "Пусть этот день будет лёгким, светлым и удачным! Улыбнись — у тебя всё получится.",
    "Шлю тебе солнечный привет и чашечку хорошего настроения! Прекрасного дня!",
    "Проснись, открой глаза скорей —\nТебя встречает новый день,\nПусть будет он светлей, теплей,\nА все заботы — в тень!" ] },
  { id: "night", name: "Спокойной ночи", emoji: "🌙", title: "Спокойной ночи", designs: ["night", "winter", "baby"], wishes: [
    "Пусть ночь будет тихой, а сны — сладкими и добрыми. Отдыхай и набирайся сил!",
    "Закрывай глазки, пусть приснится что-то очень хорошее. Сладких снов!" ] },
  { id: "weekend", name: "Хороших выходных", emoji: "🌼", title: "Хороших выходных", designs: ["meadow", "sunrise", "garland"], wishes: [
    "Пусть выходные будут тёплыми, спокойными и радостными. Отдыхай и наслаждайся каждой минутой!",
    "Желаю отличных выходных: хорошей погоды, приятных встреч и много поводов для улыбки!" ] },
  { id: "love", name: "Люблю", emoji: "❤️", title: "Я тебя люблю", nameFirst: true, designs: ["hearts", "roses", "night", "wreath"], wishes: [
    "Ты делаешь каждый мой день светлее. Спасибо, что ты рядом!",
    "Просто хочу напомнить: ты — самый важный человек в моей жизни." ] },
  { id: "thanks", name: "Спасибо", emoji: "🙏", title: "Спасибо", nameFirst: true, designs: ["wreath", "frame", "meadow", "roses"], wishes: [
    "От всего сердца спасибо за доброту, помощь и внимание! Это очень ценно для меня.",
    "Благодарю за то, что ты есть! Пусть добро, которое ты даришь, всегда возвращается." ] },
  { id: "health", name: "Выздоравливай", emoji: "🌻", title: "Выздоравливай", nameFirst: true, designs: ["meadow", "sunrise", "wreath"], wishes: [
    "Скорее поправляйся! Пусть силы и хорошее настроение возвращаются с каждым днём.",
    "Желаю крепкого здоровья и бодрости. Береги себя и возвращайся в строй с новыми силами!" ] }
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
  amatic:   { n: "Amatic SC", t: "700 {s}px 'Amatic SC'", b: "{s}px Kurale", s: "700 {s}px 'Amatic SC'", k: 1.3, kb: 1 }
};
async function loadFonts(){
  const specs = []; Object.values(FONTS).forEach(f => [f.t, f.b, f.s].forEach(x => specs.push(x.replace("{s}", 40))));
  try{ await Promise.all(specs.map(s => document.fonts.load(s, "Аа"))); }catch(e){}
}

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
function drawText(ctx, L, c){
  const F = FONTS[c.f] || FONTS.lobster, h = HOL[c.h] || HOLIDAYS[0];
  const [ax, ay, aw, ah] = L.area, cx = ax + aw / 2;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const fnt = (tpl, s) => tpl.replace("{s}", Math.round(s));
  const blocks = [];
  titleLines(h, c.n).forEach(ln => {
    if(ln.k === "name"){ let s = 150 * F.k; ctx.font = fnt(F.t, s); while(ctx.measureText(ln.t).width > aw && s > 50){ s -= 4; ctx.font = fnt(F.t, s); } blocks.push({ font: ctx.font, lines: [ln.t], lh: s * 1.12, col: L.name }); }
    else { let s = 88 * F.k; ctx.font = fnt(F.t, s); let lines = wrap(ctx, ln.t, aw); while(lines.length > 2 && s > 50){ s -= 4; ctx.font = fnt(F.t, s); lines = wrap(ctx, ln.t, aw); } blocks.push({ font: ctx.font, lines, lh: s * 1.14, col: L.title }); }
  });
  const used = blocks.reduce((a, b) => a + b.lh * b.lines.length, 0);
  const body = (c.t || "").trim(), from = (c.fr || "").trim();
  let bs = 52 * F.kb;
  if(body){
    let lines; for(; bs >= 24; bs -= 2){ ctx.font = fnt(F.b, bs); lines = wrap(ctx, body, aw * .96); if(used + 36 + lines.length * bs * 1.34 + (from ? bs * 2 : 0) <= ah) break; }
    blocks.push({ font: ctx.font, lines, lh: bs * 1.34, col: L.body, gap: 36 });
  }
  if(from){ const s = Math.min(bs * 1.12, 54 * F.kb); ctx.font = fnt(F.s, s); blocks.push({ font: ctx.font, lines: wrap(ctx, from, aw), lh: s * 1.3, col: L.title, gap: body ? 26 : 36 }); }
  const total = blocks.reduce((a, b) => a + (b.gap || 0) + b.lh * b.lines.length, 0);
  let y = ay + Math.max(0, (ah - total) / 2);
  if(L.plaque){ ctx.save(); ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fillStyle = L.plaque; rr(ctx, ax - 50, y - 50, aw + 100, total + 90, 36); ctx.fill(); ctx.restore(); }
  ctx.save();
  if(L.shadow){ ctx.shadowColor = L.shadow; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; }
  blocks.forEach(b => { y += b.gap || 0; ctx.font = b.font; ctx.fillStyle = b.col; b.lines.forEach(t => { y += b.lh; ctx.fillText(t, cx, y - b.lh * .24); }); });
  ctx.restore();
}

/* ---------- public ---------- */
function designOf(c){ return DESIGNS[c.d] || DESIGNS[(HOL[c.h] || HOLIDAYS[0]).designs[0]]; }
function drawCard(ctx, c){
  const d = designOf(c), p = d.pals[(c.p || 0) % d.pals.length], r = rng32(c.s || 1);
  ctx.save(); ctx.textAlign = "left"; const L = d.draw(ctx, r, p, c); ctx.restore();
  drawText(ctx, L, c);
}
function renderCard(c, scale = 1){
  const cv = document.createElement("canvas"); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const ctx = cv.getContext("2d"); if(scale !== 1) ctx.scale(scale, scale); drawCard(ctx, c); return cv;
}
function orthodoxEaster(y){ const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7; const m = Math.floor((d + e + 114) / 31), day = (d + e + 114) % 31 + 1; const dt = new Date(y, m - 1, day); dt.setDate(dt.getDate() + 13); return dt; }
function nextDate(h, now = new Date()){
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for(const y of [today.getFullYear(), today.getFullYear() + 1]){ const d = h.easter ? orthodoxEaster(y) : h.date ? new Date(y, h.date[0] - 1, h.date[1]) : null; if(d && d >= today) return { date: d, days: Math.round((d - today) / 864e5) }; }
  return null;
}
