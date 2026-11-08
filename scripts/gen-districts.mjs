// 生成 districts.js：全国地级行政区 → 县级行政区（区/县/县级市/旗/林区/特区）离线表。
//
// 用法：node scripts/gen-districts.mjs
//
// 数据源：npm 包 china-division@2.7.0 的 dist/pca.json
//   - 仓库：modood/Administrative-divisions-of-China（MIT 许可，无需额外署名）
//   - 内容：整理自国家统计局公布的行政区划代码（公开数据）
//   - 依次尝试 jsDelivr → unpkg → GitHub raw，任意一个成功即可
//   - 只在生成时联网；应用运行时完全离线、不定位
//
// 两种失败的处理不同：
//   1) 三个源都拉不到（源站抽风 / 断网）→ 回退到仓库里已提交的 districts.js 快照，
//      快照通过数量与抽样校验就继续构建，构建日志给出警告；
//   2) 数据拿到了但校验不过（数量不足、抽样缺失、结构异常）→ 直接失败，
//      绝不用坏数据覆盖文件，也不静默产出空表。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'districts.js');

const SOURCES = [
  'https://cdn.jsdelivr.net/npm/china-division@2.7.0/dist/pca.json',
  'https://unpkg.com/china-division@2.7.0/dist/pca.json',
  'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca.json',
];

// 直辖市在 regions.js 里第二级已经是区，districts.js 不重复收录
const MUNICIPALITIES = new Set(['北京市', '天津市', '上海市', '重庆市']);
// 这些分组不是地级市，其子项是省直辖县级单位，已在 regions.js 里作为第二级
const DIRECT_GROUP = /^(市辖区|县|省直辖县级行政区划|自治区直辖县级行政区划)$/;

// 数量下限：低于任一值就判定数据不完整
const MIN_PROVINCES = 31;
const MIN_CITIES = 300;
const MIN_DISTRICTS = 2700;

async function fetchSource() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('返回结构不是预期的 pca.json 对象');
      }
      console.log('数据源：' + url);
      return json;
    } catch (err) {
      console.warn('拉取失败，换下一个源：' + url + '（' + err.message + '）');
    }
  }
  return null;
}

// pca.json 的结构是 { 省: { 市: [区县...] } }；
// 直辖市的键是「市辖区 / 县」，省直辖县级单位单独成组
function normalize(tree) {
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) {
    throw new Error('数据结构异常：预期 { 省: { 市: [区县] } }');
  }
  const data = {};
  const municipal = {};
  const direct = {};
  let cityCount = 0;
  let districtCount = 0;
  let provinceCount = 0;

  for (const [pName, cities] of Object.entries(tree)) {
    if (!cities || typeof cities !== 'object' || Array.isArray(cities)) continue;
    provinceCount += 1;
    if (MUNICIPALITIES.has(pName)) {
      // 直辖市的区县在 regions.js 第二级已经展开，这里只收集起来做校验
      const all = [];
      for (const items of Object.values(cities)) {
        if (Array.isArray(items)) all.push(...items.filter(Boolean));
      }
      municipal[pName] = all;
      continue;
    }
    for (const [cName, items] of Object.entries(cities)) {
      if (!Array.isArray(items)) continue;
      if (DIRECT_GROUP.test(cName)) {
        // 省直辖县级单位：记录用于校验，不做第三级
        const list = items.filter(Boolean);
        if (list.length) direct[pName] = (direct[pName] || []).concat(list);
        continue;
      }
      const districts = items.filter((n) => n && !DIRECT_GROUP.test(n));
      if (!districts.length) continue;
      if (data[cName]) {
        // 同名地级市理论上不存在；出现时合并而不是覆盖
        for (const d of districts) {
          if (data[cName].indexOf(d) === -1) data[cName].push(d);
        }
      } else {
        data[cName] = districts;
        cityCount += 1;
      }
      districtCount += districts.length;
    }
  }
  return { data, municipal, direct, provinceCount, cityCount, districtCount };
}

function assertSamples(result) {
  const d = result.data;
  const checks = [
    ['杭州市', ['余杭区', '临平区', '钱塘区', '建德市']],
    ['成都市', ['武侯区', '简阳市', '都江堰市', '蒲江县']],
    ['喀什地区', ['喀什市', '疏附县', '塔什库尔干塔吉克自治县']],
    ['呼和浩特市', ['新城区', '土默特左旗', '武川县']],
  ];
  const problems = [];
  for (const [city, names] of checks) {
    if (!d[city]) {
      problems.push('缺少城市：' + city);
      continue;
    }
    for (const n of names) {
      if (d[city].indexOf(n) === -1) problems.push(city + ' 缺少：' + n);
    }
  }
  return problems;
}

// 只有在线数据才带直辖市与省直辖县级单位的分组，快照里没有，不做这两项
function assertDerived(result) {
  const problems = [];
  if (!result.municipal['重庆市'] || result.municipal['重庆市'].length < 30) {
    problems.push('重庆市区县数量异常');
  }
  if (!result.direct['海南省'] || result.direct['海南省'].length < 10) {
    problems.push('海南省直辖县级单位缺失');
  }
  if (!result.direct['河南省'] || result.direct['河南省'].indexOf('济源市') === -1) {
    problems.push('河南省直辖的济源市缺失');
  }
  return problems;
}

function validate(result, label, opts) {
  const errors = [];
  if (opts.network) {
    if (result.provinceCount < MIN_PROVINCES) errors.push('省级数量过少：' + result.provinceCount);
    for (const p of assertDerived(result)) errors.push(p);
  }
  if (result.cityCount < MIN_CITIES) errors.push('地级数量过少：' + result.cityCount);
  if (result.districtCount < MIN_DISTRICTS) errors.push('县级数量过少：' + result.districtCount);
  for (const p of assertSamples(result)) errors.push(p);
  console.log(label + '：地级 ' + result.cityCount + ' / 县级 ' + result.districtCount +
    (opts.network
      ? '（不含直辖市；直辖市合计 ' +
        Object.values(result.municipal).reduce((n, a) => n + a.length, 0) + '）'
      : '（快照，不含直辖市）'));
  return errors;
}

// 源站不可用时的兜底：读取仓库里已提交的 districts.js 并做同一套数量与抽样校验
function loadSnapshot() {
  if (!existsSync(OUT)) throw new Error('所有数据源都失败，且仓库里没有可回退的 districts.js 快照');
  const code = readFileSync(OUT, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { timeout: 5000 });
  const data = sandbox.window && sandbox.window.CN_DISTRICTS;
  if (!data || typeof data !== 'object') throw new Error('快照没有导出 window.CN_DISTRICTS');
  const cityCount = Object.keys(data).length;
  const districtCount = Object.values(data).reduce((n, list) => n + list.length, 0);
  return { data, cityCount, districtCount };
}

function emit(result) {
  const lines = [];
  lines.push('/* AeroPlan · 区/县表（第三级，完全离线，自动生成，请勿手改）。');
  lines.push('   数据来源：china-division@2.7.0（modood/Administrative-divisions-of-China，MIT）；');
  lines.push('   上游整理自国家统计局公布的行政区划代码，仅供书写辅助，不作为权威区划资料。');
  lines.push('   键为 regions.js 里的第二级城市名，值为该市下辖的县级行政区（区、县、县级市、旗、林区、特区）。');
  lines.push('   直辖市在 regions.js 第二级已经是区，故不在此表重复；表里没有的地级单位，第三级只显示「不限」。 */');
  lines.push('(function () {');
  lines.push("  'use strict';");
  lines.push('');
  lines.push('  var DATA = {');
  const cityNames = Object.keys(result.data).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  cityNames.forEach((city, i) => {
    const arr = result.data[city];
    const body = arr.map((n) => "'" + n + "'").join(', ');
    lines.push("    '" + city + "': [" + body + "]" + (i === cityNames.length - 1 ? '' : ','));
  });
  lines.push('  };');
  lines.push('');
  lines.push('  window.CN_DISTRICTS = DATA;');
  lines.push('})();');
  lines.push('');
  return lines.join('\n');
}

const tree = await fetchSource();

if (!tree) {
  // 源站全部不可用：回退到提交在仓库里的快照，不让一次抽风卡住出包
  console.warn('三个数据源都不可用，改用仓库里已提交的 districts.js 快照（不会覆盖它）。');
  const snapshot = loadSnapshot();
  const errors = validate(snapshot, '快照校验', { network: false });
  if (errors.length) {
    console.error('快照校验未通过，构建失败：');
    for (const e of errors) console.error(' - ' + e);
    process.exit(1);
  }
  console.warn('快照校验通过，按原文件继续构建。');
  process.exit(0);
}

const result = normalize(tree);
const errors = validate(result, '数据校验', { network: true });
if (errors.length) {
  console.error('数据校验未通过，未写入文件，构建失败：');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

const text = emit(result);
writeFileSync(OUT, text, 'utf8');

const bytes = Buffer.byteLength(text, 'utf8');
const gz = gzipSync(Buffer.from(text, 'utf8')).length;
console.log('已写入 districts.js：' + (bytes / 1024).toFixed(1) + ' KB（gzip ' + (gz / 1024).toFixed(1) + ' KB）');
console.log('抽样校验通过：杭州 / 成都 / 喀什 / 呼和浩特 / 重庆 / 海南 / 济源');
