package by.otkrytki.app;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.List;

/** Adds an AAC soundtrack (from raw 16-bit PCM) to a silent H.264 MP4 made in the WebView. */
final class Mux {
    private static final class S { final byte[] d; final long pts; final int flags; final boolean audio;
        S(byte[] d, long pts, int flags, boolean audio) { this.d = d; this.pts = pts; this.flags = flags; this.audio = audio; } }

    static byte[] addAudio(File dir, byte[] video, byte[] pcm, int sr, int ch) throws Exception {
        dir.mkdirs();
        File vin = new File(dir, "v.mp4"), out = new File(dir, "out.mp4");
        try (FileOutputStream o = new FileOutputStream(vin)) { o.write(video); }
        // 1) video samples
        MediaExtractor ex = new MediaExtractor(); ex.setDataSource(vin.getPath());
        MediaFormat vf = null;
        for (int i = 0; i < ex.getTrackCount(); i++) { MediaFormat f = ex.getTrackFormat(i); String m = f.getString(MediaFormat.KEY_MIME);
            if (m != null && m.startsWith("video/")) { ex.selectTrack(i); vf = f; break; } }
        if (vf == null) throw new IllegalStateException("no video");
        List<S> samples = new ArrayList<>();
        ByteBuffer buf = ByteBuffer.allocate(2 * 1024 * 1024);
        while (true) { buf.clear(); int sz = ex.readSampleData(buf, 0); if (sz < 0) break;
            byte[] d = new byte[sz]; buf.position(0); buf.get(d, 0, sz);
            int fl = (ex.getSampleFlags() & MediaExtractor.SAMPLE_FLAG_SYNC) != 0 ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
            samples.add(new S(d, ex.getSampleTime(), fl, false)); ex.advance(); }
        ex.release();
        // 2) encode PCM to AAC
        MediaFormat af = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sr, ch);
        af.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
        af.setInteger(MediaFormat.KEY_BIT_RATE, 128000);
        af.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);
        MediaCodec enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
        enc.configure(af, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE); enc.start();
        MediaFormat aOut = null; MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
        int pos = 0, frame = 2 * ch; boolean inDone = false; long started = System.currentTimeMillis();
        while (System.currentTimeMillis() - started < 30000) {
            if (!inDone) { int ii = enc.dequeueInputBuffer(5000);
                if (ii >= 0) { ByteBuffer b = enc.getInputBuffer(ii); b.clear();
                    int n = Math.min(b.remaining(), pcm.length - pos); n -= n % frame;
                    long pts = (long) (pos / frame) * 1000000L / sr;
                    if (n <= 0) { enc.queueInputBuffer(ii, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true; }
                    else { b.put(pcm, pos, n); enc.queueInputBuffer(ii, 0, n, pts, 0); pos += n; } } }
            int oi = enc.dequeueOutputBuffer(bi, 5000);
            if (oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) aOut = enc.getOutputFormat();
            else if (oi >= 0) {
                if ((bi.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && bi.size > 0) {
                    ByteBuffer ob = enc.getOutputBuffer(oi); ob.position(bi.offset); ob.limit(bi.offset + bi.size);
                    byte[] d = new byte[bi.size]; ob.get(d); samples.add(new S(d, bi.presentationTimeUs, 0, true)); }
                enc.releaseOutputBuffer(oi, false);
                if ((bi.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break; }
        }
        enc.stop(); enc.release();
        if (aOut == null) throw new IllegalStateException("no audio format");
        // 3) mux, interleaved by time
        samples.sort((a, b) -> Long.compare(a.pts, b.pts));
        MediaMuxer mux = new MediaMuxer(out.getPath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        int vt = mux.addTrack(vf), at = mux.addTrack(aOut); mux.start();
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        for (S s : samples) { info.set(0, s.d.length, s.pts, s.flags); mux.writeSampleData(s.audio ? at : vt, ByteBuffer.wrap(s.d), info); }
        mux.stop(); mux.release();
        byte[] res = new byte[(int) out.length()];
        try (FileInputStream in = new FileInputStream(out)) { int o = 0; while (o < res.length) { int r = in.read(res, o, res.length - o); if (r < 0) break; o += r; } }
        vin.delete(); out.delete();
        return res;
    }
}
