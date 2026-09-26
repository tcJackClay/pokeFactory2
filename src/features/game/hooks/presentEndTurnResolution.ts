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
