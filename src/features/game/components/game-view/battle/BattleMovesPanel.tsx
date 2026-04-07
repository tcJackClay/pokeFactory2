import { motion, useReducedMotion } from 'motion/react';
import { Circle, CircleDot, Triangle, X } from 'lucide-react';
import { TYPE_CHART } from '../../../../../constants';
import TypeBadge from '../../../../../components/TypeBadge';
import { TYPE_COLORS } from '../../../../../uiAppConstants';
import type { GameViewSectionProps } from '../shared';

const LIGHT_MOVE_TYPES = new Set(['normal', 'electric', 'ground', 'flying', 'ice', 'steel', 'rock']);

export function BattleMovesPanel({ viewModel }: GameViewSectionProps) {
  const { playerTeam, enemy, currentLanguage, t, getLocalized, handleAttack } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const player = playerTeam[0];
  const mustChooseReplacement = player?.currentHp <= 0 && playerTeam.some((pokemon, index) => index !== 0 && pokemon.currentHp > 0);

  if (!player) return null;

  const powerLabel = currentLanguage.startsWith('zh') ? t('power') : 'Pow';
  const accuracyLabel = currentLanguage.startsWith('zh') ? t('accuracy') : 'Acc';
  const ppLabel = t('pp');

  const getMoveEffectivenessMultiplier = (moveType: string) => {
    if (!enemy) return null;
    return enemy.types.reduce((multiplier, typeSlot) => {
      const typeMultiplier = TYPE_CHART[moveType]?.[typeSlot.type.name];
      return typeMultiplier === undefined ? multiplier : multiplier * typeMultiplier;
    }, 1);
  };

  const getMoveEffectivenessIcon = (moveType: string) => {
    const multiplier = getMoveEffectivenessMultiplier(moveType);
    if (multiplier === null) return null;
    if (multiplier === 0) return X;
    if (multiplier < 1) return Triangle;
    if (multiplier > 1) return CircleDot;
    return Circle;
  };

  return (
    <motion.div
      key="moves"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
      className="flex h-full flex-col p-3 sm:p-4"
    >
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-3">
        {player.selectedMoves.map((move, index) => {
          const isLightType = LIGHT_MOVE_TYPES.has(move.type);
          const EffectivenessIcon = getMoveEffectivenessIcon(move.type);
          const totalPp = move.maxPp ?? move.pp ?? 0;
          const currentPp = move.currentPp ?? totalPp;
          const isExhausted = totalPp > 0 && currentPp <= 0;
          const disabled = isExhausted || mustChooseReplacement;

          return (
            <button
              key={`${move.name}-${index}`}
              type="button"
              onClick={() => handleAttack(move)}
              disabled={disabled}
              className={`group relative flex min-h-[124px] flex-col justify-between overflow-hidden rounded-[20px] border p-3 text-left transition-all active:scale-[0.98] ${
                isLightType
                  ? 'border-slate-200 text-slate-950'
                  : 'border-slate-900/10 text-white'
              } ${disabled ? 'cursor-not-allowed opacity-60 saturate-75' : ''}`}
              style={{
                background: `linear-gradient(180deg, color-mix(in srgb, ${TYPE_COLORS[move.type] ?? 'var(--type-normal)'} 88%, white 12%) 0%, color-mix(in srgb, ${TYPE_COLORS[move.type] ?? 'var(--type-normal)'} 78%, black 22%) 100%)`,
                boxShadow: '0 14px 28px rgba(15, 23, 42, 0.12)',
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,transparent_45%,rgba(15,23,42,0.12)_100%)]" />
              <div className="absolute right-0 top-0 h-full w-16 translate-x-8 skew-x-[-20deg] bg-white/18 transition-transform duration-200 group-hover:translate-x-4" />

              <div className="relative z-10 grid min-h-[74px] grid-cols-[minmax(0,1fr)_34px] items-start gap-2">
                <div className="min-w-0 pt-[10px] sm:pt-[11px]">
                  <div className={`line-clamp-2 text-[20px] font-black leading-[1.05] ${isLightType ? 'text-slate-950' : 'text-white'} sm:text-[22px]`}>
                    {getLocalized(move)}
                  </div>

                  <div className="mt-2">
                    <TypeBadge
                      type={move.type}
                      size="xs"
                      className={`inline-flex ${isLightType ? '!bg-black/12 !text-slate-950 shadow-none' : '!bg-white/12 !text-white shadow-none'}`}
                    />
                  </div>
                </div>

                {EffectivenessIcon ? (
                  <span className={`mt-1 inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border ${
                    isLightType
                      ? 'border-slate-900/12 bg-white/40 text-slate-950'
                      : 'border-white/18 bg-black/10 text-white'
                  }`}>
                    <EffectivenessIcon className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                  </span>
                ) : (
                  <span className="mt-1 h-[34px] w-[34px]" aria-hidden="true" />
                )}
              </div>

              <div className={`relative z-10 text-[12px] font-black ${isLightType ? 'text-slate-900/80' : 'text-white/84'}`}>
                <div className="text-[16px] leading-none sm:text-[18px]">
                  {powerLabel} {move.power || '--'}
                </div>
                <div className="mt-2 flex items-center gap-4 text-[12px] leading-none sm:text-[13px]">
                  <span className="whitespace-nowrap">{accuracyLabel} {move.accuracy ?? '--'}</span>
                  <span className="whitespace-nowrap">{ppLabel} {currentPp}/{totalPp || '--'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
