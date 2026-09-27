const FACTORY_HELD_ITEM_SPRITE_BASE_URL = '/api/pokeapi-sprites/items';

function normalizeHeldItemId(itemId?: string): string {
  return (itemId ?? '').trim().toLowerCase().replace(/-/g, '_');
}

const ICON_FILENAME_BY_HELD_ITEM: Record<string, string> = {
  black_belt: 'black-belt',
  black_glasses: 'black-glasses',
  bright_powder: 'bright-powder',
  charcoal: 'charcoal',
  cheri_berry: 'cheri-berry',
  chesto_berry: 'chesto-berry',
  choice_band: 'choice-band',
  deep_sea_scale: 'deep-sea-scale',
  focus_band: 'focus-band',
  hard_stone: 'hard-stone',
  kings_rock: 'kings-rock',
  lax_incense: 'lax-incense',
  leek: 'stick',
  leftovers: 'leftovers',
  leppa_berry: 'leppa-berry',
  liechi_berry: 'liechi-berry',
  lum_berry: 'lum-berry',
  magnet: 'magnet',
  mental_herb: 'mental-herb',
  metal_coat: 'metal-coat',
  miracle_seed: 'miracle-seed',
  mystic_water: 'mystic-water',
  never_melt_ice: 'never-melt-ice',
  pecha_berry: 'pecha-berry',
  persim_berry: 'persim-berry',
  petaya_berry: 'petaya-berry',
  poison_barb: 'poison-barb',
  quick_claw: 'quick-claw',
  rawst_berry: 'rawst-berry',
  salac_berry: 'salac-berry',
  scope_lens: 'scope-lens',
  sharp_beak: 'sharp-beak',
  shell_bell: 'shell-bell',
  silk_scarf: 'silk-scarf',
  silver_powder: 'silver-powder',
  sitrus_berry: 'sitrus-berry',
  soft_sand: 'soft-sand',
  thick_club: 'thick-club',
  twisted_spoon: 'twisted-spoon',
  white_herb: 'white-herb',
};

export const FACTORY_HELD_ITEM_ICON_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ICON_FILENAME_BY_HELD_ITEM).map(([itemId, iconFile]) => (
    [itemId, `${FACTORY_HELD_ITEM_SPRITE_BASE_URL}/${iconFile}.png`]
  )),
) as Record<string, string>;

/**
 * 无图片资源的持有物 ID：PokeAPI sprites 仓库（905 张道具图）中不存在此二图，
 * 实测 `.../heavy-duty-boots.png` 与 `.../loaded-dice.png` 均 404。
 * 这些 ID 一律返回 `null`，由 UI 走非图片兜底。
 */
export const FACTORY_HELD_ITEM_ICONLESS_IDS = new Set(['heavy_duty_boots', 'loaded_dice']);

export function getFactoryHeldItemIcon(itemId?: string): string | null {
  const normalized = normalizeHeldItemId(itemId);
  if (!normalized) return null;

  // PokeAPI sprites 仓库无此二图（实测 404），按 ID 拼连字符 URL 会得到破图。
  // 因此不产出图片 URL，由调用方降级为非图片文字徽标（PRD §3.6 / 裁决：不得出现破图）。
  if (FACTORY_HELD_ITEM_ICONLESS_IDS.has(normalized)) return null;

  return FACTORY_HELD_ITEM_ICON_MAP[normalized]
    ?? `${FACTORY_HELD_ITEM_SPRITE_BASE_URL}/${normalized.replace(/_/g, '-')}.png`;
}
