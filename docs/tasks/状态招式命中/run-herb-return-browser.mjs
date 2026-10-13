import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { gunzipSync,gzipSync } from 'node:zlib';
const root='D:/Games/pokeFactory2-worktrees/status-accuracy/docs/tasks/状态招式命中/evidence/final-146c23f';
const dir=root+'/white-herb-next-battle';await mkdir(dir,{recursive:true});
const save=JSON.parse(gunzipSync(await readFile(root+'/white-herb-self/injected-save.json.gz'))),b=save.factory.battleResume;
b.battleLog=['受控第三战香草返还起点'];for(const e of b.enemyTeam)e.currentHp=1;
const origin='http://127.0.0.145:4302';const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,storageState:{cookies:[],origins:[{origin,localStorage:[{name:'pokefactory_save_v1',value:JSON.stringify(save)}]}]}});
const page=await context.newPage(),r={code:'146c23f35cacd9511b6c05e36edf551959c09075',controlled:{stage:3,enemyCurrentHp:1,save:true,globalRng:null,noDevWin:true},origin,steps:[],errors:[],http:[],assertions:{}};
page.on('pageerror',x=>r.errors.push(String(x)));page.on('console',x=>{if(x.type()==='error')r.errors.push(x.text());});page.on('response',x=>{if(x.status()>=400)r.http.push({status:x.status(),url:x.url()});});
const raw=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokefactory_save_v1')));
const record=async name=>{const s=await raw(),b=s.factory.battleResume,p=b.playerTeam[0];r.steps.push({name,phase:b.phase,stage:b.stage,log:b.battleLog,current:p.factoryHeldItemId??null,equipped:p.factoryEquippedHeldItemId,statStages:p.statStages,pp:p.selectedMoves[0].currentPp??p.selectedMoves[0].pp});await writeFile(dir+'/'+name+'.json.gz',gzipSync(JSON.stringify(s)));await page.screenshot({path:dir+'/'+name+'.png'});return s;};
try{
 await writeFile(dir+'/injected-save.json.gz',gzipSync(JSON.stringify(save)));await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});await record('before');
 for(let i=0;i<4;i++){
  if(await page.locator('.pf-result-shell').count())break;
  await page.getByRole('button',{name:'战斗',exact:true}).tap();const before=await raw();const n=before.factory.battleResume.battleLog.length;
  await page.locator('.pf-battle-move-button').first().tap();
  await page.waitForFunction(n=>{const b=JSON.parse(localStorage.getItem('pokefactory_save_v1'))?.factory?.battleResume;return document.querySelector('.pf-result-shell')||(b?.battleLog?.length>n&&document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true');},n,{timeout:60000});
  await record('turn-'+(i+1));
 }
 await page.locator('.pf-result-shell').waitFor({timeout:30000});const victory=await record('victory');r.assertions.herbConsumed= !victory.factory.battleResume.playerTeam[0].factoryHeldItemId;r.assertions.herbBaseKept=victory.factory.battleResume.playerTeam[0].factoryEquippedHeldItemId==='white_herb';
 await page.locator('.pf-result-shell button[data-tone="primary"]').tap();await page.getByRole('button',{name:'跳过交换',exact:true}).waitFor({timeout:30000});await record('swap');await page.getByRole('button',{name:'跳过交换',exact:true}).tap();
 await page.locator('[data-testid="shop-leave-button"]').waitFor({timeout:60000});await record('shop');await page.locator('[data-testid="shop-leave-button"]').tap();
 await page.locator('[data-awaiting-continue="true"]').waitFor({timeout:60000});await page.locator('[data-awaiting-continue="true"]').tap();await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});
 const after=await record('next-battle');r.assertions.stage4=after.factory.battleResume.stage===4;r.assertions.herbRestored=after.factory.battleResume.playerTeam[0].factoryHeldItemId==='white_herb';r.assertions.statsRestored=Object.values(after.factory.battleResume.playerTeam[0].statStages).every(x=>x===0);
}catch(e){r.failure=String(e);r.body=await page.locator('body').innerText().catch(()=> '');await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});}
await writeFile(dir+'/result.json',JSON.stringify(r,null,2));console.log(JSON.stringify({failure:r.failure,assertions:r.assertions,errors:r.errors,http:r.http,steps:r.steps},null,2));await browser.close();
