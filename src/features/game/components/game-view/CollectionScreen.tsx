import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
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
import { TopRecordPanel } from './TopRecordPanel';

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
const ENABLE_TEMP_DEX_MOCK = true;

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
  psychic: '超能力',
  bug: '虫',
  rock: '岩石',
  ghost: '幽灵',
  dragon: '龙',
  dark: '恶',
  steel: '钢',
  fairy: '妖精',
};

const TEMP_MOCK_DEX_ENTRIES: DexEntry[] = [
  { id: 25, name: 'Pikachu', sprite: getDefaultSprite(25), types: ['electric'], bst: 320, hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90, seen: true, owned: true, formCategory: 'BASE', sourceLabel: 'TEAM', raw: { name: 'pikachu' } },
  { id: 6, name: 'Charizard', sprite: getDefaultSprite(6), types: ['fire', 'flying'], bst: 534, hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100, seen: true, owned: true, formCategory: 'BASE', sourceLabel: 'TEAM', raw: { name: 'charizard' } },
  { id: 131, name: 'Lapras', sprite: getDefaultSprite(131), types: ['water', 'ice'], bst: 535, hp: 130, attack: 85, defense: 80, spAtk: 85, spDef: 95, speed: 60, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'ENEMY', raw: { name: 'lapras' } },
  { id: 197, name: 'Umbreon', sprite: getDefaultSprite(197), types: ['dark'], bst: 525, hp: 95, attack: 65, defense: 110, spAtk: 60, spDef: 130, speed: 65, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'RENTAL', raw: { name: 'umbreon' } },
  { id: 260, name: 'Swampert', sprite: getDefaultSprite(260), types: ['water', 'ground'], bst: 535, hp: 100, attack: 110, defense: 90, spAtk: 85, spDef: 90, speed: 60, seen: true, owned: true, formCategory: 'BASE', sourceLabel: 'TEAM', raw: { name: 'swampert' } },
  { id: 282, name: 'Gardevoir', sprite: getDefaultSprite(282), types: ['psychic', 'fairy'], bst: 518, hp: 68, attack: 65, defense: 65, spAtk: 125, spDef: 115, speed: 80, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'ENEMY', raw: { name: 'gardevoir' } },
  { id: 384, name: 'Rayquaza', sprite: getDefaultSprite(384), types: ['dragon', 'flying'], bst: 680, hp: 105, attack: 150, defense: 90, spAtk: 150, spDef: 90, speed: 95, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'ARCHIVE', raw: { name: 'rayquaza' } },
  { id: 445, name: 'Garchomp', sprite: getDefaultSprite(445), types: ['dragon', 'ground'], bst: 600, hp: 108, attack: 130, defense: 95, spAtk: 80, spDef: 85, speed: 102, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'ENEMY', raw: { name: 'garchomp' } },
  { id: 530, name: 'Excadrill', sprite: getDefaultSprite(530), types: ['ground', 'steel'], bst: 508, hp: 110, attack: 135, defense: 60, spAtk: 50, spDef: 65, speed: 88, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'RENTAL', raw: { name: 'excadrill' } },
  { id: 658, name: 'Greninja', sprite: getDefaultSprite(658), types: ['water', 'dark'], bst: 530, hp: 72, attack: 95, defense: 67, spAtk: 103, spDef: 71, speed: 122, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'ENEMY', raw: { name: 'greninja' } },
  { id: 778, name: 'Mimikyu', sprite: getDefaultSprite(778), types: ['ghost', 'fairy'], bst: 476, hp: 55, attack: 90, defense: 80, spAtk: 50, spDef: 105, speed: 96, seen: true, owned: true, formCategory: 'FORM', sourceLabel: 'TEAM', raw: { name: 'mimikyu' } },
  { id: 849, name: 'Toxtricity', sprite: getDefaultSprite(849), types: ['electric', 'poison'], bst: 502, hp: 75, attack: 98, defense: 70, spAtk: 114, spDef: 70, speed: 75, seen: true, owned: false, formCategory: 'FORM', sourceLabel: 'ARCHIVE', raw: { name: 'toxtricity' } },
  { id: 908, name: 'Meowscarada', sprite: getDefaultSprite(908), types: ['grass', 'dark'], bst: 530, hp: 76, attack: 110, defense: 70, spAtk: 81, spDef: 70, speed: 123, seen: false, owned: false, formCategory: 'BASE', sourceLabel: 'ARCHIVE', raw: { name: 'meowscarada' } },
  { id: 937, name: 'Ceruledge', sprite: getDefaultSprite(937), types: ['fire', 'ghost'], bst: 525, hp: 75, attack: 125, defense: 80, spAtk: 60, spDef: 100, speed: 85, seen: true, owned: false, formCategory: 'BASE', sourceLabel: 'RENTAL', raw: { name: 'ceruledge' } },
  { id: 1000, name: 'Gholdengo', sprite: getDefaultSprite(1000), types: ['steel', 'ghost'], bst: 550, hp: 87, attack: 60, defense: 95, spAtk: 133, spDef: 91, speed: 84, seen: false, owned: false, formCategory: 'BASE', sourceLabel: 'ARCHIVE', raw: { name: 'gholdengo' } },
];

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

function getFormCategoryLabel(category: DexFormCategory, isZh: boolean) {
  if (category === 'BASE') return isZh ? '基础' : 'Base';
  if (category === 'REGIONAL') return isZh ? '地区' : 'Regional';
  if (category === 'GENDER') return isZh ? '性别' : 'Gender';
  return isZh ? '形态' : 'Form';
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
    coins,
    stage,
    streak,
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
  const [moveDetailMap, setMoveDetailMap] = useState<Record<string, DexMoveDetail>>({});
  const [search, setSearch] = useState('');
  const [typeFilterPrimary, setTypeFilterPrimary] = useState('all');
  const [typeFilterSecondary, setTypeFilterSecondary] = useState('all');
  const [dexScopeFilter, setDexScopeFilter] = useState<DexScopeFilter>('NATIONAL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const usingTempMock = ENABLE_TEMP_DEX_MOCK || catalogEntries.length === 0;

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
    if (usingTempMock) {
      return TEMP_MOCK_DEX_ENTRIES.map((entry) => {
        const snapshot = snapshotMap[entry.id];
        return {
          ...entry,
          name: snapshot ? getLocalized({ name: snapshot.apiName, names: snapshot.names, zhName: snapshot.zhName }) : entry.name,
          sprite: snapshot?.sprite || entry.sprite,
          types: snapshot?.types ?? entry.types,
          hp: snapshot?.baseStats.hp ?? entry.hp,
          attack: snapshot?.baseStats.attack ?? entry.attack,
          defense: snapshot?.baseStats.defense ?? entry.defense,
          spAtk: snapshot?.baseStats.spAtk ?? entry.spAtk,
          spDef: snapshot?.baseStats.spDef ?? entry.spDef,
          speed: snapshot?.baseStats.speed ?? entry.speed,
          bst: snapshot
            ? snapshot.baseStats.hp + snapshot.baseStats.attack + snapshot.baseStats.defense + snapshot.baseStats.spAtk + snapshot.baseStats.spDef + snapshot.baseStats.speed
            : entry.bst,
          learnableMoves: snapshot?.learnableMoves ?? [],
        };
      });
    }
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
    usingTempMock,
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[linear-gradient(180deg,#dbeafe_0%,#ecf5ff_55%,#f8fafc_100%)]"
    >
      <div className="pointer-events-none absolute left-0 top-0 h-1.5 w-1/2 bg-red-500" />
      <div className="pointer-events-none absolute right-0 top-0 h-1.5 w-1/2 bg-blue-600" />

      <div className="px-3 pt-1 pb-0.5">
        <TopRecordPanel currentLanguage={currentLanguage} coins={coins} stage={stage} streak={streak} />
      </div>

      <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-2">
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

      <div className="px-3 pb-2 grid grid-cols-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] gap-2">
        <label className="col-span-2 md:col-span-1 min-w-0 h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isZh ? '搜索名称 / 编号' : 'Search name / id'}
            className="min-w-0 w-full bg-transparent outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
          />
        </label>

        <label className="min-w-0 h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-slate-400" />
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
        </label>

        <label className="min-w-0 h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-slate-400" />
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
        </label>

        <label className="col-span-2 md:col-span-1 min-w-0 h-10 rounded-xl border border-slate-300 bg-white flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={dexScopeFilter}
            onChange={(event) => setDexScopeFilter(event.target.value as DexScopeFilter)}
            className="min-w-0 w-full bg-transparent outline-none text-[13px] font-semibold text-slate-800 truncate"
          >
            {DEX_SCOPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {isZh ? option.zh : option.en}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 px-3 pb-3 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-3">
        <div className="min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden p-0.5">
            <div className="grid grid-cols-6 gap-2">
              {filteredEntries.map((entry) => {
                const selected = selectedEntry?.id === entry.id;
                return (
                  <button
                    key={`${entry.id}:${entry.raw?.name ?? ''}`}
                    onClick={() => setSelectedId(entry.id)}
                    className={`relative w-full aspect-square p-0 flex items-center justify-center ${selected ? 'scale-105' : ''}`}
                  >
                    <motion.div
                      animate={selected ? { y: [0, -3, 0] } : { y: 0 }}
                      transition={selected ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <DexSprite entry={entry} alt={entry.name} className="w-[96%] h-[96%] object-contain" />
                    </motion.div>
                  </button>
                );
              })}
              {filteredEntries.length === 0 && (
                <div className="col-span-6 h-36 rounded-xl border border-dashed border-slate-300 bg-slate-50" />
              )}
              {filteredEntries.length < 12 && Array.from({ length: 12 - filteredEntries.length }).map((_, index) => (
                <div
                  key={`filler-${index}`}
                  className="aspect-square"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {isZh ? '图鉴详情' : 'Dex Detail'}
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden p-4">
            {selectedEntry ? (
              <div>
                <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_100%)] p-2.5">
                  <div className="grid grid-cols-[0.95fr_1.05fr] gap-1.5 items-start">
                    <div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{getPokedexNumber(selectedEntry.id)}</p>
                          <PokeballStatusIcon owned={selectedEntry.owned} seen={selectedEntry.seen} />
                        </div>
                        <h3 className="text-xl font-black italic text-slate-900 leading-tight whitespace-normal break-words">{selectedEntry.name}</h3>
                      </div>
                      <div className="mt-1 flex justify-center">
                        <DexSprite
                          entry={selectedEntry}
                          alt={selectedEntry.name}
                          className="w-24 h-24 object-contain drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                        {selectedEntry.types.map((type) => (
                          <TypeBadge key={`detail-${selectedEntry.id}-${type}`} type={type} size="sm" />
                        ))}
                        {selectedEntry.formCategory !== 'BASE' && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                            {getFormCategoryLabel(selectedEntry.formCategory, isZh)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
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

                <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-black mb-2">
                    {isZh ? '可学习技能' : 'Learnable Moves'}
                  </p>
                  {selectedEntry.learnableMoves && selectedEntry.learnableMoves.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="space-y-1">
                        {selectedEntry.learnableMoves.map((move) => {
                          const normalizedMove = String(move || '').toLowerCase();
                          const detail = moveDetailMap[normalizedMove];
                          const displayName = getMoveDisplayName(move, detail, isZh);
                          return (
                            <div
                              key={`${selectedEntry.id}-${move}`}
                              className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.6fr] gap-1 items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                            >
                              <span className="text-[11px] font-semibold text-slate-800 truncate">{displayName}</span>
                              <div className="min-w-0">
                                {detail ? (
                                  <TypeBadge type={detail.type} size="xs" />
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400">--</span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-600 truncate">
                                {getDamageClassLabel(detail?.damageClass, isZh)}
                              </span>
                              <span className="text-[11px] font-black text-slate-700 text-right">{detail?.power ?? '--'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-10 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                  )}
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




