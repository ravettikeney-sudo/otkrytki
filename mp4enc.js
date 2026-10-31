/* Кадр-за-кадром кодирование в настоящий MP4 (H.264 + AAC) через WebCodecs.
   Такой файл открывается в WhatsApp, Viber, Telegram, ВК и любой галерее. */
const MP4_W = 704, MP4_H = 880, MP4_FPS = 30, MP4_SR = 44100;

function cpuCopy(src){ const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d", { willReadFrequently: true }).drawImage(src, 0, 0); return c; }
async function mp4Support(){
  if(!window.VideoEncoder || !window.VideoFrame || !window.Mp4Muxer) return null;
  const base = { width: MP4_W, height: MP4_H, bitrate: 3000000, framerate: MP4_FPS };
  let video = null;
  for(const codec of ["avc1.42001f", "avc1.4d001f", "avc1.640028", "avc1.42E01E"]){
    for(const hw of ["no-preference", "prefer-software"]){
      try{ const cfg = { ...base, codec, hardwareAcceleration: hw, avc: { format: "avc" } }; const r = await VideoEncoder.isConfigSupported(cfg); if(r.supported){ video = r.config || cfg; break; } }catch(e){}
    }
    if(video) break;
  }
  if(!video) return null;
  let audio = null;
  if(window.AudioEncoder && window.AudioData){
    try{ const cfg = { codec: "mp4a.40.2", sampleRate: MP4_SR, numberOfChannels: 2, bitrate: 128000 }; const r = await AudioEncoder.isConfigSupported(cfg); if(r.supported) audio = cfg; }catch(e){}
  }
  return { video, audio };
}

/* draw(ctx, t, dt) рисует кадр на холсте 1080×1350 (W×H); buildAudio(offlineCtx) расставляет звук */
async function encodeMp4({ dur, draw, buildAudio, onProgress, preview, sup }){
  sup = sup || await mp4Support(); if(!sup) throw new Error("no-webcodecs");
  const M = window.Mp4Muxer;
  const muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), fastStart: "in-memory", firstTimestampBehavior: "offset",
    video: { codec: "avc", width: MP4_W, height: MP4_H, frameRate: MP4_FPS },
    audio: sup.audio ? { codec: "aac", numberOfChannels: 2, sampleRate: MP4_SR } : undefined });
  let err = null;
  let lastOut = performance.now();
  const venc = new VideoEncoder({ output: (ch, meta) => { lastOut = performance.now(); muxer.addVideoChunk(ch, meta); }, error: e => err = e });
  venc.configure(sup.video);
  // звук: рендерим заранее, быстрее реального времени
  if(sup.audio && buildAudio){
    try{
      const oac = new OfflineAudioContext(2, Math.ceil(MP4_SR * dur), MP4_SR);
      await buildAudio(oac);
      const buf = await oac.startRendering();
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: e => err = e });
      aenc.configure(sup.audio);
      const L = buf.getChannelData(0), R = buf.getChannelData(1), step = 1024;
      for(let i = 0; i < buf.length; i += step){
        const n = Math.min(step, buf.length - i), data = new Float32Array(n * 2);
        data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: MP4_SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / MP4_SR * 1e6), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
    }catch(e){ console.warn("audio", e); }
  }
  lastOut = performance.now();
  const vc = document.createElement("canvas"); vc.width = MP4_W; vc.height = MP4_H;
  const ctx = vc.getContext("2d", { willReadFrequently: true }); ctx.scale(MP4_W / W, MP4_H / H);
  const N = Math.round(dur * MP4_FPS), fd = 1e6 / MP4_FPS;
  let lastYield = performance.now();
  for(let i = 0; i < N; i++){
    if(err) throw err;
    const t = i / MP4_FPS;
    ctx.save(); draw(ctx, t, 1 / MP4_FPS); ctx.restore();
    const fr = new VideoFrame(vc, { timestamp: Math.round(i * fd), duration: Math.round(fd) });
    venc.encode(fr, { keyFrame: i % (MP4_FPS * 2) === 0 }); fr.close();
    while(venc.encodeQueueSize > 6){ if(performance.now() - lastOut > 8000) throw new Error("encoder-stall"); await new Promise(r => setTimeout(r, 4)); }
    if(performance.now() - lastYield > 40){ if(preview) preview(vc); if(onProgress) onProgress(i / N); await new Promise(r => setTimeout(r, 0)); lastYield = performance.now(); }
  }
  await venc.flush(); venc.close(); if(err) throw err;
  muxer.finalize();
  if(onProgress) onProgress(1);
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), type: "video/mp4", ext: "mp4" };
}
