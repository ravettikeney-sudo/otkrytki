/* Открытки — video cards: the card is animated (gentle zoom, falling particles, text appearing),
   recorded with MediaRecorder together with a synthesized music-box melody and/or a recorded voice. */
"use strict";
const MELODIES = {
  none: { name: "Без музыки" },
  bday: { name: "С днём рождения", bpm: 120, notes: [[67,.75],[67,.25],[69,1],[67,1],[72,1],[71,2],[67,.75],[67,.25],[69,1],[67,1],[74,1],[72,2],[67,.75],[67,.25],[79,1],[76,1],[72,1],[71,1],[69,2],[77,.75],[77,.25],[76,1],[72,1],[74,1],[72,3]] },
  jingle: { name: "Зимняя (Jingle Bells)", bpm: 180, notes: [[64,1],[64,1],[64,2],[64,1],[64,1],[64,2],[64,1],[67,1],[60,1.5],[62,.5],[64,4],[65,1],[65,1],[65,1.5],[65,.5],[65,1],[64,1],[64,1],[64,.5],[64,.5],[64,1],[62,1],[62,1],[64,1],[62,2],[67,2],[64,1],[64,1],[64,2],[64,1],[64,1],[64,2],[64,1],[67,1],[60,1.5],[62,.5],[64,4],[65,1],[65,1],[65,1.5],[65,.5],[65,1],[64,1],[64,1],[64,.5],[64,.5],[67,1],[67,1],[65,1],[62,1],[60,4]] },
  ode: { name: "Ода к радости", bpm: 110, notes: [[64,1],[64,1],[65,1],[67,1],[67,1],[65,1],[64,1],[62,1],[60,1],[60,1],[62,1],[64,1],[64,1.5],[62,.5],[62,2],[64,1],[64,1],[65,1],[67,1],[67,1],[65,1],[64,1],[62,1],[60,1],[60,1],[62,1],[64,1],[62,1.5],[60,.5],[60,2]] },
  soft: { name: "Нежная", bpm: 140, notes: [[60,.5],[64,.5],[67,.5],[72,.5],[67,.5],[64,.5],[57,.5],[60,.5],[64,.5],[69,.5],[64,.5],[60,.5],[53,.5],[57,.5],[60,.5],[65,.5],[60,.5],[57,.5],[55,.5],[59,.5],[62,.5],[67,.5],[71,.5],[74,1.5]] }
};
function scheduleMelody(ac, out, key, dur){
  const m = MELODIES[key]; if(!m || !m.notes) return;
  const beat = 60 / m.bpm, delay = ac.createDelay(); delay.delayTime.value = beat * .75;
  const fb = ac.createGain(); fb.gain.value = .22; delay.connect(fb); fb.connect(delay); delay.connect(out);
  let t = ac.currentTime + .25; const end = ac.currentTime + dur;
  while(t < end){ for(const [n, b] of m.notes){ if(t >= end) break; const f = 440 * Math.pow(2, (n - 69) / 12);
    [[1, "sine", .32], [2, "triangle", .06], [3, "sine", .03]].forEach(([k, type, v]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f * k;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + Math.min(1.6, b * beat * 2.2));
      o.connect(g); g.connect(out); g.connect(delay); o.start(t); o.stop(t + 1.7); });
    t += b * beat; } t += beat; }
}
function pickMime(){
  const c = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return c.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}
function particleKind(c){ return ["winter", "baubles", "night"].includes(c.d) ? "snow" : ["hearts", "wedding", "roses"].includes(c.d) || ["feb14", "love"].includes(c.h) ? "heart" : ["tulips", "wreath", "meadow", "easter"].includes(c.d) ? "petal" : "confetti"; }
function makeParticles(kind, n, w, h){
  const cols = kind === "heart" ? ["#ff4d6d", "#ff8fab", "#c9184a", "#ffffff"] : kind === "petal" ? ["#ffafcc", "#ffc8dd", "#ffffff", "#ffd166"] : ["#ff5d8f", "#ffd166", "#4cc9f0", "#9b5de5", "#06d6a0"];
  return Array.from({ length: n }, () => ({ x: Math.random() * w, y: -Math.random() * h * 1.2, v: 2 + Math.random() * 3.5, s: 10 + Math.random() * 16, a: Math.random() * 6.28, va: (Math.random() - .5) * .12, c: cols[Math.floor(Math.random() * cols.length)] }));
}
function drawParticles(ctx, kind, ps, w, h, alpha = 1){
  const k = ps.k || 1;
  ps.forEach(p => { p.y += p.v * k; p.x += Math.sin(p.a) * 1.2 * k; p.a += p.va * k; if(p.y > h + 30){ p.y = -30; p.x = Math.random() * w; }
    ctx.save(); ctx.globalAlpha = alpha * (kind === "snow" ? .85 : .9); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    if(kind === "snow"){ ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(120,140,200,.6)"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, p.s / 3, 0, 6.283); ctx.fill(); }
    else if(kind === "heart"){ heartPath(ctx, 0, 0, p.s * 1.7); ctx.fillStyle = p.c; ctx.fill(); }
    else if(kind === "petal"){ ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s * .6, p.s * .3, 0, 0, 6.283); ctx.fill(); }
    else { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
    ctx.restore(); });
}
/* Draws one animation frame at time t (seconds) into a 1080×1350 coordinate space. */
function videoFrame(ctx, scene, L, c, ps, kind, t, dur){
  const z = 1 + .05 * Math.min(1, t / dur);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.drawImage(scene, -W / 2, -H / 2); ctx.restore();
  drawParticles(ctx, kind, ps, W, H, Math.min(1, t / .6));
  drawText(ctx, JSON.parse(JSON.stringify(L)), c, t);
  const shine = (t % 4) / 4; if(t > 2){ const g = ctx.createLinearGradient(W * (shine * 2 - .5), 0, W * (shine * 2 - .2), H); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if(WATERMARK && !c.nowm) drawWatermark(ctx);
}
/* Records the video. onFrame(canvas) lets the caller show the live preview. */
async function makeVideo(c, opts = {}){
  const sup = window.mp4Support ? await mp4Support() : null;
  if(sup){ try{
    const { music = "none", voice = null, onProgress, preview } = opts;
    await prepareCard(c, 1);
    if(window.Card3D && Card3D.release) Card3D.release();
    const scene = document.createElement("canvas"); scene.width = W; scene.height = H;
    const L = drawScene(scene.getContext("2d", { willReadFrequently: true }), c);
    let voiceBuf = null; if(voice){ try{ voiceBuf = await new OfflineAudioContext(2, 1, MP4_SR).decodeAudioData(await voice.arrayBuffer()); }catch(e){} }
    const dur = Math.min(40, Math.max(8, voiceBuf ? voiceBuf.duration + 3.2 : 8));
    const kind = particleKind(c), ps = makeParticles(kind, kind === "snow" ? 80 : 55, W, H); ps.k = 2;
    return await encodeMp4({ sup, dur, onProgress, preview,
      draw: (ctx, t) => videoFrame(ctx, scene, L, c, ps, kind, t, dur),
      buildAudio: async ac => { const mg = ac.createGain(); mg.gain.value = voiceBuf ? .28 : .9; mg.connect(ac.destination);
        scheduleMelody(ac, mg, music, dur);
        if(voiceBuf){ const s = ac.createBufferSource(); s.buffer = voiceBuf; const g = ac.createGain(); g.gain.value = 1.4; s.connect(g); g.connect(ac.destination); s.start(1.6); } } });
  }catch(e){ console.warn("mp4 failed, fallback", e); } }
  return makeVideoRec(c, opts);
}
async function makeVideoRec(c, { music = "none", voice = null, onProgress, preview } = {}){
  const mime = pickMime(); if(!mime) throw new Error("no-recorder");
  await prepareCard(c, 1);
  if(window.Card3D && Card3D.release) Card3D.release();
  const scene = document.createElement("canvas"); scene.width = W; scene.height = H;
  const L = drawScene(scene.getContext("2d"), c);
  const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
  const dest = ac.createMediaStreamDestination();
  let voiceBuf = null; if(voice){ try{ voiceBuf = await ac.decodeAudioData(await voice.arrayBuffer()); }catch(e){} }
  const dur = Math.min(40, Math.max(8, voiceBuf ? voiceBuf.duration + 3.2 : 8));
  const musicGain = ac.createGain(); musicGain.gain.value = voiceBuf ? .28 : .9; musicGain.connect(dest);
  scheduleMelody(ac, musicGain, music, dur);
  if(voiceBuf){ const s = ac.createBufferSource(); s.buffer = voiceBuf; const g = ac.createGain(); g.gain.value = 1.4; s.connect(g); g.connect(dest); s.start(ac.currentTime + 1.6); }
  const vc = document.createElement("canvas"); vc.width = 720; vc.height = 900; const ctx = vc.getContext("2d"); ctx.scale(720 / W, 900 / H);
  const kind = particleKind(c), ps = makeParticles(kind, kind === "snow" ? 80 : 55, W, H);
  videoFrame(ctx, scene, L, c, ps, kind, 0, dur);
  const stream = new MediaStream([...vc.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 }); const chunks = [];
  rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => rec.onstop = res);
  rec.start(250); const t0 = performance.now();
  await new Promise(res => { const tick = () => { const t = (performance.now() - t0) / 1000;
      videoFrame(ctx, scene, L, c, ps, kind, t, dur); if(preview) preview(vc); if(onProgress) onProgress(Math.min(1, t / dur));
      if(t < dur) requestAnimationFrame(tick); else res(); };
    requestAnimationFrame(tick); });
  rec.stop(); await done; stream.getTracks().forEach(t => t.stop()); ac.close();
  const type = mime.split(";")[0];
  return { blob: new Blob(chunks, { type }), type, ext: type === "video/mp4" ? "mp4" : "webm" };
}
