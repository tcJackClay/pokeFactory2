import type { BattleSnapshot, EndTurnResolutionResult } from '../battle/engine/types';

export async function presentEndTurnResolution(
  result: EndTurnResolutionResult,
  commitSnapshot: (snapshot: BattleSnapshot) => void,
  presentMessages: (messages: string[]) => Promise<void>,
): Promise<void> {
  // Team changes can clean up the calling effect before the first awaited message.
  // Commit every timer in the same synchronous step as the teams.
  commitSnapshot(result.snapshot);
  const messages = result.events
    .filter((event) => event.type === 'message')
    .map((event) => event.message);
  if (messages.length > 0) await presentMessages(messages);
}

interface CompleteEndTurnOptions {
  result: EndTurnResolutionResult;
  commitSnapshot: (snapshot: BattleSnapshot) => void;
  presentMessages: (messages: string[]) => Promise<void>;
  isCurrentBattle: () => boolean;
  shouldAnnouncePlayerFaint: () => boolean;
  playerFaintMessage: string;
  enemyFaintMessage: string;
  sendOutNextPlayer: (team: BattleSnapshot['playerTeam']) => Promise<boolean>;
  sendOutNextEnemy: (team: BattleSnapshot['enemyTeam'], faintedId: number, options?: { preservePlayerSwitchMenu?: boolean }) => Promise<boolean>;
}

export async function completeEndTurnResolution({
  result,
  commitSnapshot,
  presentMessages,
  isCurrentBattle,
  shouldAnnouncePlayerFaint,
  playerFaintMessage,
  enemyFaintMessage,
  sendOutNextPlayer,
  sendOutNextEnemy,
}: CompleteEndTurnOptions): Promise<void> {
  await presentEndTurnResolution(result, commitSnapshot, presentMessages);
  if (!isCurrentBattle()) return;

  if (result.playerLeadFainted) {
    if (shouldAnnouncePlayerFaint()) {
      await presentMessages([playerFaintMessage]);
      if (!isCurrentBattle()) return;
    }
    const playerReplaced = await sendOutNextPlayer(result.snapshot.playerTeam);
    if (!isCurrentBattle()) return;
    if (!playerReplaced) return;
  }

  if (result.enemyLeadFainted) {
    await presentMessages([enemyFaintMessage]);
    if (!isCurrentBattle()) return;
    await sendOutNextEnemy(result.snapshot.enemyTeam, result.enemyLead.id, {
      preservePlayerSwitchMenu: result.playerLeadFainted,
    });
  }
}
