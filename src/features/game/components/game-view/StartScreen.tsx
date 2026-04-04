import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Dna, Languages, Lock, Store, Swords } from 'lucide-react';
import type { BaseTab } from '../../view-model';
import { EVENT_REGIONS } from '../../config/events';
import type { GameViewSectionProps } from './shared';
import companionAnimSprite from '../../../../../reference/pokeemerald-expansion/graphics/pokemon/pikachu/anim_front.png';
import pokedexMenuIcon from '../../../../../reference/pokeemerald-expansion/graphics/object_events/pics/misc/pokedex.png';
import eventsMenuIcon from '../../../../../reference/pokeemerald-expansion/graphics/object_events/pics/misc/clipboard.png';
import { TopRecordPanel } from './TopRecordPanel';
import { APP_PALETTE } from '../../../../theme/palette';

type StartMenu = BaseTab | 'SETTINGS';

interface StartNavItem {
  menu: StartMenu;
  label: string;
  badge?: string;
  locked?: boolean;
}

export function StartScreen({ viewModel }: GameViewSectionProps) {
  const {
    loading,
    coins,
    stage,
    availableEggCount,
    eventDispatches,
    shopUnlocked,
    breedingUnlocked,
    collectionUnlocked,
    eventsUnlocked,
    totalRents,
    pendingRunSummary,
    closeRunSummary,
    hasFactoryRunToResume,
    startGame,
    openBaseTab,
    setGameState,
    currentLanguage,
  } = viewModel;

  const [companionFrame, setCompanionFrame] = useState(0);
  const isZh = currentLanguage.startsWith('zh');

  const copy = useMemo(
    () => ({
      factoryTitle: isZh ? '对战工厂' : 'Battle Factory',
      factoryDesc: isZh ? '点击图标开始下一轮挑战。' : 'Tap the icon to start your next run.',
      hide: isZh ? '收起' : 'Hide',
      setCleared: isZh ? '组别通关' : 'Set Cleared',
      runEnded: isZh ? '挑战结束' : 'Run Ended',
      menuHint: isZh
        ? '移动端优先布局：上方记录，中间主按钮，下方功能菜单。'
        : 'Mobile-first home layout: top records, center factory action, bottom menu.',
      totalRents: isZh ? `累计租赁 ${totalRents}` : `Total rents: ${totalRents}`,
      menuDeveloping: isZh ? '该功能将在下个版本开放。' : 'This feature is coming in the next version.',
      langTitle: isZh ? '语言设置' : 'Language',
      langDesc: isZh ? '当前页面支持中文与英文。' : 'This page supports Chinese and English.',
      zh: '中文',
      en: 'English',
      shop: isZh ? '商店' : 'Shop',
      breeding: isZh ? '培育' : 'Breed',
      collection: isZh ? '图鉴' : 'Collection',
      events: isZh ? '事件' : 'Events',
      settings: isZh ? '设置' : 'Settings',
    }),
    [isZh, totalRents],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCompanionFrame((prev) => (prev + 1) % 2);
    }, 420);
    return () => window.clearInterval(timer);
  }, []);

  const readyEventCount = EVENT_REGIONS.reduce((total, region) => {
    const dispatch = eventDispatches[region.id];
    if (!dispatch) return total;
    const isReady =
      dispatch.status === 'READY'
      && dispatch.readyAt !== null
      && dispatch.readyAt <= Date.now();
    return total + (isReady ? 1 : 0);
  }, 0);

  const navItems: StartNavItem[] = [
    { menu: 'SHOP', label: copy.shop, locked: !shopUnlocked },
    {
      menu: 'BREEDING',
      label: copy.breeding,
      badge: availableEggCount > 0 ? `${availableEggCount}` : undefined,
      locked: !breedingUnlocked,
    },
    {
      menu: 'COLLECTION',
      label: copy.collection,
      locked: !collectionUnlocked,
    },
    {
      menu: 'EVENTS',
      label: copy.events,
      badge: readyEventCount > 0 ? `${readyEventCount}` : undefined,
      locked: !eventsUnlocked,
    },
    { menu: 'SETTINGS', label: copy.settings },
  ];

  const startRootStyle = {
    backgroundImage: `linear-gradient(180deg, ${APP_PALETTE.page.backgroundTop} 0%, ${APP_PALETTE.page.backgroundBottom} 100%)`,
  };

  const factoryButtonStyle = {
    backgroundImage: `radial-gradient(circle at 50% 38%, #ffffff 0%, #f8fafc 42%, #e2e8f0 100%)`,
    borderColor: APP_PALETTE.border.soft,
    color: APP_PALETTE.accent.primary,
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
  };

  return (
    <motion.div
      key="start"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="flex-1 flex flex-col min-h-0"
      style={startRootStyle}
    >
      <section className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-1 pb-0.5">
          <TopRecordPanel
            currentLanguage={currentLanguage}
            coins={coins}
            stage={stage}
            streak={viewModel.streak}
            battleIndexOverride={hasFactoryRunToResume ? undefined : 0}
          />
        </div>

        {pendingRunSummary?.visible && (
          <div className="px-3 pb-1">
            <div className="bg-emerald-500 text-white rounded-xl px-3 py-2 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-wide">
                  {pendingRunSummary.result === 'WIN' ? copy.setCleared : copy.runEnded} 路 +{pendingRunSummary.tokenGain}
                </p>
                <button
                  onClick={closeRunSummary}
                  className="text-[10px] uppercase font-black tracking-wide bg-emerald-800/40 px-2 py-1 rounded-md"
                >
                  {copy.hide}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => void startGame()}
            disabled={loading}
            className="relative w-44 h-44 md:w-52 md:h-52 rounded-full border-[6px] disabled:opacity-60"
            style={factoryButtonStyle}
            aria-label="Enter Battle Factory"
          >
            <span className="absolute inset-0 rounded-full bg-white/55" />
            <span className="relative z-10 flex h-full w-full items-center justify-center">
              <Swords className="w-16 h-16 md:w-20 md:h-20" />
            </span>
          </motion.button>

          <p className="mt-5 text-base font-black uppercase tracking-[0.2em] text-slate-900">{copy.factoryTitle}</p>
          <p className="mt-2 text-sm font-semibold text-slate-600 text-center max-w-[280px]">{copy.factoryDesc}</p>
        </div>

        <div className="px-2 pb-2 pt-1 relative">
          <motion.div
            initial={{ opacity: 0, x: -10, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute left-3 top-0 -translate-y-full z-20"
          >
            <motion.div
              animate={{ y: [0, -5, 0], rotate: [0, -2, 0, 2, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <div className="h-16 w-16 overflow-hidden">
                <img
                  src={companionAnimSprite}
                  alt=""
                  aria-hidden="true"
                  className="w-16 h-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.3)]"
                  style={{
                    transform: `translateY(-${companionFrame * 50}%)`,
                    transition: 'transform 120ms steps(1)',
                  }}
                />
              </div>
            </motion.div>
          </motion.div>

          <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-lg px-2 py-2">
            <div className="grid grid-cols-5 gap-1.5">
              {navItems.map((item) => {
                const isLocked = Boolean(item.locked);
                const Icon =
                  item.menu === 'SHOP'
                    ? Store
                    : item.menu === 'BREEDING'
                      ? Dna
                      : Languages;

                return (
                  <button
                    key={item.menu}
                    onClick={() => {
                      if (item.menu === 'SETTINGS') {
                        setGameState('SETTINGS');
                        return;
                      }
                      if (!isLocked && item.menu === 'COLLECTION') {
                        openBaseTab('COLLECTION');
                        setGameState('COLLECTION');
                        return;
                      }
                      if (!isLocked && item.menu === 'EVENTS') {
                        openBaseTab('EVENTS');
                        setGameState('EVENTS');
                      }
                    }}
                    disabled={isLocked}
                    className={`relative min-h-[64px] disabled:opacity-45 ${
                      item.menu === 'COLLECTION' || item.menu === 'EVENTS'
                        ? 'rounded-none border-0 bg-transparent shadow-none'
                        : 'rounded-xl border border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1">
                      {item.menu === 'COLLECTION' ? (
                        <img src={pokedexMenuIcon} alt="" aria-hidden="true" className="w-8 h-8 object-contain [image-rendering:pixelated]" />
                      ) : item.menu === 'EVENTS' ? (
                        <img src={eventsMenuIcon} alt="" aria-hidden="true" className="w-8 h-8 object-contain [image-rendering:pixelated]" />
                      ) : (
                        <Icon className="w-4 h-4 text-slate-700" />
                      )}
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-700">{item.label}</span>
                    </span>
                    {isLocked && (
                      <span className="absolute top-1 right-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                    {item.badge && !isLocked && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </section>
    </motion.div>
  );
}



