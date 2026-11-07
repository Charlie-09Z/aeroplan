package __APP_ID__;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

public class AeroNativeBridge {
    public static final String PREFS = "aeroplan_native_reminders";
    public static final String KEY_SCHEDULED = "scheduled";
    public static final String KEY_LAST_SCHEDULE_AT = "last_schedule_at";
    public static final String KEY_LAST_SCHEDULE_RESULT = "last_schedule_result";
    public static final String KEY_LAST_DELIVERY_AT = "last_delivery_at";
    public static final String KEY_LAST_ERROR = "last_error";
    public static final String CHANNEL_ID = "aeroplan-native-v1";
    public static final String CHANNEL_NAME = "日程提醒（原生）";
    public static final String ACTION_FIRE = "com.aeroplan.app.NATIVE_REMINDER";

    private final Context context;

    public AeroNativeBridge(Context context) {
        this.context = context.getApplicationContext();
        ensureChannel(this.context);
    }

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void logError(Context ctx, String message) {
        SharedPreferences.Editor e = prefs(ctx).edit();
        e.putString(KEY_LAST_ERROR, System.currentTimeMillis() + " " + message);
        e.apply();
    }

    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
        if (ch == null) {
            ch = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("AeroPlan 原生提醒通道：不经过 Capacitor 插件");
            ch.setShowBadge(true);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 250, 200, 250});
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            try {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                ch.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, attrs);
            } catch (Throwable ignored) { }
            nm.createNotificationChannel(ch);
        }
    }

    public static PendingIntent fireIntent(Context ctx, int id) {
        Intent intent = new Intent(ctx, AeroReminderReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.putExtra("id", id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, id, intent, flags);
    }

    public static void scheduleOne(Context ctx, int id, long at, String title, String body) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) throw new IllegalStateException("no AlarmManager");
        PendingIntent pi = fireIntent(ctx, id);
        long trigger = Math.max(at, System.currentTimeMillis() + 1000L);
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            exact = am.canScheduleExactAlarms();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (exact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
            }
        } else {
            am.set(AlarmManager.RTC_WAKEUP, trigger, pi);
        }
    }

    public static void rescheduleAll(Context ctx) {
        ensureChannel(ctx);
        JSONObject stored = readScheduled(ctx);
        Iterator<String> it = stored.keys();
        while (it.hasNext()) {
            String key = it.next();
            JSONObject n = stored.optJSONObject(key);
            if (n == null) continue;
            long at = n.optLong("at", 0);
            if (at <= System.currentTimeMillis()) continue;
            try {
                scheduleOne(ctx, Integer.parseInt(key), at, n.optString("title", ""), n.optString("body", ""));
            } catch (Throwable err) {
                logError(ctx, "boot reschedule " + key + ": " + err.getMessage());
            }
        }
    }

    public static JSONObject readScheduled(Context ctx) {
        try {
            String raw = prefs(ctx).getString(KEY_SCHEDULED, "{}");
            return new JSONObject(raw);
        } catch (Throwable err) {
            return new JSONObject();
        }
    }

    public static void writeScheduled(Context ctx, JSONObject stored) {
        prefs(ctx).edit().putString(KEY_SCHEDULED, stored.toString()).apply();
    }

    private static String errorJson(Throwable err) {
        String message = err == null ? "unknown" : String.valueOf(err.getMessage());
        message = message.replace("\"", "'").replace("\n", " ");
        try {
            JSONObject ret = new JSONObject();
            ret.put("ok", false);
            ret.put("error", message);
            return ret.toString();
        } catch (Throwable ignored) {
            return "{\"ok\":false,\"error\":\"unknown\"}";
        }
    }

    @JavascriptInterface
    public String schedule(String json) {
        try {
            JSONObject input = new JSONObject(json == null ? "{}" : json);
            JSONArray list = input.optJSONArray("notifications");
            if (list == null) list = new JSONArray();
            JSONObject stored = readScheduled(context);
            int ok = 0;
            JSONArray ids = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject n = list.optJSONObject(i);
                if (n == null) continue;
                int id = n.optInt("id", 0);
                long at = n.optLong("at", 0);
                if (id <= 0 || at <= 0) continue;
                try {
                    scheduleOne(context, id, at, n.optString("title", ""), n.optString("body", ""));
                    stored.put(String.valueOf(id), n);
                    ids.put(id);
                    ok++;
                } catch (Throwable err) {
                    logError(context, "schedule id " + id + ": " + err.getMessage());
                }
            }
            writeScheduled(context, stored);
            SharedPreferences.Editor e = prefs(context).edit();
            e.putLong(KEY_LAST_SCHEDULE_AT, System.currentTimeMillis());
            e.putString(KEY_LAST_SCHEDULE_RESULT, ok + "/" + list.length());
            e.apply();
            JSONObject ret = new JSONObject();
            ret.put("ok", true);
            ret.put("requested", list.length());
            ret.put("scheduled", ok);
            ret.put("ids", ids);
            ret.put("channelId", CHANNEL_ID);
            return ret.toString();
        } catch (Throwable err) {
            logError(context, "schedule: " + err.getMessage());
            return errorJson(err);
        }
    }

    @JavascriptInterface
    public String cancelAll() {
        int cancelled = 0;
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            JSONObject stored = readScheduled(context);
            Iterator<String> it = stored.keys();
            while (it.hasNext()) {
                int id = Integer.parseInt(it.next());
                PendingIntent pi = fireIntent(context, id);
                if (am != null) am.cancel(pi);
                pi.cancel();
                cancelled++;
            }
            writeScheduled(context, new JSONObject());
        } catch (Throwable err) {
            logError(context, "cancelAll: " + err.getMessage());
        }
        JSONObject ret = new JSONObject();
        try {
            ret.put("ok", true);
            ret.put("cancelled", cancelled);
        } catch (Throwable ignored) { }
        return ret.toString();
    }

    @JavascriptInterface
    public String listScheduled() {
        JSONObject ret = new JSONObject();
        try {
            JSONObject stored = readScheduled(context);
            JSONArray items = new JSONArray();
            Iterator<String> it = stored.keys();
            while (it.hasNext()) {
                String key = it.next();
                JSONObject n = stored.optJSONObject(key);
                if (n != null) items.put(n);
            }
            ret.put("ok", true);
            ret.put("count", items.length());
            ret.put("items", items);
            return ret.toString();
        } catch (Throwable err) {
            return errorJson(err);
        }
    }

    @JavascriptInterface
    public String postTest(int seconds) {
        int id = 999000001;
        long at = System.currentTimeMillis() + Math.max(1, seconds) * 1000L;
        try {
            scheduleOne(context, id, at, "AeroPlan 原生通道自检", "这条来自原生 AlarmManager 通道，10 秒后到");
            JSONObject stored = readScheduled(context);
            JSONObject n = new JSONObject();
            n.put("id", id);
            n.put("at", at);
            n.put("title", "AeroPlan 原生通道自检");
            n.put("body", "这条来自原生 AlarmManager 通道");
            stored.put(String.valueOf(id), n);
            writeScheduled(context, stored);
            JSONObject ret = new JSONObject();
            ret.put("ok", true);
            ret.put("id", id);
            ret.put("at", at);
            return ret.toString();
        } catch (Throwable err) {
            logError(context, "postTest: " + err.getMessage());
            return errorJson(err);
        }
    }

    @JavascriptInterface
    public String getDiagnostics() {
        try {
            JSONObject ret = new JSONObject();
            SharedPreferences p = prefs(context);
            ret.put("bridge", true);
            ret.put("channelId", CHANNEL_ID);
            int importance = -1;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
                    if (ch != null) importance = ch.getImportance();
                }
            }
            ret.put("channelImportance", importance);
            ret.put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled());
            boolean exact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                exact = am != null && am.canScheduleExactAlarms();
            }
            ret.put("exactAlarms", exact);
            ret.put("scheduledCount", readScheduled(context).length());
            ret.put("lastScheduleAt", p.getLong(KEY_LAST_SCHEDULE_AT, 0));
            ret.put("lastScheduleResult", p.getString(KEY_LAST_SCHEDULE_RESULT, ""));
            ret.put("lastDeliveryAt", p.getLong(KEY_LAST_DELIVERY_AT, 0));
            ret.put("lastError", p.getString(KEY_LAST_ERROR, ""));
            ret.put("brand", Build.BRAND == null ? "" : Build.BRAND);
            ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
            ret.put("model", Build.MODEL == null ? "" : Build.MODEL);
            ret.put("sdk", Build.VERSION.SDK_INT);
            return ret.toString();
        } catch (Throwable err) {
            return errorJson(err);
        }
    }
}
