/* ---------- Рамки для своего фото: живой фон + ваше фото в рамке ---------- */
const FR_SAMPLE = ["cats", 5];
function frGold(ctx, y0, y1){ return lin(ctx, 0, y0, 0, y1, [[0, "#fff1c1"], [.25, "#e2b04a"], [.5, "#fff6d8"], [.75, "#b9852a"], [1, "#f3d27a"]]); }
function frPath(ctx, shape, cx, cy, w, h){
  ctx.beginPath();
  if(shape === "circle"){ ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 6.283); }
  else if(shape === "arch"){ const x = cx - w / 2, y = cy - h / 2, r = w / 2; ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(cx, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  else if(shape === "heart"){ const s = w; ctx.moveTo(cx, cy + h * .46);
    ctx.bezierCurveTo(cx - s * .62, cy + h * .02, cx - s * .56, cy - h * .52, cx, cy - h * .22);
    ctx.bezierCurveTo(cx + s * .56, cy - h * .52, cx + s * .62, cy + h * .02, cx, cy + h * .46); ctx.closePath(); }
  else { rr(ctx, cx - w / 2, cy - h / 2, w, h, 26); }
}
function frCover(ctx, img, cx, cy, w, h){ const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, cx - w / 2, cy - h / 2, w, h); }
function frDraw(ctx, r, p, c){
  const bg = phGet(p.set, p.n); if(bg) ctx.drawImage(bg, 0, 0, W, H); else vbg(ctx, ["#3a2430", "#1b1016"]);
  // мягкое затемнение и виньетка, чтобы рамка «читалась»
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(15,8,12,.25)"); g.addColorStop(.55, "rgba(15,8,12,.18)"); g.addColorStop(1, "rgba(15,8,12,.72)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  vignette(ctx, .35);
  const shape = this.shape, cx = W / 2, cy = shape === "heart" ? 430 : 410, w = shape === "circle" ? 560 : shape === "heart" ? 640 : 580, h = shape === "circle" ? 560 : shape === "heart" ? 600 : 640;
  const img = c.img || phGet(FR_SAMPLE[0], FR_SAMPLE[1]);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  frPath(ctx, shape, cx, cy, w + 52, h + 52 * (shape === "heart" ? 1.1 : 1)); ctx.fillStyle = frGold(ctx, cy - h / 2, cy + h / 2); ctx.fill(); ctx.restore();
  // гравировка рамки
  ctx.save(); frPath(ctx, shape, cx, cy, w + 30, h + 30 * (shape === "heart" ? 1.1 : 1)); ctx.strokeStyle = "rgba(120,80,20,.55)"; ctx.lineWidth = 3; ctx.stroke();
  frPath(ctx, shape, cx, cy, w + 40, h + 40 * (shape === "heart" ? 1.1 : 1)); ctx.strokeStyle = "rgba(255,248,220,.75)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  ctx.save(); frPath(ctx, shape, cx, cy, w, h); ctx.clip();
  if(img) frCover(ctx, img, cx, cy - (shape === "heart" ? 20 : 0), w, h); else { ctx.fillStyle = "#e9dcd2"; ctx.fillRect(0, 0, W, H); }
  const ig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * .3, cx, cy, Math.max(w, h) * .62); ig.addColorStop(0, "rgba(0,0,0,0)"); ig.addColorStop(1, "rgba(0,0,0,.28)"); ctx.fillStyle = ig; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save(); frPath(ctx, shape, cx, cy, w, h); ctx.strokeStyle = "rgba(90,55,10,.65)"; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
  if(shape === "rect"){ [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const x = cx + sx * (w / 2 + 13), y = cy + sy * (h / 2 + 13);
    ctx.save(); ctx.fillStyle = frGold(ctx, y - 30, y + 30); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.283); ctx.fill(); ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(120,80,20,.6)"; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.283); ctx.fill(); ctx.restore(); }); }
  sparkles(ctx, r, 16, "#fff3c4", [60, 60, W - 120, 760], 6, 18, [cx - w / 2, cy - h / 2, w, h]);
  const area = [90, 790, 900, 500];
  if(Math.abs(c.s || 0) % 2) return { area: [130, 830, 820, 440], anchor: "top", ts: .9, title: "#b23a5b", name: "#5b2a6e", body: "#4a3546", plaque: "rgba(255,251,243,.93)", tape: true, divider: "#d9849b" };
  return { area, anchor: "top", ts: .92, title: lin(ctx, 0, 790, 0, 1000, ["#fff1c1", "#f2c35b", "#c8902a"]), name: "#ffffff", body: "#fff8ea", from: "#ffd77a", shadow: "rgba(0,0,0,.75)", divider: "#f2c35b" };
}
const FR_DEFS = {
  fr_gold:   { name: "Золотая рамка", shape: "rect",   bg: [["roses", 0], ["peony", 2], ["bokeh", 1], ["sunset", 3], ["lilac", 5], ["hydr", 1], ["wild", 4], ["leaves", 2]] },
  fr_arch:   { name: "Арка-окошко", shape: "arch",     bg: [["cozy", 3], ["park", 1], ["blossom", 6], ["lavender", 2], ["trees", 2], ["mist", 3], ["sea", 2], ["forest", 1]] },
  fr_circle: { name: "Круглая рамка", shape: "circle", bg: [["peony", 7], ["hydr", 4], ["orchid", 3], ["lily", 2], ["bokeh", 5], ["daisy", 0], ["tulips", 1], ["roses", 4]] },
  fr_heart:  { name: "Сердце", shape: "heart",         bg: [["hearts", 0], ["roses", 1], ["bokeh", 7], ["peony", 5], ["hearts", 3], ["sunset", 7], ["lilac", 2], ["roses", 8]] },
  fr_xmas:   { name: "Новогодняя рамка", shape: "rect", bg: [["xmashome", 3], ["trees", 0], ["bokeh", 0], ["baubles", 4], ["fsnow", 2], ["xmashome", 8], ["mandarin", 4], ["snow", 0]] }
};
Object.entries(FR_DEFS).forEach(([id, d]) => { DESIGNS[id] = { name: d.name, frame: true, shape: d.shape, group: "frames", pals: d.bg.map(([set, n]) => ({ set, n: Math.min(n, (PH_SETS[set] || "").length / 2 - 1) })), draw: frDraw }; });
GROUPS.splice(1, 0, { id: "frames", name: "Рамки для фото", emoji: "🖼", sub: "Ваше фото в красивой рамке", designs: Object.keys(FR_DEFS) });
GROUP.frames = GROUPS[1];
const FR_FOR = { ny: ["fr_xmas"], xmas: ["fr_xmas"], oldny: ["fr_xmas"], cxmas: ["fr_xmas"], feb14: ["fr_heart"], love: ["fr_heart"], wedding: ["fr_heart"], anniv: ["fr_heart"], metday: ["fr_heart"], miss: ["fr_heart"] };
HOLIDAYS.forEach(h => { const own = (FR_FOR[h.id] || []).concat(["fr_gold", "fr_circle", "fr_arch", "fr_heart"]); const ids = [...new Set(own)];
  const firstNonPh = h.designs.findIndex(d => !(DESIGNS[d] && DESIGNS[d].photo)); h.designs.splice(firstNonPh < 0 ? h.designs.length : firstNonPh, 0, ...ids.filter(d => !h.designs.includes(d))); });

const _prepareCardPh = prepareCard;
prepareCard = async function(c, scale = 1){
  await _prepareCardPh(c, scale);
  const d = DESIGNS[c.d]; if(!d || !d.frame) return;
  const p = d.pals[(c.p || 0) % d.pals.length], small = scale < .5;
  const jobs = [phLoad(phUrl(p.set, p.n, small)).catch(() => phLoad(phUrl(p.set, p.n, !small)).catch(() => {}))];
  if(!c.img) jobs.push(phLoad(phUrl(FR_SAMPLE[0], FR_SAMPLE[1], small)).catch(() => {}));
  await Promise.all(jobs);
};
