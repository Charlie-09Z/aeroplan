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

const required = ['index.html', 'styles.css', 'i18n.js', 'regions.js', 'districts.js', 'weather.js', 'app.js', 'sw.js', 'manifest.webmanifest'];
for (const name of required) {
  if (!fs.existsSync(path.join(root, name))) {
    console.error('缺少网页文件：' + name);
    process.exit(1);
  }
}

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

// ---------- HTML ----------
const htmlSource = read('index.html');
const html = await minifyHtml(htmlSource, {
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

// ---------- CSS ----------
// 原样压缩：不做任何 font-size 改写（字号功能已移除，源码里的 px 就是最终值）
const cssSource = read('styles.css');
const cssResult = new CleanCSS({ level: 1 }).minify(cssSource);
if (cssResult.errors && cssResult.errors.length) {
  console.error('CSS 压缩失败：' + cssResult.errors.join('; '));
  process.exit(1);
}
fs.writeFileSync(path.join(www, 'styles.css'), cssResult.styles);

// ---------- JS ----------
// toplevel 不混淆：保留 window.I18N / window.Weather 这类对外入口；
// 不设置 sourceMap，构建产物里不会出现 .map 文件。
for (const name of ['i18n.js', 'regions.js', 'districts.js', 'weather.js', 'app.js', 'sw.js']) {
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
