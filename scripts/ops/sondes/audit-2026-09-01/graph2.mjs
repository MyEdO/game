// SONDE (lecture seule) — graphe d'imports inverse `src`+`scripts` : nombre de tests reliés à huit fichiers-socles.
// Usage : node scripts/ops/sondes/audit-2026-09-01/graph2.mjs

import fs from 'node:fs'; import path from 'node:path';
import { RACINE } from './_socle.mjs';

const REPO=RACINE;
const SEP=path.sep;
const norm=(p)=>p.split(SEP).join('/');
const isTest=(f)=>f.endsWith('.test.ts')||f.endsWith('.test.tsx');
const EXTS=['.ts','.tsx','.mts','.mjs','.js','.jsx'];
const files=[];
const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name==='node_modules')continue;walk(p);}else if(EXTS.some(x=>e.name.endsWith(x)))files.push(norm(p));}};
walk(REPO+'/src'); walk(REPO+'/scripts');
const specsOf=(text)=>{const out=[];for(const line of text.split(String.fromCharCode(10))){if(!(line.includes('import')||line.includes('from')||line.includes('require')))continue;for(const q of ['"',String.fromCharCode(39)]){let i=line.indexOf(q);while(i>=0){const j=line.indexOf(q,i+1);if(j<0)break;const s=line.slice(i+1,j);if(s.startsWith('./')||s.startsWith('../'))out.push(s);i=line.indexOf(q,j+1);}}}return out;};
const resolve1=(from,spec)=>{const base=norm(path.resolve(path.dirname(from),spec));const cands=[base,...EXTS.map(e=>base+e),base+'.json',base+'/index.ts',base+'/index.tsx'];
  const alt=base.endsWith('.mjs')?base.slice(0,-4):(base.endsWith('.mts')?base.slice(0,-4):null);
  if(alt)cands.push(alt+'.mts',alt+'.ts',alt+'.mjs');
  for(const c of cands){try{if(fs.statSync(c).isFile())return norm(c);}catch{}}return null;};
const rev=new Map();let edges=0;
for(const f of files){let t;try{t=fs.readFileSync(f,'utf8');}catch{continue;}
  for(const s of specsOf(t)){const r=resolve1(f,s);if(r){edges++;if(!rev.has(r))rev.set(r,[]);rev.get(r).push(f);}}}
console.log('fichiers',files.length,'aretes',edges);
const reach=(t)=>{const seen=new Set([t]);const st=[t];while(st.length){const c=st.pop();for(const p of rev.get(c)||[])if(!seen.has(p)){seen.add(p);st.push(p);}}return [...seen].filter(isTest);};
for(const t of ['/src/data/careers.json','/src/engine/combat.ts','/src/ui/RollShell.tsx','/scripts/guards/lib/structuresStock.mjs','/src/data/index.ts','/src/noyau/combatFlow.ts','/src/data/schemas/types.ts','/src/engine/ops.ts']){
  console.log(t,'-> tests reliés:',reach(REPO+t).length);
}
console.log('total tests:',files.filter(isTest).length);
