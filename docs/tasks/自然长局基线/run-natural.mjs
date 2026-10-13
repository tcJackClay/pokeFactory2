import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { TYPE_CHART } from '../../../src/constants.ts';

const root='D:/Games/pokeFactory2', dir=`${root}/docs/tasks/自然长局基线/evidence/attempt-2`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const page=await context.newPage();
const start=Date.now(), time=()=>Date.now()-start;
const r={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),codeBaseline:'c4a7db1fa1c22a27291a12e6d7898e6c32eb80f2',browser:browser.version(),origin:'http://127.0.0.202:4304',viewport:[390,844],startedAt:new Date().toISOString(),health:await(await fetch('http://127.0.0.1:4304/api/health')).json(),conditions:'Authorized one retry after harness incorrectly waited on pre-round save during forced replacement in attempt1. New empty browser context; no injection, DEV Win or RNG override. Default generation; existing server disk cache retained. Real Go3005/Vite4304, HMR disabled. Touch emulation only.',actions:[],steps:[],console:[],pageErrors:[],responses:[],failedRequests:[]};
page.on('console',m=>r.console.push({ms:time(),type:m.type(),text:m.text()}));
page.on('pageerror',e=>r.pageErrors.push({ms:time(),text:e.message}));
page.on('response',q=>r.responses.push({ms:time(),url:q.url(),status:q.status()}));
page.on('requestfailed',q=>r.failedRequests.push({ms:time(),url:q.url(),failure:q.failure()}));
const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokefactory_save_v1')||'null'));
const flush=()=>writeFile(`${dir}/result.json`,JSON.stringify(r,null,2));
let n=0;
async function record(label,screenshot=true){
 const id=String(n++).padStart(3,'0')+'-'+label,s=await save(),b=s?.factory?.battleResume;
 await writeFile(`${dir}/${id}.json.gz`,gzipSync(JSON.stringify(s)));
 const body=await page.locator('body').innerText();await writeFile(`${dir}/${id}.txt`,body);
 if(screenshot)await page.screenshot({path:`${dir}/${id}.png`,fullPage:true});
 const team=p=>p?.map(x=>({name:x.name,hp:x.currentHp,maxHp:x.maxHp,item:x.factoryHeldItemId,moves:x.selectedMoves?.map(m=>({name:m.name,power:m.power,pp:m.currentPp??m.maxPp??m.pp}))}));
 r.steps.push({id,ms:time(),phase:b?.phase,status:b?.status,stage:b?.stage,streak:b?.streak,turn:b?.turn,player:team(b?.playerTeam),enemy:team(b?.enemyTeam),log:b?.battleLog,wallet:s?.wallet,runSupply:s?.runSupply,settings:s?.settings});
 await flush();console.log(JSON.stringify({id,phase:b?.phase,stage:b?.stage,streak:b?.streak,player:team(b?.playerTeam)?.map(x=>[x.name,x.hp]),enemy:team(b?.enemyTeam)?.map(x=>[x.name,x.hp])}));
}
async function tap(locator,label){r.actions.push({ms:time(),label,text:await locator.innerText()});await locator.tap();}
const visible=async sel=>page.locator(sel).first().isVisible().catch(()=>false);
async function waitDecision(oldLog){
 await page.waitForFunction(old=>{
  const b=JSON.parse(localStorage.getItem('pokefactory_save_v1')||'null')?.factory?.battleResume;
  const changed=JSON.stringify(b?.battleLog)!==old;
  const result=!!document.querySelector('.pf-result-shell');
  const panel=document.querySelector('.pf-battle-interaction-panel');
  const replacement=document.querySelector('.pf-battle-pokemon-panel')?.textContent?.includes('请选择一只仍可战斗的宝可梦出战。');
  return result||replacement||(changed&&panel?.dataset.enabled==='true');
 },oldLog,{timeout:90000});
 await page.waitForTimeout(350);
}
function score(m,p,e){
 const type=m.type;const eff=e.types.reduce((a,t)=>a*(TYPE_CHART[type]?.[t.type.name]??1),1);
 const stab=p.types.some(t=>t.type.name===type)?1.5:1;
 const physical=(m.damage_class?.name??m.damage_class)==='physical';
 const atk=p.calculatedStats?.[physical?'attack':'spAtk']??100,def=e.calculatedStats?.[physical?'defense':'spDef']??100;
 return (m.power||0)*(m.accuracy||100)/100*eff*stab*atk/def;
}
try{
 await page.goto(r.origin,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'初遇伙伴'}).waitFor({timeout:60000});await record('fresh-partner');
 await tap(page.getByRole('group',{name:'选择基地伙伴'}).getByRole('button',{name:/岩狗狗/}),'partner-rockruff');
 await tap(page.getByRole('button',{name:'确认伙伴并进入基地'}),'confirm-partner');
 await page.getByText('伙伴：岩狗狗').waitFor();await record('base');
 await tap(page.getByRole('button',{name:'开始挑战',exact:true}),'start-natural-run');
 await page.locator('.pf-battle-card').nth(5).waitFor({timeout:120000});await record('six-rentals');
 console.log('WAITING_SELECTION_FILE');
 let chosen;while(!chosen){try{chosen=JSON.parse(await readFile(`${dir}/selection.json`,'utf8'));}catch{await page.waitForTimeout(1000);}}
 for(const idx of chosen.indices)await tap(page.locator('.pf-battle-card').nth(idx),`rent-${idx}`);
 await tap(page.getByRole('button',{name:/确认选择/}),'confirm-rentals');
 for(let i=0;i<180;i++){
  await page.waitForTimeout(400);
  if(await visible('[data-awaiting-continue="true"]')){await tap(page.locator('[data-awaiting-continue="true"]'),'continue-intro');continue;}
  if(await visible('.pf-result-shell')){
   await record('battle-result');const s=await save(),b=s?.factory?.battleResume,body=await page.locator('body').innerText();
   if(body.includes('挑战失败')||body.includes('败北')||body.includes('战败')||b?.roundResult==='LOSS'||b?.stage===7){r.outcome=body;break;}
   const btn=page.locator('.pf-result-shell button[data-tone="primary"]');
   if((await btn.innerText()).includes('返回基地')){r.outcome=body;break;}
   await tap(btn,'continue-after-victory');continue;
  }
  if(await page.getByRole('button',{name:'跳过交换',exact:true}).isVisible().catch(()=>false)){await record('swap');await tap(page.getByRole('button',{name:'跳过交换',exact:true}),'skip-swap-keep-team');continue;}
  if(await visible('[data-testid="shop-leave-button"]')){await record('natural-shop');await tap(page.getByTestId('shop-leave-button'),'leave-shop-save-tickets');continue;}
  await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true'||!!document.querySelector('.pf-battle-pokemon-grid button:not([disabled])')||!!document.querySelector('[data-awaiting-continue="true"]')||!!document.querySelector('.pf-result-shell'),null,{timeout:90000});
  if(await visible('[data-awaiting-continue="true"]')||await visible('.pf-result-shell'))continue;
  const s=await save(),b=s?.factory?.battleResume,p=b?.playerTeam?.[0],e=b?.enemyTeam?.[0];
  if(!p||!e)throw new Error('No current team checkpoint at interactive screen');
  const forcedReplacement=await page.getByText('请选择一只仍可战斗的宝可梦出战。',{exact:true}).isVisible().catch(()=>false);
  if(forcedReplacement||p.currentHp<=0){
   if(!await visible('.pf-battle-pokemon-grid'))await tap(page.getByRole('button',{name:'宝可梦',exact:true}),'open-forced-replacement');
   await record('forced-replacement');
   const available=page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({hasText:'出战'});await tap(available.first(),'forced-replacement-first-healthy');
   await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:90000});await record('replacement-complete');continue;
  }
  await tap(page.getByRole('button',{name:'战斗',exact:true}),'open-moves');await page.locator('.pf-battle-move-button').first().waitFor();
  const choices=[];for(let idx=0;idx<p.selectedMoves.length;idx++){if(await page.locator('.pf-battle-move-button').nth(idx).isEnabled())choices.push({idx,score:score(p.selectedMoves[idx],p,e),name:p.selectedMoves[idx].name});}
  choices.sort((a,b)=>b.score-a.score);if(!choices.length)throw new Error('No enabled moves');
  r.actions.push({ms:time(),decision:'Highest power×accuracy×STAB×type×attack/defense among enabled moves; no tactical switching or setup',choices});
  await record('before-attack');await tap(page.locator('.pf-battle-move-button').nth(choices[0].idx),`attack-${choices[0].name}`);
  await waitDecision(JSON.stringify(b.battleLog));await record('after-turn');
 }
 if(!r.outcome)r.outcome='Stopped at 180 UI-cycle observation cap';
}catch(e){r.failure=String(e);await record('stopped-failure').catch(()=>{});console.log(r.failure);}
r.finishedAt=new Date().toISOString();r.httpErrors=r.responses.filter(x=>x.status>=400);await flush();
console.log(JSON.stringify({outcome:r.outcome,failure:r.failure,errors:r.pageErrors,httpErrors:r.httpErrors}));
// Preserve actual end-state, without importing or changing it, for visual follow-up.
await context.storageState({path:`${dir}/actual-browser-storage.json`});
await browser.close();
