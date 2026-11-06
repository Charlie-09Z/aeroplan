# 轻日程 · 安卓 APK 打包工程

把现有的「轻日程」网页（PWA）用 [Capacitor](https://capacitorjs.com/) 包成安卓应用，由 GitHub Actions 在云端生成 Android 工程并打出 APK。**不需要安装 Android Studio，也不需要在自己电脑上装 Java / Android SDK。**

- 应用版本：0.3.1
- 应用包名：`com.qingricheng.app`
- 产物：`light-schedule-0.3.1.apk`（在 Actions 运行页面的 Artifacts 里下载）
- 网页文件仍然原样保留在仓库根目录，打包时由脚本复制到临时目录 `www/`

## 从哪里开始

请直接打开 **[打包说明.md](打包说明.md)**，里面是从「新建 GitHub 仓库」到「装到手机上」的逐步点按说明。

## 仓库里有什么

| 文件 / 文件夹 | 作用 |
| --- | --- |
| `index.html`、`styles.css`、`app.js`、`sw.js`、`manifest.webmanifest`、`icons/` | 轻日程网页本体（与 PWA 包内一致，仅 `app.js` 增加了一行「APK 内跳过 Service Worker」的判断） |
| `package.json` | 打包所需的 Capacitor 依赖与脚本 |
| `capacitor.config.json` | 应用名、包名、网页目录 `www` |
| `scripts/copy-web.mjs` | 把根目录网页文件复制到 `www/` |
| `scripts/prepare-android.mjs` | 写入签名、版本号，并用 `icons/icon-512.png` 生成安卓桌面图标 |
| `keystore/light-schedule-release.keystore` | 个人自签名文件（固定签名，保证新版能覆盖安装旧版） |
| `.github/workflows/build-apk.yml` | GitHub Actions：手动触发，构建 release APK 并上传为 artifact |

## 必须知道的限制

- APK 里仍然是网页技术（Android WebView），不是原生程序，**不会变成原生闹钟**。
- 提醒只在应用页面处于活动状态时可能触发；退到后台、锁屏被系统冻结或划掉应用后不会响。重要事项请同时用系统闹钟。
- 数据只存在这台手机的应用数据里；卸载应用或在系统设置里清除应用数据会全部丢失。APK 内「备份数据」的下载行为尚未在真机验证，重要数据建议先在网页版导出备份。
- 自签名 APK 可以自己安装、可以覆盖升级，**不能上架应用商店**。
