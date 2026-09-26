export function createEnemyActionGate() {
  let claimed = false;
  let battleEpoch: number | null = null;
  return {
    claim(epoch: number) {
      if (battleEpoch !== epoch) {
        battleEpoch = epoch;
        claimed = false;
      }
      if (claimed) return false;
      claimed = true;
      return true;
    },
    reset() {
      claimed = false;
    },
  };
}
