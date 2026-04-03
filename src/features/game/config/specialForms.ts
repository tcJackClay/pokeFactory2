export type SpecialFormRequirement =
  | 'DIRECT'
  | 'HOLD_ITEM'
  | 'BATTLE_MEGA'
  | 'BATTLE_DYNAMAX_GMAX'
  | 'BATTLE_TERA'
  | 'BATTLE_ABILITY'
  | 'EVENT_ONLY';

export interface SpecialFormEntry {
  key: string;
  pokeApiName: string;
  gen: number;
  requirement: SpecialFormRequirement;
  notesZh: string;
  weight?: number;
}

// 这些形态可以作为“额外形态池”参与随机（DIRECT / HOLD_ITEM）。
// 需要战斗流程触发（如 Mega / 极巨 / 太晶 / 特性战斗变身）的形态不放入直接抽取池。
export const SPECIAL_FORM_CATALOG: SpecialFormEntry[] = [
  { key: 'UNOWN_B', pokeApiName: 'unown-b', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_C', pokeApiName: 'unown-c', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_D', pokeApiName: 'unown-d', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_E', pokeApiName: 'unown-e', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_F', pokeApiName: 'unown-f', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_G', pokeApiName: 'unown-g', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_H', pokeApiName: 'unown-h', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_I', pokeApiName: 'unown-i', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_J', pokeApiName: 'unown-j', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_K', pokeApiName: 'unown-k', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_L', pokeApiName: 'unown-l', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_M', pokeApiName: 'unown-m', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_N', pokeApiName: 'unown-n', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_O', pokeApiName: 'unown-o', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_P', pokeApiName: 'unown-p', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_Q', pokeApiName: 'unown-q', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_R', pokeApiName: 'unown-r', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_S', pokeApiName: 'unown-s', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_T', pokeApiName: 'unown-t', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_U', pokeApiName: 'unown-u', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_V', pokeApiName: 'unown-v', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_W', pokeApiName: 'unown-w', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_X', pokeApiName: 'unown-x', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_Y', pokeApiName: 'unown-y', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_Z', pokeApiName: 'unown-z', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾字母形态', weight: 1 },
  { key: 'UNOWN_EXCLAMATION', pokeApiName: 'unown-exclamation', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾感叹号形态', weight: 1 },
  { key: 'UNOWN_QUESTION', pokeApiName: 'unown-question', gen: 2, requirement: 'DIRECT', notesZh: '未知图腾问号形态', weight: 1 },

  { key: 'DEOXYS_ATTACK', pokeApiName: 'deoxys-attack', gen: 3, requirement: 'DIRECT', notesZh: '代欧奇希斯形态切换' },
  { key: 'DEOXYS_DEFENSE', pokeApiName: 'deoxys-defense', gen: 3, requirement: 'DIRECT', notesZh: '代欧奇希斯形态切换' },
  { key: 'DEOXYS_SPEED', pokeApiName: 'deoxys-speed', gen: 3, requirement: 'DIRECT', notesZh: '代欧奇希斯形态切换' },
  { key: 'CASTFORM_SUNNY', pokeApiName: 'castform-sunny', gen: 3, requirement: 'BATTLE_ABILITY', notesZh: '战斗天气触发，不应直接抽取' },
  { key: 'CASTFORM_RAINY', pokeApiName: 'castform-rainy', gen: 3, requirement: 'BATTLE_ABILITY', notesZh: '战斗天气触发，不应直接抽取' },
  { key: 'CASTFORM_SNOWY', pokeApiName: 'castform-snowy', gen: 3, requirement: 'BATTLE_ABILITY', notesZh: '战斗天气触发，不应直接抽取' },

  { key: 'WORMADAM_SANDY', pokeApiName: 'wormadam-sandy', gen: 4, requirement: 'DIRECT', notesZh: '结草儿进化分支形态' },
  { key: 'WORMADAM_TRASH', pokeApiName: 'wormadam-trash', gen: 4, requirement: 'DIRECT', notesZh: '结草儿进化分支形态' },
  { key: 'ROTOM_HEAT', pokeApiName: 'rotom-heat', gen: 4, requirement: 'DIRECT', notesZh: '洛托姆家电形态' },
  { key: 'ROTOM_WASH', pokeApiName: 'rotom-wash', gen: 4, requirement: 'DIRECT', notesZh: '洛托姆家电形态' },
  { key: 'ROTOM_FROST', pokeApiName: 'rotom-frost', gen: 4, requirement: 'DIRECT', notesZh: '洛托姆家电形态' },
  { key: 'ROTOM_FAN', pokeApiName: 'rotom-fan', gen: 4, requirement: 'DIRECT', notesZh: '洛托姆家电形态' },
  { key: 'ROTOM_MOW', pokeApiName: 'rotom-mow', gen: 4, requirement: 'DIRECT', notesZh: '洛托姆家电形态' },
  { key: 'GIRATINA_ORIGIN', pokeApiName: 'giratina-origin', gen: 4, requirement: 'HOLD_ITEM', notesZh: '需携带白金宝珠（对战表现）' },
  { key: 'SHAYMIN_SKY', pokeApiName: 'shaymin-sky', gen: 4, requirement: 'DIRECT', notesZh: '谢米天空形态' },

  { key: 'BASCULIN_BLUE_STRIPED', pokeApiName: 'basculin-blue-striped', gen: 5, requirement: 'DIRECT', notesZh: '野生可遇见形态' },
  { key: 'DARMANITAN_ZEN', pokeApiName: 'darmanitan-zen', gen: 5, requirement: 'BATTLE_ABILITY', notesZh: '达摩模式，战斗特性触发' },
  { key: 'TORNADUS_THERIAN', pokeApiName: 'tornadus-therian', gen: 5, requirement: 'DIRECT', notesZh: '化身/灵兽切换形态' },
  { key: 'THUNDURUS_THERIAN', pokeApiName: 'thundurus-therian', gen: 5, requirement: 'DIRECT', notesZh: '化身/灵兽切换形态' },
  { key: 'LANDORUS_THERIAN', pokeApiName: 'landorus-therian', gen: 5, requirement: 'DIRECT', notesZh: '化身/灵兽切换形态' },
  { key: 'KYUREM_BLACK', pokeApiName: 'kyurem-black', gen: 5, requirement: 'EVENT_ONLY', notesZh: '需合体流程（DNA楔子）' },
  { key: 'KYUREM_WHITE', pokeApiName: 'kyurem-white', gen: 5, requirement: 'EVENT_ONLY', notesZh: '需合体流程（DNA楔子）' },
  { key: 'KELDEO_RESOLUTE', pokeApiName: 'keldeo-resolute', gen: 5, requirement: 'DIRECT', notesZh: '凯路迪欧觉悟形态' },
  { key: 'MELOETTA_PIROUETTE', pokeApiName: 'meloetta-pirouette', gen: 5, requirement: 'BATTLE_ABILITY', notesZh: '战斗招式触发形态切换' },

  { key: 'MEOWSTIC_FEMALE', pokeApiName: 'meowstic-female', gen: 6, requirement: 'DIRECT', notesZh: '雌雄差异形态' },
  { key: 'AEGISLASH_BLADE', pokeApiName: 'aegislash-blade', gen: 6, requirement: 'BATTLE_ABILITY', notesZh: '战斗招式触发形态切换' },
  { key: 'PUMPKABOO_SMALL', pokeApiName: 'pumpkaboo-small', gen: 6, requirement: 'DIRECT', notesZh: '尺寸形态' },
  { key: 'PUMPKABOO_LARGE', pokeApiName: 'pumpkaboo-large', gen: 6, requirement: 'DIRECT', notesZh: '尺寸形态' },
  { key: 'PUMPKABOO_SUPER', pokeApiName: 'pumpkaboo-super', gen: 6, requirement: 'DIRECT', notesZh: '尺寸形态' },
  { key: 'GOURGEIST_SMALL', pokeApiName: 'gourgeist-small', gen: 6, requirement: 'DIRECT', notesZh: '尺寸形态' },
  { key: 'GOURGEIST_LARGE', pokeApiName: 'gourgeist-large', gen: 6, requirement: 'DIRECT', notesZh: '尺寸形态' },
  { key: 'GOURGEIST_SUPER', pokeApiName: 'gourgeist-super', gen: 6, requirement: 'DIRECT', notesZh: '尺寸形态' },
  { key: 'HOOPA_UNBOUND', pokeApiName: 'hoopa-unbound', gen: 6, requirement: 'EVENT_ONLY', notesZh: '需惩戒之壶流程' },

  { key: 'ORICORIO_POM_POM', pokeApiName: 'oricorio-pom-pom', gen: 7, requirement: 'DIRECT', notesZh: '花舞鸟风格形态' },
  { key: 'ORICORIO_PAU', pokeApiName: 'oricorio-pau', gen: 7, requirement: 'DIRECT', notesZh: '花舞鸟风格形态' },
  { key: 'ORICORIO_SENSU', pokeApiName: 'oricorio-sensu', gen: 7, requirement: 'DIRECT', notesZh: '花舞鸟风格形态' },
  { key: 'LYCANROC_MIDNIGHT', pokeApiName: 'lycanroc-midnight', gen: 7, requirement: 'DIRECT', notesZh: '鬃岩狼人形态' },
  { key: 'LYCANROC_DUSK', pokeApiName: 'lycanroc-dusk', gen: 7, requirement: 'DIRECT', notesZh: '鬃岩狼人形态' },
  { key: 'WISHIWASHI_SCHOOL', pokeApiName: 'wishiwashi-school', gen: 7, requirement: 'BATTLE_ABILITY', notesZh: '鱼群形态，战斗触发' },
  { key: 'MIMIKYU_BUSTED', pokeApiName: 'mimikyu-busted', gen: 7, requirement: 'BATTLE_ABILITY', notesZh: '画皮破裂，战斗触发' },
  { key: 'NECROZMA_DUSK', pokeApiName: 'necrozma-dusk', gen: 7, requirement: 'EVENT_ONLY', notesZh: '需奈克洛索尔合体器' },
  { key: 'NECROZMA_DAWN', pokeApiName: 'necrozma-dawn', gen: 7, requirement: 'EVENT_ONLY', notesZh: '需奈克洛露奈合体器' },
  { key: 'NECROZMA_ULTRA', pokeApiName: 'necrozma-ultra', gen: 7, requirement: 'BATTLE_TERA', notesZh: '战斗中通过Z招式流程触发' },

  { key: 'TOXTRICITY_LOW_KEY', pokeApiName: 'toxtricity-low-key', gen: 8, requirement: 'DIRECT', notesZh: '高调/低调形态' },
  { key: 'INDEEDEE_FEMALE', pokeApiName: 'indeedee-female', gen: 8, requirement: 'DIRECT', notesZh: '雌雄差异形态' },
  { key: 'EISCUE_NOICE', pokeApiName: 'eiscue-noice', gen: 8, requirement: 'BATTLE_ABILITY', notesZh: '结冻头变形，战斗触发' },
  { key: 'MORPEKO_HANGRY', pokeApiName: 'morpeko-hangry', gen: 8, requirement: 'BATTLE_ABILITY', notesZh: '气场轮流，战斗触发' },
  { key: 'ZACIAN_CROWNED', pokeApiName: 'zacian-crowned', gen: 8, requirement: 'HOLD_ITEM', notesZh: '需腐朽之剑' },
  { key: 'ZAMAZENTA_CROWNED', pokeApiName: 'zamazenta-crowned', gen: 8, requirement: 'HOLD_ITEM', notesZh: '需腐朽之盾' },
  { key: 'URSHIFU_RAPID_STRIKE', pokeApiName: 'urshifu-rapid-strike', gen: 8, requirement: 'DIRECT', notesZh: '一击/连击形态' },
  { key: 'CALYREX_ICE', pokeApiName: 'calyrex-ice', gen: 8, requirement: 'EVENT_ONLY', notesZh: '需灵幽马合体' },
  { key: 'CALYREX_SHADOW', pokeApiName: 'calyrex-shadow', gen: 8, requirement: 'EVENT_ONLY', notesZh: '需雪暴马合体' },
  { key: 'ENAMORUS_THERIAN', pokeApiName: 'enamorus-therian', gen: 8, requirement: 'DIRECT', notesZh: '化身/灵兽切换形态' },

  { key: 'TAUROS_PALDEA_COMBAT', pokeApiName: 'tauros-paldea-combat-breed', gen: 9, requirement: 'DIRECT', notesZh: '帕底亚肯泰罗形态' },
  { key: 'TAUROS_PALDEA_BLAZE', pokeApiName: 'tauros-paldea-blaze-breed', gen: 9, requirement: 'DIRECT', notesZh: '帕底亚肯泰罗形态' },
  { key: 'TAUROS_PALDEA_AQUA', pokeApiName: 'tauros-paldea-aqua-breed', gen: 9, requirement: 'DIRECT', notesZh: '帕底亚肯泰罗形态' },
  { key: 'WOOPER_PALDEA', pokeApiName: 'wooper-paldea', gen: 9, requirement: 'DIRECT', notesZh: '地区形态' },
  { key: 'MAUSHOLD_THREE', pokeApiName: 'maushold-family-of-three', gen: 9, requirement: 'DIRECT', notesZh: '一家鼠稀有形态' },
  { key: 'SQUAWKABILLY_BLUE', pokeApiName: 'squawkabilly-blue-plumage', gen: 9, requirement: 'DIRECT', notesZh: '怒鹦哥羽色形态' },
  { key: 'SQUAWKABILLY_YELLOW', pokeApiName: 'squawkabilly-yellow-plumage', gen: 9, requirement: 'DIRECT', notesZh: '怒鹦哥羽色形态' },
  { key: 'SQUAWKABILLY_WHITE', pokeApiName: 'squawkabilly-white-plumage', gen: 9, requirement: 'DIRECT', notesZh: '怒鹦哥羽色形态' },
  { key: 'PALAFIN_HERO', pokeApiName: 'palafin-hero', gen: 9, requirement: 'BATTLE_ABILITY', notesZh: '战斗换下后触发全能形态' },
  { key: 'TATSUGIRI_DROOPY', pokeApiName: 'tatsugiri-droopy', gen: 9, requirement: 'DIRECT', notesZh: '米立龙形态' },
  { key: 'TATSUGIRI_STRETCHY', pokeApiName: 'tatsugiri-stretchy', gen: 9, requirement: 'DIRECT', notesZh: '米立龙形态' },
  { key: 'DUDUNSPARCE_THREE_SEGMENT', pokeApiName: 'dudunsparce-three-segment', gen: 9, requirement: 'DIRECT', notesZh: '土龙节节稀有形态' },
  { key: 'GIMMIGHOUL_ROAMING', pokeApiName: 'gimmighoul-roaming', gen: 9, requirement: 'DIRECT', notesZh: '索财灵形态' },
  { key: 'BASCULEGION_FEMALE', pokeApiName: 'basculegion-female', gen: 9, requirement: 'DIRECT', notesZh: '雌雄差异形态' },
  { key: 'OGERPON_WELLSPRING', pokeApiName: 'ogerpon-wellspring-mask', gen: 9, requirement: 'HOLD_ITEM', notesZh: '需对应面具道具' },
  { key: 'OGERPON_HEARTHFLAME', pokeApiName: 'ogerpon-hearthflame-mask', gen: 9, requirement: 'HOLD_ITEM', notesZh: '需对应面具道具' },
  { key: 'OGERPON_CORNERSTONE', pokeApiName: 'ogerpon-cornerstone-mask', gen: 9, requirement: 'HOLD_ITEM', notesZh: '需对应面具道具' },
  { key: 'TERAPAGOS_TERASTAL', pokeApiName: 'terapagos-terastal', gen: 9, requirement: 'BATTLE_TERA', notesZh: '太晶化战斗流程触发' },
  { key: 'TERAPAGOS_STELLAR', pokeApiName: 'terapagos-stellar', gen: 9, requirement: 'BATTLE_TERA', notesZh: '星晶化战斗流程触发' },
];

export const DIRECT_SPECIAL_FORMS = SPECIAL_FORM_CATALOG.filter(
  (entry) => entry.requirement === 'DIRECT' || entry.requirement === 'HOLD_ITEM',
);

export const SPECIAL_FORM_RANDOM_RATE = 0.22;
