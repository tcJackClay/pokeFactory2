import type { GameViewSectionProps } from '../shared';
import { BattleMoveEffect } from './BattleMoveEffect';
import { CatchEffectOverlay } from './CatchEffectOverlay';
import { EnemyBattleCard } from './EnemyBattleCard';
import { PlayerBattleCard } from './PlayerBattleCard';

export function BattleFieldPanel({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    enemy,
    playerAnim,
    enemyAnim,
    activeMoveType,
    isCatching,
    catchSuccess,
    getLocalized,
  } = viewModel;

  const player = playerTeam[0];
  if (!player || !enemy) return null;

  return (
    <div className="pf-arena-stage relative min-h-[320px] flex-[1.12] sm:min-h-0 sm:flex-[7]">
      <div className="pf-arena-floor" aria-hidden="true" />
      <div className="absolute inset-x-6 top-6 h-10 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.66)_0%,transparent_72%)] blur-xl" aria-hidden="true" />

      <EnemyBattleCard enemy={enemy} enemyAnim={enemyAnim} isCatching={isCatching} getLocalized={getLocalized} />
      <PlayerBattleCard player={player} playerAnim={playerAnim} getLocalized={getLocalized} viewModel={viewModel} />
      <BattleMoveEffect playerAnim={playerAnim} enemyAnim={enemyAnim} activeMoveType={activeMoveType} />
      <CatchEffectOverlay isCatching={isCatching} catchSuccess={catchSuccess} />
    </div>
  );
}
