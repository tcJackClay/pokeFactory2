import type { AbilityBattleData } from '../../../../types';

export const ABILITY_BATTLE_DATA: Record<string, AbilityBattleData> = {
  'early-bird': { id: 'early-bird', effectId: 'EARLY_BIRD', hooks: ['sleep-turn-modifier'] },
  'battle-armor': { id: 'battle-armor', effectId: 'BATTLE_ARMOR', hooks: ['crit-immunity'] },
  'skill-link': { id: 'skill-link', effectId: 'SKILL_LINK', hooks: ['multi-hit-max-roll'] },
  soundproof: { id: 'soundproof', effectId: 'SOUNDPROOF', hooks: ['uproar-immunity'] },
  'shell-armor': { id: 'shell-armor', effectId: 'SHELL_ARMOR', hooks: ['crit-immunity'] },
  comatose: { id: 'comatose', effectId: 'COMATOSE', hooks: ['sleep-state-override'] },
  insomnia: { id: 'insomnia', effectId: 'INSOMNIA', hooks: ['sleep-immunity'] },
  'vital-spirit': { id: 'vital-spirit', effectId: 'VITAL_SPIRIT', hooks: ['sleep-immunity'] },
  'purifying-salt': { id: 'purifying-salt', effectId: 'PURIFYING_SALT', hooks: ['status-immunity-partial'] },
  oblivious: { id: 'oblivious', effectId: 'OBLIVIOUS', hooks: ['attract-immunity'] },
};
