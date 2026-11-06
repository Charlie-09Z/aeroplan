/**
 * 把仓库根目录里的网页文件复制到 Capacitor 需要的 www/ 目录。
 * 仓库里只保留一份网页代码，避免两份副本改不同步。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');

const FILES = ['index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of FILES) {
  fs.copyFileSync(path.join(root, name), path.join(out, name));
}

fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });

console.log('网页文件已复制到 www/：' + FILES.join('、') + '、icons/');
