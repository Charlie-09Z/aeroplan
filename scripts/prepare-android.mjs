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
    },
    {
      name: 'android.permission.USE_FULL_SCREEN_INTENT',
      attrs: '',
      note: '全屏提醒（可选）：原生通道在锁屏时用全屏意图显示到点提醒'
    },
    {
      name: 'android.permission.READ_CALENDAR',
      attrs: '',
      note: '日历读取（可选）：开启「同时写入系统日历」时读取本应用建的专用日历'
    },
    {
      name: 'android.permission.WRITE_CALENDAR',
      attrs: '',
      note: '日历写入（可选）：开启「同时写入系统日历」时写入专用日历'
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
  // 原生提醒通道：广播接收器 + 开机重排接收器（不经过 Capacitor 插件）
  if (!manifest.includes('AeroReminderReceiver')) {
    manifest = manifest.replace('</application>',
      '    <receiver android:name=".AeroReminderReceiver" android:exported="false" />\n' +
      '    <receiver android:name=".AeroReminderBootReceiver" android:exported="true">\n' +
      '        <intent-filter>\n' +
      '            <action android:name="android.intent.action.BOOT_COMPLETED" />\n' +
      '            <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />\n' +
      '            <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />\n' +
      '        </intent-filter>\n' +
      '    </receiver>\n' +
      '</application>');
  }
  if (!manifest.includes('AeroReminderReceiver')) {
    console.error('清单接收器注入失败：没有找到 </application>');
    process.exit(1);
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
  // 整份重写：同一个包内不需要 import 自己的类。
  // registerPlugin 必须在 super.onCreate 之前；addJavascriptInterface 必须在 super.onCreate 之后
  // （此时 this.bridge 与 WebView 才存在）。
  const mainActivitySource =
    'package ' + APP_ID + ';\n\n' +
    'import android.os.Bundle;\n' +
    'import android.webkit.WebView;\n\n' +
    'import com.getcapacitor.BridgeActivity;\n\n' +
    'public class MainActivity extends BridgeActivity {\n' +
    '    @Override\n' +
    '    public void onCreate(Bundle savedInstanceState) {\n' +
    '        WebView.setWebContentsDebuggingEnabled(false);\n' +
    '        registerPlugin(AeroCalendarPlugin.class);\n' +
    '        super.onCreate(savedInstanceState);\n' +
    '        if (this.bridge != null && this.bridge.getWebView() != null) {\n' +
    '            this.bridge.getWebView().addJavascriptInterface(\n' +
    '                new AeroNativeBridge(getApplicationContext()), "AeroNativeReminders");\n' +
    '        }\n' +
    '    }\n' +
    '}\n';
  writeIfChanged(mainActivityPath, mainActivitySource);
  java = fs.readFileSync(mainActivityPath, 'utf8');
  if (java.includes('AeroNativeReminders') && java.includes('registerPlugin(AeroCalendarPlugin.class)')) {
    console.log('已写入 MainActivity：关闭 WebView 调试、注册日历插件、注入原生提醒桥');
  } else {
    console.error('构建断言失败：MainActivity 未正确写入原生提醒桥');
    process.exit(1);
  }
} else {
  console.log('没有找到 MainActivity.java，跳过 WebView 调试开关');
}

// ---------- 3.4 原生提醒通道 + 可选日历插件 ----------
// 这条通道完全不经过 Capacitor 的 LocalNotifications 插件：
// AlarmManager.setExactAndAllowWhileIdle + BroadcastReceiver + NotificationCompat。
// 之所以自建，是因为插件链路在真机上「排程成功但从不投递」，无法再在其内部定位。
const NATIVE_CHANNEL_ID = 'aeroplan-native-v1';
const javaPackageDir = path.dirname(mainActivityPath || expectedMainActivity);
fs.mkdirSync(javaPackageDir, { recursive: true });
const bridgeSource =
  'package ' + APP_ID + ';\n\n' +
  'import android.app.AlarmManager;\n' +
  'import android.app.Notification;\n' +
  'import android.app.NotificationChannel;\n' +
  'import android.app.NotificationManager;\n' +
  'import android.app.PendingIntent;\n' +
  'import android.content.Context;\n' +
  'import android.content.Intent;\n' +
  'import android.content.SharedPreferences;\n' +
  'import android.media.AudioAttributes;\n' +
  'import android.os.Build;\n' +
  'import android.provider.Settings;\n' +
  'import android.webkit.JavascriptInterface;\n\n' +
  'import androidx.core.app.NotificationManagerCompat;\n\n' +
  'import org.json.JSONArray;\n' +
  'import org.json.JSONObject;\n\n' +
  'import java.util.Iterator;\n\n' +
  'public class AeroNativeBridge {\n' +
  '    public static final String PREFS = "aeroplan_native_reminders";\n' +
  '    public static final String KEY_SCHEDULED = "scheduled";\n' +
  '    public static final String KEY_LAST_SCHEDULE_AT = "last_schedule_at";\n' +
  '    public static final String KEY_LAST_SCHEDULE_RESULT = "last_schedule_result";\n' +
  '    public static final String KEY_LAST_DELIVERY_AT = "last_delivery_at";\n' +
  '    public static final String KEY_LAST_ERROR = "last_error";\n' +
  '    public static final String CHANNEL_ID = "' + NATIVE_CHANNEL_ID + '";\n' +
  '    public static final String CHANNEL_NAME = "日程提醒（原生）";\n' +
  '    public static final String ACTION_FIRE = "com.aeroplan.app.NATIVE_REMINDER";\n\n' +
  '    private final Context context;\n\n' +
  '    public AeroNativeBridge(Context context) {\n' +
  '        this.context = context.getApplicationContext();\n' +
  '        ensureChannel(this.context);\n' +
  '    }\n\n' +
  '    public static SharedPreferences prefs(Context ctx) {\n' +
  '        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);\n' +
  '    }\n\n' +
  '    public static void logError(Context ctx, String message) {\n' +
  '        SharedPreferences.Editor e = prefs(ctx).edit();\n' +
  '        e.putString(KEY_LAST_ERROR, System.currentTimeMillis() + " " + message);\n' +
  '        e.apply();\n' +
  '    }\n\n' +
  '    public static void ensureChannel(Context ctx) {\n' +
  '        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;\n' +
  '        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);\n' +
  '        if (nm == null) return;\n' +
  '        NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);\n' +
  '        if (ch == null) {\n' +
  '            ch = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);\n' +
  '            ch.setDescription("AeroPlan 原生提醒通道：不经过 Capacitor 插件");\n' +
  '            ch.setShowBadge(true);\n' +
  '            ch.enableVibration(true);\n' +
  '            ch.setVibrationPattern(new long[]{0, 250, 200, 250});\n' +
  '            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);\n' +
  '            try {\n' +
  '                AudioAttributes attrs = new AudioAttributes.Builder()\n' +
  '                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)\n' +
  '                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)\n' +
  '                    .build();\n' +
  '                ch.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, attrs);\n' +
  '            } catch (Throwable ignored) { }\n' +
  '            nm.createNotificationChannel(ch);\n' +
  '        }\n' +
  '    }\n\n' +
  '    public static PendingIntent fireIntent(Context ctx, int id) {\n' +
  '        Intent intent = new Intent(ctx, AeroReminderReceiver.class);\n' +
  '        intent.setAction(ACTION_FIRE);\n' +
  '        intent.putExtra("id", id);\n' +
  '        int flags = PendingIntent.FLAG_UPDATE_CURRENT;\n' +
  '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;\n' +
  '        return PendingIntent.getBroadcast(ctx, id, intent, flags);\n' +
  '    }\n\n' +
  '    public static void scheduleOne(Context ctx, int id, long at, String title, String body) {\n' +
  '        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);\n' +
  '        if (am == null) throw new IllegalStateException("no AlarmManager");\n' +
  '        PendingIntent pi = fireIntent(ctx, id);\n' +
  '        long trigger = Math.max(at, System.currentTimeMillis() + 1000L);\n' +
  '        boolean exact = true;\n' +
  '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {\n' +
  '            exact = am.canScheduleExactAlarms();\n' +
  '        }\n' +
  '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {\n' +
  '            if (exact) {\n' +
  '                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);\n' +
  '            } else {\n' +
  '                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);\n' +
  '            }\n' +
  '        } else {\n' +
  '            am.set(AlarmManager.RTC_WAKEUP, trigger, pi);\n' +
  '        }\n' +
  '    }\n\n' +
  '    public static void rescheduleAll(Context ctx) {\n' +
  '        ensureChannel(ctx);\n' +
  '        JSONObject stored = readScheduled(ctx);\n' +
  '        Iterator<String> it = stored.keys();\n' +
  '        while (it.hasNext()) {\n' +
  '            String key = it.next();\n' +
  '            JSONObject n = stored.optJSONObject(key);\n' +
  '            if (n == null) continue;\n' +
  '            long at = n.optLong("at", 0);\n' +
  '            if (at <= System.currentTimeMillis()) continue;\n' +
  '            try {\n' +
  '                scheduleOne(ctx, Integer.parseInt(key), at, n.optString("title", ""), n.optString("body", ""));\n' +
  '            } catch (Throwable err) { logError(ctx, "boot reschedule " + key + ": " + err.getMessage()); }\n' +
  '        }\n' +
  '    }\n\n' +
  '    public static JSONObject readScheduled(Context ctx) {\n' +
  '        try {\n' +
  '            String raw = prefs(ctx).getString(KEY_SCHEDULED, "{}");\n' +
  '            return new JSONObject(raw);\n' +
  '        } catch (Throwable err) {\n' +
  '            return new JSONObject();\n' +
  '        }\n' +
  '    }\n\n' +
  '    public static void writeScheduled(Context ctx, JSONObject stored) {\n' +
  '        prefs(ctx).edit().putString(KEY_SCHEDULED, stored.toString()).apply();\n' +
  '    }\n\n' +
  '    @JavascriptInterface\n' +
  '    public String schedule(String json) {\n' +
  '        try {\n' +
  '            JSONObject input = new JSONObject(json == null ? "{}" : json);\n' +
  '            JSONArray list = input.optJSONArray("notifications");\n' +
  '            if (list == null) list = new JSONArray();\n' +
  '            JSONObject stored = readScheduled(context);\n' +
  '            int ok = 0;\n' +
  '            JSONArray ids = new JSONArray();\n' +
  '            for (int i = 0; i < list.length(); i++) {\n' +
  '                JSONObject n = list.optJSONObject(i);\n' +
  '                if (n == null) continue;\n' +
  '                int id = n.optInt("id", 0);\n' +
  '                long at = n.optLong("at", 0);\n' +
  '                if (id <= 0 || at <= 0) continue;\n' +
  '                try {\n' +
  '                    scheduleOne(context, id, at, n.optString("title", ""), n.optString("body", ""));\n' +
  '                    stored.put(String.valueOf(id), n);\n' +
  '                    ids.put(id);\n' +
  '                    ok++;\n' +
  '                } catch (Throwable err) {\n' +
  '                    logError(context, "schedule id " + id + ": " + err.getMessage());\n' +
  '                }\n' +
  '            }\n' +
  '            writeScheduled(context, stored);\n' +
  '            SharedPreferences.Editor e = prefs(context).edit();\n' +
  '            e.putLong(KEY_LAST_SCHEDULE_AT, System.currentTimeMillis());\n' +
  '            e.putString(KEY_LAST_SCHEDULE_RESULT, ok + "/" + list.length());\n' +
  '            e.apply();\n' +
  '            JSONObject ret = new JSONObject();\n' +
  '            ret.put("ok", true);\n' +
  '            ret.put("requested", list.length());\n' +
  '            ret.put("scheduled", ok);\n' +
  '            ret.put("ids", ids);\n' +
  '            ret.put("channelId", CHANNEL_ID);\n' +
  '            return ret.toString();\n' +
  '        } catch (Throwable err) {\n' +
  '            logError(context, "schedule: " + err.getMessage());\n' +
  '            return "{\\"ok\\":false,\\"error\\":\\"" + String.valueOf(err.getMessage()).replace("\\"", "'") + "\\"}";\n' +
  '        }\n' +
  '    }\n\n' +
  '    @JavascriptInterface\n' +
  '    public String cancelAll() {\n' +
  '        int cancelled = 0;\n' +
  '        try {\n' +
  '            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);\n' +
  '            JSONObject stored = readScheduled(context);\n' +
  '            Iterator<String> it = stored.keys();\n' +
  '            while (it.hasNext()) {\n' +
  '                int id = Integer.parseInt(it.next());\n' +
  '                PendingIntent pi = fireIntent(context, id);\n' +
  '                if (am != null) am.cancel(pi);\n' +
  '                pi.cancel();\n' +
  '                cancelled++;\n' +
  '            }\n' +
  '            writeScheduled(context, new JSONObject());\n' +
  '        } catch (Throwable err) {\n' +
  '            logError(context, "cancelAll: " + err.getMessage());\n' +
  '        }\n' +
  '        return "{\\"ok\\":true,\\"cancelled\\":" + cancelled + "}";\n' +
  '    }\n\n' +
  '    @JavascriptInterface\n' +
  '    public String listScheduled() {\n' +
  '        try {\n' +
  '            JSONObject stored = readScheduled(context);\n' +
  '            JSONArray items = new JSONArray();\n' +
  '            Iterator<String> it = stored.keys();\n' +
  '            while (it.hasNext()) {\n' +
  '                String key = it.next();\n' +
  '                JSONObject n = stored.optJSONObject(key);\n' +
  '                if (n != null) items.put(n);\n' +
  '            }\n' +
  '            JSONObject ret = new JSONObject();\n' +
  '            ret.put("ok", true);\n' +
  '            ret.put("count", items.length());\n' +
  '            ret.put("items", items);\n' +
  '            return ret.toString();\n' +
  '        } catch (Throwable err) {\n' +
  '            return "{\\"ok\\":false,\\"error\\":\\"" + String.valueOf(err.getMessage()).replace("\\"", "'") + "\\"}";\n' +
  '        }\n' +
  '    }\n\n' +
  '    @JavascriptInterface\n' +
  '    public String postTest(int seconds) {\n' +
  '        int id = 999000001;\n' +
  '        long at = System.currentTimeMillis() + Math.max(1, seconds) * 1000L;\n' +
  '        try {\n' +
  '            scheduleOne(context, id, at, "AeroPlan 原生通道自检", "这条来自原生 AlarmManager 通道，10 秒后到");\n' +
  '            JSONObject stored = readScheduled(context);\n' +
  '            JSONObject n = new JSONObject();\n' +
  '            n.put("id", id);\n' +
  '            n.put("at", at);\n' +
  '            n.put("title", "AeroPlan 原生通道自检");\n' +
  '            n.put("body", "这条来自原生 AlarmManager 通道");\n' +
  '            stored.put(String.valueOf(id), n);\n' +
  '            writeScheduled(context, stored);\n' +
  '            JSONObject ret = new JSONObject();\n' +
  '            ret.put("ok", true);\n' +
  '            ret.put("id", id);\n' +
  '            ret.put("at", at);\n' +
  '            return ret.toString();\n' +
  '        } catch (Throwable err) {\n' +
  '            logError(context, "postTest: " + err.getMessage());\n' +
  '            return "{\\"ok\\":false,\\"error\\":\\"" + String.valueOf(err.getMessage()).replace("\\"", "'") + "\\"}";\n' +
  '        }\n' +
  '    }\n\n' +
  '    @JavascriptInterface\n' +
  '    public String getDiagnostics() {\n' +
  '        try {\n' +
  '            JSONObject ret = new JSONObject();\n' +
  '            SharedPreferences p = prefs(context);\n' +
  '            ret.put("bridge", true);\n' +
  '            ret.put("channelId", CHANNEL_ID);\n' +
  '            int importance = -1;\n' +
  '            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n' +
  '                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);\n' +
  '                if (nm != null) {\n' +
  '                    NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);\n' +
  '                    if (ch != null) importance = ch.getImportance();\n' +
  '                }\n' +
  '            }\n' +
  '            ret.put("channelImportance", importance);\n' +
  '            ret.put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled());\n' +
  '            boolean exact = true;\n' +
  '            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {\n' +
  '                AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);\n' +
  '                exact = am != null && am.canScheduleExactAlarms();\n' +
  '            }\n' +
  '            ret.put("exactAlarms", exact);\n' +
  '            ret.put("scheduledCount", readScheduled(context).length());\n' +
  '            ret.put("lastScheduleAt", p.getLong(KEY_LAST_SCHEDULE_AT, 0));\n' +
  '            ret.put("lastScheduleResult", p.getString(KEY_LAST_SCHEDULE_RESULT, ""));\n' +
  '            ret.put("lastDeliveryAt", p.getLong(KEY_LAST_DELIVERY_AT, 0));\n' +
  '            ret.put("lastError", p.getString(KEY_LAST_ERROR, ""));\n' +
  '            ret.put("brand", Build.BRAND == null ? "" : Build.BRAND);\n' +
  '            ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);\n' +
  '            ret.put("model", Build.MODEL == null ? "" : Build.MODEL);\n' +
  '            ret.put("sdk", Build.VERSION.SDK_INT);\n' +
  '            return ret.toString();\n' +
  '        } catch (Throwable err) {\n' +
  '            return "{\\"ok\\":false,\\"error\\":\\"" + String.valueOf(err.getMessage()).replace("\\"", "'") + "\\"}";\n' +
  '        }\n' +
  '    }\n' +
  '}\n';

const receiverSource =
  'package ' + APP_ID + ';\n\n' +
  'import android.app.Notification;\n' +
  'import android.app.NotificationManager;\n' +
  'import android.app.PendingIntent;\n' +
  'import android.content.BroadcastReceiver;\n' +
  'import android.content.Context;\n' +
  'import android.content.Intent;\n' +
  'import android.content.SharedPreferences;\n' +
  'import android.os.Build;\n\n' +
  'import androidx.core.app.NotificationCompat;\n\n' +
  'import org.json.JSONObject;\n\n' +
  'public class AeroReminderReceiver extends BroadcastReceiver {\n' +
  '    @Override\n' +
  '    public void onReceive(Context context, Intent intent) {\n' +
  '        int id = intent.getIntExtra("id", 0);\n' +
  '        if (id <= 0) id = (int) (System.currentTimeMillis() % 100000000);\n' +
  '        JSONObject stored = AeroNativeBridge.readScheduled(context);\n' +
  '        JSONObject n = stored.optJSONObject(String.valueOf(id));\n' +
  '        String title = n != null ? n.optString("title", "AeroPlan 提醒") : "AeroPlan 提醒";\n' +
  '        String body = n != null ? n.optString("body", "") : "";\n' +
  '        try {\n' +
  '            AeroNativeBridge.ensureChannel(context);\n' +
  '            show(context, id, title, body);\n' +
  '            SharedPreferences.Editor e = AeroNativeBridge.prefs(context).edit();\n' +
  '            e.putLong(AeroNativeBridge.KEY_LAST_DELIVERY_AT, System.currentTimeMillis());\n' +
  '            e.apply();\n' +
  '        } catch (Throwable err) {\n' +
  '            AeroNativeBridge.logError(context, "deliver id " + id + ": " + err.getMessage());\n' +
  '        }\n' +
  '        stored.remove(String.valueOf(id));\n' +
  '        AeroNativeBridge.writeScheduled(context, stored);\n' +
  '    }\n\n' +
  '    private void show(Context context, int id, String title, String body) {\n' +
  '        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);\n' +
  '        if (nm == null) return;\n' +
  '        Intent open = new Intent(context, MainActivity.class);\n' +
  '        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);\n' +
  '        int flags = PendingIntent.FLAG_UPDATE_CURRENT;\n' +
  '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;\n' +
  '        PendingIntent content = PendingIntent.getActivity(context, id, open, flags);\n' +
  '        int icon = context.getResources().getIdentifier("ic_stat_icon", "drawable", context.getPackageName());\n' +
  '        if (icon == 0) icon = android.R.drawable.ic_dialog_info;\n' +
  '        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, AeroNativeBridge.CHANNEL_ID)\n' +
  '            .setContentTitle(title)\n' +
  '            .setContentText(body)\n' +
  '            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))\n' +
  '            .setSmallIcon(icon)\n' +
  '            .setPriority(NotificationCompat.PRIORITY_HIGH)\n' +
  '            .setCategory(NotificationCompat.CATEGORY_REMINDER)\n' +
  '            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)\n' +
  '            .setAutoCancel(true)\n' +
  '            .setContentIntent(content)\n' +
  '            .setDefaults(NotificationCompat.DEFAULT_ALL)\n' +
  '            .setWhen(System.currentTimeMillis());\n' +
  '        try {\n' +
  '            builder.setFullScreenIntent(content, true);\n' +
  '        } catch (Throwable ignored) { }\n' +
  '        Notification notification = builder.build();\n' +
  '        nm.notify(id, notification);\n' +
  '    }\n' +
  '}\n';

const bootReceiverSource =
  'package ' + APP_ID + ';\n\n' +
  'import android.content.BroadcastReceiver;\n' +
  'import android.content.Context;\n' +
  'import android.content.Intent;\n\n' +
  'public class AeroReminderBootReceiver extends BroadcastReceiver {\n' +
  '    @Override\n' +
  '    public void onReceive(Context context, Intent intent) {\n' +
  '        try {\n' +
  '            AeroNativeBridge.rescheduleAll(context);\n' +
  '        } catch (Throwable err) {\n' +
  '            AeroNativeBridge.logError(context, "boot: " + err.getMessage());\n' +
  '        }\n' +
  '    }\n' +
  '}\n';

const calendarPluginSource =
  'package ' + APP_ID + ';\n\n' +
  'import android.Manifest;\n' +
  'import android.content.ContentResolver;\n' +
  'import android.content.ContentUris;\n' +
  'import android.content.ContentValues;\n' +
  'import android.content.Intent;\n' +
  'import android.net.Uri;\n' +
  'import android.provider.CalendarContract;\n' +
  'import android.provider.Settings;\n\n' +
  'import com.getcapacitor.JSObject;\n' +
  'import com.getcapacitor.PermissionState;\n' +
  'import com.getcapacitor.Plugin;\n' +
  'import com.getcapacitor.PluginCall;\n' +
  'import com.getcapacitor.PluginMethod;\n' +
  'import com.getcapacitor.annotation.CapacitorPlugin;\n' +
  'import com.getcapacitor.annotation.Permission;\n' +
  'import com.getcapacitor.annotation.PermissionCallback;\n\n' +
  'import java.util.TimeZone;\n\n' +
  '@CapacitorPlugin(\n' +
  '    name = "AeroCalendar",\n' +
  '    permissions = {\n' +
  '        @Permission(alias = "readCalendar", strings = { Manifest.permission.READ_CALENDAR }),\n' +
  '        @Permission(alias = "writeCalendar", strings = { Manifest.permission.WRITE_CALENDAR })\n' +
  '    }\n' +
  ')\n' +
  'public class AeroCalendarPlugin extends Plugin {\n' +
  '    private static final String ACCOUNT_NAME = "AeroPlan";\n\n' +
  '    @PluginMethod\n' +
  '    public void deviceInfo(PluginCall call) {\n' +
  '        JSObject ret = new JSObject();\n' +
  '        ret.put("brand", android.os.Build.BRAND == null ? "" : android.os.Build.BRAND);\n' +
  '        ret.put("manufacturer", android.os.Build.MANUFACTURER == null ? "" : android.os.Build.MANUFACTURER);\n' +
  '        ret.put("model", android.os.Build.MODEL == null ? "" : android.os.Build.MODEL);\n' +
  '        ret.put("sdk", android.os.Build.VERSION.SDK_INT);\n' +
  '        call.resolve(ret);\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void openAppSettings(PluginCall call) {\n' +
  '        try {\n' +
  '            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);\n' +
  '            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));\n' +
  '            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);\n' +
  '            getContext().startActivity(intent);\n' +
  '            call.resolve();\n' +
  '        } catch (Throwable err) {\n' +
  '            call.reject(String.valueOf(err.getMessage()));\n' +
  '        }\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void checkCalendarPermission(PluginCall call) {\n' +
  '        JSObject ret = new JSObject();\n' +
  '        ret.put("read", getPermissionState("readCalendar") == PermissionState.GRANTED);\n' +
  '        ret.put("write", getPermissionState("writeCalendar") == PermissionState.GRANTED);\n' +
  '        call.resolve(ret);\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void requestCalendarPermission(PluginCall call) {\n' +
  '        if (getPermissionState("readCalendar") == PermissionState.GRANTED &&\n' +
  '            getPermissionState("writeCalendar") == PermissionState.GRANTED) {\n' +
  '            checkCalendarPermission(call);\n' +
  '            return;\n' +
  '        }\n' +
  '        requestPermissionForAliases(new String[]{"readCalendar", "writeCalendar"}, call, "calendarPermissionCallback");\n' +
  '    }\n\n' +
  '    @PermissionCallback\n' +
  '    private void calendarPermissionCallback(PluginCall call) {\n' +
  '        checkCalendarPermission(call);\n' +
  '    }\n\n' +
  '    private Uri asSyncAdapter(Uri uri) {\n' +
  '        return uri.buildUpon()\n' +
  '            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")\n' +
  '            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT_NAME)\n' +
  '            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)\n' +
  '            .build();\n' +
  '    }\n\n' +
  '    private long findCalendar(String name) {\n' +
  '        ContentResolver cr = getContext().getContentResolver();\n' +
  '        android.database.Cursor cursor = null;\n' +
  '        try {\n' +
  '            cursor = cr.query(CalendarContract.Calendars.CONTENT_URI,\n' +
  '                new String[]{CalendarContract.Calendars._ID},\n' +
  '                CalendarContract.Calendars.ACCOUNT_NAME + "=? AND " +\n' +
  '                    CalendarContract.Calendars.ACCOUNT_TYPE + "=? AND " +\n' +
  '                    CalendarContract.Calendars.CALENDAR_DISPLAY_NAME + "=?",\n' +
  '                new String[]{ACCOUNT_NAME, CalendarContract.ACCOUNT_TYPE_LOCAL, name}, null);\n' +
  '            if (cursor != null && cursor.moveToFirst()) return cursor.getLong(0);\n' +
  '        } finally {\n' +
  '            if (cursor != null) cursor.close();\n' +
  '        }\n' +
  '        return -1;\n' +
  '    }\n\n' +
  '    private long createCalendar(String name) {\n' +
  '        ContentValues values = new ContentValues();\n' +
  '        values.put(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT_NAME);\n' +
  '        values.put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);\n' +
  '        values.put(CalendarContract.Calendars.NAME, name);\n' +
  '        values.put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, name);\n' +
  '        values.put(CalendarContract.Calendars.CALENDAR_COLOR, 0xFF4C6FFF);\n' +
  '        values.put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER);\n' +
  '        values.put(CalendarContract.Calendars.OWNER_ACCOUNT, ACCOUNT_NAME);\n' +
  '        values.put(CalendarContract.Calendars.VISIBLE, 1);\n' +
  '        values.put(CalendarContract.Calendars.SYNC_EVENTS, 1);\n' +
  '        values.put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());\n' +
  '        Uri uri = getContext().getContentResolver().insert(asSyncAdapter(CalendarContract.Calendars.CONTENT_URI), values);\n' +
  '        return uri == null ? -1 : ContentUris.parseId(uri);\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void ensureCalendar(PluginCall call) {\n' +
  '        String name = call.getString("name", "AeroPlan 提醒");\n' +
  '        try {\n' +
  '            long id = findCalendar(name);\n' +
  '            if (id <= 0) id = createCalendar(name);\n' +
  '            if (id <= 0) {\n' +
  '                call.reject("无法创建专用日历：设备上没有可写的本地日历账户");\n' +
  '                return;\n' +
  '            }\n' +
  '            JSObject ret = new JSObject();\n' +
  '            ret.put("calendarId", id);\n' +
  '            ret.put("name", name);\n' +
  '            call.resolve(ret);\n' +
  '        } catch (Throwable err) {\n' +
  '            call.reject("无法创建专用日历：" + err.getMessage());\n' +
  '        }\n' +
  '    }\n\n' +
  '    private long insertEvent(ContentValues values) {\n' +
  '        Uri uri = getContext().getContentResolver().insert(asSyncAdapter(CalendarContract.Events.CONTENT_URI), values);\n' +
  '        return uri == null ? -1 : ContentUris.parseId(uri);\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void upsertEvent(PluginCall call) {\n' +
  '        Long calendarId = call.getLong("calendarId");\n' +
  '        Long begin = call.getLong("begin");\n' +
  '        if (calendarId == null || begin == null) {\n' +
  '            call.reject("缺少 calendarId 或 begin");\n' +
  '            return;\n' +
  '        }\n' +
  '        try {\n' +
  '            ContentResolver cr = getContext().getContentResolver();\n' +
  '            ContentValues values = new ContentValues();\n' +
  '            values.put(CalendarContract.Events.CALENDAR_ID, calendarId);\n' +
  '            values.put(CalendarContract.Events.TITLE, call.getString("title", "AeroPlan"));\n' +
  '            values.put(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));\n' +
  '            values.put(CalendarContract.Events.DTSTART, begin);\n' +
  '            Long end = call.getLong("end");\n' +
  '            values.put(CalendarContract.Events.DTEND, end != null ? end : begin + 1800000L);\n' +
  '            values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());\n' +
  '            values.put(CalendarContract.Events.HAS_ALARM, 1);\n' +
  '            values.put(CalendarContract.Events.EVENT_LOCATION, call.getString("location", ""));\n' +
  '            Long eventId = call.getLong("eventId");\n' +
  '            long id = -1;\n' +
  '            if (eventId != null && eventId > 0) {\n' +
  '                Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId);\n' +
  '                int rows = cr.update(uri, values, null, null);\n' +
  '                id = rows > 0 ? eventId : insertEvent(values);\n' +
  '            } else {\n' +
  '                id = insertEvent(values);\n' +
  '            }\n' +
  '            if (id <= 0) {\n' +
  '                call.reject("无法写入日历事件");\n' +
  '                return;\n' +
  '            }\n' +
  '            cr.delete(CalendarContract.Reminders.CONTENT_URI,\n' +
  '                CalendarContract.Reminders.EVENT_ID + "=?", new String[]{String.valueOf(id)});\n' +
  '            ContentValues rv = new ContentValues();\n' +
  '            rv.put(CalendarContract.Reminders.EVENT_ID, id);\n' +
  '            rv.put(CalendarContract.Reminders.MINUTES, Math.min(1440, call.getInt("remind", 0)));\n' +
  '            rv.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);\n' +
  '            cr.insert(CalendarContract.Reminders.CONTENT_URI, rv);\n' +
  '            JSObject ret = new JSObject();\n' +
  '            ret.put("eventId", id);\n' +
  '            call.resolve(ret);\n' +
  '        } catch (Throwable err) {\n' +
  '            call.reject("写入日历失败：" + err.getMessage());\n' +
  '        }\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void deleteEvent(PluginCall call) {\n' +
  '        Long eventId = call.getLong("eventId");\n' +
  '        if (eventId == null) {\n' +
  '            call.reject("缺少 eventId");\n' +
  '            return;\n' +
  '        }\n' +
  '        try {\n' +
  '            int rows = getContext().getContentResolver().delete(\n' +
  '                ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId), null, null);\n' +
  '            JSObject ret = new JSObject();\n' +
  '            ret.put("removed", rows);\n' +
  '            call.resolve(ret);\n' +
  '        } catch (Throwable err) {\n' +
  '            call.reject("删除日历事件失败：" + err.getMessage());\n' +
  '        }\n' +
  '    }\n\n' +
  '    @PluginMethod\n' +
  '    public void clearCalendar(PluginCall call) {\n' +
  '        String name = call.getString("name", "AeroPlan 提醒");\n' +
  '        int removed = 0;\n' +
  '        try {\n' +
  '            long id = findCalendar(name);\n' +
  '            if (id > 0) {\n' +
  '                removed = getContext().getContentResolver().delete(CalendarContract.Events.CONTENT_URI,\n' +
  '                    CalendarContract.Events.CALENDAR_ID + "=?", new String[]{String.valueOf(id)});\n' +
  '            }\n' +
  '            JSObject ret = new JSObject();\n' +
  '            ret.put("removed", removed);\n' +
  '            call.resolve(ret);\n' +
  '        } catch (Throwable err) {\n' +
  '            call.reject("清空专用日历失败：" + err.getMessage());\n' +
  '        }\n' +
  '    }\n' +
  '}\n';

const generated = [
  ['AeroNativeBridge.java', bridgeSource],
  ['AeroReminderReceiver.java', receiverSource],
  ['AeroReminderBootReceiver.java', bootReceiverSource],
  ['AeroCalendarPlugin.java', calendarPluginSource]
];
generated.forEach(function (pair) {
  const file = path.join(javaPackageDir, pair[0]);
  writeIfChanged(file, pair[1]);
  if (!fs.existsSync(file)) {
    console.error('构建断言失败：没有生成 ' + pair[0]);
    process.exit(1);
  }
});
console.log('已生成原生提醒通道：AeroNativeBridge / AeroReminderReceiver / AeroReminderBootReceiver');
console.log('已生成可选日历插件：AeroCalendarPlugin（专用日历「AeroPlan 提醒」）');


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
  // 图标失败不再只是“记录一下”：没有合法的小图标，Android 会在到点时
  // 静默丢弃整条通知（排程成功、却永远不响）。下面会做兜底校验。
  console.log('图标生成失败，尝试兜底：' + err.message);
}

// 校验通知小图标：必须真实存在于 res/drawable-*，且是 PNG 文件（有魔数、大小 > 0）。
// 缺失时把启动器图标复制成 ic_stat_icon 兜底，避免整条通知在投递阶段被系统丢掉。
{
  const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  const isPng = function (file) {
    try {
      const buf = fs.readFileSync(file);
      return buf.length > 64 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    } catch (err) { return false; }
  };
  const missing = [];
  for (const dpi of densities) {
    const file = path.join(resDir, 'drawable-' + dpi, 'ic_stat_icon.png');
    if (!isPng(file)) missing.push(dpi);
  }
  if (missing.length) {
    // 找一个能用的启动器图标当兜底（优先前景/高密度）
    const candidates = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi'].map(function (dpi) {
      return path.join(resDir, 'mipmap-' + dpi, 'ic_launcher.png');
    }).concat([path.join(resDir, 'drawable', 'ic_launcher_foreground.png')]);
    const fallback = candidates.filter(function (file) {
      try { return fs.existsSync(file) && fs.statSync(file).size > 64; } catch (err) { return false; }
    })[0];
    if (!fallback) {
      console.error('通知小图标 ic_stat_icon 缺失，且找不到可兜底的启动器图标；到点通知会被系统静默丢弃');
      process.exit(1);
    }
    for (const dpi of missing) {
      const dir = path.join(resDir, 'drawable-' + dpi);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(fallback, path.join(dir, 'ic_stat_icon.png'));
    }
    console.warn('已用启动器图标兜底 ic_stat_icon（建议修好图标生成，否则部分系统显示为灰色方块）：' + path.basename(fallback));
  } else {
    console.log('通知小图标校验通过：res/drawable-*/ic_stat_icon.png');
  }
}
