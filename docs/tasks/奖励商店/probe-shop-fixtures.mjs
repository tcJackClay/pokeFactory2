// 奖励商店验收 · 夹具生成（一次性 probe，不属于实现代码）。
// 从「四卡生成」任务的受控存档夹具派生本任务所需存档，写入 evidence/fixtures/。
// 来源：D:/Games/pokeFactory2/docs/tasks/四卡生成/evidence/fixtures/（merge f6518c3 时用于 17 项验收的同一批基档）。
// 派生原则：只改 runSupply.tickets 与 factory.battleResume.rewardCheckpoint，其余字段保持原样，
//          保证「团队摆到节点边界」的受控注入口径与四卡任务一致。
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const SRC_DIR = 'D:/Games/pokeFactory2/docs/tasks/四卡生成/evidence/fixtures';
const OUT_DIR = 'D:/Games/pokeFactory2-worktrees/reward-shop/docs/tasks/奖励商店/evidence/fixtures';

const load = async (name) => JSON.parse(await readFile(`${SRC_DIR}/${name}`, 'utf8'));
const dump = (save) => JSON.stringify(save);

// 深拷贝 + 打补丁：返回 [文本, 摘要]
const derive = (save, patch) => {
  const next = structuredClone(save);
  const summary = patch(next);
  return [JSON.stringify(next), summary];
};

await mkdir(OUT_DIR, { recursive: true });

const built = [];

// 1. 奖励节点（phase REWARD，stage 3，roundResult WIN，检查点 PENDING）：受控券余额。
//    基准：slowpoke=heavy_duty_boots, rhyhorn=quick_claw, tentacool=kings_rock
//    ⇒ 货架必然 = 9 种 − 3 基准 = scope_lens / choice_band / focus_band / loaded_dice / white_herb / mental_herb。
for (const [name, tickets] of [
  ['fx-shop-pending-t2.json', 2], // choice_band(3券) 永远点不动；其余可买 → AC-2 对比
  ['fx-shop-pending-t3.json', 3],  // 券余额恰好覆盖 白色香草(1) + 焦点镜(2) → AC-3/AC-4
  ['fx-shop-pending-t0.json', 0], // 全货架点不动 → AC-2 极端对比
]) {
  const [text, summary] = await derive(await load('fx-stage3-reward-pending.json'), (s) => {
    s.runSupply.tickets = tickets;
    return { phase: s.factory.battleResume.phase, stage: s.factory.battleResume.stage, tickets };
  });
  await writeFile(`${OUT_DIR}/${name}`, text, 'utf8');
  built.push({ name, ...summary });
}

// 2. 第 3 战战斗中（phase BATTLE，stage 3）：中途败退用（forfeit → LOSS 结算）。
{
  const [text, summary] = await derive(await load('fx-comboA-stage3-battle.json'), (s) => ({
    phase: s.factory.battleResume.phase, stage: s.factory.battleResume.stage, tickets: s.runSupply.tickets,
  }));
  await writeFile(`${OUT_DIR}/fx-shop-stage3-battle.json`, text, 'utf8');
  built.push({ name: 'fx-shop-stage3-battle.json', ...summary });
}

// 3. 第 7 战战斗中（phase BATTLE，stage 7，tickets 6）：组末折算用（AC-10）。
{
  const [text, summary] = await derive(await load('fx-stage7-battle.json'), (s) => ({
    phase: s.factory.battleResume.phase, stage: s.factory.battleResume.stage, tickets: s.runSupply.tickets,
  }));
  await writeFile(`${OUT_DIR}/fx-shop-stage7-battle.json`, text, 'utf8');
  built.push({ name: 'fx-shop-stage7-battle.json', ...summary });
}

// 3b. 9999 上限夹具：钱包余额 9995 + 第 7 战（tickets 6）
//     ⇒ 组奖励 3 + 折算 7 = 10，但只能入账 4（钳到 9999）→ AC-10 上限受控验证。
{
  const [text, summary] = await derive(await load('fx-stage7-battle.json'), (s) => {
    s.wallet.balance = 9995;
    return { phase: s.factory.battleResume.phase, stage: s.factory.battleResume.stage, tickets: s.runSupply.tickets, balance: s.wallet.balance };
  });
  await writeFile(`${OUT_DIR}/fx-shop-stage7-battle-cap.json`, text, 'utf8');
  built.push({ name: 'fx-shop-stage7-battle-cap.json', ...summary });
}

// 4. 旧「四卡免费领」检查点存档（S6 存档兼容 / AC-13）：
//    真实旧档形态（merge f6518c3 的写入不变量）：
//    · cardItemIds 只能来自旧七件候选 7 − 队员持有 3 = {scope_lens, choice_band, focus_band, loaded_dice}
//      —— 卡含队员已持有物在四卡时代不可产生（assertCurrentSaveRecoverability 对 RAW 旧档也要求每卡有合法装备对象）；
//    · READY 检查点无 claim 键；CLAIMED 的 claim.itemId 必须在卡内且已装备在目标位。
{
  const base = await load('fx-stage3-reward-pending.json');
  const LEGACY_CARDS = ['scope_lens', 'choice_band', 'focus_band', 'loaded_dice'];
  {
    const [text] = await derive(base, (s) => {
      s.factory.battleResume.rewardCheckpoint = {
        runId: s.runSupply.runId, stage: 3, status: 'READY', cardItemIds: LEGACY_CARDS,
      };
    });
    await writeFile(`${OUT_DIR}/fx-shop-legacy-ready.json`, text, 'utf8');
    built.push({ name: 'fx-shop-legacy-ready.json', legacy: 'READY', cardItemIds: LEGACY_CARDS.join(',') });
  }
  {
    const [text] = await derive(base, (s) => {
      // 旧档语义一致性：四卡时代 CLAIMED 检查点的 claim 已当场装备到 slot 0
      //（真实旧档里第 0 名队员的基准就是 claim 的道具）。
      s.factory.battleResume.playerTeam[0].factoryEquippedHeldItemId = 'scope_lens';
      s.factory.battleResume.playerTeam[0].factoryHeldItemId = 'scope_lens';
      s.factory.battleResume.rewardCheckpoint = {
        runId: s.runSupply.runId, stage: 3, status: 'CLAIMED',
        cardItemIds: LEGACY_CARDS,
        claim: { itemId: 'scope_lens', targetIndex: 0 },
      };
    });
    await writeFile(`${OUT_DIR}/fx-shop-legacy-claimed.json`, text, 'utf8');
    built.push({ name: 'fx-shop-legacy-claimed.json', legacy: 'CLAIMED', claim: 'scope_lens@0' });
  }
}

// 5. 新格式 CLAIMED 关闭屏夹具：已购两件（白色香草@0、焦点镜@1）、券 0、货架冻结原 6 件。
//    校验要求（saveManager.hasValidFactoryRewardCheckpoint）：已购逐件落在装备位、三人基准互异、
//    ticketsSpent=档位价、purchases 无重复 ⇒ 队伍同步改为已购装备。
{
  const [text, summary] = await derive(await load('fx-stage3-reward-pending.json'), (s) => {
    s.runSupply.tickets = 0;
    const team = s.factory.battleResume.playerTeam;
    team[0].factoryEquippedHeldItemId = 'white_herb';
    team[0].factoryHeldItemId = 'white_herb';
    team[1].factoryEquippedHeldItemId = 'scope_lens';
    team[1].factoryHeldItemId = 'scope_lens';
    s.factory.battleResume.rewardCheckpoint = {
      runId: s.runSupply.runId, stage: 3, status: 'CLAIMED',
      shelf: [
        { kind: 'HELD_ITEM', itemId: 'scope_lens' },
        { kind: 'HELD_ITEM', itemId: 'choice_band' },
        { kind: 'HELD_ITEM', itemId: 'focus_band' },
        { kind: 'HELD_ITEM', itemId: 'loaded_dice' },
        { kind: 'HELD_ITEM', itemId: 'white_herb' },
        { kind: 'HELD_ITEM', itemId: 'mental_herb' },
      ],
      purchases: [
        { itemId: 'white_herb', targetIndex: 0, ticketsSpent: 1 },
        { itemId: 'scope_lens', targetIndex: 1, ticketsSpent: 2 },
      ],
    };
    return { status: 'CLAIMED', purchases: 2, tickets: 0, equips: team.map((p) => p.factoryEquippedHeldItemId).join(',') };
  });
  await writeFile(`${OUT_DIR}/fx-shop-claimed-purchases.json`, text, 'utf8');
  built.push({ name: 'fx-shop-claimed-purchases.json', ...summary });
}

console.log(JSON.stringify(built, null, 2));
