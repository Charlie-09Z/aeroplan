/**
 * 在 CI 生成的 Android 工程上做两件事：
 * 1. 写入固定签名（个人自签名，保证以后新 APK 能覆盖安装旧版）和版本号；
 * 2. 用 icons/icon-512.png 生成各分辨率的桌面图标（sharp 不可用时自动跳过，不影响打包）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION_NAME = pkg.version;
const parts = String(VERSION_NAME).split('.').map(function (n) { return Number(n) || 0; });
const VERSION_CODE = parts[0] * 10000 + parts[1] * 100 + parts[2];
const KEY_ALIAS = 'qingricheng';
const KEY_PASSWORD = 'qingricheng';
const KEY_PATH = '../../keystore/light-schedule-release.keystore';

if (!fs.existsSync(gradlePath)) {
  throw new Error('找不到 android/app/build.gradle：请先运行 cap add android');
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + VERSION_CODE);
gradle = gradle.replace(/versionName\s+"[^"]*"/, 'versionName "' + VERSION_NAME + '"');

if (!gradle.includes('signingConfigs {')) {
  const signing = [
    '    signingConfigs {',
    '        release {',
    '            storeFile file("' + KEY_PATH + '")',
    '            storePassword "' + KEY_PASSWORD + '"',
    '            keyAlias "' + KEY_ALIAS + '"',
    '            keyPassword "' + KEY_PASSWORD + '"',
    '            storeType "PKCS12"',
    '        }',
    '    }',
    ''
  ].join('\n');
  gradle = gradle.replace(/buildTypes\s*\{/, signing + '    buildTypes {');
}

if (!gradle.includes('signingConfig signingConfigs.release')) {
  gradle = gradle.replace(
    /(buildTypes[\s\S]*?release\s*\{\s*\n)/,
    '$1            signingConfig signingConfigs.release\n'
  );
}

fs.writeFileSync(gradlePath, gradle);
console.log('已写入签名与版本号：' + VERSION_NAME + '（versionCode ' + VERSION_CODE + '）');

async function makeIcons() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.log('未找到 sharp，跳过图标生成（APK 仍可正常打包）。');
    return;
  }

  const source = path.join(root, 'icons', 'icon-512.png');
  const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
  const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

  for (const [density, size] of Object.entries(legacy)) {
    const dir = path.join(resDir, 'mipmap-' + density);
    if (!fs.existsSync(dir)) continue;

    const icon = await sharp(source).resize(size, size).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), icon);
    if (fs.existsSync(path.join(dir, 'ic_launcher_round.png'))) {
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), icon);
    }

    const fgPath = path.join(dir, 'ic_launcher_foreground.png');
    if (fs.existsSync(fgPath)) {
      const box = foreground[density];
      const inner = Math.round(box * 0.62);
      const padded = await sharp({
        create: { width: box, height: box, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      })
        .composite([{ input: await sharp(source).resize(inner, inner).png().toBuffer(), gravity: 'center' }])
        .png()
        .toBuffer();
      fs.writeFileSync(fgPath, padded);
    }
  }

  const valuesDir = path.join(resDir, 'values');
  if (fs.existsSync(valuesDir)) {
    fs.writeFileSync(
      path.join(valuesDir, 'ic_launcher_background.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#4C6FFF</color>\n</resources>\n'
    );
  }

  console.log('已生成 Android 桌面图标。');
}

makeIcons().catch(function (err) {
  console.log('图标生成失败，跳过（不影响 APK）：' + err.message);
});
