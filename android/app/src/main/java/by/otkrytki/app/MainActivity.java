package by.otkrytki.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.JavascriptInterface;
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
    private static final String HOME = "https://ravettikeney-sudo.github.io/otkrytki/";
    private static final String HOST = "ravettikeney-sudo.github.io";
    private WebView web;

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
        s.setUserAgentString(s.getUserAgentString() + " OtkrytkiApp/1.0");
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
        web.addJavascriptInterface(new Bridge(), "OtkApp");
        Updater.check(this);
        if (state != null) web.restoreState(state);
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

    private class Bridge {
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
