/* ---------- «Живые» открытки: движение поверх фото, текст «от руки» и разные способы открытия ---------- */
"use strict";
const LIVE_MAP = {
  snow: "snow fsnow village frost trees xmashome birds cocoa baubles mandarin mulled",
  petals: "roses peony tulips blossom lilac orchid lily hydr basket carn wreath mflower",
  butterflies: "butterfly wild daisy sunflower lavender rainbow straw bunny honey dand",
  leaves: "leaves park rowan cozy mush apples forest",
  hearts: "hearts rings teddy sweets cupcake",
  twinkle: "bokeh lantern candles stars night sunset sea mount sunrise mist bday",
  embers: "fire", bubbles: "champ balloons",
  motes: "coffee tea bfast books cats cathat sleepcat puppy sleepdog pancakes kulich easter gifts owl"
};
const LIVE_OF = {}; Object.entries(LIVE_MAP).forEach(([k, v]) => v.split(" ").forEach(s => LIVE_OF[s] = k));
function liveKind(c){
  const d = DESIGNS[c.d] || {}; const set = d.photo || (d.frame ? (d.pals[(c.p || 0) % d.pals.length] || {}).set : null);
  if(set && LIVE_OF[set]) return LIVE_OF[set];
  const t = envTheme(c); return t === "stars" ? "twinkle" : t === "fireworks" ? "twinkle" : t === "balloons" || t === "confetti" ? "motes" : t;
}
function liveInit(kind, seed){
  const r = rng32(seed || 7), ps = [];
  const n = { snow: 150, petals: 26, butterflies: 7, leaves: 18, hearts: 20, twinkle: 46, embers: 70, bubbles: 55, motes: 60 }[kind] || 40;
  for(let i = 0; i < n; i++) ps.push({ x: r() * W, y: r() * H, z: .35 + r() * .65, a: r() * 6.283, s: r(), v: r(), ph: r() * 6.283 });
  return { kind, ps, r, t: 0 };
}
function bfly(ctx, x, y, s, flap, col1, col2, ang){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const wing = (dir) => { ctx.save(); ctx.scale(dir * Math.max(.15, Math.abs(Math.cos(flap))), 1);
    const g = ctx.createLinearGradient(0, -s, s, s); g.addColorStop(0, col1); g.addColorStop(1, col2); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * .4, -s * 1.1, s * 1.25, -s * .9, s * .95, -s * .1); ctx.bezierCurveTo(s * 1.05, s * .35, s * .5, s * .9, 0, s * .2); ctx.fill();
    ctx.fillStyle = "rgba(20,10,10,.55)"; ctx.beginPath(); ctx.arc(s * .7, -s * .45, s * .12, 0, 6.283); ctx.fill(); ctx.restore(); };
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = s * .4; wing(1); wing(-1); ctx.shadowColor = "transparent";
  ctx.fillStyle = "#2a1a12"; ctx.beginPath(); ctx.ellipse(0, s * .05, s * .07, s * .42, 0, 0, 6.283); ctx.fill(); ctx.restore();
}
function liveDraw(ctx, L, dt, alpha = 1){
  if(!L) return; L.t += dt; const t = L.t, k = L.kind;
  ctx.save(); ctx.globalAlpha = alpha;
  L.ps.forEach((p, i) => {
    if(k === "snow"){ p.y += (40 + 110 * p.z) * dt; p.x += Math.sin(t * .8 + p.ph) * 22 * p.z * dt; if(p.y > H + 10){ p.y = -10; p.x = L.r() * W; }
      const rad = 1.6 + 6 * p.z * p.z, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.fill(); }
    else if(k === "petals"){ p.y += (45 + 50 * p.z) * dt; p.x += Math.sin(t * .9 + p.ph) * 40 * dt; p.a += (.8 + p.v) * dt; if(p.y > H + 30){ p.y = -30; p.x = L.r() * W; }
      const s = 12 + 14 * p.z; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(Math.cos(t * 2 + p.ph), 1);
      const g = ctx.createLinearGradient(-s, 0, s, 0); g.addColorStop(0, "rgba(255,190,210,.95)"); g.addColorStop(1, "rgba(255,240,245,.9)"); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.bezierCurveTo(-s * .4, -s * .7, s * .6, -s * .6, s, 0); ctx.bezierCurveTo(s * .5, s * .5, -s * .5, s * .5, -s, 0); ctx.fill(); ctx.restore(); }
    else if(k === "leaves"){ p.y += (50 + 60 * p.z) * dt; p.x += Math.sin(t * .7 + p.ph) * 55 * dt; p.a += (.6 + p.v) * dt; if(p.y > H + 40){ p.y = -40; p.x = L.r() * W; }
      const s = 16 + 18 * p.z, cols = ["#e76f51", "#f4a261", "#e9c46a", "#c1440e", "#d62828"]; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(Math.cos(t * 1.6 + p.ph), 1); ctx.globalAlpha = alpha * .95;
      leaf(ctx, -s, 0, s * 2.2, 0, cols[i % cols.length]); ctx.restore(); }
    else if(k === "butterflies"){ const cx = (p.x + t * (40 + 40 * p.v)) % (W + 300) - 150, cy = p.y * .8 + 80 + Math.sin(t * .9 + p.ph) * 90 + Math.sin(t * 2.3 + p.ph) * 20;
      const pal = [["#ff9f1c", "#c1440e"], ["#90e0ef", "#0077b6"], ["#ffffff", "#ffd6a5"], ["#ffb3c6", "#c9184a"], ["#ffe066", "#f08c00"]][i % 5];
      bfly(ctx, cx, cy, 26 + 20 * p.z, t * 14 + p.ph, pal[0], pal[1], Math.sin(t + p.ph) * .3); }
    else if(k === "hearts"){ p.y -= (35 + 50 * p.z) * dt; p.x += Math.sin(t + p.ph) * 25 * dt; if(p.y < -40){ p.y = H + 40; p.x = L.r() * W; }
      ctx.save(); ctx.globalAlpha = alpha * (.55 + .35 * p.z); heartPath(ctx, p.x, p.y, 22 + 30 * p.z); ctx.fillStyle = i % 3 ? "#ff6b8b" : "#ffd1dc"; ctx.shadowColor = "rgba(255,80,120,.6)"; ctx.shadowBlur = 14; ctx.fill(); ctx.restore(); }
    else if(k === "twinkle"){ const tw = Math.max(0, Math.sin(t * (1.2 + p.v * 1.8) + p.ph)); if(tw < .05) return;
      const s = (10 + 26 * p.z) * tw; ctx.save(); ctx.globalAlpha = alpha * tw * .9; ctx.translate(p.x, p.y);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.4); g.addColorStop(0, "rgba(255,247,215,.9)"); g.addColorStop(1, "rgba(255,247,215,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 1.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fffbe8"; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); ctx.restore(); }
    else if(k === "embers"){ p.y -= (80 + 160 * p.z) * dt; p.x += Math.sin(t * 3 + p.ph) * 30 * dt; if(p.y < -10){ p.y = H + 10 - L.r() * 200; p.x = W * (.2 + L.r() * .6); }
      const fl = .5 + .5 * Math.sin(t * 9 + p.ph), rad = 2 + 4 * p.z; ctx.save(); ctx.globalAlpha = alpha * (.4 + .6 * fl); ctx.fillStyle = "#ffb347"; ctx.shadowColor = "#ff7b00"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.fill(); ctx.restore(); }
    else if(k === "bubbles"){ p.y -= (40 + 80 * p.z) * dt; p.x += Math.sin(t * 2 + p.ph) * 12 * dt; if(p.y < -20){ p.y = H + 20; p.x = L.r() * W; }
      const rad = 3 + 10 * p.z; ctx.save(); ctx.globalAlpha = alpha * .8; ctx.strokeStyle = "rgba(255,248,220,.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(p.x - rad * .35, p.y - rad * .35, rad * .25, 0, 6.283); ctx.fill(); ctx.restore(); }
    else { p.y -= (8 + 18 * p.z) * dt; p.x += Math.sin(t * .6 + p.ph) * 14 * dt; if(p.y < -10){ p.y = H + 10; p.x = L.r() * W; }
      const fl = .55 + .45 * Math.sin(t * 2 + p.ph), rad = 1.5 + 4 * p.z; ctx.save(); ctx.globalAlpha = alpha * fl * .85; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 3); g.addColorStop(0, "rgba(255,236,180,1)"); g.addColorStop(1, "rgba(255,236,180,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 3, 0, 6.283); ctx.fill(); ctx.restore(); }
  });
  if(k === "twinkle" || k === "motes" || k === "embers"){ const lk = .5 + .5 * Math.sin(t * .5); const g = ctx.createRadialGradient(W * .85, H * .1, 0, W * .85, H * .1, W * .9); g.addColorStop(0, `rgba(255,214,150,${.14 * lk})`); g.addColorStop(1, "rgba(255,214,150,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

/* фон открытки без текста (текст потом пишется «от руки») */
function cardParts(c){
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true }); const L = drawScene(ctx, c); if(WATERMARK && !c.nowm) drawWatermark(ctx);
  return { bg: cv, L };
}
/* финал: фон с лёгким наездом камеры + живые эффекты + текст пишется + наклейки */
function drawFinal(ctx, st, tf, dt){
  const z = 1 + .04 * Math.min(1, tf / 8); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.drawImage(st.bg, -W / 2, -H / 2, W, H); ctx.restore();
  liveDraw(ctx, st.live, dt, Math.min(1, tf / .8));
  ctx.save(); drawText(ctx, st.L, st.c, tf); ctx.restore();
  if(st.c.st && st.c.st.length && tf > 2.2){ ctx.save(); ctx.globalAlpha = Math.min(1, (tf - 2.2) / .5); drawStickers(ctx, st.c.st); ctx.restore(); }
  if(tf > 3){ const k = ((tf - 3) % 4) / 4; const g = ctx.createLinearGradient(W * (k * 2.4 - .9), 0, W * (k * 2.4 - .5), H); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}

/* ---------- способы открытия ---------- */
const OPENERS = {
  env:     { name: "Конверт", emoji: "💌", hint: "Нажми, чтобы открыть", vhint: "👆  Нажмите на конверт", reveal: 2.45 },
  gift:    { name: "Подарок", emoji: "🎁", hint: "Нажми, чтобы открыть подарок", vhint: "👆  Нажмите на подарок", reveal: 2.3 },
  balloon: { name: "Шарик", emoji: "🎈", hint: "Лопни шарик!", vhint: "👆  Лопните шарик", reveal: 1.3 },
  scroll:  { name: "Свиток", emoji: "📜", hint: "Разверни свиток", vhint: "👆  Нажмите на свиток", reveal: 2.5 },
  scratch: { name: "Стирашка", emoji: "🪙", hint: "Сотри, чтобы увидеть", vhint: "👆  Сотрите пальцем", reveal: 3.1 }
};
function headline(ctx, st, o, opts){
  const S = st.S, c = st.c, hdA = 1 - easeOut(o / .5); if(hdA <= 0) return;
  ctx.save(); ctx.globalAlpha = hdA; ctx.textAlign = "center"; ctx.fillStyle = S.text; ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 8;
  const nm = (c.n || "").trim(); ctx.font = "400 76px Lobster, cursive"; ctx.fillText(nm ? `${nm}, тебе открытка!` : "Тебе открытка!", W / 2, 230, W - 120);
  if(c.fr){ ctx.font = "700 36px Nunito, sans-serif"; ctx.fillStyle = S.sub; ctx.fillText("от: " + c.fr.trim(), W / 2, 300, W - 160); }
  ctx.font = "800 40px Nunito, sans-serif"; ctx.fillStyle = S.sub; ctx.fillText(opts.hint || ("▶  " + OPENERS[st.op].hint), W / 2, 1290); ctx.restore();
}
function backdrop(ctx, st){ vbg(ctx, st.S.bg); glow(ctx, W / 2, H * .55, 680, "#ffffff", .25); const r0 = rng32(7); for(let i = 0; i < 60; i++){ ctx.fillStyle = rgba("#ffffff", .15 + r0() * .25); ctx.beginPath(); ctx.arc(r0() * W, r0() * H, 1 + r0() * 3, 0, 6.283); ctx.fill(); } }
/* карточка в процессе раскрытия: от прямоугольника (x,y,w,h) к полному экрану */
function zoomCard(ctx, st, from, k){ const x = from[0] * (1 - k), y = from[1] * (1 - k), w = from[2] + (W - from[2]) * k, h = from[3] + (H - from[3]) * k;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 40 * (1 - k); ctx.drawImage(st.bg, x, y, w, h); ctx.restore(); }
const GIFT_COL = { snow: ["#b5121b", "#e7b65a"], hearts: ["#e5383b", "#ffffff"], fireworks: ["#1d3557", "#e7b65a"], leaves: ["#9c2c13", "#e9c46a"], stars: ["#3a2f8a", "#ffe8a3"], petals: ["#ffffff", "#e2557a"], balloons: ["#2a9d8f", "#ffd166"], confetti: ["#7b2cbf", "#ffd166"] };

function drawGift(ctx, st, t, o, opts){
  backdrop(ctx, st); headline(ctx, st, o, opts);
  const [boxC, ribC] = GIFT_COL[st.theme] || GIFT_COL.confetti, bx = W / 2, by = 820, bw = 560, bh = 400;
  const shake = o < 0 ? (Math.sin(t * 22) * Math.max(0, Math.sin(t * 2.6)) * .045) : 0, lidK = easeOut(o / .55), boxK = easeIO((o - 1.2) / .8);
  // card rising
  const rise = easeOut((o - .35) / .9), cw = 600, chh = cw * H / W;
  if(o > .3 && o < OPENERS.gift.reveal){ const cy = by - 40 - rise * 760, zk = easeIO((o - 1.3) / 1.0);
    if(zk <= 0){ ctx.save(); ctx.beginPath(); ctx.rect(0, -2000, W, by - bh / 2 + 2000); ctx.clip(); ctx.shadowColor = "rgba(255,230,160,.8)"; ctx.shadowBlur = 40; ctx.drawImage(st.bg, bx - cw / 2, cy, cw, chh); ctx.restore(); }
    else zoomCard(ctx, st, [bx - cw / 2, cy, cw, chh], zk); }
  if(boxK >= 1) return;
  ctx.save(); ctx.globalAlpha = 1 - boxK; ctx.translate(bx, by + boxK * 500); ctx.rotate(shake);
  // light rays from the open box
  if(o > 0){ const rk = Math.min(1, o / .4) * (1 - boxK); ctx.save(); ctx.globalCompositeOperation = "lighter"; for(let i = 0; i < 9; i++){ const a = -Math.PI / 2 + (i - 4) * .17 + Math.sin(t * 2 + i) * .03;
      ctx.fillStyle = `rgba(255,236,170,${.10 * rk})`; ctx.beginPath(); ctx.moveTo(-60, -bh / 2); ctx.lineTo(Math.cos(a - .05) * 900, -bh / 2 + Math.sin(a - .05) * 900); ctx.lineTo(Math.cos(a + .05) * 900, -bh / 2 + Math.sin(a + .05) * 900); ctx.lineTo(60, -bh / 2); ctx.fill(); } ctx.restore(); }
  // box body
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.fillStyle = lin(ctx, -bw / 2, 0, bw / 2, 0, [shade(boxC, -.25), shade(boxC, .12), boxC, shade(boxC, -.3)]); rr(ctx, -bw / 2, -bh / 2, bw, bh, 14); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = lin(ctx, 0, -bh / 2, 0, bh / 2, ["rgba(255,255,255,.18)", "rgba(0,0,0,.18)"]); rr(ctx, -bw / 2, -bh / 2, bw, bh, 14); ctx.fill();
  ctx.fillStyle = lin(ctx, -40, 0, 40, 0, [shade(ribC, -.3), shade(ribC, .35), shade(ribC, -.15)]); ctx.fillRect(-38, -bh / 2, 76, bh);
  if(o > 0){ ctx.fillStyle = shade(boxC, -.55); ctx.fillRect(-bw / 2 + 8, -bh / 2, bw - 16, 18); }
  // lid
  if(lidK < 1){ ctx.save(); ctx.translate(lidK * 260, -bh / 2 - 50 - lidK * 900); ctx.rotate(lidK * .9); ctx.globalAlpha = 1 - lidK * .3;
    const lw = bw + 50, lh = 110; ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    ctx.fillStyle = lin(ctx, -lw / 2, 0, lw / 2, 0, [shade(boxC, -.2), shade(boxC, .18), boxC, shade(boxC, -.25)]); rr(ctx, -lw / 2, -lh / 2, lw, lh, 12); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.fillStyle = lin(ctx, -40, 0, 40, 0, [shade(ribC, -.3), shade(ribC, .35), shade(ribC, -.15)]); ctx.fillRect(-38, -lh / 2, 76, lh);
    // bow
    [[-1], [1]].forEach(([sx]) => { ctx.save(); ctx.scale(sx, 1); ctx.rotate(-.35); const g = ctx.createRadialGradient(70, -70, 10, 80, -60, 120); g.addColorStop(0, shade(ribC, .4)); g.addColorStop(1, shade(ribC, -.35));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(85, -62, 105, 58, -.25, 0, 6.283); ctx.fill(); ctx.fillStyle = rgba(shade(ribC, -.5), .45); ctx.beginPath(); ctx.ellipse(70, -60, 48, 22, -.25, 0, 6.283); ctx.fill(); ctx.restore();
      ctx.save(); ctx.scale(sx, 1); ctx.fillStyle = lin(ctx, 0, 0, 60, 120, [shade(ribC, .2), shade(ribC, -.3)]); ctx.beginPath(); ctx.moveTo(10, -40); ctx.lineTo(70, 90); ctx.lineTo(48, 82); ctx.lineTo(30, 100); ctx.lineTo(-6, -36); ctx.fill(); ctx.restore(); });
    ctx.fillStyle = lin(ctx, 0, -95, 0, -20, [shade(ribC, .35), shade(ribC, -.25)]); rr(ctx, -40, -100, 80, 76, 26); ctx.fill();
    ctx.restore(); }
  ctx.restore();
}

function drawBalloon(ctx, st, t, o, opts){
  backdrop(ctx, st); headline(ctx, st, o, opts);
  const col = st.S.seal, bx = W / 2, by = 700 + Math.sin(t * 1.6) * 14, popAt = .14;
  if(o < popAt){ const inf = 1 + (o > 0 ? o / popAt * .12 : 0) + (o < 0 ? Math.sin(t * 2) * .01 : 0);
    ctx.save(); ctx.translate(bx, by); ctx.scale(inf, inf); ctx.rotate(Math.sin(t * 1.1) * .04);
    ctx.strokeStyle = "rgba(90,70,80,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 400); ctx.bezierCurveTo(40, 480, -40, 560, 10, 660); ctx.stroke();
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
    const g = ctx.createRadialGradient(-110, -150, 20, 0, 0, 420); g.addColorStop(0, shade(col, .55)); g.addColorStop(.45, col); g.addColorStop(1, shade(col, -.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 380); ctx.bezierCurveTo(-200, 300, -330, 80, -320, -90); ctx.bezierCurveTo(-310, -300, -170, -400, 0, -400); ctx.bezierCurveTo(170, -400, 310, -300, 320, -90); ctx.bezierCurveTo(330, 80, 200, 300, 0, 380); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.fillStyle = shade(col, -.3); ctx.beginPath(); ctx.moveTo(-18, 400); ctx.lineTo(18, 400); ctx.lineTo(0, 378); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-150, -210, 48, 95, .55, 0, 6.283); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-90, -300, 18, 26, .5, 0, 6.283); ctx.fill();
    ctx.restore(); return; }
  if(!st.bursts.pop){ st.bursts.pop = true; for(let i = 0; i < 26; i++){ const a = st.rnd() * 6.283, v = 600 + st.rnd() * 700; st.ps.push({ k: "shard", x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, drag: 2, s: 24 + st.rnd() * 30, a: st.rnd() * 6, va: (st.rnd() - .5) * 14, c: col, life: 0, max: 1.6, sw: 0 }); } }
  const k = easeOut((o - popAt) / (OPENERS.balloon.reveal - popAt)), el = 1 + Math.sin(Math.min(1, (o - popAt) / 1.1) * Math.PI) * .06 * (1 - k);
  const cw = W * (.25 + .75 * k) * el, chh = cw * H / W; zoomCard(ctx, st, [W / 2 - cw / 2, H / 2 - chh / 2, cw, chh], 0);
}

function drawScroll(ctx, st, t, o, opts){
  backdrop(ctx, st); headline(ctx, st, o, opts);
  const cw = 820, chh = cw * H / W, cx = W / 2, cy = 720, ribK = easeOut(o / .4), unK = easeIO((o - .35) / 1.15), zK = easeIO((o - 1.55) / .95);
  const roll = (y, len) => { ctx.save(); const g = ctx.createLinearGradient(0, y - 46, 0, y + 46); g.addColorStop(0, "#c9a36b"); g.addColorStop(.35, "#fff1d6"); g.addColorStop(.6, "#e9cf9f"); g.addColorStop(1, "#9c7440");
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = g; rr(ctx, cx - len / 2, y - 46, len, 92, 46); ctx.fill(); ctx.shadowColor = "transparent";
    ["-1", "1"].forEach(s => { const ex = cx + s * (len / 2 + 14); ctx.fillStyle = lin(ctx, 0, y - 30, 0, y + 30, ["#e7b65a", "#8a5a1a"]); rr(ctx, ex - 22, y - 34, 44, 68, 16); ctx.fill(); }); ctx.restore(); };
  if(zK > 0){ zoomCard(ctx, st, [cx - cw / 2, cy - chh / 2, cw, chh], zK); if(zK < 1){ ctx.save(); ctx.globalAlpha = 1 - zK; roll(cy - chh / 2 - 10 - zK * 300, cw + 40); roll(cy + chh / 2 + 10 + zK * 300, cw + 40); ctx.restore(); } return; }
  const half = chh / 2 * unK;
  if(unK > 0){ ctx.save(); ctx.beginPath(); ctx.rect(cx - cw / 2, cy - half, cw, half * 2); ctx.clip(); ctx.drawImage(st.bg, cx - cw / 2, cy - chh / 2, cw, chh);
    const g = ctx.createLinearGradient(0, cy - half, 0, cy + half); g.addColorStop(0, "rgba(120,80,30,.35)"); g.addColorStop(.08, "rgba(120,80,30,0)"); g.addColorStop(.92, "rgba(120,80,30,0)"); g.addColorStop(1, "rgba(120,80,30,.35)"); ctx.fillStyle = g; ctx.fillRect(cx - cw / 2, cy - half, cw, half * 2); ctx.restore(); }
  const bob = o < 0 ? Math.sin(t * 2) * 6 : 0;
  roll(cy - half - (unK > 0 ? 40 : 0) + bob, cw + 40); if(unK > 0) roll(cy + half + 40, cw + 40);
  if(ribK < 1){ ctx.save(); ctx.globalAlpha = 1 - ribK; ctx.translate(0, ribK * 400 + bob); ctx.fillStyle = lin(ctx, cx - 40, 0, cx + 40, 0, ["#8a0d14", "#e5383b", "#8a0d14"]); ctx.fillRect(cx - 34, cy - 60, 68, 120);
    const g = ctx.createRadialGradient(cx - 12, cy - 12, 4, cx, cy, 64); g.addColorStop(0, shade(st.S.seal, .35)); g.addColorStop(1, shade(st.S.seal, -.25)); ctx.fillStyle = g; ctx.beginPath(); for(let i = 0; i <= 24; i++){ const a = i / 24 * 6.283, r2 = 58 + (i % 2 ? 5 : -3); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); } ctx.fill();
    heartPath(ctx, cx, cy + 3, 50); ctx.fillStyle = rgba(shade(st.S.seal, -.35), .7); ctx.fill(); ctx.restore(); }
}

const SCR = { w: 700, x: (W - 700) / 2 };
function scratchInit(st){ const h = SCR.w * H / W; st.scr = { h, y: 800 - h / 2, mask: document.createElement("canvas") }; const m = st.scr.mask; m.width = SCR.w; m.height = Math.round(h);
  const mc = m.getContext("2d", { willReadFrequently: true }); const g = mc.createLinearGradient(0, 0, SCR.w, h); g.addColorStop(0, "#c9ccd3"); g.addColorStop(.3, "#f4f5f8"); g.addColorStop(.55, "#b8bcc6"); g.addColorStop(.8, "#eef0f4"); g.addColorStop(1, "#a9adb8");
  mc.fillStyle = g; mc.fillRect(0, 0, SCR.w, h); const r = rng32(3); for(let i = 0; i < 1400; i++){ mc.fillStyle = `rgba(${r() > .5 ? "255,255,255" : "120,125,140"},${.15 + r() * .25})`; mc.fillRect(r() * SCR.w, r() * h, 2, 2); }
  mc.fillStyle = "rgba(90,95,110,.85)"; mc.textAlign = "center"; mc.font = "400 62px Lobster, cursive"; mc.fillText("Сотри меня ✨", SCR.w / 2, h / 2 - 10); mc.font = "800 30px Nunito, sans-serif"; mc.fillText("внутри открытка", SCR.w / 2, h / 2 + 46);
  st.scr.path = []; for(let row = 0; row < 8; row++){ const y = 55 + row * (h - 110) / 7; for(let i = 0; i <= 11; i++){ const x = row % 2 ? SCR.w - 40 - i * (SCR.w - 80) / 11 : 40 + i * (SCR.w - 80) / 11; st.scr.path.push([x, y + Math.sin(i * 1.3) * 26]); } }
  st.scr.done = 0; }
function scratchAt(st, x, y, r = 70){ const mc = st.scr.mask.getContext("2d"); mc.save(); mc.globalCompositeOperation = "destination-out"; mc.beginPath(); mc.arc(x, y, r, 0, 6.283); mc.fill(); mc.restore(); }
function scratchCleared(st){ const m = st.scr.mask, d = m.getContext("2d").getImageData(0, 0, m.width, m.height).data; let n = 0, c = 0; for(let i = 3; i < d.length; i += 4 * 37){ c++; if(d[i] < 40) n++; } return n / c; }
function drawScratch(ctx, st, t, o, opts){
  backdrop(ctx, st); headline(ctx, st, o, opts);
  if(!st.scr) scratchInit(st);
  const S = st.scr, path = S.path, prog = o > 0 && !st.manual ? Math.min(1, o / 1.9) : null;
  if(prog != null){ const upto = Math.floor(prog * (path.length - 1)); for(; S.done <= upto; S.done++){ const [x, y] = path[S.done]; scratchAt(st, x, y, 78); if(S.done > 0){ const [px, py] = path[S.done - 1]; for(let k = 1; k < 5; k++) scratchAt(st, px + (x - px) * k / 5, py + (y - py) * k / 5, 78); } } }
  const fadeK = easeOut((o - 1.95) / .35), zK = easeIO((o - 2.2) / .9);
  if(zK > 0){ zoomCard(ctx, st, [SCR.x, S.y, SCR.w, S.h], zK); return; }
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = "#fff"; rr(ctx, SCR.x - 14, S.y - 14, SCR.w + 28, S.h + 28, 26); ctx.fill(); ctx.restore();
  ctx.drawImage(st.bg, SCR.x, S.y, SCR.w, S.h);
  if(fadeK < 1){ ctx.save(); ctx.globalAlpha = 1 - fadeK; ctx.drawImage(S.mask, SCR.x, S.y, SCR.w, S.h);
    if(o < 0){ const k = ((t * .4) % 1); const g = ctx.createLinearGradient(SCR.x + SCR.w * (k * 2 - .6), 0, SCR.x + SCR.w * (k * 2 - .2), H); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(SCR.x, S.y, SCR.w, S.h); }
    ctx.restore(); }
  // coin
  if(prog != null && prog < 1){ const i = Math.min(path.length - 1, Math.floor(prog * (path.length - 1))), [x, y] = path[i];
    ctx.save(); ctx.translate(SCR.x + x + 40, S.y + y + 40); ctx.rotate(-.5); const g = ctx.createRadialGradient(-12, -12, 4, 0, 0, 52); g.addColorStop(0, "#fff3c4"); g.addColorStop(.5, "#e7b65a"); g.addColorStop(1, "#8a5a1a");
      ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 16; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 52, 52, 0, 0, 6.283); ctx.fill(); ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(120,80,20,.6)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 6.283); ctx.stroke(); ctx.restore(); }
  else if(o < 0){ ctx.save(); ctx.translate(SCR.x + SCR.w - 40, S.y + S.h - 30 + Math.sin(t * 3) * 10); ctx.font = "90px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🪙", 0, 0); ctx.restore(); }
}
