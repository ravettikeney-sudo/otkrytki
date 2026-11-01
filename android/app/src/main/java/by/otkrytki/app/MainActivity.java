package by.otkrytki.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Full-screen shell around the Открытки web app. Content loads live from the site, so the app updates without reinstalling. */
public class MainActivity extends Activity {
    static final String HOME = "https://ravettikeney-sudo.github.io/otkrytki/";
    private static final String HOST = "ravettikeney-sudo.github.io";
    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest pendingMic;
    private static final int REQ_FILE = 11, REQ_MIC = 12, REQ_NOTIFY = 13;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#fff4ec"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " OtkrytkiApp/1.1");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/otkrytki")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                catch (Exception e) { Toast.makeText(MainActivity.this, "Это приложение не установлено на телефоне", Toast.LENGTH_SHORT).show(); }
                return true;
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                try { startActivityForResult(Intent.createChooser(i, "Выберите фото"), REQ_FILE); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
            @Override
            public void onPermissionRequest(PermissionRequest r) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) r.grant(r.getResources());
                    else { pendingMic = r; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC); }
                });
            }
        });
        web.addJavascriptInterface(new Bridge(), "OtkApp");
        Reminders.ensureChannel(this);
        Reminders.schedule(this);
        Updater.check(this);
        String start = getIntent() != null ? getIntent().getStringExtra("url") : null;
        if (start != null && start.startsWith(HOME)) web.loadUrl(start);
        else if (state != null) web.restoreState(state);
        else web.loadUrl(HOME);
    }

    private File writeCache(String base64) throws Exception {
        byte[] png = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
        File dir = new File(getCacheDir(), "share"); dir.mkdirs();
        File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete();
        File f = new File(dir, "otkrytka-" + System.currentTimeMillis() + ".png");
        try (FileOutputStream out = new FileOutputStream(f)) { out.write(png); }
        return f;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i); setIntent(i);
        String u = i.getStringExtra("url"); if (u != null && u.startsWith(HOME)) web.loadUrl(u);
    }

    @Override
    protected void onActivityResult(int code, int res, Intent data) {
        super.onActivityResult(code, res, data);
        if (code == REQ_FILE && fileCb != null) {
            Uri u = (res == RESULT_OK && data != null) ? data.getData() : null;
            fileCb.onReceiveValue(u == null ? null : new Uri[]{u}); fileCb = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_MIC && pendingMic != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(pendingMic.getResources()); else pendingMic.deny();
            pendingMic = null;
        }
        if (code == REQ_NOTIFY && (results.length == 0 || results[0] != PackageManager.PERMISSION_GRANTED))
            toast("Уведомления выключены. Включите их: Настройки → Приложения → Открытки → Уведомления");
    }

    private void writeToGallery(byte[] bytes, String mime, String name, String dir) throws Exception {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, dir + "/Открытки");
        ContentResolver cr = getContentResolver();
        Uri uri = cr.insert(mime.startsWith("video") ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new Exception("no uri");
        try (OutputStream out = cr.openOutputStream(uri)) { out.write(bytes); }
    }

    private class Bridge {
        @JavascriptInterface public void setReminders(String json) {
            Reminders.save(MainActivity.this, json);
            try {
                boolean any = new org.json.JSONObject(json).optJSONArray("items") != null && new org.json.JSONObject(json).optJSONArray("items").length() > 0;
                if (any && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && !Reminders.prefs(MainActivity.this).getBoolean("askedNotify", false)) {
                    Reminders.prefs(MainActivity.this).edit().putBoolean("askedNotify", true).apply();
                    runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY));
                }
            } catch (Exception ignored) { }
        }
        @JavascriptInterface public void setWidget(String b64, String title, String hid) {
            try {
                byte[] b = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                try (FileOutputStream out = new FileOutputStream(Widget.file(MainActivity.this))) { out.write(b); }
                Reminders.prefs(MainActivity.this).edit().putString("wt", title).putString("wh", hid).apply();
                Widget.refresh(MainActivity.this);
            } catch (Exception ignored) { }
        }
        @JavascriptInterface public String muxAudio(String videoB64, String pcmB64, int sr, int ch) {
            try {
                byte[] r = Mux.addAudio(new File(getCacheDir(), "mux"), android.util.Base64.decode(videoB64, android.util.Base64.DEFAULT), android.util.Base64.decode(pcmB64, android.util.Base64.DEFAULT), sr, ch);
                return android.util.Base64.encodeToString(r, android.util.Base64.NO_WRAP);
            } catch (Throwable e) { return ""; }
        }
        @JavascriptInterface public void shareFile(String base64, String mime, String name, String text) {
            try {
                byte[] b = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                File dir = new File(getCacheDir(), "share"); dir.mkdirs();
                File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete();
                File f = new File(dir, "otkrytka-" + System.currentTimeMillis() + (mime.contains("mp4") ? ".mp4" : mime.contains("webm") ? ".webm" : ".png"));
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(b); }
                Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + f.getName());
                Intent send = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_TEXT, text);
                send.setClipData(ClipData.newRawUri("otkrytka", uri)); send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent ch = Intent.createChooser(send, "Отправить"); ch.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(ch));
            } catch (Exception e) { toast("Не получилось отправить"); }
        }
        @JavascriptInterface public void saveFile(String base64, String mime, String name) {
            try {
                if (Build.VERSION.SDK_INT < 29) { shareFile(base64, mime, name, ""); return; }
                writeToGallery(android.util.Base64.decode(base64, android.util.Base64.DEFAULT), mime, name, mime.startsWith("video") ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                toast("Сохранено в галерею (папка «Открытки»)");
            } catch (Exception e) { toast("Не получилось сохранить"); }
        }
        @JavascriptInterface public void shareImage(String base64, String text) {
            try {
                File f = writeCache(base64);
                Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + f.getName());
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_TEXT, text);
                send.setClipData(ClipData.newRawUri("otkrytka", uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Отправить открытку");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(chooser));
            } catch (Exception e) { toast("Не получилось отправить открытку"); }
        }
        @JavascriptInterface public void saveImage(String base64, String name) {
            try {
                byte[] png = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Открытки");
                    ContentResolver cr = getContentResolver();
                    Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new Exception("no uri");
                    try (OutputStream out = cr.openOutputStream(uri)) { out.write(png); }
                    toast("Открытка сохранена в галерею (папка «Открытки»)");
                } else {
                    shareImage(base64, "");
                }
            } catch (Exception e) { toast("Не получилось сохранить открытку"); }
        }
    }

    private void toast(String m) { runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_LONG).show()); }

    private void showOffline() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
            + "<body style='margin:0;background:#fff4ec;color:#2d1e2f;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div style='padding:24px'><h2>Нет подключения к интернету</h2>"
            + "<p style='color:#7a6670'>Проверьте Wi-Fi или мобильные данные.</p>"
            + "<button onclick=\"location.href='" + HOME + "'\" style='margin-top:12px;padding:14px 24px;border:0;border-radius:16px;background:#e2557a;color:#fff;font-size:17px;font-weight:700'>Повторить</button></div></body></html>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "utf-8", HOME);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return window.appBack?window.appBack():false}catch(e){return false}})()", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack(); else finish();
        });
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); Updater.resume(this); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
