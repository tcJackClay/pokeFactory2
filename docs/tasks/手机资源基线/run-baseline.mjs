import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = 'D:/Games/pokeFactory2';
const output = `${root}/docs/tasks/手机资源基线/evidence`;
await mkdir(output, { recursive: true });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const health = await (await fetch('http://127.0.0.1:4301/api/health')).text();
const [width,height]=(process.env.PF_BASELINE_VIEWPORT||'390x844').split('x').map(Number);
const runIds=(process.env.PF_BASELINE_RUNS||'1,2,3').split(',').map(Number);
const summary = { commit, health, viewport:[width,height], conditions: 'Fresh Chromium processes/contexts; empty browser cache and storage; existing Go disk cache retained, process shared, no network throttle; generation 9 selected through UI; random rentals, no seed or save injection; DPR2 touch simulation; Vite development server HMR disabled.', runs: [] };
const state = page => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pokefactory_save_v1') || 'null');
  const b = s?.factory?.battleResume;
  return { schema:s?.schemaVersion, generation:s?.settings?.selectedGens, companion:s?.progress?.companionSpeciesId, status:b?.status, phase:b?.phase, stage:b?.stage, turn:b?.turn, wallet:s?.wallet?.balance, player:b?.playerTeam?.map(p=>({id:p.id,name:p.name,hp:p.currentHp,moves:p.selectedMoves?.map(m=>({id:m.id,name:m.name,pp:m.currentPp??m.maxPp??m.pp,currentPp:m.currentPp??null,power:m.power}))})), enemy:b?.enemyTeam?.map(p=>({id:p.id,name:p.name,hp:p.currentHp})), log:b?.battleLog };
});
const layout = page => page.evaluate(()=>({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],buttons:[...document.querySelectorAll('.pf-battle-command-button,.pf-battle-move-button')].map(x=>{const r=x.getBoundingClientRect();return {text:x.textContent.trim(),disabled:x.disabled,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}),images:[...document.images].filter(x=>x.getBoundingClientRect().width>0).map(x=>({alt:x.alt,src:x.getAttribute('src'),complete:x.complete,naturalWidth:x.naturalWidth}))}));
for(const n of runIds){
  const dir=`${output}/run-${n}`; await mkdir(dir,{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage();
  const start=performance.now(); const time=()=>Math.round(performance.now()-start);
  const r={n,commit,browser:browser.version(),origin:`http://127.0.0.${180+n}:4301`,timing:{},steps:[],requests:[],responses:[],pageErrors:[],consoleErrors:[],failedRequests:[],hmr:[]};
  page.on('request',q=>r.requests.push({ms:time(),url:q.url(),type:q.resourceType()}));
  page.on('response',q=>r.responses.push({ms:time(),url:q.url(),status:q.status(),contentType:q.headers()['content-type']}));
  page.on('requestfailed',q=>r.failedRequests.push({ms:time(),url:q.url(),failure:q.failure()}));
  page.on('pageerror',e=>r.pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());if(m.text().includes('hot updated'))r.hmr.push(m.text());});
  const step=async(name)=>r.steps.push({name,ms:time(),state:await state(page),layout:await layout(page),body:(await page.locator('body').innerText()).slice(-1600)});
  try{
    await page.goto(r.origin,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'初遇伙伴'}).waitFor({timeout:60000});r.timing.partnerReady=time();
    await page.getByRole('group',{name:'选择基地伙伴'}).getByRole('button',{name:/岩狗狗/}).tap();
    await page.getByRole('button',{name:'确认伙伴并进入基地'}).tap();
    await page.getByText('伙伴：岩狗狗').waitFor();r.timing.baseReady=time();
    await page.getByRole('button',{name:'设置',exact:true}).tap();
    await page.locator('button[aria-haspopup="dialog"]').tap();
    await page.locator('label').filter({has:page.locator('input[name="factory-generation"][value="9"]')}).tap();
    await page.getByRole('button',{name:'返回',exact:true}).tap();
    r.timing.challengeClick=time();
    await page.getByRole('button',{name:'开始挑战',exact:true}).tap();
    await page.locator('.pf-battle-card').nth(5).waitFor({timeout:120000});r.timing.sixCards=time();
    await step('sixCards'); await page.screenshot({path:`${dir}/six-cards-${width}x${height}.png`,fullPage:true});
    for(let i=0;i<3;i++) await page.locator('.pf-battle-card').nth(i).tap();
    await page.getByRole('button',{name:/确认选择/}).tap();
    await page.locator('[data-awaiting-continue="true"]').waitFor({timeout:60000});
    await page.locator('[data-awaiting-continue="true"]').tap();
    await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});
    await page.getByRole('button',{name:'战斗',exact:true}).tap();
    await page.locator('.pf-battle-move-button').first().waitFor();r.timing.movesReady=time();
    await step('movesReady'); await page.screenshot({path:`${dir}/moves-ready-${width}x${height}.png`});
    const before=await state(page);r.beforeMove=before;
    const idx=Math.max(0,before.player?.[0]?.moves?.findIndex(m=>(m.power||0)>0)??0);
    r.chosenMove={index:idx,text:await page.locator('.pf-battle-move-button').nth(idx).innerText()};
    await page.locator('.pf-battle-move-button').nth(idx).tap();
    await page.waitForFunction(prev=>{const b=JSON.parse(localStorage.getItem('pokefactory_save_v1')||'null')?.factory?.battleResume;return JSON.stringify(b?.battleLog)!==prev&&b?.battleLog?.length>1&&document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true';},JSON.stringify(before.log),{timeout:60000});
    await step('afterMove');await page.screenshot({path:`${dir}/after-move-${width}x${height}.png`});
    if(n===1){
      await page.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',null,{timeout:60000});
      for(const v of [{width:320,height:568},{width:844,height:390}]){
        await page.setViewportSize(v);
        await page.getByRole('button',{name:'宝可梦',exact:true}).tap();
        await page.locator('.pf-battle-pokemon-grid').waitFor();
        await step(`pokemon-${v.width}x${v.height}`);await page.screenshot({path:`${dir}/pokemon-${v.width}x${v.height}.png`});
        await page.getByRole('button',{name:'战斗',exact:true}).tap();
        await page.locator('.pf-battle-move-button').first().waitFor();
        await step(`moves-${v.width}x${v.height}`);await page.screenshot({path:`${dir}/moves-${v.width}x${v.height}.png`});
      }
    }
  }catch(e){r.failure=String(e);r.failureBody=await page.locator('body').innerText().catch(()=> '');await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});}
  r.httpErrors=r.responses.filter(q=>q.status>=400);
  r.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,duration:e.duration,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize,initiatorType:e.initiatorType})));
  r.metrics={clickToSixCardsMs:r.timing.sixCards-r.timing.challengeClick,navigationToMovesMs:r.timing.movesReady,clickToMovesMs:r.timing.movesReady-r.timing.challengeClick,jsonBeforeCards:r.responses.filter(q=>q.ms<=r.timing.sixCards&&q.contentType?.includes('json')).length};
  await writeFile(`${dir}/result.json`,JSON.stringify(r,null,2));summary.runs.push({n,failure:r.failure,timing:r.timing,metrics:r.metrics,pageErrors:r.pageErrors,consoleErrors:r.consoleErrors,httpErrors:r.httpErrors,failedRequests:r.failedRequests,hmr:r.hmr});
  console.log(JSON.stringify(summary.runs.at(-1)));await browser.close();
}
await writeFile(`${output}/${process.env.PF_BASELINE_RUNS?'summary-'+width+'x'+height:'summary'}.json`,JSON.stringify(summary,null,2));
