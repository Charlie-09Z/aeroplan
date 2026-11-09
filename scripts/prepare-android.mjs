// 在 CI 生成 Android 工程之后、编译之前，写入这些内容：
//   1. 发布签名（keystore 由工作流从 GitHub Secrets 还原；口令只从环境变量读取，不进仓库）
//   2. 版本号（读 package.json，自动换算 versionCode）
//   3. 应用显示名与联网/振动权限（本版本不申请定位与存储权限）
//   4. R8 压缩/混淆 与 WebView 调试关闭
//   5. 应用图标与浅色启动图（用 sharp 从 icons 生成）
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const VERSION_CODE = parts[0] * 1000 + (parts[1] || 0) * 100 + (parts[2] || 0);

// keystore 由工作流从 Secrets 还原到 keystore/release.keystore；
// 口令与别名通过环境变量传入，仓库里不保存任何明文。
const KEYSTORE_PATH = '../../keystore/release.keystore';
const KEYSTORE_PASSWORD = process.env.KEYSTORE_PASSWORD || '';
const KEY_ALIAS = process.env.KEY_ALIAS || 'qingjihua';
const KEY_PASSWORD = process.env.KEY_PASSWORD || KEYSTORE_PASSWORD;
const HAS_SIGNING = !!KEYSTORE_PASSWORD;

// ---------- 1.1 版本号校验 ----------
if (!/^\d+\.\d+\.\d+$/.test(VERSION_NAME)) {
  console.error('package.json 里的 version 必须是 x.y.z：' + VERSION_NAME);
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

// shrinkResources 会误删「只在字符串里按名字引用」的资源（启动图、启动器图标）
const rawResDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'raw');
fs.mkdirSync(rawResDir, { recursive: true });
const KEEP_RESOURCES = [
  '@drawable/splash',
  '@mipmap/ic_launcher',
  '@mipmap/ic_launcher_round'
];
fs.writeFileSync(path.join(rawResDir, 'keep.xml'), [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<resources xmlns:tools="http://schemas.android.com/tools"',
  '    tools:keep="' + KEEP_RESOURCES.join(',') + '" />',
  ''
].join('\n'));
console.log('已写入 keep.xml，防止压缩误删：' + KEEP_RESOURCES.join('、'));

fs.writeFileSync(gradlePath, gradle);
console.log('已写入' + (HAS_SIGNING ? '签名配置' : '（无签名）') + '与版本号：versionName ' + VERSION_NAME +
  '（原来是 ' + (beforeVersion ? beforeVersion[0] : '未知') + '），versionCode ' + VERSION_CODE);

// ---------- 3. 应用显示名与权限 ----------
const APP_NAME = 'AeroPlan';

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
      name: 'android.permission.VIBRATE',
      attrs: '',
      note: '振动：滚轮吸附与轻触反馈的触觉反馈'
    }
  ];
  // 本版本没有定位、存储与提醒能力：模板、插件或旧配置带进这些权限时一律删掉。
  manifest = manifest.replace(/\s*<!--[^>]*定位[^>]*-->/g, '');
  manifest = manifest.replace(/\s*<!--[^>]*存储[^>]*-->/g, '');
  manifest = manifest.replace(/\s*<!--[^>]*通知[^>]*-->/g, '');
  manifest = manifest.replace(/\s*<!--[^>]*提醒[^>]*-->/g, '');
  manifest = manifest.replace(/\s*<!--[^>]*日历[^>]*-->/g, '');
  manifest = manifest.replace(
    /\s*<uses-permission[^>]*android:name="android\.permission\.(ACCESS_(FINE|COARSE)_LOCATION|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|POST_NOTIFICATIONS|SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM|RECEIVE_BOOT_COMPLETED|USE_FULL_SCREEN_INTENT|READ_CALENDAR|WRITE_CALENDAR)"[^>]*\/>/g,
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
  const forbidden = [
    'POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM',
    'RECEIVE_BOOT_COMPLETED', 'READ_CALENDAR', 'WRITE_CALENDAR'
  ].filter(function (name) {
    return written.includes('android:name="android.permission.' + name + '"');
  });
  if (missing.length) {
    console.error('清单权限校验失败，缺少：' + missing.map(function (p) { return p.name; }).join('、'));
    process.exit(1);
  }
  if (forbidden.length) {
    console.error('清单权限校验失败，仍有已移除的权限：' + forbidden.join('、'));
    process.exit(1);
  }
  console.log('清单权限校验通过：');
  needs.forEach(function (perm) {
    console.log('  ' + perm.name + (perm.attrs ? '（' + perm.attrs.trim() + '）' : ''));
  });
  console.log('已写入联网与振动权限；未申请定位、存储、通知、闹钟与日历权限');
} else {
  console.log('没有找到 AndroidManifest.xml，跳过权限写入');
}

// ---------- 3.3 构建期信息 ----------
const variablesPath = path.join(androidDir, 'variables.gradle');
let targetSdk = 0;
if (fs.existsSync(variablesPath)) {
  const variables = fs.readFileSync(variablesPath, 'utf8');
  const m = variables.match(/targetSdkVersion\s*=\s*(\d+)/);
  if (m) targetSdk = Number(m[1]);
}
console.log('targetSdkVersion = ' + (targetSdk || '未知'));

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
  const mainActivitySource =
    'package ' + APP_ID + ';\n\n' +
    'import android.os.Bundle;\n' +
    'import android.webkit.WebView;\n\n' +
    'import com.getcapacitor.BridgeActivity;\n\n' +
    'public class MainActivity extends BridgeActivity {\n' +
    '    @Override\n' +
    '    public void onCreate(Bundle savedInstanceState) {\n' +
    '        WebView.setWebContentsDebuggingEnabled(false);\n' +
    '        super.onCreate(savedInstanceState);\n' +
    '    }\n' +
    '}\n';
  writeIfChanged(mainActivityPath, mainActivitySource);
  java = fs.readFileSync(mainActivityPath, 'utf8');
  if (java.includes('setWebContentsDebuggingEnabled(false)')) {
    console.log('已写入 MainActivity：关闭 WebView 调试');
  } else {
    console.error('构建断言失败：MainActivity 未正确写入 WebView 调试开关');
    process.exit(1);
  }
} else {
  console.log('没有找到 MainActivity.java，跳过 WebView 调试开关');
}

// ---------- 4. Gradle 发行包：绕开 services.gradle.org 的 GitHub 跳转 ----------
// Capacitor 模板生成的 gradle-wrapper.properties 指向 services.gradle.org，
// 该域名 302 到 GitHub Releases（downloads.gradle.org 现在也 307 过去），CI 上反复 504。
// 这里改成国内镜像的 -bin 包（项目用不到 -all 里的源码与文档），并尽量预下载：
// 预下载成功且 zip 完整时写成 file: 地址，Gradle 构建时完全不联网；
// 两个镜像都失败时退回镜像 https 直链，仍然不会回到 GitHub。
const GRADLE_MIRRORS = [
  'https://mirrors.cloud.tencent.com/gradle/',
  'https://mirrors.huaweicloud.com/gradle/'
];
const wrapperPath = path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties');

function downloadOnce(url, dest, redirectsLeft) {
  return new Promise(function (resolve, reject) {
    const req = https.get(url, { timeout: 60000 }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(downloadOnce(new URL(res.headers.location, url).href, dest, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const expected = Number(res.headers['content-length'] || 0);
      let received = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', function (chunk) { received += chunk.length; });
      res.on('error', function (err) { out.destroy(); reject(err); });
      out.on('error', reject);
      out.on('finish', function () {
        if (expected && received !== expected) {
          reject(new Error('下载不完整：' + received + '/' + expected));
        } else {
          resolve();
        }
      });
      res.pipe(out);
    });
    req.on('timeout', function () { req.destroy(new Error('连接超时')); });
    req.on('error', reject);
  });
}

// 只看文件头（PK\3\4）和末尾中央目录签名（PK\5\6）：被截断或返回错误页时一定过不了
function zipLooksComplete(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size < 1024) return false;
    const head = Buffer.alloc(4);
    fs.readSync(fd, head, 0, 4, 0);
    if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) return false;
    const tailLen = Math.min(size, 66000);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    return tail.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  } finally {
    fs.closeSync(fd);
  }
}

async function ensureGradleDistribution() {
  if (!fs.existsSync(wrapperPath)) {
    console.log('没有找到 gradle-wrapper.properties，跳过 Gradle 发行包改写');
    return;
  }
  const props = fs.readFileSync(wrapperPath, 'utf8');
  const found = props.match(/gradle-(\d+(?:\.\d+)+)-(?:all|bin)\.zip/);
  if (!found) {
    console.log('警告：gradle-wrapper.properties 里没有识别到 gradle-x.y.z-(all|bin).zip，跳过改写');
    return;
  }
  const fileName = 'gradle-' + found[1] + '-bin.zip';
  const localZip = path.join(path.dirname(wrapperPath), fileName);

  let downloaded = false;
  if (fs.existsSync(localZip) && zipLooksComplete(localZip)) {
    downloaded = true;
  } else {
    for (const mirror of GRADLE_MIRRORS) {
      for (let attempt = 1; attempt <= 3 && !downloaded; attempt++) {
        try {
          console.log('下载 Gradle 发行包（' + mirror + fileName + '，第 ' + attempt + ' 次）');
          await downloadOnce(mirror + fileName, localZip, 5);
          if (!zipLooksComplete(localZip)) throw new Error('zip 不完整');
          downloaded = true;
        } catch (err) {
          fs.rmSync(localZip, { force: true });
          console.log('这版没下成：' + err.message);
          if (attempt < 3) await new Promise(function (r) { setTimeout(r, 3000); });
        }
      }
      if (downloaded) break;
    }
  }

  const distributionUrl = downloaded
    ? pathToFileURL(localZip).href
    : GRADLE_MIRRORS[0] + fileName;
  let next = props.replace(/distributionUrl=.*/, 'distributionUrl=' + distributionUrl.replace(':', '\\:'));
  // 指向本地文件时关掉 URL 校验：wrapper 的校验是发 HEAD 请求（按 HttpURLConnection 处理），
  // 对 file: 地址没有意义；文件本身在上面已经按 PK 头尾签名校验过。
  if (downloaded) {
    next = next.replace(/validateDistributionUrl=.*/, 'validateDistributionUrl=false');
  }
  if (next !== props) fs.writeFileSync(wrapperPath, next);
  console.log(downloaded
    ? 'Gradle 发行包已预下载并校验：' + fileName + '（wrapper 指向本地文件，构建时不联网）'
    : 'Gradle 发行包预下载失败，wrapper 改用镜像直链：' + distributionUrl);
}

await ensureGradleDistribution();

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
}

try {
  await makeIcons();
} catch (err) {
  console.log('图标生成失败，沿用默认图标：' + err.message);
}

