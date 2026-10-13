import {gunzipSync} from 'node:zlib';
import {createSaveData,createEmptyRunSupply,parseSaveDataFromText} from '../../../src/services/saveManager.ts';
import {readFile,writeFile} from 'node:fs/promises';
import {out} from './fixture-path.mjs';
export const natural=JSON.parse(await readFile(out+'/natural-battle.json','utf8'));
export function current(s){return createSaveData({...s.progress,...s.settings,companionSpeciesId:s.progress.companionSpeciesId,wallet:s.wallet,runSupply:s.runSupply,factory:s.factory,collection:s.collection,events:s.events})}
const realEventSource=JSON.parse(gunzipSync(await readFile(out+'/fixture-sources/event-party-natural-b2d5863.json.gz')));
export function eventFixture(balls=2,full=false){const s=structuredClone(natural);s.factory.battleResume=structuredClone(realEventSource.factory.battleResume);const b=s.factory.battleResume;b.phase='ROUND_RESULT';b.roundResult='LOSS';b.playerTeam=full?[...b.playerTeam,...b.enemyTeam]:[b.playerTeam[0]];b.inventoryItemIds=Array(balls).fill('masterball');s.wallet.currentRunId=null;s.runSupply=createEmptyRunSupply();s.factory.challengePaused=false;s.factory.challengeStatus=0;s.collection.acquisitions=[{acquisitionId:'dispatch:paldea:1000',speciesId:b.playerTeam[0].id,source:'DISPATCH_JOIN',regionId:'paldea',dispatchStartedAt:1000,acquiredAt:2000}];for(const reg of ['kanto','hoenn']){s.events.dispatchPokemonByRegion[reg]=b.playerTeam[0].id;s.events.dispatches[reg]={status:'READY',startedAt:10000,readyAt:11000,lastResolvedAt:null,lastResult:''}}return current(s)}
