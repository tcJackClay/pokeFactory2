import { lazy, Suspense } from 'react';
import { AnimatePresence } from 'motion/react';
import type { GameViewModel } from '../view-model';
import { BattleScreen } from './game-view/BattleScreen';
import { FactorySelectScreen } from './game-view/FactorySelectScreen';
import { FactorySwapScreen } from './game-view/FactorySwapScreen';
import { GameOverScreen } from './game-view/GameOverScreen';
import { PokemonInfoScreen } from './game-view/PokemonInfoScreen';
import { RoundResultScreen } from './game-view/RoundResultScreen';
import { RewardScreen } from './game-view/RewardScreen';
import { SettingsScreen } from './game-view/SettingsScreen';
import { EventsScreen } from './game-view/EventsScreen';
import { BootLoadingScreen } from './game-view/BootLoadingScreen';
import { StartScreen } from './game-view/StartScreen';
import { TransitionOverlay } from './game-view/TransitionOverlay';
import { DeveloperPanel } from './game-view/DeveloperPanel';
import { APP_PALETTE } from '../../../theme/palette';

const CollectionScreen = lazy(async () => import('./game-view/CollectionScreen').then((module) => ({ default: module.CollectionScreen })));

export function GameView({ viewModel }: { viewModel: GameViewModel }) {
  const { gameState, infoPokemonIdx, prevGameState, factoryRentals, playerTeam, isTransitioning } = viewModel;

  const infoPokemonList = prevGameState === 'FACTORY_SELECT' ? factoryRentals : playerTeam;
  const displayPokemon =
    gameState === 'POKEMON_INFO' && infoPokemonIdx !== null
      ? infoPokemonList[infoPokemonIdx]
      : null;

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const viewStyle = {
    backgroundColor: APP_PALETTE.page.backgroundBottom,
  };

  const stripeStyle = {
    backgroundImage:
      'linear-gradient(45deg, rgba(148,163,184,0.18) 25%, transparent 25%, transparent 50%, rgba(148,163,184,0.18) 50%, rgba(148,163,184,0.18) 75%, transparent 75%, transparent)',
    backgroundSize: '100px 100px',
  };

  return (
    <div className="h-[100dvh] text-slate-900 font-sans overflow-hidden select-none" style={viewStyle}>
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full animate-barber-pole" style={stripeStyle} />
      </div>

      <div className="max-w-6xl mx-auto h-full flex flex-col p-2 md:p-4 relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {isTransitioning && <TransitionOverlay />}

          {gameState === 'BOOT' && <BootLoadingScreen viewModel={viewModel} />}

          {gameState === 'START' && <StartScreen viewModel={viewModel} />}

          {gameState === 'COLLECTION' && (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-600">
                    Loading Collection...
                  </div>
                </div>
              }
            >
              <CollectionScreen viewModel={viewModel} />
            </Suspense>
          )}

          {gameState === 'SETTINGS' && <SettingsScreen viewModel={viewModel} />}

          {gameState === 'EVENTS' && <EventsScreen viewModel={viewModel} />}

          {gameState === 'BATTLE' && playerTeam[0] && <BattleScreen viewModel={viewModel} />}

          {gameState === 'FACTORY_SELECT' && <FactorySelectScreen viewModel={viewModel} />}

          {gameState === 'FACTORY_SWAP' && <FactorySwapScreen viewModel={viewModel} />}

          {gameState === 'REWARD' && <RewardScreen viewModel={viewModel} />}

          {gameState === 'ROUND_RESULT' && <RoundResultScreen viewModel={viewModel} />}

          {gameState === 'POKEMON_INFO' && displayPokemon && (
            <PokemonInfoScreen
              viewModel={viewModel}
              displayPokemon={displayPokemon}
              pokemonList={infoPokemonList}
              selectedIndex={infoPokemonIdx ?? 0}
              isMobileViewport={isMobileViewport}
            />
          )}

          {gameState === 'GAMEOVER' && <GameOverScreen viewModel={viewModel} />}
        </AnimatePresence>
      </div>

      <DeveloperPanel viewModel={viewModel} />
    </div>
  );
}
