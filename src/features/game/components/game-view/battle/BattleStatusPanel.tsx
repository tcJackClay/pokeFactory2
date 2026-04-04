import {
  CloudRain,
  CloudSun,
  Leaf,
  MoonStar,
  Orbit,
  Snowflake,
  Sparkles,
  Swords,
  Triangle,
  Wind,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { FieldState, StatStages, Weather } from '../../../../../types';
import type { GameViewSectionProps } from '../shared';

const STAGE_KEYS: Array<keyof Pick<StatStages, 'attack' | 'defense' | 'spAtk'>> = ['attack', 'defense', 'spAtk'];

const WEATHER_META: Record<Weather, { icon: LucideIcon; label: { zh: string; en: string }; iconClassName: string }> = {
  none: { icon: Wind, label: { zh: '无天气', en: 'No Weather' }, iconClassName: 'text-slate-400' },
  sunny: { icon: CloudSun, label: { zh: '大晴天', en: 'Sunny' }, iconClassName: 'text-amber-500' },
  rainy: { icon: CloudRain, label: { zh: '下雨', en: 'Rain' }, iconClassName: 'text-sky-500' },
  sandstorm: { icon: Wind, label: { zh: '沙暴', en: 'Sandstorm' }, iconClassName: 'text-amber-700' },
  hail: { icon: Snowflake, label: { zh: '冰雹', en: 'Hail' }, iconClassName: 'text-cyan-500' },
};

const FIELD_META: Record<FieldState, { icon: LucideIcon; label: { zh: string; en: string }; iconClassName: string }> = {
  electric_terrain: { icon: Zap, label: { zh: '电气场地', en: 'Electric Terrain' }, iconClassName: 'text-yellow-500' },
  grassy_terrain: { icon: Leaf, label: { zh: '青草场地', en: 'Grassy Terrain' }, iconClassName: 'text-emerald-500' },
  misty_terrain: { icon: CloudRain, label: { zh: '薄雾场地', en: 'Misty Terrain' }, iconClassName: 'text-fuchsia-400' },
  psychic_terrain: { icon: Sparkles, label: { zh: '精神场地', en: 'Psychic Terrain' }, iconClassName: 'text-pink-500' },
  trick_room: { icon: Orbit, label: { zh: '戏法空间', en: 'Trick Room' }, iconClassName: 'text-violet-500' },
  magic_room: { icon: MoonStar, label: { zh: '魔法空间', en: 'Magic Room' }, iconClassName: 'text-indigo-500' },
  wonder_room: { icon: Sparkles, label: { zh: '奇妙空间', en: 'Wonder Room' }, iconClassName: 'text-cyan-500' },
  gravity: { icon: Orbit, label: { zh: '重力', en: 'Gravity' }, iconClassName: 'text-slate-500' },
  fairy_lock: { icon: Sparkles, label: { zh: '妖精之锁', en: 'Fairy Lock' }, iconClassName: 'text-rose-400' },
};

function getTurnLabel(turns: number, isZh: boolean) {
  if (turns <= 0) return isZh ? '持续中' : 'Active';
  return isZh ? `${turns}回合` : `${turns} turns`;
}

export function BattleStatusPanel({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    weather,
    weatherTurns,
    fieldState,
    fieldTurns,
    currentLanguage,
    getStatName,
  } = viewModel;
  const player = playerTeam[0];
  const isZh = currentLanguage.startsWith('zh');

  if (!player) return null;

  const stageRows = STAGE_KEYS
    .map((key) => ({ key, value: player.statStages[key] }))
    .filter((entry) => entry.value !== 0);

  const effectRows: Array<{
    key: string;
    icon: LucideIcon;
    label: { zh: string; en: string };
    iconClassName: string;
    turns: number;
  }> = [];

  if (weather !== 'none') {
    effectRows.push({
      key: `weather-${weather}`,
      ...WEATHER_META[weather],
      turns: Math.max(0, weatherTurns),
    });
  }

  for (const state of fieldState) {
    effectRows.push({
      key: `field-${state}`,
      ...FIELD_META[state],
      turns: Math.max(0, fieldTurns[state] ?? 0),
    });
  }

  if (player.specialBoostActive && player.specialBoostMode) {
    effectRows.push({
      key: `special-${player.specialBoostMode}`,
      icon: Swords,
      label: { zh: player.specialBoostMode, en: player.specialBoostMode },
      iconClassName: 'text-orange-500',
      turns: player.specialBoostMode === 'DYNAMAX' ? Math.max(0, player.dynamaxTurnsLeft ?? 0) : 0,
    });
  }

  return (
    <motion.div
      key="status-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="h-full overflow-y-auto custom-scrollbar p-3 sm:p-4"
    >
      <div className="flex h-full flex-col gap-3">
        {effectRows.length > 0 && (
          <div className="space-y-2">
            {effectRows.map((effect) => {
              const Icon = effect.icon;
              return (
                <div key={effect.key} className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2 last:border-b-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className={`h-4 w-4 shrink-0 ${effect.iconClassName}`} strokeWidth={2.25} />
                    <span className="truncate text-[11px] font-black tracking-[0.08em] text-slate-700">
                      {isZh ? effect.label.zh : effect.label.en}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-slate-400">
                    {getTurnLabel(effect.turns, isZh)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {stageRows.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {stageRows.map((row) => {
              const isBuff = row.value > 0;
              return (
                <div key={row.key} className="flex min-w-0 items-center justify-center gap-1.5 text-[11px] font-black text-slate-700">
                  <span className="truncate">{getStatName(row.key)}</span>
                  <span className={`flex items-center gap-0.5 ${isBuff ? 'text-red-600' : 'text-blue-600'}`}>
                    <Triangle
                      className={`h-3 w-3 ${isBuff ? 'fill-current' : 'rotate-180 fill-current'}`}
                      strokeWidth={1.8}
                    />
                    <span>{Math.abs(row.value)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {effectRows.length === 0 && stageRows.length === 0 && (
          <div className="flex h-full items-center justify-center text-[11px] font-bold tracking-[0.08em] text-slate-400">
            {isZh ? '当前无状态变化' : 'No active effects'}
          </div>
        )}
      </div>
    </motion.div>
  );
}
