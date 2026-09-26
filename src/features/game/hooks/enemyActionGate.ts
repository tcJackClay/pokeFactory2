export function createEnemyActionGate() {
  let claimed = false;
  return {
    claim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    reset() {
      claimed = false;
    },
  };
}
