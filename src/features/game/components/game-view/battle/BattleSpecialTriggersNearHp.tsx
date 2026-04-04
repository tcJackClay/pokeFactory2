import { motion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';
import megaTriggerIcon from '../../../../../assets/battle/mega-trigger.png';
import dynamaxTriggerIcon from '../../../../../assets/battle/dynamax-trigger.png';
import teraTriggerIcon from '../../../../../assets/battle/tera-trigger.png';
import zmoveTriggerIcon from '../../../../../assets/battle/tera-trigger.png';

export function BattleSpecialTriggersNearHp({ viewModel }: GameViewSectionProps) {
  const {
    t,
    battleMenuTab,
    triggerBattleSpecial,
    canUseBattleSpecialByMode,
    specialModeUnlocked,
    battleSpecialUsage,
  } = viewModel;

  const triggerButtons = [
    {
      mode: 'MEGA' as const,
      icon: megaTriggerIcon,
      label: battleSpecialUsage.MEGA ? t('specialMegaUsed') : t('specialMega'),
      enabled: canUseBattleSpecialByMode.MEGA,
      activated: battleSpecialUsage.MEGA,
    },
    {
      mode: 'DYNAMAX' as const,
      icon: dynamaxTriggerIcon,
      label: battleSpecialUsage.DYNAMAX ? t('specialDynamaxUsed') : t('specialDynamax'),
      enabled: canUseBattleSpecialByMode.DYNAMAX,
      activated: battleSpecialUsage.DYNAMAX,
    },
    {
      mode: 'TERA' as const,
      icon: teraTriggerIcon,
      label: battleSpecialUsage.TERA ? t('specialTeraUsed') : t('specialTera'),
      enabled: canUseBattleSpecialByMode.TERA,
      activated: battleSpecialUsage.TERA,
    },
    {
      mode: 'ZMOVE' as const,
      icon: zmoveTriggerIcon,
      label: battleSpecialUsage.ZMOVE ? t('specialZMoveUsed') : t('specialZMove'),
      enabled: canUseBattleSpecialByMode.ZMOVE,
      activated: battleSpecialUsage.ZMOVE,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full min-h-[110px] p-1 flex flex-col justify-between"
    >
      <div className="grid grid-cols-4 gap-2">
        {triggerButtons.map((button) => (
          <button
            key={button.mode}
            title={button.label}
            aria-label={button.label}
            onClick={() => void triggerBattleSpecial(button.mode)}
            disabled={!button.enabled || battleMenuTab !== 'MAIN'}
            className={`relative overflow-hidden transition-all w-14 h-14 sm:w-16 sm:h-16 p-0 border-0 bg-transparent shadow-none ${
              button.enabled && battleMenuTab === 'MAIN'
                ? 'hover:-translate-y-[1px] hover:brightness-110'
                : 'cursor-not-allowed'
            }`}
          >
            <span
              className="block h-full w-full [image-rendering:pixelated]"
              style={{
                backgroundImage: `url(${button.icon})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 200%',
                backgroundPosition: button.activated ? 'center bottom' : 'center top',
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 text-center text-[8px] font-black tracking-wide text-slate-700">
        {specialModeUnlocked ? t('specialTriggerHint') : t('specialLocked')}
      </div>
    </motion.div>
  );
}
