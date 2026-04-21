import type { GamePokemon, Move } from '../../../../types';
import { clearVolatileStatus, getVolatileStatus, hasVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';

export interface ProtectionMoveResult {
  pokemon: GamePokemon;
  succeeded: boolean;
}

export interface ProtectionCollisionResult {
  attacker: GamePokemon;
  messages: string[];
  hpChange: number;
}

function clampProtectChainCounter(counter?: number) {
  return Math.max(0, Math.min(30, counter ?? 0));
}

function isProtectionMove(move: Move | null | undefined) {
  const effectId = move?.battleData?.effectId;
  return effectId === 'PROTECT'
    || effectId === 'DETECT'
    || effectId === 'KINGS_SHIELD'
    || effectId === 'SPIKY_SHIELD';
}

function getProtectSuccessChance(chainCounter: number) {
  if (chainCounter <= 0) return 1;
  return 1 / (2 ** chainCounter);
}

export function clearProtectionChain(pokemon: GamePokemon) {
  if (!hasVolatileStatus(pokemon, 'protect_chain')) return pokemon;
  return clearVolatileStatus(pokemon, 'protect_chain');
}

export function resolveProtectionMoveUse(
  pokemon: GamePokemon,
  move: Move,
  random: () => number = Math.random,
): ProtectionMoveResult {
  if (!isProtectionMove(move)) {
    return {
      pokemon: clearProtectionChain(pokemon),
      succeeded: false,
    };
  }

  const chainCounter = clampProtectChainCounter(getVolatileStatus(pokemon, 'protect_chain')?.counter);
  const succeeded = random() < getProtectSuccessChance(chainCounter);
  const nextChainCounter = chainCounter + 1;
  let nextPokemon = setVolatileStatus(pokemon, 'protect_chain', {
    counter: nextChainCounter,
  });

  if (!succeeded) {
    nextPokemon = clearVolatileStatus(nextPokemon, 'protect');
    return {
      pokemon: nextPokemon,
      succeeded: false,
    };
  }

  nextPokemon = setVolatileStatus(nextPokemon, 'protect', {
    turnsRemaining: 1,
    sourceMoveName: move.name,
  });
  return {
    pokemon: nextPokemon,
    succeeded: true,
  };
}

export function resolveProtectionCollision(
  attacker: GamePokemon,
  defender: GamePokemon,
  move: Move,
): ProtectionCollisionResult {
  const protectState = getVolatileStatus(defender, 'protect');
  if (!protectState || !move.battleData?.makesContact) {
    return {
      attacker,
      messages: [],
      hpChange: 0,
    };
  }

  if (protectState.sourceMoveName === 'kings-shield') {
    const nextAttackStage = Math.max(-6, attacker.statStages.attack - 2);
    if (nextAttackStage === attacker.statStages.attack) {
      return {
        attacker,
        messages: [],
        hpChange: 0,
      };
    }
    return {
      attacker: {
        ...attacker,
        statStages: {
          ...attacker.statStages,
          attack: nextAttackStage,
        },
      },
      messages: [`${attacker.name}'s Attack harshly fell!`],
      hpChange: 0,
    };
  }

  if (protectState.sourceMoveName === 'spiky-shield' && attacker.currentHp > 0) {
    const chipDamage = Math.max(1, Math.floor(attacker.maxHp / 8));
    const nextHp = Math.max(0, attacker.currentHp - chipDamage);
    return {
      attacker: {
        ...attacker,
        currentHp: nextHp,
      },
      messages: [`${attacker.name} was hurt by Spiky Shield!`],
      hpChange: nextHp - attacker.currentHp,
    };
  }

  return {
    attacker,
    messages: [],
    hpChange: 0,
  };
}
