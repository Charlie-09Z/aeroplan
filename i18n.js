/* =========================================================
   氢计划 / AeroPlan · 双语文案（v1.1.8）
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
    '日期时间': 'Date & time',
    '这天还没有安排': 'Nothing scheduled this day',
    '+ 添加': '+ Add',
    '收起': 'Collapse',

    // ---------- 议程 ----------
    '今天还没有行程': 'No trips today',
    '想到什么就先记下来，之后再调整。': 'Jot it down now; you can adjust it later.',
    '来自更早的日期，别忘了处理': 'From earlier dates — don\'t forget them',
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
    '设置时间': 'Set time',
    '不设时间': 'No time',
    '选择日期': 'Select date',
    '上个月': 'Previous month',
    '下个月': 'Next month',
    '优先级': 'Priority',
    '更多选项': 'More options',
    '条目类型': 'Item type',
    '分类': 'Category',
    '未分类': 'Uncategorized',
    '+ 管理标签': '+ Manage tags',
    '日期': 'Date',
    '某天': 'Pick a date',
    '时间（可留空）': 'Time (optional)',
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
    '暂无未来的周计划': 'No upcoming weekly plans',
    '暂无未来的月计划': 'No upcoming monthly plans',
    '暂无未来的年计划': 'No upcoming yearly plans',
    '暂无计划': 'No plans yet',
    '暂无': '—',
    '其他周期': 'Other periods',
    '已添加，但没能保存到本机': 'Added, but could not save on this device',

    // ---------- 设置 ----------
    '数据': 'Data',
    '正在读取本机数据…': 'Reading local data…',
    '正在检查…': 'Checking…',
    '检测中…': 'Checking…',
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
    '关于': 'About',
    '没有账号，也不上传任何内容。': 'No account, and nothing is uploaded.',
    '换机或清理前，记得先备份。': 'Back up before switching devices or clearing data.',
    '版本': 'Version',
    '数据只在你的手机里，卸载或清理会一并删除。': 'Data lives only on your phone; uninstalling or clearing removes it.',
    '语言 / Language': 'Language',
    '语言': 'Language',
    '默认跟随系统，也可以手动切换。': 'Follows the system by default; you can also switch manually.',
    '备份位置': 'Backup location',
    '打开位置': 'Open location',
    '查看说明': 'How to find it',
    '再备份一次': 'Back up again',
    '备份位置说明': 'Backup location',
    '常用': 'Common',
    '数据与备份': 'Data & backup',
    '个性化': 'Personalization',
    '关于氢计划': 'About AeroPlan',
    '隐私承诺': 'Privacy',
    '数据存放': 'Where data lives',
    '字体与开源许可': 'Fonts & licenses',
    '联系方式': 'Contact',
    '不需要账号，也没有统计或广告代码。': 'No account, and no analytics or ad code.',
    '通过你获取本应用的渠道反馈即可（应用商店、发布页面或仓库 Issue）。': 'Send feedback through the channel where you got this app (app store, release page, or repository issues).',

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
    '请填写 1–1440 之间的整数': 'Enter a whole number between 1 and 1440',
    '结束日期早于开始日期，已改为一直重复': 'End date is before the start date; set to repeat forever',
    '已备份，文件在手机的“下载”里': 'Backed up to your phone\'s Downloads',
    '已生成备份，可直接保存或分享': 'Backup created; save or share it now',
    '备份已生成，可在下面的位置找到': 'Backup created; you can find it at the location below',
    '还没有备份文件，先点「备份数据」': 'No backup file yet. Tap "Back up data" first.',
    '已清理旧版示例数据': 'Old sample data removed',
    '替换会把现在的全部条目删掉，确定吗？': 'Replacing deletes all current items. Continue?',
    '今天的安排都完成了': 'All done for today',

    // ---------- 带占位符的动态文案 ----------
    '{n} 项安排': '{n} items',
    '今天还有 {n} 项未完成': '{n} items left today',
    '逾期 {n} 项': '{n} overdue',
    '已完成 {n} 项': '{n} done',
    '本月共 {n} 项行程': '{n} trips this month',
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
    '完成 {done}/{total}': 'Done {done}/{total}',
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
    '逾期 · {n}': 'Overdue · {n}',
    '上滑跳到下一个有行程的日期': 'Swipe up to jump to the next date with trips',
    '下滑跳到上一个有行程的日期': 'Swipe down to jump to the previous date with trips',
    '正在跳转…': 'Jumping…',
    '没有更早的行程': 'No earlier trips',
    '没有更晚的行程': 'No later trips',
    '加载中…': 'Loading…',
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
    '已添加：{title}': 'Added: {title}',

    // ---------- 本次新增的说明文案 ----------
    '应用专属目录 files/backups（可用下方按钮分享或另存到「下载」）': 'App folder files/backups (use the button below to share or save to Downloads)',
    '手机浏览器的「下载」目录（文件管理 → 下载）': 'Your browser\'s Downloads folder (Files → Downloads)',
    '网页版的备份会保存到手机的「下载」目录：打开「文件管理」→「下载」，按文件名「{name}」查找。如果找不到，可以点下面的「再备份一次」。': 'Backups in the web version go to your phone\'s Downloads folder: open Files → Downloads and look for "{name}". If it is missing, tap "Back up again".',
    '备份保存在应用专属目录 files/backups，系统不允许其它应用直接浏览。可以点「备份数据」重新生成，再通过分享另存到「下载」。': 'The backup is stored in the app folder files/backups, which other apps cannot browse. Tap "Back up data" to create it again, then share it to Downloads.',
    '氢计划备份': 'AeroPlan backup',
    '备份文件': 'Backup file',
    '氢计划 · AeroPlan': 'AeroPlan',
    '开屏字体：站酷小薇 ZCOOL XiaoWei（中文）、Cormorant Garamond（英文），均为 SIL Open Font License 1.1 授权；字体文件随应用本地打包，不联网加载。': 'Splash fonts: ZCOOL XiaoWei (Chinese) and Cormorant Garamond (English), both under the SIL Open Font License 1.1. Font files are bundled locally and never loaded from the network.',
    '氢计划 · 版本 {v}': 'AeroPlan · V{v}',
    '农历': 'Lunar calendar',
    '备份不会写进应用私有目录：生成后交给系统的保存 / 分享面板，由你决定存到哪里；临时文件用完即删。': 'Backups never go into the app\'s private folder: the file is handed to the system save/share panel so you decide where it goes, and the temporary file is deleted afterwards.',
    '备份时由你选择位置': 'You choose where to save the backup',
    '备份已生成，请在系统面板里选择保存位置': 'Backup created — choose where to save it in the system panel',
    '已备份，文件在手机的“下载”目录里': 'Backup saved to your phone\'s Downloads folder',
    '备份文件不会留在应用里：点「备份数据」后会打开系统的保存 / 分享面板，由你选择存到「下载」、发到微信或传上网盘。想重新导出时，再点一次「备份数据」即可。\n\n最近一次文件名：{name}': 'No copy is kept inside the app. Tapping "Back up data" opens the system save/share panel, where you choose Downloads, WeChat, cloud storage, and so on. To export again, just tap "Back up data".\n\nLast file name: {name}',
    '备份不会写进应用私有目录：每次备份都会打开系统的保存/分享面板，由你选择存到「下载」、发到微信或传上网盘，临时文件用完即删。': 'Backups are never written into the app\'s private folder: each backup opens the system save/share panel so you can save it to Downloads, send it via WeChat, or upload it to cloud storage. Temporary files are deleted afterwards.',
    '编辑条目': 'Edit item',
    '编辑计划': 'Edit plan',
    '保存修改': 'Save changes',
    '已保存修改：{title}': 'Changes saved: {title}',
    '已修改，但没能保存到本机': 'Changed, but could not save to this device',
    '编辑这条安排': 'Edit this item',
    '编辑这条计划': 'Edit this plan',
    '保存失败：{msg}': 'Save failed: {msg}',
    '计划保存失败，请重试': 'Could not save the plan. Please try again.',
    '分类保存失败：{msg}': 'Could not save the category: {msg}',
    '浏览器拒绝写入': 'the browser refused the write',
    '写入失败': 'the write failed',
    '写入被中断': 'the write was interrupted',
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

    // ---------- 智能提示 ----------
    '智能提示': 'Smart tips',
    '确认': 'Got it',
    '{when}：{tip}': '{when}: {tip}',
    // 天气（每类 4 套，随机选一套）
    '可能下雨，出门记得带伞': 'Rain is likely — take an umbrella.',
    '有降雨的可能，带把伞更稳妥': 'There may be rain; an umbrella would be safer.',
    '今天可能下雨，路上慢一点': 'Might rain today — take it slow on the road.',
    '雨水可能在路上，出门备好雨具': 'Rain may be on the way; keep rain gear handy.',
    '可能有降雪，出门注意防滑保暖': 'Snow is likely — watch your step and stay warm.',
    '有降雪的可能，路面湿滑，走慢些': 'Snow is possible; roads may be slippery, so walk slowly.',
    '可能下雪，记得穿暖一点、注意脚下': 'Might snow — dress warmly and mind your footing.',
    '雪花可能来，出门多留点时间': 'Snow could arrive; allow a little extra travel time.',
    '紫外线较强，记得做好防晒': 'UV is strong — remember sun protection.',
    '日晒有点强，防晒别偷懒': 'Sun exposure is high — do not skip sunscreen.',
    '紫外线偏高，出门涂好防晒': 'UV levels are high — apply sunscreen before heading out.',
    '阳光里的紫外线不弱，遮阳更舒服': 'The sun is strong; some shade will feel better.',
    '气温较高，注意补充水分': 'It is hot — drink enough water.',
    '天气偏热，记得多喝水': 'It is quite warm — remember to drink more water.',
    '今天有点热，别在太阳下待太久': 'Hot today — do not stay in the sun too long.',
    '气温不低，注意防暑降温': 'Temperatures are high — keep cool and avoid the heat.',
    '气温偏低，出门注意保暖': 'It is cold — bundle up before heading out.',
    '天气偏冷，记得多穿一件': 'It is chilly — add an extra layer.',
    '今天有点冷，注意别着凉': 'Cold today — do not catch a chill.',
    '气温不高，出门把自己裹暖些': 'Temperatures are low — wrap up before heading out.',
    '风比较大，出门留意防风': 'It is windy — mind the gusts outside.',
    '今天风不小，注意别被吹乱行程': 'It is fairly windy today — mind the gusts.',
    '风力偏大，出门带件防风外套': 'Strong wind — bring a windproof jacket.',
    '风有点大，走路骑车都慢一些': 'Windy out — take care walking or cycling.',
    '天气不错，适合出门走走': 'Nice weather — a good day to go out.',
    '今天放晴，安排点户外活动吧': 'Clear skies today — plan something outdoors.',
    '阳光正好，别辜负好天气': 'The sun is out — enjoy the fine weather.',
    '天晴了，出门透透气': 'It has cleared up — step out for some fresh air.',
    '云层较厚，出门也留意天色': 'Mostly cloudy — keep an eye on the sky.',
    '今天多云，随身看一眼天气更安心': 'Cloudy today; a quick weather check helps.',
    '天色偏阴，出门记得留意变化': 'Overcast today — watch for changes.',
    '云有点多，带把伞也不碍事': 'Quite cloudy — an umbrella will not hurt.',
    '出门前看一眼天气，安排会更从容': 'A quick look at the weather helps you plan.',
    '天气可能有变化，出门前再确认一下': 'The weather may change — check again before heading out.',
    '今天天色不太确定，备好再出门': 'The sky looks uncertain today — be prepared.',
    '出门前扫一眼天气，心里更有底': 'A quick weather glance makes the day smoother.',
    // 行程（进行中 / 即将开始，各 4 套）
    '行程 · {title} 正在进行': 'Trip · {title} is happening now',
    '行程 · {title} 已经开始了': 'Trip · {title} has already started',
    '行程 · 正在 {title}，别错过后续安排': 'Trip · You are in {title} now — mind what comes next',
    '行程 · {title} 进行中，留意时间': 'Trip · {title} in progress — keep an eye on the time',
    '行程 · {title} {n} 分钟后开始': 'Trip · {title} starts in {n} min',
    '行程 · 还有 {n} 分钟就到 {title} 了': 'Trip · {n} min until {title}',
    '行程 · {title} 即将在 {n} 分钟后开始': 'Trip · {title} begins in {n} minutes',
    '行程 · {n} 分钟后是 {title}，可以准备出发了': 'Trip · {title} in {n} min — time to head out',
    // 计划（周期前缀 + 4 套结尾）
    '本周计划': "This week's plan",
    '本月计划': "This month's plan",
    '本年计划': "This year's plan",
    '{title} 快到期限了': '{title} is almost due',
    '{title} 记得安排时间收尾': '{title}: set aside time to wrap it up',
    '{title} 只剩最后一点时间了': '{title} — only a little time left',
    '{title} 别忘在期限前完成': '{title}: finish before the deadline',
    // 爱心（日程过多，4 套）
    '今天有 {n} 项日程，记得给自己留点喘息的时间': '{n} events today — leave yourself some breathing room',
    '今天日程有点满（{n} 项），忙里也要照顾好自己': 'Today looks full ({n} events). Take good care of yourself too',
    '今天 {n} 项日程排得挺紧，中间记得起来活动一下': '{n} events today — a packed schedule. Stretch and move a little in between',
    '今天的节奏有点密（{n} 项日程），别忘了喝水休息': 'A busy day with {n} events — do not forget water and rest',
    // 节日（3 套）
    '{festival}，愿今天有一点小小的欢喜': 'Happy {festival} — may today bring you a little joy.',
    '{festival}快乐，别忘了给自己留一点温柔': 'Happy {festival}. Remember to be gentle with yourself.',
    '今天是{festival}，愿你所念皆如愿，所行皆坦途': '{festival} is here — may everything you wish for find its way to you.',
    // 最后一项行程完成（5 套）
    '今天的行程都走完了，早点休息，明天见': 'That was the last event today — rest early and see you tomorrow.',
    '最后一项也完成了，辛苦了，今晚早点睡': 'Everything is done for today. You worked hard — get to bed early tonight.',
    '一天的事收好尾了，剩下的时间留给自己': 'The day is wrapped up. Save the rest of the evening for yourself.',
    '日程走完了。天色不早的话，就早点休息吧': 'Your schedule is clear. If it is getting late, turn in early.',
    '待办都清空了，今晚不用再惦记还有什么事': 'Your to-do list is clear — nothing left to keep track of tonight.',
    // 深夜（5 套）
    '夜已经深了，剩下的事明天再说，先去睡吧': 'It is late — leave the rest for tomorrow and get some sleep.',
    '这个点还醒着的话，给自己留点睡眠时间': 'If you are still awake, give yourself a little more sleep.',
    '深夜了，屏幕的光再好看，也不如好好睡一觉': 'Late night. No screen is worth losing a good night’s rest.',
    '夜深了，愿你把今天的疲惫留在今天': 'The night is deep — leave today’s tiredness where it belongs.',
    '该睡了。明天的你，会感谢今晚早睡的自己': 'Time for bed. Tomorrow you will thank tonight’s you for sleeping early.',
    // 晚间写完日记（5 套）
    '今天记下了，就好好休息吧': 'Today is written down — now get some good rest.',
    '写完这一天，可以把剩下的时间交给睡眠了': 'With the day saved, you can hand the rest of the evening to sleep.',
    '字落在纸上，心也可以放下了，晚安': 'The words are on the page, so your mind can rest too. Good night.',
    '今天已经记在这一页了，剩下的明天再写也不迟': 'Today is on the page — the rest can wait until tomorrow.',
    '记录完今天，愿今晚睡得安稳': 'You have recorded today — may tonight be a peaceful sleep.',
    // 周计划过期（5 套）
    '有 {n} 条周计划已经过期，量力而行，慢慢来': '{n} weekly plans have slipped past their week — go easy and take your time.',
    '这一周有 {n} 条计划没赶上，不必苛责自己，先挑重要的做': '{n} plans did not make it this week. Be kind to yourself and pick the important ones first.',
    '{n} 条周计划过期了，调整一下节奏也完全可以': '{n} weekly plans are overdue — it is perfectly fine to adjust your pace.',
    '过期的 {n} 条里，做完的部分一样算数': 'Of the {n} overdue plans, whatever you already finished still counts.',
    '计划没跟上也没关系，{n} 条过期项，重新排一排就好': 'It is okay that plans slipped. {n} overdue items — just reorder them and start again.',

    // ---------- 天气 ----------
    '后天': 'Day after tomorrow',
    '选择城市': 'Choose city',
    '天气': 'Weather',
    '先填写位置，再查看天气': 'Add a place first to see the weather',
    '正在查询天气…': 'Checking the weather…',
    '没有查到这里的天气，换个更具体的位置试试': 'No weather found for this place — try a more specific name',
    '这篇日记没有保存天气': 'No weather was saved for this entry',
    '天气服务暂时不可用，稍后再试': 'Weather service is unavailable right now. Please try again later.',
    '天气城市': 'Weather city',
    '天气城市已设为 {city}': 'Weather city set to {city}',
    '可以手动选择城市来显示天气。': 'You can choose a city manually for weather.',
    '正在搜索城市…': 'Searching cities…',
    '没有找到这个城市，换个名字试试。': 'No matching city. Try another name.',
    '正在搜索城市或区县…': 'Searching cities and districts…',
    '没有找到匹配的城市或区县，换个名字试试。': 'No matching city or district. Try another name.',
    '搜索失败，请检查网络，已保留原来的城市。': 'Search failed. Check your connection — your current city is unchanged.',
    '搜索其他地点': 'Search other places',
    '正在查询位置…': 'Looking up this place…',
    '没有找到该位置，请用搜索试试。': 'Could not find this place. Try the search instead.',
    '滚轮列表来自应用内置；搜索可查更细的地点。选择只保存在本机，应用不读取设备定位。': 'Search finds cities and districts; pick a result to set your weather city. Your choice stays on this device — the app never reads your location.',
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
    '备份文件': 'Backup files',
    '同意记录': 'Consent record',
    '签名与安装包': 'Signature and installers',
    '协议条款': 'Terms',
    '数据来源': 'Data sources',
    '字体与图标许可': 'Fonts & icons',
    '联系方式': 'Contact',
    '氢计划是一个纯本地的日程与行程工具：日历、条目、计划、行程表和天气。没有账号，也没有服务端。': 'AeroPlan is a fully local schedule and planning tool: calendar, items, plans, timetable and weather. There are no accounts and no server.',
    '条目、计划、分类、设置和同意记录保存在本机：优先 IndexedDB（aeroplan-db），不可用时退回 localStorage。': 'Items, plans, categories, settings and the consent record stay on this device: IndexedDB (aeroplan-db) is preferred, with localStorage as a fallback.',
    '没有服务器，我们不会持有你的数据副本。': 'There is no server, so we hold no copy of your data.',
    '卸载应用或清除应用数据会删除全部本地内容。换机或清理前请先导出备份。': 'Uninstalling the app or clearing its data removes all local content. Export a backup before switching devices or cleaning up.',
    '只有天气与地址搜索会联网。它们发出的是搜索关键词和所选地点的坐标，收件方只有下列服务。': 'Only weather and address search go online. They send search keywords and the coordinates of the place you picked, and only to the services listed below.',
    '天气：只发送所选地点的经纬度（保留 3 位小数，约 100 米精度），发给 Open-Meteo。': 'Weather: sends only the coordinates of the place you selected (three decimal places, roughly 100 m) to Open-Meteo.',
    '城市与地点搜索：只发送你输入的搜索关键词，发给 Photon（基于 OpenStreetMap 数据）。': 'City and place search: sends only the keywords you type to Photon, which uses OpenStreetMap data.',
    '地址搜索：只发送你输入的搜索关键词，发给 Photon。': 'Address search: sends only the keywords you type to Photon.',
    '不会发送日程正文、备注、分类、计划、备份文件内容、账号信息、通讯录、相片，也不会发送设备型号。': 'It does not send event titles, notes, categories, plans, backup contents, account details, contacts, photos or the device model.',
    '所有请求都由设备用 HTTPS 直连上述服务，不经过本项目中转；应用没有统计、广告或崩溃上报 SDK。': 'Every request goes directly from the device to those services over HTTPS and is not proxied by this project. The app has no analytics, ads or crash-reporting SDK.',
    '备份是 JSON 文件，当前未加密，含条目、计划、分类、设置和同意记录。': 'A backup is a JSON file. It is unencrypted and contains items, plans, categories, settings and the consent record.',
    '备份生成后交给系统的保存或分享面板，应用内不留副本，临时文件用完即删。': 'After creation the file goes to the system save or share panel. No copy stays in the app, and temporary files are deleted right after use.',
    '文件可能被网盘、聊天工具或他人看到，请存放到你可信的位置。': 'The file may be seen in cloud drives, chat apps or by other people. Keep it somewhere you trust.',
    '本机尚未记录同意。': 'No consent record on this device yet.',
    '这条记录只存在本机，清除应用数据或卸载会一并删除。': 'This record stays on this device only and is removed when you clear app data or uninstall.',
    '天气与预报：Open-Meteo。请求只包含所选地点的经纬度。': 'Weather and forecast: Open-Meteo. Requests contain only the coordinates of the selected place.',
    '城市与地点搜索：Photon，基于 OpenStreetMap 数据。': 'City and place search: Photon, based on OpenStreetMap data.',
    '官方签名指纹：生成新密钥后填入（见 README）': 'Official signing fingerprint: to be filled after generating the new key (see README)',
    '官方签名指纹：{fp}（可在系统应用信息中核对）': 'Official signing fingerprint: {fp} (check it in the system app info)',
    '从非官方渠道获得、或签名指纹不一致的安装包，可能已被修改，请勿使用。': 'Installers from unofficial channels, or with a different signing fingerprint, may have been modified. Do not use them.',
    '客户端没有「不可破解的加密」：混淆只提高改动成本，真正阻止第三方改包的是系统的签名校验。': 'No client-side encryption here is unbreakable: obfuscation only raises the cost of tampering; what actually stops modified packages is the system signature check.',
    '生效日期：2026-11-07。': 'Effective date: 2026-11-07.',
    '本页内容共同构成使用协议：数据存放、网络请求与数据去向、权限与系统限制、备份文件、同意记录。': 'This page as a whole forms the terms of use: data storage, network requests and data, permissions and system limits, backup files, and the consent record.',
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
    '将删除 {items} 条安排、{plans} 条计划、{cats} 个分类，以及全部设置与本地缓存。\n\n删除后无法恢复，建议先备份。': 'This will delete {items} items, {plans} plans, {cats} categories, all settings and local caches.\n\nThis cannot be undone. Back up first if needed.',
    '删除': 'Delete',
    '已删除所有数据': 'All data deleted',
    '已删除，但未能写入本机': 'Deleted, but could not write to this device',

    // ---------- v0.8.0：黄历 / 关于 ----------
    '黄历': 'Almanac',
    '黄历卡片': 'Almanac card',
    '日历卡片': 'Calendar card',
    '星座': 'Zodiac',
    '选择星座': 'Choose your sign',
    '选中即生效并返回，选择保存在本机。': 'Tap a sign to apply and return. Saved on this device.',
    '运': 'Luck',
    '幸运色': 'Lucky color',
    '幸运数字': 'Lucky number',
    '守护星': 'Ruling planet',
    '宜': 'Good for',
    '忌': 'Avoid',
    '冲煞': 'Clash',
    '值神': 'Day spirit',
    '（黄道）': ' (Auspicious)',
    '（黑道）': ' (Inauspicious)',

    '纯本地的日程与行程工具：日历、议程、行程表、计划、日记、天气与黄历。没有账号，也没有服务端。': 'A fully local schedule and planning tool: calendar, agenda, timetable, plans, journal, weather and almanac. No accounts and no server.',
    '条目、计划、分类、偏好与同意记录只保存在本机：优先 IndexedDB，不可用时退回 localStorage。没有服务器副本。': 'Items, plans, categories, preferences and the consent record stay on this device only: IndexedDB is preferred, with localStorage as a fallback. There is no server copy.',
    '卸载应用会删除全部本地内容；换机前请先导出备份。': 'Uninstalling the app removes all local content. Export a backup before switching devices.',
    '只有天气与地点搜索会联网，且只发送搜索关键词或所选地点的坐标（保留 3 位小数，约 100 米精度）。': 'Only weather and place search go online, sending just your keywords or the coordinates of the selected place (three decimal places, about 100 m).',
    '收件方只有：Open-Meteo（天气）、Photon（地点搜索，基于 OpenStreetMap 数据）。': 'The only recipients are Open-Meteo (weather) and Photon (place search, based on OpenStreetMap data).',
    '不会发送日程正文、备注、分类、备份内容、账号、通讯录、相片或设备型号；应用没有统计、广告或崩溃上报 SDK。': 'No event titles, notes, categories, backup contents, accounts, contacts, photos or device model are sent. The app has no analytics, ads or crash-reporting SDK.',
    '权限与系统限制': 'Permissions and system limits',
    '本应用不提供到点提醒，所有内容仅在本机记录与展示。': 'AeroPlan does not provide due-time reminders; everything is recorded and shown on this device only.',
    '振动：用于轻触反馈，可随时关闭。本版本不申请存储、定位、通知与闹钟权限：备份经系统保存/分享面板完成，导入由你手动选择文件。': 'Vibration: light feedback, can be turned off. This version requests no storage, location, notification or alarm permission: backups use the system save/share panel, and imports use the file you pick manually.',
    '备份是一个未加密的 zip：文字数据压缩，附件按原文件原样放入。请存放在可信位置。': 'A backup is an unencrypted zip: text data is compressed and attachments are stored as original files. Keep it somewhere you trust.',
    '生成后交给系统保存或分享面板，应用内不留副本，临时文件用完即删；文件可能被他人看到，请存放在可信位置。': 'It is handed to the system save/share panel; no copy stays in the app and temporary files are deleted right after use. The file may be seen by others, so keep it somewhere you trust.',
    '数据来源与许可': 'Data sources & licences',
    '天气与预报：Open-Meteo，仅发送所选地点坐标。地点搜索：Photon（OpenStreetMap 数据，版权归贡献者，ODbL）。请求都由设备直达，不经过本项目中转。': 'Weather: Open-Meteo, sent only the selected coordinates. Place search: Photon (OpenStreetMap data, © contributors, ODbL). Requests go directly from the device and are not proxied by this project.',
    '站酷小薇 ZCOOL XiaoWei 与 Cormorant Garamond：SIL Open Font License 1.1；Lucide 图标：ISC License。字体、图标、应用图标与启动图都随应用本地打包，不从网络加载。': 'ZCOOL XiaoWei and Cormorant Garamond: SIL Open Font License 1.1; Lucide icons: ISC License. Fonts, icons, the app icon and splash images are bundled locally and never loaded from the network.',
    '可从设置导出 .zip 备份，并随时导入恢复；备份文件不会上传。': 'Export a .zip backup from Settings and import it back whenever you need; the backup file is never uploaded.',
    '行政区划与区县数据：china-division（MIT License）。': 'Administrative region and district data: china-division (MIT License).',
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
    '搜索行程、地点或分类': 'Search trips, places or categories',
    '搜索历史计划的标题或备注': 'Search past plan titles or notes',
    '没有匹配的安排': 'No matching plans',
    '没有匹配的历史计划': 'No matching past plans',
    '换个关键词试试，或清空搜索。': 'Try another keyword, or clear the search.',
    '周期已变更，计划已移到 {period}': 'Period changed — the plan moved to {period}',
    '那天写了什么': 'What you wrote that day',
    '只记了心情和附件': 'Only a mood and files',
    '这篇只有心情和附件': 'Only a mood and files',
    '无标题日记': 'Untitled diary',
    '还有 {n} 张图片未显示': '{n} more images not shown',
    '{n} 字': '{n} chars',
    '{n} 个标签': '{n} tags',
    '{n} 个附件': '{n} files',
    '已保存': 'Saved',
    '已保存 · {n} 字': 'Saved · {n} chars',
    '今天发生了什么…': 'What happened today…',
    '今天想记什么': 'What would you like to record?',
    '选择位置': 'Choose location',
    '修改位置': 'Change location',
    '使用当前位置': 'Use current location',
    '还没有设置天气位置，请先在日历页选择城市': 'No weather location set yet — pick a city on the calendar page first',
    '不限': 'Any',
    '切换到深色模式': 'Switch to dark mode',
    '切换到浅色模式': 'Switch to light mode',
    '位置': 'Location',
    '具体位置（可选），如街道、店铺、楼栋': 'Specific place (optional): street, shop, building',
    '英文模式下不提供省市滚轮，可用「使用当前位置」或直接在下方填写位置。': 'Region wheels are not available in English mode. Use your current location, or type a place below.',
    '这天已有日记，已进入编辑': 'An entry already exists for that day; opening it for editing',
    '预告': 'Upcoming',
    '正文 / 标签': 'Text / tags',
    '添加视频（单个 80MB）': 'Add video (max 80 MB)',
    '每篇最多 1 个视频': 'One video per entry',
    '视频超过 80MB，无法添加': 'Video exceeds 80 MB',
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
    '附件目录': 'Attachments',
    '共 {n} 个附件': '{n} attachments',
    '已用 {size}': 'Used {size}',
    '{n} 个 · 已用 {size}': '{n} files · {size} used',
    '还没有附件': 'No attachments yet',
    '图片': 'Image',
    '视频': 'Video',
    '文件': 'File',
    '类型': 'Type',
    '体积': 'Size',
    '尺寸': 'Dimensions',
    '时长': 'Duration',
    '所属日记': 'Diary entry',
    '缺失': 'Missing',
    '添加附件': 'Add attachment',
    '添加图片': 'Add image',
    '添加文件': 'Add file',
    '处理中…': 'Processing…',
    '已用 {size} / {limit} · {n} / {max} 个': 'Used {size} / {limit} · {n} of {max} files',
    '正在处理 {done} / {total} 个…': 'Processing {done} of {total}…',
    '删除这篇日记': 'Delete this entry',
    '删除附件': 'Remove attachment',
    '当前环境不支持附件：浏览器数据库（IndexedDB）不可用，日记文字仍会照常保存。': 'Attachments aren\'t available here: the browser database (IndexedDB) is unavailable. Journal text still saves normally.',
    '单篇最多 {n} 个附件': 'Up to {n} files per entry',
    '单篇最多 {n} 个附件，多出的已跳过': 'Up to {n} files per entry; the extras were skipped',
    '有 {n} 个附件超过 80MB，已跳过': '{n} attachments over 80 MB were skipped',
    '这篇日记附件已达 80MB，有 {n} 个已跳过': 'This entry already has 80 MB of attachments; {n} were skipped',
    '本机存储空间不足，附件没能保存，可以先删掉一些旧附件再试': 'Not enough storage on this device, so the attachments couldn\'t be saved. Delete some older attachments and try again.',
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

    // ---------- 备份：zip ----------
    '备份会打包成一个 .zip：文字数据压缩，附件按原始文件原样放入，不重新压缩图片或视频。': 'The backup is packed as a .zip: text data is compressed and attachments are stored as original files — images and videos are not re-encoded.',
    '默认只导出日记文字与附件信息，不包含图片和文件本体。': 'By default only journal text and attachment details are exported — not the images or files themselves.',
    '不含附件（推荐，文件小）': 'Without attachments (recommended, smaller)',
    '只含日记文字与附件信息，恢复后附件列表仍在、文件不在': 'Journal text and attachment details only; after restoring, the list remains but the files don\'t',
    '包含附件（体积大）': 'Include attachments (large)',
    '图片与文件合计约 {size}': 'Images and files total about {size}',
    '图片、视频与文件合计约 {size}': 'Images, videos and files total about {size}',
    '备份约 {size}': 'Backup is about {size}',
    '含视频，备份可能达到数百 MB': 'Includes video; the backup may reach hundreds of MB',
    '导出的是未加密的 JSON 文件，请存到可信位置；视频会让备份达到数百 MB，请确认存储空间充足。': 'The export is an unencrypted file; keep it somewhere trusted. Videos can make the backup hundreds of MB, so check your free space first.',
    '当前没有附件，文件不会变大': 'No attachments, so the file won\'t grow',
    '导出的是未加密的 JSON 文件，请存到可信位置；含附件时体积很大。': 'The export is unencrypted — keep it somewhere you trust. It gets large with attachments.',
    '导出包含附件的备份？': 'Export a backup with attachments?',
    '文件约 {size}，比不含附件大很多；导出的是未加密文件，请存到可信位置。': 'The file will be about {size}, much larger than without attachments. It\'s unencrypted; keep it somewhere you trust.',
    '文件约 {size}，附件按原文件原样打包进 zip，体积接近原始大小；导出的是未加密文件，请存到可信位置。': 'The file will be about {size}; attachments are stored in the zip exactly as they are, so the size stays close to the originals. It is unencrypted, so keep it somewhere you trust.',
    '继续导出': 'Continue',
    '当前环境读不到附件，备份只包含日记文字与附件信息': 'Attachments can\'t be read in this environment, so the backup contains journal text and attachment details only.',
    '当前没有附件，已导出不含附件的备份': 'There are no attachments, so a backup without attachments was exported.',
    '条目、计划、分类、日记、偏好与同意记录只保存在本机：优先 IndexedDB，不可用时退回 localStorage。没有服务器副本。': 'Items, plans, categories, journal entries, preferences and consent records stay on this device: IndexedDB first, with localStorage as a fallback. There is no server copy.',
    '日记里的图片与文件只存进本应用自己的 IndexedDB，不写入相册、不申请存储权限、不联网、不做云端同步。IndexedDB 不可用时，日记文字仍可保存，附件功能会提示「当前环境不支持附件」。': 'Images and files in the journal go only into this app\'s own IndexedDB — not to Photos, with no storage permission, no network, and no cloud sync. When IndexedDB is unavailable, journal text still saves and attachments show "not supported here".',
    '备份是一个未加密的 zip：backup.json 存条目、计划、分类、日记、偏好与同意记录，附件按原文件原样放在 attachments/ 里。': 'A backup is an unencrypted zip: backup.json holds items, plans, categories, journal entries, preferences and the consent record, while attachments keep their original bytes under attachments/.',
    '默认备份不含附件本体，只有文件名、大小与类型；需要连图片一起带走时，在「备份数据」弹窗里选择「包含附件」，打包时会显示逐个附件的进度。': 'By default a backup has no attachment bodies — only names, sizes and types. To take the images along, choose "Include attachments" in the Backup dialog; packing shows per-attachment progress.',
    'zip 只是去掉 base64 膨胀并压缩文字，照片和视频本身不会变小；文件未加密，请妥善保管。': 'The zip only removes base64 inflation and compresses text — photos and videos themselves do not get smaller. The file is unencrypted, so keep it safe.',
    'zip 只是去掉 base64 膨胀并压缩文字，照片本身不会变小；文件未加密，请存到可信位置。': 'The zip only removes base64 inflation and compresses text — the photos themselves do not get smaller. The file is unencrypted, so keep it somewhere you trust.',
    'zip 只是去掉 base64 膨胀并压缩文字，照片和视频本身不会变小；文件未加密，请存到可信位置。': 'The zip only removes base64 inflation and compresses text — photos and videos themselves do not get smaller. The file is unencrypted, so keep it somewhere you trust.',
    '备份文件中的日记为明文，含附件时体积很大，请妥善保管。': 'Journal entries in a backup are plain text, and the file gets large with attachments — please keep it safe.',

    // ---------- 备份打包进度 ----------
    '正在打包备份': 'Packing backup',
    '请勿关闭或退出应用': 'Please don\'t close or leave the app',
    '已处理 {done} / {total} 个附件': 'Processed {done} / {total} attachments',
    '正在整理数据…': 'Preparing data…',
    '正在写入备份文件…': 'Writing backup file…',
    '备份打包失败': 'Backup failed',
    '数据没有变化，可以稍后重试。': 'Your data is unchanged; please try again later.',
    '备份打包失败，请重试': 'Backup failed — please try again',
    '导入失败：压缩包损坏或缺少 backup.json': 'Import failed: the archive is damaged or has no backup.json',

    // ---------- v0.9.3：更多页 / 计划进度 / 倒数日 / 自定义情绪 ----------
    '更多': 'More',
    '卡片样式': 'Card style',
    '外观': 'Appearance',
    '当前样式': 'Current style',
    '点选立即全局生效，并保存在本机。': 'Tap one to apply it everywhere. Your choice is saved on this device.',
    '带「仅浅色 / 仅深色」标记的皮肤只在对应主题下生效。': 'Skins marked “Light only” or “Dark only” apply in that theme only.',
    '仅浅色': 'Light only',
    '仅深色': 'Dark only',
    '通用': 'Universal',
    '浅色模式': 'light mode',
    '「{name}」只在{mode}生效，当前卡片使用默认样式；切回{mode}会自动恢复。': '“{name}” only applies in {mode}. Default cards are used meanwhile, and it comes back automatically when you switch back.',
    '默认': 'Default',
    '进度视觉': 'Progress style',
    '进度条': 'Bar',
    '能量格': 'Cells',
    '环形': 'Ring',
    '百分数': 'Percent',
    '月相': 'Moon phase',
    '目标次数': 'Target count',
    '每点一次记一次；填 1 就是一次性计划': 'Each tap counts one; set 1 for a one-off plan',
    '减少目标次数': 'Decrease target',
    '增加目标次数': 'Increase target',
    '记一次完成': 'Count one',
    '记一次': 'Add one',
    '撤销一次': 'Undo one',
    '重置': 'Reset',
    '进度': 'Progress',
    '目标已达成': 'Target reached',
    '目标达成 · {title}': 'Target reached · {title}',
    '目标已达成，可在计划详情里重置': 'Target reached. You can reset it in the plan details.',
    '已撤销一次': 'One undone',
    '进度已重置': 'Progress reset',
    '周、月、年分开看，长线目标也有进度。': 'Week, month and year apart — long-term goals get progress too.',
    '全部行程': 'All trips',
    '历史与未来，连续往下看': 'Past and upcoming, in one continuous list',
    '纪念日': 'Anniversaries',
    '日期类型': 'Date type',
    '公历': 'Solar',
    '农历': 'Lunar calendar',
    '计算方式': 'Counting',
    '倒数': 'Countdown',
    '正数': 'Count up',
    '不重复': 'No repeat',
    '农历年份（锚点）': 'Lunar year (anchor)',
    '闰月': 'Leap month',
    '农历 {d}': 'Lunar {d}',
    '下次 {d}': 'Next {d}',
    '自 {y} 年以来': 'Since {y}',
    '已经 {n} 年': '{n} years',
    '距上次 {n} 天': '{n} days since last',
    '日期超出范围': 'Date out of range',
    '公历 {d}': 'Solar {d}',
    '该农历月只有 {n} 天，请改选': 'That lunar month has only {n} days — choose another day',
    '该年没有闰月': 'No leap month that year',
    '该年没有闰{r}月': 'No leap month {r} that year',
    '该年无闰月': 'No leap month that year',
    '该年闰{r}月': 'Leap month {r} that year',
    '年份需在 1900–2100 之间': 'Year must be between 1900 and 2100',
    '农历日期超出 1900–2100 范围': 'Lunar date out of the 1900–2100 range',
    '农历暂不支持每月重复': 'Monthly repeat is not available for lunar dates',
    '新建纪念日': 'New anniversary',
    '编辑纪念日': 'Edit anniversary',
    '目标日期': 'Target date',
    '颜色': 'Colour',
    '颜色 {c}': 'Colour {c}',
    '置顶': 'Pin to top',
    '天后': 'days to go',
    '天前': 'days ago',
    '就是今天': "It's today",
    '还有': 'to go',
    '已经': 'already',
    '还有 {n} 天': '{n} days to go',
    '已过 {n} 天': '{n} days past',
    '已经 {n} 天': '{n} days since',
    '全选': 'Select all',
    '标签管理': 'Tag management',
    '分类标签': 'Category tags',
    '还没有分类标签': 'No category tags yet',
    '点右上角新建，给安排分个类。': 'Tap New in the top corner to group your entries.',
    '行程标签管理': 'Trip tags',
    '情绪标签': 'Mood tags',
    '情绪标签管理': 'Mood tags',
    '分享长图': 'Share as image',
    '图片列数': 'Image columns',
    '1 列': '1 col',
    '2 列': '2 cols',
    '3 列': '3 cols',
    '长按图片保存到相册': 'Long-press the image to save',
    '点按「保存图片」或长按图片保存到相册': 'Tap "Save image", or long-press the image to save',
    '保存图片': 'Save image',
    '保存或分享图片': 'Save or share image',
    '还没有纪念日': 'No anniversaries yet',
    '新建一个，记住重要的日子。': 'Add one to remember a day that matters.',
    '例如：生日、考试、旅行': 'e.g. birthday, exam, trip',
    '请填写名称和日期': 'Enter a name and a date',
    '已添加纪念日': 'Anniversary added',
    '纪念日已更新': 'Anniversary updated',
    '已删除纪念日': 'Anniversary deleted',
    '纪念日保存失败，请重试': 'Couldn\'t save the anniversary. Please try again.',
    '删除纪念日「{name}」？': 'Delete anniversary “{name}”?',
    '删除后不可恢复': 'This can\'t be undone.',
    '自定义情绪': 'Custom moods',
    '新建情绪': 'New mood',
    '编辑情绪': 'Edit mood',
    '删除情绪': 'Delete mood',
    '还没有自定义情绪': 'No custom moods yet',
    '点右上角新建，给情绪起个自己的名字。': 'Tap New in the top corner and give a mood your own name.',
    '请填写情绪名称': 'Enter a mood name',
    '名称最多 12 个字': 'Name can be at most 12 characters',
    '这个名称已经用过了': 'That name is already in use',
    '情绪已更新': 'Mood updated',
    '已添加情绪': 'Mood added',
    '已删除情绪': 'Mood deleted',
    '删除情绪「{name}」？': 'Delete the mood "{name}"?',
    '引用它的日记会清空心情，其他内容保留': 'Journal entries using it keep their content but lose the mood',
    '按住可拖动排序，长按可编辑或删除': 'Press and drag to reorder; press and hold to edit or delete',
    '按住可拖动排序，长按可编辑或删除。自定义情绪会出现在日记的情绪条里。': 'Press and drag to reorder; press and hold to edit or delete. Custom moods show up in the journal mood row.',
    '＋ 新建': '+ New',

    // ---------- v0.9.8：计划历史 / 过期标记 / 周期分段 ----------
    '历史计划': 'Plan history',
    '计划周期': 'Plan period',
    '已过期': 'Overdue',
    '暂无未来的计划': 'No upcoming plans yet',
    '未来的周 / 月 / 年计划会显示在这里。': 'Upcoming weekly, monthly and yearly plans appear here.',

    // ---------- 安装包说明 ----------
    '保存失败：未能写入本机': 'Save failed: nothing was written to this device',
    '这是 AeroPlan 的新安装包（com.aeroplan.app）。如需保留旧数据，请先在旧版「设置 → 备份数据」导出，再在本版「恢复数据」导入；新旧包名不同，不能直接覆盖升级。': 'This is the new AeroPlan package (com.aeroplan.app). To keep old data, export a backup from the old version (Settings → Backup data) and restore it here; the package name changed, so it cannot update the old app in place.',

    // ---------- 年历 / 捏合手势 / 日历提示 ----------
    '左右滑动切换年份 · 捏合或返回回到月历': 'Swipe to change years · Pinch or go back to the month view',
    '日历卡片内容': 'Calendar card content',
    '视图': 'Views',

    // ---------- 省市区县选择 ----------
    '省': 'Province',
    '市': 'City',
    '区/县': 'District',
    '省份': 'Province',
    '城市': 'City',
    '选择省市': 'Choose region',
    '省市区县列表来自应用内置，完全离线，不联网、不定位、不上传。': 'The region list is built into the app: fully offline, no network, no location, nothing uploaded.',

    // ---------- 农历 / 样式 / 通用按钮与提示 ----------
    '农历日期': 'Lunar date',
    '农历年份': 'Lunar year',
    '农历月份': 'Lunar month',
    '农历日': 'Lunar day',
    '心情': 'Mood',
    '样式筛选': 'Style filter',
    '和纸': 'Washi',
    '图标': 'Icon',
    '添加': 'Add',
    '清除': 'Clear',
    '纯本地的日程与行程工具：日历、计划、行程表、日记、纪念日、天气与黄历。没有账号，也没有服务端。': 'A fully local schedule and planning tool: calendar, plans, timetable, journal, anniversaries, weather and almanac. No accounts and no server.',
    '按住可拖动排序，长按可编辑或删除。标签颜色会用在名称文字上。': 'Press and drag to reorder; press and hold to edit or delete. Tag colors are used for the name text.',

    // ---------- 历史计划空态 / 日记写作与分类标签页的动态文案 ----------
    '还没有历史计划': 'No past plans yet',
    '过去的周 / 月 / 年计划会归档在这里。': 'Past weekly, monthly and yearly plans are archived here.',
    '自定义': 'Custom',
    '默认色点': 'Default color dot',
    '更多信息': 'More info',

    // ---------- 天气：加载中 / 拉取失败 / 地区不支持 ----------
    '更新于 {time}': 'Updated {time}',
    '更新于 {time} · 可能已过期': 'Updated {time} · may be out of date',
    '正在获取天气…': 'Getting the weather…',
    '天气暂时获取不到': 'Weather is unavailable right now',
    '该地区暂不支持天气': 'Weather is not available for this area',
    '重试': 'Retry',
    '日记保存失败，请重试': 'Could not save the journal entry. Try again.',
    '当前环境不支持附件，备份里的附件没有还原': 'Attachments are not supported here; attachments in the backup were not restored.',
    '将删除 {items} 条安排、{plans} 条计划、{diary} 篇日记、{cats} 个分类，以及全部设置与本地缓存。\n\n删除后无法恢复，建议先备份。': 'This will delete {items} items, {plans} plans, {diary} journal entries and {cats} categories, plus all settings and local cache.\n\nThis cannot be undone — back up first.'
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
