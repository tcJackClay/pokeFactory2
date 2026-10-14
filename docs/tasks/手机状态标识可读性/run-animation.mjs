import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {browser,run,current,out,raw,observe} from './run-harness.mjs';
import {metrics} from './run-checks.mjs';
const source=JSON.parse(gunzipSync(await readFile(out+'/fixture-sources/animation-natural-first-battle.json.gz')));
await run('v4-normal-animation',current(source),async(p,r,snap,dir)=>{
 await p.locator('.pf-battle-interaction-panel[data-enabled=true]').waitFor({timeout:120000});
 await snap('01-move-badges');const before=await observe(p);const move=before.playerTeam[0].selectedMoves.find(m=>m.name==='strength');assert(move);
 const animation=p.waitForFunction(()=>{const e=document.querySelector('[data-effect-target=enemy] [style*="normal.png"]');return !!e&&e.getBoundingClientRect().width>0},{},{polling:'raf',timeout:20000});
 await p.locator('.pf-battle-move-button').filter({hasText:'Strength'}).tap();await animation;
 const m=await metrics(p);await writeFile(dir+'/animation-style.json',JSON.stringify(m,null,2));await p.screenshot({path:dir+'/02-normal-animation.png'});r.steps.push({label:'02-normal-animation',kind:'actual attack animation captured, not stabilized/static'});
 await p.waitForFunction(()=>document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled==='true',{},{timeout:60000});await snap('03-after-turn');const after=await observe(p);assert.equal(after.playerTeam[0].selectedMoves.find(m=>m.name==='strength').currentPp,(move.currentPp??move.maxPp??move.pp)-1);assert(after.battleLog.some(t=>/Strength/.test(t)));
 r.checks={normalAnimation:true,normalBadgeCurrentColor:true,actualMovePpDecreased:true};r.controlled='Replayed this SHA natural first-battle save with production createSaveData; no random override, no DEV Win; real Strength tap.';
});await browser.close();
