import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { buildMoveBattleDataFromPokeApiMove } from '../../../../src/features/game/data/battle/index.ts';
const root='D:/Games/pokeFactory2';
const out=root+'/docs/tasks/手机资源基线/pp-probe';
const code=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const base=JSON.parse(gunzipSync(await readFile(root+'/docs/tasks/奖励商店/evidence/final-4072de0/white-herb-self/injected-save.json.gz')));
const flyData=await(await fetch('http://127.0.0.1:3002/api/pokeapi/move/fly')).json();
const fly={name:flyData.name,names:flyData.names,zhName:'飞翔',power:flyData.power,accuracy:100,type:flyData.type.name,damage_class:flyData.damage_class.name,pp:15,currentPp:15,maxPp:15,battleData:buildMoveBattleDataFromPokeApiMove(flyData)};
const short=s=>{const b=s.factory.battleResume;return {phase:b.phase,status:b.status,turn:b.turn,checkpointAt:b.checkpointAt,log:b.battleLog,player:b.playerTeam.map(p=>({name:p.name,hp:p.currentHp,held:p.factoryHeldItemId,moves:p.selectedMoves.map(m=>({name:m.name,currentPp:m.currentPp,pp:m.pp,maxPp:m.maxPp}))})),enemy:b.enemyTeam.map(p=>({name:p.name,hp:p.currentHp,moves:p.selectedMoves.map(m=>({name:m.name,currentPp:m.currentPp,accuracy:m.accuracy}))}))};};
const summary=[];
for(const [idx,c] of [{name:'miss-leftovers',accuracy:0},{name:'hit-leftovers',accuracy:100}].entries()){
 const dir=out+'/'+c.name;await mkdir(dir,{recursive:true});
 const save=structuredClone(base),b=save.factory.battleResume,p=b.playerTeam[0],e=b.enemyTeam[0];
 b.phase='BATTLE';b.status='READY';b.turn='PLAYER';b.battleMenuTab='MOVES';b.battleLog=['受控PP复现起点'];
 p.selectedMoves=[structuredClone(fly)];p.currentHp=300;p.maxHp=400;p.calculatedStats.speed=500;p.calculatedStats.hp=400;
 p.factoryHeldItemId='leftovers';p.factoryEquippedHeldItemId='leftovers';p.factoryOriginalHeldItemId='leftovers';
 p.factoryChoiceLockedMoveName=null;p.volatileStatuses=[];
 const tackle=structuredClone(base.factory.battleResume.playerTeam[0].selectedMoves.find(x=>x.name==='tackle'));
 tackle.accuracy=c.accuracy;tackle.currentPp=35;tackle.maxPp=35;
 e.selectedMoves=[tackle];e.currentHp=400;e.maxHp=400;e.calculatedStats={...p.calculatedStats,speed:1,attack:20,defense:300};
 e.factoryHeldItemId='heavy_duty_boots';e.factoryEquippedHeldItemId='heavy_duty_boots';e.factoryOriginalHeldItemId='heavy_duty_boots';e.volatileStatuses=[];
 const origin=`http://127.0.0.${191+idx}:4301`;
 const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,storageState:{cookies:[],origins:[{origin,localStorage:[{name:'pokefactory_save_v1',value:JSON.stringify(save)}]}]}});
 const page=await context.newPage();const r={code,case:c,origin,browser:browser.version(),controlled:true,errors:[],http:[]};
 page.on('pageerror',x=>r.errors.push(String(x)));page.on('console',x=>{if(x.type()==='error')r.errors.push(x.text());});page.on('response',x=>{if(x.status()>=400)r.http.push({status:x.status(),url:x.url()});});
 const raw=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokefactory_save_v1')));
 try{
  await writeFile(dir+'/injected-save.json.gz',gzipSync(JSON.stringify(save)));
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});
  await page.getByRole('button',{name:'战斗',exact:true}).tap();await page.locator('.pf-battle-move-button').first().waitFor();
  const before=await raw();r.before=short(before);await writeFile(dir+'/before-save.json.gz',gzipSync(JSON.stringify(before)));await page.screenshot({path:dir+'/before.png'});
  await page.evaluate(()=>{window.__ppTrace=[];let prev='';new MutationObserver(()=>{const text=[...document.querySelectorAll('.pf-battle-move-button')].map(x=>x.textContent).join('|');if(text!==prev){window.__ppTrace.push({ms:performance.now(),text});prev=text;}}).observe(document.body,{subtree:true,childList:true,characterData:true});});
  await page.locator('.pf-battle-move-button').first().tap();
  await page.waitForFunction(()=>{const b=JSON.parse(localStorage.getItem('pokefactory_save_v1'))?.factory?.battleResume;return b?.battleLog?.some(x=>x.includes('恢复了体力'))&&document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true';},null,{timeout:60000});
  const after=await raw();r.after=short(after);r.uiTrace=await page.evaluate(()=>window.__ppTrace);r.body=await page.locator('body').innerText();
  await writeFile(dir+'/after-save.json.gz',gzipSync(JSON.stringify(after)));await page.screenshot({path:dir+'/after.png'});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});r.reloaded=short(await raw());await page.screenshot({path:dir+'/reload.png'});
 }catch(err){r.failure=String(err);r.body=await page.locator('body').innerText().catch(()=> '');await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});}
 await writeFile(dir+'/result.json',JSON.stringify(r,null,2));summary.push({case:c.name,failure:r.failure,before:r.before?.player[0].moves,after:r.after?.player[0].moves,reloaded:r.reloaded?.player[0].moves,log:r.after?.log,errors:r.errors,http:r.http});await browser.close();
}
await writeFile(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
