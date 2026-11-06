// 在 CI 生成 Android 工程之后、编译之前，写入这些内容：
//   1. 发布签名（固定 keystore，PKCS12）
//   2. 版本号（读 package.json，自动换算 versionCode）
//   3. 应用显示名与联网/通知权限
//   4. 应用图标与浅色启动图（用 sharp 从 icons 生成）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');

if (!fs.existsSync(androidDir)) {
  console.error('没有找到 android 目录，请先执行 npx cap add android');
  process.exit(1);
}

// ---------- 1. 版本号 ----------
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION_NAME = String(pkg.version || '0.0.1');
const parts = VERSION_NAME.split('.').map(function (n) { return Number(n) || 0; });
const VERSION_CODE = parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);

const KEY_ALIAS = 'qingricheng';
const KEY_PASSWORD = 'qingricheng';
const KEY_PATH = '../../keystore/light-schedule-release.keystore';

// ---------- 2. 改 build.gradle ----------
const gradlePath = path.join(androidDir, 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) {
  console.error('没有找到 android/app/build.gradle');
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

const beforeVersion = gradle.match(/versionName\s+"[^"]*"/);
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + VERSION_CODE);
gradle = gradle.replace(/versionName\s+"[^"]*"/, 'versionName "' + VERSION_NAME + '"');

// 先在 buildTypes.release 里挂上签名（必须在插入 signingConfigs 之前做，
// 否则下面的正则可能先匹配到 signingConfigs 里的 release 块）
if (!/signingConfig\s+signingConfigs\.release/.test(gradle)) {
  const releaseAnchor = /(buildTypes\s*{[\s\S]*?\n\s*release\s*{)/;
  if (!releaseAnchor.test(gradle)) {
    console.error('build.gradle 里没有找到 buildTypes.release，无法写入签名');
    process.exit(1);
  }
  gradle = gradle.replace(releaseAnchor, '$1\n            signingConfig signingConfigs.release');
}

if (!/signingConfigs\s*{/.test(gradle)) {
  const signingBlock = [
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
  if (!gradle.includes('buildTypes')) {
    console.error('build.gradle 里没有找到 buildTypes，无法写入签名配置');
    process.exit(1);
  }
  gradle = gradle.replace(/(\n\s*buildTypes\s*{)/, '\n' + signingBlock + '$1');
}

fs.writeFileSync(gradlePath, gradle);
console.log('已写入签名配置与版本号：versionName ' + VERSION_NAME +
  '（原来是 ' + (beforeVersion ? beforeVersion[0] : '未知') + '），versionCode ' + VERSION_CODE);

// ---------- 3. 应用显示名与通知权限 ----------
const APP_NAME = '氢计划';

const stringsPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsPath)) {
  let strings = fs.readFileSync(stringsPath, 'utf8');
  if (/<string name="app_name">[^<]*<\/string>/.test(strings)) {
    strings = strings.replace(/<string name="app_name">[^<]*<\/string>/,
      '<string name="app_name">' + APP_NAME + '</string>');
  } else {
    strings = strings.replace('</resources>',
      '    <string name="app_name">' + APP_NAME + '</string>\n</resources>');
  }
  fs.writeFileSync(stringsPath, strings);
  console.log('已写入应用显示名：' + APP_NAME);
} else {
  console.log('没有找到 strings.xml，跳过应用显示名');
}

const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const needs = [
    {
      name: 'android.permission.INTERNET',
      attrs: '',
      note: '联网权限：安装时自动授予，用来加载内置页面'
    },
    {
      name: 'android.permission.POST_NOTIFICATIONS',
      attrs: '',
      note: '通知权限：Android 13 起需要运行时申请，用于到点提醒'
    },
    {
      name: 'android.permission.SCHEDULE_EXACT_ALARM',
      attrs: '',
      note: '精确闹钟：让到点提醒尽量准时（系统可能要求用户手动允许）'
    },
    {
      name: 'android.permission.RECEIVE_BOOT_COMPLETED',
      attrs: '',
      note: '开机广播：重启后恢复已排程的提醒'
    },
    {
      name: 'android.permission.ACCESS_COARSE_LOCATION',
      attrs: '',
      note: '大致定位：拒绝精确位置时的兜底；只用于天气城市与减少搜索范围，不后台追踪'
    },
    {
      name: 'android.permission.ACCESS_FINE_LOCATION',
      attrs: '',
      note: '精确位置：只在用户点「使用当前位置」时读取一次，用于天气与条目地址，不记录轨迹'
    },
    {
      name: 'android.permission.READ_EXTERNAL_STORAGE',
      attrs: ' android:maxSdkVersion="32"',
      note: '存储权限：Android 12 及以下用于读取用户选择的备份文件；Android 13+ 无需授权'
    },
    {
      name: 'android.permission.WRITE_EXTERNAL_STORAGE',
      attrs: ' android:maxSdkVersion="28"',
      note: '存储权限：Android 9 及以下用于写入备份文件；Android 10+ 使用应用专属目录'
    }
  ];
  for (const perm of needs) {
    if (manifest.includes('android:name="' + perm.name + '"')) continue;
    manifest = manifest.replace('<application',
      '    <!-- ' + perm.note + ' -->\n' +
      '    <uses-permission android:name="' + perm.name + '"' + perm.attrs + ' />\n\n    <application');
  }
  fs.writeFileSync(manifestPath, manifest);
  console.log('已确认联网、通知、定位、精确闹钟与存储权限');
} else {
  console.log('没有找到 AndroidManifest.xml，跳过权限写入');
}

// ---------- 4. 生成图标与启动图 ----------
async function makeIcons() {
  const sharp = (await import('sharp')).default;
  const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
  const icon512 = path.join(root, 'icons', 'icon-512.png');
  const icon192 = path.join(root, 'icons', 'icon-192.png');
  if (!fs.existsSync(icon512)) {
    console.log('没有 icons/icon-512.png，跳过图标生成，沿用默认图标');
    return;
  }

  const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  const art = fs.existsSync(icon192) ? icon192 : icon512;

  for (const [dpi, size] of Object.entries(legacy)) {
    const dir = path.join(resDir, 'mipmap-' + dpi);
    fs.mkdirSync(dir, { recursive: true });
    const buf = await sharp(icon512).resize(size, size, { fit: 'cover' }).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);
  }

  for (const [dpi, size] of Object.entries(foreground)) {
    const dir = path.join(resDir, 'mipmap-' + dpi);
    fs.mkdirSync(dir, { recursive: true });
    const inner = Math.round(size * 0.62);
    const small = await sharp(art).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
    const canvas = await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: small, gravity: 'center' }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), canvas);
  }

  const valuesDir = path.join(resDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#4C6FFF</color>\n</resources>\n'
  );
  console.log('图标已生成');

  // 启动图：浅色底 + 居中图标，避免系统默认的黑白闪屏
  const drawableDir = path.join(resDir, 'drawable');
  fs.mkdirSync(drawableDir, { recursive: true });
  const splashW = 1080;
  const splashH = 1920;
  const markSize = 300;
  const mark = await sharp(art).resize(markSize, markSize, { fit: 'cover' }).png().toBuffer();
  const splash = await sharp({
    create: { width: splashW, height: splashH, channels: 4, background: { r: 243, g: 245, b: 250, alpha: 1 } }
  })
    .composite([{
      input: mark,
      left: Math.round((splashW - markSize) / 2),
      top: Math.round((splashH - markSize) / 2)
    }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(drawableDir, 'splash.png'), splash);
  console.log('启动图已生成（浅色底 + 图标）');
}

try {
  await makeIcons();
} catch (err) {
  // 图标失败不影响能不能装，只记录一下
  console.log('图标生成失败，沿用默认图标：' + err.message);
}
