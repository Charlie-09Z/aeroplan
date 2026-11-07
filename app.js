'use strict';

/* =========================================================
   氢计划 / AeroPlan v0.9.1
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
  const LS_DIARY_KEY = 'light-schedule.diary';
  const IDB_NAME = 'light-schedule-db';
  const IDB_STORE = 'kv';
  // 日记附件单独一个对象仓库，按 id 索引，避免把 Blob 塞进 kv 的大对象里
  const DIARY_FILE_STORE = 'diaryFiles';

  const APP_VERSION = '0.9.1';
  const POLICY_VERSION = 'privacy-1.1';
  // 生成新 keystore 后，把证书 SHA-256 指纹填在这里（README 有步骤）
  const OFFICIAL_CERT_SHA256 = '';

  // 协议正文的权威副本：只用于计算同意记录的 SHA-256。
  // 不从 DOM 取，避免中英文切换、渲染差异或构建压缩导致哈希漂移。
  const POLICY_TEXT = [
    '氢计划 隐私与使用说明',
    '生效日期：2026-11-07',
    '',
    '一、数据存放',
    '条目、计划、分类、设置和同意记录保存在本机。没有服务器，我们不持有副本。卸载或清除应用数据会删除全部本地内容。',
    '',
    '二、网络请求与数据去向',
    '天气请求只发送所选地点的经纬度（保留三位小数），发给 Open-Meteo。',
    '城市、地点和地址搜索只发送你输入的搜索关键词，发给 Photon（基于 OpenStreetMap 数据）。',
    '不会发送日程正文、备注、分类、计划、备份文件内容、账号信息、通讯录、相片或设备型号。',
    '',
    '三、权限与系统限制',
    '通知用于到点提醒；拒绝后收不到提醒。',
    'Android 12/12L 的「闹钟与提醒」用于准时触发；Android 13 及以上由系统自动授予，没有单独开关。',
    '振动用于轻触反馈；关闭不影响功能。',
    '本版本不申请存储与定位权限：备份经系统保存或分享面板完成，导入由你手动选择文件。',
    '国产系统的自启动、后台清理与省电策略可能拦截提醒，需要时请允许自启动/后台运行并设为「不限制」。',
    '',
    '四、备份文件',
    '备份是未加密的 JSON 文件，含条目、计划、分类、偏好和同意记录。请存放在可信位置。',
    '',
    '五、协议',
    '本页内容构成使用协议。协议更新时随新版本发布并标注新的生效日期，重大变更会再次提示确认。继续使用即表示你已阅读并接受本协议。',
    '',
    'AeroPlan Privacy and Terms',
    'Effective date: 2026-11-07',
    '',
    '1. Data storage',
    'Items, plans, categories, settings and the consent record stay on this device. There is no server, so we hold no copy. Uninstalling the app or clearing app data removes everything locally.',
    '',
    '2. Network requests and data',
    'Weather requests send only the coordinates of the place you selected (three decimal places) to Open-Meteo.',
    'City, place and address searches send only the keywords you type to Photon, which is based on OpenStreetMap data.',
    'We do not send event titles, notes, categories, plans, backup contents, account details, contacts, photos or the device model.',
    '',
    '3. Permissions and system limits',
    'Notifications are used for reminders. If denied, you will not receive reminders.',
    'On Android 12/12L, "Alarms and reminders" keeps reminders on time; on Android 13 and later the system grants it automatically with no separate toggle.',
    'Vibration is used for light feedback when picking dates and times. Turning it off does not affect any feature.',
    'This version requests no storage or location permission: backups go through the system save/share panel, and imports use the file you pick manually.',
    'Autostart, background cleanup and battery policies on some ROMs may block reminders. Allow autostart/background activity and set battery usage to "Unrestricted" when needed.',
    '',
    '4. Backup files',
    'A backup is an unencrypted JSON file containing items, plans, categories, preferences and the consent record. Keep it somewhere you trust.',
    '',
    '5. Terms',
    'This page forms the terms of use. Updated terms ship with a new version and carry a new effective date; major changes prompt for confirmation again. Continuing to use the app means you have read and accept these terms.'
  ].join('\n').trim();

  const MAX_CATEGORIES = 20;
  const MAX_CAT_NAME = 8;
  const STACK_LIMIT = 1;
  // 日程页按时间轴流式渲染：默认往上看 30 天历史、往下看 90 天未来，
  // 触到边界再按 30 天为一步加载，避免一次性铺满全部数据。
  const AGENDA_BACK_DAYS = 30;
  const AGENDA_FWD_DAYS = 90;
  const AGENDA_STEP_DAYS = 30;
  // 14 个经典色：彼此有明确区分度，不做连续色相渐变。
  // 两行 × 7 列的圆点布局由 CSS 控制；已存的自定义 hex 不受影响。
  const PRESET_COLORS = [
    '#E5484D', // 正红
    '#F76B15', // 橙
    '#F5A524', // 琥珀
    '#7CB342', // 草绿
    '#16A34A', // 翠绿
    '#0EA5B7', // 青
    '#3B82F6', // 天蓝
    '#4F46E5', // 靛蓝
    '#8B5CF6', // 紫
    '#C026D3', // 洋红
    '#EC4899', // 粉
    '#A16207', // 棕
    '#6B7280', // 灰
    '#1F2937'  // 黑
  ];

  // 分类内置图标：全部为内联 SVG（线性、细笔画），只随分类颜色着色，不引入字体或网络资源。
  // id 会写进分类数据与备份；改名会导致旧数据图标丢失，因此 id 固定不变。
  const CATEGORY_ICONS = [
    { id: 'book', zh: '书本 / 学习', en: 'Book', svg: '<path d="M2 4h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-4H2z"/><path d="M22 4h-6a3 3 0 0 0-3 3v13a4 4 0 0 1 4-4h5z"/>' },
    { id: 'work', zh: '工作 / 公文包', en: 'Work', svg: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>' },
    { id: 'gift', zh: '纪念日 / 礼物', en: 'Anniversary', svg: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12"/><path d="M3 13h18"/><path d="M12 9c-3 0-4.5-1.5-4.5-3A2 2 0 0 1 12 5c0 1.5-1.5 4-4.5 4"/><path d="M12 9c3 0 4.5-1.5 4.5-3A2 2 0 0 0 12 5c0 1.5 1.5 4 4.5 4"/>' },
    { id: 'flower', zh: '花朵', en: 'Flower', svg: '<circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="6.4" r="2.8"/><circle cx="17" cy="9.4" r="2.8"/><circle cx="17" cy="14.6" r="2.8"/><circle cx="12" cy="17.6" r="2.8"/><circle cx="7" cy="14.6" r="2.8"/><circle cx="7" cy="9.4" r="2.8"/>' },
    { id: 'sport', zh: '运动', en: 'Sport', svg: '<path d="M3 9v6"/><path d="M6 7v10"/><path d="M18 7v10"/><path d="M21 9v6"/><path d="M6 12h12"/>' },
    { id: 'food', zh: '餐食', en: 'Food', svg: '<path d="M3 12h18"/><path d="M5 12a7 7 0 0 0 14 0"/><path d="M4 21h16"/><path d="M9 3.5c0 1.8-1 2.8-1 4.5"/><path d="M13 3c0 1.8-1 2.8-1 4.5"/>' },
    { id: 'travel', zh: '旅行', en: 'Travel', svg: '<path d="M2.5 13.5 21.5 5l-7 16-3.4-6.6-6.6-3.4z"/><path d="M21.5 5 11.1 14.4"/>' },
    { id: 'medical', zh: '医疗', en: 'Medical', svg: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7.5v9"/><path d="M7.5 12h9"/>' },
    { id: 'home', zh: '家务', en: 'Housework', svg: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.5 20v-5.5h5V20"/>' },
    { id: 'finance', zh: '财务', en: 'Finance', svg: '<circle cx="12" cy="12" r="8"/><path d="M8.5 8.5 12 12l3.5-3.5"/><path d="M12 12v4.5"/><path d="M9 13.2h6"/>' },
    { id: 'music', zh: '音乐', en: 'Music', svg: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>' },
    { id: 'pet', zh: '宠物', en: 'Pet', svg: '<circle cx="6" cy="9" r="2"/><circle cx="10" cy="6.2" r="2"/><circle cx="14" cy="6.2" r="2"/><circle cx="18" cy="9" r="2"/><path d="M8 15c0-2 1.8-4 4-4s4 2 4 4c0 2-2 3-4 3s-4-1-4-3z"/>' },
    { id: 'cake', zh: '生日蛋糕', en: 'Birthday', svg: '<path d="M4 21h16"/><path d="M5 21v-7h14v7"/><path d="M5 16.5c1.6-1.6 2.4 1.6 4 0s2.4-1.6 4 0 2.4 1.6 4 0"/><path d="M9 11V6.5"/><path d="M12 11V5.5"/><path d="M15 11V6.5"/>' },
    { id: 'star', zh: '星标', en: 'Star', svg: '<path d="M12 3.2l2.6 5.5 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.5l5.9-.8z"/>' }
  ];
  const CATEGORY_ICON_BY_ID = {};
  CATEGORY_ICONS.forEach(function (icon) { CATEGORY_ICON_BY_ID[icon.id] = icon; });

  // 图标片段本身只有 path/circle，必须包一层 <svg> 才会被浏览器绘制；
  // 缺 viewBox 或宽高会渲染成 0×0（之前图标全空的根因就是少了这层 svg）。
  function categorySvg(inner) {
    return '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">' +
      inner + '</svg>';
  }

  function categoryGlyphHTML(cat, extraClass) {
    if (!cat || !cat.icon) return '';
    const icon = CATEGORY_ICON_BY_ID[cat.icon];
    if (!icon) return '';
    return '<span class="cat-glyph' + (extraClass ? ' ' + extraClass : '') +
      '" style="color:' + cat.color + '" aria-hidden="true">' + categorySvg(icon.svg) + '</span>';
  }

  // 有图标用图标，没有图标回落成原来的色点，绝不出现空白
  function categoryMarkHTML(cat, dotStyle) {
    const glyph = categoryGlyphHTML(cat);
    return glyph || '<i style="' + (dotStyle || '') + '"></i>';
  }

  // ---------- 状态 ----------
  const state = {
    view: 'calendar',
    month: new Date(),
    agendaAnchor: '',
    agendaBack: AGENDA_BACK_DAYS,
    agendaFwd: AGENDA_FWD_DAYS,
    agendaLoading: '',
    scheduleAnchor: '',
    items: [],
    plans: [],
    categories: [],
    agendaFilters: [],
    meta: {},
    editCategoryId: '',
    openDoneGroups: new Set(),
    expandedGroups: new Set(),
    // 批量选择：batchSel 存「id|date」形式的实例键，删除时按 id 去重
    batchMode: false,
    batchSel: new Set(),
    batchLock: 0,
    selectedDate: '',
    swipeLock: 0,
    swipeClickLock: 0,
    busyChecks: new Set(),
    snackbarTimer: null,
    undoFn: null,
    sheetOpen: false,
    planSheetOpen: false,
    editingId: '',
    planEditingId: '',
    settingsOpen: false,
    saving: false,
    reminderTimers: [],
    firedReminders: {},
    nativeReminderIds: [],
    nativeReminderGen: 0,
    // 原生排程如果被系统拒绝，这里记录原因，供「权限管理」里的状态自查直接显示
    nativeScheduleError: '',
    // 精确闹钟的当前状态；'' 表示还没检测过。denied 时排程会退化为非精确，可能延迟
    exactAlarmStatus: '',
    channelReady: false,
    // 渠道建完后从系统读回的实际参数（重要性、提示音等），自查面板据此判断是否生效
    channelInfo: null,
    // 最近一次排程的逐条诊断（自查面板的实例表直接用这份数据）
    reminderReport: [],
    lastDayKey: '',
    // 年历：捏合展开时记下正在浏览的年份；pinchActive 用于让横滑手势让位
    yearView: false,
    yearViewYear: new Date().getFullYear(),
    pinchActive: false,
    // ===== 日记 =====
    diary: [],
    diaryQuery: '',
    // all | attach | mood
    diaryFilter: 'all',
    // '' 表示全部月份，否则是 'YYYY-MM'
    diaryMonth: '',
    // timeline | grid
    diaryMode: 'timeline',
    diaryEditorOpen: false,
    diaryEditingDate: '',
    // 正在编辑的草稿：{ date, text, mood, tags, attachments, createdAt }
    diaryDraft: null,
    diaryDirty: false,
    diarySavedAt: 0,
    diaryManage: false,
    diarySel: new Set(),
    // 附件不支持时的原因（IndexedDB 不可用），空串表示可用
    diaryAttachBlocked: '',
    diaryAttachBusy: false
  };

  const storage = {
    status: 'detecting',
    db: null,
    memoryItems: [],
    memoryPlans: [],
    memoryMeta: {},
    memoryCats: [],
    memoryDiary: []
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
    const weatherTotal = (w.forecastDays || 0) + (w.pending || 0);
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
    const lunarFestival = lunarFestivalOf(lunar);
    let festival = lunarFestival || solarFestivalOf(y, m, d);
    // 清明既是节气也是传统节日，归到「跟随农历」这一类；公历/国际节日则始终显示
    let festivalKind = lunarFestival ? 'lunar' : (festival ? 'solar' : '');
    if (!festival && term === '清明') { festival = '清明'; festivalKind = 'lunar'; }
    const monthName = LUNAR_MONTH_NAMES[lunar.month - 1];
    const meta = {
      lunar: lunar,
      lunarText: lunar.day === 1
        ? (lunar.isLeap ? '闰' + monthName + '月' : '初一')
        : (lunar.isLeap ? '闰' : '') + LUNAR_DAY_NAMES[lunar.day - 1],
      lunarFull: (lunar.isLeap ? '闰' : '') + monthName + '月' + LUNAR_DAY_NAMES[lunar.day - 1],
      term: term,
      festival: festival,
      festivalKind: festivalKind
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

  function padHex(n) {
    const s = Math.round(n).toString(16);
    return s.length === 1 ? '0' + s : s;
  }

  function hexToRgb(hex) {
    const v = String(hex || '').replace('#', '');
    return {
      r: parseInt(v.slice(0, 2), 16) || 0,
      g: parseInt(v.slice(2, 4), 16) || 0,
      b: parseInt(v.slice(4, 6), 16) || 0
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }

  function hexToHsv(hex) {
    const rgb = hexToRgb(hex);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  }

  function hsvToHex(h, s, v) {
    const rgb = hsvToRgb(h, s, v);
    return '#' + padHex(rgb.r) + padHex(rgb.g) + padHex(rgb.b);
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
      // 旧数据没有 order：null 表示继续按时间/创建顺序，不强行改写
      order: typeof raw.order === 'number' && isFinite(raw.order) ? raw.order : null,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  // ==================== 日记 ====================

  // 六种心情：所有面孔共用同一个外圆，只换眼睛与嘴，保证笔画一致
  const DIARY_MOODS = [
    { id: 'happy', zh: '开心', en: 'Happy', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M8.8 14c1.9 2.1 4.5 2.1 6.4 0"/>' },
    { id: 'calm', zh: '平静', en: 'Calm', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M9.2 14.4h5.6"/>' },
    { id: 'tired', zh: '疲惫', en: 'Tired', face: '<path d="M8.2 10.2h2.2M13.6 10.2h2.2"/><path d="M9.6 14.6c1.5.9 3.3.9 4.8 0"/>' },
    { id: 'sad', zh: '难过', en: 'Sad', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M8.8 15.2c1.9-2.1 4.5-2.1 6.4 0"/>' },
    { id: 'annoyed', zh: '烦躁', en: 'Irritated', face: '<path d="M8.4 9.4l2.4 1M15.6 9.4l-2.4 1"/><path d="M9.2 15c.9-1 1.7-1 2.6 0s1.7 1 2.6 0"/>' },
    { id: 'hopeful', zh: '期待', en: 'Hopeful', face: '<path d="M9 10.4h.01M15 10.4h.01"/><circle cx="12" cy="14.8" r="1.5"/>' }
  ];
  const DIARY_MOOD_IDS = DIARY_MOODS.map(function (m) { return m.id; });

  // 附件上限：单篇 20 个、单个 20MB、整体 500MB
  const DIARY_MAX_FILES = 20;
  const DIARY_MAX_FILE_BYTES = 20 * 1024 * 1024;
  const DIARY_STORE_LIMIT = 500 * 1024 * 1024;
  const DIARY_IMG_MAX = 1600;
  const DIARY_IMG_QUALITY = 0.82;
  const DIARY_THUMB_MAX = 320;
  const DIARY_THUMB_QUALITY = 0.72;
  // 标题上限 60 字；视频单篇最多 1 个、单个 50MB。
  // WebView 里无法转码，视频原样入库，只抽首帧做封面（约 320px）。
  const DIARY_TITLE_MAX = 60;
  const DIARY_MAX_VIDEOS = 1;
  const DIARY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
  const DIARY_VIDEO_COVER_MAX = 320;

  function moodMeta(id) {
    for (let i = 0; i < DIARY_MOODS.length; i++) {
      if (DIARY_MOODS[i].id === id) return DIARY_MOODS[i];
    }
    return null;
  }

  function moodLabel(id) {
    const m = moodMeta(id);
    return m ? (isEn() ? m.en : m.zh) : '';
  }

  // 面孔：24 网格、1.6 描边，和底部导航同一套线性语言
  function moodIconHTML(id, cls) {
    const m = moodMeta(id);
    if (!m) return '';
    return '<svg class="' + (cls || 'mood-ico') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="8.2"/>' + m.face + '</svg>';
  }

  function normalizeDiaryAttachment(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' ? raw.id : '';
    const name = String(raw.name || '').trim().slice(0, 200);
    if (!id || !name) return null;
    const kind = raw.kind === 'image' ? 'image' : (raw.kind === 'video' ? 'video' : 'file');
    return {
      id: id,
      name: name,
      type: typeof raw.type === 'string' ? raw.type : '',
      size: Number(raw.size) > 0 ? Math.round(Number(raw.size)) : 0,
      kind: kind,
      w: Number(raw.w) > 0 ? Math.round(Number(raw.w)) : 0,
      h: Number(raw.h) > 0 ? Math.round(Number(raw.h)) : 0,
      duration: Number(raw.duration) > 0 ? Math.round(Number(raw.duration)) : 0
    };
  }

  // 位置：省市来自内置表（完全离线），具体位置是用户自己写的一行，全部可选
  function normalizeDiaryLocation(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const province = String(raw.province || '').trim().slice(0, 20);
    const city = String(raw.city || '').trim().slice(0, 20);
    const text = String(raw.text || '').trim().slice(0, 60);
    if (!province && !city && !text) return null;
    return { province: province, city: city, text: text };
  }

  function normalizeDiary(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';
    if (!date || isNaN(keyToDate(date).getTime())) return null;
    const mood = DIARY_MOOD_IDS.indexOf(raw.mood) !== -1 ? raw.mood : '';
    const tags = Array.isArray(raw.tags)
      ? raw.tags.filter(function (t) { return typeof t === 'string' && t.trim(); })
          .map(function (t) { return t.trim().slice(0, 16); })
          .slice(0, 12)
      : [];
    const attachments = Array.isArray(raw.attachments)
      ? raw.attachments.map(normalizeDiaryAttachment).filter(Boolean).slice(0, DIARY_MAX_FILES)
      : [];
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, DIARY_TITLE_MAX) : '';
    const location = normalizeDiaryLocation(raw.location);
    const text = typeof raw.text === 'string' ? raw.text.slice(0, 50000) : '';
    // 完全空的记录直接丢弃：旧版本或异常退出可能留下空壳。
    // 只有标题、只有位置也属于有效记录。
    if (!text.trim() && !title && !mood && !tags.length && !attachments.length && !location) return null;
    return {
      date: date,
      title: title,
      text: text,
      mood: mood,
      tags: tags,
      location: location,
      attachments: attachments,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  function sortDiary() {
    state.diary.sort(function (a, b) { return b.date.localeCompare(a.date); });
  }

  function diaryByDate(date) {
    for (let i = 0; i < state.diary.length; i++) {
      if (state.diary[i].date === date) return state.diary[i];
    }
    return null;
  }

  // 字数按「非空白字符」算，和写作页右下角显示保持一致
  function diaryWordCount(text) {
    return String(text || '').replace(/\s/g, '').length;
  }

  function diaryHasFiles(entry) {
    return !!(entry && entry.attachments && entry.attachments.length);
  }

  // 统计附件占用：只按元数据里的 size 估算，不必读 Blob
  function diaryUsedBytes() {
    let total = 0;
    state.diary.forEach(function (entry) {
      (entry.attachments || []).forEach(function (a) { total += a.size || 0; });
    });
    return total;
  }

  function diaryCoverAttachment(entry) {
    if (!entry || !entry.attachments) return null;
    for (let i = 0; i < entry.attachments.length; i++) {
      if (entry.attachments[i].kind === 'image') return entry.attachments[i];
    }
    // 没有图片时用视频首帧封面
    for (let i = 0; i < entry.attachments.length; i++) {
      if (entry.attachments[i].kind === 'video') return entry.attachments[i];
    }
    return null;
  }

  async function persistDiary(silent) {
    sortDiary();
    const snapshot = state.diary.map(function (entry) {
      return {
        date: entry.date,
        title: entry.title || '',
        text: entry.text,
        mood: entry.mood,
        tags: entry.tags.slice(),
        location: entry.location ? Object.assign({}, entry.location) : null,
        attachments: entry.attachments.map(function (a) { return Object.assign({}, a); }),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    });
    try {
      if (storage.status === 'idb') {
        await idbSet('diary', snapshot);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_DIARY_KEY, JSON.stringify(snapshot));
      } else {
        storage.memoryDiary = snapshot;
      }
      return true;
    } catch (err) {
      console.error('日记保存失败：', err);
      if (!silent) showToast(T('日记保存失败，请重试'));
      return false;
    }
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
      // 旧数据没有 icon 字段，读取时为 null，渲染回落成色点
      icon: typeof raw.icon === 'string' && CATEGORY_ICON_BY_ID[raw.icon] ? raw.icon : null,
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
        // v2：新增 diaryFiles，用来按 id 存日记附件的原图/文件与缩略图
        req = indexedDB.open(IDB_NAME, 2);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(DIARY_FILE_STORE)) {
          db.createObjectStore(DIARY_FILE_STORE, { keyPath: 'id' });
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

  // 同一个事务里写多组键：删除全部数据时避免出现「记录清了、数据还在」的中间态
  function idbSetMany(entries) {
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = storage.db.transaction(IDB_STORE, 'readwrite');
      } catch (err) {
        reject(err);
        return;
      }
      const store = tx.objectStore(IDB_STORE);
      entries.forEach(function (pair) { store.put({ key: pair[0], value: pair[1] }); });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error || new Error('写入失败')); };
      tx.onabort = function () { reject(tx.error || new Error('写入被中断')); };
    });
  }

  // ===== 日记附件（diaryFiles 仓库，keyPath = id）=====
  function diaryFilePut(record) {
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = storage.db.transaction(DIARY_FILE_STORE, 'readwrite');
      } catch (err) {
        reject(err);
        return;
      }
      tx.objectStore(DIARY_FILE_STORE).put(record);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error || new Error('附件写入失败')); };
      tx.onabort = function () { reject(tx.error || new Error('附件写入被中断')); };
    });
  }

  function diaryFileGet(id) {
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = storage.db.transaction(DIARY_FILE_STORE, 'readonly');
      } catch (err) {
        reject(err);
        return;
      }
      const req = tx.objectStore(DIARY_FILE_STORE).get(id);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function diaryFileDelete(ids) {
    if (!ids || !ids.length) return Promise.resolve(true);
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = storage.db.transaction(DIARY_FILE_STORE, 'readwrite');
      } catch (err) {
        reject(err);
        return;
      }
      const store = tx.objectStore(DIARY_FILE_STORE);
      ids.forEach(function (id) { store.delete(id); });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error || new Error('附件删除失败')); };
      tx.onabort = function () { reject(tx.error || new Error('附件删除被中断')); };
    });
  }

  function diaryFileClear() {
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = storage.db.transaction(DIARY_FILE_STORE, 'readwrite');
      } catch (err) {
        reject(err);
        return;
      }
      tx.objectStore(DIARY_FILE_STORE).clear();
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error || new Error('附件清空失败')); };
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
    let diary = [];
    try {
      if (storage.status === 'idb') {
        items = (await idbGet('items')) || [];
        cats = (await idbGet('categories')) || [];
        plans = (await idbGet('plans')) || [];
        meta = (await idbGet('meta')) || {};
        diary = (await idbGet('diary')) || [];
      } else if (storage.status === 'local') {
        items = JSON.parse(localStorage.getItem(LS_ITEMS_KEY) || '[]');
        cats = JSON.parse(localStorage.getItem(LS_CATS_KEY) || '[]');
        plans = JSON.parse(localStorage.getItem(LS_PLANS_KEY) || '[]');
        meta = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}');
        diary = JSON.parse(localStorage.getItem(LS_DIARY_KEY) || '[]');
      } else {
        items = storage.memoryItems;
        cats = storage.memoryCats;
        plans = storage.memoryPlans;
        meta = storage.memoryMeta;
        diary = storage.memoryDiary;
      }
    } catch (err) {
      console.warn('读取本地数据失败：', err);
    }

    if (!Array.isArray(items)) items = [];
    if (!Array.isArray(cats)) cats = [];
    if (!Array.isArray(plans)) plans = [];
    if (!Array.isArray(diary)) diary = [];
    if (!meta || typeof meta !== 'object') meta = {};

    state.categories = cats.map(normalizeCategory).filter(Boolean).slice(0, MAX_CATEGORIES);
    sortCategories();
    state.items = items.map(normalizeItem).filter(Boolean);
    state.plans = plans.map(normalizePlan).filter(Boolean);
    // 日记以 date 为唯一键：旧备份里万一有重复日期，保留更新时间较晚的那条
    const diaryByDate = {};
    diary.forEach(function (raw) {
      const record = normalizeDiary(raw);
      if (!record) return;
      const prev = diaryByDate[record.date];
      if (!prev || record.updatedAt >= prev.updatedAt) diaryByDate[record.date] = record;
    });
    state.diary = Object.keys(diaryByDate).map(function (k) { return diaryByDate[k]; });
    sortDiary();
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
      return true;
    } catch (err) {
      console.warn('设置保存失败：', err);
      return false;
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
      if (state.yearView) {
        title.textContent = isEn() ? String(state.yearViewYear) : state.yearViewYear + ' 年';
      } else {
        title.textContent = isEn()
          ? MONTH_EN[state.month.getMonth()] + ' ' + state.month.getFullYear()
          : state.month.getFullYear() + '年' + (state.month.getMonth() + 1) + '月';
      }
      prev.hidden = false;
      next.hidden = false;
      onToday = state.yearView
        ? state.yearViewYear === td.getFullYear()
        : state.month.getFullYear() === td.getFullYear() && state.month.getMonth() === td.getMonth();
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
    } else if (state.view === 'diary') {
      title.textContent = T('日记');
      prev.hidden = true;
      next.hidden = true;
    } else {
      title.textContent = T('计划');
      prev.hidden = true;
      next.hidden = true;
    }

    $('#todayBtn').classList.toggle('is-current', onToday);
  }

  function renderSummary() {
    if (state.batchMode) {
      // 批量操作栏占用顶部位置，汇总提示先让位
      $('#summaryBar').hidden = true;
      return;
    }
    if (state.view === 'plan' || state.view === 'diary') {
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

  // ==================== 节假日（内置数据表，离线可用，不联网） ====================
  // 覆盖 2024–2027 年国务院办公厅公布的放假/调休安排。
  // 表外年份如实降级：不绘制「假 / 班」标记，不猜测。
  const HOLIDAY_RANGES = [
    ['2024-01-01', '2024-01-01', '元旦'],
    ['2024-02-10', '2024-02-17', '春节'],
    ['2024-04-04', '2024-04-06', '清明'],
    ['2024-05-01', '2024-05-05', '劳动节'],
    ['2024-06-08', '2024-06-10', '端午'],
    ['2024-09-15', '2024-09-17', '中秋'],
    ['2024-10-01', '2024-10-07', '国庆'],
    ['2025-01-01', '2025-01-01', '元旦'],
    ['2025-01-28', '2025-02-04', '春节'],
    ['2025-04-04', '2025-04-06', '清明'],
    ['2025-05-01', '2025-05-05', '劳动节'],
    ['2025-05-31', '2025-06-02', '端午'],
    ['2025-10-01', '2025-10-08', '国庆中秋'],
    ['2026-01-01', '2026-01-03', '元旦'],
    ['2026-02-15', '2026-02-23', '春节'],
    ['2026-04-04', '2026-04-06', '清明'],
    ['2026-05-01', '2026-05-05', '劳动节'],
    ['2026-06-19', '2026-06-21', '端午'],
    ['2026-09-25', '2026-09-27', '中秋'],
    ['2026-10-01', '2026-10-07', '国庆'],
    ['2027-01-01', '2027-01-03', '元旦'],
    ['2027-02-05', '2027-02-13', '春节'],
    ['2027-04-03', '2027-04-05', '清明'],
    ['2027-05-01', '2027-05-05', '劳动节'],
    ['2027-06-09', '2027-06-09', '端午'],
    ['2027-09-15', '2027-09-15', '中秋'],
    ['2027-10-01', '2027-10-07', '国庆']
  ];
  const HOLIDAY_WORKDAYS = [
    ['2024-02-04', '春节调休'], ['2024-02-18', '春节调休'], ['2024-04-07', '清明调休'],
    ['2024-04-28', '劳动节调休'], ['2024-05-11', '劳动节调休'], ['2024-09-14', '中秋调休'],
    ['2024-09-29', '国庆调休'], ['2024-10-12', '国庆调休'],
    ['2025-01-26', '春节调休'], ['2025-02-08', '春节调休'], ['2025-04-27', '劳动节调休'],
    ['2025-09-28', '国庆调休'], ['2025-10-11', '国庆调休'],
    ['2026-01-04', '元旦调休'], ['2026-02-14', '春节调休'], ['2026-02-28', '春节调休'],
    ['2026-05-09', '劳动节调休'], ['2026-09-20', '国庆调休'], ['2026-10-10', '国庆调休'],
    ['2027-01-31', '春节调休'], ['2027-02-14', '春节调休'], ['2027-05-08', '劳动节调休'],
    ['2027-09-26', '国庆调休'], ['2027-10-09', '国庆调休']
  ];
  let holidayMap = null;

  function buildHolidayMap() {
    const map = {};
    HOLIDAY_RANGES.forEach(function (r) {
      let key = r[0];
      while (key <= r[1]) {
        map[key] = { type: 'holiday', name: r[2] };
        key = addDays(key, 1);
      }
    });
    HOLIDAY_WORKDAYS.forEach(function (w) {
      map[w[0]] = { type: 'workday', name: w[1] };
    });
    return map;
  }

  // 节假日标记跟随「农历」开关：关掉农历就一并隐藏，不单独提供开关
  function holidayInfo(key) {
    if (!lunarVisible()) return null;
    if (!holidayMap) holidayMap = buildHolidayMap();
    return holidayMap[key] || null;
  }

  function holidayCoveredYear(year) {
    return year >= 2024 && year <= 2027;
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
    // 日记按日期建索引，日历格只关心「有没有」
    const diaryDates = {};
    state.diary.forEach(function (entry) { diaryDates[entry.date] = entry; });

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
        dayItems.length && !undone.length ? 'all-done' : '',
        diaryDates[key] ? 'has-diary' : ''
      ].filter(Boolean).join(' ');

      let dots = '';
      dotColors.slice(0, 3).forEach(function (color) {
        dots += '<span class="dot" style="background:' + color + '"></span>';
      });
      // 日记用 2px 中性圆点，和 5px 的分类色点区分，且排在前面不挤占色点位置
      if (diaryDates[key]) {
        dots = '<span class="diary-dot" aria-hidden="true"></span>' + dots;
      }

      const meta = dayMeta(key);
      const hol = holidayInfo(key);
      // 农历开关（默认开）统一管辖：农历日期、二十四节气、中国传统节日、假/班标记。
      // 公历/国际节日（元旦、情人节、母亲节等）不受影响，始终显示。
      const showLunar = lunarVisible();
      const tradFestival = showLunar && meta.festivalKind === 'lunar' ? meta.festival : '';
      const solarFestival = meta.festivalKind === 'solar' ? meta.festival : '';
      const mainFestival = tradFestival || solarFestival;
      const subText = isEn()
        ? (mainFestival ? T(mainFestival) : (showLunar ? meta.lunarText : ''))
        : (mainFestival || (showLunar ? meta.term : '') || (showLunar ? meta.lunarText : ''));
      const subClass = mainFestival ? ' is-festival'
        : ((showLunar && meta.term) ? ' is-term' : '');

      const ariaTextBase = isEn()
        ? monthDay(key) + ' ' + weekdayOf(key) +
          (showLunar ? ' ' + meta.lunarFull : '') +
          (mainFestival ? ', ' + T(mainFestival) : '') +
          ', ' + T('{n} 项安排', { n: dayItems.length })
        : monthDay(key) + ' ' + weekdayOf(key) + ' ' + (showLunar ? meta.lunarFull : '') +
          (showLunar && meta.term ? ' ' + meta.term : '') + (mainFestival ? ' ' + mainFestival : '') +
          '，' + dayItems.length + ' 项安排';
      const ariaText = ariaTextBase + (diaryDates[key] ? (isEn() ? ', journal entry' : '，有日记') : '') +
        (hol ? (isEn() ? ', ' + (hol.type === 'workday' ? 'make-up workday' : 'public holiday')
          : '，' + (hol.type === 'workday' ? '调休上班' : hol.name + '假期')) : '');

      // 「假 / 班」标记固定在内层日期格右下角内侧，绘制在文字下层，不遮日期数字
      const holBadge = hol
        ? '<span class="cal-holiday ' + hol.type + '" aria-hidden="true">' +
          (hol.type === 'workday' ? '班' : '假') + '</span>'
        : '';

      html += '<button class="' + classes + '" type="button" data-date="' + key +
        '" aria-label="' + esc(ariaText) + '">' +
        holBadge +
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
    // 没有安排时整条不显示，避免右侧留下空槽把「日程 / 待办」图例挤偏
    $('#monthStat').hidden = monthItems.length === 0;
    $('#monthStat').textContent = monthItems.length
      ? T('本月 {n} 项 · 已完成 {m} 项', { n: monthItems.length, m: monthDone })
      : '';

    const isEmpty = state.items.length === 0;
    $('#calendarEmpty').hidden = !isEmpty;
    $('#calTip').hidden = isEmpty;
    // 只保留当前浏览窗口前后的换算缓存，翻到别的年月也不会无限累积
    pruneDateCaches(dateKey(state.month));
  }

  // ==================== 年历：双指捏合进出，12 个月一屏平铺 ====================
  function renderYearView() {
    const grid = $('#yearGrid');
    if (!grid) return;
    const y = state.yearViewYear;
    const title = $('#yearTitle');
    if (title) title.textContent = isEn() ? String(y) : y + ' 年';
    const today = todayKey();
    const selMonth = state.month.getFullYear() === y ? state.month.getMonth() : -1;
    let html = '';
    for (let m = 0; m < 12; m++) {
      const days = new Date(y, m + 1, 0).getDate();
      const lead = (new Date(y, m, 1).getDay() + 6) % 7;
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<span class="ym-day out"></span>';
      for (let d = 1; d <= days; d++) {
        const key = y + '-' + pad2(m + 1) + '-' + pad2(d);
        const hol = holidayInfo(key);
        cells += '<span class="ym-day' + (key === today ? ' today' : '') + '">' + d +
          (hol ? '<i class="ym-holiday-dot' + (hol.type === 'workday' ? ' work' : '') + '"></i>' : '') +
          '</span>';
      }
      html += '<button class="ym-card' + (m === selMonth ? ' current' : '') + '" type="button" data-month="' + m + '">' +
        '<span class="ym-name">' + esc(isEn() ? MONTH_EN[m] : (m + 1) + ' 月') + '</span>' +
        '<span class="ym-days">' + cells + '</span>' +
      '</button>';
    }
    grid.innerHTML = html;
  }

  function openYearView() {
    if (state.view !== 'calendar' || state.yearView) return;
    state.yearView = true;
    state.yearViewYear = state.month.getFullYear();
    $('#calMonth').hidden = true;
    $('#yearView').hidden = false;
    renderYearView();
    $('#content').scrollTop = 0;
    haptic(8);
  }

  function closeYearView() {
    if (!state.yearView) return;
    state.yearView = false;
    $('#yearView').hidden = true;
    $('#calMonth').hidden = false;
    haptic(6);
  }

  function shiftYearView(dir) {
    state.yearViewYear += dir;
    renderYearView();
    haptic(6);
  }

  // 点某个月：进入该月月历
  function pickYearMonth(m) {
    state.month = new Date(state.yearViewYear, m, 1);
    state.selectedDate = '';
    closeYearView();
    renderCalendar();
    updateTopbar();
    $('#content').scrollTop = 0;
  }

  function bindPinchYear() {
    const month = $('#calMonth');
    const year = $('#yearView');
    if (!month || !year) return;

    const MIN_MOVE = 8;
    const PINCH_IN = 1.18;   // 两指张开 18% 才进入年历，避免误触
    const PINCH_OUT = 0.84;  // 在年历里捏合到 84% 才回到月历
    let startDist = 0;
    let pinching = false;

    function distance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function onStart(e) {
      if (e.touches.length !== 2) return;
      startDist = distance(e.touches);
      pinching = false;
      state.pinchActive = true;
    }

    function onMove(e) {
      if (e.touches.length !== 2 || !startDist) return;
      const ratio = distance(e.touches) / startDist;
      if (!pinching && ratio >= PINCH_IN && !state.yearView) {
        pinching = true;
        openYearView();
        return;
      }
      if (!pinching && ratio <= PINCH_OUT && state.yearView) {
        pinching = true;
        closeYearView();
      }
    }

    function onEnd(e) {
      if (e.touches.length === 0) {
        startDist = 0;
        pinching = false;
        state.pinchActive = false;
      }
    }

    [month, year].forEach(function (el) {
      el.addEventListener('touchstart', onStart, { passive: true });
      el.addEventListener('touchmove', onMove, { passive: true });
      el.addEventListener('touchend', onEnd, { passive: true });
      el.addEventListener('touchcancel', onEnd, { passive: true });
    });

    // 年历：点月份进入；左右滑（单指）切年份
    let pid = null;
    let sx = 0;
    let sy = 0;
    let lock = '';
    year.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      lock = '';
    });
    year.addEventListener('pointermove', function (e) {
      if (pid === null || e.pointerId !== pid) return;
      const mx = e.clientX - sx;
      const my = e.clientY - sy;
      if (!lock) {
        if (Math.abs(mx) < MIN_MOVE && Math.abs(my) < MIN_MOVE) return;
        lock = Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v';
        if (lock === 'h') {
          try { year.setPointerCapture(pid); } catch (err) { /* 忽略 */ }
        }
      }
    }, { passive: true });
    year.addEventListener('pointerup', function (e) {
      if (pid === null || e.pointerId !== pid) return;
      const mx = e.clientX - sx;
      pid = null;
      if (lock === 'h' && Math.abs(mx) > Math.min(56, (year.clientWidth || 360) * 0.16)) {
        shiftYearView(mx < 0 ? 1 : -1);
      }
      lock = '';
    });
    year.addEventListener('click', function (e) {
      const card = e.target.closest('.ym-card');
      if (!card) return;
      pickYearMonth(Number(card.dataset.month));
    });
  }

  function lunarVisible() {
    return state.meta.lunarVisible !== false;
  }

  // 选中日期后把内容区滚回顶部：月历在正常文档流里，详情紧跟在下方。
  // （原来的粘顶周条与收起逻辑已整体移除）
  function revealDayDetail() {
    if (state.view !== 'calendar') return;
    const scroller = $('#content');
    if (!scroller) return;
    scroller.scrollTop = 0;
    requestAnimationFrame(function () {
      const sc = $('#content');
      if (sc) sc.scrollTop = 0;
    });
  }

  // ==================== 黄历卡片（纯离线推算，不联网、不新增权限） ====================
  const ALM_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ALM_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ALM_ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const ALM_JIAN = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];
  const ALM_JIAN_YI = [
    '出行、上任、会友', '扫舍、治病、解除', '祭祀、祈福、开市', '修路、整地、平治',
    '冠笄、嫁娶、安床', '捕捉、嫁娶、修造', '破屋、求医、拆卸', '安床、祭祀、修造',
    '开市、嫁娶、立券', '纳财、收账、栽种', '开市、出行、求财', '安葬、筑堤、补垣'
  ];
  const ALM_JIAN_JI = [
    '动土、开仓、安葬', '出行、开市', '安葬、上任', '开渠、栽种',
    '出行、诉讼', '开市、出行', '嫁娶、开市、动土', '出行、登高',
    '诉讼、安葬', '出行、安葬', '安葬、动土', '开市、出行'
  ];
  const ALM_GODS = ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'];
  const ALM_GOD_GOOD = [1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0];
  // 月建 → 青龙起始日支：寅申起子、卯酉起寅、辰戌起辰、巳亥起午、子午起申、丑未起戌
  const ALM_GOD_START = { 2: 0, 8: 0, 3: 2, 9: 2, 4: 4, 10: 4, 5: 6, 11: 6, 0: 8, 6: 8, 1: 10, 7: 10 };
  const almanacCache = {};

  function almanacVisible() {
    // 黄历是中文语境内容，英文界面不展示；用户关掉开关也不展示
    return !isEn() && state.meta.almanacVisible !== false;
  }

  // 天气总开关：老数据没有该字段时默认开启
  function weatherEnabled() {
    return state.meta.weatherEnabled !== false;
  }

  function almanacOf(key) {
    if (almanacCache[key]) return almanacCache[key];
    const d = keyToDate(key);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const jdn = Math.floor(Date.UTC(y, m - 1, day) / 86400000) + 2440588;
    const cycleIdx = ((jdn + 49) % 60 + 60) % 60;
    const yearBranchOfGZ = cycleIdx % 12;
    const dayBranch = cycleIdx % 12;

    // 立春换年：立春之前仍算上一干支年
    const terms = solarTermsOfYear(y);
    let lichunDay = 4;
    Object.keys(terms).forEach(function (k) {
      if (terms[k] === '立春') lichunDay = Number(k.split('-')[1]);
    });
    const gzYear = (m < 2 || (m === 2 && day < lichunDay)) ? y - 1 : y;
    const yearStem = ((gzYear - 4) % 10 + 10) % 10;
    const yearBranch = ((gzYear - 4) % 12 + 12) % 12;

    // 节气定月建：取最近一个「节」（立春→寅、惊蛰→卯……小寒→丑）
    const bounds = [
      ['立春', 2], ['惊蛰', 3], ['清明', 4], ['立夏', 5], ['芒种', 6], ['小暑', 7],
      ['立秋', 8], ['白露', 9], ['寒露', 10], ['立冬', 11], ['大雪', 12], ['小寒', 1]
    ];
    const today = Date.UTC(y, m - 1, day);
    const monthBranch = (function () {
      let bestStamp = -1;
      let branch = 1;
      [y, y - 1].forEach(function (yy) {
        const map = solarTermsOfYear(yy);
        bounds.forEach(function (b) {
          Object.keys(map).forEach(function (k) {
            const km = Number(k.split('-')[0]);
            if (km !== b[1] || map[k] !== b[0]) return;
            const stamp = Date.UTC(yy, km - 1, Number(k.split('-')[1]));
            if (stamp > today || stamp <= bestStamp) return;
            bestStamp = stamp;
            branch = km === 12 ? 0 : km === 1 ? 1 : km;
          });
        });
      });
      return branch;
    })();

    // 五虎遁：由年干推寅月天干，再顺推到当前月
    const baseStem = [2, 4, 6, 8, 0][yearStem % 5];
    const monthStem = (baseStem + ((monthBranch - 2 + 12) % 12)) % 10;

    const jianOffset = ((dayBranch - monthBranch + 12) % 12);
    const godIdx = ((dayBranch - ALM_GOD_START[monthBranch]) + 12) % 12;
    const chongBranch = (dayBranch + 6) % 12;
    const shaDir = [8, 0, 4].indexOf(dayBranch) >= 0 ? '南'
      : [2, 6, 10].indexOf(dayBranch) >= 0 ? '北'
      : [5, 9, 1].indexOf(dayBranch) >= 0 ? '东' : '西';

    const out = {
      yearGZ: ALM_STEMS[yearStem] + ALM_BRANCHES[yearBranch],
      monthGZ: ALM_STEMS[monthStem] + ALM_BRANCHES[monthBranch],
      dayGZ: ALM_STEMS[cycleIdx % 10] + ALM_BRANCHES[yearBranchOfGZ],
      yi: ALM_JIAN_YI[jianOffset],
      ji: ALM_JIAN_JI[jianOffset],
      jian: ALM_JIAN[jianOffset],
      chong: '冲' + ALM_ZODIAC[chongBranch] + ' · 煞' + shaDir,
      god: ALM_GODS[godIdx],
      godGood: ALM_GOD_GOOD[godIdx] === 1
    };
    almanacCache[key] = out;
    return out;
  }

  function almanacCardHTML(key) {
    if (!almanacVisible()) return '';
    const a = almanacOf(key);
    return '<div class="dd-almanac" aria-label="' + esc(T('黄历')) + '">' +
      '<div class="alm-top">' +
        '<span class="alm-title">' + esc(T('黄历')) + '</span>' +
        '<span class="alm-ganzhi">' + esc(a.yearGZ + '年 · ' + a.monthGZ + '月 · ' + a.dayGZ + '日') + '</span>' +
      '</div>' +
      '<div class="alm-line"><b class="alm-tag ok">' + esc(T('宜')) + '</b><span>' + esc(a.yi) + '</span></div>' +
      '<div class="alm-line"><b class="alm-tag no">' + esc(T('忌')) + '</b><span>' + esc(a.ji) + '</span></div>' +
      '<div class="alm-foot">' +
        '<span>' + esc(T('冲煞')) + '：' + esc(a.chong) + '</span>' +
        '<span>' + esc(T('值神')) + '：' + esc(a.god) + (a.godGood ? '（黄道）' : '（黑道）') + '</span>' +
      '</div>' +
    '</div>';
  }

  // ==================== 渲染：日历下方「当日详情」 ====================

  function swipeRowHTML(item, opts, stack) {
    // groupOnly：同一折叠组里除首张外的可见卡片，只带组标识（供批量整组选择），
    // 不画堆叠层、不参与左滑锁定，视觉上与普通卡片一致
    const headRow = !!stack && !stack.groupOnly;
    // 收起时固定露出 2 层；组内超过 3 项时最外层再收窄并淡一档表示「还有更多」
    const moreLayers = headRow && (stack.count || 0) > 3;
    const layers = headRow
      ? '<div class="stack-layers' + (stack.hidden ? ' is-open' : '') + (moreLayers ? ' is-more' : '') +
        '" data-layers="' + stack.key + '" aria-hidden="true"><i class="l1"></i><i class="l2"></i></div>'
      : '';
    const locked = headRow && stack.locked;
    const batchOn = state.batchMode && state.batchSel.has(item.id + '|' + item.date);
    return '<div class="swipe' + (headRow ? ' swipe-stack' : '') + (locked ? ' swipe-locked' : '') +
        (batchOn ? ' batch-on' : '') +
        '" data-id="' + item.id + '" data-date="' + item.date + '"' +
        (stack ? ' data-stack-group="' + stack.key + '"' : '') +
        (headRow ? ' data-stack-head="' + stack.key + '"' : '') + '>' +
      '<button class="swipe-edit" type="button" data-swipe-edit="' + item.id + '" aria-label="编辑这条安排">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 19.8h4L19.4 8.6a1.8 1.8 0 0 0 0-2.6l-1.4-1.4a1.8 1.8 0 0 0-2.6 0L4.2 15.8v4z"/><path d="M13.6 6.6l3.8 3.8"/></svg>' +
      '</button>' +
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

    // 关闭天气时右侧列整体移除，左侧日期块占满整行（不留 gap 空位）
    const headBlock = document.querySelector('.cal-head-block');
    if (headBlock) headBlock.classList.toggle('weather-off', !weatherEnabled());

    const key = state.selectedDate;
    if (!key) {
      box.classList.remove('open');
      const head = $('#ddHead');
      if (head) { head.hidden = true; head.innerHTML = ''; }
      if (window.Weather) window.Weather.render($('#ddWeather'), '');
      return;
    }

    const meta = dayMeta(key);
    const d = keyToDate(key);
    const items = expandOccurrences(state.items, key, key).sort(compareAgenda);
    const total = items.length;

    const subParts = [];
    // 农历关闭时，农历、节气、传统节日、节假日信息一起隐藏；公历/国际节日照常
    const showLunar = lunarVisible();
    if (showLunar) subParts.push(meta.lunarFull);
    if (showLunar && !isEn() && meta.term && meta.term !== meta.festival) subParts.push(meta.term);
    if (meta.festival && (showLunar || meta.festivalKind === 'solar')) {
      subParts.push(isEn() ? T(meta.festival) : meta.festival);
    }
    // 节假日：与公历/农历/节气/节日同一行补充「国庆假期 · 放假」或「调休 · 上班」
    const hol = showLunar ? holidayInfo(key) : null;
    if (hol) {
      subParts.push(isEn()
        ? (hol.type === 'workday' ? T('调休 · 上班') : T(hol.name) + ' · ' + T('放假'))
        : (hol.type === 'workday' ? '调休 · 上班' : hol.name + '假期 · 放假'));
    }

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
        // 第一张承载堆叠视觉与锁定；其余可见卡片也带组标识，供「全选本组」完整选中
        rows += swipeRowHTML(item, undefined,
          stacked ? (i === 0 ? { key: stackKey, hidden: expanded, locked: !expanded, count: g.items.length } : { key: stackKey, groupOnly: true }) : null);
      });

      let extraHTML = '';
      if (extraItems.length) {
        let extraRows = '';
        extraItems.forEach(function (item) { extraRows += swipeRowHTML(item, undefined, { key: stackKey, groupOnly: true }); });
        extraHTML = '<div class="stack-extra' + (expanded ? ' open' : '') + '" data-stack="' + stackKey + '">' +
          '<div class="stack-extra-inner"><div class="timeline">' + extraRows + '</div></div></div>';
      }

      const toggle = stacked
        ? '<button class="stack-toggle" type="button" data-stack-toggle="' + stackKey +
          '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
          (expanded ? esc(T('收起')) : esc(T('展开 {n} 条', { n: extraItems.length }))) + '</button>'
        : '';

      // 批量模式下，折叠/堆叠的整组在组头提供独立的「全选本组」入口
      const countHTML = stacked && state.batchMode
        ? '<button class="batch-group-count" type="button" data-batch-group="' + stackKey + '">' +
            esc(T('全选本组 · 共 {n} 项', { n: g.items.length })) + '</button>'
        : '<span>' + g.items.length + '</span>';

      listHTML += '<div class="dd-group">' +
        '<div class="dd-group-head"><i style="background:' + TYPE_META[g.type].color + '"></i>' +
        TYPE_META[g.type].label + countHTML + toggle + '</div>' +
        '<div class="timeline">' + rows + '</div>' + extraHTML +
      '</div>';
    });

    if (!total) {
      listHTML = '<div class="dd-empty">' +
        '<span>' + esc(T('该日暂无安排')) + '</span>' +
      '</div>';
    }

    inner.innerHTML =
      almanacCardHTML(key) +
      diaryEntryHTML(key) +
      listHTML;

    // 日期/农历与天气同属 cal-head-block 的前两行，各自独立渲染
    const head = $('#ddHead');
    if (head) {
      head.hidden = false;
      head.innerHTML =
        '<div class="dd-date">' + esc(monthDay(key)) +
          '<span>' + esc(weekdayFullOf(key)) + '</span></div>' +
        '<div class="dd-sub">' + esc(subParts.join(' · ')) + '</div>';
    }
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

    const MIN_MOVE = 7;           // 判定方向的位移（越小越跟手）
    const VELOCITY = 0.18;        // px/ms，轻轻快扫也能翻页

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
      const threshold = Math.min(56, w * 0.14);
      const flick = Math.abs(vx) > VELOCITY && Math.abs(dx) > 4 &&
        (vx < 0) === (dx < 0);

      if (!(Math.abs(dx) >= threshold || flick) || atBound(dir)) {
        springBack();
        return;
      }

      // 当前月份跟手滑出，再从另一侧滑入新月份
      haptic(8);
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
      // 双指捏合进年历时，单指横滑必须让位，否则会同时翻月
      if (state.pinchActive || state.yearView) return;
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
        // 纵向滚动交给页面；轻微的上下抖动不打断横向翻月
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx) * 1.4) {
          active = false;
          grid.style.transition = '';
          grid.style.transform = '';
          return;
        }
        if (Math.abs(mx) > MIN_MOVE && Math.abs(mx) >= Math.abs(my)) {
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

  const SWIPE_REVEAL = 114;
  const SWIPE_OPEN_AT = 86;
  const SWIPE_MAX = 136;

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

  // ==================== 批量选择与删除 ====================
  // 长按 500ms 进入批量模式。选择单位是「实例」(id|date)。
  // 折叠组：收起时整组算一张卡（点它=整组）；展开后每张独立勾选，整组入口在组头。
  const BATCH_LONG_PRESS = 500;

  function batchKeyOf(wrap) {
    return wrap.dataset.id + '|' + wrap.dataset.date;
  }

  // 返回卡片所属的折叠组 key；独立卡片返回 ''（只选它自己）
  function batchGroupKeyOf(wrap) {
    if (!wrap.closest) return '';
    const extra = wrap.closest('.stack-extra');
    if (extra) return extra.dataset.stack || '';
    // 组内每张可见卡片都带 data-stack-group，整组选择不会漏掉第二张之后
    const grouped = wrap.closest('[data-stack-group]');
    return grouped ? (grouped.dataset.stackGroup || '') : '';
  }

  // 折叠组当前是否展开：展开后每张卡片独立勾选，收起时整组算一张卡
  function batchGroupExpanded(groupKey) {
    return !!groupKey && state.expandedGroups.has(groupKey);
  }

  // 折叠组里所有实例卡片（含 stack-extra 里的隐藏项）。
  // 只给「全选本组」入口用，单卡点击不再扩散到整组。
  function batchGroupCards(groupKey) {
    const out = [];
    if (!groupKey) return out;
    ['dayDetailInner', 'agendaList'].forEach(function (id) {
      const box = document.getElementById(id);
      if (!box) return;
      Array.prototype.forEach.call(box.querySelectorAll('.swipe[data-id]'), function (wrap) {
        if (batchGroupKeyOf(wrap) === groupKey) out.push(wrap);
      });
    });
    return out;
  }

  // 组头「全选本组」控件的文案与状态：未选 → 全选本组；已选 → 已选 k / 共 n
  function syncBatchGroupLabels() {
    if (!state.batchMode) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-batch-group]'), function (chip) {
      const cards = batchGroupCards(chip.dataset.batchGroup);
      const total = cards.length;
      if (!total) { chip.hidden = true; return; }
      chip.hidden = false;
      const sel = cards.filter(function (w) {
        return state.batchSel.has(batchKeyOf(w));
      }).length;
      chip.textContent = sel === 0
        ? T('全选本组 · 共 {n} 项', { n: total })
        : T('已选 {k} / 共 {n} 项', { k: sel, n: total });
      chip.classList.toggle('is-all', total > 0 && sel === total);
      // 部分选中要如实呈现（收起后也不能看起来像整组全选）
      chip.classList.toggle('is-partial', sel > 0 && sel < total);
    });
  }

  function syncBatchDom() {
    ['dayDetailInner', 'agendaList'].forEach(function (id) {
      const box = document.getElementById(id);
      if (!box) return;
      box.classList.toggle('batch-mode', state.batchMode);
      const cards = box.querySelectorAll('.swipe[data-id]');
      Array.prototype.forEach.call(cards, function (wrap) {
        wrap.classList.toggle('batch-on', state.batchMode && state.batchSel.has(batchKeyOf(wrap)));
      });
    });
    syncBatchGroupLabels();
  }

  // 折叠组的组头补上「全选本组」入口。进入批量模式时直接改 DOM，
  // 不重渲染，避免长按期间把手指按住的卡片换掉。
  function applyBatchGroupLabels() {
    ['dayDetailInner', 'agendaList'].forEach(function (id) {
      const box = document.getElementById(id);
      if (!box) return;

      // 日历当日详情：把组头里的项数 span 换成可点的「全选本组」按钮
      Array.prototype.forEach.call(box.querySelectorAll('.dd-group'), function (group) {
        const head = group.querySelector('.dd-group-head');
        if (!head || head.querySelector('[data-batch-group]')) return;
        const toggle = head.querySelector('[data-stack-toggle]');
        if (!toggle) return;
        const span = Array.prototype.find.call(head.children, function (el) {
          return el.tagName === 'SPAN';
        });
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'batch-group-count';
        chip.dataset.batchGroup = toggle.dataset.stackToggle;
        if (span) head.replaceChild(chip, span);
        else head.insertBefore(chip, toggle);
      });

      // 日程页：日期分组标题后补一个同类控件
      Array.prototype.forEach.call(box.querySelectorAll('.day-group'), function (group) {
        const head = group.querySelector('.day-head-title');
        if (!head || head.querySelector('[data-batch-group]')) return;
        const toggle = head.querySelector('[data-stack-toggle]');
        if (!toggle) return;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'batch-group-count';
        chip.dataset.batchGroup = toggle.dataset.stackToggle;
        head.insertBefore(chip, toggle);
      });
    });
    syncBatchGroupLabels();
  }

  function renderBatchBar() {
    const bar = $('#batchBar');
    if (!bar) return;
    bar.hidden = !state.batchMode;
    if (!state.batchMode) return;
    $('#batchCount').textContent = T('已选 {n} 项', { n: state.batchSel.size });
    const del = $('#batchDelete');
    del.disabled = state.batchSel.size === 0;
  }

  function enterBatchMode(wrap) {
    if (state.batchMode) return;
    state.batchMode = true;
    state.batchSel = new Set();
    // 长按松手后浏览器会补发一次 click，用时间锁挡掉
    state.batchLock = Date.now() + 420;
    closeAllSwipes();
    // 收起状态整组算一张卡：长按它等同选中组内全部；展开状态只选这一张
    if (wrap) {
      const groupKey = batchGroupKeyOf(wrap);
      if (groupKey && !batchGroupExpanded(groupKey)) {
        batchGroupCards(groupKey).forEach(function (el) {
          state.batchSel.add(batchKeyOf(el));
        });
      } else {
        state.batchSel.add(batchKeyOf(wrap));
      }
    }
    document.body.classList.add('batch-mode');
    haptic(18);
    syncBatchDom();
    applyBatchGroupLabels();
    renderSummary();
    renderBatchBar();
  }

  function clearBatchState() {
    state.batchMode = false;
    state.batchSel = new Set();
    document.body.classList.remove('batch-mode');
    const bar = $('#batchBar');
    if (bar) bar.hidden = true;
    syncBatchDom();
  }

  function exitBatchMode() {
    if (!state.batchMode) return;
    clearBatchState();
    renderAll();
  }

  // 单卡点击：收起状态整组算一张卡（点它=选整组），展开状态只切换这一张
  function toggleBatchCard(wrap) {
    const groupKey = batchGroupKeyOf(wrap);
    if (groupKey && !batchGroupExpanded(groupKey)) {
      toggleBatchGroup(groupKey);
      return;
    }
    const key = batchKeyOf(wrap);
    if (state.batchSel.has(key)) state.batchSel.delete(key);
    else state.batchSel.add(key);
    syncBatchDom();
    renderBatchBar();
    haptic(8);
  }

  // 整组选择只从组头的「全选本组」控件进入
  function toggleBatchGroup(groupKey) {
    const cards = batchGroupCards(groupKey);
    if (!cards.length) return;
    const keys = cards.map(batchKeyOf);
    const allOn = keys.every(function (k) { return state.batchSel.has(k); });
    keys.forEach(function (k) {
      if (allOn) state.batchSel.delete(k);
      else state.batchSel.add(k);
    });
    syncBatchDom();
    renderBatchBar();
    haptic(allOn ? 8 : 18);
  }

  // 批量模式下的点击分流（顺序即优先级）：
  // 1) 「全选本组」控件 → 整组选择
  // 2) 展开 / 收起按钮、组头 → 只切换展开态，不改选择
  // 3) 卡片本体 → 只切换这一张
  // 4) 其他按钮忽略；空白处退出批量模式
  function handleBatchClick(e) {
    const chip = e.target.closest('[data-batch-group]');
    if (chip) {
      toggleBatchGroup(chip.dataset.batchGroup);
      return true;
    }

    const stackBtn = e.target.closest('[data-stack-toggle]');
    if (stackBtn) {
      toggleStack(stackBtn);
      return true;
    }

    const doneToggle = e.target.closest('[data-done-toggle]');
    if (doneToggle) {
      toggleDoneGroup(doneToggle);
      return true;
    }

    // 组头空白处等同点展开 / 收起，不改变选择
    const groupHead = e.target.closest('.dd-group-head') || e.target.closest('.day-head');
    if (groupHead) {
      const toggle = groupHead.querySelector('[data-stack-toggle]');
      if (toggle) toggleStack(toggle);
      return true;
    }

    const wrap = e.target.closest('.swipe[data-id]');
    if (wrap) {
      toggleBatchCard(wrap);
      return true;
    }

    // 其余按钮（更多、筛选等）在批量模式下不响应，避免误触
    if (e.target.closest('button')) return true;
    exitBatchMode();
    return true;
  }

  function batchSelectionStats() {
    const ids = new Set();
    const perDate = {};
    state.batchSel.forEach(function (key) {
      const at = key.lastIndexOf('|');
      ids.add(key.slice(0, at));
      const date = key.slice(at + 1);
      perDate[date] = (perDate[date] || 0) + 1;
    });
    let sameDay = 0;
    Object.keys(perDate).forEach(function (d) {
      if (perDate[d] > sameDay) sameDay = perDate[d];
    });
    let recurring = 0;
    ids.forEach(function (id) {
      const item = state.items.find(function (i) { return i.id === id; });
      if (item && item.recurrence) recurring += 1;
    });
    return { total: state.batchSel.size, ids: ids, sameDay: sameDay, recurring: recurring };
  }

  function askBatchDelete() {
    if (!state.batchSel.size) return;
    const st = batchSelectionStats();
    openModal({
      kind: 'batch-del',
      title: st.sameDay > 1
        ? T('将删除 {n} 项，其中 {m} 项属于同一天', { n: st.total, m: st.sameDay })
        : T('将删除 {n} 项', { n: st.total }),
      // 重复条目按 id 去重删除，等于删掉整条重复规则和它的全部实例
      text: st.recurring
        ? T('其中 {k} 项来自重复规则，会连同整个重复规则及其所有实例一起删除。', { k: st.recurring })
        : '',
      confirmText: T('删除'),
      danger: true,
      onConfirm: function () { doBatchDelete(st); }
    });
  }

  async function doBatchDelete(st) {
    if (!st || !st.ids.size) return;
    state.items = state.items.filter(function (i) { return !st.ids.has(i.id); });
    await persistItems();
    clearBatchState();
    renderAll();
    scheduleReminders();
    showToast(T('已删除 {n} 项', { n: st.total }), 1400);
  }

  // 长按 500ms 进入批量模式；移动超过 8px 视为滚动，取消长按
  function bindBatchPress(container) {
    if (!container || container.dataset.batchBound) return;
    container.dataset.batchBound = '1';
    let press = null;
    let longFired = false;

    function clearPress() {
      if (press && press.timer) clearTimeout(press.timer);
      press = null;
    }

    container.addEventListener('pointerdown', function (e) {
      if (state.batchMode) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!e.target.closest) return;
      if (e.target.closest('.swipe-del, .swipe-edit, .check, [data-stack-toggle], [data-done-toggle], [data-agenda-more], .batch-btn')) return;
      const wrap = e.target.closest('.swipe[data-id]');
      if (!wrap || wrap.classList.contains('revealed')) return;
      clearPress();
      longFired = false;
      press = { x: e.clientX, y: e.clientY, wrap: wrap, timer: 0, pointerId: e.pointerId };
      press.timer = setTimeout(function () {
        const target = press ? press.wrap : null;
        press = null;
        if (!target || state.batchMode) return;
        longFired = true;
        enterBatchMode(target);
      }, BATCH_LONG_PRESS);
    });

    container.addEventListener('pointermove', function (e) {
      if (!press || e.pointerId !== press.pointerId) return;
      if (Math.abs(e.clientX - press.x) > 8 || Math.abs(e.clientY - press.y) > 8) {
        longFired = false;
        clearPress();
      }
    });

    ['pointerup', 'pointercancel'].forEach(function (type) {
      container.addEventListener(type, function (e) {
        if (press && e.pointerId !== press.pointerId) return;
        // 长按松手后会紧跟一次 click：按松手时间再锁 350ms，避免刚选中就被点掉
        if (longFired) state.batchLock = Date.now() + 350;
        longFired = false;
        clearPress();
      });
    });

    container.addEventListener('pointerleave', function () {
      longFired = false;
      clearPress();
    });

    // 长按卡片时不要弹出系统文字选择 / 上下文菜单
    container.addEventListener('contextmenu', function (e) {
      if (e.target.closest && e.target.closest('.swipe[data-id]')) e.preventDefault();
    });
  }

  function bindSwipe(container) {
    if (!container || container.dataset.swipeBound) return;
    container.dataset.swipeBound = '1';
    let sw = null;

    container.addEventListener('pointerdown', function (e) {
      // 批量模式下禁用左滑删除
      if (state.batchMode) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.swipe-del, .swipe-edit')) return;
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
    const edit = e.target.closest('[data-swipe-edit]');
    if (edit) {
      closeAllSwipes();
      openEditSheet(edit.dataset.swipeEdit);
      return true;
    }
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
    // 展开 / 收起只切换淡出位移，层次跟着 extra 区域一起过渡
    if (layers) layers.classList.toggle('is-open', open);
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
    // 批量模式下展开 / 收起只影响呈现，组头计数与「部分 / 全部选中」要跟着刷新
    if (state.batchMode) syncBatchGroupLabels();
  }

  function handleSharedListClick(e) {
    const stackBtn = e.target.closest('[data-stack-toggle]');
    if (stackBtn) {
      toggleStack(stackBtn);
      return true;
    }
    return false;
  }

  // 「已完成 · N」折叠：批量模式下也要能用，所以抽成独立函数
  function toggleDoneGroup(doneToggle) {
    const key = doneToggle.dataset.doneToggle;
    if (state.openDoneGroups.has(key)) state.openDoneGroups.delete(key);
    else state.openDoneGroups.add(key);
    const open = state.openDoneGroups.has(key);
    doneToggle.classList.toggle('open', open);
    doneToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const list = $('[data-done-list="' + key + '"]');
    if (list) list.hidden = !open;
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
      cat ? '<span class="tag tag-category" style="color:' + cat.color + ';background:' + hexToRgba(cat.color, 0.12) + '">' + (categoryGlyphHTML(cat) || '<i></i>') + esc(cat.name) + '</span>' : '',
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
          i === 0 ? { key: stackKey, hidden: !stackExpanded, locked: !stackExpanded, count: undone.length } : { key: stackKey, groupOnly: true });
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

    // 批量模式下折叠组的整组选择走组头这个独立入口，单卡点击只选单卡
    const batchChip = stacked && state.batchMode
      ? '<button class="batch-group-count" type="button" data-batch-group="' + stackKey + '">' +
          esc(T('全选本组 · 共 {n} 项', { n: undone.length })) + '</button>'
      : '';

    return '<section class="day-group" id="day-' + key + '">' +
      '<div class="day-head">' +
        '<div class="day-head-main">' +
          '<div class="day-head-title"><h2>' + esc(title) + '</h2>' + batchChip + stackBtn + '</div>' +
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
        categoryMarkHTML(cat, '--chip-color:' + cat.color) + esc(cat.name) + '</button>';
    });

    bar.innerHTML = html;
    bar.hidden = false;
  }

  // 把某个日期分组滚到可视区，供「回到今日」与上下翻动定位
  function agendaScrollTo(key, smooth) {
    const el = document.getElementById('day-' + key);
    if (!el || !el.scrollIntoView) return;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function renderAgenda() {
    const t = todayKey();
    const anchor = state.agendaAnchor || t;
    const back = Math.max(AGENDA_STEP_DAYS, state.agendaBack || AGENDA_BACK_DAYS);
    const fwd = Math.max(AGENDA_STEP_DAYS, state.agendaFwd || AGENDA_FWD_DAYS);

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

    // 以焦点日为轴：向上 back 天历史、向下 fwd 天未来，边界按钮再按步扩展
    let start = addDays(anchor, -back);
    let end = addDays(anchor, fwd);

    const byDate = {};
    expandOccurrences(visibleItems, start, end).forEach(function (item) {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });

    const overdue = visibleItems
      .filter(function (i) { return !i.recurrence && !i.done && i.date < t; })
      .sort(compareOverdue);

    let html = '<div class="agenda-more top">' +
      '<button class="agenda-more-btn" type="button" data-agenda-more="back">' +
        '<span class="am-label">' +
          '<svg class="am-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V4M4.6 7.4 8 4l3.4 3.4"/></svg>' +
          '<span class="am-text">' + esc(T('加载更早的安排')) + '</span>' +
        '</span>' +
      '</button>' +
      '<span class="agenda-more-note">' + esc(T('当前展示近 {n} 天历史', { n: back })) + '</span>' +
    '</div>';

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

    // 历史在上、未来在下，逐日分组；没有安排的日期不铺空分组，今天与焦点日始终保留
    let key = start;
    let guard = 0;
    while (key <= end && guard < 800) {
      const dayItems = byDate[key] || [];
      if (dayItems.length || key === t || key === anchor) html += dayGroupHTML(key, dayItems);
      key = addDays(key, 1);
      guard += 1;
    }

    // 窗口末尾之后是否还有数据：重复条目看 until（没有 until 视为一直延续）
    const hasLater = visibleItems.some(function (i) {
      if (i.recurrence) {
        const until = i.recurrence.until || '';
        return !until || until > end;
      }
      return i.date > end;
    });

    html += '<div class="agenda-more bottom">' +
      (hasLater
        ? '<button class="agenda-more-btn" type="button" data-agenda-more="fwd">' +
            '<span class="am-label">' +
              '<svg class="am-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5V12M4.6 8.6 8 12l3.4-3.4"/></svg>' +
              '<span class="am-text">' + esc(T('加载更晚的安排')) + '</span>' +
            '</span>' +
          '</button>'
        : '<span class="agenda-more-end"><span class="am-label">' + esc(T('已经是最新')) + '</span></span>') +
      '<span class="agenda-more-note">' + esc(T('已展示到 {date}', { date: monthDay(end) })) + '</span>' +
    '</div>';

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
    // 手动拖动排序优先；旧数据没有 order 时继续按时间 / 创建顺序
    const ao = Number.isFinite(a.order) ? a.order : null;
    const bo = Number.isFinite(b.order) ? b.order : null;
    if (ao !== null && bo !== null && ao !== bo) return ao - bo;
    if (ao !== null && bo === null) return -1;
    if (ao === null && bo !== null) return 1;
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
        (categoryGlyphHTML(cat) || '<i></i>') + esc(cat.name) + '</span>');
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
    return '<div class="swipe plan-swipe" data-id="' + plan.id + '"' +
      (showPeriod ? '' : ' data-plan-current="1"') + '>' +
      '<button class="swipe-edit" type="button" data-plan-edit="' + plan.id + '" aria-label="编辑这条计划">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 19.8h4L19.4 8.6a1.8 1.8 0 0 0 0-2.6l-1.4-1.4a1.8 1.8 0 0 0-2.6 0L4.2 15.8v4z"/><path d="M13.6 6.6l3.8 3.8"/></svg>' +
      '</button>' +
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
      '<div><p>' + esc(T('周、月、年分开看，长线目标也有进度。')) + '</p></div>' +
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
        categoryMarkHTML(cat, '--cat-dot:' + cat.color) + esc(cat.name) + '</button>';
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
        categoryMarkHTML(cat, 'background:' + cat.color) + esc(cat.name) +
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

  async function createCategory(name, color, icon) {
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
      icon: icon && CATEGORY_ICON_BY_ID[icon] ? icon : null,
      order: maxOrder + 1,
      createdAt: Date.now()
    });
    sortCategories();
    await persistCategories();
    renderAll();
    showToast(T('已新增分类：{name}', { name: name }));
  }

  async function updateCategory(id, name, color, icon) {
    const cat = getCategory(id);
    if (!cat) return;
    cat.name = name;
    cat.color = color;
    cat.icon = icon && CATEGORY_ICON_BY_ID[icon] ? icon : null;
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
  let modalIcon = null;
  let modalPickerOpen = false;
  let modalPickerDrag = '';
  let modalHsv = hexToHsv(PRESET_COLORS[0]);
  const modalState = { kind: '', onConfirm: null };

  function isPresetColor(color) {
    const c = String(color || '').toLowerCase();
    return PRESET_COLORS.some(function (p) { return p.toLowerCase() === c; });
  }

  function tintModalIcons() {
    $$('#modalIcons .cat-glyph').forEach(function (el) {
      el.style.color = modalColor;
    });
  }

  function renderModalPicker() {
    const picker = $('#modalPicker');
    if (!picker) return;
    picker.hidden = !modalPickerOpen;
    const btn = $('#modalCustomBtn');
    if (btn) {
      btn.setAttribute('aria-expanded', modalPickerOpen ? 'true' : 'false');
      btn.classList.toggle('active', modalPickerOpen || !isPresetColor(modalColor));
    }
    const dot = $('#modalCustomDot');
    if (dot) dot.style.background = modalColor;
    if (!modalPickerOpen) return;

    const sv = $('#cpSv');
    if (sv) sv.style.setProperty('--cp-hue', hsvToHex(modalHsv.h, 1, 1));
    const svKnob = $('#cpSvKnob');
    if (svKnob) {
      svKnob.style.left = (modalHsv.s * 100) + '%';
      svKnob.style.top = ((1 - modalHsv.v) * 100) + '%';
      svKnob.style.background = modalColor;
    }
    const hueKnob = $('#cpHueKnob');
    if (hueKnob) {
      hueKnob.style.left = (modalHsv.h / 360 * 100) + '%';
      hueKnob.style.background = hsvToHex(modalHsv.h, 1, 1);
    }
    const hex = $('#cpHex');
    if (hex) hex.textContent = modalColor.toUpperCase();
  }

  function renderModalSwatches() {
    const box = $('#modalSwatches');
    if (box) box.innerHTML = swatchesHTML(modalColor, 'modal-color');
    renderModalPicker();
  }

  function setModalColor(color, keepHsv) {
    modalColor = isHexColor(color) ? color : PRESET_COLORS[0];
    // 点预设色时同步 HSV，保证下次展开取色器时光标落在当前颜色上
    if (!keepHsv) modalHsv = hexToHsv(modalColor);
    $$('#modalSwatches .swatch').forEach(function (el) {
      el.classList.toggle('active', String(el.dataset.modalColor || '').toLowerCase() === modalColor.toLowerCase());
    });
    renderModalPicker();
    tintModalIcons();
  }

  function renderModalIcons() {
    const box = $('#modalIcons');
    if (!box) return;
    let html = '<button type="button" class="cat-icon-btn' + (modalIcon ? '' : ' active') +
      '" data-icon="" aria-label="' + esc(T('默认色点')) + '"><i class="dot"></i></button>';
    CATEGORY_ICONS.forEach(function (icon) {
      html += '<button type="button" class="cat-icon-btn' + (modalIcon === icon.id ? ' active' : '') +
        '" data-icon="' + icon.id + '" aria-label="' + esc(isEn() ? icon.en : icon.zh) + '">' +
        '<span class="cat-glyph" style="color:' + modalColor + '">' + categorySvg(icon.svg) + '</span></button>';
    });
    box.innerHTML = html;
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
      modalIcon = cfg.icon && CATEGORY_ICON_BY_ID[cfg.icon] ? cfg.icon : null;
      modalHsv = hexToHsv(modalColor);
      modalPickerOpen = false;
      modalPickerDrag = '';
      $('#modalIconsWrap').hidden = false;
      if ($('#modalIconsLabel')) $('#modalIconsLabel').textContent = T('图标');
      renderModalSwatches();
      renderModalIcons();
    } else {
      $('#modalIconsWrap').hidden = true;
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
      const icon = modalIcon;
      const trimmed = name.trim();
      closeModal();
      if (kind === 'cat-create') await createCategory(trimmed, color, icon);
      else await updateCategory(editId, trimmed, color, icon);
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
      icon: cat ? cat.icon : null,
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

  // ---------- 分类气泡拖动排序 ----------
  // 判定：按住 260ms 才进入拖动；按下后先移动超过 10px 则取消长按、
  // 交给页面正常滚动。拖动期间才锁滚动，松手按 DOM 顺序写回 order。
  const CAT_DRAG_HOLD_MS = 260;
  const CAT_DRAG_CANCEL_PX = 10;
  const CAT_DRAG_CLICK_MS = 320;
  let catDrag = null;
  let catDragEndAt = 0;

  function catDragTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('[data-cat-bubble]') : null;
  }

  function catDragStart(e) {
    const bubble = e.target.closest('[data-cat-bubble]');
    if (!bubble) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    catDrag = {
      id: bubble.dataset.catBubble,
      el: bubble,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      timer: 0
    };
    catDrag.timer = setTimeout(function () {
      if (!catDrag) return;
      catDrag.active = true;
      catDrag.el.classList.add('dragging');
      const list = $('#categoryList');
      if (list) list.classList.add('dragging');
      closeCatPop();
      try { catDrag.el.setPointerCapture(catDrag.pointerId); } catch (err) { /* 忽略 */ }
      haptic(8);
    }, CAT_DRAG_HOLD_MS);
  }

  function catDragMove(e) {
    if (!catDrag) return;
    const dx = e.clientX - catDrag.startX;
    const dy = e.clientY - catDrag.startY;
    if (!catDrag.active) {
      if (Math.abs(dx) > CAT_DRAG_CANCEL_PX || Math.abs(dy) > CAT_DRAG_CANCEL_PX) {
        clearTimeout(catDrag.timer);
        catDrag = null;
      }
      return;
    }
    e.preventDefault();
    const target = catDragTarget(e.clientX, e.clientY);
    if (!target || target === catDrag.el || target.hasAttribute('data-cat-new')) return;
    const r = target.getBoundingClientRect();
    const parent = catDrag.el.parentNode;
    if (e.clientY > r.top + r.height / 2) parent.insertBefore(catDrag.el, target.nextSibling);
    else parent.insertBefore(catDrag.el, target);
  }

  function catDragEnd() {
    if (!catDrag) return;
    clearTimeout(catDrag.timer);
    const active = catDrag.active;
    const el = catDrag.el;
    const list = $('#categoryList');
    if (el) el.classList.remove('dragging');
    if (list) list.classList.remove('dragging');
    catDrag = null;
    if (!active) return;
    catDragEndAt = Date.now();
    const ids = $$('#categoryList [data-cat-bubble]').map(function (b) {
      return b.dataset.catBubble;
    });
    let changed = false;
    ids.forEach(function (id, i) {
      const cat = getCategory(id);
      if (cat && cat.order !== i) { cat.order = i; changed = true; }
    });
    if (changed) persistCategories();
    renderAll();
    haptic(8);
  }

  // ---------- 计划卡片拖动排序 ----------
  // 判定：按住 280ms 进入拖动；按下后先移动超过 10px 交给左滑/页面滚动。
  // 横向由 bindSwipe 处理，纵向拖动排序只在长按成立后接管。
  const PLAN_DRAG_HOLD_MS = 280;
  const PLAN_DRAG_CANCEL_PX = 10;
  let planDrag = null;
  let planDragEndAt = 0;

  function getPlanById(id) {
    return state.plans.find(function (p) { return p.id === id; }) || null;
  }

  // FLIP：拖动跨过其它卡片时，让位动画平滑过渡
  function planFlip(list, mutate) {
    const els = $$('.plan-swipe', list).filter(function (el) {
      return !el.classList.contains('dragging');
    });
    const tops = new Map();
    els.forEach(function (el) { tops.set(el, el.getBoundingClientRect().top); });
    mutate();
    els.forEach(function (el) {
      const dy = (tops.get(el) || 0) - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = 'none';
      el.style.transform = 'translateY(' + dy + 'px)';
      requestAnimationFrame(function () {
        el.style.transition = 'transform .17s ease';
        el.style.transform = '';
      });
      setTimeout(function () { el.style.transition = ''; }, 220);
    });
  }

  function planDragStart(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const wrap = e.target.closest('.plan-swipe');
    if (!wrap || !wrap.hasAttribute('data-plan-current')) return;
    if (e.target.closest('.check, [data-plan-edit], [data-plan-del]')) return;
    const list = wrap.closest('.plan-list');
    if (!list) return;
    planDrag = {
      el: wrap,
      list: list,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      timer: 0
    };
    wrap.classList.add('pressing');
    planDrag.timer = setTimeout(function () {
      if (!planDrag) return;
      planDrag.active = true;
      planDrag.el.classList.remove('pressing');
      planDrag.el.classList.add('dragging');
      planDrag.list.classList.add('dragging');
      try { planDrag.el.setPointerCapture(planDrag.pointerId); } catch (err) { /* 忽略 */ }
      haptic(10);
    }, PLAN_DRAG_HOLD_MS);
  }

  function planDragMove(e) {
    if (!planDrag) return;
    const dx = e.clientX - planDrag.startX;
    const dy = e.clientY - planDrag.startY;
    if (!planDrag.active) {
      if (Math.abs(dx) > PLAN_DRAG_CANCEL_PX || Math.abs(dy) > PLAN_DRAG_CANCEL_PX) {
        clearTimeout(planDrag.timer);
        planDrag.el.classList.remove('pressing');
        planDrag = null;
      }
      return;
    }
    e.preventDefault();
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const target = hit ? hit.closest('.plan-swipe') : null;
    if (!target || target === planDrag.el || !target.hasAttribute('data-plan-current')) return;
    if (target.parentNode !== planDrag.list) return;
    const r = target.getBoundingClientRect();
    const drag = planDrag;
    planFlip(drag.list, function () {
      if (e.clientY > r.top + r.height / 2) drag.list.insertBefore(drag.el, target.nextSibling);
      else drag.list.insertBefore(drag.el, target);
    });
  }

  function planDragEnd() {
    if (!planDrag) return;
    clearTimeout(planDrag.timer);
    const active = planDrag.active;
    const wrap = planDrag.el;
    const list = planDrag.list;
    wrap.classList.remove('pressing', 'dragging');
    if (list) list.classList.remove('dragging');
    planDrag = null;
    if (!active) return;
    planDragEndAt = Date.now();
    const card = list.closest('[data-plan-card]');
    const kind = card ? card.dataset.planCard : '';
    const start = planPeriodStart(kind, todayKey());
    $$('.plan-swipe', list).forEach(function (el, i) {
      const plan = getPlanById(el.dataset.id);
      if (plan && plan.periodStart === start) plan.order = i;
    });
    persistPlans();
    renderPlan();
    haptic(10);
  }

  // ==================== 总渲染 ====================

  function renderAll() {
    // 日记页有自己的「写今天」入口，隐藏全局加号，避免两个创建入口打架
    document.body.classList.toggle('diary-view', state.view === 'diary');
    updateTopbar();
    renderSummary();
    if (state.view === 'calendar') renderCalendar();
    if (state.view === 'agenda') renderAgenda();
    if (state.view === 'plan') renderPlan();
    if (state.view === 'schedule') renderSchedule();
    if (state.view === 'diary') renderDiary();
    renderSettings();
    renderBatchBar();
    // 日记编辑页是独立的覆盖层，不随视图重绘，但"写今天/续写今天"要跟着日期与数据变
    syncDiaryWriteButton();
  }

  function setView(view) {
    // 离开日记页前先把没来得及自动保存的内容落盘，避免切 tab 丢字
    if (state.view === 'diary' && view !== 'diary') closeDiaryEditor(true);
    if (state.diaryManage) exitDiaryManage();
    state.view = view;
    $$('.tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    $('#viewCalendar').hidden = view !== 'calendar';
    $('#viewAgenda').hidden = view !== 'agenda';
    $('#viewPlan').hidden = view !== 'plan';
    $('#viewSchedule').hidden = view !== 'schedule';
    $('#viewDiary').hidden = view !== 'diary';
    $('#content').scrollTop = 0;
    // 离开日历视图时收起年历，避免回来时还停在年历
    if (view !== 'calendar') closeYearView();
    // 切换视图时退出批量模式并清空已选
    if (state.batchMode) clearBatchState();
    renderAll();
    // 日程是流式的，进入时直接落在焦点日（默认今天）而不是页面顶部
    if (view === 'agenda' && state.agendaAnchor) {
      requestAnimationFrame(function () { agendaScrollTo(state.agendaAnchor, false); });
    }
  }

  // ==================== 存储提示 / 主题 ====================

  function updateStorageBanner() {
    $('#storageBanner').hidden = storage.status !== 'memory';
  }

  function preferredTheme() {
    // 默认浅色：首次启动与清库后都固定浅色，不跟随系统深色；
    // 只有用户自己打开过深色才持久化为 dark。
    return state.meta.theme === 'dark' ? 'dark' : 'light';
  }

  // 状态栏跟随应用主题：浅色主题用浅底 + 深色图标，深色主题用深底 + 浅色图标。
  // 页面通过 env(safe-area-inset-top) 把内容让到状态栏下方，所以这里开 overlay
  // 让背景色延伸到状态栏，而不是留一条系统默认的黑条。
  function syncStatusBar(dark) {
    const StatusBar = plugin('StatusBar');
    if (!StatusBar) return;
    const bg = dark ? '#0F1117' : '#F3F5FA';
    try {
      Promise.resolve(StatusBar.setOverlaysWebView({ overlay: true })).catch(function () {});
      Promise.resolve(StatusBar.setBackgroundColor({ color: bg })).catch(function () {});
      // 注意 Capacitor 的语义：DARK = 浅色文字（暗背景），LIGHT = 深色文字（亮背景）
      Promise.resolve(StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' })).catch(function () {});
    } catch (err) { /* 网页版没有状态栏，忽略 */ }
  }

  function applyTheme() {
    const dark = preferredTheme() === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0F1117' : '#F3F5FA');
    syncStatusBar(dark);
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

  // 气泡带前置图标，文字写进 .chip-label，避免整块 textContent 赋值把图标抹掉
  function setChipText(el, text) {
    if (!el) return;
    const label = el.querySelector('.chip-label');
    if (label) label.textContent = text;
    else el.textContent = text;
  }

  function syncRepeatChip() {
    const el = $('#repeatChip');
    if (!el) return;
    const rec = draft.recurrence;
    if (rec) {
      setChipText(el, recurrenceLabel(rec, draft.date || todayKey()));
      el.classList.add('active');
    } else {
      setChipText(el, T('重复'));
      el.classList.remove('active');
    }
  }

  function syncPriorityChip() {
    const el = $('#priorityChip');
    const box = $('#priorityInput');
    if (box) box.checked = draft.priority;
    if (!el) return;
    setChipText(el, draft.priority ? T('高优先级') : T('优先级'));
    el.classList.toggle('active', draft.priority);
    el.classList.toggle('high', draft.priority);
  }

  function syncDateChip() {
    if (dateSheet.target === 'plan') {
      const planChip = $('#planDateChip');
      if (!planChip) return;
      const planKey = planDraft.date || todayKey();
      setChipText(planChip, planDraft.time ? relativeDayLabel(planKey) + ' ' + planDraft.time : relativeDayLabel(planKey));
      planChip.classList.add('active');
      return;
    }
    const el = $('#dateChip');
    if (!el) return;
    const key = draft.date || todayKey();
    const label = relativeDayLabel(key);
    setChipText(el, draft.time ? label + ' ' + draft.time : label + ' · ' + T('全天'));
    el.classList.add('active');
  }

  function syncRemindChip() {
    const el = $('#remindChip');
    if (!el) return;
    if (typeof draft.remindBefore === 'number') {
      setChipText(el, T('提前 {n} 分钟', { n: draft.remindBefore }));
      el.classList.add('active');
    } else {
      setChipText(el, T('提醒'));
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
    mode: 'calendar',
    year: 0,
    month: 0,
    day: 1
  };

  function updateDetailNoteCount() {
    const value = $('#detailNote').value;
    $('#detailNoteCount').textContent = value.length + ' / 500';
  }

  // 详情页统一结构：
  //   标题（最重要）→ 日期时间 / 分类 / 提醒（主信息）→ 地址 → 备注（在 body 外）
  //   类型 / 重复 / 优先级等次要字段收进折叠区，避免一屏全是等宽小行
  function detailRowsHTML(opts) {
    const rows = opts.rows || [];
    const foldRows = opts.foldRows || [];
    const renderRow = function (pair) {
      // 第三项为 'html' 时值已由调用方转义并拼好（如带图标的分类）
      const value = pair[2] === 'html' ? pair[1] : esc(pair[1]);
      return '<div class="detail-row"><span class="detail-label">' + pair[0] +
        '</span><span class="detail-value">' + value + '</span></div>';
    };

    let html = '<div class="detail-hero">' +
      '<h3 class="detail-hero-title">' + esc(opts.title) + '</h3>' +
      (opts.badge ? '<span class="detail-hero-badge">' + esc(opts.badge) + '</span>' : '') +
      '</div>';

    html += '<div class="detail-facts">' + rows.map(renderRow).join('') + '</div>';

    const address = opts.address;
    if (address && address.label) {
      html += '<div class="detail-row detail-addr">' +
        '<span class="detail-label">' + esc(T('地址')) + '</span>' +
        '<span class="detail-addr-right">' +
          '<span class="detail-value">' + esc(address.label) + '</span>' +
          '<button class="detail-map-link" id="detailMapBtn" type="button">' + esc(T('打开地图')) + '</button>' +
        '</span></div>';
    }

    if (foldRows.length) {
      html += '<details class="detail-more"><summary>' + esc(T('更多信息')) + '</summary>' +
        foldRows.map(renderRow).join('') + '</details>';
    }
    return html;
  }

  // 该条目在最近一次排程里的真实状态（已排程 / 跳过原因 / 失败原因）
  function reminderStatusOf(id, key) {
    const report = Array.isArray(state.reminderReport) ? state.reminderReport : [];
    const rows = report.filter(function (r) { return r.key.indexOf(String(id) + '|') === 0; });
    if (!rows.length) return '';
    const hit = (key && rows.filter(function (r) { return r.key === String(id) + '|' + key; })[0]) || rows[0];
    if (!hit) return '';
    const label = {
      ok: T('已排程'), queued: T('排程中'), timer: T('前台计时器'),
      skip: T('已跳过'), fail: T('排程失败')
    }[hit.status] || '';
    if (hit.status === 'ok') {
      // 精确闹钟不可用时系统只能延迟投递，详情里必须写明，不能静默
      return label + ' · ' + hit.fireText +
        (state.exactAlarmStatus === 'denied' ? ' · ' + T('可能延迟') : '');
    }
    return label + (hit.reason ? ' · ' + hit.reason : '');
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

  // 精确闹钟被系统关闭时，提醒仍会到，但只能按「允许延迟」的方式排，界面如实标注
  function remindTextOf(before) {
    if (!before) return T('不提醒');
    const base = T('提前 {n} 分钟', { n: before });
    return state.exactAlarmStatus === 'denied' ? base + ' · ' + T('可能延迟') : base;
  }

  function openDetail(id, date) {
    const base = state.items.find(function (i) { return i.id === id; });
    if (!base) return;
    detail.kind = 'item';
    detail.itemId = id;
    detail.date = date || base.date;

    const inst = base.recurrence ? makeInstance(base, detail.date) : base;
    const cat = getCategory(base.categoryId);
    // 分类一栏带图标；未设置图标时只显示名称，不留空白
    const catCell = cat ? (categoryGlyphHTML(cat) + esc(cat.name)) : esc(T('未分类'));
    const remindStatus = reminderStatusOf(base.id, inst.date);
    const rows = [
      ['日期时间', monthDay(inst.date) + ' · ' + weekdayOf(inst.date) + ' · ' + (inst.time || T('全天'))],
      ['分类', catCell, 'html'],
      ['提醒', remindTextOf(inst.remindBefore) + (remindStatus ? ' · ' + remindStatus : '')]
    ];
    const foldRows = [
      ['类型', T(TYPE_META[inst.type].label)],
      ['重复', repeatDetailText(inst)],
      ['优先级', (base.priority === 'high') ? T('高优先级') : T('普通')]
    ];

    showDetailSheet(detailRowsHTML({
      title: inst.title,
      badge: T(TYPE_META[inst.type].label),
      rows: rows,
      foldRows: foldRows,
      address: base.address
    }), base.note);
  }

  function openPlanDetail(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    detail.kind = 'plan';
    detail.itemId = id;
    detail.date = '';
    const cat = getCategory(plan.categoryId);
    const catCell = cat ? (categoryGlyphHTML(cat) + esc(cat.name)) : esc(T('未分类'));
    const remindStatus = reminderStatusOf(plan.id, plan.periodStart);
    const rows = [
      ['周期', planPeriodLabel(plan.kind, plan.periodStart)],
      ['时间', plan.time || T('全天') + ' · ' + T('基准') + ' ' + REMIND_DEFAULT_TIME],
      ['分类', catCell, 'html'],
      ['提醒', remindTextOf(plan.remindBefore) + (remindStatus ? ' · ' + remindStatus : '')]
    ];
    const foldRows = [
      ['类型', T(PLAN_KINDS[plan.kind])],
      ['优先级', plan.priority === 'high' ? T('高优先级') : T('普通')]
    ];

    showDetailSheet(detailRowsHTML({
      title: plan.title,
      badge: T(PLAN_KINDS[plan.kind]),
      rows: rows,
      foldRows: foldRows,
      address: plan.address
    }), plan.note);
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
    // WebView 里 navigator.vibrate 不可靠，优先用 Capacitor Haptics；
    // 不支持时静默跳过（不弹提示、不影响操作）
    const haptics = plugin('Haptics');
    if (haptics && typeof haptics.impact === 'function') {
      const style = typeof ms === 'string' ? ms : (ms >= 18 ? 'MEDIUM' : 'LIGHT');
      try {
        const res = haptics.impact({ style: style.toUpperCase() });
        if (res && res.catch) res.catch(function () {});
        return;
      } catch (err) { /* 落到下面的兜底 */ }
    }
    try {
      if (navigator.vibrate) navigator.vibrate(typeof ms === 'number' ? ms : 10);
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

    // ---- 拖动核心：触摸与鼠标共用 ----
    function startDrag(y, id) {
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      drag = {
        id: id,
        startY: y,
        top: el.scrollTop,
        lastY: y,
        lastT: performance.now(),
        v: 0,
        moved: false
      };
      el.classList.add('dragging');
    }

    function moveDrag(y) {
      if (!drag) return;
      const dy = y - drag.startY;
      if (Math.abs(dy) > 3) drag.moved = true;
      el.scrollTop = drag.top - dy;
      markWheel(kind);
      const now = performance.now();
      const dt = now - drag.lastT;
      if (dt > 4) {
        const v = ((y - drag.lastY) / dt) * 16;
        drag.v = Math.max(-40, Math.min(40, v));
        drag.lastY = y;
        drag.lastT = now;
      }
    }

    function endDrag() {
      if (!drag) return;
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

    el.addEventListener('scroll', function () {
      if (drag) return;
      markWheel(kind);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(snapBack, 140);
    }, { passive: true });

    // 触摸：用 touch 事件驱动，不与 pointer / 页面手势抢。
    // 拖动一旦成立就 preventDefault + stopPropagation，
    // 避免 WebView 的原生滚动把指针事件提前 pointercancel 掉。
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      startDrag(e.touches[0].clientY, 'touch');
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!drag || drag.id !== 'touch' || e.touches.length !== 1) return;
      moveDrag(e.touches[0].clientY);
      if (drag && drag.moved) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    ['touchend', 'touchcancel'].forEach(function (type) {
      el.addEventListener(type, function (e) {
        if (!drag || drag.id !== 'touch') return;
        e.stopPropagation();
        endDrag();
      }, { passive: true });
    });

    // 鼠标 / 手写笔仍走 pointer，并可拖出元素外
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();
      startDrag(e.clientY, 'p' + e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });

    el.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== 'p' + e.pointerId) return;
      moveDrag(e.clientY);
      if (drag && drag.moved && e.cancelable) e.preventDefault();
    }, { passive: false });

    el.addEventListener('pointerup', function (e) {
      if (!drag || drag.id !== 'p' + e.pointerId) return;
      endDrag();
    });

    el.addEventListener('pointercancel', function (e) {
      if (!drag || drag.id !== 'p' + e.pointerId) return;
      endDrag();
    });

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

  // mode: 'calendar' 日历跳转；'diary' 日记补写日期（默认停在当前编辑的日期）
  function openYearPicker(mode) {
    const useDiary = mode === 'diary' && state.diaryEditorOpen && state.diaryDraft;
    const base = useDiary ? keyToDate(state.diaryDraft.date) : jumpBaseDate();
    yearPicker.mode = useDiary ? 'diary' : 'calendar';
    yearPicker.year = base.getFullYear();
    yearPicker.month = base.getMonth() + 1;
    yearPicker.day = base.getDate();
    yearPicker.open = true;
    const title = $('#yearSheetTitle');
    if (title) title.textContent = useDiary ? T('选择日期') : T('跳转到');
    const go = $('#yearGo');
    if (go) go.textContent = useDiary ? T('确定') : T('跳转');
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
    const key = yearPicker.year + '-' + pad2(yearPicker.month) + '-' +
      pad2(Math.min(yearPicker.day, daysInMonth(yearPicker.year, yearPicker.month)));
    // 日记模式：只切换写作页的日期，不跳日历；该日已有日记则进入编辑（同一天仍只有一篇）
    if (yearPicker.mode === 'diary' && state.diaryEditorOpen) {
      const had = !!diaryByDate(key);
      closeYearPicker();
      if (state.diaryDraft && state.diaryDraft.date !== key) openDiaryEditor(key);
      if (had) showToast(T('这天已有日记，已进入编辑'));
      return;
    }
    applyJump(yearPicker.year, yearPicker.month, yearPicker.day);
    closeYearPicker();
    renderAll();
    if (state.view === 'agenda') {
      requestAnimationFrame(function () { agendaScrollTo(state.agendaAnchor, false); });
    } else {
      revealDayDetail();
    }
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
    // 没有已设时间时，滚轮默认停在当前设备时间（而不是 00:00 / 09:00），并居中高亮
    const now = new Date();
    const parsed = parseDpTime(subject.time) || parseDpTime(dateSheet.lastTime) ||
      { h: now.getHours(), m: now.getMinutes() };
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
    state.editingId = '';
    $('#sheetTitle').textContent = T('新建条目');
    $('#saveBtn').textContent = T('保存');
    draft.type = 'event';
    draft.date = preset || (state.view === 'agenda' && anchor >= t ? anchor : t);
    // 新建条目默认用当前设备时间，与时间滚轮的默认位置一致
    const nowClock = new Date();
    draft.time = pad2(nowClock.getHours()) + ':' + pad2(nowClock.getMinutes());

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

  function openEditSheet(id) {
    const base = state.items.find(function (i) { return i.id === id; });
    if (!base) return;
    if (detail.open) closeDetail();

    state.editingId = id;
    draft.type = base.type;
    draft.date = base.date;
    draft.time = (base.recurrence && base.recurrence.time) || base.time || '';
    draft.categoryId = getCategory(base.categoryId) ? base.categoryId : null;
    draft.recurrence = base.recurrence ? JSON.parse(JSON.stringify(base.recurrence)) : null;
    draft.note = base.note || '';
    draft.address = base.address ? Object.assign({}, base.address) : null;
    draft.remindBefore = typeof base.remindBefore === 'number' ? base.remindBefore : null;
    draft.priority = base.priority === 'high';

    $('#sheetTitle').textContent = T('编辑条目');
    $('#saveBtn').textContent = T('保存修改');
    $('#itemTitle').value = base.title;
    $('#noteInput').value = base.note || '';
    $('#remindMinutes').value = typeof base.remindBefore === 'number' ? String(base.remindBefore) : '';
    $('#remindEditor').hidden = typeof base.remindBefore !== 'number';
    $('#saveBtn').disabled = false;
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
    state.editingId = '';
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
    // 用户可能已经输入分钟数、但没点「确定」就直接保存：这里兜底提交，
    // 否则 remindBefore 仍是 null，界面看着有值而提醒永远不会排程。
    if ($('#remindEditor') && !$('#remindEditor').hidden) {
      const pendingRemind = remindEditorValue();
      if (pendingRemind !== null) {
        draft.remindBefore = pendingRemind;
        syncRemindChip();
      }
    }
    const base = state.editingId ? state.items.find(function (i) { return i.id === state.editingId; }) : null;
    // 重复条目的时间以 recurrence.time 为准；编辑后同步过去，详情页与编辑面板才不会显示两套
    const recurrence = draft.recurrence
      ? Object.assign({}, draft.recurrence, { time: draft.time || null })
      : null;
    const item = normalizeItem({
      id: base ? base.id : uid(),
      type: draft.type,
      title: title,
      date: date,
      time: draft.time || null,
      priority: draft.priority ? 'high' : 'normal',
      done: base ? !!base.done : false,
      doneAt: base ? (base.doneAt || null) : null,
      createdAt: base ? base.createdAt : Date.now(),
      updatedAt: Date.now(),
      categoryId: getCategory(draft.categoryId) ? draft.categoryId : null,
      note: draft.note.slice(0, 500),
      address: draft.address,
      remindBefore: typeof draft.remindBefore === 'number' ? draft.remindBefore : null,
      recurrence: recurrence,
      completions: base && base.completions ? base.completions : {}
    });

    state.saving = true;
    $('#saveBtn').disabled = true;
    if (base) state.items[state.items.indexOf(base)] = item;
    else state.items.push(item);
    const ok = await persistItems();

    state.saving = false;
    closeSheet();

    if (state.view === 'agenda') state.agendaAnchor = item.date;
    renderAll();
    scheduleReminders();
    // 有提醒时确保拿到系统通知（Android 13+）与精确闹钟（Android 12+）权限
    if (typeof item.remindBefore === 'number' && isNativeApp()) {
      if (notifyState.status !== 'granted') ensureReminderPermissions();
      else maybeAskExactAlarm();
    }
    if (base) showToast(ok ? T('已保存修改：{title}', { title: shorten(item.title, 14) }) : T('已修改，但没能保存到本机'));
    else showToast(ok ? T('已添加：{title}', { title: shorten(item.title, 18) }) : T('已添加，但没能保存到本机'));
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
    setChipText(el, planDraft.time ? relativeDayLabel(key) + ' ' + planDraft.time : relativeDayLabel(key));
    el.classList.add('active');
  }

  function syncPlanRemindChip() {
    const el = $('#planRemindChip');
    if (!el) return;
    const on = typeof planDraft.remindBefore === 'number';
    setChipText(el, on ? T('提前 {n} 分钟', { n: planDraft.remindBefore }) : T('提醒'));
    el.classList.toggle('active', on);
  }

  function syncPlanPriorityChip() {
    const el = $('#planPriorityChip');
    if (!el) return;
    setChipText(el, planDraft.priority ? T('高优先级') : T('优先级'));
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
        categoryMarkHTML(cat, '--cat-dot:' + cat.color) + esc(cat.name) + '</button>';
    });
    html += '<button class="cat-manage-chip" type="button" data-plan-manage>+ 管理分类</button>';
    box.innerHTML = html;
  }

  function openPlanSheet(presetKind) {
    const t = todayKey();
    state.planEditingId = '';
    $('#planSheetTitle').textContent = T('新建计划');
    $('#planSave').textContent = T('保存');
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

  function openPlanEditSheet(id) {
    const base = state.plans.find(function (p) { return p.id === id; });
    if (!base) return;
    if (detail.open) closeDetail();

    state.planEditingId = id;
    planDraft.kind = base.kind;
    planDraft.date = base.periodStart;
    planDraft.time = base.time || null;
    planDraft.categoryId = getCategory(base.categoryId) ? base.categoryId : null;
    planDraft.address = base.address ? Object.assign({}, base.address) : null;
    planDraft.remindBefore = typeof base.remindBefore === 'number' ? base.remindBefore : null;
    planDraft.priority = base.priority === 'high';

    $('#planSheetTitle').textContent = T('编辑计划');
    $('#planSave').textContent = T('保存修改');
    $('#planTitle').value = base.title;
    $('#planNote').value = base.note || '';
    $('#planRemindInput').value = typeof base.remindBefore === 'number' ? String(base.remindBefore) : '';
    $('#planRemindEditor').hidden = typeof base.remindBefore !== 'number';
    $('#planSave').disabled = false;
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
    state.planEditingId = '';
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
    // 同条目：输入了分钟数但没点「确定」就保存时，兜底提交
    if ($('#planRemindEditor') && !$('#planRemindEditor').hidden) {
      const rawRemind = $('#planRemindInput').value.trim();
      const nRemind = Number(rawRemind);
      if (rawRemind && isFinite(nRemind) && Math.round(nRemind) === nRemind && nRemind >= 1 && nRemind <= 1440) {
        planDraft.remindBefore = nRemind;
        syncPlanRemindChip();
      }
    }
    const base = state.planEditingId ? state.plans.find(function (p) { return p.id === state.planEditingId; }) : null;

    const plan = normalizePlan({
      id: base ? base.id : uid(),
      kind: planDraft.kind,
      title: title,
      periodStart: planPeriodStart(planDraft.kind, date),
      time: planDraft.time || null,
      priority: planDraft.priority ? 'high' : 'normal',
      categoryId: getCategory(planDraft.categoryId) ? planDraft.categoryId : null,
      note: $('#planNote').value.slice(0, 500),
      address: planDraft.address,
      remindBefore: typeof planDraft.remindBefore === 'number' ? planDraft.remindBefore : null,
      done: base ? !!base.done : false,
      doneAt: base ? (base.doneAt || null) : null,
      createdAt: base ? base.createdAt : Date.now(),
      updatedAt: Date.now()
    });
    if (!plan) return;

    state.saving = true;
    $('#planSave').disabled = true;
    if (base) state.plans[state.plans.indexOf(base)] = plan;
    else state.plans.push(plan);
    const ok = await persistPlans();

    state.saving = false;
    closePlanSheet();
    renderPlan();
    scheduleReminders();
    if (typeof plan.remindBefore === 'number' && isNativeApp()) {
      if (notifyState.status !== 'granted') ensureReminderPermissions();
      else maybeAskExactAlarm();
    }
    if (base) showToast(ok ? T('已保存修改：{title}', { title: shorten(plan.title, 14) }) : T('已修改，但没能保存到本机'));
    else showToast(ok ? T('已添加{kind}：{title}', { kind: T(PLAN_KINDS[plan.kind]), title: shorten(plan.title, 16) })
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
    if (!weatherEnabled()) {
      // 关闭状态：只同步状态，不请求、不排程
      if (window.Weather.setEnabled) window.Weather.setEnabled(false);
      stopWeatherTimer();
      return;
    }
    window.Weather.refresh();
    if (!weatherTimer) {
      // 打开时拉一次，之后每 45 分钟刷新；回到前台时也会按需刷新
      weatherTimer = setInterval(function () {
        if (weatherEnabled()) window.Weather.refresh();
      }, 45 * 60 * 1000);
    }
  }

  function stopWeatherTimer() {
    if (weatherTimer) {
      clearInterval(weatherTimer);
      weatherTimer = null;
    }
  }

  // 开关变化后统一收口：排程、在途请求、渲染都只在这里决定
  function applyWeatherSetting() {
    if (!window.Weather) return;
    const on = weatherEnabled();
    if (window.Weather.setEnabled) window.Weather.setEnabled(on);
    if (on) {
      if (!weatherTimer) {
        weatherTimer = setInterval(function () {
          if (weatherEnabled()) window.Weather.refresh();
        }, 45 * 60 * 1000);
      }
      window.Weather.refresh();
    } else {
      stopWeatherTimer();
    }
    if (state.view === 'calendar' && state.selectedDate) renderDayDetail();
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
  // 地址一律由用户输入关键词搜索得到；应用不读取设备定位。
  // 搜索结果只活在这张面板里，关闭即丢弃。

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

    const addr = activeAddressDraft().address;
    $('#addressClear').hidden = !addr;

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

  async function runAddressSearch(q) {
    const query = String(q || '').trim();
    const seq = ++addressSearchSeq;
    if (query.length < 2) {
      addressResultsData = [];
      $('#addressResults').innerHTML = '';
      return;
    }
    addressHint(T('正在搜索地址…'));
    let list;
    try {
      if (!window.Weather || typeof window.Weather.searchAddress !== 'function') {
        throw new Error('no-provider');
      }
      list = await window.Weather.searchAddress(query);
    } catch (err) {
      if (seq !== addressSearchSeq) return;
      addressHint(T('地址搜索失败，请稍后再试。'));
      return;
    }
    if (seq !== addressSearchSeq || $('#addressSearch').value.trim() !== query) return;
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
    $('#lunarToggle').checked = lunarVisible();
    if ($('#almanacToggle')) $('#almanacToggle').checked = almanacVisible();
    if ($('#weatherToggle')) $('#weatherToggle').checked = weatherEnabled();
    $('#notifyState').textContent = notifyState.status === 'granted' && state.exactAlarmStatus === 'denied'
      ? notificationLabel() + ' · ' + T('可能延迟')
      : notificationLabel();

    const cityValue = $('#weatherCityValue');
    if (cityValue) {
      cityValue.textContent = window.Weather ? window.Weather.cityLabel() : T('未选择城市');
    }
    // 天气关闭时，城市入口一并隐藏，避免点了没反应
    const cityBtn = $('#weatherCityBtn');
    if (cityBtn) cityBtn.hidden = !weatherEnabled();

    $$('#langRow .lang-chip').forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.lang === (window.I18N ? window.I18N.lang : 'zh'));
    });

    renderCategoryList();
  }

  // ==================== 首次启动的协议同意 ====================

  function ensureDeviceId() {
    if (state.meta && typeof state.meta.deviceId === 'string' && state.meta.deviceId) {
      return state.meta.deviceId;
    }
    let id = '';
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        id = window.crypto.randomUUID();
      } else if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        id = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
          hex.slice(16, 20) + '-' + hex.slice(20);
      }
    } catch (err) {}
    if (!id) id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    state.meta.deviceId = id;
    return id;
  }

  async function policyDigest() {
    const text = POLICY_TEXT.trim();
    try {
      if (!window.crypto || !window.crypto.subtle || typeof TextEncoder !== 'function') return '';
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    } catch (err) {
      return '';
    }
  }

  // 只有「当前协议版本 + 同一台设备」的同意记录才算有效。
  // 从另一台设备导入的旧记录会保留用于展示，但不会跳过协议确认。
  function hasValidConsent() {
    const consent = state.meta && state.meta.consent;
    if (!consent || typeof consent !== 'object') return false;
    if (consent.policyVersion !== POLICY_VERSION) return false;
    const id = ensureDeviceId();
    return typeof consent.deviceId === 'string' && consent.deviceId === id;
  }

  function renderConsentInfo() {
    const el = $('#consentInfo');
    if (!el) return;
    const local = state.meta && state.meta.consent;
    const imported = state.meta && state.meta.importedConsent;
    // 本机记录优先；只有本机完全没有记录时，才显示备份里带过来的那条（仅展示）
    const consent = (local && local.acceptedAt) ? local : imported;
    if (!consent || !consent.acceptedAt) {
      el.textContent = T('本机尚未记录同意。');
      return;
    }
    const d = new Date(consent.acceptedAt);
    const when = isFinite(d.getTime())
      ? (d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
        pad2(d.getHours()) + ':' + pad2(d.getMinutes()))
      : String(consent.acceptedAt);
    el.textContent = T('上次同意：{time} · 协议版本 {version}', {
      time: when,
      version: consent.policyVersion || '-'
    });
  }

  function renderFingerprint() {
    const el = $('#officialFingerprint');
    if (!el) return;
    if (!OFFICIAL_CERT_SHA256) {
      el.textContent = T('官方签名指纹：生成新密钥后填入（见 README）');
      return;
    }
    el.textContent = T('官方签名指纹：{fp}（可在系统应用信息中核对）', { fp: OFFICIAL_CERT_SHA256 });
  }

  function openAgreement() {
    const page = $('#aboutPage');
    if (!page) return;
    renderConsentInfo();
    renderFingerprint();
    $('#agreementActions').hidden = false;
    $('#aboutClose').hidden = true;
    page.hidden = false;
    page.classList.add('agreement-mode');
    requestAnimationFrame(function () { page.classList.add('open'); });
    const body = page.querySelector('.about-body');
    if (body) body.scrollTop = 0;
  }

  function closeAgreement() {
    const page = $('#aboutPage');
    if (!page) return;
    $('#agreementActions').hidden = true;
    $('#aboutClose').hidden = false;
    page.classList.remove('agreement-mode');
    page.classList.remove('open');
    setTimeout(function () {
      if (!page.classList.contains('open')) page.hidden = true;
    }, 300);
  }

  let acceptingAgreement = false;
  async function acceptAgreement() {
    if (acceptingAgreement) return;
    acceptingAgreement = true;
    ensureDeviceId();
    state.meta.consent = {
      policyVersion: POLICY_VERSION,
      acceptedAt: new Date().toISOString(),
      policyHash: await policyDigest(),
      appVersion: APP_VERSION,
      deviceId: state.meta.deviceId
    };
    const saved = await persistMeta();
    acceptingAgreement = false;
    closeAgreement();
    renderConsentInfo();
    if (!saved) {
      // 存储不可用时仍允许本次使用，但明确告知下次启动会再问一次
      showToast(T('本机存储不可用，同意记录未能保存，下次启动会再次询问'));
    }
    maybeShowPermissionIntro();
  }

  function declineAgreement() {
    const app = plugin('App');
    if (app && typeof app.exitApp === 'function') {
      try {
        app.exitApp();
      } catch (err) {
        console.warn('退出应用失败：', err);
      }
      return;
    }
    // 非 Android 环境无法退出：留在协议页，绝不进入主界面
    showToast(T('需要接受协议才能继续使用'));
  }

  function maybeShowAgreement() {
    if (hasValidConsent()) {
      maybeShowPermissionIntro();
      return;
    }
    openAgreement();
  }

  function openAbout() {
    const page = $('#aboutPage');
    renderConsentInfo();
    renderFingerprint();
    page.classList.remove('agreement-mode');
    $('#agreementActions').hidden = true;
    $('#aboutClose').hidden = false;
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
  }

  function closeAbout() {
    const page = $('#aboutPage');
    if (page.classList.contains('agreement-mode')) return;
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

  // ==================== 权限引导（通知 / 存储） ====================

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

  // 提醒专用渠道：重要性 HIGH 才会横幅弹出；渠道不存在时 Android 会静默丢弃通知。
  // Android 的渠道参数一旦创建就不可修改，旧版本可能已经在设备上留下参数不对的
  // qingjihua-reminders，重建同 id 无效，所以这里改用带版本的新 id，启动时顺带删除旧渠道。
  const REMIND_CHANNEL_ID = 'qingjihua-reminders-v2';
  const REMIND_CHANNEL_LEGACY_ID = 'qingjihua-reminders';
  const REMIND_CHANNEL_IMPORTANCE = 5;
  const REMIND_SMALL_ICON = 'ic_stat_icon';
  const REMIND_SOUND = 'qingjihua_notify';

  // 同一时刻只建一次渠道：启动、授权、排程、测试通知都会调用它
  let channelTask = null;

  function reminderChannelOptions() {
    return {
      id: REMIND_CHANNEL_ID,
      name: T('日程提醒'),
      description: T('计划与条目的到点提醒'),
      // 声音必须给（res/raw 文件名）：Android 8+ 的声音由渠道决定，
      // 只把 sound 写在单条通知上无效，缺渠道音就会变成静音通知。
      sound: REMIND_SOUND,
      importance: REMIND_CHANNEL_IMPORTANCE,
      visibility: 1,      // 1 = 锁屏可见
      vibration: true,
      lights: true
    };
  }

  // 旧渠道只做删除尝试：本来不存在或系统不允许删除都无害，不阻塞启动
  async function dropLegacyReminderChannel(notify) {
    if (!notify || typeof notify.deleteChannel !== 'function') return false;
    try {
      await notify.deleteChannel({ id: REMIND_CHANNEL_LEGACY_ID });
      return true;
    } catch (err) {
      return false;
    }
  }

  async function ensureReminderChannel(notify) {
    if (!notify || typeof notify.createChannel !== 'function') return false;
    if (channelTask) return channelTask;

    const task = (async function () {
      const options = reminderChannelOptions();
      try {
        await notify.createChannel(options);
      } catch (err) {
        state.channelReady = false;
        state.channelInfo = null;
        console.warn('创建通知渠道失败：', err);
        return false;
      }
      // 建完再读回一次：渠道参数只在首次创建时生效，读回的值才是系统里真正生效的
      let info = options;
      try {
        const res = await notify.listChannels();
        const list = (res && res.channels) || [];
        const ch = list.filter(function (c) { return c && c.id === REMIND_CHANNEL_ID; })[0];
        if (ch) info = ch;
      } catch (err) { /* 读不到就按期望值展示，自查面板会标注 */ }
      state.channelInfo = info;
      state.channelReady = true;
      return true;
    })();

    channelTask = task;
    const ok = await task;
    // 失败时允许下次重试；成功则保留结果，避免并发重复创建
    if (!ok) channelTask = null;
    return ok;
  }

  function pluginErrorText(err) {
    if (!err) return '';
    const raw = String(err.message || err);
    if (/not enabled/i.test(raw)) return T('系统通知总开关被关闭');
    if (/exact/i.test(raw)) return T('系统未允许「闹钟和提醒」');
    if (/channel/i.test(raw)) return T('通知渠道不可用');
    return raw.slice(0, 120);
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
    // 精确闹钟状态决定排程精度与界面标注，每次检查权限时一起刷新
    if (notify) await refreshExactAlarmStatus(notify);
    renderSettings();
    renderPermissionSheet();
    scheduleReminders();
    return notifyState.status;
  }

  async function refreshAllPermissionStates() {
    await refreshNotifyState();
    renderPermissionSheet();
    await renderNotifyDiagnostics();
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
    if (status === 'granted') maybeAskExactAlarm();
    return status;
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

    const notifyDenied = notifyState.status === 'denied';
    $('#permDenied').hidden = !notifyDenied;

    const allowBtn = $('#permAllow');
    if (allowBtn) {
      allowBtn.hidden = notifyState.status === 'granted' || notifyState.status === 'unsupported';
      allowBtn.textContent = notifyDenied ? T('重新检查') : T('允许通知');
    }

    const later = $('#permLater');
    if (later) later.textContent = T('开始使用');
  }

  function openPermissionSheet() {
    const page = $('#permSheet');
    if (!page || !page.hidden) return;
    renderPermissionSheet();
    refreshAllPermissionStates();
    // 打开面板时顺手重排一次：保证实例表里的触发时间/状态是最新的
    scheduleReminders();
    renderNotifyDiagnostics();
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

  // 旧版本曾把备份写进应用私有目录 backups/；现在只做清理，不再新增
  async function clearNativeBackups() {
    const fs = plugin('Filesystem');
    if (!fs || !isNativeApp()) return { removed: 0 };
    let files = [];
    try {
      const res = await fs.readdir({ path: 'backups/', directory: 'DATA' });
      files = backupFileList(res && res.files);
    } catch (err) {
      files = [];
    }
    let removed = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        await fs.deleteFile({ path: 'backups/' + files[i], directory: 'DATA' });
        removed++;
      } catch (err) {}
    }
    // 顺带清掉导出用的缓存目录，避免临时文件残留
    try {
      await fs.rmdir({ path: 'backup-export', directory: 'CACHE', recursive: true });
    } catch (err) {}
    return { removed: removed };
  }

  // 自检用：查看应用私有目录里还剩几份旧备份（不在界面暴露）
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

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const raw = String(reader.result || '');
        const comma = raw.indexOf(',');
        resolve(comma === -1 ? raw : raw.slice(comma + 1));
      };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(b64, type) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
  }

  async function exportJSON(includeFiles) {
    // 「包含附件」需要把 Blob 转成 base64 一并写入；不含附件时与旧版备份完全一致
    let withFiles = !!includeFiles && storage.status === 'idb';
    let diaryFiles = null;
    if (withFiles) {
      diaryFiles = [];
      for (let i = 0; i < state.diary.length; i++) {
        const entry = state.diary[i];
        for (let j = 0; j < entry.attachments.length; j++) {
          const meta = entry.attachments[j];
          let rec = null;
          try { rec = await diaryFileGet(meta.id); } catch (err) { rec = null; }
          if (!rec || !rec.data) continue;
          diaryFiles.push({
            id: meta.id,
            date: entry.date,
            name: meta.name,
            type: meta.type,
            kind: meta.kind,
            size: rec.data.size || meta.size || 0,
            w: meta.w || 0,
            h: meta.h || 0,
            data: await blobToBase64(rec.data),
            thumb: rec.thumb ? await blobToBase64(rec.thumb) : ''
          });
        }
      }
      // 没有可写的附件时退回默认模式，避免 manifest 与实际内容不一致
      if (!diaryFiles.length) withFiles = false;
    }
    const attachmentsSkipped = !!includeFiles && !withFiles;

    // manifest 只保留恢复真正需要的字段：不写设备型号，也不写时区，
    // 避免备份在网盘/聊天里成为可关联的弱指纹。
    const payload = {
      app: isEn() ? 'AeroPlan' : '氢计划',
      schema: 'qingjihua-backup',
      manifest: {
        formatVersion: 1,
        schemaVersion: 8,
        appVersion: APP_VERSION,
        createdAt: new Date().toISOString(),
        includeAttachments: withFiles,
        counts: {
          items: state.items.length,
          plans: state.plans.length,
          categories: state.categories.length,
          diary: state.diary.length
        },
        encrypted: false
      },
      settings: {
        theme: preferredTheme(),
        language: window.I18N ? window.I18N.lang : 'zh',
        weatherEnabled: weatherEnabled()
      },
      categories: state.categories,
      items: state.items,
      plans: state.plans,
      diary: state.diary,
      consent: state.meta.consent || null
    };
    if (withFiles) payload.diaryFiles = diaryFiles;

    const json = JSON.stringify(payload, null, 2);
    const fileName = backupFileName();
    const fs = plugin('Filesystem');
    const share = plugin('Share');
    let shared = false;

    // 写进缓存目录的临时文件 → 交给系统保存/分享面板 → 面板关闭后删掉临时文件，
    // 不在应用私有目录里留副本；用户选择的位置（下载 / 微信 / 网盘）由系统接管。
    if (fs && isNativeApp()) {
      const tempPath = 'backup-export/' + fileName;
      try {
        await fs.writeFile({
          path: tempPath,
          data: json,
          directory: 'CACHE',
          encoding: 'utf8',
          recursive: true
        });
        if (share && typeof share.share === 'function') {
          const uriRes = await fs.getUri({ path: tempPath, directory: 'CACHE' });
          const uri = uriRes && uriRes.uri;
          if (uri) {
            await share.share({
              title: isEn() ? 'AeroPlan backup' : '氢计划备份',
              text: isEn() ? 'AeroPlan backup file' : '氢计划备份文件',
              url: uri,
              dialogTitle: isEn() ? 'Save or share backup' : '保存或分享备份'
            });
            shared = true;
          }
        }
      } catch (err) {
        console.warn('调起系统保存面板失败：', err);
      } finally {
        try { await fs.deleteFile({ path: tempPath, directory: 'CACHE' }); } catch (e2) {}
      }
    }

    if (!shared) {
      // 网页版或系统分享不可用：直接下载，落到浏览器/WebView 的「下载」目录
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
    persistMeta();
    renderSettings();
    showToast(attachmentsSkipped
      ? T('当前环境读不到附件，备份只包含日记文字与附件信息')
      : (shared
        ? T('备份已生成，请在系统面板里选择保存位置')
        : T('已备份，文件在手机的“下载”目录里')));
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
    if (!isArrayFile && (!data || typeof data !== 'object')) {
      showToast(T('导入失败：文件里找不到条目列表'));
      return;
    }
    const rawItems = isArrayFile ? data : (Array.isArray(data.items) ? data.items : []);
    // 旧备份没有 diary 字段：按空数组处理，不报错
    const hasDiary = !isArrayFile && Array.isArray(data.diary);
    const rawDiary = hasDiary ? data.diary : [];
    if (!isArrayFile && !Array.isArray(data.items) && !hasDiary) {
      showToast(T('导入失败：文件里找不到条目列表'));
      return;
    }

    const rawCats = !isArrayFile && data && Array.isArray(data.categories) ? data.categories : [];
    const cleanedCats = rawCats.map(normalizeCategory).filter(Boolean);
    const rawPlans = !isArrayFile && data && Array.isArray(data.plans) ? data.plans : [];
    const cleanedPlans = rawPlans.map(normalizePlan).filter(Boolean);
    const cleanedDiary = rawDiary.map(normalizeDiary).filter(Boolean);
    const rawDiaryFiles = !isArrayFile && Array.isArray(data.diaryFiles) ? data.diaryFiles : [];
    const includeAttachments = !isArrayFile && !!(data.manifest && data.manifest.includeAttachments === true);

    const cleaned = [];
    let skipped = 0;
    rawItems.forEach(function (raw) {
      const item = normalizeItem(raw);
      if (item) cleaned.push(item);
      else skipped += 1;
    });

    if (!cleaned.length && !cleanedPlans.length && !cleanedDiary.length) {
      showToast(T('导入失败：没有可识别的条目'));
      return;
    }

    // 旧备份可能带 deviceModel / timeZone 等字段；这里一律忽略，不要求它们存在。
    let importedConsent = null;
    if (!isArrayFile && data && data.consent && typeof data.consent === 'object') {
      const c = data.consent;
      if (typeof c.policyVersion === 'string' && typeof c.acceptedAt === 'string') {
        importedConsent = {
          policyVersion: c.policyVersion.slice(0, 32),
          acceptedAt: c.acceptedAt,
          policyHash: typeof c.policyHash === 'string' ? c.policyHash.slice(0, 64) : '',
          appVersion: typeof c.appVersion === 'string' ? c.appVersion.slice(0, 32) : '',
          deviceId: typeof c.deviceId === 'string' ? c.deviceId.slice(0, 64) : ''
        };
      }
    }

    pendingImport = {
      items: cleaned,
      categories: cleanedCats,
      plans: cleanedPlans,
      diary: cleanedDiary,
      diaryFiles: rawDiaryFiles,
      hasDiary: hasDiary,
      includeAttachments: includeAttachments,
      hasCategories: !isArrayFile && !!data && Array.isArray(data.categories),
      consent: importedConsent,
      // 旧备份没有 settings.weatherEnabled：保持本机当前设置，不回滚成默认值
      weatherEnabled: !isArrayFile && data && data.settings && typeof data.settings.weatherEnabled === 'boolean'
        ? data.settings.weatherEnabled
        : null
    };
    const currentIds = new Set(state.items.map(function (i) { return i.id; }));
    const added = cleaned.filter(function (i) { return !currentIds.has(i.id); }).length;
    const updated = cleaned.length - added;

    const summaryBits = isEn()
      ? {
        read: 'Read <b>' + cleaned.length + '</b> records',
        plans: ' · <b>' + cleanedPlans.length + '</b> plans',
        cats: ' · <b>' + cleanedCats.length + '</b> categories',
        diary: ' · <b>' + cleanedDiary.length + '</b> diary entries',
        files: includeAttachments ? ' (with attachments)' : '',
        skipped: ' (skipped ' + skipped + ' invalid records)',
        merge: 'Added ' + added + ' · updated ' + updated + ' with the same ID',
        merged: ' · categories merged by ID',
        uncat: ' · no categories in the file; items are uncategorized'
      }
      : {
        read: '读到 <b>' + cleaned.length + '</b> 条记录',
        plans: ' · <b>' + cleanedPlans.length + '</b> 条计划',
        cats: ' · <b>' + cleanedCats.length + '</b> 个分类',
        diary: ' · <b>' + cleanedDiary.length + '</b> 篇日记',
        files: includeAttachments ? '（含附件）' : '',
        skipped: '（忽略 ' + skipped + ' 条无效记录）',
        merge: '新增 ' + added + ' 条 · 更新同 ID ' + updated + ' 条',
        merged: ' · 分类按 ID 合并',
        uncat: ' · 文件里没有分类，条目归为未分类'
      };

    $('#importSummary').innerHTML =
      summaryBits.read +
      (cleanedPlans.length ? summaryBits.plans : '') +
      (cleanedCats.length ? summaryBits.cats : '') +
      (cleanedDiary.length ? summaryBits.diary + summaryBits.files : '') +
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

  // 含附件的备份：把 base64 还原成 Blob 写回 diaryFiles；缺一条就跳过，不影响其余数据
  async function restoreDiaryFiles(list) {
    if (!Array.isArray(list) || !list.length || storage.status !== 'idb') return 0;
    let restored = 0;
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      if (!raw || typeof raw.id !== 'string' || typeof raw.data !== 'string') continue;
      try {
        const data = base64ToBlob(raw.data, raw.type);
        const thumb = raw.thumb ? base64ToBlob(raw.thumb, 'image/jpeg') : null;
        await diaryFilePut({ id: raw.id, data: data, thumb: thumb, date: raw.date || '' });
        restored += 1;
      } catch (err) {
        console.warn('还原附件失败：', err);
      }
    }
    return restored;
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
      // 旧备份没有 diary：替换时保持本机日记不动，避免「用旧备份覆盖」时误删日记
      if (pendingImport.hasDiary) {
        // 被替换掉的旧日记，如果它的附件不再被新数据引用，一并清掉，避免 Blob 泄漏
        const oldIds = [];
        state.diary.forEach(function (e) {
          (e.attachments || []).forEach(function (a) { oldIds.push(a.id); });
        });
        state.diary = pendingImport.diary.map(function (e) { return Object.assign({}, e); });
        if (oldIds.length && storage.status === 'idb') {
          const keep = new Set();
          state.diary.forEach(function (e) {
            (e.attachments || []).forEach(function (a) { keep.add(a.id); });
          });
          const orphan = oldIds.filter(function (id) { return !keep.has(id); });
          if (orphan.length) {
            try { await diaryFileDelete(orphan); } catch (err) { console.warn('清理旧附件失败：', err); }
          }
        }
      }
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

      // 日记按 date 合并：同一天以导入的那篇为准
      if (pendingImport.hasDiary) {
        const diaryMap = new Map();
        state.diary.forEach(function (e) { diaryMap.set(e.date, e); });
        pendingImport.diary.forEach(function (e) { diaryMap.set(e.date, Object.assign({}, e)); });
        state.diary = Array.from(diaryMap.values());
      }
    }

    state.agendaFilters = state.agendaFilters.filter(function (id) { return !!getCategory(id); });

    const importedConsent = pendingImport.consent;
    const importedWeather = pendingImport.weatherEnabled;
    const importedFiles = pendingImport.includeAttachments ? pendingImport.diaryFiles : [];
    await persistCategories();
    await persistItems();
    await persistPlans();
    sortDiary();
    await persistDiary(true);
    if (importedFiles && importedFiles.length) {
      if (storage.status === 'idb') await restoreDiaryFiles(importedFiles);
      else showToast(T('当前环境不支持附件，备份里的附件没有还原'));
    }
    pendingImport = null;
    // 天气开关随备份恢复；旧备份缺字段时保留本机值
    if (typeof importedWeather === 'boolean') {
      state.meta.weatherEnabled = importedWeather;
      await persistMeta();
      applyWeatherSetting();
    }
    // 备份里的同意记录只保留用于展示，绝不覆盖本机记录：
    // 覆盖会让当前设备已有的有效同意失效，导致下次启动莫名重新弹窗。
    if (importedConsent) {
      state.meta.importedConsent = importedConsent;
      await persistMeta();
      renderConsentInfo();
    }
    $('#importPreview').hidden = true;
    renderAll();
    scheduleReminders();
    showToast(mode === 'replace' ? T('已替换为备份数据') : T('已合并导入'));
  }

  function clearAllItems() {
    openModal({
      kind: 'clear-all',
      title: T('删除所有数据'),
      text: T('将删除 {items} 条安排、{plans} 条计划、{diary} 篇日记、{cats} 个分类，以及全部设置、本地缓存与已排程的提醒。\n\n删除后无法恢复，建议先备份。', {
        items: state.items.length,
        plans: state.plans.length,
        diary: state.diary.length,
        cats: state.categories.length
      }),
      confirmText: T('删除'),
      danger: true,
      onConfirm: performClearAll
    });
  }

  // 删除全部数据必须把同意记录（policyVersion / acceptedAt / policyHash /
  // appVersion / deviceId）一起清掉，否则会留下「数据清空但已同意」的中间态。
  // IndexedDB 用同一个事务写五个键；localStorage 没有事务，按数据→元数据的顺序写，
  // 即使中途失败，内存里的 meta 也已重置，界面会立即回到未同意状态。
  async function persistClearedState() {
    const meta = Object.assign({}, state.meta);
    try {
      if (storage.status === 'idb') {
        await idbSetMany([
          ['items', []],
          ['plans', []],
          ['categories', []],
          ['diary', []],
          ['meta', meta]
        ]);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_ITEMS_KEY, '[]');
        localStorage.setItem(LS_PLANS_KEY, '[]');
        localStorage.setItem(LS_CATS_KEY, '[]');
        localStorage.setItem(LS_DIARY_KEY, '[]');
        localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
      } else {
        storage.memoryItems = [];
        storage.memoryPlans = [];
        storage.memoryCats = [];
        storage.memoryDiary = [];
        storage.memoryMeta = meta;
      }
      return true;
    } catch (err) {
      console.error('清空数据写入失败：', err);
      return false;
    }
  }

  async function performClearAll() {
    // 先取消旧提醒预约：meta 重置后就找不到上一轮的 id 了
    const oldReminderIds = Array.isArray(state.meta.reminderIds) ? state.meta.reminderIds.slice() : [];
    const notify = plugin('LocalNotifications');
    if (notify && oldReminderIds.length) {
      try {
        await notify.cancel({ notifications: oldReminderIds.map(function (id) { return { id: id }; }) });
      } catch (err) {
        console.warn('取消旧提醒失败：', err);
      }
    }
    state.reminderTimers.forEach(function (timer) { clearTimeout(timer); });
    state.reminderTimers = [];
    state.firedReminders = {};
    state.nativeReminderIds = [];

    state.items = [];
    state.plans = [];
    state.diary = [];
    state.categories = [];
    state.agendaFilters = [];
    state.editCategoryId = '';
    draft.categoryId = null;

    // 日记附件一并清空：写作页、草稿、预览与缩略图缓存都不留残余
    clearTimeout(diarySaveTimer);
    state.diaryDraft = null;
    state.diaryEditorOpen = false;
    state.diaryEditingDate = '';
    state.diaryManage = false;
    state.diarySel = new Set();
    state.diaryQuery = '';
    state.diaryMonth = '';
    state.diaryFilter = 'all';
    closeDiaryViewer();
    closeAttachSheet();
    closeExportSheet();
    diaryReleaseUrls();
    const diaryEditorEl = $('#diaryEditor');
    if (diaryEditorEl) {
      diaryEditorEl.classList.remove('open');
      diaryEditorEl.hidden = true;
    }
    try { await diaryFileClear(); } catch (err) { console.warn('清空日记附件失败：', err); }

    // 整体重置 meta：语言、主题、农历、提醒列表、权限引导标记、备份记录、
    // 天气城市和同意记录全部回到出厂状态。界面随后按默认值重新渲染。
    state.meta = { samplesCleared: true, reminderIds: [] };
    // Weather 模块持有 meta 引用；换了对象要重新注入，否则之后选的城市写不进新 meta
    if (window.Weather && typeof window.Weather.configure === 'function') {
      window.Weather.configure({ meta: state.meta });
    }

    // 界面状态一并回到首次安装：日历视图 + 今天，收起所有面板
    state.view = 'calendar';
    state.month = new Date();
    state.selectedDate = todayKey();
    state.agendaAnchor = '';
    state.scheduleAnchor = '';
    state.sheetOpen = false;
    state.planSheetOpen = false;
    state.editingId = '';
    state.planEditingId = '';
    state.openDoneGroups.clear();
    state.expandedGroups.clear();
    // 批量选择状态一并清空，避免清空数据后仍残留勾选
    state.batchMode = false;
    state.batchSel = new Set();
    state.batchLock = 0;
    document.body.classList.remove('batch-mode');
    state.lastDayKey = '';
    if ($('#settingsPage') && !$('#settingsPage').hidden) {
      state.settingsOpen = true;
      closeSettings();
    }
    state.settingsOpen = false;
    if (detail.open) closeDetail();

    // 语言回到中文（写回镜像键，避免下次启动按系统语言又变成英文）
    try { localStorage.setItem(LANG_MIRROR_KEY, 'zh'); } catch (err) {}
    if (window.I18N && window.I18N.lang !== 'zh') window.I18N.setLang('zh');
    if (window.I18N) window.I18N.apply(document.body);
    applyTheme();

    // 连带清理缓存、旧版本遗留的备份文件与天气数据（含已选城市）
    clearAllCaches();
    await clearNativeBackups();
    const saved = await persistClearedState();
    renderAll();
    renderSettings();
    // 出厂设置里天气是开启的：重新拉起排程（此时无城市，不会发起请求）
    applyWeatherSetting();
    // 渲染当前视图会重新填充当月的日期换算结果；这里再清一次，确保清空后自检为 0
    clearAllCaches();
    scheduleReminders();
    showToast(saved ? T('已删除所有数据') : T('已删除，但未能写入本机'));
    // 不重启应用：立即弹出协议页，必须重新同意才回到主界面
    openAgreement();
  }

  // ==================== 提醒（前台兜底 + 系统排程） ====================
  // 保存条目时就把提醒交给系统（LocalNotifications）按触发时刻预约，
  // 这样 App 退到后台、锁屏、甚至被关掉也能按时弹出；前台仍保留页面内提示作为兜底。

  // 排程窗口覆盖 60 天：原来只看「今天起 14 天」，明天以后的条目也不会漏。
  const REMIND_HORIZON_DAYS = 60;
  const REMIND_PER_ITEM = 60;
  const REMIND_MAX = 180;
  // 全天 / 未设时间的条目没有基准时刻，统一按当天 09:00 计算，
  // 详情页会注明这一基准，避免「设了提醒却永远不响」。
  const REMIND_DEFAULT_TIME = '09:00';

  function clearReminderTimers() {
    state.reminderTimers.forEach(function (timer) { clearTimeout(timer); });
    state.reminderTimers = [];
  }

  function effectiveRemind(item) {
    return typeof item.remindBefore === 'number' ? item.remindBefore : null;
  }

  // 系统按整秒触发：只做向上取整。已经过去的时间必须如实返回过去值，
  // 由调用方跳过并写进自查表；旧实现把它钳到「现在 +1 秒」，导致过期提醒被当成
  // 立即提醒排进去，而真正要排的过去判断永远不会生效。
  function wholeSecond(ms) {
    return Math.ceil(ms / 1000) * 1000;
  }

  // 条目 / 计划在某一天的实际触发时刻。没有具体时间时用 REMIND_DEFAULT_TIME 作基准。
  function reminderFireTime(item, key, before) {
    const raw = (item.recurrence && item.recurrence.time) || item.time || '';
    const timeText = raw || REMIND_DEFAULT_TIME;
    const parts = timeText.split(':').map(Number);
    const target = keyToDate(key);
    target.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
    return {
      at: wholeSecond(target.getTime() - before * 60000),
      allDay: !raw,
      timeText: timeText
    };
  }

  function reminderClockText(ms) {
    const d = new Date(ms);
    return dateKey(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // 每条排程都要带齐的四项：渠道、小图标、允许待机、点开自动消失。
  // 缺渠道 Android 会静默丢通知；缺小图标构建会失败；autoCancel 避免用户点开后还留在通知栏。
  function nativeNotificationPayload(id, title, body, fireAt, extra) {
    return {
      id: id,
      title: title,
      body: body,
      channelId: REMIND_CHANNEL_ID,
      smallIcon: REMIND_SMALL_ICON,
      autoCancel: true,
      schedule: { at: new Date(wholeSecond(fireAt)), allowWhileIdle: true },
      extra: extra || {}
    };
  }

  function scheduleReminders() {
    clearReminderTimers();
    const now = Date.now();
    const t = todayKey();
    const windowEnd = addDays(t, REMIND_HORIZON_DAYS);

    // 原生端：有 LocalNotifications 且已授权时，交给系统排程（App 关掉、锁屏也能弹）
    const notify = localNotifyPlugin();
    const useNative = !!(notify && typeof notify.schedule === 'function' &&
      notifyState.status === 'granted');
    const pending = [];
    // 诊断表：每一行对应「一个带提醒的实例」，记录它为什么排上或为什么没排上
    const report = [];
    const usedIds = {};

    function pushRow(row) {
      report.push(row);
      return row;
    }

    function baseRow(item, key, before, info) {
      return {
        key: String(item.id) + '|' + key,
        title: item.title || '',
        when: key + ' ' + (info.allDay
          ? T('未设时间') + '（' + T('基准') + ' ' + REMIND_DEFAULT_TIME + '）'
          : info.timeText),
        before: before,
        fireText: reminderClockText(info.at),
        status: 'queued',
        numericId: '',
        reason: ''
      };
    }

    function skipRow(item, key, before, info, reason) {
      const row = baseRow(item, key, before, info);
      row.status = 'skip';
      row.reason = reason;
      return pushRow(row);
    }

    function consider(item, key, before, kind) {
      const info = reminderFireTime(item, key, before);
      const row = baseRow(item, key, before, info);
      const diff = info.at - now;
      if (diff <= 0) {
        row.status = 'skip';
        row.reason = T('触发时间已过去');
        pushRow(row);
        return false;
      }
      // 网页端只留 24 小时内的页面计时器；原生端按较长的日历窗口预约
      if (!useNative && diff >= 24 * 60 * 60 * 1000) {
        row.status = 'skip';
        row.reason = T('网页版只排 24 小时内');
        pushRow(row);
        return false;
      }
      // 通知 id 按「条目 + 日期」生成；万一两条撞到同一个 id，就顺延到下一个空位，
      // 避免后一条把前一条覆盖掉（同一个 id 在系统里只会保留最后一条）。
      let numericId = reminderNumericId(item, key);
      let guard = 0;
      while (usedIds[numericId] && guard < 16) {
        numericId = (numericId % 2147483646) + 1;
        guard += 1;
      }
      usedIds[numericId] = true;
      row.status = 'queued';
      row.numericId = String(numericId);
      if (guard > 0) row.reason = T('id 碰撞，已顺延');
      pushRow(row);
      pending.push({ item: item, key: key, fireAt: info.at, diff: diff, kind: kind, numericId: numericId, row: row });
      return true;
    }

    state.items.forEach(function (item) {
      const before = effectiveRemind(item);
      if (before === null) return;
      if (!item.recurrence && item.done) {
        skipRow(item, item.date, before, reminderFireTime(item, item.date, before), T('条目已完成，不再提醒'));
        return;
      }

      const keys = occurrenceDatesIn(item, t, windowEnd);
      if (!keys.length) {
        if (!item.recurrence) {
          skipRow(item, item.date, before, reminderFireTime(item, item.date, before),
            item.date < t ? T('条目日期已过去') : T('超出 {n} 天排程窗口').replace('{n}', REMIND_HORIZON_DAYS));
        }
        return;
      }

      let added = 0;
      keys.some(function (key) {
        if (item.recurrence && item.completions[key]) return false;
        if (consider(item, key, before, 'item')) added += 1;
        return added >= REMIND_PER_ITEM;
      });
    });

    // 计划提醒：以周期首日 + 设定时间（未设时用 REMIND_DEFAULT_TIME）触发
    state.plans.forEach(function (plan) {
      const before = effectiveRemind(plan);
      if (before === null) return;
      const key = plan.periodStart || '';
      if (plan.done) {
        skipRow(plan, key, before, reminderFireTime(plan, key, before), T('计划已完成，不再提醒'));
        return;
      }
      if (!key || key < t) {
        skipRow(plan, key, before, reminderFireTime(plan, key, before), T('周期已过去'));
        return;
      }
      if (key > windowEnd) {
        skipRow(plan, key, before, reminderFireTime(plan, key, before),
          T('超出 {n} 天排程窗口').replace('{n}', REMIND_HORIZON_DAYS));
        return;
      }
      consider(plan, key, before, 'plan');
    });

    state.reminderReport = report;

    if (useNative) {
      const ordered = pending.slice().sort(function (a, b) { return a.fireAt - b.fireAt; });
      // 超出单轮上限的实例如实标出来，而不是悄悄丢掉
      ordered.slice(REMIND_MAX).forEach(function (p) {
        p.row.status = 'skip';
        p.row.reason = T('超出本轮排程上限 {n} 条').replace('{n}', REMIND_MAX);
      });

      const notifications = ordered
        .slice(0, REMIND_MAX)
        .map(function (p) {
          const timeText = (p.item.recurrence && p.item.recurrence.time) || p.item.time || '';
          return nativeNotificationPayload(
            p.numericId,
            T('氢计划提醒'),
            (timeText || T('全天')) + ' · ' + monthDay(p.key) + ' · ' + p.item.title,
            p.fireAt,
            {
              itemId: p.item.id,
              date: p.key,
              kind: p.kind,
              // 记录本条是按精确还是允许延迟排的，排查时可以对照系统设置
              exact: state.exactAlarmStatus !== 'denied'
            }
          );
        });

      // 排程 id 记到 meta 里：App 重启后仍能准确取消上一轮预约
      const previous = Array.isArray(state.meta.reminderIds) ? state.meta.reminderIds.slice() : [];
      const newIds = notifications.map(function (n) { return n.id; });
      // 只清掉本轮不再需要的旧 id；同一 id 重新排程会覆盖旧闹钟，不会重复弹
      const stale = previous.filter(function (id) { return newIds.indexOf(id) === -1; });

      const gen = ++state.nativeReminderGen;

      const cancelIds = function (ids) {
        if (!ids.length) return Promise.resolve();
        return Promise.resolve(notify.cancel({
          notifications: ids.map(function (id) { return { id: id }; })
        })).catch(function (err) {
          console.warn('取消旧提醒失败：', err);
        });
      };

      // 顺序：建渠道 → 先排程 → 再清理旧 id。
      // 先排程后清理：即使排程被系统拒绝，上一轮的提醒仍留在系统里，不会「旧的被取消、新的没排上」。
      Promise.resolve(ensureReminderChannel(notify))
        .then(function (channelOk) {
          if (gen !== state.nativeReminderGen) return null;
          if (!channelOk) throw new Error('notification channel unavailable');
          if (!notifications.length) return { ids: [] };
          return Promise.resolve(notify.schedule({ notifications: notifications }))
            .then(function () {
              // 回读系统里的排程：排程调用成功但被系统丢掉时，自查表能直接看出来
              return Promise.resolve(notify.getPending()).then(function (res) {
                return { ids: ((res && res.notifications) || []).map(function (n) { return n.id; }) };
              }).catch(function () { return { ids: null }; });
            });
        })
        .then(function (result) {
          if (gen !== state.nativeReminderGen) return;
          // 只有排程成功才改写 meta，失败时保留上一轮 id 以便下次继续清理
          state.meta.reminderIds = notifications.length ? newIds : [];
          state.nativeReminderIds = state.meta.reminderIds.slice();
          persistMeta();
          const readback = result && result.ids;
          const missing = readback ? newIds.filter(function (id) { return readback.indexOf(id) === -1; }) : [];
          notifications.forEach(function (n) {
            const p = pending.filter(function (row) { return row.numericId === n.id; })[0];
            if (!p) return;
            p.row.status = 'ok';
            if (readback && readback.indexOf(n.id) === -1) {
              p.row.status = 'fail';
              p.row.reason = T('系统未接受该排程');
            }
          });
          state.nativeScheduleError = missing.length
            ? T('系统未回读 {n} 条排程，可能被省电策略拦截').replace('{n}', missing.length)
            : '';
          return cancelIds(stale);
        })
        .then(function () {
          if (gen !== state.nativeReminderGen) return;
          state.reminderReport = report;
          renderNotifyDiagnostics();
        })
        .catch(function (err) {
          if (gen !== state.nativeReminderGen) return;
          // 系统拒绝排程时不再“装作已排程”：记录原因，并保留前台页面计时器兜底
          state.nativeScheduleError = pluginErrorText(err);
          console.warn('本地通知排程失败：', err);
          pending.forEach(function (p) {
            if (p.row.status === 'queued') {
              p.row.status = 'fail';
              p.row.reason = state.nativeScheduleError || T('排程失败');
            }
          });
          state.reminderReport = report;
          renderNotifyDiagnostics();
          pending.forEach(function (p) {
            // setTimeout 超过 2^31ms 会溢出成立即触发，只兜底 24 小时内的
            if (p.diff >= 24 * 60 * 60 * 1000) return;
            const timer = setTimeout(function () {
              fireReminder(p.item, p.key);
            }, p.diff);
            state.reminderTimers.push(timer);
          });
        });
      return;
    }

    // 网页版：没有系统排程，只能用页面计时器兜底，表格里标明
    pending.forEach(function (p) {
      // 原生环境里权限没给：连系统排程都不会发生，如实写进表里，方便用户对照
      if (!useNative && notify && notifyState.status !== 'granted') {
        p.row.status = 'skip';
        p.row.reason = T('通知权限未允许');
        return;
      }
      p.row.status = p.row.status === 'queued' ? 'timer' : p.row.status;
      const timer = setTimeout(function () {
        fireReminder(p.item, p.key);
      }, p.diff);
      state.reminderTimers.push(timer);
    });
    state.reminderReport = report;
    renderNotifyDiagnostics();
  }

  // 申请通知权限；Android 12+ 再检查「精确闹钟」权限。返回是否已授权
  async function ensureReminderPermissions(options) {
    const notify = localNotifyPlugin();
    if (!notify) return false;
    let granted = false;
    try {
      const cur = await notify.checkPermissions();
      granted = cur && cur.display === 'granted';
      if (!granted) {
        const res = await notify.requestPermissions();
        granted = res && res.display === 'granted';
      }
    } catch (err) {
      granted = false;
    }
    notifyState.native = true;
    notifyState.checked = true;
    notifyState.status = granted ? 'granted' : 'denied';
    renderSettings();
    renderPermissionSheet();
    if (!granted) return false;

    await ensureReminderChannel(notify);
    await maybeAskExactAlarm(options && options.quiet);
    scheduleReminders();
    return true;
  }

  // 精确闹钟：Android 13+ 用 USE_EXACT_ALARM 自动授予（没有用户开关）；
  // Android 12/12L 依赖 SCHEDULE_EXACT_ALARM，被关闭时只能退化到「允许延迟」的排程。
  // 优先问原生的 canScheduleExactAlarms()，没有这个接口时退回插件自带的检查。
  async function canScheduleExactAlarms(notify) {
    const target = notify || localNotifyPlugin();
    if (!target) return 'unsupported';
    if (typeof target.canScheduleExactAlarms === 'function') {
      try {
        const res = await target.canScheduleExactAlarms();
        const granted = res && (res.granted === true || res.granted === 'granted' || res.exact_alarm === 'granted');
        return granted ? 'granted' : 'denied';
      } catch (err) { /* 原生接口不可用，继续用插件自带的检查 */ }
    }
    if (typeof target.checkExactNotificationSetting === 'function') {
      try {
        const res = await target.checkExactNotificationSetting();
        const value = res && (res.exact_alarm || res.exactAlarm) || '';
        if (value === 'granted') return 'granted';
        if (value === 'denied') return 'denied';
        return 'not-required';
      } catch (err) {
        return 'unknown';
      }
    }
    return 'unsupported';
  }

  async function refreshExactAlarmStatus(notify) {
    state.exactAlarmStatus = await canScheduleExactAlarms(notify);
    renderSettings();
    return state.exactAlarmStatus;
  }

  async function maybeAskExactAlarm(quiet) {
    const notify = localNotifyPlugin();
    if (!notify) return;
    const value = await refreshExactAlarmStatus(notify);
    if (value !== 'denied') return;
    if (quiet || state.meta.exactAlarmAsked) return;
    state.meta.exactAlarmAsked = 1;
    persistMeta();
    openModal({
      kind: 'exact-alarm',
      title: T('允许精确提醒'),
      text: T('系统里「闹钟和提醒」未允许：提醒会退化为非精确排程，可能延迟（通常几分钟内）。允许后可准时；若系统里找不到这一项，请在「自启动 / 后台运行」里允许本应用，并把电池策略设为「不限制」。'),
      confirmText: T('去允许'),
      onConfirm: function () {
        if (typeof notify.changeExactNotificationSetting === 'function') {
          Promise.resolve(notify.changeExactNotificationSetting()).catch(function (err) {
            console.warn('打开精确闹钟设置失败：', err);
          });
        }
      }
    });
  }

  // 自查面板：把「权限 / 渠道 / 精确闹钟 / 系统里已排程数量 / 最近错误」一次列清楚，
  // 用户不用猜是哪一环断了。
  async function collectNotifyDiagnostics() {
    const L = function (zh, en) { return isEn() ? en : zh; };
    const notify = localNotifyPlugin();
    const rows = [];

    const statusText = function (status) {
      if (status === 'granted') return L('已允许', 'Allowed');
      if (status === 'denied') return L('已拒绝', 'Denied');
      if (status === 'unsupported') return L('不支持', 'Unsupported');
      return L('未询问', 'Not asked');
    };
    rows.push([L('通知权限', 'Notification permission'), statusText(notifyState.status)]);

    if (!notify) {
      rows.push([L('原生插件', 'Native plugin'), L('不可用（网页版）', 'Unavailable (web)')]);
      return rows;
    }

    let channelText = L('未创建', 'Missing');
    try {
      const res = await notify.listChannels();
      const list = (res && res.channels) || [];
      const ch = list.filter(function (c) { return c && c.id === REMIND_CHANNEL_ID; })[0];
      const legacy = list.filter(function (c) { return c && c.id === REMIND_CHANNEL_LEGACY_ID; })[0];
      if (ch) {
        state.channelInfo = ch;
        channelText = L('已创建 · 重要性 ', 'Created · importance ') + ch.importance;
        if (ch.importance < 4) channelText += L('（偏低，可能不弹横幅）', ' (low, may not pop)');
        channelText += ch.sound ? L(' · 含提示音', ' · sound on') : L(' · 无提示音', ' · no sound');
        channelText += ch.vibration ? L(' · 振动', ' · vibrate') : '';
      }
      if (legacy) channelText += L(' · 旧渠道仍在（可忽略）', ' · legacy channel still present (harmless)');
    } catch (err) {
      channelText = state.channelInfo
        ? L('已创建（未回读）· 重要性 ', 'Created (not read back) · importance ') + state.channelInfo.importance
        : L('读取失败', 'Unreadable');
    }
    rows.push([L('通知渠道', 'Channel'), channelText]);
    rows.push([L('渠道 id', 'Channel id'), REMIND_CHANNEL_ID]);

    // 小图标与提示音是否存在只能构建时校验；这里亮出配置值，便于和构建日志对照
    rows.push([L('通知小图标', 'Small icon'), REMIND_SMALL_ICON + L('（构建时校验在 APK 内）', ' (verified in APK at build)')]);
    rows.push([L('提示音', 'Sound'), REMIND_SOUND + L('（res/raw，构建时校验）', ' (res/raw, verified at build)')]);

    let exactText = L('不适用', 'Not required');
    const isAndroid = !!(window.Capacitor && typeof Capacitor.getPlatform === 'function' && Capacitor.getPlatform() === 'android');
    if (isAndroid) {
      const value = await canScheduleExactAlarms(notify);
      state.exactAlarmStatus = value;
      if (value === 'granted') exactText = L('已允许，提醒准时', 'Allowed; reminders are on time');
      else if (value === 'denied') exactText = L('被系统关闭，已退化为允许延迟的排程（可能延迟几分钟）', 'Blocked; using inexact scheduling (may be a few minutes late)');
      else if (value === 'unsupported' || value === 'unknown') exactText = L('无法读取', 'Unreadable');
      else exactText = L('不适用', 'Not required');
    }
    rows.push([L('精确闹钟', 'Exact alarms'), exactText]);
    rows.push([L('排程精度', 'Precision'),
      state.exactAlarmStatus === 'denied' ? L('允许延迟', 'Inexact (may be delayed)') : L('精确', 'Exact')]);

    let pendingText = L('未知', 'Unknown');
    try {
      const res = await notify.getPending();
      pendingText = String(((res && res.notifications) || []).length) + L(' 条', '');
    } catch (err) {
      pendingText = L('读取失败', 'Unreadable');
    }
    rows.push([L('系统里已排程', 'Pending in system'), pendingText]);

    const recorded = Array.isArray(state.meta.reminderIds) ? state.meta.reminderIds.length : 0;
    rows.push([L('本轮记录的排程', 'Recorded this round'), String(recorded) + L(' 条', '')]);

    if (state.nativeScheduleError) rows.push([L('最近排程错误', 'Last schedule error'), state.nativeScheduleError]);
    return rows;
  }

  async function renderNotifyDiagnostics() {
    const box = $('#notifyDiag');
    if (!box) return;
    const rows = await collectNotifyDiagnostics();
    const esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    const head = isEn() ? 'Self-check' : '状态自查';
    const hint = isEn()
      ? 'If permission is allowed, the channel exists and pending count > 0 but still nothing pops, the system is blocking background delivery — allow autostart / background activity / battery unrestricted for this app.'
      : '权限已允许、渠道已创建、排程数量大于 0，但仍然不响时，多半是系统后台限制：请在系统设置里允许本应用「自启动 / 后台运行」，并把省电策略设为「不限制」。';

    const statusText = function (status) {
      const map = {
        ok: ['已排程', 'Scheduled'],
        queued: ['排程中', 'Queued'],
        timer: ['前台计时器', 'In-page timer'],
        skip: ['已跳过', 'Skipped'],
        fail: ['排程失败', 'Failed']
      };
      const pair = map[status] || [status, status];
      return isEn() ? pair[1] : pair[0];
    };

    const report = Array.isArray(state.reminderReport) ? state.reminderReport : null;
    let tableHTML = '';
    if (report) {
      const tHead = isEn()
        ? ['Instance', 'Title', 'Item time', 'Before', 'Fires at', 'Scheduled', 'id', 'Reason']
        : ['实例 keys', '标题', '条目时间', '提前', '触发时间', '是否已排程', '排程 id', '失败原因'];
      if (!report.length) {
        tableHTML = '<div class="diag-sub">' + esc(isEn() ? 'Reminder instances' : '带提醒的实例') + '</div>' +
          '<p class="diag-empty">' + esc(isEn() ? 'No entry has a reminder yet.' : '当前没有设置提醒的条目。') + '</p>';
      } else {
        tableHTML = '<div class="diag-sub">' + esc(isEn() ? 'Reminder instances' : '带提醒的实例') + '</div>' +
          '<div class="diag-table-wrap"><table class="diag-table"><thead><tr>' +
          tHead.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          report.map(function (r) {
            return '<tr class="diag-' + esc(r.status) + '">' +
              '<td class="diag-mono">' + esc(r.key) + '</td>' +
              '<td>' + esc(r.title) + '</td>' +
              '<td>' + esc(r.when) + '</td>' +
              '<td>' + esc(r.before + ' ' + (isEn() ? 'min' : '分钟')) + '</td>' +
              '<td class="diag-mono">' + esc(r.fireText) + '</td>' +
              '<td>' + esc(statusText(r.status)) + '</td>' +
              '<td class="diag-mono">' + esc(r.numericId || '—') + '</td>' +
              '<td>' + esc(r.reason || '—') + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>';
      }
    }

    box.innerHTML = '<div class="diag-title">' + esc(head) + '</div>' +
      rows.map(function (r) {
        return '<div class="diag-row"><span class="diag-key">' + esc(r[0]) + '</span>' +
          '<span class="diag-value">' + esc(r[1]) + '</span></div>';
      }).join('') +
      '<p class="diag-hint">' + esc(hint) + '</p>' + tableHTML;
    box.hidden = false;
  }

  // 系统通知真正弹出 / 用户点开通知时：把后续重复条目继续往后排
  function bindNotificationEvents() {
    const notify = localNotifyPlugin();
    if (!notify || typeof notify.addListener !== 'function') return;
    try {
      Promise.resolve(notify.addListener('localNotificationReceived', function () {
        scheduleReminders();
        renderSummary();
      })).catch(function () {});
      Promise.resolve(notify.addListener('localNotificationActionPerformed', function (action) {
        const extra = action && action.notification && action.notification.extra;
        scheduleReminders();
        if (!extra || !extra.itemId) return;
        if (!state.items.some(function (i) { return i.id === extra.itemId; })) return;
        state.agendaAnchor = extra.date || todayKey();
        setView('agenda');
        openDetail(extra.itemId, extra.date || '');
      })).catch(function () {});
    } catch (err) {
      console.warn('注册通知监听失败：', err);
    }
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
        if (state.yearView) {
          shiftYearView(-1);
          updateTopbar();
          return;
        }
        if (!shiftMonthBy(-1)) return;
        renderCalendar();
        updateTopbar();
      } else if (state.view === 'agenda') {
        state.agendaAnchor = addDays(state.agendaAnchor || todayKey(), -1);
        renderAgenda();
        updateTopbar();
        agendaScrollTo(state.agendaAnchor, false);
      } else if (state.view === 'schedule') {
        state.scheduleAnchor = addDays(state.scheduleAnchor || startOfWeek(todayKey()), -7);
        renderSchedule();
        updateTopbar();
        $('#content').scrollTop = 0;
      }
    });

    $('#nextBtn').addEventListener('click', function () {
      if (state.view === 'calendar') {
        if (state.yearView) {
          shiftYearView(1);
          updateTopbar();
          return;
        }
        if (!shiftMonthBy(1)) return;
        renderCalendar();
        updateTopbar();
      } else if (state.view === 'agenda') {
        state.agendaAnchor = addDays(state.agendaAnchor || todayKey(), 1);
        renderAgenda();
        updateTopbar();
        agendaScrollTo(state.agendaAnchor, false);
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
        requestAnimationFrame(function () { agendaScrollTo(t, true); });
      } else {
        // 年历里点今天：回到月历的今天
        closeYearView();
        state.month = new Date(d.getFullYear(), d.getMonth(), 1);
        state.selectedDate = t;
        renderAll();
        revealDayDetail();
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
      updateTopbar();
      // 统一归位：选中后滚回顶部，详情紧跟在月历下方
      revealDayDetail();
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
    bindBatchPress($('#dayDetailInner'));
    bindBatchPress($('#agendaList'));
    $('#batchCancel').addEventListener('click', function () { exitBatchMode(); });
    $('#batchDelete').addEventListener('click', askBatchDelete);
    bindMonthSwipe();
    bindPinchYear();
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
      if (state.batchMode) {
        // 长按刚触发时的补发 click 忽略掉
        if (Date.now() < state.batchLock) return;
        handleBatchClick(e);
        return;
      }
      if (handleSwipeClick(e)) return;
      if (state.swipeLock && Date.now() < state.swipeLock) return;
      // 黄历卡片下方的「那天写了什么」入口：直接打开该日全文
      const diaryEntry = e.target.closest('[data-diary-open]');
      if (diaryEntry) { openDiaryEditor(diaryEntry.dataset.diaryOpen); return; }
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
        const nowClock = new Date();
        draft.time = pad2(nowClock.getHours()) + ':' + pad2(nowClock.getMinutes());
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
      // 刚结束拖动的那一下不当作点击，避免松手后误开编辑浮层
      if (Date.now() - catDragEndAt < CAT_DRAG_CLICK_MS) return;
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

    // 长按气泡后拖动排序：pointer 事件负责判定，touchmove 在拖动期间锁滚动
    $('#categoryList').addEventListener('pointerdown', catDragStart);
    document.addEventListener('pointermove', catDragMove, { passive: false });
    document.addEventListener('pointerup', catDragEnd);
    document.addEventListener('pointercancel', catDragEnd);
    document.addEventListener('touchmove', function (e) {
      if (catDrag && catDrag.active) e.preventDefault();
    }, { passive: false });

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
      setModalColor(swatch.dataset.modalColor);
      haptic(6);
    });

    // 应用内自绘取色：色相条 + 饱和度/明度块，不调用原生 input[type=color]
    function applyPickerPoint(kind, x, y) {
      if (kind === 'sv') {
        const rect = $('#cpSv').getBoundingClientRect();
        modalHsv.s = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
        modalHsv.v = Math.min(1, Math.max(0, 1 - (y - rect.top) / rect.height));
      } else {
        const rect = $('#cpHue').getBoundingClientRect();
        modalHsv.h = Math.min(359.9, Math.max(0, (x - rect.left) / rect.width * 360));
      }
      setModalColor(hsvToHex(modalHsv.h, modalHsv.s, modalHsv.v), true);
    }

    $('#modalCustomBtn').addEventListener('click', function () {
      modalPickerOpen = !modalPickerOpen;
      if (modalPickerOpen) modalHsv = hexToHsv(modalColor);
      renderModalPicker();
      haptic(6);
    });

    $('#cpBack').addEventListener('click', function () {
      modalPickerOpen = false;
      modalPickerDrag = '';
      renderModalPicker();
    });

    [['#cpSv', 'sv'], ['#cpHue', 'hue']].forEach(function (pair) {
      const el = $(pair[0]);
      if (!el) return;
      el.addEventListener('pointerdown', function (e) {
        modalPickerDrag = pair[1];
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        haptic(6);
        applyPickerPoint(pair[1], e.clientX, e.clientY);
        e.preventDefault();
      });
    });

    document.addEventListener('pointermove', function (e) {
      if (!modalPickerDrag) return;
      e.preventDefault();
      applyPickerPoint(modalPickerDrag, e.clientX, e.clientY);
    }, { passive: false });
    document.addEventListener('pointerup', function () { modalPickerDrag = ''; });
    document.addEventListener('pointercancel', function () { modalPickerDrag = ''; });
    document.addEventListener('touchmove', function (e) {
      if (modalPickerDrag) e.preventDefault();
    }, { passive: false });

    $('#modalIcons').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-icon]');
      if (!btn) return;
      modalIcon = btn.dataset.icon || null;
      $$('#modalIcons .cat-icon-btn').forEach(function (el) {
        el.classList.toggle('active', el === btn);
      });
    });

    $('#modalInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitModal();
      }
    });

    $('#raOk').addEventListener('click', hideReminderAlert);

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
    $('#agreementAccept').addEventListener('click', acceptAgreement);
    $('#agreementDecline').addEventListener('click', declineAgreement);

    $('#permClose').addEventListener('click', finishPermissionIntro);
    $('#permBackdrop').addEventListener('click', finishPermissionIntro);
    $('#permLater').addEventListener('click', finishPermissionIntro);
    $('#permAllow').addEventListener('click', function () { askNotifyPermission(); });
    $('#permRecheck').addEventListener('click', function () { refreshAllPermissionStates(); });
    $('#notifyDiagRefresh').addEventListener('click', function () { renderNotifyDiagnostics(); });

    $('#themeToggle').addEventListener('change', function () {
      state.meta.theme = $('#themeToggle').checked ? 'dark' : 'light';
      applyTheme();
      persistMeta();
      renderSettings();
    });

    $('#lunarToggle').addEventListener('change', function () {
      state.meta.lunarVisible = $('#lunarToggle').checked;
      persistMeta();
      renderAll();
      // 节假日标记跟随农历开关，年历也要同步重绘
      if (state.yearView) renderYearView();
    });

    $('#almanacToggle').addEventListener('change', function () {
      state.meta.almanacVisible = $('#almanacToggle').checked;
      persistMeta();
      renderAll();
    });

    $('#weatherToggle').addEventListener('change', function () {
      state.meta.weatherEnabled = $('#weatherToggle').checked;
      persistMeta();
      applyWeatherSetting();
      renderSettings();
      renderAll();
    });

    $('#agendaList').addEventListener('click', function (e) {
      if (state.batchMode) {
        if (Date.now() < state.batchLock) return;
        handleBatchClick(e);
        return;
      }
      const more = e.target.closest('[data-agenda-more]');
      if (more) {
        // 加载中忽略重复点击
        if (state.agendaLoading || more.disabled) return;
        const dir = more.dataset.agendaMore;
        state.agendaLoading = dir;
        more.disabled = true;
        more.classList.add('is-loading');
        more.setAttribute('aria-busy', 'true');
        more.innerHTML = '<span class="am-label"><span class="am-spin" aria-hidden="true"></span>' +
          '<span class="am-text">' + esc(T('加载中…')) + '</span></span>';
        // 留出一帧以上让加载态可见，再展开窗口
        setTimeout(function () {
          if (dir === 'back') state.agendaBack += AGENDA_STEP_DAYS;
          else state.agendaFwd += AGENDA_STEP_DAYS;
          state.agendaLoading = '';
          renderAgenda();
        }, 220);
        return;
      }
      if (handleSwipeClick(e)) return;
      if (state.swipeLock && Date.now() < state.swipeLock) return;
      if (handleSharedListClick(e)) return;

      const doneToggle = e.target.closest('[data-done-toggle]');
      if (doneToggle) {
        toggleDoneGroup(doneToggle);
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

    // 长按卡片后拖动排序：pointer 事件判定，拖动期间锁滚动，松手后短暂抑制点击
    $('#planContent').addEventListener('pointerdown', planDragStart);
    document.addEventListener('pointermove', planDragMove, { passive: false });
    document.addEventListener('pointerup', planDragEnd);
    document.addEventListener('pointercancel', planDragEnd);
    document.addEventListener('touchmove', function (e) {
      if (planDrag && planDrag.active) e.preventDefault();
    }, { passive: false });

    $('#planContent').addEventListener('click', function (e) {
      if (Date.now() - planDragEndAt < 320) return;
      if (e.target.closest('#planAdd')) {
        openPlanSheet('week');
        return;
      }
      const edit = e.target.closest('[data-plan-edit]');
      if (edit) {
        closeAllSwipes();
        openPlanEditSheet(edit.dataset.planEdit);
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
      // 批量模式下点内容区的空白处退出；操作栏、卡片列表与各种弹层内部不算空白
      if (!state.batchMode) return;
      if (!e.target.closest || !e.target.closest('#content')) return;
      if (e.target.closest('#batchBar')) return;
      if (e.target.closest('#dayDetailInner') || e.target.closest('#agendaList')) return;
      if (Date.now() < state.batchLock) return;
      exitBatchMode();
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
      handleBackGesture();
    });

    bindBackGesture();
    bindNotificationEvents();
    bindDiaryEvents();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (state.lastDayKey !== todayKey()) {
          state.lastDayKey = todayKey();
          renderAll();
        } else {
          renderSummary();
        }
        if (weatherEnabled() && window.Weather) window.Weather.refresh();
        // 用户可能刚在系统里改过「闹钟和提醒」：回到前台先同步一次，再按最新状态排程
        const backNotify = localNotifyPlugin();
        if (backNotify) refreshExactAlarmStatus(backNotify).then(function () { scheduleReminders(); });
        else scheduleReminders();
      }
    });

    window.addEventListener('resize', function () {
      // 屏幕旋转后重新计算日期标签等布局
      if (state.view === 'plan') renderPlan();
    });
  }

  // ==================== 返回手势 ====================
  // Android 手势导航下，边缘右滑会触发系统返回。接管后：弹层 → 上一级 → 主界面退到后台，
  // 不再让系统直接把 Activity 结束掉。
  function handleBackGesture() {
    if (yearPicker.open) { closeYearPicker(); return true; }
    if (regionPicker.open) { closeRegionSheet(); return true; }
    if (repDraft.open) { closeRepSheet(); return true; }
    if (dateSheet.open) { closeDateSheet(); return true; }
    if (addressSheet.open) { closeAddressSheet(); return true; }
    if (!$('#citySheet').hidden) { closeCitySheet(); return true; }
    if (!$('#catPop').hidden) { closeCatPop(); return true; }
    if (!$('#permSheet').hidden) { finishPermissionIntro(); return true; }
    if (!$('#modalCard').hidden) { closeModal(); return true; }
    // 日记：预览 → 写作页 → 附件/备份选择 → 管理态，逐层退出
    if (!$('#diaryViewer').hidden) { closeDiaryViewer(); return true; }
    if (!$('#attachSheet').hidden) { closeAttachSheet(); return true; }
    if (!$('#exportSheet').hidden) { closeExportSheet(); return true; }
    if (state.diaryEditorOpen) { closeDiaryEditor(true); return true; }
    if (state.diaryManage) { exitDiaryManage(); return true; }
    // 详情面板在写作页之下：先关写作页，再关详情
    if (detail.open) { closeDetail(); return true; }
    // 批量模式：返回键先退出选择，而不是直接离开当前视图
    if (state.batchMode) { exitBatchMode(); return true; }
    if (state.planSheetOpen) { closePlanSheet(); return true; }
    if (state.sheetOpen) { closeSheet(); return true; }
    if (!$('#aboutPage').hidden) {
      // 首次启动的协议页不允许用返回键绕过
      if ($('#aboutPage').classList.contains('agreement-mode')) return true;
      closeAbout();
      return true;
    }
    if (state.settingsOpen) { closeSettings(); return true; }
    // 年历：返回键先回到月历
    if (state.yearView) { closeYearView(); return true; }

    if (state.view !== 'calendar') {
      setView('calendar');
      return true;
    }

    // 已经在主界面：退到后台，而不是结束进程
    const app = plugin('App');
    if (app && typeof app.minimizeApp === 'function') {
      try {
        Promise.resolve(app.minimizeApp()).catch(function () {});
      } catch (err) {}
    }
    return true;
  }

  function bindBackGesture() {
    const app = plugin('App');
    if (!app || typeof app.addListener !== 'function') return;
    try {
      Promise.resolve(app.addListener('backButton', function () {
        handleBackGesture();
      })).catch(function () {});
    } catch (err) {
      console.warn('注册返回手势失败：', err);
    }
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
    if (regionPicker.open) closeRegionSheet();
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

  // ==================== 日记：入口 / 时间线 / 写作 / 附件 / 网格 ====================

  let diarySaveTimer = 0;
  let diarySavedTimer = 0;
  let diaryTagValue = '';
  // objectURL 统一登记，重绘或关闭写作页时集中释放，避免图片越用越占内存
  const diaryUrls = new Map();

  function diaryReleaseUrls() {
    diaryUrls.forEach(function (url) {
      try { URL.revokeObjectURL(url); } catch (err) { /* 忽略 */ }
    });
    diaryUrls.clear();
  }

  function diaryObjectUrl(key, blob) {
    if (!blob) return '';
    if (diaryUrls.has(key)) return diaryUrls.get(key);
    const url = URL.createObjectURL(blob);
    diaryUrls.set(key, url);
    return url;
  }

  function formatBytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) return v + ' B';
    if (v < 1024 * 1024) return (v / 1024).toFixed(v < 10240 ? 1 : 0) + ' KB';
    return (v / 1048576).toFixed(1) + ' MB';
  }

  // 写作页与分组标题共用的「星期 · 节日/节气 · 农历」
  function diarySubText(key) {
    const meta = dayMeta(key);
    const showLunar = lunarVisible();
    const bits = [weekdayFullOf(key)];
    if (meta.festival && (showLunar || meta.festivalKind === 'solar')) bits.push(T(meta.festival));
    else if (showLunar && meta.term) bits.push(T(meta.term));
    if (showLunar) bits.push((isEn() ? '' : '农历') + meta.lunarFull);
    return bits.join(' · ');
  }

  // 卡片上的位置只到市：省 · 市，缺一项就只显示另一项；具体位置只在写作页与详情里出现
  function diaryLocationBrief(entry) {
    const loc = entry && entry.location;
    if (!loc) return '';
    if (loc.province && loc.city) return loc.province + ' · ' + loc.city;
    return loc.city || loc.province || '';
  }

  // 详情用完整位置：省市 + 手写的具体位置
  function diaryLocationFull(entry) {
    const loc = entry && entry.location;
    if (!loc) return '';
    const brief = diaryLocationBrief(entry);
    if (loc.text && brief) return brief + ' · ' + loc.text;
    return brief || loc.text || '';
  }

  function diaryDateTitle(key) {
    const rel = relativeDayLabel(key);
    if (rel !== monthDay(key)) return rel;
    const d = keyToDate(key);
    if (d.getFullYear() === keyToDate(todayKey()).getFullYear()) return rel;
    return isEn()
      ? MONTH_EN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear()
      : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  // 日历黄历卡片下方的一行入口：有日记才出现
  function diaryEntryHTML(key) {
    const entry = diaryByDate(key);
    if (!entry) return '';
    const excerpt = entry.text.trim()
      ? shorten(entry.text.trim().replace(/\s+/g, ' '), 46)
      : T('只记了心情和附件');
    const mood = entry.mood
      ? '<span class="dd-diary-mood">' + moodIconHTML(entry.mood, 'dd-diary-face') + esc(moodLabel(entry.mood)) + '</span>'
      : '';
    return '<button class="dd-diary" type="button" data-diary-open="' + key + '">' +
      '<span class="dd-diary-main">' +
        '<span class="dd-diary-label">' + esc(T('那天写了什么')) + '</span>' +
        '<span class="dd-diary-text">' + esc(excerpt) + '</span>' +
      '</span>' + mood +
      '<svg class="dd-diary-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
    '</button>';
  }

  function diaryMatches(entry, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    if (String(entry.title || '').toLowerCase().indexOf(q) !== -1) return true;
    if (String(entry.text || '').toLowerCase().indexOf(q) !== -1) return true;
    if (entry.location) {
      const loc = [entry.location.province, entry.location.city, entry.location.text].join(' ').toLowerCase();
      if (loc.indexOf(q) !== -1) return true;
    }
    if ((entry.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) !== -1; })) return true;
    if ((entry.attachments || []).some(function (a) {
      return String(a.name || '').toLowerCase().indexOf(q) !== -1;
    })) return true;
    return false;
  }

  // 日期查询解析：
  //   2026-11-07 / 2026/11/7 / 2026.11.7 → 指定某一天
  //   11月7日 / 11-07 / 11/7             → 不带年份，按所有年份列出
  function diaryParseDateQuery(query) {
    const q = String(query || '').trim();
    if (!q) return null;
    let m = q.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return { year: y, month: mo, day: d, key: y + '-' + pad2(mo) + '-' + pad2(d) };
      }
      return null;
    }
    m = q.match(/^(\d{1,2})[-/.月](\d{1,2})日?$/);
    if (m) {
      const mo = Number(m[1]), d = Number(m[2]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { year: 0, month: mo, day: d, key: '' };
    }
    return null;
  }

  function diaryDateQueryMatch(entry, dq) {
    if (!dq) return false;
    const parts = entry.date.split('-').map(Number);
    if (parts[1] !== dq.month || parts[2] !== dq.day) return false;
    return dq.year ? parts[0] === dq.year : true;
  }

  // 只应用筛选器（心情/附件/月份），不参与文本匹配
  function diaryFilterBase() {
    return state.diary.filter(function (entry) {
      if (state.diaryFilter === 'attach' && !diaryHasFiles(entry)) return false;
      if (state.diaryFilter === 'mood' && !entry.mood) return false;
      if (state.diaryMonth && entry.date.slice(0, 7) !== state.diaryMonth) return false;
      return true;
    });
  }

  function diaryFiltered() {
    const query = state.diaryQuery.trim();
    const dq = diaryParseDateQuery(query);
    return diaryFilterBase().filter(function (entry) {
      // 识别成日期查询时，日期命中优先展示；同一条仍可因正文命中出现在第二组
      return diaryMatches(entry, query) || diaryDateQueryMatch(entry, dq);
    });
  }

  // 搜索命中高亮：先转义再包 <mark>，避免正文里的尖括号被当成标签
  function diaryHighlight(text, query) {
    const src = String(text || '');
    const q = String(query || '').trim();
    if (!q) return esc(src);
    const lower = src.toLowerCase();
    const needle = q.toLowerCase();
    let out = '';
    let from = 0;
    let idx = lower.indexOf(needle, from);
    while (idx !== -1) {
      out += esc(src.slice(from, idx)) + '<mark>' + esc(src.slice(idx, idx + needle.length)) + '</mark>';
      from = idx + needle.length;
      idx = lower.indexOf(needle, from);
    }
    return out + esc(src.slice(from));
  }

  // 卡片标题：有标题用标题；没有就回退正文首行摘要（样式略弱）
  function diaryCardTitle(entry, query) {
    const title = (entry.title || '').trim();
    if (title) return { html: diaryHighlight(title.slice(0, DIARY_TITLE_MAX), query), weak: false };
    const firstLine = (entry.text || '').trim().split(/\r?\n/)[0].trim();
    if (firstLine) {
      const brief = firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
      return { html: diaryHighlight(brief, query), weak: true };
    }
    return { html: esc(T('这篇只有心情和附件')), weak: true };
  }

  // 卡片日期时间：本年内省略年份，跨年份带上年份
  function diaryCardDate(key) {
    const d = keyToDate(key);
    const sameYear = d.getFullYear() === keyToDate(todayKey()).getFullYear();
    const md = monthDay(key);
    const head = sameYear ? md : (isEn() ? d.getFullYear() + ' ' + md : d.getFullYear() + '年' + md);
    return head + ' ' + weekdayOf(key);
  }

  function diaryCardHTML(entry) {
    const query = state.diaryQuery.trim();
    const title = diaryCardTitle(entry, query);
    const text = (entry.text || '').trim();
    let body = '';
    if (text) {
      const shown = entry.title ? text : text.split(/\r?\n/).slice(1).join(' ').trim();
      if (shown) body = '<p class="dc-text">' + diaryHighlight(shown.slice(0, 180), query) + '</p>';
    }
    const future = entry.date > todayKey();
    const moodText = moodLabel(entry.mood);
    const mood = entry.mood
      ? '<span class="dc-mood">' + moodIconHTML(entry.mood, 'dc-face') + esc(moodText) + '</span>'
      : '';
    // 位置在卡片上只到市，具体位置留给详情
    const locBrief = diaryLocationBrief(entry);
    const loc = locBrief
      ? '<span class="dc-loc">' + esc(locBrief) + '</span>'
      : '';
    const tags = entry.tags.length
      ? '<div class="dc-tags">' + entry.tags.map(function (t) {
          return '<span class="dc-tag">' + diaryHighlight(t, query) + '</span>';
        }).join('') + '</div>'
      : '';
    const words = diaryWordCount(entry.text);
    const counts = [];
    if (words) counts.push(T('{n} 字', { n: words }));
    if (entry.tags.length) counts.push(T('{n} 个标签', { n: entry.tags.length }));
    const attachCount = entry.attachments.length;
    const attach = attachCount
      ? '<span class="dc-files" title="' + esc(T('{n} 个附件', { n: attachCount })) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 12.4l5.3-5.3a3.1 3.1 0 1 1 4.4 4.4l-6.4 6.4a4.7 4.7 0 0 1-6.6-6.6l6-6"/></svg>' +
          '<span>' + attachCount + '</span></span>'
      : '';
    const selected = state.diaryManage && state.diarySel.has(entry.date);
    return '<article class="diary-card' + (selected ? ' selected' : '') + (future ? ' is-future' : '') + '"' +
      ' data-diary-open="' + entry.date + '" data-diary-card="' + entry.date + '"' +
      ' role="button" tabindex="0">' +
      '<div class="dc-head">' +
        '<h3 class="dc-title' + (title.weak ? ' is-weak' : '') + '">' + title.html + '</h3>' +
        '<div class="dc-meta">' +
          '<span class="dc-date">' + esc(diaryCardDate(entry.date)) + '</span>' +
          (future ? '<span class="dc-ahead">' + esc(T('预告')) + '</span>' : '') +
          mood + loc +
        '</div>' +
      '</div>' +
      body + tags +
      '<div class="dc-top">' +
        (counts.length ? '<span class="dc-counts">' + esc(counts.join(' · ')) + '</span>' : '') +
        attach +
      '</div>' +
      '<span class="dc-check" aria-hidden="true"></span>' +
    '</article>';
  }

  function renderDiaryTimeline(list) {
    let html = '';
    list.forEach(function (entry) {
      html += '<section class="day-group diary-group">' +
        '<div class="day-head">' +
          '<div class="day-head-main">' +
            '<div class="day-head-title"><h2>' + esc(diaryDateTitle(entry.date)) + '</h2></div>' +
            '<div class="day-sub">' + esc(diarySubText(entry.date)) + '</div>' +
          '</div>' +
        '</div>' +
        diaryCardHTML(entry) +
      '</section>';
    });
    return html;
  }

  function renderDiaryGrid(list) {
    const query = state.diaryQuery.trim();
    let html = '<div class="diary-grid">';
    list.forEach(function (entry) {
      const cover = diaryCoverAttachment(entry);
      const title = diaryCardTitle(entry, query);
      const selected = state.diaryManage && state.diarySel.has(entry.date);
      const locBrief = diaryLocationBrief(entry);
      const future = entry.date > todayKey();
      const inner = cover
        ? '<span class="dcard-cover"><img data-diary-cover="' + cover.id + '" alt="">' +
            (cover.kind === 'video'
              ? '<span class="dcard-play" aria-hidden="true">' +
                  '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>' +
                  (cover.duration ? '<span class="dcard-dur">' + esc(diaryDurationText(cover.duration)) + '</span>' : '') +
                '</span>'
              : '') +
          '</span>' +
          '<span class="dcard-shade" aria-hidden="true"></span>'
        : '<span class="dcard-text">' +
            diaryHighlight(entry.text.trim().slice(0, 140) || T('这篇只有心情和附件'), query) +
          '</span>';
      html += '<article class="dcard' + (cover ? ' has-cover' : '') + (selected ? ' selected' : '') +
        (future ? ' is-future' : '') + '"' +
        ' data-diary-open="' + entry.date + '" data-diary-card="' + entry.date + '"' +
        ' role="button" tabindex="0">' +
        '<span class="dcard-head">' +
          '<span class="dcard-title' + (title.weak ? ' is-weak' : '') + '">' + title.html + '</span>' +
          '<span class="dcard-meta">' +
            '<span class="dcard-date">' + esc(diaryCardDate(entry.date)) + '</span>' +
            (future ? '<span class="dcard-ahead">' + esc(T('预告')) + '</span>' : '') +
            (entry.mood ? moodIconHTML(entry.mood, 'dcard-face') : '') +
            (locBrief ? '<span class="dcard-loc">' + esc(locBrief) + '</span>' : '') +
          '</span>' +
        '</span>' +
        inner +
        '<span class="dcard-foot">' +
          (entry.attachments.length ? '<span class="dcard-files">' + entry.attachments.length + '</span>' : '') +
        '</span>' +
        '<span class="dc-check" aria-hidden="true"></span>' +
      '</article>';
    });
    return html + '</div>';
  }

  function diaryDurationText(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : String(r));
  }

  function hydrateDiaryThumbs() {
    if (storage.status !== 'idb') return;
    $$('[data-diary-cover]').forEach(function (img) {
      const id = img.dataset.diaryCover;
      diaryFileGet(id).then(function (rec) {
        if (!rec) { img.classList.add('missing'); return; }
        const url = diaryObjectUrl('c:' + id, rec.thumb || rec.data);
        if (url) img.src = url;
      }).catch(function () { img.classList.add('missing'); });
    });
    $$('[data-attach-thumb]').forEach(function (img) {
      const id = img.dataset.attachThumb;
      diaryFileGet(id).then(function (rec) {
        if (!rec) {
          const tile = img.closest('.de-file');
          if (tile) tile.classList.add('missing');
          return;
        }
        const url = diaryObjectUrl('t:' + id, rec.thumb || rec.data);
        if (url) img.src = url;
      }).catch(function () { /* 缩略图缺失时保留占位 */ });
    });
  }

  function renderDiaryChips() {
    const box = $('#diaryChips');
    if (!box) return;
    const months = {};
    state.diary.forEach(function (entry) { months[entry.date.slice(0, 7)] = true; });
    const keys = Object.keys(months).sort().reverse();
    let html = '';
    [['all', '全部'], ['attach', '有附件'], ['mood', '有心情']].forEach(function (pair) {
      const active = state.diaryFilter === pair[0];
      html += '<button class="diary-chip' + (active ? ' active' : '') + '" type="button"' +
        ' data-diary-filter="' + pair[0] + '" aria-pressed="' + active + '">' + esc(T(pair[1])) + '</button>';
    });
    if (keys.length || state.diaryMonth) {
      html += '<span class="diary-month-wrap"><select id="diaryMonthSelect" class="diary-month" aria-label="' +
        esc(T('按年月筛选')) + '">' +
        '<option value="">' + esc(T('全部月份')) + '</option>' +
        keys.map(function (m) {
          const y = m.slice(0, 4);
          const mo = Number(m.slice(5, 7));
          const label = isEn() ? MONTH_EN[mo - 1] + ' ' + y : y + '年' + mo + '月';
          return '<option value="' + m + '"' + (state.diaryMonth === m ? ' selected' : '') + '>' +
            esc(label) + '</option>';
        }).join('') +
      '</select></span>';
    }
    box.innerHTML = html;
  }

  function syncDiaryModes() {
    $$('#diaryModes .diary-mode').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.diaryMode === state.diaryMode);
    });
  }

  function syncDiaryWriteButton() {
    const btn = $('#diaryWriteBtn');
    if (!btn) return;
    btn.textContent = diaryByDate(todayKey()) ? T('续写今天') : T('写今天');
  }

  function syncDiaryManageBar() {
    const bar = $('#diaryManageBar');
    if (!bar) return;
    bar.hidden = !state.diaryManage;
    $('#diaryManageCount').textContent = T('已选 {n} 篇', { n: state.diarySel.size });
    $('#diaryManageDelete').disabled = state.diarySel.size === 0;
    $('#diaryManageBtn').hidden = state.diaryManage;
    $('#viewDiary').classList.toggle('managing', state.diaryManage);
  }

  function renderDiary() {
    syncDiaryModes();
    renderDiaryChips();
    syncDiaryWriteButton();
    syncDiaryManageBar();

    const list = diaryFiltered();
    const body = $('#diaryBody');
    const dq = diaryParseDateQuery(state.diaryQuery.trim());
    let html = '';
    if (list.length) {
      if (dq && state.diaryMode !== 'grid') {
        // 日期命中与文本命中分组展示：先「日期」，再「正文 / 标签」
        const base = diaryFilterBase();
        const dateList = base.filter(function (e) { return diaryDateQueryMatch(e, dq); });
        const textList = base.filter(function (e) {
          return !diaryDateQueryMatch(e, dq) && diaryMatches(e, state.diaryQuery.trim());
        });
        if (dateList.length) {
          html += '<div class="diary-sec"><div class="diary-sec-head">' + esc(T('日期')) +
            '<span class="diary-sec-n">' + dateList.length + '</span></div>' +
            renderDiaryTimeline(dateList) + '</div>';
        }
        if (textList.length) {
          html += '<div class="diary-sec"><div class="diary-sec-head">' + esc(T('正文 / 标签')) +
            '<span class="diary-sec-n">' + textList.length + '</span></div>' +
            renderDiaryTimeline(textList) + '</div>';
        }
      } else {
        html = state.diaryMode === 'grid' ? renderDiaryGrid(list) : renderDiaryTimeline(list);
      }
    }
    body.innerHTML = html;
    body.hidden = !list.length;

    const empty = $('#diaryEmpty');
    empty.hidden = !!list.length;
    if (!list.length) {
      const filtered = state.diary.length > 0;
      $('#diaryEmptyTitle').textContent = filtered ? T('没有符合条件的日记') : T('还没有写过日记');
      $('#diaryEmptySub').textContent = filtered
        ? T('换个筛选，或者清空搜索再看看。')
        : T('想到什么就写一句，不必等到有完整的一天。');
    }
    hydrateDiaryThumbs();
  }

  function enterDiaryManage() {
    if (state.diaryManage) return;
    state.diaryManage = true;
    state.diarySel = new Set();
    haptic(14);
    renderDiary();
  }

  function exitDiaryManage() {
    if (!state.diaryManage) return;
    state.diaryManage = false;
    state.diarySel = new Set();
    syncDiaryManageBar();
    renderDiary();
  }

  function toggleDiarySel(date, el) {
    if (state.diarySel.has(date)) state.diarySel.delete(date);
    else state.diarySel.add(date);
    if (el) el.classList.toggle('selected', state.diarySel.has(date));
    haptic(8);
    syncDiaryManageBar();
  }

  // ---------- 写作页 ----------

  function diaryAttachBlockedReason() {
    if (storage.status === 'idb') return '';
    return T('当前环境不支持附件：浏览器数据库（IndexedDB）不可用，日记文字仍会照常保存。');
  }

  function openDiaryEditor(date) {
    const raw = String(date || '');
    const key = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayKey();
    if (state.diaryEditorOpen && state.diaryDraft && state.diaryDraft.date !== key) {
      saveDiaryDraft(true);
    }
    const entry = diaryByDate(key);
    state.diaryDraft = entry
      ? {
          date: key,
          title: entry.title || '',
          text: entry.text,
          mood: entry.mood,
          tags: entry.tags.slice(),
          location: entry.location ? Object.assign({}, entry.location) : null,
          attachments: entry.attachments.map(function (a) { return Object.assign({}, a); }),
          createdAt: entry.createdAt
        }
      : { date: key, title: '', text: '', mood: '', tags: [], location: null, attachments: [], createdAt: Date.now() };
    state.diaryEditorOpen = true;
    state.diaryEditingDate = key;
    state.diaryDirty = false;
    state.diaryAttachBlocked = diaryAttachBlockedReason();
    diaryTagValue = '';

    const el = $('#diaryEditor');
    el.hidden = false;
    renderDiaryEditor();
    requestAnimationFrame(function () { el.classList.add('open'); });
    const scroll = $('.de-scroll', el);
    if (scroll) scroll.scrollTop = 0;

    // 只有新写的日记才自动聚焦；续写旧日记时把光标留在开头，避免一进来就弹键盘
    if (!entry) {
      setTimeout(function () {
        const ta = $('#diaryText');
        if (ta) ta.focus();
      }, 240);
    }
  }

  function closeDiaryEditor(save) {
    if (!state.diaryEditorOpen) return;
    if (save !== false) saveDiaryDraft(true);
    state.diaryEditorOpen = false;
    state.diaryEditingDate = '';
    state.diaryDraft = null;
    state.diaryDirty = false;
    clearTimeout(diarySaveTimer);
    closeDiaryViewer();
    closeAttachSheet();
    const el = $('#diaryEditor');
    el.classList.remove('open');
    el.hidden = true;
    diaryReleaseUrls();
    renderAll();
  }

  function renderDiaryEditor() {
    const draft = state.diaryDraft;
    if (!draft) return;
    $('#deDate').textContent = diaryDateTitle(draft.date);
    $('#deSub').textContent = diarySubText(draft.date);
    $('#diaryTitle').value = draft.title || '';
    $('#diaryText').value = draft.text;
    $('#deLocText').value = (draft.location && draft.location.text) || '';
    renderDiaryLocation();
    $('#deSaved').hidden = true;
    $('#diaryDeleteBtn').hidden = !diaryByDate(draft.date);
    renderDiaryMoods();
    renderDiaryTags();
    renderDiaryAttachments();
  }

  // 位置栏整栏可选：省市与具体位置都为空时只是空输入框，不提示「未设置」
  function renderDiaryLocation() {
    const draft = state.diaryDraft;
    if (!draft) return;
    const loc = normalizeDiaryLocation(draft.location);
    draft.location = loc;
    const brief = loc ? diaryLocationBrief({ location: loc }) : '';
    const summary = $('#deLocSummary');
    if (summary) {
      summary.textContent = brief;
      summary.hidden = !brief;
    }
    const pick = $('#deLocPick');
    if (pick) pick.textContent = brief ? T('修改省市') : T('选择省市');
    const clear = $('#deLocClear');
    if (clear) clear.hidden = !loc;
  }

  function diarySetLocation(next) {
    const draft = state.diaryDraft;
    if (!draft) return;
    draft.location = normalizeDiaryLocation(next);
    renderDiaryLocation();
    state.diaryDirty = true;
    scheduleDiarySave();
  }

  // ---------- 省市滚轮（regions.js 内置表，完全离线）----------
  const regionPicker = { open: false, province: 0, city: 0 };

  function regionData() {
    return Array.isArray(window.CN_REGIONS) ? window.CN_REGIONS : [];
  }

  function buildRegionWheel(el, values, index, onPick) {
    if (!el) return;
    const at = Math.max(0, Math.min(values.length - 1, index || 0));
    el.innerHTML = values.map(function (v) {
      return '<div class="wheel-item">' + esc(v) + '</div>';
    }).join('');
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      let timer = null;
      el.addEventListener('scroll', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (!el.children.length) return;
          const idx = Math.max(0, Math.min(el.children.length - 1, Math.round(el.scrollTop / 40)));
          el.scrollTo({ top: idx * 40, behavior: 'smooth' });
          Array.prototype.forEach.call(el.children, function (c, i) {
            c.classList.toggle('active', i === idx);
          });
          if (el._onPick) el._onPick(idx);
        }, 140);
      }, { passive: true });
    }
    el._onPick = onPick;
    Array.prototype.forEach.call(el.children, function (c, i) {
      c.classList.toggle('active', i === at);
    });
    el.scrollTop = at * 40;
  }

  function renderRegionWheels() {
    const data = regionData();
    if (!data.length) return;
    const pi = Math.max(0, Math.min(data.length - 1, regionPicker.province));
    const provinceEl = $('#regionProvince');
    buildRegionWheel(provinceEl, data.map(function (p) { return p.province; }), pi, function (idx) {
      if (idx === regionPicker.province) return;
      regionPicker.province = idx;
      regionPicker.city = 0;
      const cities = (data[idx] || data[0]).cities;
      buildRegionWheel($('#regionCity'), cities, 0, function (i) { regionPicker.city = i; });
    });
    const cities = (data[pi] || data[0]).cities;
    buildRegionWheel($('#regionCity'), cities, regionPicker.city, function (i) { regionPicker.city = i; });
  }

  function openRegionSheet() {
    const data = regionData();
    if (!data.length) return;
    const draft = state.diaryDraft;
    const loc = draft && draft.location ? draft.location : null;
    let pi = 0;
    let ci = 0;
    if (loc && loc.province) {
      const found = data.findIndex(function (p) { return p.province === loc.province; });
      if (found !== -1) pi = found;
    }
    if (loc && loc.city) {
      const found = (data[pi] || data[0]).cities.indexOf(loc.city);
      if (found !== -1) ci = found;
    }
    regionPicker.province = pi;
    regionPicker.city = ci;
    regionPicker.open = true;
    renderRegionWheels();
    $('#regionBackdrop').hidden = false;
    $('#regionSheet').hidden = false;
    requestAnimationFrame(function () {
      $('#regionBackdrop').classList.add('open');
      $('#regionSheet').classList.add('open');
      renderRegionWheels();
    });
  }

  function closeRegionSheet() {
    if (!regionPicker.open) return;
    regionPicker.open = false;
    $('#regionSheet').classList.remove('open');
    $('#regionBackdrop').classList.remove('open');
    setTimeout(function () {
      if (!regionPicker.open) {
        $('#regionSheet').hidden = true;
        $('#regionBackdrop').hidden = true;
      }
    }, 300);
  }

  function commitRegion() {
    const data = regionData();
    if (!data.length) return;
    const p = data[Math.max(0, Math.min(data.length - 1, regionPicker.province))] || data[0];
    const city = p.cities[Math.max(0, Math.min(p.cities.length - 1, regionPicker.city))] || '';
    const draft = state.diaryDraft;
    const text = draft && draft.location ? draft.location.text : '';
    diarySetLocation({ province: p.province, city: city, text: text });
    closeRegionSheet();
    haptic(8);
  }

  function renderDiaryMoods() {
    const draft = state.diaryDraft;
    if (!draft) return;
    $('#deMoods').innerHTML = DIARY_MOODS.map(function (m) {
      const active = draft.mood === m.id;
      return '<button class="de-mood' + (active ? ' active' : '') + '" type="button" data-mood="' + m.id + '"' +
        ' aria-pressed="' + active + '">' +
        moodIconHTML(m.id, 'de-mood-face') +
        '<span>' + esc(isEn() ? m.en : m.zh) + '</span>' +
      '</button>';
    }).join('');
  }

  function renderDiaryTags() {
    const draft = state.diaryDraft;
    if (!draft) return;
    let html = draft.tags.map(function (tag, i) {
      return '<span class="de-tag">' + esc(tag) +
        '<button class="de-tag-del" type="button" data-tag-del="' + i + '" aria-label="' + esc(T('删除标签')) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button></span>';
    }).join('');
    html += '<input class="de-tag-input" id="deTagInput" type="text" maxlength="16" autocomplete="off"' +
      ' placeholder="' + esc(draft.tags.length ? T('再加一个') : T('添加标签，回车确认')) + '"' +
      ' aria-label="' + esc(T('添加标签')) + '">';
    const box = $('#deTags');
    box.innerHTML = html;
    const input = $('#deTagInput');
    if (input && diaryTagValue) input.value = diaryTagValue;
  }

  function addDiaryTag(value) {
    const draft = state.diaryDraft;
    if (!draft) return;
    const tag = String(value || '').trim().slice(0, 16);
    diaryTagValue = '';
    if (!tag) { renderDiaryTags(); return; }
    if (draft.tags.indexOf(tag) !== -1) { renderDiaryTags(); return; }
    if (draft.tags.length >= 12) { showToast(T('最多 12 个标签')); renderDiaryTags(); return; }
    draft.tags.push(tag);
    scheduleDiarySave();
    renderDiaryTags();
    const input = $('#deTagInput');
    if (input) input.focus();
  }

  function diaryUsedBytesForDraft() {
    const draft = state.diaryDraft;
    let total = 0;
    state.diary.forEach(function (entry) {
      if (draft && entry.date === draft.date) return;
      (entry.attachments || []).forEach(function (a) { total += a.size || 0; });
    });
    if (draft) draft.attachments.forEach(function (a) { total += a.size || 0; });
    return total;
  }

  function renderDiaryAttachments() {
    const draft = state.diaryDraft;
    if (!draft) return;
    const grid = $('#diaryAttachGrid');
    const hint = $('#diaryAttachHint');
    const addBtn = $('#diaryAttachBtn');
    if (state.diaryAttachBlocked) {
      grid.innerHTML = '';
      grid.hidden = true;
      addBtn.disabled = true;
      addBtn.classList.remove('busy');
      hint.textContent = state.diaryAttachBlocked;
      return;
    }
    grid.hidden = false;
    addBtn.disabled = !!state.diaryAttachBusy;
    addBtn.classList.toggle('busy', !!state.diaryAttachBusy);
    addBtn.textContent = state.diaryAttachBusy ? T('处理中…') : T('添加');

    grid.innerHTML = draft.attachments.map(function (a) {
      const del = '<button class="de-file-del" type="button" data-attach-del="' + a.id + '"' +
        ' aria-label="' + esc(T('删除附件')) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>';
      if (a.kind === 'image') {
        return '<div class="de-file de-image" data-attach-open="' + a.id + '" role="button" tabindex="0">' +
          '<img data-attach-thumb="' + a.id + '" alt="' + esc(a.name) + '">' + del + '</div>';
      }
      if (a.kind === 'video') {
        return '<div class="de-file de-video" data-attach-open="' + a.id + '" role="button" tabindex="0">' +
          '<img data-attach-thumb="' + a.id + '" alt="' + esc(a.name) + '">' +
          '<span class="de-play" aria-hidden="true"><svg viewBox="0 0 24 24">' +
            '<path d="M8 5.5v13l11-6.5z"/></svg></span>' +
          (a.duration ? '<span class="de-dur">' + esc(diaryDurationText(a.duration)) + '</span>' : '') +
          del + '</div>';
      }
      return '<div class="de-file de-doc" data-attach-open="' + a.id + '" role="button" tabindex="0">' +
        '<span class="de-doc-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M7 3.8h6.5L18 8.3v11.9H7z"/><path d="M13.5 3.8v4.5H18"/></svg></span>' +
        '<span class="de-doc-main">' +
          '<span class="de-doc-name">' + esc(a.name) + '</span>' +
          '<span class="de-doc-size">' + esc(formatBytes(a.size)) + '</span>' +
        '</span>' + del + '</div>';
    }).join('');

    hint.textContent = draft.attachments.length
      ? T('{n} / {max} 个 · 已用 {size}，上限 {limit}', {
          n: draft.attachments.length,
          max: DIARY_MAX_FILES,
          size: formatBytes(diaryUsedBytesForDraft()),
          limit: formatBytes(DIARY_STORE_LIMIT)
        })
      : T('图片会先压缩再存进本机，不上传、不写入相册');
    hydrateDiaryThumbs();
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (blob) { resolve(blob || null); }, 'image/jpeg', quality);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function decodeDiaryImage(file) {
    return new Promise(function (resolve, reject) {
      function viaElement() {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
        img.src = url;
      }
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(file, { imageOrientation: 'from-image' })
          .then(function (bitmap) { resolve(bitmap); })
          .catch(viaElement);
      } else {
        viaElement();
      }
    });
  }

  // 图片入库前压缩：长边 ≤1600、JPEG 0.82；同时生成约 320px 的缩略图（质量 0.72）
  async function compressDiaryImage(file) {
    const src = await decodeDiaryImage(file);
    const sw = src.width || src.naturalWidth || 0;
    const sh = src.height || src.naturalHeight || 0;
    if (!sw || !sh) throw new Error('empty image');
    const scale = Math.min(1, DIARY_IMG_MAX / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // JPEG 没有透明通道：先铺白底，避免 PNG 的透明区域变黑
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);

    const tScale = Math.min(1, DIARY_THUMB_MAX / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * tScale));
    const th = Math.max(1, Math.round(h * tScale));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = tw;
    thumbCanvas.height = th;
    const tctx = thumbCanvas.getContext('2d');
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, tw, th);
    tctx.drawImage(canvas, 0, 0, tw, th);

    const data = await canvasToBlob(canvas, DIARY_IMG_QUALITY);
    const thumb = await canvasToBlob(thumbCanvas, DIARY_THUMB_QUALITY);
    if (src.close) { try { src.close(); } catch (err) { /* 忽略 */ } }
    if (!data) throw new Error('encode failed');
    return { data: data, thumb: thumb, w: w, h: h };
  }

  // 视频不转码：读元数据 → 跳到 0.1s → 画到 ≤320px 的 canvas 生成封面。
  // 任何一步失败都返回空封面，视频本体仍照常入库。
  function videoCoverOf(file) {
    return new Promise(function (resolve) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      let settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        try { URL.revokeObjectURL(url); } catch (err) { /* 忽略 */ }
        resolve(result);
      }
      function grab() {
        try {
          const sw = video.videoWidth || 0;
          const sh = video.videoHeight || 0;
          if (!sw || !sh) { finish({ thumb: null, w: 0, h: 0, duration: video.duration || 0 }); return; }
          const scale = Math.min(1, DIARY_VIDEO_COVER_MAX / Math.max(sw, sh));
          const w = Math.max(1, Math.round(sw * scale));
          const h = Math.max(1, Math.round(sh * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            finish({ thumb: blob, w: w, h: h, duration: video.duration || 0 });
          }, 'image/jpeg', 0.75);
        } catch (err) {
          finish({ thumb: null, w: 0, h: 0, duration: video.duration || 0 });
        }
      }
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = function () {
        const dur = video.duration || 0;
        // 有些视频第 0 帧是黑屏，取 0.1s 更稳；短视频取时长的 1/10
        const target = dur > 0 ? Math.min(0.1, dur / 10) : 0.1;
        try { video.currentTime = target; } catch (err) { grab(); }
      };
      video.onseeked = grab;
      video.onerror = function () { finish({ thumb: null, w: 0, h: 0, duration: 0 }); };
      // 兜底：个别编码在 WebView 里拿不到 seek 事件，8 秒后放弃封面
      setTimeout(function () {
        finish({ thumb: null, w: 0, h: 0, duration: video.duration || 0 });
      }, 8000);
      video.src = url;
    });
  }

  async function addDiaryAttachments(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    const draft = state.diaryDraft;
    if (!draft) return;
    if (state.diaryAttachBlocked) { showToast(state.diaryAttachBlocked); return; }
    if (storage.status !== 'idb') {
      state.diaryAttachBlocked = diaryAttachBlockedReason();
      renderDiaryAttachments();
      showToast(state.diaryAttachBlocked);
      return;
    }
    if (state.diaryAttachBusy) return;

    const room = DIARY_MAX_FILES - draft.attachments.length;
    if (room <= 0) { showToast(T('单篇最多 {n} 个附件', { n: DIARY_MAX_FILES })); return; }

    state.diaryAttachBusy = true;
    renderDiaryAttachments();

    let added = 0;
    let tooBig = 0;
    let overflow = 0;
    let failed = 0;
    let overQuota = false;
    let videoNoted = false;

    for (let i = 0; i < files.length; i++) {
      if (added >= room) { overflow += 1; continue; }
      const file = files[i];
      const isVideo = /^video\//.test(file.type || '');
      if (isVideo) {
        const vCount = draft.attachments.filter(function (a) { return a.kind === 'video'; }).length;
        // 视频限制单独提示（每轮只提示一次，避免批量选择时刷屏）
        if (vCount >= DIARY_MAX_VIDEOS) {
          if (!videoNoted) { showToast(T('每篇最多 1 个视频')); videoNoted = true; }
          continue;
        }
        if (file.size > DIARY_VIDEO_MAX_BYTES) {
          if (!videoNoted) { showToast(T('视频超过 50MB，无法添加')); videoNoted = true; }
          continue;
        }
      } else if (file.size > DIARY_MAX_FILE_BYTES) {
        tooBig += 1;
        continue;
      }
      if (diaryUsedBytesForDraft() + file.size > DIARY_STORE_LIMIT) { overQuota = true; break; }
      const isImage = /^image\//.test(file.type || '');
      const id = uid();
      try {
        let data = file;
        let thumb = null;
        let w = 0;
        let h = 0;
        let duration = 0;
        if (isImage) {
          const out = await compressDiaryImage(file);
          data = out.data;
          thumb = out.thumb;
          w = out.w;
          h = out.h;
        } else if (isVideo) {
          // 视频原样入库（WebView 无法转码），只抽第一帧做封面
          const out = await videoCoverOf(file);
          thumb = out.thumb;
          w = out.w;
          h = out.h;
          duration = out.duration;
        }
        if (diaryUsedBytesForDraft() + data.size + (thumb ? thumb.size : 0) > DIARY_STORE_LIMIT) {
          overQuota = true;
          break;
        }
        await diaryFilePut({
          id: id,
          data: data,
          thumb: thumb,
          date: draft.date,
          name: file.name,
          type: data.type || file.type || ''
        });
        draft.attachments.push({
          id: id,
          name: file.name || (isImage ? 'image.jpg' : (isVideo ? 'video.mp4' : 'file')),
          type: data.type || file.type || '',
          size: data.size,
          kind: isImage ? 'image' : (isVideo ? 'video' : 'file'),
          w: w,
          h: h,
          duration: duration
        });
        added += 1;
      } catch (err) {
        console.warn('添加附件失败：', err);
        failed += 1;
        // 写入被浏览器拒绝：直接降级，后续不再尝试
        if (err && (err.name === 'InvalidStateError' || err.name === 'NotFoundError')) {
          state.diaryAttachBlocked = diaryAttachBlockedReason();
          break;
        }
      }
    }

    state.diaryAttachBusy = false;
    if (added) {
      saveDiaryDraft(true);
      haptic(12);
    }
    renderDiaryAttachments();
    const notes = [];
    if (tooBig) notes.push(T('有 {n} 个文件超过 20MB，已跳过', { n: tooBig }));
    if (overflow) notes.push(T('单篇最多 {n} 个附件，多出的已跳过', { n: DIARY_MAX_FILES }));
    if (overQuota) notes.push(T('附件已占用 {size}，接近上限，请先清理', { size: formatBytes(diaryUsedBytesForDraft()) }));
    else if (!added && failed) notes.push(T('附件没能保存，请重试'));
    if (notes.length) showToast(notes.join('；'), 2600);
  }

  async function removeDiaryAttachment(id) {
    const draft = state.diaryDraft;
    if (!draft) return;
    const idx = draft.attachments.findIndex(function (a) { return a.id === id; });
    if (idx === -1) return;
    draft.attachments.splice(idx, 1);
    ['t:', 'c:'].forEach(function (prefix) {
      const cacheKey = prefix + id;
      if (!diaryUrls.has(cacheKey)) return;
      try { URL.revokeObjectURL(diaryUrls.get(cacheKey)); } catch (err) { /* 忽略 */ }
      diaryUrls.delete(cacheKey);
    });
    try { await diaryFileDelete([id]); } catch (err) { console.warn('删除附件失败：', err); }
    saveDiaryDraft(true);
    renderDiaryAttachments();
    haptic(8);
  }

  async function openDiaryAttachment(id) {
    const draft = state.diaryDraft;
    if (!draft) return;
    const meta = draft.attachments.find(function (a) { return a.id === id; });
    if (!meta) return;
    let rec = null;
    try { rec = await diaryFileGet(id); } catch (err) { rec = null; }
    if (!rec || !rec.data) {
      openModal({
        kind: 'attach-missing',
        title: meta.name,
        text: T('这个附件不在本机。它可能来自一份不含附件的备份，或在旧设备上。'),
        hideCancel: true,
        confirmText: T('知道了')
      });
      return;
    }
    if (meta.kind === 'video') {
      const viewer = $('#diaryViewer');
      const vid = $('#diaryViewerVideo');
      const img = $('#diaryViewerImg');
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      if (vid.dataset.url) {
        try { URL.revokeObjectURL(vid.dataset.url); } catch (err) { /* 忽略 */ }
      }
      const url = URL.createObjectURL(rec.data);
      vid.dataset.url = url;
      vid.src = url;
      vid.hidden = false;
      $('#diaryViewerName').textContent = meta.name;
      viewer.hidden = false;
      requestAnimationFrame(function () { viewer.classList.add('open'); });
      return;
    }
    if (meta.kind === 'image') {
      const viewer = $('#diaryViewer');
      const img = $('#diaryViewerImg');
      const vid = $('#diaryViewerVideo');
      if (vid) { vid.hidden = true; vid.pause(); vid.removeAttribute('src'); }
      if (img.dataset.url) {
        try { URL.revokeObjectURL(img.dataset.url); } catch (err) { /* 忽略 */ }
      }
      const url = URL.createObjectURL(rec.data);
      img.dataset.url = url;
      img.src = url;
      $('#diaryViewerName').textContent = meta.name;
      viewer.hidden = false;
      requestAnimationFrame(function () { viewer.classList.add('open'); });
      return;
    }
    openModal({
      kind: 'attach-info',
      title: meta.name,
      text: T('大小 {size} · 类型 {type}', {
        size: formatBytes(meta.size),
        type: meta.type || T('未知')
      }),
      hideCancel: true,
      confirmText: T('知道了')
    });
  }

  function closeDiaryViewer() {
    const viewer = $('#diaryViewer');
    if (!viewer || viewer.hidden) return;
    const img = $('#diaryViewerImg');
    if (img && img.dataset.url) {
      try { URL.revokeObjectURL(img.dataset.url); } catch (err) { /* 忽略 */ }
      img.dataset.url = '';
      img.removeAttribute('src');
    }
    const vid = $('#diaryViewerVideo');
    if (vid) {
      try { vid.pause(); } catch (err) { /* 忽略 */ }
      if (vid.dataset.url) {
        try { URL.revokeObjectURL(vid.dataset.url); } catch (err) { /* 忽略 */ }
        vid.dataset.url = '';
      }
      vid.removeAttribute('src');
      vid.hidden = true;
    }
    viewer.classList.remove('open');
    viewer.hidden = true;
  }

  function openAttachSheet() {
    if (state.diaryAttachBlocked) { showToast(state.diaryAttachBlocked); return; }
    if (state.diaryAttachBusy) return;
    const sheet = $('#attachSheet');
    const back = $('#attachSheetBackdrop');
    back.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(function () {
      back.classList.add('open');
      sheet.classList.add('open');
    });
  }

  function closeAttachSheet() {
    const sheet = $('#attachSheet');
    const back = $('#attachSheetBackdrop');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    back.classList.remove('open');
    sheet.hidden = true;
    back.hidden = true;
  }

  // ---------- 自动保存 ----------

  function scheduleDiarySave() {
    if (!state.diaryDraft) return;
    state.diaryDirty = true;
    clearTimeout(diarySaveTimer);
    // 停止输入 2 秒后落盘；失焦与退出会立即触发
    diarySaveTimer = setTimeout(function () { saveDiaryDraft(true); }, 2000);
  }

  function markDiarySaved() {
    state.diaryDirty = false;
    state.diarySavedAt = Date.now();
    const el = $('#deSaved');
    if (!el) return;
    const words = diaryWordCount(state.diaryDraft ? state.diaryDraft.text : '');
    el.textContent = words ? T('已保存 · {n} 字', { n: words }) : T('已保存');
    el.hidden = false;
    el.classList.add('show');
    clearTimeout(diarySavedTimer);
    diarySavedTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (!el.classList.contains('show')) el.hidden = true; }, 240);
    }, 1600);
  }

  function saveDiaryDraft(silent) {
    clearTimeout(diarySaveTimer);
    const draft = state.diaryDraft;
    if (!draft) return;
    const text = draft.text || '';
    const title = String(draft.title || '').trim().slice(0, DIARY_TITLE_MAX);
    draft.title = title;
    const location = normalizeDiaryLocation(draft.location);
    draft.location = location;
    // 只有标题、只有位置也算有效记录，避免「写了标题却保存不了」
    const empty = !text.trim() && !title && !draft.mood && !draft.tags.length &&
      !draft.attachments.length && !location;
    const existing = diaryByDate(draft.date);

    // 首次输入前不落空记录；把已有日记清空后，记录本身也一并移除
    if (empty) {
      if (existing) {
        state.diary = state.diary.filter(function (e) { return e.date !== draft.date; });
        persistDiary(true);
      }
      state.diaryDirty = false;
      if (!silent) markDiarySaved();
      return;
    }

    const record = {
      date: draft.date,
      title: title,
      text: text,
      mood: draft.mood,
      tags: draft.tags.slice(),
      location: location ? Object.assign({}, location) : null,
      attachments: draft.attachments.map(function (a) { return Object.assign({}, a); }),
      createdAt: existing ? existing.createdAt : (draft.createdAt || Date.now()),
      updatedAt: Date.now()
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      draft.createdAt = record.createdAt;
      state.diary.push(record);
    }
    sortDiary();
    persistDiary(true).then(function (ok) { if (ok) markDiarySaved(); });
  }

  // ---------- 删除 ----------

  async function deleteDiaryEntries(dates) {
    if (!dates || !dates.length) return;
    const ids = [];
    dates.forEach(function (date) {
      const entry = diaryByDate(date);
      if (!entry) return;
      (entry.attachments || []).forEach(function (a) { ids.push(a.id); });
    });
    state.diary = state.diary.filter(function (e) { return dates.indexOf(e.date) === -1; });
    try { await diaryFileDelete(ids); } catch (err) { console.warn('清理附件失败：', err); }
    await persistDiary(true);
    ids.forEach(function (id) {
      ['t:', 'c:'].forEach(function (prefix) {
        const key = prefix + id;
        if (diaryUrls.has(key)) {
          try { URL.revokeObjectURL(diaryUrls.get(key)); } catch (err) { /* 忽略 */ }
          diaryUrls.delete(key);
        }
      });
    });
    renderAll();
  }

  function confirmDeleteDiary(date) {
    const entry = diaryByDate(date);
    if (!entry) return;
    const count = entry.attachments.length;
    openModal({
      kind: 'diary-del',
      title: T('删除这篇日记？'),
      text: count
        ? T('{date} 的日记和 {n} 个附件会一起删除，无法恢复。', { date: monthDay(date), n: count })
        : T('{date} 的日记会被删除，无法恢复。', { date: monthDay(date) }),
      confirmText: T('删除'),
      danger: true,
      onConfirm: function () {
        if (state.diaryDraft && state.diaryDraft.date === date) {
          state.diaryDraft = null;
          state.diaryEditorOpen = false;
          state.diaryEditingDate = '';
          const el = $('#diaryEditor');
          el.classList.remove('open');
          el.hidden = true;
          clearTimeout(diarySaveTimer);
          diaryReleaseUrls();
        }
        deleteDiaryEntries([date]);
        showToast(T('已删除这篇日记'));
      }
    });
  }

  function deleteSelectedDiary() {
    const dates = Array.from(state.diarySel);
    if (!dates.length) return;
    openModal({
      kind: 'diary-batch-del',
      title: T('将删除 {n} 篇日记', { n: dates.length }),
      text: T('附件原图、缩略图与视频会一并清除，无法恢复。', { n: dates.length }),
      confirmText: T('删除'),
      danger: true,
      onConfirm: function () {
        exitDiaryManage();
        deleteDiaryEntries(dates);
        showToast(T('已删除 {n} 篇日记', { n: dates.length }));
      }
    });
  }

  // ---------- 备份：是否包含附件 ----------

  function diaryBackupEstimate() {
    // 缩略图按原图约 1 成估，base64 比原始字节大约多 37%；视频原样入库，同样计入
    return Math.round(diaryUsedBytes() * 1.1 * 1.37);
  }

  function diaryHasVideo() {
    return state.diary.some(function (entry) {
      return entry.attachments.some(function (a) { return a.kind === 'video'; });
    });
  }

  function openExportSheet() {
    const est = diaryBackupEstimate();
    const hasVideo = diaryHasVideo();
    $('#exportSizeHint').textContent = est
      ? T('图片、视频与文件合计约 {size}', { size: formatBytes(est) }) +
        (hasVideo ? ' · ' + T('含视频，备份可能达到数百 MB') : '')
      : T('当前没有附件，文件不会变大');
    $('#exportSheetNote').textContent = hasVideo
      ? T('导出的是未加密的 JSON 文件，请存到可信位置；视频会让备份达到数百 MB，请确认存储空间充足。')
      : T('导出的是未加密的 JSON 文件，请存到可信位置；含附件时体积很大。');
    const sheet = $('#exportSheet');
    const back = $('#exportSheetBackdrop');
    back.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(function () {
      back.classList.add('open');
      sheet.classList.add('open');
      const btn = $('#exportNoFiles');
      if (btn) btn.focus();
    });
  }

  function closeExportSheet() {
    const sheet = $('#exportSheet');
    const back = $('#exportSheetBackdrop');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    back.classList.remove('open');
    sheet.hidden = true;
    back.hidden = true;
  }

  function chooseExportWithFiles() {
    closeExportSheet();
    const size = formatBytes(diaryBackupEstimate());
    openModal({
      kind: 'export-with-files',
      title: T('导出包含附件的备份？'),
      text: T('文件约 {size}，比不含附件大很多；导出的是未加密文件，请存到可信位置。', { size: size }),
      confirmText: T('继续导出'),
      onConfirm: function () { exportJSON(true); }
    });
  }

  // ---------- 事件 ----------

  function bindDiaryEvents() {
    $('#diarySearch').addEventListener('input', function (e) {
      state.diaryQuery = e.target.value;
      $('#diarySearchClear').hidden = !state.diaryQuery;
      renderDiary();
    });

    $('#diarySearchClear').addEventListener('click', function () {
      state.diaryQuery = '';
      $('#diarySearch').value = '';
      $('#diarySearchClear').hidden = true;
      renderDiary();
    });

    $('#diaryModes').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-diary-mode]');
      if (!btn) return;
      if (state.diaryMode === btn.dataset.diaryMode) return;
      state.diaryMode = btn.dataset.diaryMode;
      haptic(6);
      renderDiary();
    });

    $('#diaryChips').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-diary-filter]');
      if (!btn) return;
      state.diaryFilter = btn.dataset.diaryFilter;
      renderDiary();
    });

    $('#diaryChips').addEventListener('change', function (e) {
      if (e.target && e.target.id === 'diaryMonthSelect') {
        state.diaryMonth = e.target.value;
        renderDiary();
      }
    });

    $('#diaryWriteBtn').addEventListener('click', function () { openDiaryEditor(todayKey()); });

    $('#diaryManageBtn').addEventListener('click', function () {
      if (state.diaryManage) exitDiaryManage();
      else enterDiaryManage();
    });
    $('#diaryManageCancel').addEventListener('click', exitDiaryManage);
    $('#diaryManageDelete').addEventListener('click', deleteSelectedDiary);

    $('#diaryBody').addEventListener('click', function (e) {
      const card = e.target.closest('[data-diary-open]');
      if (!card) {
        // 管理态点内容区空白：退出管理且不删除
        if (state.diaryManage) exitDiaryManage();
        return;
      }
      const date = card.dataset.diaryOpen;
      if (state.diaryManage) { toggleDiarySel(date, card); return; }
      openDiaryEditor(date);
    });

    $('#diaryBody').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest && e.target.closest('[data-diary-open]');
      if (!card) return;
      e.preventDefault();
      const date = card.dataset.diaryOpen;
      if (state.diaryManage) toggleDiarySel(date, card);
      else openDiaryEditor(date);
    });

    $('#diaryDone').addEventListener('click', function () { closeDiaryEditor(true); });
    $('#diaryText').addEventListener('input', function (e) {
      if (!state.diaryDraft) return;
      state.diaryDraft.text = e.target.value;
      scheduleDiarySave();
    });
    $('#diaryText').addEventListener('blur', function () {
      if (state.diaryDraft) saveDiaryDraft(true);
    });

    $('#diaryTitle').addEventListener('input', function (e) {
      if (!state.diaryDraft) return;
      state.diaryDraft.title = e.target.value.slice(0, DIARY_TITLE_MAX);
      scheduleDiarySave();
    });

    // 点日期打开滚轮，默认停在当前编辑的日期，可补写过去的日记
    $('#deDate').addEventListener('click', function () {
      openYearPicker('diary');
    });

    $('#deLocText').addEventListener('input', function (e) {
      if (!state.diaryDraft) return;
      const loc = state.diaryDraft.location ? Object.assign({}, state.diaryDraft.location) : {};
      loc.text = e.target.value.slice(0, 60);
      diarySetLocation(loc);
    });
    $('#deLocPick').addEventListener('click', openRegionSheet);
    $('#deLocClear').addEventListener('click', function () {
      diarySetLocation(null);
      const input = $('#deLocText');
      if (input) input.value = '';
      haptic(8);
    });
    $('#regionDone').addEventListener('click', commitRegion);
    $('#regionClose').addEventListener('click', closeRegionSheet);
    $('#regionBackdrop').addEventListener('click', closeRegionSheet);

    $('#deMoods').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-mood]');
      if (!btn || !state.diaryDraft) return;
      // 再点一次取消心情
      state.diaryDraft.mood = state.diaryDraft.mood === btn.dataset.mood ? '' : btn.dataset.mood;
      haptic(8);
      renderDiaryMoods();
      scheduleDiarySave();
    });

    $('#deTags').addEventListener('click', function (e) {
      const del = e.target.closest('[data-tag-del]');
      if (!del || !state.diaryDraft) return;
      state.diaryDraft.tags.splice(Number(del.dataset.tagDel), 1);
      scheduleDiarySave();
      renderDiaryTags();
    });

    $('#deTags').addEventListener('input', function (e) {
      if (e.target && e.target.id === 'deTagInput') diaryTagValue = e.target.value;
    });

    $('#deTags').addEventListener('keydown', function (e) {
      const input = e.target;
      if (!input || input.id !== 'deTagInput') return;
      if (e.isComposing) return;
      if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
        e.preventDefault();
        addDiaryTag(input.value);
        return;
      }
      if (e.key === 'Backspace' && !input.value && state.diaryDraft && state.diaryDraft.tags.length) {
        e.preventDefault();
        state.diaryDraft.tags.pop();
        scheduleDiarySave();
        renderDiaryTags();
      }
    });

    $('#deTags').addEventListener('blur', function (e) {
      if (e.target && e.target.id === 'deTagInput' && e.target.value.trim()) {
        addDiaryTag(e.target.value);
      }
    }, true);

    $('#diaryAttachBtn').addEventListener('click', openAttachSheet);
    $('#attachCancel').addEventListener('click', closeAttachSheet);
    $('#attachSheetBackdrop').addEventListener('click', closeAttachSheet);
    $('#attachPickImage').addEventListener('click', function () {
      closeAttachSheet();
      $('#diaryImageInput').click();
    });
    $('#attachPickVideo').addEventListener('click', function () {
      closeAttachSheet();
      $('#diaryVideoInput').click();
    });
    $('#attachPickFile').addEventListener('click', function () {
      closeAttachSheet();
      $('#diaryFileInput').click();
    });

    ['#diaryImageInput', '#diaryVideoInput', '#diaryFileInput'].forEach(function (sel) {
      const input = $(sel);
      if (!input) return;
      input.addEventListener('change', function () {
        addDiaryAttachments(input.files);
        input.value = '';
      });
    });

    $('#diaryAttachGrid').addEventListener('click', function (e) {
      const del = e.target.closest('[data-attach-del]');
      if (del) {
        e.stopPropagation();
        removeDiaryAttachment(del.dataset.attachDel);
        return;
      }
      const tile = e.target.closest('[data-attach-open]');
      if (tile) openDiaryAttachment(tile.dataset.attachOpen);
    });

    $('#diaryDeleteBtn').addEventListener('click', function () {
      if (state.diaryDraft) confirmDeleteDiary(state.diaryDraft.date);
    });

    $('#diaryViewerClose').addEventListener('click', closeDiaryViewer);
    $('#diaryViewer').addEventListener('click', function (e) {
      if (e.target === $('#diaryViewer')) closeDiaryViewer();
    });

    $('#exportBtn').addEventListener('click', openExportSheet);
    $('#exportNoFiles').addEventListener('click', function () {
      closeExportSheet();
      exportJSON();
    });
    $('#exportWithFiles').addEventListener('click', chooseExportWithFiles);
    $('#exportCancel').addEventListener('click', closeExportSheet);
    $('#exportSheetBackdrop').addEventListener('click', closeExportSheet);

    // 切到后台 / 失焦时立即落盘，避免系统回收进程导致丢字
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && state.diaryEditorOpen && state.diaryDraft) {
        saveDiaryDraft(true);
      }
    });
    window.addEventListener('blur', function () {
      if (state.diaryEditorOpen && state.diaryDraft) saveDiaryDraft(true);
    });
  }

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

    // 设备标识：随机 UUID，只用于把同意记录绑定到本机；不使用设备型号等硬件信息
    if (!state.meta.deviceId) {
      ensureDeviceId();
      await persistMeta();
    }

    // 首次打开保持空白；只清理旧版本留下的示例条目，且只跑一次
    await migrateLegacySamples();
    await ensurePersist();

    applyTheme();
    updateStorageBanner();
    renderAll();
    initWeather();
    registerSW();
    scheduleNextMidnight();
    setInterval(onTick, 30000);
    // 回到前台时重排一次：把后台期间新增/修改的提醒补进系统，
    // 也顺手把已经过去的实例从排程里剔除
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') scheduleReminders();
    });

    // 渠道必须在第一次排程之前建好：Android 8+ 的通知按渠道投递，缺渠道会被静默丢弃。
    // 先删掉旧 id 的渠道（参数不可改，重建同 id 无效），再幂等创建 v2 渠道。
    const bootNotify = localNotifyPlugin();
    if (bootNotify) {
      await dropLegacyReminderChannel(bootNotify);
      await ensureReminderChannel(bootNotify);
      await refreshExactAlarmStatus(bootNotify);
    }
    await refreshNotifyState();
    // 开屏结束后的顺序：协议确认 → 通知授权引导 → 主界面
    onSplashDone(function () { maybeShowAgreement(); });
  }

  boot().catch(function (err) {
    console.error('启动失败：', err);
    storage.status = 'memory';
    updateStorageBanner();
    showToast(T('启动时遇到问题，已切换到内存模式'));
  });
})();
