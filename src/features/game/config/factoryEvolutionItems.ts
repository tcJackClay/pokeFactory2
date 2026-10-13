import { getFactoryShopRarityPrice, type FactoryShopRarityTier } from './factoryRewards';

/**
 * 「奖励商店」进化道具的唯一定义源（PRD 奖励商店 §2.6 / §F4）。
 *
 * - 名单 = PRD §2.6 与 `docs/公开版规则定稿.md` 第三次回写的 **39 种**：
 *   10 种进化石 + 连接线 `linking_cord` + 28 种专门道具（顺序即定稿顺序）。
 * - 稀有度一律 **3 档 = 3 券**（decisions.md 第六节第 5 条，用户已定）。
 * - **`kings_rock` 王者之证不进本名单**（PRD §2.6 已定）：它在本项目里已是 2 券的持有道具，
 *   首版只当持有道具；参考实现里它同时是「蚊香君 → 蚊香蛙皇、呆呆兽 → 呆呆王」的道具进化条件，
 *   这两个进化因此**换不到**。`FACTORY_EVOLUTION_ITEM_EXCLUDED_IDS` 负责在候选枚举里显式排除，
 *   避免同一件商品以两种身份出现。
 * - 图标沿用既有约定 `/api/pokeapi-sprites/items/<slug>.png`（`getFactoryEvolutionItemIcon`）。
 *   实测 PokeAPI sprites 仓库缺图的 16 件列入 `FACTORY_EVOLUTION_ITEM_ICONLESS_IDS`，
 *   一律返回 `null` 由 UI 走文字兜底（PRD F1.8：不得出现破图）。
 */

export const FACTORY_EVOLUTION_ITEM_IDS = [
  // 进化石 10 种
  'fire_stone',
  'water_stone',
  'thunder_stone',
  'leaf_stone',
  'ice_stone',
  'moon_stone',
  'sun_stone',
  'shiny_stone',
  'dusk_stone',
  'dawn_stone',
  // 连接线 1 种（代替通讯交换）
  'linking_cord',
  // 其他专门道具 28 种
  'metal_coat',
  'dragon_scale',
  'upgrade',
  'dubious_disc',
  'protector',
  'electirizer',
  'magmarizer',
  'reaper_cloth',
  'deep_sea_tooth',
  'deep_sea_scale',
  'sachet',
  'whipped_dream',
  'prism_scale',
  'galarica_cuff',
  'galarica_wreath',
  'black_augurite',
  'tart_apple',
  'sweet_apple',
  'syrupy_apple',
  'cracked_pot',
  'chipped_pot',
  'metal_alloy',
  'scroll_of_darkness',
  'scroll_of_waters',
  'auspicious_armor',
  'malicious_armor',
  'unremarkable_teacup',
  'masterpiece_teacup',
] as const;

export type FactoryEvolutionItemId = typeof FACTORY_EVOLUTION_ITEM_IDS[number];

export interface FactoryEvolutionItemDefinition {
  itemId: FactoryEvolutionItemId;
  zhName: string;
  enName: string;
  /** PokeAPI sprites 仓库里的图标文件名（不含扩展名）。 */
  iconSlug: string;
}

export const FACTORY_EVOLUTION_ITEM_DEFINITIONS: Record<FactoryEvolutionItemId, FactoryEvolutionItemDefinition> = {
  fire_stone: { itemId: 'fire_stone', zhName: '火之石', enName: 'Fire Stone', iconSlug: 'fire-stone' },
  water_stone: { itemId: 'water_stone', zhName: '水之石', enName: 'Water Stone', iconSlug: 'water-stone' },
  thunder_stone: { itemId: 'thunder_stone', zhName: '雷之石', enName: 'Thunder Stone', iconSlug: 'thunder-stone' },
  leaf_stone: { itemId: 'leaf_stone', zhName: '叶之石', enName: 'Leaf Stone', iconSlug: 'leaf-stone' },
  ice_stone: { itemId: 'ice_stone', zhName: '冰之石', enName: 'Ice Stone', iconSlug: 'ice-stone' },
  moon_stone: { itemId: 'moon_stone', zhName: '月之石', enName: 'Moon Stone', iconSlug: 'moon-stone' },
  sun_stone: { itemId: 'sun_stone', zhName: '日之石', enName: 'Sun Stone', iconSlug: 'sun-stone' },
  shiny_stone: { itemId: 'shiny_stone', zhName: '光之石', enName: 'Shiny Stone', iconSlug: 'shiny-stone' },
  dusk_stone: { itemId: 'dusk_stone', zhName: '暗之石', enName: 'Dusk Stone', iconSlug: 'dusk-stone' },
  dawn_stone: { itemId: 'dawn_stone', zhName: '觉醒之石', enName: 'Dawn Stone', iconSlug: 'dawn-stone' },
  linking_cord: { itemId: 'linking_cord', zhName: '连接线', enName: 'Linking Cord', iconSlug: 'linking-cord' },
  metal_coat: { itemId: 'metal_coat', zhName: '金属膜', enName: 'Metal Coat', iconSlug: 'metal-coat' },
  dragon_scale: { itemId: 'dragon_scale', zhName: '龙之鳞片', enName: 'Dragon Scale', iconSlug: 'dragon-scale' },
  upgrade: { itemId: 'upgrade', zhName: '升级数据', enName: 'Upgrade', iconSlug: 'up-grade' },
  dubious_disc: { itemId: 'dubious_disc', zhName: '可疑补丁', enName: 'Dubious Disc', iconSlug: 'dubious-disc' },
  protector: { itemId: 'protector', zhName: '护具', enName: 'Protector', iconSlug: 'protector' },
  electirizer: { itemId: 'electirizer', zhName: '电力增幅器', enName: 'Electirizer', iconSlug: 'electirizer' },
  magmarizer: { itemId: 'magmarizer', zhName: '熔岩增幅器', enName: 'Magmarizer', iconSlug: 'magmarizer' },
  reaper_cloth: { itemId: 'reaper_cloth', zhName: '灵界之布', enName: 'Reaper Cloth', iconSlug: 'reaper-cloth' },
  deep_sea_tooth: { itemId: 'deep_sea_tooth', zhName: '深海之牙', enName: 'Deep Sea Tooth', iconSlug: 'deep-sea-tooth' },
  deep_sea_scale: { itemId: 'deep_sea_scale', zhName: '深海之鳞', enName: 'Deep Sea Scale', iconSlug: 'deep-sea-scale' },
  sachet: { itemId: 'sachet', zhName: '香袋', enName: 'Sachet', iconSlug: 'sachet' },
  whipped_dream: { itemId: 'whipped_dream', zhName: '泡沫奶油', enName: 'Whipped Dream', iconSlug: 'whipped-dream' },
  prism_scale: { itemId: 'prism_scale', zhName: '美丽鳞片', enName: 'Prism Scale', iconSlug: 'prism-scale' },
  galarica_cuff: { itemId: 'galarica_cuff', zhName: '伽勒豆蔻手环', enName: 'Galarica Cuff', iconSlug: 'galarica-cuff' },
  galarica_wreath: { itemId: 'galarica_wreath', zhName: '伽勒豆蔻花圈', enName: 'Galarica Wreath', iconSlug: 'galarica-wreath' },
  black_augurite: { itemId: 'black_augurite', zhName: '黑色碎石', enName: 'Black Augurite', iconSlug: 'black-augurite' },
  tart_apple: { itemId: 'tart_apple', zhName: '酸苹果', enName: 'Tart Apple', iconSlug: 'tart-apple' },
  sweet_apple: { itemId: 'sweet_apple', zhName: '甜苹果', enName: 'Sweet Apple', iconSlug: 'sweet-apple' },
  syrupy_apple: { itemId: 'syrupy_apple', zhName: '糖浆苹果', enName: 'Syrupy Apple', iconSlug: 'syrupy-apple' },
  cracked_pot: { itemId: 'cracked_pot', zhName: '破碎的茶壶', enName: 'Cracked Pot', iconSlug: 'cracked-pot' },
  chipped_pot: { itemId: 'chipped_pot', zhName: '缺损的茶壶', enName: 'Chipped Pot', iconSlug: 'chipped-pot' },
  metal_alloy: { itemId: 'metal_alloy', zhName: '复合金属', enName: 'Metal Alloy', iconSlug: 'metal-alloy' },
  scroll_of_darkness: { itemId: 'scroll_of_darkness', zhName: '暗之卷轴', enName: 'Scroll of Darkness', iconSlug: 'scroll-of-darkness' },
  scroll_of_waters: { itemId: 'scroll_of_waters', zhName: '水之卷轴', enName: 'Scroll of Waters', iconSlug: 'scroll-of-waters' },
  auspicious_armor: { itemId: 'auspicious_armor', zhName: '喜庆铠甲', enName: 'Auspicious Armor', iconSlug: 'auspicious-armor' },
  malicious_armor: { itemId: 'malicious_armor', zhName: '咒术铠甲', enName: 'Malicious Armor', iconSlug: 'malicious-armor' },
  unremarkable_teacup: { itemId: 'unremarkable_teacup', zhName: '凡作的茶杯', enName: 'Unremarkable Teacup', iconSlug: 'unremarkable-teacup' },
  masterpiece_teacup: { itemId: 'masterpiece_teacup', zhName: '杰出的茶杯', enName: 'Masterpiece Teacup', iconSlug: 'masterpiece-teacup' },
};

/** 全部进化道具统一按稀有度 3 定价（decisions.md 第六节第 5 条；PRD §2.3）。 */
export const FACTORY_EVOLUTION_ITEM_RARITY: FactoryShopRarityTier = 3;

export function getFactoryEvolutionItemPrice(itemId: string): number | null {
  if (!isFactoryEvolutionItemId(itemId)) return null;
  return getFactoryShopRarityPrice(FACTORY_EVOLUTION_ITEM_RARITY);
}

export function isFactoryEvolutionItemId(value: unknown): value is FactoryEvolutionItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FACTORY_EVOLUTION_ITEM_DEFINITIONS, value);
}

export function getFactoryEvolutionItemDefinition(itemId: string): FactoryEvolutionItemDefinition | null {
  return isFactoryEvolutionItemId(itemId) ? FACTORY_EVOLUTION_ITEM_DEFINITIONS[itemId] : null;
}

/**
 * 首版**不当进化道具**的持有道具（PRD §2.6「王者之证双重身份的处理」）：
 * 它在参考实现里同时是持有道具与两条进化的道具条件，本项目只保留持有道具身份。
 * 候选枚举与取数映射都必须显式跳过，不得以两种身份出现。
 */
export const FACTORY_EVOLUTION_ITEM_EXCLUDED_IDS: ReadonlySet<string> = new Set(['kings_rock']);

/**
 * PokeAPI 道具 slug → 本项目进化道具 ID。
 * 绝大多数只是 `-` 换 `_`；少数 PokeAPI 命名与本项目 itemId 不一致（如 `up-grade` → `upgrade`）。
 * 不在名单内（含 `kings_rock`、光粉、属性强化等）一律返回 `null` ⇒ 该关系**不上架**，绝不编造。
 */
const POKEAPI_ITEM_SLUG_OVERRIDES: Record<string, FactoryEvolutionItemId> = {
  'up-grade': 'upgrade',
};

export function getFactoryEvolutionItemIdByPokeApiSlug(slug: unknown): FactoryEvolutionItemId | null {
  if (typeof slug !== 'string') return null;
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;
  const candidate = POKEAPI_ITEM_SLUG_OVERRIDES[normalizedSlug]
    ?? normalizedSlug.replace(/-/g, '_');
  if (FACTORY_EVOLUTION_ITEM_EXCLUDED_IDS.has(candidate)) return null;
  return isFactoryEvolutionItemId(candidate) ? candidate : null;
}

const FACTORY_EVOLUTION_ITEM_SPRITE_BASE_URL = '/api/pokeapi-sprites/items';

/**
 * PokeAPI sprites 仓库（`sprites/items/`）中**不存在**图标的 16 件进化道具。
 * 实测（2026-09-27，`curl -o /dev/null -w '%{http_code}'`）全部 404，按 ID 拼连字符 URL 会得到破图。
 * 一律返回 `null`，由 UI 走非图片文字兜底（PRD F1.8：图标缺失时不得出现破图）。
 */
export const FACTORY_EVOLUTION_ITEM_ICONLESS_IDS: ReadonlySet<FactoryEvolutionItemId> = new Set([
  'linking_cord',
  'galarica_cuff',
  'galarica_wreath',
  'black_augurite',
  'tart_apple',
  'sweet_apple',
  'syrupy_apple',
  'cracked_pot',
  'chipped_pot',
  'metal_alloy',
  'scroll_of_darkness',
  'scroll_of_waters',
  'auspicious_armor',
  'malicious_armor',
  'unremarkable_teacup',
  'masterpiece_teacup',
]);

export function getFactoryEvolutionItemIcon(itemId?: string | null): string | null {
  const definition = getFactoryEvolutionItemDefinition(typeof itemId === 'string' ? itemId.trim().toLowerCase() : '');
  if (!definition) return null;
  if (FACTORY_EVOLUTION_ITEM_ICONLESS_IDS.has(definition.itemId)) return null;
  return `${FACTORY_EVOLUTION_ITEM_SPRITE_BASE_URL}/${definition.iconSlug}.png`;
}
