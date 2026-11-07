// 通知渠道参数的单一校验入口：本地与 CI 共用，避免构建脚本和 app.js 各说各话。
// 直接运行：node scripts/notify-config.mjs（参数不对时退出码为 1）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function readNotifyConfig(root) {
  const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const pick = function (re) {
    return (src.match(re) || [])[1] || '';
  };
  return {
    channelId: pick(/const REMIND_CHANNEL_ID = '([^']+)'/),
    legacyChannelId: pick(/const REMIND_CHANNEL_LEGACY_ID = '([^']+)'/),
    importance: Number(pick(/const REMIND_CHANNEL_IMPORTANCE = (\d+)/) || 0),
    smallIcon: pick(/const REMIND_SMALL_ICON = '([^']+)'/),
    sound: pick(/const REMIND_SOUND = '([^']+)'/)
  };
}

export function validateNotifyConfig(cfg) {
  const problems = [];
  if (!cfg.channelId) problems.push('app.js 里没有找到 REMIND_CHANNEL_ID');
  if (!cfg.legacyChannelId) problems.push('app.js 里没有找到 REMIND_CHANNEL_LEGACY_ID');
  if (cfg.importance !== 5) problems.push('渠道重要性不是 5，通知不会弹横幅');
  if (cfg.smallIcon !== 'ic_stat_icon') problems.push('通知小图标名不是 ic_stat_icon');
  if (cfg.sound !== 'qingjihua_notify') problems.push('提示音名不是 qingjihua_notify');
  return problems;
}

export function printNotifyConfig(cfg) {
  console.log('--- 通知渠道参数（取自 app.js）---');
  console.log('  渠道 id：' + (cfg.channelId || '缺失'));
  console.log('  旧渠道 id（启动时尝试删除）：' + (cfg.legacyChannelId || '未设置'));
  console.log('  重要性：' + cfg.importance + '（5 = HIGH，会横幅弹出）');
  console.log('  锁屏可见：yes · 振动：yes');
  console.log('  小图标：' + (cfg.smallIcon || '缺失') + ' · 提示音：res/raw/' + (cfg.sound || '缺失'));
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = readNotifyConfig(root);
  printNotifyConfig(cfg);
  const problems = validateNotifyConfig(cfg);
  if (problems.length) {
    console.error('通知渠道参数校验失败：' + problems.join('；'));
    process.exit(1);
  }
}
