/* =========================================================
   氢计划 / AeroPlan · 天气模块（v0.5.0）
   数据源：Open-Meteo（免费、无需 API key、无 cookie、无追踪）。
   只请求每日所需的三个字段，不做统计，也不加载任何第三方 SDK。
   位置：优先使用设备定位（仅在已有授权时自动读取一次），
   失败或被拒绝时由用户手动选择城市并记住；不后台追踪、不上传坐标。
   区/县地名：坐标反查 BigDataCloud（优先）/ OpenStreetMap Nominatim（回落），
   仅一次并只在内存缓存。
   图标：Lucide 图标集（ISC License），以 SVG 内联随应用本地打包。
   ========================================================= */

(function () {
  'use strict';

  var CACHE_MS = 45 * 60 * 1000;      // 45 分钟刷新一次，避免高频轮询
  var FORECAST_DAYS = 16;            // Open-Meteo 允许的上限
  var GEO_TTL = 10 * 60 * 1000;      // 同一次会话内坐标最多复用 10 分钟
  var PLACE_MIN_GAP = 1000;          // 反查地名遵守 1 次/秒的频率限制

  var opts = {
    t: function (s) { return s; },
    isEn: function () { return false; },
    meta: null,
    persist: null
  };

  var store = {
    city: null,          // 手动选择的城市 {name, latitude, longitude}
    data: null,          // {time:[], code:[], max:[], min:[], label:''}
    at: 0,               // 上次成功拉取的时间
    pending: null,
    gen: 0,              // 清理代号：丢弃清理前发出的请求结果
    el: null,
    key: '',
    geo: null,           // {latitude, longitude, at}，仅内存，不写入存储
    geoBlocked: false,   // 定位不可用（拒绝 / 失败 / 不支持）
    place: null,         // {key, label}：反查地名只保留当前坐标这一份
    placeAt: 0           // 上次反查时间，用于遵守 1 次/秒
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

  function T(s) { return opts.t(s); }
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

  // ---------- 配置与对外状态 ----------

  function configure(o) {
    if (!o) return;
    if (o.t) opts.t = o.t;
    if (o.isEn) opts.isEn = o.isEn;
    if (o.meta) opts.meta = o.meta;
    if (o.persist) opts.persist = o.persist;
    store.city = normalizeCity(opts.meta && opts.meta.weatherCity);
  }

  function city() { return store.city; }

  function cityLabel() {
    if (store.city) return store.city.label || store.city.name;
    return T('自动定位');
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
    store.city = c;
    store.geoBlocked = false;
    saveCity(c);
    store.data = null;
    store.at = 0;
    refresh(true);
    return true;
  }

  function clearCity() {
    store.city = null;
    saveCity(null);
    store.data = null;
    store.at = 0;
    return true;
  }

  // ---------- 定位（只在需要更新天气时取一次） ----------

  function capGeo() {
    if (!window.Capacitor) return null;
    var plugins = window.Capacitor.Plugins || {};
    return plugins.Geolocation || null;
  }

  function checkGeoPermission() {
    var geo = capGeo();
    if (geo && typeof geo.checkPermissions === 'function') {
      return geo.checkPermissions().then(function (res) {
        var v = res && (res.location || res.coarseLocation);
        return v === 'granted' ? 'granted' : (v === 'denied' ? 'denied' : 'prompt');
      }).catch(function () { return 'prompt'; });
    }
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      return navigator.permissions.query({ name: 'geolocation' }).then(function (res) {
        return res.state === 'granted' ? 'granted' : (res.state === 'denied' ? 'denied' : 'prompt');
      }).catch(function () { return 'prompt'; });
    }
    return Promise.resolve('prompt');
  }

  function readPosition() {
    var geo = capGeo();
    if (geo && typeof geo.getCurrentPosition === 'function') {
      return geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
        .then(function (res) {
          return { latitude: res.coords.latitude, longitude: res.coords.longitude };
        });
    }
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) { resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
        function (err) { reject(err); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // 用户点了「使用当前位置」：会触发系统/浏览器授权，只读一次
  function useCurrentLocation() {
    store.geo = null;
    return readPosition().then(function (pos) {
      store.geo = { latitude: pos.latitude, longitude: pos.longitude, at: Date.now() };
      store.geoBlocked = false;
      if (store.city) {
        store.city = null;
        saveCity(null);
      }
      refresh(true);
      return true;
    }).catch(function () {
      store.geoBlocked = true;
      render();
      return false;
    });
  }

  // ---------- 拉取天气 ----------

  function resolvePosition() {
    if (store.city) {
      return Promise.resolve({
        latitude: store.city.latitude,
        longitude: store.city.longitude,
        label: store.city.name
      });
    }
    if (store.geo && Date.now() - store.geo.at < GEO_TTL) {
      return Promise.resolve({
        latitude: store.geo.latitude,
        longitude: store.geo.longitude,
        label: T('当前定位')
      });
    }
    return checkGeoPermission().then(function (state) {
      if (state !== 'granted') {
        store.geoBlocked = true;
        throw new Error('geo-' + state);
      }
      return readPosition().then(function (pos) {
        store.geo = { latitude: pos.latitude, longitude: pos.longitude, at: Date.now() };
        store.geoBlocked = false;
        return { latitude: pos.latitude, longitude: pos.longitude, label: T('当前定位') };
      });
    });
  }

  function fetchForecast(pos) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + pos.latitude.toFixed(3) +
      '&longitude=' + pos.longitude.toFixed(3) +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&forecast_days=' + FORECAST_DAYS +
      '&timezone=auto';

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 9000) : null;

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
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
      throw err;
    });
  }

  function refresh(force) {
    if (store.pending) return store.pending;
    var now = Date.now();
    if (!force && store.data && now - store.at < CACHE_MS) {
      render();
      return Promise.resolve(store.data);
    }

    var gen = store.gen;
    store.pending = resolvePosition()
      .then(fetchForecast)
      .then(function (data) {
        if (gen !== store.gen) return;
        store.data = data;
        store.at = Date.now();
        store.geoBlocked = false;
      })
      .catch(function () {
        // 静默降级：清掉旧数据，保留位置，不弹错误框
        if (gen !== store.gen) return;
        store.data = null;
        store.at = 0;
      })
      .then(function () {
        if (gen !== store.gen) return;
        store.pending = null;
        render();
      });
    return store.pending;
  }

  // 清空数据 / 退出时调用：天气数据、定位与反查地名一并丢弃，回到首次安装状态
  function clearCache() {
    store.gen++;
    store.data = null;
    store.at = 0;
    store.pending = null;
    store.place = null;
    store.geo = null;
    store.placeAt = 0;
    store.geoBlocked = false;
    // 手动选过的城市也属于可清理数据：一并清掉，避免清空后又去反查地名
    store.city = null;
    if (opts.meta && opts.meta.weatherCity) {
      delete opts.meta.weatherCity;
      if (opts.persist) opts.persist();
    }
    render();
  }

  function cacheStats() {
    return {
      forecastDays: (store.data && Array.isArray(store.data.time)) ? store.data.time.length : 0,
      placeEntries: (store.place && store.place.key) ? 1 : 0,
      geoEntries: store.geo ? 1 : 0,
      pending: store.pending ? 1 : 0
    };
  }

  // ---------- 渲染 ----------

  function setEl(el, key) {
    store.el = el || null;
    store.key = key || '';
  }

  // ---------- 反向地理编码：城市 + 区/县（可选街道），只反查一次并内存缓存 ----------

  function currentCoords() {
    if (store.city) return { latitude: store.city.latitude, longitude: store.city.longitude };
    if (store.geo) return { latitude: store.geo.latitude, longitude: store.geo.longitude };
    return null;
  }

  function placeKeyOf(lat, lon) {
    return Number(lat).toFixed(3) + ',' + Number(lon).toFixed(3) + '|' + (isEn() ? 'en' : 'zh');
  }

  function placeLabelFromParts(partsIn) {
    var parts = [];
    partsIn.forEach(function (p) {
      var s = String(p || '').trim();
      if (!s || parts.indexOf(s) !== -1) return;
      parts.push(s.slice(0, 24));
    });
    return parts.slice(0, 3).join(' · ');
  }

  function placeLabelFrom(addr) {
    if (!addr) return '';
    var city = addr.city || addr.town || addr.municipality || addr.county || addr.state_district || '';
    var district = addr.city_district || addr.district || addr.borough || addr.county || addr.suburb || '';
    // 街道/乡镇级只用接口确实返回的字段，缺失就不拼凑
    var street = addr.road || addr.township || addr.hamlet || '';
    return placeLabelFromParts([city, district, street]);
  }

  // 先用无需密钥、可直接跨域的 BigDataCloud；不可用时再回落到 OSM Nominatim
  function requestPlace(lat, lon, signal) {
    var lang = isEn() ? 'en' : 'zh';
    var bdc = 'https://api.bigdatacloud.net/data/reverse-geocode-client' +
      '?latitude=' + Number(lat).toFixed(4) +
      '&longitude=' + Number(lon).toFixed(4) +
      '&localityLanguage=' + lang;

    return fetch(bdc, { method: 'GET', credentials: 'omit', signal: signal })
      .then(function (res) {
        if (!res.ok) throw new Error('bdc-' + res.status);
        return res.json();
      })
      .then(function (json) {
        // 只取确实存在的地名字段，不拼接近似地址
        return placeLabelFromParts([json && json.city, json && json.locality]);
      })
      .catch(function () {
        var osmLang = isEn() ? 'en' : 'zh-CN,zh';
        var osm = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
          '&lat=' + Number(lat).toFixed(4) +
          '&lon=' + Number(lon).toFixed(4) +
          '&zoom=16&addressdetails=1&accept-language=' + encodeURIComponent(osmLang);
        return fetch(osm, { method: 'GET', credentials: 'omit', signal: signal })
          .then(function (res) {
            if (!res.ok) throw new Error('osm-' + res.status);
            return res.json();
          })
          .then(function (json) { return placeLabelFrom(json && json.address); })
          .catch(function () { return ''; });
      });
  }

  function fetchPlace(lat, lon) {
    var key = placeKeyOf(lat, lon);
    if (!key) return;
    // 同一坐标（含语言）已经反查过：直接复用，不再请求
    if (store.place && store.place.key === key) return;

    // 坐标变化：旧地名立即替换，不保留多份
    store.place = { key: key, label: '' };
    render();

    // 遵守开放地理服务的合理频率：两次请求至少间隔 1 秒
    var wait = Math.max(0, PLACE_MIN_GAP - (Date.now() - store.placeAt));
    setTimeout(function () {
      if (!store.place || store.place.key !== key) return;
      store.placeAt = Date.now();

      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;

      requestPlace(lat, lon, controller ? controller.signal : undefined)
        .then(function (label) {
          if (timer) clearTimeout(timer);
          if (store.place && store.place.key === key) {
            store.place = { key: key, label: label };
            render();
          }
        })
        .catch(function () {
          // 失败 / 离线 / 超时：这一行留空，天气照常显示
          if (timer) clearTimeout(timer);
          if (store.place && store.place.key === key) {
            store.place = { key: key, label: '' };
            render();
          }
        });
    }, wait);
  }

  function render() {
    var el = store.el;
    if (!el || !el.isConnected) return;
    var pos = currentCoords();
    if (pos) fetchPlace(pos.latitude, pos.longitude);
    paint(el, store.key);
  }

  function paint(el, key) {
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
    // 地名优先用反查结果；手动选的区县在反查失败时用选择时记下的层级兜底
    var placeText = (store.place && store.place.label) || (store.city && store.city.label) || '';
    var place = placeText
      ? '<span class="wx-place" title="' + esc(placeText) + '">' + esc(placeText) + '</span>'
      : '';

    el.innerHTML = '<div class="wx-now" title="' + esc(tip + (placeText ? ' · ' + placeText : '')) +
      '" aria-label="' + esc(tip) + '">' +
      '<span class="wx-now-main">' +
        '<span class="wx-big ' + ICON_TONE[entry[0]] + '">' + ICONS[entry[0]] + '</span>' +
        '<span class="wx-now-meta">' +
          '<span class="wx-temp">' + maxText + (minText ? '<i>/' + minText + '</i>' : '') + '</span>' +
          '<span class="wx-text">' + esc(desc) + '</span>' +
        '</span>' +
      '</span>' +
      place +
    '</div>';
  }

  function weatherPlaceholder() {
    if (store.city || store.geo) {
      return '<span class="wx-placeholder">—</span>';
    }
    // 没有城市、也没有可用的定位：给一个不打扰的手动入口
    return '<button class="wx-city-btn" type="button" data-weather-city="1">' +
      esc(T('选择城市')) + '</button>';
  }

  // ---------- 城市 / 区县搜索（Photon，基于 OpenStreetMap，免密钥、可跨域） ----------

  // 只查省 / 市 / 区县这类行政区；不含街道、村镇，避免同名地点挤掉区县结果
  var SEARCH_TAGS = [
    'place:state', 'place:province', 'place:city',
    'place:district', 'place:county', 'place:municipality'
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

  function adminRegion(p, name) { // 省 · 市 · 区县，用于区分同名地区
    var parts = [];
    var push = function (v) {
      var s = String(v || '').trim();
      if (!s || parts.indexOf(s) !== -1) return;
      if (/^[A-Z]{2}$/.test(s)) return; // 部分条目只有省份缩写，不展示
      parts.push(s.slice(0, 24));
    };
    push(p.state);
    push(p.city);
    push(p.county && p.county !== p.city ? p.county : '');
    push(p.district);
    push(name);
    if (p.countrycode && p.countrycode !== 'CN') push(p.country);
    return parts.join(' · ');
  }

  function shortLabelOf(p, name) { // 天气下方小字：城市 + 区/县
    var parts = [];
    var push = function (v) {
      var s = String(v || '').trim();
      if (!s || parts.indexOf(s) !== -1) return;
      parts.push(s.slice(0, 24));
    };
    push(p.city);
    if (!p.city) push(p.county);
    push(p.district);
    push(name);
    return parts.slice(0, 3).join(' · ');
  }

  function search(query) {
    var q = String(query || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=8';
    if (isEn()) url += '&lang=en';
    SEARCH_TAGS.forEach(function (tag) { url += '&osm_tag=' + tag; });

    // 一次只发一个请求；超时或失败由调用方给出简短提示
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    }).then(function (json) {
      var features = (json && json.features) || [];
      return features.map(function (f) {
        var p = (f && f.properties) || {};
        var ll = (f && f.geometry && f.geometry.coordinates) || [];
        var name = cleanPlaceName(p.name);
        var lat = Number(ll[1]);
        var lon = Number(ll[0]);
        if (!name || !isFinite(lat) || !isFinite(lon)) return null;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
        return {
          name: name,
          latitude: lat,
          longitude: lon,
          label: shortLabelOf(p, name),
          region: adminRegion(p, name)
        };
      }).filter(Boolean);
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  window.Weather = {
    configure: configure,
    city: city,
    cityLabel: cityLabel,
    setCity: setCity,
    clearCity: clearCity,
    useCurrentLocation: useCurrentLocation,
    refresh: refresh,
    search: search,
    clearCache: clearCache,
    cacheStats: cacheStats,
    render: function (el, key) {
      setEl(el, key);
      render();
    }
  };
})();
