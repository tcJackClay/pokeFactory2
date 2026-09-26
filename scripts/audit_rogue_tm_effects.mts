#!/usr/bin/env node
// Read-only review of the pinned Rogue TM table against this project's current battle loader.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import extractor from './extract_rogue_tm_compat.cjs';
import { buildMoveBattleDataFromPokeApiMove } from '../src/features/game/data/battle/index.ts';
import { MOVE_BATTLE_DATA_OVERRIDES } from '../src/features/game/data/battle/moveEffectTable.ts';

const { assertResearchOutputPath } = extractor;
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptRoot, '..');
const PINNED_SHA = 'a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014';

export const KNOWN_GAPS: Record<string, string[]> = {
  'solar-blade': ['Two-turn charging is not represented by the current move battle data or battle turn flow.'],
  'u-turn': ['Post-damage pivot switching is not represented by the current battle turn flow.'],
  'volt-switch': ['Post-damage pivot switching is not represented by the current battle turn flow.'],
  'tailwind': ['Side-wide timed speed boost is not represented in the current field or team state.'],
  'toxic-spikes': ['Entry hazard placement and switch-in poison are not represented in the current battle state.'],
  'stealth-rock': ['Entry hazard placement and switch-in damage are not represented in the current battle state.'],
  'outrage': ['Multi-turn forced use and confusion afterward are not represented in the current battle turn flow.'],
  'snowscape': ['Current override maps snow to hail; snow defense boost and hail distinction require rule review.'],
};

function option(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`Pass ${flag} <path>.`);
  return path.resolve(args[index + 1]);
}

function cachedMoves(cacheRoot: string): Map<string, { raw: any; bodySha256: string }> {
  const entries = new Map<string, { raw: any; bodySha256: string }>();
  for (const file of fs.readdirSync(cacheRoot).filter((name) => name.endsWith('.json')).sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(cacheRoot, file), 'utf8'));
    if (typeof meta.key !== 'string' || !meta.key.startsWith('move/')) continue;
    if (!/^[0-9a-f]{64}\.body$/.test(meta.file)) throw new Error(`Unsafe cache body name: ${file}`);
    const body = fs.readFileSync(path.join(cacheRoot, meta.file));
    const digest = crypto.createHash('sha256').update(body).digest('hex');
    if (digest !== meta.sha256) throw new Error(`Cache digest mismatch: ${meta.key}`);
    const raw = JSON.parse(body.toString('utf8'));
    const name = meta.key.slice(5);
    if (raw?.name !== name) throw new Error(`Cache key/body mismatch: ${meta.key}`);
    entries.set(name, { raw, bodySha256: digest });
  }
  return entries;
}

export function classifyMove(tm: string, moveSymbol: string, cached?: { raw: any; bodySha256: string }) {
  const projectMoveIdCandidate = moveSymbol.slice(5).toLowerCase().replaceAll('_', '-');
  const override = MOVE_BATTLE_DATA_OVERRIDES[projectMoveIdCandidate];
  const row: Record<string, unknown> = {
    tm,
    rogueMoveSymbol: moveSymbol,
    projectMoveIdCandidate,
    idMappingVerified: false,
    localCache: cached ? 'present' : 'missing',
    localLoader: cached ? 'pending' : 'not-tested',
    battleResolution: !cached && override ? 'dedicated-override-unloaded' : 'generic-unloaded',
    effectId: override?.effectId ?? 'NONE',
    obviousMechanismGaps: [...(KNOWN_GAPS[projectMoveIdCandidate] ?? [])],
  };
  if (!cached) {
    if (projectMoveIdCandidate === 'freeze-dry') row.obviousMechanismGaps = [...row.obviousMechanismGaps as string[], 'Local move payload is absent; FREEZE_DRY override cannot be exercised through the current local cache.'];
    if (projectMoveIdCandidate === 'quiver-dance') row.obviousMechanismGaps = [...row.obviousMechanismGaps as string[], 'Local move payload is absent; three self stat boosts cannot be checked through the current local cache.'];
    return row;
  }
  const raw = cached.raw;
  if (!Number.isInteger(raw.id) || raw.name !== projectMoveIdCandidate || !raw.type?.name || !raw.damage_class?.name) {
    row.localLoader = 'invalid-payload';
    return row;
  }
  const battle = buildMoveBattleDataFromPokeApiMove(raw);
  row.localLoader = 'buildMoveBattleDataFromPokeApiMove-ok';
  row.pokeApiMoveId = raw.id;
  row.localBodySha256 = cached.bodySha256;
  row.damageClass = raw.damage_class.name;
  row.effectId = battle.effectId;
  row.weather = battle.weather ?? null;
  row.fieldState = battle.fieldState ?? null;
  row.secondaryEffects = battle.secondaryEffects.map((effect) => ({ kind: effect.kind, appliesTo: effect.appliesTo, stat: effect.stat ?? null, change: effect.change ?? null, statusId: effect.statusId ?? null }));
  row.battleResolution = battle.effectId !== 'NONE' || battle.weather || battle.fieldState
    ? 'dedicated-effect-or-field-override'
    : 'generic-damage-or-secondary-effects';
  return row;
}

function main(args: string[]) {
  const sourceRoot = option(args, '--source');
  const cacheRoot = option(args, '--cache');
  const outputRoot = assertResearchOutputPath(option(args, '--output'), projectRoot);
  // Source revision and content digest are validated by the extraction routine.
  const { matrix } = extractor.extract(sourceRoot);
  if (matrix.source.commit !== PINNED_SHA) throw new Error('Unexpected source SHA');
  const cache = cachedMoves(cacheRoot);
  const rows = matrix.tms.map(({ tm, move }: { tm: string; move: string }) => classifyMove(tm, move, cache.get(move.slice(5).toLowerCase().replaceAll('_', '-'))));
  const counts = {
    tms: rows.length,
    localCachePresent: rows.filter((row) => row.localCache === 'present').length,
    localCacheMissing: rows.filter((row) => row.localCache === 'missing').length,
    locallyBuilt: rows.filter((row) => row.localLoader === 'buildMoveBattleDataFromPokeApiMove-ok').length,
    withDedicatedEffectOrFieldOverride: rows.filter((row) => row.battleResolution === 'dedicated-effect-or-field-override').length,
    withObviousMechanismGap: rows.filter((row) => (row.obviousMechanismGaps as string[]).length > 0).length,
  };
  if (counts.tms !== 50) throw new Error('Unexpected TM count');
  const report = {
    source: matrix.source,
    projectRevision: execFileSync('git', ['-C', projectRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    cacheRoot,
    scope: 'Static inspection of local cache payloads and buildMoveBattleDataFromPokeApiMove; no gameplay verification or authoritative Rogue-to-project ID mapping.',
    counts,
    rows,
  };
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, 'tm-effect-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputRoot, 'tm-effect-audit.md'), renderMarkdown(rows, counts));
  process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
}

export function renderMarkdown(rows: Record<string, unknown>[], counts: Record<string, number>): string {
  const header = [
    '# Rogue TM 项目战斗效果静态审查',
    '',
    `固定 TM ${counts.tms}；本地缓存 ${counts.localCachePresent}；缓存缺失 ${counts.localCacheMissing}；本地数据转换成功 ${counts.locallyBuilt}。名称转换仅为候选，所有项目 ID 和效果仍需逐项验证。`,
    '',
    '| TM | Rogue 符号 | 项目招式 ID 候选 | 本地缓存/转换 | 项目结算路径 | 明显缺口 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  const lines = rows.map((row) => `| ${row.tm} | ${row.rogueMoveSymbol} | ${row.projectMoveIdCandidate} | ${row.localCache}/${row.localLoader} | ${row.battleResolution}${row.effectId && row.effectId !== 'NONE' ? ` (${row.effectId})` : ''}${row.weather ? ` (weather:${row.weather})` : ''}${row.fieldState ? ` (field:${row.fieldState})` : ''} | ${(row.obviousMechanismGaps as string[]).join('; ') || 'No obvious gap in static scan; runtime not verified'} |`);
  return `${[...header, ...lines, ''].join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
