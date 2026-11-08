# 氢计划（AeroPlan）· Android 打包工程

把「氢计划」网页应用用 Capacitor 包成安卓 APK，全部在 GitHub Actions 云端完成，电脑上不需要装 Android Studio。

显示名仍然是中文「氢计划」；英文名 AeroPlan 用在包信息、导出文件名、关于页和英文模式下。

## 这个文件夹里有什么

| 文件 / 文件夹 | 作用 |
| --- | --- |
| `index.html`、`styles.css`、`i18n.js`、`app.js`、`sw.js`、`manifest.webmanifest`、`icons/`、`fonts/` | 网页本体，打包时会被复制进 APK |
| `regions.js`、`districts.js` | 省 / 市、市 / 区县两级离线表；`districts.js` 由构建流程自动生成，不手改 |
| `package.json` | 版本号在这里（`version`），打包时会自动换算成安卓的版本号 |
| `capacitor.config.json` | 应用名、包名、网页目录，关闭 WebView 调试、禁止明文混合内容 |
| `scripts/copy-web.mjs` | 把网页文件复制到 `www/`，同时压缩 HTML / CSS / JS（去注释与空白、混淆变量名、不产出 source map） |
| `scripts/prepare-android.mjs` | 写入签名、版本号、应用显示名「氢计划」、联网 / 振动权限（不含通知、闹钟、日历、存储与定位）、图标和启动图；开启 R8 混淆与资源压缩 |
| `.github/workflows/build-apk.yml` | GitHub 上的自动打包流程（签名材料从 Secrets 还原） |
| `.github/workflows/_generate-keystore.yml` | 一次性任务：生成新的签名密钥并把 base64 与口令打印到日志 |
| `打包说明.md` | 从建仓库到装到手机的中文分步说明 |

`www/`、`android/`、`node_modules/`、`dist/` 都是打包过程中自动生成的，不需要上传，也不要手动创建。

## 区县数据（构建时生成）

- 数据源：`china-division@2.7.0` 的 `dist/pca.json`（开源仓库 `modood/Administrative-divisions-of-China`，MIT 许可，无需额外署名；内容整理自国家统计局公布的行政区划代码）。脚本依次尝试 jsDelivr、unpkg、GitHub raw，任一成功即可。
- 构建流程在 `scripts/copy-web.mjs` 之前执行 `scripts/gen-districts.mjs` 生成 `districts.js`；要求 ≥300 个地级、≥2700 个县级（当前 333 / 2938，另含直辖市 86 个区县），并抽样校验杭州、成都、喀什、呼和浩特、重庆、海南、济源。数量或抽样不达标时构建直接失败，不会写入空表。
- 兜底：三个源都拉不到（源站抽风或断网）时，回退到仓库里已提交的 `districts.js` 快照，快照同样要过数量与抽样校验；快照缺失或校验不过才失败。
- 体积：约 50 KB 未压缩、约 17 KB gzip，随 `regions.js` 一起在首屏同步加载，代价很小，暂不做按需懒加载；本地开发没有 Node 也能直接用仓库里的快照。

## 本次（v0.9.5）功能与结构变化

- 层级修复：全部安排页的详情页与编辑功能条都抬到二级页之上（`.above-page` 58 / 59；`body.agenda-open .batch-bar` 固定到 z 57），日记写作页的日期选择器从 46 / 47 抬到 66 / 67；倒数日编辑面板不再在 id 选择器上写 z-index，统一由 `.above-page` 的 56 / 57 控制，遮罩不会再盖住面板。
- 分类拖动结束后把新顺序写回 `cat.order` 并按 order 重排数组、持久化，松手不再回到原处。
- 环形 / 百分数 / 月相三种进度视觉移到「+」的左侧；「+」支持长按约 400ms 减一次（带 620ms 抑制窗口，避免松手后补发 click 又加回去）；月相改为 SVG 真实相位，0% 新月、50% 半月、100% 满月。
- 圆点形状的分类标签同样可配色；情绪标签改为浅底 + 细边 + 协调文字色；内置情绪由 12 种扩到 18 种；「更多」页分类管理拆为「行程标签管理」与「情绪标签管理」两个入口。
- 日记：时间线卡片左滑出「编辑 / 删除」，网格卡片长按弹同款菜单；详情页改为朋友圈式排版（文字在上，图片 / 视频 / 附件在下，图片可点开大图）；新增「分享长图」，用 Canvas 生成长图并在查看器里长按保存。
- 倒数日横滑条移到日记页上方；新增正数：日期在过去时显示「已经 N 天」，与「还有 N 天」由日期方向决定。
- 设置里的语言独立成「语言」一栏；「更多」页新增「个性化」分组并把黄历卡片移入；批量编辑功能条新增「全选」，一次选中当前屏内全部卡片（含收起的卡片组，DOM 仍在）。

## 上一版（v0.9.4）功能与结构变化

- 进度视觉改为**每条计划各自设置**：新建 / 编辑计划面板里新增「进度视觉」一行，五个小预览块点选即选中，选择写进该条计划的 `progressStyle` 字段（缺省回落 `bar`）；「更多」页的全局进度视觉分段控件已移除。五种视觉：进度条 `bar`、能量格 `battery`、环形 `ring`、百分数 `percent`、月相 `moon`，共用同一卡片高度体系，点击记一次的反馈在五种上都生效，环形与月相带平滑过渡。
- 倒数日从日记页移到**计划页搜索栏下方**（日记页那条撤掉），并整页重做：顶部一行「返回 + 单行标题 + 新建」、列表行卡片（名称与日期在左，天数与「还有 N 天 / 已过 N 天 / 就是今天」标签在右）、居中空状态、长按编辑 / 删除、按住拖动排序；编辑面板的日期改用滚轮选择。
- 分类与倒数日的颜色统一作用于**名称文字**，图标回到中性灰；色板共用同一套（14 个预设色 + 自定义颜色，选中态用描边圈）。分类图标按参考风格重画为 16 个：`viewBox 0 0 24 24`、无填充、`stroke-width 2`、圆头端点与转角，外套浅色圆形底（深色模式用次级卡片色），选中靠主色外圈而不是改图标颜色。
- 修正二级页标题被挤成竖排、返回箭头错位、新建按钮飘位的问题（根因是共用 `.text-btn` 的 `flex-basis:100%`）；自定义情绪、倒数日、全部安排等二级页统一为单行标题。
- 日期 / 省市 / 时间三个滚轮统一为 touch 主通道 + pointer 辅助，拖动时阻止页面滚动，松手吸附并轻震动；日期选择器层级抬到日记编辑页与底栏之上，打开时锁定底层滚动。
- 备份格式 `formatVersion:1 schemaVersion:10`，新增计划字段 `progressStyle`、倒数日 `order`、`moods`、`cardStyle`，导入兼容旧版本文件。

## 上一版（v0.9.3）功能与结构变化

- 底栏固定五格：日历 / 计划 / 行程表 / 日记 / 更多；原「议程」页下线，改为日历页内的「全部安排」全屏入口，连续历史 / 未来与分类筛选能力保留。
- 「更多」页集中卡片样式（柔和 / 纸感 / 雾面 / 线框，点选即全局生效）、分类管理与倒数日、设置入口；版本号居中置于页尾。
- 计划支持目标次数 M 与已完成 N：计划卡显示 N/M 与进度视觉，点一次记一次；目标为 1 时沿用旧的一次性完成逻辑。进度随备份导出与导入，删除计划时一并清理。
- 新增倒数日：剩余 / 已过天数、自定义名称与颜色、可置顶；展示为日记页搜索栏与筛选 chips 之间的横向卡片条，新增的排在最右，点击卡片进入编辑。
- 日记情绪扩到 12 种，并支持自定义情绪（名称 + 图标或颜色），可拖动排序、长按编辑 / 删除。
- 备份格式 `formatVersion:1 schemaVersion:9`，新增 `countdowns`、`moods`、`cardStyle`、`progressStyle`，导入兼容旧版本文件。

## 提醒功能已下线（自 v0.9.2 起）

本应用没有任何到点提醒：没有通知、没有系统日历写入、没有闹钟排程，也没有通知权限引导或「权限管理」页面。

依赖仍是 Capacitor 官方插件，`npm install` 会自动装好，不需要额外密钥：

- `@capacitor/filesystem`：备份只写缓存里的临时文件，交给系统面板后立即删除，不再往私有目录留副本。
- `@capacitor/share`：备份时调起系统保存 / 分享面板（下载、微信、网盘等由用户选择）。
- `@capacitor/haptics`：日期时间滚轮吸附时的触觉反馈（系统不支持时静默跳过）。
- `@capacitor/app`：接管 Android 返回手势（弹层 → 上一级 → 主界面退到后台）。

**已删除 `@capacitor/local-notifications`**，并删除 `android-inject/` 下的四个原生提醒类（`AeroNativeBridge` / `AeroReminderReceiver` / `AeroReminderBootReceiver` / `AeroCalendarPlugin`）以及只服务于提醒的 `scripts/notify-config.mjs`。

`prepare-android.mjs` 会把这些权限写进 `AndroidManifest.xml`：

- `INTERNET`（安装时授予；天气与地点搜索需要联网）
- `VIBRATE`（滚轮触觉反馈）

**不再声明** `POST_NOTIFICATIONS`、`SCHEDULE_EXACT_ALARM`、`USE_EXACT_ALARM`、`RECEIVE_BOOT_COMPLETED`、`READ_CALENDAR`、`WRITE_CALENDAR`、`USE_FULL_SCREEN_INTENT`，也不再声明任何存储或定位权限。

**本版本不再声明 `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`**：备份经系统保存或分享面板写出，导入由用户手动选择文件，全部走应用缓存目录，不需要任何存储权限。

`build-apk.yml` 在构建后会打印合并清单里的全部权限与 `targetSdkVersion`，并在发现定位、存储、通知、闹钟或日历权限，或清单里仍有原生提醒组件时直接让构建失败。

## 版本号规则

只改 `package.json` 里的 `version`，例如：

- `0.3.2` → 安卓 `versionCode 302`（主版本 ×1000 + 次版本 ×100 + 修订号）
- `0.4.2` → `versionCode 402`
- `0.6.0` → `versionCode 600`
- `0.7.0` → `versionCode 700`
- `0.8.0` → `versionCode 800`
- `0.9.0` → `versionCode 900`
- `0.9.1` → `versionCode 901`
- `0.9.2` → `versionCode 902`
- `0.9.3` → `versionCode 903`
- `0.9.4` → `versionCode 904`
- `1.0.0` → `versionCode 1000`

产物文件名固定为 `AeroPlan.apk`（不带版本号），版本号由 `versionName` / `versionCode` 体现；artifact 名带版本号只为便于在 Actions 页面辨认。

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
| `KEY_ALIAS` | 签名别名。默认沿用旧别名 `qingjihua`：它是密钥身份标识、不对用户可见，**改了会导致老版本无法覆盖升级**，因此不做改名。 |

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
- 本应用不提供到点提醒：没有系统通知、没有闹钟排程，也没有系统日历写入。
- 数据存在手机本机（应用专属目录 / 浏览器数据库），不上传服务器。备份文件由你自己在系统面板里选择去处，应用内不留副本。
- 开屏字标为本地打包的 OFL 字体（ZCOOL XiaoWei / Cormorant Garamond），不联网加载。
