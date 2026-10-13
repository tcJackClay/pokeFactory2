import type { GamePokemon, Nature, Stats } from '../../../types';

/**
 * 进化变换的「保留契约」唯一真值源（PRD 奖励商店 F4.3 / 本任务 B5）。
 *
 * 兑换进化道具时**只换物种**，绝不允许重新生成一只宝可梦。以下字段必须逐项原样保留：
 * `id`（队员身份）、等级、个体值、努力值、性格、性别、太晶属性、亲密度、
 * **原来的四招（逐招且顺序一致）**，以及三个持有道具字段。
 *
 * 允许变化的只有：物种身份（`speciesId` / `speciesName` / `pokeApiName` / `formLedgerSlug`）、
 * 图鉴数据（`sprites` / `types` / `abilities` / 图鉴数值 `stats` / 中文名 `zhName`）、
 * 物种基础值 `baseStats`，以及由这些**重算**出来的 `calculatedStats` / `maxHp` / `currentHp`。
 *
 * 本模块是纯函数、不依赖网络：`pokeApi.buildEvolvedFactoryPokemon` 负责**产生**变换，
 * `saveManager.commitFactoryEvolutionPurchase` 负责在落盘前用本模块**证明**保留契约成立，
 * 单测则直接用本模块锁定契约。三方同源，故不存在「文档说保留、代码却重新随机」的空档。
 */

export type FactoryEvolutionViolationCode =
  | 'invalid-target'
  | 'species-unchanged'
  | 'species-mismatch'
  | 'identity-changed'
  | 'level-changed'
  | 'ivs-changed'
  | 'evs-changed'
  | 'nature-changed'
  | 'gender-changed'
  | 'moves-changed'
  | 'held-item-changed'
  | 'team-length-changed'
  | 'other-teammate-changed';

export interface FactoryEvolutionViolation {
  code: FactoryEvolutionViolationCode;
  detail: string;
}

const STAT_KEYS: (keyof Stats)[] = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];

/** 招式签名 = 按顺序取 `name`（「逐招且顺序一致」的机器可判定形式）。 */
function movesSignature(moves: readonly { name?: string }[] | undefined): string {
  return (moves ?? []).map((move) => move?.name ?? '').join('\u0000');
}

function statsSignature(stats: Partial<Stats> | undefined): string {
  return STAT_KEYS.map((key) => `${key}:${Number(stats?.[key] ?? 0)}`).join('|');
}

function natureSignature(nature: Nature | undefined): string {
  return `${nature?.name ?? ''}/${nature?.plus ?? ''}/${nature?.minus ?? ''}`;
}

function heldItemSignature(pokemon: GamePokemon): string {
  return [
    pokemon.factoryEquippedHeldItemId ?? '',
    pokemon.factoryHeldItemId ?? '',
    pokemon.factoryOriginalHeldItemId ?? '',
  ].join('|');
}

function nullish(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * 单只宝可梦的保留契约校验：返回**全部**违规项（不是抛第一个），便于测试与审计逐条展示。
 */
export function findFactoryEvolutionViolations(
  previous: GamePokemon,
  next: GamePokemon,
  toSpeciesId: number,
): FactoryEvolutionViolation[] {
  const violations: FactoryEvolutionViolation[] = [];
  if (!Number.isSafeInteger(toSpeciesId) || toSpeciesId <= 0) {
    return [{ code: 'invalid-target', detail: `target species is not a positive integer: ${String(toSpeciesId)}` }];
  }
  if (previous.speciesId === toSpeciesId) {
    violations.push({ code: 'species-unchanged', detail: `already species ${toSpeciesId}` });
  }
  if (next.speciesId !== toSpeciesId) {
    violations.push({
      code: 'species-mismatch',
      detail: `expected speciesId ${toSpeciesId}, got ${nullish(next.speciesId)}`,
    });
  }
  if (next.id !== previous.id) {
    violations.push({ code: 'identity-changed', detail: `id ${nullish(previous.id)} -> ${nullish(next.id)}` });
  }
  if (next.level !== previous.level) {
    violations.push({ code: 'level-changed', detail: `level ${previous.level} -> ${next.level}` });
  }
  if (statsSignature(next.ivs) !== statsSignature(previous.ivs)) {
    violations.push({ code: 'ivs-changed', detail: `${statsSignature(previous.ivs)} -> ${statsSignature(next.ivs)}` });
  }
  if (statsSignature(next.evs) !== statsSignature(previous.evs)) {
    violations.push({ code: 'evs-changed', detail: `${statsSignature(previous.evs)} -> ${statsSignature(next.evs)}` });
  }
  if (natureSignature(next.nature) !== natureSignature(previous.nature)) {
    violations.push({
      code: 'nature-changed',
      detail: `${natureSignature(previous.nature)} -> ${natureSignature(next.nature)}`,
    });
  }
  if (nullish(next.gender) !== nullish(previous.gender)) {
    violations.push({ code: 'gender-changed', detail: `${nullish(previous.gender)} -> ${nullish(next.gender)}` });
  }
  const previousMoves = movesSignature(previous.selectedMoves);
  const nextMoves = movesSignature(next.selectedMoves);
  if (previousMoves !== nextMoves) {
    violations.push({ code: 'moves-changed', detail: `[${previousMoves.split('\u0000').join(',')}] -> [${nextMoves.split('\u0000').join(',')}]` });
  }
  if (heldItemSignature(next) !== heldItemSignature(previous)) {
    violations.push({ code: 'held-item-changed', detail: `${heldItemSignature(previous)} -> ${heldItemSignature(next)}` });
  }
  return violations;
}

/**
 * 队伍级保留契约校验：除目标队员外，**其余队员必须逐字段不变**（含长度）。
 */
export function findFactoryEvolutionTeamViolations(
  previousTeam: readonly GamePokemon[],
  nextTeam: readonly GamePokemon[],
  targetIndex: number,
  toSpeciesId: number,
): FactoryEvolutionViolation[] {
  if (nextTeam.length !== previousTeam.length) {
    return [{ code: 'team-length-changed', detail: `${previousTeam.length} -> ${nextTeam.length}` }];
  }
  if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex >= previousTeam.length) {
    return [{ code: 'invalid-target', detail: `target index out of range: ${String(targetIndex)}` }];
  }
  const violations = findFactoryEvolutionViolations(previousTeam[targetIndex], nextTeam[targetIndex], toSpeciesId);
  for (let index = 0; index < previousTeam.length; index += 1) {
    if (index === targetIndex) continue;
    if (JSON.stringify(previousTeam[index]) !== JSON.stringify(nextTeam[index])) {
      violations.push({ code: 'other-teammate-changed', detail: `teammate ${index} changed` });
    }
  }
  return violations;
}

/** 保留契约断言：任一项被破坏即抛错（落盘前的最后一道闸）。 */
export function assertFactoryEvolutionPreserved(
  previousTeam: readonly GamePokemon[],
  nextTeam: readonly GamePokemon[],
  targetIndex: number,
  toSpeciesId: number,
): void {
  const violations = findFactoryEvolutionTeamViolations(previousTeam, nextTeam, targetIndex, toSpeciesId);
  if (violations.length > 0) {
    throw new Error(`Evolution must preserve the holder verbatim: ${violations
      .map((violation) => `${violation.code}(${violation.detail})`)
      .join(', ')}`);
  }
}

/**
 * 进化后 `speciesId` 是否与「货架冻结的目标」一致。
 * 货架上的目标在冻结时已写明物种，兑换时不得偏离（防 UI 传错参数）。
 */
export function isFactoryEvolutionTarget(
  targets: readonly { targetIndex: number; toSpeciesId: number }[],
  targetIndex: number,
  toSpeciesId: number,
): boolean {
  return targets.some((target) => target.targetIndex === targetIndex && target.toSpeciesId === toSpeciesId);
}
