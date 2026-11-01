/* Открытки — "card in an envelope": the closed envelope is the first frame (what the recipient sees in the chat),
   then the seal pops, the flap opens, the card slides out and fills the screen while themed effects play.
   Used both for the sent video and for the interactive page that opens from a link. */
"use strict";
const ENV_OPEN = 1.3;   // seconds of closed envelope before it opens (video thumbnail = closed envelope)
const ENV_DUR = 11;     // total video length

function envTheme(c){
  const h = c.h, d = c.d || "";
  if(["ny", "xmas"].includes(h) || ["winter", "baubles", "baubles3d", "ph_snow", "ph_frost", "ph_village", "ph_trees", "ph_baubles", "ph_xmashome", "ph_cocoa", "ph_birds"].includes(d)) return "snow";
  if(["feb14", "love", "wedding", "anniv", "family"].includes(h)) return "hearts";
  if(["jubilee", "grad", "feb23"].includes(h)) return "fireworks";
  if(["sep1", "teacher"].includes(h) || ["autumn", "ph_leaves", "ph_park", "ph_rowan", "ph_cozy"].includes(d)) return "leaves";
  if(["night", "angel", "evening"].includes(h)) return "stars";
  if(["mar8", "mom", "easter", "thanks", "elders", "medic", "morning", "goodday", "health", "weekend", "monday"].includes(h)) return "petals";
  if(["bday", "baby"].includes(h)) return "balloons";
  return "confetti";
}
const ENV_STYLE = {
  snow:      { bg: ["#16305c", "#0a1530"], env: "#b5121b", envD: "#8a0d14", seal: "#e7b65a", text: "#ffffff", sub: "#cfe0ff", melody: "jingle" },
  hearts:    { bg: ["#ffd6e0", "#ffb3c6"], env: "#ff8fab", envD: "#e5698d", seal: "#c9184a", text: "#800f2f", sub: "#a4133c", melody: "soft" },
  fireworks: { bg: ["#0b1033", "#1d1450"], env: "#1d3557", envD: "#14253f", seal: "#e7b65a", text: "#ffd166", sub: "#d8e2ff", melody: "ode" },
  leaves:    { bg: ["#fff1e0", "#ffd8b1"], env: "#d4a373", envD: "#b5835a", seal: "#9c2c13", text: "#7f3b12", sub: "#9c5a2a", melody: "soft" },
  stars:     { bg: ["#1b1f4b", "#3b2f7a"], env: "#4b3f8f", envD: "#3a3070", seal: "#ffe8a3", text: "#ffe8a3", sub: "#e6e0ff", melody: "soft" },
  petals:    { bg: ["#fff0f5", "#ffe1ec"], env: "#f6e3d3", envD: "#e6cdb6", seal: "#d6336c", text: "#a4133c", sub: "#b5585f", melody: "soft" },
  balloons:  { bg: ["#e8f4ff", "#fff0f6"], env: "#fdf3e6", envD: "#ecd9bd", seal: "#e2557a", text: "#7b2cbf", sub: "#d6336c", melody: "bday" },
  confetti:  { bg: ["#fff4ec", "#ffe1ea"], env: "#f3e2cc", envD: "#e0c7a6", seal: "#e2557a", text: "#5b2a62", sub: "#e2557a", melody: "soft" }
};
const easeOut = k => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3), easeIO = k => { k = Math.max(0, Math.min(1, k)); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };

function envState(c, cardImg){
  const theme = envTheme(c), S = ENV_STYLE[theme], parts = cardParts(c), op = OPENERS[c.op] ? c.op : "env";
  return { c, theme, S, op, card: cardImg, bg: parts.bg, L: parts.L, live: liveInit(liveKind(c), (c.s || 1) * 7 + 3), ps: [], bursts: { seal: false, open: false }, last: 0, rnd: rng32((c.s || 1) * 13 + 5) };
}
/* ---------- particles ---------- */
const PCOL = { confetti: ["#ff5d8f", "#ffd166", "#4cc9f0", "#9b5de5", "#06d6a0", "#ff9f1c"], hearts: ["#ff4d6d", "#ff8fab", "#c9184a", "#ffffff"], petals: ["#ffafcc", "#ffc8dd", "#ffffff", "#ffd6a5"], leaves: ["#e76f51", "#f4a261", "#e9c46a", "#d62828"], snow: ["#ffffff"], stars: ["#ffe8a3", "#ffffff"], gold: ["#f6d38b", "#fff1c1", "#e7b65a"] };
function spawn(st, kind, n, x, y, spread, up){
  const r = st.rnd;
  for(let i = 0; i < n; i++){ const a = -Math.PI / 2 + (r() - .5) * spread, v = (up || 900) * (.4 + r() * .7);
    const cols = PCOL[kind] || PCOL.confetti;
    st.ps.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: kind === "snow" || kind === "stars" ? 60 : kind === "balloon" ? -120 : 520, drag: kind === "snow" || kind === "petals" || kind === "leaves" ? 2.2 : 1.1,
      s: kind === "balloon" ? 60 + r() * 30 : 10 + r() * 16, a: r() * 6.28, va: (r() - .5) * 8, c: cols[Math.floor(r() * cols.length)], life: 0, max: 6 + r() * 3, sw: r() * 6.28 }); }
}
function rain(st, kind, n, w = W){ const r = st.rnd; for(let i = 0; i < n; i++){ const cols = PCOL[kind] || PCOL.confetti; st.ps.push({ k: kind, x: r() * w, y: -40 - r() * 600, vx: 0, vy: 80 + r() * 140, g: 0, drag: 0, s: kind === "snow" ? 5 + r() * 9 : 12 + r() * 14, a: r() * 6.28, va: (r() - .5) * 3, c: cols[Math.floor(r() * cols.length)], life: 0, max: 99, sw: r() * 6.28 }); } }
function fireworkP(st, x, y, col){ const r = st.rnd; for(let i = 0; i < 46; i++){ const a = i / 46 * 6.28, v = 380 + r() * 120; st.ps.push({ k: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 140, drag: 1.6, s: 5, a: 0, va: 0, c: col, life: 0, max: 1.6 + r() * .5, sw: 0 }); } }
function stepParticles(st, dt){
  st.ps.forEach(p => { p.life += dt; p.vx *= Math.exp(-p.drag * dt); p.vy = p.vy * Math.exp(-p.drag * dt) + p.g * dt; p.sw += dt * 2;
    p.x += (p.vx + (["snow", "petals", "leaves"].includes(p.k) ? Math.sin(p.sw) * 40 : 0)) * dt; p.y += p.vy * dt; p.a += p.va * dt;
    if(p.max === 99 && p.y > H + 40){ p.y = -40; p.x = st.rnd() * W; } });
  st.ps = st.ps.filter(p => p.life < p.max && p.y < H + 200 && p.y > -900);
}
function drawParticle(ctx, p){
  const fade = p.max < 90 ? Math.min(1, (p.max - p.life) / .8) : 1;
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.a);
  switch(p.k){
    case "hearts": heartPath(ctx, 0, 0, p.s * 2); ctx.fillStyle = p.c; ctx.fill(); break;
    case "petals": ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s * .9, p.s * .45, 0, 0, 6.283); ctx.fill(); break;
    case "leaves": leaf(ctx, -p.s, 0, p.s * 2.4, 0, p.c); break;
    case "snow": ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(160,190,255,.8)"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, p.s * .5, 0, 6.283); ctx.fill(); if(p.s > 11){ ctx.shadowBlur = 0; snowflake(ctx, 0, 0, p.s, "rgba(255,255,255,.95)", 2); } break;
    case "stars": case "gold": star5(ctx, 0, 0, p.s * .8, p.c); break;
    case "spark": ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, p.s * .6, 0, 6.283); ctx.fill(); break;
    case "balloon": ctx.rotate(-p.a); balloon(ctx, 0, 0, p.s, p.c, () => .5, "rgba(120,120,140,.6)"); break;
    default: ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
  }
  ctx.restore();
}
function themedBurst(st, x, y, big){
  const t = st.theme, n = big ? 1 : .45;
  if(t === "snow"){ spawn(st, "gold", 40 * n, x, y, 6.28, 700); spawn(st, "snow", 50 * n, x, y, 6.28, 600); if(big) rain(st, "snow", 70); }
  else if(t === "hearts"){ spawn(st, "hearts", 46 * n, x, y, 6.28, 800); if(big) rain(st, "hearts", 26); }
  else if(t === "petals"){ spawn(st, "petals", 60 * n, x, y, 6.28, 750); if(big) rain(st, "petals", 40); }
  else if(t === "leaves"){ spawn(st, "leaves", 40 * n, x, y, 6.28, 700); if(big) rain(st, "leaves", 28); }
  else if(t === "stars"){ spawn(st, "stars", 50 * n, x, y, 6.28, 650); if(big) rain(st, "stars", 30); }
  else if(t === "fireworks"){ spawn(st, "confetti", 60 * n, x, y, 2.4, 1100); if(big){ fireworkP(st, 260, 360, "#ffd166"); fireworkP(st, 820, 300, "#ff5d8f"); fireworkP(st, 540, 520, "#4cc9f0"); } }
  else if(t === "balloons"){ spawn(st, "confetti", 90 * n, x, y, 2.6, 1200); if(big) for(let i = 0; i < 7; i++) st.ps.push({ k: "balloon", x: 80 + i * 150 + st.rnd() * 40, y: H + 80 + st.rnd() * 300, vx: 0, vy: -260 - st.rnd() * 120, g: 0, drag: 0, s: 55 + st.rnd() * 25, a: (st.rnd() - .5) * .3, va: 0, c: PCOL.confetti[i % 6], life: 0, max: 9, sw: st.rnd() * 6 }); }
  else spawn(st, "confetti", 100 * n, x, y, 2.6, 1200);
}

/* ---------- envelope drawing ---------- */
const EW = 820, EH = 560, EX = (W - EW) / 2, EY = 560;
function drawEnvObj(ctx, st, t, o, opts){
  const S = st.S, c = st.c;
  const flapK = easeIO(o / .7), slideK = easeOut((o - .55) / 1.0), zoomK = easeIO((o - 1.45) / 1.0);
  vbg(ctx, S.bg); glow(ctx, W / 2, EY + EH / 2, 640, "#ffffff", .25);
  const r0 = rng32(7); for(let i = 0; i < 60; i++){ ctx.fillStyle = rgba("#ffffff", .15 + r0() * .25); ctx.beginPath(); ctx.arc(r0() * W, r0() * H, 1 + r0() * 3, 0, 6.283); ctx.fill(); }
  // headline (fades when opening)
  const hdA = 1 - easeOut(o / .5);
  if(hdA > 0){ ctx.save(); ctx.globalAlpha = hdA; ctx.textAlign = "center"; ctx.fillStyle = S.text;
    const nm = (c.n || "").trim(); ctx.font = "400 76px Lobster, cursive"; ctx.fillText(nm ? `${nm}, тебе открытка!` : "Тебе открытка!", W / 2, 300, W - 120);
    ctx.font = "800 40px Nunito, sans-serif"; ctx.fillStyle = S.sub; ctx.fillText(opts.hint || "▶  Нажми, чтобы открыть", W / 2, 1270);
    if(c.fr) { ctx.font = "700 36px Nunito, sans-serif"; ctx.fillText("от: " + c.fr.trim(), W / 2, 380, W - 160); }
    ctx.restore(); }
  // envelope + card, then zoom the card to full screen
  const env = 1 - zoomK, wob = o < 0 ? Math.sin(t * 5) * .012 : 0;
  ctx.save(); ctx.globalAlpha = Math.max(0, env); ctx.translate(W / 2, EY + EH / 2 + zoomK * 500); ctx.rotate(wob); ctx.translate(-W / 2, -(EY + EH / 2));
  ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  ctx.fillStyle = S.envD; rr(ctx, EX, EY, EW, EH, 18); ctx.fill(); ctx.shadowColor = "transparent";
  const flapUp = flapK > .5, flapTipY = EY + EH * .56 * Math.cos(Math.PI * flapK);
  const drawFlap = () => { ctx.fillStyle = lin(ctx, 0, EY, 0, EY + EH * .56, flapUp ? [shade(S.envD, -.1), S.envD] : [shade(S.env, .08), shade(S.env, -.06)]);
    ctx.beginPath(); ctx.moveTo(EX + 6, EY + 4); ctx.lineTo(EX + EW - 6, EY + 4); ctx.lineTo(W / 2, flapTipY); ctx.closePath(); ctx.fill(); };
  if(flapUp) drawFlap();
  // card inside (slides up)
  const cw = 740, ch = cw * H / W, cy = EY + 40 - slideK * 640;
  if(slideK > 0 || flapUp){ ctx.save(); ctx.beginPath(); ctx.rect(EX - 200, -2000, EW + 400, EY + EH * .5 + 2000); ctx.clip(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 24; ctx.drawImage(st.bg, W / 2 - cw / 2, cy, cw, ch); ctx.restore(); }
  // front pocket
  ctx.fillStyle = lin(ctx, 0, EY + EH * .35, 0, EY + EH, [S.env, shade(S.env, -.08)]);
  ctx.beginPath(); ctx.moveTo(EX, EY + 14); ctx.lineTo(W / 2, EY + EH * .58); ctx.lineTo(EX + EW, EY + 14); ctx.lineTo(EX + EW, EY + EH - 18); ctx.arcTo(EX + EW, EY + EH, EX + EW - 18, EY + EH, 18); ctx.lineTo(EX + 18, EY + EH); ctx.arcTo(EX, EY + EH, EX, EY + EH - 18, 18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(shade(S.envD, -.2), .35); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(EX + 8, EY + EH - 8); ctx.lineTo(W / 2, EY + EH * .58); ctx.lineTo(EX + EW - 8, EY + EH - 8); ctx.stroke();
  if(!flapUp) drawFlap();
  // wax seal
  const sealK = o < 0 ? 1 : 1 - easeOut(o / .35), sealS = o < 0 ? 1 + Math.sin(t * 6) * .03 : 1 + (1 - sealK) * .8;
  if(sealK > 0){ ctx.save(); ctx.globalAlpha = sealK; ctx.translate(W / 2, EY + EH * .54); ctx.scale(sealS, sealS);
    const g = ctx.createRadialGradient(-14, -14, 4, 0, 0, 74); g.addColorStop(0, shade(S.seal, .35)); g.addColorStop(1, shade(S.seal, -.25));
    ctx.fillStyle = g; ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.beginPath();
    for(let i = 0; i <= 24; i++){ const a = i / 24 * 6.283, rr2 = 70 + (i % 2 ? 5 : -3); ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.fill(); ctx.shadowColor = "transparent";
    heartPath(ctx, 0, 4, 64); ctx.fillStyle = rgba(shade(S.seal, -.35), .7); ctx.fill(); heartPath(ctx, -2, 1, 60); ctx.fillStyle = rgba(shade(S.seal, .25), .6); ctx.fill();
    ctx.restore(); }
  ctx.restore();
  // the card zooming to full screen
  if(zoomK > 0){ const sc = cw / W + (1 - cw / W) * zoomK, x = W / 2 - W * sc / 2, y0 = cy + (1 - zoomK) * 0, y = y0 + (0 - y0) * zoomK;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 40 * (1 - zoomK); ctx.drawImage(st.bg, x, y, W * sc, H * sc); ctx.restore(); }
}
function drawEnvelopeFrame(ctx, st, t, opts = {}){
  const dt = Math.max(0, Math.min(.1, t - st.last)); st.last = t;
  const o = t - ENV_OPEN, R = OPENERS[st.op].reveal;
  if(o >= .05 && !st.bursts.seal){ st.bursts.seal = true; if(st.op !== "scratch") themedBurst(st, W / 2, st.op === "env" ? EY + EH * .52 : H * .55, false); }
  if(o >= R - .25 && !st.bursts.open){ st.bursts.open = true; themedBurst(st, W / 2, H * .55, true); }
  stepParticles(st, dt);
  if(o >= R) drawFinal(ctx, st, o - R, dt);
  else if(st.op === "env") drawEnvObj(ctx, st, t, o, opts);
  else ({ gift: drawGift, balloon: drawBalloon, scroll: drawScroll, scratch: drawScratch })[st.op](ctx, st, t, o, opts);
  st.ps.forEach(p => drawParticle(ctx, p));
}

/* ---------- the sent video ---------- */
function popSound(ac, out, t){
  const len = .25, buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
  for(let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; const g = ac.createGain(); g.gain.value = .9;
  s.connect(f); f.connect(g); g.connect(out); s.start(t);
  [880, 1320, 1760].forEach((fr, i) => { const o = ac.createOscillator(), gg = ac.createGain(); o.frequency.value = fr; gg.gain.setValueAtTime(0, t + .05 + i * .06); gg.gain.linearRampToValueAtTime(.18, t + .06 + i * .06); gg.gain.exponentialRampToValueAtTime(.001, t + .6 + i * .06); o.connect(gg); gg.connect(out); o.start(t + .05 + i * .06); o.stop(t + .8 + i * .06); });
}
async function makeEnvelopeVideo(c, opts = {}){
  const sup = await mp4Support();
  if(sup){ try{
    const { sound = true, onProgress, preview } = opts;
    await prepareCard(c, 1); const card = cpuCopy(renderCard(c));
    if(window.Card3D && Card3D.release) Card3D.release();
    const st = envState(c, card);
    return await encodeMp4({ sup, dur: ENV_DUR, onProgress, preview,
      draw: (ctx, t) => drawEnvelopeFrame(ctx, st, t),
      buildAudio: sound ? async ac => { const mg = ac.createGain(); mg.gain.value = .85; mg.connect(ac.destination);
        popSound(ac, ac.destination, ENV_OPEN + .05);
        const sub = { currentTime: ENV_OPEN + .5, createDelay: () => ac.createDelay(), createGain: () => ac.createGain(), createOscillator: () => ac.createOscillator() };
        scheduleMelody(sub, mg, st.S.melody, ENV_DUR - ENV_OPEN - .5); } : null });
  }catch(e){ console.warn("mp4 failed, fallback", e); } }
  return makeEnvelopeVideoRec(c, opts);
}
async function makeEnvelopeVideoRec(c, { sound = true, onProgress, preview } = {}){
  const mime = pickMime(); if(!mime) throw new Error("no-recorder");
  await prepareCard(c, 1);
  const card = renderCard(c);
  if(window.Card3D && Card3D.release) Card3D.release();
  const st = envState(c, card);
  const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
  const dest = ac.createMediaStreamDestination();
  if(sound){ const mg = ac.createGain(); mg.gain.value = .85; mg.connect(dest);
    const t0 = ac.currentTime; popSound(ac, dest, t0 + ENV_OPEN + .05);
    const sub = { currentTime: t0 + ENV_OPEN + .5, createDelay: () => ac.createDelay(), createGain: () => ac.createGain(), createOscillator: () => ac.createOscillator() };
    scheduleMelody(sub, mg, st.S.melody, ENV_DUR - ENV_OPEN - .5); }
  const vc = document.createElement("canvas"); vc.width = 720; vc.height = 900; const ctx = vc.getContext("2d"); ctx.scale(720 / W, 900 / H);
  drawEnvelopeFrame(ctx, st, 0);
  const stream = new MediaStream([...vc.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 }); const chunks = [];
  rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => rec.onstop = res);
  rec.start(250); const t0 = performance.now();
  await new Promise(res => { const tick = () => { const t = (performance.now() - t0) / 1000; drawEnvelopeFrame(ctx, st, t); if(preview) preview(vc); if(onProgress) onProgress(Math.min(1, t / ENV_DUR));
    if(t < ENV_DUR) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
  rec.stop(); await done; stream.getTracks().forEach(tr => tr.stop()); ac.close();
  const type = mime.split(";")[0];
  return { blob: new Blob(chunks, { type }), type, ext: type === "video/mp4" ? "mp4" : "webm" };
}
