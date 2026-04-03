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
    <div className="relative flex-[7] bg-white rounded-none skew-x-[-1deg] shadow-2xl overflow-hidden border-y-8 border-slate-900 min-h-0">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#e0e0e0,#ffffff)]" />
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-slate-100 skew-y-[-2deg] origin-left" />

      <EnemyBattleCard enemy={enemy} enemyAnim={enemyAnim} isCatching={isCatching} getLocalized={getLocalized} />
      <PlayerBattleCard player={player} playerAnim={playerAnim} getLocalized={getLocalized} />
      <BattleMoveEffect playerAnim={playerAnim} enemyAnim={enemyAnim} activeMoveType={activeMoveType} />
      <CatchEffectOverlay isCatching={isCatching} catchSuccess={catchSuccess} />
    </div>
  );
}
