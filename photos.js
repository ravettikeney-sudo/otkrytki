/* ---------- Фото-открытки: настоящие фотографии (Unsplash License) + текст поверх ----------
   Каждая «коллекция» — это дизайн ph_<имя>, а её фотографии — варианты (палитры). */
const PH_SETS = {"bday": "t0b1b1b1b1b1t0", "candles": "b1t0", "trees": "t1t1t1t1t1t0t1t1t1", "baubles": "t1b1t1t0t1t0b1t0t1b1t1b0", "roses": "t1t1t1t1t1t1t1b0t0", "tulips": "b1t1t1t1t1b1t1t0b0", "cats": "b1b1b1t0b1t0t1t0b1t1", "coffee": "t1b0t0t0t1b1t0t0", "cozy": "b1t1b1b1b1b1t1b1t0b1", "leaves": "t1t1t1t1t1b1t1b0b0t1b1", "rowan": "t1b1t1t1t1t1t1", "champ": "t1t1t0t1", "balloons": "b0b0b0t1t1b1b0t1b0t0", "snow": "t0t1t0t1b0t1b0t1t0", "peony": "t1t1t1t1t1t1b0t1t1t1b0b1", "night": "t0t0t0t0t0t0t0", "gifts": "t1b1b1t1t0b1t1", "rings": "t1b1t1b1t0t0", "easter": "t1t1t1t1t1t1t0", "daisy": "t1t0t0t0t1b1t0", "sunflower": "t1t1t0t0t0b0b1", "sea": "b0t1b0b0t0t0t0t0b0", "teddy": "t1b0b1b1t1t1t0b0", "hearts": "t1t0t1t1t1t0b0t0b0", "pancakes": "t1t0t0t1b1t1t1"};
const PH_NAMES = { bday: "Торт и свечи", candles: "Свечи", trees: "Ёлка и огни", baubles: "Ёлочные шары", roses: "Розы", tulips: "Тюльпаны", cats: "Котики", coffee: "Утренний кофе",
  cozy: "Уютная осень", leaves: "Осенние листья", rowan: "Рябина", champ: "Шампанское", balloons: "Воздушные шары", snow: "Зимний лес", peony: "Пионы", night: "Луна и звёзды",
  gifts: "Подарки", rings: "Кольца", easter: "Пасхальные яйца", daisy: "Ромашки", sunflower: "Подсолнухи", sea: "Море", teddy: "Мишки", hearts: "Сердечки", pancakes: "Блины" };
const PH_FOR = {
  bday: "bday balloons gifts roses peony champ cats teddy candles", ny: "trees baubles snow champ gifts cats", xmas: "trees candles baubles snow night",
  feb14: "hearts roses peony rings teddy", feb23: "sea snow champ leaves gifts", mar8: "tulips peony roses daisy gifts", easter: "easter tulips daisy",
  mom: "peony roses tulips daisy hearts", wedding: "rings roses peony champ hearts", anniv: "rings hearts roses champ candles", baby: "teddy balloons daisy",
  morning: "coffee cozy sunflower daisy cats leaves rowan", night: "night candles cats sea", weekend: "sea cozy coffee sunflower leaves",
  love: "hearts roses peony teddy sea", thanks: "peony roses daisy sunflower tulips", health: "cozy daisy sunflower cats teddy",
  goodday: "sunflower daisy coffee cozy rowan leaves cats sea", monday: "coffee sunflower cats cozy", friday: "champ sea balloons cats",
  jubilee: "champ roses peony bday balloons", sep1: "leaves rowan sunflower balloons", teacher: "leaves peony roses rowan", grad: "balloons champ sea",
  medic: "daisy tulips peony sea", builder: "sea sunflower leaves", family: "daisy hearts sunflower cozy", angel: "candles daisy peony night",
  housewarming: "cozy gifts balloons candles", maslenitsa: "pancakes sunflower", elders: "leaves rowan daisy peony cozy"
};
(function seasonal(){ const m = new Date().getMonth(); if(m >= 8 && m <= 10) ["morning", "goodday", "weekend", "monday"].forEach(h => { PH_FOR[h] = "cozy leaves rowan " + PH_FOR[h].replace(/\b(cozy|leaves|rowan)\b/g, "").trim(); });
  if(m === 11 || m <= 1) ["morning", "goodday", "weekend"].forEach(h => { PH_FOR[h] = PH_FOR[h] + " snow"; }); })();

const PH_IMG = {};
function phUrl(set, n, small){ return `ph/${set}/${n}${small ? "t" : ""}.webp`; }
function phLoad(url){
  if(PH_IMG[url]) return PH_IMG[url].p;
  const im = new Image(); const rec = { im, ok: false };
  rec.p = new Promise((res, rej) => { im.onload = () => { rec.ok = true; res(im); }; im.onerror = rej; });
  im.src = new URL(url, document.baseURI).href; PH_IMG[url] = rec; return rec.p;
}
function phGet(set, n){ const a = PH_IMG[phUrl(set, n)], b = PH_IMG[phUrl(set, n, true)]; return a && a.ok ? a.im : b && b.ok ? b.im : null; }

function phDivider(ctx, x, y, col){
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.moveTo(x - 190, y); ctx.lineTo(x - 34, y); ctx.moveTo(x + 34, y); ctx.lineTo(x + 190, y); ctx.stroke();
  heartPath(ctx, x, y - 13, 30); ctx.fill(); ctx.restore();
}
const PH_STYLES = ["light", "gold", "note"];
function phDraw(ctx, r, p, c){
  const set = this.photo, n = (c.p || 0) % this.pals.length, img = phGet(set, n);
  if(img) ctx.drawImage(img, 0, 0, W, H);
  else { vbg(ctx, ["#f3e7dc", "#e9d6c8"]); }
  const style = PH_STYLES[Math.abs(c.s || 0) % 3], top = (c.tp || p.pos) === "t", busy = p.busy;
  const area = top ? [90, 70, 900, 620] : [90, 640, 900, 620];
  if(style !== "note"){
    const a = busy ? .68 : .55, g = top ? ctx.createLinearGradient(0, 0, 0, 900) : ctx.createLinearGradient(0, H, 0, 450);
    g.addColorStop(0, `rgba(10,6,12,${a})`); g.addColorStop(.55, `rgba(10,6,12,${a * .45})`); g.addColorStop(1, "rgba(10,6,12,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  vignette(ctx, .22);
  if(style === "gold") sparkles(ctx, r, 14, "#ffe7a3", [area[0] - 60, area[1] - 40, area[2] + 120, area[3] + 80], 6, 16);
  const [ax, ay, aw, ah] = area;
  const anchor = top ? "top" : "bottom", ts = 1.12;
  if(style === "light") return { area, anchor, ts, title: "#ffffff", name: lin(ctx, 0, ay, 0, ay + ah, ["#fff6df", "#ffd59a"]), body: "#ffffff", from: "#ffe6b8", shadow: "rgba(0,0,0,.65)", divider: "rgba(255,255,255,.9)" };
  if(style === "gold") return { area, anchor, ts, title: lin(ctx, 0, ay, 0, ay + ah * .6, ["#fff1c1", "#f2c35b", "#c8902a"]), name: "#ffffff", body: "#fff8ea", from: "#ffd77a", shadow: "rgba(30,15,0,.75)", divider: "#f2c35b" };
  return { area: [ax + 40, ay + (top ? 40 : 0), aw - 80, ah - 50], anchor, ts: 1.04, title: "#b23a5b", name: "#5b2a6e", body: "#4a3546", plaque: "rgba(255,251,243,.92)", tape: true, divider: "#d9849b" };
}
Object.entries(PH_SETS).forEach(([set, code]) => {
  const pals = []; for(let i = 0; i < code.length; i += 2) pals.push({ pos: code[i], busy: code[i + 1] === "1" });
  DESIGNS["ph_" + set] = { name: PH_NAMES[set], photo: set, group: "photo", pals, draw: phDraw };
});
GROUPS.unshift({ id: "photo", name: "Красивые фото", emoji: "📸", sub: "Настоящие фотографии", designs: Object.keys(PH_SETS).map(s => "ph_" + s) });
GROUP.photo = GROUPS[0];
Object.entries(PH_FOR).forEach(([h, sets]) => { if(!HOL[h]) return; const ids = sets.split(/\s+/).filter(Boolean).map(s => "ph_" + s).filter(d => DESIGNS[d]);
  HOL[h].designs = ids.concat(HOL[h].designs.filter(d => !ids.includes(d))); });

const _prepareCardBase = prepareCard;
prepareCard = async function(c, scale = 1){
  await _prepareCardBase(c, scale);
  const d = DESIGNS[c.d]; if(!d || !d.photo) return;
  const n = (c.p || 0) % d.pals.length;
  try{ await phLoad(phUrl(d.photo, n, scale < .5)); }catch(e){ try{ await phLoad(phUrl(d.photo, n, !(scale < .5))); }catch(e2){} }
};
const _cardOfDayBase = cardOfDay;
cardOfDay = function(now = new Date()){
  const c = _cardOfDayBase(now), ph = HOL[c.h].designs.filter(d => DESIGNS[d] && DESIGNS[d].photo);
  if(ph.length){ c.d = ph[c.s % Math.min(3, ph.length)]; c.p = c.s % DESIGNS[c.d].pals.length; }
  return c;
};
