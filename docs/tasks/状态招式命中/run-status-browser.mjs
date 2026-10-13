import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { buildMoveBattleDataFromPokeApiMove } from '../../../src/features/game/data/battle/index.ts';
const root='D:/Games/pokeFactory2-worktrees/status-accuracy';
const task=root+'/docs/tasks/状态招式命中';
const out=task+'/evidence/final-146c23f';
await mkdir(out,{recursive:true});
const code=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(code!=='146c23f35cacd9511b6c05e36edf551959c09075')throw Error('Wrong frozen SHA');
const base=JSON.parse(gunzipSync(await readFile(root+'/docs/tasks/奖励商店/evidence/final-4072de0/white-herb-self/injected-save.json.gz')));
const names=['feather-dance','calm-mind','rain-dance','protect','superpower','tackle','kings-shield','sandstorm','misty-terrain','toxic','fly'];
const moves={},raws={};
for(const name of names){const d=await(await fetch('http://127.0.0.1:3003/api/pokeapi/move/'+name)).json();raws[name]=d;moves[name]={name:d.name,names:d.names,zhName:d.names.find(x=>x.language.name==='zh-hans')?.name??d.name,power:d.power,accuracy:d.accuracy,type:d.type.name,damage_class:d.damage_class.name,pp:d.pp,battleData:buildMoveBattleDataFromPokeApiMove(d)};}
await writeFile(out+'/move-source.json',JSON.stringify(raws,null,2));
await writeFile(out+'/environment.json',JSON.stringify({code,root,health:await(await fetch('http://127.0.0.1:4302/api/health')).json(),versions:await(await fetch('http://127.0.0.1:4302/api/content/version')).json(),frontend:'Vite4302 DISABLE_HMR=true GO_BACKEND_URL=http://127.0.0.1:3003',backend:'PORT3003 Go cwd='+root,device:'Chromium simulated touch DPR2; no physical phone; controlled saves; no DEV Win'},null,2));
const copy=x=>structuredClone(x),m=(name,accuracy)=>({...copy(moves[name]),...(accuracy===undefined?{}:{accuracy})});
const equip=(p,id)=>{p.factoryHeldItemId=id;p.factoryEquippedHeldItemId=id;p.factoryOriginalHeldItemId=id;};
function seed(pm='tackle',em='tackle'){
 const s=copy(base),b=s.factory.battleResume;
 b.phase='BATTLE';b.status='READY';b.turn='PLAYER';b.battleMenuTab='MOVES';b.battleLog=['受控状态命中起点'];b.weather='none';b.weatherTurns=0;b.fieldState=[];b.fieldTurns={};
 for(const [i,p] of [...b.playerTeam,...b.enemyTeam].entries()){p.currentHp=400;p.maxHp=400;p.calculatedStats={hp:400,attack:100,defense:300,spAtk:100,spDef:300,speed:100};p.volatileStatuses={};delete p.nonVolatileStatus;p.statStages={attack:0,defense:0,spAtk:0,spDef:0,speed:0,accuracy:0,evasion:0};p.factoryChoiceLockedMoveName=null;p.factoryDamagedThisTurn=false;p.factoryConsecutiveMoveCount=0;p.abilities=[{ability:{name:'illuminate',url:''},is_hidden:false,slot:1}];equip(p,['heavy_duty_boots','quick_claw','kings_rock'][i%3]);}
 b.playerTeam[0].selectedMoves=[m(pm)];b.enemyTeam[0].selectedMoves=[m(em)];b.playerTeam[0].calculatedStats.speed=500;b.enemyTeam[0].calculatedStats.speed=1;
 return s;
}
const player=s=>s.factory.battleResume.playerTeam[0],enemy=s=>s.factory.battleResume.enemyTeam[0],bp=s=>s.factory.battleResume;
const pp=p=>p.selectedMoves[0].currentPp??p.selectedMoves[0].maxPp??p.selectedMoves[0].pp;
const slim=s=>{const b=bp(s);const member=p=>({id:p.id,name:p.name,hp:p.currentHp,statStages:p.statStages,status:p.nonVolatileStatus??null,volatile:p.volatileStatuses,held:p.factoryHeldItemId??null,equipped:p.factoryEquippedHeldItemId,moves:p.selectedMoves.map(x=>({name:x.name,pp:x.pp,currentPp:x.currentPp??null,maxPp:x.maxPp??null,accuracy:x.accuracy,target:x.battleData?.target}))});return {phase:b.phase,status:b.status,turn:b.turn,stage:b.stage,weather:b.weather,weatherTurns:b.weatherTurns,fieldState:b.fieldState,fieldTurns:b.fieldTurns,checkpointAt:b.checkpointAt,player:b.playerTeam.map(member),enemy:b.enemyTeam.map(member),log:b.battleLog};};
const cases=[];
for(const side of ['player','enemy'])for(const hit of [true,false]){
 const s=seed(side==='player'?'feather-dance':'tackle',side==='enemy'?'feather-dance':'tackle');const actor=side==='player'?player(s):enemy(s),target=side==='player'?enemy(s):player(s);
 actor.selectedMoves[0].accuracy=hit?100:0;const other=side==='player'?player(s):enemy(s);equip(target,'white_herb');
 cases.push({name:`status-${side}-${hit?'hit':'miss'}`,s,visual:!hit,check:(r)=>{const t=side==='player'?enemy(r):player(r);return {targetAttackZero:t.statStages.attack===0,herb:hit?!t.factoryHeldItemId:t.factoryHeldItemId==='white_herb',equipped:t.factoryEquippedHeldItemId==='white_herb',feedback:hit?bp(r).battleLog.some(x=>x.includes('白色香草')):bp(r).battleLog.some(x=>x.includes('没有命中'))};}});
}
{const s=seed('feather-dance','tackle');cases.push({name:'status-hit-no-herb',s,check:r=>({attackLowered:enemy(r).statStages.attack===-2})});}
for(const name of ['self-calm-mind','field-rain','self-cap']){const s=seed(name==='field-rain'?'rain-dance':'calm-mind','protect');enemy(s).statStages.evasion=6;enemy(s).volatileStatuses.substitute={id:'substitute',active:true,counter:100};if(name==='self-cap'){player(s).statStages.spAtk=6;player(s).statStages.spDef=6;}cases.push({name,s,check:r=>name==='field-rain'?{rain:bp(r).weather==='rainy',timer:bp(r).weatherTurns===4}:{spAtk:player(r).statStages.spAtk===(name==='self-cap'?6:1),spDef:player(r).statStages.spDef===(name==='self-cap'?6:1)}});}
for(const what of ['protect','substitute']){const s=seed('feather-dance',what==='protect'?'protect':'calm-mind');equip(enemy(s),'white_herb');if(what==='substitute')enemy(s).volatileStatuses.substitute={id:'substitute',active:true,counter:100};cases.push({name:'status-'+what,s,visual:true,check:r=>({attackUnchanged:enemy(r).statStages.attack===0,herbUnconsumed:enemy(r).factoryHeldItemId==='white_herb',blockedFeedback:bp(r).battleLog.some(x=>what==='substitute'?x.includes('替身'):x.includes('保护')||x.includes('守住')),noMissFeedback:!bp(r).battleLog.some(x=>x.includes('没有命中'))})});}
for(const cause of ['self','kings-shield']){const s=seed(cause==='self'?'superpower':'tackle',cause==='self'?'tackle':'kings-shield');equip(player(s),'white_herb');if(cause==='kings-shield')player(s).selectedMoves[0].battleData.makesContact=true;cases.push({name:'white-herb-'+cause,s,contactFlag:cause==='kings-shield',visual:true,check:r=>({attackRestored:player(r).statStages.attack===0,defenseRestored:player(r).statStages.defense===0,consumed:!player(r).factoryHeldItemId,equippedPreserved:player(r).factoryEquippedHeldItemId==='white_herb',singleHerb:bp(r).battleLog.filter(x=>x.includes('白色香草')).length===1})});}
{const s=seed('feather-dance','tackle');player(s).selectedMoves[0].accuracy=0;bp(s).weather='sunny';bp(s).weatherTurns=3;cases.push({name:'complete-round-refresh',s,reload:true,check:r=>({weatherDecrementOnce:bp(r).weatherTurns===2})});}
for(const kind of ['miss','hit']){const s=JSON.parse(gunzipSync(await readFile('D:/Games/pokeFactory2/docs/tasks/手机资源基线/pp-probe/'+kind+'-leftovers/injected-save.json.gz')));cases.push({name:'pp-'+kind+'-leftovers',s,reload:true,trace:true,check:r=>({pp14:pp(player(r))===14,hpValid:kind==='miss'?player(r).currentHp===325:player(r).currentHp<=325,enemyPp34:pp(enemy(r))===34})});}
for(const side of ['player','enemy'])for(const weather of [true,false]){const s=seed(side==='player'?(weather?'sandstorm':'calm-mind'):'feather-dance',side==='enemy'?(weather?'sandstorm':'calm-mind'):'feather-dance');const first=side==='player'?player(s):enemy(s),second=side==='player'?enemy(s):player(s);first.abilities=[{ability:{name:'sand-veil',url:''},slot:1,is_hidden:false}];first.calculatedStats.speed=500;second.calculatedStats.speed=1;cases.push({name:`same-round-weather-${side}-${weather?'sand':'none'}`,s,rng:.9,check:r=>{const target=side==='player'?player(r):enemy(r);return {attack:target.statStages.attack===(weather?0:-2),weather:bp(r).weather===(weather?'sandstorm':'none'),missMatches:bp(r).battleLog.some(x=>x.includes('没有命中'))===weather};}});}
for(const side of ['player','enemy'])for(const variant of ['grounded','no-field','flying']){const s=seed(side==='player'?(variant==='no-field'?'calm-mind':'misty-terrain'):'toxic',side==='enemy'?(variant==='no-field'?'calm-mind':'misty-terrain'):'toxic');const first=side==='player'?player(s):enemy(s),second=side==='player'?enemy(s):player(s);first.calculatedStats.speed=500;second.calculatedStats.speed=1;first.types=[{slot:1,type:{name:variant==='flying'?'flying':'normal',url:''}}];first.baseTypes=copy(first.types);cases.push({name:`same-round-misty-${side}-${variant}`,s,rng:.5,check:r=>{const target=side==='player'?player(r):enemy(r);return {status:variant==='grounded'?!target.nonVolatileStatus:target.nonVolatileStatus?.id==='bad_poison',field:variant==='no-field'?!bp(r).fieldState.includes('misty_terrain'):bp(r).fieldState.includes('misty_terrain')};}});}
const wanted=process.env.PF_STATUS_CASES?.split(',');const summary=[];
for(const [i,c] of cases.entries()){
 if(wanted&&!wanted.includes(c.name))continue;
 const dir=out+'/'+c.name;await mkdir(dir,{recursive:true});const origin=`http://127.0.0.${101+i}:4302`;
 const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,storageState:{cookies:[],origins:[{origin,localStorage:[{name:'pokefactory_save_v1',value:JSON.stringify(c.s)}]}]}});
 if(c.rng!==undefined)await context.addInitScript(value=>{Math.random=()=>value;},c.rng);
 const page=await context.newPage();const r={code,name:c.name,origin,controlled:{save:true,globalRng:c.rng??null,makesContactInjected:!!c.contactFlag,noDevWin:true},browser:browser.version(),errors:[],http:[],assertions:{}};
 page.on('pageerror',x=>r.errors.push(String(x)));page.on('console',x=>{if(x.type()==='error')r.errors.push(x.text());});page.on('response',x=>{if(x.status()>=400)r.http.push({status:x.status(),url:x.url()});});
 const raw=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pokefactory_save_v1')));
 try{
  await writeFile(dir+'/injected-save.json.gz',gzipSync(JSON.stringify(c.s)));await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});await page.getByRole('button',{name:'战斗',exact:true}).tap();await page.locator('.pf-battle-move-button').first().waitFor();
  const before=await raw();r.before=slim(before);await writeFile(dir+'/before-save.json.gz',gzipSync(JSON.stringify(before)));await page.screenshot({path:dir+'/before.png'});
  await page.evaluate(()=>{window.__ppTrace=[];let prev='';new MutationObserver(()=>{const text=[...document.querySelectorAll('.pf-battle-move-button')].map(x=>x.textContent).join('|');if(text!==prev){window.__ppTrace.push({ms:performance.now(),text});prev=text;}}).observe(document.body,{subtree:true,childList:true,characterData:true});});
  await page.locator('.pf-battle-move-button').first().tap();
  await page.waitForFunction(count=>{const b=JSON.parse(localStorage.getItem('pokefactory_save_v1'))?.factory?.battleResume;return b?.battleLog?.slice(count).filter(x=>x.includes('使用了')).length===2&&document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true';},r.before.log.length,{timeout:60000});
  const after=await raw();r.after=slim(after);r.uiTrace=await page.evaluate(()=>window.__ppTrace);r.body=await page.locator('body').innerText();
  r.assertions={...c.check(after),playerPpOnce:pp(player(after))===pp(player(before))-1,enemyPpOnce:pp(enemy(after))===pp(enemy(before))-1,eachSideOnce:r.after.log.slice(r.before.log.length).filter(x=>x.includes('使用了')).length===2};
  await writeFile(dir+'/after-save.json.gz',gzipSync(JSON.stringify(after)));await page.screenshot({path:dir+'/after.png'});
  if(c.visual){for(const viewport of [{width:320,height:568},{width:844,height:390}]){await page.setViewportSize(viewport);await page.screenshot({path:dir+`/after-${viewport.width}x${viewport.height}.png`});}}
  if(c.reload){await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});r.reloaded=slim(await raw());const stable=x=>{const {checkpointAt,...rest}=x;return rest;};r.assertions.reloadStable=JSON.stringify(stable(r.reloaded))===JSON.stringify(stable(r.after));await page.screenshot({path:dir+'/reload.png'});}
 }catch(err){r.failure=String(err);r.body=await page.locator('body').innerText().catch(()=> '');await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});}
 await writeFile(dir+'/result.json',JSON.stringify(r,null,2));await browser.close();const row={name:c.name,failure:r.failure,failedAssertions:Object.entries(r.assertions).filter(([,v])=>v!==true),errors:r.errors,http:r.http};summary.push(row);console.log(JSON.stringify(row));await writeFile(out+'/summary-'+(process.env.PF_STATUS_BATCH||'all')+'.json',JSON.stringify(summary,null,2));
 if(r.failure||row.failedAssertions.length)throw Error('Stopped at '+c.name+'; inspect actual state before rerun');
}
