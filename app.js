'use strict';

/* =========================================================
   氢计划 / AeroPlan v1.1.8
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

  const LS_ITEMS_KEY = 'aeroplan.items';
  const LS_META_KEY = 'aeroplan.meta';
  const LS_CATS_KEY = 'aeroplan.categories';
  const LS_PLANS_KEY = 'aeroplan.plans';
  const LS_DIARY_KEY = 'aeroplan.diary';
  const LS_CD_KEY = 'aeroplan.countdowns';
  const IDB_NAME = 'aeroplan-db';
  const IDB_STORE = 'kv';
  // 日记附件单独一个对象仓库，按 id 索引，避免把 Blob 塞进 kv 的大对象里
  const DIARY_FILE_STORE = 'diaryFiles';

  // 旧代号（light-schedule）的库与键里可能存着用户全部数据，只能迁移、不能直接改名。
  // 迁移成功后旧库/旧键保留不删，失败时继续读旧库，绝不出现「打开就空了」。
  const LEGACY_IDB_NAMES = ['light-schedule-db'];
  const LEGACY_LS_KEYS = {
    items: 'light-schedule.items',
    meta: 'light-schedule.meta',
    categories: 'light-schedule.categories',
    plans: 'light-schedule.plans',
    diary: 'light-schedule.diary',
    lang: 'light-schedule.lang'
  };

  const APP_VERSION = '1.2.19';
  const POLICY_VERSION = 'privacy-1.2';
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
    '振动用于轻触反馈；关闭不影响功能。',
    '本版本不申请存储、定位、通知与闹钟权限：备份经系统保存或分享面板完成，导入由你手动选择文件。',
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
    'Vibration is used for light feedback when picking dates and times. Turning it off does not affect any feature.',
    'This version requests no storage, location, notification or alarm permission: backups go through the system save/share panel, and imports use the file you pick manually.',
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
  // 「全部行程」默认只显示当天；上滑跳到未来最近有行程的一天，下滑跳到过去最近有行程的一天。
  // 不再逐日/逐段铺开，也不用页头按钮，全部交给纵向手势。
  const AGENDA_BACK_DAYS = 0;
  const AGENDA_FWD_DAYS = 0;
  // 跳转后锚点日两侧各留几天，让目标日期大致落在视野中央
  const AGENDA_JUMP_SPAN = 3;
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

  // 分类内置图标：扁平拟物 / 双色调。
  // 每个图标 3 个色块（.i1 主体 / .i2 次面 / .i3 暗部或点缀）+ 1 处高光（.hl），
  // 全部内联 SVG、只靠 CSS 变量取色，不使用 linearGradient，因此没有 id，
  // 也就不会出现「重复渲染后渐变串色」的问题；单图标节点数 3~7。
  // id 会写进分类数据与备份，改名会导致旧数据图标丢失，因此 id 固定不变。
  const CATEGORY_ICONS = [
    { id: 'book', zh: '书本 / 学习', en: 'Book', svg: '<rect class="i1" x="3.4" y="3.2" width="17.2" height="17.6" rx="3.2"/><rect class="i2" x="7.2" y="5.4" width="10.9" height="13.2" rx="1.8"/><path class="i3" d="M7.2 5.4H5.4a1.8 1.8 0 0 0-1.8 1.8v9.6a1.8 1.8 0 0 0 1.8 1.8h1.8z"/><path class="hl" d="M9.2 8.4h6.9v1.3H9.2z"/>' },
    { id: 'work', zh: '工作 / 公文包', en: 'Work', svg: '<rect class="i1" x="2.8" y="7.6" width="18.4" height="12.6" rx="3"/><path class="i3" d="M9 7.6V5.8A2.6 2.6 0 0 1 11.6 3.2h.8A2.6 2.6 0 0 1 15 5.8v1.8h-1.9V5.9a.8.8 0 0 0-.8-.8h-.6a.8.8 0 0 0-.8.8v1.7z"/><rect class="i2" x="10.1" y="11.6" width="3.8" height="2.1" rx="1"/><path class="hl" d="M3.6 14.2h16.8v1.2H3.6z"/>' },
    { id: 'gift', zh: '纪念日 / 礼物', en: 'Anniversary', svg: '<rect class="i1" x="3.2" y="8.8" width="17.6" height="12" rx="2"/><rect class="i2" x="10.5" y="8.8" width="3" height="12"/><rect class="i2" x="3.2" y="11.8" width="17.6" height="2.6"/><path class="i3" d="M10.5 8.8c-1.3-.5-2-1.7-2-2.7 0-.8.6-1.3 1.3-1.3.9 0 2 1.1 2.8 4z"/><path class="i3" d="M13.5 8.8c1.3-.5 2-1.7 2-2.7 0-.8-.6-1.3-1.3-1.3-.9 0-2 1.1-2.8 4z"/>' },
    { id: 'flower', zh: '花朵', en: 'Flower', svg: '<circle class="i1" cx="12" cy="6.7" r="3"/><circle class="i1" cx="17.3" cy="12" r="3"/><circle class="i2" cx="12" cy="17.3" r="3"/><circle class="i2" cx="6.7" cy="12" r="3"/><circle class="i3" cx="12" cy="12" r="2.4"/>' },
    { id: 'sport', zh: '运动', en: 'Sport', svg: '<path class="i1" d="M7.6 8.6h8.8v6.8H7.6z"/><rect class="i2" x="3.2" y="7.2" width="3.7" height="9.6" rx="1.7"/><rect class="i2" x="17.1" y="7.2" width="3.7" height="9.6" rx="1.7"/><path class="i3" d="M6.8 9.8h1.7v4.4H6.8zM15.5 9.8h1.7v4.4h-1.7z"/><path class="hl" d="M8.4 9.8h7.2v1.3H8.4z"/>' },
    { id: 'food', zh: '餐食', en: 'Food', svg: '<path class="i1" d="M3 12.6h18c0 4.3-3.5 7.5-9 7.5S3 16.9 3 12.6z"/><path class="i2" d="M5.2 11.7c1.5-1.5 4-2.4 6.8-2.4s5.3.9 6.8 2.4c-1.7.6-4.2 1-6.8 1s-5.1-.4-6.8-1z"/><path class="ln" d="M9 3.6c-.7 1.3-.7 2 .1 3M12.4 2.9c-.7 1.3-.7 2 .1 3M15.8 3.6c-.7 1.3-.7 2 .1 3"/><path class="hl" d="M5.4 13.8h5.4v1.4H5.4z"/>' },
    { id: 'travel', zh: '旅行', en: 'Travel', svg: '<path class="i1" d="M21.2 4.3 3 11.5l6.9 2.4z"/><path class="i2" d="M9.9 13.9 21.2 4.3l-8.6 15z"/><path class="i3" d="M9.9 13.9l-1.3 5.2 3.5-3.9z"/><path class="hl" d="M10.1 13.8l2.7-2.3 1.3.8z"/>' },
    { id: 'medical', zh: '医疗', en: 'Medical', svg: '<rect class="i1" x="3" y="6.6" width="18" height="12.6" rx="3"/><path class="i3" d="M9.2 6.6V5.7A2.5 2.5 0 0 1 11.7 3.2h.6A2.5 2.5 0 0 1 14.8 5.7v.9h-1.9v-.8a.7.7 0 0 0-.7-.7h-.4a.7.7 0 0 0-.7.7v.8z"/><rect class="i2" x="10.9" y="8.9" width="2.2" height="8" rx=".7"/><rect class="i2" x="7.9" y="11.9" width="8.2" height="2.2" rx=".7"/>' },
    { id: 'home', zh: '家务', en: 'Housework', svg: '<path class="i2" d="M5.6 9.8 12 4.4l6.4 5.4V20a1 1 0 0 1-1 1H6.6a1 1 0 0 1-1-1z"/><path class="i3" d="M9.8 21v-5.3a2.2 2.2 0 0 1 4.4 0V21z"/><path class="i1" d="M3 11 12 3.2l9 7.8v1.8L12 5.3 3 12.8z"/><rect class="hl" x="7.6" y="12.4" width="2.4" height="2.4" rx=".7"/>' },
    { id: 'finance', zh: '财务', en: 'Finance', svg: '<circle class="i1" cx="12" cy="12" r="8.6"/><circle class="i2" cx="12" cy="12" r="6.4"/><path class="ln" d="M9.4 8.6 12 11.8l2.6-3.2M12 11.8v4M9.9 13.4h4.2"/><circle class="hl" cx="9.2" cy="7.8" r="1.4"/>' },
    { id: 'music', zh: '音乐', en: 'Music', svg: '<path class="i1" d="M9.4 5.2l9-1.6v1.9l-9 1.6z"/><path class="i1" d="M9.4 5.2v12.2h1.6V6.6z"/><path class="i1" d="M15.6 7.6v7.9h1.6V6.3z"/><circle class="i2" cx="6.6" cy="17.4" r="2.7"/><circle class="i2" cx="15" cy="15.6" r="2.7"/><path class="hl" d="M10 5.9l8.2-1.5v1.2L10 7.1z"/>' },
    { id: 'pet', zh: '宠物', en: 'Pet', svg: '<path class="i1" d="M7.4 17.2c0-2.7 2-4.5 4.6-4.5s4.6 1.8 4.6 4.5c0 2.3-2 3.5-4.6 3.5s-4.6-1.2-4.6-3.5z"/><circle class="i2" cx="6.5" cy="8.7" r="2.1"/><circle class="i2" cx="10.1" cy="6" r="2.1"/><circle class="i2" cx="13.9" cy="6" r="2.1"/><circle class="i2" cx="17.5" cy="8.7" r="2.1"/><circle class="hl" cx="10.2" cy="16.2" r="1"/>' },
    { id: 'cake', zh: '生日蛋糕', en: 'Birthday', svg: '<path class="i2" d="M3.4 20.4h17.2v1.4H3.4z"/><rect class="i1" x="4.8" y="11.6" width="14.4" height="8.8" rx="1.4"/><path class="i2" d="M6.2 9.4h11.6a1.6 1.6 0 0 1 1.6 1.6v1.2H4.6v-1.2a1.6 1.6 0 0 1 1.6-1.6z"/><rect class="i2" x="8.6" y="4.8" width="1.9" height="4.6" rx=".7"/><rect class="i2" x="13.5" y="4.8" width="1.9" height="4.6" rx=".7"/><circle class="i3" cx="9.55" cy="3.4" r="1.4"/><circle class="i3" cx="14.45" cy="3.4" r="1.4"/>' },
    { id: 'star', zh: '星标', en: 'Star', svg: '<path class="i1" d="M12 3.4l2.6 5.4 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8z"/><path class="i2" d="M12 6.6l1.7 3.6 3.9.6-2.8 2.7.7 3.8-3.5-1.9z"/><path class="hl" d="M12 5l1.2 2.4-1.2 1.4-1.2-1.4z"/>' },
    { id: 'camera', zh: '摄影 / 相机', en: 'Camera', svg: '<rect class="i1" x="2.8" y="7.4" width="18.4" height="12.4" rx="3"/><path class="i2" d="M8.2 7.4l1.5-2.3h4.6l1.5 2.3z"/><circle class="i2" cx="12" cy="13.4" r="4"/><circle class="i3" cx="12" cy="13.4" r="2.2"/><circle class="hl" cx="10.9" cy="12.3" r=".9"/>' },
    { id: 'coffee', zh: '咖啡 / 休息', en: 'Coffee', svg: '<path class="i1" d="M4 8.4h12.2v5.8a5.2 5.2 0 0 1-5.2 5.2H9.2A5.2 5.2 0 0 1 4 14.2z"/><ellipse class="i2" cx="10.1" cy="8.6" rx="6.1" ry="1.8"/><path class="i1" d="M16.2 9.4h2.1a2.8 2.8 0 0 1 0 5.6h-2.1v-1.7h2.1a1.1 1.1 0 0 0 0-2.2h-2.1z"/><path class="hl" d="M5.3 10.8h4.7v1.4H5.3z"/>' }
  ];
  const CATEGORY_ICON_BY_ID = {};
  CATEGORY_ICONS.forEach(function (icon) { CATEGORY_ICON_BY_ID[icon.id] = icon; });

  // 图标片段本身只有 path/circle/rect，必须包一层 <svg> 才会被浏览器绘制；
  // 缺 viewBox 或宽高会渲染成 0×0（之前图标全空的根因就是少了这层 svg）。
  // data-icon 用于在 CSS 里给每个图标分配一套浅色/深色都适用的色板。
  // viewBox 收紧到 1.5~22.5（图形本体约占 2.8~21.2），在不变大的圆底里
  // 让块面更充分地铺满，同时留 1 单位左右的细窄留白，避免贴边裁切感。
  function categorySvg(inner, id) {
    return '<svg class="cat-ic" data-icon="' + (id || '') + '" viewBox="1.5 1.5 21 21" width="12" height="12" aria-hidden="true" focusable="false">' +
      inner + '</svg>';
  }

  function categoryGlyphHTML(cat, extraClass) {
    if (!cat || !cat.icon) return '';
    const icon = CATEGORY_ICON_BY_ID[cat.icon];
    if (!icon) return '';
    return '<span class="cat-glyph' + (extraClass ? ' ' + extraClass : '') +
      '" aria-hidden="true">' + categorySvg(icon.svg, icon.id) + '</span>';
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
    countdowns: [],
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
    // 计划页分段控件当前选中的周期
    planKind: 'week',
    editingId: '',
    planEditingId: '',
    settingsOpen: false,
    saving: false,
    // 数据是否已经读完
    loaded: false,
    // 旧代号数据迁移日志（写入自查面板）
    migrationLog: [],
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
    memoryCountdowns: [],
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

  // 英文界面的世界节日（固定公历日期）。日格宽度只有 45px 左右，
  // 名字按「一眼能认出来」压到最短，不放完整官方名
  const EN_SOLAR_FESTIVALS = {
    '1-1': 'New Year',
    '2-14': 'Valentine',
    '3-17': "St. Pat's",
    '4-1': 'April Fools',
    '10-31': 'Halloween',
    '12-24': 'Xmas Eve',
    '12-25': 'Christmas',
    '12-31': "Year's Eve"
  };

  const lunarDayCache = {};
  const solarTermCache = {};
  const dayMetaCache = {};

  // ==================== 缓存管理：统一前缀、统一清理、可自检 ====================
  // 应用只保留“活数据”：日期换算缓存按当前浏览窗口裁剪，天气与反查地名由
  // weather.js 每次替换而非累积；这里提供统一入口，避免越用越大。
  const CACHE_PREFIX = 'aeroplan.cache.';

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

  // 复活节：春分后第一个满月之后的第一个星期日（公历 computus，匿名算法）
  function easterOf(y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return {
      month: Math.floor((h + l - 7 * m + 114) / 31),
      day: ((h + l - 7 * m + 114) % 31) + 1
    };
  }

  // 英文界面专用的节日表：固定公历 + 复活节、母亲节、父亲节、感恩节四个浮动节日
  function enFestivalOf(y, m, d) {
    if (m === 5 && d === nthWeekdayOfMonth(y, 5, 0, 2)) return "Mother's";
    if (m === 6 && d === nthWeekdayOfMonth(y, 6, 0, 3)) return "Father's";
    if (m === 11 && d === nthWeekdayOfMonth(y, 11, 4, 4)) return 'Thanks';
    if (m === 3 || m === 4) {
      const e = easterOf(y);
      if (e.month === m && e.day === d) return 'Easter';
    }
    return EN_SOLAR_FESTIVALS[m + '-' + d] || '';
  }

  // 每天的农历 / 节气 / 节日，按天缓存
  // 节日表随语言切换（中文传统节日 / 英文世界节日），所以缓存里记下语言，
  // 语言变了就地重算，不依赖调用方记得清缓存
  function dayMeta(key) {
    const en = isEn();
    if (dayMetaCache[key] && dayMetaCache[key].en === en) return dayMetaCache[key];
    const dt = keyToDate(key);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const lunar = solarToLunar(y, m, d);
    const term = solarTermsOfYear(y)[m + '-' + d] || '';
    // 英文界面换一整套世界节日：不显示农历节日、二十四节气和公历里的中国节日
    const lunarFestival = en ? '' : lunarFestivalOf(lunar);
    let festival = en ? enFestivalOf(y, m, d) : (lunarFestival || solarFestivalOf(y, m, d));
    // 清明既是节气也是传统节日，归到「跟随农历」这一类；公历/国际节日则始终显示
    let festivalKind = en ? (festival ? 'solar' : '') : (lunarFestival ? 'lunar' : (festival ? 'solar' : ''));
    if (!en && !festival && term === '清明') { festival = '清明'; festivalKind = 'lunar'; }
    const monthName = LUNAR_MONTH_NAMES[lunar.month - 1];
    const meta = {
      lunar: lunar,
      lunarText: lunar.day === 1
        ? (lunar.isLeap ? '闰' + monthName + '月' : '初一')
        : (lunar.isLeap ? '闰' : '') + LUNAR_DAY_NAMES[lunar.day - 1],
      lunarFull: (lunar.isLeap ? '闰' : '') + monthName + '月' + LUNAR_DAY_NAMES[lunar.day - 1],
      term: term,
      festival: festival,
      festivalKind: festivalKind,
      en: en
    };
    dayMetaCache[key] = meta;
    return meta;
  }

  // 英文界面用数字写农历（8/15），中文保持「八月十五 / 初一」；
  // 和纪念日卡片的农历写法一致，避免英文日历里出现汉字
  function lunarDigits(meta) {
    return meta.lunar.month + '/' + meta.lunar.day;
  }

  function lunarLabel(meta) {
    return isEn() ? T('农历 {d}', { d: lunarDigits(meta) }) : meta.lunarFull;
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
    // 旧版本的「提醒」类型已取消，统一按待办展示
    const type = raw.type === 'reminder' ? 'todo' : (TYPE_META[raw.type] ? raw.type : 'todo');
    const time = /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : null;
    const recurrence = normalizeRecurrence(raw.recurrence);
    const completions = normalizeCompletions(raw.completions);
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
  // 目标次数上限：够表达长期计划，也不至于把卡片撑爆
  const PLAN_TARGET_MAX = 999;
  // 五种进度视觉，全部在同一套卡片高度内排布
  const PLAN_PROGRESS_STYLES = ['bar', 'battery', 'ring', 'percent', 'moon'];
  const PLAN_PROGRESS_META = {
    bar: { zh: '进度条', en: 'Bar' },
    battery: { zh: '能量格', en: 'Cells' },
    ring: { zh: '环形', en: 'Ring' },
    percent: { zh: '百分数', en: 'Percent' },
    moon: { zh: '月相', en: 'Moon' }
  };
  function planStyleOf(v) {
    return PLAN_PROGRESS_STYLES.indexOf(v) !== -1 ? v : 'bar';
  }
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
  // 「其他」区块只列未来周期，空态文案单独一套
  const PLAN_SCOPE_FUTURE_EMPTY = {
    week: '暂无未来的周计划',
    month: '暂无未来的月计划',
    year: '暂无未来的年计划'
  };

  function planPeriodStart(kind, key) {
    const d = keyToDate(key);
    if (kind === 'year') return d.getFullYear() + '-01-01';
    if (kind === 'month') return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01';
    return startOfWeek(key);
  }

  // 周期最后一天：用来判断计划是否已经过期（周期结束且目标未达成）
  function planPeriodEnd(kind, periodStart) {
    const d = keyToDate(periodStart);
    if (kind === 'year') return d.getFullYear() + '-12-31';
    if (kind === 'month') return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return addDays(periodStart, 6);
  }

  function planIsOverdue(plan, progress) {
    const p = progress || planProgress(plan);
    if (p.done) return false;
    return todayKey() > planPeriodEnd(plan.kind, plan.periodStart);
  }

  function planPeriodLabel(kind, periodStart) {
    const d = keyToDate(periodStart);
    if (kind === 'year') return isEn() ? String(d.getFullYear()) : d.getFullYear() + ' 年';
    if (kind === 'month') return isEn() ? MONTH_EN[d.getMonth()] + ' ' + d.getFullYear() : (d.getMonth() + 1) + ' 月';
    return shortDate(periodStart) + ' – ' + shortDate(addDays(periodStart, 6));
  }

  // 计划进度：target = 目标次数 M，count = 已完成次数 N。
  // 目标 1 的条目等同原来的「一次性计划」，done 只是 count >= target 的派生值。
  function normalizePlan(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = PLAN_KINDS[raw.kind] ? raw.kind : 'week';
    const title = String(raw.title || '').trim().slice(0, 80);
    if (!title) return null;
    let periodStart = String(raw.periodStart || '');
    if (isNaN(keyToDate(periodStart).getTime())) periodStart = planPeriodStart(kind, todayKey());
    const time = /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : null;

    const rawTarget = Math.round(Number(raw.target));
    const rawCount = Math.round(Number(raw.count));
    let target = isFinite(rawTarget) && rawTarget > 0 ? rawTarget : (isFinite(rawCount) && rawCount > 0 ? rawCount : 1);
    target = Math.min(Math.max(target, 1), PLAN_TARGET_MAX);
    // 旧数据只有 done：完成过就把进度直接补满，未完成则从 0 开始
    let count = isFinite(rawCount) ? rawCount : (raw.done === true ? target : 0);
    count = Math.min(Math.max(count, 0), target);

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
      target: target,
      count: count,
      // 每条计划自己的进度视觉；旧数据缺省回落进度条
      progressStyle: planStyleOf(raw.progressStyle),
      done: count >= target,
      doneAt: typeof raw.doneAt === 'number' ? raw.doneAt : (count >= target ? Date.now() : null),
      // 旧数据没有 order：null 表示继续按时间/创建顺序，不强行改写
      order: typeof raw.order === 'number' && isFinite(raw.order) ? raw.order : null,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  function planProgress(plan) {
    const target = Math.max(1, Math.round(Number(plan && plan.target) || 1));
    const count = Math.min(target, Math.max(0, Math.round(Number(plan && plan.count) || 0)));
    return { target: target, count: count, ratio: count / target, done: count >= target };
  }

  // ==================== 日记 ====================

  // 心情：所有面孔共用同一个外圆，只换眼睛与嘴，保证笔画一致
  const DIARY_MOODS = [
    { id: 'happy', zh: '开心', en: 'Happy', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M8.8 14c1.9 2.1 4.5 2.1 6.4 0"/>' },
    { id: 'calm', zh: '平静', en: 'Calm', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M9.2 14.4h5.6"/>' },
    { id: 'tired', zh: '疲惫', en: 'Tired', face: '<path d="M8.2 10.2h2.2M13.6 10.2h2.2"/><path d="M9.6 14.6c1.5.9 3.3.9 4.8 0"/>' },
    { id: 'sad', zh: '难过', en: 'Sad', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M8.8 15.2c1.9-2.1 4.5-2.1 6.4 0"/>' },
    { id: 'annoyed', zh: '烦躁', en: 'Irritated', face: '<path d="M8.4 9.4l2.4 1M15.6 9.4l-2.4 1"/><path d="M9.2 15c.9-1 1.7-1 2.6 0s1.7 1 2.6 0"/>' },
    { id: 'hopeful', zh: '期待', en: 'Hopeful', face: '<path d="M9 10.4h.01M15 10.4h.01"/><circle cx="12" cy="14.8" r="1.5"/>' },
    { id: 'excited', zh: '兴奋', en: 'Excited', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M8.4 13.4c2.1 3 5.1 3 7.2 0"/>' },
    { id: 'grateful', zh: '感激', en: 'Grateful', face: '<path d="M8.4 10.6c.6-.8 1.4-.8 2 0M13.6 10.6c.6-.8 1.4-.8 2 0"/><path d="M9 14c1.8 1.6 4.2 1.6 6 0"/>' },
    { id: 'angry', zh: '生气', en: 'Angry', face: '<path d="M8.2 8.6l2.6 1.4M15.8 8.6l-2.6 1.4"/><path d="M9.4 15.6c1.7-.8 3.4-.8 5.2 0"/>' },
    { id: 'anxious', zh: '焦虑', en: 'Anxious', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M9 14.8c.8-.9 1.6.9 2.4 0s1.6-.9 2.4 0"/>' },
    { id: 'lonely', zh: '孤独', en: 'Lonely', face: '<path d="M8.6 10.6h2M13.4 10.6h2"/><path d="M9.4 15h5.2"/>' },
    { id: 'surprised', zh: '惊喜', en: 'Surprised', face: '<path d="M9 10.4h.01M15 10.4h.01"/><circle cx="12" cy="15" r="1.8"/>' },
    { id: 'shy', zh: '害羞', en: 'Shy', face: '<path d="M8.4 10.6c.6.5 1.4.5 2 0M13.6 10.6c.6.5 1.4.5 2 0"/><path d="M9.6 14.4c1.4 1 3.4 1 4.8 0"/><path d="M6.6 12.6h.9M16.5 12.6h.9"/>' },
    { id: 'moved', zh: '感动', en: 'Moved', face: '<path d="M8.6 10.6c.5-.7 1.2-.7 1.7 0M13.7 10.6c.5-.7 1.2-.7 1.7 0"/><path d="M9 14.2c1.8 1.7 4.2 1.7 6 0"/>' },
    { id: 'speechless', zh: '无语', en: 'Speechless', face: '<path d="M8.6 10.6h2M13.4 10.6h2"/><path d="M9.4 14.9h5.2"/>' },
    { id: 'relieved', zh: '释然', en: 'Relieved', face: '<path d="M8.4 10.6c.6.6 1.4.6 2 0M13.6 10.6c.6.6 1.4.6 2 0"/><path d="M9.4 14.2c1.7 1.4 3.5 1.4 5.2 0"/>' },
    { id: 'bored', zh: '无聊', en: 'Bored', face: '<path d="M8.4 10.4h2.2M13.4 10.4h2.2"/><path d="M9.4 14.8h5.2"/>' },
    { id: 'longing', zh: '想念', en: 'Longing', face: '<path d="M9 10.4h.01M15 10.4h.01"/><path d="M9 14.6c1.6-.9 4.4-.9 6 0"/><path d="M17.8 15.6c.7.5 1.3 1.3 1.3 2a1.4 1.4 0 0 1-2.6 0c0-.7.6-1.5 1.3-2Z"/>' }
  ];
  const DIARY_MOOD_IDS = DIARY_MOODS.map(function (m) { return m.id; });

  // 自定义情绪可选图标：18 张预设面孔 + 8 个抽象符号，统一放进同一个外圆
  const MOOD_GLYPH_EXTRAS = [
    { id: 'heart', face: '<path d="M12 16.6c-2.6-1.8-4-3.2-4-4.9a2.2 2.2 0 0 1 4-1.2 2.2 2.2 0 0 1 4 1.2c0 1.7-1.4 3.1-4 4.9Z"/>' },
    { id: 'star', face: '<path d="M12 6.6l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.9-3.4 1.9.7-3.8-2.8-2.7 3.8-.5z"/>' },
    { id: 'sun', face: '<circle cx="12" cy="12" r="3"/><path d="M12 6.2v-1.4M12 19.2v-1.4M6.2 12h-1.4M19.2 12h-1.4M8.1 8.1l-1-1M16.9 16.9l-1-1M8.1 15.9l-1 1M16.9 8.1l-1 1"/>' },
    { id: 'moon', face: '<path d="M14.6 7.2a4.8 4.8 0 1 0 3.9 7.6 5.4 5.4 0 0 1-3.9-7.6Z"/>' },
    { id: 'leaf', face: '<path d="M16.8 7.2c0 5.2-3.6 8.2-8.4 8.4 0-5 3.4-8.2 8.4-8.4Z"/><path d="M9.4 14.8 15.6 8.6"/>' },
    { id: 'flame', face: '<path d="M12 17.8c2.3 0 4-1.6 4-3.8 0-2.6-2.6-3.6-3.1-6.6-2.1 1.4-3.1 3.1-3.1 4.8-.5-.5-.9-1.2-1-2-1.2 1.2-1.8 2.4-1.8 3.8 0 2.2 1.7 3.8 4 3.8Z"/>' },
    { id: 'drop', face: '<path d="M12 7.2c2 3.1 3.2 5 3.2 6.6a3.2 3.2 0 0 1-6.4 0c0-1.6 1.2-3.5 3.2-6.6Z"/>' },
    { id: 'bolt', face: '<path d="M13.4 6.2 8.6 12.8h3l-.9 5 4.8-6.6h-3z"/>' }
  ];
  const MOOD_GLYPHS = DIARY_MOODS.map(function (m) {
    return { id: m.id, face: m.face };
  }).concat(MOOD_GLYPH_EXTRAS);
  const MOOD_GLYPH_BY_ID = {};
  MOOD_GLYPHS.forEach(function (g) { MOOD_GLYPH_BY_ID[g.id] = g; });

  // 自定义情绪存放在 meta.moods（跟主题、语言同一份本机设置），随备份一起导出
  function customMoods() {
    return Array.isArray(state.meta && state.meta.moods) ? state.meta.moods : [];
  }

  function normalizeMoods(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      const name = String(item.name || '').trim().slice(0, 12);
      if (!name) return;
      let id = String(item.id || '');
      if (!/^cm-[a-z0-9]+$/.test(id)) id = 'cm-' + uid();
      if (out.some(function (m) { return m.id === id; })) return;
      out.push({
        id: id,
        name: name,
        color: isHexColor(item.color) ? item.color : '#7C8CF8',
        glyph: MOOD_GLYPH_BY_ID[item.glyph] ? item.glyph : 'happy',
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
      });
    });
    return out.slice(0, 24);
  }

  // ==================== 卡片样式 / 本机设置 ====================

  // mode：这套皮肤适配的主题。light / dark 表示只在对应主题下生效，
  // 主题不匹配时静默回落到默认卡片，但保留用户的选择，切回匹配主题自动恢复。
  const CARD_STYLES = [
    { id: 'default', zh: '默认', en: 'Default', mode: 'both' },
    { id: 'washi', zh: '和纸', en: 'Washi', mode: 'light' },
    { id: 'felt', zh: '毛毡', en: 'Felt', mode: 'light' },
    { id: 'leather', zh: '皮革', en: 'Leather', mode: 'both' },
    { id: 'cream', zh: '奶油', en: 'Cream', mode: 'light' },
    { id: 'note', zh: '便签纸', en: 'Sticky note', mode: 'light' },
    { id: 'vine', zh: '藤蔓', en: 'Vine', mode: 'light' },
    // 氛围向 · 深色专属
    { id: 'starry', zh: '星空', en: 'Starry sky', mode: 'dark' },
    { id: 'blackhole', zh: '黑洞', en: 'Black hole', mode: 'dark' },
    { id: 'moon', zh: '月球', en: 'Moon', mode: 'dark' },
    // 第二批：磨砂玻璃 / 线框 / 果冻 / 雨窗，本轮全部转正
    { id: 'frost', zh: '磨砂玻璃', en: 'Frosted glass', mode: 'both' },
    { id: 'outline', zh: '线框', en: 'Outline', mode: 'both' },
    { id: 'jelly', zh: '果冻', en: 'Jelly', mode: 'both' },
    { id: 'rain', zh: '雨窗', en: 'Rain window', mode: 'both' },
    // 第三批：亚麻 / 拉丝金属 / 海岸 / 糖果 / 竹 / 线装书
    { id: 'linen', zh: '亚麻', en: 'Linen', mode: 'both' },
    { id: 'metal', zh: '拉丝金属', en: 'Brushed metal', mode: 'both' },
    { id: 'coast', zh: '海岸', en: 'Seaside', mode: 'light' },
    { id: 'candy', zh: '糖果', en: 'Candy', mode: 'light' },
    { id: 'bamboo', zh: '竹简', en: 'Bamboo slip', mode: 'light' },
    { id: 'bound', zh: '线装书', en: 'Thread-bound book', mode: 'light' },
    // 第四批 · 风格扩容 20 套（第一批）
    // 车票、猫趴边、气泡、漫画因造型问题被否，已从注册表与样式中移除；
    // 以下每套至少动两处结构：形状/边缘、装饰母题的尺度、文字排版。
    { id: 'polaroid', zh: '拍立得', en: 'Polaroid', mode: 'light' },
    { id: 'cyber', zh: '赛博霓虹', en: 'Cyber neon', mode: 'dark' },
    { id: 'pixel', zh: '像素 8-bit', en: 'Pixel 8-bit', mode: 'both' },
    { id: 'garland', zh: '藤蔓缠绕', en: 'Garland', mode: 'light' },
    { id: 'newsprint', zh: '报纸剪报', en: 'Newsprint', mode: 'light' },
    { id: 'envelope', zh: '邮戳信封', en: 'Envelope', mode: 'light' },
    { id: 'chalkboard', zh: '黑板粉笔', en: 'Chalkboard', mode: 'both' },
    { id: 'canlabel', zh: '罐头标签', en: 'Can label', mode: 'light' },
    { id: 'window', zh: '格窗光斑', en: 'Window light', mode: 'light' },
    { id: 'subtitle', zh: '字幕卡', en: 'Subtitle card', mode: 'both' },
    { id: 'neon', zh: '霓虹灯牌', en: 'Neon sign', mode: 'dark' },
    { id: 'clip', zh: '便签回形针', en: 'Clipped note', mode: 'light' },
    { id: 'quilt', zh: '绗缝棉被', en: 'Quilt', mode: 'light' },
    { id: 'stamp', zh: '邮票', en: 'Postage stamp', mode: 'light' },
    { id: 'pawtrail', zh: '爪印项圈', en: 'Paw trail', mode: 'light' },
    // 胶片 / 木牌 / 撕页日历 / 和纸包装 / 票根 五套观感不成立，已连同样式一起移除
    { id: 'blueprint', zh: '蓝图', en: 'Blueprint', mode: 'both' },
    { id: 'zipper', zh: '拉链', en: 'Zipper', mode: 'light' },
    { id: 'punchcard', zh: '打孔卡', en: 'Punch card', mode: 'light' },
    { id: 'dogear', zh: '折角纸', en: 'Dog-ear', mode: 'light' },
    { id: 'circuit', zh: '电路板', en: 'Circuit board', mode: 'dark' },
  ];
  const CARD_STYLE_IDS = CARD_STYLES.map(function (s) { return s.id; });

  // 旧键值平滑升级：旧的 paper / glass / ink（以及默认 soft）各自映射到最接近的新皮肤，
  // 老用户已保存的选择不会丢，也不会因为认不出键值被重置成默认。
  const CARD_STYLE_LEGACY = {
    soft: 'washi',
    paper: 'washi',
    glass: 'frost',
    ink: 'outline'
  };
  // 新装用户与「恢复初始设置」的落点：不挂任何皮肤变量，走应用最原始的渲染路径
  const CARD_STYLE_DEFAULT = 'default';

  function normalizeCardStyleId(raw) {
    if (typeof raw !== 'string' || !raw) return CARD_STYLE_DEFAULT;
    if (CARD_STYLE_IDS.indexOf(raw) !== -1) return raw;
    return CARD_STYLE_LEGACY[raw] || CARD_STYLE_DEFAULT;
  }

  function normalizeMeta(raw) {
    const meta = Object.assign({}, raw && typeof raw === 'object' ? raw : {});
    meta.cardStyle = normalizeCardStyleId(meta.cardStyle);
    meta.progressStyle = meta.progressStyle === 'battery' ? 'battery' : 'bar';
    meta.moods = normalizeMoods(meta.moods);
    // 智能提示升级为统一横幅：天气 / 行程 / 计划各记一份确认指纹。
    // 老版本的单份 smartTipAck 只代表天气，这里迁移到天气指纹，避免升级后又弹一次
    meta.smartTipAckWeather = typeof meta.smartTipAckWeather === 'string'
      ? meta.smartTipAckWeather
      : (typeof meta.smartTipAck === 'string' ? meta.smartTipAck : '');
    meta.smartTipAckTrip = typeof meta.smartTipAckTrip === 'string' ? meta.smartTipAckTrip : '';
    meta.smartTipAckPlan = typeof meta.smartTipAckPlan === 'string' ? meta.smartTipAckPlan : '';
    return meta;
  }

  function cardStyleId() {
    return normalizeCardStyleId(state.meta.cardStyle);
  }

  function cardStyleLabel(id) {
    const key = normalizeCardStyleId(id);
    const skin = CARD_STYLES.filter(function (s) { return s.id === key; })[0];
    return skin ? (isEn() ? skin.en : skin.zh) : '';
  }

  function cardStyleMode(id) {
    const key = normalizeCardStyleId(id);
    const skin = CARD_STYLES.filter(function (s) { return s.id === key; })[0];
    return skin && skin.mode ? skin.mode : 'both';
  }

  // 选中的皮肤是否适配当前主题；both 与 default 永远匹配
  function cardStyleFitsTheme(id) {
    const mode = cardStyleMode(id);
    return mode === 'both' || mode === preferredTheme();
  }

  // 真正挂到 body 上的皮肤：不匹配就静默换成默认，用户的选择仍留在 meta 里
  function effectiveCardStyleId() {
    const id = cardStyleId();
    return cardStyleFitsTheme(id) ? id : CARD_STYLE_DEFAULT;
  }

  // 「仅浅色 / 仅深色」小标记，只给单模式皮肤用
  function cardStyleModeLabel(id) {
    const mode = cardStyleMode(id);
    if (mode === 'light') return T('仅浅色');
    if (mode === 'dark') return T('仅深色');
    return '';
  }

  // ==================== 倒数日 ====================

  const CD_COLORS = ['#7C8CF8', '#E0776A', '#68C39F', '#F2B84B', '#46B3C9', '#D98BB5', '#98A2B3', '#F08A4B'];
  // 农历表覆盖 1900–2100：超出范围一律拒绝，不硬算
  const CD_MIN_YEAR = 1900;
  const CD_MAX_YEAR = 2100;
  const CD_DIRECTIONS = ['down', 'up'];
  const CD_REPEATS = ['none', 'yearly', 'monthly'];
  const CD_CALENDARS = ['solar', 'lunar'];
  // 旧数据缺 direction/repeat/calendar：读入时补全并在这里打标记，boot 完成后回写一次
  let cdNeedsMigration = false;

  function normalizeCountdown(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title || '').trim().slice(0, 40);
    const date = String(raw.date || '');
    if (!title) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(keyToDate(date).getTime())) return null;

    // 方向：新数据用面板选择；旧数据按日期推断（已过 = 正数，未来 = 倒数）
    let direction = CD_DIRECTIONS.indexOf(raw.direction) !== -1 ? raw.direction : '';
    if (!direction) {
      direction = date < todayKey() ? 'up' : 'down';
      cdNeedsMigration = true;
    }
    let repeat = CD_REPEATS.indexOf(raw.repeat) !== -1 ? raw.repeat : '';
    if (!repeat) {
      repeat = 'none';
      cdNeedsMigration = true;
    }
    let calendar = CD_CALENDARS.indexOf(raw.calendar) !== -1 ? raw.calendar : '';
    if (!calendar) {
      calendar = 'solar';
      cdNeedsMigration = true;
    }

    let lunarYear = null;
    let lunarMonth = null;
    let lunarDay = null;
    let lunarLeap = false;
    if (calendar === 'lunar') {
      const ly = Number(raw.lunarYear);
      const lm = Number(raw.lunarMonth);
      const ld = Number(raw.lunarDay);
      const okLunar = isFinite(ly) && isFinite(lm) && isFinite(ld) &&
        ly >= CD_MIN_YEAR && ly <= CD_MAX_YEAR && lm >= 1 && lm <= 12 && ld >= 1 && ld <= 30;
      if (okLunar) {
        lunarYear = Math.round(ly);
        lunarMonth = Math.round(lm);
        lunarDay = Math.round(ld);
        lunarLeap = raw.lunarLeap === true;
        // 农历没有「每月几号」这种稳定概念，遇到旧数据里的组合降级为不重复
        if (repeat === 'monthly') {
          repeat = 'none';
          cdNeedsMigration = true;
        }
      } else {
        // 农历字段缺失或损坏：回落到公历，卡片本身不丢
        calendar = 'solar';
        lunarYear = lunarMonth = lunarDay = null;
        lunarLeap = false;
        cdNeedsMigration = true;
      }
    }

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      title: title,
      date: date,
      direction: direction,
      repeat: repeat,
      calendar: calendar,
      lunarYear: lunarYear,
      lunarMonth: lunarMonth,
      lunarDay: lunarDay,
      lunarLeap: lunarLeap,
      color: isHexColor(raw.color) ? raw.color : CD_COLORS[0],
      categoryId: typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : null,
      pinned: raw.pinned === true,
      // 横向卡片条的固定排序位次：只增不减，新增的排最右，改日期也不会跳位
      order: isFinite(Number(raw.order)) ? Number(raw.order) : null,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  function countdownDays(entry) {
    // 重复的纪念日按「下一次」计天数，排序才不会把生日永远排到最后
    const next = cdNextKey(entry);
    const target = next || entry.date;
    return cdDayDiff(todayKey(), target);
  }

  function sortCountdowns() {
    // 旧数据没有 order：按「未来由近到远，已过由近到远」补一次位次，之后不再变
    let maxOrder = -1;
    state.countdowns.forEach(function (c) {
      if (typeof c.order === 'number') maxOrder = Math.max(maxOrder, c.order);
    });
    state.countdowns.filter(function (c) { return typeof c.order !== 'number'; })
      .sort(function (a, b) {
        const da = countdownDays(a);
        const db = countdownDays(b);
        const ra = da >= 0 ? da : 1e9 + Math.abs(da);
        const rb = db >= 0 ? db : 1e9 + Math.abs(db);
        if (ra !== rb) return ra - rb;
        return a.date.localeCompare(b.date);
      })
      .forEach(function (c) { c.order = ++maxOrder; });

    state.countdowns.sort(function (a, b) {
      // 置顶的排最前，其余按固定位次；位次相同再按日期
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.date.localeCompare(b.date);
    });
  }

  function countdownNextOrder() {
    let max = -1;
    state.countdowns.forEach(function (c) {
      if (typeof c.order === 'number') max = Math.max(max, c.order);
    });
    return max + 1;
  }

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
    const list = customMoods();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      const glyph = MOOD_GLYPH_BY_ID[list[i].glyph] || MOOD_GLYPH_BY_ID.happy;
      return { id: id, zh: list[i].name, en: list[i].name, face: glyph.face, color: list[i].color, custom: true };
    }
    return null;
  }

  function moodLabel(id) {
    const m = moodMeta(id);
    return m ? (isEn() ? m.en : m.zh) : '';
  }

  // 情绪条：预设 12 种 + 用户自定义；自定义带自己的颜色
  function moodAll() {
    const presets = DIARY_MOODS.map(function (m) {
      return { id: m.id, label: isEn() ? m.en : m.zh, color: null, custom: false };
    });
    const customs = customMoods().map(function (m) {
      return { id: m.id, label: m.name, color: m.color, custom: true };
    });
    return presets.concat(customs);
  }

  // 面孔：24 网格、1.6 描边，和底部导航同一套线性语言
  function moodIconHTML(id, cls) {
    const m = moodMeta(id);
    if (!m) return '';
    return '<svg class="' + (cls || 'mood-ico') + '" viewBox="0 0 24 24" aria-hidden="true"' +
      (m.color ? ' style="color:' + esc(m.color) + '"' : '') + '>' +
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

  // 位置：省市区县来自内置表（完全离线），具体位置是用户自己写的一行，全部可选
  function normalizeDiaryLocation(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const province = String(raw.province || '').trim().slice(0, 20);
    const city = String(raw.city || '').trim().slice(0, 20);
    const district = String(raw.district || '').trim().slice(0, 20);
    const text = String(raw.text || '').trim().slice(0, 60);
    if (!province && !city && !district && !text) return null;
    return { province: province, city: city, district: district, text: text };
  }

  // 天气快照：只存用户滚轮选的位置与当天的天气结果，离线也保留
  function normalizeDiaryWeather(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';
    const code = Number(raw.code);
    if (!date || !isFinite(code)) return null;
    const max = Number(raw.max);
    const min = Number(raw.min);
    return {
      date: date,
      code: code,
      max: isFinite(max) ? max : null,
      min: isFinite(min) ? min : null,
      place: String(raw.place || '').trim().slice(0, 60),
      at: typeof raw.at === 'number' ? raw.at : Date.now()
    };
  }

  function normalizeDiary(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';
    if (!date || isNaN(keyToDate(date).getTime())) return null;
    // 自定义情绪在 meta 之前读入，这里按 id 规则放行，渲染时找不到就自然留空
    const rawMood = typeof raw.mood === 'string' ? raw.mood : '';
    const mood = (DIARY_MOOD_IDS.indexOf(rawMood) !== -1 || /^cm-[a-z0-9]+$/.test(rawMood)) ? rawMood : '';
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
    const weather = normalizeDiaryWeather(raw.weather);
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
      weather: weather,
      // 英文模式日记天气勾选：每篇日记独立保存，中文模式不显示该开关
      weatherOn: raw.weatherOn === true,
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
        weather: entry.weather ? Object.assign({}, entry.weather) : null,
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

  // ---------- 旧库迁移（light-schedule-db → aeroplan-db） ----------
  // 打开旧库时不指定版本：已有版本保持不变，不会因为升级而改动旧库结构。
  function openExistingDB(name) {
    return new Promise(function (resolve, reject) {
      let req;
      try {
        req = indexedDB.open(name);
      } catch (err) {
        reject(err);
        return;
      }
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('旧库打开失败')); };
      req.onblocked = function () { reject(new Error('旧库被占用')); };
    });
  }

  function readStoreValue(db, storeName, key) {
    return new Promise(function (resolve) {
      try {
        if (!db.objectStoreNames.contains(storeName)) return resolve(undefined);
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        req.onsuccess = function () { resolve(req.result ? req.result.value : undefined); };
        req.onerror = function () { resolve(undefined); };
      } catch (err) {
        resolve(undefined);
      }
    });
  }

  function readStoreAll(db, storeName) {
    return new Promise(function (resolve) {
      try {
        if (!db.objectStoreNames.contains(storeName)) return resolve([]);
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      } catch (err) {
        resolve([]);
      }
    });
  }

  async function readLegacyIdb(name) {
    let db = null;
    try {
      db = await withTimeout(openExistingDB(name), 1200);
      const snapshot = {
        items: await readStoreValue(db, IDB_STORE, 'items'),
        categories: await readStoreValue(db, IDB_STORE, 'categories'),
        plans: await readStoreValue(db, IDB_STORE, 'plans'),
        meta: await readStoreValue(db, IDB_STORE, 'meta'),
        diary: await readStoreValue(db, IDB_STORE, 'diary')
      };
      const files = await readStoreAll(db, DIARY_FILE_STORE);
      return { snapshot: snapshot, files: files };
    } catch (err) {
      return null;
    } finally {
      if (db) {
        try { db.close(); } catch (err) { /* 忽略 */ }
      }
    }
  }

  function hasAnyValue(snapshot) {
    if (!snapshot) return false;
    return ['items', 'categories', 'plans', 'diary'].some(function (k) {
      return Array.isArray(snapshot[k]) && snapshot[k].length > 0;
    }) || (snapshot.meta && typeof snapshot.meta === 'object' && Object.keys(snapshot.meta).length > 0);
  }

  // 启动时做一次：新库为空、旧库有数据才迁移；任一环节失败就跳过，继续用旧数据源。
  async function migrateLegacyStore() {
    state.migrationLog = [];
    try {
      if (storage.status === 'idb') {
        const current = {
          items: await idbGet('items'),
          categories: await idbGet('categories'),
          plans: await idbGet('plans'),
          diary: await idbGet('diary'),
          meta: await idbGet('meta')
        };
        if (hasAnyValue(current)) return;
        for (const name of LEGACY_IDB_NAMES) {
          const legacy = await readLegacyIdb(name);
          if (!legacy || !hasAnyValue(legacy.snapshot)) continue;
          const s = legacy.snapshot;
          await idbSetMany([
            ['items', Array.isArray(s.items) ? s.items : []],
            ['categories', Array.isArray(s.categories) ? s.categories : []],
            ['plans', Array.isArray(s.plans) ? s.plans : []],
            ['diary', Array.isArray(s.diary) ? s.diary : []],
            ['meta', s.meta && typeof s.meta === 'object' ? s.meta : {}]
          ]);
          for (const file of (legacy.files || [])) {
            if (file && file.id) await diaryFilePut(file);
          }
          state.migrationLog.push(
            '已迁移旧库 ' + name + '：' + (Array.isArray(s.items) ? s.items.length : 0) + ' 条条目 / ' +
            (Array.isArray(s.diary) ? s.diary.length : 0) + ' 篇日记 / ' +
            (Array.isArray(s.plans) ? s.plans.length : 0) + ' 条计划'
          );
          console.log(state.migrationLog[state.migrationLog.length - 1]);
          return;
        }
      } else if (storage.status === 'local') {
        const pairs = [
          [LS_ITEMS_KEY, LEGACY_LS_KEYS.items],
          [LS_CATS_KEY, LEGACY_LS_KEYS.categories],
          [LS_PLANS_KEY, LEGACY_LS_KEYS.plans],
          [LS_META_KEY, LEGACY_LS_KEYS.meta],
          [LS_DIARY_KEY, LEGACY_LS_KEYS.diary]
        ];
        let copied = 0;
        pairs.forEach(function (pair) {
          if (localStorage.getItem(pair[0])) return;
          const legacy = localStorage.getItem(pair[1]);
          if (!legacy) return;
          localStorage.setItem(pair[0], legacy);
          copied += 1;
        });
        if (copied) {
          state.migrationLog.push('已迁移旧 local-storage 键 ' + copied + ' 组（旧键保留）');
        }
      }
    } catch (err) {
      console.warn('旧数据迁移失败，继续使用原有数据：', err);
    }
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
      tx.onerror = function () { reject(tx.error || new Error(T('写入失败'))); };
      tx.onabort = function () { reject(tx.error || new Error(T('写入被中断'))); };
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
      tx.onerror = function () { reject(tx.error || new Error(T('写入失败'))); };
      tx.onabort = function () { reject(tx.error || new Error(T('写入被中断'))); };
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
      const probe = 'aeroplan.probe';
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
    let countdowns = [];
    try {
      if (storage.status === 'idb') {
        items = (await idbGet('items')) || [];
        cats = (await idbGet('categories')) || [];
        plans = (await idbGet('plans')) || [];
        meta = (await idbGet('meta')) || {};
        diary = (await idbGet('diary')) || [];
        countdowns = (await idbGet('countdowns')) || [];
      } else if (storage.status === 'local') {
        items = JSON.parse(localStorage.getItem(LS_ITEMS_KEY) || '[]');
        cats = JSON.parse(localStorage.getItem(LS_CATS_KEY) || '[]');
        plans = JSON.parse(localStorage.getItem(LS_PLANS_KEY) || '[]');
        meta = JSON.parse(localStorage.getItem(LS_META_KEY) || '{}');
        diary = JSON.parse(localStorage.getItem(LS_DIARY_KEY) || '[]');
        countdowns = JSON.parse(localStorage.getItem(LS_CD_KEY) || '[]');
      } else {
        items = storage.memoryItems;
        cats = storage.memoryCats;
        plans = storage.memoryPlans;
        meta = storage.memoryMeta;
        diary = storage.memoryDiary;
        countdowns = storage.memoryCountdowns;
      }
    } catch (err) {
      console.warn('读取本地数据失败：', err);
    }

    if (!Array.isArray(items)) items = [];
    if (!Array.isArray(cats)) cats = [];
    if (!Array.isArray(plans)) plans = [];
    if (!Array.isArray(diary)) diary = [];
    if (!Array.isArray(countdowns)) countdowns = [];
    if (!meta || typeof meta !== 'object') meta = {};

    state.categories = cats.map(normalizeCategory).filter(Boolean).slice(0, MAX_CATEGORIES);
    sortCategories();
    state.items = items.map(normalizeItem).filter(Boolean);
    state.plans = plans.map(normalizePlan).filter(Boolean);
    state.countdowns = countdowns.map(normalizeCountdown).filter(Boolean);
    sortCountdowns();
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
    state.meta = normalizeMeta(meta);

    // 旧数据的条目没有 categoryId，这里只在内存里视为未分类，不写回存储
    const ids = new Set(state.categories.map(function (cat) { return cat.id; }));
    state.items.forEach(function (item) {
      if (item.categoryId && !ids.has(item.categoryId)) item.categoryId = null;
    });
    state.plans.forEach(function (plan) {
      if (plan.categoryId && !ids.has(plan.categoryId)) plan.categoryId = null;
    });

    state.agendaFilters = state.agendaFilters.filter(function (id) { return ids.has(id); });
    state.loaded = true;
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

  async function persistCountdowns(silent) {
    const snapshot = state.countdowns.map(function (cd) { return Object.assign({}, cd); });
    try {
      if (storage.status === 'idb') {
        await idbSet('countdowns', snapshot);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_CD_KEY, JSON.stringify(snapshot));
      } else {
        storage.memoryCountdowns = snapshot;
      }
      return true;
    } catch (err) {
      console.error('倒数日保存失败：', err);
      if (!silent) showToast(T('纪念日保存失败，请重试'));
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
    const titleText = $('#topbarText');
    const prev = $('#prevBtn');
    const next = $('#nextBtn');
    const t = todayKey();
    const td = keyToDate(t);
    let onToday = false;

    if (state.view === 'calendar') {
      if (state.yearView) {
        titleText.textContent = isEn() ? String(state.yearViewYear) : state.yearViewYear + ' 年';
      } else {
        titleText.textContent = isEn()
          ? MONTH_EN[state.month.getMonth()] + ' ' + state.month.getFullYear()
          : state.month.getFullYear() + '年' + (state.month.getMonth() + 1) + '月';
      }
      onToday = state.yearView
        ? state.yearViewYear === td.getFullYear()
        : state.month.getFullYear() === td.getFullYear() && state.month.getMonth() === td.getMonth();
    } else if (state.view === 'schedule') {
      const start = state.scheduleAnchor || startOfWeek(t);
      titleText.textContent = shortDate(start) + ' – ' + shortDate(addDays(start, 6));
      onToday = start === startOfWeek(t);
    } else if (state.view === 'diary') {
      titleText.textContent = T('日记');
    } else if (state.view === 'profile') {
      titleText.textContent = T('更多');
    } else {
      titleText.textContent = T('计划');
    }

    // 计划 / 日记 / 更多三页在标题左侧带页面图标；日历、行程表的标题是日期文本，不配图标
    title.dataset.tbicon = (state.view === 'plan' || state.view === 'diary' || state.view === 'profile')
      ? state.view
      : '';

    // 五个页面顶栏统一：无翻页/无「今天」的页面用占位（visibility:hidden），
    // 保留与日历页相同的左/右空间，标题与图标的横坐标不因内容缺失而位移
    const showArrows = state.view === 'calendar' || state.view === 'schedule';
    prev.hidden = false;
    next.hidden = false;
    prev.classList.toggle('ghost', !showArrows);
    next.classList.toggle('ghost', !showArrows);
    prev.toggleAttribute('aria-hidden', !showArrows);
    next.toggleAttribute('aria-hidden', !showArrows);

    // 「更多」页只有设置，不需要「今天」；同样占位对齐
    const todayBtn = $('#todayBtn');
    todayBtn.classList.toggle('ghost', state.view === 'profile');
    todayBtn.toggleAttribute('aria-hidden', state.view === 'profile');
    todayBtn.hidden = false;
    todayBtn.classList.toggle('is-current', onToday);
  }

  // 汇总气泡常驻：显示条件只看「今天有没有行程 / 待办」。
  // 不再记录点过「查看」的指纹，点过之后仍然显示；
  // 有未完成项时给数字，全部完成时只给结论句，避免出现「还有 0 项未完成」。
  let summaryHasPending = false;

  function renderSummary() {
    if (state.batchMode) {
      // 批量操作栏占用顶部位置，汇总提示先让位
      $('#summaryBar').hidden = true;
      return;
    }
    if (state.view === 'plan' || state.view === 'diary' || state.view === 'profile') {
      $('#summaryBar').hidden = true;
      return;
    }
    const t = todayKey();
    const todayItems = expandOccurrences(state.items, t, t);
    // 唯一隐藏条件：今天完全没有行程 / 待办（空状态）
    if (!todayItems.length) {
      summaryHasPending = false;
      $('#summaryBar').hidden = true;
      return;
    }
    const clock = new Date();
    const nowMinutes = clock.getHours() * 60 + clock.getMinutes();

    // 口径：今天、还没完成的两类才算——
    // 1）待办（todo）只要没勾选完成就计数；
    // 2）日程（event）只算今天且开始时间还没到的，今天已经过去的、其它日期的都不算；
    // 已完成的、逾期的（其它日期）一律排除。
    const pending = todayItems.filter(function (i) {
      if (i.done) return false;
      if (i.type === 'todo') return true;
      if (i.type !== 'event') return false;
      // 全天日程没有具体开始时刻，谈不上「已过去」，按今天待办处理
      if (!i.time) return true;
      const parts = String(i.time).split(':');
      const startMinutes = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      return startMinutes > nowMinutes;
    });

    if (!pending.length) {
      summaryHasPending = false;
      $('#summaryText').innerHTML = esc(T('今天的安排都完成了'));
      $('#summaryBar').hidden = false;
      return;
    }

    summaryHasPending = true;
    $('#summaryText').innerHTML = esc(T('今天还有 {n} 项未完成', { n: pending.length }));
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
  // 英文界面不显示中国法定节假日与调休（含假/班角标），改用世界节日
  function holidayInfo(key) {
    if (isEn()) return null;
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
        ? (mainFestival ? T(mainFestival) : (showLunar ? lunarDigits(meta) : ''))
        : (mainFestival || (showLunar ? meta.term : '') || (showLunar ? meta.lunarText : ''));
      const subClass = mainFestival ? ' is-festival'
        : ((!isEn() && showLunar && meta.term) ? ' is-term' : '');

      const ariaTextBase = isEn()
        ? monthDay(key) + ' ' + weekdayOf(key) +
          (showLunar ? ' ' + lunarLabel(meta) : '') +
          (mainFestival ? ', ' + T(mainFestival) : '') +
          ', ' + T('{n} 项安排', { n: dayItems.length })
        : monthDay(key) + ' ' + weekdayOf(key) + ' ' + (showLunar ? meta.lunarFull : '') +
          (showLunar && meta.term ? ' ' + meta.term : '') + (mainFestival ? ' ' + mainFestival : '') +
          '，' + dayItems.length + ' 项安排';
      const ariaText = ariaTextBase + (diaryDates[key] ? (isEn() ? ', journal entry' : '，有日记') : '') +
        (hol ? (isEn() ? ', ' + (hol.type === 'workday' ? 'make-up workday' : 'public holiday')
          : '，' + (hol.type === 'workday' ? '调休上班' : hol.name + '假期')) : '');

      // 「假 / 班」标记固定在内层日期格右下角内侧，绘制在文字下层，不遮日期数字
      // 英文界面 holidayInfo 恒为 null，角标不渲染，所以这里只用中文单字
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
    // 没有安排时整条不显示，避免右侧留下空槽把「日程 / 待办」图例挤偏
    $('#monthStat').hidden = monthItems.length === 0;
    $('#monthStat').textContent = monthItems.length
      ? T('本月共 {n} 项行程', { n: monthItems.length })
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
    // 方向按「两指间距相对初始值」判断：
    // 月历里往内捏（缩到 82%）→ 年历；年历里往外拉（放大到 118%）→ 月历。
    const PINCH_IN = 0.82;
    const PINCH_OUT = 1.18;
    let startDist = 0;
    let pinching = false;

    function distance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function resetEl(el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.opacity = '';
    }

    // 跟手反馈：捏合过程中月历按比例缩小（方向与手势一致，不突然跳变）
    function scaleMonth(ratio) {
      const r = Math.max(PINCH_IN, Math.min(1, ratio));
      month.style.transition = 'none';
      month.style.transformOrigin = '50% 22%';
      month.style.transform = 'scale(' + r.toFixed(3) + ')';
      month.style.opacity = String(0.5 + ((r - PINCH_IN) / (1 - PINCH_IN)) * 0.5);
    }

    function animateOpenYear() {
      openYearView();
      // 年历从略小的尺寸展开，和「往里捏把月历收成小格」的方向衔接
      year.style.transition = 'none';
      year.style.transform = 'scale(.9)';
      year.style.opacity = '0';
      requestAnimationFrame(function () {
        year.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
        year.style.transform = 'scale(1)';
        year.style.opacity = '1';
      });
    }

    function animateCloseYear() {
      year.style.transition = 'transform .16s ease-in, opacity .16s ease-in';
      year.style.transform = 'scale(1.06)';
      year.style.opacity = '0';
      setTimeout(function () {
        closeYearView();
        resetEl(year);
        // 月历从稍小的尺寸回到正常，对应「往外拉放大」
        month.style.transition = 'transform .16s ease-out, opacity .16s ease-out';
        month.style.transform = 'scale(.92)';
        month.style.opacity = '1';
        requestAnimationFrame(function () {
          month.style.transform = 'scale(1)';
        });
        setTimeout(function () { resetEl(month); }, 170);
      }, 150);
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

      if (!state.yearView) {
        if (ratio < 1) scaleMonth(ratio);
        if (!pinching && ratio <= PINCH_IN) {
          pinching = true;
          resetEl(month);
          animateOpenYear();
        }
        return;
      }

      if (ratio > 1) {
        year.style.transition = 'none';
        year.style.transformOrigin = '50% 50%';
        year.style.transform = 'scale(' + Math.min(PINCH_OUT, ratio).toFixed(3) + ')';
      }
      if (!pinching && ratio >= PINCH_OUT) {
        pinching = true;
        animateCloseYear();
      }
    }

    function onEnd(e) {
      if (e.touches.length === 0) {
        startDist = 0;
        pinching = false;
        state.pinchActive = false;
        if (!state.yearView) {
          // 没到阈值就松手：还原缩放
          resetEl(month);
        } else {
          year.style.transition = 'transform .16s ease-out';
          year.style.transform = 'scale(1)';
          setTimeout(function () { if (state.yearView) resetEl(year); }, 170);
        }
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

  // 「日历卡片」三选：黄历 / 星座 / 关闭。
  // 老数据只有 almanacVisible 开关，关掉过的映射成「关闭」，其余按「黄历」。
  function storedCalendarCardMode() {
    const m = state.meta.calendarCard;
    if (m === 'almanac' || m === 'zodiac' || m === 'off') return m;
    return state.meta.almanacVisible === false ? 'off' : 'almanac';
  }

  // 英文界面只有「星座 / 关闭」两段，黄历一律按「星座」等效，避免选中项在控件里不存在。
  function calendarCardMode() {
    const m = storedCalendarCardMode();
    return isEn() && m === 'almanac' ? 'zodiac' : m;
  }

  // 切到英文或英文启动时，把存着的「黄历」迁成「星座」，保证刷新后控件仍有选中项。
  // lang 传目标语言（切语言发生在 I18N 生效前），不传则按当前语言判断。
  function migrateCalendarCardForLang(lang) {
    const en = lang ? lang === 'en' : isEn();
    if (!en || storedCalendarCardMode() !== 'almanac') return false;
    state.meta.calendarCard = 'zodiac';
    state.meta.almanacVisible = true;
    return true;
  }

  function almanacVisible() {
    // 英文界面的等效模式是「星座」，黄历卡片不展示；用户选「关闭」也不展示
    return calendarCardMode() === 'almanac';
  }

  // 星座：本地静态文案 + 按日期确定性打分，不联网、不新增权限
  const ZODIAC_SIGNS = [
    { id: 'aries', zh: '白羊座', short: '白羊', en: 'Aries', glyph: '♈', el: '火象', elEn: 'Fire', planet: '火星', planetEn: 'Mars',
      color: '暖橙', colorEn: 'Warm orange', num: 3,
      luckZh: '行动力被点亮，那件一直想开头的事适合今天动手', luckEn: 'Start what you keep postponing',
      adviceZh: '别把话说满，留一点回旋余地', adviceEn: 'Leave some room in what you promise' },
    { id: 'taurus', zh: '金牛座', short: '金牛', en: 'Taurus', glyph: '♉', el: '土象', elEn: 'Earth', planet: '金星', planetEn: 'Venus',
      color: '米白', colorEn: 'Ivory', num: 6,
      luckZh: '适合把账目、开销和长期计划理一遍，越具体越安心', luckEn: 'Sort budgets and long-term plans',
      adviceZh: '不要为了省事而答应临时的加码', adviceEn: 'Do not accept extra work to stay easy' },
    { id: 'gemini', zh: '双子座', short: '双子', en: 'Gemini', glyph: '♊', el: '风象', elEn: 'Air', planet: '水星', planetEn: 'Mercury',
      color: '淡黄', colorEn: 'Pale yellow', num: 5,
      luckZh: '消息来得快，沟通顺，适合约人把卡住的事聊开', luckEn: 'Talk through what has been stuck',
      adviceZh: '听到的别急着转述，先确认一遍', adviceEn: 'Confirm before you repeat it' },
    { id: 'cancer', zh: '巨蟹座', short: '巨蟹', en: 'Cancer', glyph: '♋', el: '水象', elEn: 'Water', planet: '月亮', planetEn: 'Moon',
      color: '珍珠白', colorEn: 'Pearl white', num: 2,
      luckZh: '情绪敏感但直觉准，适合处理家里和关系里的小事', luckEn: 'Home matters go smoothly',
      adviceZh: '别用猜测代替询问', adviceEn: 'Ask instead of guessing' },
    { id: 'leo', zh: '狮子座', short: '狮子', en: 'Leo', glyph: '♌', el: '火象', elEn: 'Fire', planet: '太阳', planetEn: 'Sun',
      color: '琥珀', colorEn: 'Amber', num: 1,
      luckZh: '适合站出来牵头，你的判断今天比别人快半步', luckEn: 'Lead — your read is a beat ahead',
      adviceZh: '把功劳分出去，场面会更稳', adviceEn: 'Share the credit and stay steady' },
    { id: 'virgo', zh: '处女座', short: '处女', en: 'Virgo', glyph: '♍', el: '土象', elEn: 'Earth', planet: '水星', planetEn: 'Mercury',
      color: '松绿', colorEn: 'Pine green', num: 7,
      luckZh: '细节手感在线，适合校对、整理和收尾', luckEn: 'Good day to proof and finish',
      adviceZh: '允许一件事做到八十分就交出去', adviceEn: 'Let one thing ship at eighty percent' },
    { id: 'libra', zh: '天秤座', short: '天秤', en: 'Libra', glyph: '♎', el: '风象', elEn: 'Air', planet: '金星', planetEn: 'Venus',
      color: '雾蓝', colorEn: 'Foggy blue', num: 9,
      luckZh: '审美和判断都在线，适合定方案、挑东西', luckEn: 'Good for choosing and deciding',
      adviceZh: '别为了照顾所有人而迟迟不选', adviceEn: 'Do not stall just to please everyone' },
    { id: 'scorpio', zh: '天蝎座', short: '天蝎', en: 'Scorpio', glyph: '♏', el: '水象', elEn: 'Water', planet: '冥王星', planetEn: 'Pluto',
      color: '藏青', colorEn: 'Navy', num: 4,
      luckZh: '专注力很深，适合啃需要耐心的硬骨头', luckEn: 'Deep focus on patient work',
      adviceZh: '先听完再回应，别急着下结论', adviceEn: 'Listen to the end before concluding' },
    { id: 'sagittarius', zh: '射手座', short: '射手', en: 'Sagittarius', glyph: '♐', el: '火象', elEn: 'Fire', planet: '木星', planetEn: 'Jupiter',
      color: '珊瑚', colorEn: 'Coral', num: 8,
      luckZh: '心思往外跑，适合规划出行和学新东西', luckEn: 'Plan a trip, learn something',
      adviceZh: '行程留一段空白，不必排满', adviceEn: 'Keep a blank slot in the plan' },
    { id: 'capricorn', zh: '摩羯座', short: '摩羯', en: 'Capricorn', glyph: '♑', el: '土象', elEn: 'Earth', planet: '土星', planetEn: 'Saturn',
      color: '石墨灰', colorEn: 'Graphite', num: 10,
      luckZh: '耐力最稳的一天，适合推进长期目标', luckEn: 'Push the long-term goal',
      adviceZh: '别把休息也当成任务', adviceEn: 'Do not turn rest into a task' },
    { id: 'aquarius', zh: '水瓶座', short: '水瓶', en: 'Aquarius', glyph: '♒', el: '风象', elEn: 'Air', planet: '天王星', planetEn: 'Uranus',
      color: '淡紫', colorEn: 'Lilac', num: 11,
      luckZh: '想法跳脱，适合换个角度重新看老问题', luckEn: 'Try a new angle on old issues',
      adviceZh: '把新点子写下来，别只停在嘴上', adviceEn: 'Write the idea down, not just say it' },
    { id: 'pisces', zh: '双鱼座', short: '双鱼', en: 'Pisces', glyph: '♓', el: '水象', elEn: 'Water', planet: '海王星', planetEn: 'Neptune',
      color: '海蓝', colorEn: 'Sea blue', num: 12,
      luckZh: '共情力强，适合谈需要体谅的事', luckEn: 'Talk with understanding',
      adviceZh: '给情绪找一个落地的出口', adviceEn: 'Give the feeling somewhere to go' }
  ];

  function zodiacOf() {
    const id = state.meta.zodiacSign;
    const hit = ZODIAC_SIGNS.filter(function (z) { return z.id === id; })[0];
    return hit || ZODIAC_SIGNS[0];
  }

  // 同一天同一星座分数稳定（纯本地哈希，不随机跳变）
  function zodiacScore(key, id) {
    const s = key + '|' + id;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return 62 + (h % 34);
  }

  function zodiacStars(score) {
    const lit = Math.max(1, Math.min(5, Math.round(score / 20)));
    return '★★★★★'.slice(0, lit) + '☆☆☆☆☆'.slice(0, 5 - lit);
  }

  function zodiacCardHTML(key) {
    if (calendarCardMode() !== 'zodiac') return '';
    const z = zodiacOf();
    const en = isEn();
    const score = zodiacScore(key, z.id);
    const tagFortune = en ? 'Luck' : '运';
    const tagDo = en ? 'Do' : '宜';
    const sep = en ? ': ' : '：';
    return '<div class="dd-almanac" aria-label="' + esc(T('星座')) + '">' +
      '<div class="alm-top">' +
        '<span class="alm-title">' + esc(T('星座')) + ' · ' + esc(en ? z.en : z.zh) + '</span>' +
        '<span class="alm-ganzhi">' + esc(z.glyph + '\uFE0E ' + (en ? z.elEn + ' · ' + z.planetEn : z.el + ' · ' + z.planet)) + '</span>' +
      '</div>' +
      '<div class="alm-line"><b class="alm-tag ok">' + esc(tagFortune) + '</b><span>' +
        esc(zodiacStars(score) + ' ' + score + ' · ' + (en ? z.luckEn : z.luckZh)) + '</span></div>' +
      '<div class="alm-line"><b class="alm-tag no">' + esc(tagDo) + '</b><span>' + esc(en ? z.adviceEn : z.adviceZh) + '</span></div>' +
      '<div class="alm-foot">' +
        '<span>' + esc(T('幸运色') + sep + (en ? z.colorEn : z.color)) + '</span>' +
        '<span>' + esc(T('幸运数字') + sep + z.num) + '</span>' +
        '<span>' + esc(T('守护星') + sep + (en ? z.planetEn : z.planet)) + '</span>' +
      '</div>' +
    '</div>';
  }

  // 各星座的标准日期区间（公历，跨年的摩羯按 12.22 – 1.19 写）
  const ZODIAC_RANGES = {
    aries: '3.21 – 4.19', taurus: '4.20 – 5.20', gemini: '5.21 – 6.21', cancer: '6.22 – 7.22',
    leo: '7.23 – 8.22', virgo: '8.23 – 9.22', libra: '9.23 – 10.23', scorpio: '10.24 – 11.22',
    sagittarius: '11.23 – 12.21', capricorn: '12.22 – 1.19', aquarius: '1.20 – 2.18', pisces: '2.19 – 3.20'
  };

  // 「选择星座」独立整页：十二星座网格，含符号、名称、日期区间与选中态
  function renderZodiacPage() {
    const grid = $('#zodiacGrid');
    if (!grid) return;
    const en = isEn();
    const cur = zodiacOf().id;
    grid.innerHTML = ZODIAC_SIGNS.map(function (z) {
      const on = z.id === cur;
      return '<button class="zodiac-item' + (on ? ' active' : '') + '" type="button" data-zodiac="' + z.id +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="zi-glyph" aria-hidden="true">' + z.glyph + '\uFE0E' + '</span>' +
        '<span class="zi-text">' +
          '<span class="zi-name">' + esc(en ? z.en : z.zh) + '</span>' +
          '<span class="zi-range">' + esc(ZODIAC_RANGES[z.id] || '') + '</span>' +
        '</span>' +
        '<span class="zi-tick" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
      '</button>';
    }).join('');
  }

  function openZodiacPage() {
    const page = $('#zodiacPage');
    if (!page) return;
    renderZodiacPage();
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
    const body = page.querySelector('.settings-body');
    if (body) body.scrollTop = 0;
  }

  function closeZodiacPage() {
    const page = $('#zodiacPage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    window.setTimeout(function () {
      if (page.classList.contains('open')) return;
      page.hidden = true;
    }, 240);
  }

  function calendarCardHTML(key) {
    const mode = calendarCardMode();
    if (mode === 'off') return '';
    if (mode === 'zodiac') return zodiacCardHTML(key);
    return almanacCardHTML(key);
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
        '<span>' + esc(T('值神')) + '：' + esc(a.god) + esc(T(a.godGood ? '（黄道）' : '（黑道）')) + '</span>' +
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
    if (showLunar) subParts.push(lunarLabel(meta));
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
      calendarCardHTML(key) +
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
    const VELOCITY = 0.12;        // px/ms，轻轻快扫也能翻页
    // 翻月动画压到 70 + 80 = 150ms：动画结束立刻解锁，快速连划能顺畅接上。
    // 一次手势只翻一个月靠的是「方向锁 + 位移阈值」，而不是长时间冷却。
    const ANIM_OUT = 70;
    const ANIM_IN = 80;

    let pid = null;
    let active = false;
    let mode = '';                // '' | 'h'（已锁定横向）
    let animating = false;
    let animTimers = [];
    let animSeq = 0;
    let sx = 0;
    let sy = 0;
    let dx = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;

    // 动画期间的手势一律可中断：定时器带序号，取消后旧回调直接作废，
    // 新滑动不必等惯性/翻页动画结束。
    function later(fn, ms) {
      const seq = animSeq;
      animTimers.push(setTimeout(function () {
        if (seq !== animSeq) return;
        fn();
      }, ms));
    }

    function cancelAnim() {
      animSeq++;
      animTimers.forEach(function (t) { clearTimeout(t); });
      animTimers = [];
      animating = false;
      grid.style.transition = '';
      grid.style.transform = '';
    }

    function width() { return grid.clientWidth || 360; }

    function atBound(dir) {
      const y = state.month.getFullYear();
      const m = state.month.getMonth();
      if (dir < 0) return y <= CAL_MIN_YEAR && m === 0;
      return y >= CAL_MAX_YEAR && m === 11;
    }

    function springBack() {
      animating = true;
      grid.style.transition = 'transform .16s cubic-bezier(.22,.61,.36,1)';
      grid.style.transform = 'translate3d(0,0,0)';
      later(function () {
        grid.style.transition = '';
        grid.style.transform = '';
        animating = false;
      }, 170);
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
      const threshold = Math.min(30, w * 0.09);
      const flick = Math.abs(vx) > VELOCITY && Math.abs(dx) > 4 &&
        (vx < 0) === (dx < 0);

      if (!(Math.abs(dx) >= threshold || flick) || atBound(dir)) {
        springBack();
        return;
      }

      // 当前月份跟手滑出，再从另一侧滑入新月份
      haptic(8);
      animating = true;
      grid.style.transition = 'transform ' + ANIM_OUT + 'ms cubic-bezier(.2,.7,.3,1)';
      grid.style.transform = 'translate3d(' + (-dir * w) + 'px,0,0)';

      later(function () {
        if (!shiftMonthBy(dir)) {
          springBack();
          return;
        }
        renderCalendar();
        updateTopbar();

        grid.style.transition = 'none';
        grid.style.transform = 'translate3d(' + (dir * w) + 'px,0,0)';
        const seq = animSeq;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (seq !== animSeq) return;
            grid.style.transition = 'transform ' + ANIM_IN + 'ms cubic-bezier(.2,.7,.3,1)';
            grid.style.transform = 'translate3d(0,0,0)';
            later(function () {
              grid.style.transition = '';
              grid.style.transform = '';
              animating = false;
            }, ANIM_IN);
          });
        });
      }, ANIM_OUT);
    }

    grid.addEventListener('pointerdown', function (e) {
      // 上一次翻页还在收尾时，新手势直接接管：清掉旧动画与定时器，立即可反向滑
      if (animating) cancelAnim();
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

  // 全选：当前屏幕内的全部卡片，含已收起的卡片组（DOM 仍在，只是不可见）
  function selectAllBatchCards() {
    const box = document.getElementById(document.body.classList.contains('agenda-open') ? 'agendaList' : 'dayDetailInner');
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('.swipe[data-id]'), function (wrap) {
      state.batchSel.add(batchKeyOf(wrap));
    });
    syncBatchDom();
    renderBatchBar();
    haptic(8);
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
    const overdue = options.overdue === true ||
      (item.type === 'todo' && !item.recurrence && !item.done && item.date < t);
    const meta = TYPE_META[item.type];
    const cat = getCategory(item.categoryId);
    // 圆点只表达「类型」：日程蓝、待办绿，和左下角图注一致；
    // 分类颜色只出现在标签 chip 上，逾期/完成另有文字与卡片状态，不占用这个点。
    const railColor = meta.color;
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
    // 「全部安排」要直接列出该日全部卡片：过期的未完成项也留在当天分组里，
    // 不再用一句「可在上方逾期里查看」把内容藏起来。
    const undone = all.filter(function (i) { return !i.done; }).sort(compareAgenda);
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

    // 只有这一天真的没有任何条目时才出现虚线空态；有历史卡片就照常列出
    if (!undone.length && !doneCount) {
      rows = '<div class="day-empty">' + esc(T('新的一天，从计划开始')) + '</div>';
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
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + ';color:' + cat.color + '">' +
        categoryMarkHTML(cat, '--chip-color:' + cat.color) + esc(cat.name) + '</button>';
    });

    bar.innerHTML = html;
    bar.hidden = false;
  }

  // 把某个日期分组滚到可视区，供「回到今日」与手势跳转定位
  function agendaScrollTo(key, smooth, block) {
    const el = document.getElementById('day-' + key);
    if (!el || !el.scrollIntoView) return;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: block || 'start' });
  }

  // 「全部安排」的即时搜索：标题、备注、地点、分类名都参与匹配
  let agendaSearchQuery = '';
  // 从汇总条「查看」进入时为 true：今天已过去的日程不再列出，和统计口径保持一致
  let agendaPendingOnly = false;

  function agendaItemMatches(item, q) {
    const cat = getCategory(item.categoryId);
    const hay = [
      item.title,
      item.note,
      item.address && item.address.label,
      cat && cat.name
    ].filter(Boolean).join('\n').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  // 锚点之后 / 之前最近一个有行程的日期；重复项按规则逐日展开，命中即停
  function agendaNearestDate(dir) {
    const anchor = state.agendaAnchor || todayKey();
    const filters = state.agendaFilters;
    const pool = filters.length
      ? state.items.filter(function (i) { return filters.indexOf(i.categoryId) !== -1; })
      : state.items;
    let best = '';
    const LIMIT = 4000;

    pool.forEach(function (item) {
      if (!item.recurrence) {
        if (dir === 'fwd' ? item.date > anchor : item.date < anchor) {
          if (!best || (dir === 'fwd' ? item.date < best : item.date > best)) best = item.date;
        }
        return;
      }

      const until = item.recurrence.until || '';
      const startWeek = startOfWeek(item.date);
      let key = dir === 'fwd' ? (item.date > anchor ? item.date : addDays(anchor, 1)) : addDays(anchor, -1);
      if (dir === 'back' && until && until < key) key = until;

      for (let i = 0; i < LIMIT; i++) {
        if (dir === 'fwd' ? (until && key > until) : key < item.date) return;
        if (matchesRecurrence(item, key, startWeek)) {
          if (!best || (dir === 'fwd' ? key < best : key > best)) best = key;
          return;
        }
        key = addDays(key, dir === 'fwd' ? 1 : -1);
      }
    });

    return best;
  }

  // 手势提示：加载中 / 还能继续跳 / 已到边界
  // 上滑看更晚、下滑看更早，所以底部提示「上滑跳到下一个有行程的日期」，顶部相反
  function agendaEdgeHint(dir, loading, available) {
    const loadingText = T('正在跳转…');
    const readyText = dir === 'back' ? T('下滑跳到上一个有行程的日期') : T('上滑跳到下一个有行程的日期');
    const endText = dir === 'back' ? T('没有更早的行程') : T('没有更晚的行程');
    const label = loading
      ? '<span class="am-spin" aria-hidden="true"></span>' + esc(loadingText)
      : esc(available ? readyText : endText);
    return '<span class="agenda-more-end' + (loading ? ' is-loading' : '') +
      '"><span class="am-label">' + label + '</span></span>';
  }

  // 列表里的进度条宽度按 data-pct 统一绘制
  function paintAgendaBars() {
    $$('.mini-bar i', $('#agendaList')).forEach(function (el) {
      if (el.dataset.pct !== undefined) el.style.width = el.dataset.pct + '%';
    });
  }

  function renderAgenda() {
    const t = todayKey();
    const anchor = state.agendaAnchor || t;
    const back = Math.max(0, state.agendaBack || 0);
    const fwd = Math.max(0, state.agendaFwd || 0);

    renderAgendaFilterBar();

    const isEmpty = state.items.length === 0;
    $('#agendaEmpty').hidden = !isEmpty;
    if (isEmpty) {
      $('#agendaList').innerHTML = '';
      return;
    }

    const filters = state.agendaFilters;
    let visibleItems = filters.length
      ? state.items.filter(function (item) { return filters.indexOf(item.categoryId) !== -1; })
      : state.items;

    // 关键词过滤放在日期分组之前，分组与时间顺序保持原样
    const q = agendaSearchQuery.trim().toLowerCase();
    if (q) visibleItems = visibleItems.filter(function (item) { return agendaItemMatches(item, q); });

    if (!visibleItems.length) {
      $('#agendaList').innerHTML = q
        ? '<div class="filter-empty">' +
            '<p class="filter-empty-title">' + esc(T('没有匹配的安排')) + '</p>' +
            '<p class="filter-empty-sub">' + esc(T('换个关键词试试，或清空搜索。')) + '</p>' +
          '</div>'
        : '<div class="filter-empty">' +
            '<p class="filter-empty-title">' + esc(T('所选分类还没有条目')) + '</p>' +
            '<p class="filter-empty-sub">' + esc(T('换一个分类看看，或者给条目加上这些分类。')) + '</p>' +
            '<button class="empty-btn" type="button" data-filter="all">' + esc(T('查看全部')) + '</button>' +
          '</div>';
      return;
    }

    // 搜索时改用全库结果：不受当前日期窗口限制，命中的条目按日期先后铺开
    if (q) {
      const byDate = {};
      visibleItems.forEach(function (item) {
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
      });
      let html = '';
      Object.keys(byDate).sort().forEach(function (key) {
        html += dayGroupHTML(key, byDate[key]);
      });
      $('#agendaList').innerHTML = html;
      requestAnimationFrame(paintAgendaBars);
      return;
    }

    // 以焦点日为轴：向上 back 天历史、向下 fwd 天未来；默认 back/fwd = 0，只显示当天
    const start = addDays(anchor, -back);
    const end = addDays(anchor, fwd);
    const hasEarlier = !!agendaNearestDate('back');
    const hasLater = !!agendaNearestDate('fwd');

    // 从汇总条进入时，今天已开始的日程不铺进时间线，保证列表条目数与「今天还有 n 项」一致
    const clock = new Date();
    const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
    const byDate = {};
    expandOccurrences(visibleItems, start, end).forEach(function (item) {
      if (agendaPendingOnly && item.date === t && item.type === 'event' && item.time) {
        const parts = String(item.time).split(':');
        const startMinutes = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        if (startMinutes <= nowMinutes) return;
      }
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });

    // 汇总条口径不含其它日期的逾期项，进入时也不再把逾期分组顶在最上面
    const overdue = agendaPendingOnly ? [] : visibleItems
      .filter(function (i) { return i.type === 'todo' && !i.recurrence && !i.done && i.date < t; })
      .sort(compareOverdue);

    let html = '<div class="agenda-more top">' +
      agendaEdgeHint('back', state.agendaLoading === 'back', hasEarlier) +
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

    html += '<div class="agenda-more bottom">' +
      agendaEdgeHint('fwd', state.agendaLoading === 'fwd', hasLater) +
    '</div>';

    $('#agendaList').innerHTML = html;

    requestAnimationFrame(paintAgendaBars);
  }

  // 纵向手势跳转：上滑跳到未来最近有行程的一天，下滑跳到过去最近有行程的一天。
  // 加载中忽略重复触发；到边界时把列表滚到对应端，让边界提示露出来。
  function jumpAgenda(dir) {
    if (state.agendaLoading) return;
    const scroller = document.querySelector('.agenda-body');
    const target = agendaNearestDate(dir);

    if (!target) {
      if (scroller) scroller.scrollTop = dir === 'fwd' ? scroller.scrollHeight : 0;
      return;
    }

    // 记住当前窗口；跳转后的窗口与它取并集，首屏内容和新拉取的分组始终在同一条列表里连续排列
    const anchor = state.agendaAnchor || todayKey();
    const back = Math.max(0, state.agendaBack || 0);
    const fwd = Math.max(0, state.agendaFwd || 0);
    const oldStart = addDays(anchor, -back);
    const oldEnd = addDays(anchor, fwd);

    state.agendaLoading = dir;
    renderAgenda();

    // 先给一帧加载反馈，再把焦点移到目标日期；两侧各留几天上下文，目标日仍居中
    setTimeout(function () {
      state.agendaAnchor = target;
      state.agendaBack = Math.max(AGENDA_JUMP_SPAN, daysBetween(oldStart, target));
      state.agendaFwd = Math.max(AGENDA_JUMP_SPAN, daysBetween(target, oldEnd));
      state.agendaLoading = '';
      renderAgenda();
      agendaScrollTo(target, false, 'center');
    }, 200);
  }

  // 页面级纵向手势：只接管明显纵向滑动，横向手势仍留给卡片的编辑/删除
  function bindAgendaSwipe() {
    const page = $('#agendaPage');
    if (!page || page.dataset.agendaSwipe) return;
    page.dataset.agendaSwipe = '1';
    let st = null;

    page.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false, horizontal: false };
    });

    page.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id || st.active) return;
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) { st.horizontal = true; return; }
      if (st.horizontal) return;
      if (Math.abs(dy) >= 56) {
        st.active = true;
        // 上滑（dy < 0）看更晚，下滑看更早
        jumpAgenda(dy < 0 ? 'fwd' : 'back');
      }
    });

    function end(e) {
      if (st && e.pointerId === st.id) st = null;
    }
    page.addEventListener('pointerup', end);
    page.addEventListener('pointercancel', end);
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
    // 计划没有「日程/待办」之分，圆点统一用计划色，不再跟随分类标签
    return 'var(--primary)';
  }

  // 月相亮面路径：k 为已完成比例（0 = 新月全暗，1 = 满月全亮）。
  // 外圈先画右半圆，再用明暗界线椭圆从底部回到顶部：
  // k < 0.5 界线凸向右侧，亮面是右边缘月牙；k = 0.5 界线为直线，亮面正好半盘；
  // k > 0.5 界线凸向左侧，亮面超过半盘。两端单独处理，避免弧线退化后露出半盘。
  function moonLitPathD(k) {
    const r = 9.4;
    const ko = Math.max(0, Math.min(1, k));
    if (ko <= 0) return '';
    if (ko >= 1) {
      return 'M0,' + (-r) + ' A' + r + ',' + r + ' 0 0 1 0,' + r +
        ' A' + r + ',' + r + ' 0 0 1 0,' + (-r) + 'Z';
    }
    const rx = (r * Math.abs(1 - 2 * ko)).toFixed(2);
    const sweep = ko < 0.5 ? 0 : 1;
    return 'M0,' + (-r) + ' A' + r + ',' + r + ' 0 0 1 0,' + r +
      ' A' + rx + ',' + r + ' 0 0 ' + sweep + ' 0,' + (-r) + 'Z';
  }

  // 亮面只从右侧生长：按面积比例插值推进，ease-out，面积单调不减
  function moonEaseOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateMoonLit(el, fromK, toK) {
    if (el._moonRaf) cancelAnimationFrame(el._moonRaf);
    if (Math.abs(toK - fromK) < 0.001) {
      el.setAttribute('d', moonLitPathD(toK));
      return;
    }
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dur = 280;
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const k = fromK + (toK - fromK) * moonEaseOut(t);
      el.setAttribute('d', moonLitPathD(k));
      if (t < 1) {
        el._moonRaf = requestAnimationFrame(step);
      } else {
        el._moonRaf = 0;
      }
    }
    el._moonRaf = requestAnimationFrame(step);
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

  // 进度视觉：目标 > 1 才显示；每条计划按自己的 progressStyle 渲染
  function planProgressVisualHTML(p, plan) {
    if (p.target <= 1) return '';
    const style = planStyleOf(plan && plan.progressStyle);
    const pct = Math.round(p.ratio * 100);
    const countHTML = '<span class="plan-count"><b data-plan-count>' + p.count + '</b>' +
      '<span class="plan-count-sep">/</span><span data-plan-target>' + p.target + '</span></span>';

    // 能量格：最多铺 60 格，超过就自动退回进度条
    if (style === 'battery' && p.target <= 60) {
      let cells = '';
      for (let i = 0; i < p.target; i++) {
        cells += '<i class="plan-cell' + (i < p.count ? ' on' : '') + '"></i>';
      }
      return '<div class="plan-progress battery" data-plan-style="battery">' +
        '<div class="plan-cells' + (p.target > 24 ? ' dense' : '') + '">' + cells + '</div>' + countHTML +
      '</div>';
    }

    if (style === 'ring') {
      return '<div class="plan-progress ring" data-plan-style="ring">' +
        '<span class="plan-ring-mini">' +
          '<svg viewBox="0 0 36 36" aria-hidden="true">' +
            '<circle class="pr-track" cx="18" cy="18" r="14" pathLength="100"/>' +
            '<circle class="pr-fill" data-plan-arc cx="18" cy="18" r="14" pathLength="100" stroke-dasharray="100"' +
              ' stroke-dashoffset="' + (100 - p.ratio * 100).toFixed(1) + '"/>' +
          '</svg>' +
          '<b class="plan-pct-in" data-plan-pct>' + pct + '%</b>' +
        '</span>' + countHTML +
      '</div>';
    }

    if (style === 'percent') {
      return '<div class="plan-progress percent" data-plan-style="percent">' +
        '<span class="plan-pct-main" data-plan-pct>' + pct + '%</span>' + countHTML +
      '</div>';
    }

    if (style === 'moon') {
      // 真实月盘：暗面深灰蓝 + 几处极淡环形山，亮面按完成比例呈现盈亏相位。
      // 相位：外圈右半弧 + 明暗界线椭圆弧；k=0 新月、0.5 上弦、1 满月。
      // 节点预算：暗面圆 1 + 环形山 3 + 亮面路径 1 + 满月高光 0/1 + 外缘 1 ≤ 7。
      const r = 9.4;
      const k = Math.max(0, Math.min(1, p.ratio));
      const d = moonLitPathD(k);
      const full = k >= 0.92;
      return '<div class="plan-progress moon" data-plan-style="moon">' +
        '<span class="plan-moon' + (full ? ' is-full' : '') + '" data-plan-moon>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<defs>' +
              '<radialGradient id="pmLitGrad" cx="38%" cy="30%" r="82%">' +
                '<stop offset="0" stop-color="#FFF8DE"/>' +
                '<stop offset=".5" stop-color="#F7EBC0"/>' +
                '<stop offset=".82" stop-color="#EBD79E"/>' +
                '<stop offset="1" stop-color="#D6BC7C"/>' +
              '</radialGradient>' +
              '<radialGradient id="pmDarkGrad" cx="74%" cy="44%" r="88%">' +
                '<stop offset="0" stop-color="#4E4C56"/>' +
                '<stop offset=".55" stop-color="#404659"/>' +
                '<stop offset="1" stop-color="#343A4A"/>' +
              '</radialGradient>' +
            '</defs>' +
            '<circle class="pm-track" cx="12" cy="12" r="' + r + '"/>' +
            '<ellipse class="pm-crater" cx="10" cy="9" rx="2.1" ry="1.7"/>' +
            '<ellipse class="pm-crater" cx="14.2" cy="13.8" rx="1.7" ry="1.3"/>' +
            '<ellipse class="pm-crater" cx="9.6" cy="14.9" rx="1.2" ry="1"/>' +
            '<g transform="translate(12 12)"><path class="pm-lit" data-plan-moon-lit data-k="' + k + '" d="' + d + '"/></g>' +
            // 环形山必须画在亮面之上，否则满月时会被暖黄亮面整块盖住，看起来就是一块平涂。
            // 4 个坑集中在月盘中部，靠边缘的位置一律不放，26px 下才看得清。
            '<g class="pm-craters-lit" aria-hidden="true">' +
              '<ellipse class="pm-crater-lit" cx="11.2" cy="8.6" rx="2.3" ry="1.8"/>' +
              '<path class="pm-crater-rim" d="M9.3 7.9A2.4 1.9 0 0 1 12.7 7.3"/>' +
              '<ellipse class="pm-crater-lit" cx="14.4" cy="13.1" rx="1.75" ry="1.4"/>' +
              '<path class="pm-crater-rim" d="M13.1 12.6A1.8 1.45 0 0 1 15.2 12.2"/>' +
              '<ellipse class="pm-crater-lit" cx="9.9" cy="15.1" rx="1.3" ry="1.05"/>' +
              '<ellipse class="pm-crater-lit" cx="12.9" cy="10.5" rx=".95" ry=".78"/>' +
            '</g>' +
            '<path class="pm-glow" d="M5.1 9.9A8.2 8.2 0 0 1 11.6 3.6"/>' +
            '<circle class="pm-rim" cx="12" cy="12" r="' + (r - 0.6) + '"/>' +
          '</svg>' +
        '</span>' + countHTML +
      '</div>';
    }

    return '<div class="plan-progress bar" data-plan-style="bar">' +
      '<div class="plan-bar"><i data-plan-bar style="width:' + (p.ratio * 100).toFixed(1) + '%"></i></div>' + countHTML +
    '</div>';
  }

  function planItemHTML(plan, showPeriod) {
    const cat = getCategory(plan.categoryId);
    const p = planProgress(plan);
    const overdue = planIsOverdue(plan, p);
    const tags = [];
    if (showPeriod) {
      tags.push('<span class="tag tag-plan-period">' + esc(planPeriodLabel(plan.kind, plan.periodStart)) + '</span>');
    }
    if (cat) {
      tags.push('<span class="tag" style="color:' + cat.color + ';background:' + hexToRgba(cat.color, 0.12) + '">' +
        (categoryGlyphHTML(cat) || '<i></i>') + esc(cat.name) + '</span>');
    }
    if (plan.priority === 'high') tags.push('<span class="tag tag-high">' + esc(T('高优先级')) + '</span>');
    // 周期结束仍未达成：柔和砖红小标记，不整卡染红
    if (overdue) tags.push('<span class="tag tag-plan-overdue">' + esc(T('已过期')) + '</span>');

    const tap = p.target <= 1
      ? '<button class="check' + (p.done ? ' checked' : '') + '" type="button" data-plan-check="' + plan.id +
          '" role="checkbox" aria-checked="' + (p.done ? 'true' : 'false') +
          '" aria-label="' + esc(p.done ? T('标记为未完成') : T('标记为完成')) + '">' +
          '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.4 7.5l3 2.9 6.2-6.5"/></svg>' +
        '</button>'
      : '<button class="plan-tap' + (p.done ? ' done' : '') + '" type="button" data-plan-check="' + plan.id +
          '" aria-label="' + esc(p.done ? T('目标已达成') : T('记一次完成')) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            (p.done ? '<path d="M5 12.5l4.2 4.2L19 7.4"/>' : '<path d="M12 6.2v11.6M6.2 12h11.6"/>') +
          '</svg>' +
        '</button>';

    // 环形 / 百分数 / 月相三种：视觉块与「+」同一行，视觉在左、「+」在最右
    const style = planStyleOf(plan.progressStyle);
    const visual = planProgressVisualHTML(p, plan);
    const inlineVisual = (style === 'ring' || style === 'percent' || style === 'moon') ? visual : '';

    return '<article class="row plan-item' + (p.done ? ' done' : '') + (overdue ? ' plan-overdue' : '') +
      '" data-plan-row="' + plan.id + '">' +
      '<div class="row-time">' + (plan.time ? esc(plan.time) : esc(T('全天'))) + '</div>' +
      '<div class="row-rail"><span class="rail-dot" style="--dot-color:' +
        (overdue ? 'var(--plan-overdue)' : planColorOf(plan)) + '"></span></div>' +
      '<div class="row-card plan-row-card' + (plan.priority === 'high' ? ' high' : '') + '">' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(plan.title) + '</div>' +
          '<div class="row-meta">' + tags.join('') + '</div>' +
          (inlineVisual ? '' : visual) +
        '</div>' +
        (inlineVisual ? '<div class="plan-inline-visual">' + inlineVisual + '</div>' : '') +
        tap +
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

  // 每个周期自己的完成数：周只算这一周、月只算这一月、年只算这一年
  function planDoneCount(list) {
    return list.filter(function (p) { return p.done; }).length;
  }

  function planPeriodStatText(list) {
    return T('完成 {done}/{total}', { done: planDoneCount(list), total: list.length });
  }

  // 卡头副标题：范围词 · 周期（仅周） · 完成 n/m；进度变化时原地只改这行文字
  function planSubText(kind, total, done, start) {
    return [T(PLAN_SCOPE_WORD[kind])]
      .concat(kind === 'week' ? [planPeriodLabel(kind, start || planPeriodStart(kind, todayKey()))] : [])
      .concat([total ? T('完成 {done}/{total}', { done: done, total: total }) : T('暂无计划')])
      .join(' · ');
  }

  function planCardHTML(kind, t) {
    const start = planPeriodStart(kind, t);
    const ofKind = state.plans.filter(function (p) { return p.kind === kind; });
    const current = ofKind.filter(function (p) { return p.periodStart === start; }).sort(planSort);
    // 「其他」区块只列当前周期之后的未来周期，按时间正序
    const others = ofKind.filter(function (p) { return p.periodStart > start; })
      .sort(function (a, b) {
        if (a.periodStart !== b.periodStart) return a.periodStart > b.periodStart ? 1 : -1;
        return planSort(a, b);
      });
    const done = current.filter(function (p) { return p.done; }).length;
    const total = current.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const full = pct === 100 && total > 0;

    let rows = '';
    if (total) {
      current.forEach(function (plan) { rows += planSwipeHTML(plan, false); });
    } else {
      rows = '<p class="plan-empty">' + esc(T(PLAN_SCOPE_EMPTY[kind])) + '</p>';
    }
    if (others.length) {
      rows += '<p class="plan-other-head">' + esc(T(PLAN_SCOPE_OTHER[kind], { n: others.length })) + '</p>';
      others.forEach(function (plan) { rows += planSwipeHTML(plan, true); });
    } else {
      rows += '<p class="plan-other-head">' + esc(T(PLAN_SCOPE_FUTURE_EMPTY[kind])) + '</p>';
    }

    return '<div class="plan-card" data-plan-card="' + kind + '">' +
      '<div class="plan-card-head">' +
        '<div class="plan-card-title">' +
          '<h2>' + esc(T(PLAN_KINDS[kind])) + '</h2>' +
          '<p class="plan-sub" data-plan-sub>' + esc(planSubText(kind, total, done, start)) + '</p>' +
        '</div>' +
        '<div class="plan-ring' + (full ? ' is-full' : '') + '">' +
          '<svg viewBox="0 0 58 58" aria-hidden="true">' +
            '<circle class="ring-bg" cx="29" cy="29" r="24"></circle>' +
            // 注意：SVG presentation attribute 会被样式表里的 .ring-fill { stroke-dashoffset: 100 } 覆盖，
            // 初始弧长必须写进内联 style，才能和 refreshPlanRing 的原地更新走同一套规则
            '<circle class="ring-fill' + (full ? ' full' : '') + (pct ? '' : ' zero') + '" data-plan-ring="' + kind +
              '" data-pct="' + pct + '" cx="29" cy="29" r="24" pathLength="100"' +
              ' style="stroke-dashoffset:' + (100 - pct) + '"></circle>' +
          '</svg>' +
          '<div class="ring-label"><b>' + (total ? pct + '%' : '—') + '</b><span>' + esc(total ? T('完成') : T('暂无')) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="plan-list">' + rows + '</div>' +
    '</div>';
  }

  function planKindLabel(kind) {
    return kind === 'month' ? T('月计划') : kind === 'year' ? T('年计划') : T('周计划');
  }

  function renderPlan() {
    const t = todayKey();
    const kind = state.planKind === 'month' || state.planKind === 'year' ? state.planKind : 'week';
    const idx = kind === 'week' ? 0 : kind === 'month' ? 1 : 2;
    // 头部两段：操作按钮行 → 周期分段条；分段条单占一行，作为视图切换而不是按钮
    let html = '<div class="plan-page-head">' +
      '<button class="plan-history-btn" id="planHistoryBtn" type="button">' + esc(T('历史计划')) + '</button>' +
      '<button class="plan-add-btn" id="planAdd" type="button">' + esc(T('＋ 添加计划')) + '</button>' +
    '</div>' +
    '<div class="plan-seg" id="planSeg" role="tablist" aria-label="' + esc(T('计划周期')) + '" style="--seg-i:' + idx + '">' +
      '<span class="plan-seg-thumb" aria-hidden="true"></span>' +
      ['week', 'month', 'year'].map(function (k) {
        return '<button class="plan-seg-btn' + (k === kind ? ' active' : '') + '" type="button" role="tab"' +
          ' aria-selected="' + (k === kind ? 'true' : 'false') + '" data-plan-kind="' + k + '">' +
          esc(planKindLabel(k)) + '</button>';
      }).join('') +
    '</div>';
    html += '<div id="planList">' + planCardHTML(kind, t) + '</div>';
    $('#planContent').innerHTML = html;
  }

  // ---------- 历史计划（可左滑编辑） ----------

  function planHistoryItemHTML(plan) {
    const p = planProgress(plan);
    const cat = getCategory(plan.categoryId);
    const overdue = planIsOverdue(plan, p);
    return '<div class="swipe plan-hist-swipe" data-id="' + plan.id + '">' +
      '<button class="swipe-edit" type="button" data-plan-edit="' + plan.id + '" aria-label="编辑这条计划">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 19.8h4L19.4 8.6a1.8 1.8 0 0 0 0-2.6l-1.4-1.4a1.8 1.8 0 0 0-2.6 0L4.2 15.8v4z"/><path d="M13.6 6.6l3.8 3.8"/></svg>' +
      '</button>' +
      '<button class="swipe-del" type="button" data-plan-del="' + plan.id + '" aria-label="删除这条计划">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5.3h5V7M6.9 7l.8 11.2h8.6L17.1 7"/><path d="M10 10.4v4.6M14 10.4v4.6"/></svg>' +
      '</button>' +
      '<div class="swipe-inner">' +
        '<div class="plan-hist-item' + (p.done ? ' done' : '') + (overdue ? ' overdue' : '') + '">' +
          '<span class="plan-hist-dot" style="background:' +
            (overdue ? 'var(--plan-overdue)' : planColorOf(plan)) + '"></span>' +
          '<span class="plan-hist-title">' + esc(plan.title) + '</span>' +
          (cat ? '<span class="plan-hist-cat" style="color:' + cat.color + '">' + esc(cat.name) + '</span>' : '') +
          '<span class="plan-hist-count">' + p.count + '/' + p.target + '</span>' +
          '<span class="plan-hist-check" aria-hidden="true">' + (p.done ? '✓' : (overdue ? esc(T('已过期')) : '')) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  let planHistorySearch = '';
  // 历史计划按周期分组的展开/收起状态（仅本次会话，不写盘）
  const planHistCollapsed = new Set();

  function planHistoryItemMatches(plan, q) {
    if (!q) return true;
    const hay = [plan.title, plan.note].filter(Boolean).join('\n').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function planHistoryBodyHTML() {
    const today = todayKey();
    const q = String(planHistorySearch || '').trim().toLowerCase();
    let html = '';
    ['week', 'month', 'year'].forEach(function (kind) {
      const currentStart = planPeriodStart(kind, today);
      // 只收已经翻过去的周期（历史归档）；当前与未来周期留在计划主页
      const past = state.plans.filter(function (p) {
        return p.kind === kind && p.periodStart < currentStart && planHistoryItemMatches(p, q);
      });
      if (!past.length) return;
      past.sort(function (a, b) {
        if (a.periodStart !== b.periodStart) return a.periodStart > b.periodStart ? -1 : 1;
        return planSort(a, b);
      });
      const groups = [];
      past.forEach(function (p) {
        const last = groups[groups.length - 1];
        if (!last || last.start !== p.periodStart) groups.push({ start: p.periodStart, list: [p] });
        else last.list.push(p);
      });
      html += '<section class="plan-hist-kind">' +
        '<h3 class="plan-hist-kind-title">' + esc(planKindLabel(kind)) + '</h3>' +
        groups.map(function (g) {
          const gkey = kind + '|' + g.start;
          const collapsed = planHistCollapsed.has(gkey);
          return '<div class="plan-hist-group" data-hist-group="' + gkey + '">' +
            '<button class="plan-hist-head" type="button" data-hist-toggle="' + gkey + '" aria-expanded="' + (!collapsed ? 'true' : 'false') + '">' +
              '<span class="plan-hist-period">' + esc(planPeriodLabel(kind, g.start)) + '</span>' +
              '<span class="plan-hist-head-right">' +
                '<span class="plan-hist-stat">' + esc(planPeriodStatText(g.list)) + '</span>' +
                '<svg class="plan-hist-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
              '</span>' +
            '</button>' +
            '<div class="plan-hist-list' + (collapsed ? ' collapsed' : '') + '" data-hist-list="' + gkey + '">' +
              '<div class="plan-hist-list-inner">' + g.list.map(planHistoryItemHTML).join('') + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</section>';
    });
    if (!html) {
      if (q) {
        html = '<div class="empty-state plan-hist-empty">' +
          '<p class="empty-title">' + esc(T('没有匹配的历史计划')) + '</p>' +
          '<p class="empty-sub">' + esc(T('换个关键词试试，或清空搜索。')) + '</p>' +
        '</div>';
      } else {
        html = '<div class="empty-state plan-hist-empty">' +
          '<p class="empty-title">' + esc(T('还没有历史计划')) + '</p>' +
          '<p class="empty-sub">' + esc(T('过去的周 / 月 / 年计划会归档在这里。')) + '</p>' +
        '</div>';
      }
    }
    return html;
  }

  function renderPlanHistory() {
    const body = $('#planHistoryBody');
    if (body) body.innerHTML = planHistoryBodyHTML();
  }

  // 历史计划分组的展开 / 收起：高度用 grid-template-rows 过渡，避免跳变
  function togglePlanHistoryGroup(key, btn) {
    const list = document.querySelector('#planHistoryBody [data-hist-list="' + key + '"]');
    if (!list) return;
    const collapsed = !list.classList.contains('collapsed');
    list.classList.toggle('collapsed', collapsed);
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (collapsed) planHistCollapsed.add(key);
    else planHistCollapsed.delete(key);
    closeAllSwipes();
    haptic(6);
  }

  function openPlanHistoryPage() {
    const page = $('#planHistoryPage');
    if (!page) return;
    // 每次打开都从全量开始，避免上次搜索词残留
    planHistorySearch = '';
    const input = $('#planHistorySearch');
    if (input) input.value = '';
    const clear = $('#planHistorySearchClear');
    if (clear) clear.hidden = true;
    renderPlanHistory();
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
    const body = $('#planHistoryBody');
    if (body) body.scrollTop = 0;
  }

  function closePlanHistoryPage() {
    const page = $('#planHistoryPage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    window.setTimeout(function () {
      if (page.classList.contains('open')) return;
      page.hidden = true;
    }, 240);
  }

  // ==================== 渲染：个人页 ====================

  function renderProfile() {
    const ver = $('#profileVersion');
    if (ver) ver.textContent = 'V' + APP_VERSION;
    renderCardStyleEntry();
    renderCategoryList();
    // 「个性化」里的智能提示开关（默认开启）
    const smartToggle = $('#smartTipToggle');
    if (smartToggle) smartToggle.checked = smartTipEnabled();
  }

  function applyCardStyle() {
    const chosen = cardStyleId();
    const id = effectiveCardStyleId();
    // data-card-style 记录用户选中的皮肤；data-skin 只在当前主题适配时才挂上
    document.body.dataset.cardStyle = chosen;
    if (id === 'default') {
      // 默认皮肤不挂 data-skin：整套皮肤基座、装饰层、行距全部不参与，回到最干净的渲染
      delete document.body.dataset.skin;
    } else {
      document.body.dataset.skin = id;
    }
  }

  function renderCardStyleEntry() {
    const el = $('#cardStyleValue');
    if (!el) return;
    const current = cardStyleId();
    const tip = cardStyleFitsTheme(current) ? '' : cardStyleModeLabel(current);
    el.textContent = cardStyleLabel(current) + (tip ? ' · ' + tip : '');
  }

  // ==================== 皮肤演示卡 ====================

  function skinDemoHTML(id, large) {
    const en = isEn();
    const key = normalizeCardStyleId(id);
    // 默认皮肤不给预览挂 data-skin，避免整套皮肤基座命中预览
    const attr = key === 'default' ? '' : ' data-skin="' + key + '"';
    return '<div class="skin-demo' + (large ? ' skin-demo-lg' : '') + (key === 'default' ? ' skin-demo-default' : '') + '"' + attr + ' aria-hidden="true">' +
      '<span class="skin-demo-top"><i class="skin-demo-dot"></i>' +
        '<span class="skin-demo-title">' + (en ? 'Read that book' : '看完那本书') + '</span></span>' +
      '<span class="skin-demo-meta"><span class="skin-demo-tag">' + (en ? 'Reading' : '阅读') + '</span>' +
        '<span class="skin-demo-time">09:30</span></span>' +
      (large ? '<span class="skin-demo-bar"><i></i></span>' : '') +
    '</div>';
  }

  let cardStyleFilter = 'all';
  function renderCardStylePage() {
    const current = cardStyleId();
    const nameEl = $('#cardStyleCurrentName');
    if (nameEl) nameEl.textContent = cardStyleLabel(current);
    const stage = $('#cardStyleCurrentStage');
    if (stage) stage.innerHTML = skinDemoHTML(current, true);
    // 预览照常展示所选皮肤（方便看清它长什么样），但要说明当前主题下实际不生效
    const noteEl = $('#cardStyleCurrentNote');
    if (noteEl) {
      const fits = cardStyleFitsTheme(current);
      noteEl.hidden = fits;
      noteEl.textContent = fits ? '' : T('「{name}」只在{mode}生效，当前卡片使用默认样式；切回{mode}会自动恢复。', {
        name: cardStyleLabel(current),
        mode: T(cardStyleMode(current) === 'dark' ? '深色模式' : '浅色模式')
      });
    }
    const grid = $('#cardStyleGrid');
    if (!grid) return;
    // 筛选只过滤展示，不改变当前已选皮肤；20 套全部在列，不再有 hold 隐藏项
    grid.innerHTML = CARD_STYLES.filter(function (s) {
      return cardStyleFilter === 'all' || s.mode === cardStyleFilter;
    }).map(function (s) {
      const active = s.id === current;
      const modeTip = cardStyleModeLabel(s.id);
      return '<button class="skin-cell' + (active ? ' active' : '') + '" type="button" data-card-style="' + s.id + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        '<span class="skin-cell-shot">' + skinDemoHTML(s.id, false) + '</span>' +
        '<span class="skin-cell-name">' + esc(isEn() ? s.en : s.zh) +
          (modeTip ? '<i class="skin-cell-mode">' + esc(modeTip) + '</i>' : '') +
        '</span>' +
      '</button>';
    }).join('');
  }

  function openCardStylePage() {
    const page = $('#cardStylePage');
    if (!page) return;
    renderCardStylePage();
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
    const body = page.querySelector('.settings-body');
    if (body) body.scrollTop = 0;
  }

  function closeCardStylePage() {
    const page = $('#cardStylePage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    window.setTimeout(function () {
      if (page.classList.contains('open')) return;
      page.hidden = true;
    }, 240);
  }

  async function chooseCardStyle(id) {
    const next = normalizeCardStyleId(id);
    if (CARD_STYLE_IDS.indexOf(next) === -1 || cardStyleId() === next) return;
    state.meta.cardStyle = next;
    applyCardStyle();
    renderCardStyleEntry();
    renderCardStylePage();
    haptic(8);
    await persistMeta();
    if (state.view === 'plan') renderPlan();
  }

  // ==================== 渲染：倒数日 ====================

  let cdEditingId = '';
  // 新建/编辑面板的草稿：方向、重复、历法、农历月日都在这里，保存时一次性写进数据
  let cdDraft = null;
  let cdWheelDraft = null;

  // ---------- 纪念日：日期换算 ----------

  function cdDayDiff(fromKey, toKey) {
    return Math.round((keyToDate(toKey).getTime() - keyToDate(fromKey).getTime()) / 86400000);
  }

  function cdSolarDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // 公历月末夹取：2 月 29 日在平年回落到 2 月 28 日，31 号遇到小月落到月末
  function cdSolarOn(year, month, day) {
    return dateKey(new Date(year, month - 1, Math.min(Math.max(1, day), cdSolarDaysInMonth(year, month))));
  }

  // 唯一历法入口：复用仓库里的 lunarToSolar，这里只做区间检查与「该月没有这一天」的夹取
  function cdLunarSolar(year, month, day, wantLeap) {
    if (year < CD_MIN_YEAR || year > CD_MAX_YEAR) return null;
    if (month < 1 || month > 12 || day < 1) return null;
    let leap = false;
    let max;
    if (wantLeap && lunarLeapMonth(year) === month) {
      leap = true;
      max = lunarLeapDays(year);
    } else {
      max = lunarMonthDays(year, month);
    }
    const useDay = Math.min(day, max);
    const s = lunarToSolar(year, month, useDay, leap);
    if (!s || s.year < CD_MIN_YEAR || s.year > CD_MAX_YEAR) return null;
    return {
      key: dateKey(new Date(s.year, s.month - 1, s.day)),
      year: s.year, month: s.month, day: s.day,
      leap: leap, clamped: useDay !== day
    };
  }

  // ---------- 纪念日：「下一次」与「上一次」 ----------

  function cdSolarYearlyNext(anchorKey, todayK) {
    if (anchorKey >= todayK) return anchorKey;
    const a = keyToDate(anchorKey);
    const y = keyToDate(todayK).getFullYear();
    const key = cdSolarOn(y, a.getMonth() + 1, a.getDate());
    return key < todayK ? cdSolarOn(y + 1, a.getMonth() + 1, a.getDate()) : key;
  }

  function cdSolarYearlyPrev(anchorKey, todayK) {
    const a = keyToDate(anchorKey);
    const y = keyToDate(todayK).getFullYear();
    const key = cdSolarOn(y, a.getMonth() + 1, a.getDate());
    return key > todayK ? cdSolarOn(y - 1, a.getMonth() + 1, a.getDate()) : key;
  }

  function cdSolarMonthlyNext(anchorKey, todayK) {
    if (anchorKey >= todayK) return anchorKey;
    const a = keyToDate(anchorKey);
    const t = keyToDate(todayK);
    let y = t.getFullYear();
    let m = t.getMonth() + 1;
    let key = cdSolarOn(y, m, a.getDate());
    if (key < todayK) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      key = cdSolarOn(y, m, a.getDate());
    }
    return key;
  }

  function cdSolarMonthlyPrev(anchorKey, todayK) {
    const a = keyToDate(anchorKey);
    const t = keyToDate(todayK);
    let y = t.getFullYear();
    let m = t.getMonth() + 1;
    let key = cdSolarOn(y, m, a.getDate());
    if (key > todayK) {
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
      key = cdSolarOn(y, m, a.getDate());
    }
    return key;
  }

  // 农历按「农历年」逐年找，跨公历年也正确（春节前后不会差一年）
  function cdLunarYearlyNext(cd, todayK) {
    const t = keyToDate(todayK);
    const tl = solarToLunar(t.getFullYear(), t.getMonth() + 1, t.getDate());
    let y = Math.max(cd.lunarYear, tl.year);
    for (let i = 0; i < 3 && y <= CD_MAX_YEAR; i++, y++) {
      const s = cdLunarSolar(y, cd.lunarMonth, cd.lunarDay, cd.lunarLeap);
      if (s && s.key >= todayK) return s.key;
    }
    return null;
  }

  function cdLunarYearlyPrev(cd, todayK) {
    const t = keyToDate(todayK);
    const tl = solarToLunar(t.getFullYear(), t.getMonth() + 1, t.getDate());
    let y = Math.max(cd.lunarYear, tl.year);
    for (let i = 0; i < 3 && y >= CD_MIN_YEAR; i++, y--) {
      const s = cdLunarSolar(y, cd.lunarMonth, cd.lunarDay, cd.lunarLeap);
      if (s && s.key <= todayK) return s.key;
    }
    return null;
  }

  function cdNextKey(cd) {
    if (!cd.repeat || cd.repeat === 'none') return cd.date;
    const todayK = todayKey();
    if (cd.calendar === 'lunar') {
      return cd.repeat === 'yearly' ? cdLunarYearlyNext(cd, todayK) : cd.date;
    }
    if (cd.repeat === 'yearly') return cdSolarYearlyNext(cd.date, todayK);
    if (cd.repeat === 'monthly') return cdSolarMonthlyNext(cd.date, todayK);
    return cd.date;
  }

  function cdPrevKey(cd) {
    const todayK = todayKey();
    if (!cd.repeat || cd.repeat === 'none' || cd.date > todayK) return null;
    if (cd.calendar === 'lunar') {
      return cd.repeat === 'yearly' ? cdLunarYearlyPrev(cd, todayK) : null;
    }
    if (cd.repeat === 'yearly') return cdSolarYearlyPrev(cd.date, todayK);
    if (cd.repeat === 'monthly') return cdSolarMonthlyPrev(cd.date, todayK);
    return null;
  }

  // 完整经过的周年数（未到今年的纪念日少算一年）
  function cdElapsedYears(anchorKey, todayK) {
    const a = keyToDate(anchorKey);
    const ty = keyToDate(todayK).getFullYear();
    let n = ty - a.getFullYear();
    if (cdSolarOn(ty, a.getMonth() + 1, a.getDate()) > todayK) n -= 1;
    return Math.max(0, n);
  }

  // ---------- 纪念日：展示 ----------

  function cdLunarLabel(cd) {
    if (cd.calendar !== 'lunar' || !cd.lunarMonth || !cd.lunarDay) return '';
    if (isEn()) return String(cd.lunarMonth) + '/' + String(cd.lunarDay);
    return (cd.lunarLeap ? '闰' : '') + LUNAR_MONTH_NAMES[cd.lunarMonth - 1] + '月' + LUNAR_DAY_NAMES[cd.lunarDay - 1];
  }

  // 日期行：农历条目带上「农历 八月十五」，重复条目显示的是下一次的日期
  function cdDateLine(cd, key) {
    const target = key || cd.date;
    const y = String(new Date().getFullYear()) !== target.slice(0, 4) ? ' · ' + target.slice(0, 4) : '';
    const base = monthDay(target) + ' · ' + weekdayOf(target) + y;
    if (cd.calendar === 'lunar') return T('农历 {d}', { d: cdLunarLabel(cd) }) + ' · ' + base;
    return base;
  }

  function cdMetaChipsHTML(cd, cls) {
    const chips = [];
    if (cd.calendar === 'lunar') chips.push(T('农历 {d}', { d: cdLunarLabel(cd) }));
    if (cd.repeat === 'yearly') chips.push(T('每年'));
    else if (cd.repeat === 'monthly') chips.push(T('每月'));
    if (!chips.length) return '';
    return '<span class="' + cls + '">' + chips.map(function (t) {
      return '<span class="cd-chip">' + esc(t) + '</span>';
    }).join('') + '</span>';
  }

  function cdTodayView(cd, key) {
    return { num: T('今天'), unit: '', dir: T('今天'), label: T('就是今天'), sub: cdDateLine(cd, key), tone: 'today' };
  }

  function cdView(cd) {
    const todayK = todayKey();
    const startYear = cd.calendar === 'lunar' && cd.lunarYear ? cd.lunarYear : Number(cd.date.slice(0, 4));

    // 正数 + 每年：用「自某年以来 N 年」，周年按年计更贴语义；具体天数放在副行
    if (cd.direction === 'up' && cd.repeat === 'yearly' && cd.date <= todayK) {
      const years = cdElapsedYears(cd.date, todayK);
      const prev = cdPrevKey(cd) || cd.date;
      const since = cdDayDiff(prev, todayK);
      return {
        num: String(years),
        unit: isEn() ? 'yrs' : T('年'),
        dir: T('自 {y} 年以来', { y: startYear }),
        label: T('已经 {n} 年', { n: years }),
        sub: T('距上次 {n} 天', { n: since }),
        tone: 'up'
      };
    }
    // 正数 + 每月：按月重复，用「距上次 N 天」更直观
    if (cd.direction === 'up' && cd.repeat === 'monthly') {
      const prev = cdPrevKey(cd);
      if (prev) {
        const n = cdDayDiff(prev, todayK);
        if (n === 0) return cdTodayView(cd, prev);
        return {
          num: String(n), unit: T('天前'), dir: T('已经'),
          label: T('距上次 {n} 天', { n: n }), sub: cdDateLine(cd, prev), tone: 'up'
        };
      }
    }

    const next = cdNextKey(cd) || cd.date;
    const d = cdDayDiff(todayK, next);
    if (d === 0) return cdTodayView(cd, next);
    if (d > 0) {
      return { num: String(d), unit: T('天后'), dir: T('还有'), label: T('还有 {n} 天', { n: d }), sub: cdDateLine(cd, next), tone: 'down' };
    }
    // 倒数日过期：不消失，自动转成正数语义「已经 N 天」
    return { num: String(-d), unit: T('天前'), dir: T('已经'), label: T('已经 {n} 天', { n: -d }), sub: cdDateLine(cd, next), tone: 'up' };
  }

  // 日记页横滑卡片固定四行：标题 / 正倒数日期 / 设置日期 / 标签。
  // 高度由内容撑开，四行都不截断；横向滑动由 cd-strip 统一处理。
  function countdownCardHTML(cd) {
    const info = cdView(cd);
    const cat = getCategory(cd.categoryId);
    const catChip = cat
      ? '<span class="cd-card-cat" style="color:' + esc(cat.color) + '">' +
          categoryMarkHTML(cat, 'background:' + cat.color) + esc(cat.name) + '</span>'
      : '';
    return '<button class="cd-card' + (cd.pinned ? ' pinned' : '') + '" type="button" data-cd-open="' + cd.id +
      '" style="--cd-color:' + esc(cd.color) + '">' +
      '<span class="cd-card-top"><i class="cd-dot"></i><span class="cd-card-title">' + esc(cd.title) + '</span>' +
        (cd.pinned ? '<span class="cd-pin-mark">' + T('置顶') + '</span>' : '') +
      '</span>' +
      '<span class="cd-card-count">' + esc(info.label) + '</span>' +
      '<span class="cd-card-date">' + esc(cd.date) + '</span>' +
      '<span class="cd-card-tags">' + cdMetaChipsHTML(cd, 'cd-card-meta') + catChip + '</span>' +
    '</button>';
  }

  function renderCountdownStrip() {
    const box = $('#countdownCards');
    const strip = $('#countdownStrip');
    if (!box || !strip) return;
    // 日记页这条只做展示：一条都没有时整条隐藏，不占位
    if (!state.countdowns.length) {
      box.innerHTML = '';
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    box.innerHTML = state.countdowns.map(countdownCardHTML).join('');
  }

  function renderCountdownPage() {
    const body = $('#countdownListBody');
    if (!body) return;
    if (!state.countdowns.length) {
      body.innerHTML = '<div class="empty-state cd-empty">' +
        '<p class="empty-title">' + esc(T('还没有纪念日')) + '</p>' +
        '<p class="empty-sub">' + esc(T('新建一个，记住重要的日子。')) + '</p>' +
      '</div>';
      return;
    }
    body.innerHTML = '<div class="cd-list">' + state.countdowns.map(function (cd) {
      const info = cdView(cd);
      const cat = getCategory(cd.categoryId);
      const catChip = cat
        ? '<span class="cd-row-cat" style="color:' + esc(cat.color) + '">' +
            categoryMarkHTML(cat, 'background:' + cat.color) + esc(cat.name) + '</span>'
        : '';
      const nextKey = cdNextKey(cd) || cd.date;
      return '<div class="cd-row' + (cd.pinned ? ' pinned' : '') + '" data-cd-open="' + cd.id + '" style="--cd-color:' + esc(cd.color) + '">' +
        '<i class="cd-dot"></i>' +
        '<div class="cd-row-main">' +
          '<span class="cd-row-title">' + esc(cd.title) + '</span>' +
          '<span class="cd-row-sub">' + esc(cdDateLine(cd, nextKey)) + '</span>' +
          cdMetaChipsHTML(cd, 'cd-row-tags') +
          catChip +
        '</div>' +
        '<span class="cd-row-days">' +
          (info.unit ? '<b>' + esc(info.num) + '</b>' : '') +
          '<span class="cd-days-tag">' + esc(info.label) + '</span>' +
        '</span>' +
        '<button class="cd-pin-btn' + (cd.pinned ? ' active' : '') + '" type="button" data-cd-pin="' + cd.id +
          '" aria-pressed="' + (cd.pinned ? 'true' : 'false') + '" aria-label="' + esc(T('置顶')) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 4.6h7.2l-1 5 3.2 3.2H6.2l3.2-3.2z"/><path d="M12 12.8v6.2"/></svg>' +
        '</button>' +
      '</div>';
    }).join('') + '</div>';
  }

  function openCountdownPage() {
    renderCountdownPage();
    $('#countdownPage').hidden = false;
    requestAnimationFrame(function () { $('#countdownPage').classList.add('open'); });
  }

  function closeCountdownPage() {
    const page = $('#countdownPage');
    if (!page || page.hidden) return;
    closeCdPop();
    page.classList.remove('open');
    window.setTimeout(function () { page.hidden = true; }, 240);
  }

  function renderCdCats() {
    const box = $('#cdCats');
    if (!box) return;
    const current = $('#cdSheet').dataset.cat || '';
    let html = '<button class="cat-chip' + (current ? '' : ' active') + '" type="button" data-cd-cat="none">' +
      '<i style="--cat-dot:var(--muted)"></i>' + esc(T('未分类')) + '</button>';
    state.categories.forEach(function (cat) {
      const active = current === cat.id;
      html += '<button class="cat-chip' + (active ? ' active' : '') + '" type="button" data-cd-cat="' + cat.id +
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + ';color:' + cat.color + '">' +
        categoryMarkHTML(cat, '--chip-color:' + cat.color) + esc(cat.name) + '</button>';
    });
    box.innerHTML = html;
  }

  function renderCdSwatches() {
    const box = $('#cdSwatches');
    if (!box) return;
    const current = ($('#cdSheet').dataset.color || CD_COLORS[0]).toLowerCase();
    const custom = PRESET_COLORS.every(function (color) { return color.toLowerCase() !== current; });
    box.innerHTML = swatchesHTML(current, 'cd-color') +
      '<label class="swatch cd-custom-swatch' + (custom ? ' active' : '') + '" style="--sw:' + current + '" title="' + esc(T('自定义颜色')) + '">' +
        '<input type="color" id="cdCustomColor" value="' + current + '" aria-label="' + esc(T('自定义颜色')) + '">' +
      '</label>';
    $$('#cdSwatches .swatch').forEach(function (el) {
      if (el.classList.contains('cd-custom-swatch')) return;
      el.classList.toggle('active', String(el.dataset.cdColor || '').toLowerCase() === current);
    });
  }

  function cdDraftLunarOf(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null;
    const d = keyToDate(key);
    const y = d.getFullYear();
    if (y < CD_MIN_YEAR || y > CD_MAX_YEAR) return null;
    const l = solarToLunar(y, d.getMonth() + 1, d.getDate());
    return { year: l.year, month: l.month, day: l.day, isLeap: l.isLeap };
  }

  function cdDraftFromDate(key) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(key || '') ? key : todayKey();
    const l = cdDraftLunarOf(date) || cdDraftLunarOf(todayKey());
    return {
      calendar: 'solar',
      direction: 'down',
      repeat: 'none',
      date: date,
      lunarYear: l ? l.year : new Date().getFullYear(),
      lunarMonth: l ? l.month : 1,
      lunarDay: l ? l.day : 1,
      lunarLeap: false
    };
  }

  function renderCdChoices() {
    if (!cdDraft) return;
    $$('#cdCalSeg .seg-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.cdCal === cdDraft.calendar); });
    $$('#cdDirSeg .seg-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.cdDir === cdDraft.direction); });
    // 重复只在「倒数」时有意义：选正数整段隐藏，并且不写 repeat
    if (cdDraft.direction !== 'down') cdDraft.repeat = 'none';
    $$('#cdRepeatSeg .seg-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.cdRepeat === cdDraft.repeat); });
    // 农历没有「每月几号」这种稳定日期：直接禁用，避免存出无法解释的卡片
    const monthBtn = $('#cdRepeatSeg [data-cd-repeat="monthly"]');
    if (monthBtn) monthBtn.disabled = cdDraft.calendar === 'lunar';
    const repeatGroup = $('#cdRepeatGroup');
    if (repeatGroup) repeatGroup.hidden = cdDraft.direction !== 'down';
    const chip = $('#cdDateChip');
    if (chip) chip.hidden = cdDraft.calendar !== 'solar';
    const lunarField = $('#cdLunarField');
    if (lunarField) lunarField.hidden = cdDraft.calendar !== 'lunar';
  }

  function syncCdLunarHint() {
    const hint = $('#cdLunarHint');
    if (!hint || !cdDraft) return;
    const y = cdDraft.lunarYear;
    if (y < CD_MIN_YEAR || y > CD_MAX_YEAR) {
      hint.textContent = T('年份需在 1900–2100 之间');
      return;
    }
    let msg = '';
    // 陈述该年实际的闰月：有就说「该年闰X月」，没有就说「该年无闰月」。
    // 不再拿所选月份去问「有没有闰这个月」，那种句式既像报错又永远为假。
    const leapMonth = lunarLeapMonth(y);
    msg = leapMonth
      ? T('该年闰{r}月', { r: isEn() ? String(leapMonth) : LUNAR_MONTH_NAMES[leapMonth - 1] })
      : T('该年无闰月');
    const key = cdEffectiveKey();
    if (key) {
      const solar = T('公历 {d}', { d: monthDay(key) + ' ' + key.slice(0, 4) });
      msg = msg ? msg + ' · ' + solar : solar;
    }
    hint.textContent = msg;
  }

  function cdEffectiveKey() {
    if (!cdDraft) return '';
    if (cdDraft.calendar !== 'lunar') {
      return /^\d{4}-\d{2}-\d{2}$/.test(cdDraft.date) ? cdDraft.date : '';
    }
    const s = cdLunarSolar(cdDraft.lunarYear, cdDraft.lunarMonth, cdDraft.lunarDay, cdDraft.lunarLeap);
    return s ? s.key : '';
  }

  function syncCdDateFromDraft() {
    const key = cdEffectiveKey();
    const input = $('#cdDate');
    if (input && key) input.value = key;
    const label = $('#cdDateChipLabel');
    if (label && key) label.textContent = relativeDayLabel(key);
    const chip = $('#cdDateChip');
    if (chip) chip.classList.toggle('active', !!key);
    syncCdSave();
  }

  function cdWheelMaxDay(w) {
    const leap = w.leap && lunarLeapMonth(w.year) === w.month;
    return leap ? lunarLeapDays(w.year) : lunarMonthDays(w.year, w.month);
  }

  function cdWheelYearLabel(y) { return isEn() ? String(y) : (y + ' 年'); }
  function cdWheelMonthLabel(m) { return isEn() ? ('Month ' + m) : (LUNAR_MONTH_NAMES[m - 1] + '月'); }
  function cdWheelDayLabel(d) { return isEn() ? ('Day ' + d) : LUNAR_DAY_NAMES[d - 1]; }

  function renderCdLunarPickers() {
    if (!cdDraft) return;
    if (cdDraft.lunarYear < CD_MIN_YEAR || cdDraft.lunarYear > CD_MAX_YEAR) cdDraft.lunarYear = new Date().getFullYear();
    if (cdDraft.lunarMonth < 1 || cdDraft.lunarMonth > 12) cdDraft.lunarMonth = 1;

    const hasLeap = lunarLeapMonth(cdDraft.lunarYear) === cdDraft.lunarMonth;
    if (!hasLeap) cdDraft.lunarLeap = false;
    const maxDay = cdWheelMaxDay(cdDraft);
    if (cdDraft.lunarDay > maxDay) cdDraft.lunarDay = maxDay;
    if (cdDraft.lunarDay < 1) cdDraft.lunarDay = 1;

    const yt = $('#cdLunarYearText');
    const mt = $('#cdLunarMonthText');
    const dt = $('#cdLunarDayText');
    if (yt) yt.textContent = cdWheelYearLabel(cdDraft.lunarYear);
    if (mt) mt.textContent = cdWheelMonthLabel(cdDraft.lunarMonth);
    if (dt) dt.textContent = cdWheelDayLabel(cdDraft.lunarDay);

    // 闰月只在这一年确实有这个闰月时出现；没有闰月就只留一句小字提示
    const leapRow = $('#cdLeapRow');
    const leapBox = $('#cdLunarLeap');
    if (leapRow) leapRow.hidden = !hasLeap;
    if (leapBox) {
      leapBox.disabled = !hasLeap;
      leapBox.checked = hasLeap && !!cdDraft.lunarLeap;
    }

    syncCdLunarHint();
    syncCdDateFromDraft();
  }

  // ---------- 农历日期滚轮（复用 buildRegionWheel，与日期/时间选择器同一套） ----------

  function cdWheelHint() {
    const hint = $('#cdWheelHint');
    if (!hint || !cdWheelDraft) return;
    const s = cdLunarSolar(cdWheelDraft.year, cdWheelDraft.month, cdWheelDraft.day, cdWheelDraft.leap);
    hint.textContent = s
      ? T('公历 {d}', { d: monthDay(s.key) + ' ' + s.key.slice(0, 4) })
      : T('年份需在 1900–2100 之间');
  }

  function renderCdWheelSheet() {
    if (!cdWheelDraft) return;
    const w = cdWheelDraft;
    if (w.year < CD_MIN_YEAR || w.year > CD_MAX_YEAR) w.year = new Date().getFullYear();
    if (w.month < 1 || w.month > 12) w.month = 1;
    const hasLeap = lunarLeapMonth(w.year) === w.month;
    if (!hasLeap) w.leap = false;
    const maxDay = cdWheelMaxDay(w);
    if (w.day > maxDay) w.day = maxDay;
    if (w.day < 1) w.day = 1;

    const years = [];
    for (let y = CD_MIN_YEAR; y <= CD_MAX_YEAR; y++) years.push(cdWheelYearLabel(y));
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(cdWheelMonthLabel(m));
    const days = [];
    for (let d = 1; d <= maxDay; d++) days.push(cdWheelDayLabel(d));

    buildRegionWheel($('#cdWheelYear'), years, w.year - CD_MIN_YEAR, function (i) {
      w.year = CD_MIN_YEAR + i;
      w.leap = false;
      renderCdWheelSheet();
      haptic(4);
    });
    buildRegionWheel($('#cdWheelMonth'), months, w.month - 1, function (i) {
      w.month = i + 1;
      w.leap = false;
      renderCdWheelSheet();
      haptic(4);
    });
    buildRegionWheel($('#cdWheelDay'), days, w.day - 1, function (i) {
      w.day = i + 1;
      cdWheelHint();
      haptic(4);
    });

    const leapRow = $('#cdWheelLeapRow');
    const leapBox = $('#cdWheelLeap');
    if (leapRow) leapRow.hidden = !hasLeap;
    if (leapBox) {
      leapBox.disabled = !hasLeap;
      leapBox.checked = hasLeap && !!w.leap;
    }
    cdWheelHint();
  }

  function openCdWheelSheet() {
    if (!cdDraft || cdDraft.calendar !== 'lunar') return;
    cdWheelDraft = {
      year: cdDraft.lunarYear,
      month: cdDraft.lunarMonth,
      day: cdDraft.lunarDay,
      leap: !!cdDraft.lunarLeap
    };
    $('#cdWheelBackdrop').hidden = false;
    $('#cdWheelSheet').hidden = false;
    requestAnimationFrame(function () {
      $('#cdWheelBackdrop').classList.add('open');
      $('#cdWheelSheet').classList.add('open');
      renderCdWheelSheet();
    });
    haptic(6);
  }

  function closeCdWheelSheet() {
    $('#cdWheelSheet').classList.remove('open');
    $('#cdWheelBackdrop').classList.remove('open');
    cdWheelDraft = null;
    window.setTimeout(function () {
      if ($('#cdWheelSheet').classList.contains('open')) return;
      $('#cdWheelSheet').hidden = true;
      $('#cdWheelBackdrop').hidden = true;
    }, 220);
  }

  function confirmCdWheel() {
    if (cdDraft && cdWheelDraft) {
      cdDraft.lunarYear = cdWheelDraft.year;
      cdDraft.lunarMonth = cdWheelDraft.month;
      cdDraft.lunarDay = cdWheelDraft.day;
      cdDraft.lunarLeap = !!cdWheelDraft.leap && lunarLeapMonth(cdDraft.lunarYear) === cdDraft.lunarMonth;
      renderCdLunarPickers();
    }
    closeCdWheelSheet();
    haptic(10);
  }

  function syncCdDateChip() {
    if (!cdDraft) return;
    const key = (cdDateDraft && cdDateDraft.date) || cdDraft.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) cdDraft.date = key;
    syncCdDateFromDraft();
  }

  function openCdSheet(id) {
    const base = id ? state.countdowns.find(function (cd) { return cd.id === id; }) : null;
    cdEditingId = base ? base.id : '';
    $('#cdSheetTitle').textContent = base ? T('编辑纪念日') : T('新建纪念日');
    $('#cdTitle').value = base ? base.title : '';
    const date = base ? base.date : addDays(todayKey(), 30);
    cdDateDraft = { date: date, time: '' };
    if (base) {
      const auto = cdDraftLunarOf(base.date);
      cdDraft = {
        calendar: base.calendar === 'lunar' ? 'lunar' : 'solar',
        direction: base.direction === 'up' ? 'up' : 'down',
        repeat: CD_REPEATS.indexOf(base.repeat) !== -1 ? base.repeat : 'none',
        date: base.date,
        lunarYear: base.lunarYear || (auto ? auto.year : new Date().getFullYear()),
        lunarMonth: base.lunarMonth || (auto ? auto.month : 1),
        lunarDay: base.lunarDay || (auto ? auto.day : 1),
        lunarLeap: base.calendar === 'lunar' ? base.lunarLeap === true : false
      };
    } else {
      cdDraft = cdDraftFromDate(date);
    }
    $('#cdPinned').checked = base ? !!base.pinned : false;
    $('#cdSheet').dataset.color = base ? base.color : CD_COLORS[0];
    $('#cdSheet').dataset.cat = base && base.categoryId ? base.categoryId : '';
    $('#cdDelete').hidden = !base;
    renderCdChoices();
    renderCdLunarPickers();
    syncCdDateFromDraft();
    renderCdSwatches();
    renderCdCats();
    $('#cdBackdrop').hidden = false;
    $('#cdSheet').hidden = false;
    requestAnimationFrame(function () {
      $('#cdBackdrop').classList.add('open');
      $('#cdSheet').classList.add('open');
    });
    if (!base) setTimeout(function () { $('#cdTitle').focus(); }, 280);
  }

  function closeCdSheet() {
    $('#cdSheet').classList.remove('open');
    $('#cdBackdrop').classList.remove('open');
    cdEditingId = '';
    cdDraft = null;
    window.setTimeout(function () {
      if ($('#cdSheet').classList.contains('open')) return;
      $('#cdSheet').hidden = true;
      $('#cdBackdrop').hidden = true;
    }, 260);
  }

  function syncCdSave() {
    const titleOk = $('#cdTitle').value.trim().length > 0;
    const key = cdEffectiveKey();
    const dateOk = !!key && /^\d{4}-\d{2}-\d{2}$/.test(key);
    const y = dateOk ? Number(key.slice(0, 4)) : 0;
    $('#cdSave').disabled = !(titleOk && dateOk && y >= CD_MIN_YEAR && y <= CD_MAX_YEAR);
  }

  async function saveCountdown() {
    const title = $('#cdTitle').value.trim();
    if (!cdDraft) return;
    // 农历 + 每月在面板里已被禁用，这里再兜一层，避免旧状态带进来
    if (cdDraft.calendar === 'lunar' && cdDraft.repeat === 'monthly') cdDraft.repeat = 'none';
    const date = cdEffectiveKey();
    if (!title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(keyToDate(date).getTime())) {
      showToast(T('请填写名称和日期'));
      return;
    }
    const y = Number(date.slice(0, 4));
    if (y < CD_MIN_YEAR || y > CD_MAX_YEAR) {
      showToast(T('日期超出范围'));
      return;
    }
    const base = cdEditingId ? state.countdowns.find(function (cd) { return cd.id === cdEditingId; }) : null;
    const lunar = cdDraft.calendar === 'lunar';
    const entry = normalizeCountdown({
      id: base ? base.id : uid(),
      title: title,
      date: date,
      direction: cdDraft.direction,
      // 正数不写 repeat：重复只在倒数场景里有意义
      repeat: cdDraft.direction === 'down' ? cdDraft.repeat : 'none',
      calendar: cdDraft.calendar,
      lunarYear: lunar ? cdDraft.lunarYear : null,
      lunarMonth: lunar ? cdDraft.lunarMonth : null,
      lunarDay: lunar ? cdDraft.lunarDay : null,
      lunarLeap: lunar ? !!cdDraft.lunarLeap : false,
      color: $('#cdSheet').dataset.color || CD_COLORS[0],
      categoryId: getCategory($('#cdSheet').dataset.cat) ? $('#cdSheet').dataset.cat : null,
      pinned: $('#cdPinned').checked,
      // 新增的追加到最右，编辑时保持原位次
      order: base ? base.order : countdownNextOrder(),
      createdAt: base ? base.createdAt : Date.now(),
      updatedAt: Date.now()
    });
    if (!entry) return;
    if (base) state.countdowns[state.countdowns.indexOf(base)] = entry;
    else state.countdowns.push(entry);
    sortCountdowns();
    closeCdSheet();
    await persistCountdowns();
    renderCountdownStrip();
    if (!$('#countdownPage').hidden) renderCountdownPage();
    haptic(10);
    showToast(base ? T('纪念日已更新') : T('已添加纪念日'));
  }

  async function deleteCountdown(id) {
    const idx = state.countdowns.findIndex(function (cd) { return cd.id === id; });
    if (idx === -1) return;
    state.countdowns.splice(idx, 1);
    closeCdSheet();
    await persistCountdowns();
    renderCountdownStrip();
    renderCountdownPage();
    haptic(12);
    showToast(T('已删除纪念日'));
  }

  async function toggleCountdownPin(id) {
    const cd = state.countdowns.find(function (c) { return c.id === id; });
    if (!cd) return;
    cd.pinned = !cd.pinned;
    cd.updatedAt = Date.now();
    sortCountdowns();
    await persistCountdowns(true);
    renderCountdownStrip();
    renderCountdownPage();
    haptic(8);
  }

  // ---------- 倒数日：长按编辑/删除 + 按住拖动排序 ----------
  let cdPopId = '';
  let cdDrag = null;
  let cdDragEndAt = 0;
  const CD_DRAG_HOLD_MS = 300;
  const CD_DRAG_CANCEL_PX = 10;

  function openCdPop(id) {
    const row = document.querySelector('#countdownListBody [data-cd-open="' + id + '"]');
    const pop = $('#cdPop');
    if (!row || !pop) return;
    cdPopId = id;
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    const b = row.getBoundingClientRect();
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

  function closeCdPop() {
    const pop = $('#cdPop');
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    cdPopId = '';
  }

  function cdDragStart(e) {
    if (e.target.closest('[data-cd-pin]')) return;
    const row = e.target.closest('[data-cd-open]');
    if (!row) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cdDrag = {
      el: row,
      pointerId: e.pointerId,
      startY: e.clientY,
      lastX: e.clientX,
      dy: 0,
      active: false,
      moved: false,
      timer: 0
    };
    cdDrag.timer = setTimeout(function () {
      if (!cdDrag) return;
      cdDrag.active = true;
      cdDrag.el.classList.add('dragging');
      $('#countdownListBody').classList.add('dragging');
      closeCdPop();
      try { cdDrag.el.setPointerCapture(cdDrag.pointerId); } catch (err) { /* 忽略 */ }
      haptic(8);
    }, CD_DRAG_HOLD_MS);
  }

  function cdDragMove(e) {
    if (!cdDrag) return;
    const dy = e.clientY - cdDrag.startY;
    const dx = e.clientX - cdDrag.lastX;
    if (!cdDrag.active) {
      if (Math.abs(dy) > CD_DRAG_CANCEL_PX || Math.abs(dx) > CD_DRAG_CANCEL_PX) {
        clearTimeout(cdDrag.timer);
        cdDrag = null;
      }
      return;
    }
    e.preventDefault();
    cdDrag.moved = true;
    const el = cdDrag.el;
    const oldDy = cdDrag.dy;
    cdDrag.dy = dy;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const target = under ? under.closest('[data-cd-open]') : null;
    if (target && target !== el) {
      const box = el.parentNode;
      const before = new Map();
      $$('[data-cd-open]', box).forEach(function (r) { before.set(r, r.getBoundingClientRect().top); });
      const layoutTop = el.getBoundingClientRect().top - oldDy;
      const r = target.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) box.insertBefore(el, target.nextSibling);
      else box.insertBefore(el, target);
      const newLayoutTop = el.getBoundingClientRect().top - oldDy;
      cdDrag.dy -= (newLayoutTop - layoutTop);
      $$('[data-cd-open]', box).forEach(function (other) {
        if (other === el) return;
        const shift = (before.get(other) || 0) - other.getBoundingClientRect().top;
        if (!shift) return;
        other.style.transition = 'none';
        other.style.transform = 'translateY(' + shift + 'px)';
        requestAnimationFrame(function () {
          other.style.transition = 'transform .17s ease';
          other.style.transform = '';
        });
        setTimeout(function () { other.style.transition = ''; }, 220);
      });
    }
    el.style.transform = 'translateY(' + cdDrag.dy + 'px)';
    cdDrag.lastX = e.clientX;
  }

  async function cdDragEnd() {
    if (!cdDrag) return;
    clearTimeout(cdDrag.timer);
    const drag = cdDrag;
    cdDrag = null;
    drag.el.classList.remove('dragging');
    drag.el.style.transform = '';
    $('#countdownListBody').classList.remove('dragging');
    if (!drag.active) return;
    cdDragEndAt = Date.now();
    closeCdPop();
    // 按住不动就松手：当作长按，弹出编辑/删除
    if (!drag.moved) {
      openCdPop(drag.el.dataset.cdOpen);
      return;
    }
    const ids = $$('[data-cd-open]', $('#countdownListBody')).map(function (el) { return el.dataset.cdOpen; });
    ids.forEach(function (id, i) {
      const cd = state.countdowns.find(function (c) { return c.id === id; });
      if (cd) cd.order = i;
    });
    sortCountdowns();
    await persistCountdowns(true);
    renderCountdownStrip();
    renderCountdownPage();
    haptic(8);
  }

  // ==================== 渲染：自定义情绪 ====================

  let moodPopId = '';
  let moodDrag = null;
  let moodDragEndAt = 0;
  const MOOD_DRAG_HOLD_MS = 260;
  const MOOD_DRAG_CANCEL_PX = 10;

  function renderMoodPage() {
    const list = $('#moodList');
    if (!list) return;
    const customs = customMoods();
    if (!customs.length) {
      list.innerHTML = '<div class="empty-state">' +
        '<p class="empty-title">' + esc(T('还没有自定义情绪')) + '</p>' +
        '<p class="empty-sub">' + esc(T('点右上角新建，给情绪起个自己的名字。')) + '</p>' +
      '</div>';
      return;
    }
    list.innerHTML = customs.map(function (m) {
      const glyph = MOOD_GLYPH_BY_ID[m.glyph] || MOOD_GLYPH_BY_ID.happy;
      return '<div class="mood-row" data-mood-row="' + m.id + '" style="--mood-color:' + esc(m.color) + '">' +
        '<svg class="mood-row-face" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/>' + glyph.face + '</svg>' +
        '<span class="mood-row-name">' + esc(m.name) + '</span>' +
        '<span class="mood-row-grip" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 9h8M8 12.5h8M8 16h8"/></svg></span>' +
      '</div>';
    }).join('');
  }

  function openTripTagsPage(raised) {
    const page = $('#tripTagsPage');
    renderCategoryList();
    // 从「新建条目/新建计划」跳进来时抬到日记写作页/计划面板之上
    page.classList.toggle('raised', !!raised);
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
  }

  function closeTripTagsPage() {
    const page = $('#tripTagsPage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    window.setTimeout(function () {
      if (page.classList.contains('open')) return;
      page.hidden = true;
      page.classList.remove('raised');
    }, 240);
  }

  function openMoodPage(raised) {
    const page = $('#moodPage');
    renderMoodPage();
    // 日记写作页里点「自定义」跳过来时，必须盖在写作页之上
    page.classList.toggle('raised', !!raised);
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
  }

  function closeMoodPage() {
    const page = $('#moodPage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    window.setTimeout(function () {
      if (page.classList.contains('open')) return;
      page.hidden = true;
      page.classList.remove('raised');
    }, 240);
  }

  function validateMoodName(name, excludeId) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return T('请填写情绪名称');
    if (trimmed.length > 12) return T('名称最多 12 个字');
    const taken = DIARY_MOODS.some(function (m) { return m.zh === trimmed || m.en === trimmed; }) ||
      customMoods().some(function (m) { return m.id !== excludeId && m.name === trimmed; });
    if (taken) return T('这个名称已经用过了');
    return '';
  }

  let moodEditingId = '';

  function openMoodEditor(id) {
    const base = id ? customMoods().find(function (m) { return m.id === id; }) : null;
    moodEditingId = base ? base.id : '';
    openModal({
      kind: base ? 'mood-edit' : 'mood-create',
      title: base ? T('编辑情绪') : T('新建情绪'),
      field: true,
      iconMode: 'mood',
      name: base ? base.name : '',
      color: base ? base.color : CD_COLORS[0],
      icon: base ? base.glyph : 'happy',
      confirmText: T('保存')
    });
  }

  async function saveMood(id, name, color, glyph) {
    const list = customMoods().slice();
    if (id) {
      const item = list.find(function (m) { return m.id === id; });
      if (item) {
        item.name = name;
        item.color = color;
        item.glyph = glyph;
      }
    } else {
      list.push({
        id: 'cm-' + uid(),
        name: name,
        color: color,
        glyph: glyph,
        createdAt: Date.now()
      });
    }
    state.meta.moods = list;
    await persistMeta();
    renderMoodPage();
    if (state.diaryDraft) renderDiaryMoods();
    haptic(10);
    showToast(id ? T('情绪已更新') : T('已添加情绪'));
  }

  async function deleteMood(id) {
    const list = customMoods().filter(function (m) { return m.id !== id; });
    state.meta.moods = list;
    await persistMeta();
    // 删掉情绪后，把引用它的日记清空心情，避免留下无主 id
    let diaryChanged = false;
    state.diary.forEach(function (entry) {
      if (entry.mood === id) { entry.mood = ''; diaryChanged = true; }
    });
    if (diaryChanged) await persistDiary(true);
    closeMoodPage();
    renderMoodPage();
    if (state.diaryDraft) renderDiaryMoods();
    haptic(12);
    showToast(T('已删除情绪'));
  }

  function openMoodPop(id) {
    const row = document.querySelector('[data-mood-row="' + id + '"]');
    const pop = $('#moodPop');
    if (!row || !pop) return;
    moodPopId = id;
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    const b = row.getBoundingClientRect();
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

  function closeMoodPop() {
    const pop = $('#moodPop');
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    moodPopId = '';
  }

  function moodDragStart(e) {
    const row = e.target.closest('[data-mood-row]');
    if (!row) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    moodDrag = {
      el: row,
      pointerId: e.pointerId,
      startY: e.clientY,
      lastX: e.clientX,
      dy: 0,
      active: false,
      timer: 0
    };
    moodDrag.timer = setTimeout(function () {
      if (!moodDrag) return;
      moodDrag.active = true;
      moodDrag.el.classList.add('dragging');
      $('#moodList').classList.add('dragging');
      closeMoodPop();
      try { moodDrag.el.setPointerCapture(moodDrag.pointerId); } catch (err) { /* 忽略 */ }
      haptic(8);
    }, MOOD_DRAG_HOLD_MS);
  }

  function moodDragMove(e) {
    if (!moodDrag) return;
    const dy = e.clientY - moodDrag.startY;
    const dx = e.clientX - moodDrag.lastX;
    if (!moodDrag.active) {
      if (Math.abs(dy) > MOOD_DRAG_CANCEL_PX || Math.abs(dx) > MOOD_DRAG_CANCEL_PX) {
        clearTimeout(moodDrag.timer);
        moodDrag = null;
      }
      return;
    }
    e.preventDefault();
    const el = moodDrag.el;
    const oldDy = moodDrag.dy;
    moodDrag.dy = dy;
    // 拖动中的行不接收命中，才能用它下面的行判断落点
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const target = under ? under.closest('[data-mood-row]') : null;
    if (target && target !== el) {
      const box = el.parentNode;
      const before = new Map();
      $$('[data-mood-row]', box).forEach(function (r) { before.set(r, r.getBoundingClientRect().top); });
      const layoutTop = el.getBoundingClientRect().top - oldDy;
      const r = target.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) box.insertBefore(el, target.nextSibling);
      else box.insertBefore(el, target);
      const newLayoutTop = el.getBoundingClientRect().top - oldDy;
      moodDrag.dy -= (newLayoutTop - layoutTop);
      $$('[data-mood-row]', box).forEach(function (other) {
        if (other === el) return;
        const shift = (before.get(other) || 0) - other.getBoundingClientRect().top;
        if (!shift) return;
        other.style.transition = 'none';
        other.style.transform = 'translateY(' + shift + 'px)';
        requestAnimationFrame(function () {
          other.style.transition = 'transform .17s ease';
          other.style.transform = '';
        });
        setTimeout(function () { other.style.transition = ''; }, 220);
      });
    }
    el.style.transform = 'translateY(' + moodDrag.dy + 'px)';
    moodDrag.lastX = e.clientX;
  }

  async function moodDragEnd() {
    if (!moodDrag) return;
    clearTimeout(moodDrag.timer);
    const drag = moodDrag;
    moodDrag = null;
    drag.el.classList.remove('dragging');
    drag.el.style.transform = '';
    $('#moodList').classList.remove('dragging');
    if (!drag.active) return;
    moodDragEndAt = Date.now();
    const ids = $$('[data-mood-row]', $('#moodList')).map(function (el) { return el.dataset.moodRow; });
    const list = customMoods().slice().sort(function (a, b) {
      return ids.indexOf(a.id) - ids.indexOf(b.id);
    });
    state.meta.moods = list;
    await persistMeta();
    renderMoodPage();
    if (state.diaryDraft) renderDiaryMoods();
    haptic(8);
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
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + ';color:' + cat.color + '">' +
        categoryMarkHTML(cat, '--chip-color:' + cat.color) + esc(cat.name) + '</button>';
    });

    html += '<button class="cat-manage-chip" id="manageCategoryBtn" type="button">+ 管理标签</button>';
    box.innerHTML = html;
  }

  function renderCategoryList() {
    const list = $('#categoryList');
    if (!list) return;
    if (!state.categories.length) {
      list.innerHTML = '<div class="empty-state">' +
        '<p class="empty-title">' + esc(T('还没有分类标签')) + '</p>' +
        '<p class="empty-sub">' + esc(T('点右上角新建，给安排分个类。')) + '</p>' +
      '</div>';
      return;
    }
    // 与「情绪标签」同一套行结构与样式：图标保持中性，只有名称用标签色
    list.innerHTML = state.categories.map(function (cat) {
      const count = countByCategory(cat.id);
      const mark = categoryGlyphHTML(cat) || '<i class="cat-mini-dot" style="background:' + esc(cat.color) + '"></i>';
      return '<div class="mood-row" data-cat-row="' + cat.id + '" style="--mood-color:' + esc(cat.color) + '">' +
        '<span class="mood-row-face cat-row-mark">' + mark + '</span>' +
        '<span class="mood-row-name">' + esc(cat.name) + '</span>' +
        (count ? '<span class="cat-count">' + count + '</span>' : '') +
        '<span class="mood-row-grip" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 9h8M8 12.5h8M8 16h8"/></svg></span>' +
      '</div>';
    }).join('');
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
  let modalIconMode = 'cat';
  let modalPickerOpen = false;
  let modalPickerDrag = '';
  let modalHsv = hexToHsv(PRESET_COLORS[0]);
  const modalState = { kind: '', onConfirm: null, onCancel: null };

  function isPresetColor(color) {
    const c = String(color || '').toLowerCase();
    return PRESET_COLORS.some(function (p) { return p.toLowerCase() === c; });
  }

  function tintModalIcons() {
    // 图标只保留中性色；「默认色点」是色块而非图标，跟随所选颜色
    const box = $('#modalIcons');
    const dot = box && box.querySelector('[data-icon=""] .dot');
    if (dot) dot.style.background = modalColor;
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
    if (modalIconMode === 'mood') {
      box.innerHTML = MOOD_GLYPHS.map(function (glyph) {
        return '<button type="button" class="cat-icon-btn' + (modalIcon === glyph.id ? ' active' : '') +
          '" data-icon="' + glyph.id + '" aria-label="' + esc(glyph.id) + '">' +
          '<span class="cat-glyph" style="color:' + modalColor + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/>' + glyph.face + '</svg>' +
          '</span></button>';
      }).join('');
      return;
    }
    let html = '<button type="button" class="cat-icon-btn' + (modalIcon ? '' : ' active') +
      '" data-icon="" aria-label="' + esc(T('默认色点')) + '"><i class="dot" style="background:' + modalColor + '"></i></button>';
    CATEGORY_ICONS.forEach(function (icon) {
      html += '<button type="button" class="cat-icon-btn' + (modalIcon === icon.id ? ' active' : '') +
        '" data-icon="' + icon.id + '" aria-label="' + esc(isEn() ? icon.en : icon.zh) + '">' +
        '<span class="cat-glyph">' + categorySvg(icon.svg, icon.id) + '</span></button>';
    });
    box.innerHTML = html;
  }

  function openModal(cfg) {
    modalState.kind = cfg.kind || '';
    modalState.onConfirm = cfg.onConfirm || null;
    modalState.onCancel = cfg.onCancel || null;
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
      $('#modalInput').maxLength = cfg.iconMode === 'mood' ? 12 : 20;
      modalColor = isHexColor(cfg.color) ? cfg.color : PRESET_COLORS[0];
      modalIconMode = cfg.iconMode === 'mood' ? 'mood' : 'cat';
      if (modalIconMode === 'mood') {
        modalIcon = cfg.icon && MOOD_GLYPH_BY_ID[cfg.icon] ? cfg.icon : 'happy';
      } else {
        modalIcon = cfg.icon && CATEGORY_ICON_BY_ID[cfg.icon] ? cfg.icon : null;
      }
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
    modalState.onCancel = null;
    modalState.kind = '';
    card.classList.remove('open');
    back.classList.remove('open');
    setTimeout(function () {
      card.hidden = true;
      back.hidden = true;
    }, 180);
  }

  function cancelModal() {
    const fn = modalState.onCancel;
    closeModal();
    if (fn) fn();
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
    if (modalState.kind === 'mood-create' || modalState.kind === 'mood-edit') {
      const name = $('#modalInput').value;
      const excludeId = modalState.kind === 'mood-edit' ? moodEditingId : null;
      const err = validateMoodName(name, excludeId);
      if (err) {
        $('#modalHint').textContent = err;
        return;
      }
      const kind = modalState.kind;
      const editId = moodEditingId;
      const color = modalColor;
      const glyph = modalIcon || 'happy';
      const trimmed = name.trim();
      closeModal();
      await saveMood(kind === 'mood-edit' ? editId : '', trimmed, color, glyph);
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
    const bubble = document.querySelector('[data-cat-row="' + id + '"]');
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
    return el ? el.closest('[data-cat-row]') : null;
  }

  function catDragStart(e) {
    const bubble = e.target.closest('[data-cat-row]');
    if (!bubble) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    catDrag = {
      id: bubble.dataset.catRow,
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
    if (!target || target === catDrag.el) return;
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
    const ids = $$('#categoryList [data-cat-row]').map(function (b) {
      return b.dataset.catRow;
    });
    let changed = false;
    ids.forEach(function (id, i) {
      const cat = getCategory(id);
      if (cat && cat.order !== i) { cat.order = i; changed = true; }
    });
    // 关键：order 只是字段，数组本身没按 order 重排时，
    // renderCategoryList 仍按旧数组顺序渲染 → 看起来「松手回到原处」。
    if (changed) sortCategories();
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
    if (e.target.closest('.check, [data-plan-edit], [data-plan-del], [data-plan-check]')) return;
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
    // 个人页只做设置类操作，不需要新建条目
    document.body.classList.toggle('profile-view', state.view === 'profile');
    // 双保险：属性 hidden 的优先级最高，避免样式被其它规则覆盖
    $('#fab').hidden = state.view === 'profile';
    updateTopbar();
    renderSummary();
    if (state.view === 'calendar') renderCalendar();
    if (state.view === 'plan') renderPlan();
    if (state.view === 'schedule') renderSchedule();
    if (state.view === 'diary') renderDiary();
    if (state.view === 'profile') renderProfile();
    renderSettings();
    renderBatchBar();
    // 统一悬浮横幅：五个主界面（日历 / 计划 / 行程表 / 日记 / 更多）共用一套判定
    renderSmartTip();
    // 「全部安排」是全屏覆盖层，数据变化时同步重绘
    if (agendaPageOpen()) renderAgenda();
    // 日记编辑页是独立的覆盖层，不随视图重绘，但"写今天/续写今天"要跟着日期与数据变
    syncDiaryWriteButton();
  }

  function agendaPageOpen() {
    const page = $('#agendaPage');
    return !!page && !page.hidden;
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
    $('#viewPlan').hidden = view !== 'plan';
    $('#viewSchedule').hidden = view !== 'schedule';
    $('#viewDiary').hidden = view !== 'diary';
    $('#viewProfile').hidden = view !== 'profile';
    // 更多页的深浅色开关已移入「外观」分组；右上角图标在这页隐藏但保留占位，
    // 保证五个页面的右侧图标右边距完全一致
    const themeBtn = $('#themeBtn');
    if (themeBtn) {
      themeBtn.hidden = false;
      themeBtn.classList.toggle('ghost', view === 'profile');
      themeBtn.toggleAttribute('aria-hidden', view === 'profile');
    }
    $('#content').scrollTop = 0;
    // 离开日历视图时收起年历，避免回来时还停在年历
    if (view !== 'calendar') closeYearView();
    // 切换视图时退出批量模式并清空已选
    if (state.batchMode) clearBatchState();
    // 进入日记页时也先尝试拉一次最新天气；失败/超时静默保留缓存
    if (view === 'diary' && weatherEnabled() && window.Weather) refreshWeather(true);
    renderAll();
  }

  // 「全部安排」：原议程页降级为日历页内的全屏流式入口，能力（连续历史/未来 + 分类筛选）完整保留
  function openAgenda(anchor, opts) {
    state.agendaAnchor = anchor || state.agendaAnchor || todayKey();
    // 默认只显示当天，由纵向手势再逐步加载历史 / 未来
    state.agendaBack = 0;
    state.agendaFwd = 0;
    state.agendaLoading = '';
    // 只有从汇总条进入时才按「未完成」口径精简今天的时间线
    agendaPendingOnly = !!(opts && opts.pendingOnly);
    // 每次打开都从全量开始，清掉上次的搜索词
    agendaSearchQuery = '';
    const searchInput = $('#agendaSearch');
    if (searchInput) searchInput.value = '';
    const searchClear = $('#agendaSearchClear');
    if (searchClear) searchClear.hidden = true;
    const page = $('#agendaPage');
    page.hidden = false;
    document.body.classList.add('agenda-open');
    renderAgenda();
    requestAnimationFrame(function () {
      page.classList.add('open');
      agendaScrollTo(state.agendaAnchor, false);
    });
  }

  function closeAgenda() {
    const page = $('#agendaPage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    document.body.classList.remove('agenda-open');
    window.setTimeout(function () { page.hidden = true; }, 260);
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
    const btn = $('#themeBtn');
    if (btn) {
      // 浅色显示太阳（点了去深色），深色显示月牙（点了回浅色）
      btn.setAttribute('aria-label', dark ? T('切换到浅色模式') : T('切换到深色模式'));
      btn.setAttribute('title', dark ? T('切换到浅色模式') : T('切换到深色模式'));
    }
    applyCardStyle();
    // 更多页「外观」里的开关与右上角图标共用同一份 meta.theme，这里统一回写
    const darkToggle = $('#profileDarkToggle');
    if (darkToggle) darkToggle.checked = dark;
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
    if (dateSheet.target === 'countdown') {
      $('#cdDate').value = activeDateDraft().date;
      syncCdDateChip();
      return;
    }
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
  //   标题（最重要）→ 日期时间 / 分类（主信息）→ 地址 → 备注（在 body 外）
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
    // 分类一栏带图标；未设置图标时只显示名称，不留空白
    const catCell = cat
      ? (categoryGlyphHTML(cat) + '<span style="color:' + cat.color + '">' + esc(cat.name) + '</span>')
      : esc(T('未分类'));
    const rows = [
      ['日期时间', monthDay(inst.date) + ' · ' + weekdayOf(inst.date) + ' · ' + (inst.time || T('全天'))],
      ['分类', catCell, 'html']
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
    const catCell = cat
      ? (categoryGlyphHTML(cat) + '<span style="color:' + cat.color + '">' + esc(cat.name) + '</span>')
      : esc(T('未分类'));
    const rows = [
      ['周期', planPeriodLabel(plan.kind, plan.periodStart)],
      ['时间', plan.time || T('全天')],
      ['分类', catCell, 'html']
    ];
    const foldRows = [
      ['类型', T(PLAN_KINDS[plan.kind])],
      ['优先级', plan.priority === 'high' ? T('高优先级') : T('普通')]
    ];

    // 进度型计划在详情里给「记一次 / 撤销一次 / 重置」，卡面点错了也有退路
    const p = planProgress(plan);
    let progressHTML = '';
    if (p.target > 1) {
      progressHTML = '<div class="pd-progress">' +
        '<div class="pd-head"><span class="pd-title">' + esc(T('进度')) + '</span></div>' +
        '<div class="pd-visual">' + planProgressVisualHTML(p, plan) + '</div>' +
        '<div class="pd-actions">' +
          '<button class="pd-btn" type="button" data-plan-minus="' + plan.id + '"' +
            (p.count ? '' : ' disabled') + '>' + esc(T('撤销一次')) + '</button>' +
          '<button class="pd-btn primary" type="button" data-plan-plus="' + plan.id + '"' +
            (p.done ? ' disabled' : '') + '>' + esc(T('记一次')) + '</button>' +
          '<button class="pd-btn ghost" type="button" data-plan-reset="' + plan.id + '">' + esc(T('重置')) + '</button>' +
        '</div>' +
      '</div>';
    }

    showDetailSheet(detailRowsHTML({
      title: plan.title,
      badge: T(PLAN_KINDS[plan.kind]),
      rows: rows,
      foldRows: foldRows,
      address: plan.address
    }) + progressHTML, plan.note);
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
    if (agendaPageOpen() && state.agendaAnchor) return keyToDate(state.agendaAnchor);
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
    state.month = new Date(year, month - 1, 1);
    state.selectedDate = key;
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
    revealDayDetail();
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
  let cdDateDraft = null;
  const DP_ITEM_H = 40;

  // 日期面板既服务条目，也服务计划与倒数日；对外只暴露当前正在编辑的对象
  function activeDateDraft() {
    if (dateSheet.target === 'countdown') {
      if (!cdDateDraft) cdDateDraft = { date: todayKey(), time: '' };
      return cdDateDraft;
    }
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
    const selected = activeDateDraft().date || t;
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
    bindDpWheelDrag(el);
  }

  // 日期面板的滚轮只有原生滚动，没有拖动绑定；这里补一套指针拖动，
  // 拖动时临时关掉 scroll-snap，松手再吸附到最近的刻度。
  function bindDpWheelDrag(el) {
    if (!el || el.dataset.dragBound === '1') return;
    el.dataset.dragBound = '1';
    let startY = 0;
    let startTop = 0;
    let moved = false;

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startY = e.clientY;
      startTop = el.scrollTop;
      moved = true;
      el.classList.add('dragging');
      el.style.scrollSnapType = 'none';
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    el.addEventListener('pointermove', function (e) {
      if (!moved) return;
      if (e.cancelable) e.preventDefault();
      el.scrollTop = startTop - (e.clientY - startY);
    });

    function end(e) {
      if (!moved) return;
      moved = false;
      el.classList.remove('dragging');
      el.style.scrollSnapType = '';
      const max = Math.max(0, el.children.length - 2);
      const idx = Math.max(0, Math.min(max, Math.round(el.scrollTop / DP_ITEM_H)));
      el.scrollTo({ top: idx * DP_ITEM_H, behavior: 'smooth' });
      markDpWheel(el);
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
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
    dateSheet.target = target === 'plan' ? 'plan' : (target === 'countdown' ? 'countdown' : 'item');
    if (dateSheet.target === 'countdown') {
      cdDateDraft = { date: $('#cdDate').value || addDays(todayKey(), 30), time: '' };
    }
    const subject = activeDateDraft();
    const key = subject.date || todayKey();
    const d = keyToDate(key);
    dateSheet.year = d.getFullYear();
    dateSheet.month = d.getMonth();
    // 倒数日只关心日期，隐藏时间分组，避免出现「不设时间」
    const timeWrap = $('#dateSheet').querySelector('.dp-time');
    if (timeWrap) timeWrap.hidden = dateSheet.target === 'countdown';
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
    draft.date = preset || (agendaPageOpen() && anchor >= t ? anchor : t);
    // 新建条目默认用当前设备时间，与时间滚轮的默认位置一致
    const nowClock = new Date();
    draft.time = pad2(nowClock.getHours()) + ':' + pad2(nowClock.getMinutes());

    // 只筛了一个分类时，新条目默认归到它，省一步
    draft.categoryId = agendaPageOpen() && state.agendaFilters.length === 1 &&
      getCategory(state.agendaFilters[0]) ? state.agendaFilters[0] : null;
    draft.recurrence = null;
    draft.note = '';
    draft.address = null;
    draft.priority = false;

    $('#itemTitle').value = '';
    $('#noteInput').value = '';
    $('#saveBtn').disabled = true;
    autoGrowNote();

    const body = $('#sheetBody');
    if (body) body.scrollTop = 0;
    dateSheet.target = 'item';
    syncTypeChips();
    syncDateChip();
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
    draft.priority = base.priority === 'high';

    $('#sheetTitle').textContent = T('编辑条目');
    $('#saveBtn').textContent = T('保存修改');
    $('#itemTitle').value = base.title;
    $('#noteInput').value = base.note || '';
    $('#saveBtn').disabled = false;
    autoGrowNote();

    const body = $('#sheetBody');
    if (body) body.scrollTop = 0;
    dateSheet.target = 'item';
    syncTypeChips();
    syncDateChip();
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

    if (agendaPageOpen()) state.agendaAnchor = item.date;
    renderAll();
    if (!ok) showToast(T('保存失败：未能写入本机'));
    else if (base) showToast(T('已保存修改：{title}', { title: shorten(item.title, 14) }));
    else showToast(T('已添加：{title}', { title: shorten(item.title, 18) }));
  }

  // ==================== 添加计划面板（与日程独立） ====================

  const planDraft = {
    kind: 'week',
    date: '',
    time: null,
    categoryId: null,
    address: null,
    priority: false,
    target: 1,
    progressStyle: 'bar'
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

  function syncPlanPriorityChip() {
    const el = $('#planPriorityChip');
    if (!el) return;
    setChipText(el, planDraft.priority ? T('高优先级') : T('优先级'));
    el.classList.toggle('active', planDraft.priority);
    el.classList.toggle('high', planDraft.priority);
  }

  function clampTarget(value) {
    const n = Math.round(Number(value));
    if (!isFinite(n) || n < 1) return 1;
    return Math.min(n, PLAN_TARGET_MAX);
  }

  function syncPlanTarget(value) {
    if (value !== undefined) planDraft.target = clampTarget(value);
    const input = $('#planTarget');
    if (input) input.value = String(planDraft.target);
  }

  // 每条计划自己的进度视觉；缺省回落进度条
  function syncPlanStyleOpts() {
    const box = $('#planStyleOpts');
    if (!box) return;
    $$('.plan-style-opt', box).forEach(function (btn) {
      const active = btn.dataset.planStyle === planStyleOf(planDraft.progressStyle);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
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
        '" style="--chip-color:' + cat.color + ';--chip-soft:' + hexToRgba(cat.color, 0.12) + ';color:' + cat.color + '">' +
        categoryMarkHTML(cat, '--cat-dot:' + cat.color) + esc(cat.name) + '</button>';
    });
    html += '<button class="cat-manage-chip" type="button" data-plan-manage>+ 管理标签</button>';
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
    planDraft.priority = false;
    planDraft.target = 1;
    planDraft.progressStyle = 'bar';

    $('#planTitle').value = '';
    $('#planNote').value = '';
    $('#planSave').disabled = true;
    syncPlanTarget(1);
    syncPlanStyleOpts();
    autoGrowPlanNote();

    syncPlanKindChips();
    syncPlanDateChip();
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
    planDraft.priority = base.priority === 'high';
    planDraft.target = planProgress(base).target;
    planDraft.progressStyle = planStyleOf(base.progressStyle);

    $('#planSheetTitle').textContent = T('编辑计划');
    $('#planSave').textContent = T('保存修改');
    $('#planTitle').value = base.title;
    $('#planNote').value = base.note || '';
    $('#planSave').disabled = false;
    syncPlanTarget(planDraft.target);
    syncPlanStyleOpts();
    autoGrowPlanNote();

    syncPlanKindChips();
    syncPlanDateChip();
    syncPlanPriorityChip();
    syncAddressChips();
    renderPlanCategoryChips();

    clearTimeout(planCloseTimer);
    // 历史计划页的层级是 50，编辑面板必须抬到页面之上才点得到
    $('#planBackdrop').classList.add('above-page');
    $('#planSheet').classList.add('above-page');
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
    $('#planSheet').classList.remove('above-page');
    $('#planBackdrop').classList.remove('above-page');
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
    const base = state.planEditingId ? state.plans.find(function (p) { return p.id === state.planEditingId; }) : null;
    const nextStart = planPeriodStart(planDraft.kind, date);
    // 历史计划改了周期就可能离开原分组（甚至回到当前周期），保存后要明确告知
    const periodChanged = !!base && (base.kind !== planDraft.kind || base.periodStart !== nextStart);

    const plan = normalizePlan({
      id: base ? base.id : uid(),
      kind: planDraft.kind,
      title: title,
      periodStart: nextStart,
      time: planDraft.time || null,
      priority: planDraft.priority ? 'high' : 'normal',
      categoryId: getCategory(planDraft.categoryId) ? planDraft.categoryId : null,
      note: $('#planNote').value.slice(0, 500),
      address: planDraft.address,
      // 目标次数可改；已完成次数保留，但不能超过新目标
      target: clampTarget($('#planTarget').value || planDraft.target),
      count: base ? Math.min(planProgress(base).count, clampTarget($('#planTarget').value || planDraft.target)) : 0,
      progressStyle: planStyleOf(planDraft.progressStyle),
      done: false,
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
    if (!$('#planHistoryPage').hidden) renderPlanHistory();
    if (!ok) showToast(T('保存失败：未能写入本机'));
    else if (base) {
      showToast(periodChanged
        ? T('周期已变更，计划已移到 {period}', { period: planPeriodLabel(plan.kind, plan.periodStart) })
        : T('已保存修改：{title}', { title: shorten(plan.title, 14) }));
    }
    else showToast(T('已添加{kind}：{title}', { kind: T(PLAN_KINDS[plan.kind]), title: shorten(plan.title, 16) }));
  }

  async function togglePlanDone(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    const p = planProgress(plan);
    // 一次性计划（目标 = 1）：保持原来的勾选/取消语义
    if (p.target <= 1) {
      plan.count = p.done ? 0 : 1;
      plan.done = !p.done;
      plan.doneAt = plan.done ? Date.now() : null;
      plan.updatedAt = Date.now();
      await persistPlans();
      // 原地刷新这一条与卡头进度，不重建整张列表
      paintPlanRow(plan);
      refreshPlanRing(plan.kind);
      reorderPlanRow(plan);
      haptic(10);
      if (plan.done) showToast(T('已完成 · {title}', { title: shorten(plan.title, 16) }), 1400);
      return;
    }
    await incrementPlan(id);
  }

  // 点一次 = 记一次完成：先动数据与卡面，落盘在后台进行，避免等 IO 卡住手感
  async function incrementPlan(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    const p = planProgress(plan);
    if (p.done) {
      haptic(6);
      showToast(T('目标已达成，可在计划详情里重置'), 1600);
      return;
    }
    plan.count = p.count + 1;
    plan.updatedAt = Date.now();
    if (plan.count >= p.target) {
      plan.done = true;
      plan.doneAt = Date.now();
    }
    haptic(plan.done ? 16 : 9);
    bumpPlanDom(plan);
    paintPlanRow(plan);
    refreshPlanRing(plan.kind);
    if (detail.open && detail.kind === 'plan') openPlanDetail(plan.id);
    if (plan.done) {
      showToast(T('目标达成 · {title}', { title: shorten(plan.title, 16) }), 1600);
      // 完成后只把这一条挪到列表末尾，不重建整张列表
      window.setTimeout(function () { reorderPlanRow(plan); }, 900);
    }
    await persistPlans(true);
  }

  async function decrementPlan(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    const p = planProgress(plan);
    if (p.count <= 0) return;
    plan.count = p.count - 1;
    plan.done = false;
    plan.doneAt = null;
    plan.updatedAt = Date.now();
    await persistPlans();
    // 撤销同样原地刷新：这一条、卡头环、排序位置
    paintPlanProgress(plan);
    paintPlanRow(plan);
    refreshPlanRing(plan.kind);
    reorderPlanRow(plan);
    if (detail.open && detail.kind === 'plan') openPlanDetail(id);
    haptic(6);
    showToast(T('已撤销一次'), 1200);
  }

  async function resetPlanProgress(id) {
    const plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    plan.count = 0;
    plan.done = false;
    plan.doneAt = null;
    plan.updatedAt = Date.now();
    await persistPlans();
    renderPlan();
    if (detail.open && detail.kind === 'plan') openPlanDetail(id);
    haptic(12);
    showToast(T('进度已重置'), 1200);
  }

  // 卡面进度原地刷新：只改数字、进度条/能量格/环形/百分数/月相，不重建节点
  function paintPlanProgress(plan) {
    const p = planProgress(plan);
    const article = document.querySelector('[data-plan-row="' + plan.id + '"]');
    if (!article) return null;
    const countEl = article.querySelector('[data-plan-count]');
    if (countEl) countEl.textContent = String(p.count);
    const bar = article.querySelector('[data-plan-bar]');
    if (bar) bar.style.width = (p.ratio * 100).toFixed(1) + '%';
    const cells = article.querySelectorAll('.plan-cell');
    if (cells.length) {
      cells.forEach(function (el, i) { el.classList.toggle('on', i < p.count); });
    }
    // 环形：通过 stroke-dashoffset 的过渡动画平滑推进
    const arc = article.querySelector('[data-plan-arc]');
    if (arc) arc.style.strokeDashoffset = (100 - p.ratio * 100).toFixed(1);
    // 环形中心与百分数样式的百分比数字
    article.querySelectorAll('[data-plan-pct]').forEach(function (el) {
      el.textContent = Math.round(p.ratio * 100) + '%';
    });
    // 月相：完成次数 → 亮面面积，0 = 新月全暗，目标 = 满月全亮，不做整圈相位循环
    const moon = article.querySelector('[data-plan-moon]');
    if (moon) {
      const k = Math.max(0, Math.min(1, p.ratio));
      const lit = article.querySelector('[data-plan-moon-lit]');
      if (lit) {
        const fromK = Math.max(0, Math.min(1, Number(lit.getAttribute('data-k') || 0)));
        lit.setAttribute('data-k', String(k));
        // 相位推进只改路径一个属性；按下缩放走 bump 动画，两者互不干扰
        animateMoonLit(lit, fromK, k);
      }
      moon.classList.toggle('is-full', k >= 0.92);
    }
    return article;
  }

  // 勾选态原地刷新：行的 done 类、勾选/「+1」按钮外观与 aria 文案
  function paintPlanRow(plan) {
    const row = document.querySelector('[data-plan-row="' + plan.id + '"]');
    if (!row) return;
    const p = planProgress(plan);
    row.classList.toggle('done', p.done);
    const btn = row.querySelector('[data-plan-check]');
    if (!btn) return;
    if (btn.classList.contains('check')) {
      btn.classList.toggle('checked', p.done);
      btn.setAttribute('aria-checked', p.done ? 'true' : 'false');
      btn.setAttribute('aria-label', T(p.done ? '标记为未完成' : '标记为完成'));
    } else {
      btn.classList.toggle('done', p.done);
      btn.setAttribute('aria-label', T(p.done ? '目标已达成' : '记一次完成'));
      const path = btn.querySelector('svg path');
      if (path) path.setAttribute('d', p.done ? 'M5 12.5l4.2 4.2L19 7.4' : 'M12 6.2v11.6M6.2 12h11.6');
    }
  }

  // 完成态在 planSort 里排最后：只移动这一条的节点，不重建列表
  function reorderPlanRow(plan) {
    const row = document.querySelector('[data-plan-row="' + plan.id + '"]');
    const swipe = row && row.closest('.plan-swipe');
    if (!swipe || swipe.getAttribute('data-plan-current') !== '1') return;
    const list = swipe.parentNode;
    if (!list) return;
    const cur = Array.prototype.slice.call(list.querySelectorAll('.plan-swipe[data-plan-current="1"]'))
      .map(function (el) {
        return { el: el, plan: state.plans.find(function (x) { return x.id === el.dataset.id; }) };
      })
      .filter(function (x) { return !!x.plan; })
      .sort(function (a, b) { return planSort(a.plan, b.plan); });
    const i = cur.findIndex(function (x) { return x.el === swipe; });
    const next = i >= 0 && i + 1 < cur.length ? cur[i + 1].el : null;
    if (next) {
      list.insertBefore(swipe, next);
    } else {
      const other = list.querySelector('.plan-other-head');
      if (other) list.insertBefore(swipe, other);
      else list.appendChild(swipe);
    }
  }

  // 点击「+1」的反馈：先原地刷新数字，再补弹跳与飞字
  function bumpPlanDom(plan) {
    const article = paintPlanProgress(plan);
    if (!article) return;
    const prog = article.querySelector('.plan-progress');
    if (prog) {
      prog.classList.remove('bump');
      // 强制重排，让动画每次点击都能重新播放
      void prog.offsetWidth;
      prog.classList.add('bump');
    }
    const card = article.querySelector('.plan-row-card');
    if (card) {
      const fly = document.createElement('span');
      fly.className = 'plan-fly';
      fly.textContent = '+1';
      card.appendChild(fly);
      window.setTimeout(function () {
        if (fly.parentNode) fly.parentNode.removeChild(fly);
      }, 700);
    }
  }

  // 卡头的完成百分比环跟着进度即时刷新（只改环与副标题，不重建列表）
  function refreshPlanRing(kind) {
    const card = document.querySelector('[data-plan-card="' + kind + '"]');
    if (!card) return;
    const t = todayKey();
    const start = planPeriodStart(kind, t);
    const current = state.plans.filter(function (p) { return p.kind === kind && p.periodStart === start; });
    const total = current.length;
    const done = current.filter(function (p) { return p.done; }).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const full = pct === 100 && total > 0;
    const ring = card.querySelector('[data-plan-ring="' + kind + '"]');
    const label = card.querySelector('.ring-label b');
    const sub = card.querySelector('[data-plan-sub]');
    if (ring) {
      ring.dataset.pct = String(pct);
      ring.style.strokeDashoffset = String(100 - pct);
      ring.classList.toggle('full', full);
      ring.classList.toggle('zero', pct === 0);
      const wrap = ring.closest('.plan-ring');
      if (wrap) wrap.classList.toggle('is-full', full);
    }
    if (label) label.textContent = total ? pct + '%' : '—';
    if (sub) sub.textContent = planSubText(kind, total, done, start);
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
    // 历史计划页：先让该行收起消失，再重排列表与统计，避免整页跳变
    const row = document.querySelector('#planHistoryBody .plan-hist-swipe[data-id="' + id + '"]');
    if (row) {
      row.classList.add('hist-leaving');
      await new Promise(function (resolve) { setTimeout(resolve, 200); });
    }
    state.plans.splice(idx, 1);
    await persistPlans();
    renderPlan();
    renderPlanHistory();
    showToast(T('已删除'), 1200);
  }

  // ==================== 天气：初始化与城市选择 ====================

  let weatherTimer = null;
  let cityResultsData = [];
  let citySearchTimer = null;
  let citySearchSeq = 0;
  let cityCommitBusy = false;
  // 城市面板的三列滚轮状态，与日记位置的 regionPicker 各自独立
  const cityPicker = { province: 0, city: 0, district: 0 };

  // ==================== 智能提示：统一悬浮横幅（天气 / 行程 / 计划） ====================

  // 总开关：老数据没有该字段时默认开启
  function smartTipEnabled() {
    return state.meta.smartTipEnabled !== false;
  }

  // 三类通知各自一份确认指纹；老版本的单份 smartTipAck 在 normalizeMeta 里迁移到天气
  const SMART_TIP_ACK_FIELD = {
    weather: 'smartTipAckWeather',
    trip: 'smartTipAckTrip',
    plan: 'smartTipAckPlan'
  };
  const SMART_TIP_ICON_TRIP = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/>' +
    '<path d="M12 7.6V12h3.9"/></svg>';
  const SMART_TIP_ICON_PLAN = '<svg viewBox="0 0 24 24"><path d="M6 4.8h12v14.4H6z"/>' +
    '<path d="M9 9h6M9 12.6h4"/></svg>';

  // 本次会话内点过「关闭」或横幅本身的指纹：只存在内存里，不写 meta。
  // 换天 / 换天气 / 换行程 / 换计划都会产生新指纹，横幅会再次出现，不会被永久屏蔽。
  const smartTipDismissed = Object.create(null);
  let smartTipCurrent = null;
  let smartTipShownSig = '';
  let smartTipHideTimer = null;

  // 21:00 前用今日天气，21:00 起改用明日天气
  function smartTipDay() {
    if (!window.Weather || !window.Weather.dayFor) return null;
    const tomorrow = new Date().getHours() >= 21;
    const key = tomorrow ? addDays(todayKey(), 1) : todayKey();
    const day = window.Weather.dayFor(key);
    if (!day) return null;
    day.tomorrow = tomorrow;
    return day;
  }

  // 天气确认指纹：日期 + 这次用到的天气数据。换天或天气实质变化后才允许再出现
  function smartTipSignature(day) {
    function num(v, digits) {
      const n = Number(v);
      if (!isFinite(n)) return '';
      return digits ? n.toFixed(digits) : String(Math.round(n));
    }
    return [
      day.date,
      String(day.code),
      num(day.max),
      num(day.min),
      num(day.pop),
      num(day.uv, 1),
      num(day.wind)
    ].join('|');
  }

  // 判定优先级：降水 > 紫外线 > 高温 > 低温 > 大风 > 晴/云兜底
  // 阈值：降水概率 ≥ 50%；UV ≥ 6（10:00–16:00 正午时段放宽到 ≥ 3）；
  //       高温 ≥ 33°；低温 ≤ 4°；大风 ≥ 30 km/h
  function smartTipSentence(day) {
    const code = Number(day.code);
    // 老缓存可能没有新字段：null / undefined 一律按 NaN 处理，避免误判成 0°
    function num(v) { return v === null || v === undefined || v === '' ? NaN : Number(v); }
    const pop = num(day.pop);
    const uv = num(day.uv);
    const max = num(day.max);
    const min = num(day.min);
    const wind = num(day.wind);
    const hour = new Date().getHours();
    const noon = hour >= 10 && hour < 16;
    const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    const wet = code >= 51 || (isFinite(pop) && pop >= 50);

    if (wet) return snow ? T('可能有降雪，出门注意防滑保暖') : T('可能下雨，出门记得带伞');
    if (isFinite(uv) && (uv >= 6 || (noon && uv >= 3))) return T('紫外线较强，记得做好防晒');
    if (isFinite(max) && max >= 33) return T('气温较高，注意补充水分');
    if (isFinite(min) && min <= 4) return T('气温偏低，出门注意保暖');
    if (isFinite(wind) && wind >= 30) return T('风比较大，出门留意防风');
    if (code === 0 || code === 1) return T('天气不错，适合出门走走');
    if (code === 2 || code === 3) return T('云层较厚，出门也留意天色');
    return T('出门前看一眼天气，安排会更从容');
  }

  function smartTipWeatherCandidate() {
    if (!weatherEnabled()) return null;
    const day = smartTipDay();
    if (!day) return null;
    const info = window.Weather && window.Weather.infoFor ? window.Weather.infoFor(Number(day.code)) : null;
    return {
      type: 'weather',
      sig: smartTipSignature(day),
      text: T('{when}：{tip}', {
        when: day.tomorrow ? T('明天') : T('今天'),
        tip: smartTipSentence(day)
      }),
      tone: info && info.tone ? info.tone : '',
      icon: info && info.icon ? info.icon : ''
    };
  }

  // 行程：只看今天带时间的未完成条目。开始前 60 分钟到开始后 60 分钟内提示；
  // 「进行中」按开始后 60 分钟内算（条目没有结束时间，统一按一小时时段处理）。
  const SMART_TIP_TRIP_WINDOW = 60;
  function smartTipTripCandidate(now) {
    const key = todayKey();
    let best = null;
    expandOccurrences(state.items, key, key).forEach(function (item) {
      if (!item.time || item.done) return;
      const parts = item.time.split(':');
      const start = keyToDate(key);
      start.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
      const mins = Math.round((start.getTime() - now.getTime()) / 60000);
      if (mins > SMART_TIP_TRIP_WINDOW || mins < -SMART_TIP_TRIP_WINDOW) return;
      const urgency = Math.max(0, mins);
      if (best && best.urgency <= urgency) return;
      let text;
      if (mins <= 0) text = T('行程 · {title} 正在进行', { title: item.title });
      else if (mins <= 1) text = T('行程 · {title} 即将开始', { title: item.title });
      else text = T('行程 · {title} {n} 分钟后开始', { title: item.title, n: mins });
      best = {
        type: 'trip',
        // 换行程（不同条目 / 日期 / 时间 / 标题）就是新指纹
        sig: 'trip|' + item.id + '|' + key + '|' + item.time + '|' + item.title,
        text: text,
        urgency: urgency,
        tone: '',
        icon: SMART_TIP_ICON_TRIP
      };
    });
    return best;
  }

  // 计划：只看未完成的计划，且周期结束日落在今天或明天（即「最后两天」）。
  // 周期结束日：周 = 周日、月 = 月末、年 = 12-31，沿用 planPeriodEnd。
  function smartTipPlanCandidate(today) {
    let best = null;
    state.plans.forEach(function (plan) {
      const prog = planProgress(plan);
      if (prog.done) return;
      const end = planPeriodEnd(plan.kind, plan.periodStart);
      if (today < addDays(end, -1) || today > end) return;
      const deadline = keyToDate(end);
      deadline.setHours(23, 59, 59, 999);
      const mins = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 60000));
      if (best && best.urgency <= mins) return;
      let textKey;
      if (plan.kind === 'year') textKey = '本年计划 · {title} 快到期限了';
      else if (plan.kind === 'month') textKey = '本月计划 · {title} 快到期限了';
      else textKey = '本周计划 · {title} 快到期限了';
      best = {
        type: 'plan',
        // 换计划（条目 / 周期 / 标题）就是新指纹；进度变化不重弹
        sig: 'plan|' + plan.id + '|' + plan.kind + '|' + plan.periodStart + '|' + end + '|' + plan.title,
        text: T(textKey, { title: plan.title }),
        urgency: mins,
        tone: '',
        icon: SMART_TIP_ICON_PLAN
      };
    });
    return best;
  }

  function smartTipAcked(candidate) {
    return state.meta[SMART_TIP_ACK_FIELD[candidate.type]] === candidate.sig;
  }

  function smartTipBlocked(candidate) {
    return smartTipAcked(candidate) || !!smartTipDismissed[candidate.sig];
  }

  // 优先级：行程 = 计划（按紧迫度取更急的一条，分钟数越小越急）> 天气
  function smartTipPick() {
    if (!smartTipEnabled()) return null;
    const urgent = [];
    const trip = smartTipTripCandidate(new Date());
    const plan = smartTipPlanCandidate(todayKey());
    if (trip) urgent.push(trip);
    if (plan) urgent.push(plan);
    urgent.sort(function (a, b) { return a.urgency - b.urgency; });
    const ordered = urgent.concat([smartTipWeatherCandidate()].filter(Boolean));
    for (let i = 0; i < ordered.length; i++) {
      if (!smartTipBlocked(ordered[i])) return ordered[i];
    }
    return null;
  }

  function smartTipBannerHTML(candidate) {
    const icon = candidate.icon
      ? '<span class="smart-banner-icon' + (candidate.tone ? ' ' + candidate.tone : '') +
        '" aria-hidden="true">' + candidate.icon + '</span>'
      : '';
    return icon +
      '<span class="smart-banner-text">' + esc(candidate.text) + '</span>' +
      '<span class="smart-banner-actions">' +
        '<button class="smart-banner-ack" type="button" data-smart-tip-ack>' + esc(T('确认')) + '</button>' +
      '</span>';
  }

  function hideSmartTipBanner() {
    const banner = $('#smartTipBanner');
    if (!banner || banner.hidden) return;
    banner.classList.remove('open');
    clearTimeout(smartTipHideTimer);
    smartTipHideTimer = setTimeout(function () {
      if (!banner.classList.contains('open')) banner.hidden = true;
    }, 240);
  }

  function renderSmartTip() {
    const banner = $('#smartTipBanner');
    if (!banner) return;
    const pick = smartTipPick();
    if (!pick) {
      smartTipCurrent = null;
      smartTipShownSig = '';
      hideSmartTipBanner();
      return;
    }
    smartTipCurrent = pick;
    // 位置由 CSS 固定在 .app 顶部（滚动区之外），这里不再做任何测量
    // 同一条内容已经在显示时不动它，避免每次 renderAll 都重播动画；
    // 语言也算进比较键，切中英文时同一条通知要按新语言重绘
    const shownKey = pick.sig + '|' + (isEn() ? 'en' : 'zh');
    if (smartTipShownSig === shownKey && !banner.hidden) return;
    smartTipShownSig = shownKey;
    banner.innerHTML = smartTipBannerHTML(pick);
    banner.hidden = false;
    banner.classList.remove('open');
    void banner.offsetWidth;
    requestAnimationFrame(function () {
      if (smartTipShownSig === shownKey) banner.classList.add('open');
    });
  }

  // 「确认」：写对应类型的指纹，之后同类内容不再出现
  function ackSmartTip() {
    const cur = smartTipCurrent;
    if (!cur) return;
    state.meta[SMART_TIP_ACK_FIELD[cur.type]] = cur.sig;
    persistMeta();
    haptic(8);
    renderSmartTip();
  }

  // 「关闭」/ 点横幅自身：只收起本次，不写 meta
  function dismissSmartTip() {
    const cur = smartTipCurrent;
    if (!cur) return;
    smartTipDismissed[cur.sig] = true;
    smartTipCurrent = null;
    smartTipShownSig = '';
    hideSmartTipBanner();
    haptic(6);
  }

  // 拉到新天气后重算一次提示（失败也重算，用缓存/隐藏）
  function refreshWeather(force) {
    if (!window.Weather) return;
    const p = window.Weather.refresh(force);
    if (p && typeof p.then === 'function') p.then(renderSmartTip, renderSmartTip);
  }

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
    // 每次启动都强制拉一次最新（缓存已先渲染，失败/超时静默保留缓存）
    refreshWeather(true);
    if (!weatherTimer) {
      // 之后每 45 分钟刷新；回到前台时也会按需刷新
      weatherTimer = setInterval(function () {
        if (weatherEnabled()) refreshWeather();
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
          if (weatherEnabled()) refreshWeather();
        }, 45 * 60 * 1000);
      }
      refreshWeather();
    } else {
      stopWeatherTimer();
    }
    if (state.view === 'calendar' && state.selectedDate) renderDayDetail();
    renderSmartTip();
  }

  function openCitySheet() {
    const sheet = $('#citySheet');
    const bg = $('#cityBackdrop');
    if (!sheet || !bg) return;
    cityResultsData = [];
    $('#citySearch').value = '';
    $('#cityResults').innerHTML = '';
    setCitySearchExpanded(false);
    syncCityPickerFromCurrent();
    bg.hidden = false;
    sheet.hidden = false;
    renderPickerWheels(cityPicker, CITY_WHEEL_IDS);
    requestAnimationFrame(function () {
      sheet.classList.add('open');
      bg.classList.add('open');
      // 浮层隐藏时 scrollTop 会被重置，打开后必须再贴一次选中项
      renderPickerWheels(cityPicker, CITY_WHEEL_IDS);
    });
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
    $('#citySearch').value = '';
    setCitySearchExpanded(false);
    $('#citySearch').blur();
    setTimeout(function () {
      if (!sheet.classList.contains('open')) {
        sheet.hidden = true;
        bg.hidden = true;
      }
    }, 300);
  }

  // 搜索是兜底入口：默认收起，点开才出现输入框。
  // 英文模式下没有滚轮，搜索是唯一入口，所以强制展开。
  function setCitySearchExpanded(open) {
    const toggle = $('#citySearchToggle');
    const body = $('#citySearchBody');
    if (!toggle || !body) return;
    const force = isEn();
    toggle.setAttribute('aria-expanded', (force || open) ? 'true' : 'false');
    body.hidden = !(force || open);
    if (!force && !open) $('#citySearch').blur();
  }

  // 打开时把滚轮停在当前天气城市；匹配不到就回到第一项，不猜
  function syncCityPickerFromCurrent() {
    cityPicker.province = 0;
    cityPicker.city = 0;
    cityPicker.district = 0;
    const data = regionData();
    const cur = window.Weather && typeof window.Weather.city === 'function' ? window.Weather.city() : null;
    if (!data.length || !cur) return;
    const segs = String(cur.label || cur.name || '')
      .split('·').map(function (s) { return s.trim(); }).filter(Boolean);
    let hitP = -1;
    let hitC = -1;
    data.forEach(function (p, pi) {
      if (hitC !== -1) return;
      p.cities.forEach(function (c, ci) {
        if (hitC !== -1) return;
        if (c === cur.name || segs.indexOf(c) !== -1) { hitP = pi; hitC = ci; }
      });
    });
    if (hitC === -1) return;
    cityPicker.province = hitP;
    cityPicker.city = hitC;
    const opts = districtOptionsFor(cityPicker);
    segs.forEach(function (s) {
      const di = opts.indexOf(s);
      if (di > 0) cityPicker.district = di;
    });
  }

  // 内置表只有地名，天气需要经纬度：拿地名再走一次搜索，命中后回填
  function pickCityHit(list, city, district) {
    let best = null;
    list.forEach(function (c) {
      let score = 0;
      if (district && c.name === district) score += 3;
      if (c.name === city) score += 2;
      if ((c.region || '').indexOf(city) !== -1) score += 1;
      if (!best || score > best.score) best = { c: c, score: score };
    });
    if (best && best.score > 0) return best.c;
    return list[0];
  }

  async function commitCityWheel() {
    if (cityCommitBusy || !window.Weather) return;
    const data = regionData();
    if (!data.length) return;
    const p = data[cityPicker.province] || data[0];
    const city = p.cities[cityPicker.city] || '';
    const opts = districtOptionsFor(cityPicker);
    const district = cityPicker.district > 0 ? (opts[cityPicker.district] || '') : '';
    if (!city) return;
    const btn = $('#cityWheelDone');
    const btnText = btn ? btn.textContent : '';
    cityCommitBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = T('正在查询位置…'); }
    let list = [];
    let failed = false;
    try {
      list = await window.Weather.search(district ? city + district : city);
    } catch (err) {
      failed = true;
    }
    cityCommitBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = btnText; }
    if (!failed && list && list.length) {
      const hit = pickCityHit(list, city, district);
      if (hit) {
        window.Weather.setCity(hit);
        closeCitySheet();
        showToast(T('天气城市已设为 {city}', { city: hit.label || district || city }));
        if (state.view === 'calendar') renderDayDetail();
        renderSettings();
        return;
      }
    }
    // 查不到就让搜索接手，预填刚选中的地名，用户改两个字就能命中
    const input = $('#citySearch');
    if (input) {
      input.value = district || city;
      setCitySearchExpanded(true);
      runCitySearch(input.value);
      setTimeout(function () { input.focus(); }, 60);
    }
    showToast(failed ? T('搜索失败，请检查网络，已保留原来的城市。') : T('没有找到该位置，请用搜索试试。'));
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

    const ver = $('#settingsVersion');
    if (ver) ver.textContent = T('氢计划 · 版本 {v}', { v: APP_VERSION });

    $('#lunarToggle').checked = lunarVisible();
    const en = isEn();
    $$('#calendarCardSeg [data-cal-card]').forEach(function (btn) {
      const key = btn.dataset.calCard;
      // 英文只有「星座 / 关闭」两段，黄历段隐藏；文案由这里统一下发，避免和字典的「关闭→Close」冲突
      if (key === 'almanac') btn.hidden = en;
      const label = key === 'almanac' ? T('黄历') : key === 'zodiac' ? T('星座') : (en ? 'Off' : T('关闭'));
      if (btn.textContent !== label) btn.textContent = label;
      const on = key === calendarCardMode();
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const zodiacRow = $('#zodiacPickRow');
    if (zodiacRow) {
      const showZodiac = calendarCardMode() === 'zodiac';
      zodiacRow.hidden = !showZodiac;
      const cur = $('#zodiacCurrent');
      if (cur) {
        const z = zodiacOf();
        cur.innerHTML = '<span class="ze-glyph" aria-hidden="true">' + z.glyph + '\uFE0E' + '</span>' +
          '<span class="ze-name">' + esc(isEn() ? z.en : z.zh) + '</span>';
      }
    }
    if ($('#weatherToggle')) $('#weatherToggle').checked = weatherEnabled();

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

  function renderAboutVersion() {
    const el = $('#aboutVersion');
    if (el) el.textContent = 'V' + APP_VERSION;
  }

  function openAgreement() {
    const page = $('#aboutPage');
    if (!page) return;
    renderConsentInfo();
    renderFingerprint();
    renderAboutVersion();
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
    if (hasValidConsent()) return;
    openAgreement();
  }

  function openAbout() {
    const page = $('#aboutPage');
    renderConsentInfo();
    renderFingerprint();
    renderAboutVersion();
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

  // ==================== 原生能力（Capacitor 插件） ====================

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
      schema: 'aeroplan-backup',
      manifest: {
        formatVersion: 1,
        schemaVersion: 10,
        appVersion: APP_VERSION,
        createdAt: new Date().toISOString(),
        includeAttachments: withFiles,
        counts: {
          items: state.items.length,
          plans: state.plans.length,
          countdowns: state.countdowns.length,
          categories: state.categories.length,
          diary: state.diary.length,
          moods: customMoods().length
        },
        encrypted: false
      },
      settings: {
        theme: preferredTheme(),
        language: window.I18N ? window.I18N.lang : 'zh',
        weatherEnabled: weatherEnabled(),
        cardStyle: cardStyleId(),
        progressStyle: state.meta.progressStyle
      },
      categories: state.categories,
      items: state.items,
      plans: state.plans,
      countdowns: state.countdowns,
      moods: customMoods(),
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
    const rawCountdowns = !isArrayFile && Array.isArray(data.countdowns) ? data.countdowns : [];
    const cleanedCountdowns = rawCountdowns.map(normalizeCountdown).filter(Boolean);
    const rawMoods = !isArrayFile && Array.isArray(data.moods) ? data.moods : [];
    const cleanedMoods = normalizeMoods(rawMoods);
    const rawDiaryFiles = !isArrayFile && Array.isArray(data.diaryFiles) ? data.diaryFiles : [];
    const includeAttachments = !isArrayFile && !!(data.manifest && data.manifest.includeAttachments === true);

    const cleaned = [];
    let skipped = 0;
    rawItems.forEach(function (raw) {
      const item = normalizeItem(raw);
      if (item) cleaned.push(item);
      else skipped += 1;
    });

    // 倒数日也算有效内容，避免「只有倒数日」的备份被判成空文件
    const hasAnyContent = cleaned.length || cleanedPlans.length || cleanedDiary.length || cleanedCountdowns.length;
    if (!hasAnyContent) {
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
      countdowns: cleanedCountdowns,
      hasCountdowns: !isArrayFile && !!data && Array.isArray(data.countdowns),
      moods: cleanedMoods,
      hasMoods: !isArrayFile && !!data && Array.isArray(data.moods),
      // 旧备份里的 paper / glass / ink 也按新键值映射，不因认不出而丢掉设置
      cardStyle: !isArrayFile && data && data.settings && typeof data.settings.cardStyle === 'string' && data.settings.cardStyle
        ? normalizeCardStyleId(data.settings.cardStyle)
        : null,
      progressStyle: !isArrayFile && data && data.settings && data.settings.progressStyle === 'battery'
        ? 'battery'
        : (isArrayFile || !data || !data.settings ? null : 'bar'),
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
      if (pendingImport.hasCountdowns) {
        state.countdowns = pendingImport.countdowns.map(function (cd) { return Object.assign({}, cd); });
        sortCountdowns();
      }
      if (pendingImport.hasMoods) state.meta.moods = pendingImport.moods.slice();
      if (pendingImport.cardStyle) state.meta.cardStyle = pendingImport.cardStyle;
      if (pendingImport.progressStyle) state.meta.progressStyle = pendingImport.progressStyle;
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

      if (pendingImport.hasCountdowns) {
        const cdMap = new Map();
        state.countdowns.forEach(function (cd) { cdMap.set(cd.id, cd); });
        pendingImport.countdowns.forEach(function (cd) { cdMap.set(cd.id, Object.assign({}, cd)); });
        state.countdowns = Array.from(cdMap.values());
        sortCountdowns();
      }
      if (pendingImport.hasMoods) {
        const moodMap = new Map();
        customMoods().forEach(function (m) { moodMap.set(m.id, m); });
        pendingImport.moods.forEach(function (m) { moodMap.set(m.id, Object.assign({}, m)); });
        state.meta.moods = Array.from(moodMap.values());
      }
      if (pendingImport.cardStyle) state.meta.cardStyle = pendingImport.cardStyle;
      if (pendingImport.progressStyle) state.meta.progressStyle = pendingImport.progressStyle;

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
    await persistCountdowns();
    await persistMeta();
    applyCardStyle();
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
    showToast(mode === 'replace' ? T('已替换为备份数据') : T('已合并导入'));
  }

  function clearAllItems() {
    openModal({
      kind: 'clear-all',
      title: T('删除所有数据'),
      text: T('将删除 {items} 条安排、{plans} 条计划、{diary} 篇日记、{cats} 个分类，以及全部设置与本地缓存。\n\n删除后无法恢复，建议先备份。', {
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
          ['countdowns', []],
          ['diary', []],
          ['meta', meta]
        ]);
      } else if (storage.status === 'local') {
        localStorage.setItem(LS_ITEMS_KEY, '[]');
        localStorage.setItem(LS_PLANS_KEY, '[]');
        localStorage.setItem(LS_CATS_KEY, '[]');
        localStorage.setItem(LS_CD_KEY, '[]');
        localStorage.setItem(LS_DIARY_KEY, '[]');
        localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
      } else {
        storage.memoryItems = [];
        storage.memoryPlans = [];
        storage.memoryCountdowns = [];
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
    state.items = [];
    state.plans = [];
    state.countdowns = [];
    state.diary = [];
    state.categories = [];
    state.agendaFilters = [];
    state.meta.moods = [];
    state.meta.cardStyle = CARD_STYLE_DEFAULT;
    state.meta.progressStyle = 'bar';
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

    // 整体重置 meta：语言、主题、农历、备份记录、天气城市和同意记录全部回到出厂状态。
    // 界面随后按默认值重新渲染。
    state.meta = { samplesCleared: true };
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
    showToast(saved ? T('已删除所有数据') : T('已删除，但未能写入本机'));
    // 不重启应用：立即弹出协议页，必须重新同意才回到主界面
    openAgreement();
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
    // 这两个二级页会被日记写作页 / 计划面板直接调起，
    // 挪到 body 下才不受 #viewProfile 的子层叠上下文限制（否则会被上层元素盖住）。
    ['#tripTagsPage', '#moodPage'].forEach(function (sel) {
      const page = $(sel);
      if (page && page.parentNode !== document.body) document.body.appendChild(page);
    });
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
      if (state.view === 'plan') {
        openAgenda(t);
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
      // 气泡常驻：点「查看」只跳转，不再收起、也不再写指纹
      // 进入今天之前清掉分类筛选，保证列表口径与统计数字一致
      state.agendaFilters = [];
      openAgenda(todayKey(), { pendingOnly: summaryHasPending });
    });

    $('#topbarTitle').addEventListener('click', function () {
      if (state.view === 'calendar') openYearPicker();
    });

    // 日历页 → 全部安排（原议程页）：全屏流式入口
    $('#agendaEntryBtn').addEventListener('click', function () { openAgenda(todayKey()); });
    $('#agendaBack').addEventListener('click', closeAgenda);
    $('#agendaToday').addEventListener('click', function () {
      state.agendaAnchor = todayKey();
      renderAgenda();
      agendaScrollTo(state.agendaAnchor, true);
    });
    // 「更早 / 更晚」按钮已移除，改为页面级纵向手势翻页
    bindAgendaSwipe();
    // 「全部安排」搜索：输入即时过滤（200ms 防抖），清空恢复全量
    let agendaSearchTimer = null;
    $('#agendaSearch').addEventListener('input', function () {
      const el = this;
      if (agendaSearchTimer) clearTimeout(agendaSearchTimer);
      agendaSearchTimer = setTimeout(function () {
        agendaSearchQuery = el.value;
        $('#agendaSearchClear').hidden = !el.value;
        renderAgenda();
      }, 200);
    });
    $('#agendaSearchClear').addEventListener('click', function () {
      $('#agendaSearch').value = '';
      agendaSearchQuery = '';
      this.hidden = true;
      if (agendaSearchTimer) clearTimeout(agendaSearchTimer);
      renderAgenda();
      $('#agendaSearch').focus();
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
    bindSwipe($('#planHistoryBody'));
    bindBatchPress($('#dayDetailInner'));
    bindBatchPress($('#agendaList'));
    $('#batchCancel').addEventListener('click', function () { exitBatchMode(); });
    $('#batchAll').addEventListener('click', selectAllBatchCards);
    $('#batchDelete').addEventListener('click', askBatchDelete);
    bindMonthSwipe();
    bindPinchYear();
    $('#scheduleGrid').addEventListener('click', function (e) {
      const chip = e.target.closest('.sch-chip');
      if (chip) openDetail(chip.dataset.id, chip.dataset.date || '');
    });

    // 天气：城市选择
    $('#weatherCityBtn').addEventListener('click', openCitySheet);
    // 日历页顶部的天气条由 weather.js 自行渲染在 #ddWeather 里，
    // 它不在 #dayDetailInner 内，所以这里单独委托一次，避免「点了没反应」。
    const calWeatherEl = $('#ddWeather');
    if (calWeatherEl) {
      calWeatherEl.addEventListener('click', function (e) {
        if (e.target.closest('[data-weather-city]')) openCitySheet();
      });
    }
    $('#cityClose').addEventListener('click', closeCitySheet);
    $('#cityBackdrop').addEventListener('click', closeCitySheet);
    $('#cityWheelDone').addEventListener('click', commitCityWheel);
    $('#citySearchToggle').addEventListener('click', function () {
      const body = $('#citySearchBody');
      const expand = !!(body && body.hidden);
      setCitySearchExpanded(expand);
      if (expand) setTimeout(function () { $('#citySearch').focus(); }, 60);
    });
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
      const plus = e.target.closest('[data-plan-plus]');
      if (plus) {
        incrementPlan(plus.dataset.planPlus);
        return;
      }
      const minus = e.target.closest('[data-plan-minus]');
      if (minus) {
        decrementPlan(minus.dataset.planMinus);
        return;
      }
      const reset = e.target.closest('[data-plan-reset]');
      if (reset) {
        resetPlanProgress(reset.dataset.planReset);
        return;
      }
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
      if (diaryEntry) { if (diaryEntry.tagName !== 'SECTION' && !diaryEntry.closest('#diaryBody')) openDiaryDetail(diaryEntry.dataset.diaryOpen); return; }
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
        // 直接落到「分类标签」整页，并压在面板之上
        openTripTagsPage(true);
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

    $('.stepper', $('#planSheet')).addEventListener('click', function (e) {
      const btn = e.target.closest('[data-plan-step]');
      if (!btn) return;
      syncPlanTarget(planDraft.target + Number(btn.dataset.planStep));
    });
    $('#planTarget').addEventListener('input', function () {
      planDraft.target = clampTarget($('#planTarget').value);
    });
    $('#planTarget').addEventListener('blur', function () {
      syncPlanTarget(clampTarget($('#planTarget').value));
    });

    $('#planPriorityChip').addEventListener('click', function () {
      planDraft.priority = !planDraft.priority;
      syncPlanPriorityChip();
    });

    $('#planStyleOpts').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-plan-style]');
      if (!btn) return;
      planDraft.progressStyle = planStyleOf(btn.dataset.planStyle);
      syncPlanStyleOpts();
      haptic(6);
    });

    $('#planCategoryChips').addEventListener('click', function (e) {
      if (e.target.closest('[data-plan-manage]')) {
        closePlanSheet();
        openTripTagsPage(true);
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

    $('#profileSettingsBtn').addEventListener('click', openSettings);
    $('#settingsClose').addEventListener('click', closeSettings);

    // ---------- 个人页 ----------
    $('#cardStyleEntryBtn').addEventListener('click', openCardStylePage);
    $('#cardStyleBack').addEventListener('click', closeCardStylePage);
    $('#cardStyleGrid').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-card-style]');
      if (btn) chooseCardStyle(btn.dataset.cardStyle);
    });
    // 卡片样式筛选：仅改展示，不写设置、不动当前已选皮肤
    $('#cardStyleFilter').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-skin-filter]');
      if (!btn) return;
      cardStyleFilter = btn.dataset.skinFilter;
      Array.prototype.forEach.call(this.querySelectorAll('[data-skin-filter]'), function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      renderCardStylePage();
    });
    $('#profileCountdownBtn').addEventListener('click', openCountdownPage);
    $('#profileTripTagsBtn').addEventListener('click', openTripTagsPage);
    $('#profileMoodTagsBtn').addEventListener('click', openMoodPage);
    $('#tripTagsBack').addEventListener('click', closeTripTagsPage);
    $('#planHistoryBack').addEventListener('click', closePlanHistoryPage);
    // 历史计划搜索：与「全部安排」一致，200ms 防抖，清空恢复全量
    let planHistorySearchTimer = null;
    $('#planHistorySearch').addEventListener('input', function () {
      const el = this;
      if (planHistorySearchTimer) clearTimeout(planHistorySearchTimer);
      planHistorySearchTimer = setTimeout(function () {
        planHistorySearch = el.value;
        $('#planHistorySearchClear').hidden = !el.value;
        renderPlanHistory();
      }, 200);
    });
    $('#planHistorySearchClear').addEventListener('click', function () {
      $('#planHistorySearch').value = '';
      planHistorySearch = '';
      this.hidden = true;
      if (planHistorySearchTimer) clearTimeout(planHistorySearchTimer);
      renderPlanHistory();
      $('#planHistorySearch').focus();
    });
    // 左滑露出编辑/删除按钮；标题行可展开收起该周期的条目
    $('#planHistoryBody').addEventListener('click', function (e) {
      const toggle = e.target.closest('[data-hist-toggle]');
      if (toggle) {
        togglePlanHistoryGroup(toggle.dataset.histToggle, toggle);
        return;
      }
      const edit = e.target.closest('[data-plan-edit]');
      if (edit) {
        if (Date.now() < state.swipeClickLock) return;
        closeAllSwipes();
        openPlanEditSheet(edit.dataset.planEdit);
        return;
      }
      const del = e.target.closest('[data-plan-del]');
      if (del) {
        if (Date.now() < state.swipeClickLock) return;
        closeAllSwipes();
        askDeletePlan(del.dataset.planDel);
        return;
      }
      if (handleSwipeClick(e)) return;
    });

    // ---------- 倒数日 ----------
    $('#countdownBack').addEventListener('click', closeCountdownPage);
    $('#countdownAdd').addEventListener('click', function () { openCdSheet(''); });
    // 横滑条现在挂在日记页，监听挂在长期存在的 #viewDiary 上
    $('#viewDiary').addEventListener('click', function (e) {
      const btn = e.target.closest('#countdownCards [data-cd-open]');
      if (!btn) return;
      haptic(8);
      openCdSheet(btn.dataset.cdOpen || '');
    });

    // 纪念日横滑条：原生嵌套横向滚动在部分 Android WebView 下会被父级纵向滚动吃掉，
    // 这里用 pointer 手势直接改写 scrollLeft；纵向手势放行给页面，横向位移超过 8px 才接管，
    // 松手后短暂抑制点击，避免滑动被误判成「打开纪念日」。
    (function bindCdStripDrag() {
      const strip = $('#countdownCards');
      if (!strip) return;
      let drag = null;
      let suppressUntil = 0;
      strip.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: strip.scrollLeft, active: false };
      });
      strip.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.active) {
          // 位移太小或更像纵向滑动：不接管，交给页面滚动
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
          drag.active = true;
          try { strip.setPointerCapture(drag.id); } catch (err) { /* 忽略 */ }
        }
        if (e.cancelable) e.preventDefault();
        strip.scrollLeft = drag.left - dx;
      }, { passive: false });
      function endDrag(e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.active) suppressUntil = Date.now() + 400;
        drag = null;
      }
      strip.addEventListener('pointerup', endDrag);
      strip.addEventListener('pointercancel', endDrag);
      strip.addEventListener('click', function (e) {
        if (Date.now() < suppressUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    })();
    $('#countdownListBody').addEventListener('pointerdown', cdDragStart);
    $('#countdownListBody').addEventListener('pointermove', cdDragMove);
    document.addEventListener('pointerup', cdDragEnd);
    document.addEventListener('pointercancel', cdDragEnd);
    document.addEventListener('touchmove', function (e) {
      if (cdDrag && cdDrag.active) e.preventDefault();
    }, { passive: false });
    $('#countdownListBody').addEventListener('click', function (e) {
      if (Date.now() - cdDragEndAt < 260) return;
      const pin = e.target.closest('[data-cd-pin]');
      if (pin) {
        e.stopPropagation();
        toggleCountdownPin(pin.dataset.cdPin);
        return;
      }
      const row = e.target.closest('[data-cd-open]');
      if (!row) return;
      haptic(8);
      openCdSheet(row.dataset.cdOpen || '');
    });
    $('#cdPop').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cd-pop]');
      if (!btn || !cdPopId) return;
      const id = cdPopId;
      closeCdPop();
      if (btn.dataset.cdPop === 'edit') {
        openCdSheet(id);
        return;
      }
      const cd = state.countdowns.find(function (c) { return c.id === id; });
      openModal({
        kind: 'cd-del',
        title: T('删除纪念日「{name}」？', { name: cd ? cd.title : '' }),
        text: T('删除后不可恢复'),
        confirmText: T('删除'),
        danger: true,
        onConfirm: function () { deleteCountdown(id); }
      });
    });
    document.addEventListener('pointerdown', function (e) {
      if (cdPopId && !e.target.closest('#cdPop') && !e.target.closest('#countdownListBody')) closeCdPop();
    });
    $('#cdClose').addEventListener('click', closeCdSheet);
    $('#cdBackdrop').addEventListener('click', closeCdSheet);
    $('#cdTitle').addEventListener('input', syncCdSave);
    $('#cdDateChip').addEventListener('click', function () {
      openDateSheet('countdown');
    });
    // 公历 / 农历：切换时把当前日期换算过去，选择器不会是空的
    $('#cdCalSeg').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cd-cal]');
      if (!btn || !cdDraft) return;
      const cal = btn.dataset.cdCal;
      if (cal !== 'solar' && cal !== 'lunar') return;
      if (cdDraft.calendar === cal) return;
      if (cal === 'lunar') {
        const l = cdDraftLunarOf(cdDraft.date);
        if (l) {
          cdDraft.lunarYear = l.year;
          cdDraft.lunarMonth = l.month;
          cdDraft.lunarDay = l.day;
          cdDraft.lunarLeap = l.isLeap && lunarLeapMonth(l.year) === l.month;
        }
      } else {
        const key = cdEffectiveKey();
        if (key) {
          cdDraft.date = key;
          cdDateDraft = { date: key, time: '' };
        }
      }
      cdDraft.calendar = cal;
      if (cal === 'lunar' && cdDraft.repeat === 'monthly') cdDraft.repeat = 'none';
      renderCdChoices();
      renderCdLunarPickers();
      haptic(6);
    });
    $('#cdDirSeg').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cd-dir]');
      if (!btn || !cdDraft) return;
      cdDraft.direction = btn.dataset.cdDir === 'up' ? 'up' : 'down';
      renderCdChoices();
      syncCdSave();
      haptic(6);
    });
    $('#cdRepeatSeg').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cd-repeat]');
      if (!btn || !cdDraft || btn.disabled) return;
      cdDraft.repeat = CD_REPEATS.indexOf(btn.dataset.cdRepeat) !== -1 ? btn.dataset.cdRepeat : 'none';
      renderCdChoices();
      syncCdSave();
      haptic(6);
    });
    ['#cdLunarYearBtn', '#cdLunarMonthBtn', '#cdLunarDayBtn'].forEach(function (sel) {
      const btn = $(sel);
      if (btn) btn.addEventListener('click', openCdWheelSheet);
    });
    const leapToggle = $('#cdLunarLeap');
    if (leapToggle) leapToggle.addEventListener('change', function () {
      if (!cdDraft) return;
      cdDraft.lunarLeap = !!this.checked && lunarLeapMonth(cdDraft.lunarYear) === cdDraft.lunarMonth;
      renderCdLunarPickers();
      haptic(6);
    });
    if ($('#cdWheelBackdrop')) $('#cdWheelBackdrop').addEventListener('click', closeCdWheelSheet);
    if ($('#cdWheelClose')) $('#cdWheelClose').addEventListener('click', closeCdWheelSheet);
    if ($('#cdWheelDone')) $('#cdWheelDone').addEventListener('click', confirmCdWheel);
    if ($('#cdWheelLeap')) $('#cdWheelLeap').addEventListener('change', function () {
      if (!cdWheelDraft) return;
      cdWheelDraft.leap = !!this.checked && lunarLeapMonth(cdWheelDraft.year) === cdWheelDraft.month;
      renderCdWheelSheet();
      haptic(6);
    });
    $('#cdSwatches').addEventListener('click', function (e) {
      const sw = e.target.closest('[data-cd-color]');
      if (!sw) return;
      $('#cdSheet').dataset.color = sw.dataset.cdColor;
      $$('#cdSwatches .swatch').forEach(function (el) {
        el.classList.toggle('active', el === sw);
      });
      haptic(6);
    });
    // 自定义颜色：原生取色器，不重建节点，取色过程中保持打开
    $('#cdSwatches').addEventListener('input', function (e) {
      if (!e.target || e.target.id !== 'cdCustomColor') return;
      const color = isHexColor(e.target.value) ? e.target.value : PRESET_COLORS[0];
      $('#cdSheet').dataset.color = color;
      const label = e.target.closest('.cd-custom-swatch');
      if (label) {
        label.style.setProperty('--sw', color);
        $$('#cdSwatches .swatch').forEach(function (el) {
          el.classList.toggle('active', el === label);
        });
      }
    });
    $('#cdCats').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-cd-cat]');
      if (!chip) return;
      const id = chip.dataset.cdCat === 'none' ? '' : chip.dataset.cdCat;
      $('#cdSheet').dataset.cat = id;
      renderCdCats();
      haptic(6);
    });
    $('#cdSave').addEventListener('click', saveCountdown);
    $('#cdDelete').addEventListener('click', function () {
      if (cdEditingId) deleteCountdown(cdEditingId);
    });

    // ---------- 自定义情绪 ----------
    $('#moodBack').addEventListener('click', closeMoodPage);
    $('#moodAdd').addEventListener('click', function () { openMoodEditor(''); });
    $('#moodList').addEventListener('pointerdown', moodDragStart);
    $('#moodList').addEventListener('pointermove', moodDragMove);
    document.addEventListener('pointerup', moodDragEnd);
    document.addEventListener('pointercancel', moodDragEnd);
    $('#moodList').addEventListener('click', function (e) {
      if (Date.now() - moodDragEndAt < 220) return;
      const row = e.target.closest('[data-mood-row]');
      if (!row) return;
      haptic(10);
      openMoodPop(row.dataset.moodRow);
    });
    $('#moodPop').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-mood-pop]');
      if (!btn || !moodPopId) return;
      const id = moodPopId;
      closeMoodPop();
      if (btn.dataset.moodPop === 'edit') openMoodEditor(id);
      else {
        openModal({
          kind: 'mood-del',
          title: T('删除情绪「{name}」？', { name: (customMoods().find(function (m) { return m.id === id; }) || {}).name || '' }),
          text: T('引用它的日记会清空心情，其他内容保留'),
          confirmText: T('删除'),
          danger: true,
          onConfirm: function () { deleteMood(id); }
        });
      }
    });
    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest('#moodPop') || e.target.closest('[data-mood-row]')) return;
      closeMoodPop();
    });
    $('#clearAllBtn').addEventListener('click', clearAllItems);

    // 分类：点标签行直接在右下角弹出编辑/删除
    $('#categoryList').addEventListener('click', function (e) {
      // 刚结束拖动的那一下不当作点击，避免松手后误开编辑浮层
      if (Date.now() - catDragEndAt < CAT_DRAG_CLICK_MS) return;
      const row = e.target.closest('[data-cat-row]');
      if (!row) return;
      const id = row.dataset.catRow;
      if (!$('#catPop').hidden && catPopId === id) {
        closeCatPop();
        return;
      }
      openCatPop(id);
    });
    $('#tripTagsAdd').addEventListener('click', function () { openCategoryEditor(null); });

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
          !e.target.closest('[data-cat-row]')) {
        closeCatPop();
      }
    });

    $('#settingsPage').addEventListener('scroll', function () { closeCatPop(); }, { passive: true });

    // 通用弹窗
    $('#modalCancel').addEventListener('click', cancelModal);
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
      // 必须锚定按钮本身：内联 svg 也带 data-icon，直接 closest('[data-icon]')
      // 会把点击判定落在图形上，导致部分图标「点不中」
      const btn = e.target.closest('.cat-icon-btn');
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

    $('#aboutEntryBtn').addEventListener('click', openAbout);
    $('#aboutClose').addEventListener('click', closeAbout);
    $('#agreementAccept').addEventListener('click', acceptAgreement);
    $('#agreementDecline').addEventListener('click', declineAgreement);

    // 顶栏深浅色切换：其余四页用；更多页改用「外观」里的开关，两者同一个 meta.theme
    $('#themeBtn').addEventListener('click', function () {
      state.meta.theme = preferredTheme() === 'dark' ? 'light' : 'dark';
      applyTheme();
      persistMeta();
      haptic(8);
    });
    $('#profileDarkToggle').addEventListener('change', function () {
      state.meta.theme = this.checked ? 'dark' : 'light';
      applyTheme();
      persistMeta();
      haptic(8);
    });

    // 页面切到后台时暂停皮肤动效（CSS 只认这个开关，避免后台空转）
    document.addEventListener('visibilitychange', function () {
      document.documentElement.classList.toggle('app-paused', document.hidden);
    });

    $('#lunarToggle').addEventListener('change', function () {
      state.meta.lunarVisible = $('#lunarToggle').checked;
      persistMeta();
      renderAll();
      // 节假日标记跟随农历开关，年历也要同步重绘
      if (state.yearView) renderYearView();
    });

    $('#calendarCardSeg').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cal-card]');
      if (!btn || btn.dataset.calCard === calendarCardMode()) return;
      state.meta.calendarCard = btn.dataset.calCard;
      // 同步老字段，避免降级到旧版本时仍按旧开关判断
      state.meta.almanacVisible = btn.dataset.calCard !== 'off';
      persistMeta();
      renderSettings();
      renderDayDetail();
      haptic(8);
    });

    $('#zodiacOpen').addEventListener('click', openZodiacPage);
    $('#zodiacBack').addEventListener('click', closeZodiacPage);
    $('#zodiacGrid').addEventListener('click', function (e) {
      const item = e.target.closest('[data-zodiac]');
      if (!item || item.dataset.zodiac === zodiacOf().id) {
        if (item) closeZodiacPage();
        return;
      }
      state.meta.zodiacSign = item.dataset.zodiac;
      persistMeta();
      renderSettings();
      renderDayDetail();
      closeZodiacPage();
      haptic(8);
    });

    $('#weatherToggle').addEventListener('change', function () {
      state.meta.weatherEnabled = $('#weatherToggle').checked;
      persistMeta();
      applyWeatherSetting();
      renderSettings();
      renderAll();
    });

    // 「个性化 · 智能提示」总开关：关掉后日记 / 日历 / 行程表三处气泡一起收起
    if ($('#smartTipToggle')) {
      $('#smartTipToggle').addEventListener('change', function () {
        state.meta.smartTipEnabled = this.checked;
        persistMeta();
        renderSmartTip();
        haptic(8);
      });
    }

    // 统一横幅：「确认」写对应类型指纹；点横幅正文只收起本次（不写指纹）
    const smartBanner = $('#smartTipBanner');
    if (smartBanner) {
      smartBanner.addEventListener('click', function (e) {
        if (e.target.closest('[data-smart-tip-ack]')) {
          e.stopPropagation();
          ackSmartTip();
          return;
        }
        dismissSmartTip();
      });
    }

    $('#agendaList').addEventListener('click', function (e) {
      if (state.batchMode) {
        if (Date.now() < state.batchLock) return;
        handleBatchClick(e);
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

    // 计划卡「+」长按 400ms：减一次，与点击加一次形成对称
    let planMinusTimer = 0;
    let planMinusEl = null;
    let planMinusFrom = null;
    let planMinusUntil = 0;
    $('#planContent').addEventListener('pointerdown', function (e) {
      const btn = e.target.closest('[data-plan-check]');
      if (!btn) return;
      planMinusEl = btn;
      planMinusFrom = { x: e.clientX, y: e.clientY };
      clearTimeout(planMinusTimer);
      planMinusTimer = window.setTimeout(function () {
        planMinusTimer = 0;
        if (!planMinusEl) return;
        // 抑制长按松手后浏览器补发的 click，避免「减一次又加一次」
        planMinusUntil = Date.now() + 620;
        const id = planMinusEl.dataset.planCheck;
        planMinusEl.classList.add('minus-flash');
        haptic(14);
        // 减完之后列表会整段重渲染，闪光要补到新节点上才看得见
        decrementPlan(id).then(function () {
          const fresh = document.querySelector('[data-plan-row="' + id + '"] [data-plan-check]');
          if (!fresh || fresh === planMinusEl) return;
          fresh.classList.add('minus-flash');
          window.setTimeout(function () { fresh.classList.remove('minus-flash'); }, 340);
        });
        window.setTimeout(function () {
          if (planMinusEl) planMinusEl.classList.remove('minus-flash');
        }, 340);
      }, 400);
    });
    $('#planContent').addEventListener('pointermove', function (e) {
      if (!planMinusTimer || !planMinusFrom) return;
      if (Math.abs(e.clientX - planMinusFrom.x) > 10 || Math.abs(e.clientY - planMinusFrom.y) > 10) {
        clearTimeout(planMinusTimer);
        planMinusTimer = 0;
      }
    });
    function cancelPlanMinus() {
      clearTimeout(planMinusTimer);
      planMinusTimer = 0;
      planMinusEl = null;
      planMinusFrom = null;
    }
    $('#planContent').addEventListener('pointerup', cancelPlanMinus);
    $('#planContent').addEventListener('pointercancel', cancelPlanMinus);
    document.addEventListener('pointermove', planDragMove, { passive: false });
    document.addEventListener('pointerup', planDragEnd);
    document.addEventListener('pointercancel', planDragEnd);
    document.addEventListener('touchmove', function (e) {
      if (planDrag && planDrag.active) e.preventDefault();
    }, { passive: false });

    $('#planContent').addEventListener('click', function (e) {
      if (Date.now() - planDragEndAt < 320) return;
      if (e.target.closest('#planHistoryBtn')) {
        openPlanHistoryPage();
        return;
      }
      const seg = e.target.closest('[data-plan-kind]');
      if (seg) {
        const kind = seg.dataset.planKind;
        if (kind !== state.planKind) {
          const from = state.planKind === 'week' ? 0 : state.planKind === 'month' ? 1 : 2;
          const to = kind === 'week' ? 0 : kind === 'month' ? 1 : 2;
          state.planKind = kind;
          renderPlan();
          // 重绘后让高亮块从旧档位滑到新档位（先落旧值、关过渡，再在下一帧开启）
          const segEl = $('#planSeg');
          const thumb = segEl ? segEl.querySelector('.plan-seg-thumb') : null;
          if (segEl && thumb) {
            thumb.style.transition = 'none';
            segEl.style.setProperty('--seg-i', from);
            requestAnimationFrame(function () {
              thumb.style.transition = '';
              segEl.style.setProperty('--seg-i', to);
            });
          }
          const content = $('#content');
          if (content) content.scrollTop = 0;
        }
        return;
      }
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
        if (Date.now() < planMinusUntil) return;
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
        if (agendaPageOpen()) renderAgenda();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      handleBackGesture();
    });

    bindBackGesture();
    bindDiaryEvents();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (state.lastDayKey !== todayKey()) {
          state.lastDayKey = todayKey();
          renderAll();
        } else {
          renderSummary();
        }
        if (weatherEnabled() && window.Weather) refreshWeather();
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
    if (!$('#cdSheet').hidden) { closeCdSheet(); return true; }
    if (!$('#moodPop').hidden) { closeMoodPop(); return true; }
    if (!$('#planHistoryPage').hidden) { closePlanHistoryPage(); return true; }
    if (!$('#tripTagsPage').hidden) { closeTripTagsPage(); return true; }
    if (!$('#moodPage').hidden) { closeMoodPage(); return true; }
    if (!$('#countdownPage').hidden) { closeCountdownPage(); return true; }
    if (!$('#agendaPage').hidden) { closeAgenda(); return true; }
    if (!$('#catPop').hidden) { closeCatPop(); return true; }
    if (!$('#modalCard').hidden) { closeModal(); return true; }
    // 日记：详情页 → 预览 → 写作页 → 附件/备份选择 → 管理态，逐层退出
    if (!$('#diaryDetailPage').hidden) { closeDiaryDetail(); return true; }
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
    // 设置下的二级页：有层级就先回设置页，不能直接退到系统
    if (!$('#cardStylePage').hidden) { closeCardStylePage(); return true; }
    if (!$('#zodiacPage').hidden) { closeZodiacPage(); return true; }
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

  const LANG_MIRROR_KEY = 'aeroplan.lang';

  function resolveInitialLanguage() {
    try {
      const saved = localStorage.getItem(LANG_MIRROR_KEY) || localStorage.getItem(LEGACY_LS_KEYS.lang);
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
    migrateCalendarCardForLang(target);
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
    else if (!isEn() && showLunar && meta.term) bits.push(T(meta.term));
    if (showLunar) bits.push(isEn() ? lunarLabel(meta) : '农历' + meta.lunarFull);
    return bits.join(' · ');
  }

  // 卡片上的位置只到区县：省 · 市 · 区，缺一项就跳过；具体位置只在写作页与详情里出现
  function diaryLocationBrief(entry) {
    const loc = entry && entry.location;
    if (!loc) return '';
    const parts = [];
    [loc.province, loc.city, loc.district].forEach(function (p) {
      if (p && parts.indexOf(p) === -1) parts.push(p);
    });
    return parts.join(' · ');
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
    // 位置在卡片上只到区县，具体位置留给详情
    const locBrief = diaryLocationBrief(entry);
    const loc = locBrief
      ? '<span class="dc-loc">' + esc(locBrief) + '</span>'
      : '';
    const wx = diaryWeatherBrief(entry);
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
          mood + loc + wx +
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
        '<div class="dc-swipe" data-dc-swipe="' + entry.date + '">' +
          '<div class="dc-swipe-actions">' +
            '<button type="button" data-diary-act="edit" data-date="' + entry.date + '">' + T('编辑') + '</button>' +
            '<button type="button" class="danger" data-diary-act="del" data-date="' + entry.date + '">' + T('删除') + '</button>' +
          '</div>' +
          diaryCardHTML(entry) +
        '</div>' +
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
            diaryWeatherBrief(entry) +
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

  // ---------- 日记详情：朋友圈式排版 ----------
  let diaryDetailDate = '';
  let diaryDetailUrls = [];

  function diaryMoodLabel(id) {
    if (!id) return '';
    const preset = DIARY_MOODS.find(function (m) { return m.id === id; });
    if (preset) return preset.zh;
    const custom = customMoods().find(function (m) { return m.id === id; });
    return custom ? custom.name : '';
  }

  function openDiaryDetail(date) {
    const entry = diaryByDate(date);
    if (!entry) { openDiaryEditor(date); return; }
    diaryDetailDate = date;
    renderDiaryDetail(entry);
    const page = $('#diaryDetailPage');
    page.hidden = false;
    requestAnimationFrame(function () { page.classList.add('open'); });
  }

  function closeDiaryDetail() {
    const page = $('#diaryDetailPage');
    if (!page || page.hidden) return;
    page.classList.remove('open');
    diaryDetailUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (err) { /* 忽略 */ } });
    diaryDetailUrls = [];
    window.setTimeout(function () {
      if (page.classList.contains('open')) return;
      page.hidden = true;
      $('#ddBody').innerHTML = '';
    }, 240);
  }

  function renderDiaryDetail(entry) {
    $('#ddTitle').textContent = diaryDateTitle(entry.date);
    const mood = diaryMoodLabel(entry.mood);
    const loc = diaryLocationBrief(entry);
    const whtml = diaryWeatherHTML(entry);
    const bits = ['<span>' + esc(diaryCardDate(entry.date)) + '</span>'];
    if (mood) {
      bits.push('<span class="dd-mood">' + moodIconHTML(entry.mood, 'dd-face') + esc(mood) + '</span>');
    }
    if (loc) bits.push('<span>' + esc(loc) + '</span>');

    const media = entry.attachments.map(function (a) {
      if (a.kind === 'image') {
        return '<button class="dd-media-item" type="button" data-dd-media="' + a.id + '">' +
          '<img alt="" data-dd-thumb="' + a.id + '"></button>';
      }
      if (a.kind === 'video') {
        return '<button class="dd-media-item dd-media-video" type="button" data-dd-media="' + a.id + '">' +
          '<span class="dd-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>' +
          (a.duration ? '<span class="dd-dur">' + esc(diaryDurationText(a.duration)) + '</span>' : '') +
        '</button>';
      }
      return '<button class="dd-doc" type="button" data-dd-media="' + a.id + '">' +
        '<span class="dd-doc-name">' + esc(a.name) + '</span>' +
      '</button>';
    }).join('');

    $('#ddBody').innerHTML =
      '<div class="dd-meta">' + bits.join('') + '</div>' +
      (whtml ? '<div class="dd-wx-line">' + whtml + '</div>' : '') +
      (entry.text.trim()
        ? '<div class="dd-text">' + esc(entry.text.trim()).replace(/\n/g, '<br>') + '</div>'
        : '') +
      (media ? '<div class="dd-media">' + media + '</div>' : '') +
      (entry.tags.length
        ? '<div class="dd-tags">' + entry.tags.map(function (t) {
            return '<span class="dd-tag">' + esc(t) + '</span>';
          }).join('') + '</div>'
        : '') +
      '<div class="dd-foot"><button class="soft-chip" type="button" data-dd-share="1">分享长图</button></div>';

    hydrateDiaryDetail();
  }

  async function hydrateDiaryDetail() {
    const nodes = $$('#ddBody [data-dd-thumb]');
    for (const node of nodes) {
      try {
        const rec = await diaryFileGet(node.dataset.ddThumb);
        if (!rec || !rec.data) continue;
        const url = URL.createObjectURL(rec.data);
        diaryDetailUrls.push(url);
        node.src = url;
      } catch (err) { /* 忽略 */ }
    }
  }

  async function openDiaryDetailMedia(id) {
    const entry = diaryByDate(diaryDetailDate);
    if (!entry) return;
    await openDiaryAttachment(id, entry.attachments);
  }

  function wrapCanvasLines(ctx, text, maxW) {
    const out = [];
    text.split('\n').forEach(function (para) {
      let line = '';
      for (const ch of para) {
        if (line && ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
        else line += ch;
      }
      out.push(line);
    });
    return out;
  }

  // ==================== 日记分享长图（皮肤 / 心情 / 天气 / 位置） ====================
  const SHARE_W = 720;
  const SHARE_EDGE = 22;
  const SHARE_PAD = 44;
  const SHARE_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif';
  const SHARE_EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';
  // 长图图片区规则：单张最高 520px（按原比例缩宽度，不拉伸）；
  // 最多排 9 张、图片区总高 4200px，超出用一行提示收尾；
  // 画布总高超过 12000px 时整体等比缩小，避开安卓 WebView 的 canvas 上限。
  const SHARE_IMG_MAX_H = 520;
  const SHARE_IMG_GAP = 18;
  const SHARE_IMG_MAX = 9;
  const SHARE_IMG_BUDGET = 4200;
  const SHARE_MAX_H = 12000;

  const SHARE_MOOD_EMOJI = {
    happy: '😊', calm: '😌', tired: '😪', sad: '😢', annoyed: '😤', hopeful: '🌱',
    excited: '🤩', grateful: '🙏', angry: '😠', anxious: '😰', lonely: '🥺',
    surprised: '😮', shy: '😳', moved: '🥹', speechless: '😑', relieved: '😮‍💨',
    bored: '😐', longing: '💭', heart: '❤️', star: '⭐', sun: '☀️', moon: '🌙',
    leaf: '🍃', flame: '🔥', drop: '💧', bolt: '⚡'
  };
  const SHARE_WX_EMOJI = {
    sun: '☀️', partly: '⛅', cloudy: '☁️', fog: '🌫️',
    drizzle: '🌦️', rain: '🌧️', snow: '🌨️', storm: '⛈️'
  };
  // 皮肤 → 纹理画法：与 styles.css 里 --cs-tex 同源的轻量近似（不解析 CSS 渐变）
  const SHARE_TEX = {
    washi: 'paper', note: 'ruled', vine: 'paper', felt: 'fibre', linen: 'weave',
    leather: 'grain', cream: 'blob', jelly: 'gloss', frost: 'streaks', rain: 'rain',
    metal: 'brush', coast: 'waves', candy: 'dots', bamboo: 'bamboo', bound: 'rules',
    starry: 'stars', blackhole: 'stars', moon: 'stars', outline: 'none'
  };

  function shareMoodEmoji(id) {
    if (SHARE_MOOD_EMOJI[id]) return SHARE_MOOD_EMOJI[id];
    const list = customMoods();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return SHARE_MOOD_EMOJI[list[i].glyph] || '🙂';
    }
    return '🙂';
  }

  // 天气只在有快照、且快照地点与当前位置一致时出现；否则整块省略
  function shareWeather(entry) {
    const w = entry && entry.weather;
    if (!w) return null;
    const q = diaryWeatherQuery(normalizeDiaryLocation(entry.location));
    if (!q) return null;
    if (w.place && w.place !== q) return null;
    const W = window.Weather;
    if (!W || typeof W.infoFor !== 'function') return null;
    const info = W.infoFor(w.code);
    if (!info) return null;
    const max = isFinite(Number(w.max)) ? Math.round(Number(w.max)) + '°' : '';
    const min = isFinite(Number(w.min)) ? Math.round(Number(w.min)) + '°' : '';
    const temp = max ? (min ? max + ' / ' + min : max) : min;
    return { emoji: SHARE_WX_EMOJI[info.key] || '☁️', desc: isEn() ? info.en : info.zh, temp: temp };
  }

  // 从真实渲染的皮肤变量取色，保证深浅主题与二十套皮肤都能正确套用
  function shareTheme() {
    const cs = getComputedStyle(document.body);
    const pick = function (name, fallback) {
      const v = (cs.getPropertyValue(name) || '').trim();
      return v || fallback;
    };
    const dark = document.documentElement.classList.contains('dark');
    const skin = effectiveCardStyleId();
    const skinned = skin !== CARD_STYLE_DEFAULT;
    const fbBg = dark ? '#1e2228' : '#ffffff';
    return {
      skin: skin,
      dark: dark,
      bg: skinned ? pick('--cs-bg', fbBg) : pick('--card', fbBg),
      soft: skinned ? pick('--cs-bg-soft', fbBg) : pick('--card-soft', fbBg),
      fg: skinned ? pick('--cs-fg', '#1b2433') : pick('--text', '#1b2433'),
      fg2: skinned ? pick('--cs-fg-2', '#5a636f') : pick('--text-2', '#5a636f'),
      line: skinned ? pick('--cs-line', 'rgba(0,0,0,.12)') : pick('--line', 'rgba(0,0,0,.12)'),
      accent: skinned ? pick('--cs-accent', '#7C8CF8') : pick('--primary', '#7C8CF8'),
      accentSoft: skinned ? pick('--cs-accent-soft', 'rgba(124,140,248,.12)') : pick('--primary-soft', 'rgba(124,140,248,.12)'),
      radius: Math.max(10, Math.min(40, parseFloat(skinned ? pick('--cs-radius', '20px') : '20px') || 20)),
      deco: skinned ? pick('--cs-deco', 'none') : 'none'
    };
  }

  function shareColor(str) {
    const s = String(str || '').trim();
    let m = /^#([0-9a-f]{3})$/.exec(s);
    if (m) {
      return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    }
    m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    }
    m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) {
      const parts = m[1].split(',').map(function (p) { return parseFloat(p); });
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? parts[3] : 1];
    }
    return [0, 0, 0, 1];
  }

  function shareTint(color, alpha) {
    const c = shareColor(color);
    return 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + alpha + ')';
  }

  function shareRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shareRoundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function shareTexture(ctx, theme, card) {
    const kind = SHARE_TEX[theme.skin] || 'none';
    if (kind === 'none') return;
    const ink = theme.dark ? '255,255,255' : '0,0,0';
    const rnd = shareRandom(11);
    ctx.save();
    shareRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius);
    ctx.clip();
    ctx.lineWidth = 1;
    if (kind === 'paper' || kind === 'ruled') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.035)';
      for (let ly = card.y; ly < card.y + card.h; ly += kind === 'ruled' ? 34 : 6) {
        ctx.beginPath();
        ctx.moveTo(card.x, ly);
        ctx.lineTo(card.x + card.w, ly);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(' + ink + ',0.05)';
      for (let i = 0; i < 240; i++) ctx.fillRect(card.x + rnd() * card.w, card.y + rnd() * card.h, 1.3, 1.3);
    } else if (kind === 'fibre') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.04)';
      for (let lx = card.x - card.h; lx < card.x + card.w; lx += 9) {
        ctx.beginPath();
        ctx.moveTo(lx, card.y);
        ctx.lineTo(lx + card.h * .6, card.y + card.h);
        ctx.stroke();
      }
    } else if (kind === 'weave') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.028)';
      for (let ly = card.y; ly < card.y + card.h; ly += 7) {
        ctx.beginPath();
        ctx.moveTo(card.x, ly);
        ctx.lineTo(card.x + card.w, ly);
        ctx.stroke();
      }
      for (let lx = card.x; lx < card.x + card.w; lx += 7) {
        ctx.beginPath();
        ctx.moveTo(lx, card.y);
        ctx.lineTo(lx, card.y + card.h);
        ctx.stroke();
      }
    } else if (kind === 'grain') {
      for (let i = 0; i < 130; i++) {
        const bx = card.x + rnd() * card.w;
        const by = card.y + rnd() * card.h;
        const rad = 5 + rnd() * 18;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
        g.addColorStop(0, 'rgba(' + ink + ',0.045)');
        g.addColorStop(1, 'rgba(' + ink + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
      }
    } else if (kind === 'blob' || kind === 'gloss') {
      for (let i = 0; i < 7; i++) {
        const bx = card.x + rnd() * card.w;
        const by = card.y + rnd() * card.h;
        const rad = 60 + rnd() * 120;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
        g.addColorStop(0, 'rgba(' + ink + ',' + (kind === 'gloss' ? '0.05' : '0.035') + ')');
        g.addColorStop(1, 'rgba(' + ink + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
      }
    } else if (kind === 'streaks' || kind === 'rain') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.05)';
      const step = kind === 'rain' ? 16 : 26;
      for (let sx = card.x - card.h; sx < card.x + card.w; sx += step) {
        ctx.beginPath();
        ctx.moveTo(sx, card.y);
        ctx.lineTo(sx + card.h * .35, card.y + card.h);
        ctx.stroke();
      }
      if (kind === 'rain') {
        ctx.fillStyle = 'rgba(' + ink + ',0.07)';
        for (let i = 0; i < 60; i++) ctx.fillRect(card.x + rnd() * card.w, card.y + rnd() * card.h, 1.6, 6 + rnd() * 8);
      }
    } else if (kind === 'brush') {
      for (let ly = card.y; ly < card.y + card.h; ly += 4) {
        ctx.strokeStyle = 'rgba(' + ink + ',' + (0.015 + rnd() * 0.03) + ')';
        ctx.beginPath();
        ctx.moveTo(card.x, ly);
        ctx.lineTo(card.x + card.w, ly + 1);
        ctx.stroke();
      }
    } else if (kind === 'waves') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.05)';
      for (let wy = card.y + 40; wy < card.y + card.h; wy += 44) {
        ctx.beginPath();
        for (let wx = card.x; wx <= card.x + card.w; wx += 6) {
          const yy = wy + Math.sin((wx - card.x) / 34) * 5;
          if (wx === card.x) ctx.moveTo(wx, yy);
          else ctx.lineTo(wx, yy);
        }
        ctx.stroke();
      }
    } else if (kind === 'dots') {
      ctx.fillStyle = 'rgba(' + ink + ',0.05)';
      for (let dy = card.y + 12; dy < card.y + card.h; dy += 18) {
        for (let dx = card.x + 12; dx < card.x + card.w; dx += 18) ctx.fillRect(dx, dy, 2, 2);
      }
    } else if (kind === 'bamboo') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.05)';
      for (let bx = card.x + 18; bx < card.x + card.w; bx += 42) {
        ctx.beginPath();
        ctx.moveTo(bx, card.y);
        ctx.lineTo(bx, card.y + card.h);
        ctx.stroke();
      }
      for (let ny = card.y + 70; ny < card.y + card.h; ny += 140) {
        ctx.beginPath();
        ctx.moveTo(card.x, ny);
        ctx.lineTo(card.x + card.w, ny);
        ctx.stroke();
      }
    } else if (kind === 'rules') {
      ctx.strokeStyle = 'rgba(' + ink + ',0.05)';
      for (let lx = card.x + 14; lx < card.x + 44; lx += 7) {
        ctx.beginPath();
        ctx.moveTo(lx, card.y);
        ctx.lineTo(lx, card.y + card.h);
        ctx.stroke();
      }
    } else if (kind === 'stars') {
      ctx.fillStyle = 'rgba(' + ink + ',0.10)';
      for (let i = 0; i < 120; i++) {
        const sx = card.x + rnd() * card.w;
        const sy = card.y + rnd() * card.h;
        const sz = rnd() > 0.85 ? 2 : 1;
        ctx.fillRect(sx, sy, sz, sz);
      }
      if (theme.skin === 'blackhole') {
        ctx.strokeStyle = 'rgba(' + ink + ',0.10)';
        ctx.beginPath();
        ctx.ellipse(card.x + card.w * .82, card.y + 78, 58, 20, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (theme.skin === 'moon') {
        ctx.fillStyle = 'rgba(' + ink + ',0.055)';
        ctx.beginPath();
        ctx.arc(card.x + card.w - 70, card.y + 66, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(card.x + card.w - 96, card.y + 94, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 皮肤装饰图（--cs-deco 的 data:image/svg+xml）直接栅格化，位置与尺寸从简写里读取
  function shareDecoInfo(theme) {
    const v = theme.deco;
    if (!v || v === 'none') return null;
    const u = /url\((['"]?)([^'")]+)\1\)/.exec(v);
    if (!u) return null;
    const size = /\/\s*([\d.]+)px\s+([\d.]+)px/.exec(v);
    return {
      src: u[2],
      w: size ? Math.max(36, parseFloat(size[1]) * 2.2) : 44,
      h: size ? Math.max(36, parseFloat(size[2]) * 2.2) : 44,
      top: /top\s+[-\d.]+px/.test(v),
      left: /left\s+[-\d.]+px/.test(v)
    };
  }

  function loadShareImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function shareDrawDeco(ctx, theme, card, deco, img) {
    if (!deco || !img) return;
    const x = deco.left ? card.x + 10 : card.x + card.w - deco.w - 12;
    const y = deco.top ? card.y + 8 : card.y + card.h - deco.h - 6;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(img, x, y, deco.w, deco.h);
    ctx.restore();
  }

  function shareChipWidth(ctx, chip) {
    ctx.font = '400 24px ' + SHARE_EMOJI_FONT;
    const ew = ctx.measureText(chip.emoji).width;
    ctx.font = '400 22px ' + SHARE_FONT;
    const tw = ctx.measureText(chip.text).width;
    return { w: Math.ceil(12 + ew + 8 + tw + 16), ew: ew };
  }

  function shareChipRows(ctx, chips, maxW) {
    const rows = [];
    let row = [];
    let rowW = 0;
    chips.forEach(function (chip) {
      const size = shareChipWidth(ctx, chip);
      chip.w = size.w;
      chip.ew = size.ew;
      const need = chip.w + (row.length ? 10 : 0);
      if (row.length && rowW + need > maxW) {
        rows.push(row);
        row = [chip];
        rowW = chip.w;
      } else {
        row.push(chip);
        rowW += need;
      }
    });
    if (row.length) rows.push(row);
    return rows;
  }

  function shareDrawChip(ctx, x, y, chip, theme) {
    const h = 42;
    const bg = chip.kind === 'mood' && chip.color
      ? shareTint(chip.color, theme.dark ? 0.22 : 0.14)
      : (chip.kind === 'wx' ? theme.accentSoft : theme.soft);
    ctx.save();
    shareRoundRect(ctx, x, y, chip.w, h, h / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.line;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = '400 24px ' + SHARE_EMOJI_FONT;
    ctx.fillText(chip.emoji, x + 12, y + h / 2 + 1);
    ctx.font = '400 22px ' + SHARE_FONT;
    ctx.fillStyle = theme.fg;
    ctx.fillText(chip.text, x + 12 + chip.ew + 8, y + h / 2 + 1);
    ctx.restore();
  }

  // 先量后画：先在测量用的 ctx 上排好版，拿到画布高度再真正建 canvas
  function shareLayout(ctx, chips, lines, imgHs, imgHint) {
    const W = SHARE_W;
    const EDGE = SHARE_EDGE;
    const PAD = SHARE_PAD;
    const innerX = EDGE + PAD;
    const innerW = W - innerX * 2;
    let y = EDGE + PAD;
    const titleBase = y + 34;
    y = titleBase + 14;
    const dateBase = y + 18;
    y = dateBase + 16;
    let meta = null;
    if (chips.length) {
      const rows = shareChipRows(ctx, chips, innerW);
      meta = { rows: rows, top: y, height: rows.length * 42 + (rows.length - 1) * 10 };
      y += meta.height;
    }
    y += meta ? 30 : 18;
    const bodyBase = y + 26;
    y = bodyBase + (lines.length - 1) * 42;
    let imgY = 0;
    if (imgHs.length) {
      y += 24;
      imgY = y;
      for (let i = 0; i < imgHs.length; i++) {
        y += imgHs[i];
        if (i < imgHs.length - 1) y += SHARE_IMG_GAP;
      }
    }
    let hintY = 0;
    if (imgHint) {
      y += imgHs.length ? 14 : 20;
      hintY = y + 20;
      y += 24;
    }
    const footY = y + 44;
    return {
      W: W,
      H: Math.round(footY + 40 + EDGE),
      edge: EDGE,
      pad: PAD,
      innerX: innerX,
      innerW: innerW,
      titleBase: titleBase,
      dateBase: dateBase,
      meta: meta,
      bodyBase: bodyBase,
      imgY: imgY,
      hintY: hintY,
      footY: footY
    };
  }

  // 长图展示在 <img> 上的 url 是 blob:，Android WebView 既没有内置的图片长按菜单，
  // 也下载不了 blob:，所以把这次生成的 PNG 留一份，给「保存图片」按钮和长按兜底用
  let shareImageBlob = null;

  // 长图大标题：有标题用标题；没有标题回退正文首行摘要（与卡片一致），仍为空用「无标题日记」。
  // 相对日期（今天/昨天/前天）只出现在页脚，不再当标题。
  function shareTitle(entry) {
    const title = (entry.title || '').trim();
    if (title) return { text: title, weak: false };
    const firstLine = (entry.text || '').trim().split(/\r?\n/)[0].trim();
    if (firstLine) {
      const brief = firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
      return { text: brief, weak: true };
    }
    return { text: T('无标题日记'), weak: true };
  }

  // 标题单行绘制：先按宽度缩字号（34 → 24px），仍放不下再截断补省略号
  function shareFitTitle(ctx, text, maxW) {
    let size = 34;
    ctx.font = '600 ' + size + 'px ' + SHARE_FONT;
    while (size > 24 && ctx.measureText(text).width > maxW) {
      size -= 2;
      ctx.font = '600 ' + size + 'px ' + SHARE_FONT;
    }
    const chars = Array.from(text);
    let out = text;
    while (chars.length > 1 && ctx.measureText(out + '…').width > maxW) {
      chars.pop();
      out = chars.join('');
    }
    return out === text ? text : out + '…';
  }

  async function shareDiaryLongImage() {
    const entry = diaryByDate(diaryDetailDate);
    if (!entry) return;
    const probe = document.createElement('canvas').getContext('2d');
    const innerW = SHARE_W - (SHARE_EDGE + SHARE_PAD) * 2;

    const head = shareTitle(entry);
    const rawText = (entry.text || '').trim();
    // 标题用了正文首行时，正文跳过首行，避免同一句话画两遍
    const bodyText = rawText
      ? (head.weak ? rawText.split(/\r?\n/).slice(1).join('\n').trim() : rawText)
      : T('这篇只有心情和附件');
    probe.font = '400 26px ' + SHARE_FONT;
    let lines = wrapCanvasLines(probe, bodyText, innerW);
    // 画布高度有上限：超长正文截到 180 行，末尾补省略号
    if (lines.length > 180) {
      lines = lines.slice(0, 180);
      lines[179] = lines[179].replace(/[\s\S]$/, '') + '…';
    }

    // 图片：按附件顺序（正文顺序）依次排进长图；视频、文件不参与。
    // 单张加载失败就跳过继续，不能让整张长图跟着挂掉。
    const imgMetas = (entry.attachments || []).filter(function (a) { return a.kind === 'image'; });
    const imgBlocks = [];
    const imgUrls = [];
    let imgTotal = 0;
    for (let i = 0; i < imgMetas.length; i++) {
      if (imgBlocks.length >= SHARE_IMG_MAX) break;
      let url = '';
      let img = null;
      try {
        const rec = await diaryFileGet(imgMetas[i].id);
        if (rec && rec.data) {
          url = URL.createObjectURL(rec.data);
          img = await loadShareImage(url);
        }
      } catch (err) {
        img = null;
      }
      if (!img || !img.width || !img.height) {
        if (url) { try { URL.revokeObjectURL(url); } catch (err) { /* 忽略 */ } }
        continue;
      }
      let w = innerW;
      let h = Math.round(w * img.height / img.width);
      if (h > SHARE_IMG_MAX_H) {
        // 单张限高：按原比例缩窄，居中摆放，不拉伸
        h = SHARE_IMG_MAX_H;
        w = Math.max(1, Math.round(h * img.width / img.height));
      }
      const add = h + (imgBlocks.length ? SHARE_IMG_GAP : 0);
      if (imgTotal + add > SHARE_IMG_BUDGET) {
        try { URL.revokeObjectURL(url); } catch (err) { /* 忽略 */ }
        break;
      }
      imgTotal += add;
      imgBlocks.push({ img: img, w: w, h: h });
      imgUrls.push(url);
    }
    const imgHidden = imgMetas.length - imgBlocks.length;
    const imgHint = imgHidden > 0 ? T('还有 {n} 张图片未显示', { n: imgHidden }) : '';

    // 心情（含自定义）→ 天气（仅快照且地点一致）→ 地区；缺失的整块不参与排版
    const chips = [];
    if (entry.mood) {
      const mm = moodMeta(entry.mood);
      chips.push({
        kind: 'mood',
        emoji: shareMoodEmoji(entry.mood),
        text: moodLabel(entry.mood),
        color: mm && mm.color ? mm.color : null
      });
    }
    const wx = shareWeather(entry);
    if (wx) {
      chips.push({ kind: 'wx', emoji: wx.emoji, text: wx.desc + (wx.temp ? '  ' + wx.temp : '') });
    }
    const loc = diaryLocationBrief(entry);
    if (loc) chips.push({ kind: 'loc', emoji: '📍', text: loc });

    const theme = shareTheme();
    const layout = shareLayout(probe, chips, lines, imgBlocks.map(function (b) { return b.h; }), !!imgHint);
    const W = layout.W;
    const H = layout.H;
    const card = { x: SHARE_EDGE, y: SHARE_EDGE, w: W - SHARE_EDGE * 2, h: H - SHARE_EDGE * 2 };

    const canvas = document.createElement('canvas');
    // canvas 尺寸兜底：安卓 WebView 对 canvas 有边长/总像素上限，内容过高时
    // 整体等比缩小（下面用逻辑坐标绘制），保证极端情况也能出图
    let scale = 1;
    if (H > SHARE_MAX_H) scale = SHARE_MAX_H / H;
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));
    const ctx = canvas.getContext('2d');
    if (scale !== 1) ctx.scale(scale, scale);

    // 底色：整张图先铺皮肤底色，再压一层薄雾，让卡片从画布里浮起来
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = theme.dark ? 'rgba(255,255,255,.035)' : 'rgba(24,26,32,.045)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.shadowColor = theme.dark ? 'rgba(0,0,0,.45)' : 'rgba(30,34,44,.16)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    shareRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.restore();

    shareTexture(ctx, theme, card);

    ctx.save();
    shareRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius);
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 装饰允许探出卡片，但会被画布裁住，不会溢出图片
    const deco = shareDecoInfo(theme);
    if (deco) {
      const decoImg = await loadShareImage(deco.src);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      shareDrawDeco(ctx, theme, card, deco, decoImg);
      ctx.restore();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // 标题画日记标题（见 shareTitle）；相对日期只留在页脚，不再占标题位
    ctx.fillStyle = theme.fg;
    ctx.fillText(shareFitTitle(ctx, head.text, layout.innerW), layout.innerX, layout.titleBase);

    ctx.fillStyle = theme.fg2;
    ctx.font = '400 19px ' + SHARE_FONT;
    ctx.fillText(diaryCardDate(entry.date), layout.innerX, layout.dateBase);

    if (layout.meta) {
      layout.meta.rows.forEach(function (row, i) {
        let x = layout.innerX;
        const y = layout.meta.top + i * 52;
        row.forEach(function (chip) {
          shareDrawChip(ctx, x, y, chip, theme);
          x += chip.w + 10;
        });
      });
    }

    ctx.fillStyle = theme.fg;
    ctx.font = '400 26px ' + SHARE_FONT;
    lines.forEach(function (line, i) {
      ctx.fillText(line, layout.innerX, layout.bodyBase + i * 42);
    });

    let imgDrawY = layout.imgY;
    imgBlocks.forEach(function (b) {
      // 限高后宽度变窄的图居中摆放，保持原始比例
      const ix = layout.innerX + Math.round((layout.innerW - b.w) / 2);
      ctx.save();
      shareRoundRect(ctx, ix, imgDrawY, b.w, b.h, Math.min(18, theme.radius));
      ctx.clip();
      ctx.drawImage(b.img, ix, imgDrawY, b.w, b.h);
      ctx.restore();
      imgDrawY += b.h + SHARE_IMG_GAP;
    });

    if (imgHint) {
      ctx.fillStyle = theme.fg2;
      ctx.font = '400 20px ' + SHARE_FONT;
      ctx.fillText(imgHint, layout.innerX, layout.hintY);
    }

    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.innerX, layout.footY - 24);
    ctx.lineTo(layout.innerX + layout.innerW, layout.footY - 24);
    ctx.stroke();

    ctx.fillStyle = theme.fg2;
    ctx.font = '400 17px ' + SHARE_FONT;
    ctx.fillText('AeroPlan · ' + diaryDateTitle(entry.date), layout.innerX, layout.footY);

    canvas.toBlob(function (blob) {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const viewer = $('#diaryViewer');
      const vid = $('#diaryViewerVideo');
      const img = $('#diaryViewerImg');
      shareImageBlob = blob;
      if (vid) { vid.hidden = true; try { vid.pause(); } catch (err) { /* 忽略 */ } vid.removeAttribute('src'); }
      if (img.dataset.url) { try { URL.revokeObjectURL(img.dataset.url); } catch (err) { /* 忽略 */ } }
      img.dataset.url = url;
      img.src = url;
      img.hidden = false;
      $('#diaryViewerName').textContent = T('点按「保存图片」或长按图片保存到相册');
      const saveBtn = $('#diaryViewerSave');
      if (saveBtn) saveBtn.hidden = false;
      viewer.scrollTop = 0;
      viewer.hidden = false;
      requestAnimationFrame(function () { viewer.classList.add('open'); });
    }, 'image/png');
    if (imgUrls.length) {
      window.setTimeout(function () {
        imgUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (err) { /* 忽略 */ } });
      }, 4000);
    }
  }

  function shareImageName() {
    return (isEn() ? 'AeroPlan-diary-' : '氢计划日记-') + (diaryDetailDate || dateKey(new Date())) + '.png';
  }

  // 保存长图：原生环境写进缓存目录 → 交给系统面板（用户在里面选「保存到相册 / 文件」），
  // 网页环境退回普通下载。
  async function saveShareImage() {
    if (!shareImageBlob) return;
    const name = shareImageName();
    const fs = plugin('Filesystem');
    const share = plugin('Share');
    if (fs && isNativeApp()) {
      const path = 'share-image/' + name;
      try {
        await fs.writeFile({
          path: path,
          data: await blobToBase64(shareImageBlob),
          directory: 'CACHE',
          recursive: true
        });
        const uriRes = await fs.getUri({ path: path, directory: 'CACHE' });
        const uri = uriRes && uriRes.uri;
        if (share && typeof share.share === 'function' && uri) {
          await share.share({
            title: T('保存图片'),
            dialogTitle: T('保存或分享图片'),
            files: [uri]
          });
          return;
        }
      } catch (err) {
        console.warn('调起系统保存面板失败：', err);
      }
    }
    const url = URL.createObjectURL(shareImageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
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
    // 倒数日横滑条：位于日记页搜索栏下方、日记列表之上
    renderCountdownStrip();

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

  function selectAllDiary() {
    $$('#diaryBody [data-diary-open]').forEach(function (card) {
      state.diarySel.add(card.dataset.diaryOpen);
      card.classList.add('selected');
    });
    haptic(8);
    syncDiaryManageBar();
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
          weather: entry.weather ? Object.assign({}, entry.weather) : null,
          weatherOn: entry.weatherOn === true,
          attachments: entry.attachments.map(function (a) { return Object.assign({}, a); }),
          createdAt: entry.createdAt
        }
      : { date: key, title: '', text: '', mood: '', tags: [], location: null, weather: null, weatherOn: false, attachments: [], createdAt: Date.now() };
    state.diaryEditorOpen = true;
    state.diaryEditingDate = key;
    state.diaryDirty = false;
    diaryWeatherNote = '';
    state.diaryAttachBlocked = diaryAttachBlockedReason();
    diaryTagValue = '';

    const el = $('#diaryEditor');
    el.hidden = false;
    renderDiaryEditor();
    refreshDiaryWeather(false);
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
    const wxToggle = $('#deWxToggle');
    if (wxToggle) wxToggle.checked = draft.weatherOn === true;
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
    if (pick) pick.textContent = brief ? T('修改位置') : T('选择位置');
    const clear = $('#deLocClear');
    if (clear) clear.hidden = !loc;
    // 英文模式隐藏省市滚轮后，用一行说明告诉用户还剩哪两种定位方式；
    // 文案走 i18n，中文界面由 CSS 隐藏这行，保持原样
    const hint = $('#deLocHint');
    if (hint) hint.textContent = T('英文模式下不提供省市滚轮，可用「使用当前位置」或直接在下方填写位置。');
    renderDiaryWeather();
  }

  function diarySetLocation(next) {
    const draft = state.diaryDraft;
    if (!draft) return;
    draft.location = normalizeDiaryLocation(next);
    renderDiaryLocation();
    // 位置一变就重新对天气；没选滚轮位置时清空天气，绝不按设备定位补
    refreshDiaryWeather(false);
    state.diaryDirty = true;
    scheduleDiarySave();
  }

  // 「当前位置」直接复用天气系统里已经设置的地点（同一份 meta.weatherCity，
  // 不另存一份）。天气被关闭或模块未就绪时，退回读 meta 里的那份设置。
  function weatherCitySource() {
    const W = window.Weather;
    const live = W && typeof W.city === 'function' ? W.city() : null;
    if (live && live.name) return live;
    const saved = state.meta && state.meta.weatherCity;
    if (saved && saved.name) return saved;
    return null;
  }

  // 天气城市只有「城市 · 区县」两个短名，这里回到内置区划表里找省市区
  function regionForWeatherCity(city) {
    const name = String((city && city.name) || '').trim();
    const segs = String((city && city.label) || '').split('·')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    const data = regionData();
    for (let pi = 0; pi < data.length; pi++) {
      const cities = data[pi].cities || [];
      for (let ci = 0; ci < cities.length; ci++) {
        const c = cities[ci];
        if (c !== name && segs.indexOf(c) === -1) continue;
        let district = '';
        const opts = districtsFor(c);
        segs.forEach(function (s) {
          if (opts.indexOf(s) !== -1) district = s;
        });
        return { province: data[pi].province, city: c, district: district };
      }
    }
    // 表里没有（海外或新地名）：只写城市名，仍然能查天气
    return { province: '', city: name, district: '' };
  }

  function useWeatherCityAsLocation() {
    const draft = state.diaryDraft;
    if (!draft) return;
    const city = weatherCitySource();
    if (!city) {
      showToast(T('还没有设置天气位置，请先在日历页选择城市'));
      return;
    }
    const region = regionForWeatherCity(city);
    const text = draft.location && draft.location.text ? draft.location.text : '';
    diarySetLocation({
      province: region.province,
      city: region.city,
      district: region.district,
      text: text
    });
    haptic(8);
  }

  // ---------- 日记天气：只用滚轮选的位置，结果随日记持久化 ----------
  const NO_DISTRICT = '不限';
  let diaryWeatherTimer = null;
  let diaryWeatherSeq = 0;
  // 英文勾选天气时给用户的状态提示：空 / 正在查询 / 查不到
  let diaryWeatherNote = '';

  function diaryWeatherQuery(loc) {
    if (!loc || (!loc.province && !loc.city)) return '';
    const parts = [];
    [loc.province, loc.city, loc.district].forEach(function (p) {
      if (p && p !== NO_DISTRICT && parts.indexOf(p) === -1) parts.push(p);
    });
    return parts.join(' ');
  }

  // 英文模式勾选「天气」后优先用手动填写的位置查询；没有手动位置时
  // 退回「使用当前位置」写入的省市区，中文模式仍沿用省市区
  function diaryWeatherPlace(record) {
    const loc = normalizeDiaryLocation(record && record.location);
    if (!loc) return '';
    if (isEn() && record && record.weatherOn) return loc.text || diaryWeatherQuery(loc);
    return diaryWeatherQuery(loc);
  }

  // 位置变了但天气还是旧地点的一律不显示，避免张冠李戴
  function diaryWeatherHTML(record) {
    if (isEn() && !(record && record.weatherOn)) return '';
    const w = record && record.weather;
    if (!w) return '';
    const q = diaryWeatherPlace(record);
    if (!q) return '';
    if (w.place && w.place !== q) return '';
    const W = window.Weather;
    if (!W || typeof W.infoFor !== 'function') return '';
    const info = W.infoFor(w.code);
    if (!info) return '';
    const max = isFinite(Number(w.max)) ? Math.round(Number(w.max)) + '°' : '—';
    const min = isFinite(Number(w.min)) ? Math.round(Number(w.min)) + '°' : '';
    const tone = info.tone ? ' ' + info.tone : '';
    const icon = String(info.icon || '').replace('<svg ', '<svg class="dw-svg" ');
    return '<span class="dw-wx">' +
      '<span class="dw-ico' + tone + '">' + icon + '</span>' +
      '<span class="dw-desc">' + esc(isEn() ? info.en : info.zh) + '</span>' +
      '<span class="dw-temp">' + max + (min ? '<i>/' + min + '</i>' : '') + '</span>' +
    '</span>';
  }

  // 卡片上只放图标 + 最高温，避免在窄卡片里堆文字
  function diaryWeatherBrief(entry) {
    if (isEn() && !(entry && entry.weatherOn)) return '';
    const w = entry && entry.weather;
    if (!w) return '';
    const q = diaryWeatherPlace(entry);
    if (!q) return '';
    if (w.place && w.place !== q) return '';
    const W = window.Weather;
    if (!W || typeof W.infoFor !== 'function') return '';
    const info = W.infoFor(w.code);
    if (!info) return '';
    const max = isFinite(Number(w.max)) ? Math.round(Number(w.max)) + '°' : '—';
    return '<span class="dc-wx"><span class="dw-ico' + (info.tone ? ' ' + info.tone : '') + '">' +
      String(info.icon || '').replace('<svg ', '<svg class="dw-svg" ') + '</span>' +
      '<span>' + max + '</span></span>';
  }

  function renderDiaryWeather() {
    const box = $('#deWeather');
    if (!box) return;
    const draft = state.diaryDraft;
    const html = (isEn() && (!draft || !draft.weatherOn)) ? '' : diaryWeatherHTML(draft);
    box.innerHTML = html;
    box.hidden = !html;
    // 查不到 / 位置为空 / 查询中时用一行提示兜底，避免留白
    const hint = $('#deWxHint');
    if (hint) {
      let note = '';
      if (!html && isEn() && draft && draft.weatherOn) {
        note = diaryWeatherPlace(draft) ? diaryWeatherNote : T('先填写位置，再查看天气');
      }
      hint.textContent = note;
      hint.hidden = !note;
    }
  }

  // 只在「今天」这一篇上主动联网；历史日记只展示已保存的快照
  function refreshDiaryWeather(force) {
    clearTimeout(diaryWeatherTimer);
    diaryWeatherNote = '';
    diaryWeatherTimer = setTimeout(function () {
      const draft = state.diaryDraft;
      if (!draft || !state.diaryEditorOpen) return;
      // 英文模式未勾选「天气」：不查询、不展示，也不保留旧快照
      if (isEn() && !draft.weatherOn) {
        if (draft.weather) {
          draft.weather = null;
          scheduleDiarySave();
        }
        renderDiaryWeather();
        return;
      }
      const q = diaryWeatherPlace(draft);
      if (!q) {
        // 位置为空（英文勾选场景）或没选位置：清掉旧快照，避免残留
        if (draft.weather) {
          draft.weather = null;
          scheduleDiarySave();
        }
        renderDiaryWeather();
        return;
      }
      if (draft.date !== todayKey()) {
        if (isEn() && draft.weatherOn && !draft.weather) diaryWeatherNote = T('这篇日记没有保存天气');
        renderDiaryWeather();
        return;
      }
      const W = window.Weather;
      if (!W || typeof W.dailyForPlace !== 'function') {
        if (isEn() && draft.weatherOn) diaryWeatherNote = T('天气服务暂时不可用，稍后再试');
        renderDiaryWeather();
        return;
      }
      const cached = draft.weather;
      if (!force && cached && cached.date === todayKey() && cached.place === q) {
        renderDiaryWeather();
        return;
      }
      const seq = ++diaryWeatherSeq;
      if (isEn() && draft.weatherOn) diaryWeatherNote = T('正在查询天气…');
      renderDiaryWeather();
      W.dailyForPlace(q).then(function (snap) {
        if (seq !== diaryWeatherSeq) return;
        const live = state.diaryDraft;
        if (!live || !state.diaryEditorOpen || live.date !== todayKey()) return;
        if (diaryWeatherPlace(live) !== q) return;
        diaryWeatherNote = '';
        live.weather = normalizeDiaryWeather({
          date: todayKey(), code: snap.code, max: snap.max, min: snap.min, place: q, at: snap.at
        });
        renderDiaryWeather();
        scheduleDiarySave();
      }).catch(function () {
        if (seq !== diaryWeatherSeq) return;
        // 离线、超时或没有该地点：保留已保存的快照，不清空
        if (isEn() && state.diaryDraft && state.diaryDraft.weatherOn) {
          diaryWeatherNote = T('没有查到这里的天气，换个更具体的位置试试');
        }
        renderDiaryWeather();
      });
    }, 240);
  }

  // ---------- 省市区县滚轮（regions.js / districts.js 内置表，完全离线）----------
  const regionPicker = { open: false, province: 0, city: 0, district: 0 };

  function regionData() {
    return Array.isArray(window.CN_REGIONS) ? window.CN_REGIONS : [];
  }

  // 第三级区县：表里没有的城市只保留「不限」一项，绝不联网补数据
  function districtsFor(city) {
    const map = window.CN_DISTRICTS;
    if (!map || !city || !Array.isArray(map[city])) return [];
    return map[city];
  }

  function districtOptionsFor(picker) {
    const data = regionData();
    const p = data[picker.province] || data[0];
    const city = p ? p.cities[picker.city] : '';
    return [NO_DISTRICT].concat(districtsFor(city));
  }

  function districtOptions() {
    return districtOptionsFor(regionPicker);
  }

  // 两个面板共用同一套滚轮逻辑，各自持有一份 picker 状态和元素 id
  const REGION_WHEEL_IDS = { province: '#regionProvince', city: '#regionCity', district: '#regionDistrict' };
  const CITY_WHEEL_IDS = { province: '#cityProvince', city: '#cityCity', district: '#cityDistrict' };

  function wheelEls(ids) {
    return { province: $(ids.province), city: $(ids.city), district: $(ids.district) };
  }

  function renderPickerWheels(picker, ids) {
    const data = regionData();
    if (!data.length) return;
    const els = wheelEls(ids);
    const pi = Math.max(0, Math.min(data.length - 1, picker.province));
    picker.province = pi;
    buildRegionWheel(els.province, data.map(function (p) { return p.province; }), pi, function (idx) {
      if (idx === picker.province) return;
      picker.province = idx;
      picker.city = 0;
      picker.district = 0;
      // 只重建二、三级；省列已经在用户松手的位置，不必回贴
      paintCityWheel(picker, els);
    });
    paintCityWheel(picker, els);
  }

  function paintCityWheel(picker, els) {
    const data = regionData();
    const p = data[picker.province] || data[0];
    const cities = p.cities;
    const ci = Math.max(0, Math.min(cities.length - 1, picker.city));
    picker.city = ci;
    buildRegionWheel(els.city, cities, ci, function (i) {
      picker.city = i;
      picker.district = 0;
      paintDistrictWheel(picker, els);
    });
    paintDistrictWheel(picker, els);
  }

  function paintDistrictWheel(picker, els) {
    const values = districtOptionsFor(picker);
    const di = Math.max(0, Math.min(values.length - 1, picker.district));
    picker.district = di;
    buildRegionWheel(els.district, values, di, function (i) {
      picker.district = i;
    });
  }

  function renderRegionWheels() {
    renderPickerWheels(regionPicker, REGION_WHEEL_IDS);
  }

  function buildRegionWheel(el, values, index, onPick) {
    if (!el) return;
    // 吸附步长取自每列 data-item-h（缺省 40px，与 CSS .wheel-item 行高一致）；
    // 行高改小时必须同步改这个属性，否则松手会错位
    const itemH = function () { return Number(el.dataset.itemH) || 40; };
    const at = Math.max(0, Math.min(values.length - 1, index || 0));
    el.innerHTML = values.map(function (v) {
      return '<div class="wheel-item">' + esc(v) + '</div>';
    }).join('');
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      let timer = null;
      let drag = null;
      let raf = 0;

      // 松手后按最近一项吸附
      function snapNow(smooth) {
        if (!el.children.length) return;
        const idx = Math.max(0, Math.min(el.children.length - 1, Math.round(el.scrollTop / itemH())));
        const top = idx * itemH();
        cancelAnimationFrame(raf);
        if (smooth) {
          el.scrollTo({ top: top, behavior: 'smooth' });
        } else {
          el.scrollTop = top;
        }
        Array.prototype.forEach.call(el.children, function (c, i) {
          c.classList.toggle('active', i === idx);
        });
        if (el._onPick) el._onPick(idx);
      }

      function moveTo(y) {
        if (!drag) return;
        el.scrollTop = drag.top - (y - drag.y);
      }

      // 触摸主通道：passive:false + preventDefault，避免被祖先滚动抢走
      el.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        drag = { y: e.touches[0].clientY, top: el.scrollTop };
        e.stopPropagation();
      }, { passive: true });

      el.addEventListener('touchmove', function (e) {
        if (!drag || e.touches.length !== 1) return;
        moveTo(e.touches[0].clientY);
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }, { passive: false });

      ['touchend', 'touchcancel'].forEach(function (type) {
        el.addEventListener(type, function (e) {
          if (!drag) return;
          drag = null;
          e.stopPropagation();
          if (navigator.vibrate) navigator.vibrate(6);
          snapNow(true);
        }, { passive: true });
      });

      // 鼠标也支持拖动
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        drag = { y: e.clientY, top: el.scrollTop };
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerType === 'touch') return;
        moveTo(e.clientY);
      });
      el.addEventListener('pointerup', function () {
        if (!drag) return;
        drag = null;
        snapNow(true);
      });

      el.addEventListener('scroll', function () {
        if (drag) return;
        clearTimeout(timer);
        timer = setTimeout(function () { snapNow(true); }, 140);
      }, { passive: true });
    }
    el._onPick = onPick;
    Array.prototype.forEach.call(el.children, function (c, i) {
      c.classList.toggle('active', i === at);
    });
    el.scrollTop = at * itemH();
  }

  function openRegionSheet() {
    // 英文模式不展示内置中文省市数据：入口按钮已隐藏，这里再兜一层，
    // 防止任何其它路径（历史绑定、快捷键、后续新增入口）把滚轮翻出来
    if (isEn()) return;
    const data = regionData();
    if (!data.length) return;
    // 先收起软键盘：浮层贴在底部，键盘还在时会被顶出可视区
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    document.body.classList.add('region-open');
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
    // 恢复第三级：命中内置区县就停在那一项，否则回到「不限」
    regionPicker.district = 0;
    if (loc && loc.district) {
      const found = districtOptions().indexOf(loc.district);
      if (found !== -1) regionPicker.district = found;
    }
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
    document.body.classList.remove('region-open');
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
    const options = districtOptions();
    const district = regionPicker.district > 0 ? (options[regionPicker.district] || '') : '';
    const draft = state.diaryDraft;
    const text = draft && draft.location ? draft.location.text : '';
    diarySetLocation({ province: p.province, city: city, district: district, text: text });
    closeRegionSheet();
    haptic(8);
  }

  function renderDiaryMoods() {
    const draft = state.diaryDraft;
    if (!draft) return;
    const list = moodAll();
    const html = list.map(function (m) {
      const active = draft.mood === m.id;
      return '<button class="de-mood' + (active ? ' active' : '') + (m.custom ? ' custom' : '') + '"' +
        ' type="button" data-mood="' + m.id + '" aria-pressed="' + active + '"' +
        (m.color ? ' style="--mood-color:' + esc(m.color) + '"' : '') + '>' +
        moodIconHTML(m.id, 'de-mood-face') +
        '<span>' + esc(m.label) + '</span>' +
      '</button>';
    }).join('');
    $('#deMoods').innerHTML = html +
      '<button class="de-mood de-mood-add" type="button" data-mood-manage>' +
        '<svg class="de-mood-face" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.2v11.6M6.2 12h11.6"/></svg>' +
        '<span>' + esc(T('自定义')) + '</span>' +
      '</button>';
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

  async function openDiaryAttachment(id, attachments) {
    // 详情页与写作页共用：详情页直接传自己的附件列表，不改动 state.diaryDraft，
    // 避免异步取文件期间自动保存读到一份缺字段的草稿
    const list = attachments || (state.diaryDraft && state.diaryDraft.attachments) || [];
    const meta = list.find(function (a) { return a.id === id; });
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
      shareImageBlob = null;
      const saveBtn = $('#diaryViewerSave');
      if (saveBtn) saveBtn.hidden = true;
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      if (vid.dataset.url) {
        try { URL.revokeObjectURL(vid.dataset.url); } catch (err) { /* 忽略 */ }
      }
      const url = URL.createObjectURL(rec.data);
      vid.dataset.url = url;
      vid.src = url;
      vid.hidden = false;
      $('#diaryViewerName').textContent = meta.name;
      viewer.scrollTop = 0;
      viewer.hidden = false;
      requestAnimationFrame(function () { viewer.classList.add('open'); });
      return;
    }
    if (meta.kind === 'image') {
      const viewer = $('#diaryViewer');
      const img = $('#diaryViewerImg');
      const vid = $('#diaryViewerVideo');
      shareImageBlob = null;
      const saveBtn = $('#diaryViewerSave');
      if (saveBtn) saveBtn.hidden = true;
      if (vid) { vid.hidden = true; vid.pause(); vid.removeAttribute('src'); }
      if (img.dataset.url) {
        try { URL.revokeObjectURL(img.dataset.url); } catch (err) { /* 忽略 */ }
      }
      const url = URL.createObjectURL(rec.data);
      img.dataset.url = url;
      img.src = url;
      $('#diaryViewerName').textContent = meta.name;
      viewer.scrollTop = 0;
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
    shareImageBlob = null;
    const saveBtn = $('#diaryViewerSave');
    if (saveBtn) saveBtn.hidden = true;
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
      weather: draft.weather ? Object.assign({}, draft.weather) : null,
      weatherOn: draft.weatherOn === true,
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
    $('#diaryManageAll').addEventListener('click', selectAllDiary);
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
      // 非管理态交给 #diaryBody 自己的 click 处理器（统一走详情页 + 滑动/长按判定）
      return;
    });

    $('#diaryBody').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest && e.target.closest('[data-diary-open]');
      if (!card) return;
      e.preventDefault();
      const date = card.dataset.diaryOpen;
      if (state.diaryManage) toggleDiarySel(date, card);
      else openDiaryDetail(date);
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
    $('#deLocCurrent').addEventListener('click', useWeatherCityAsLocation);
    // 英文模式：勾选后才用「手动填写的位置」查天气；取消勾选立刻停止查询并收起
    const wxToggle = $('#deWxToggle');
    if (wxToggle) {
      wxToggle.addEventListener('change', function (e) {
        const draft = state.diaryDraft;
        if (!draft) return;
        draft.weatherOn = !!e.target.checked;
        if (!draft.weatherOn) draft.weather = null;
        state.diaryDirty = true;
        scheduleDiarySave();
        renderDiaryWeather();
        refreshDiaryWeather(true);
        haptic(6);
      });
    }
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
      if (e.target.closest('[data-mood-manage]')) {
        haptic(8);
        openMoodPage(true);
        return;
      }
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
    $('#diaryViewerSave').addEventListener('click', function (e) {
      e.stopPropagation();
      saveShareImage();
    });
    // 浏览器 / 部分环境长按会派发 contextmenu：拦下来直接走同一条保存路径
    $('#diaryViewerImg').addEventListener('contextmenu', function (e) {
      if (!shareImageBlob) return;
      e.preventDefault();
      saveShareImage();
    });
    $('#diaryViewer').addEventListener('click', function (e) {
      // 预览区可滚动后，空白处由 .dv-stage 撑满，点它也算点背景
      if (e.target === $('#diaryViewer') || e.target === $('#diaryViewerStage')) closeDiaryViewer();
    });

    // ---------- 日记详情页 ----------
    $('#ddBack').addEventListener('click', closeDiaryDetail);
    $('#ddEdit').addEventListener('click', function () {
      const date = diaryDetailDate;
      closeDiaryDetail();
      openDiaryEditor(date);
    });
    $('#ddBody').addEventListener('click', function (e) {
      const shared = e.target.closest('[data-dd-share]');
      if (shared) { shareDiaryLongImage(); return; }
      const media = e.target.closest('[data-dd-media]');
      if (media) { openDiaryDetailMedia(media.dataset.ddMedia); return; }
    });

    // ---------- 日记卡片：时间线左滑 / 网格长按 ----------
    let diaryLockUntil = 0;
    let dcSwipe = null;

    function dcSwipeClose(wrap, card) {
      if (!wrap) return;
      wrap.classList.remove('swiped');
      if (card) card.style.transform = '';
    }

    function openDiaryPop(date, x, y) {
      const pop = $('#diaryPop');
      pop.dataset.date = date;
      pop.hidden = false;
      const w = 128;
      const h = 96;
      pop.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, x - w / 2)) + 'px';
      pop.style.top = Math.max(10, Math.min(window.innerHeight - h - 10, y - h / 2)) + 'px';
    }

    function closeDiaryPop() {
      const pop = $('#diaryPop');
      if (pop) pop.hidden = true;
    }

    $('#diaryBody').addEventListener('pointerdown', function (e) {
      if (state.diaryManage) return;
      const wrap = e.target.closest('.dc-swipe');
      const card = wrap ? wrap.querySelector('.diary-card') : null;
      if (card && !e.target.closest('.dc-swipe-actions')) {
        dcSwipe = {
          wrap: wrap,
          card: card,
          x: e.clientX,
          y: e.clientY,
          base: wrap.classList.contains('swiped') ? -136 : 0,
          dx: 0,
          moved: false,
          timer: 0
        };
      }
      const tile = e.target.closest('.dcard');
      if (tile && tile.dataset.diaryCard) {
        const date = tile.dataset.diaryCard;
        const px = e.clientX;
        const py = e.clientY;
        dcSwipe = dcSwipe || { wrap: null, card: null, x: px, y: py, dx: 0, moved: false, timer: 0 };
        dcSwipe.timer = window.setTimeout(function () {
          dcSwipe.timer = 0;
          diaryLockUntil = Date.now() + 520;
          haptic(12);
          openDiaryPop(date, px, py);
        }, 420);
      }
    });

    $('#diaryBody').addEventListener('pointermove', function (e) {
      if (!dcSwipe) return;
      const dx = e.clientX - dcSwipe.x;
      const dy = e.clientY - dcSwipe.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (Math.abs(dy) > Math.abs(dx)) { clearTimeout(dcSwipe.timer); dcSwipe.moved = true; return; }
        if (Math.abs(dx) > 8) {
          clearTimeout(dcSwipe.timer);
          dcSwipe.timer = 0;
          dcSwipe.moved = true;
        }
        if (dcSwipe.card) {
          const offset = Math.max(-136, Math.min(0, dcSwipe.base + dx));
          dcSwipe.card.style.transform = 'translateX(' + offset + 'px)';
          dcSwipe.dx = offset;
        }
      }
    });

    function endDiarySwipe() {
      if (!dcSwipe) return;
      clearTimeout(dcSwipe.timer);
      if (dcSwipe.moved && dcSwipe.card) {
        const open = dcSwipe.dx <= -68;
        $$('.dc-swipe.swiped').forEach(function (w) {
          if (w !== dcSwipe.wrap) dcSwipeClose(w, w.querySelector('.diary-card'));
        });
        dcSwipe.wrap.classList.toggle('swiped', open);
        dcSwipe.card.style.transform = open ? 'translateX(-136px)' : '';
        diaryLockUntil = Date.now() + 260;
      }
      dcSwipe = null;
    }

    $('#diaryBody').addEventListener('pointerup', endDiarySwipe);
    $('#diaryBody').addEventListener('pointercancel', endDiarySwipe);

    $('#diaryBody').addEventListener('click', function (e) {
      const act = e.target.closest('[data-diary-act]');
      if (act) {
        e.preventDefault();
        e.stopPropagation();
        const date = act.dataset.date;
        if (act.dataset.diaryAct === 'edit') {
          closeDiaryPop();
          openDiaryEditor(date);
        } else {
          closeDiaryPop();
          confirmDeleteDiary(date);
        }
        return;
      }
      if (Date.now() < diaryLockUntil) return;
      const card = e.target.closest('[data-diary-open]');
      if (card) {
        const wrap = card.closest('.dc-swipe');
        if (wrap && wrap.classList.contains('swiped')) { dcSwipeClose(wrap, card); return; }
        if (state.diaryManage) return;
        openDiaryDetail(card.dataset.diaryOpen);
      }
    });

    $('#diaryPop').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-diary-pop]');
      if (!btn) return;
      const date = $('#diaryPop').dataset.date;
      closeDiaryPop();
      if (btn.dataset.diaryPop === 'edit') openDiaryEditor(date);
      else confirmDeleteDiary(date);
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('#diaryPop') && !e.target.closest('.dcard')) closeDiaryPop();
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
    // 旧代号（light-schedule）的数据先迁移到新库/新键，再读取，避免「打开就空了」
    await migrateLegacyStore();
    await loadAll();
    // 旧纪念日缺 direction/repeat/calendar：读入时已按日期推断，这里把推断结果写回存储一次
    if (cdNeedsMigration) {
      cdNeedsMigration = false;
      try { await persistCountdowns(true); } catch (err) { /* 写不进去也不影响当次显示 */ }
    }
    if (state.migrationLog.length) {
      state.meta.migrationLog = state.migrationLog.slice();
      try { await persistMeta(); } catch (err) { /* 迁移日志写不进去不影响数据 */ }
    }

    // 已保存过语言（在数据里）就以后者为准
    if (state.meta.lang && window.I18N && state.meta.lang !== window.I18N.lang) {
      window.I18N.setLang(state.meta.lang);
      try { localStorage.setItem(LANG_MIRROR_KEY, state.meta.lang); } catch (err) { /* 忽略 */ }
    }

    // 英文且存的是「黄历」：启动时迁到「星座」，否则控件里没有对应项
    if (migrateCalendarCardForLang()) {
      try { await persistMeta(); } catch (err) { /* 写不进去也不影响当次显示 */ }
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
    // 旧版本可能在 html 上留过字号档位属性，启动时清掉，避免残留状态
    document.documentElement.removeAttribute('data-fs');
    updateStorageBanner();
    renderAll();
    initWeather();
    registerSW();
    scheduleNextMidnight();
    setInterval(onTick, 30000);

    // 开屏结束后的顺序：协议确认 → 主界面
    onSplashDone(function () { maybeShowAgreement(); });
  }

  boot().catch(function (err) {
    console.error('启动失败：', err);
    storage.status = 'memory';
    updateStorageBanner();
    showToast(T('启动时遇到问题，已切换到内存模式'));
  });
})();
