import type { Move } from '../../../types';
import { AILMENT_ZH, STAT_ZH } from './battleText';

export function isChineseBattleLog(language?: string) {
  return language?.startsWith('zh') ?? false;
}

export function battleLine(language: string | undefined, english: string, chinese: string) {
  return isChineseBattleLog(language) ? chinese : english;
}

export function battleMoveName(move: Move | null | undefined, language?: string) {
  if (!move) return '';
  return isChineseBattleLog(language) ? (move.zhName || move.name) : move.name;
}

export function battleAilmentName(statusId: string, language?: string) {
  if (isChineseBattleLog(language)) {
    const additional: Record<string, string> = {
      bad_poison: '剧毒', taunt: '挑衅', torment: '无理取闹', disable: '定身法',
      encore: '再来一次', heal_block: '回复封锁', attract: '着迷',
    };
    return additional[statusId] ?? AILMENT_ZH[statusId] ?? statusId;
  }
  const english: Record<string, string> = {
    bad_poison: 'bad poison',
    paralysis: 'paralysis',
    burn: 'burn',
    freeze: 'freeze',
    sleep: 'sleep',
    confusion: 'confusion',
    infatuation: 'infatuation',
    poison: 'poison',
  };
  return english[statusId] ?? statusId.replace(/_/g, ' ');
}

export function battleStatName(statId: string, language?: string) {
  if (isChineseBattleLog(language)) return STAT_ZH[statId] ?? statId;
  const english: Record<string, string> = {
    attack: 'Attack',
    defense: 'Defense',
    spAtk: 'Special Attack',
    spDef: 'Special Defense',
    speed: 'Speed',
    accuracy: 'Accuracy',
    evasion: 'Evasion',
  };
  return english[statId] ?? statId;
}

const HELD_ITEM_ZH: Record<string, string> = {
  bright_powder: '光粉', kings_rock: '王者之证', leftovers: '吃剩的东西', quick_claw: '先制之爪',
  scope_lens: '焦点镜', shell_bell: '贝壳之铃', sitrus_berry: '文柚果', lum_berry: '木子果',
  cheri_berry: '樱子果', chesto_berry: '零余果', pecha_berry: '桃桃果', rawst_berry: '莓莓果',
  persim_berry: '柿仔果', liechi_berry: '枝荔果', petaya_berry: '龙睛果', salac_berry: '沙鳞果',
  lax_incense: '悠闲薰香', charcoal: '木炭', mystic_water: '神秘水滴', magnet: '磁铁',
  black_belt: '黑带', poison_barb: '毒针', never_melt_ice: '不融冰', twisted_spoon: '弯曲的汤匙',
  hard_stone: '硬石头', sharp_beak: '锐利鸟嘴', silver_powder: '银粉', metal_coat: '金属膜',
  miracle_seed: '奇迹种子', soft_sand: '柔软沙子', black_glasses: '黑色眼镜', silk_scarf: '丝绸围巾',
  choice_band: '讲究头带', focus_band: '气势头带', white_herb: '白色香草', mental_herb: '心灵香草',
  thick_club: '粗骨头', leek: '大葱', deep_sea_scale: '深海鳞片', leppa_berry: '苹野果',
};

export function battleHeldItemName(itemId: string | undefined, englishName: string, language?: string) {
  if (!isChineseBattleLog(language)) return englishName;
  const normalized = (itemId ?? '').toLowerCase().replace(/-/g, '_');
  return HELD_ITEM_ZH[normalized] ?? (normalized.replace(/_/g, ' ') || '携带道具');
}

export type BattleItemMessageKind = 'cure' | 'heal' | 'stat' | 'restoreStats' | 'mentalCure';

export function battleItemMessage(
  language: string | undefined,
  kind: BattleItemMessageKind,
  name: string,
  item: string,
  detail = '',
) {
  switch (kind) {
    case 'cure':
      return battleLine(language, `${name} cured its ${detail} with ${item}!`, `${name}使用${item}治好了${detail}！`);
    case 'heal':
      return battleLine(language, `${name} restored HP with ${item}!`, `${name}使用${item}恢复了体力！`);
    case 'stat':
      return battleLine(language, `${name}'s ${detail} rose with ${item}!`, `${name}使用${item}，${detail}提高了！`);
    case 'restoreStats':
      return battleLine(language, `${name} restored its lowered stats with ${item}!`, `${name}使用${item}恢复了降低的能力！`);
    case 'mentalCure':
      return battleLine(language, `${name} recovered from ${detail} with ${item}!`, `${name}使用${item}解除了${detail}！`);
  }
}
