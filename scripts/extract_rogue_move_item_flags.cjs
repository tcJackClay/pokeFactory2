#!/usr/bin/env node
// Offline, pinned ordinary-table extraction. This does not admit moves for sale/play.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const SOURCE_SHA = 'a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014';
const FILES = Object.freeze({
  'src/data/battle_moves.h': 'ae86f6c1ef686d0d006a543993aaf057c977c00ae5f26c98e31f377e4b90830a',
  'include/config.h': '61d097bd53b92dbb4f8b37b437a91f8c02dc26868a750cf9fe73742d4f002d15',
  'include/config/battle.h': '60ffd9c880da2f409e781b26f893e476c5ca735da88225d3852df4b095b48d5d',
  'include/constants/moves.h': 'a9f338c30d45bc4c4daff9c6f4cd5aa099b235bb0bf9985481d117a4a3049398',
});
const FIELDS = ['makesContact', 'ignoresKingsRock', 'sheerForceBoost', 'healBlockBanned'];
const API_SOURCE = Object.freeze({
  repository: 'PokeAPI/pokeapi',
  sha: '81d20919845b6a445969b9265aab5cec6b04cece',
  url: 'https://raw.githubusercontent.com/PokeAPI/pokeapi/81d20919845b6a445969b9265aab5cec6b04cece/data/v2/csv/moves.csv',
  sha256: '8aafd37bf78f19471495c05b201545180f50f0a08a2a2a844d69f9837dd39ac9',
});
// Vetted identifiers from the above CSV; numeric Rogue IDs are NOT PokeAPI IDs.
const API_SLUGS = new Set(`
10-000-000-volt-thunderbolt absorb accelerock acid acid-armor acid-downpour--physical acid-downpour--special acid-spray
acrobatics acupressure aerial-ace aeroblast after-you agility air-cutter air-slash
all-out-pummeling--physical all-out-pummeling--special alluring-voice ally-switch amnesia anchor-shot ancient-power apple-acid
aqua-cutter aqua-jet aqua-ring aqua-step aqua-tail arm-thrust armor-cannon aromatherapy
aromatic-mist assist assurance astonish astral-barrage attack-order attract aura-sphere
aura-wheel aurora-beam aurora-veil autotomize avalanche axe-kick baby-doll-eyes baddy-bad
baneful-bunker barb-barrage barrage barrier baton-pass beak-blast beat-up behemoth-bash
behemoth-blade belch belly-drum bestow bide bind bite bitter-blade
bitter-malice black-hole-eclipse--physical black-hole-eclipse--special blast-burn blaze-kick blazing-torque bleakwind-storm blizzard
block blood-moon bloom-doom--physical bloom-doom--special blue-flare body-press body-slam bolt-beak
bolt-strike bone-club bone-rush bonemerang boomburst bounce bouncy-bubble branch-poke
brave-bird breaking-swipe breakneck-blitz--physical breakneck-blitz--special brick-break brine brutal-swing bubble
bubble-beam bug-bite bug-buzz bulk-up bulldoze bullet-punch bullet-seed burn-up
burning-bulwark burning-jealousy buzzy-buzz calm-mind camouflage captivate catastropika ceaseless-edge
celebrate charge charge-beam charm chatter chilling-water chilly-reception chip-away
chloroblast circle-throw clamp clanging-scales clangorous-soul clangorous-soulblaze clear-smog close-combat
coaching coil collision-course combat-torque comet-punch comeuppance confide confuse-ray
confusion constrict continental-crush--physical continental-crush--special conversion conversion-2 copycat core-enforcer
corkscrew-crash--physical corkscrew-crash--special corrosive-gas cosmic-power cotton-guard cotton-spore counter court-change
covet crabhammer crafty-shield cross-chop cross-poison crunch crush-claw crush-grip
curse cut dark-pulse dark-void darkest-lariat dazzling-gleam decorate defend-order
defense-curl defog destiny-bond detect devastating-drake--physical devastating-drake--special diamond-storm dig
dire-claw disable disarming-voice discharge dive dizzy-punch doodle doom-desire
double-edge double-hit double-iron-bash double-kick double-shock double-slap double-team draco-meteor
dragon-ascent dragon-breath dragon-cheer dragon-claw dragon-dance dragon-darts dragon-energy dragon-hammer
dragon-pulse dragon-rage dragon-rush dragon-tail drain-punch draining-kiss dream-eater drill-peck
drill-run drum-beating dual-chop dual-wingbeat dynamax-cannon dynamic-punch earth-power earthquake
echoed-voice eerie-impulse eerie-spell egg-bomb electric-terrain electrify electro-ball electro-drift
electro-shot electroweb embargo ember encore endeavor endure energy-ball
entrainment eruption esper-wing eternabeam expanding-force explosion extrasensory extreme-evoboost
extreme-speed facade fairy-lock fairy-wind fake-out fake-tears false-surrender false-swipe
feather-dance feint feint-attack fell-stinger fickle-beam fiery-dance fiery-wrath fillet-away
final-gambit fire-blast fire-fang fire-lash fire-pledge fire-punch fire-spin first-impression
fishious-rend fissure flail flame-burst flame-charge flame-wheel flamethrower flare-blitz
flash flash-cannon flatter fleur-cannon fling flip-turn floaty-fall floral-healing
flower-shield flower-trick fly flying-press focus-blast focus-energy focus-punch follow-me
force-palm foresight forests-curse foul-play freeze-dry freeze-shock freezing-glare freezy-frost
frenzy-plant frost-breath frustration fury-attack fury-cutter fury-swipes fusion-bolt fusion-flare
future-sight gastro-acid gear-grind gear-up genesis-supernova geomancy giga-drain giga-impact
gigaton-hammer gigavolt-havoc--physical gigavolt-havoc--special glacial-lance glaciate glaive-rush glare glitzy-glow
grass-knot grass-pledge grass-whistle grassy-glide grassy-terrain grav-apple gravity growl
growth grudge guard-split guard-swap guardian-of-alola guillotine gunk-shot gust
gyro-ball hail hammer-arm happy-hour hard-press harden haze head-charge
head-smash headbutt headlong-rush heal-bell heal-block heal-order heal-pulse healing-wish
heart-stamp heart-swap heat-crash heat-wave heavy-slam helping-hand hex hidden-power
high-horsepower high-jump-kick hold-back hold-hands hone-claws horn-attack horn-drill horn-leech
howl hurricane hydro-cannon hydro-pump hydro-steam hydro-vortex--physical hydro-vortex--special hyper-beam
hyper-drill hyper-fang hyper-voice hyperspace-fury hyperspace-hole hypnosis ice-ball ice-beam
ice-burn ice-fang ice-hammer ice-punch ice-shard ice-spinner icicle-crash icicle-spear
icy-wind imprison incinerate infernal-parade inferno inferno-overdrive--physical inferno-overdrive--special infestation
ingrain instruct ion-deluge iron-defense iron-head iron-tail ivy-cudgel jaw-lock
jet-punch judgment jump-kick jungle-healing karate-chop kinesis kings-shield knock-off
kowtow-cleave lands-wrath laser-focus lash-out last-resort last-respects lava-plume leaf-blade
leaf-storm leaf-tornado leafage leech-life leech-seed leer lets-snuggle-forever lick
life-dew light-of-ruin light-screen light-that-burns-the-sky liquidation lock-on lovely-kiss low-kick
low-sweep lucky-chant lumina-crash lunar-blessing lunar-dance lunge luster-purge mach-punch
magic-coat magic-powder magic-room magical-leaf magical-torque magma-storm magnet-bomb magnet-rise
magnetic-flux magnitude make-it-rain malicious-moonsault malignant-chain mat-block matcha-gotcha max-airstream
max-darkness max-flare max-flutterby max-geyser max-guard max-hailstorm max-knuckle max-lightning
max-mindstorm max-ooze max-overgrowth max-phantasm max-quake max-rockfall max-starfall max-steelspike
max-strike max-wyrmwind me-first mean-look meditate mega-drain mega-kick mega-punch
megahorn memento menacing-moonraze-maelstrom metal-burst metal-claw metal-sound meteor-assault meteor-beam
meteor-mash metronome mighty-cleave milk-drink mimic mind-blown mind-reader minimize
miracle-eye mirror-coat mirror-move mirror-shot mist mist-ball misty-explosion misty-terrain
moonblast moongeist-beam moonlight morning-sun mortal-spin mountain-gale mud-bomb mud-shot
mud-slap mud-sport muddy-water multi-attack mystical-fire mystical-power nasty-plot natural-gift
nature-power natures-madness needle-arm never-ending-nightmare--physical never-ending-nightmare--special night-daze night-shade night-slash
nightmare no-retreat noble-roar noxious-torque nuzzle oblivion-wing obstruct oceanic-operetta
octazooka octolock odor-sleuth ominous-wind order-up origin-pulse outrage overdrive
overheat pain-split parabolic-charge parting-shot pay-day payback peck perish-song
petal-blizzard petal-dance phantom-force photon-geyser pika-papow pin-missile plasma-fists play-nice
play-rough pluck poison-fang poison-gas poison-jab poison-powder poison-sting poison-tail
pollen-puff poltergeist population-bomb pounce pound powder powder-snow power-gem
power-shift power-split power-swap power-trick power-trip power-up-punch power-whip precipice-blades
present prismatic-laser protect psybeam psyblade psych-up psychic psychic-fangs
psychic-noise psychic-terrain psycho-boost psycho-cut psycho-shift psyshield-bash psyshock psystrike
psywave pulverizing-pancake punishment purify pursuit pyro-ball quash quick-attack
quick-guard quiver-dance rage rage-fist rage-powder raging-bull raging-fury rain-dance
rapid-spin razor-leaf razor-shell razor-wind recover recycle reflect reflect-type
refresh relic-song rest retaliate return revelation-dance revenge reversal
revival-blessing rising-voltage roar roar-of-time rock-blast rock-climb rock-polish rock-slide
rock-smash rock-throw rock-tomb rock-wrecker role-play rolling-kick rollout roost
rototiller round ruination sacred-fire sacred-sword safeguard salt-cure sand-attack
sand-tomb sandsear-storm sandstorm sappy-seed savage-spin-out--physical savage-spin-out--special scald scale-shot
scary-face scorching-sands scratch screech searing-shot searing-sunraze-smash secret-power secret-sword
seed-bomb seed-flare seismic-toss self-destruct shadow-ball shadow-blast shadow-blitz shadow-bolt
shadow-bone shadow-break shadow-chill shadow-claw shadow-down shadow-end shadow-fire shadow-force
shadow-half shadow-hold shadow-mist shadow-panic shadow-punch shadow-rave shadow-rush shadow-shed
shadow-sky shadow-sneak shadow-storm shadow-wave sharpen shattered-psyche--physical shattered-psyche--special shed-tail
sheer-cold shell-side-arm shell-smash shell-trap shelter shift-gear shock-wave shore-up
signal-beam silk-trap silver-wind simple-beam sing sinister-arrow-raid sizzly-slide sketch
skill-swap skitter-smack skull-bash sky-attack sky-drop sky-uppercut slack-off slam
slash sleep-powder sleep-talk sludge sludge-bomb sludge-wave smack-down smart-strike
smelling-salts smog smokescreen snap-trap snarl snatch snipe-shot snore
snowscape soak soft-boiled solar-beam solar-blade sonic-boom soul-stealing-7-star-strike spacial-rend
spark sparkling-aria sparkly-swirl spectral-thief speed-swap spicy-extract spider-web spike-cannon
spikes spiky-shield spin-out spirit-break spirit-shackle spit-up spite splash
splintered-stormshards splishy-splash spore spotlight springtide-storm stealth-rock steam-eruption steamroller
steel-beam steel-roller steel-wing sticky-web stockpile stoked-sparksurfer stomp stomping-tantrum
stone-axe stone-edge stored-power storm-throw strange-steam strength strength-sap string-shot
struggle struggle-bug stuff-cheeks stun-spore submission substitute subzero-slammer--physical subzero-slammer--special
sucker-punch sunny-day sunsteel-strike super-fang supercell-slam superpower supersonic supersonic-skystrike--physical
supersonic-skystrike--special surf surging-strikes swagger swallow sweet-kiss sweet-scent swift
switcheroo swords-dance synchronoise synthesis syrup-bomb tachyon-cutter tackle tail-glow
tail-slap tail-whip tailwind take-down take-heart tar-shot taunt tearful-look
teatime techno-blast tectonic-rage--physical tectonic-rage--special teeter-dance telekinesis teleport temper-flare
tera-blast tera-starstorm terrain-pulse thief thousand-arrows thousand-waves thrash throat-chop
thunder thunder-cage thunder-fang thunder-punch thunder-shock thunder-wave thunderbolt thunderclap
thunderous-kick tickle tidy-up topsy-turvy torch-song torment toxic toxic-spikes
toxic-thread trailblaze transform tri-attack trick trick-or-treat trick-room triple-arrows
triple-axel triple-dive triple-kick trop-kick trump-card twin-beam twineedle twinkle-tackle--physical
twinkle-tackle--special twister u-turn upper-hand uproar v-create vacuum-wave veevee-volley
venom-drench venoshock vice-grip victory-dance vine-whip vital-throw volt-switch volt-tackle
wake-up-slap water-gun water-pledge water-pulse water-shuriken water-sport water-spout waterfall
wave-crash weather-ball whirlpool whirlwind wicked-blow wicked-torque wide-guard wild-charge
wildbolt-storm will-o-wisp wing-attack wish withdraw wonder-room wood-hammer work-up
worry-seed wrap wring-out x-scissor yawn zap-cannon zen-headbutt zing-zap
zippy-zap
`.trim().split(/\s+/));
const Z_SPLITS = new Set([
  'BREAKNECK_BLITZ', 'ALL_OUT_PUMMELING', 'SUPERSONIC_SKYSTRIKE', 'ACID_DOWNPOUR',
  'TECTONIC_RAGE', 'CONTINENTAL_CRUSH', 'SAVAGE_SPIN_OUT', 'NEVER_ENDING_NIGHTMARE',
  'CORKSCREW_CRASH', 'INFERNO_OVERDRIVE', 'HYDRO_VORTEX', 'BLOOM_DOOM', 'GIGAVOLT_HAVOC',
  'SHATTERED_PSYCHE', 'SUBZERO_SLAMMER', 'DEVASTATING_DRAKE', 'BLACK_HOLE_ECLIPSE', 'TWINKLE_TACKLE',
]);
const CONFIG_NAMES = ['B_UPDATED_MOVE_DATA', 'B_UPDATED_MOVE_TYPES', 'B_UPDATED_MOVE_FLAGS', 'B_GROWTH_STAT_RAISE', 'B_HEAL_BLOCKING'];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');

function definitions(text) {
  const result = new Map([['TRUE', '1'], ['FALSE', '0']]);
  for (const [, name, value] of stripComments(text).matchAll(/^\s*#define\s+([A-Z][A-Z0-9_]*)[ \t]+([^\n]+)$/gm)) {
    // Unrelated conditional config definitions need not be interpreted. A referenced
    // conflicting definition is rejected by evaluate, never chosen arbitrarily.
    if (result.has(name) && result.get(name) !== value.trim()) result.set(name, null);
    else result.set(name, value.trim());
  }
  return result;
}

// Deliberately small C integer-expression grammar: no eval, functions, or silent defaults.
function evaluate(expression, macros, visiting = new Set()) {
  const tokens = expression.match(/\s+|\|\||&&|==|!=|>=|<=|[()+!<>-]|\d+|[A-Z][A-Z0-9_]*/g) ?? [];
  assert(tokens.join('') === expression, `Unsupported expression: ${expression}`);
  const input = tokens.filter((token) => !/^\s+$/.test(token));
  let i = 0;
  function atom() {
    const token = input[i++];
    if (token === '!') return Number(!atom());
    if (token === '(') { const value = or(); assert(input[i++] === ')', `Unclosed expression: ${expression}`); return value; }
    if (/^\d+$/.test(token ?? '')) return Number(token);
    assert(token && macros.has(token), `Unknown macro ${token} in ${expression}`);
    assert(macros.get(token) !== null, `Conflicting macro ${token}`);
    assert(!visiting.has(token), `Macro cycle: ${token}`);
    const next = new Set(visiting); next.add(token);
    return evaluate(macros.get(token), macros, next);
  }
  function sum() { let value = atom(); while (input[i] === '+' || input[i] === '-') { const op = input[i++]; const rhs = atom(); value = op === '+' ? value + rhs : value - rhs; } return value; }
  function comparison() {
    let value = sum();
    while (['==', '!=', '>=', '<=', '>', '<'].includes(input[i])) {
      const op = input[i++]; const rhs = sum();
      value = Number(op === '==' ? value === rhs : op === '!=' ? value !== rhs : op === '>=' ? value >= rhs : op === '<=' ? value <= rhs : op === '>' ? value > rhs : value < rhs);
    }
    return value;
  }
  function and() { let value = comparison(); while (input[i] === '&&') { i++; const rhs = comparison(); value = Number(Boolean(value) && Boolean(rhs)); } return value; }
  function or() { let value = and(); while (input[i] === '||') { i++; const rhs = and(); value = Number(Boolean(value) || Boolean(rhs)); } return value; }
  const value = or(); assert(i === input.length, `Trailing expression input: ${expression}`); return value;
}

function preprocess(text, macros) {
  const stack = []; const out = []; let active = true;
  for (const line of stripComments(text).split('\n')) {
    const directive = line.match(/^\s*#(\w+)\b(.*)$/);
    if (!directive) { if (active) out.push(line); continue; }
    const [, kind, tail] = directive;
    if (kind === 'include') { assert(tail.trim() === '"battle_scripts.h"', `Unknown include: ${tail}`); continue; }
    if (kind === 'if') {
      const condition = Boolean(evaluate(tail.trim(), macros));
      stack.push({ parent: active, matched: condition, hasElse: false }); active = active && condition;
    } else if (kind === 'elif') {
      const top = stack.at(-1); assert(top && !top.hasElse, 'Unexpected #elif');
      const condition = Boolean(evaluate(tail.trim(), macros)); active = top.parent && !top.matched && condition; top.matched ||= condition;
    } else if (kind === 'else') {
      const top = stack.at(-1); assert(top && !top.hasElse && !tail.trim(), 'Unexpected #else');
      active = top.parent && !top.matched; top.matched = true; top.hasElse = true;
    } else if (kind === 'endif') {
      assert(stack.length && !tail.trim(), 'Unexpected #endif'); active = stack.pop().parent;
    } else throw new Error(`Unsupported directive: ${kind}`);
  }
  assert(stack.length === 0, 'Unclosed conditional'); return out.join('\n');
}

function parseMoves(text, macros) {
  const clean = preprocess(text, macros);
  const table = clean.match(/^\s*const struct BattleMove gBattleMoves_Mainline\[MOVES_COUNT_DYNAMAX\]\s*=\s*\{([\s\S]*)\};\s*$/);
  assert(table, 'Ordinary move table missing or trailing source');
  const rows = []; const seen = new Set();
  const body = table[1].replace(/\[(MOVE_[A-Z0-9_]+)\]\s*=\s*\{([^{}]*)\}\s*,/g, (_, symbol, fields) => {
    assert(!seen.has(symbol), `Duplicate move ${symbol}`); seen.add(symbol);
    const flags = Object.fromEntries(FIELDS.map((field) => [field, false])); const assigned = new Set();
    const remainder = fields.replace(/\.([A-Za-z][A-Za-z0-9_]*)\s*=\s*([^,]+)(?:,|$)/g, (assignment, name, value) => {
      assert(!/\.[A-Za-z][A-Za-z0-9_]*\s*=/.test(value), `Missing field separator: ${symbol}.${name}`);
      assert(!assigned.has(name), `Duplicate field ${symbol}.${name}`); assigned.add(name);
      if (FIELDS.includes(name)) { const resolved = evaluate(value.trim(), macros); assert(resolved === 0 || resolved === 1, `Not boolean: ${symbol}.${name}`); flags[name] = Boolean(resolved); }
      return '';
    });
    assert(!remainder.trim(), `Unparsed fields: ${symbol}`); rows.push({ symbol, flags }); return '';
  });
  assert(!body.trim(), 'Unparsed move table rows'); return rows;
}

function mapSlugs(symbol) {
  assert(/^MOVE_[A-Z0-9_]+$/.test(symbol), `Invalid symbol ${symbol}`);
  if (symbol === 'MOVE_NONE') return { slugs: [], excluded: 'Sentinel, not a move' };
  if (symbol === 'MOVE_SWIRLING_BLADE') return { slugs: [], excluded: 'Rogue-only custom move, no PokeAPI identity' };
  if (symbol.startsWith('MOVE_G_MAX_')) return { slugs: [], excluded: 'G-Max has no move identity in pinned PokeAPI moves.csv' };
  const raw = symbol.slice(5); const slug = raw.toLowerCase().replaceAll('_', '-');
  const slugs = Z_SPLITS.has(raw) ? [`${slug}--physical`, `${slug}--special`]
    : [symbol === 'MOVE_VISE_GRIP' ? 'vice-grip' : symbol === 'MOVE_10000000_VOLT_THUNDERBOLT' ? '10-000-000-volt-thunderbolt' : slug];
  for (const name of slugs) assert(API_SLUGS.has(name), `Unmapped move: ${symbol} -> ${name}`);
  return { slugs };
}

function extract(sourceRoot) {
  assert(path.isAbsolute(sourceRoot), '--source must be an absolute path');
  const actual = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert(actual === SOURCE_SHA, `Wrong Rogue commit: ${actual}`);
  const texts = {};
  for (const [file, digest] of Object.entries(FILES)) {
    const text = fs.readFileSync(path.join(sourceRoot, file), 'utf8').replace(/\r\n/g, '\n');
    assert(hash(text) === digest, `Pinned source differs: ${file}`); texts[file] = text;
  }
  const macros = definitions(texts['include/config.h'] + '\n' + texts['include/config/battle.h']);
  const moveMacros = definitions(texts['include/constants/moves.h']);
  const generations = Object.fromEntries(['GEN_1', 'GEN_2', 'GEN_3', 'GEN_4', 'GEN_5', 'GEN_6', 'GEN_7', 'GEN_8', 'GEN_9', 'GEN_LATEST', ...CONFIG_NAMES].map((name) => [name, evaluate(name, macros)]));
  assert(generations.GEN_LATEST === 8 && CONFIG_NAMES.every((name) => generations[name] === 8), 'Expected ordinary GEN9 configuration');
  const rows = parseMoves(texts['src/data/battle_moves.h'], macros);
  assert(rows.length === 936, `Expected 936 rows, got ${rows.length}`);
  const flags = {}; const identities = []; const excluded = []; const ids = new Set();
  for (const row of rows) {
    const sourceId = evaluate(row.symbol, moveMacros); assert(!ids.has(sourceId), `Duplicate source ID ${sourceId}`); ids.add(sourceId);
    const mapping = mapSlugs(row.symbol);
    if (mapping.excluded) excluded.push({ symbol: row.symbol, sourceId, reason: mapping.excluded });
    for (const slug of mapping.slugs) { assert(!Object.hasOwn(flags, slug), `Duplicate slug ${slug}`); flags[slug] = row.flags; identities.push({ symbol: row.symbol, sourceId, slug }); }
  }
  assert(Object.keys(flags).length === 919 && excluded.length === 35, 'Mapping coverage changed');
  const source = {
    sha: SOURCE_SHA, sourceSha256: FILES['src/data/battle_moves.h'],
    configSha256: hash(['include/config.h', 'include/config/battle.h'].map((file) => file + '\0' + texts[file] + '\0').join('')),
    profile: 'normal', generations,
  };
  const manifest = {
    ...source, repository: 'https://github.com/Pokabbie/pokeemerald-rogue', generatorVersion: 1,
    hashEncoding: 'UTF-8 with CRLF normalized to LF; hashes match pinned git blobs', files: FILES,
    generationValueEncoding: 'C constants are zero-based: GEN_1 = 0 through GEN_9 = 8; selected profile is generation 9.',
    identifierSource: API_SOURCE,
    coverage: { sourceRows: rows.length, mappedSourceRows: rows.length - excluded.length, generatedSlugs: Object.keys(flags).length, excludedSourceRows: excluded.length },
    flagCounts: Object.fromEntries(FIELDS.map((name) => [name, Object.values(flags).filter((row) => row[name]).length])),
    defaultSemantics: 'Omitted C aggregate fields are zero; unknown move identities remain absent, never synthesized as all-false.',
    boundary: 'Four flags only. No numeric move body, gameplay implementation, or sale admission is certified. Generic Z physical/special identities share the four fixed-source flags.',
    excluded, identities,
  };
  return { source, flags, manifest };
}

function render(result) {
  const type = `export interface RogueMoveItemFlags {\n${FIELDS.map((name) => `  readonly ${name}: boolean;`).join('\n')}\n}\n`;
  const entries = Object.entries(result.flags).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([slug, flags]) => `  '${slug}': ${JSON.stringify(flags)},`).join('\n');
  return {
    'src/features/game/data/battle/rogueMoveItemFlags.ts': `// Generated by scripts/extract_rogue_move_item_flags.cjs. Do not edit.\n// Unknown identifiers are absent; flags do not certify gameplay support.\n${type}\nexport const ROGUE_MOVE_ITEM_FLAGS_SOURCE = ${JSON.stringify(result.source, null, 2)} as const;\n\nexport const ROGUE_MOVE_ITEM_FLAGS: Readonly<Record<string, RogueMoveItemFlags>> = {\n${entries}\n};\n`,
    'docs/tasks/九种持有物效果/move-flags-source.json': JSON.stringify(result.manifest, null, 2) + '\n',
  };
}

function main(args) {
  let sourceRoot; let check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source') { assert(!sourceRoot && args[i + 1], 'Expected one --source path'); sourceRoot = args[++i]; }
    else if (args[i] === '--check') { assert(!check, 'Repeated --check'); check = true; }
    else throw new Error(`Unknown argument ${args[i]}`);
  }
  assert(sourceRoot, 'Usage: node scripts/extract_rogue_move_item_flags.cjs --source <absolute root> [--check]');
  const result = extract(sourceRoot); const root = path.resolve(__dirname, '..');
  for (const [file, content] of Object.entries(render(result))) {
    const target = path.join(root, file);
    if (check) assert(fs.existsSync(target) && fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') === content, `Generated file differs: ${file}`);
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content, 'utf8'); }
  }
  console.log(JSON.stringify({ mode: check ? 'check' : 'generate', ...result.manifest.coverage, flagCounts: result.manifest.flagCounts }));
}

module.exports = { evaluate, definitions, preprocess, parseMoves, mapSlugs, extract, render };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
