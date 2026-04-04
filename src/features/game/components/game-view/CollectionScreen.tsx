import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Filter, Search, Trophy } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import {
  fetchDexCatalogEntries,
  fetchDexSnapshots,
  fetchDexTypeMap,
  type DexCatalogEntry,
  type DexFormCategory,
  type DexSnapshot,
} from '../../../../services/pokedexClient';
import type { GameViewSectionProps } from './shared';
import dexArrows from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/arrows.png';
import dexCaughtBall from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/caught_ball.png';

type SortMode = 'NUMERICAL' | 'ALPHABETICAL' | 'BST_DESC';
type FormFilter = 'ALL' | DexFormCategory;

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
  raw: any;
}

const PREBUILT_TYPE_OPTIONS = [
  'all',
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
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
  psychic: '超能力',
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
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function normalizeApiSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
}

function getFormKey(id: number, apiName: string) {
  return `form-v2:${id}:${normalizeApiSlug(apiName)}`;
}

function getFormCategoryLabel(category: DexFormCategory, isZh: boolean) {
  if (category === 'BASE') return isZh ? '基础' : 'Base';
  if (category === 'REGIONAL') return isZh ? '地区' : 'Regional';
  if (category === 'GENDER') return isZh ? '性别' : 'Gender';
  return isZh ? '形态' : 'Form';
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

  const isZh = currentLanguage.startsWith('zh');
  const [catalogEntries, setCatalogEntries] = useState<DexCatalogEntry[]>([]);
  const [dexTypeMap, setDexTypeMap] = useState<Record<string, string[]>>({});
  const [snapshotMap, setSnapshotMap] = useState<Record<number, DexSnapshot>>({});
  const [search, setSearch] = useState('');
  const [typeFilterPrimary, setTypeFilterPrimary] = useState('all');
  const [typeFilterSecondary, setTypeFilterSecondary] = useState('all');
  const [formFilter, setFormFilter] = useState<FormFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('NUMERICAL');
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
        raw: {
          ...(runtime ?? {}),
          name: apiName,
          names: snapshot?.names ?? runtime?.names,
          zhName: snapshot?.zhName ?? runtime?.zhName,
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
      const matchSearch =
        keyword.length === 0
        || entry.name.toLowerCase().includes(keyword)
        || entry.raw?.name?.toLowerCase?.().includes(keyword)
        || String(entry.id).includes(keyword);

      const matchPrimary = typeFilterPrimary === 'all' || entry.types.includes(typeFilterPrimary);
      const matchSecondary = typeFilterSecondary === 'all' || entry.types.includes(typeFilterSecondary);
      const matchType = matchPrimary && matchSecondary;
      const matchForm = formFilter === 'ALL' || entry.formCategory === formFilter;
      return matchSearch && matchType && matchForm;
    });

    filtered.sort((a, b) => {
      if (sortMode === 'ALPHABETICAL') return a.name.localeCompare(b.name);
      if (sortMode === 'BST_DESC') return b.bst - a.bst || a.id - b.id;
      return a.id - b.id;
    });

    return filtered;
  }, [entries, formFilter, search, sortMode, typeFilterPrimary, typeFilterSecondary]);

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

  const seenCount = useMemo(() => entries.filter((entry) => entry.seen).length, [entries]);
  const ownedCount = useMemo(() => entries.filter((entry) => entry.owned).length, [entries]);
  const completion = entries.length > 0 ? Math.round((ownedCount / entries.length) * 100) : 0;

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedId],
  );

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(selectedEntry.id);
    }
  }, [filteredEntries, selectedEntry, selectedId]);

  return (
    <motion.div
      key="collection"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[linear-gradient(180deg,#dbeafe_0%,#ecf5ff_55%,#f8fafc_100%)]"
    >
      <div className="pointer-events-none absolute left-0 top-0 h-1.5 w-1/2 bg-red-500" />
      <div className="pointer-events-none absolute right-0 top-0 h-1.5 w-1/2 bg-blue-600" />

      <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            {isZh ? '图鉴中心' : 'Dex Center'}
          </p>
          <h2 className="mt-1 text-2xl font-black italic tracking-tight text-slate-900">
            {isZh ? '宝可梦图鉴' : 'Pokedex'}
          </h2>
        </div>
        <button
          onClick={() => setGameState('START')}
          className="h-10 px-4 skew-x-[-12deg] border border-slate-300 bg-white text-slate-800 font-black text-xs uppercase tracking-wide flex items-center gap-2 hover:border-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="skew-x-[12deg]">{isZh ? '返回' : 'Back'}</span>
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-black">{isZh ? '已见' : 'Seen'}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{seenCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-black">{isZh ? '拥有' : 'Owned'}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{ownedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-black">{isZh ? '完成率' : 'Rate'}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{completion}%</p>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 grid grid-cols-1 md:grid-cols-[1.2fr_0.75fr_0.75fr_0.75fr_0.75fr] gap-2">
        <label className="h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isZh ? '搜索名称 / 编号' : 'Search name / id'}
            className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
          />
        </label>

        <label className="h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilterPrimary}
            onChange={(event) => setTypeFilterPrimary(event.target.value)}
            className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
          >
            {PREBUILT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? (isZh ? '属性一' : 'Type 1') : getTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilterSecondary}
            onChange={(event) => setTypeFilterSecondary(event.target.value)}
            className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
          >
            {PREBUILT_TYPE_OPTIONS.map((type) => (
              <option key={`secondary-${type}`} value={type}>
                {type === 'all' ? (isZh ? '属性二' : 'Type 2') : getTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={formFilter}
            onChange={(event) => setFormFilter(event.target.value as FormFilter)}
            className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
          >
            <option value="ALL">{isZh ? '全部形态' : 'All Forms'}</option>
            <option value="BASE">{isZh ? '基础形态' : 'Base'}</option>
            <option value="FORM">{isZh ? '一般形态' : 'Form'}</option>
            <option value="REGIONAL">{isZh ? '地区形态' : 'Regional'}</option>
            <option value="GENDER">{isZh ? '性别差异' : 'Gender'}</option>
          </select>
        </label>

        <label className="h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Trophy className="w-4 h-4 text-slate-400" />
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
          >
            <option value="NUMERICAL">{isZh ? '编号排序' : 'Numerical'}</option>
            <option value="ALPHABETICAL">{isZh ? '字母排序' : 'Alphabetical'}</option>
            <option value="BST_DESC">{isZh ? '能力值排序' : 'Stats (High to Low)'}</option>
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 px-3 pb-3 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {isZh ? '图鉴列表' : 'Dex List'}
            </p>
            <div className="flex items-center gap-2">
              <img src={dexArrows} alt="" aria-hidden="true" className="h-3 w-auto opacity-70" />
              <p className="text-[11px] font-bold text-slate-600">{filteredEntries.length}</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2">
            <div className="space-y-1.5">
              {filteredEntries.map((entry) => {
                const selected = selectedEntry?.id === entry.id;
                return (
                  <button
                    key={`${entry.id}:${entry.raw?.name ?? ''}`}
                    onClick={() => setSelectedId(entry.id)}
                    className={`w-full rounded-xl border p-2 flex items-center gap-2 text-left transition ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center">
                      <img src={entry.sprite} alt={entry.name} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{getPokedexNumber(entry.id)}</p>
                      <p className="text-sm font-black truncate text-slate-900">{entry.name}</p>
                      <p className="text-[10px] font-bold text-slate-500">{getFormCategoryLabel(entry.formCategory, isZh)}</p>
                      <div className="mt-1 flex gap-1">
                        {entry.types.map((type) => (
                          <TypeBadge key={`${entry.id}-${type}`} type={type} size="xs" />
                        ))}
                      </div>
                    </div>
                    <div className="w-6 flex justify-end">
                      <img
                        src={dexCaughtBall}
                        alt=""
                        aria-hidden="true"
                        className={`w-4 h-4 ${entry.owned ? 'opacity-100' : entry.seen ? 'opacity-70' : 'opacity-25 grayscale'}`}
                      />
                    </div>
                  </button>
                );
              })}
              {filteredEntries.length === 0 && (
                <div className="h-36 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">
                  {isZh ? '未找到匹配条目' : 'No entry found'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {isZh ? '图鉴详情' : 'Dex Detail'}
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
            {selectedEntry ? (
              <div>
                <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_100%)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{getPokedexNumber(selectedEntry.id)}</p>
                      <h3 className="text-2xl font-black italic text-slate-900 leading-tight">{selectedEntry.name}</h3>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                      selectedEntry.owned ? 'bg-emerald-100 text-emerald-700' : selectedEntry.seen ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {selectedEntry.owned ? (isZh ? '已拥有' : 'Owned') : selectedEntry.seen ? (isZh ? '仅遇见' : 'Seen') : (isZh ? '未遇见' : 'Unseen')}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    {selectedEntry.types.map((type) => (
                      <TypeBadge key={`detail-${selectedEntry.id}-${type}`} type={type} size="sm" />
                    ))}
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                      {getFormCategoryLabel(selectedEntry.formCategory, isZh)}
                    </span>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <img
                      src={selectedEntry.sprite}
                      alt={selectedEntry.name}
                      className="w-36 h-36 object-contain drop-shadow-[0_12px_24px_rgba(15,23,42,0.22)]"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-black">BST</p>
                      <p className="mt-1 text-lg font-black text-slate-900">{selectedEntry.bst}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-black">{isZh ? '来源' : 'Source'}</p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {selectedEntry.sourceLabel === 'TEAM'
                          ? (isZh ? '我方队伍' : 'Team')
                          : selectedEntry.sourceLabel === 'ENEMY'
                            ? (isZh ? '敌方遭遇' : 'Enemy')
                            : selectedEntry.sourceLabel === 'RENTAL'
                              ? (isZh ? '租借池' : 'Rentals')
                              : (isZh ? '历史记录' : 'Archive')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-black mb-2">
                    {isZh ? '基础能力' : 'Base Stats'}
                  </p>
                  <div className="space-y-2">
                    {[
                      { key: 'HP', value: selectedEntry.hp, color: 'bg-red-500' },
                      { key: 'ATK', value: selectedEntry.attack, color: 'bg-orange-500' },
                      { key: 'DEF', value: selectedEntry.defense, color: 'bg-yellow-500' },
                      { key: 'SPA', value: selectedEntry.spAtk, color: 'bg-blue-500' },
                      { key: 'SPD', value: selectedEntry.spDef, color: 'bg-green-500' },
                      { key: 'SPE', value: selectedEntry.speed, color: 'bg-pink-500' },
                    ].map((stat) => (
                      <div key={`${selectedEntry.id}-${stat.key}`}>
                        <div className="mb-0.5 flex items-center justify-between text-[11px] font-bold text-slate-600">
                          <span>{stat.key}</span>
                          <span>{stat.value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full ${stat.color}`} style={{ width: `${Math.min(100, (stat.value / 255) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">
                {isZh ? '暂无数据' : 'No Data'}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
