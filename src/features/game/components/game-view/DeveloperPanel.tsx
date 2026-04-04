import type { GameViewSectionProps } from './shared';

export function DeveloperPanel({ viewModel }: GameViewSectionProps) {
  const {
    developerMode,
    gameState,
    stage,
    coins,
    specialModeUnlocked,
    quickStartDevBattle,
    devAddCoins,
    devSetStage,
    devUnlockSpecialMode,
    devResetBattleSpecialUsage,
    devOpenRewardScreen,
  } = viewModel;

  if (!developerMode) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[120] w-[280px] max-w-[calc(100vw-1rem)] bg-slate-900 text-white border-2 border-cyan-400 shadow-2xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-cyan-300">Developer Mode</h3>
        <span className="text-[10px] font-bold text-slate-300">{gameState}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <button
          onClick={() => void quickStartDevBattle()}
          className="col-span-2 bg-cyan-600 hover:bg-cyan-500 font-black uppercase py-2"
        >
          Quick Start Battle
        </button>
        <button onClick={() => devAddCoins(500)} className="bg-emerald-600 hover:bg-emerald-500 font-black uppercase py-2">
          +500 Coins
        </button>
        <button onClick={() => devSetStage(21)} className="bg-amber-600 hover:bg-amber-500 font-black uppercase py-2">
          Stage 21
        </button>
        <button onClick={devUnlockSpecialMode} className="bg-violet-600 hover:bg-violet-500 font-black uppercase py-2">
          Unlock Special
        </button>
        <button
          onClick={devResetBattleSpecialUsage}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 font-black uppercase py-2"
        >
          Reset Special
        </button>
        <button onClick={devOpenRewardScreen} className="col-span-2 bg-blue-600 hover:bg-blue-500 font-black uppercase py-2">
          Open Reward Test
        </button>
      </div>

      <div className="text-[10px] text-slate-200 font-semibold space-y-1">
        <p>Stage: {stage}</p>
        <p>Coins: {coins}</p>
        <p>Special: {specialModeUnlocked ? 'Unlocked' : 'Locked'}</p>
      </div>
    </aside>
  );
}
