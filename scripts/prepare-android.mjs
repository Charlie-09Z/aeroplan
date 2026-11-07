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

// ---------- 0. 应用标识（包名） ----------
// 包名以 capacitor.config.json 为唯一来源：改名会让它变成「另一个应用」，
// 老版本无法覆盖升级、数据也不继承，所以这里同时强制写入 gradle 的 namespace 与 applicationId，
// 避免模板残留旧包名导致 MainActivity 包路径和清单对不上。
const capConfig = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const APP_ID = String(capConfig.appId || '');
if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(APP_ID)) {
  console.error('capacitor.config.json 里的 appId 不合法：' + APP_ID);
  process.exit(1);
}
const APP_ID_PATH = APP_ID.split('.');
console.log('应用包名（applicationId / namespace）：' + APP_ID);

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

// namespace / applicationId 必须和 appId 一致，否则清单里的 Activity 全限定名会指向不存在的类
if (/namespace\s+"[^"]*"/.test(gradle)) {
  gradle = gradle.replace(/namespace\s+"[^"]*"/, 'namespace "' + APP_ID + '"');
} else {
  console.error('警告：build.gradle 里没有 namespace，跳过包名同步');
}
if (/applicationId\s+"[^"]*"/.test(gradle)) {
  gradle = gradle.replace(/applicationId\s+"[^"]*"/, 'applicationId "' + APP_ID + '"');
} else {
  gradle = gradle.replace(/(defaultConfig\s*\{)/, '$1\n        applicationId "' + APP_ID + '"');
}

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
  '-keep class ' + APP_ID + '.** { *; }',
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
  '@raw/aeroplan_notify'
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
const noticeSoundPath = path.join(rawResDir, 'aeroplan_notify.wav');
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
console.log('已生成通知提示音：res/raw/aeroplan_notify.wav');

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
  // 模板里可能残留旧包名的全限定 Activity / provider，统一改成当前 appId
  manifest = manifest.replace(/\bcom\.qingricheng\.app\b/g, APP_ID);
  manifest = manifest.replace(/\bcom\.qingjihua\.app\b/g, APP_ID);
  // <manifest package="..."> 必须和 applicationId 一致，否则相对类名会解析到别处
  manifest = manifest.replace(/(<manifest\b[^>]*\spackage=")[^"]*(")/, '$1' + APP_ID + '$2');
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

// ---------- 3.3 构建期硬断言：权限 / SDK / 插件注册 ----------
// 这些是「通知不响」的常见断点，宁可构建失败，也不要产出「看起来能装但永远不弹」的包。
const variablesPath = path.join(androidDir, 'variables.gradle');
let targetSdk = 0;
if (fs.existsSync(variablesPath)) {
  const variables = fs.readFileSync(variablesPath, 'utf8');
  const m = variables.match(/targetSdkVersion\s*=\s*(\d+)/);
  if (m) targetSdk = Number(m[1]);
}
console.log('targetSdkVersion = ' + (targetSdk || '未知'));
if (!targetSdk || targetSdk < 33) {
  console.error('构建断言失败：targetSdkVersion 必须 >= 33（当前 ' + (targetSdk || '未知') + '）。' +
    '低于 33 时 Android 13+ 的 POST_NOTIFICATIONS 行为不一致，运行时授权链路无法保证。');
  process.exit(1);
}

const appManifestFinal = fs.readFileSync(manifestPath, 'utf8');
if (!/android\.permission\.POST_NOTIFICATIONS/.test(appManifestFinal)) {
  console.error('构建断言失败：AndroidManifest.xml 缺少 POST_NOTIFICATIONS');
  process.exit(1);
}

const pluginsJsonPath = path.join(androidDir, 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');
if (!fs.existsSync(pluginsJsonPath)) {
  // 这一步在 npx cap sync 之前，文件可能还没生成；硬断言放在构建末端的产物检查里
  console.warn('警告：还没有 capacitor.plugins.json（cap sync 之后会生成并在产物检查里硬校验）');
} else {
  const pluginsJson = fs.readFileSync(pluginsJsonPath, 'utf8');
  if (!/LocalNotifications/.test(pluginsJson)) {
    console.warn('警告：capacitor.plugins.json 里暂时没有 LocalNotifications，' +
      '若 cap sync 之后仍然缺失，产物检查会直接失败');
  } else {
    console.log('插件注册校验通过：capacitor.plugins.json 含 LocalNotifications');
  }
}

// 提示音与 keep.xml 的实际文件名必须一致，否则渠道建好后也没有声音
if (!fs.existsSync(noticeSoundPath)) {
  console.error('构建断言失败：缺少提示音资源 ' + noticeSoundPath);
  process.exit(1);
}
const legacySound = path.join(rawResDir, 'qingjihua_notify.wav');
if (fs.existsSync(legacySound)) fs.rmSync(legacySound, { force: true });
console.log('资源校验通过：res/raw/aeroplan_notify.wav 存在，旧命名已清理');

// ---------- 3.2 状态栏：浅色主题白底深色图标，深色主题深底浅色图标 ----------
// 运行时会通过 @capacitor/status-bar 按应用主题再设一次；这里写原生主题是为了
// 首帧（JS 还没执行时）不出现系统默认的黑色状态栏。
const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
const valuesDir = path.join(resDir, 'values');
fs.mkdirSync(valuesDir, { recursive: true });

function writeIfChanged(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.writeFileSync(file, content);
  return true;
}

writeIfChanged(
  path.join(valuesDir, 'colors.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
  '    <color name="status_bar">#F3F5FA</color>\n</resources>\n'
);
writeIfChanged(
  path.join(resDir, 'values-night', 'colors.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
  '    <color name="status_bar">#0F1117</color>\n</resources>\n'
);

const stylesPath = path.join(valuesDir, 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  const styleBlock = styles.match(/<style name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?<\/style>/);
  if (styleBlock) {
    let block = styleBlock[0];
    const ensureItem = function (xml, name, value) {
      const re = new RegExp('(\\s*)<item name="' + name.replace(/\./g, '\\.') + '">[\\s\\S]*?</item>');
      if (re.test(xml)) return xml.replace(re, '<item name="' + name + '">' + value + '</item>');
      return xml.replace('</style>', '    <item name="' + name + '">' + value + '</item>\n    </style>');
    };
    block = ensureItem(block, 'android:statusBarColor', '@color/status_bar');
    block = ensureItem(block, 'android:navigationBarColor', '@color/status_bar');
    block = ensureItem(block, 'android:windowLightStatusBar', 'true');
    block = ensureItem(block, 'android:windowDrawsSystemBarBackgrounds', 'true');
    styles = styles.replace(styleBlock[0], block);
    writeIfChanged(stylesPath, styles);

    // 深色模式：同一份样式，只把图标改为浅色
    const nightBlock = block.replace(
      /<item name="android:windowLightStatusBar">[^<]*<\/item>/,
      '<item name="android:windowLightStatusBar">false</item>'
    );
    writeIfChanged(
      path.join(resDir, 'values-night', 'styles.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    ' + nightBlock + '\n</resources>\n'
    );
    console.log('已写入状态栏主题（浅色：白底深色图标；深色：深底浅色图标）');
  } else {
    console.log('警告：styles.xml 里没有找到 AppTheme.NoActionBar，跳过了状态栏主题');
  }
} else {
  console.log('警告：没有找到 styles.xml，跳过了状态栏主题');
}

// ---------- 3.1 关闭 WebView 调试 ----------
// 包名变更后 MainActivity 的目录与 package 声明必须一起移动，否则编译不过。
const javaRoot = path.join(androidDir, 'app', 'src', 'main', 'java');
const expectedJavaDir = path.join.apply(path, [javaRoot].concat(APP_ID_PATH));
const expectedMainActivity = path.join(expectedJavaDir, 'MainActivity.java');

function findMainActivity() {
  if (fs.existsSync(expectedMainActivity)) return expectedMainActivity;
  const stack = [javaRoot];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === 'MainActivity.java') return full;
    }
  }
  return '';
}

let mainActivityPath = findMainActivity();
if (mainActivityPath && mainActivityPath !== expectedMainActivity) {
  fs.mkdirSync(expectedJavaDir, { recursive: true });
  let moved = fs.readFileSync(mainActivityPath, 'utf8');
  moved = moved.replace(/^package\s+[A-Za-z0-9_.]+;/m, 'package ' + APP_ID + ';');
  fs.writeFileSync(expectedMainActivity, moved);
  fs.rmSync(mainActivityPath, { force: true });
  mainActivityPath = expectedMainActivity;
  console.log('已把 MainActivity 移动到新包路径：' + APP_ID);
}
if (mainActivityPath) {
  let java = fs.readFileSync(mainActivityPath, 'utf8');
  // 包声明兜底：模板残留旧包名时直接改成本次构建的 appId
  java = java.replace(/^package\s+[A-Za-z0-9_.]+;/m, 'package ' + APP_ID + ';');
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
