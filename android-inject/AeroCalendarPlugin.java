package __APP_ID__;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.TimeZone;

@CapacitorPlugin(
    name = "AeroCalendar",
    permissions = {
        @Permission(alias = "readCalendar", strings = { Manifest.permission.READ_CALENDAR }),
        @Permission(alias = "writeCalendar", strings = { Manifest.permission.WRITE_CALENDAR })
    }
)
public class AeroCalendarPlugin extends Plugin {
    private static final String ACCOUNT_NAME = "AeroPlan";

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("brand", android.os.Build.BRAND == null ? "" : android.os.Build.BRAND);
        ret.put("manufacturer", android.os.Build.MANUFACTURER == null ? "" : android.os.Build.MANUFACTURER);
        ret.put("model", android.os.Build.MODEL == null ? "" : android.os.Build.MODEL);
        ret.put("sdk", android.os.Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Throwable err) {
            call.reject(String.valueOf(err.getMessage()));
        }
    }

    @PluginMethod
    public void checkCalendarPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("read", getPermissionState("readCalendar") == PermissionState.GRANTED);
        ret.put("write", getPermissionState("writeCalendar") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestCalendarPermission(PluginCall call) {
        if (getPermissionState("readCalendar") == PermissionState.GRANTED &&
            getPermissionState("writeCalendar") == PermissionState.GRANTED) {
            checkCalendarPermission(call);
            return;
        }
        requestPermissionForAliases(new String[]{"readCalendar", "writeCalendar"}, call, "calendarPermissionCallback");
    }

    @PermissionCallback
    private void calendarPermissionCallback(PluginCall call) {
        checkCalendarPermission(call);
    }

    private Uri asSyncAdapter(Uri uri) {
        return uri.buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT_NAME)
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
            .build();
    }

    private long findCalendar(String name) {
        ContentResolver cr = getContext().getContentResolver();
        android.database.Cursor cursor = null;
        try {
            cursor = cr.query(CalendarContract.Calendars.CONTENT_URI,
                new String[]{CalendarContract.Calendars._ID},
                CalendarContract.Calendars.ACCOUNT_NAME + "=? AND " +
                    CalendarContract.Calendars.ACCOUNT_TYPE + "=? AND " +
                    CalendarContract.Calendars.CALENDAR_DISPLAY_NAME + "=?",
                new String[]{ACCOUNT_NAME, CalendarContract.ACCOUNT_TYPE_LOCAL, name}, null);
            if (cursor != null && cursor.moveToFirst()) return cursor.getLong(0);
        } finally {
            if (cursor != null) cursor.close();
        }
        return -1;
    }

    private long createCalendar(String name) {
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT_NAME);
        values.put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        values.put(CalendarContract.Calendars.NAME, name);
        values.put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, name);
        values.put(CalendarContract.Calendars.CALENDAR_COLOR, 0xFF4C6FFF);
        values.put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER);
        values.put(CalendarContract.Calendars.OWNER_ACCOUNT, ACCOUNT_NAME);
        values.put(CalendarContract.Calendars.VISIBLE, 1);
        values.put(CalendarContract.Calendars.SYNC_EVENTS, 1);
        values.put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
        Uri uri = getContext().getContentResolver().insert(asSyncAdapter(CalendarContract.Calendars.CONTENT_URI), values);
        return uri == null ? -1 : ContentUris.parseId(uri);
    }

    @PluginMethod
    public void ensureCalendar(PluginCall call) {
        String name = call.getString("name", "AeroPlan 提醒");
        try {
            long id = findCalendar(name);
            if (id <= 0) id = createCalendar(name);
            if (id <= 0) {
                call.reject("无法创建专用日历：设备上没有可写的本地日历账户");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("calendarId", id);
            ret.put("name", name);
            call.resolve(ret);
        } catch (Throwable err) {
            call.reject("无法创建专用日历：" + err.getMessage());
        }
    }

    private long insertEvent(ContentValues values) {
        Uri uri = getContext().getContentResolver().insert(asSyncAdapter(CalendarContract.Events.CONTENT_URI), values);
        return uri == null ? -1 : ContentUris.parseId(uri);
    }

    @PluginMethod
    public void upsertEvent(PluginCall call) {
        Long calendarId = call.getLong("calendarId");
        Long begin = call.getLong("begin");
        if (calendarId == null || begin == null) {
            call.reject("缺少 calendarId 或 begin");
            return;
        }
        try {
            ContentResolver cr = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(CalendarContract.Events.CALENDAR_ID, calendarId);
            values.put(CalendarContract.Events.TITLE, call.getString("title", "AeroPlan"));
            values.put(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
            values.put(CalendarContract.Events.DTSTART, begin);
            Long end = call.getLong("end");
            values.put(CalendarContract.Events.DTEND, end != null ? end : begin + 1800000L);
            values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
            values.put(CalendarContract.Events.HAS_ALARM, 1);
            values.put(CalendarContract.Events.EVENT_LOCATION, call.getString("location", ""));
            Long eventId = call.getLong("eventId");
            long id = -1;
            if (eventId != null && eventId > 0) {
                Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId);
                int rows = cr.update(uri, values, null, null);
                id = rows > 0 ? eventId : insertEvent(values);
            } else {
                id = insertEvent(values);
            }
            if (id <= 0) {
                call.reject("无法写入日历事件");
                return;
            }
            cr.delete(CalendarContract.Reminders.CONTENT_URI,
                CalendarContract.Reminders.EVENT_ID + "=?", new String[]{String.valueOf(id)});
            ContentValues rv = new ContentValues();
            rv.put(CalendarContract.Reminders.EVENT_ID, id);
            rv.put(CalendarContract.Reminders.MINUTES, Math.min(1440, call.getInt("remind", 0)));
            rv.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
            cr.insert(CalendarContract.Reminders.CONTENT_URI, rv);
            JSObject ret = new JSObject();
            ret.put("eventId", id);
            call.resolve(ret);
        } catch (Throwable err) {
            call.reject("写入日历失败：" + err.getMessage());
        }
    }

    @PluginMethod
    public void deleteEvent(PluginCall call) {
        Long eventId = call.getLong("eventId");
        if (eventId == null) {
            call.reject("缺少 eventId");
            return;
        }
        try {
            int rows = getContext().getContentResolver().delete(
                ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId), null, null);
            JSObject ret = new JSObject();
            ret.put("removed", rows);
            call.resolve(ret);
        } catch (Throwable err) {
            call.reject("删除日历事件失败：" + err.getMessage());
        }
    }

    @PluginMethod
    public void clearCalendar(PluginCall call) {
        String name = call.getString("name", "AeroPlan 提醒");
        int removed = 0;
        try {
            long id = findCalendar(name);
            if (id > 0) {
                removed = getContext().getContentResolver().delete(CalendarContract.Events.CONTENT_URI,
                    CalendarContract.Events.CALENDAR_ID + "=?", new String[]{String.valueOf(id)});
            }
            JSObject ret = new JSObject();
            ret.put("removed", removed);
            call.resolve(ret);
        } catch (Throwable err) {
            call.reject("清空专用日历失败：" + err.getMessage());
        }
    }
}
