import { Coins, Flame, Hash } from 'lucide-react';
import { APP_PALETTE } from '../../../../theme/palette';
import { FACTORY_REWARD_CONFIG, getBattleIndexInSet } from '../../config/factoryRewards';
import './topRecordPanel.css';

const RECORD_LABELS = {
  'zh-hans': { round: '轮次', streak: '连胜' },
  'zh-hant': { round: '輪次', streak: '連勝' },
  en: { round: 'Round', streak: 'Streak' },
} as const;

interface TopRecordPanelProps {
  currentLanguage: string;
  coins: number;
  stage: number;
  streak: number;
  battleIndexOverride?: number;
}

export function TopRecordPanel({ currentLanguage, coins, stage, streak, battleIndexOverride }: TopRecordPanelProps) {
  const labels = RECORD_LABELS[currentLanguage === 'zh-hant' ? 'zh-hant' : currentLanguage.startsWith('zh') ? 'zh-hans' : 'en'];

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
    { key: 'bp', label: 'BP', value: String(coins), icon: Coins, iconClass: 'text-amber-500' },
    { key: 'round', label: labels.round, value: `${battleIndex}/${battlesPerSet}`, icon: Hash, iconClass: 'text-sky-600' },
    { key: 'streak', label: labels.streak, value: String(streak), icon: Flame, iconClass: 'text-orange-500' },
  ] as const;

  return (
    <div className="pf-top-record-panel pf-panel overflow-hidden" style={panelStyle}>
      <div className="h-1.5 bg-[linear-gradient(90deg,#ef4444_0%,#ef4444_38%,#f8fafc_50%,#2563eb_62%,#2563eb_100%)]" />
      <div className="px-3 py-2">
        <div className="pf-top-record-grid grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="pf-top-record-chip pf-hud-chip min-w-0"
                style={chipStyle}
                aria-label={item.label}
              >
                <div className="pf-top-record-label">
                  <Icon aria-hidden="true" className={`pf-top-record-icon ${item.iconClass}`} />
                  <span>{item.label}</span>
                </div>
                <div className="pf-top-record-value pf-data-value">{item.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
