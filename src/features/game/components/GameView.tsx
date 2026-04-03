import { AnimatePresence } from 'motion/react';
import type { GameViewModel } from '../view-model';
import { BattleLogHistory } from './game-view/BattleLogHistory';
import { BattleScreen } from './game-view/BattleScreen';
import { FactorySelectScreen } from './game-view/FactorySelectScreen';
import { FactorySwapScreen } from './game-view/FactorySwapScreen';
import { GameHeader } from './game-view/GameHeader';
import { GameOverScreen } from './game-view/GameOverScreen';
import { PokemonInfoScreen } from './game-view/PokemonInfoScreen';
import { RoundResultScreen } from './game-view/RoundResultScreen';
import { RewardScreen } from './game-view/RewardScreen';
import { StartScreen } from './game-view/StartScreen';
import { TransitionOverlay } from './game-view/TransitionOverlay';

export function GameView({ viewModel }: { viewModel: GameViewModel }) {
  const { gameState, infoPokemonIdx, prevGameState, factoryRentals, playerTeam, isTransitioning } = viewModel;

  const displayPokemon =
    gameState === 'POKEMON_INFO' && infoPokemonIdx !== null
      ? (prevGameState === 'FACTORY_SELECT' ? factoryRentals[infoPokemonIdx] : playerTeam[infoPokemonIdx])
      : null;

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="h-[100dvh] bg-[#f0f0f0] text-slate-900 font-sans overflow-hidden select-none">
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,#00a0e9_25%,transparent_25%,transparent_50%,#00a0e9_50%,#00a0e9_75%,transparent_75%,transparent)] bg-[length:100px_100px] animate-barber-pole" />
      </div>

      <div className="max-w-6xl mx-auto h-full flex flex-col p-2 md:p-4 relative z-10 overflow-hidden">
        <GameHeader viewModel={viewModel} />
        <BattleLogHistory viewModel={viewModel} />

        <AnimatePresence mode="wait">
          {isTransitioning && <TransitionOverlay />}

          {gameState === 'START' && <StartScreen viewModel={viewModel} />}

          {gameState === 'BATTLE' && playerTeam[0] && viewModel.enemy && <BattleScreen viewModel={viewModel} />}

          {gameState === 'FACTORY_SELECT' && <FactorySelectScreen viewModel={viewModel} />}

          {gameState === 'FACTORY_SWAP' && <FactorySwapScreen viewModel={viewModel} />}

          {gameState === 'REWARD' && <RewardScreen viewModel={viewModel} />}

          {gameState === 'ROUND_RESULT' && <RoundResultScreen viewModel={viewModel} />}

          {gameState === 'POKEMON_INFO' && displayPokemon && (
            <PokemonInfoScreen
              viewModel={viewModel}
              displayPokemon={displayPokemon}
              isMobileViewport={isMobileViewport}
            />
          )}

          {gameState === 'GAMEOVER' && <GameOverScreen viewModel={viewModel} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
