import { Coins, Flame, Hash } from 'lucide-react';
import { APP_PALETTE } from '../../../../theme/palette';
import { FACTORY_REWARD_CONFIG, getBattleIndexInSet } from '../../config/factoryRewards';

interface TopRecordPanelProps {
  currentLanguage: string;
  coins: number;
  stage: number;
  streak: number;
  battleIndexOverride?: number;
}

export function TopRecordPanel({ currentLanguage, coins, stage, streak, battleIndexOverride }: TopRecordPanelProps) {
  const isZh = currentLanguage.startsWith('zh');

  const panelStyle = {
    backgroundColor: APP_PALETTE.surface.panel,
    borderColor: APP_PALETTE.border.soft,
    boxShadow: APP_PALETTE.shadow.panel,
  };

  const chipStyle = {
    backgroundColor: APP_PALETTE.surface.panelSoft,
    borderColor: APP_PALETTE.border.soft,
  };

  const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
  const battleIndex = battleIndexOverride ?? getBattleIndexInSet(stage, battlesPerSet);

  const items = [
    { key: 'tokens', label: isZh ? '代币' : 'Coins', value: String(coins), icon: Coins, iconClass: 'text-amber-500' },
    { key: 'round', label: isZh ? '轮次' : 'Round', value: `${battleIndex}/${battlesPerSet}`, icon: Hash, iconClass: 'text-sky-600' },
    { key: 'streak', label: isZh ? '连胜' : 'Streak', value: String(streak), icon: Flame, iconClass: 'text-orange-500' },
  ] as const;

  return (
    <div className="pf-panel overflow-hidden" style={panelStyle}>
      <div className="h-1.5 bg-[linear-gradient(90deg,#ef4444_0%,#ef4444_38%,#f8fafc_50%,#2563eb_62%,#2563eb_100%)]" />
      <div className="px-3 py-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="pf-hud-chip min-w-0 px-2.5 py-2"
                style={chipStyle}
                title={item.label}
                aria-label={item.label}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white shadow-sm">
                    <Icon className={`h-3.5 w-3.5 ${item.iconClass}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="pf-data-value truncate">{item.value}</div>
                    <div className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{item.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
