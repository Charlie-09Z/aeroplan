/* =========================================================
   氢计划 / AeroPlan · 天气模块（v0.8.0）
   数据源：Open-Meteo（免费、无需 API key、无 cookie、无追踪）。
   只请求每日所需的三个字段，不做统计，也不加载任何第三方 SDK。
   位置：只能由用户输入关键词搜索选择。应用不读取设备定位、
   不申请定位权限，也没有后台追踪；所选地点的经纬度只用于查询天气。
   搜索：当前只有 Photon（基于 OpenStreetMap，免密钥、可跨域）一个
   provider，但调用点走 SEARCH_PROVIDERS 来源链，便于将来替换来源。
   图标：Lucide 图标集（ISC License），以 SVG 内联随应用本地打包。
   ========================================================= */

(function () {
  'use strict';

  var CACHE_MS = 45 * 60 * 1000;      // 45 分钟刷新一次，避免高频轮询
  var FORECAST_DAYS = 16;            // Open-Meteo 允许的上限
  var STALE_MS = 6 * 60 * 60 * 1000; // 超过 6 小时标注「可能已过期」
  var WCACHE_KEY = 'aeroplan.cache.weather.v1';

  var opts = {
    t: function (s) { return s; },
    isEn: function () { return false; },
    meta: null,
    persist: null
  };

  var store = {
    city: null,          // 用户搜索并选择的地点 {name, latitude, longitude, label}
    data: null,          // {time:[], code:[], max:[], min:[], label:''}
    at: 0,               // 上次成功拉取的时间
    pending: null,
    gen: 0,              // 清理代号：丢弃清理前发出的请求结果
    el: null,
    key: '',
    enabled: true,       // 天气开关；关闭后不请求、不写缓存、不渲染
    abort: null          // 当前在途请求的 AbortController
  };

  // ---------- 图标（内联 SVG，currentColor 随主题变化） ----------
  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    partly: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2v1.8M5.6 5.6l1.2 1.2M3.2 12h1.8"/><circle cx="9.4" cy="12.2" r="3"/><path d="M18 19H10.5a5.2 5.2 0 1 1 4.99-7h1.34a3.5 3.5 0 0 1 1.17 7Z"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    fog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14H10a5 5 0 1 1 4.79-6.42A4.5 4.5 0 0 1 17.5 14Z"/><path d="M5 18h14M7 21.5h10"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14H10a5 5 0 1 1 4.79-6.42A4.5 4.5 0 0 1 17.5 14Z"/><path d="M9 17.5v2M13 16.8v2.6M17 17.5v2"/></svg>',
    rain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14H10a5 5 0 1 1 4.79-6.42A4.5 4.5 0 0 1 17.5 14Z"/><path d="M9 16.8v4.4M13 16.8v5.4M17 16.8v4.4"/></svg>',
    snow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14H10a5 5 0 1 1 4.79-6.42A4.5 4.5 0 0 1 17.5 14Z"/><path d="M9 17.5h.01M13 17h.01M17 17.6h.01M11 21h.01M15 20.6h.01"/></svg>',
    storm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 13.5H10a5 5 0 1 1 4.79-6.42A4.5 4.5 0 0 1 17.5 13.5Z"/><path d="M12.6 15.4 10 19h3l-1.6 3.4"/></svg>'
  };

  // WMO 天气代码 → 图标 / 中文 / 英文
  var CODES = {
    0: ['sun', '晴', 'Clear'],
    1: ['partly', '晴间多云', 'Mostly clear'],
    2: ['partly', '多云', 'Partly cloudy'],
    3: ['cloudy', '阴', 'Overcast'],
    45: ['fog', '雾', 'Fog'],
    48: ['fog', '雾凇', 'Rime fog'],
    51: ['drizzle', '毛毛雨', 'Light drizzle'],
    53: ['drizzle', '毛毛雨', 'Drizzle'],
    55: ['drizzle', '毛毛雨', 'Dense drizzle'],
    56: ['drizzle', '冻雨', 'Freezing drizzle'],
    57: ['drizzle', '冻雨', 'Freezing drizzle'],
    61: ['rain', '小雨', 'Light rain'],
    63: ['rain', '中雨', 'Rain'],
    65: ['rain', '大雨', 'Heavy rain'],
    66: ['rain', '冻雨', 'Freezing rain'],
    67: ['rain', '冻雨', 'Freezing rain'],
    71: ['snow', '小雪', 'Light snow'],
    73: ['snow', '中雪', 'Snow'],
    75: ['snow', '大雪', 'Heavy snow'],
    77: ['snow', '米雪', 'Snow grains'],
    80: ['rain', '阵雨', 'Showers'],
    81: ['rain', '阵雨', 'Showers'],
    82: ['rain', '强阵雨', 'Heavy showers'],
    85: ['snow', '阵雪', 'Snow showers'],
    86: ['snow', '阵雪', 'Snow showers'],
    95: ['storm', '雷阵雨', 'Thunderstorm'],
    96: ['storm', '雷暴冰雹', 'Storm with hail'],
    99: ['storm', '雷暴冰雹', 'Storm with hail']
  };

  var ICON_TONE = {
    sun: 'wx-sun',
    partly: 'wx-sun',
    cloudy: '',
    fog: '',
    drizzle: 'wx-rain',
    rain: 'wx-rain',
    snow: 'wx-snow',
    storm: 'wx-storm'
  };

  function T(s, vars) { return opts.t(s, vars); }
  function isEn() { return !!opts.isEn(); }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function keyToDate(key) {
    var p = String(key).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 选中日期落在预报范围内（今天的 16 天内）才显示天气
  function forecastLastKey() {
    var d = keyToDate(todayKey());
    d.setDate(d.getDate() + FORECAST_DAYS - 1);
    return dateKey(d);
  }

  function normalizeCity(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var lat = Number(raw.latitude);
    var lon = Number(raw.longitude);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    var name = String(raw.name || '').trim().slice(0, 40);
    if (!name) return null;
    var label = String(raw.label || '').trim().slice(0, 48);
    return { name: name, latitude: lat, longitude: lon, label: label || name };
  }

  // ---------- 离线缓存：城市 + 日期，一处只保留最新一条 ----------
  // 每次成功拉取后写入 localStorage（与应用的 kv 层同一存储）；
  // 数据结构：{ cityKey, at, days: { 'YYYY-MM-DD': {code,max,min} } }
  // 只有一个当前城市，切换城市时整块丢弃；写入时整块覆盖，日期条目不会堆积。

  function citySignature(c) {
    return c ? (c.latitude.toFixed(3) + ',' + c.longitude.toFixed(3)) : '';
  }

  function dropWeatherCache() {
    try { localStorage.removeItem(WCACHE_KEY); } catch (err) { /* 隐私模式下忽略 */ }
  }

  function loadWeatherCache(c) {
    if (!c) return null;
    try {
      var raw = localStorage.getItem(WCACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.cityKey !== citySignature(c) || !obj.days || !isFinite(Number(obj.at))) return null;
      var lo = todayKey();
      var hi = forecastLastKey();
      var keys = Object.keys(obj.days).filter(function (k) { return k >= lo && k <= hi; }).sort();
      if (!keys.length) return null;
      return {
        at: Number(obj.at),
        data: {
          time: keys,
          code: keys.map(function (k) { return obj.days[k].code; }),
          max: keys.map(function (k) { return obj.days[k].max; }),
          min: keys.map(function (k) { return obj.days[k].min; }),
          label: c.name
        }
      };
    } catch (err) {
      return null; // 解析异常时当作没有缓存，不影响界面
    }
  }

  function saveWeatherCache(c, data, at) {
    if (!c || !data || !Array.isArray(data.time)) return;
    try {
      // 整块覆盖：每个「城市 + 日期」只留这一份最新数据，旧日期与旧副本
      // 随这次写入一起被替换掉，不会累积历史记录。
      var days = {};
      data.time.forEach(function (k, i) {
        days[k] = { code: data.code[i], max: data.max[i], min: data.min[i] };
      });
      localStorage.setItem(WCACHE_KEY, JSON.stringify({
        v: 1,
        cityKey: citySignature(c),
        city: { name: c.name, label: c.label },
        at: at,
        days: days
      }));
    } catch (err) { /* 写入失败不影响展示 */ }
  }

  // ---------- 配置与对外状态 ----------

  function configure(o) {
    if (!o) return;
    if (o.t) opts.t = o.t;
    if (o.isEn) opts.isEn = o.isEn;
    if (o.meta) opts.meta = o.meta;
    if (o.persist) opts.persist = o.persist;
    // 老数据没有 weatherEnabled 字段时按默认开启处理
    store.enabled = !(opts.meta && opts.meta.weatherEnabled === false);
    store.city = normalizeCity(opts.meta && opts.meta.weatherCity);
    // 启动时先用本地缓存立即可显示，随后由 refresh() 在后台更新
    var cached = loadWeatherCache(store.city);
    store.data = cached ? cached.data : null;
    store.at = cached ? cached.at : 0;
    localizeCityLabel(store.city);
  }

  // 开关：关闭时作废在途请求、停止写缓存；重新打开时先用缓存立即渲染
  function setEnabled(on) {
    var next = !!on;
    if (store.enabled === next) return;
    store.enabled = next;
    if (!next) {
      store.gen++;
      store.pending = null;
      if (store.abort) {
        try { store.abort.abort(); } catch (err) { /* 忽略 */ }
        store.abort = null;
      }
      render();
      return;
    }
    var cached = loadWeatherCache(store.city);
    store.data = cached ? cached.data : null;
    store.at = cached ? cached.at : 0;
    render();
    refresh(true);
  }

  function city() { return store.city; }

  function cityLabel() {
    if (store.city) return store.city.label || store.city.name;
    return T('未选择城市');
  }

  function saveCity(cityObj) {
    if (!opts.meta) return;
    if (cityObj) opts.meta.weatherCity = cityObj;
    else delete opts.meta.weatherCity;
    if (opts.persist) opts.persist();
  }

  function setCity(cityObj) {
    var c = normalizeCity(cityObj);
    if (!c) return false;
    // 换城市：旧城市的缓存整块丢弃，再尝试载入新城市缓存
    if (store.city && citySignature(store.city) !== citySignature(c)) dropWeatherCache();
    store.city = c;
    saveCity(c);
    localizeCityLabel(c);
    var cached = loadWeatherCache(c);
    store.data = cached ? cached.data : null;
    store.at = cached ? cached.at : 0;
    if (store.enabled) refresh(true);
    else render();
    return true;
  }

  function clearCity() {
    store.city = null;
    saveCity(null);
    store.data = null;
    store.at = 0;
    dropWeatherCache();
    return true;
  }

  // ---------- 天气位置：只来自用户搜索选择的地点 ----------

  function resolvePosition() {
    if (!store.city) return Promise.reject(new Error('no-city'));
    return Promise.resolve({
      latitude: store.city.latitude,
      longitude: store.city.longitude,
      label: store.city.name
    });
  }

  // ---------- 拉取天气 ----------

  function fetchForecast(pos) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + pos.latitude.toFixed(3) +
      '&longitude=' + pos.longitude.toFixed(3) +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&forecast_days=' + FORECAST_DAYS +
      '&timezone=auto';

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 9000) : null;
    if (controller) store.abort = controller;

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      store.abort = null;
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    }).then(function (json) {
      var daily = json && json.daily;
      if (!daily || !Array.isArray(daily.time)) throw new Error('bad-payload');
      // 只保留当前需要的窗口（今天到预报上限），不累积历史天气
      var lo = todayKey();
      var hi = forecastLastKey();
      var keep = [];
      daily.time.forEach(function (k, i) {
        if (k >= lo && k <= hi) keep.push(i);
      });
      if (!keep.length) throw new Error('empty-window');
      return {
        time: keep.map(function (i) { return daily.time[i]; }),
        code: keep.map(function (i) { return (daily.weather_code || [])[i]; }),
        max: keep.map(function (i) { return (daily.temperature_2m_max || [])[i]; }),
        min: keep.map(function (i) { return (daily.temperature_2m_min || [])[i]; }),
        label: pos.label
      };
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      store.abort = null;
      throw err;
    });
  }

  function refresh(force) {
    // 天气关闭时完全不联网：不请求、不写缓存
    if (!store.enabled) { render(); return Promise.resolve(store.data); }
    if (store.pending) return store.pending;
    var now = Date.now();
    // 缓存优先：先用已有数据立即渲染，再决定是否后台更新
    render();
    if (!force && store.data && now - store.at < CACHE_MS) {
      return Promise.resolve(store.data);
    }

    var cityRef = store.city;
    var gen = store.gen;
    store.pending = resolvePosition()
      .then(fetchForecast)
      .then(function (data) {
        if (gen !== store.gen) return;
        store.data = data;
        store.at = Date.now();
        saveWeatherCache(cityRef, data, store.at);
      })
      .catch(function () {
        // 离线或失败：保留上一次有效缓存，不清空、不弹错误框；
        // 从未成功拉取过时保持占位状态。
        if (gen !== store.gen) return;
      })
      .then(function () {
        if (gen !== store.gen) return;
        store.pending = null;
        render();
      });
    return store.pending;
  }

  // 清空数据 / 退出时调用：天气数据、离线缓存与所选地点一并丢弃
  function clearCache() {
    store.gen++;
    store.data = null;
    store.at = 0;
    store.pending = null;
    store.city = null;
    dropWeatherCache();
    try {
      localStorage.removeItem(PLACE_ZH_KEY);
      placeZhMemo = null;
    } catch (err) { /* 忽略 */ }
    if (opts.meta && opts.meta.weatherCity) {
      delete opts.meta.weatherCity;
      if (opts.persist) opts.persist();
    }
    render();
  }

  function cacheStats() {
    return {
      forecastDays: (store.data && Array.isArray(store.data.time)) ? store.data.time.length : 0,
      pending: store.pending ? 1 : 0
    };
  }

  // ---------- 渲染 ----------

  function setEl(el, key) {
    store.el = el || null;
    store.key = key || '';
  }

  function render() {
    var el = store.el;
    if (!el || !el.isConnected) return;
    paint(el, store.key);
  }

  // 供其他模块（如日记天气）复用同一套图标与文案，保证风格一致
  function infoFor(code) {
    var e = CODES[code];
    if (!e) return null;
    return { key: e[0], icon: ICONS[e[0]], tone: ICON_TONE[e[0]] || '', zh: e[1], en: e[2] };
  }

  // 按「用户自己选的地名」查当天天气：只用于日记快照，不读设备定位
  function dailyForPlace(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.reject(new Error('no-place'));
    return search(q).then(function (list) {
      if (!list || !list.length) throw new Error('no-place');
      return fetchForecast(list[0]);
    }).then(function (data) {
      var key = todayKey();
      var idx = data.time.indexOf(key);
      if (idx === -1) throw new Error('no-today');
      return {
        code: data.code[idx],
        max: data.max[idx],
        min: data.min[idx],
        date: key,
        at: Date.now()
      };
    });
  }

  function paint(el, key) {
    // 关闭天气：整块移除，不留占位、不撑高度
    if (!store.enabled) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    var today = todayKey();
    // 只显示选中日期当天：过去日期、超出预报范围时都不猜数据
    if (!key || key < today || key > forecastLastKey()) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    el.hidden = false;

    if (!store.data) {
      el.innerHTML = weatherPlaceholder();
      return;
    }

    var idx = store.data.time.indexOf(key);
    if (idx === -1) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    var entry = CODES[store.data.code[idx]] || ['cloudy', '阴', 'Overcast'];
    var desc = isEn() ? entry[2] : entry[1];
    var max = store.data.max[idx];
    var min = store.data.min[idx];
    var maxText = isFinite(Number(max)) ? Math.round(Number(max)) + '°' : '—';
    var minText = isFinite(Number(min)) ? Math.round(Number(min)) + '°' : '';
    var tip = desc + ' ' + maxText + (minText ? ' / ' + minText : '');
    // 地名只用用户选择时记录的城市 · 区县，不再反查坐标
    var placeText = (store.city && (store.city.label || store.city.name)) || '';

    // 数据新鲜度：缓存优先时也能看出是哪次拉取的；超过 6 小时提示可能过期
    var freshText = '';
    var stale = false;
    if (store.at) {
      var pulled = new Date(store.at);
      var hhmm = pad2(pulled.getHours()) + ':' + pad2(pulled.getMinutes());
      stale = Date.now() - store.at > STALE_MS;
      freshText = T(stale ? '更新于 {time} · 可能已过期' : '更新于 {time}', { time: hhmm });
    }

    // 固定四行，每行一个块级元素：图标+温度 / 状况 / 城市 · 区县 / 更新时间
    el.innerHTML = '<div class="wx-now" title="' + esc(tip + (placeText ? ' · ' + placeText : '')) +
      '" aria-label="' + esc(tip) + '">' +
      '<div class="wx-row wx-now-main">' +
        '<span class="wx-big ' + ICON_TONE[entry[0]] + '">' + ICONS[entry[0]] + '</span>' +
        '<span class="wx-temp">' + maxText + (minText ? '<i>/' + minText + '</i>' : '') + '</span>' +
      '</div>' +
      '<div class="wx-row wx-text">' + esc(desc) + '</div>' +
      (placeText ? '<div class="wx-row wx-place" title="' + esc(placeText) + '">' + esc(placeText) + '</div>' : '') +
      (freshText ? '<div class="wx-row wx-fresh' + (stale ? ' stale' : '') + '">' + esc(freshText) + '</div>' : '') +
    '</div>';
  }

  function weatherPlaceholder() {
    if (store.city) {
      return '<span class="wx-placeholder">—</span>';
    }
    // 还没有选择地点：给一个不打扰的手动入口（定位小图标 + 细字，热区靠 CSS 外扩）
    return '<button class="wx-city-btn" type="button" data-weather-city="1">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2s6.3-5.6 6.3-10.4a6.3 6.3 0 0 0-12.6 0C5.7 15.6 12 21.2 12 21.2z"/><circle cx="12" cy="10.7" r="2.2"/></svg>' +
      '<span class="wx-city-btn-text">' + esc(T('选择城市')) + '</span></button>';
  }

  // ---------- 地点搜索：按顺序尝试的来源链 ----------
  // 目前只有 Photon 一个 provider。调用点不直接依赖具体服务，
  // 将来换来源时只改 SEARCH_PROVIDERS。provider 约定：
  //   (query) => Promise<Array<{name, latitude, longitude, label, region}>>

  // 行政区 + 常见机构/地点。这样「西湖区」这类区县名和「剑桥大学」
  // 这类机构名都能命中；结果仍会归到它所属的省/市/区县。
  var SEARCH_TAGS = [
    'place:state', 'place:province', 'place:city', 'place:town', 'place:village',
    'place:district', 'place:county', 'place:municipality',
    'amenity:university', 'amenity:college', 'amenity:school',
    'amenity:hospital', 'railway:station', 'aeroway:aerodrome',
    'tourism:attraction', 'tourism:museum'
  ];

  function cleanPlaceName(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    // 中文模式下部分条目会附带多语言别名，只保留中文那一段
    if (!isEn()) {
      var segs = s.split(/\s+/);
      for (var i = 0; i < segs.length; i++) {
        if (/[\u4e00-\u9fa5]/.test(segs[i])) { s = segs[i]; break; }
      }
    }
    return s.slice(0, 40);
  }

  // Photon 用 Accept-Language 决定返回哪种语言的 name。WebView 自带的默认值
  // 可能是 en-US，所以中文模式必须显式发 zh-CN，否则国内地名会回成英文/拼音。
  // 注意不要用 lang=zh：演示服务器只收录 de/en/fr 与本地语言，lang=zh 会被
  // 回落到服务端默认语言（英文），反而比不传更糟。
  function photonLangHeader() {
    return isEn() ? 'en' : 'zh-CN,zh;q=0.9,en;q=0.4';
  }

  function localizedNameOf(p, raw) {
    if (isEn()) {
      var en = p && (p['name:en'] || p['name:en-US']);
      return cleanPlaceName(en || raw);
    }
    var zh = p && (p['name:zh'] || p['name:zh-Hans'] || p['name:zh-CN'] || p['name:zh-Hant']);
    return cleanPlaceName(zh || raw);
  }

  function cityOf(p) {
    // 只用真正的「市 / 镇 / 村 / 直辖市」字段；不要把省当城市，
    // 否则城市级结果的小字会显示成「浙江省」而不是「杭州市」。
    return zhAdmin(p, 'city') || zhAdmin(p, 'town') || zhAdmin(p, 'village') || zhAdmin(p, 'municipality');
  }

  function districtOf(p) {
    return zhAdmin(p, 'district') || zhAdmin(p, 'city_district') || zhAdmin(p, 'county') ||
      zhAdmin(p, 'borough') || zhAdmin(p, 'suburb');
  }

  // Photon 的 city / district 字段不一定跟着 Accept-Language 本地化。
  // 中文界面下优先取同名字段的 :zh 变体；字段本身等于要素名时再用 name:zh。
  function zhAdmin(p, key) {
    var v = String(p[key] || '').trim();
    if (!v || isEn()) return v;
    var zh = p[key + ':zh'] || p[key + ':zh-Hans'] || p[key + ':zh-CN'] || p[key + ':zh-Hant'];
    if (zh) return String(zh).trim();
    if (v === String(p.name || '').trim()) {
      var nameZh = p['name:zh'] || p['name:zh-Hans'] || p['name:zh-CN'] || p['name:zh-Hant'];
      if (nameZh) return String(nameZh).trim();
    }
    return v;
  }

  function adminRegion(p, name) { // 省 · 市 · 区县，用于区分同名地点
    var parts = [];
    var push = function (v) {
      var s = String(v || '').trim();
      if (!s || parts.indexOf(s) !== -1) return;
      if (/^[A-Z]{1,3}$/.test(s)) return; // 只有缩写/国家代码时不展示
      parts.push(s.slice(0, 24));
    };
    push(p.state);
    push(cityOf(p));
    push(districtOf(p));
    if (p.countrycode && p.countrycode !== 'CN') push(p.country);
    if (!parts.length) push(name);
    return parts.join(' · ');
  }

  function shortLabelOf(p, name) { // 天气下方小字：城市 · 区县
    var parts = [];
    var push = function (v) {
      var s = String(v || '').trim();
      if (!s || parts.indexOf(s) !== -1) return;
      parts.push(s.slice(0, 24));
    };
    push(cityOf(p));
    push(districtOf(p));
    if (!parts.length) {
      push(name);
    } else if (parts.length === 1 && name && parts.indexOf(name) === -1) {
      // 区县节点常常没有 district 字段（名字本身就是区县），用名字补齐第二段
      push(name);
    }
    return parts.slice(0, 2).join(' · ');
  }

  // Photon 偶尔仍返回英文/拼音的市名。中文界面下用 Open-Meteo 的
  // language=zh 反查一次中文名并缓存；失败时保留原名，绝不显示空白。
  var PLACE_ZH_KEY = 'aeroplan.cache.place-zh.v1';
  var placeZhMemo = null;

  function placeZhMap() {
    if (placeZhMemo) return placeZhMemo;
    try {
      placeZhMemo = JSON.parse(localStorage.getItem(PLACE_ZH_KEY) || '{}') || {};
    } catch (err) {
      placeZhMemo = {};
    }
    return placeZhMemo;
  }

  function savePlaceZhMap() {
    try {
      var map = placeZhMap();
      var keys = Object.keys(map);
      if (keys.length > 120) {
        keys.slice(0, keys.length - 120).forEach(function (k) { delete map[k]; });
      }
      localStorage.setItem(PLACE_ZH_KEY, JSON.stringify(map));
    } catch (err) { /* 写入失败忽略 */ }
  }

  function translatePlaceName(raw) {
    var s = String(raw || '').trim();
    if (isEn() || !s || !/[A-Za-z]/.test(s) || /[\u4e00-\u9fa5]/.test(s)) {
      return Promise.resolve(s);
    }
    var map = placeZhMap();
    if (map[s]) return Promise.resolve(map[s]);

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
    var stop = function () { if (timer) clearTimeout(timer); };
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(s) +
      '&count=1&language=zh&format=json';

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      stop();
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    }).then(function (json) {
      var hit = json && json.results && json.results[0];
      var zh = hit && String(hit.name || '').trim();
      if (zh && /[\u4e00-\u9fa5]/.test(zh)) {
        map[s] = zh.slice(0, 24);
        savePlaceZhMap();
        return map[s];
      }
      return s;
    }).catch(function () {
      stop();
      return s;
    });
  }

  function localizeCityLabel(city) {
    if (!city || isEn()) return;
    var segs = String(city.label || city.name || '').split(' · ')
      .map(function (s) { return s.trim(); })
      .filter(Boolean).slice(0, 2);
    if (!segs.length) return;
    var needs = segs.some(function (s) {
      return /[A-Za-z]/.test(s) && !/[\u4e00-\u9fa5]/.test(s);
    });
    if (!needs) return;

    Promise.all(segs.map(function (s) {
      return (/[A-Za-z]/.test(s) && !/[\u4e00-\u9fa5]/.test(s)) ? translatePlaceName(s) : Promise.resolve(s);
    })).then(function (vals) {
      if (!store.city || citySignature(store.city) !== citySignature(city)) return;
      var label = vals.filter(Boolean).join(' · ');
      if (!label || label === store.city.label) return;
      if (segs[0] === city.name) city.name = vals[0] || city.name;
      city.label = label;
      saveCity(city);
      render();
    }).catch(function () { /* 翻译失败保留原名 */ });
  }

  function photonSearch(q) {
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=10';
    if (isEn()) url += '&lang=en';
    SEARCH_TAGS.forEach(function (tag) { url += '&osm_tag=' + tag; });

    // 一次只发一个请求；8 秒没返回就放弃，由调用方给出简短提示
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    function stop() { if (timer) clearTimeout(timer); }

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Accept': 'application/json', 'Accept-Language': photonLangHeader() },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      stop();
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    }).then(function (json) {
      var features = (json && json.features) || [];
      var seen = {};
      var list = [];
      features.forEach(function (f) {
        var p = (f && f.properties) || {};
        var ll = (f && f.geometry && f.geometry.coordinates) || [];
        var name = localizedNameOf(p, p.name);
        var lat = Number(ll[1]);
        var lon = Number(ll[0]);
        if (!name || !isFinite(lat) || !isFinite(lon)) return;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
        var region = adminRegion(p, name);
        var dedupe = name + '|' + region;
        if (seen[dedupe]) return;
        seen[dedupe] = 1;
        list.push({
          name: name,
          latitude: lat,
          longitude: lon,
          label: shortLabelOf(p, name),
          region: region
        });
      });
      return list;
    }).catch(function (err) {
      stop();
      throw err;
    });
  }

  var SEARCH_PROVIDERS = [photonSearch];

  function search(query) {
    if (!store.enabled) return Promise.resolve([]);
    var q = String(query || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    // 按顺序尝试：某个来源没命中就换下一个，全部失败才把错误抛给调用方
    function tryNext(i) {
      if (i >= SEARCH_PROVIDERS.length) return Promise.resolve([]);
      return SEARCH_PROVIDERS[i](q).then(function (list) {
        if (list && list.length) return list;
        return tryNext(i + 1);
      }, function (err) {
        if (i + 1 >= SEARCH_PROVIDERS.length) throw err;
        return tryNext(i + 1);
      });
    }
    return tryNext(0);
  }

  // ---------- 地址搜索：同样按来源链组织，调用点不写死具体服务 ----------
  // provider 约定：(query) => Promise<Array<{name, region, label, lat, lon}>>

  function joinAddrParts(parts) {
    var out = [];
    parts.forEach(function (part) {
      var text = String(part || '').trim();
      if (text && out.indexOf(text) === -1) out.push(text);
    });
    return out.join(' · ');
  }

  function photonMainName(p) {
    if (p.street) return p.street;
    if (p.name && p.osm_value !== 'postcode') return localizedNameOf(p, p.name);
    return p.district || p.suburb || p.neighbourhood || p.city || p.town || p.village || '';
  }

  function photonAddressResult(feature) {
    var p = (feature && feature.properties) || {};
    var coords = feature && feature.geometry && feature.geometry.coordinates;
    if (!coords || coords.length < 2) return null;
    var main = photonMainName(p);
    if (!main) return null;
    var adminParts = [
      p.city || p.town || p.village || p.municipality,
      p.district || p.city_district || p.county || p.borough,
      p.state,
      p.country && p.country !== '中国' && p.country !== 'China' ? p.country : ''
    ].map(function (part) {
      var text = String(part || '').trim();
      return /^[A-Z]{1,3}$/.test(text) ? '' : text;
    });
    var region = joinAddrParts(adminParts);
    var label = joinAddrParts([main].concat(adminParts)).slice(0, 160);
    return {
      name: main.slice(0, 40),
      region: region,
      label: label,
      lat: coords[1],
      lon: coords[0]
    };
  }

  function photonAddressSearch(q) {
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=8';
    if (isEn()) url += '&lang=en';

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    function stop() { if (timer) clearTimeout(timer); }

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Accept': 'application/json', 'Accept-Language': photonLangHeader() },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      stop();
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    }).then(function (json) {
      return ((json && json.features) || []).map(photonAddressResult).filter(Boolean);
    }).catch(function (err) {
      stop();
      throw err;
    });
  }

  var ADDRESS_PROVIDERS = [photonAddressSearch];

  function searchAddress(query) {
    if (!store.enabled) return Promise.resolve([]);
    var q = String(query || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    function tryNext(i) {
      if (i >= ADDRESS_PROVIDERS.length) return Promise.resolve([]);
      return ADDRESS_PROVIDERS[i](q).then(function (list) {
        if (list && list.length) return list;
        return tryNext(i + 1);
      }, function (err) {
        if (i + 1 >= ADDRESS_PROVIDERS.length) throw err;
        return tryNext(i + 1);
      });
    }
    return tryNext(0);
  }

  window.Weather = {
    configure: configure,
    setEnabled: setEnabled,
    isEnabled: function () { return store.enabled; },
    city: city,
    cityLabel: cityLabel,
    setCity: setCity,
    clearCity: clearCity,
    refresh: refresh,
    search: search,
    searchAddress: searchAddress,
    dailyForPlace: dailyForPlace,
    infoFor: infoFor,
    clearCache: clearCache,
    cacheStats: cacheStats,
    render: function (el, key) {
      setEl(el, key);
      render();
    }
  };
})();
