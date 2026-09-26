import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import { CreditsScreen } from './game-view/CreditsScreen';
import { EventsScreen } from './game-view/EventsScreen';
import { BootLoadingScreen } from './game-view/BootLoadingScreen';
import { CompanionSelectScreen } from './game-view/CompanionSelectScreen';
import { BaseScreen } from './game-view/BaseScreen';
import { StartScreen } from './game-view/StartScreen';
import { TopRecordPanel } from './game-view/TopRecordPanel';
import { DeveloperPanel } from './game-view/DeveloperPanel';
import { APP_PALETTE } from '../../../theme/palette';
import { TypeBadgeLanguageContext } from '../../../components/TypeBadge';
import { discardInvalidSave, inspectStoredSave, triggerTextDownload, type SaveInspection } from '../../../services/saveManager';

const CollectionScreen = lazy(async () => import('./game-view/CollectionScreen').then((module) => ({ default: module.CollectionScreen })));

function InvalidSaveScreen({ inspection }: { inspection: Extract<SaveInspection, { raw: string }> }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRef = useRef(false);
  useEffect(() => {
    if (confirmClear) {
      cancelButtonRef.current?.focus();
    } else if (wasConfirmingRef.current) {
      clearButtonRef.current?.focus();
    }
    wasConfirmingRef.current = confirmClear;
  }, [confirmClear]);
  const isLegacy = inspection.kind === 'legacy';
  const needsCompanionSchema = inspection.kind === 'legacy' && inspection.version === 10;
  const isUnreadable = inspection.kind === 'unreadable';
  const filename = isLegacy
    ? 'pokefactory-legacy-backup.json'
    : isUnreadable ? 'pokefactory-unreadable-backup.txt' : 'pokefactory-damaged-backup.json';

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-center shadow-lg sm:p-6">
        <h1 className="text-xl font-black text-slate-900">
          {isLegacy
            ? needsCompanionSchema ? '旧版本存档不兼容 / Older save is incompatible' : '旧规则存档不兼容 / Old save is incompatible'
            : '存档无法读取 / Save cannot be read'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {isLegacy
            ? needsCompanionSchema
              ? '新版存档需要绑定基地伙伴。此旧版存档不能自动指定伙伴，请先备份，再重新开始。'
              : '新版本按七战整组结算 BP，旧版逐场代币不能转入 BP。请先备份旧存档，再重新开始。'
            : '保存的挑战记录无法读取，原始存档尚未修改。请先下载备份，再决定是否清除并重新开始。'}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {isLegacy
            ? needsCompanionSchema
              ? 'The new save requires a bound base companion. This older save cannot choose one automatically. Back it up before starting over.'
              : 'The new BP rules require a fresh save. Old per-battle tokens cannot be carried over.'
            : 'Your saved challenge cannot be read. The original data is untouched. Download a backup before starting over.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="pf-action-button px-4"
            onClick={() => triggerTextDownload(
              inspection.raw,
              filename,
              isUnreadable ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8',
            )}
          >
            下载原始存档 / Download backup
          </button>
          {!confirmClear ? (
            <button ref={clearButtonRef} type="button" className="pf-action-button px-4" data-tone="primary" onClick={() => setConfirmClear(true)}>
              清除并重新开始 / Start fresh
            </button>
          ) : (
            <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3" role="group" aria-label="确认清除存档 / Confirm save removal">
              <p className="text-sm font-bold text-rose-900">确定清除本机存档？此操作不可撤销。 / Delete this local save permanently?</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button ref={cancelButtonRef} type="button" className="pf-action-button px-4" onClick={() => setConfirmClear(false)}>取消 / Cancel</button>
                <button type="button" className="pf-action-button px-4" data-tone="primary" onClick={() => { discardInvalidSave(); window.location.reload(); }}>
                  确认清除 / Delete save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameView({ viewModel }: { viewModel: GameViewModel }) {
  const {
    gameState,
    currentBaseTab,
    infoPokemonIdx,
    infoPokemonSource,
    prevGameState,
    factoryRentals,
    playerTeam,
    enemyTeam,
    isTransitioning,
    currentLanguage,
    coins,
    stage,
    streak,
    hasFactoryRunToResume,
    companionSpeciesId,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const [storedSave] = useState(inspectStoredSave);
  const showFactoryTopRecord = companionSpeciesId !== null && [
    'BASE',
    'START',
    'FACTORY_SELECT',
    'BATTLE',
    'FACTORY_SWAP',
    'REWARD',
    'ROUND_RESULT',
    'POKEMON_INFO',
    'GAMEOVER',
  ].includes(gameState);
  const battleIndexOverride = gameState === 'FACTORY_SELECT' || ((gameState === 'BASE' || gameState === 'START') && !hasFactoryRunToResume)
    ? 0
    : undefined;

  const infoPokemonList = prevGameState === 'FACTORY_SELECT' || infoPokemonSource === 'FACTORY'
    ? factoryRentals
    : infoPokemonSource === 'ENEMY'
      ? enemyTeam
      : playerTeam;
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

  const renderCollectionScreen = (key: string) => (
    <Suspense
      key={key}
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

  if (storedSave.kind !== 'none' && storedSave.kind !== 'valid') {
    screenContent = <InvalidSaveScreen inspection={storedSave} />;
  } else if (gameState === 'BOOT') {
    screenContent = <BootLoadingScreen key="boot-screen" viewModel={viewModel} />;
  } else if (companionSpeciesId === null) {
    screenContent = <CompanionSelectScreen key="companion-select-screen" viewModel={viewModel} />;
  } else if (gameState === 'BASE') {
    if (currentBaseTab === 'COLLECTION') {
      screenContent = renderCollectionScreen('collection-screen-base');
    } else if (currentBaseTab === 'EVENTS') {
      screenContent = <EventsScreen key="events-screen-base" viewModel={viewModel} />;
    } else {
      screenContent = <BaseScreen key="base-screen" viewModel={viewModel} />;
    }
  } else if (gameState === 'START') {
    screenContent = <StartScreen key="start-screen" viewModel={viewModel} />;
  } else if (gameState === 'COLLECTION') {
    screenContent = renderCollectionScreen('collection-screen');
  } else if (gameState === 'SETTINGS') {
    screenContent = <SettingsScreen key="settings-screen" viewModel={viewModel} />;
  } else if (gameState === 'CREDITS') {
    screenContent = <CreditsScreen key="credits-screen" viewModel={viewModel} />;
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
    <TypeBadgeLanguageContext.Provider value={currentLanguage}>
    <div className="pf-app-shell overflow-hidden select-none" style={viewStyle}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.08),_transparent_28%)]" />
        <div
          className={`absolute inset-0 opacity-[0.56] ${shouldReduceMotion ? '' : 'animate-barber-pole'}`}
          style={stripeStyle}
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent)]" />
      </div>

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-col overflow-hidden px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))] md:px-4 md:py-4">
        {showFactoryTopRecord && gameState !== 'BATTLE' && (
          <div className="px-3 pb-2 pt-1">
            <TopRecordPanel
              currentLanguage={currentLanguage}
              coins={coins}
              stage={stage}
              streak={streak}
              battleIndexOverride={battleIndexOverride}
            />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait" initial={!shouldReduceMotion}>
            {screenContent}
          </AnimatePresence>
        </div>
      </div>

      {(storedSave.kind === 'none' || storedSave.kind === 'valid') && companionSpeciesId !== null && <DeveloperPanel viewModel={viewModel} />}
    </div>
    </TypeBadgeLanguageContext.Provider>
  );
}
