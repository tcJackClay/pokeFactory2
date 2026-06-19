const FACTORY_HELD_ITEM_SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

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

export function getFactoryHeldItemIcon(itemId?: string): string | null {
  const normalized = normalizeHeldItemId(itemId);
  if (!normalized) return null;

  return FACTORY_HELD_ITEM_ICON_MAP[normalized]
    ?? `${FACTORY_HELD_ITEM_SPRITE_BASE_URL}/${normalized.replace(/_/g, '-')}.png`;
}
