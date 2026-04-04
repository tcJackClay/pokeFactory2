import { Coins, Flame, Hash } from 'lucide-react';
import { APP_PALETTE } from '../../../../theme/palette';
import { FACTORY_REWARD_CONFIG, getBattleIndexInSet } from '../../config/factoryRewards';

interface TopRecordPanelProps {
  currentLanguage: string;
  coins: number;
  stage: number;
  streak: number;
}

export function TopRecordPanel({ currentLanguage, coins, stage, streak }: TopRecordPanelProps) {
  const isZh = currentLanguage.startsWith('zh');

  const copy = {
    tokens: isZh ? '代币' : 'Coins',
    round: isZh ? '轮次' : 'Round',
    streak: isZh ? '连胜' : 'Streak',
  };

  const panelStyle = {
    backgroundColor: APP_PALETTE.surface.panel,
    borderColor: APP_PALETTE.border.soft,
  };

  const chipStyle = {
    backgroundColor: APP_PALETTE.surface.panelSoft,
    borderColor: APP_PALETTE.border.soft,
  };

  const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
  const battleIndex = getBattleIndexInSet(stage, battlesPerSet);

  const items = [
    { key: 'tokens', label: copy.tokens, value: String(coins), icon: Coins, iconClass: 'text-amber-500' },
    { key: 'round', label: copy.round, value: `${battleIndex}/${battlesPerSet}`, icon: Hash, iconClass: 'text-sky-600' },
    { key: 'streak', label: copy.streak, value: String(streak), icon: Flame, iconClass: 'text-orange-500' },
  ] as const;

  return (
    <div className="rounded-xl shadow-sm border overflow-hidden" style={panelStyle}>
      <div className="h-1 bg-[linear-gradient(90deg,#ef4444_0%,#ef4444_48%,#f8fafc_50%,#2563eb_52%,#2563eb_100%)]" />
      <div className="px-2 py-1.5">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-center justify-center gap-1 px-2 py-1 border rounded-lg text-[11px] font-black text-slate-900 min-w-0"
                style={chipStyle}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className={`w-3 h-3 shrink-0 ${item.iconClass}`} />
                <span className="truncate">{item.value}</span>
                <span className="truncate text-[10px] font-semibold text-slate-500">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
