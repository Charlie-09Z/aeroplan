/* =========================================================
   氢计划 / AeroPlan · 双语文案（v0.5.2）
   中文是源文案，英文在 DICT 里按「整句」对照。
   带 {n} 这类占位符的句子用 T('中文模板', {n: 3}) 生成。
   DOM 里新增的中文文本节点会被自动翻译，切回中文时恢复原文。
   ========================================================= */

(function () {
  'use strict';

  var DICT = {
    // ---------- 外壳 / 导航 ----------
    '氢计划': 'AeroPlan',
    '让计划，轻如呼吸': 'Let plan breathe',
    '氢计划 · 数据只在本机': 'AeroPlan · Data stays on this device',
    '氢计划提醒': 'AeroPlan reminder',
    '日历': 'Calendar',
    '议程': 'Agenda',
    '计划': 'Plans',
    '今天': 'Today',
    '明天': 'Tomorrow',
    '昨天': 'Yesterday',
    '查看': 'View',
    '上一页': 'Previous page',
    '下一页': 'Next page',
    '切换年月': 'Change month',
    '设置': 'Settings',
    '返回': 'Back',
    '主导航': 'Main navigation',
    '新建条目': 'New item',
    '新建计划': 'New plan',
    '关闭': 'Close',
    '删除这条安排': 'Delete this item',
    '删除这条计划': 'Delete this plan',

    // ---------- 日历 ----------
    '新的一天，从计划开始': 'A new day begins with a plan.',
    '该日暂无安排': 'No plans for this day.',
    '新建第一条': 'Create the first one',
    '点任意日期，查看当天按小时排列的安排。': 'Tap any date to see that day\'s schedule.',
    '日程': 'Event',
    '待办': 'To-do',
    '这天还没有安排': 'Nothing scheduled this day',
    '+ 添加': '+ Add',
    '收起': 'Collapse',
    '本月还没有安排': 'Nothing scheduled this month',

    // ---------- 议程 ----------
    '今天还没有安排': 'Nothing scheduled today',
    '想到什么就先记下来，之后再调整。': 'Jot it down now; you can adjust it later.',
    '来自更早的日期，别忘了处理': 'From earlier dates — don\'t forget them',
    '这一天还没有安排': 'Nothing scheduled this day',
    '这一天的安排都完成了': 'All done for this day',
    '这一项还没完成，可在上方「逾期」里查看': 'One item isn\'t done — check "Overdue" above',
    '未完成的项目已归入上方「逾期」': 'Unfinished items are under "Overdue" above',
    '全部': 'All',
    '这个分类还没有条目': 'No items in this category',
    '所选分类还没有条目': 'No items in the selected categories',
    '换一个分类看看，或者给条目加上这个分类。': 'Try another category, or add this category to an item.',
    '换一个分类看看，或者给条目加上这些分类。': 'Try other categories, or add these categories to an item.',
    '已逾期': 'Overdue',
    '高优': 'High',
    '高优先级': 'High priority',
    '标记为完成': 'Mark as done',
    '标记为未完成': 'Mark as not done',
    '有备注': 'Has notes',

    // ---------- 新建条目 ----------
    '要做什么？': 'What needs doing?',
    '备注（可选）': 'Notes (optional)',
    '提前多少分钟': 'Minutes before',
    '设置时间': 'Set time',
    '不设时间': 'No time',
    '选择日期': 'Select date',
    '上个月': 'Previous month',
    '下个月': 'Next month',
    '优先级': 'Priority',
    '更多选项': 'More options',
    '分类 · 提醒 · 重复 · 备注 · 优先级': 'Category · Reminder · Repeat · Notes · Priority',
    '条目类型': 'Item type',
    '分类': 'Category',
    '未分类': 'Uncategorized',
    '+ 管理分类': '+ Manage categories',
    '日期': 'Date',
    '某天': 'Pick a date',
    '时间（可留空）': 'Time (optional)',
    '提醒': 'Reminder',
    '不提醒': 'No reminder',
    '提前 5 分钟': '5 min before',
    '提前 10 分钟': '10 min before',
    '提前 20 分钟': '20 min before',
    '提前 30 分钟': '30 min before',
    '自定义': 'Custom',
    '分钟前': 'min before',
    '重复': 'Repeat',
    '不重复': 'No repeat',
    '颜色 {c}': 'Color {c}',
    '重复时间': 'Repeat time',
    '起始年份': 'Start year',
    '农历日 {n}': 'Lunar day {n}',
    '农历月 {n}': 'Lunar month {n}',
    '备注': 'Notes',
    '未填写': 'Not added',
    '已填写': 'Added',
    '补充说明，最多 500 字': 'Add notes, up to 500 characters',
    '标记为高优先级': 'Mark as high priority',
    '左侧会显示琥珀色竖条': 'An amber bar shows on the left',
    '保存': 'Save',

    // ---------- 新建计划 ----------
    '周计划': 'Weekly plan',
    '月计划': 'Monthly plan',
    '年计划': 'Yearly plan',
    '计划类型': 'Plan type',
    '想完成什么？': 'What do you want to accomplish?',
    '周期内任一天': 'Any day in the period',

    // ---------- 重复面板 ----------
    '每天': 'Daily',
    '每周': 'Weekly',
    '每月': 'Monthly',
    '每年': 'Yearly',
    '每月（农历）': 'Monthly (lunar)',
    '每年（农历）': 'Yearly (lunar)',
    '结束': 'Ends',
    '一直重复': 'Repeat forever',
    '到某天为止': 'Until a date',
    '完成': 'Done',
    '每': 'Every',
    '天重复': 'days',
    '周': 'weeks',
    '日': 'day',
    '月': 'month',
    '时间': 'Time',
    '这条只出现一次，不会重复。': 'This item appears once.',
    '选 2 就是隔一天出现一次。': 'Set 2 to repeat every other day.',
    '可以选多天；选 2 周就是两周一次。至少保留一天。': 'Pick one or more days; 2 weeks means every other week. Keep at least one day.',
    '遇到没有这一天的月份（如 2 月 30 日）会自动跳过；时间留空就是全天。': 'Months without this day (e.g. Feb 30) are skipped. Leave time empty for all day.',
    '按农历计算，例如「每月 农历初五」。农历三十在只有 29 天的小月不出现。': 'Calculated by the lunar calendar, e.g. the 5th of each lunar month. The 30th is skipped in 29-day months.',
    '按农历计算，例如生日「每年 农历三月十四」。闰月不单独处理，只匹配非闰月。': 'Calculated by the lunar calendar, e.g. a birthday on lunar 3/14. Leap months are not handled separately.',
    '记录起始年份（可选）': 'Record start year (optional)',
    '只作展示，不影响重复': 'Display only; does not affect repeats',
    '例如 1990': 'e.g. 1990',
    '例如生日：3 月 14 日 09:30，起始年 1990。2 月 29 日在平年会跳过。': 'e.g. birthday: Mar 14, 09:30, start year 1990. Feb 29 is skipped in common years.',
    '记录起始年份': 'Record start year',

    // ---------- 详情 ----------
    '条目详情': 'Item details',
    '标题': 'Title',
    '类型': 'Type',
    '全天': 'All day',
    '保存备注': 'Save notes',
    '备注已保存': 'Notes saved',
    '保存失败，请再试一次': 'Save failed, please try again',

    // ---------- 跳转 ----------
    '跳转到': 'Jump to',
    '年': 'Year',
    '月': 'Month',
    '日': 'Day',
    '跳转': 'Go',

    // ---------- 通用弹窗 ----------
    '取消': 'Cancel',
    '确定': 'OK',
    '编辑': 'Edit',
    '删除': 'Delete',
    '编辑分类': 'Edit category',
    '新建分类': 'New category',
    '分类名称（最多 8 字）': 'Category name (up to 8 characters)',
    '自定义颜色': 'Custom color',
    '请先输入分类名称': 'Enter a category name first',
    '已经有同名分类了': 'A category with this name already exists',
    '分类已更新': 'Category updated',
    '已删除分类，条目已归为未分类': 'Category deleted; its items are now uncategorized',
    '删除这条安排？': 'Delete this item?',
    '会删除整个系列，包括之后所有日期。': 'This deletes the whole series, including all future dates.',
    '删除这条计划？': 'Delete this plan?',
    '只删除计划本身，不会影响日程与待办。': 'Only the plan is deleted; events and to-dos are unaffected.',
    '已删除': 'Deleted',
    '已完成': 'Done',
    '撤销': 'Undo',
    '已撤销完成': 'Completion undone',
    '知道了': 'Got it',

    // ---------- 计划页 ----------
    '周、月、年分开看，长线目标也有进度。': 'Weekly, monthly and yearly views, with progress for long-term goals.',
    '＋ 添加计划': '+ Add plan',
    '这个周期还没有计划，点右上角「添加计划」写下一条。': 'No plans for this period yet. Tap "Add plan" in the top right.',
    '本周还没有计划，点右上角「添加计划」写下一条。': 'No plans this week yet. Tap "Add plan" in the top right.',
    '本月还没有计划，点右上角「添加计划」写下一条。': 'No plans this month yet. Tap "Add plan" in the top right.',
    '本年度还没有计划，点右上角「添加计划」写下一条。': 'No plans this year yet. Tap "Add plan" in the top right.',
    '本周': 'This week',
    '本月': 'This month',
    '本年度': 'This year',
    '普通': 'Normal',
    '周期': 'Period',
    '计划详情': 'Plan details',
    '其他周计划': 'Other weekly plans',
    '其他月计划': 'Other monthly plans',
    '其他年度计划': 'Other yearly plans',
    '其他周计划 · {n}': 'Other weekly plans · {n}',
    '其他月计划 · {n}': 'Other monthly plans · {n}',
    '其他年度计划 · {n}': 'Other yearly plans · {n}',
    '暂无计划': 'No plans yet',
    '暂无': '—',
    '其他周期': 'Other periods',
    '已添加，但没能保存到本机': 'Added, but could not save on this device',

    // ---------- 设置 ----------
    '数据': 'Data',
    '正在读取本机数据…': 'Reading local data…',
    '正在检查…': 'Checking…',
    '检测中…': 'Checking…',
    '已允许': 'Allowed',
    '已拒绝': 'Denied',
    '不支持': 'Not supported',
    '未开启': 'Off',
    '备份数据': 'Back up data',
    '恢复数据': 'Restore data',
    '合并导入': 'Merge',
    '替换全部': 'Replace all',
    '换手机或清理浏览器数据前，先备份。': 'Back up before switching phones or clearing browser data.',
    '分类管理': 'Categories',
    '点标签可编辑或删除。': 'Tap a tag to edit or delete.',
    '清空数据': 'Clear data',
    '清空所有数据': 'Clear all data',
    '删除后不可恢复，建议先备份。': 'This cannot be undone. Back up first.',
    '外观': 'Appearance',
    '深色模式': 'Dark mode',
    '通知权限': 'Notifications',
    '系统通知': 'System notifications',
    '申请通知权限': 'Allow notifications',
    '通知已开启': 'Notifications on',
    '重新检查通知权限': 'Re-check permission',
    '提醒只在应用打开时有效，重要的事请同时设手机闹钟。': 'Reminders only work while the app is open. Set a phone alarm for important things.',
    '查看权限引导': 'View permission guide',
    '首次打开时的授权说明，可以在这里再看一遍或重新申请。': 'The first-run permission guide. Review it or request again here.',
    '首次打开时的授权说明，可以在「通知权限」里重新打开或申请。': 'The first-run permission guide. Reopen or request it under Notifications.',
    '关于': 'About',
    '没有账号，也不上传任何内容。': 'No account, and nothing is uploaded.',
    '换机或清理前，记得先备份。': 'Back up before switching devices or clearing data.',
    '版本': 'Version',
    '数据只在你的手机里，卸载或清理会一并删除。': 'Data lives only on your phone; uninstalling or clearing removes it.',
    '语言 / Language': 'Language',
    '默认跟随系统，也可以手动切换。': 'Follows the system by default; you can also switch manually.',
    '备份位置': 'Backup location',
    '打开位置': 'Open location',
    '查看说明': 'How to find it',
    '再备份一次': 'Back up again',
    '备份位置说明': 'Backup location',
    '常用': 'Common',
    '数据与备份': 'Data & backup',
    '个性化': 'Personalization',
    '权限': 'Permissions',
    '权限管理': 'Permissions',
    '关于氢计划': 'About AeroPlan',
    '隐私承诺': 'Privacy',
    '数据存放': 'Where data lives',
    '权限说明': 'Permissions',
    '字体与开源许可': 'Fonts & licenses',
    '联系方式': 'Contact',
    '不需要账号，不上传任何内容，也没有统计或广告代码。': 'No account, no uploads, no analytics or ads.',
    '存储权限仅用于写入备份文件，以及读取你选择的备份文件来恢复数据。': 'Storage permission is used only to write backup files and to read the backup file you choose when restoring.',
    '定位权限只用于更新天气时读取一次位置；不会后台持续定位，不上传也不记录坐标。拒绝授权时可以手动选择城市。': 'Location is read once only when updating weather; no background tracking, no upload and no stored coordinates. If denied, you can pick a city manually.',
    '首次打开时的授权说明，可以在「权限管理」里重新打开或申请。': 'The first-run permission guide. Reopen or request it under Permissions.',
    '通过你获取本应用的渠道反馈即可（应用商店、发布页面或仓库 Issue）。': 'Send feedback through the channel where you got this app (app store, release page, or repository issues).',

    // ---------- 权限引导 ----------
    '开始使用前': 'Before you start',
    '通知': 'Notifications',
    '存储': 'Storage',
    '定位': 'Location',
    '允许通知': 'Allow notifications',
    '以后再说': 'Maybe later',
    '开始使用': 'Start using',
    '重新检查': 'Check again',
    '去设置': 'Open settings',
    '申请权限': 'Request permission',
    '无需授权': 'No permission needed',
    '已开启': 'On',
    '通知权限被拒绝了，应用其他功能不受影响。': 'Notification permission was denied. Everything else still works.',
    '当前环境不支持系统通知，提醒会显示在应用内。': 'System notifications are not supported here; reminders show in the app.',
    '还没有开启通知，点下面的按钮申请。': 'Notifications are off. Tap the button below to request them.',
    '通知已开启，到点的安排会弹出系统提醒。': 'Notifications are on; due items will pop up a system alert.',
    '正在检查通知权限…': 'Checking notification permission…',
    '氢计划用手机的系统通知提醒你安排的事。通知只在你自己的手机上生成，不会上传到任何地方。': 'AeroPlan uses your phone\'s system notifications to remind you. Notifications are created on your phone only and never uploaded.',
    '到点会通过系统通知提醒你；如果系统限制后台运行，可能略有延迟。': 'Due items notify you through the system; delays may occur if the system limits background activity.',
    '系统拒绝了通知权限。可以打开手机「设置 → 应用 → 氢计划 → 通知」把通知打开，再回到这里点下面的按钮重新检查。': 'Notifications were denied. Open Settings → Apps → AeroPlan → Notifications, turn them on, then come back and tap Check again.',
    '用于把备份文件写入手机，也用于读取你选择的备份文件来恢复数据。': 'Used to write backup files to your phone and to read the backup file you choose when restoring.',
    '之后用于记录日程地点、以及显示当地天气；本版本只申请权限，不会读取你的位置。': 'Intended for recording event locations and showing local weather later. This version only requests the permission and never reads your location.',
    '当前是网页版：下载备份、选择文件都不需要额外授权。': 'Web version: downloading backups and picking files need no extra permission.',
    '当前是安装版：备份写在应用专属目录，不需要系统存储授权。': 'Installed app: backups go to the app\'s own folder, which needs no system storage permission.',
    '定位权限只用于上面说明的用途，本版本不会读取坐标。': 'Location permission is only for the purposes above; this version never reads coordinates.',
    '存储与备份': 'Storage & backups',
    '通知与提醒': 'Notifications & reminders',
    '定位用途': 'Location purpose',

    // ---------- 提示消息 ----------
    '已回到今天': 'Back to today',
    '读取文件失败': 'Could not read the file',
    '导入失败：不是有效的 JSON 文件': 'Import failed: not a valid JSON file',
    '导入失败：文件里找不到条目列表': 'Import failed: no item list found',
    '导入失败：没有可识别的条目': 'Import failed: no recognizable items',
    '已替换为备份数据': 'Replaced with backup data',
    '已合并导入': 'Merged',
    '当前没有数据': 'No data yet',
    '已清空所有数据': 'All data cleared',
    '已清空，但未能写入本机': 'Cleared, but could not write to this device',
    '启动时遇到问题，已切换到内存模式': 'Startup problem; switched to in-memory mode',
    '通知已开启': 'Notifications on',
    '请输入 1–1440 的整数分钟': 'Enter a whole number of minutes from 1 to 1440',
    '请填写 1–1440 之间的整数': 'Enter a whole number between 1 and 1440',
    '结束日期早于开始日期，已改为一直重复': 'End date is before the start date; set to repeat forever',
    '已备份，文件在手机的“下载”里': 'Backed up to your phone\'s Downloads',
    '已生成备份，可直接保存或分享': 'Backup created; save or share it now',
    '备份已生成，可在下面的位置找到': 'Backup created; you can find it at the location below',
    '还没有备份文件，先点「备份数据」': 'No backup file yet. Tap "Back up data" first.',
    '已清理旧版示例数据': 'Old sample data removed',
    '替换会把现在的全部条目删掉，确定吗？': 'Replacing deletes all current items. Continue?',

    // ---------- 提醒 ----------
    '提醒 · ': 'Reminder · ',

    // ---------- 带占位符的动态文案 ----------
    '{n} 项安排': '{n} items',
    '今天还有 {n} 项未完成': '{n} items left today',
    '逾期 {n} 项': '{n} overdue',
    '已完成 {n} 项': '{n} done',
    '本月 {n} 项 · 已完成 {m} 项': '{n} items this month · {m} done',
    '展开 {n} 条': 'Show {n} more',
    '已完成 · {n}': 'Done · {n}',
    '每月 {d} 日': 'Day {d} of each month',
    '每 {n} 天': 'Every {n} days',
    '每 {n} 周': 'Every {n} weeks',
    '每月 农历{day}': 'Lunar day {day} each month',
    '每年 农历{m}月{d}': 'Lunar {m}/{d} each year',
    '每年 {m} 月 {d} 日': '{m}/{d} each year',
    '，到 {d} 为止': ', until {d}',
    ' · 到 {d}': ' · until {d}',
    '重复：{text}': 'Repeats: {text}',
    '{year} 年起，{rest}': 'Since {year}, {rest}',
    '其他周期 · {n}': 'Other periods · {n}',
    '完成 {done}/{total}': '{done}/{total} done',
    '记为「{kind}」· {period}': 'Saved as "{kind}" · {period}',
    '已添加{kind}：{title}': '{kind} added: {title}',
    '已完成 · {title}': 'Done · {title}',
    '本机共 {n} 条': '{n} items on this device',
    ' · 上次备份 {d}': ' · Last backup {d}',
    ' · 还没备份': ' · No backup yet',
    '已清理 {n} 条旧版示例数据': 'Removed {n} old sample items',
    '最多 {n} 个分类': 'Up to {n} categories',
    '已新增分类：{name}': 'Category added: {name}',
    '删除分类「{name}」？': 'Delete category "{name}"?',
    '该分类下 {n} 条安排会变成未分类，不会被删除': 'The {n} items in this category become uncategorized; they will not be deleted',
    '提醒 · {time}': 'Reminder · {time}',
    '逾期 · {n}': 'Overdue · {n}',
    '名称最多 {n} 个字': 'Name must be at most {n} characters',
    '查看全部': 'View all',
    '+ 新建分类': '+ New category',
    '清空所有数据？': 'Clear all data?',
    '共 {items} 条安排、{plans} 条计划、{cats} 个分类，删除后不可恢复。': 'Contains {items} items, {plans} plans and {cats} categories. This cannot be undone.',
    '建议先备份。': 'Back up first.',
    '已开启自动清理保护': 'Auto-cleanup protection is on',
    '建议定期备份': 'Back up regularly',
    '当前模式无法保存，请换普通模式打开': 'Cannot save in this mode. Open in a normal browser.',
    '当前浏览模式无法保存数据，请用普通模式打开': 'Cannot save data in this mode. Open in a normal browser.',
    '年份': 'Year',
    '月份': 'Month',
    '已生成备份，可在下面的位置找到': 'Backup created; you can find it at the location below',
    '还有 {n} 项未完成，可在上方「逾期」里查看': '{n} items are not done — check "Overdue" above',
    '提前 {n} 分钟': '{n} min before',
    '已添加：{title}': 'Added: {title}',

    // ---------- 本次新增的说明文案 ----------
    '应用专属目录 files/backups（可用下方按钮分享或另存到「下载」）': 'App folder files/backups (use the button below to share or save to Downloads)',
    '手机浏览器的「下载」目录（文件管理 → 下载）': 'Your browser\'s Downloads folder (Files → Downloads)',
    '打开手机「设置 → 应用 → 氢计划 → 权限」，手动打开对应权限后，再回到这里点「重新检查」。': 'Open Settings → Apps → AeroPlan → Permissions, turn on the permission, then come back and tap "Check again".',
    '当前是网页版：定位权限由浏览器管理，可在浏览器的网站设置里查看或修改。': 'Web version: the browser manages location permission. You can review or change it in the site settings.',
    '网页版的备份会保存到手机的「下载」目录：打开「文件管理」→「下载」，按文件名「{name}」查找。如果找不到，可以点下面的「再备份一次」。': 'Backups in the web version go to your phone\'s Downloads folder: open Files → Downloads and look for "{name}". If it is missing, tap "Back up again".',
    '备份保存在应用专属目录 files/backups，系统不允许其它应用直接浏览。可以点「备份数据」重新生成，再通过分享另存到「下载」。': 'The backup is stored in the app folder files/backups, which other apps cannot browse. Tap "Back up data" to create it again, then share it to Downloads.',
    '氢计划备份': 'AeroPlan backup',
    '备份文件': 'Backup file',
    '氢计划 · AeroPlan': 'AeroPlan',
    '开屏字体：站酷小薇 ZCOOL XiaoWei（中文）、Cormorant Garamond（英文），均为 SIL Open Font License 1.1 授权；字体文件随应用本地打包，不联网加载。': 'Splash fonts: ZCOOL XiaoWei (Chinese) and Cormorant Garamond (English), both under the SIL Open Font License 1.1. Font files are bundled locally and never loaded from the network.',
    '氢计划 · 版本V0.5.2': 'AeroPlan · V0.5.2',
    '保存失败：{msg}': 'Save failed: {msg}',
    '计划保存失败，请重试': 'Could not save the plan. Please try again.',
    '分类保存失败：{msg}': 'Could not save the category: {msg}',
    '浏览器拒绝写入': 'the browser refused the write',
    '正在读取…': 'Reading…',

    // ---------- 节日 ----------
    '元旦': 'New Year\'s Day',
    '情人节': 'Valentine\'s Day',
    '妇女节': 'Women\'s Day',
    '愚人节': 'April Fools\' Day',
    '劳动节': 'Labour Day',
    '儿童节': 'Children\'s Day',
    '万圣夜': 'Halloween',
    '平安夜': 'Christmas Eve',
    '圣诞节': 'Christmas Day',
    '跨年夜': 'New Year\'s Eve',
    '母亲节': 'Mother\'s Day',
    '父亲节': 'Father\'s Day',
    '春节': 'Spring Festival',
    '元宵': 'Lantern Festival',
    '龙抬头': 'Longtaitou',
    '端午': 'Dragon Boat Festival',
    '七夕': 'Qixi',
    '中元': 'Zhongyuan',
    '中秋': 'Mid-Autumn',
    '重阳': 'Double Ninth',
    '腊八': 'Laba',
    '小年': 'Little New Year',
    '除夕': 'Lunar New Year\'s Eve',
    '清明': 'Qingming',

    // ---------- 行程表 ----------
    '行程表': 'Schedule',
    '本周 {n} 项 · 已完成 {m} 项': 'This week: {n} items · {m} done',
    '本周还没有安排': 'No plans this week',
    '点色块查看详情': 'Tap a block for details',

    // ---------- 天气 ----------
    '后天': 'Day after tomorrow',
    '选择城市': 'Choose city',
    '自动定位': 'Auto (current location)',
    '当前定位': 'Current location',
    '天气城市': 'Weather city',
    '天气城市已设为 {city}': 'Weather city set to {city}',
    '已使用当前位置': 'Using current location',
    '使用当前位置': 'Use current location',
    '定位不可用，请选择城市': 'Location unavailable — choose a city',
    '定位未开启': 'Location is off',
    '可以手动选择城市来显示天气。': 'You can choose a city manually for weather.',
    '正在搜索城市…': 'Searching cities…',
    '没有找到这个城市，换个名字试试。': 'No matching city. Try another name.',
    '输入城市名，例如 杭州': 'Type a city, e.g. Hangzhou',
    '正在搜索城市或区县…': 'Searching cities and districts…',
    '没有找到匹配的城市或区县，换个名字试试。': 'No matching city or district. Try another name.',
    '搜索失败，请检查网络，已保留原来的城市。': 'Search failed. Check your connection — your current city is unchanged.',
    '输入城市或区县，例如 杭州 / 西湖': 'Type a city or district, e.g. Hangzhou / Xihu',
    '城市或区县只用于查询天气，保存在本机。定位只在更新天气时读取一次。': 'City or district is used only for weather and saved on this device. Location is read once per update.',
    '城市与区县搜索来自 Photon（基于 OpenStreetMap，数据 © OpenStreetMap 贡献者，ODbL），只在输入时即时查询，不保存搜索历史。': 'City and district search uses Photon (based on OpenStreetMap, data © OpenStreetMap contributors, ODbL). Lookups happen only as you type; no search history is stored.',
    '天气数据来自 Open-Meteo，只用于显示天气，不包含统计或广告代码。': 'Weather data comes from Open-Meteo and is used only to display the forecast; there is no analytics or ad code.',
    '天气按定位坐标的区域网格取值，可到区/县级别。': 'Weather is read from the regional grid at your location, down to district/county level.',
    '地名由无需密钥的开放地理服务（BigDataCloud / OpenStreetMap Nominatim）反查，仅在本次使用内缓存，不长期保存。': 'Place names are looked up once via keyless open geo services (BigDataCloud / OpenStreetMap Nominatim) and cached only for this session.',
    '天气图标：Lucide 图标集（ISC License，可商用）；图标以 SVG 内联随应用本地打包，不从网络加载。': 'Weather icons: Lucide (ISC License, free for commercial use), bundled locally as inline SVG and never loaded from the network.',
    '定位权限只用于更新天气时读取一次位置；不会后台持续定位，不上传也不记录坐标。拒绝授权时可以手动选择城市。': 'Location is read once per weather update only. There is no background tracking, and coordinates are neither uploaded nor stored. If you decline, you can pick a city manually.',
    '用于查询当地天气：只在更新天气时读取一次经纬度，不后台追踪、不上传。拒绝时也可以手动选择城市。': 'Used to look up local weather: coordinates are read once per weather update, with no background tracking and no upload. You can also pick a city manually.',
    '定位只在需要更新天气时取一次，不做后台持续追踪，也不上传任何位置信息。': 'Location is read once only when weather needs updating, with no background tracking and no location upload.',

    // ---------- 条目地址 ----------
    '地址': 'Address',
    '添加地址': 'Add address',
    '选择地址': 'Choose address',
    '搜索街道或地点，例如 西湖大道': 'Search a street or place, e.g. West Lake Blvd',
    '打开地图': 'Open in maps',
    '清除地址': 'Clear address',
    '地址已清除': 'Address cleared',
    '地址已保存': 'Address saved',
    '正在定位…': 'Locating…',
    '正在查找地址…': 'Looking up the address…',
    '正在搜索地址…': 'Searching addresses…',
    '当前地址：{label}': 'Current address: {label}',
    '定位失败，可以手动搜索地址。': 'Location failed. Search for the address manually.',
    '只获得了大致位置。可以手动搜索地址，或在系统设置里允许精确位置。': 'Only approximate location is available. Search for the address manually, or allow precise location in system settings.',
    '没能获取位置对应的地址，可以手动搜索。': 'Could not find an address for this location. Search manually instead.',
    '没有找到匹配的地址，换个关键词试试。': 'No matching address. Try another keyword.',
    '地址搜索失败，请稍后再试。': 'Address search failed. Try again later.',
    '地址只随这条记录保存在本机，可随备份导出和恢复，不会上传。': 'The address is saved with this entry on this device, included in backups, and never uploaded.',
    '地址已复制，可粘贴到地图应用': 'Address copied — paste it into a maps app',
    '没有可用的地图应用，已复制地址': 'No maps app available — address copied',

    // WMO 天气状态（简短文案）
    '晴': 'Clear',
    '晴间多云': 'Mostly clear',
    '多云': 'Partly cloudy',
    '阴': 'Overcast',
    '雾': 'Fog',
    '雾凇': 'Rime fog',
    '毛毛雨': 'Drizzle',
    '冻雨': 'Freezing rain',
    '小雨': 'Light rain',
    '中雨': 'Rain',
    '大雨': 'Heavy rain',
    '阵雨': 'Showers',
    '强阵雨': 'Heavy showers',
    '小雪': 'Light snow',
    '中雪': 'Snow',
    '大雪': 'Heavy snow',
    '米雪': 'Snow grains',
    '阵雪': 'Snow showers',
    '雷阵雨': 'Thunderstorm',
    '雷暴冰雹': 'Storm with hail'
  };

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];
  var WEEK_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  var lang = 'zh';
  var originals = new WeakMap();
  var attrOriginals = new WeakMap();
  var applying = false;
  var observer = null;
  var changeHook = null;

  function norm(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  function lookup(text) {
    var key = norm(text);
    if (!key) return null;
    return DICT[key] || null;
  }

  // 可在生成动态文案时调用：T('本月 {n} 项', { n: 3 })
  function T(template, vars) {
    var out = lang === 'en' ? (DICT[norm(template)] || template) : template;
    if (vars) {
      out = out.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] === undefined || vars[k] === null ? m : String(vars[k]);
      });
    }
    return out;
  }

  function skipNode(node) {
    var parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest('script, style, textarea, .row-title, .detail-value, [data-no-i18n]')) return true;
    return false;
  }

  function applyTextNode(node) {
    if (skipNode(node)) return;
    var current = node.nodeValue;
    if (originals.has(node)) {
      var src = originals.get(node);
      var next = lang === 'en' ? (lookup(src) || src) : src;
      if (current !== next) node.nodeValue = next;
      return;
    }
    if (lang !== 'en') {
      originals.set(node, current);
      return;
    }
    var hit = lookup(current);
    if (!hit) {
      // 英文模式下新出现的节点多半已经是英文，记下来即可
      originals.set(node, current);
      return;
    }
    originals.set(node, current);
    node.nodeValue = current.replace(current.trim(), hit);
  }

  function applyAttrs(el) {
    if (!el.hasAttribute) return;
    if (el.hasAttribute('data-wday')) {
      var idx = Number(el.getAttribute('data-wday'));
      var arr = lang === 'en' ? WEEK_EN : WEEK_ZH;
      var next = arr[idx] || '';
      if (el.textContent !== next) el.textContent = next;
    }
    for (var i = 0; i < ATTRS.length; i++) {
      var attr = ATTRS[i];
      if (!el.hasAttribute(attr)) continue;
      var store = attrOriginals.get(el);
      if (!store) {
        store = {};
        attrOriginals.set(el, store);
      }
      if (!store[attr]) store[attr] = el.getAttribute(attr);
      var src = store[attr];
      var val = lang === 'en' ? (lookup(src) || src) : src;
      if (el.getAttribute(attr) !== val) el.setAttribute(attr, val);
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      applyTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) applyAttrs(root);
    var node = root.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType === 3) applyTextNode(node);
      else if (node.nodeType === 1) {
        applyAttrs(node);
        walk(node);
      }
      node = nextNode;
    }
  }

  function apply(root) {
    if (applying) return;
    applying = true;
    try {
      walk(root || document.body);
    } finally {
      applying = false;
    }
  }

  function setLang(next, opts) {
    lang = next === 'en' ? 'en' : 'zh';
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
    document.title = lang === 'en' ? 'AeroPlan' : '氢计划';
    apply(document.body);
    if (opts && typeof opts.onChange === 'function') opts.onChange(lang);
    if (typeof changeHook === 'function') changeHook(lang);
  }

  function watch(root) {
    if (observer || typeof MutationObserver === 'undefined') return;
    var target = root || document.body;
    var scheduled = false;
    observer = new MutationObserver(function (mutations) {
      if (applying || lang !== 'en') return;
      if (!mutations.length) return;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        apply(target);
      });
    });
    observer.observe(target, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ATTRS.concat(['data-wday']) });
  }

  window.I18N = {
    get lang() { return lang; },
    isEn: function () { return lang === 'en'; },
    t: T,
    apply: apply,
    setLang: setLang,
    watch: watch,
    dict: DICT,
    onChange: function (fn) { changeHook = fn; }
  };
})();
