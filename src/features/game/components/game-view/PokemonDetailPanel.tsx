import { type ReactNode, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Package, Shield, Sparkles, Swords } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import type { GamePokemon } from '../../../../types';
import { ALL_ITEMS } from '../../../../uiAppConstants';
import type { LocalizeDescFn, LocalizeFn, TranslateFn } from '../../view-model';
import { getFactoryHeldItemIcon } from '../../config/factoryHeldItemIcons';

interface PokemonDetailPanelProps {
  pokemon: GamePokemon;
  isZh: boolean;
  t: TranslateFn;
  getLocalized: LocalizeFn;
  getLocalizedDesc: LocalizeDescFn;
  getLocalizedNature: (nature: GamePokemon['nature']) => string;
  getStatName: (stat: string) => string;
  className?: string;
}

const STAT_CONFIG = [
  { key: 'hp', short: 'HP', radarColor: '#ef4444', barColor: 'from-red-500 to-rose-500' },
  { key: 'attack', short: 'ATK', radarColor: '#f97316', barColor: 'from-orange-500 to-amber-500' },
  { key: 'defense', short: 'DEF', radarColor: '#eab308', barColor: 'from-yellow-500 to-lime-500' },
  { key: 'spAtk', short: 'SPA', radarColor: '#3b82f6', barColor: 'from-sky-500 to-blue-500' },
  { key: 'spDef', short: 'SPD', radarColor: '#10b981', barColor: 'from-emerald-500 to-teal-500' },
  { key: 'speed', short: 'SPE', radarColor: '#d946ef', barColor: 'from-fuchsia-500 to-pink-500' },
] as const;

const IV_RADAR_MAX = 31;
const RADAR_SIZE = 156;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 50;

function formatIdentifierLabel(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getFactoryHeldItemLabel(itemId: string | undefined, getLocalized: LocalizeFn, isZh: boolean): string {
  if (!itemId) {
    return isZh ? '无' : 'None';
  }

  const normalized = itemId.toLowerCase();
  const knownItem =
    ALL_ITEMS.find((item) => item.id.toLowerCase() === normalized)
    ?? ALL_ITEMS.find((item) => item.id.replace(/_/g, '-').toLowerCase() === normalized)
    ?? ALL_ITEMS.find((item) => item.id.replace(/-/g, '_').toLowerCase() === normalized);

  if (knownItem) {
    return getLocalized(knownItem);
  }

  return formatIdentifierLabel(itemId);
}

function getSpecialModeLabel(pokemon: GamePokemon, isZh: boolean): string {
  if (!pokemon.factoryPlannedSpecialMode) {
    return isZh ? '无' : 'None';
  }

  if (pokemon.factoryPlannedSpecialMode === 'TERA' && pokemon.teraType) {
    return `${pokemon.factoryPlannedSpecialMode} / ${formatIdentifierLabel(pokemon.teraType)}`;
  }

  return pokemon.factoryPlannedSpecialMode;
}

function polarToCartesian(angleInDegrees: number, radius: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: RADAR_CENTER + Math.cos(angleInRadians) * radius,
    y: RADAR_CENTER + Math.sin(angleInRadians) * radius,
  };
}

function buildRadarPolygon(scale: number) {
  return STAT_CONFIG.map((_, index) => {
    const angle = (360 / STAT_CONFIG.length) * index;
    const point = polarToCartesian(angle, RADAR_RADIUS * scale);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function DetailMetaCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/[0.92] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_12px_24px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-3 text-sm font-black leading-5 text-slate-900">{value}</div>
    </div>
  );
}

function IvRadarChart({
  pokemon,
  isZh,
}: {
  pokemon: GamePokemon;
  isZh: boolean;
}) {
  const gridPolygons = [0.25, 0.5, 0.75, 1];
  const radarPolygon = STAT_CONFIG.map((stat, index) => {
    const angle = (360 / STAT_CONFIG.length) * index;
    const point = polarToCartesian(angle, (pokemon.ivs[stat.key] / IV_RADAR_MAX) * RADAR_RADIUS);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        {isZh ? '个体值' : 'IV'}
      </div>

      <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="block h-[156px] w-[156px] overflow-visible">
        {gridPolygons.map((scale) => (
          <polygon
            key={`grid-${scale}`}
            points={buildRadarPolygon(scale)}
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1"
          />
        ))}

        {STAT_CONFIG.map((stat, index) => {
          const angle = (360 / STAT_CONFIG.length) * index;
          const outerPoint = polarToCartesian(angle, RADAR_RADIUS);
          const labelPoint = polarToCartesian(angle, RADAR_RADIUS + 16);
          const textAnchor =
            Math.abs(labelPoint.x - RADAR_CENTER) < 8
              ? 'middle'
              : labelPoint.x > RADAR_CENTER
                ? 'start'
                : 'end';

          return (
            <g key={`axis-${stat.key}`}>
              <line
                x1={RADAR_CENTER}
                y1={RADAR_CENTER}
                x2={outerPoint.x}
                y2={outerPoint.y}
                stroke="rgba(148,163,184,0.34)"
                strokeWidth="1"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                fill="#64748b"
                fontSize="9"
                fontWeight="800"
                textAnchor={textAnchor}
                dominantBaseline="middle"
              >
                {stat.short}
              </text>
              <text
                x={outerPoint.x}
                y={outerPoint.y}
                fill={stat.radarColor}
                fontSize="9"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {pokemon.ivs[stat.key]}
              </text>
            </g>
          );
        })}

        <polygon
          points={radarPolygon}
          fill="rgba(59,130,246,0.18)"
          stroke="rgba(37,99,235,0.72)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export function PokemonDetailPanel({
  pokemon,
  isZh,
  t,
  getLocalized,
  getLocalizedDesc,
  getLocalizedNature,
  getStatName,
  className = '',
}: PokemonDetailPanelProps) {
  const shouldReduceMotion = useReducedMotion();

  const copy = useMemo(
    () => ({
      heldItem: isZh ? '道具' : 'Held Item',
      specialMode: isZh ? '特殊模式' : 'Special Mode',
      moveSet: isZh ? '配招' : 'Moveset',
      statPanel: isZh ? '种族值' : 'Base Stats',
      noDescription: isZh ? '暂无招式说明。' : 'No move description available.',
    }),
    [isZh],
  );

  const abilityName = getLocalized(pokemon.abilities[0]?.ability) || t('none');
  const heldItemName = getFactoryHeldItemLabel(pokemon.factoryHeldItemId, getLocalized, isZh);
  const heldItemIcon = getFactoryHeldItemIcon(pokemon.factoryHeldItemId);
  const specialModeLabel = getSpecialModeLabel(pokemon, isZh);
  const natureAdjustments = [
    pokemon.nature.plus ? `+${getStatName(pokemon.nature.plus)}` : '',
    pokemon.nature.minus ? `-${getStatName(pokemon.nature.minus)}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const natureSummary = [getLocalizedNature(pokemon.nature), natureAdjustments]
    .filter(Boolean)
    .join(' / ');

  return (
    <div className={`grid gap-5 p-4 md:p-6 xl:grid-cols-[420px_minmax(0,1fr)] ${className}`}>
      <aside className="space-y-4">
        <div className="rounded-[28px] border border-white/85 bg-[linear-gradient(180deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.95)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_20px_36px_rgba(15,23,42,0.12)]">
          <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            <span>#{String(pokemon.id).padStart(3, '0')}</span>
            <span>LV.{pokemon.level}</span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_170px] items-center gap-4">
            <div className="flex flex-col items-center justify-center text-center">
              <motion.img
                animate={shouldReduceMotion ? undefined : { y: [0, -8, 0] }}
                transition={shouldReduceMotion ? undefined : { repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
                src={pokemon.sprites.front_default}
                alt={pokemon.name}
                className="h-[176px] w-[176px] object-contain drop-shadow-[0_18px_20px_rgba(15,23,42,0.18)]"
                referrerPolicy="no-referrer"
              />

              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {pokemon.types.map((typeSlot) => (
                  <TypeBadge key={`detail-type-${typeSlot.type.name}`} type={typeSlot.type.name} size="sm" />
                ))}
              </div>
            </div>

            <IvRadarChart pokemon={pokemon} isZh={isZh} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailMetaCard icon={<Shield className="h-4 w-4" />} label={t('ability')} value={abilityName} />
          <DetailMetaCard icon={<Sparkles className="h-4 w-4" />} label={t('nature')} value={natureSummary} />
          <DetailMetaCard
            icon={<Package className="h-4 w-4" />}
            label={copy.heldItem}
            value={(
              <span className="inline-flex items-center gap-2">
                {heldItemIcon && (
                  <img
                    src={heldItemIcon}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 rounded object-contain [image-rendering:pixelated]"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span>{heldItemName}</span>
              </span>
            )}
          />
          <DetailMetaCard icon={<Swords className="h-4 w-4" />} label={copy.specialMode} value={specialModeLabel} />
        </div>
      </aside>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[26px] border border-slate-200/80 bg-white/[0.9] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_16px_30px_rgba(15,23,42,0.08)] md:p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">{copy.statPanel}</h4>
          </div>

          <div className="space-y-3">
            {STAT_CONFIG.map((stat) => {
              const baseValue = pokemon.baseStats[stat.key];
              const width = Math.min(100, Math.max(14, (baseValue / 255) * 100));

              return (
                <div key={`detail-stat-${stat.key}`}>
                  <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <span>{getStatName(stat.key)}</span>
                    <span className="text-slate-900">{baseValue}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${stat.barColor}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200/80 bg-white/[0.9] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_16px_30px_rgba(15,23,42,0.08)] md:p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">{copy.moveSet}</h4>
          </div>

          <div className="space-y-3">
            {pokemon.selectedMoves.map((move, index) => (
              <div
                key={`${move.name}-${index}`}
                className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_20px_rgba(15,23,42,0.06)]"
              >
                <div className="min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-950 md:text-base">
                      {getLocalized(move)}
                    </div>
                    <div className="mt-2">
                      <TypeBadge type={move.type} size="xs" className="inline-flex" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {getLocalizedDesc(move) || copy.noDescription}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/[0.92] px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t('power')}</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{move.power ?? '--'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/[0.92] px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t('accuracy')}</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{move.accuracy ?? '--'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/[0.92] px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t('pp')}</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{move.pp ?? move.maxPp ?? '--'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
