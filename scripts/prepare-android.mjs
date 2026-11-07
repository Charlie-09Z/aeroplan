// 在 CI 生成 Android 工程之后、编译之前，写入这些内容：
//   1. 发布签名（keystore 由工作流从 GitHub Secrets 还原；口令只从环境变量读取，不进仓库）
//   2. 版本号（读 package.json，自动换算 versionCode）
//   3. 应用显示名与联网/通知/存储权限（本版本不申请定位权限）
//   4. R8 压缩/混淆 与 WebView 调试关闭
//   5. 应用图标与浅色启动图（用 sharp 从 icons 生成）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNotifyConfig, validateNotifyConfig, printNotifyConfig } from './notify-config.mjs';

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

// keystore 由工作流从 Secrets 还原到 keystore/release.keystore；
// 口令与别名通过环境变量传入，仓库里不保存任何明文。
const KEYSTORE_PATH = '../../keystore/release.keystore';
const KEYSTORE_PASSWORD = process.env.KEYSTORE_PASSWORD || '';
const KEY_ALIAS = process.env.KEY_ALIAS || 'qingjihua';
const KEY_PASSWORD = process.env.KEY_PASSWORD || KEYSTORE_PASSWORD;
const HAS_SIGNING = !!KEYSTORE_PASSWORD;

// ---------- 1.1 通知渠道参数校验 ----------
// 渠道参数写在 app.js 里，构建日志回显一份并校验关键值：
// 重要性必须是 5（否则不弹横幅）、图标与提示音必须和 res 里的资源同名。
const notifyConfig = readNotifyConfig(root);
printNotifyConfig(notifyConfig);
const notifyProblems = validateNotifyConfig(notifyConfig);
if (notifyProblems.length) {
  console.error('通知渠道参数校验失败：' + notifyProblems.join('；'));
  process.exit(1);
}

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

if (HAS_SIGNING) {
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
      '            storeFile file("' + KEYSTORE_PATH + '")',
      '            storePassword System.getenv("KEYSTORE_PASSWORD")',
      '            keyAlias System.getenv("KEY_ALIAS")',
      '            keyPassword System.getenv("KEY_PASSWORD")',
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
} else {
  console.log('警告：没有提供 KEYSTORE_PASSWORD，跳过发布签名；产出的 APK 不能安装');
}

// ---------- 2.1 R8：压缩资源、混淆代码 ----------
gradle = gradle.replace(/(buildTypes\s*{[\s\S]*?\n\s*release\s*{)([\s\S]*?)(\n\s*})/, function (whole, head, body, tail) {
  if (!/minifyEnabled\s+true/.test(body)) {
    if (/minifyEnabled\s+false/.test(body)) {
      body = body.replace(/minifyEnabled\s+false/, 'minifyEnabled true');
    } else {
      body += '\n            minifyEnabled true';
    }
  }
  if (!/shrinkResources\s+true/.test(body)) {
    body += '\n            shrinkResources true';
  }
  return head + body + tail;
});

const proguardPath = path.join(androidDir, 'app', 'proguard-rules.pro');
fs.writeFileSync(proguardPath, [
  '# Capacitor 运行时通过反射加载插件，这些规则不能删。',
  '-keep class com.getcapacitor.** { *; }',
  '-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }',
  '-keep class * extends com.getcapacitor.Plugin { *; }',
  '-keepclassmembers class * extends com.getcapacitor.Plugin { *; }',
  '-keepclassmembers class * {',
  '    @android.webkit.JavascriptInterface <methods>;',
  '}',
  '-keep class com.qingricheng.app.** { *; }',
  '-dontwarn com.getcapacitor.**',
  ''
].join('\n'));
console.log('已开启 R8 压缩与混淆，并写入 Capacitor 的 keep 规则');

// shrinkResources 会误删「只在字符串里按名字引用」的资源（通知小图标、提示音、启动图、启动器图标）
const rawResDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'raw');
fs.mkdirSync(rawResDir, { recursive: true });
const KEEP_RESOURCES = [
  '@drawable/ic_stat_icon',
  '@drawable/splash',
  '@mipmap/ic_launcher',
  '@mipmap/ic_launcher_round',
  '@raw/qingjihua_notify'
];
fs.writeFileSync(path.join(rawResDir, 'keep.xml'), [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<resources xmlns:tools="http://schemas.android.com/tools"',
  '    tools:keep="' + KEEP_RESOURCES.join(',') + '" />',
  ''
].join('\n'));
console.log('已写入 keep.xml，防止压缩误删：' + KEEP_RESOURCES.join('、'));

// Android 8+ 的通知声音由「渠道」决定，且渠道只能引用 res/raw 里的音频。
// 这里用固定算法生成 0.6 秒的双音提示，避免引入外部音频与网络资源。
const noticeSoundPath = path.join(rawResDir, 'qingjihua_notify.wav');
const SAMPLE_RATE = 44100;
const SECONDS = 0.6;
const totalSamples = Math.floor(SAMPLE_RATE * SECONDS);
const pcm = Buffer.alloc(totalSamples * 2);
for (let i = 0; i < totalSamples; i += 1) {
  const t = i / SAMPLE_RATE;
  let v = 0;
  if (t < 0.30) v += 0.62 * Math.sin(2 * Math.PI * 880 * t) * Math.exp(-9.5 * t);
  if (t > 0.16) {
    const u = t - 0.16;
    v += 0.50 * Math.sin(2 * Math.PI * 1318.5 * u) * Math.exp(-6.2 * u);
  }
  const clamped = Math.max(-1, Math.min(1, v));
  pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
}
const wavHeader = Buffer.alloc(44);
wavHeader.write('RIFF', 0, 4, 'ascii');
wavHeader.writeUInt32LE(36 + pcm.length, 4);
wavHeader.write('WAVE', 8, 4, 'ascii');
wavHeader.write('fmt ', 12, 4, 'ascii');
wavHeader.writeUInt32LE(16, 16);
wavHeader.writeUInt16LE(1, 20);
wavHeader.writeUInt16LE(1, 22);
wavHeader.writeUInt32LE(SAMPLE_RATE, 24);
wavHeader.writeUInt32LE(SAMPLE_RATE * 2, 28);
wavHeader.writeUInt16LE(2, 32);
wavHeader.writeUInt16LE(16, 34);
wavHeader.write('data', 36, 4, 'ascii');
wavHeader.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(noticeSoundPath, Buffer.concat([wavHeader, pcm]));
console.log('已生成通知提示音：res/raw/qingjihua_notify.wav');

fs.writeFileSync(gradlePath, gradle);
console.log('已写入' + (HAS_SIGNING ? '签名配置' : '（无签名）') + '与版本号：versionName ' + VERSION_NAME +
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
      attrs: ' android:maxSdkVersion="32"',
      note: '精确闹钟：Android 12 / 12L 用它，装机默认允许，用户可在「闹钟和提醒」里撤销'
    },
    {
      name: 'android.permission.USE_EXACT_ALARM',
      attrs: '',
      note: '精确闹钟（Android 13+）：系统自动授予，不出现用户开关，避免到点提醒被拦'
    },
    {
      name: 'android.permission.RECEIVE_BOOT_COMPLETED',
      attrs: '',
      note: '开机广播：重启后由本地通知插件恢复已排程的提醒'
    },
    {
      name: 'android.permission.VIBRATE',
      attrs: '',
      note: '振动：通知振动与滚轮吸附的触觉反馈'
    }
  ];
  // 本版本没有定位与存储能力：模板、插件或旧配置带进这些权限时一律删掉。
  manifest = manifest.replace(/\s*<!--[^>]*定位[^>]*-->/g, '');
  manifest = manifest.replace(/\s*<!--[^>]*存储[^>]*-->/g, '');
  manifest = manifest.replace(
    /\s*<uses-permission[^>]*android:name="android\.permission\.(ACCESS_(FINE|COARSE)_LOCATION|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM)"[^>]*\/>/g,
    ''
  );
  for (const perm of needs) {
    if (manifest.includes('android:name="' + perm.name + '"')) continue;
    manifest = manifest.replace('<application',
      '    <!-- ' + perm.note + ' -->\n' +
      '    <uses-permission android:name="' + perm.name + '"' + perm.attrs + ' />\n\n    <application');
  }
  fs.writeFileSync(manifestPath, manifest);

  // 写回后再读一遍做校验：合并清单由这里注入的权限派生，源头缺一项就提前失败
  const written = fs.readFileSync(manifestPath, 'utf8');
  const missing = needs.filter(function (perm) {
    return !written.includes('android:name="' + perm.name + '"');
  });
  if (missing.length) {
    console.error('清单权限校验失败，缺少：' + missing.map(function (p) { return p.name; }).join('、'));
    process.exit(1);
  }
  console.log('清单权限校验通过：');
  needs.forEach(function (perm) {
    console.log('  ' + perm.name + (perm.attrs ? '（' + perm.attrs.trim() + '）' : ''));
  });
  console.log('已写入联网、通知、精确闹钟（USE_EXACT_ALARM + SCHEDULE_EXACT_ALARM）、开机广播与振动权限；未申请定位与存储权限');
} else {
  console.log('没有找到 AndroidManifest.xml，跳过权限写入');
}

// ---------- 3.1 关闭 WebView 调试 ----------
const mainActivityPath = path.join(
  androidDir, 'app', 'src', 'main', 'java', 'com', 'qingricheng', 'app', 'MainActivity.java'
);
if (fs.existsSync(mainActivityPath)) {
  let java = fs.readFileSync(mainActivityPath, 'utf8');
  if (!/setWebContentsDebuggingEnabled/.test(java)) {
    if (!/import android\.os\.Bundle;/.test(java)) {
      java = java.replace(/(import com\.getcapacitor\.BridgeActivity;)/,
        'import android.os.Bundle;\n$1');
    }
    if (!java.includes('import android.webkit.WebView;')) {
      java = java.replace(/(import android\.os\.Bundle;)/, '$1\nimport android.webkit.WebView;');
    }
    java = java.replace(
      /public class MainActivity extends BridgeActivity\s*\{\s*\}/,
      'public class MainActivity extends BridgeActivity {\n' +
      '    @Override\n' +
      '    public void onCreate(Bundle savedInstanceState) {\n' +
      '        WebView.setWebContentsDebuggingEnabled(false);\n' +
      '        super.onCreate(savedInstanceState);\n' +
      '    }\n' +
      '}'
    );
  } else {
    java = java.replace(/setWebContentsDebuggingEnabled\s*\([^)]*\)/, 'setWebContentsDebuggingEnabled(false)');
  }
  fs.writeFileSync(mainActivityPath, java);
  if (/setWebContentsDebuggingEnabled\(false\)/.test(java)) {
    console.log('已关闭 WebView 调试');
  } else {
    console.log('警告：MainActivity.java 结构未按预期匹配，未能关闭 WebView 调试');
  }
} else {
  console.log('没有找到 MainActivity.java，跳过 WebView 调试开关');
}

// ---------- 5. 生成图标与启动图 ----------
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

  // 通知栏小图标：必须是纯白剪影，否则部分系统会显示成灰色方块或直接不显示。
  // 取原图标的 alpha 通道，叠在纯白画布上，得到单色剪影。
  const smallSizes = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
  for (const [dpi, size] of Object.entries(smallSizes)) {
    const dir = path.join(resDir, 'drawable-' + dpi);
    fs.mkdirSync(dir, { recursive: true });
    const alpha = await sharp(icon512).resize(size, size, { fit: 'cover' })
      .ensureAlpha().extractChannel('alpha').toBuffer();
    const white = await sharp({
      create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();
    const mono = await sharp(white).joinChannel(alpha).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_stat_icon.png'), mono);
  }
  console.log('通知栏小图标已生成：ic_stat_icon');
}

try {
  await makeIcons();
} catch (err) {
  // 图标失败不影响能不能装，只记录一下
  console.log('图标生成失败，沿用默认图标：' + err.message);
}
