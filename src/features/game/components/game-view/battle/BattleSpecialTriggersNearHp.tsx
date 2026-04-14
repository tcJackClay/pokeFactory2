import { motion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';
import megaTriggerIcon from '../../../../../assets/battle/mega-trigger.png';
import dynamaxTriggerIcon from '../../../../../assets/battle/dynamax-trigger.png';
import teraTriggerIcon from '../../../../../assets/battle/tera-trigger.png';
import zmoveTriggerIcon from '../../../../../assets/battle/zmove-trigger.png';

interface BattleSpecialTriggersNearHpProps extends GameViewSectionProps {
  variant?: 'panel' | 'dock';
}

export function BattleSpecialTriggersNearHp({
  viewModel,
  variant = 'panel',
}: BattleSpecialTriggersNearHpProps) {
  const {
    t,
    battleMenuTab,
    triggerBattleSpecial,
    canUseBattleSpecialByMode,
    battleSpecialUsage,
    playerTeam,
    developerMode,
  } = viewModel;
  const lead = playerTeam[0];
  const heldItemId = lead?.factoryHeldItemId?.toLowerCase() ?? '';
  const canShowMega = heldItemId.includes('ite') || heldItemId === 'red_orb' || heldItemId === 'blue_orb';
  const canShowZMove = heldItemId.endsWith('-z') || heldItemId.endsWith('_z') || heldItemId.includes('ium-z') || heldItemId.includes('ium_z');
  const forceShowInDev = developerMode;

  const triggerButtons = [
    {
      mode: 'MEGA' as const,
      icon: megaTriggerIcon,
      label: battleSpecialUsage.MEGA ? t('specialMegaUsed') : t('specialMega'),
      enabled: canUseBattleSpecialByMode.MEGA,
      activated: battleSpecialUsage.MEGA,
      visible: forceShowInDev || battleSpecialUsage.MEGA || (canUseBattleSpecialByMode.MEGA && canShowMega),
    },
    {
      mode: 'DYNAMAX' as const,
      icon: dynamaxTriggerIcon,
      label: battleSpecialUsage.DYNAMAX ? t('specialDynamaxUsed') : t('specialDynamax'),
      enabled: canUseBattleSpecialByMode.DYNAMAX,
      activated: battleSpecialUsage.DYNAMAX,
      visible: forceShowInDev || battleSpecialUsage.DYNAMAX || canUseBattleSpecialByMode.DYNAMAX,
    },
    {
      mode: 'TERA' as const,
      icon: teraTriggerIcon,
      label: battleSpecialUsage.TERA ? t('specialTeraUsed') : t('specialTera'),
      enabled: canUseBattleSpecialByMode.TERA,
      activated: battleSpecialUsage.TERA,
      visible: forceShowInDev || battleSpecialUsage.TERA || canUseBattleSpecialByMode.TERA,
    },
    {
      mode: 'ZMOVE' as const,
      icon: zmoveTriggerIcon,
      label: battleSpecialUsage.ZMOVE ? t('specialZMoveUsed') : t('specialZMove'),
      enabled: canUseBattleSpecialByMode.ZMOVE,
      activated: battleSpecialUsage.ZMOVE,
      visible: forceShowInDev || battleSpecialUsage.ZMOVE || (canUseBattleSpecialByMode.ZMOVE && canShowZMove),
    },
  ];
  const isDock = variant === 'dock';
  const visibleButtons = triggerButtons.filter((button) => button.visible);
  const specialTriggersInteractive = battleMenuTab === 'MAIN' || battleMenuTab === 'MOVES';

  if (visibleButtons.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      className={
        isDock
          ? 'pf-battle-trigger-dock shrink-0 self-end px-1.5 py-1.5'
          : 'flex h-full min-h-[110px] flex-col justify-between rounded-[18px] border border-slate-200 bg-white/86 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.90)]'
      }
    >
      <div className={isDock ? 'flex items-center gap-1.5' : 'grid grid-cols-4 gap-2'}>
        {visibleButtons.map((button) => (
          <button
            key={button.mode}
            title={button.label}
            aria-label={button.label}
            onClick={() => void triggerBattleSpecial(button.mode)}
            disabled={!button.enabled || !specialTriggersInteractive}
            className={`relative overflow-hidden transition-all p-0 border-0 shadow-none ${
              isDock
                ? 'h-9 w-9 rounded-[8px] bg-transparent sm:h-10 sm:w-10'
                : 'h-14 w-14 rounded-[10px] bg-transparent sm:h-16 sm:w-16'
            } ${
              button.enabled && specialTriggersInteractive
                ? 'hover:-translate-y-[1px] hover:brightness-110'
                : 'cursor-not-allowed opacity-60 saturate-50'
            } ${
              button.activated && isDock ? 'ring-1 ring-violet-500 ring-offset-1 ring-offset-white' : ''
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
    </motion.div>
  );
}
