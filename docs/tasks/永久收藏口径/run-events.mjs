import {browser,run,raw,waitBase,observe,rng,fault} from './runtime-harness.mjs';
import {eventFixture} from './fixtures.mjs';
const vm=async p=>(await observe(p)).state;
async function events(p){await p.getByRole('button',{name:'返回基地',exact:true}).waitFor({timeout:60000});await p.getByRole('button',{name:'返回基地',exact:true}).tap();await waitBase(p);await p.getByRole('button',{name:/事件/}).tap();await p.getByRole('button',{name:'领取结果',exact:true}).first().waitFor();}
const seedRng=async(p,v)=>p.evaluate(first=>{let n=0;Math.random=()=>n++===0?first:.001},v);
await run('r7-join-two-regions',eventFixture(),async(p,r,snap)=>{await events(p);await snap('01-ready');await seedRng(p,.7);await p.getByRole('button',{name:'领取结果',exact:true}).first().tap();await p.getByText(/认可了你的队伍/).waitFor({timeout:120000});let a=await snap('02-first');r.a=await vm(p);await p.touchscreen.tap(5,5);await seedRng(p,.7);await p.getByRole('button',{name:'领取结果',exact:true}).first().tap();await p.getByText(/认可了你的队伍/).waitFor({timeout:120000});let b=await snap('03-second');r.b=await vm(p);r.checks={twoReceipts:b.collection.acquisitions.length===3,twoAdded:r.b.playerTeam.length===3,ballsSpent:r.b.inventory.filter(x=>x.isBall).length===0,firstRetained:r.b.playerTeam.some(x=>x.id===r.a.playerTeam[1].id)};});
await browser.close();


