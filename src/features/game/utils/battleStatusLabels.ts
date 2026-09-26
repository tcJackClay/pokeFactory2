import type { KnownVolatileStatus, NonVolatileStatus } from '../../../types';
import { normalizeBattleStatusId } from './battleStatus';

const STATUS_LABELS: Record<NonVolatileStatus | KnownVolatileStatus, { zh: string; en: string }> = {
  sleep: { zh: '睡眠', en: 'Asleep' },
  poison: { zh: '中毒', en: 'Poisoned' },
  bad_poison: { zh: '剧毒', en: 'Badly Poisoned' },
  burn: { zh: '灼伤', en: 'Burned' },
  paralysis: { zh: '麻痹', en: 'Paralyzed' },
  freeze: { zh: '冰冻', en: 'Frozen' },
  confusion: { zh: '混乱', en: 'Confused' },
  flinch: { zh: '畏缩', en: 'Flinched' },
  attract: { zh: '着迷', en: 'Infatuated' },
  infatuation: { zh: '着迷', en: 'Infatuated' },
  taunt: { zh: '挑衅', en: 'Taunted' },
  encore: { zh: '再来一次', en: 'Encored' },
  torment: { zh: '无理取闹', en: 'Tormented' },
  disable: { zh: '定身法', en: 'Disabled' },
  nightmare: { zh: '恶梦', en: 'Nightmare' },
  curse: { zh: '诅咒', en: 'Cursed' },
  yawn: { zh: '瞌睡', en: 'Drowsy' },
  uproar: { zh: '大闹', en: 'Uproar' },
  protect: { zh: '守住', en: 'Protected' },
  substitute: { zh: '替身', en: 'Substitute' },
  safeguard: { zh: '神秘守护', en: 'Safeguard' },
  reflect: { zh: '反射壁', en: 'Reflect' },
  light_screen: { zh: '光墙', en: 'Light Screen' },
  crit_boost: { zh: '聚气', en: 'Focus Energy' },
  foresight: { zh: '识破', en: 'Identified' },
  seeded: { zh: '寄生种子', en: 'Leech Seed' },
  trapped: { zh: '束缚', en: 'Trapped' },
  perish_song: { zh: '灭亡之歌', en: 'Perish Song' },
  ingrain: { zh: '扎根', en: 'Ingrain' },
};

const EXTRA_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  flash_fire: { zh: '引火', en: 'Flash Fire' },
  defense_curl: { zh: '变圆', en: 'Defense Curl' },
  minimized: { zh: '变小', en: 'Minimized' },
};

export function getBattleStatusLabel(statusId: string, language: string): string {
  const normalized = normalizeBattleStatusId(statusId);
  const labels = STATUS_LABELS[normalized as NonVolatileStatus | KnownVolatileStatus]
    ?? EXTRA_STATUS_LABELS[normalized];
  if (labels) return language.startsWith('zh') ? labels.zh : labels.en;
  if (language.startsWith('zh')) return '特殊状态';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Status Effect';
}
