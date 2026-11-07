// 把仓库根目录的网页文件复制到 www/，并在复制时压缩 / 混淆。
// - HTML：去掉注释与多余空白
// - CSS：去掉注释与多余空白（level 1，避免改变层叠顺序）
// - JS：terser 压缩 + 局部变量名混淆，不生成 source map
// - manifest：压成一行 JSON
// Capacitor 打包时只认 www/，原始源码不进 APK。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify as minifyJs } from 'terser';
import { minify as minifyHtml } from 'html-minifier-terser';
import CleanCSS from 'clean-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

const required = ['index.html', 'styles.css', 'i18n.js', 'regions.js', 'weather.js', 'app.js', 'sw.js', 'manifest.webmanifest'];
for (const name of required) {
  if (!fs.existsSync(path.join(root, name))) {
    console.error('缺少网页文件：' + name);
    process.exit(1);
  }
}

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

// ---------- 构建标识 ----------
// 用户能一眼核对装的是不是最新包：时间 + CI 流水号 + 短 commit。
// 写进 index.html 的 meta，随「先走网络」的导航一起更新，不受 Service Worker 静态缓存影响。
const buildTime = (process.env.BUILD_TIME || new Date().toISOString()).replace('T', ' ').slice(0, 16);
const buildRun = process.env.GITHUB_RUN_NUMBER ? '#' + process.env.GITHUB_RUN_NUMBER : '';
const buildSha = (process.env.GITHUB_SHA || '').slice(0, 7);
const BUILD_STAMP = [buildTime, buildRun, buildSha].filter(Boolean).join(' · ') || 'dev';

// ---------- HTML ----------
const htmlSource = read('index.html');
if (!/name="aeroplan-build"/.test(htmlSource)) {
  console.error('index.html 缺少 <meta name="aeroplan-build"> 占位，构建标识无法写入');
  process.exit(1);
}
const html = await minifyHtml(htmlSource.replace(/<meta name="aeroplan-build"[^>]*>/, '<meta name="aeroplan-build" content="' + BUILD_STAMP + '">'), {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  useShortDoctype: true,
  caseSensitive: true,
  keepClosingSlash: true,
  minifyCSS: true,
  minifyJS: false
});
fs.writeFileSync(path.join(www, 'index.html'), html);
console.log('构建标识：' + BUILD_STAMP);

// ---------- CSS ----------
const cssResult = new CleanCSS({ level: 1 }).minify(read('styles.css'));
if (cssResult.errors && cssResult.errors.length) {
  console.error('CSS 压缩失败：' + cssResult.errors.join('; '));
  process.exit(1);
}
fs.writeFileSync(path.join(www, 'styles.css'), cssResult.styles);

// ---------- JS ----------
// toplevel 不混淆：保留 window.I18N / window.Weather 这类对外入口；
// 不设置 sourceMap，构建产物里不会出现 .map 文件。
for (const name of ['i18n.js', 'regions.js', 'weather.js', 'app.js', 'sw.js']) {
  const result = await minifyJs(read(name), {
    compress: { passes: 2, drop_debugger: true },
    mangle: true,
    format: { comments: false },
    sourceMap: false
  });
  if (!result || !result.code) {
    console.error('JS 压缩失败：' + name);
    process.exit(1);
  }
  fs.writeFileSync(path.join(www, name), result.code + '\n');
}

// ---------- manifest ----------
fs.writeFileSync(
  path.join(www, 'manifest.webmanifest'),
  JSON.stringify(JSON.parse(read('manifest.webmanifest')))
);

const iconDir = path.join(root, 'icons');
if (fs.existsSync(iconDir)) {
  fs.cpSync(iconDir, path.join(www, 'icons'), { recursive: true });
}

const fontDir = path.join(root, 'fonts');
if (fs.existsSync(fontDir)) {
  fs.cpSync(fontDir, path.join(www, 'fonts'), { recursive: true });
}

console.log('www 已准备好（已压缩混淆，无 source map）：' + required.join(', ') + '、icons/、fonts/');
