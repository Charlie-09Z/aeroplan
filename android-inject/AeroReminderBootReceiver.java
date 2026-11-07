package __APP_ID__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AeroReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            AeroNativeBridge.rescheduleAll(context);
        } catch (Throwable err) {
            AeroNativeBridge.logError(context, "boot: " + err.getMessage());
        }
    }
}
