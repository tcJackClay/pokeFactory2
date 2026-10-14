import {chromium} from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
export const root='D:/Games/pokeFactory2-worktrees/dispatch-balls',sha=process.env.PF_SHA??'f713afd9b189b13e57e89404d638d1985c74eca2';
export const task=root+'/docs/tasks/派遣赠球与阿罗拉入口',out=task+'/evidence/final-'+sha.slice(0,7),origin='http://127.0.0.209:4308';
export const raw=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('pokefactory_save_v1')));
export const observe=p=>p.evaluate(()=>{let vm;for(const el of document.querySelectorAll('*')){let k=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));for(let f=k&&el[k],i=0;f&&i<16;i++,f=f.return){if(f.memoizedProps?.viewModel){vm=f.memoizedProps.viewModel;break}}if(vm)break}return vm?JSON.parse(JSON.stringify(vm.state??vm,(k,v)=>typeof v==='function'?undefined:v)):null});
export const waitBase=p=>p.getByRole('button',{name:/^(开始挑战|Start Run|開始挑戰|Resume Run|继续挑战)$/}).waitFor({timeout:60000});
export const card=(p,id='alola')=>p.locator(`[data-region-id=${id}]`);
export const events=async p=>{await waitBase(p);await p.getByRole('button',{name:/^(?:\d+\s*)?(Events|事件)$/}).tap();await card(p).waitFor()};
export const readSave=async name=>JSON.parse(gunzipSync(await readFile(out+'/'+name)));
export const store=async(name,data)=>{await mkdir(out,{recursive:true});await writeFile(out+'/'+name,gzipSync(JSON.stringify(data)))};
export async function rng(p,outcome=.1){await p.evaluate(value=>{window.__nativeRandom??=Math.random;window.__rngTrace=[];Math.random=()=>{const stack=new Error().stack;const controlled=stack.includes('rollDispatchOutcome');const v=controlled?value:window.__nativeRandom();if(controlled)window.__rngTrace.push({at:Date.now(),v,stack});return v}},outcome)}export async function fault(p,stage){await p.evaluate(mode=>{window.__setItemOriginal??=Storage.prototype.setItem;window.__faultMode=mode;window.__writeAttempts=[];Storage.prototype.setItem=function(k,v){if(k==='pokefactory_save_v1'){const s=JSON.parse(v),entry={revision:s.baseInventory?.revision,pending:Object.keys(s.events?.pendingResults??{}),completed:Object.keys(s.events?.completedResults??{}),balls:s.baseInventory?.balls};window.__writeAttempts.push(entry);if((window.__faultMode==='pending'&&entry.pending.length)||(window.__faultMode==='commit'&&entry.completed.length)){throw Error('PLAYER controlled '+window.__faultMode+' write fault')}}return window.__setItemOriginal.call(this,k,v)}},stage)}
export async function run(name,save,action,{viewport={width:390,height:844},before,controls=[]}={}){
 if(process.env.PF_CASES&&!process.env.PF_CASES.split(',').includes(name))return;
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==sha)throw Error('Frozen SHA mismatch');
 const dir=out+'/'+name;await mkdir(dir,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
 const context=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true,...(save?{storageState:{cookies:[],origins:[{origin,localStorage:[{name:'pokefactory_save_v1',value:JSON.stringify(save)}]}]}}:{})});
 const p=await context.newPage();p.setDefaultTimeout(20000);const r={startedAt:new Date().toISOString(),name,sha,browser:browser.version(),viewport,controlledSave:!!save,controls,noDevWin:true,errors:[],http:[],requestfailed:[],requests:[],checks:{},steps:[]};
 p.on('pageerror',e=>r.errors.push({at:new Date().toISOString(),type:'pageerror',message:String(e)}));p.on('console',e=>{if(e.type()==='error')r.errors.push({at:new Date().toISOString(),type:'console',message:e.text()})});p.on('request',e=>{if(e.url().includes('/api/'))r.requests.push({at:new Date().toISOString(),url:e.url()})});p.on('response',e=>{if(e.status()>=400)r.http.push({at:new Date().toISOString(),url:e.url(),status:e.status()})});p.on('requestfailed',e=>r.requestfailed.push({at:new Date().toISOString(),url:e.url(),failure:e.failure()}));
 const snap=async(label)=>{await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);let state={controlTrace:await p.evaluate(()=>({rng:window.__rngTrace,writes:window.__writeAttempts})),save:await raw(p),runtime:await observe(p),body:await p.locator('body').innerText(),layout:await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight}))};await writeFile(dir+'/'+label+'.json.gz',gzipSync(JSON.stringify(state)));await p.screenshot({path:dir+'/'+label+'.png',fullPage:true});r.steps.push({at:new Date().toISOString(),label,layout:state.layout,body:state.body});return state};
 try{if(save)await writeFile(dir+'/input.json.gz',gzipSync(JSON.stringify(save)));if(before)await before(p,r);await p.goto(origin,{waitUntil:'domcontentloaded'});await action(p,r,snap,dir)}catch(e){r.failure=String(e);await snap('failure').catch(()=>{})}
 r.endedAt=new Date().toISOString();r.injectedTrace=await p.evaluate(()=>({rng:window.__rngTrace,writes:window.__writeAttempts})).catch(()=>null);await writeFile(dir+'/result.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({name,failure:r.failure,checks:r.checks,errors:r.errors,http:r.http}));return r;
}



export async function captureRng(p,value){const source=await(await fetch(origin+'/src/features/game/hooks/useBattleController.ts')).text();const line=source.split('\n').findIndex(x=>x.includes('const caught = Math.random()'))+1;if(!line)throw Error('Capture RNG source missing');await p.evaluate(({value,line})=>{window.__nativeRandom??=Math.random;Math.random=()=>{const stack=new Error().stack;const controlled=stack.includes('useBattleController.ts:'+line+':');const v=controlled?value:window.__nativeRandom();if(controlled)(window.__rngTrace??=[]).push({at:Date.now(),v,stack,captureLine:line});return v}},{value,line})}


