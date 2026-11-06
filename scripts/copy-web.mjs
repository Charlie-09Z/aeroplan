// 把仓库根目录的网页文件复制到 www/，Capacitor 打包时只认这个目录。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

const files = ['index.html', 'styles.css', 'i18n.js', 'weather.js', 'app.js', 'sw.js', 'manifest.webmanifest'];
for (const name of files) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) {
    console.error('缺少网页文件：' + name);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(www, name));
}

const iconDir = path.join(root, 'icons');
if (fs.existsSync(iconDir)) {
  fs.cpSync(iconDir, path.join(www, 'icons'), { recursive: true });
}

const fontDir = path.join(root, 'fonts');
if (fs.existsSync(fontDir)) {
  fs.cpSync(fontDir, path.join(www, 'fonts'), { recursive: true });
}

console.log('www 目录已准备好：' + files.join(', ') + '、icons/、fonts/');
