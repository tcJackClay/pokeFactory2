import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const task=fileURLToPath(new URL('.',import.meta.url));
const root='evidence/final-ba5c0c2-stable/';
const cases=['v1-natural-eevee-final','v4-normal-animation'];
for(const lang of ['zh-hans','zh-hant','en']){cases.push('v1-v3-zero-events-'+lang+'-final');for(const streak of [999999,9007199254740991])cases.push('v2-'+lang+'-'+streak+'-final')}
const files=[];async function add(path){const b=await readFile(task+path);files.push({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')})}
async function walk(path){for(const e of await readdir(task+path,{withFileTypes:true})){if(e.isDirectory())await walk(path+e.name+'/');else await add(path+e.name)}}
const results=[];for(const c of cases){const r=JSON.parse(await readFile(task+root+c+'/result.json','utf8'));if(r.failure)throw Error(c+': '+r.failure);results.push({name:c,checks:r.checks,errors:r.errors,http:r.http,browser:r.browser});await walk(root+c+'/')}
await add(root+'environment.json');await add(root+'natural-eevee.json.gz');await add(root+'natural-first-battle.json.gz');await walk(root+'fixture-sources/');
await writeFile(task+root+'manifest.json',JSON.stringify({sha:'ba5c0c286d588868b081aa15851e89941f790f2a',scope:'11 final simulated-browser scenarios; no actual Android or production',cases:results,files},null,2));
await add(root+'manifest.json');for(const f of ['runtime.md','log.md','attempt-history.md','run-harness.mjs','run-checks.mjs','run-mobile.mjs','run-matrix.mjs','run-animation.mjs','make-manifest.mjs'])await add(f);
await writeFile(task+'commit-manifest.json',JSON.stringify({sha:'ba5c0c286d588868b081aa15851e89941f790f2a',files},null,2));
console.log(JSON.stringify({cases:results.length,files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),errors:results.filter(r=>r.errors.length||r.http.length).map(r=>r.name)}));
