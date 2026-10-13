// Final-code runtime probes. Only harness and controlled fixtures.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { launch, makeContext, attach, waitAppBoot, waitRewardReady, waitBattleReady, waitPhase, tapSkipSwap, winBattleByMoves, tapContinueRoundResult, readState, readShopDom, snap, settleImages } from './shop-harness.mjs';
import { armPurchaseCounter, purchaseCommits, armFailWrite, failWriteStats, disarmFailWrite, burstClick } from './shop-harness.mjs';
import { buildMoveBattleDataFromPokeApiMove } from '../../../src/features/game/data/battle/index.ts';

const codeSha = '4072de03eb7ecfc2277bd9b473407f272a2875d6';
const root = 'D:/Games/pokeFactory2-worktrees/reward-shop/docs/tasks/奖励商店/evidence/final-4072de0';
const fixtures = root + '/../fixtures';
const base = JSON.parse(await readFile(fixtures + '/fx-shop-pending-t3.json', 'utf8'));
const battleBase = JSON.parse(await readFile(fixtures + '/fx-shop-stage3-battle.json', 'utf8'));
const icyWindData = await (await fetch('http://127.0.0.1:3001/api/pokeapi/move/icy-wind')).json();
const icyWind = {
  name:icyWindData.name,names:icyWindData.names,
  zhName:icyWindData.names.find(x=>x.language.name==='zh-hans')?.name??icyWindData.name,
  power:icyWindData.power,accuracy:icyWindData.accuracy,type:icyWindData.type.name,
  damage_class:icyWindData.damage_class.name,pp:icyWindData.pp,
  battleData:buildMoveBattleDataFromPokeApiMove(icyWindData),
};
const browser = await launch();
const summary = {};
let evolvedForCrossGroup = null;
const copy = (x) => structuredClone(x);
const raw = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pokefactory_save_v1')));
const member = (p) => ({
  id:p?.id, speciesId:p?.speciesId, pokeApiName:p?.pokeApiName, level:p?.level,
  ivs:p?.ivs, evs:p?.evs, nature:p?.nature, gender:p?.gender,
  moves:p?.selectedMoves?.map((m)=>({name:m.name,pp:m.pp})),
  baseStats:p?.baseStats, calculatedStats:p?.calculatedStats,
  original:p?.factoryOriginalHeldItemId, equipped:p?.factoryEquippedHeldItemId,
  current:p?.factoryHeldItemId, statStages:p?.statStages,
});
async function run(name, octet, save, viewport, action) {
  if(process.env.PF_FINAL_ONLY&&process.env.PF_FINAL_ONLY!==name
    &&!(process.env.PF_FINAL_ONLY==='evolution-cross-group-controlled'&&name==='evolution-shelf-eligible'))return;
  const dir = root + '/' + name;
  await mkdir(dir,{recursive:true});
  await writeFile(dir + '/injected-save.json',JSON.stringify(save));
  const rec={codeSha,viewport,
    means:'Playwright Chromium simulated mobile viewport; controlled save injection; UI touch',
    steps:[],errors:[],httpErrors:[],assertions:{}};
  const {context}=await makeContext(browser,{octet,viewport,saveText:JSON.stringify(save)});
  const page=await context.newPage();attach(page,rec);
  try {
    await page.goto('http://127.0.0.'+octet+':4300',{waitUntil:'domcontentloaded'});
    await waitAppBoot(page);
    await action(page,rec,dir);
  } catch(e) {
    rec.failure=String(e);
    await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});
    rec.bodyTail=(await readState(page)).bodyTail;
  } finally {
    await context.close();
    await writeFile(dir+'/result.json',JSON.stringify(rec,null,2));
    summary[name]={failure:rec.failure??null,failedAssertions:Object.entries(rec.assertions).filter(([,v])=>v!==true).map(([k])=>k),errors:rec.errors,httpErrors:rec.httpErrors};
  }
}
const eevee=copy(base);
// Use a real, fully resolved Eevee member from the battle fixture; avoid a stale Slowpoke name/resource.
const eeveeMember=copy(battleBase.factory.battleResume.enemyTeam.find(p=>p.pokeApiName==='eevee'));
eeveeMember.factoryOriginalHeldItemId='leftovers';
eeveeMember.factoryEquippedHeldItemId='heavy_duty_boots';
eeveeMember.factoryHeldItemId='heavy_duty_boots';
eevee.factory.battleResume.playerTeam[0]=copy(eeveeMember);
eevee.factory.battleResume.factoryRentals[0]=copy(eeveeMember);
await run('evolution-shelf-eligible',61,eevee,{width:320,height:568},async(page,rec,dir)=>{
  await waitRewardReady(page);await settleImages(page);
  const before=await raw(page), shelf=before.factory.battleResume.rewardCheckpoint.shelf;
  rec.before={tickets:before.runSupply.tickets,member:member(before.factory.battleResume.playerTeam[0]),shelf};
  const shopDom=await readShopDom(page);rec.domBefore=shopDom.products;
  rec.assertions.sixDistinct=shelf.length===6&&new Set(shelf.map(p=>p.itemId)).size===6;
  rec.assertions.evolutionAppears=shelf.some(p=>p.kind==='EVOLUTION_ITEM'&&p.targets.some(t=>t.targetIndex===0&&t.fromPokeApiName==='eevee'));
  rec.assertions.descriptionNamesForms=shelf.filter(p=>p.kind==='EVOLUTION_ITEM').every(p=>p.targets.every(t=>shopDom.body.includes(t.toNameZh)&&shopDom.body.includes('伊布')));
  await snap(page,rec,dir,'01-eligible-320x568');
  await page.setViewportSize({width:390,height:844});await snap(page,rec,dir,'02-eligible-390x844');
  await page.setViewportSize({width:844,height:390});await snap(page,rec,dir,'03-eligible-844x390');
  const evo=shelf.find(p=>p.kind==='EVOLUTION_ITEM'&&p.targets.some(t=>t.targetIndex===0));
  if(!evo)throw new Error('No evolution product on eligible shelf');
  const product=page.locator('[data-testid="shop-product"][data-kind="EVOLUTION_ITEM"]').first();
  rec.selectedProduct={itemId:evo.itemId,targets:evo.targets};
  await product.locator('[data-testid="shop-redeem-button"]').tap();
  await page.locator('.pf-panel',{has:page.getByRole('heading',{name:'选择装备队员'})}).locator('button').nth(0).tap();
  await page.locator('[data-testid="shop-evolution-target"]').first().tap();
  rec.confirmText=await page.locator('[role="group"][aria-label="确认兑换"]').innerText();
  await snap(page,rec,dir,'04-evolution-confirm');
  await page.locator('[data-testid="shop-confirm-evolution"]').tap();
  await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint.purchases.length===1}catch{return false}},null,{timeout:30000});
  const after=await raw(page),evolved=after.factory.battleResume.playerTeam[0],target=evo.targets[0];
  evolvedForCrossGroup=copy(evolved);
  rec.after={tickets:after.runSupply.tickets,member:member(evolved),purchases:after.factory.battleResume.rewardCheckpoint.purchases,shelf:after.factory.battleResume.rewardCheckpoint.shelf};
  rec.assertions.evolvedToFrozenTarget=evolved.speciesId===target.toSpeciesId&&evolved.pokeApiName===target.toPokeApiName;
  rec.assertions.ticketSpentThree=after.runSupply.tickets===before.runSupply.tickets-3;
  rec.assertions.purchaseSingle=rec.after.purchases.length===1&&rec.after.purchases[0].itemId===evo.itemId&&rec.after.purchases[0].ticketsSpent===3;
  rec.assertions.movesIdentical=JSON.stringify(member(evolved).moves)===JSON.stringify(rec.before.member.moves);
  rec.assertions.identityAndHeldRetained=evolved.level===rec.before.member.level&&JSON.stringify(evolved.ivs)===JSON.stringify(rec.before.member.ivs)&&JSON.stringify(evolved.evs)===JSON.stringify(rec.before.member.evs)&&JSON.stringify(evolved.nature)===JSON.stringify(rec.before.member.nature)&&evolved.gender===rec.before.member.gender&&evolved.factoryEquippedHeldItemId===rec.before.member.equipped;
  rec.assertions.otherMembersIdentical=JSON.stringify(after.factory.battleResume.playerTeam.slice(1))===JSON.stringify(before.factory.battleResume.playerTeam.slice(1));
  rec.assertions.shelfFrozenAfterPurchase=JSON.stringify(rec.after.shelf)===JSON.stringify(shelf);
  await snap(page,rec,dir,'05-after-evolution-844x390');
  await page.reload({waitUntil:'domcontentloaded'});await waitAppBoot(page);
  const reload=await raw(page);
  rec.afterReload={tickets:reload.runSupply.tickets,member:member(reload.factory.battleResume.playerTeam[0]),purchases:reload.factory.battleResume.rewardCheckpoint.purchases};
  rec.assertions.reloadKeepsEvolution=reload.factory.battleResume.playerTeam[0].speciesId===evolved.speciesId&&reload.runSupply.tickets===after.runSupply.tickets;
  await page.setViewportSize({width:390,height:844});await snap(page,rec,dir,'06-reload-390x844');
  const {context:coldContext}=await makeContext(browser,{octet:69,viewport:{width:390,height:844},saveText:JSON.stringify(after)});
  const coldPage=await coldContext.newPage();attach(coldPage,rec);
  await coldPage.goto('http://127.0.0.69:4300',{waitUntil:'domcontentloaded'});await waitAppBoot(coldPage);
  const cold=await raw(coldPage);
  rec.coldReopen={tickets:cold.runSupply.tickets,member:member(cold.factory.battleResume.playerTeam[0]),purchases:cold.factory.battleResume.rewardCheckpoint.purchases};
  rec.assertions.coldReopenKeepsEvolution=cold.factory.battleResume.playerTeam[0].speciesId===evolved.speciesId&&cold.factory.battleResume.playerTeam[0].pokeApiName===evolved.pokeApiName&&cold.runSupply.tickets===after.runSupply.tickets;
  await snap(coldPage,rec,dir,'06b-cold-reopen-390x844');await coldContext.close();
  await page.locator('[data-testid="shop-leave-button"]').tap();await waitBattleReady(page);
  const next=await raw(page);
  rec.nextBattle={stage:next.factory.battleResume.stage,phase:next.factory.battleResume.phase,member:member(next.factory.battleResume.playerTeam[0])};
  rec.assertions.nextBattleKeepsEvolution=next.factory.battleResume.stage===4&&next.factory.battleResume.playerTeam[0].speciesId===evolved.speciesId;
  await snap(page,rec,dir,'07-next-battle-390x844');
});
if(evolvedForCrossGroup&&(!process.env.PF_FINAL_ONLY||process.env.PF_FINAL_ONLY==='evolution-cross-group-controlled')){
  const stage7=JSON.parse(await readFile(fixtures+'/fx-shop-stage7-battle.json','utf8'));
  const b=stage7.factory.battleResume;
  const boosted=copy(b.playerTeam[0]);
  const evolved=copy(evolvedForCrossGroup);
  evolved.selectedMoves=copy(boosted.selectedMoves);
  evolved.calculatedStats=copy(boosted.calculatedStats);
  evolved.maxHp=boosted.maxHp;evolved.currentHp=boosted.currentHp;
  b.playerTeam[0]=copy(evolved);b.factoryRentals[b.selectedRentalIndices[0]]=copy(evolved);
  await run('evolution-cross-group-controlled',70,stage7,{width:390,height:844},async(page,rec,dir)=>{
    rec.injectionNote='Stage-7 boundary save injects evolved identity with fixture combat moves/stats; proves settlement handoff, not natural four-battle progression.';
    if(!(await waitBattleReady(page)))throw new Error('Stage-7 battle not ready');
    const before=await raw(page);rec.before={stage:before.factory.battleResume.stage,member:member(before.factory.battleResume.playerTeam[0])};
    await snap(page,rec,dir,'01-evolved-stage7');
    rec.win=await winBattleByMoves(page,rec);
    if(!rec.win.ok)throw new Error('Stage-7 battle not won');
    const settled=await raw(page);
    rec.settled={phase:settled.factory.battleResume.phase,member:member(settled.factory.battleResume.playerTeam[0]),tickets:settled.runSupply.tickets,wallet:settled.wallet};
    rec.assertions.settlementKeepsForm=settled.factory.battleResume.playerTeam[0].speciesId===evolved.speciesId;
    await snap(page,rec,dir,'02-settled-stage7');
    await tapContinueRoundResult(page);
    const baseState=await raw(page);
    rec.afterSet={phase:baseState.factory.battleResume.phase,member:member(baseState.factory.battleResume.playerTeam?.[0]),tickets:baseState.runSupply.tickets};
    rec.assertions.baseKeepsForm=baseState.factory.battleResume.playerTeam?.[0]?.speciesId===evolved.speciesId;
    await snap(page,rec,dir,'03-after-settlement-base');
    await page.getByRole('button',{name:'设置',exact:true}).tap();
    const [download]=await Promise.all([
      page.waitForEvent('download',{timeout:15000}),
      page.getByRole('button',{name:'导出存档'}).tap(),
    ]);
    const exportedPath=dir+'/exported-save.json';
    await download.saveAs(exportedPath);
    const exportedText=await readFile(exportedPath,'utf8');
    const exported=JSON.parse(exportedText);
    rec.export={filename:download.suggestedFilename(),bytes:Buffer.byteLength(exportedText),
      speciesId:exported.factory.battleResume.playerTeam?.[0]?.speciesId};
    rec.assertions.exportKeepsForm=rec.export.speciesId===evolved.speciesId;
    await snap(page,rec,dir,'03b-settings-export');
    await page.locator('input[type="file"]').setInputFiles({name:'same-version-export.json',mimeType:'application/json',buffer:Buffer.from(exportedText)});
    await page.waitForTimeout(1800);await waitAppBoot(page);
    const imported=await raw(page);
    rec.import={phase:imported.factory.battleResume.phase,
      speciesId:imported.factory.battleResume.playerTeam?.[0]?.speciesId,
      pokeApiName:imported.factory.battleResume.playerTeam?.[0]?.pokeApiName,
      tickets:imported.runSupply.tickets};
    rec.assertions.uiImportKeepsForm=rec.import.speciesId===evolved.speciesId&&rec.import.pokeApiName===evolved.pokeApiName;
    await snap(page,rec,dir,'03c-after-ui-import');
    if(!(await page.getByRole('button',{name:'继续挑战'}).count())){
      await page.getByRole('button',{name:'返回',exact:true}).tap().catch(()=>{});
    }
    await page.getByRole('button',{name:'继续挑战'}).tap();
    if(!(await waitBattleReady(page)))throw new Error('Next-group battle not ready');
    const nextGroup=await raw(page);
    rec.nextGroup={phase:nextGroup.factory.battleResume.phase,stage:nextGroup.factory.battleResume.stage,member:member(nextGroup.factory.battleResume.playerTeam?.[0]),tickets:nextGroup.runSupply.tickets};
    rec.assertions.nextGroupKeepsForm=nextGroup.factory.battleResume.phase==='BATTLE'&&nextGroup.factory.battleResume.stage===8&&nextGroup.factory.battleResume.playerTeam?.[0]?.speciesId===evolved.speciesId;
    rec.assertions.nextGroupTicketsReset=nextGroup.runSupply.tickets===0;
    await snap(page,rec,dir,'04-next-group-battle');
  });
}
await run('evolution-shelf-ineligible',62,copy(base),{width:390,height:844},async(page,rec,dir)=>{
  await waitRewardReady(page);await settleImages(page);
  const s=await raw(page),shelf=s.factory.battleResume.rewardCheckpoint.shelf;
  rec.shelf=shelf;rec.dom=(await readShopDom(page)).products;
  rec.assertions.onlyHeldItems=shelf.length===6&&shelf.every(p=>p.kind==='HELD_ITEM');
  await snap(page,rec,dir,'01-ineligible-390x844');
});
const dualEevee=copy(eevee);
const secondEevee=copy(eeveeMember);
secondEevee.factoryOriginalHeldItemId='quick_claw';
secondEevee.factoryEquippedHeldItemId='quick_claw';
secondEevee.factoryHeldItemId='quick_claw';
dualEevee.factory.battleResume.playerTeam[1]=copy(secondEevee);
dualEevee.factory.battleResume.factoryRentals[1]=copy(secondEevee);
await run('evolution-multi-teammate',74,dualEevee,{width:390,height:844},async(page,rec,dir)=>{
  await waitRewardReady(page);await settleImages(page);
  const before=await raw(page),shelf=before.factory.battleResume.rewardCheckpoint.shelf;
  const product=shelf.find(p=>p.kind==='EVOLUTION_ITEM'&&p.targets.some(t=>t.targetIndex===0)&&p.targets.some(t=>t.targetIndex===1));
  if(!product)throw new Error('No shared evolution product for two Eevee teammates');
  rec.before={tickets:before.runSupply.tickets,first:member(before.factory.battleResume.playerTeam[0]),second:member(before.factory.battleResume.playerTeam[1]),product};
  rec.assertions.bothTeammatesListed=product.targets.some(t=>t.targetIndex===0)&&product.targets.some(t=>t.targetIndex===1);
  await snap(page,rec,dir,'01-two-eligible-teammates');
  const cards=page.locator('[data-testid="shop-product"][data-kind="EVOLUTION_ITEM"]');
  const all=await cards.count();let tapped=false;
  for(let i=0;i<all;i++){
    const txt=await cards.nth(i).innerText();
    if(txt.includes(product.targets[0].toNameZh)){
      await cards.nth(i).locator('[data-testid="shop-redeem-button"]').tap();tapped=true;break;
    }
  }
  if(!tapped)throw new Error('Could not identify matching evolution card');
  const teamPanel=page.locator('.pf-panel',{has:page.getByRole('heading',{name:'选择装备队员'})});
  rec.teamChoices=await teamPanel.locator('button').allInnerTexts();
  rec.assertions.twoChoiceButtons=rec.teamChoices.length>=2;
  await snap(page,rec,dir,'02-teammate-picker');
  await teamPanel.locator('button').nth(1).tap();
  await page.locator('[data-testid="shop-evolution-target"]').first().tap();
  await snap(page,rec,dir,'03-confirm-second-teammate');
  await page.locator('[data-testid="shop-confirm-evolution"]').tap();
  await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint.purchases.length===1}catch{return false}},null,{timeout:30000});
  const after=await raw(page);
  rec.after={tickets:after.runSupply.tickets,first:member(after.factory.battleResume.playerTeam[0]),second:member(after.factory.battleResume.playerTeam[1]),purchases:after.factory.battleResume.rewardCheckpoint.purchases};
  const target=product.targets.find(t=>t.targetIndex===1);
  rec.assertions.secondEvolved=rec.after.second.speciesId===target.toSpeciesId&&rec.after.second.pokeApiName===target.toPokeApiName;
  rec.assertions.firstUnaffected=JSON.stringify(after.factory.battleResume.playerTeam[0])===JSON.stringify(before.factory.battleResume.playerTeam[0]);
  rec.assertions.purchaseTargetsSecond=rec.after.purchases.length===1&&rec.after.purchases[0].targetIndex===1&&rec.after.tickets===rec.before.tickets-3;
  await snap(page,rec,dir,'04-only-second-evolved');
});
const identityFromResource=async(slug,gender,held)=>{
  const data=await (await fetch(`http://127.0.0.1:3001/api/pokeapi/pokemon/${slug}`)).json();
  const species=await (await fetch(`http://127.0.0.1:3001/api/pokeapi/pokemon-species/${slug}`)).json();
  const p=copy(eeveeMember);
  p.id=data.id;p.name=slug;p.speciesId=species.id;p.speciesName=species.name;
  p.pokeApiName=slug;p.formLedgerSlug=slug;p.species=data.species;
  p.names=copy(species.names);
  p.zhName=species.names.find(x=>x.language.name==='zh-hans')?.name??slug;
  p.gender=gender;p.types=copy(data.types);p.baseTypes=data.types.map(x=>x.type.name);
  p.stats=copy(data.stats);p.sprites=copy(data.sprites);
  p.baseStats={hp:data.stats[0].base_stat,attack:data.stats[1].base_stat,
    defense:data.stats[2].base_stat,spAtk:data.stats[3].base_stat,
    spDef:data.stats[4].base_stat,speed:data.stats[5].base_stat};
  p.factoryOriginalHeldItemId=held;p.factoryEquippedHeldItemId=held;p.factoryHeldItemId=held;
  return p;
};
if(!process.env.PF_FINAL_ONLY||process.env.PF_FINAL_ONLY==='evolution-gender-dawn-stone'){
  const sexTeam=copy(base),sexBattle=sexTeam.factory.battleResume;
  const members=[
    await identityFromResource('kirlia','male','heavy_duty_boots'),
    await identityFromResource('kirlia','female','quick_claw'),
    await identityFromResource('snorunt','female','kings_rock'),
  ];
  sexBattle.playerTeam=copy(members);sexBattle.factoryRentals=copy(members);
  await run('evolution-gender-dawn-stone',75,sexTeam,{width:390,height:844},async(page,rec,dir)=>{
    await waitRewardReady(page);await settleImages(page);
    const before=await raw(page),shelf=before.factory.battleResume.rewardCheckpoint.shelf;
    const dawn=shelf.find(p=>p.kind==='EVOLUTION_ITEM'&&p.itemId==='dawn_stone');
    rec.before={tickets:before.runSupply.tickets,team:before.factory.battleResume.playerTeam.map(member),shelf};
    rec.dawn=dawn??null;
    if(!dawn)throw new Error('Dawn Stone was not drawn from eligible candidate pool; rerun with new random draw');
    rec.assertions.genderFiltersTargets=dawn.targets.length===2&&dawn.targets.some(t=>t.targetIndex===0&&t.toPokeApiName==='gallade')
      &&dawn.targets.some(t=>t.targetIndex===2&&t.toPokeApiName==='froslass')&&!dawn.targets.some(t=>t.targetIndex===1);
    await snap(page,rec,dir,'01-dawn-stone-gender-targets');
    const card=page.locator('[data-testid="shop-product"][data-kind="EVOLUTION_ITEM"][aria-label="觉醒之石"]');
    rec.cardText=await card.innerText();
    rec.assertions.cardNamesBothAllowed=rec.cardText.includes('奇鲁莉安')&&rec.cardText.includes('雪童子')&&rec.cardText.includes('艾路雷朵')&&rec.cardText.includes('雪妖女');
    await card.locator('[data-testid="shop-redeem-button"]').tap();
    const panel=page.locator('.pf-panel',{has:page.getByRole('heading',{name:'选择装备队员'})});
    rec.choices=await panel.locator('button').allInnerTexts();
    rec.choiceDisabled=await panel.locator('button').evaluateAll(buttons=>buttons.map(b=>b.disabled));
    rec.assertions.onlyEligibleTeamChoices=rec.choices.length===3
      &&JSON.stringify(rec.choiceDisabled)===JSON.stringify([false,true,false]);
    await snap(page,rec,dir,'02-gender-filtered-team-picker');
    await panel.locator('button').nth(2).tap();
    await page.locator('[data-testid="shop-evolution-target"]').first().tap();
    await page.locator('[data-testid="shop-confirm-evolution"]').tap();
    await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint.purchases.length===1}catch{return false}},null,{timeout:30000});
    const after=await raw(page);
    rec.after={tickets:after.runSupply.tickets,team:after.factory.battleResume.playerTeam.map(member),purchases:after.factory.battleResume.rewardCheckpoint.purchases};
    rec.assertions.femaleSnoruntEvolvedOnly=rec.after.team[0].speciesId===rec.before.team[0].speciesId
      &&rec.after.team[1].speciesId===rec.before.team[1].speciesId
      &&rec.after.team[2].speciesId===478&&rec.after.purchases[0].targetIndex===2;
    await snap(page,rec,dir,'03-female-snorunt-evolved');
  });
}
const armEvolutionPurchase=async(page)=>{
  await waitRewardReady(page);
  const before=await raw(page);
  const evo=before.factory.battleResume.rewardCheckpoint.shelf.find(p=>p.kind==='EVOLUTION_ITEM');
  if(!evo)throw new Error('No evolution product on eligible shelf');
  await page.locator('[data-testid="shop-product"][data-kind="EVOLUTION_ITEM"]').first()
    .locator('[data-testid="shop-redeem-button"]').tap();
  await page.locator('.pf-panel',{has:page.getByRole('heading',{name:'选择装备队员'})})
    .locator('button').nth(0).tap();
  await page.locator('[data-testid="shop-evolution-target"]').first().tap();
  return {before,evo};
};
await run('evolution-confirm-burst',72,copy(eevee),{width:390,height:844},async(page,rec,dir)=>{
  const {before,evo}=await armEvolutionPurchase(page);
  rec.before={tickets:before.runSupply.tickets,member:member(before.factory.battleResume.playerTeam[0]),itemId:evo.itemId};
  await armPurchaseCounter(page);
  await snap(page,rec,dir,'01-confirm-armed');
  rec.burst=await burstClick(page,'[data-testid="shop-confirm-evolution"]',8);
  await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint.purchases.length===1}catch{return false}},null,{timeout:30000});
  const after=await raw(page);rec.after={tickets:after.runSupply.tickets,member:member(after.factory.battleResume.playerTeam[0]),purchases:after.factory.battleResume.rewardCheckpoint.purchases};
  rec.commitCount=await purchaseCommits(page);
  rec.assertions.onePurchaseOnly=rec.after.purchases.length===1&&rec.commitCount===1;
  rec.assertions.oneDeductionOnly=rec.after.tickets===rec.before.tickets-3;
  rec.assertions.evolvedOnce=rec.after.member.speciesId===evo.targets[0].toSpeciesId;
  await snap(page,rec,dir,'02-after-burst');
});
await run('evolution-write-failure',73,copy(eevee),{width:390,height:844},async(page,rec,dir)=>{
  const {before,evo}=await armEvolutionPurchase(page);
  rec.before={tickets:before.runSupply.tickets,member:member(before.factory.battleResume.playerTeam[0]),itemId:evo.itemId};
  await armFailWrite(page,'"purchases":\\[\\{');
  await snap(page,rec,dir,'01-before-failure');
  await page.locator('[data-testid="shop-confirm-evolution"]').tap();
  await page.waitForTimeout(1500);
  const failed=await raw(page);rec.failed={tickets:failed.runSupply.tickets,member:member(failed.factory.battleResume.playerTeam[0]),
    purchases:failed.factory.battleResume.rewardCheckpoint.purchases,status:failed.factory.battleResume.rewardCheckpoint.status,
    failWrite:await failWriteStats(page),body:(await readState(page)).bodyTail};
  rec.assertions.failedWriteWasIntercepted=rec.failed.failWrite.hits===1;
  rec.assertions.failedWriteNoDeduction=rec.failed.tickets===rec.before.tickets;
  rec.assertions.failedWriteNoEvolution=rec.failed.member.speciesId===rec.before.member.speciesId&&rec.failed.purchases.length===0&&rec.failed.status==='READY';
  await snap(page,rec,dir,'02-write-failed');
  await disarmFailWrite(page);
  await page.locator('[data-testid="shop-confirm-evolution"]').tap();
  await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint.purchases.length===1}catch{return false}},null,{timeout:30000});
  const after=await raw(page);rec.after={tickets:after.runSupply.tickets,member:member(after.factory.battleResume.playerTeam[0]),purchases:after.factory.battleResume.rewardCheckpoint.purchases};
  rec.assertions.retrySingleSuccess=rec.after.tickets===rec.before.tickets-3&&rec.after.member.speciesId===evo.targets[0].toSpeciesId&&rec.after.purchases.length===1;
  await snap(page,rec,dir,'03-retry-success');
});
const noBuy=copy(base);noBuy.runSupply.tickets=0;
await run('leave-shop-without-purchase',71,noBuy,{width:320,height:568},async(page,rec,dir)=>{
  await waitRewardReady(page);
  const before=await raw(page);
  rec.before={stage:before.factory.battleResume.stage,tickets:before.runSupply.tickets,
    status:before.factory.battleResume.rewardCheckpoint.status,
    purchases:before.factory.battleResume.rewardCheckpoint.purchases};
  await snap(page,rec,dir,'01-before-leave-320x568');
  await page.locator('[data-testid="shop-leave-button"]').tap();
  if(!(await waitBattleReady(page)))throw new Error('Next battle not ready after free leave');
  const after=await raw(page);
  rec.after={stage:after.factory.battleResume.stage,phase:after.factory.battleResume.phase,tickets:after.runSupply.tickets,
    rewardCheckpoint:after.factory.battleResume.rewardCheckpoint};
  rec.assertions.emptyPurchaseList=rec.before.purchases.length===0;
  rec.assertions.leaveAdvancesStage=rec.after.stage===4&&rec.after.phase==='BATTLE';
  rec.assertions.ticketsUnchanged=rec.after.tickets===0;
  rec.assertions.checkpointCleared=rec.after.rewardCheckpoint==null;
  await snap(page,rec,dir,'02-after-leave-stage4');
});
function herbSave(cause){
  const s=copy(battleBase),b=s.factory.battleResume;
  for(const p of [b.playerTeam[0],b.factoryRentals[0]]){p.factoryEquippedHeldItemId='white_herb';p.factoryHeldItemId='white_herb'}
  if(cause==='self'){
    b.playerTeam[0].selectedMoves[0]=copy(b.playerTeam[1].selectedMoves.find(m=>m.name==='superpower'));
    b.factoryRentals[0].selectedMoves[0]=copy(b.playerTeam[0].selectedMoves[0]);
  }else{
    const move=cause==='icy-wind'
      ?copy(icyWind)
      :copy(b.enemyTeam[0].selectedMoves.find(m=>m.name==='feather-dance'));
    if(cause==='opponent'){
      // Feather Dance source data has isPrimary=true/chance=0, which the current
      // resolver skips. This probe explicitly raises chance to isolate herb only.
      move.battleData.secondaryEffects[0].chance=100;
    }
    b.enemyTeam[0].selectedMoves=[move,copy(move),copy(move),copy(move)];
    b.enemyTeam[0].maxHp=400;b.enemyTeam[0].currentHp=400;
    b.enemyTeam[0].calculatedStats.hp=400;
    // Belly Drum raises Attack to +6. A low-power Tackle lets Feather Dance create -2
    // without knocking out the controlled opponent.
    b.playerTeam[0].selectedMoves[0].power=1;
    b.factoryRentals[0].selectedMoves[0].power=1;
  }
  return s;
}
for(const [cause,octet] of [['self',63],['opponent',64],['icy-wind',68],['feather-dance-raw',76]]){
  await run('white-herb-'+cause,octet,herbSave(cause),{width:390,height:844},async(page,rec,dir)=>{
    if(!(await waitBattleReady(page)))throw new Error('Battle not ready');
    const before=await raw(page);rec.before={member:member(before.factory.battleResume.playerTeam[0]),log:before.factory.battleResume.battleLog.slice(-5)};
    if(cause==='feather-dance-raw'){
      const move=before.factory.battleResume.enemyTeam[0].selectedMoves[0];
      rec.sourceMove={name:move.name,secondaryEffects:move.battleData.secondaryEffects};
      rec.assertions.rawPrimaryZeroChance=move.name==='feather-dance'&&move.battleData.secondaryEffects.some(e=>e.isPrimary===true&&e.chance===0&&e.change===-2);
    }
    await snap(page,rec,dir,'01-before-turn');
    await page.getByRole('button',{name:'战斗',exact:true}).tap().catch(()=>{});
    const moves=page.locator('.pf-battle-move-button');rec.moveTexts=await moves.allInnerTexts();
    rec.turnAttempts=[];
    for(let attempt=0;attempt<4;attempt++){
      if(attempt>0&&!await waitBattleReady(page,20))break;
      const previous=await raw(page);
      const previousLogLength=previous.factory.battleResume.battleLog.length;
      await moves.nth(0).tap();
      await page.waitForFunction((length)=>{try{
        return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.battleLog.length>length;
      }catch{return false}},previousLogLength,{timeout:20000});
      const trial=await raw(page),battle=trial.factory.battleResume;
      rec.turnAttempts.push({attempt:attempt+1,heldItem:battle.playerTeam[0].factoryHeldItemId??null,
        statStages:battle.playerTeam[0].statStages,log:battle.battleLog.slice(-8),
        body:(await readState(page)).bodyTail});
      if(battle.playerTeam[0].factoryHeldItemId==null&&battle.battleLog.some(e=>JSON.stringify(e).includes('白色香草')))break;
    }
    if(rec.turnAttempts.at(-1)?.heldItem!==null||!rec.turnAttempts.at(-1)?.log.some(e=>JSON.stringify(e).includes('白色香草')))
      throw new Error('White Herb was not activated after four real UI turns');
    const after=await raw(page);rec.after={member:member(after.factory.battleResume.playerTeam[0]),log:after.factory.battleResume.battleLog.slice(-12)};
    rec.assertions.currentHerbConsumed=after.factory.battleResume.playerTeam[0].factoryHeldItemId==null;
    rec.assertions.baselineHerbRetained=after.factory.battleResume.playerTeam[0].factoryEquippedHeldItemId==='white_herb';
    rec.assertions.negativeStagesRestored=Object.values(after.factory.battleResume.playerTeam[0].statStages).every(n=>n>=0);
    rec.assertions.herbLogOnce=after.factory.battleResume.battleLog.filter(e=>JSON.stringify(e).includes('白色香草')).length===1;
    if(cause==='feather-dance-raw'){
      const log=after.factory.battleResume.battleLog.map(String).join(' ');
      rec.assertions.rawFeatherDanceDroppedAttack=log.includes('羽毛舞')&&log.includes('攻击降低');
      rec.assertions.rawFeatherDanceHerbRestored=log.includes('白色香草恢复');
    }
    await snap(page,rec,dir,'02-after-trigger');
    if(cause==='self'){
      rec.win=await winBattleByMoves(page,rec);
      if(!rec.win.ok)throw new Error('Could not win controlled White Herb battle');
      await tapContinueRoundResult(page);
      await waitPhase(page,'FACTORY_SWAP');
      await tapSkipSwap(page);
      await waitRewardReady(page);
      await page.locator('[data-testid="shop-leave-button"]').tap();
      if(!(await waitBattleReady(page)))throw new Error('Next battle not ready after herb consumption');
      const next=await raw(page);
      rec.nextBattle={stage:next.factory.battleResume.stage,member:member(next.factory.battleResume.playerTeam[0])};
      rec.assertions.herbRestoredNextBattle=next.factory.battleResume.stage===4
        &&next.factory.battleResume.playerTeam[0].factoryHeldItemId==='white_herb'
        &&next.factory.battleResume.playerTeam[0].factoryEquippedHeldItemId==='white_herb';
      await snap(page,rec,dir,'03-next-battle-herb-restored');
    }
  });
}
await browser.close();
console.log(JSON.stringify(summary,null,2));
