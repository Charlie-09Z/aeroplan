package __APP_ID__;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

public class AeroReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 0);
        if (id <= 0) id = (int) (System.currentTimeMillis() % 100000000);
        JSONObject stored = AeroNativeBridge.readScheduled(context);
        JSONObject n = stored.optJSONObject(String.valueOf(id));
        String title = n != null ? n.optString("title", "AeroPlan 提醒") : "AeroPlan 提醒";
        String body = n != null ? n.optString("body", "") : "";
        try {
            AeroNativeBridge.ensureChannel(context);
            show(context, id, title, body);
            SharedPreferences.Editor e = AeroNativeBridge.prefs(context).edit();
            e.putLong(AeroNativeBridge.KEY_LAST_DELIVERY_AT, System.currentTimeMillis());
            e.apply();
        } catch (Throwable err) {
            AeroNativeBridge.logError(context, "deliver id " + id + ": " + err.getMessage());
        }
        stored.remove(String.valueOf(id));
        AeroNativeBridge.writeScheduled(context, stored);
    }

    private void show(Context context, int id, String title, String body) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent content = PendingIntent.getActivity(context, id, open, flags);
        int icon = context.getResources().getIdentifier("ic_stat_icon", "drawable", context.getPackageName());
        if (icon == 0) icon = android.R.drawable.ic_dialog_info;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, AeroNativeBridge.CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(icon)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(content)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setWhen(System.currentTimeMillis());
        try {
            builder.setFullScreenIntent(content, true);
        } catch (Throwable ignored) { }
        Notification notification = builder.build();
        nm.notify(id, notification);
    }
}
