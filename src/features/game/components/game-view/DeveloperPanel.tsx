import { useState } from 'react';
import type { GameViewSectionProps } from './shared';

export function DeveloperPanel({ viewModel }: GameViewSectionProps) {
  const {
    developerMode,
    gameState,
    stage,
    coins,
    weather,
    weatherTurns,
    fieldState,
    specialModeUnlocked,
    quickStartDevBattle,
    devAddCoins,
    devSetStage,
    devUnlockSpecialMode,
    devResetBattleSpecialUsage,
    devOpenRewardScreen,
    devOpenStatusPanel,
    devApplyStatusPanelPreset,
    devSetWeather,
    devToggleFieldEffect,
    devAdjustLeadStatStage,
    devClearBattleStatuses,
  } = viewModel;
  const [collapsed, setCollapsed] = useState(true);

  if (!developerMode) return null;

  return (
    <>
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="fixed top-4 left-4 z-[121] rounded-full border border-cyan-300 bg-slate-900/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 shadow-lg backdrop-blur-sm hover:bg-slate-900/75"
      >
        {collapsed ? 'DEV' : 'HIDE'}
      </button>

      {!collapsed && (
        <aside className="fixed top-14 left-4 z-[120] w-[308px] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto rounded-xl border border-cyan-400/70 bg-slate-900/72 text-white shadow-2xl backdrop-blur-md">
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Developer</h3>
              <span className="text-[9px] font-bold text-slate-300">{gameState}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <button
                onClick={() => void quickStartDevBattle()}
                className="col-span-2 rounded-md bg-cyan-600/90 px-2 py-2 font-black uppercase"
              >
                Quick Battle
              </button>
              <button onClick={() => devAddCoins(500)} className="rounded-md bg-emerald-600/90 px-2 py-1.5 font-black uppercase">
                +500
              </button>
              <button onClick={() => devSetStage(21)} className="rounded-md bg-amber-600/90 px-2 py-1.5 font-black uppercase">
                Stage 21
              </button>
              <button onClick={devUnlockSpecialMode} className="rounded-md bg-violet-600/90 px-2 py-1.5 font-black uppercase">
                Unlock
              </button>
              <button onClick={devResetBattleSpecialUsage} className="rounded-md bg-fuchsia-600/90 px-2 py-1.5 font-black uppercase">
                Reset
              </button>
              <button onClick={devOpenRewardScreen} className="col-span-2 rounded-md bg-blue-600/90 px-2 py-1.5 font-black uppercase">
                Reward Test
              </button>
            </div>

            <section className="space-y-1.5 border-t border-slate-700/80 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Status</h4>
                <span className="text-[9px] font-semibold text-slate-400">{weather !== 'none' ? `${weather} ${weatherTurns}` : 'idle'}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <button onClick={devOpenStatusPanel} className="rounded-md bg-slate-700/90 px-2 py-1.5 font-black uppercase">
                  Open
                </button>
                <button onClick={devApplyStatusPanelPreset} className="rounded-md bg-teal-600/90 px-2 py-1.5 font-black uppercase">
                  Preset
                </button>
                <button onClick={() => devSetWeather('sunny', 4)} className="rounded-md bg-amber-600/90 px-2 py-1.5 font-black uppercase">
                  Sunny
                </button>
                <button onClick={() => devSetWeather('rainy', 4)} className="rounded-md bg-sky-600/90 px-2 py-1.5 font-black uppercase">
                  Rain
                </button>
                <button onClick={() => devToggleFieldEffect('electric_terrain', 4)} className="rounded-md bg-yellow-600/90 px-2 py-1.5 font-black uppercase">
                  Electric
                </button>
                <button onClick={() => devToggleFieldEffect('trick_room', 4)} className="rounded-md bg-violet-600/90 px-2 py-1.5 font-black uppercase">
                  Trick
                </button>
                <button onClick={() => devAdjustLeadStatStage('attack', 1)} className="rounded-md bg-emerald-700/90 px-2 py-1.5 font-black uppercase">
                  Atk+
                </button>
                <button onClick={() => devAdjustLeadStatStage('attack', -1)} className="rounded-md bg-rose-700/90 px-2 py-1.5 font-black uppercase">
                  Atk-
                </button>
                <button onClick={() => devAdjustLeadStatStage('defense', 1)} className="rounded-md bg-emerald-700/90 px-2 py-1.5 font-black uppercase">
                  Def+
                </button>
                <button onClick={() => devAdjustLeadStatStage('defense', -1)} className="rounded-md bg-rose-700/90 px-2 py-1.5 font-black uppercase">
                  Def-
                </button>
                <button onClick={() => devAdjustLeadStatStage('spAtk', 1)} className="rounded-md bg-emerald-700/90 px-2 py-1.5 font-black uppercase">
                  SpA+
                </button>
                <button onClick={() => devAdjustLeadStatStage('spAtk', -1)} className="rounded-md bg-rose-700/90 px-2 py-1.5 font-black uppercase">
                  SpA-
                </button>
                <button onClick={devClearBattleStatuses} className="col-span-2 rounded-md bg-slate-600/90 px-2 py-1.5 font-black uppercase">
                  Clear
                </button>
              </div>

              <p className="text-[9px] font-semibold text-slate-400">
                F: {fieldState.length > 0 ? fieldState.join(', ') : 'none'}
              </p>
            </section>

            <div className="grid grid-cols-3 gap-1 text-[9px] font-semibold text-slate-300">
              <span>S {stage}</span>
              <span>C {coins}</span>
              <span>{specialModeUnlocked ? 'SP ON' : 'SP OFF'}</span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
