import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
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
  const shouldReduceMotion = useReducedMotion();

  const infoPokemonList = prevGameState === 'FACTORY_SELECT' ? factoryRentals : playerTeam;
  const displayPokemon =
    gameState === 'POKEMON_INFO' && infoPokemonIdx !== null
      ? infoPokemonList[infoPokemonIdx]
      : null;

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const viewStyle = {
    backgroundImage: `linear-gradient(180deg, ${APP_PALETTE.page.backgroundTop} 0%, ${APP_PALETTE.page.backgroundBottom} 100%)`,
  };

  const stripeStyle = {
    backgroundImage:
      `linear-gradient(45deg, ${APP_PALETTE.page.stripe} 25%, transparent 25%, transparent 50%, ${APP_PALETTE.page.stripe} 50%, ${APP_PALETTE.page.stripe} 75%, transparent 75%, transparent)`,
    backgroundSize: '96px 96px',
  };

  let screenContent: ReactNode = null;

  if (gameState === 'BOOT') {
    screenContent = <BootLoadingScreen key="boot-screen" viewModel={viewModel} />;
  } else if (gameState === 'START') {
    screenContent = <StartScreen key="start-screen" viewModel={viewModel} />;
  } else if (gameState === 'COLLECTION') {
    screenContent = (
      <Suspense
        key="collection-screen"
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
    );
  } else if (gameState === 'SETTINGS') {
    screenContent = <SettingsScreen key="settings-screen" viewModel={viewModel} />;
  } else if (gameState === 'EVENTS') {
    screenContent = <EventsScreen key="events-screen" viewModel={viewModel} />;
  } else if (gameState === 'BATTLE' && playerTeam[0]) {
    screenContent = <BattleScreen key="battle-screen" viewModel={viewModel} />;
  } else if (gameState === 'FACTORY_SELECT') {
    screenContent = <FactorySelectScreen key="factory-select-screen" viewModel={viewModel} />;
  } else if (gameState === 'FACTORY_SWAP') {
    screenContent = <FactorySwapScreen key="factory-swap-screen" viewModel={viewModel} />;
  } else if (gameState === 'REWARD') {
    screenContent = <RewardScreen key="reward-screen" viewModel={viewModel} />;
  } else if (gameState === 'ROUND_RESULT') {
    screenContent = <RoundResultScreen key="round-result-screen" viewModel={viewModel} />;
  } else if (gameState === 'POKEMON_INFO' && displayPokemon) {
    screenContent = (
      <PokemonInfoScreen
        key="pokemon-info-screen"
        viewModel={viewModel}
        displayPokemon={displayPokemon}
        pokemonList={infoPokemonList}
        selectedIndex={infoPokemonIdx ?? 0}
        isMobileViewport={isMobileViewport}
      />
    );
  } else if (gameState === 'GAMEOVER') {
    screenContent = <GameOverScreen key="gameover-screen" viewModel={viewModel} />;
  }

  return (
    <div className="h-[100dvh] overflow-hidden select-none" style={viewStyle}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.08),_transparent_28%)]" />
        <div
          className={`absolute inset-0 opacity-[0.56] ${shouldReduceMotion ? '' : 'animate-barber-pole'}`}
          style={stripeStyle}
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent)]" />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col overflow-hidden px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))] md:px-4 md:py-4">
        <AnimatePresence initial={!shouldReduceMotion}>
          {isTransitioning && <TransitionOverlay key="transition-overlay-screen" />}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={!shouldReduceMotion}>
          {screenContent}
        </AnimatePresence>
      </div>

      <DeveloperPanel viewModel={viewModel} />
    </div>
  );
}
