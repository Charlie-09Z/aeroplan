# 氢计划（AeroPlan）· Android 打包工程

把「氢计划」网页应用用 Capacitor 包成安卓 APK，全部在 GitHub Actions 云端完成，电脑上不需要装 Android Studio。

显示名仍然是中文「氢计划」；英文名 AeroPlan 用在包信息、导出文件名、关于页和英文模式下。

## 这个文件夹里有什么

| 文件 / 文件夹 | 作用 |
| --- | --- |
| `index.html`、`styles.css`、`i18n.js`、`app.js`、`sw.js`、`manifest.webmanifest`、`icons/`、`fonts/` | 网页本体，打包时会被复制进 APK |
| `package.json` | 版本号在这里（`version`），打包时会自动换算成安卓的版本号 |
| `capacitor.config.json` | 应用名、包名、网页目录，以及通知 / 定位 / 存储权限的说明 |
| `scripts/copy-web.mjs` | 把网页文件（含 `i18n.js` 与 `fonts/`）复制到 `www/` |
| `scripts/prepare-android.mjs` | 写入签名、版本号、应用显示名「氢计划」、联网 / 通知 / 定位 / 存储权限、图标和启动图 |
| `keystore/light-schedule-release.keystore` | 固定签名文件（PKCS12，别名和密码都是 `qingricheng`） |
| `.github/workflows/build-apk.yml` | GitHub 上的自动打包流程 |
| `打包说明.md` | 从建仓库到装到手机的中文分步说明 |

`www/`、`android/`、`node_modules/`、`dist/` 都是打包过程中自动生成的，不需要上传，也不要手动创建。

## 本次（v0.4.3）依赖与权限变化

新增三个 Capacitor 官方插件，`npm install` 会自动装好，不需要额外密钥或权限：

- `@capacitor/filesystem`：把备份写到应用专属目录 `files/backups`。
- `@capacitor/share`：点「打开位置」时调用系统分享面板，把备份另存到「下载」或网盘。
- `@capacitor/geolocation`：只调用 `requestPermissions()` / `checkPermissions()`，**没有任何读取坐标的代码**。

`prepare-android.mjs` 会把这些权限写进 `AndroidManifest.xml`：

- `INTERNET`（安装时授予）
- `POST_NOTIFICATIONS`（Android 13+ 运行时申请）
- `ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION`（定位：只声明与申请，不读取坐标）
- `READ_EXTERNAL_STORAGE`（仅 Android 12 及以下）、`WRITE_EXTERNAL_STORAGE`（仅 Android 9 及以下）
- `SCHEDULE_EXACT_ALARM`（精确闹钟，用于到点提醒；部分系统需要你在「设置 → 应用 → 氢计划 → 闹钟与提醒」里手动允许）
- `RECEIVE_BOOT_COMPLETED`（重启后恢复已排好的本地通知）

## 版本号规则

只改 `package.json` 里的 `version`，例如：

- `0.3.2` → 安卓 `versionCode 302`（主版本 ×10000 + 次版本 ×100 + 修订号）
- `0.4.2` → `versionCode 402`
- `0.4.3` → `versionCode 403`

APK 文件名也会自动变成 `qingjihua-0.4.3.apk`，不需要手改任何地方。

## 签名说明

用的是仓库里固定的自签名文件，好处是以后每次打包签名一致，可以直接覆盖安装升级；代价是这种 APK 不能上架应用商店（上架需要 Google Play 的正式签名）。签名文件丢了就没法覆盖升级，只能先卸载旧版再装新版。

## 限制

- APK 里跑的仍然是网页技术（WebView），不是原生应用。
- 安装版会通过 `@capacitor/local-notifications` 把到点提醒排成系统本地通知，应用退到后台也能弹；受系统省电策略和精确闹钟权限影响，个别机型可能略有延迟。网页版仍只在页面打开时触发，没有通知权限时回落到页面内提醒卡片。
- 数据存在手机本机（应用专属目录 / 浏览器数据库），不上传服务器。
- 开屏字标为本地打包的 OFL 字体（ZCOOL XiaoWei / Cormorant Garamond），不联网加载。
