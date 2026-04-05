import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import {
  fetchDexCatalogEntries,
  fetchDexMoveDetails,
  fetchDexSnapshots,
  fetchDexTypeMap,
  type DexCatalogEntry,
  type DexFormCategory,
  type DexMoveDetail,
  type DexSnapshot,
} from '../../../../services/pokedexClient';
import { getPokemonSpriteUrl } from '../../../../services/pokeApiEndpoint';
import type { GameViewSectionProps } from './shared';

interface DexEntry {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  bst: number;
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  seen: boolean;
  owned: boolean;
  formCategory: DexFormCategory;
  sourceLabel: 'TEAM' | 'ENEMY' | 'RENTAL' | 'ARCHIVE';
  learnableMoves?: string[];
  raw: any;
}

type DexScopeFilter = 'NATIONAL' | 'KANTO' | 'JOHTO' | 'HOENN' | 'SINNOH' | 'UNOVA' | 'KALOS' | 'ALOLA' | 'GALAR' | 'PALDEA';

const PREBUILT_TYPE_OPTIONS = [
  'all',
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

const DEX_SCOPE_OPTIONS: Array<{
  id: DexScopeFilter;
  zh: string;
  en: string;
  range: [number, number] | null;
}> = [
  { id: 'NATIONAL', zh: '全国', en: 'National', range: null },
  { id: 'KANTO', zh: '关都', en: 'Kanto', range: [1, 151] },
  { id: 'JOHTO', zh: '城都', en: 'Johto', range: [152, 251] },
  { id: 'HOENN', zh: '丰缘', en: 'Hoenn', range: [252, 386] },
  { id: 'SINNOH', zh: '神奥', en: 'Sinnoh', range: [387, 493] },
  { id: 'UNOVA', zh: '合众', en: 'Unova', range: [494, 649] },
  { id: 'KALOS', zh: '卡洛斯', en: 'Kalos', range: [650, 721] },
  { id: 'ALOLA', zh: '阿罗拉', en: 'Alola', range: [722, 809] },
  { id: 'GALAR', zh: '伽勒尔', en: 'Galar', range: [810, 898] },
  { id: 'PALDEA', zh: '帕底亚', en: 'Paldea', range: [899, 1025] },
];

const TYPE_LABELS_ZH: Record<string, string> = {
  all: '全部属性',
  normal: '一般',
  fire: '火',
  water: '水',
  electric: '电',
  grass: '草',
  ice: '冰',
  fighting: '格斗',
  poison: '毒',
  ground: '地面',
  flying: '飞行',
  psychic: '超能',
  bug: '虫',
  rock: '岩石',
  ghost: '幽灵',
  dragon: '龙',
  dark: '恶',
  steel: '钢',
  fairy: '妖精',
};

function getPokedexNumber(id: number) {
  return `#${String(id).padStart(4, '0')}`;
}

function getDefaultSprite(id: number) {
  return getPokemonSpriteUrl(id);
}

function getSpriteCandidates(entry: Pick<DexEntry, 'id' | 'sprite' | 'raw'>): string[] {
  const apiName = String(entry.raw?.name ?? '').trim().toLowerCase();
  const fallback = [
    entry.sprite,
    getDefaultSprite(entry.id),
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${entry.id}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${entry.id}.png`,
    apiName ? `https://play.pokemonshowdown.com/sprites/ani/${apiName}.gif` : '',
  ];
  return [...new Set(fallback.filter((url) => typeof url === 'string' && url.trim().length > 0))];
}

function normalizeApiSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
}

function getFormKey(id: number, apiName: string) {
  return `form-v2:${id}:${normalizeApiSlug(apiName)}`;
}

const FORM_SUFFIX_FALLBACK_LABELS: Record<string, { zh: string; en: string }> = {
  alola: { zh: '阿罗拉', en: 'Alola' },
  galar: { zh: '伽勒尔', en: 'Galar' },
  hisui: { zh: '洗翠', en: 'Hisui' },
  paldea: { zh: '帕底亚', en: 'Paldea' },
  male: { zh: '雄性', en: 'Male' },
  female: { zh: '雌性', en: 'Female' },
  m: { zh: '雄性', en: 'Male' },
  f: { zh: '雌性', en: 'Female' },
};

function toTitleCaseLabel(value: string) {
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function getFallbackFormLabel(apiName: string, formCategory: DexFormCategory, isZh: boolean) {
  const normalized = normalizeApiSlug(apiName);
  const directSuffix = Object.keys(FORM_SUFFIX_FALLBACK_LABELS).find((suffix) => normalized.endsWith(`-${suffix}`));
  if (directSuffix) {
    return isZh ? FORM_SUFFIX_FALLBACK_LABELS[directSuffix].zh : FORM_SUFFIX_FALLBACK_LABELS[directSuffix].en;
  }

  if (formCategory === 'GENDER') {
    return isZh ? '性别差异' : 'Gender Variant';
  }

  const parts = normalized.split('-').filter(Boolean);
  if (parts.length <= 1) {
    return isZh ? '特殊形态' : 'Form Variant';
  }

  return toTitleCaseLabel(parts.slice(1).join(' '));
}

function getFormDisplayLabel(
  entry: DexEntry,
  getLocalized: (value: any) => string,
  isZh: boolean,
) {
  if (entry.formCategory === 'BASE') return '';

  const localized = getLocalized({
    name: entry.raw?.formName,
    names: entry.raw?.formNames,
    zhName: entry.raw?.formZhName,
  }).trim();

  if (localized) return localized;

  return getFallbackFormLabel(String(entry.raw?.name ?? ''), entry.formCategory, isZh);
}

function formatMoveName(name: string) {
  return name
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function getMoveDisplayName(move: string, detail: DexMoveDetail | undefined, isZh: boolean) {
  const en = detail?.enName || formatMoveName(move);
  const zh = detail?.zhName || en;
  return isZh ? zh : en;
}

function getDamageClassLabel(damageClass: DexMoveDetail['damageClass'] | undefined, isZh: boolean) {
  if (damageClass === 'physical') return isZh ? '物理' : 'Physical';
  if (damageClass === 'special') return isZh ? '特殊' : 'Special';
  return isZh ? '变化' : 'Status';
}

function PokeballStatusIcon({ owned, seen }: { owned: boolean; seen: boolean }) {
  const topColor = owned ? 'bg-red-500' : 'bg-slate-300';
  const opacityClass = owned ? 'opacity-100' : seen ? 'opacity-70' : 'opacity-25';
  return (
    <span
      className={`relative block h-3.5 w-3.5 rounded-full border border-slate-500 overflow-hidden ${opacityClass}`}
      aria-hidden="true"
    >
      <span className={`absolute left-0 top-0 h-1/2 w-full ${topColor}`} />
      <span className="bg-white absolute left-0 bottom-0 h-1/2 w-full" />
      <span className="absolute left-0 top-1/2 h-[1px] w-full -translate-y-1/2 bg-slate-700" />
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border border-slate-700" />
    </span>
  );
}

function DexSprite({
  entry,
  alt,
  className,
}: {
  entry: Pick<DexEntry, 'id' | 'sprite' | 'raw'>;
  alt: string;
  className: string;
}) {
  const spriteCandidates = useMemo(
    () => getSpriteCandidates(entry),
    [entry.id, entry.raw?.name, entry.sprite],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [spriteCandidates]);

  const currentSrc = spriteCandidates[candidateIndex] ?? getDefaultSprite(entry.id);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
      onError={() => {
        setCandidateIndex((prev) => (prev < spriteCandidates.length - 1 ? prev + 1 : prev));
      }}
    />
  );
}

export function CollectionScreen({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    enemyTeam,
    factoryRentals,
    collectionSeenIds,
    collectionOwnedIds,
    collectionFormKeys,
    currentLanguage,
    getLocalized,
    setGameState,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const [catalogEntries, setCatalogEntries] = useState<DexCatalogEntry[]>([]);
  const [dexTypeMap, setDexTypeMap] = useState<Record<string, string[]>>({});
  const [snapshotMap, setSnapshotMap] = useState<Record<number, DexSnapshot>>({});
  const [moveDetailMap, setMoveDetailMap] = useState<Record<string, DexMoveDetail>>({});
  const [search, setSearch] = useState('');
  const [typeFilterPrimary, setTypeFilterPrimary] = useState('all');
  const [typeFilterSecondary, setTypeFilterSecondary] = useState('all');
  const [dexScopeFilter, setDexScopeFilter] = useState<DexScopeFilter>('NATIONAL');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [catalog, typeMap] = await Promise.all([fetchDexCatalogEntries(), fetchDexTypeMap()]);
      if (cancelled) return;
      setCatalogEntries(catalog);
      setDexTypeMap(typeMap);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo<DexEntry[]>(() => {
    if (catalogEntries.length === 0) return [];

    const runtimeById = new Map<number, any>();
    [...factoryRentals, ...enemyTeam, ...playerTeam].forEach((pokemon) => {
      if (!runtimeById.has(pokemon.id)) {
        runtimeById.set(pokemon.id, pokemon);
      }
    });

    const runtimeEnemyIds = new Set(enemyTeam.map((pokemon) => pokemon.id));
    const runtimeRentalIds = new Set(factoryRentals.map((pokemon) => pokemon.id));
    const runtimePlayerIds = new Set(playerTeam.map((pokemon) => pokemon.id));
    const seenIdSet = new Set(collectionSeenIds);
    const ownedIdSet = new Set(collectionOwnedIds);
    const formKeySet = new Set(collectionFormKeys);

    return catalogEntries.map((catalog) => {
      const id = catalog.id;
      const runtime = runtimeById.get(id);
      const snapshot = snapshotMap[id];
      const apiName = snapshot?.apiName ?? runtime?.name ?? catalog.apiName;
      const localizedSource = snapshot
        ? { name: snapshot.apiName, names: snapshot.names, zhName: snapshot.zhName }
        : runtime
          ? runtime
          : { name: apiName };
      const types = snapshot?.types ?? runtime?.types?.map((slot: any) => slot.type.name) ?? dexTypeMap[catalog.apiName] ?? [];
      const hp = snapshot?.baseStats.hp ?? runtime?.baseStats?.hp ?? 0;
      const attack = snapshot?.baseStats.attack ?? runtime?.baseStats?.attack ?? 0;
      const defense = snapshot?.baseStats.defense ?? runtime?.baseStats?.defense ?? 0;
      const spAtk = snapshot?.baseStats.spAtk ?? runtime?.baseStats?.spAtk ?? 0;
      const spDef = snapshot?.baseStats.spDef ?? runtime?.baseStats?.spDef ?? 0;
      const speed = snapshot?.baseStats.speed ?? runtime?.baseStats?.speed ?? 0;
      const bst = hp + attack + defense + spAtk + spDef + speed;
      const sourceLabel: DexEntry['sourceLabel'] = runtimePlayerIds.has(id)
        ? 'TEAM'
        : runtimeEnemyIds.has(id)
          ? 'ENEMY'
          : runtimeRentalIds.has(id)
            ? 'RENTAL'
            : 'ARCHIVE';
      const formKey = getFormKey(id, catalog.apiName);
      const seen = seenIdSet.has(id) || formKeySet.has(formKey);

      return {
        id,
        name: snapshot ? getLocalized(localizedSource) : apiName.replace(/-/g, ' '),
        sprite: snapshot?.sprite || runtime?.sprites?.front_default || getDefaultSprite(id),
        types,
        bst,
        hp,
        attack,
        defense,
        spAtk,
        spDef,
        speed,
        seen,
        owned: ownedIdSet.has(id),
        formCategory: catalog.formCategory,
        sourceLabel,
        learnableMoves: snapshot?.learnableMoves
          ?? runtime?.moves?.map((move: any) => move?.move?.name).filter(Boolean)
          ?? runtime?.selectedMoves?.map((move: any) => move?.name).filter(Boolean)
          ?? [],
        raw: {
          ...(runtime ?? {}),
          name: apiName,
          names: snapshot?.names ?? runtime?.names,
          zhName: snapshot?.zhName ?? runtime?.zhName,
          formName: snapshot?.formName,
          formZhName: snapshot?.formZhName,
          formNames: snapshot?.formNames,
        },
      };
    });
  }, [
    catalogEntries,
    collectionFormKeys,
    collectionOwnedIds,
    collectionSeenIds,
    dexTypeMap,
    enemyTeam,
    factoryRentals,
    getLocalized,
    playerTeam,
    snapshotMap,
  ]);

  const getTypeLabel = (type: string) => (isZh ? (TYPE_LABELS_ZH[type] ?? type) : type);

  const filteredEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (!entry.seen) return false;

      const matchSearch =
        keyword.length === 0
        || entry.name.toLowerCase().includes(keyword)
        || entry.raw?.name?.toLowerCase?.().includes(keyword)
        || String(entry.id).includes(keyword);

      const matchPrimary = typeFilterPrimary === 'all' || entry.types.includes(typeFilterPrimary);
      const matchSecondary = typeFilterSecondary === 'all' || entry.types.includes(typeFilterSecondary);
      const selectedScope = DEX_SCOPE_OPTIONS.find((option) => option.id === dexScopeFilter);
      const matchScope = !selectedScope || selectedScope.range === null
        ? true
        : entry.id >= selectedScope.range[0] && entry.id <= selectedScope.range[1];
      const matchType = matchPrimary && matchSecondary;
      return matchSearch && matchType && matchScope;
    });

    filtered.sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));

    return filtered;
  }, [dexScopeFilter, entries, search, typeFilterPrimary, typeFilterSecondary]);

  const hydrateIds = useMemo(() => {
    const selected = selectedId ? [selectedId] : [];
    const top = filteredEntries.slice(0, 120).map((entry) => entry.id);
    const merged = [...selected, ...top];
    return [...new Set(merged)].filter((id) => !snapshotMap[id]);
  }, [filteredEntries, selectedId, snapshotMap]);

  useEffect(() => {
    let cancelled = false;
    if (hydrateIds.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const snapshots = await fetchDexSnapshots(hydrateIds);
      if (cancelled) return;
      setSnapshotMap((prev) => ({ ...prev, ...snapshots }));
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateIds]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedId],
  );

  const selectedFormLabel = useMemo(
    () => (selectedEntry ? getFormDisplayLabel(selectedEntry, getLocalized, isZh) : ''),
    [getLocalized, isZh, selectedEntry],
  );

  const seenCount = entries.filter((entry) => entry.seen).length;
  const selectedSourceLabel = selectedEntry
    ? (
      isZh
        ? {
            TEAM: '队伍',
            ENEMY: '对手',
            RENTAL: '租赁',
            ARCHIVE: '档案',
          }[selectedEntry.sourceLabel]
        : selectedEntry.sourceLabel
    )
    : '';

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(selectedEntry.id);
    }
  }, [filteredEntries, selectedEntry, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const moveNames = (selectedEntry?.learnableMoves ?? [])
      .map((move) => String(move || '').trim().toLowerCase())
      .filter(Boolean);
    const pending = moveNames.filter((move) => !moveDetailMap[move]);
    if (pending.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const details = await fetchDexMoveDetails(pending);
      if (cancelled) return;
      setMoveDetailMap((prev) => ({ ...prev, ...details }));
    })();

    return () => {
      cancelled = true;
    };
  }, [moveDetailMap, selectedEntry]);

  return (
    <motion.div
      key="collection"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      className="pf-system-page"
    >
      <div className="pf-system-header">
        <div className="flex items-center gap-3">
          <h2 className={`text-slate-950 ${isZh ? 'text-[28px] font-black' : 'text-[26px] font-black uppercase tracking-[0.05em]'}`}>
            {isZh ? '宝可梦图鉴' : 'Pokedex'}
          </h2>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-black text-slate-500">
              Seen {seenCount}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setGameState('START')}
          className="pf-action-button px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isZh ? '返回' : 'Back'}</span>
        </button>
      </div>

      <div className="pf-system-toolbar">
        <div className="pf-toolbar-panel p-2.5">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.5fr_1.5fr_1fr]">
            <label className="pf-filter-field">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isZh ? '搜索名称 / 编号' : 'Search name / id'}
                className="min-w-0 w-full bg-transparent outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
              />
            </label>

            <div className="pf-filter-field gap-3">
              <Filter className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                <select
                  value={typeFilterPrimary}
                  onChange={(event) => setTypeFilterPrimary(event.target.value)}
                  className="min-w-0 w-full bg-transparent outline-none text-sm font-semibold text-slate-800 truncate"
                >
                  {PREBUILT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type === 'all' ? (isZh ? '属性一' : 'Type 1') : getTypeLabel(type)}
                    </option>
                  ))}
                </select>

                <select
                  value={typeFilterSecondary}
                  onChange={(event) => setTypeFilterSecondary(event.target.value)}
                  className="min-w-0 w-full bg-transparent outline-none text-sm font-semibold text-slate-800 truncate"
                >
                  {PREBUILT_TYPE_OPTIONS.map((type) => (
                    <option key={`secondary-${type}`} value={type}>
                      {type === 'all' ? (isZh ? '属性二' : 'Type 2') : getTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="pf-filter-field">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={dexScopeFilter}
                onChange={(event) => setDexScopeFilter(event.target.value as DexScopeFilter)}
                className="min-w-0 w-full bg-transparent outline-none text-sm font-semibold text-slate-800 truncate"
              >
                {DEX_SCOPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {isZh ? option.zh : option.en}
                  </option>
                ))}
              </select>
            </label>

          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 min-h-0 px-3 pb-3">
        <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="pf-terminal-panel min-h-0 overflow-hidden p-2.5 flex flex-col">
            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-6 gap-1.5">
                {filteredEntries.map((entry) => {
                  return (
                    <button
                      key={`${entry.id}:${entry.raw?.name ?? ''}`}
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className="relative aspect-square overflow-hidden"
                    >
                      <motion.div
                        animate={{ y: 0 }}
                        transition={{ duration: 0 }}
                        className="relative z-10 flex h-full w-full items-center justify-center"
                      >
                        <DexSprite entry={entry} alt={entry.name} className="h-full w-full scale-[1.08] object-contain" />
                      </motion.div>
                    </button>
                  );
                })}

                {filteredEntries.length === 0 && (
                  <div className="col-span-full flex h-36 items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-400">
                    {isZh ? '没有匹配结果。' : 'No matching entries.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pf-terminal-panel min-h-0 overflow-hidden p-3 flex flex-col">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              {selectedEntry ? (
                <div className="space-y-3">
                  <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <PokeballStatusIcon owned={selectedEntry.owned} seen={selectedEntry.seen} />
                        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                          {getPokedexNumber(selectedEntry.id)}
                        </span>
                      </div>
                      {selectedSourceLabel && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.10em] text-slate-500">
                          {selectedSourceLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-[128px_minmax(0,1fr)] items-start gap-4">
                      <div className="flex flex-col items-center text-center">
                        <div className="min-w-0">
                          <h3 className={`text-slate-950 ${isZh ? 'text-[26px] font-black' : 'text-[24px] font-black uppercase tracking-[0.04em]'}`}>
                            {selectedEntry.name}
                          </h3>
                          {selectedFormLabel && (
                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                              {selectedFormLabel}
                            </div>
                          )}
                        </div>

                        <div className="flex h-[128px] w-[128px] items-center justify-center rounded-[18px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,246,250,0.96)_100%)]">
                          <DexSprite
                            entry={selectedEntry}
                            alt={selectedEntry.name}
                            className="h-[112px] w-[112px] object-contain drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                          />
                        </div>

                        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                          {selectedEntry.types.map((type) => (
                            <TypeBadge key={`detail-${selectedEntry.id}-${type}`} type={type} size="sm" />
                          ))}
                        </div>
                      </div>

                      <div className="min-w-0 pt-1">
                        <div className="space-y-1.5">
                          {[
                            { key: 'HP', value: selectedEntry.hp, color: 'bg-red-500' },
                            { key: 'ATK', value: selectedEntry.attack, color: 'bg-orange-500' },
                          { key: 'DEF', value: selectedEntry.defense, color: 'bg-yellow-500' },
                          { key: 'SPA', value: selectedEntry.spAtk, color: 'bg-blue-500' },
                          { key: 'SPD', value: selectedEntry.spDef, color: 'bg-emerald-500' },
                          { key: 'SPE', value: selectedEntry.speed, color: 'bg-pink-500' },
                        ].map((stat) => (
                            <div key={`${selectedEntry.id}-${stat.key}`}>
                              <div className="mb-0.5 flex items-center justify-between text-[11px] font-bold text-slate-600">
                                <span>{stat.key}</span>
                                <span>{stat.value}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full ${stat.color}`} style={{ width: `${Math.min(100, (stat.value / 255) * 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                    {selectedEntry.learnableMoves && selectedEntry.learnableMoves.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedEntry.learnableMoves.map((move) => {
                          const normalizedMove = String(move || '').toLowerCase();
                          const detail = moveDetailMap[normalizedMove];
                          const displayName = getMoveDisplayName(move, detail, isZh);
                          return (
                            <div
                              key={`${selectedEntry.id}-${move}`}
                              className="grid grid-cols-[1.35fr_0.75fr_0.8fr_0.45fr] items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50/90 px-3 py-2"
                            >
                              <span className="truncate text-[12px] font-semibold text-slate-800">{displayName}</span>
                              <div className="min-w-0">
                                {detail ? (
                                  <TypeBadge type={detail.type} size="xs" />
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400">--</span>
                                )}
                              </div>
                              <span className="truncate text-[10px] font-semibold text-slate-500">
                                {getDamageClassLabel(detail?.damageClass, isZh)}
                              </span>
                              <span className="text-right text-[11px] font-black text-slate-700">
                                {detail?.power ?? '--'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-400">
                        {isZh ? '暂无可学习技能。' : 'No learnable moves.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center text-sm font-semibold text-slate-400">
                  {isZh ? '暂无数据' : 'No Data'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}




