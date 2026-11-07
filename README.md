# 氢计划（AeroPlan）· Android 打包工程

把「氢计划」网页应用用 Capacitor 包成安卓 APK，全部在 GitHub Actions 云端完成，电脑上不需要装 Android Studio。

显示名仍然是中文「氢计划」；英文名 AeroPlan 用在包信息、导出文件名、关于页和英文模式下。

## 这个文件夹里有什么

| 文件 / 文件夹 | 作用 |
| --- | --- |
| `index.html`、`styles.css`、`i18n.js`、`app.js`、`sw.js`、`manifest.webmanifest`、`icons/`、`fonts/` | 网页本体，打包时会被复制进 APK |
| `package.json` | 版本号在这里（`version`），打包时会自动换算成安卓的版本号 |
| `capacitor.config.json` | 应用名、包名、网页目录，关闭 WebView 调试、禁止明文混合内容 |
| `scripts/copy-web.mjs` | 把网页文件复制到 `www/`，同时压缩 HTML / CSS / JS（去注释与空白、混淆变量名、不产出 source map） |
| `scripts/prepare-android.mjs` | 写入签名、版本号、应用显示名「氢计划」、联网 / 通知 / 精确闹钟权限（不含存储与定位）、图标和启动图；开启 R8 混淆与资源压缩 |
| `.github/workflows/build-apk.yml` | GitHub 上的自动打包流程（签名材料从 Secrets 还原） |
| `.github/workflows/_generate-keystore.yml` | 一次性任务：生成新的签名密钥并把 base64 与口令打印到日志 |
| `打包说明.md` | 从建仓库到装到手机的中文分步说明 |

`www/`、`android/`、`node_modules/`、`dist/` 都是打包过程中自动生成的，不需要上传，也不要手动创建。

## 本次（v0.8.0）依赖与权限变化

依赖仍是 Capacitor 官方插件，`npm install` 会自动装好，不需要额外密钥：

- `@capacitor/local-notifications`：保存条目时就把提醒按触发时刻排进系统，App 关闭、锁屏也能按时弹；重复条目会预排未来 14 天，并在触发后自动续排。
- `@capacitor/filesystem`：备份只写缓存里的临时文件，交给系统面板后立即删除，不再往私有目录留副本。
- `@capacitor/share`：备份时调起系统保存 / 分享面板（下载、微信、网盘等由用户选择）。
- `@capacitor/haptics`：日期时间滚轮吸附时的触觉反馈（系统不支持时静默跳过）。
- `@capacitor/app`：接管 Android 返回手势（弹层 → 上一级 → 主界面退到后台）。

**已删除 `@capacitor/geolocation`**。本版本没有任何定位能力：城市 / 区县与条目地址一律由用户输入关键词搜索得到。

`prepare-android.mjs` 会把这些权限写进 `AndroidManifest.xml`：

- `INTERNET`（安装时授予；天气与地点搜索需要联网）
- `POST_NOTIFICATIONS`（Android 13+ 运行时申请）
- `SCHEDULE_EXACT_ALARM`（仅 Android 12/12L，`maxSdkVersion=32`；用户可在「闹钟和提醒」里撤销）
- `USE_EXACT_ALARM`（Android 13+ 精确闹钟，系统自动授予、没有单独开关）
- `RECEIVE_BOOT_COMPLETED`（重启后由本地通知插件恢复已排程的提醒）
- `VIBRATE`（滚轮触觉反馈）
- `USE_FULL_SCREEN_INTENT`（原生提醒通道在锁屏时的全屏意图，系统不支持时自动忽略）
- `READ_CALENDAR` / `WRITE_CALENDAR`（可选的「同时写入系统日历」，只在用户打开开关时申请）

**原生提醒通道**：`prepare-android.mjs` 会额外生成四个类，完全不经过 Capacitor 插件——

- `AeroNativeBridge`：通过 `addJavascriptInterface` 暴露为 `window.AeroNativeReminders`，提供 `schedule(json)` / `cancelAll()` / `listScheduled()` / `postTest(seconds)` / `getDiagnostics()`；排程数据写入 `SharedPreferences`。
- `AeroReminderReceiver`：`AlarmManager.setExactAndAllowWhileIdle`（`RTC_WAKEUP`）到点后直接 `NotificationCompat` 发通知，渠道 `aeroplan-native-v1`（重要性 HIGH、系统默认提示音、锁屏公开），小图标优先 `ic_stat_icon`、找不到退回 `android.R.drawable.ic_dialog_info`。
- `AeroReminderBootReceiver`：监听 `BOOT_COMPLETED` / `LOCKED_BOOT_COMPLETED` / `MY_PACKAGE_REPLACED`，从 `SharedPreferences` 重排。
- `AeroCalendarPlugin`：可选的系统日历通道，专用日历「AeroPlan 提醒」（`ACCOUNT_TYPE_LOCAL`），方法 `ensureCalendar` / `upsertEvent` / `deleteEvent` / `clearCalendar` / `checkCalendarPermission` / `requestCalendarPermission` / `openAppSettings` / `deviceInfo`。

网页侧优先调用原生桥，桥不存在时才回落到 `LocalNotifications` 插件或页面计时器。构建末端的 `build-apk.yml` 会在 APK 的 dex 里断言这四个类都存在，并校验清单里已声明两个接收器。

**本版本不再声明 `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`**：备份经系统保存或分享面板写出，导入由用户手动选择文件，全部走应用缓存目录，不需要任何存储权限。

插件自身可能还会合并进 `WAKE_LOCK` / `FOREGROUND_SERVICE` 之类的系统权限；`build-apk.yml` 在构建后会打印合并清单里的全部权限与 `targetSdkVersion`，并在发现定位或存储权限、缺少 `POST_NOTIFICATIONS` / `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM`、或 APK 内缺少 `ic_stat_icon` 时直接让构建失败。

同时会生成通知栏小图标 `ic_stat_icon`（纯白剪影），避免部分机型通知不显示。

## 版本号规则

只改 `package.json` 里的 `version`，例如：

- `0.3.2` → 安卓 `versionCode 302`（主版本 ×10000 + 次版本 ×100 + 修订号）
- `0.4.2` → `versionCode 402`
- `0.6.0` → `versionCode 600`
- `0.7.0` → `versionCode 700`
- `0.8.0` → `versionCode 800`
- `0.9.0` → `versionCode 900`
- `0.9.1` → `versionCode 901`

产物文件名固定为 `AeroPlan.apk`（不带版本号），版本号由 `versionName` / `versionCode` 体现。

### 升级安装

- 包名是 `com.aeroplan.app`。**升级必须覆盖同一个包名**；若手机上装过旧包名（如 `com.qingricheng.app`）的版本，需要先卸载旧版再装，否则两个图标并存、数据互不相通。
- 包名变更等于另一个应用：旧版数据不会继承。请先在旧版「设置 → 备份数据」导出，再在新版「恢复数据」导入。
- 已创建的旧通知渠道、旧 Service Worker 缓存与旧签名指纹均会作废，属预期行为。

## 签名密钥（已迁出仓库）

仓库里**不再存放任何 keystore 文件，也没有明文口令**。签名材料只存在 GitHub 仓库的 Secrets 里，打包时临时还原，任务结束即丢弃。

### 推荐的单 Secret 方案：`KEYSTORE_BUNDLE`

如果新建短值 Secret 时反复报 `Failed to add secret`，改用这一个 Secret：

| Secret | 内容 |
| --- | --- |
| `KEYSTORE_BUNDLE` | 一个 base64 字符串，解码后是 `{"keystore":"<keystore 的 base64>","password":"...","alias":"..."}` |

构建时会解出 keystore、口令、别名，再通过 `GITHUB_ENV` 传给后续步骤；`prepare-android.mjs` 不需要改动。

`KEYSTORE_BUNDLE` 优先。旧的三项（`KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` + `KEY_ALIAS`）仍然兼容；两者都没有时，构建会明确失败并打印提示，不会产出未签名包。

### 兼容的三 Secret 方案

| Secret | 内容 |
| --- | --- |
| `KEYSTORE_BASE64` | 整个 `release.keystore` 文件的 base64（单行） |
| `KEYSTORE_PASSWORD` | keystore 口令 |
| `KEY_ALIAS` | 别名（生成任务里默认 `qingjihua`） |

`KEY_PASSWORD` 可选；不填时与 `KEYSTORE_PASSWORD` 相同（PKCS12 一般不需要单独的口令）。

### 生成新密钥（一次性）

1. 打开仓库 → Actions →「生成签名密钥（一次性）」→ Run workflow。
2. 任务结束后打开这次运行的日志，复制 `KEYSTORE_BUNDLE` 这一整行（放在推荐区块里）。
3. 到 Secrets 新建一个 `KEYSTORE_BUNDLE`，粘贴整行 base64，保存。
4. 复制完成后，删除这次运行的记录（Actions 里可以删除单次运行），再删除 `.github/workflows/_generate-keystore.yml`，避免以后被误触发。

生成任务不会把 keystore 上传成 artifact（公开仓库的 artifact 谁都能下载），只在日志里输出；日志会随运行记录一起删除。

### 已安装旧版的用户必须卸载重装

新密钥的签名与旧版不同，Android 不允许覆盖安装签名不一致的包。因此：

1. 卸载前先在旧版里「设置 → 备份数据」导出备份，存到可信位置（网盘 / 电脑）。
2. 卸载旧版（卸载会一并删掉本机数据和同意记录）。
3. 安装新 APK，首次打开会重新弹出协议页，需要再接受一次；随后用「恢复数据」导入之前的备份。

### `.gitignore` 与旧历史

- `.gitignore` 已加入 `keystore/`、`*.keystore`、`*.jks`，之后不会再被提交。
- 旧 keystore 已从工作区删除，但**它仍留在 git 历史里**。旧密钥已作废（新包用新密钥签名），所以不必为此重写历史——重写会改变所有提交哈希，代价大于收益。最短可行做法：现在删文件 + 加忽略规则 + 换新密钥，三步即可。
- 如果仓库是公开的，且你希望彻底抹掉旧文件的历史痕迹，只能用 `git filter-repo` 重写历史后强推；这会让所有协作者必须重新克隆，非必要不建议。

## 官方签名指纹

生成新密钥后，在 Actions 构建日志的「输出官方签名指纹」步骤里能看到证书 SHA-256（`apksigner verify --print-certs` 输出的 `certificate SHA-256 digest`）。把它填到两处：

1. 本 README 的下一行；
2. `app.js` 顶部的 `OFFICIAL_CERT_SHA256` 常量（关于页会显示这一行）。

官方签名指纹：`（待填入：生成新密钥后从构建日志复制）`

在系统「应用信息」里核对签名指纹，与上面一致才是官方包。从非官方渠道获得、或指纹不一致的安装包，可能已被修改，请勿使用。

## 代码加固与边界

- 网页资源在打包时压缩（去注释与空白）、JS 变量名混淆、**不产出 source map**。
- Android 侧开启 R8 代码混淆与资源压缩；`proguard-rules.pro` 保留 Capacitor 插件、`@JavascriptInterface`、`@CapacitorPlugin` 与包名入口，避免插件桥接被裁掉。
- `capacitor.config.json` 与 `MainActivity` 都关闭了 WebView 调试（`webContentsDebuggingEnabled: false`），不允许用 chrome://inspect 附加调试。
- 没有加运行时完整性自校验、第三方加固或 Play Integrity。它们各自的代价：运行时自校验可被动态绕过且需自己维护；第三方加固按年付费、需要联网与厂商服务端；Play Integrity 国内机型基本不可用且需要服务端校验。

需要说明的是：**客户端不存在「不可破解的加密」**。混淆与压缩只能提高阅读和二次打包的成本，挡不住有决心的逆向。真正阻止第三方改包的是 Android 的系统签名校验——改了包内容又用别的密钥签名，就无法覆盖安装。用户能做的自查就是比对上面的官方签名指纹。

## 限制

- APK 里跑的仍然是网页技术（WebView），不是原生应用。
- 安装版把提醒交给系统本地通知排程，App 关闭或锁屏后仍会按时弹出；极严格的省电策略、未允许「闹钟与提醒」时仍可能略有延迟。网页版没有系统排程，只在页面打开时触发。
- 数据存在手机本机（应用专属目录 / 浏览器数据库），不上传服务器。备份文件由你自己在系统面板里选择去处，应用内不留副本。
- 开屏字标为本地打包的 OFL 字体（ZCOOL XiaoWei / Cormorant Garamond），不联网加载。
