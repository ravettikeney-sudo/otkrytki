package by.otkrytki.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RemoteViews;
import java.io.File;

/** Home-screen widget: today's card picture; a tap opens the app on that card. */
public class Widget extends AppWidgetProvider {
    static File file(Context c){ return new File(c.getFilesDir(), "widget.jpg"); }

    static void refresh(Context c){
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, Widget.class));
        if (ids.length > 0) new Widget().onUpdate(c, m, ids);
    }

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids){
        String hid = Reminders.prefs(c).getString("wh", ""), title = Reminders.prefs(c).getString("wt", "");
        Intent open = new Intent(c, MainActivity.class).putExtra("url", MainActivity.HOME + (hid.isEmpty() ? "" : "?h=" + hid)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 77, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Bitmap bmp = null; File f = file(c);
        if (f.exists()) { BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 1; bmp = BitmapFactory.decodeFile(f.getPath(), o); }
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
            if (bmp != null) v.setImageViewBitmap(R.id.wimg, bmp);
            v.setTextViewText(R.id.wtxt, title.isEmpty() ? "💌 Открытка дня — отправить" : "💌 " + title + " — отправить");
            v.setOnClickPendingIntent(R.id.wroot, pi);
            m.updateAppWidget(id, v);
        }
    }
}
