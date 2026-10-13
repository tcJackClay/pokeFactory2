export interface FixedTmSource {
  readonly repository: string;
  readonly commit: string;
  readonly branch: string;
  readonly profileMode: 'ordinary';
  readonly generatorVersion: number;
  readonly runtimeGeneratorVersion: number;
  readonly digestSha256: string;
}

export interface FixedTmEntry {
  readonly tm: string;
  readonly number: number;
  readonly moveName: string;
  readonly sourceMove: string;
}

export interface FixedTmMemberIdentity {
  readonly pokemonId: number;
  readonly speciesId: number;
  readonly identifier?: string;
}

export interface FixedTmIdentityRow extends FixedTmMemberIdentity {
  readonly identifier: string;
  readonly sourceAlias: string;
  readonly tmNumbers: readonly number[];
}

export type FixedTmIdentityResult =
  | { readonly status: 'resolved'; readonly identity: FixedTmIdentityRow }
  | { readonly status: 'unknown-identity' | 'identity-conflict'; readonly diagnostic: string };

export type FixedTmEligibilityStatus = 'eligible' | 'already-known' | 'incompatible' | 'unknown-identity' | 'identity-conflict' | 'unknown-tm';

export interface FixedTmEligibility {
  readonly status: FixedTmEligibilityStatus;
  readonly compatible: boolean;
  readonly alreadyKnown: boolean;
  readonly tm: FixedTmEntry | null;
  readonly identity: FixedTmIdentityRow | null;
  readonly diagnostic: string | null;
}

export interface FixedTmMember {
  readonly identity: FixedTmMemberIdentity;
  readonly knownMoveNames: readonly string[];
}

export interface FixedTmTeamEligibility {
  readonly members: readonly FixedTmIdentityResult[];
  readonly tms: readonly { readonly tm: FixedTmEntry; readonly memberIndexes: readonly number[] }[];
}

export interface FixedTmAdmission {
  readonly tm: FixedTmEntry;
  readonly status: 'pending';
  readonly fixedContentEvidence: null;
  readonly battleEvidence: null;
  readonly price: null;
}

export type FixedTmSaleBlocker = 'unknown-tm' | 'not-admitted' | 'fixed-content-unverified' | 'battle-unverified' | 'price-unapproved' | 'no-eligible-member';
export interface FixedTmSaleReadiness {
  readonly saleEligible: false;
  readonly admission: FixedTmAdmission | null;
  readonly eligibleMemberIndexes: readonly number[];
  readonly blockers: readonly FixedTmSaleBlocker[];
}
