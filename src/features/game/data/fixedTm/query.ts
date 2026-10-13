import { identities, source, tms } from './generated';
import { getFixedTmAdmission } from './admission';
import type {
  FixedTmEligibility, FixedTmIdentityResult, FixedTmMember, FixedTmMemberIdentity,
  FixedTmSaleBlocker, FixedTmSaleReadiness, FixedTmTeamEligibility,
} from './types';

export { getFixedTmAdmission } from './admission';
export const catalog = Object.freeze({
  source: Object.freeze({ ...source }),
  tms: Object.freeze(tms.map((entry) => Object.freeze({ ...entry }))),
});
const byMoveName = new Map(catalog.tms.map((entry) => [entry.moveName, entry]));
const byPokemonId = new Map(identities.map((row) => [row.pokemonId, Object.freeze({ ...row, tmNumbers: Object.freeze([...row.tmNumbers]) })]));

export function resolveFixedTmIdentity(identity: FixedTmMemberIdentity): FixedTmIdentityResult {
  if (!identity || !Number.isInteger(identity.pokemonId) || identity.pokemonId <= 0 ||
      !Number.isInteger(identity.speciesId) || identity.speciesId <= 0) {
    return { status: 'unknown-identity', diagnostic: 'A positive integer pokemonId and speciesId are required.' };
  }
  const row = byPokemonId.get(identity.pokemonId);
  if (!row) return { status: 'unknown-identity', diagnostic: `No fixed-source factory mapping for pokemonId ${identity.pokemonId}.` };
  if (row.speciesId !== identity.speciesId || (identity.identifier !== undefined && row.identifier !== identity.identifier)) {
    return { status: 'identity-conflict', diagnostic: 'Provided speciesId or identifier disagrees with the mapped pokemonId.' };
  }
  return { status: 'resolved', identity: row };
}

export function getFixedTmEligibility(identity: FixedTmMemberIdentity, moveName: string, knownMoveNames: readonly string[]): FixedTmEligibility {
  const tm = byMoveName.get(moveName);
  if (!tm) return { status: 'unknown-tm', compatible: false, alreadyKnown: false, tm: null, identity: null, diagnostic: 'Move is not in the fixed TM01–TM50 table.' };
  const resolved = resolveFixedTmIdentity(identity);
  if (resolved.status !== 'resolved') return { status: resolved.status, compatible: false, alreadyKnown: false, tm, identity: null, diagnostic: resolved.diagnostic };
  const compatible = resolved.identity.tmNumbers.includes(tm.number);
  const alreadyKnown = knownMoveNames.includes(moveName);
  return {
    status: !compatible ? 'incompatible' : alreadyKnown ? 'already-known' : 'eligible',
    compatible, alreadyKnown, tm, identity: resolved.identity, diagnostic: null,
  };
}

export function listLearnableFixedTms(identity: FixedTmMemberIdentity, knownMoveNames: readonly string[]) {
  return catalog.tms.filter((tm) => getFixedTmEligibility(identity, tm.moveName, knownMoveNames).status === 'eligible');
}

export function getTeamFixedTmEligibility(members: readonly FixedTmMember[]): FixedTmTeamEligibility {
  return {
    members: members.map((member) => resolveFixedTmIdentity(member.identity)),
    tms: catalog.tms.map((tm) => ({
      tm,
      memberIndexes: members.flatMap((member, index) => getFixedTmEligibility(member.identity, tm.moveName, member.knownMoveNames).status === 'eligible' ? [index] : []),
    })).filter((row) => row.memberIndexes.length > 0),
  };
}

export function getFixedTmSaleReadiness(moveName: string, members: readonly FixedTmMember[]): FixedTmSaleReadiness {
  const admission = getFixedTmAdmission(moveName);
  if (!admission) return { saleEligible: false, admission: null, eligibleMemberIndexes: [], blockers: ['unknown-tm'] };
  const eligibleMemberIndexes = members.flatMap((member, index) => getFixedTmEligibility(member.identity, moveName, member.knownMoveNames).status === 'eligible' ? [index] : []);
  const blockers: FixedTmSaleBlocker[] = ['not-admitted', 'fixed-content-unverified', 'battle-unverified', 'price-unapproved'];
  if (eligibleMemberIndexes.length === 0) blockers.push('no-eligible-member');
  return { saleEligible: false, admission, eligibleMemberIndexes, blockers };
}
