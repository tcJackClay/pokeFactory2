import assert from 'node:assert/strict';
import {run,raw,waitBase,events,card,store,readSave,rng} from './run-harness.mjs';
let s=await readSave('natural-first-gift.json.gz');s.events.dispatches.alola={status:'READY',startedAt:40000,readyAt:50000,lastResolvedAt:null,lastResult:''};
await run('r4-first-join-real-gift',s,async(p,r,snap)=>{
 await events(p);await rng(p,.7);await card(p).getByRole('button',{name:'领取结果',exact:true}).tap();await p.getByText(/认可了你的队伍/).waitFor({timeout:180000});let a=await snap('01-joined');assert.equal(a.save.baseInventory.balls.pokeball,2);assert.equal(a.save.baseInventory.transactions.at(-1).kind,'JOIN');assert.equal(a.save.collection.acquisitions.length,1);assert.equal(a.save.events.resourceCheckpoint.playerTeam.length,1);assert(a.save.collection.ownedIds.includes(a.save.events.resourceCheckpoint.playerTeam[0].id));await store('actual-joined-save.json.gz',a.save);r.checks.realGiftConsumedAndPermanentJoin=true;await p.reload();await waitBase(p);let re=await snap('02-join-reload');assert.equal(re.save.baseInventory.balls.pokeball,2);assert.equal(re.save.events.resourceCheckpoint.playerTeam.length,1);r.checks.reloadKeepsPartyAndBalls=true;
},{controls:['Actual first gift save; next Alola READY timing controlled','Outcome join and target left to original RNG; no injected ball/team']});

