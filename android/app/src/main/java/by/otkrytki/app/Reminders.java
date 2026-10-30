package by.otkrytki.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;

/** Birthday reminders: one alarm a day at the chosen time; on that day (and the day before) a notification opens a ready card. */
public class Reminders extends BroadcastReceiver {
    static final String CH = "bdays";
    static SharedPreferences prefs(Context c){ return c.getSharedPreferences("otk", Context.MODE_PRIVATE); }

    static void save(Context c, String json){ prefs(c).edit().putString("rem", json).apply(); schedule(c); }

    static void schedule(Context c){
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, Reminders.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        try {
            JSONObject o = new JSONObject(prefs(c).getString("rem", "{}"));
            if (o.optJSONArray("items") == null || o.optJSONArray("items").length() == 0) return;
            String[] hm = o.optString("time", "09:00").split(":");
            Calendar t = Calendar.getInstance();
            t.set(Calendar.HOUR_OF_DAY, Integer.parseInt(hm[0])); t.set(Calendar.MINUTE, Integer.parseInt(hm[1])); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
            if (t.getTimeInMillis() <= System.currentTimeMillis() + 1000) t.add(Calendar.DAY_OF_YEAR, 1);
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pi);
        } catch (Exception ignored) { }
    }

    static void ensureChannel(Context c){
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CH, "Дни рождения", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Напоминания о днях рождения близких");
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    @Override public void onReceive(Context c, Intent in){
        try {
            JSONObject o = new JSONObject(prefs(c).getString("rem", "{}"));
            JSONArray items = o.optJSONArray("items"); boolean before = o.optBoolean("before", true);
            if (items == null) return;
            ensureChannel(c);
            Calendar today = Calendar.getInstance(), tom = Calendar.getInstance(); tom.add(Calendar.DAY_OF_YEAR, 1);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            for (int i = 0; i < items.length(); i++) {
                JSONObject b = items.getJSONObject(i); int d = b.optInt("d"), m = b.optInt("m"); String name = b.optString("n"), id = b.optString("id");
                boolean isToday = today.get(Calendar.DAY_OF_MONTH) == d && today.get(Calendar.MONTH) + 1 == m;
                boolean isTom = before && tom.get(Calendar.DAY_OF_MONTH) == d && tom.get(Calendar.MONTH) + 1 == m;
                if (!isToday && !isTom) continue;
                int y = b.optInt("y", 0); int age = y > 0 ? today.get(Calendar.YEAR) + (isTom && tom.get(Calendar.YEAR) != today.get(Calendar.YEAR) ? 1 : 0) - y : 0;
                String title = (isToday ? "Сегодня день рождения: " : "Завтра день рождения: ") + name + (age > 0 ? " (" + age + ")" : "") + " 🎂";
                String text = isToday ? "Открытка уже готова — нажмите, чтобы поздравить" : "Подготовьте открытку заранее";
                Intent open = new Intent(c, MainActivity.class).putExtra("url", MainActivity.HOME + "?bd=" + id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent pi = PendingIntent.getActivity(c, 100 + i, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
                nb.setSmallIcon(R.drawable.ic_notify).setContentTitle(title).setContentText(text).setContentIntent(pi).setAutoCancel(true).setColor(0xffe2557a);
                try { nm.notify(1000 + i, nb.build()); } catch (SecurityException ignored) { }
            }
        } catch (Exception ignored) { }
        finally { schedule(c); }
    }

    /** Restores the alarm after the phone restarts or the app is updated. */
    public static class Boot extends BroadcastReceiver {
        @Override public void onReceive(Context c, Intent i){ schedule(c); }
    }
}
