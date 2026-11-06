'use strict';

/* =========================================================
   氢计划 / AeroPlan v0.5.2
   纯前端：无框架、无 CDN、无构建步骤
   数据存在手机上：优先用浏览器数据库，不可用时退到本地存储，再不行只放内存
   ========================================================= */

(function () {
  // ---------- DOM 小工具 ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const T = (s, vars) => (window.I18N ? window.I18N.t(s, vars) : s);
  const isEn = () => !!(window.I18N && window.I18N.isEn());

  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEK_EN_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TYPE_META = {
    event: { label: '日程', color: 'var(--event)' },
    todo: { label: '待办', color: 'var(--todo)' }
  };

  const LS_ITEMS_KEY = 'light-schedule.items';
  const LS_META_KEY = 'light-schedule.meta';
  const LS_CATS_KEY = 'light-schedule.categories';
  const LS_PLANS_KEY = 'light-schedule.plans';
  const IDB_NAME = 'light-schedule-db';
  const IDB_STORE = 'kv';

  const MAX_CATEGORIES = 20;
  const MAX_CAT_NAME = 8;
  const STACK_LIMIT = 1;
  const PRESET_COLORS = [
    '#4C6FFF', '#6E9E7B', '#D9694C', '#C99A3E', '#7B6BD6', '#0E9681',
    '#C86B98', '#4A96B8', '#9C7A57', '#7A8794', '#B85C6E', '#557A5E'
  ];

  // ---------- 状态 ----------
  const state = {
    view: 'calendar',
    month: new Date(),
    agendaAnchor: '',
    scheduleAnchor: '',
    items: [],
    plans: [],
    categories: [],
    agendaFilters: [],
    meta: {},
    editCategoryId: '',
    openDoneGroups: new Set(),
    expandedGroups: new Set(),
    selectedDate: '',
    swipeLock: 0,
    swipeClickLock: 0,
    busyChecks: new Set(),
    snackbarTimer: null,
    undoFn: null,
    sheetOpen: false,
    planSheetOpen: false,
    settingsOpen: false,
    saving: false,
    reminderTimers: [],
    firedReminders: {},
    nativeReminderIds: [],
    nativeReminderGen: 0,
    lastDayKey: ''
  };

  const storage = {
    status: 'detecting',
    db: null,
    memoryItems: [],
    memoryPlans: [],
    memoryMeta: {},
    memoryCats: []
  };

  let toastTimer = null;
  let pendingImport = null;
  let sheetCloseTimer = null;

  // ==================== 日期与文本工具 ====================

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function keyToDate(key) {
    const parts = String(key).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function addDays(key, n) {
    const d = keyToDate(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  function weekdayOf(key) {
    const day = keyToDate(key).getDay();
    return isEn() ? WEEK_EN[day] : '周' + WEEK[day];
  }

  function weekdayFullOf(key) {
    const day = keyToDate(key).getDay();
    return isEn() ? WEEK_EN_FULL[day] : '星期' + WEEK[day];
  }

  function monthDay(key) {
    const d = keyToDate(key);
    return isEn() ? MONTH_EN[d.getMonth()] + ' ' + d.getDate() : (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function shortDate(key) {
    const d = keyToDate(key);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function relativeDayLabel(key) {
    const t = todayKey();
    if (key === t) return T('今天');
    if (key === addDays(t, 1)) return T('明天');
    if (key === addDays(t, -1)) return T('昨天');
    return monthDay(key);
  }

  function startOfWeek(key) {
    const d = keyToDate(key);
    const offset = (d.getDay() + 6) % 7; // 周一为一周起点
    d.setDate(d.getDate() - offset);
    return dateKey(d);
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    return isEn()
      ? MONTH_EN[d.getMonth()] + ' ' + d.getDate() + ' ' + hm
      : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shorten(s, max) {
    const limit = max || 22;
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  }

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function buildMonthGrid(year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const offset = (first.getDay() + 6) % 7; // 周一为第一列
    const start = new Date(year, monthIndex, 1 - offset);
    const keys = [];
    for (let i = 0; i < 42; i++) {
      keys.push(dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    }
    return keys;
  }

  function itemTimeValue(item) {
    return item.time || '00:00';
  }

  function compareAgenda(a, b) {
    const at = itemTimeValue(a);
    const bt = itemTimeValue(b);
    if (at !== bt) return at < bt ? -1 : 1;
    const ap = a.priority === 'high' ? 0 : 1;
    const bp = b.priority === 'high' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  function compareOverdue(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return compareAgenda(a, b);
  }

  // ==================== 农历 / 节气 / 节日 ====================
  // 1900–2100 农历信息表，每年一个 20 位数：低 4 位为闰月（0 = 无闰月）
  const LUNAR_INFO = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ];

  // 24 节气相对 1900 年小寒的分钟偏移（近似算法，个别年份会差 1 天）
  const SOLAR_TERM_INFO = [
    0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
    263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
  ];
  const SOLAR_TERM_NAMES = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
    '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
  ];
  const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const LUNAR_DAY_NAMES = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
  ];

  // 按农历的节日：月-日
  const LUNAR_FESTIVALS = {
    '1-1': '春节', '1-15': '元宵', '2-2': '龙抬头', '5-5': '端午', '7-7': '七夕',
    '7-15': '中元', '8-15': '中秋', '9-9': '重阳', '12-8': '腊八', '12-23': '小年'
  };
  // 按公历的固定节日：月-日
  const SOLAR_FESTIVALS = {
    '1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '4-1': '愚人节', '5-1': '劳动节',
    '6-1': '儿童节', '10-31': '万圣夜', '12-24': '平安夜', '12-25': '圣诞节', '12-31': '跨年夜'
  };

  const lunarDayCache = {};
  const solarTermCache = {};
  const dayMetaCache = {};

  // ==================== 缓存管理：统一前缀、统一清理、可自检 ====================
  // 应用只保留“活数据”：日期换算缓存按当前浏览窗口裁剪，天气与反查地名由
  // weather.js 每次替换而非累积；这里提供统一入口，避免越用越大。
  const CACHE_PREFIX = 'light-schedule.cache.';

  function cacheKeysInStorage() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
      }
    } catch (err) { /* 隐私模式下可能不可用 */ }
    return keys;
  }

  // 仅保留当前浏览月份（含今天所在月份）前后各两三个月的换算结果
  function pruneDateCaches(anchorKey) {
    const base = anchorKey ? keyToDate(anchorKey) : new Date();
    const t = keyToDate(todayKey());
    const aLo = new Date(base.getFullYear(), base.getMonth() - 2, 1);
    const aHi = new Date(base.getFullYear(), base.getMonth() + 3, 0);
    const tLo = new Date(t.getFullYear(), t.getMonth() - 2, 1);
    const tHi = new Date(t.getFullYear(), t.getMonth() + 3, 0);
    const lo = dateKey(aLo < tLo ? aLo : tLo);
    const hi = dateKey(aHi > tHi ? aHi : tHi);
    Object.keys(lunarDayCache).forEach(function (k) {
      if (k < lo || k > hi) delete lunarDayCache[k];
    });
    Object.keys(dayMetaCache).forEach(function (k) {
      if (k < lo || k > hi) delete dayMetaCache[k];
    });
    Object.keys(solarTermCache).forEach(function (k) {
      const y = Number(k);
      if (y < Number(lo.slice(0, 4)) || y > Number(hi.slice(0, 4))) delete solarTermCache[k];
    });
  }

  function clearAllCaches() {
    Object.keys(lunarDayCache).forEach(function (k) { delete lunarDayCache[k]; });
    Object.keys(solarTermCache).forEach(function (k) { delete solarTermCache[k]; });
    Object.keys(dayMetaCache).forEach(function (k) { delete dayMetaCache[k]; });
    try {
      cacheKeysInStorage().forEach(function (k) {
        try { localStorage.removeItem(k); } catch (err) {}
      });
    } catch (err) {}
    pendingImport = null;
    if (window.Weather && window.Weather.clearCache) window.Weather.clearCache();
  }

  // 供自动化/自检使用，不在界面暴露技术细节
  function cacheStats() {
    const w = (window.Weather && window.Weather.cacheStats) ? window.Weather.cacheStats() : {};
    const weatherTotal = (w.forecastDays || 0) + (w.placeEntries || 0) + (w.geoEntries || 0) + (w.pending || 0);
    const mem = Object.keys(lunarDayCache).length + Object.keys(solarTermCache).length + Object.keys(dayMetaCache).length;
    const local = cacheKeysInStorage().length;
    return {
      lunar: Object.keys(lunarDayCache).length,
      solarTerm: Object.keys(solarTermCache).length,
      dayMeta: Object.keys(dayMetaCache).length,
      localStorage: local,
      weather: w,
      total: mem + local + weatherTotal
    };
  }
  window.__cacheStats = cacheStats;

  function lunarLeapMonth(y) {
    return LUNAR_INFO[y - 1900] & 0xf;
  }

  function lunarLeapDays(y) {
    if (!lunarLeapMonth(y)) return 0;
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  }

  function lunarMonthDays(y, m) {
    return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
  }

  function lunarYearDays(y) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) {
      if (LUNAR_INFO[y - 1900] & i) sum += 1;
    }
    return sum + lunarLeapDays(y);
  }

  function solarToLunar(y, m, d) {
    const cacheKey = y + '-' + m + '-' + d;
    if (lunarDayCache[cacheKey]) return lunarDayCache[cacheKey];
    let offset = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
    let i;
    let temp = 0;
    for (i = 1900; i < 2101 && offset > 0; i++) {
      temp = lunarYearDays(i);
      offset -= temp;
    }
    if (offset < 0) {
      offset += temp;
      i--;
    }
    const lunarYear = i;
    const leap = lunarLeapMonth(i);
    let isLeap = false;
    let j;
    for (j = 1; j < 13 && offset > 0; j++) {
      if (leap > 0 && j === leap + 1 && !isLeap) {
        --j;
        isLeap = true;
        temp = lunarLeapDays(lunarYear);
      } else {
        temp = lunarMonthDays(lunarYear, j);
      }
      if (isLeap && j === leap + 1) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && j === leap + 1) {
      if (isLeap) {
        isLeap = false;
      } else {
        isLeap = true;
        --j;
      }
    }
    if (offset < 0) {
      offset += temp;
      --j;
    }
    const result = { year: lunarYear, month: j, day: offset + 1, isLeap: isLeap };
    lunarDayCache[cacheKey] = result;
    return result;
  }

  function lunarToSolar(y, m, d, isLeap) {
    let offset = 0;
    for (let i = 1900; i < y; i++) offset += lunarYearDays(i);
    const leap = lunarLeapMonth(y);
    for (let i = 1; i < m; i++) {
      offset += lunarMonthDays(y, i);
      if (i === leap) offset += lunarLeapDays(y);
    }
    if (isLeap && leap === m) offset += lunarMonthDays(y, m);
    offset += d - 1;
    const dt = new Date(Date.UTC(1900, 0, 31) + offset * 86400000);
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
  }

  function solarTermsOfYear(y) {
    if (solarTermCache[y]) return solarTermCache[y];
    const map = {};
    for (let n = 0; n < 24; n++) {
      const month = Math.floor(n / 2) + 1;
      const ms = 31556925974.7 * (y - 1900) + SOLAR_TERM_INFO[n] * 60000 + Date.UTC(1900, 0, 6, 2, 5);
      const day = new Date(ms).getUTCDate();
      map[month + '-' + day] = SOLAR_TERM_NAMES[n];
    }
    solarTermCache[y] = map;
    return map;
  }

  function nthWeekdayOfMonth(y, m, weekday, nth) {
    const first = new Date(y, m - 1, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return 1 + offset + (nth - 1) * 7;
  }

  function lunarFestivalOf(lunar) {
    if (lunar.month === 12 && lunar.day === lunarMonthDays(lunar.year, 12)) return '除夕';
    return LUNAR_FESTIVALS[lunar.month + '-' + lunar.day] || '';
  }

  function solarFestivalOf(y, m, d) {
    if (m === 5 && d === nthWeekdayOfMonth(y, 5, 0, 2)) return '母亲节';
    if (m === 6 && d === nthWeekdayOfMonth(y, 6, 0, 3)) return '父亲节';
    return SOLAR_FESTIVALS[m + '-' + d] || '';
  }

  // 每天的农历 / 节气 / 节日，按天缓存
  function dayMeta(key) {
    if (dayMetaCache[key]) return dayMetaCache[key];
    const dt = keyToDate(key);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const lunar = solarToLunar(y, m, d);
    const term = solarTermsOfYear(y)[m + '-' + d] || '';
    let festival = lunarFestivalOf(lunar) || solarFestivalOf(y, m, d);
    if (!festival && term === '清明') festival = '清明';
    const monthName = LUNAR_MONTH_NAMES[lunar.month - 1];
    const meta = {
      lunar: lunar,
      lunarText: lunar.day === 1
        ? (lunar.isLeap ? '闰' + monthName + '月' : '初一')
        : (lunar.isLeap ? '闰' : '') + LUNAR_DAY_NAMES[lunar.day - 1],
      lunarFull: (lunar.isLeap ? '闰' : '') + monthName + '月' + LUNAR_DAY_NAMES[lunar.day - 1],
      term: term,
      festival: festival
    };
    dayMetaCache[key] = meta;
    return meta;
  }

  // ==================== 重复规则 ====================

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function daysBetween(aKey, bKey) {
    const a = keyToDate(aKey);
    const b = keyToDate(bKey);
    return Math.round(
      (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
       Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000
    );
  }

  function normalizeRecurrence(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.type !== 'daily' && raw.type !== 'weekly' &&
        raw.type !== 'monthly' && raw.type !== 'yearly' &&
        raw.type !== 'lunarYearly' && raw.type !== 'lunarMonthly') return null;

    const rec = { type: raw.type, interval: clampInt(raw.interval, 1, 30, 1) };

    if (raw.type === 'weekly') {
      const src = Array.isArray(raw.byWeekday) ? raw.byWeekday : [];
      const days = [];
      src.forEach(function (v) {
        const n = Number(v);
        if (n >= 0 && n <= 6 && days.indexOf(n) === -1) days.push(n);
      });
      rec.byWeekday = days.sort(function (a, b) { return a - b; });
    }

    if (raw.type === 'monthly') {
      const day = Number(raw.byMonthDay);
      if (day >= 1 && day <= 31) rec.byMonthDay = Math.round(day);
    }

    if (raw.type === 'yearly') {
      const month = Number(raw.byMonth);
      const day = Number(raw.byMonthDay);
      if (month >= 1 && month <= 12) rec.byMonth = Math.round(month);
      if (day >= 1 && day <= 31) rec.byMonthDay = Math.round(day);
      if (Number(raw.startYear) >= 1900 && Number(raw.startYear) <= 2100) {
        rec.startYear = Math.round(Number(raw.startYear));
      }
    }

    if (raw.type === 'lunarYearly' || raw.type === 'lunarMonthly') {
      const day = Number(raw.lunarDay);
      if (day >= 1 && day <= 30) rec.lunarDay = Math.round(day);
      if (raw.type === 'lunarYearly') {
        const month = Number(raw.lunarMonth);
        if (month >= 1 && month <= 12) rec.lunarMonth = Math.round(month);
      }
    }

    if ((raw.type === 'monthly' || raw.type === 'yearly' ||
         raw.type === 'lunarYearly' || raw.type === 'lunarMonthly') &&
        /^\d{2}:\d{2}$/.test(String(raw.time || ''))) {
      rec.time = String(raw.time);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw.until || ''))) {
      rec.until = String(raw.until);
    }

    return rec;
  }

  function normalizeCompletions(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (key) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof raw[key] === 'number') {
        out[key] = raw[key];
      }
    });
    return out;
  }

  function lunarPartsOfKey(key) {
    const d = keyToDate(key);
    return solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function recurrenceLabel(rec, startKey) {
    if (!rec) return T('不重复');
    const start = startKey ? keyToDate(startKey) : new Date();
    if (rec.type === 'daily') {
      return rec.interval > 1 ? T('每 {n} 天', { n: rec.interval }) : T('每天');
    }
    if (rec.type === 'weekly') {
      const weekdays = rec.byWeekday && rec.byWeekday.length ? rec.byWeekday : [start.getDay()];
      const names = weekdays.map(function (w) { return isEn() ? WEEK_EN[w] : WEEK[w]; }).join(isEn() ? ', ' : '·');
      const head = rec.interval > 1 ? T('每 {n} 周', { n: rec.interval }) : T('每周');
      return head + ' ' + names;
    }
    if (rec.type === 'monthly') {
      return T('每月 {d} 日', { d: rec.byMonthDay || start.getDate() });
    }
    if (rec.type === 'lunarMonthly' || rec.type === 'lunarYearly') {
      const lp = lunarPartsOfKey(startKey || todayKey());
      const day = rec.lunarDay || lp.day;
      if (rec.type === 'lunarMonthly') {
        return isEn()
          ? T('每月 农历{day}', { day: day })
          : '每月 农历' + LUNAR_DAY_NAMES[day - 1];
      }
      const month = rec.lunarMonth || lp.month;
      return isEn()
        ? T('每年 农历{m}月{d}', { m: month, d: day })
        : '每年 农历' + LUNAR_MONTH_NAMES[month - 1] + '月' + LUNAR_DAY_NAMES[day - 1];
    }
    return isEn()
      ? T('每年 {m} 月 {d} 日', { m: rec.byMonth || start.getMonth() + 1, d: rec.byMonthDay || start.getDate() })
      : '每年 ' + (rec.byMonth || start.getMonth() + 1) + ' 月 ' + (rec.byMonthDay || start.getDate()) + ' 日';
  }

  function repeatDetailText(item) {
    if (!item.recurrence) return T('不重复');
    const rec = item.recurrence;
    const baseDate = item.baseDate || item.date;
    let text = recurrenceLabel(rec, baseDate);
    if (rec.time) text += ' ' + rec.time;
    if (rec.type === 'yearly' && rec.startYear) {
      text = isEn()
        ? T('{year} 年起，{rest}', { year: rec.startYear, rest: text })
        : rec.startYear + ' 年起，' + text;
    }
    if (rec.until) text += T('，到 {d} 为止', { d: rec.until });
    return text;
  }

  function repeatFullText(item) {
    return item.recurrence ? T('重复：{text}', { text: repeatDetailText(item) }) : '';
  }

  function matchesRecurrence(item, key, startWeek) {
    const rec = item.recurrence;
    const start = item.date;
    if (key < start) return false;

    const d = keyToDate(key);
    const startDate = keyToDate(start);
    const interval = rec.interval || 1;

    if (rec.type === 'daily') {
      const diff = daysBetween(start, key);
      return diff >= 0 && diff % interval === 0;
    }

    if (rec.type === 'weekly') {
      const weekdays = rec.byWeekday && rec.byWeekday.length
        ? rec.byWeekday
        : [startDate.getDay()];
      if (weekdays.indexOf(d.getDay()) === -1) return false;
      const diffWeeks = daysBetween(startWeek, startOfWeek(key)) / 7;
      return diffWeeks >= 0 && diffWeeks % interval === 0;
    }

    if (rec.type === 'monthly') {
      const day = rec.byMonthDay || startDate.getDate();
      return d.getDate() === day;
    }

    if (rec.type === 'lunarMonthly' || rec.type === 'lunarYearly') {
      const lp = lunarPartsOfKey(key);
      // 闰月不单独处理：只匹配非闰月
      if (lp.isLeap) return false;
      if (lp.day !== (rec.lunarDay || 1)) return false;
      if (rec.type === 'lunarMonthly') return true;
      return lp.month === (rec.lunarMonth || 1);
    }

    const month = (rec.byMonth || startDate.getMonth() + 1) - 1;
    const day = rec.byMonthDay || startDate.getDate();
    return d.getMonth() === month && d.getDate() === day;
  }

  // 按窗口一次性展开，同一个条目同一天最多出现一次
  function occurrenceDatesIn(item, startKey, endKey) {
    if (!item.recurrence) {
      return item.date >= startKey && item.date <= endKey ? [item.date] : [];
    }

    let from = item.date > startKey ? item.date : startKey;
    const until = item.recurrence.until;
    let to = endKey;
    if (until && until < to) to = until;
    if (from > to) return [];

    const startWeek = startOfWeek(item.date);
    const dates = [];
    for (let key = from; key <= to; key = addDays(key, 1)) {
      if (matchesRecurrence(item, key, startWeek)) dates.push(key);
    }
    return dates;
  }

  function makeInstance(item, key) {
    if (!item.recurrence) return item;
    const copy = Object.assign({}, item);
    copy.baseDate = item.date;
    copy.date = key;
    copy.done = !!item.completions[key];
    copy.doneAt = item.completions[key] || null;
    if (item.recurrence.time) copy.time = item.recurrence.time;
    return copy;
  }

  function expandOccurrences(items, startKey, endKey) {
    const out = [];
    items.forEach(function (item) {
      occurrenceDatesIn(item, startKey, endKey).forEach(function (key) {
        out.push(makeInstance(item, key));
      });
    });
    return out;
  }

  // ==================== 数据校验 ====================

  // 条目 / 计划上的地址：只保留一行可读地址，坐标可选（用于打开地图）
  function normalizeAddress(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const label = String(raw.label || '').trim().slice(0, 160);
    if (!label) return null;
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    return {
      label: label,
      lat: isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null,
      lon: isFinite(lon) && lon >= -180 && lon <= 180 ? lon : null
    };
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title || '').trim().slice(0, 120);
    if (!title) return null;
    const date = String(raw.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (isNaN(keyToDate(date).getTime())) return null;
    // 旧版本的「提醒」类型已取消，统一按待办展示，remindBefore 提醒设置保留
    const type = raw.type === 'reminder' ? 'todo' : (TYPE_META[raw.type] ? raw.type : 'todo');
    const time = /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : null;
    const recurrence = normalizeRecurrence(raw.recurrence);
    const completions = normalizeCompletions(raw.completions);
    const remindRaw = Number(raw.remindBefore);
    const remindBefore = isFinite(remindRaw) && Math.round(remindRaw) === remindRaw &&
      remindRaw >= 1 && remindRaw <= 1440 ? remindRaw : null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      type: type,
      title: title,
      date: date,
      time: time,
      priority: raw.priority === 'high' ? 'high' : 'normal',
      done: recurrence ? false : raw.done === true,
      doneAt: recurrence ? null : (typeof raw.doneAt === 'number' ? raw.doneAt : (raw.done === true ? Date.now() : null)),
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      categoryId: typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : null,
      note: String(raw.note || '').slice(0, 500),
      address: normalizeAddress(raw.address),
      remindBefore: remindBefore,
      recurrence: recurrence,
      completions: completions
    };
  }

  function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
  }

  // ---------- 计划（与日程条目独立存储） ----------
  const PLAN_KINDS = { week: '周计划', month: '月计划', year: '年计划' };
  // 「本周期」按类型说清楚：周 / 月 / 年各自一套叫法，空态、统计、分组标题统一使用
  const PLAN_SCOPE_WORD = { week: '本周', month: '本月', year: '本年度' };
  const PLAN_SCOPE_EMPTY = {
    week: '本周还没有计划，点右上角「添加计划」写下一条。',
    month: '本月还没有计划，点右上角「添加计划」写下一条。',
    year: '本年度还没有计划，点右上角「添加计划」写下一条。'
  };
  const PLAN_SCOPE_OTHER = {
    week: '其他周计划 · {n}',
    month: '其他月计划 · {n}',
    year: '其他年度计划 · {n}'
  };

  function planPeriodStart(kind, key) {
    const d = keyToDate(key);
    if (kind === 'year') return d.getFullYear() + '-01-01';
    if (kind === 'month') return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01';
    return startOfWeek(key);
  }

  function planPeriodLabel(kind, periodStart) {
    const d = keyToDate(periodStart);
    if (kind === 'year') return isEn() ? String(d.getFullYear()) : d.getFullYear() + ' 年';
    if (kind === 'month') return isEn() ? MONTH_EN[d.getMonth()] + ' ' + d.getFullYear() : (d.getMonth() + 1) + ' 月';
    return shortDate(periodStart) + ' – ' + shortDate(addDays(periodStart, 6));
  }

  function normalizePlan(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = PLAN_KINDS[raw.kind] ? raw.kind : 'week';
    const title = String(raw.title || '').trim().slice(0, 80);
    if (!title) return null;
    let periodStart = String(raw.periodStart || '');
    if (isNaN(keyToDate(periodStart).getTime())) periodStart = planPeriodStart(kind, todayKey());
    const time = /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : null;
    const remindRaw = Number(raw.remindBefore);
    const remindBefore = isFinite(remindRaw) && Math.round(remindRaw) === remindRaw &&
      remindRaw >= 1 && remindRaw <= 1440 ? remindRaw : null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      kind: kind,
      title: title,
      periodStart: periodStart,
      time: time,
      priority: raw.priority === 'high' ? 'high' : 'normal',
      categoryId: typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : null,
      note: String(raw.note || '').slice(0, 500),
      address: normalizeAddress(raw.address),
      remindBefore: remindBefore,
      done: raw.done === true,
      doneAt: typeof raw.doneAt === 'number' ? raw.doneAt : (raw.done === true ? Date.now() : null),
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  function normalizeCategory(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim().slice(0, MAX_CAT_NAME);
    if (!name) return null;
    const fallback = PRESET_COLORS[index % PRESET_COLORS.length];
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      name: name,
      color: isHexColor(raw.color) ? String(raw.color) : fallback,
      order: typeof raw.order === 'number' && isFinite(raw.order) ? raw.order : index,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
    };
  }

  function sortCategories() {
    state.categories.sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function getCategory(id) {
    if (!id) return null;
    return state.categories.find(function (cat) { return cat.id === id; }) || null;
  }

  function categoryColorOf(item) {
    const cat = getCategory(item.categoryId);
    return cat ? cat.color : TYPE_META[item.type].color;
  }

  function hexToRgba(hex, alpha) {
    if (!isHexColor(hex)) return 'rgba(78, 84, 110, ' + alpha + ')';
    const h = String(hex).slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function countByCategory(id) {
    return state.items.filter(function (item) { return item.categoryId === id; }).length;
  }

  // ==================== 存储层 ====================

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('timeout')); }, ms);
      })
    ]);
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      let req;
      try {
        req = indexedDB.open(IDB_NAME, 1);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB 打开失败')); };
      req.onblocked = function () { reject(new Error('IndexedDB 被其它标签页占用')); };
    });
  }

  function idbGet(key) {
    return new Promise(function (resolve, reject) {
      const tx = storage.db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = function () {
        resolve(req.result ? req.result.value : undefined);
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbSet(key, value) {
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = storage.db.transaction(IDB_STORE, 'readwrite');
      } catch (err) {
        reject(err);
        return;
      }
      tx.objectStore(IDB_STORE).put({ key: key, value: value });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error || new Error('写入失败')); };
      tx.onabort = function () { reject(tx.error || new Error('写入被中断')); };
    });
  }

  function localStorageWorks() {
    try {
      const probe = 'light-schedule.probe';
      localStorage.setItem(probe, '1');
      const val = localStorage.getItem(probe);
      localStorage.removeItem(probe);
      return val === '1';
    } catch (err) {
      return false;
    }
  }

  async function detectStorage() {
    if (window.indexedDB) {
      try {
        storage.db = await withTimeout(openDB(), 1500);
        storage.status = 'idb';
        return;
      } catch (err) {
        console.warn('IndexedDB 不可用，尝试 localStorage：', err && err.message);
      }
    }
    if (localStorageWorks()) {
      storage.status = 'local';
      return;
    }
    storage.status = 'memory';
  }

  async function loadAll() {
    let items = [];
    let cats = [];
    let plans = [];
    let meta = {};
    try {
      if (storage.status === 'idb') {
        items = (await idbGet('items')) || [];
        cats = (await idbGet('categories')) || [];
        plans = (await idbGet('plans')) || [];
        meta = (await idbGet('meta')) || {};
      } else if (storage.status === 'local') {
        items = JSON.parse(localStorage.getItem(LS_ITEMS_KEY) || '[]');
        cats = JSON.parse(localStorage.getItem(LS_CATS_KEY) || '[]');
        plans = JSON.parse(localStorage.getItem(LS_PLANS_KEY) || '[]');
        meta = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}');
      } else {
        items = storage.memoryItems;
        cats = storage.memoryCats;
        plans = storage.memoryPlans;
        meta = storage.memoryMeta;
      }
    } catch (err) {
      console.warn('读取本地数据失败：', err);
    }

    if (!Array.isArray(items)) items = [];
    if (!Array.isArray(cats)) cats = [];
    if (!Array.isArray(plans)) plans = [];
    if (!meta || typeof meta !== 'object') meta = {};

    state.categories = cats.map(normalizeCategory).filter(Boolean).slice(0, MAX_CATEGORIES);
    sortCategories();
    state.items = items.map(normalizeItem).filter(Boolean);
    state.plans = plans.map(normalizePlan).filter(Boolean);
    state.meta = meta;

    // 旧数据的条目没有 categoryId，这里只在内存里视为未分类，不写回存储
    const ids = new Set(state.categories.map(function (cat) { return cat.id; }));
    state.items.forEach(function (item) {
      if (item.categoryId && !ids.has(item.categoryId)) item.categoryId = null;
    });
    state.plans.forEach(function (plan) {
      if (plan.categoryId && !ids.has(plan.categoryId)) plan.categoryId = null;
    });

    state.agendaFilters = state.agendaFilters.filter(function (id) { return ids.has(id); });
  }

  async function persistItems(silent) {
    const snapshot = state.items.map(function (item) { return Object.assign({}, item); });
    try {
      if (storage.status === 'idb') {
        await idbSet('items', snapshot);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(snapshot));
      } else {
        storage.memoryItems = snapshot;
      }
      return true;
    } catch (err) {
      console.error('保存失败：', err);
      if (!silent) showToast(T('保存失败：{msg}', { msg: err && err.message ? err.message : T('浏览器拒绝写入') }));
      return false;
    }
  }

  async function persistPlans(silent) {
    const snapshot = state.plans.map(function (plan) { return Object.assign({}, plan); });
    try {
      if (storage.status === 'idb') {
        await idbSet('plans', snapshot);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_PLANS_KEY, JSON.stringify(snapshot));
      } else {
        storage.memoryPlans = snapshot;
      }
      return true;
    } catch (err) {
      console.error('计划保存失败：', err);
      if (!silent) showToast(T('计划保存失败，请重试'));
      return false;
    }
  }

  async function persistCategories(silent) {
    const snapshot = state.categories.map(function (cat) { return Object.assign({}, cat); });
    try {
      if (storage.status === 'idb') {
        await idbSet('categories', snapshot);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_CATS_KEY, JSON.stringify(snapshot));
      } else {
        storage.memoryCats = snapshot;
      }
      return true;
    } catch (err) {
      console.error('分类保存失败：', err);
      if (!silent) showToast(T('分类保存失败：{msg}', { msg: err && err.message ? err.message : T('浏览器拒绝写入') }));
      return false;
    }
  }

  async function persistMeta() {
    const snapshot = Object.assign({}, state.meta);
    try {
      if (storage.status === 'idb') {
        await idbSet('meta', snapshot);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_META_KEY, JSON.stringify(snapshot));
      } else {
        storage.memoryMeta = snapshot;
      }
    } catch (err) {
      console.warn('设置保存失败：', err);
    }
  }

  function formatBackupShort(ts) {
    const d = new Date(ts);
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // ==================== 旧版示例数据清理（只跑一次） ====================

  // 旧版本首次打开会写入一批 id 以 seed- 开头的示例条目。
  // 这里只在第一次运行时移除这些示例，用户自己新建的条目 id 不带该前缀，不会被删。
  async function migrateLegacySamples() {
    if (state.meta.samplesCleared === true) return;

    const legacy = state.items.filter(function (item) {
      return typeof item.id === 'string' && item.id.indexOf('seed-') === 0;
    });

    if (legacy.length) {
      state.items = state.items.filter(function (item) {
        return !(typeof item.id === 'string' && item.id.indexOf('seed-') === 0);
      });
      await persistItems();
    }

    state.meta.samplesCleared = true;
    await persistMeta();

    if (legacy.length) {
      showToast(T('已清理 {n} 条旧版示例数据', { n: legacy.length }));
    }
  }

  // ==================== 渲染：顶部栏 / 汇总 ====================

  function updateTopbar() {
    const title = $('#topbarTitle');
    const prev = $('#prevBtn');
    const next = $('#nextBtn');
    const t = todayKey();
    const td = keyToDate(t);
    let onToday = false;

    if (state.view === 'calendar') {
      title.textContent = isEn()
        ? MONTH_EN[state.month.getMonth()] + ' ' + state.month.getFullYear()
        : state.month.getFullYear() + '年' + (state.month.getMonth() + 1) + '月';
      prev.hidden = false;
      next.hidden = false;
      onToday = state.month.getFullYear() === td.getFullYear() && state.month.getMonth() === td.getMonth();
    } else if (state.view === 'agenda') {
      title.textContent = relativeDayLabel(state.agendaAnchor) + ' · ' + weekdayOf(state.agendaAnchor);
      prev.hidden = false;
      next.hidden = false;
      onToday = state.agendaAnchor === t;
    } else if (state.view === 'schedule') {
      const start = state.scheduleAnchor || startOfWeek(t);
      title.textContent = shortDate(start) + ' – ' + shortDate(addDays(start, 6));
      prev.hidden = false;
      next.hidden = false;
      onToday = start === startOfWeek(t);
    } else {
      title.textContent = T('计划');
      prev.hidden = true;
      next.hidden = true;
    }

    $('#todayBtn').classList.toggle('is-current', onToday);
  }

  function renderSummary() {
    if (state.view === 'plan') {
      $('#summaryBar').hidden = true;
      return;
    }
    const t = todayKey();
    const todayItems = expandOccurrences(state.items, t, t);
    const overdue = state.items.filter(function (i) {
      return !i.recurrence && !i.done && i.date < t;
    });
    const pending = todayItems.filter(function (i) { return !i.done; });
    const doneToday = todayItems.filter(function (i) { return i.done; });

    if (!overdue.length && !pending.length) {
      $('#summaryBar').hidden = true;
      return;
    }

    const parts = [];
    if (overdue.length) {
      parts.push('<span class="sum-danger">' + esc(T('逾期 {n} 项', { n: overdue.length })) + '</span>');
    }
    parts.push(esc(T('今天还有 {n} 项未完成', { n: pending.length })));
    if (doneToday.length) {
      parts.push(esc(T('已完成 {n} 项', { n: doneToday.length })));
    }
    $('#summaryText').innerHTML = parts.join('<span class="sum-sep">·</span>');
    $('#summaryBar').hidden = false;
  }

  // ==================== 渲染：日历 ====================

  function renderCalendar() {
    const year = state.month.getFullYear();
    const monthIndex = state.month.getMonth();
    const keys = buildMonthGrid(year, monthIndex);
    const t = todayKey();

    const byDate = {};
    const occurrences = expandOccurrences(state.items, keys[0], keys[keys.length - 1]);
    occurrences.forEach(function (item) {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });

    let html = '';
    keys.forEach(function (key) {
      const d = keyToDate(key);
      const inMonth = d.getMonth() === monthIndex;
      const dayItems = byDate[key] || [];
      const undone = dayItems.filter(function (i) { return !i.done; });
      const dotSource = undone.length ? undone : dayItems;
      const dotColors = [];
      dotSource.forEach(function (i) {
        const color = categoryColorOf(i);
        if (dotColors.indexOf(color) === -1) dotColors.push(color);
      });

      const classes = [
        'cal-cell',
        inMonth ? '' : 'other',
        key === t ? 'today' : '',
        key === state.selectedDate ? 'selected' : '',
        dayItems.length ? 'has-items' : '',
        dayItems.length && !undone.length ? 'all-done' : ''
      ].filter(Boolean).join(' ');

      let dots = '';
      dotColors.slice(0, 3).forEach(function (color) {
        dots += '<span class="dot" style="background:' + color + '"></span>';
      });

      const meta = dayMeta(key);
      const subText = isEn()
        ? (meta.festival ? T(meta.festival) : '')
        : (meta.festival || meta.term || meta.lunarText);
      const subClass = isEn() ? (meta.festival ? ' is-festival' : '')
        : (meta.festival ? ' is-festival' : (meta.term ? ' is-term' : ''));

      const ariaText = isEn()
        ? monthDay(key) + ' ' + weekdayOf(key) +
          (meta.festival ? ', ' + T(meta.festival) : '') +
          ', ' + T('{n} 项安排', { n: dayItems.length })
        : monthDay(key) + ' ' + weekdayOf(key) + ' ' + meta.lunarFull +
          (meta.term ? ' ' + meta.term : '') + (meta.festival ? ' ' + meta.festival : '') +
          '，' + dayItems.length + ' 项安排';

      html += '<button class="' + classes + '" type="button" data-date="' + key +
        '" aria-label="' + esc(ariaText) + '">' +
        '<span class="dnum">' + d.getDate() + '</span>' +
        '<span class="cal-lunar' + subClass + '">' + esc(subText) + '</span>' +
        '<span class="dots">' + dots + '</span>' +
        '</button>';
    });

    $('#calGrid').innerHTML = html;
    renderDayDetail();

    const monthItems = occurrences.filter(function (item) {
      const d = keyToDate(item.date);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });
    const monthDone = monthItems.filter(function (i) { return i.done; }).length;
    $('#monthStat').textContent = monthItems.length
      ? T('本月 {n} 项 · 已完成 {m} 项', { n: monthItems.length, m: monthDone })
      : T('本月还没有安排');

    const isEmpty = state.items.length === 0;
    $('#calendarEmpty').hidden = !isEmpty;
    $('#calTip').hidden = isEmpty;
    // 只保留当前浏览窗口前后的换算缓存，翻到别的年月也不会无限累积
    pruneDateCaches(dateKey(state.month));
  }

  // ==================== 渲染：日历下方「当日详情」 ====================

  function swipeRowHTML(item, opts, stack) {
    const layers = stack
      ? '<div class="stack-layers" data-layers="' + stack.key + '" aria-hidden="true"' +
        (stack.hidden ? ' hidden' : '') + '><i></i><i></i></div>'
      : '';
    const locked = stack && stack.locked;
    return '<div class="swipe' + (stack ? ' swipe-stack' : '') + (locked ? ' swipe-locked' : '') +
        '" data-id="' + item.id + '" data-date="' + item.date + '"' +
        (stack ? ' data-stack-head="' + stack.key + '"' : '') + '>' +
      '<button class="swipe-del" type="button" data-swipe-del="' + item.id + '" aria-label="删除这条安排">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5.3h5V7M6.9 7l.8 11.2h8.6L17.1 7"/><path d="M10 10.4v4.6M14 10.4v4.6"/></svg>' +
      '</button>' +
      '<div class="swipe-inner">' + itemRowHTML(item, opts, layers) + '</div>' +
    '</div>';
  }

  function renderDayDetail() {
    const box = $('#dayDetail');
    const inner = $('#dayDetailInner');
    if (!box || !inner) return;

    const key = state.selectedDate;
    if (!key) {
      box.classList.remove('open');
      return;
    }

    const meta = dayMeta(key);
    const d = keyToDate(key);
    const items = expandOccurrences(state.items, key, key).sort(compareAgenda);
    const total = items.length;

    const subParts = isEn()
      ? (meta.festival ? [T(meta.festival)] : [])
      : [meta.lunarFull];
    if (!isEn() && meta.term && meta.term !== meta.festival) subParts.push(meta.term);
    if (!isEn() && meta.festival) subParts.push(meta.festival);

    const order = ['event', 'todo'];
    const groups = [];
    order.forEach(function (type) {
      const list = items.filter(function (i) { return i.type === type; });
      if (list.length) groups.push({ type: type, items: list });
    });

    let listHTML = '';
    groups.forEach(function (g) {
      const stackKey = 'd:' + key + ':' + g.type;
      const stacked = g.items.length > STACK_LIMIT;
      const expanded = stacked && state.expandedGroups.has(stackKey);
      const headItems = stacked ? g.items.slice(0, STACK_LIMIT) : g.items;
      const extraItems = stacked ? g.items.slice(STACK_LIMIT) : [];

      let rows = '';
      headItems.forEach(function (item, i) {
        rows += swipeRowHTML(item, undefined,
          stacked && i === 0 ? { key: stackKey, hidden: expanded, locked: !expanded } : null);
      });

      let extraHTML = '';
      if (extraItems.length) {
        let extraRows = '';
        extraItems.forEach(function (item) { extraRows += swipeRowHTML(item); });
        extraHTML = '<div class="stack-extra' + (expanded ? ' open' : '') + '" data-stack="' + stackKey + '">' +
          '<div class="stack-extra-inner"><div class="timeline">' + extraRows + '</div></div></div>';
      }

      const toggle = stacked
        ? '<button class="stack-toggle" type="button" data-stack-toggle="' + stackKey +
          '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
          (expanded ? esc(T('收起')) : esc(T('展开 {n} 条', { n: extraItems.length }))) + '</button>'
        : '';

      listHTML += '<div class="dd-group">' +
        '<div class="dd-group-head"><i style="background:' + TYPE_META[g.type].color + '"></i>' +
        TYPE_META[g.type].label + '<span>' + g.items.length + '</span>' + toggle + '</div>' +
        '<div class="timeline">' + rows + '</div>' + extraHTML +
      '</div>';
    });

    if (!total) {
      listHTML = '<div class="dd-empty">' +
        '<span>' + esc(T('该日暂无安排')) + '</span>' +
      '</div>';
    }

    inner.innerHTML =
      '<div class="dd-head">' +
        '<div class="dd-head-main">' +
          '<div class="dd-date">' + esc(monthDay(key)) +
            '<span>' + esc(weekdayFullOf(key)) + '</span></div>' +
          '<div class="dd-sub">' + esc(subParts.join(' · ')) + '</div>' +
        '</div>' +
        '<div class="dd-weather" id="ddWeather"></div>' +
      '</div>' +
      listHTML;

    // 天气与选中日期绑定：显示该日及之后两天的预报（超出范围则隐藏）
    if (window.Weather) window.Weather.render($('#ddWeather'), key);

    box.classList.add('open');
  }

  // ==================== 日历：左右滑动切月 ====================

  const CAL_MIN_YEAR = 1900;
  const CAL_MAX_YEAR = 2100;

  // 切换月份（带上 1900 / 2100 的边界），返回是否真的换了
  function shiftMonthBy(delta) {
    const y = state.month.getFullYear();
    const m = state.month.getMonth();
    const total = y * 12 + m + delta;
    if (total < CAL_MIN_YEAR * 12 || total > CAL_MAX_YEAR * 12 + 11) return false;
    state.month = new Date(Math.floor(total / 12), total % 12, 1);
    state.selectedDate = '';
    return true;
  }

  function bindMonthSwipe() {
    const grid = $('#calGrid');
    if (!grid) return;

    const MIN_MOVE = 12;          // 判定方向的位移
    const VELOCITY = 0.32;        // px/ms，快速轻扫也能翻页

    let pid = null;
    let active = false;
    let mode = '';                // '' | 'h'（已锁定横向）
    let animating = false;
    let sx = 0;
    let sy = 0;
    let dx = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;

    function width() { return grid.clientWidth || 360; }

    function atBound(dir) {
      const y = state.month.getFullYear();
      const m = state.month.getMonth();
      if (dir < 0) return y <= CAL_MIN_YEAR && m === 0;
      return y >= CAL_MAX_YEAR && m === 11;
    }

    function springBack() {
      animating = true;
      grid.style.transition = 'transform .24s cubic-bezier(.22,.61,.36,1)';
      grid.style.transform = 'translate3d(0,0,0)';
      setTimeout(function () {
        grid.style.transition = '';
        grid.style.transform = '';
        animating = false;
      }, 250);
    }

    function release(pointerId) {
      if (!active || pointerId !== pid) return;
      active = false;
      pid = null;

      if (mode !== 'h') {
        grid.style.transition = '';
        grid.style.transform = '';
        return;
      }

      state.swipeClickLock = Date.now() + 280;

      const dir = dx < 0 ? 1 : -1;           // 左滑 → 下个月
      const w = width();
      const threshold = Math.min(88, w * 0.2);
      const flick = Math.abs(vx) > VELOCITY && Math.abs(dx) > MIN_MOVE &&
        (vx < 0) === (dx < 0);

      if (!(Math.abs(dx) >= threshold || flick) || atBound(dir)) {
        springBack();
        return;
      }

      // 当前月份跟手滑出，再从另一侧滑入新月份
      animating = true;
      grid.style.transition = 'transform .24s cubic-bezier(.22,.61,.36,1)';
      grid.style.transform = 'translate3d(' + (-dir * w) + 'px,0,0)';

      setTimeout(function () {
        if (!shiftMonthBy(dir)) {
          springBack();
          return;
        }
        renderCalendar();
        updateTopbar();

        grid.style.transition = 'none';
        grid.style.transform = 'translate3d(' + (dir * w) + 'px,0,0)';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            grid.style.transition = 'transform .26s cubic-bezier(.22,.61,.36,1)';
            grid.style.transform = 'translate3d(0,0,0)';
            setTimeout(function () {
              grid.style.transition = '';
              grid.style.transform = '';
              animating = false;
            }, 280);
          });
        });
      }, 240);
    }

    grid.addEventListener('pointerdown', function (e) {
      if (animating) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId;
      active = true;
      mode = '';
      sx = e.clientX;
      sy = e.clientY;
      dx = 0;
      lastX = e.clientX;
      lastT = Date.now();
      vx = 0;
    });

    grid.addEventListener('pointermove', function (e) {
      if (!active || e.pointerId !== pid) return;
      const mx = e.clientX - sx;
      const my = e.clientY - sy;

      if (!mode) {
        // 纵向优先：只要纵向位移更明显就交还给页面滚动
        if (Math.abs(my) > 9 && Math.abs(my) >= Math.abs(mx)) {
          active = false;
          grid.style.transition = '';
          grid.style.transform = '';
          return;
        }
        if (Math.abs(mx) > MIN_MOVE && Math.abs(mx) > Math.abs(my) * 1.15) {
          mode = 'h';
          try { grid.setPointerCapture(pid); } catch (err) { /* 忽略 */ }
        } else {
          return;
        }
      }

      const now = Date.now();
      const dt = Math.max(1, now - lastT);
      vx = vx * 0.5 + ((e.clientX - lastX) / dt) * 0.5;
      lastX = e.clientX;
      lastT = now;

      dx = mx;
      const dir = dx < 0 ? 1 : -1;
      const out = atBound(dir) ? dx * 0.32 : dx;   // 到边界时带阻尼
      grid.style.transition = 'none';
      grid.style.transform = 'translate3d(' + out.toFixed(1) + 'px,0,0)';
      if (e.cancelable) e.preventDefault();
    });

    grid.addEventListener('pointerup', function (e) { release(e.pointerId); });
    grid.addEventListener('pointercancel', function (e) { release(e.pointerId); });
    grid.addEventListener('lostpointercapture', function (e) {
      if (active && e.pointerId === pid) release(e.pointerId);
    });
  }

  // ==================== 左滑删除 ====================

  const SWIPE_REVEAL = 76;
  const SWIPE_OPEN_AT = 56;
  const SWIPE_MAX = 96;

  function closeSwipe(wrap) {
    if (!wrap) return;
    const inner = wrap.querySelector('.swipe-inner');
    wrap.classList.remove('revealed', 'armed', 'swiping');
    if (inner) {
      inner.style.transition = '';
      inner.style.transform = '';
    }
  }

  function closeAllSwipes() {
    $$('.swipe.revealed').forEach(closeSwipe);
  }

  function revealSwipe(wrap, inner, container) {
    $$('.swipe.revealed', container).forEach(function (other) {
      if (other !== wrap) closeSwipe(other);
    });
    inner.style.transition = '';
    inner.style.transform = 'translateX(-' + SWIPE_REVEAL + 'px)';
    wrap.classList.remove('swiping', 'armed');
    wrap.classList.add('revealed');
    haptic(8);
  }

  function askDelete(id) {
    const item = state.items.find(function (i) { return i.id === id; });
    if (!item) return;
    closeAllSwipes();
    openModal({
      kind: 'item-del',
      title: '删除这条安排？',
      text: item.recurrence ? '会删除整个系列，包括之后所有日期。' : '',
      confirmText: '删除',
      danger: true,
      onConfirm: function () { deleteItemNow(id); }
    });
  }

  async function deleteItemNow(id) {
    const idx = state.items.findIndex(function (i) { return i.id === id; });
    if (idx === -1) return;
    state.items.splice(idx, 1);
    await persistItems();
    renderAll();
    scheduleReminders();
    showToast(T('已删除'), 1200);
  }

  function bindSwipe(container) {
    if (!container || container.dataset.swipeBound) return;
    container.dataset.swipeBound = '1';
    let sw = null;

    container.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.swipe-del')) return;
      const inner = e.target.closest ? e.target.closest('.swipe-inner') : null;
      if (!inner) return;
      if (e.target.closest('.check')) return;
      const wrap = inner.parentElement;
      if (wrap.classList.contains('swipe-locked')) return;
      const base = wrap.classList.contains('revealed') ? -SWIPE_REVEAL : 0;
      sw = {
        inner: inner, wrap: wrap, pointerId: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        dx: base, base: base, active: false, decided: false,
        id: wrap.dataset.id
      };
    });

    container.addEventListener('pointermove', function (e) {
      if (!sw || e.pointerId !== sw.pointerId) return;
      const dx = e.clientX - sw.startX;
      const dy = e.clientY - sw.startY;
      if (!sw.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        sw.decided = true;
        sw.active = Math.abs(dx) > Math.abs(dy) && (dx < 0 || sw.base !== 0);
        if (!sw.active) return;
        sw.inner.style.transition = 'none';
      }
      if (!sw.active) return;
      sw.dx = Math.max(-SWIPE_MAX, Math.min(0, sw.base + dx));
      sw.inner.style.transform = 'translateX(' + sw.dx + 'px)';
      sw.wrap.classList.toggle('swiping', sw.dx < -8);
      sw.wrap.classList.toggle('armed', sw.dx <= -SWIPE_OPEN_AT);
    });

    function finish(e) {
      if (!sw || (e && e.pointerId !== sw.pointerId)) return;
      const cur = sw;
      sw = null;
      if (!cur.active) return;
      cur.wrap.classList.remove('swiping', 'armed');
      state.swipeLock = Date.now() + 240;
      state.swipeClickLock = Date.now() + 320;
      if (cur.dx <= -SWIPE_OPEN_AT) {
        revealSwipe(cur.wrap, cur.inner, container);
      } else {
        closeSwipe(cur.wrap);
      }
    }

    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', finish);
  }

  function handleSwipeClick(e) {
    const del = e.target.closest('[data-swipe-del]');
    if (del) {
      askDelete(del.dataset.swipeDel);
      return true;
    }
    const wrap = e.target.closest('.swipe');
    if (wrap && wrap.classList.contains('revealed')) {
      if (Date.now() < state.swipeClickLock) return true;
      closeSwipe(wrap);
      return true;
    }
    return false;
  }

  function toggleStack(btn) {
    const key = btn.dataset.stackToggle;
    const wrap = document.querySelector('[data-stack="' + key + '"]');
    if (!wrap) return;
    const open = !wrap.classList.contains('open');
    if (!open) closeAllSwipes();
    wrap.classList.toggle('open', open);
    const layers = document.querySelector('[data-layers="' + key + '"]');
    if (layers) layers.hidden = open;
    const head = document.querySelector('[data-stack-head="' + key + '"]');
    if (head) head.classList.toggle('swipe-locked', !open);
    if (open) state.expandedGroups.add(key);
    else state.expandedGroups.delete(key);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      const hidden = wrap.querySelectorAll('.row').length;
      btn.textContent = T('收起');
      btn.setAttribute('data-hidden', String(hidden));
    } else {
      const hidden = wrap.querySelectorAll('.row').length;
      btn.textContent = T('展开 {n} 条', { n: hidden });
    }
  }

  function handleSharedListClick(e) {
    const stackBtn = e.target.closest('[data-stack-toggle]');
    if (stackBtn) {
      toggleStack(stackBtn);
      return true;
    }
    return false;
  }

  // ==================== 渲染：议程 ====================

  function itemRowHTML(item, opts, extra) {
    const options = opts || {};
    const t = todayKey();
    const overdue = options.overdue === true || (!item.recurrence && !item.done && item.date < t);
    const meta = TYPE_META[item.type];
    const cat = getCategory(item.categoryId);
    const railColor = cat ? cat.color : meta.color;
    const classes = [
      'row',
      overdue ? 'overdue' : '',
      item.done ? 'done' : '',
      item.priority === 'high' ? 'high' : ''
    ].filter(Boolean).join(' ');

    let timeLabel = item.time ? esc(item.time) : esc(T('全天'));
    let datePart = '';
    if (options.showDate) {
      datePart = '<span class="rt-date">' + esc(shortDate(item.date)) + '</span>';
    }

    let repLabel = '';
    if (item.recurrence) {
      repLabel = recurrenceLabel(item.recurrence, item.baseDate || item.date);
      if (item.recurrence.until) repLabel += T(' · 到 {d}', { d: shortDate(item.recurrence.until) });
    }

    const tags = [
      '<span class="tag tag-' + item.type + '"><i></i>' + esc(T(meta.label)) + '</span>',
      item.recurrence ? '<span class="tag tag-rep" title="' + esc(repeatFullText(item)) + '">↻ ' + esc(repLabel) + '</span>' : '',
      cat ? '<span class="tag tag-category" style="color:' + cat.color + ';background:' + hexToRgba(cat.color, 0.12) + '"><i></i>' + esc(cat.name) + '</span>' : '',
      item.note ? '<span class="note-mark" title="' + esc(T('有备注')) + '" aria-label="' + esc(T('有备注')) + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 12.6h2.3L13 5.1 10.9 3 3.4 10.4z"/><path d="M9.8 4.2 11.9 6.3"/></svg></span>' : '',
      overdue ? '<span class="tag tag-overdue">' + esc(T('已逾期')) + '</span>' : '',
      item.priority === 'high' ? '<span class="tag tag-high">' + esc(T('高优')) + '</span>' : ''
    ].join('');

    return '<article class="' + classes + (extra ? ' has-deck' : '') + '" data-id="' + item.id + '" data-date="' + item.date + '">' +
      '<div class="row-time' + (options.showDate ? ' with-date' : '') + '">' + datePart + timeLabel + '</div>' +
      '<div class="row-rail"><span class="rail-dot" style="--dot-color:' + railColor + '"></span></div>' +
      '<div class="card-deck">' +
        '<div class="row-card' + (item.priority === 'high' ? ' high' : '') + '">' +
          '<div class="row-main">' +
            '<div class="row-title">' + esc(item.title) + '</div>' +
            '<div class="row-meta">' + tags + '</div>' +
          '</div>' +
          (item.type === 'todo'
            ? '<button class="check' + (item.done ? ' checked' : '') + '" type="button" data-check="' + item.id +
                '" data-check-date="' + item.date +
                '" role="checkbox" aria-checked="' + (item.done ? 'true' : 'false') +
                '" aria-label="' + esc(item.done ? T('标记为未完成') : T('标记为完成')) + '">' +
                '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.4 7.5l3 2.9 6.2-6.5"/></svg>' +
              '</button>'
            : '') +
        '</div>' +
        (extra || '') +
      '</div>' +
    '</article>';
  }

  function dayGroupHTML(key, dayItems, options) {
    const opts = options || {};
    const t = todayKey();
    const isToday = key === t;
    const title = relativeDayLabel(key);
    const relative = key === t || key === addDays(t, 1) || key === addDays(t, -1);
    const sub = esc(weekdayOf(key)) + (relative ? ' · ' + esc(monthDay(key)) : '');

    const all = dayItems.slice();
    const undone = all.filter(function (i) { return !i.done && (i.date >= t || i.recurrence); }).sort(compareAgenda);
    const done = all.filter(function (i) { return i.done; }).sort(function (a, b) {
      return (b.doneAt || 0) - (a.doneAt || 0);
    });
    const doneCount = done.length;
    const total = all.length;
    const pct = total ? Math.round(doneCount / total * 100) : 0;

    let rows = '';
    const stackKey = 'g:' + key;
    const stackExpanded = state.expandedGroups.has(stackKey);
    const stacked = undone.length > STACK_LIMIT;
    if (stacked) {
      undone.slice(0, STACK_LIMIT).forEach(function (item, i) {
        rows += swipeRowHTML(item, undefined,
          i === 0 ? { key: stackKey, hidden: stackExpanded, locked: !stackExpanded } : null);
      });
      let extraRows = '';
      undone.slice(STACK_LIMIT).forEach(function (item) { extraRows += swipeRowHTML(item); });
      rows += '<div class="stack-extra' + (stackExpanded ? ' open' : '') + '" data-stack="' + stackKey + '">' +
        '<div class="stack-extra-inner">' + extraRows + '</div></div>';
    } else {
      undone.forEach(function (item) { rows += swipeRowHTML(item); });
    }

    if (!undone.length) {
      let text = T('新的一天，从计划开始');
      if (total > 0 && doneCount === total) {
        text = T('这一天的安排都完成了');
      } else if (total > 0 && !doneCount) {
        text = all.length === 1
          ? T('这一项还没完成，可在上方「逾期」里查看')
          : T('还有 {n} 项未完成，可在上方「逾期」里查看', { n: all.length });
      } else if (total > 0) {
        text = T('未完成的项目已归入上方「逾期」');
      }
      rows = '<div class="day-empty">' + esc(text) + '</div>';
    }

    let doneHTML = '';
    if (doneCount > 0) {
      const open = state.openDoneGroups.has(key);
      let doneRows = '';
      done.forEach(function (item) { doneRows += swipeRowHTML(item); });
      doneHTML =
        '<button class="done-toggle' + (open ? ' open' : '') + '" type="button" data-done-toggle="' + key + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' + esc(T('已完成 · {n}', { n: doneCount })) +
        '</button>' +
        '<div class="done-list" data-done-list="' + key + '"' + (open ? '' : ' hidden') + '>' + doneRows + '</div>';
    }

    const progress = opts.hideProgress ? '' :
      '<div class="day-progress"><span>' + doneCount + '/' + total + '</span>' +
      '<span class="mini-bar"><i data-pct="' + pct + '"></i></span></div>';

    const stackBtn = stacked
      ? '<button class="stack-toggle" type="button" data-stack-toggle="' + stackKey +
        '" aria-expanded="' + (stackExpanded ? 'true' : 'false') + '">' +
        (stackExpanded ? esc(T('收起')) : esc(T('展开 {n} 条', { n: undone.length - STACK_LIMIT }))) + '</button>'
      : '';

    return '<section class="day-group" id="day-' + key + '">' +
      '<div class="day-head">' +
        '<div class="day-head-main">' +
          '<div class="day-head-title"><h2>' + esc(title) + '</h2>' + stackBtn + '</div>' +
          '<div class="day-sub">' + sub + '</div>' +
        '</div>' +
        '<div class="day-head-side">' + progress + '</div>' +
      '</div>' +
      '<div class="timeline">' + rows + '</div>' +
      doneHTML +
    '</section>';
  }

  function renderAgendaFilterBar() {
    const bar = $('#agendaFilterBar');
    if (!state.categories.length) {
      bar.hidden = true;
      bar.innerHTML = '';
      state.agendaFilters = [];
      return;
    }

    // 分类被删掉后，筛选里残留的 id 一并清理
    const validIds = new Set(state.categories.map(function (c) { return c.id; }));
    state.agendaFilters = state.agendaFilters.filter(function (id) { return validIds.has(id); });

    const noneSelected = state.agendaFilters.length === 0;
    let html = '<button class="filter-chip' + (noneSelected ? ' active' : '') +
      '" type="button" data-filter="all">' + esc(T('全部')) + '</button>';

    state.categories.forEach(function (cat) {
      const active = state.agendaFilters.indexOf(cat.id) !== -1;
      html += '<button class="filter-chip' + (active ? ' active' : '') + '" type="button" data-filter="' + cat.id +
        '" aria-pressed="' + (active ? 'true' : 'false') +
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + '">' +
        '<i style="--chip-color:' + cat.color + '"></i>' + esc(cat.name) + '</button>';
    });

    bar.innerHTML = html;
    bar.hidden = false;
  }

  function renderAgenda() {
    const anchor = state.agendaAnchor;
    const t = todayKey();
    const tomorrow = addDays(t, 1);

    renderAgendaFilterBar();

    const isEmpty = state.items.length === 0;
    $('#agendaEmpty').hidden = !isEmpty;
    if (isEmpty) {
      $('#agendaList').innerHTML = '';
      return;
    }

    const filters = state.agendaFilters;
    const visibleItems = filters.length
      ? state.items.filter(function (item) { return filters.indexOf(item.categoryId) !== -1; })
      : state.items;

    if (!visibleItems.length) {
      $('#agendaList').innerHTML =
        '<div class="filter-empty">' +
          '<p class="filter-empty-title">' + esc(T('所选分类还没有条目')) + '</p>' +
          '<p class="filter-empty-sub">' + esc(T('换一个分类看看，或者给条目加上这些分类。')) + '</p>' +
          '<button class="empty-btn" type="button" data-filter="all">' + esc(T('查看全部')) + '</button>' +
        '</div>';
      return;
    }

    const byDate = {};
    const windowEnd = addDays(anchor, 13);
    expandOccurrences(visibleItems, anchor, windowEnd).forEach(function (item) {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });

    const overdue = visibleItems
      .filter(function (i) { return !i.recurrence && !i.done && i.date < t; })
      .sort(compareOverdue);

    let html = '';

    if (overdue.length) {
      let rows = '';
      overdue.forEach(function (item) { rows += swipeRowHTML(item, { overdue: true, showDate: true }); });
      html += '<section class="day-group overdue-group">' +
        '<div class="day-head">' +
          '<div class="day-head-main"><h2>' + esc(T('逾期 · {n}', { n: overdue.length })) + '</h2><div class="day-sub">' +
            esc(T('来自更早的日期，别忘了处理')) + '</div></div>' +
        '</div>' +
        '<div class="timeline">' + rows + '</div>' +
      '</section>';
    }

    for (let i = 0; i < 14; i++) {
      const key = addDays(anchor, i);
      const dayItems = byDate[key] || [];
      if (!dayItems.length && key !== anchor && key !== t && key !== tomorrow) continue;
      html += dayGroupHTML(key, dayItems);
    }

    $('#agendaList').innerHTML = html;

    requestAnimationFrame(function () {
      $$('.mini-bar i', $('#agendaList')).forEach(function (el) {
        if (el.dataset.pct !== undefined) el.style.width = el.dataset.pct + '%';
      });
    });
  }

  // ==================== 渲染：行程表（一周 × 时段） ====================

  function scheduleChipHTML(item, t) {
    const cat = getCategory(item.categoryId);
    const color = cat ? cat.color : TYPE_META[item.type].color;
    const overdue = item.type === 'todo' && !item.done && item.date < t;
    const cls = [
      'sch-chip',
      item.done ? 'done' : '',
      overdue ? 'overdue' : '',
      item.priority === 'high' ? 'high' : ''
    ].filter(Boolean).join(' ');
    const aria = item.title + ' · ' + (item.time || T('全天')) + (item.done ? ' · ' + T('已完成') : '');
    // 列很窄，只放色块 + 标题前两个字；完整标题留给点击后的详情
    const mark = Array.from(String(item.title).trim()).slice(0, 2).join('');
    return '<button class="' + cls + '" type="button" data-id="' + item.id +
      '" data-date="' + item.date + '" title="' + esc(aria) + '" aria-label="' + esc(aria) + '"' +
      ' style="--chip-color:' + color + ';--chip-soft:' + hexToRgba(color, 0.14) + '">' +
      '<span class="sch-mark">' + esc(mark) + '</span>' +
    '</button>';
  }

  function scheduleBand(hour) {
    if (hour < 6) return 'band-night';
    if (hour < 12) return 'band-morning';
    if (hour < 18) return 'band-afternoon';
    return 'band-evening';
  }

  function renderSchedule() {
    const t = todayKey();
    const start = state.scheduleAnchor || startOfWeek(t);
    state.scheduleAnchor = start;

    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));

    const byDate = {};
    const occurrences = expandOccurrences(state.items, days[0], days[6]);
    occurrences.forEach(function (item) {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });

    // cells[dayIndex][hour] 与 allDay[dayIndex] 分别存放定时条目与全天条目
    const cells = days.map(function () { return Array.from({ length: 24 }, function () { return []; }); });
    const allDay = days.map(function () { return []; });

    days.forEach(function (key, di) {
      (byDate[key] || []).forEach(function (item) {
        if (item.time) {
          const hour = Math.min(23, Math.max(0, parseInt(item.time.slice(0, 2), 10) || 0));
          cells[di][hour].push(item);
        } else {
          allDay[di].push(item);
        }
      });
      cells[di].forEach(function (list) { list.sort(compareAgenda); });
      allDay[di].sort(compareAgenda);
    });

    let html = '';

    // 表头：左上角空白 + 七天（今天用圆形标记）
    html += '<div class="sch-corner"></div>';
    days.forEach(function (key) {
      const d = keyToDate(key);
      const wday = d.getDay();
      const isToday = key === t;
      const cls = ['sch-day', isToday ? 'today' : '', (wday === 0 || wday === 6) ? 'weekend' : '']
        .filter(Boolean).join(' ');
      const dow = isEn() ? WEEK_EN[wday] : '周' + WEEK[wday];
      html += '<div class="' + cls + '" data-date="' + key + '">' +
        '<span class="sch-dow">' + esc(dow) + '</span>' +
        '<span class="sch-dnum">' + d.getDate() + '</span>' +
      '</div>';
    });

    // 全天行
    html += '<div class="sch-adlabel">' + esc(isEn() ? 'All' : '全') + '</div>';
    days.forEach(function (key, di) {
      const isToday = key === t;
      const list = allDay[di];
      const cls = ['sch-adcell', list.length ? '' : 'empty', isToday ? 'today-col' : ''].filter(Boolean).join(' ');
      let chips = '';
      list.forEach(function (item) { chips += scheduleChipHTML(item, t); });
      html += '<div class="' + cls + '">' + chips + '</div>';
    });

    // 24 个时段行：每 3 小时标一次刻度，行本身按早/中/晚深浅区分
    for (let h = 0; h < 24; h++) {
      const tick = (h % 3 === 0) ? String(h) : '';
      html += '<div class="sch-hourlabel">' + tick + '</div>';
      days.forEach(function (key, di) {
        const isToday = key === t;
        const list = cells[di][h];
        const cls = ['sch-cell', scheduleBand(h), list.length ? '' : 'empty', isToday ? 'today-col' : '']
          .filter(Boolean).join(' ');
        let chips = '';
        list.forEach(function (item) { chips += scheduleChipHTML(item, t); });
        html += '<div class="' + cls + '">' + chips + '</div>';
      });
    }

    $('#scheduleGrid').innerHTML = html;

    const total = occurrences.length;
    const done = occurrences.filter(function (i) { return i.done; }).length;
    $('#scheduleFoot').innerHTML =
      '<span>' + esc(total ? T('本周 {n} 项 · 已完成 {m} 项', { n: total, m: done }) : T('本周还没有安排')) + '</span>' +
      '<span>' + esc(T('点色块查看详情')) + '</span>';
  }

  // ==================== 渲染：计划 ====================

  function planColorOf(plan) {
    const cat = getCategory(plan.categoryId);
    return cat ? cat.color : 'var(--primary)';
  }

  function planSort(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const at = a.time || '99:99';
    const bt = b.time || '99:99';
    if (at !== bt) return at < bt ? -1 : 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  function planItemHTML(plan, showPeriod) {
    const cat = getCategory(plan.categoryId);
    const tags = [];
    if (showPeriod) {
      tags.push('<span class="tag tag-plan-period">' + esc(planPeriodLabel(plan.kind, plan.periodStart)) + '</span>');
    }
    if (cat) {
      tags.push('<span class="tag" style="color:' + cat.color + ';background:' + hexToRgba(cat.color, 0.12) + '">' +
        '<i></i>' + esc(cat.name) + '</span>');
    }
    if (plan.priority === 'high') tags.push('<span class="tag tag-high">' + esc(T('高优先级')) + '</span>');

    return '<article class="row plan-item' + (plan.done ? ' done' : '') + '" data-plan-row="' + plan.id + '">' +
      '<div class="row-time">' + (plan.time ? esc(plan.time) : esc(T('全天'))) + '</div>' +
      '<div class="row-rail"><span class="rail-dot" style="--dot-color:' + planColorOf(plan) + '"></span></div>' +
      '<div class="row-card' + (plan.priority === 'high' ? ' high' : '') + '">' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(plan.title) + '</div>' +
          '<div class="row-meta">' + tags.join('') + '</div>' +
        '</div>' +
        '<button class="check' + (plan.done ? ' checked' : '') + '" type="button" data-plan-check="' + plan.id +
          '" role="checkbox" aria-checked="' + (plan.done ? 'true' : 'false') +
          '" aria-label="' + esc(plan.done ? T('标记为未完成') : T('标记为完成')) + '">' +
          '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.4 7.5l3 2.9 6.2-6.5"/></svg>' +
        '</button>' +
      '</div>' +
    '</article>';
  }

  function planSwipeHTML(plan, showPeriod) {
    return '<div class="swipe plan-swipe" data-id="' + plan.id + '">' +
      '<button class="swipe-del" type="button" data-plan-del="' + plan.id + '" aria-label="删除这条计划">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5.3h5V7M6.9 7l.8 11.2h8.6L17.1 7"/><path d="M10 10.4v4.6M14 10.4v4.6"/></svg>' +
      '</button>' +
      '<div class="swipe-inner">' + planItemHTML(plan, showPeriod) + '</div>' +
    '</div>';
  }

  function planCardHTML(kind, t) {
    const start = planPeriodStart(kind, t);
    const ofKind = state.plans.filter(function (p) { return p.kind === kind; });
    const current = ofKind.filter(function (p) { return p.periodStart === start; }).sort(planSort);
    const others = ofKind.filter(function (p) { return p.periodStart !== start; })
      .sort(function (a, b) {
        if (a.periodStart !== b.periodStart) return a.periodStart < b.periodStart ? 1 : -1;
        return planSort(a, b);
      });
    const done = current.filter(function (p) { return p.done; }).length;
    const total = current.length;
    const pct = total ? Math.round(done / total * 100) : 0;

    let rows = '';
    if (total) {
      current.forEach(function (plan) { rows += planSwipeHTML(plan, false); });
    } else {
      rows = '<p class="plan-empty">' + esc(T(PLAN_SCOPE_EMPTY[kind])) + '</p>';
    }
    if (others.length) {
      rows += '<p class="plan-other-head">' + esc(T(PLAN_SCOPE_OTHER[kind], { n: others.length })) + '</p>';
      others.forEach(function (plan) { rows += planSwipeHTML(plan, true); });
    }

    return '<div class="plan-card" data-plan-card="' + kind + '">' +
      '<div class="plan-card-head">' +
        '<div class="plan-card-title">' +
          '<h2>' + esc(T(PLAN_KINDS[kind])) + '</h2>' +
          '<p class="plan-sub">' +
            esc([T(PLAN_SCOPE_WORD[kind])]
              .concat(kind === 'week' ? [planPeriodLabel(kind, start)] : [])
              .concat([total ? T('完成 {done}/{total}', { done: done, total: total }) : T('暂无计划')])
              .join(' · ')) + '</p>' +
        '</div>' +
        '<div class="plan-ring">' +
          '<svg viewBox="0 0 58 58" aria-hidden="true">' +
            '<circle class="ring-bg" cx="29" cy="29" r="24"></circle>' +
            '<circle class="ring-fill' + (pct === 100 && total ? ' full' : '') + '" data-plan-ring="' + kind +
              '" data-pct="' + pct + '" cx="29" cy="29" r="24" pathLength="100"></circle>' +
          '</svg>' +
          '<div class="ring-label"><b>' + (total ? pct + '%' : '—') + '</b><span>' + esc(total ? T('完成') : T('暂无')) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="plan-list">' + rows + '</div>' +
    '</div>';
  }

  function renderPlan() {
    const t = todayKey();
    let html = '<div class="plan-page-head">' +
      '<div><h1>' + esc(T('计划')) + '</h1><p>' + esc(T('周、月、年分开看，长线目标也有进度。')) + '</p></div>' +
      '<button class="plan-add-btn" id="planAdd" type="button">' + esc(T('＋ 添加计划')) + '</button>' +
    '</div>';

    ['week', 'month', 'year'].forEach(function (kind) {
      html += planCardHTML(kind, t);
    });
    $('#planContent').innerHTML = html;

    requestAnimationFrame(function () {
      $$('[data-plan-ring]', $('#planContent')).forEach(function (el) {
        el.style.strokeDashoffset = String(100 - Number(el.dataset.pct || 0));
      });
    });
  }

  // ==================== 分类：新建面板 / 设置页 ====================

  function swatchesHTML(activeColor, attr) {
    return PRESET_COLORS.map(function (color) {
      const active = String(activeColor || '').toLowerCase() === color.toLowerCase();
      return '<button class="swatch' + (active ? ' active' : '') + '" type="button" data-' + attr + '="' + color +
        '" style="--sw:' + color + '" aria-label="' + esc(T('颜色 {c}', { c: color })) + '"></button>';
    }).join('');
  }

  function renderCategoryChips() {
    const box = $('#categoryChips');
    if (!box) return;

    let html = '<button class="cat-chip' + (draft.categoryId ? '' : ' active') + '" type="button" data-cat-chip="none">' +
      '<i style="--cat-dot:var(--muted)"></i>未分类</button>';

    state.categories.forEach(function (cat) {
      const active = draft.categoryId === cat.id;
      html += '<button class="cat-chip' + (active ? ' active' : '') + '" type="button" data-cat-chip="' + cat.id +
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + '">' +
        '<i style="--cat-dot:' + cat.color + '"></i>' + esc(cat.name) + '</button>';
    });

    html += '<button class="cat-manage-chip" id="manageCategoryBtn" type="button">+ 管理分类</button>';
    box.innerHTML = html;
  }

  function renderCategoryList() {
    const list = $('#categoryList');
    if (!list) return;
    let html = '';
    state.categories.forEach(function (cat) {
      const count = countByCategory(cat.id);
      html += '<button class="cat-bubble" type="button" data-cat-bubble="' + cat.id + '">' +
        '<i style="background:' + cat.color + '"></i>' + esc(cat.name) +
        (count ? '<span class="cat-count">' + count + '</span>' : '') +
        '</button>';
    });
    if (state.categories.length < MAX_CATEGORIES) {
      html += '<button class="cat-bubble cat-bubble-add" type="button" data-cat-new>+ 新建分类</button>';
    }
    list.innerHTML = html;
  }

  function validateCategoryName(rawName, excludeId) {
    const name = String(rawName || '').trim();
    if (!name) return T('请先输入分类名称');
    if (name.length > MAX_CAT_NAME) return T('名称最多 {n} 个字', { n: MAX_CAT_NAME });
    const dup = state.categories.some(function (cat) {
      return cat.id !== excludeId && cat.name === name;
    });
    if (dup) return T('已经有同名分类了');
    return '';
  }

  async function createCategory(name, color) {
    if (state.categories.length >= MAX_CATEGORIES) {
      showToast(T('最多 {n} 个分类', { n: MAX_CATEGORIES }));
      return;
    }
    const maxOrder = state.categories.reduce(function (max, cat) {
      return cat.order > max ? cat.order : max;
    }, -1);
    state.categories.push({
      id: uid(),
      name: name,
      color: color,
      order: maxOrder + 1,
      createdAt: Date.now()
    });
    sortCategories();
    await persistCategories();
    renderAll();
    showToast(T('已新增分类：{name}', { name: name }));
  }

  async function updateCategory(id, name, color) {
    const cat = getCategory(id);
    if (!cat) return;
    cat.name = name;
    cat.color = color;
    await persistCategories();
    renderAll();
    showToast(T('分类已更新'));
  }

  async function deleteCategoryNow(id) {
    const cat = getCategory(id);
    if (!cat) return;

    state.categories = state.categories.filter(function (c) { return c.id !== id; });
    let itemsChanged = false;
    state.items.forEach(function (item) {
      if (item.categoryId === id) {
        item.categoryId = null;
        item.updatedAt = Date.now();
        itemsChanged = true;
      }
    });

    state.agendaFilters = state.agendaFilters.filter(function (fid) { return fid !== id; });
    if (state.editCategoryId === id) state.editCategoryId = '';
    if (draft.categoryId === id) draft.categoryId = null;

    await persistCategories();
    if (itemsChanged) await persistItems();
    renderAll();
    showToast(T('已删除分类，条目已归为未分类'));
  }

  // ---------- 通用弹窗 ----------
  let modalColor = PRESET_COLORS[0];
  const modalState = { kind: '', onConfirm: null };

  function renderModalSwatches() {
    const box = $('#modalSwatches');
    if (box) box.innerHTML = swatchesHTML(modalColor, 'modal-color');
  }

  function openModal(cfg) {
    modalState.kind = cfg.kind || '';
    modalState.onConfirm = cfg.onConfirm || null;
    $('#modalTitle').textContent = cfg.title || '';
    const text = $('#modalText');
    text.hidden = !cfg.text;
    text.textContent = cfg.text || '';
    $('#modalField').hidden = !cfg.field;
    $('#modalHint').textContent = '';
    $('#modalCancel').textContent = cfg.cancelText || T('取消');
    $('#modalCancel').hidden = !!cfg.hideCancel;
    const confirm = $('#modalConfirm');
    confirm.textContent = cfg.confirmText || T('确定');
    confirm.classList.toggle('danger-btn', !!cfg.danger);
    confirm.classList.toggle('primary-btn', !cfg.danger);

    if (cfg.field) {
      $('#modalInput').value = cfg.name || '';
      modalColor = isHexColor(cfg.color) ? cfg.color : PRESET_COLORS[0];
      $('#modalCustom').value = isHexColor(cfg.color) ? cfg.color : PRESET_COLORS[0];
      renderModalSwatches();
    }

    const card = $('#modalCard');
    const back = $('#modalBackdrop');
    back.hidden = false;
    card.hidden = false;
    requestAnimationFrame(function () {
      back.classList.add('open');
      card.classList.add('open');
    });
    if (cfg.field) setTimeout(function () { $('#modalInput').focus(); }, 240);
  }

  function closeModal() {
    const card = $('#modalCard');
    const back = $('#modalBackdrop');
    modalState.onConfirm = null;
    modalState.kind = '';
    card.classList.remove('open');
    back.classList.remove('open');
    setTimeout(function () {
      card.hidden = true;
      back.hidden = true;
    }, 180);
  }

  async function submitModal() {
    if (modalState.kind === 'cat-create' || modalState.kind === 'cat-edit') {
      const name = $('#modalInput').value;
      const excludeId = modalState.kind === 'cat-edit' ? state.editCategoryId : null;
      const err = validateCategoryName(name, excludeId);
      if (err) {
        $('#modalHint').textContent = err;
        return;
      }
      const kind = modalState.kind;
      const editId = state.editCategoryId;
      const color = modalColor;
      const trimmed = name.trim();
      closeModal();
      if (kind === 'cat-create') await createCategory(trimmed, color);
      else await updateCategory(editId, trimmed, color);
      return;
    }
    const fn = modalState.onConfirm;
    closeModal();
    if (fn) fn();
  }

  function openCategoryEditor(id) {
    const cat = id ? getCategory(id) : null;
    state.editCategoryId = cat ? cat.id : '';
    openModal({
      kind: cat ? 'cat-edit' : 'cat-create',
      title: cat ? '编辑分类' : '新建分类',
      field: true,
      name: cat ? cat.name : '',
      color: cat ? cat.color : PRESET_COLORS[0],
      confirmText: '保存'
    });
  }

  function openCategoryDelete(id) {
    const cat = getCategory(id);
    if (!cat) return;
    openModal({
      kind: 'cat-del',
      title: T('删除分类「{name}」？', { name: cat.name }),
      text: T('该分类下 {n} 条安排会变成未分类，不会被删除', { n: countByCategory(id) }),
      confirmText: T('删除'),
      danger: true,
      onConfirm: function () { deleteCategoryNow(id); }
    });
  }

  // ---------- 分类浮层 ----------
  let catPopId = '';

  function openCatPop(id) {
    const bubble = document.querySelector('[data-cat-bubble="' + id + '"]');
    const pop = $('#catPop');
    if (!bubble || !pop) return;
    catPopId = id;
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    const b = bubble.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let left = b.right - 10;
    if (left + w > window.innerWidth - 8) left = Math.min(b.right - w, window.innerWidth - w - 8);
    left = Math.max(8, left);
    let top = b.bottom + 6;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.visibility = '';
    haptic(12);
  }

  function closeCatPop() {
    const pop = $('#catPop');
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    catPopId = '';
  }

  // ==================== 总渲染 ====================

  function renderAll() {
    updateTopbar();
    renderSummary();
    if (state.view === 'calendar') renderCalendar();
    if (state.view === 'agenda') renderAgenda();
    if (state.view === 'plan') renderPlan();
    if (state.view === 'schedule') renderSchedule();
    renderSettings();
  }

  function setView(view) {
    state.view = view;
    $$('.tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    $('#viewCalendar').hidden = view !== 'calendar';
    $('#viewAgenda').hidden = view !== 'agenda';
    $('#viewPlan').hidden = view !== 'plan';
    $('#viewSchedule').hidden = view !== 'schedule';
    $('#content').scrollTop = 0;
    renderAll();
  }

  // ==================== 存储提示 / 主题 ====================

  function updateStorageBanner() {
    $('#storageBanner').hidden = storage.status !== 'memory';
  }

  function preferredTheme() {
    if (state.meta.theme === 'dark' || state.meta.theme === 'light') return state.meta.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const dark = preferredTheme() === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0F1117' : '#4C6FFF');
  }

  // ==================== Toast / Snackbar ====================

  function showToast(message, duration) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.hidden = true; }, 220);
    }, duration || 2300);
  }

  function showSnackbar(item, key) {
    const bar = $('#snackbar');
    $('#snackbarText').textContent = T('已完成 · {title}', { title: shorten(item.title, 18) });
    $('#fab').classList.add('fab-hide');
    bar.hidden = false;
    bar.classList.remove('show');
    void bar.offsetWidth;
    bar.classList.add('show');

    const meter = $('.snackbar-timer', bar);
    meter.style.animation = 'none';
    void meter.offsetWidth;
    meter.style.animation = 'timerbar 5s linear forwards';

    clearTimeout(state.snackbarTimer);
    state.snackbarTimer = setTimeout(hideSnackbar, 5000);

    const occDate = key || item.date;

    state.undoFn = async function () {
      clearTimeout(state.snackbarTimer);
      hideSnackbar();
      const target = state.items.find(function (i) { return i.id === item.id; });
      if (!target) return;
      if (target.recurrence) {
        delete target.completions[occDate];
      } else {
        target.done = false;
        target.doneAt = null;
      }
      target.updatedAt = Date.now();
      await persistItems();
      renderAll();
      scheduleReminders();
      showToast(T('已撤销完成'));
    };
  }

  function hideSnackbar() {
    const bar = $('#snackbar');
    bar.classList.remove('show');
    $('#fab').classList.remove('fab-hide');
    state.undoFn = null;
    setTimeout(function () {
      if (!bar.classList.contains('show')) bar.hidden = true;
    }, 220);
  }

  // ==================== 勾选完成（带动画） ====================

  function animateComplete(row, done) {
    const height = row.getBoundingClientRect().height;
    row.style.height = height + 'px';
    row.classList.add('completing');
    setTimeout(function () {
      row.classList.add('leaving');
      row.style.height = '0px';
      row.style.marginBottom = '0px';
    }, 160);
    setTimeout(done, 160 + 260);
  }

  async function toggleDone(item, button, key) {
    const occDate = key || item.date;
    const busyKey = item.id + '@' + occDate;
    if (state.busyChecks.has(busyKey)) return;
    state.busyChecks.add(busyKey);

    const target = state.items.find(function (i) { return i.id === item.id; }) || item;
    const recurring = !!target.recurrence;
    const prevDone = recurring ? !!target.completions[occDate] : target.done;
    const prevDoneAt = recurring ? target.completions[occDate] : target.doneAt;
    const next = !prevDone;

    if (recurring) {
      if (next) target.completions[occDate] = Date.now();
      else delete target.completions[occDate];
    } else {
      target.done = next;
      target.doneAt = next ? Date.now() : null;
    }
    target.updatedAt = Date.now();

    const ok = await persistItems();
    if (!ok) {
      if (recurring) {
        if (prevDoneAt) target.completions[occDate] = prevDoneAt;
        else delete target.completions[occDate];
      } else {
        target.done = prevDone;
        target.doneAt = prevDoneAt;
      }
      state.busyChecks.delete(busyKey);
      renderAll();
      return;
    }

    scheduleReminders();

    const row = button ? button.closest('.row') : null;
    const inDoneList = row && row.parentElement && row.parentElement.classList.contains('done-list');

    if (next && row && !inDoneList) {
      animateComplete(row, function () {
        state.busyChecks.delete(busyKey);
        renderAll();
        showSnackbar(target, occDate);
      });
      return;
    }

    state.busyChecks.delete(busyKey);
    renderAll();
    if (next) showSnackbar(target, occDate);
  }

  // ==================== 新建面板 ====================

  const draft = {
    type: 'event',
    date: '',
    time: '09:00',
    categoryId: null,
    recurrence: null,
    note: '',
    address: null,
    remindBefore: null,
    priority: false
  };

  const repDraft = {
    type: 'none',
    interval: 1,
    byWeekday: [],
    byMonthDay: 1,
    byMonth: 1,
    lunarMonth: 1,
    lunarDay: 1,
    time: '',
    startYear: null,
    startYearOn: false,
    until: null,
    open: false
  };

  function syncRepeatChip() {
    const el = $('#repeatChip');
    if (!el) return;
    const rec = draft.recurrence;
    if (rec) {
      el.textContent = recurrenceLabel(rec, draft.date || todayKey());
      el.classList.add('active');
    } else {
      el.textContent = T('重复');
      el.classList.remove('active');
    }
  }

  function syncPriorityChip() {
    const el = $('#priorityChip');
    const box = $('#priorityInput');
    if (box) box.checked = draft.priority;
    if (!el) return;
    el.textContent = draft.priority ? T('高优先级') : T('优先级');
    el.classList.toggle('active', draft.priority);
    el.classList.toggle('high', draft.priority);
  }

  function syncDateChip() {
    if (dateSheet.target === 'plan') {
      const planChip = $('#planDateChip');
      if (!planChip) return;
      const planKey = planDraft.date || todayKey();
      planChip.textContent = planDraft.time ? relativeDayLabel(planKey) + ' ' + planDraft.time : relativeDayLabel(planKey);
      planChip.classList.add('active');
      return;
    }
    const el = $('#dateChip');
    if (!el) return;
    const key = draft.date || todayKey();
    const label = relativeDayLabel(key);
    el.textContent = draft.time ? label + ' ' + draft.time : label + ' · ' + T('全天');
    el.classList.add('active');
  }

  function syncRemindChip() {
    const el = $('#remindChip');
    if (!el) return;
    if (typeof draft.remindBefore === 'number') {
      el.textContent = T('提前 {n} 分钟', { n: draft.remindBefore });
      el.classList.add('active');
    } else {
      el.textContent = T('提醒');
      el.classList.remove('active');
    }
  }

  function renderRepTypeChips() {
    $$('.rep-type-chip', $('#repTypeChips')).forEach(function (chip) {
      if (chip.dataset.repType === 'lunarMonthly' || chip.dataset.repType === 'lunarYearly') {
        chip.hidden = isEn();
      }
      const active = chip.dataset.repType === repDraft.type;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function stepRowHTML(target, value, unit, min, max) {
    return '<div class="rep-step">' +
      '<span class="rep-step-label">每</span>' +
      '<button class="step-btn" type="button" data-step-target="' + target + '" data-step="-1"' + (value <= min ? ' disabled' : '') + '>−</button>' +
      '<b class="rep-num">' + value + '</b>' +
      '<button class="step-btn" type="button" data-step-target="' + target + '" data-step="1"' + (value >= max ? ' disabled' : '') + '>+</button>' +
      '<span class="rep-step-label">' + unit + '</span>' +
    '</div>';
  }

  function lunarStepHTML(target, value, names, min, max) {
    const label = isEn()
      ? T(target === 'lunarDay' ? '农历日 {n}' : '农历月 {n}', { n: value })
      : names[value - 1];
    return '<div class="rep-step">' +
      '<button class="step-btn" type="button" data-step-target="' + target + '" data-step="-1"' + (value <= min ? ' disabled' : '') + '>−</button>' +
      '<b class="rep-num rep-num-wide">' + label + '</b>' +
      '<button class="step-btn" type="button" data-step-target="' + target + '" data-step="1"' + (value >= max ? ' disabled' : '') + '>+</button>' +
    '</div>';
  }

  function lunarMonthNames() {
    return LUNAR_MONTH_NAMES.map(function (n) { return n + '月'; });
  }

  function renderRepBody() {
    const body = $('#repBody');
    if (!body) return;
    const start = draft.date || todayKey();
    const startDate = keyToDate(start);
    let html = '';

    if (repDraft.type === 'none') {
      html = '<p class="rep-hint">这条只出现一次，不会重复。</p>';
    } else if (repDraft.type === 'daily') {
      html = stepRowHTML('interval', repDraft.interval, '天重复', 1, 30) +
        '<p class="rep-hint">选 2 就是隔一天出现一次。</p>';
    } else if (repDraft.type === 'weekly') {
      let chips = '';
      const weekNames = isEn() ? WEEK_EN : WEEK;
      weekNames.forEach(function (name, index) {
        const active = repDraft.byWeekday.indexOf(index) !== -1;
        chips += '<button class="rep-weekday' + (active ? ' active' : '') + '" type="button" data-weekday="' + index +
          '" aria-pressed="' + (active ? 'true' : 'false') + '">' + name + '</button>';
      });
      html = stepRowHTML('interval', repDraft.interval, '周', 1, 30) +
        '<div class="rep-weekdays" id="repWeekdays">' + chips + '</div>' +
        '<p class="rep-hint">可以选多天；选 2 周就是两周一次。至少保留一天。</p>';
    } else if (repDraft.type === 'monthly') {
      html = stepRowHTML('day', repDraft.byMonthDay, '日', 1, 31) +
        '<div class="rep-time"><span>时间</span><input type="time" id="repTimeInput" value="' + (repDraft.time || '') + '" aria-label="' + esc(T('重复时间')) + '"></div>' +
        '<p class="rep-hint">遇到没有这一天的月份（如 2 月 30 日）会自动跳过；时间留空就是全天。</p>';
    } else if (repDraft.type === 'lunarMonthly') {
      html = lunarStepHTML('lunarDay', repDraft.lunarDay, LUNAR_DAY_NAMES, 1, 30) +
        '<div class="rep-time"><span>时间</span><input type="time" id="repTimeInput" value="' + (repDraft.time || '') + '" aria-label="' + esc(T('重复时间')) + '"></div>' +
        '<p class="rep-hint">按农历计算，例如「每月 农历初五」。农历三十在只有 29 天的小月不出现。</p>';
    } else if (repDraft.type === 'lunarYearly') {
      html = lunarStepHTML('lunarMonth', repDraft.lunarMonth, lunarMonthNames(), 1, 12) +
        lunarStepHTML('lunarDay', repDraft.lunarDay, LUNAR_DAY_NAMES, 1, 30) +
        '<div class="rep-time"><span>时间</span><input type="time" id="repTimeInput" value="' + (repDraft.time || '') + '" aria-label="' + esc(T('重复时间')) + '"></div>' +
        '<p class="rep-hint">按农历计算，例如生日「每年 农历三月十四」。闰月不单独处理，只匹配非闰月。</p>';
    } else {
      html = stepRowHTML('month', repDraft.byMonth, '月', 1, 12) +
        stepRowHTML('day', repDraft.byMonthDay, '日', 1, 31) +
        '<div class="rep-time"><span>时间</span><input type="time" id="repTimeInput" value="' + (repDraft.time || '') + '" aria-label="' + esc(T('重复时间')) + '"></div>' +
        '<label class="switch-row rep-start-year">' +
          '<span class="switch-label"><span>记录起始年份（可选）</span>' +
          '<span class="switch-sub">只作展示，不影响重复</span></span>' +
          '<input type="checkbox" id="repStartYearToggle"' + (repDraft.startYearOn ? ' checked' : '') + '>' +
          '<span class="toggle" aria-hidden="true"></span>' +
        '</label>' +
        '<div id="repStartYearWrap"' + (repDraft.startYearOn ? '' : ' hidden') + '>' +
          '<input class="rep-year-input" id="repStartYearInput" type="number" min="1900" max="2100" inputmode="numeric" ' +
          'value="' + (repDraft.startYear || '') + '" placeholder="' + esc(T('例如 1990')) + '" aria-label="' + esc(T('起始年份')) + '">' +
        '</div>' +
        '<p class="rep-hint">例如生日：3 月 14 日 09:30，起始年 1990。2 月 29 日在平年会跳过。</p>';
    }

    body.innerHTML = html;
  }

  function syncRepUntil() {
    const hasDate = !!repDraft.until;
    $$('.date-chip', $('#repUntilChips')).forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.until === (hasDate ? 'date' : 'forever'));
    });
    const input = $('#repUntilInput');
    input.hidden = !hasDate;
    input.value = repDraft.until || '';
  }

  function openRepSheet() {
    const rec = draft.recurrence;
    const start = keyToDate(draft.date || todayKey());
    repDraft.type = rec ? rec.type : 'none';
    repDraft.interval = rec ? (rec.interval || 1) : 1;
    repDraft.byWeekday = rec && rec.byWeekday && rec.byWeekday.length
      ? rec.byWeekday.slice()
      : [start.getDay()];
    repDraft.byMonthDay = rec && rec.byMonthDay ? rec.byMonthDay : start.getDate();
    repDraft.byMonth = rec && rec.byMonth ? rec.byMonth : start.getMonth() + 1;
    const lp = lunarPartsOfKey(draft.date || todayKey());
    repDraft.lunarMonth = rec && rec.lunarMonth ? rec.lunarMonth : lp.month;
    repDraft.lunarDay = rec && rec.lunarDay ? rec.lunarDay : lp.day;
    repDraft.time = rec && rec.time ? rec.time : (draft.time || '');
    repDraft.startYearOn = !!(rec && rec.startYear);
    repDraft.startYear = rec && rec.startYear ? rec.startYear : null;
    repDraft.until = rec && rec.until ? rec.until : null;

    renderRepTypeChips();
    renderRepBody();
    syncRepUntil();

    clearTimeout(sheetCloseTimer);
    $('#repBackdrop').hidden = false;
    $('#repSheet').hidden = false;
    requestAnimationFrame(function () {
      $('#repSheet').classList.add('open');
      $('#repBackdrop').classList.add('open');
    });
    repDraft.open = true;
    $('#repSheet').scrollTop = 0;
  }

  function closeRepSheet() {
    if (!repDraft.open) return;
    repDraft.open = false;
    $('#repSheet').classList.remove('open');
    $('#repBackdrop').classList.remove('open');
    setTimeout(function () {
      if (!repDraft.open) {
        $('#repSheet').hidden = true;
        $('#repBackdrop').hidden = true;
      }
    }, 300);
  }

  function commitRepSheet() {
    if (repDraft.type === 'none') {
      draft.recurrence = null;
    } else {
      const lunarType = repDraft.type === 'lunarMonthly' || repDraft.type === 'lunarYearly';
      const plainTimeType = repDraft.type === 'monthly' || repDraft.type === 'yearly';
      const rec = normalizeRecurrence({
        type: repDraft.type,
        interval: repDraft.interval,
        byWeekday: repDraft.type === 'weekly' ? repDraft.byWeekday : undefined,
        byMonthDay: repDraft.type === 'monthly' || repDraft.type === 'yearly' ? repDraft.byMonthDay : undefined,
        byMonth: repDraft.type === 'yearly' ? repDraft.byMonth : undefined,
        lunarMonth: repDraft.type === 'lunarYearly' ? repDraft.lunarMonth : undefined,
        lunarDay: lunarType ? repDraft.lunarDay : undefined,
        time: plainTimeType || lunarType ? repDraft.time : undefined,
        startYear: repDraft.type === 'yearly' && repDraft.startYearOn ? repDraft.startYear : undefined,
        until: repDraft.until
      });
      if (rec && rec.until && rec.until < (draft.date || todayKey())) {
        rec.until = null;
        showToast(T('结束日期早于开始日期，已改为一直重复'));
      }
      draft.recurrence = rec;
    }
    syncRepeatChip();
    closeRepSheet();
  }

  const detail = {
    open: false,
    kind: 'item',
    itemId: '',
    date: ''
  };

  const yearPicker = {
    open: false,
    year: 0,
    month: 0,
    day: 1
  };

  function updateDetailNoteCount() {
    const value = $('#detailNote').value;
    $('#detailNoteCount').textContent = value.length + ' / 500';
  }

  function detailRowsHTML(rows, address) {
    let html = rows.map(function (pair) {
      return '<div class="detail-row"><span class="detail-label">' + pair[0] +
        '</span><span class="detail-value">' + esc(pair[1]) + '</span></div>';
    }).join('');
    if (address && address.label) {
      html += '<div class="detail-row detail-addr">' +
        '<span class="detail-label">' + esc(T('地址')) + '</span>' +
        '<span class="detail-addr-right">' +
          '<span class="detail-value">' + esc(address.label) + '</span>' +
          '<button class="detail-map-link" id="detailMapBtn" type="button">' + esc(T('打开地图')) + '</button>' +
        '</span></div>';
    }
    return html;
  }

  function showDetailSheet(rowsHTML, note) {
    $('#detailTitle').textContent = detail.kind === 'plan' ? T('计划详情') : T('条目详情');
    $('#detailBody').innerHTML = rowsHTML;
    $('#detailNote').value = note || '';
    updateDetailNoteCount();

    detail.open = true;
    $('#detailBackdrop').hidden = false;
    $('#detailSheet').hidden = false;
    $('#detailSheet').scrollTop = 0;
    requestAnimationFrame(function () {
      $('#detailSheet').classList.add('open');
      $('#detailBackdrop').classList.add('open');
    });
  }

  function openDetail(id, date) {
    const base = state.items.find(function (i) { return i.id === id; });
    if (!base) return;
    detail.kind = 'item';
    detail.itemId = id;
    detail.date = date || base.date;

    const inst = base.recurrence ? makeInstance(base, detail.date) : base;
    const cat = getCategory(base.categoryId);
    const rows = [
      ['标题', inst.title],
      ['类型', T(TYPE_META[inst.type].label)],
      ['日期', monthDay(inst.date) + ' · ' + weekdayOf(inst.date)],
      ['时间', inst.time || T('全天')],
      ['重复', repeatDetailText(inst)],
      ['分类', cat ? cat.name : T('未分类')],
      ['提醒', inst.remindBefore ? T('提前 {n} 分钟', { n: inst.remindBefore }) : T('不提醒')]
    ];

    showDetailSheet(detailRowsHTML(rows, base.address), base.note);
  }

  function openPlanDetail(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    detail.kind = 'plan';
    detail.itemId = id;
    detail.date = '';
    const cat = getCategory(plan.categoryId);
    const rows = [
      ['标题', plan.title],
      ['类型', T(PLAN_KINDS[plan.kind])],
      ['周期', planPeriodLabel(plan.kind, plan.periodStart)],
      ['时间', plan.time || T('全天')],
      ['分类', cat ? cat.name : T('未分类')],
      ['提醒', plan.remindBefore ? T('提前 {n} 分钟', { n: plan.remindBefore }) : T('不提醒')],
      ['优先级', plan.priority === 'high' ? T('高优先级') : T('普通')]
    ];

    showDetailSheet(detailRowsHTML(rows, plan.address), plan.note);
  }

  function closeDetail() {
    if (!detail.open) return;
    detail.open = false;
    $('#detailSheet').classList.remove('open');
    $('#detailBackdrop').classList.remove('open');
    setTimeout(function () {
      if (!detail.open) {
        $('#detailSheet').hidden = true;
        $('#detailBackdrop').hidden = true;
      }
    }, 300);
  }

  async function saveDetailNote() {
    const list = detail.kind === 'plan' ? state.plans : state.items;
    const target = list.find(function (i) { return i.id === detail.itemId; });
    if (!target) return;
    target.note = $('#detailNote').value.slice(0, 500);
    target.updatedAt = Date.now();
    const ok = detail.kind === 'plan' ? await persistPlans() : await persistItems();
    if (!ok) {
      showToast(T('保存失败，请再试一次'));
      return;
    }
    if (detail.kind === 'plan') renderPlan();
    else renderAll();
    closeDetail();
    showToast(T('备注已保存'));
  }

  function jumpBaseDate() {
    if (state.view === 'agenda' && state.agendaAnchor) return keyToDate(state.agendaAnchor);
    if (state.selectedDate) return keyToDate(state.selectedDate);
    return state.month;
  }

  function haptic(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms || 10);
    } catch (err) {}
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  const WHEEL_H = 40;
  const wheelState = { year: null, month: null, day: null };

  function wheelEl(kind) {
    return $('#wheel' + kind.charAt(0).toUpperCase() + kind.slice(1));
  }

  function wheelValues(kind) {
    const out = [];
    let i;
    if (kind === 'year') {
      for (i = 1900; i <= 2100; i++) out.push(i);
      return out;
    }
    if (kind === 'month') {
      for (i = 1; i <= 12; i++) out.push(i);
      return out;
    }
    const count = daysInMonth(yearPicker.year, yearPicker.month);
    for (i = 1; i <= count; i++) out.push(i);
    return out;
  }

  function fillWheel(kind, values, index) {
    const el = wheelEl(kind);
    if (!el) return;
    el.innerHTML = values.map(function (v, i) {
      return '<div class="wheel-item' + (i === index ? ' active' : '') + '" data-idx="' + i + '">' + v + '</div>';
    }).join('');
    wheelState[kind] = { values: values, index: index };
    el.scrollTop = index * WHEEL_H;
  }

  function wheelIndex(el, values) {
    const idx = Math.round(el.scrollTop / WHEEL_H);
    return Math.max(0, Math.min(values.length - 1, idx));
  }

  function markWheel(kind) {
    const el = wheelEl(kind);
    const st = wheelState[kind];
    if (!el || !st) return 0;
    const idx = wheelIndex(el, st.values);
    st.index = idx;
    $$('.wheel-item', el).forEach(function (item, i) {
      item.classList.toggle('active', i === idx);
    });
    return idx;
  }

  function onWheelSettle(kind) {
    const el = wheelEl(kind);
    const st = wheelState[kind];
    if (!el || !st) return;
    const idx = markWheel(kind);
    const value = st.values[idx];
    if (value === yearPicker[kind]) return;

    yearPicker[kind] = value;
    if (kind === 'year' || kind === 'month') {
      const maxDay = daysInMonth(yearPicker.year, yearPicker.month);
      if (yearPicker.day > maxDay) yearPicker.day = maxDay;
      fillWheel('day', wheelValues('day'), yearPicker.day - 1);
    }
    haptic(10);
  }

  function bindWheel(kind) {
    const el = wheelEl(kind);
    if (!el) return;
    let settleTimer = null;
    let raf = 0;
    let drag = null;
    let lastMoved = 0;

    function animateTo(target) {
      cancelAnimationFrame(raf);
      const from = el.scrollTop;
      const dist = target - from;
      if (Math.abs(dist) < 1) {
        el.scrollTop = target;
        markWheel(kind);
        onWheelSettle(kind);
        return;
      }
      const start = performance.now();
      const dur = 180;
      function frame(now) {
        const p = Math.min(1, (now - start) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        el.scrollTop = from + dist * ease;
        if (p < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          markWheel(kind);
          onWheelSettle(kind);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function snapBack() {
      const st = wheelState[kind];
      if (!st) return;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const idx = wheelIndex(el, st.values);
      animateTo(Math.max(0, Math.min(maxTop, idx * WHEEL_H)));
    }

    el.addEventListener('scroll', function () {
      if (drag) return;
      markWheel(kind);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(snapBack, 140);
    }, { passive: true });

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      drag = {
        id: e.pointerId,
        startY: e.clientY,
        top: el.scrollTop,
        lastY: e.clientY,
        lastT: performance.now(),
        v: 0,
        moved: false
      };
      el.classList.add('dragging');
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });

    el.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dy) > 3) drag.moved = true;
      el.scrollTop = drag.top - dy;
      markWheel(kind);
      const now = performance.now();
      const dt = now - drag.lastT;
      if (dt > 4) {
        const v = ((e.clientY - drag.lastY) / dt) * 16;
        drag.v = Math.max(-40, Math.min(40, v));
        drag.lastY = e.clientY;
        drag.lastT = now;
      }
      if (drag.moved && e.cancelable) e.preventDefault();
    }, { passive: false });

    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag;
      drag = null;
      el.classList.remove('dragging');
      if (d.moved) lastMoved = Date.now();
      let v = d.v;
      if (Math.abs(v) < 0.4) {
        snapBack();
        return;
      }
      function glide() {
        v *= 0.9;
        el.scrollTop -= v;
        markWheel(kind);
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        if (Math.abs(v) < 0.5 || el.scrollTop <= 0 || el.scrollTop >= maxTop) {
          snapBack();
          return;
        }
        raf = requestAnimationFrame(glide);
      }
      raf = requestAnimationFrame(glide);
    }

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('click', function (e) {
      if (Date.now() - lastMoved < 260) return;
      const item = e.target.closest('.wheel-item');
      if (!item) return;
      const idx = Number(item.dataset.idx);
      if (!isFinite(idx)) return;
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      animateTo(Math.max(0, Math.min(maxTop, idx * WHEEL_H)));
    });
  }

  function syncJumpPanel() {
    fillWheel('year', wheelValues('year'), yearPicker.year - 1900);
    fillWheel('month', wheelValues('month'), yearPicker.month - 1);
    fillWheel('day', wheelValues('day'), yearPicker.day - 1);
  }

  function openYearPicker() {
    const base = jumpBaseDate();
    yearPicker.year = base.getFullYear();
    yearPicker.month = base.getMonth() + 1;
    yearPicker.day = base.getDate();
    yearPicker.open = true;
    $('#yearBackdrop').hidden = false;
    $('#yearSheet').hidden = false;
    syncJumpPanel();
    requestAnimationFrame(function () {
      $('#yearSheet').classList.add('open');
      $('#yearBackdrop').classList.add('open');
      syncJumpPanel();
    });
  }

  function closeYearPicker() {
    if (!yearPicker.open) return;
    yearPicker.open = false;
    $('#yearSheet').classList.remove('open');
    $('#yearBackdrop').classList.remove('open');
    setTimeout(function () {
      if (!yearPicker.open) {
        $('#yearSheet').hidden = true;
        $('#yearBackdrop').hidden = true;
      }
    }, 300);
  }

  function applyJump(year, month, day) {
    const key = year + '-' + pad2(month) + '-' + pad2(Math.min(day, daysInMonth(year, month)));
    if (state.view === 'agenda') {
      state.agendaAnchor = key;
    } else {
      state.month = new Date(year, month - 1, 1);
      state.selectedDate = key;
    }
  }

  function jumpToDate() {
    applyJump(yearPicker.year, yearPicker.month, yearPicker.day);
    closeYearPicker();
    renderAll();
  }

  // ---------- 日期 + 时间面板 ----------

  const dateSheet = {
    open: false,
    year: 0,
    month: 0,
    lastTime: '09:00',
    syncing: false,
    target: 'item'   // 'item' 条目 / 'plan' 计划
  };

  let dateCloseTimer = null;
  const DP_ITEM_H = 40;

  // 日期面板既服务条目，也服务计划；对外只暴露当前正在编辑的对象
  function activeDateDraft() {
    return dateSheet.target === 'plan' ? planDraft : draft;
  }

  function renderDatePanel() {
    const label = $('#dpLabel');
    if (label) {
      label.textContent = isEn()
        ? MONTH_EN[dateSheet.month] + ' ' + dateSheet.year
        : dateSheet.year + ' 年 ' + (dateSheet.month + 1) + ' 月';
    }
    const grid = $('#dpGrid');
    if (!grid) return;
    const t = todayKey();
    const selected = draft.date || t;
    let html = '';
    buildMonthGrid(dateSheet.year, dateSheet.month).forEach(function (key) {
      const d = keyToDate(key);
      const cls = ['dp-cell'];
      if (d.getMonth() !== dateSheet.month) cls.push('other');
      if (key === t) cls.push('today');
      if (key === selected) cls.push('selected');
      html += '<button class="' + cls.join(' ') + '" type="button" data-dp-key="' + key + '">' +
        d.getDate() + '</button>';
    });
    grid.innerHTML = html;
  }

  function buildDpWheel(id, count) {
    const el = $(id);
    if (!el) return;
    let html = '<div class="wheel-spacer"></div>';
    for (let i = 0; i < count; i++) {
      html += '<div class="wheel-item" data-idx="' + i + '">' + pad2(i) + '</div>';
    }
    html += '<div class="wheel-spacer"></div>';
    el.innerHTML = html;
    el.scrollTop = 0;
  }

  function dpWheelIndex(el) {
    if (!el) return 0;
    const max = Math.max(0, el.children.length - 2);
    return Math.max(0, Math.min(max, Math.round(el.scrollTop / DP_ITEM_H)));
  }

  function markDpWheel(el) {
    if (!el) return;
    const idx = dpWheelIndex(el);
    $$('.wheel-item', el).forEach(function (item, i) {
      item.classList.toggle('active', i === idx);
    });
  }

  function setDpWheel(el, index) {
    if (!el) return;
    el.scrollTop = index * DP_ITEM_H;
    markDpWheel(el);
  }

  function parseDpTime(value) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    return { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) };
  }

  function syncDpNoTime() {
    const off = !activeDateDraft().time;
    const wheels = $('#dpWheels');
    const btn = $('#dpNoTime');
    if (wheels) wheels.classList.toggle('off', off);
    if (btn) btn.textContent = off ? T('设置时间') : T('不设时间');
    if (off) $$('.wheel-item').forEach(function (item) { item.classList.remove('active'); });
  }

  function applyDpWheelTime() {
    if (dateSheet.syncing) return;
    const hourEl = $('#wheelHour');
    const minuteEl = $('#wheelMinute');
    if (!hourEl || !minuteEl) return;
    activeDateDraft().time = pad2(dpWheelIndex(hourEl)) + ':' + pad2(dpWheelIndex(minuteEl));
    markDpWheel(hourEl);
    markDpWheel(minuteEl);
    syncDpNoTime();
    syncDateChip();
  }

  function openDateSheet(target) {
    dateSheet.target = target === 'plan' ? 'plan' : 'item';
    const subject = activeDateDraft();
    const key = subject.date || todayKey();
    const d = keyToDate(key);
    dateSheet.year = d.getFullYear();
    dateSheet.month = d.getMonth();
    renderDatePanel();

    buildDpWheel('#wheelHour', 24);
    buildDpWheel('#wheelMinute', 60);
    const parsed = parseDpTime(subject.time) || parseDpTime(dateSheet.lastTime) || { h: 9, m: 0 };
    if (subject.time) dateSheet.lastTime = subject.time;

    clearTimeout(dateCloseTimer);
    $('#dateBackdrop').hidden = false;
    $('#dateSheet').hidden = false;
    dateSheet.open = true;
    dateSheet.syncing = true;
    requestAnimationFrame(function () {
      $('#dateSheet').classList.add('open');
      $('#dateBackdrop').classList.add('open');
      setDpWheel($('#wheelHour'), parsed.h);
      setDpWheel($('#wheelMinute'), parsed.m);
      syncDpNoTime();
      setTimeout(function () { dateSheet.syncing = false; }, 260);
    });
  }

  function closeDateSheet() {
    if (!dateSheet.open) return;
    dateSheet.open = false;
    $('#dateSheet').classList.remove('open');
    $('#dateBackdrop').classList.remove('open');
    clearTimeout(dateCloseTimer);
    dateCloseTimer = setTimeout(function () {
      if (dateSheet.open) return;
      $('#dateSheet').hidden = true;
      $('#dateBackdrop').hidden = true;
    }, 300);
  }

  function commitDateSheet() {
    const subject = activeDateDraft();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(subject.date)) subject.date = todayKey();
    syncDateChip();
    closeDateSheet();
  }

  function toggleDpNoTime() {
    const subject = activeDateDraft();
    if (subject.time) {
      dateSheet.lastTime = subject.time;
      subject.time = '';
    } else {
      const restored = parseDpTime(dateSheet.lastTime) || { h: 9, m: 0 };
      subject.time = pad2(restored.h) + ':' + pad2(restored.m);
      dateSheet.syncing = true;
      setDpWheel($('#wheelHour'), restored.h);
      setDpWheel($('#wheelMinute'), restored.m);
      setTimeout(function () { dateSheet.syncing = false; }, 200);
    }
    syncDpNoTime();
    syncDateChip();
  }

  function shiftDpMonth(delta) {
    const d = new Date(dateSheet.year, dateSheet.month + delta, 1);
    dateSheet.year = d.getFullYear();
    dateSheet.month = d.getMonth();
    renderDatePanel();
  }

  function syncTypeChips() {
    $$('.type-chip', $('#typeChips')).forEach(function (chip) {
      const active = chip.dataset.type === draft.type;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function autoGrowNote() {
    const el = $('#noteInput');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function openSheet(presetDate) {
    const t = todayKey();
    const anchor = state.agendaAnchor;
    const preset = /^\d{4}-\d{2}-\d{2}$/.test(String(presetDate || '')) ? String(presetDate) : '';
    draft.type = 'event';
    draft.date = preset || (state.view === 'agenda' && anchor >= t ? anchor : t);
    draft.time = '09:00';

    // 只筛了一个分类时，新条目默认归到它，省一步
    draft.categoryId = state.view === 'agenda' && state.agendaFilters.length === 1 &&
      getCategory(state.agendaFilters[0]) ? state.agendaFilters[0] : null;
    draft.recurrence = null;
    draft.note = '';
    draft.address = null;
    draft.remindBefore = null;
    draft.priority = false;

    $('#itemTitle').value = '';
    $('#noteInput').value = '';
    $('#remindMinutes').value = '';
    $('#remindEditor').hidden = true;
    $('#saveBtn').disabled = true;
    autoGrowNote();

    const body = $('#sheetBody');
    if (body) body.scrollTop = 0;
    dateSheet.target = 'item';
    syncTypeChips();
    syncDateChip();
    syncRemindChip();
    syncRepeatChip();
    syncPriorityChip();
    syncAddressChips();
    renderCategoryChips();

    clearTimeout(sheetCloseTimer);
    $('#sheetBackdrop').hidden = false;
    $('#sheet').hidden = false;
    requestAnimationFrame(function () {
      $('#sheet').classList.add('open');
      $('#sheetBackdrop').classList.add('open');
    });
    state.sheetOpen = true;
    setTimeout(function () { $('#itemTitle').focus(); }, 280);
  }

  function closeSheet() {
    if (addressSheet.open) closeAddressSheet();
    if (repDraft.open) closeRepSheet();
    if (dateSheet.open) closeDateSheet();
    if (!state.sheetOpen) return;
    state.sheetOpen = false;
    $('#sheet').classList.remove('open');
    $('#sheetBackdrop').classList.remove('open');
    clearTimeout(sheetCloseTimer);
    sheetCloseTimer = setTimeout(function () {
      if (state.sheetOpen) return;
      $('#sheet').hidden = true;
      $('#sheetBackdrop').hidden = true;
    }, 300);
  }

  async function saveItem() {
    if (state.saving) return;
    const title = $('#itemTitle').value.trim();
    if (!title) {
      $('#itemTitle').focus();
      return;
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : todayKey();
    const item = normalizeItem({
      id: uid(),
      type: draft.type,
      title: title,
      date: date,
      time: draft.time || null,
      priority: draft.priority ? 'high' : 'normal',
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      categoryId: getCategory(draft.categoryId) ? draft.categoryId : null,
      note: draft.note.slice(0, 500),
      address: draft.address,
      remindBefore: typeof draft.remindBefore === 'number' ? draft.remindBefore : null,
      recurrence: draft.recurrence || null,
      completions: {}
    });

    state.saving = true;
    $('#saveBtn').disabled = true;
    state.items.push(item);
    const ok = await persistItems();

    state.saving = false;
    closeSheet();

    if (state.view === 'agenda') state.agendaAnchor = item.date;
    renderAll();
    scheduleReminders();
    showToast(ok ? T('已添加：{title}', { title: shorten(item.title, 18) }) : T('已添加，但没能保存到本机'));
  }

  // ==================== 添加计划面板（与日程独立） ====================

  const planDraft = {
    kind: 'week',
    date: '',
    time: null,
    categoryId: null,
    address: null,
    remindBefore: null,
    priority: false
  };

  let planCloseTimer = null;

  function syncPlanKindChips() {
    $$('.type-chip', $('#planKindChips')).forEach(function (chip) {
      const active = chip.dataset.planKind === planDraft.kind;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function syncPlanDateChip() {
    const el = $('#planDateChip');
    if (!el) return;
    const key = planDraft.date || todayKey();
    el.textContent = planDraft.time ? relativeDayLabel(key) + ' ' + planDraft.time : relativeDayLabel(key);
    el.classList.add('active');
  }

  function syncPlanRemindChip() {
    const el = $('#planRemindChip');
    if (!el) return;
    const on = typeof planDraft.remindBefore === 'number';
    el.textContent = on ? T('提前 {n} 分钟', { n: planDraft.remindBefore }) : T('提醒');
    el.classList.toggle('active', on);
  }

  function syncPlanPriorityChip() {
    const el = $('#planPriorityChip');
    if (!el) return;
    el.textContent = planDraft.priority ? T('高优先级') : T('优先级');
    el.classList.toggle('active', planDraft.priority);
    el.classList.toggle('high', planDraft.priority);
  }

  function autoGrowPlanNote() {
    const el = $('#planNote');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  function renderPlanCategoryChips() {
    const box = $('#planCategoryChips');
    if (!box) return;
    let html = '<button class="cat-chip' + (planDraft.categoryId ? '' : ' active') + '" type="button" data-plan-cat="none">' +
      '<i style="--cat-dot:var(--muted)"></i>未分类</button>';
    state.categories.forEach(function (cat) {
      const active = planDraft.categoryId === cat.id;
      html += '<button class="cat-chip' + (active ? ' active' : '') + '" type="button" data-plan-cat="' + cat.id +
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + '">' +
        '<i style="--cat-dot:' + cat.color + '"></i>' + esc(cat.name) + '</button>';
    });
    html += '<button class="cat-manage-chip" type="button" data-plan-manage>+ 管理分类</button>';
    box.innerHTML = html;
  }

  function openPlanSheet(presetKind) {
    const t = todayKey();
    planDraft.kind = PLAN_KINDS[presetKind] ? presetKind : 'week';
    planDraft.date = t;
    planDraft.time = null;
    planDraft.categoryId = null;
    planDraft.address = null;
    planDraft.remindBefore = null;
    planDraft.priority = false;

    $('#planTitle').value = '';
    $('#planNote').value = '';
    $('#planRemindInput').value = '';
    $('#planRemindEditor').hidden = true;
    $('#planSave').disabled = true;
    autoGrowPlanNote();

    syncPlanKindChips();
    syncPlanDateChip();
    syncPlanRemindChip();
    syncPlanPriorityChip();
    syncAddressChips();
    renderPlanCategoryChips();

    clearTimeout(planCloseTimer);
    $('#planBackdrop').hidden = false;
    $('#planSheet').hidden = false;
    requestAnimationFrame(function () {
      $('#planSheet').classList.add('open');
      $('#planBackdrop').classList.add('open');
    });
    state.planSheetOpen = true;
    setTimeout(function () { $('#planTitle').focus(); }, 280);
  }

  function closePlanSheet() {
    if (addressSheet.open) closeAddressSheet();
    if (!state.planSheetOpen) return;
    state.planSheetOpen = false;
    $('#planSheet').classList.remove('open');
    $('#planBackdrop').classList.remove('open');
    clearTimeout(planCloseTimer);
    planCloseTimer = setTimeout(function () {
      if (state.planSheetOpen) return;
      $('#planSheet').hidden = true;
      $('#planBackdrop').hidden = true;
    }, 300);
  }

  async function savePlan() {
    if (state.saving) return;
    const title = $('#planTitle').value.trim();
    if (!title) {
      $('#planTitle').focus();
      return;
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(planDraft.date) ? planDraft.date : todayKey();

    const plan = normalizePlan({
      id: uid(),
      kind: planDraft.kind,
      title: title,
      periodStart: planPeriodStart(planDraft.kind, date),
      time: planDraft.time || null,
      priority: planDraft.priority ? 'high' : 'normal',
      categoryId: getCategory(planDraft.categoryId) ? planDraft.categoryId : null,
      note: $('#planNote').value.slice(0, 500),
      address: planDraft.address,
      remindBefore: typeof planDraft.remindBefore === 'number' ? planDraft.remindBefore : null,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    if (!plan) return;

    state.saving = true;
    $('#planSave').disabled = true;
    state.plans.push(plan);
    const ok = await persistPlans();

    state.saving = false;
    closePlanSheet();
    renderPlan();
    scheduleReminders();
    showToast(ok ? T('已添加{kind}：{title}', { kind: T(PLAN_KINDS[plan.kind]), title: shorten(plan.title, 16) })
      : T('已添加，但没能保存到本机'));
  }

  async function togglePlanDone(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    plan.done = !plan.done;
    plan.doneAt = plan.done ? Date.now() : null;
    plan.updatedAt = Date.now();
    await persistPlans();
    renderPlan();
    haptic(10);
    if (plan.done) showToast(T('已完成 · {title}', { title: shorten(plan.title, 16) }), 1400);
  }

  function askDeletePlan(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    closeAllSwipes();
    openModal({
      kind: 'plan-del',
      title: '删除这条计划？',
      text: '只删除计划本身，不会影响日程与待办。',
      confirmText: '删除',
      danger: true,
      onConfirm: function () { deletePlanNow(id); }
    });
  }

  async function deletePlanNow(id) {
    const idx = state.plans.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    state.plans.splice(idx, 1);
    await persistPlans();
    renderPlan();
    scheduleReminders();
    showToast(T('已删除'), 1200);
  }

  // ==================== 设置页 ====================

  const notifyState = { status: 'default', checked: false, native: false };
  const storageState = { status: 'unknown', checked: false, native: false };
  const locationState = { status: 'unknown', checked: false, native: false };

  function permissionLabel(status) {
    if (status === 'granted') return T('已允许');
    if (status === 'denied') return T('已拒绝');
    if (status === 'unsupported') return T('不支持');
    if (status === 'not-required') return T('无需授权');
    if (status === 'unknown') return T('检测中…');
    return T('未开启');
  }

  function permissionBadgeClass(status) {
    if (status === 'granted' || status === 'not-required') return 'ok';
    if (status === 'denied') return 'danger';
    if (status === 'default') return 'warn';
    return '';
  }

  function notificationLabel() {
    return notifyState.checked ? permissionLabel(notifyState.status) : T('检测中…');
  }

  function backupLocationText() {
    if (isNativeApp() && plugin('Filesystem')) {
      return T('应用专属目录 files/backups（可用下方按钮分享或另存到「下载」）');
    }
    return T('手机浏览器的「下载」目录（文件管理 → 下载）');
  }

  // ==================== 天气：初始化与城市选择 ====================

  let weatherTimer = null;
  let cityResultsData = [];
  let citySearchTimer = null;
  let citySearchSeq = 0;

  function initWeather() {
    if (!window.Weather) return;
    window.Weather.configure({
      t: T,
      isEn: isEn,
      meta: state.meta,
      persist: persistMeta
    });
    window.Weather.refresh();
    if (!weatherTimer) {
      // 打开时拉一次，之后每 45 分钟刷新；回到前台时也会按需刷新
      weatherTimer = setInterval(function () { window.Weather.refresh(); }, 45 * 60 * 1000);
    }
  }

  function openCitySheet() {
    const sheet = $('#citySheet');
    const bg = $('#cityBackdrop');
    if (!sheet || !bg) return;
    cityResultsData = [];
    $('#citySearch').value = '';
    $('#cityResults').innerHTML = '';
    bg.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add('open');
      bg.classList.add('open');
    });
    setTimeout(function () { $('#citySearch').focus(); }, 280);
  }

  function closeCitySheet() {
    const sheet = $('#citySheet');
    const bg = $('#cityBackdrop');
    if (!sheet || !bg || sheet.hidden) return;
    sheet.classList.remove('open');
    bg.classList.remove('open');
    if (citySearchTimer) { clearTimeout(citySearchTimer); citySearchTimer = null; }
    // 搜索结果只活在这张面板里，关闭即丢弃，不做历史堆积
    citySearchSeq++;
    cityResultsData = [];
    $('#cityResults').innerHTML = '';
    $('#citySearch').blur();
    setTimeout(function () {
      if (!sheet.classList.contains('open')) {
        sheet.hidden = true;
        bg.hidden = true;
      }
    }, 300);
  }

  function cityHint(text) {
    $('#cityResults').innerHTML = '<p class="city-empty">' + esc(text) + '</p>';
  }

  function renderCityResults(list) {
    cityResultsData = list;
    let html = '';
    list.forEach(function (c, i) {
      html += '<button class="city-item" type="button" data-city-index="' + i + '">' +
        '<b>' + esc(c.name) + '</b>' +
        (c.region ? '<span>' + esc(c.region) + '</span>' : '') +
      '</button>';
    });
    $('#cityResults').innerHTML = html;
  }

  async function runCitySearch(q) {
    const query = String(q || '').trim();
    const seq = ++citySearchSeq;
    if (query.length < 2) {
      cityResultsData = [];
      $('#cityResults').innerHTML = '';
      return;
    }
    cityHint(T('正在搜索城市或区县…'));
    let list;
    try {
      list = await window.Weather.search(query);
    } catch (err) {
      // 失败 / 离线：只给一句提示，保留原来已选的天气城市
      if (seq !== citySearchSeq) return;
      cityHint(T('搜索失败，请检查网络，已保留原来的城市。'));
      return;
    }
    if (seq !== citySearchSeq || $('#citySearch').value.trim() !== query) return;
    if (!list.length) {
      cityHint(T('没有找到匹配的城市或区县，换个名字试试。'));
      return;
    }
    renderCityResults(list);
  }

  // ==================== 条目 / 计划地址 ====================
  // 只在用户点「使用当前位置」时读一次坐标，不后台追踪、不缓存轨迹；
  // 手动搜索走 Photon，结果只活在这张面板里，关闭即丢弃。

  const addressSheet = { open: false, target: 'item' };
  let addressResultsData = [];
  let addressSearchTimer = null;
  let addressSearchSeq = 0;

  function activeAddressDraft() {
    return addressSheet.target === 'plan' ? planDraft : draft;
  }

  function syncAddressChips() {
    [
      ['#addressChip', draft],
      ['#planAddressChip', planDraft]
    ].forEach(function (pair) {
      const chip = $(pair[0]);
      if (!chip) return;
      const text = chip.querySelector('.addr-chip-text');
      const addr = pair[1].address;
      if (text) {
        text.textContent = addr ? addr.label : T('添加地址');
        chip.title = addr ? addr.label : '';
      }
      chip.classList.toggle('active', !!addr);
    });
  }

  function addressHint(text) {
    $('#addressResults').innerHTML = '<p class="city-empty">' + esc(text) + '</p>';
  }

  function showAddressNote(text, neutral) {
    const el = $('#addressNote');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('neutral', !!neutral);
    el.hidden = false;
  }

  function hideAddressNote() {
    const el = $('#addressNote');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  function openAddressSheet(target) {
    const sheet = $('#addressSheet');
    const bg = $('#addressBackdrop');
    if (!sheet || !bg) return;
    addressSheet.target = target === 'plan' ? 'plan' : 'item';
    addressSheet.open = true;
    addressResultsData = [];
    addressSearchSeq++;
    $('#addressSearch').value = '';
    $('#addressResults').innerHTML = '';
    hideAddressNote();

    const addr = activeAddressDraft().address;
    $('#addressClear').hidden = !addr;
    if (addr) showAddressNote(T('当前地址：{label}', { label: addr.label }), true);

    bg.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add('open');
      bg.classList.add('open');
    });
    setTimeout(function () { $('#addressSearch').focus(); }, 280);
  }

  function closeAddressSheet() {
    const sheet = $('#addressSheet');
    const bg = $('#addressBackdrop');
    if (!sheet || !bg || !addressSheet.open) return;
    addressSheet.open = false;
    sheet.classList.remove('open');
    bg.classList.remove('open');
    if (addressSearchTimer) { clearTimeout(addressSearchTimer); addressSearchTimer = null; }
    addressSearchSeq++;
    addressResultsData = [];
    $('#addressResults').innerHTML = '';
    $('#addressSearch').blur();
    hideAddressNote();
    setTimeout(function () {
      if (!addressSheet.open) {
        sheet.hidden = true;
        bg.hidden = true;
      }
    }, 260);
  }

  function chooseAddress(addr) {
    const clean = normalizeAddress(addr);
    if (!clean) return;
    activeAddressDraft().address = clean;
    syncAddressChips();
    closeAddressSheet();
    showToast(T('地址已保存'));
  }

  function joinAddressParts(parts) {
    const out = [];
    parts.forEach(function (part) {
      const text = String(part || '').trim();
      if (text && out.indexOf(text) === -1) out.push(text);
    });
    return out.join(' · ');
  }

  function photonMainName(p) {
    // 优先街道名，其次地点名；邮编之类的占位不要当地址
    if (p.street) return p.street;
    if (p.name && p.osm_value !== 'postcode') return p.name;
    return p.district || p.suburb || p.neighbourhood || p.city || p.town || p.village || '';
  }

  function photonAddressResult(feature) {
    const p = (feature && feature.properties) || {};
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    if (!coords || coords.length < 2) return null;
    const main = photonMainName(p);
    if (!main) return null;
    const adminParts = [
      p.city || p.town || p.village || p.municipality,
      p.district || p.city_district || p.county || p.borough,
      p.state,
      p.country && p.country !== '中国' && p.country !== 'China' ? p.country : ''
    ].map(function (part) {
      // 少数要素的 state 只给 "ZJ" 这种缩写，拼进一行地址里没有意义
      const text = String(part || '').trim();
      return /^[A-Z]{1,3}$/.test(text) ? '' : text;
    });
    const region = joinAddressParts(adminParts);
    const label = joinAddressParts([main].concat(adminParts)).slice(0, 160);
    return {
      name: main.slice(0, 40),
      region: region,
      label: label,
      lat: coords[1],
      lon: coords[0]
    };
  }

  function fetchJSON(url, timeoutMs) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 8000);
    return fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      // Photon 按 Accept-Language 选地名，中文模式不能被浏览器默认语言带偏
      headers: { Accept: 'application/json', 'Accept-Language': isEn() ? 'en' : 'zh-CN' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  async function runAddressSearch(q) {
    const query = String(q || '').trim();
    const seq = ++addressSearchSeq;
    if (query.length < 2) {
      addressResultsData = [];
      $('#addressResults').innerHTML = '';
      return;
    }
    addressHint(T('正在搜索地址…'));
    let data;
    try {
      let url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=8';
      if (isEn()) url += '&lang=en';
      data = await fetchJSON(url, 8000);
    } catch (err) {
      if (seq !== addressSearchSeq) return;
      addressHint(T('地址搜索失败，请稍后再试。'));
      return;
    }
    if (seq !== addressSearchSeq || $('#addressSearch').value.trim() !== query) return;
    const list = (data.features || []).map(photonAddressResult).filter(Boolean);
    if (!list.length) {
      addressHint(T('没有找到匹配的地址，换个关键词试试。'));
      return;
    }
    addressResultsData = list;
    $('#addressResults').innerHTML = list.map(function (addr, i) {
      return '<button class="city-item" type="button" data-address-index="' + i + '">' +
        '<b>' + esc(addr.name) + '</b>' +
        (addr.region ? '<span>' + esc(addr.region) + '</span>' : '') +
      '</button>';
    }).join('');
  }

  function readPrecisePosition() {
    const geo = plugin('Geolocation');
    if (!geo || !geo.getCurrentPosition) {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) {
          reject(new Error('geolocation unavailable'));
          return;
        }
        navigator.geolocation.getCurrentPosition(function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        }, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
    }
    return geo.requestPermissions().then(function (perm) {
      const fine = perm && perm.location === 'granted';
      const coarse = perm && perm.coarseLocation === 'granted';
      if (!fine) return { denied: !coarse, coarse: !!coarse };
      return geo.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }).then(function (pos) {
        return {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      });
    });
  }

  async function reverseAddress(lat, lon) {
    try {
      const url = 'https://photon.komoot.io/reverse?lat=' + encodeURIComponent(lat) +
        '&lon=' + encodeURIComponent(lon) + '&limit=1' + (isEn() ? '&lang=en' : '');
      const data = await fetchJSON(url, 8000);
      const feature = (data.features || [])[0];
      if (!feature) return null;
      const addr = photonAddressResult(feature);
      return addr ? { label: addr.label, lat: lat, lon: lon } : null;
    } catch (err) {
      return null;
    }
  }

  async function locateForAddress() {
    const btn = $('#addressLocate');
    if (!btn || btn.disabled) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = T('正在定位…');
    hideAddressNote();

    let pos;
    try {
      pos = await readPrecisePosition();
    } catch (err) {
      pos = { denied: true };
    }
    if (!pos || pos.denied) {
      btn.disabled = false;
      btn.textContent = original;
      showAddressNote(T('定位失败，可以手动搜索地址。'));
      return;
    }
    // 只拿到大致位置时明确说明，不把城市级坐标当成门牌地址
    if (pos.coarse || (typeof pos.accuracy === 'number' && pos.accuracy > 3000)) {
      btn.disabled = false;
      btn.textContent = original;
      showAddressNote(T('只获得了大致位置。可以手动搜索地址，或在系统设置里允许精确位置。'));
      return;
    }

    btn.textContent = T('正在查找地址…');
    const addr = await reverseAddress(pos.lat, pos.lon);
    btn.disabled = false;
    btn.textContent = original;
    if (!addr || !addr.label) {
      showAddressNote(T('没能获取位置对应的地址，可以手动搜索。'));
      return;
    }
    chooseAddress(addr);
  }

  function copyPlainText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return legacyCopyText(text);
      });
    }
    return Promise.resolve(legacyCopyText(text));
  }

  function legacyCopyText(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  // 用系统 geo: 意图打开地图；没有地图应用接手时降级为复制地址
  function openAddressMap(addr) {
    if (!addr || !addr.label) return;
    const hasCoords = typeof addr.lat === 'number' && typeof addr.lon === 'number';
    const coords = hasCoords ? addr.lat + ',' + addr.lon : '';
    const uri = 'geo:' + (coords || '0,0') + '?q=' +
      encodeURIComponent(hasCoords ? coords + '(' + addr.label + ')' : addr.label);

    let left = false;
    const onVisibility = function () {
      if (document.hidden) left = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    try {
      window.location.href = uri;
    } catch (err) { /* 没有注册 geo: 协议时走复制 */ }
    setTimeout(function () {
      document.removeEventListener('visibilitychange', onVisibility);
      if (left || document.hidden) return;
      copyPlainText(addr.label).then(function (ok) {
        showToast(ok ? T('没有可用的地图应用，已复制地址') : T('地址已复制，可粘贴到地图应用'));
      });
    }, 1800);
  }

  function renderSettings() {
    if (!storage.status) return;

    $('#themeToggle').checked = document.documentElement.classList.contains('dark');
    $('#notifyState').textContent = notificationLabel();

    const loc = $('#backupLocation');
    if (loc) loc.textContent = backupLocationText();

    const cityValue = $('#weatherCityValue');
    if (cityValue) {
      cityValue.textContent = window.Weather ? window.Weather.cityLabel() : T('自动定位');
    }

    $$('#langRow .lang-chip').forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.lang === (window.I18N ? window.I18N.lang : 'zh'));
    });

    renderCategoryList();
  }

  function openAbout() {
    const page = $('#aboutPage');
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
  }

  function closeAbout() {
    const page = $('#aboutPage');
    page.classList.remove('open');
    setTimeout(function () {
      if (!page.classList.contains('open')) page.hidden = true;
    }, 300);
  }

  function openSettings() {
    state.settingsOpen = true;
    renderSettings();
    refreshNotifyState();
    const page = $('#settingsPage');
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
  }

  function closeSettings() {
    if (!state.settingsOpen) return;
    state.settingsOpen = false;
    state.editCategoryId = '';
    closeCatPop();
    closeAbout();
    const page = $('#settingsPage');
    page.classList.remove('open');
    setTimeout(function () {
      if (!state.settingsOpen) page.hidden = true;
    }, 300);
  }

  // ==================== 开屏动画 ====================

  let splashDone = false;
  const splashWaiters = [];

  function onSplashDone(fn) {
    if (splashDone) {
      fn();
      return;
    }
    splashWaiters.push(fn);
  }

  function finishSplash() {
    if (splashDone) return;
    splashDone = true;
    const splash = $('#splash');
    if (splash && !splash.hidden) {
      splash.classList.add('done');
      setTimeout(function () { splash.hidden = true; }, 260);
    }
    while (splashWaiters.length) {
      const fn = splashWaiters.shift();
      try {
        fn();
      } catch (err) {
        console.warn('开屏结束回调失败：', err);
      }
    }
  }

  function initSplash() {
    const splash = $('#splash');
    if (!splash) {
      finishSplash();
      return;
    }
    // 点一下就能跳过；2 秒内自动结束（字标呼吸 → 寄语浮现 → 整体上浮淡出）
    splash.addEventListener('click', finishSplash);
    splash.addEventListener('touchstart', finishSplash, { passive: true });
    setTimeout(finishSplash, 2000);
  }

  // ==================== 权限引导（通知 / 存储 / 定位） ====================

  function isNativeApp() {
    if (!window.Capacitor) return false;
    if (typeof window.Capacitor.isNativePlatform === 'function') {
      return window.Capacitor.isNativePlatform();
    }
    return true;
  }

  function plugin(name) {
    if (!window.Capacitor) return null;
    const plugins = window.Capacitor.Plugins || {};
    return plugins[name] || null;
  }

  function localNotifyPlugin() {
    return plugin('LocalNotifications');
  }

  function showInfo(title, text) {
    openModal({
      kind: 'info',
      title: title,
      text: text,
      confirmText: T('知道了'),
      hideCancel: true
    });
  }

  async function openSystemSettings() {
    const notify = localNotifyPlugin();
    if (notify && typeof notify.openSettings === 'function') {
      try {
        await notify.openSettings();
        return;
      } catch (err) {
        console.warn('打开系统设置失败：', err);
      }
    }
    showInfo(T('去设置'), T('打开手机「设置 → 应用 → 氢计划 → 权限」，手动打开对应权限后，再回到这里点「重新检查」。'));
  }

  async function refreshNotifyState() {
    const notify = localNotifyPlugin();
    notifyState.native = !!notify;
    if (notify) {
      try {
        const res = await notify.checkPermissions();
        const display = res && res.display;
        if (display === 'granted') notifyState.status = 'granted';
        else if (display === 'denied') notifyState.status = 'denied';
        else notifyState.status = 'default';
      } catch (err) {
        notifyState.status = 'unsupported';
      }
    } else if ('Notification' in window) {
      notifyState.status = Notification.permission;
    } else {
      notifyState.status = 'unsupported';
    }
    notifyState.checked = true;
    renderSettings();
    renderPermissionSheet();
    scheduleReminders();
    return notifyState.status;
  }

  async function refreshStorageState() {
    const fs = plugin('Filesystem');
    storageState.native = !!fs;
    storageState.checked = true;
    if (!fs) {
      // 网页版：下载与选择文件都由浏览器处理，不需要额外授权
      storageState.status = 'not-required';
    } else {
      try {
        const res = await fs.checkPermissions();
        storageState.status = res && res.publicStorage === 'denied' ? 'denied' : 'granted';
      } catch (err) {
        storageState.status = 'granted';
      }
    }
    return storageState.status;
  }

  async function refreshLocationState() {
    const geo = plugin('Geolocation');
    locationState.native = !!geo;
    locationState.checked = true;
    if (geo) {
      try {
        const res = await geo.checkPermissions();
        const value = res && (res.location || res.coarseLocation);
        if (value === 'granted') locationState.status = 'granted';
        else if (value === 'denied') locationState.status = 'denied';
        else locationState.status = 'default';
      } catch (err) {
        locationState.status = 'unsupported';
      }
    } else if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const res = await navigator.permissions.query({ name: 'geolocation' });
        locationState.status = res.state === 'granted' ? 'granted' : (res.state === 'denied' ? 'denied' : 'default');
      } catch (err) {
        locationState.status = 'unsupported';
      }
    } else {
      locationState.status = 'unsupported';
    }
    return locationState.status;
  }

  async function refreshAllPermissionStates() {
    await Promise.all([refreshNotifyState(), refreshStorageState(), refreshLocationState()]);
    renderPermissionSheet();
  }

  async function askNotifyPermission() {
    const notify = localNotifyPlugin();
    let status = 'unsupported';
    if (notify) {
      try {
        const res = await notify.requestPermissions();
        status = res && res.display === 'granted' ? 'granted' : 'denied';
      } catch (err) {
        status = 'denied';
      }
    } else if ('Notification' in window) {
      try {
        status = await Notification.requestPermission();
      } catch (err) {
        status = 'denied';
      }
    }
    notifyState.status = status;
    notifyState.checked = true;
    renderSettings();
    renderPermissionSheet();
    if (status === 'granted') showToast(T('通知已开启'));
    scheduleReminders();
    return status;
  }

  async function askStoragePermission() {
    const fs = plugin('Filesystem');
    if (!fs) {
      showInfo(T('存储与备份'), T('当前是网页版：下载备份、选择文件都不需要额外授权。'));
      return;
    }
    if (storageState.status === 'granted') {
      openSystemSettings();
      return;
    }
    try {
      await fs.requestPermissions();
    } catch (err) {
      console.warn('存储权限申请失败：', err);
    }
    await refreshStorageState();
    renderPermissionSheet();
    if (storageState.status !== 'granted') openSystemSettings();
  }

  async function askLocationPermission() {
    const geo = plugin('Geolocation');
    if (!geo) {
      // 网页版：真正触发一次浏览器定位授权，只用于天气
      const ok = window.Weather ? await window.Weather.useCurrentLocation() : false;
      if (ok) showToast(T('已使用当前位置'));
      else showInfo(T('定位未开启'), T('可以手动选择城市来显示天气。'));
      await refreshLocationState();
      renderPermissionSheet();
      return;
    }
    if (locationState.status === 'granted') {
      if (window.Weather) window.Weather.refresh(true);
      openSystemSettings();
      return;
    }
    try {
      // 申请权限；granted 之后天气模块会按需读取一次坐标
      await geo.requestPermissions();
    } catch (err) {
      console.warn('定位权限申请失败：', err);
    }
    await refreshLocationState();
    renderPermissionSheet();
    if (locationState.status === 'granted') {
      if (window.Weather) window.Weather.refresh(true);
    } else {
      openSystemSettings();
    }
  }

  function setPermissionBadge(el, status) {
    if (!el) return;
    el.textContent = permissionLabel(status);
    const cls = permissionBadgeClass(status);
    el.className = 'perm-badge' + (cls ? ' ' + cls : '');
  }

  function renderPermissionSheet() {
    const notifyBadge = $('#permNotifyState');
    if (!notifyBadge) return;

    setPermissionBadge(notifyBadge, notifyState.status === 'default' ? 'default' : notifyState.status);
    setPermissionBadge($('#permStorageState'), storageState.status);
    setPermissionBadge($('#permLocationState'), locationState.status);

    const notifyDenied = notifyState.status === 'denied';
    $('#permDenied').hidden = !notifyDenied;

    const allowBtn = $('#permAllow');
    if (allowBtn) {
      allowBtn.hidden = notifyState.status === 'granted' || notifyState.status === 'unsupported';
      allowBtn.textContent = notifyDenied ? T('重新检查') : T('允许通知');
    }

    const storageBtn = $('#permStorageBtn');
    if (storageBtn) {
      if (storageState.status === 'not-required') {
        storageBtn.textContent = T('查看说明');
      } else if (storageState.status === 'granted') {
        storageBtn.textContent = T('去设置');
      } else {
        storageBtn.textContent = T('申请权限');
      }
    }

    const locationBtn = $('#permLocationBtn');
    if (locationBtn) {
      if (!locationState.native) {
        locationBtn.textContent = T('查看说明');
      } else if (locationState.status === 'granted') {
        locationBtn.textContent = T('去设置');
      } else {
        locationBtn.textContent = T('申请权限');
      }
    }

    const later = $('#permLater');
    if (later) later.textContent = T('开始使用');
  }

  function openPermissionSheet() {
    const page = $('#permSheet');
    if (!page || !page.hidden) return;
    renderPermissionSheet();
    refreshAllPermissionStates();
    $('#permBackdrop').hidden = false;
    page.hidden = false;
    requestAnimationFrame(function () {
      page.classList.add('open');
      $('#permBackdrop').classList.add('open');
    });
  }

  function closePermissionSheet() {
    const page = $('#permSheet');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    $('#permBackdrop').classList.remove('open');
    setTimeout(function () {
      page.hidden = true;
      $('#permBackdrop').hidden = true;
    }, 280);
  }

  async function finishPermissionIntro() {
    closePermissionSheet();
    if (!state.meta.permissionIntroDone) {
      state.meta.permissionIntroDone = 1;
      await persistMeta();
    }
  }

  function maybeShowPermissionIntro() {
    if (state.meta.permissionIntroDone) return;
    openPermissionSheet();
  }

  // ==================== 导出 / 导入 ====================

  const BACKUP_FILE_RE = /^(AeroPlan-backup-|氢计划备份-).+\.json$/;
  const TEMP_FILE_RE = /\.(part|tmp)$/i;

  function backupFileName() {
    const d = new Date();
    const stamp = dateKey(d) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    return (isEn() ? 'AeroPlan-backup-' : '氢计划备份-') + stamp + '.json';
  }

  function backupFileList(files) {
    return (files || []).map(function (f) {
      return typeof f === 'string' ? f : (f && f.name);
    }).filter(function (n) { return n && (BACKUP_FILE_RE.test(n) || TEMP_FILE_RE.test(n)); });
  }

  // 新备份写入并校验通过后，才删旧备份；临时的 .part/.tmp 一并清掉
  async function pruneNativeBackups(keepName) {
    const fs = plugin('Filesystem');
    if (!fs || !isNativeApp()) return { kept: 0, removed: 0 };
    let files = [];
    try {
      const res = await fs.readdir({ path: 'backups/', directory: 'DATA' });
      files = backupFileList(res && res.files);
    } catch (err) {
      return { kept: 0, removed: 0 };
    }

    const backupNames = files.filter(function (n) { return BACKUP_FILE_RE.test(n); });
    backupNames.sort(); // 文件名带时间戳，按名称排序即按时间排序
    const removed = [];
    backupNames.forEach(function (n) { if (n !== keepName) removed.push(n); });
    files.forEach(function (n) {
      if (TEMP_FILE_RE.test(n) && removed.indexOf(n) === -1) removed.push(n);
    });

    for (let i = 0; i < removed.length; i++) {
      try { await fs.deleteFile({ path: 'backups/' + removed[i], directory: 'DATA' }); } catch (err) {}
    }
    return { kept: keepName && backupNames.indexOf(keepName) !== -1 ? 1 : 0, removed: removed.length };
  }

  async function clearNativeBackups() {
    const fs = plugin('Filesystem');
    if (!fs || !isNativeApp()) return { removed: 0 };
    let files = [];
    try {
      const res = await fs.readdir({ path: 'backups/', directory: 'DATA' });
      files = backupFileList(res && res.files);
    } catch (err) {
      return { removed: 0 };
    }
    let removed = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        await fs.deleteFile({ path: 'backups/' + files[i], directory: 'DATA' });
        removed++;
      } catch (err) {}
    }
    return { removed: removed };
  }

  // 自检用：查看应用私有目录里还剩几份备份（不在界面暴露）
  async function backupStats() {
    const fs = plugin('Filesystem');
    if (!fs || !isNativeApp()) return { native: false, count: 0, names: [] };
    try {
      const res = await fs.readdir({ path: 'backups/', directory: 'DATA' });
      const names = backupFileList(res && res.files);
      return { native: true, count: names.length, names: names };
    } catch (err) {
      return { native: true, count: 0, names: [] };
    }
  }
  window.__backupStats = backupStats;

  async function exportJSON() {
    const payload = {
      app: isEn() ? 'AeroPlan' : '氢计划',
      schema: 'qingjihua-backup',
      schemaVersion: 7,
      version: 7,
      appVersion: 'v0.5.2',
      exportedAt: new Date().toISOString(),
      count: state.items.length,
      planCount: state.plans.length,
      categoryCount: state.categories.length,
      settings: { theme: preferredTheme(), language: window.I18N ? window.I18N.lang : 'zh' },
      categories: state.categories,
      items: state.items,
      plans: state.plans
    };

    const json = JSON.stringify(payload, null, 2);
    const fileName = backupFileName();
    let savedNative = false;

    const fs = plugin('Filesystem');
    if (fs && isNativeApp()) {
      try {
        await fs.writeFile({
          path: 'backups/' + fileName,
          data: json,
          directory: 'DATA',
          encoding: 'utf8',
          recursive: true
        });
        // 先校验新备份完整可用，校验通过后才删除旧备份（绝不先删后写）
        const back = await fs.readFile({ path: 'backups/' + fileName, directory: 'DATA', encoding: 'utf8' });
        const text = typeof back === 'string' ? back : (back && back.data);
        const check = JSON.parse(text);
        if (!check || check.schema !== 'qingjihua-backup' || !Array.isArray(check.items)) {
          throw new Error('verify-failed');
        }
        await pruneNativeBackups(fileName);

        const uriRes = await fs.getUri({ path: 'backups/' + fileName, directory: 'DATA' });
        state.meta.lastBackupUri = (uriRes && uriRes.uri) || '';
        savedNative = true;
      } catch (err) {
        console.warn('写入备份文件失败：', err);
        try { await fs.deleteFile({ path: 'backups/' + fileName, directory: 'DATA' }); } catch (e2) {}
      }
    }

    if (!savedNative) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    }

    state.meta.lastExportAt = Date.now();
    state.meta.lastBackupName = fileName;
    if (!savedNative) state.meta.lastBackupUri = '';
    persistMeta();
    renderSettings();
    showToast(savedNative ? T('已生成备份，可在下面的位置找到') : T('已备份，文件在手机的“下载”里'));
  }

  async function openBackupLocation() {
    const fs = plugin('Filesystem');
    const share = plugin('Share');

    if (!fs || !isNativeApp()) {
      showInfo(
        T('备份位置说明'),
        T('网页版的备份会保存到手机的「下载」目录：打开「文件管理」→「下载」，按文件名「{name}」查找。如果找不到，可以点下面的「再备份一次」。', { name: state.meta.lastBackupName || backupFileName() })
      );
      return;
    }

    if (!state.meta.lastBackupUri) {
      showToast(T('还没有备份文件，先点「备份数据」'));
      return;
    }

    if (share) {
      try {
        await share.share({
          title: T('氢计划备份'),
          url: state.meta.lastBackupUri,
          dialogTitle: T('备份文件')
        });
        return;
      } catch (err) {
        console.warn('分享备份失败：', err);
      }
    }

    showInfo(
      T('备份位置说明'),
      T('备份保存在应用专属目录 files/backups，系统不允许其它应用直接浏览。可以点「备份数据」重新生成，再通过分享另存到「下载」。')
    );
  }

  async function handleImportFile(file) {
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch (err) {
      showToast(T('读取文件失败'));
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      showToast(T('导入失败：不是有效的 JSON 文件'));
      return;
    }

    const isArrayFile = Array.isArray(data);
    const rawItems = isArrayFile ? data : (data && Array.isArray(data.items) ? data.items : null);
    if (!rawItems) {
      showToast(T('导入失败：文件里找不到条目列表'));
      return;
    }

    const rawCats = !isArrayFile && data && Array.isArray(data.categories) ? data.categories : [];
    const cleanedCats = rawCats.map(normalizeCategory).filter(Boolean);
    const rawPlans = !isArrayFile && data && Array.isArray(data.plans) ? data.plans : [];
    const cleanedPlans = rawPlans.map(normalizePlan).filter(Boolean);

    const cleaned = [];
    let skipped = 0;
    rawItems.forEach(function (raw) {
      const item = normalizeItem(raw);
      if (item) cleaned.push(item);
      else skipped += 1;
    });

    if (!cleaned.length && !cleanedPlans.length) {
      showToast(T('导入失败：没有可识别的条目'));
      return;
    }

    pendingImport = {
      items: cleaned,
      categories: cleanedCats,
      plans: cleanedPlans,
      hasCategories: !isArrayFile && !!data && Array.isArray(data.categories)
    };
    const currentIds = new Set(state.items.map(function (i) { return i.id; }));
    const added = cleaned.filter(function (i) { return !currentIds.has(i.id); }).length;
    const updated = cleaned.length - added;

    const summaryBits = isEn()
      ? {
        read: 'Read <b>' + cleaned.length + '</b> records',
        plans: ' · <b>' + cleanedPlans.length + '</b> plans',
        cats: ' · <b>' + cleanedCats.length + '</b> categories',
        skipped: ' (skipped ' + skipped + ' invalid records)',
        merge: 'Added ' + added + ' · updated ' + updated + ' with the same ID',
        merged: ' · categories merged by ID',
        uncat: ' · no categories in the file; items are uncategorized'
      }
      : {
        read: '读到 <b>' + cleaned.length + '</b> 条记录',
        plans: ' · <b>' + cleanedPlans.length + '</b> 条计划',
        cats: ' · <b>' + cleanedCats.length + '</b> 个分类',
        skipped: '（忽略 ' + skipped + ' 条无效记录）',
        merge: '新增 ' + added + ' 条 · 更新同 ID ' + updated + ' 条',
        merged: ' · 分类按 ID 合并',
        uncat: ' · 文件里没有分类，条目归为未分类'
      };

    $('#importSummary').innerHTML =
      summaryBits.read +
      (cleanedPlans.length ? summaryBits.plans : '') +
      (cleanedCats.length ? summaryBits.cats : '') +
      (skipped ? summaryBits.skipped : '') +
      '<br><span class="muted">' + summaryBits.merge +
      (cleanedCats.length ? summaryBits.merged : summaryBits.uncat) + '</span>';
    $('#importPreview').hidden = false;
  }

  function sanitizeItemCategories(items, categories) {
    const ids = new Set(categories.map(function (cat) { return cat.id; }));
    return items.map(function (item) {
      const copy = Object.assign({}, item);
      copy.categoryId = copy.categoryId && ids.has(copy.categoryId) ? copy.categoryId : null;
      return copy;
    });
  }

  function sanitizePlanCategories(plans, categories) {
    const ids = new Set(categories.map(function (cat) { return cat.id; }));
    return plans.map(function (plan) {
      const copy = Object.assign({}, plan);
      copy.categoryId = copy.categoryId && ids.has(copy.categoryId) ? copy.categoryId : null;
      return copy;
    });
  }

  async function applyImport(mode) {
    if (!pendingImport) return;

    if (mode === 'replace') {
      if (!window.confirm(T('替换会把现在的全部条目删掉，确定吗？'))) return;
      state.categories = pendingImport.hasCategories
        ? pendingImport.categories.slice(0, MAX_CATEGORIES).map(function (c) { return Object.assign({}, c); })
        : state.categories.slice();
      sortCategories();
      state.items = sanitizeItemCategories(pendingImport.items, state.categories);
      state.plans = sanitizePlanCategories(pendingImport.plans || [], state.categories);
    } else {
      const catMap = new Map();
      state.categories.forEach(function (cat) { catMap.set(cat.id, cat); });
      pendingImport.categories.forEach(function (cat) { catMap.set(cat.id, Object.assign({}, cat)); });
      state.categories = Array.from(catMap.values()).slice(0, MAX_CATEGORIES);
      sortCategories();

      const itemMap = new Map();
      state.items.forEach(function (item) { itemMap.set(item.id, item); });
      pendingImport.items.forEach(function (item) { itemMap.set(item.id, Object.assign({}, item)); });
      state.items = sanitizeItemCategories(Array.from(itemMap.values()), state.categories);

      const planMap = new Map();
      state.plans.forEach(function (plan) { planMap.set(plan.id, plan); });
      (pendingImport.plans || []).forEach(function (plan) { planMap.set(plan.id, Object.assign({}, plan)); });
      state.plans = sanitizePlanCategories(Array.from(planMap.values()), state.categories);
    }

    state.agendaFilters = state.agendaFilters.filter(function (id) { return !!getCategory(id); });

    await persistCategories();
    await persistItems();
    await persistPlans();
    pendingImport = null;
    $('#importPreview').hidden = true;
    renderAll();
    scheduleReminders();
    showToast(mode === 'replace' ? T('已替换为备份数据') : T('已合并导入'));
  }

  async function clearAllItems() {
    const hasData = state.items.length || state.plans.length || state.categories.length;
    if (hasData) {
      const ok = window.confirm(
        isEn()
          ? T('清空所有数据？') + '\n\n' +
            T('共 {items} 条安排、{plans} 条计划、{cats} 个分类，删除后不可恢复。', {
              items: state.items.length, plans: state.plans.length, cats: state.categories.length
            }) + '\n' + T('建议先备份。')
          : '清空所有数据？\n\n共 ' + state.items.length + ' 条安排、' + state.plans.length + ' 条计划、' +
            state.categories.length + ' 个分类，删除后不可恢复。\n建议先导出备份。'
      );
      if (!ok) return;
    }

    state.items = [];
    state.plans = [];
    state.categories = [];
    state.agendaFilters = [];
    state.editCategoryId = '';
    draft.categoryId = null;
    state.meta.samplesCleared = true;
    // 连带清理缓存、备份文件与反查地名，占用回落到接近首次安装
    clearAllCaches();
    await clearNativeBackups();
    state.meta.lastBackupUri = '';
    state.meta.lastBackupName = '';
    const savedItems = await persistItems();
    const savedPlans = await persistPlans();
    const savedCats = await persistCategories();
    await persistMeta();
    renderAll();
    // 渲染当前视图会重新填充当月的日期换算结果；这里再清一次，确保清空后自检为 0
    // （已渲染的界面不受影响，下次查看时会按需重算）
    clearAllCaches();
    scheduleReminders();
    showToast(savedItems && savedPlans && savedCats ? T('已清空所有数据') : T('已清空，但未能写入本机'));
  }

  // ==================== 提醒（仅前台） ====================

  function clearReminderTimers() {
    state.reminderTimers.forEach(function (timer) { clearTimeout(timer); });
    state.reminderTimers = [];
  }

  function effectiveRemind(item) {
    return typeof item.remindBefore === 'number' ? item.remindBefore : null;
  }

  function scheduleReminders() {
    clearReminderTimers();
    const now = Date.now();
    const t = todayKey();
    const windowEnd = addDays(t, 1);

    // 原生端：有 LocalNotifications 且已授权时，交给系统排程（App 退到后台也能弹）
    const notify = localNotifyPlugin();
    const useNative = !!(notify && typeof notify.schedule === 'function' &&
      notifyState.status === 'granted');
    const pending = [];

    function consider(item, key, before) {
      const timeText = (item.recurrence && item.recurrence.time) || item.time;
      if (!timeText) return;
      const target = keyToDate(key);
      const parts = timeText.split(':').map(Number);
      target.setHours(parts[0], parts[1], 0, 0);
      const fireAt = target.getTime() - before * 60000;
      const diff = fireAt - now;
      // 只安排 24 小时内的提醒，避免超长定时器不可靠
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        pending.push({ item: item, key: key, fireAt: fireAt, diff: diff });
      }
    }

    state.items.forEach(function (item) {
      const before = effectiveRemind(item);
      if (before === null) return;
      if (!item.recurrence && item.done) return;

      occurrenceDatesIn(item, t, windowEnd).forEach(function (key) {
        if (item.recurrence && item.completions[key]) return;
        consider(item, key, before);
      });
    });

    // 计划提醒：以周期首日 + 设定时间触发
    state.plans.forEach(function (plan) {
      const before = effectiveRemind(plan);
      if (before === null || !plan.time || plan.done) return;
      const key = plan.periodStart;
      if (key < t || key > windowEnd) return;
      consider(plan, key, before);
    });

    if (useNative) {
      const notifications = pending.map(function (p) {
        const timeText = (p.item.recurrence && p.item.recurrence.time) || p.item.time || '';
        return {
          id: reminderNumericId(p.item, p.key),
          title: T('氢计划提醒'),
          body: (timeText || T('全天')) + ' · ' + monthDay(p.key) + ' · ' + p.item.title,
          schedule: { at: new Date(p.fireAt), allowWhileIdle: true },
          extra: { itemId: p.item.id, date: p.key }
        };
      });

      const previous = state.nativeReminderIds.slice();
      state.nativeReminderIds = notifications.map(function (n) { return n.id; });
      const gen = ++state.nativeReminderGen;

      // 先取消上一轮排程，再按本轮列表重新排；代次判断避免并发调用互相覆盖
      Promise.resolve()
        .then(function () {
          if (!previous.length) return null;
          return notify.cancel({
            notifications: previous.map(function (id) { return { id: id }; })
          });
        })
        .then(function () {
          if (gen !== state.nativeReminderGen) return null;
          if (!notifications.length) return null;
          return notify.schedule({ notifications: notifications });
        })
        .catch(function (err) {
          console.warn('本地通知排程失败：', err);
        });
      return;
    }

    pending.forEach(function (p) {
      const timer = setTimeout(function () {
        fireReminder(p.item, p.key);
      }, p.diff);
      state.reminderTimers.push(timer);
    });
  }

  // 通知 id 必须是 32 位正整数；按「条目 + 日期」生成稳定值，避免同一条重复排程
  function reminderNumericId(item, key) {
    const s = String(item.id) + '|' + String(key);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 2147483646) + 1;
  }

  function fireReminder(item, key) {
    const timeText = (item.recurrence && item.recurrence.time) || item.time || '';
    // 同一「条目 + 日期 + 时间 + 提前量」只弹一次，防止重复调度或页面重排后重复提醒
    const stamp = String(item.id) + '|' + (key || item.date) + '|' + timeText + '|' +
      String(effectiveRemind(item));
    if (state.firedReminders[stamp]) return;
    state.firedReminders[stamp] = true;
    const meta = (timeText || T('全天')) + ' · ' + monthDay(key);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(T('氢计划提醒'), {
          body: meta + ' · ' + item.title,
          icon: './icons/icon-192.png',
          tag: 'reminder-' + item.id + '-' + (key || item.date)
        });
        n.onclick = function () {
          window.focus();
          n.close();
          openDetail(item.id, key || item.date);
        };
        renderSummary();
        return;
      } catch (err) {
        console.warn('系统通知发送失败：', err);
      }
    }
    showReminderAlert(item.title, meta);
    renderSummary();
  }

  function showReminderAlert(title, meta) {
    const box = $('#reminderAlert');
    if (!box) return;
    $('#raTitle').textContent = title;
    $('#raTime').textContent = T('提醒 · {time}', { time: meta });
    box.hidden = false;
    requestAnimationFrame(function () { box.classList.add('show'); });
  }

  function hideReminderAlert() {
    const box = $('#reminderAlert');
    if (!box || box.hidden) return;
    box.classList.remove('show');
    setTimeout(function () { box.hidden = true; }, 220);
  }

  function remindEditorValue() {
    const raw = $('#remindMinutes').value.trim();
    const n = Number(raw);
    if (!raw || !isFinite(n) || Math.round(n) !== n || n < 1 || n > 1440) return null;
    return n;
  }

  function openRemindEditor() {
    const box = $('#remindEditor');
    if (!box) return;
    $('#remindMinutes').value = typeof draft.remindBefore === 'number' ? draft.remindBefore : '';
    box.hidden = false;
    setTimeout(function () { $('#remindMinutes').focus(); }, 60);
  }

  function closeRemindEditor() {
    const box = $('#remindEditor');
    if (box) box.hidden = true;
  }

  function applyRemindEditor() {
    const n = remindEditorValue();
    if (n === null) {
      showToast(T('请输入 1–1440 的整数分钟'));
      $('#remindMinutes').focus();
      return;
    }
    draft.remindBefore = n;
    syncRemindChip();
    closeRemindEditor();
  }

  async function ensurePersist() {
    if (storage.status === 'memory') return;
    if (state.meta.persist === 'granted' || state.meta.persist === 'denied' ||
        state.meta.persist === 'unsupported') return;

    if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
      state.meta.persist = 'unsupported';
      await persistMeta();
      renderSettings();
      return;
    }

    try {
      const already = typeof navigator.storage.persisted === 'function'
        ? await navigator.storage.persisted()
        : false;
      const granted = already ? true : await navigator.storage.persist();
      state.meta.persist = granted ? 'granted' : 'denied';
    } catch (err) {
      state.meta.persist = 'denied';
    }
    await persistMeta();
    renderSettings();
  }

  // ==================== Service Worker ====================

  async function registerSW() {
    // 打包成 APK 后，网页文件已经随安装包离线内置，不再注册 Service Worker，
    // 避免以后更新版本时旧缓存盖住新文件。网页版（浏览器打开）行为不变。
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform()) return;
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('离线缓存注册失败：', err);
    }
  }

  // ==================== 事件绑定 ====================

  function bindEvents() {
    $('#prevBtn').addEventListener('click', function () {
      if (state.view === 'calendar') {
        if (!shiftMonthBy(-1)) return;
        renderCalendar();
        updateTopbar();
      } else if (state.view === 'agenda') {
        state.agendaAnchor = addDays(state.agendaAnchor, -1);
        renderAgenda();
        updateTopbar();
        $('#content').scrollTop = 0;
      } else if (state.view === 'schedule') {
        state.scheduleAnchor = addDays(state.scheduleAnchor || startOfWeek(todayKey()), -7);
        renderSchedule();
        updateTopbar();
        $('#content').scrollTop = 0;
      }
    });

    $('#nextBtn').addEventListener('click', function () {
      if (state.view === 'calendar') {
        if (!shiftMonthBy(1)) return;
        renderCalendar();
        updateTopbar();
      } else if (state.view === 'agenda') {
        state.agendaAnchor = addDays(state.agendaAnchor, 1);
        renderAgenda();
        updateTopbar();
        $('#content').scrollTop = 0;
      } else if (state.view === 'schedule') {
        state.scheduleAnchor = addDays(state.scheduleAnchor || startOfWeek(todayKey()), 7);
        renderSchedule();
        updateTopbar();
        $('#content').scrollTop = 0;
      }
    });

    $('#todayBtn').addEventListener('click', function () {
      const t = todayKey();
      const d = keyToDate(t);
      if (state.view === 'schedule') {
        state.scheduleAnchor = startOfWeek(t);
        renderSchedule();
        updateTopbar();
        $('#content').scrollTop = 0;
        return;
      }
      if (state.view === 'agenda' || state.view === 'plan') {
        state.agendaAnchor = t;
        setView('agenda');
      } else {
        state.month = new Date(d.getFullYear(), d.getMonth(), 1);
        state.selectedDate = t;
        renderAll();
        showToast(T('已回到今天'));
      }
    });

    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setView(tab.dataset.view);
      });
    });

    $('#calGrid').addEventListener('click', function (e) {
      if (state.swipeClickLock && Date.now() < state.swipeClickLock) return;
      const cell = e.target.closest('.cal-cell');
      if (!cell) return;
      const key = cell.dataset.date;
      state.selectedDate = state.selectedDate === key ? '' : key;
      renderCalendar();
      if (state.selectedDate) {
        setTimeout(function () {
          const box = $('#dayDetail');
          if (box && box.scrollIntoView) {
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 60);
      }
    });

    $('#summaryBtn').addEventListener('click', function () {
      state.agendaAnchor = todayKey();
      setView('agenda');
    });

    $('#topbarTitle').addEventListener('click', function () {
      if (state.view === 'calendar' || state.view === 'agenda') openYearPicker();
    });

    $('#yearClose').addEventListener('click', closeYearPicker);
    $('#yearBackdrop').addEventListener('click', closeYearPicker);
    bindWheel('year');
    bindWheel('month');
    bindWheel('day');
    $('#yearGo').addEventListener('click', jumpToDate);

    $('#fab').addEventListener('click', function () { openSheet(); });
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#sheetBackdrop').addEventListener('click', closeSheet);

    bindSwipe($('#agendaList'));
    bindSwipe($('#dayDetailInner'));
    bindSwipe($('#planContent'));
    bindMonthSwipe();

    $('#scheduleGrid').addEventListener('click', function (e) {
      const chip = e.target.closest('.sch-chip');
      if (chip) openDetail(chip.dataset.id, chip.dataset.date || '');
    });

    // 天气：城市选择
    $('#weatherCityBtn').addEventListener('click', openCitySheet);
    $('#cityClose').addEventListener('click', closeCitySheet);
    $('#cityBackdrop').addEventListener('click', closeCitySheet);
    $('#cityResults').addEventListener('click', function (e) {
      const item = e.target.closest('[data-city-index]');
      if (!item) return;
      const c = cityResultsData[Number(item.dataset.cityIndex)];
      if (!c || !window.Weather) return;
      window.Weather.setCity(c);
      closeCitySheet();
      showToast(T('天气城市已设为 {city}', { city: c.label || c.name }));
      if (state.view === 'calendar') renderDayDetail();
      renderSettings();
    });
    $('#cityLocate').addEventListener('click', async function () {
      closeCitySheet();
      const ok = window.Weather ? await window.Weather.useCurrentLocation() : false;
      showToast(ok ? T('已使用当前位置') : T('定位不可用，请选择城市'));
      if (state.view === 'calendar') renderDayDetail();
      renderSettings();
    });
    $('#citySearch').addEventListener('input', function () {
      const q = this.value;
      if (citySearchTimer) clearTimeout(citySearchTimer);
      // 输入防抖约 300ms，避免每个按键都发一次请求
      citySearchTimer = setTimeout(function () { runCitySearch(q); }, 300);
    });
    $('#citySearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (citySearchTimer) clearTimeout(citySearchTimer);
        runCitySearch(this.value);
      }
    });

    // 地址：条目与计划共用同一张面板
    $('#addressChip').addEventListener('click', function () { openAddressSheet('item'); });
    $('#planAddressChip').addEventListener('click', function () { openAddressSheet('plan'); });
    $('#addressClose').addEventListener('click', closeAddressSheet);
    $('#addressBackdrop').addEventListener('click', closeAddressSheet);
    $('#addressResults').addEventListener('click', function (e) {
      const item = e.target.closest('[data-address-index]');
      if (!item) return;
      const addr = addressResultsData[Number(item.dataset.addressIndex)];
      if (addr) chooseAddress(addr);
    });
    $('#addressLocate').addEventListener('click', locateForAddress);
    $('#addressClear').addEventListener('click', function () {
      activeAddressDraft().address = null;
      syncAddressChips();
      closeAddressSheet();
      showToast(T('地址已清除'));
    });
    $('#addressSearch').addEventListener('input', function () {
      const q = this.value;
      if (addressSearchTimer) clearTimeout(addressSearchTimer);
      addressSearchTimer = setTimeout(function () { runAddressSearch(q); }, 320);
    });
    $('#addressSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (addressSearchTimer) clearTimeout(addressSearchTimer);
        runAddressSearch(this.value);
      }
    });
    $('#detailBody').addEventListener('click', function (e) {
      if (!e.target.closest('#detailMapBtn')) return;
      const list = detail.kind === 'plan' ? state.plans : state.items;
      const target = list.find(function (i) { return i.id === detail.itemId; });
      if (target && target.address) openAddressMap(target.address);
    });

    $('#dayDetailInner').addEventListener('click', function (e) {
      if (handleSwipeClick(e)) return;
      if (state.swipeLock && Date.now() < state.swipeLock) return;
      const cityBtn = e.target.closest('[data-weather-city]');
      if (cityBtn) { openCitySheet(); return; }
      if (handleSharedListClick(e)) return;

      const check = e.target.closest('[data-check]');
      if (check) {
        const item = state.items.find(function (i) { return i.id === check.dataset.check; });
        if (item) toggleDone(item, check, check.dataset.checkDate);
        return;
      }

      const row = e.target.closest('.row');
      if (row) {
        openDetail(row.dataset.id, row.dataset.date || '');
      }
    });

    $('#repClose').addEventListener('click', closeRepSheet);
    $('#repBackdrop').addEventListener('click', closeRepSheet);
    $('#repDone').addEventListener('click', commitRepSheet);

    $('#noteInput').addEventListener('input', function () {
      draft.note = $('#noteInput').value.slice(0, 500);
      autoGrowNote();
    });

    $('#priorityChip').addEventListener('click', function () {
      draft.priority = !draft.priority;
      syncPriorityChip();
    });

    $('#repeatChip').addEventListener('click', openRepSheet);

    $('#dateChip').addEventListener('click', openDateSheet);
    $('#dateSheetClose').addEventListener('click', closeDateSheet);
    $('#dateBackdrop').addEventListener('click', closeDateSheet);
    $('#dpDone').addEventListener('click', commitDateSheet);
    $('#dpToday').addEventListener('click', function () {
      const key = todayKey();
      const d = keyToDate(key);
      activeDateDraft().date = key;
      dateSheet.year = d.getFullYear();
      dateSheet.month = d.getMonth();
      renderDatePanel();
      syncDateChip();
    });
    $('#dpNoTime').addEventListener('click', toggleDpNoTime);
    $('#dpPrev').addEventListener('click', function () { shiftDpMonth(-1); });
    $('#dpNext').addEventListener('click', function () { shiftDpMonth(1); });
    $('#dpGrid').addEventListener('click', function (e) {
      const cell = e.target.closest('[data-dp-key]');
      if (!cell) return;
      activeDateDraft().date = cell.dataset.dpKey;
      const d = keyToDate(activeDateDraft().date);
      dateSheet.year = d.getFullYear();
      dateSheet.month = d.getMonth();
      renderDatePanel();
      syncDateChip();
    });

    ['#wheelHour', '#wheelMinute'].forEach(function (sel) {
      const el = $(sel);
      if (!el) return;
      let scrollTimer = null;
      el.addEventListener('scroll', function () {
        if (!dateSheet.open || dateSheet.syncing) return;
        markDpWheel(el);
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(applyDpWheelTime, 70);
      }, { passive: true });
    });

    $('#remindChip').addEventListener('click', function () {
      if ($('#remindEditor').hidden) openRemindEditor();
      else closeRemindEditor();
    });
    $('#remindApply').addEventListener('click', applyRemindEditor);
    $('#remindClear').addEventListener('click', function () {
      draft.remindBefore = null;
      $('#remindMinutes').value = '';
      syncRemindChip();
      closeRemindEditor();
    });
    $('#remindMinutes').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyRemindEditor();
      }
    });

    $('#detailNote').addEventListener('input', updateDetailNoteCount);
    $('#detailClose').addEventListener('click', closeDetail);
    $('#detailCloseBtn').addEventListener('click', closeDetail);
    $('#detailBackdrop').addEventListener('click', closeDetail);
    $('#detailSave').addEventListener('click', saveDetailNote);

    $('#repTypeChips').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-rep-type]');
      if (!chip) return;
      repDraft.type = chip.dataset.repType;
      if (repDraft.type === 'weekly' && !repDraft.byWeekday.length) {
        repDraft.byWeekday = [keyToDate(draft.date || todayKey()).getDay()];
      }
      if (repDraft.type === 'monthly') {
        repDraft.byMonthDay = keyToDate(draft.date || todayKey()).getDate();
      }
      if (repDraft.type === 'lunarMonthly' || repDraft.type === 'lunarYearly') {
        const lp = lunarPartsOfKey(draft.date || todayKey());
        if (!repDraft.lunarDay) repDraft.lunarDay = lp.day;
        if (repDraft.type === 'lunarYearly' && !repDraft.lunarMonth) repDraft.lunarMonth = lp.month;
      }
      renderRepTypeChips();
      renderRepBody();
    });

    $('#repBody').addEventListener('click', function (e) {
      const stepBtn = e.target.closest('[data-step-target]');
      if (stepBtn) {
        const delta = Number(stepBtn.dataset.step);
        const target = stepBtn.dataset.stepTarget;
        if (target === 'interval') {
          repDraft.interval = clampInt(repDraft.interval + delta, 1, 30, 1);
        } else if (target === 'month') {
          repDraft.byMonth = clampInt(repDraft.byMonth + delta, 1, 12, 1);
        } else if (target === 'lunarMonth') {
          repDraft.lunarMonth = clampInt(repDraft.lunarMonth + delta, 1, 12, 1);
        } else if (target === 'lunarDay') {
          repDraft.lunarDay = clampInt(repDraft.lunarDay + delta, 1, 30, 1);
        } else {
          repDraft.byMonthDay = clampInt(repDraft.byMonthDay + delta, 1, 31, 1);
        }
        renderRepBody();
        return;
      }

      const weekday = e.target.closest('[data-weekday]');
      if (weekday) {
        const index = Number(weekday.dataset.weekday);
        const pos = repDraft.byWeekday.indexOf(index);
        if (pos !== -1) {
          if (repDraft.byWeekday.length === 1) return; // 至少保留一天
          repDraft.byWeekday.splice(pos, 1);
        } else {
          repDraft.byWeekday.push(index);
          repDraft.byWeekday.sort(function (a, b) { return a - b; });
        }
        renderRepBody();
      }
    });

    $('#repUntilChips').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-until]');
      if (!chip) return;
      if (chip.dataset.until === 'forever') {
        repDraft.until = null;
      } else {
        if (!repDraft.until) repDraft.until = addDays(draft.date || todayKey(), 30);
      }
      syncRepUntil();
    });

    $('#repBody').addEventListener('change', function (e) {
      if (e.target.id === 'repTimeInput') {
        repDraft.time = e.target.value;
        return;
      }
      if (e.target.id === 'repStartYearToggle') {
        repDraft.startYearOn = e.target.checked;
        if (repDraft.startYearOn && !repDraft.startYear) {
          repDraft.startYear = keyToDate(draft.date || todayKey()).getFullYear();
        }
        renderRepBody();
        return;
      }
      if (e.target.id === 'repStartYearInput') {
        const value = e.target.value;
        repDraft.startYear = value ? clampInt(value, 1900, 2100, null) : null;
      }
    });

    $('#repUntilInput').addEventListener('change', function () {
      if ($('#repUntilInput').value) {
        repDraft.until = $('#repUntilInput').value;
        syncRepUntil();
      }
    });

    $('#categoryChips').addEventListener('click', function (e) {
      if (e.target.closest('#manageCategoryBtn')) {
        closeSheet();
        openSettings();
        return;
      }
      const chip = e.target.closest('[data-cat-chip]');
      if (!chip) return;
      const value = chip.dataset.catChip;
      draft.categoryId = value === 'none' ? null : value;
      renderCategoryChips();
    });

    $('#typeChips').addEventListener('click', function (e) {
      const chip = e.target.closest('.type-chip');
      if (!chip) return;
      draft.type = chip.dataset.type;
      syncTypeChips();
      if (draft.type !== 'todo' && !draft.time) {
        draft.time = '09:00';
        syncDateChip();
      }
    });

    $('#itemTitle').addEventListener('input', function () {
      $('#saveBtn').disabled = !$('#itemTitle').value.trim();
    });

    $('#itemTitle').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!$('#saveBtn').disabled) saveItem();
      }
    });

    $('#saveBtn').addEventListener('click', saveItem);

    // 添加计划（与新增日程独立）
    $('#planClose').addEventListener('click', closePlanSheet);
    $('#planBackdrop').addEventListener('click', closePlanSheet);

    $('#planKindChips').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-plan-kind]');
      if (!chip) return;
      planDraft.kind = chip.dataset.planKind;
      syncPlanKindChips();
    });

    $('#planDateChip').addEventListener('click', function () {
      openDateSheet('plan');
    });

    $('#planTitle').addEventListener('input', function () {
      $('#planSave').disabled = !$('#planTitle').value.trim();
    });

    $('#planTitle').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!$('#planSave').disabled) savePlan();
      }
    });

    $('#planNote').addEventListener('input', autoGrowPlanNote);

    $('#planRemindChip').addEventListener('click', function () {
      const editor = $('#planRemindEditor');
      const opening = editor.hidden;
      editor.hidden = !opening;
      if (opening) {
        $('#planRemindInput').value = typeof planDraft.remindBefore === 'number' ? planDraft.remindBefore : '';
        $('#planRemindInput').focus();
      }
    });

    $('#planRemindApply').addEventListener('click', function () {
      const raw = $('#planRemindInput').value.trim();
      const n = Number(raw);
      if (!raw || !isFinite(n) || Math.round(n) !== n || n < 1 || n > 1440) {
        $('#planRemindInput').focus();
        return;
      }
      planDraft.remindBefore = n;
      $('#planRemindEditor').hidden = true;
      syncPlanRemindChip();
    });

    $('#planRemindInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#planRemindApply').click();
      }
    });

    $('#planRemindClear').addEventListener('click', function () {
      planDraft.remindBefore = null;
      $('#planRemindInput').value = '';
      $('#planRemindEditor').hidden = true;
      syncPlanRemindChip();
    });

    $('#planPriorityChip').addEventListener('click', function () {
      planDraft.priority = !planDraft.priority;
      syncPlanPriorityChip();
    });

    $('#planCategoryChips').addEventListener('click', function (e) {
      if (e.target.closest('[data-plan-manage]')) {
        closePlanSheet();
        openSettings();
        return;
      }
      const chip = e.target.closest('[data-plan-cat]');
      if (!chip) return;
      const value = chip.dataset.planCat;
      planDraft.categoryId = value === 'none' ? null : value;
      renderPlanCategoryChips();
    });

    $('#planSave').addEventListener('click', savePlan);

    $('#snackbarAction').addEventListener('click', function () {
      if (state.undoFn) state.undoFn();
    });

    $('#settingsBtn').addEventListener('click', openSettings);
    $('#settingsClose').addEventListener('click', closeSettings);
    $('#clearAllBtn').addEventListener('click', clearAllItems);

    // 分类：点标签直接在气泡右下角弹出编辑/删除
    $('#categoryList').addEventListener('click', function (e) {
      if (e.target.closest('[data-cat-new]')) {
        closeCatPop();
        openCategoryEditor(null);
        return;
      }
      const bubble = e.target.closest('[data-cat-bubble]');
      if (!bubble) return;
      const id = bubble.dataset.catBubble;
      if (!$('#catPop').hidden && catPopId === id) {
        closeCatPop();
        return;
      }
      openCatPop(id);
    });

    $('#catPop').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cat-pop]');
      if (!btn || !catPopId) return;
      const id = catPopId;
      closeCatPop();
      if (btn.dataset.catPop === 'edit') openCategoryEditor(id);
      else openCategoryDelete(id);
    });

    document.addEventListener('pointerdown', function (e) {
      if (!$('#catPop').hidden &&
          !e.target.closest('#catPop') &&
          !e.target.closest('[data-cat-bubble]')) {
        closeCatPop();
      }
    });

    $('#settingsPage').addEventListener('scroll', function () { closeCatPop(); }, { passive: true });

    // 通用弹窗
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modalBackdrop').addEventListener('click', closeModal);
    $('#modalConfirm').addEventListener('click', submitModal);

    $('#modalSwatches').addEventListener('click', function (e) {
      const swatch = e.target.closest('[data-modal-color]');
      if (!swatch) return;
      modalColor = swatch.dataset.modalColor;
      $$('#modalSwatches .swatch').forEach(function (el) {
        el.classList.toggle('active', el === swatch);
      });
      $('#modalCustom').value = modalColor;
    });

    $('#modalCustom').addEventListener('input', function () {
      modalColor = $('#modalCustom').value;
      $$('#modalSwatches .swatch').forEach(function (el) { el.classList.remove('active'); });
    });

    $('#modalInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitModal();
      }
    });

    $('#raOk').addEventListener('click', hideReminderAlert);

    $('#exportBtn').addEventListener('click', exportJSON);
    $('#importBtn').addEventListener('click', function () {
      $('#importFile').value = '';
      $('#importFile').click();
    });

    $('#importFile').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      handleImportFile(file);
      e.target.value = '';
    });

    $('#mergeBtn').addEventListener('click', function () { applyImport('merge'); });
    $('#replaceBtn').addEventListener('click', function () { applyImport('replace'); });
    $('#cancelImportBtn').addEventListener('click', function () {
      pendingImport = null;
      $('#importPreview').hidden = true;
    });

    $('#openLocationBtn').addEventListener('click', openBackupLocation);

    $('#langRow').addEventListener('click', function (e) {
      const chip = e.target.closest('.lang-chip');
      if (!chip) return;
      changeLanguage(chip.dataset.lang);
    });

    $('#permissionGuideBtn').addEventListener('click', function () {
      openPermissionSheet();
    });

    $('#aboutEntryBtn').addEventListener('click', openAbout);
    $('#aboutClose').addEventListener('click', closeAbout);

    $('#permClose').addEventListener('click', finishPermissionIntro);
    $('#permBackdrop').addEventListener('click', finishPermissionIntro);
    $('#permLater').addEventListener('click', finishPermissionIntro);
    $('#permAllow').addEventListener('click', function () { askNotifyPermission(); });
    $('#permStorageBtn').addEventListener('click', function () { askStoragePermission(); });
    $('#permLocationBtn').addEventListener('click', function () { askLocationPermission(); });
    $('#permRecheck').addEventListener('click', function () { refreshAllPermissionStates(); });

    $('#themeToggle').addEventListener('change', function () {
      state.meta.theme = $('#themeToggle').checked ? 'dark' : 'light';
      applyTheme();
      persistMeta();
      renderSettings();
    });

    $('#agendaList').addEventListener('click', function (e) {
      if (handleSwipeClick(e)) return;
      if (state.swipeLock && Date.now() < state.swipeLock) return;
      if (handleSharedListClick(e)) return;

      const doneToggle = e.target.closest('[data-done-toggle]');
      if (doneToggle) {
        const key = doneToggle.dataset.doneToggle;
        if (state.openDoneGroups.has(key)) state.openDoneGroups.delete(key);
        else state.openDoneGroups.add(key);
        const list = $('[data-done-list="' + key + '"]');
        const open = state.openDoneGroups.has(key);
        doneToggle.classList.toggle('open', open);
        doneToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (list) list.hidden = !open;
        return;
      }

      const check = e.target.closest('[data-check]');
      if (check) {
        const item = state.items.find(function (i) { return i.id === check.dataset.check; });
        if (item) toggleDone(item, check, check.dataset.checkDate);
        return;
      }

      const row = e.target.closest('.row');
      if (row) {
        openDetail(row.dataset.id, row.dataset.date || '');
      }
    });

    $('#planContent').addEventListener('click', function (e) {
      if (e.target.closest('#planAdd')) {
        openPlanSheet('week');
        return;
      }
      const del = e.target.closest('[data-plan-del]');
      if (del) {
        askDeletePlan(del.dataset.planDel);
        return;
      }
      if (handleSwipeClick(e)) return;
      const check = e.target.closest('[data-plan-check]');
      if (check) {
        togglePlanDone(check.dataset.planCheck);
        return;
      }
      const row = e.target.closest('[data-plan-row]');
      if (row) openPlanDetail(row.dataset.planRow);
    });

    document.addEventListener('click', function (e) {
      const filterChip = e.target.closest('[data-filter]');
      if (filterChip) {
        const val = filterChip.dataset.filter;
        if (val === 'all') {
          state.agendaFilters = [];
        } else {
          const i = state.agendaFilters.indexOf(val);
          if (i === -1) state.agendaFilters.push(val);
          else state.agendaFilters.splice(i, 1);
        }
        if (state.view === 'agenda') renderAgenda();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (detail.open) closeDetail();
      else if (yearPicker.open) closeYearPicker();
      else if (repDraft.open) closeRepSheet();
      else if (addressSheet.open) closeAddressSheet();
      else if (!$('#citySheet').hidden) closeCitySheet();
      else if (!$('#permSheet').hidden) finishPermissionIntro();
      else if (state.planSheetOpen) closePlanSheet();
      else if (!$('#aboutPage').hidden) closeAbout();
      else if (state.settingsOpen) closeSettings();
      else if (state.sheetOpen) closeSheet();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (state.lastDayKey !== todayKey()) {
          state.lastDayKey = todayKey();
          renderAll();
        } else {
          renderSummary();
        }
        if (window.Weather) window.Weather.refresh();
        scheduleReminders();
      }
    });

    window.addEventListener('resize', function () {
      // 屏幕旋转后重新计算日期标签等布局
      if (state.view === 'plan') renderPlan();
    });
  }

  // ==================== 语言 ====================

  const LANG_MIRROR_KEY = 'light-schedule.lang';

  function resolveInitialLanguage() {
    try {
      const saved = localStorage.getItem(LANG_MIRROR_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    } catch (err) { /* 忽略 */ }
    const nav = (navigator.language || '').toLowerCase();
    return nav.indexOf('en') === 0 ? 'en' : 'zh';
  }

  function changeLanguage(next) {
    const target = next === 'en' ? 'en' : 'zh';
    if (!window.I18N) return;
    if (window.I18N.lang === target) {
      renderSettings();
      return;
    }

    if (detail.open) closeDetail();
    if (yearPicker.open) closeYearPicker();
    if (repDraft.open) closeRepSheet();
    if (state.planSheetOpen) closePlanSheet();
    if (state.sheetOpen) closeSheet();

    state.meta.lang = target;
    try { localStorage.setItem(LANG_MIRROR_KEY, target); } catch (err) { /* 忽略 */ }
    persistMeta();

    window.I18N.setLang(target);
    renderAll();
    renderSettings();
    updateStorageBanner();
    renderSummary();
    window.I18N.apply(document.body);
  }

  window.I18N && window.I18N.onChange(function () {
    const sheet = $('#langRow');
    if (!sheet) return;
    $$('#langRow .lang-chip').forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.lang === window.I18N.lang);
    });
  });

  // ==================== 启动 ====================

  let midnightTimer = null;

  // 每天 0 点触发一次；设备时间被改动时，30 秒兜底校验也能兜住
  function scheduleNextMidnight() {
    clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2, 0);
    const delay = Math.max(1000, next.getTime() - now.getTime());
    midnightTimer = setTimeout(function () {
      onTick();
      scheduleNextMidnight();
    }, delay);
  }

  function onTick() {
    const t = todayKey();
    if (t !== state.lastDayKey) {
      state.lastDayKey = t;
      renderAll();
      scheduleReminders();
    } else {
      renderSummary();
    }
  }

  async function boot() {
    state.agendaAnchor = todayKey();
    state.selectedDate = todayKey();
    state.lastDayKey = todayKey();
    const now = new Date();
    state.month = new Date(now.getFullYear(), now.getMonth(), 1);

    if (window.I18N) {
      window.I18N.setLang(resolveInitialLanguage());
      window.I18N.watch(document.body);
    }

    initSplash();
    bindEvents();
    renderAll();

    await detectStorage();
    updateStorageBanner();
    await loadAll();

    // 已保存过语言（在数据里）就以后者为准
    if (state.meta.lang && window.I18N && state.meta.lang !== window.I18N.lang) {
      window.I18N.setLang(state.meta.lang);
      try { localStorage.setItem(LANG_MIRROR_KEY, state.meta.lang); } catch (err) { /* 忽略 */ }
    }

    // 首次打开保持空白；只清理旧版本留下的示例条目，且只跑一次
    await migrateLegacySamples();
    await ensurePersist();

    applyTheme();
    updateStorageBanner();
    renderAll();
    scheduleReminders();
    initWeather();
    registerSW();
    scheduleNextMidnight();
    setInterval(onTick, 30000);

    await refreshNotifyState();
    // 开屏结束后，首次使用才弹出通知授权引导
    onSplashDone(function () { maybeShowPermissionIntro(); });
  }

  boot().catch(function (err) {
    console.error('启动失败：', err);
    storage.status = 'memory';
    updateStorageBanner();
    showToast(T('启动时遇到问题，已切换到内存模式'));
  });
})();
