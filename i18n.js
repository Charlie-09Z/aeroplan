/* =========================================================
   氢计划 / AeroPlan · 双语文案（v0.8.0）
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
    '放假': 'Holiday',
    '调休上班': 'Make-up workday',
    '调休 · 上班': 'Make-up workday',
    '未设时间': 'No time set',
    '基准': 'base',
    '触发时间已过去': 'Fire time already passed',
    '网页版只排 24 小时内': 'Web build only schedules within 24h',
    '条目已完成，不再提醒': 'Item is done — no reminder',
    '条目日期已过去': 'Item date already passed',
    '计划已完成，不再提醒': 'Plan is done — no reminder',
    '周期已过去': 'Plan period already passed',
    '超出 {n} 天排程窗口': 'Beyond the {n}-day scheduling window',
    '超出本轮排程上限 {n} 条': 'Beyond this round\'s limit of {n}',
    'id 碰撞，已顺延': 'id collision — shifted to next slot',
    '系统未接受该排程': 'The system did not accept this schedule',
    '系统未回读 {n} 条排程，可能被省电策略拦截': 'The system could not read back {n} schedules — battery policy may be blocking them',
    '排程失败': 'Scheduling failed',
    '更多信息': 'More info',
    '已排程': 'Scheduled',
    '排程中': 'Scheduling',
    '前台计时器': 'In-page timer',
    '已跳过': 'Skipped',
    '通知权限未允许': 'Notification permission not granted',
    '日期时间': 'Date & time',
    '这天还没有安排': 'Nothing scheduled this day',
    '+ 添加': '+ Add',
    '收起': 'Collapse',

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
    '已选 {n} 项': 'Selected {n}',
    '共 {n} 项': '{n} items',
    '全选本组 · 共 {n} 项': 'Select group · {n} items',
    '已选 {k} / 共 {n} 项': '{k} / {n} selected',
    '将删除 {n} 项': 'Delete {n} items',
    '将删除 {n} 项，其中 {m} 项属于同一天': 'Delete {n} items, including {m} on the same day',
    '其中 {k} 项来自重复规则，会连同整个重复规则及其所有实例一起删除。': '{k} of them are recurring — the whole repeat rule and all of its instances will be deleted.',
    '已删除 {n} 项': 'Deleted {n} items',
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
    '不需要账号，也没有统计或广告代码。': 'No account, and no analytics or ad code.',
    '存储权限仅用于写入备份文件，以及读取你选择的备份文件来恢复数据。': 'Storage permission is used only to write backup files and to read the backup file you choose when restoring.',
    '首次打开时的授权说明，可以在「权限管理」里重新打开或申请。': 'The first-run permission guide. Reopen or request it under Permissions.',
    '通过你获取本应用的渠道反馈即可（应用商店、发布页面或仓库 Issue）。': 'Send feedback through the channel where you got this app (app store, release page, or repository issues).',

    // ---------- 权限引导 ----------
    '开始使用前': 'Before you start',
    '通知': 'Notifications',
    '存储': 'Storage',
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
    '当前是网页版：下载备份、选择文件都不需要额外授权。': 'Web version: downloading backups and picking files need no extra permission.',
    '当前是安装版：备份写在应用专属目录，不需要系统存储授权。': 'Installed app: backups go to the app\'s own folder, which needs no system storage permission.',
    '存储与备份': 'Storage & backups',
    '通知与提醒': 'Notifications & reminders',

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
    '加载更早的安排': 'Load earlier items',
    '加载更晚的安排': 'Load later items',
    '当前展示近 {n} 天历史': 'Showing the last {n} days of history',
    '已展示到 {date}': 'Showing up to {date}',
    '加载中…': 'Loading…',
    '已经是最新': 'You are all caught up',
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
    '网页版的备份会保存到手机的「下载」目录：打开「文件管理」→「下载」，按文件名「{name}」查找。如果找不到，可以点下面的「再备份一次」。': 'Backups in the web version go to your phone\'s Downloads folder: open Files → Downloads and look for "{name}". If it is missing, tap "Back up again".',
    '备份保存在应用专属目录 files/backups，系统不允许其它应用直接浏览。可以点「备份数据」重新生成，再通过分享另存到「下载」。': 'The backup is stored in the app folder files/backups, which other apps cannot browse. Tap "Back up data" to create it again, then share it to Downloads.',
    '氢计划备份': 'AeroPlan backup',
    '备份文件': 'Backup file',
    '氢计划 · AeroPlan': 'AeroPlan',
    '开屏字体：站酷小薇 ZCOOL XiaoWei（中文）、Cormorant Garamond（英文），均为 SIL Open Font License 1.1 授权；字体文件随应用本地打包，不联网加载。': 'Splash fonts: ZCOOL XiaoWei (Chinese) and Cormorant Garamond (English), both under the SIL Open Font License 1.1. Font files are bundled locally and never loaded from the network.',
    '氢计划 · 版本V0.9.1': 'AeroPlan · V0.9.1',
    '农历': 'Lunar calendar',
    '提醒由系统排程，关掉应用或锁屏后也会按时通知；系统限制后台运行时可能略有延迟。': 'Reminders are scheduled by the system and still fire when the app is closed or the screen is locked. Strict background limits may delay them slightly.',
    '备份不会写进应用私有目录：生成后交给系统的保存 / 分享面板，由你决定存到哪里；临时文件用完即删。': 'Backups never go into the app\'s private folder: the file is handed to the system save/share panel so you decide where it goes, and the temporary file is deleted afterwards.',
    '备份时由你选择位置': 'You choose where to save the backup',
    '备份已生成，请在系统面板里选择保存位置': 'Backup created — choose where to save it in the system panel',
    '已备份，文件在手机的“下载”目录里': 'Backup saved to your phone\'s Downloads folder',
    '备份文件不会留在应用里：点「备份数据」后会打开系统的保存 / 分享面板，由你选择存到「下载」、发到微信或传上网盘。想重新导出时，再点一次「备份数据」即可。\n\n最近一次文件名：{name}': 'No copy is kept inside the app. Tapping "Back up data" opens the system save/share panel, where you choose Downloads, WeChat, cloud storage, and so on. To export again, just tap "Back up data".\n\nLast file name: {name}',
    '提醒由系统调度，关掉应用、锁屏之后也会按时通知；系统省电策略很严格时可能略有延迟。可以在「权限管理」里检查通知与精确闹钟权限。': 'Reminders are scheduled by the system and still fire when the app is closed or the screen is locked. Very strict battery policies may delay them slightly. You can check notification and exact-alarm permissions under Permission management.',
    '备份不会写进应用私有目录：每次备份都会打开系统的保存/分享面板，由你选择存到「下载」、发到微信或传上网盘，临时文件用完即删。': 'Backups are never written into the app\'s private folder: each backup opens the system save/share panel so you can save it to Downloads, send it via WeChat, or upload it to cloud storage. Temporary files are deleted afterwards.',
    '编辑条目': 'Edit item',
    '编辑计划': 'Edit plan',
    '保存修改': 'Save changes',
    '已保存修改：{title}': 'Changes saved: {title}',
    '已修改，但没能保存到本机': 'Changed, but could not save to this device',
    '编辑这条安排': 'Edit this item',
    '编辑这条计划': 'Edit this plan',
    '允许精确提醒': 'Allow exact reminders',
    'Android 12 起，系统需要「闹钟与提醒」权限，允许后提醒才能准点弹出；不允许时仍会提醒，但可能延迟几分钟。': 'Since Android 12, the system requires the "Alarms & reminders" permission for on-time notifications. Without it reminders still arrive, but may be a few minutes late.',
    '去允许': 'Allow',
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
    '天气': 'Weather',
    '天气城市': 'Weather city',
    '天气城市已设为 {city}': 'Weather city set to {city}',
    '可以手动选择城市来显示天气。': 'You can choose a city manually for weather.',
    '正在搜索城市…': 'Searching cities…',
    '没有找到这个城市，换个名字试试。': 'No matching city. Try another name.',
    '正在搜索城市或区县…': 'Searching cities and districts…',
    '没有找到匹配的城市或区县，换个名字试试。': 'No matching city or district. Try another name.',
    '搜索失败，请检查网络，已保留原来的城市。': 'Search failed. Check your connection — your current city is unchanged.',
    '城市与区县搜索来自 Photon（基于 OpenStreetMap，数据 © OpenStreetMap 贡献者，ODbL），只在输入时即时查询，不保存搜索历史。': 'City and district search uses Photon (based on OpenStreetMap, data © OpenStreetMap contributors, ODbL). Lookups happen only as you type; no search history is stored.',
    '天气数据来自 Open-Meteo，只用于显示天气，不包含统计或广告代码。': 'Weather data comes from Open-Meteo and is used only to display the forecast; there is no analytics or ad code.',
    '天气按所选地点的坐标取值，可到区/县级别。': 'Weather is read from the coordinates of the selected place, down to district/county level.',
    '天气图标：Lucide 图标集（ISC License，可商用）；图标以 SVG 内联随应用本地打包，不从网络加载。': 'Weather icons: Lucide (ISC License, free for commercial use), bundled locally as inline SVG and never loaded from the network.',

    // ---------- 条目地址 ----------
    '地址': 'Address',
    '添加地址': 'Add address',
    '选择地址': 'Choose address',
    '搜索街道或地点，例如 西湖大道': 'Search a street or place, e.g. West Lake Blvd',
    '打开地图': 'Open in maps',
    '清除地址': 'Clear address',
    '地址已清除': 'Address cleared',
    '地址已保存': 'Address saved',
    '正在搜索地址…': 'Searching addresses…',
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
    '雷暴冰雹': 'Storm with hail',

    // 关于页（v0.7.0）
    '应用简介': 'Overview',
    '数据存放': 'Where data lives',
    '网络请求与数据去向': 'Network requests and where data goes',
    '权限清单': 'Permissions',
    '备份文件': 'Backup files',
    '提醒的局限': 'Limits of reminders',
    '同意记录': 'Consent record',
    '签名与安装包': 'Signature and installers',
    '协议条款': 'Terms',
    '数据来源': 'Data sources',
    '字体与图标许可': 'Fonts & icons',
    '联系方式': 'Contact',
    '氢计划是一个纯本地的日程与行程工具：日历、条目、计划、行程表和天气。没有账号，也没有服务端。': 'AeroPlan is a fully local schedule and planning tool: calendar, items, plans, timetable and weather. There are no accounts and no server.',
    '提醒由系统本地通知调度，应用关闭或锁屏后仍会触发。': 'Reminders are scheduled through system local notifications and still fire when the app is closed or the screen is locked.',
    '条目、计划、分类、设置和同意记录保存在本机：优先 IndexedDB（light-schedule-db），不可用时退回 localStorage。': 'Items, plans, categories, settings and the consent record stay on this device: IndexedDB (light-schedule-db) is preferred, with localStorage as a fallback.',
    '没有服务器，我们不会持有你的数据副本。': 'There is no server, so we hold no copy of your data.',
    '卸载应用或清除应用数据会删除全部本地内容。换机或清理前请先导出备份。': 'Uninstalling the app or clearing its data removes all local content. Export a backup before switching devices or cleaning up.',
    '只有天气与地址搜索会联网。它们发出的是搜索关键词和所选地点的坐标，收件方只有下列服务。': 'Only weather and address search go online. They send search keywords and the coordinates of the place you picked, and only to the services listed below.',
    '天气：只发送所选地点的经纬度（保留 3 位小数，约 100 米精度），发给 Open-Meteo。': 'Weather: sends only the coordinates of the place you selected (three decimal places, roughly 100 m) to Open-Meteo.',
    '城市与地点搜索：只发送你输入的搜索关键词，发给 Photon（基于 OpenStreetMap 数据）。': 'City and place search: sends only the keywords you type to Photon, which uses OpenStreetMap data.',
    '地址搜索：只发送你输入的搜索关键词，发给 Photon。': 'Address search: sends only the keywords you type to Photon.',
    '不会发送日程正文、备注、分类、计划、备份文件内容、账号信息、通讯录、相片，也不会发送设备型号。': 'It does not send event titles, notes, categories, plans, backup contents, account details, contacts, photos or the device model.',
    '所有请求都由设备用 HTTPS 直连上述服务，不经过本项目中转；应用没有统计、广告或崩溃上报 SDK。': 'Every request goes directly from the device to those services over HTTPS and is not proxied by this project. The app has no analytics, ads or crash-reporting SDK.',
    '通知：用于到点提醒。拒绝后应用仍可使用，但收不到提醒。': 'Notifications: used for due reminders. If denied, the app still works but you will not receive reminders.',
    '闹钟与提醒（Android 12 及以上）：用于准时触发提醒。拒绝后提醒可能延后或漏掉。': 'Alarms and reminders (Android 12+): keeps reminders on time. If denied, reminders may be delayed or missed.',
    '存储（旧版 Android）：只用于导出备份和读取你选择的备份文件。拒绝后无法导出或恢复。': 'Storage (older Android): only used to export a backup and to read the backup file you choose. If denied, export and restore are unavailable.',
    '振动：用于选择日期、时间时的轻触反馈。关闭后只是没有触感，不影响功能。': 'Vibration: light feedback when picking dates and times. Turning it off removes the feel but affects no feature.',
    '本应用不申请定位权限，也不读取设备位置。': 'The app does not request location permission and does not read device location.',
    '备份是 JSON 文件，当前未加密，含条目、计划、分类、设置和同意记录。': 'A backup is a JSON file. It is unencrypted and contains items, plans, categories, settings and the consent record.',
    '备份生成后交给系统的保存或分享面板，应用内不留副本，临时文件用完即删。': 'After creation the file goes to the system save or share panel. No copy stays in the app, and temporary files are deleted right after use.',
    '文件可能被网盘、聊天工具或他人看到，请存放到你可信的位置。': 'The file may be seen in cloud drives, chat apps or by other people. Keep it somewhere you trust.',
    '系统清理后台、省电模式或权限关闭时，提醒可能延迟，甚至不触发。': 'Background cleanup, battery saving or revoked permissions may delay a reminder or stop it entirely.',
    '重要事项请同时在系统闹钟里设一次提醒。这是本应用的真实边界。': 'For anything important, also set a system alarm. This is a real limit of the app.',
    '本机尚未记录同意。': 'No consent record on this device yet.',
    '这条记录只存在本机，清除应用数据或卸载会一并删除。': 'This record stays on this device only and is removed when you clear app data or uninstall.',
    '天气与预报：Open-Meteo。请求只包含所选地点的经纬度。': 'Weather and forecast: Open-Meteo. Requests contain only the coordinates of the selected place.',
    '城市与地点搜索：Photon，基于 OpenStreetMap 数据。': 'City and place search: Photon, based on OpenStreetMap data.',
    '官方签名指纹：生成新密钥后填入（见 README）': 'Official signing fingerprint: to be filled after generating the new key (see README)',
    '官方签名指纹：{fp}（可在系统应用信息中核对）': 'Official signing fingerprint: {fp} (check it in the system app info)',
    '从非官方渠道获得、或签名指纹不一致的安装包，可能已被修改，请勿使用。': 'Installers from unofficial channels, or with a different signing fingerprint, may have been modified. Do not use them.',
    '客户端没有「不可破解的加密」：混淆只提高改动成本，真正阻止第三方改包的是系统的签名校验。': 'No client-side encryption here is unbreakable: obfuscation only raises the cost of tampering; what actually stops modified packages is the system signature check.',
    '生效日期：2026-11-07。': 'Effective date: 2026-11-07.',
    '本页内容共同构成使用协议：数据存放、网络请求与数据去向、权限清单、备份文件、提醒的局限。': 'This page as a whole forms the terms of use: data storage, network requests and data, permissions, backup files and the limits of reminders.',
    '协议更新时随新版本发布，并在本页标注新的生效日期；重大变更会在下次启动时再次提示确认。': 'Updated terms ship with a new version and carry a new effective date on this page; major changes prompt for confirmation again on the next launch.',
    '继续使用即表示你已阅读并接受本协议。': 'Continuing to use the app means you have read and accept these terms.',
    '请通过你获取本应用的渠道联系我们：应用商店页面、发布页面或仓库 Issue。': 'Contact us through the channel where you got the app: the app store page, release page or repository issues.',
    '我已阅读并接受': 'I have read and accept',
    '不同意': 'Do not accept',
    '上次同意：{time} · 协议版本 {version}': 'Last consent: {time} · policy version {version}',
    '本机存储不可用，同意记录未能保存，下次启动会再次询问': 'Local storage is unavailable, so the consent record could not be saved. You will be asked again on the next launch.',
    '需要接受协议才能继续使用': 'You need to accept the terms to continue.',
    '未选择城市': 'No city selected',
    '输入城市、区县或地点，例如 杭州 / 西湖 / 剑桥大学': 'Search a city, district or place, e.g. Hangzhou / Xihu / University of Cambridge',
    '搜索街道或地点，例如 西湖大道 / 剑桥大学': 'Search a street or place, e.g. Xihu Avenue / University of Cambridge',
    '城市或区县由你搜索选择，只用于查询天气并保存在本机；应用不读取设备定位。': 'You pick a city or district by search. It is used only for weather and stored on this device; the app never reads device location.',
    '地址由你搜索选择，只随这条记录保存在本机，可随备份导出和恢复，不会上传。': 'You pick an address by search. It is stored on this device with this record, can be exported and restored with a backup, and is never uploaded.',

    // 删除所有数据
    '删除所有数据': 'Delete all data',
    '将删除 {items} 条安排、{plans} 条计划、{cats} 个分类，以及全部设置、本地缓存与已排程的提醒。\n\n删除后无法恢复，建议先备份。': 'This will delete {items} items, {plans} plans, {cats} categories, all settings, local caches and scheduled reminders.\n\nThis cannot be undone. Back up first if needed.',
    '删除': 'Delete',
    '已删除所有数据': 'All data deleted',
    '已删除，但未能写入本机': 'Deleted, but could not write to this device',

    // ---------- v0.8.0：黄历 / 提醒自查 / 关于 ----------
    '黄历': 'Almanac',
    '黄历卡片': 'Almanac card',
    '宜': 'Good for',
    '忌': 'Avoid',
    '冲煞': 'Clash',
    '值神': 'Day spirit',
    '日程提醒': 'Event reminders',
    '计划与条目的到点提醒': 'Reminders for plans and items',
    '测试通知': 'Test notification',
    '测试通知（5 秒后）': 'Test notification (in 5 s)',
    '5 秒后 · 含状态自查': 'In 5 s · with self-check',
    '刷新自查': 'Refresh check',
    '测试提醒': 'Test reminder',
    '看到这条通知，说明通知权限、渠道和排程都正常。': 'If you see this, notification permission, the channel and scheduling all work.',
    '已排程，5 秒后应弹出': 'Scheduled; it should appear in 5 seconds',
    '排程失败：': 'Scheduling failed: ',
    '当前是网页版，无法排程系统通知。': 'The web version cannot schedule system notifications.',
    '系统通知总开关被关闭': 'The system notification switch is off',
    '系统未允许「闹钟和提醒」': 'The system has not allowed "Alarms and reminders"',
    '通知渠道不可用': 'The notification channel is unavailable',
    '去设置': 'Open settings',
    '图标': 'Icon',
    '默认色点': 'Default dot',
    '可能延迟': 'May be delayed',
    '更新于 {time}': 'Updated {time}',
    '更新于 {time} · 可能已过期': 'Updated {time} · Possibly outdated',
    '系统里「闹钟和提醒」未允许：提醒会退化为非精确排程，可能延迟（通常几分钟内）。允许后可准时；若系统里找不到这一项，请在「自启动 / 后台运行」里允许本应用，并把电池策略设为「不限制」。': 'The system has not allowed "Alarms and reminders": reminders fall back to inexact scheduling and may be delayed (usually within minutes). Allow it for on-time delivery; if the item is not shown, allow autostart/background activity and set battery usage to "Unrestricted".',

    '纯本地的日程与行程工具：日历、条目、计划、行程表、天气与黄历。没有账号，也没有服务端。': 'A fully local schedule and planning tool: calendar, items, plans, timetable, weather and almanac. No accounts and no server.',
    '条目、计划、分类、偏好与同意记录只保存在本机：优先 IndexedDB，不可用时退回 localStorage。没有服务器副本。': 'Items, plans, categories, preferences and the consent record stay on this device only: IndexedDB is preferred, with localStorage as a fallback. There is no server copy.',
    '卸载应用会删除全部本地内容；换机前请先导出备份。': 'Uninstalling the app removes all local content. Export a backup before switching devices.',
    '只有天气与地点搜索会联网，且只发送搜索关键词或所选地点的坐标（保留 3 位小数，约 100 米精度）。': 'Only weather and place search go online, sending just your keywords or the coordinates of the selected place (three decimal places, about 100 m).',
    '收件方只有：Open-Meteo（天气）、Photon（地点搜索，基于 OpenStreetMap 数据）。': 'The only recipients are Open-Meteo (weather) and Photon (place search, based on OpenStreetMap data).',
    '不会发送日程正文、备注、分类、备份内容、账号、通讯录、相片或设备型号；应用没有统计、广告或崩溃上报 SDK。': 'No event titles, notes, categories, backup contents, accounts, contacts, photos or device model are sent. The app has no analytics, ads or crash-reporting SDK.',
    '权限与系统限制': 'Permissions and system limits',
    '通知：用于到点提醒；拒绝后仍可使用，但收不到提醒。': 'Notifications: for due reminders. If denied, the app still works but you will not get reminders.',
    '闹钟与提醒（Android 12/12L）：用于准时触发；Android 13 及以上由系统自动授予，没有单独开关。': 'Alarms and reminders (Android 12/12L): keeps reminders on time. On Android 13 and later the system grants it automatically with no separate toggle.',
    '振动：用于轻触反馈，可随时关闭。本版本不申请存储与定位权限：备份经系统保存/分享面板完成，导入由你手动选择文件。': 'Vibration: light feedback, can be turned off. This version requests no storage or location permission: backups use the system save/share panel, and imports use the file you pick manually.',
    '国产系统的自启动、后台清理与省电策略可能拦截提醒；需要时请在系统设置里允许本应用自启动/后台运行，并把省电策略设为「不限制」。重要事项请同时在系统闹钟里设一次提醒。': 'Autostart, background cleanup and battery policies on some ROMs may block reminders. When needed, allow autostart/background activity and set battery usage to "Unrestricted". For anything important, also set a system alarm.',
    '备份是未加密的 JSON，含条目、计划、分类、偏好与同意记录。': 'A backup is an unencrypted JSON file containing items, plans, categories, preferences and the consent record.',
    '生成后交给系统保存或分享面板，应用内不留副本，临时文件用完即删；文件可能被他人看到，请存放在可信位置。': 'It is handed to the system save/share panel; no copy stays in the app and temporary files are deleted right after use. The file may be seen by others, so keep it somewhere you trust.',
    '数据来源与许可': 'Data sources & licences',
    '天气与预报：Open-Meteo，仅发送所选地点坐标。地点搜索：Photon（OpenStreetMap 数据，版权归贡献者，ODbL）。请求都由设备直达，不经过本项目中转。': 'Weather: Open-Meteo, sent only the selected coordinates. Place search: Photon (OpenStreetMap data, © contributors, ODbL). Requests go directly from the device and are not proxied by this project.',
    '站酷小薇 ZCOOL XiaoWei 与 Cormorant Garamond：SIL Open Font License 1.1；Lucide 图标：ISC License。字体、图标、应用图标与启动图都随应用本地打包，不从网络加载。': 'ZCOOL XiaoWei and Cormorant Garamond: SIL Open Font License 1.1; Lucide icons: ISC License. Fonts, icons, the app icon and splash images are bundled locally and never loaded from the network.',
    '本页内容共同构成使用协议：数据存放、网络请求与数据去向、权限与系统限制、备份文件、同意记录。': 'This page as a whole forms the terms of use: data storage, network requests and data, permissions and system limits, backup files, and the consent record.',
    '协议更新时随新版本发布并标注新的生效日期；重大变更会在下次启动时再次提示确认。继续使用即表示你已阅读并接受本协议。': 'Updated terms ship with a new version and carry a new effective date; major changes prompt for confirmation again on the next launch. Continuing to use the app means you have read and accept these terms.',

    // ---------- 日记 ----------
    '日记': 'Journal',
    '时间线': 'Timeline',
    '网格': 'Grid',
    '搜索日记': 'Search journal',
    '搜索日记、标签或日期': 'Search journal, tags or date',
    '清空搜索': 'Clear search',
    '有附件': 'With files',
    '有心情': 'With mood',
    '全部月份': 'All months',
    '按年月筛选': 'Filter by month',
    '写今天': 'Write today',
    '续写今天': 'Continue today',
    '管理': 'Manage',
    '完成': 'Done',
    '已选 {n} 篇': '{n} selected',
    '还没有写过日记': 'No journal entries yet',
    '想到什么就写一句，不必等到有完整的一天。': 'Write a line when it comes to mind; a day needn\'t be complete.',
    '没有符合条件的日记': 'No entries match',
    '换个筛选，或者清空搜索再看看。': 'Try another filter, or clear the search.',
    '那天写了什么': 'What you wrote that day',
    '只记了心情和附件': 'Only a mood and files',
    '这篇只有心情和附件': 'Only a mood and files',
    '{n} 字': '{n} chars',
    '{n} 个标签': '{n} tags',
    '{n} 个附件': '{n} files',
    '已保存': 'Saved',
    '已保存 · {n} 字': 'Saved · {n} chars',
    '今天发生了什么…': 'What happened today…',
    '今天想记什么': 'What would you like to record?',
    '选择省市': 'Choose region',
    '修改省市': 'Change region',
    '位置': 'Location',
    '具体位置（可选），如街道、店铺、楼栋': 'Specific place (optional): street, shop, building',
    '这天已有日记，已进入编辑': 'An entry already exists for that day; opening it for editing',
    '预告': 'Upcoming',
    '正文 / 标签': 'Text / tags',
    '添加视频（单个 50MB）': 'Add video (max 50 MB)',
    '每篇最多 1 个视频': 'One video per entry',
    '视频超过 50MB，无法添加': 'Video exceeds 50 MB',
    '将删除 {n} 篇日记': 'Delete {n} entries',
    '附件原图、缩略图与视频会一并清除，无法恢复。': 'Original attachments, thumbnails and videos will be removed. This cannot be undone.',
    '省市列表来自应用内置，完全离线，不联网、不定位、不上传。': 'Regions come from a built-in list. Fully offline: no network, no location, no upload.',
    '添加标签': 'Add tag',
    '添加标签，回车确认': 'Add a tag, press Enter',
    '再加一个': 'Add another',
    '删除标签': 'Remove tag',
    '最多 12 个标签': 'Up to 12 tags',
    '开心': 'Happy',
    '平静': 'Calm',
    '疲惫': 'Tired',
    '难过': 'Sad',
    '烦躁': 'Irritated',
    '期待': 'Hopeful',
    '附件': 'Attachments',
    '添加附件': 'Add attachment',
    '添加图片': 'Add image',
    '添加文件': 'Add file',
    '处理中…': 'Processing…',
    '{n} / {max} 个 · 已用 {size}，上限 {limit}': '{n} / {max} files · {size} used of {limit}',
    '图片会先压缩再存进本机，不上传、不写入相册': 'Images are compressed and stored on this device — nothing is uploaded or saved to Photos.',
    '删除这篇日记': 'Delete this entry',
    '删除附件': 'Remove attachment',
    '当前环境不支持附件：浏览器数据库（IndexedDB）不可用，日记文字仍会照常保存。': 'Attachments aren\'t available here: the browser database (IndexedDB) is unavailable. Journal text still saves normally.',
    '单篇最多 {n} 个附件': 'Up to {n} files per entry',
    '单篇最多 {n} 个附件，多出的已跳过': 'Up to {n} files per entry; the extras were skipped',
    '有 {n} 个文件超过 20MB，已跳过': '{n} files over 20MB were skipped',
    '附件已占用 {size}，接近上限，请先清理': 'Attachments already use {size}, close to the limit. Please clean up first.',
    '附件没能保存，请重试': 'Couldn\'t save the attachments. Please try again.',
    '这个附件不在本机。它可能来自一份不含附件的备份，或在旧设备上。': 'This file isn\'t on this device. It may come from a backup without attachments, or from an older device.',
    '知道了': 'Got it',
    '大小 {size} · 类型 {type}': 'Size {size} · Type {type}',
    '未知': 'Unknown',
    '删除这篇日记？': 'Delete this entry?',
    '{date} 的日记和 {n} 个附件会一起删除，无法恢复。': 'The entry for {date} and its {n} files will be deleted. This can\'t be undone.',
    '{date} 的日记会被删除，无法恢复。': 'The entry for {date} will be deleted. This can\'t be undone.',
    '已删除这篇日记': 'Entry deleted',
    '删除 {n} 篇日记？': 'Delete {n} entries?',
    '这 {n} 篇日记和它们的附件会一起删除，无法恢复。': 'These {n} entries and their files will be deleted. This can\'t be undone.',
    '已删除 {n} 篇日记': 'Deleted {n} entries',

    // ---------- 备份：是否包含附件 ----------
    '默认只导出日记文字与附件信息，不包含图片和文件本体。': 'By default only journal text and attachment details are exported — not the images or files themselves.',
    '不含附件（推荐，文件小）': 'Without attachments (recommended, smaller)',
    '只含日记文字与附件信息，恢复后附件列表仍在、文件不在': 'Journal text and attachment details only; after restoring, the list remains but the files don\'t',
    '包含附件（体积大）': 'Include attachments (large)',
    '图片与文件合计约 {size}': 'Images and files total about {size}',
    '图片、视频与文件合计约 {size}': 'Images, videos and files total about {size}',
    '含视频，备份可能达到数百 MB': 'Includes video; the backup may reach hundreds of MB',
    '导出的是未加密的 JSON 文件，请存到可信位置；视频会让备份达到数百 MB，请确认存储空间充足。': 'The export is an unencrypted JSON file; keep it somewhere trusted. Videos can make the backup hundreds of MB, so check your free space first.',
    '当前没有附件，文件不会变大': 'No attachments, so the file won\'t grow',
    '导出的是未加密的 JSON 文件，请存到可信位置；含附件时体积很大。': 'The export is an unencrypted JSON file — keep it somewhere you trust. It gets large with attachments.',
    '导出包含附件的备份？': 'Export a backup with attachments?',
    '文件约 {size}，比不含附件大很多；导出的是未加密文件，请存到可信位置。': 'The file will be about {size}, much larger than without attachments. It\'s unencrypted; keep it somewhere you trust.',
    '继续导出': 'Continue',
    '当前环境读不到附件，备份只包含日记文字与附件信息': 'Attachments can\'t be read in this environment, so the backup contains journal text and attachment details only.',
    '条目、计划、分类、日记、偏好与同意记录只保存在本机：优先 IndexedDB，不可用时退回 localStorage。没有服务器副本。': 'Items, plans, categories, journal entries, preferences and consent records stay on this device: IndexedDB first, with localStorage as a fallback. There is no server copy.',
    '日记里的图片与文件只存进本应用自己的 IndexedDB，不写入相册、不申请存储权限、不联网、不做云端同步。IndexedDB 不可用时，日记文字仍可保存，附件功能会提示「当前环境不支持附件」。': 'Images and files in the journal go only into this app\'s own IndexedDB — not to Photos, with no storage permission, no network, and no cloud sync. When IndexedDB is unavailable, journal text still saves and attachments show "not supported here".',
    '备份是未加密的 JSON，含条目、计划、分类、日记、偏好与同意记录。': 'A backup is an unencrypted JSON file containing items, plans, categories, journal entries, preferences and the consent record.',
    '默认备份不含附件本体，只有文件名、大小与类型；需要连图片一起带走时，在「备份数据」弹窗里选择「包含附件」，体积可能很大，导出前会估算并再次确认。': 'By default a backup has no attachment bodies — only names, sizes and types. To take the images along, choose "Include attachments" in the Backup dialog; it can be large, and the size is estimated and confirmed before export.',
    '备份文件中的日记为明文，含附件时体积很大，请妥善保管。': 'Journal entries in a backup are plain text, and the file gets large with attachments — please keep it safe.'
  };

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  // 字典键里有 \n 这类空白差异，查表前统一压成单空格，避免整句匹配失败后回落到中文
  var NORM_DICT = (function () {
    var map = {};
    for (var key in DICT) {
      if (Object.prototype.hasOwnProperty.call(DICT, key)) map[norm(key)] = DICT[key];
    }
    return map;
  })();
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
    return NORM_DICT[key] || null;
  }

  // 可在生成动态文案时调用：T('本月 {n} 项', { n: 3 })
  function T(template, vars) {
    var out = lang === 'en' ? (NORM_DICT[norm(template)] || template) : template;
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
