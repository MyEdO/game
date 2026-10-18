// SONDE (lecture seule) — table Rationalisations du skill : chaque ligne est-elle COUVERTE par une fiche de mémoire.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p12-artefacts.mjs

import fs from 'fs';
import path from 'path';
import { RACINE, skillOrchestration } from './_socle.mjs';

const root=RACINE;
const memdir=path.join(root,'.claude/memory');
const corpus=fs.readdirSync(memdir).filter(f=>f.endsWith('.md')).map(f=>({f,t:fs.readFileSync(path.join(memdir,f),'utf8')}));
const t=skillOrchestration();
const a=t.indexOf('## Rationalisations'),b=t.indexOf('## Red flags');
const rows=t.slice(a,b).split(/\r?\n/).filter(l=>/^\|/.test(l)).slice(2);
const stop=new Set(['dans','pour','avec','plus','sans','tout','tous','cette','leur','elle','mais','donc','alors','quand','celui','autre','meme','même','fait','fois','jamais','toute','entre','apres','après','avant','chaque','encore','seul','seule','deja','déjà','pas','que','qui','une','des','les','est','par','sur','aux','ils','son','ses','peut','fera','laffaire','trouve','trouvée']);
for(const r of rows){
 const cells=r.split('|');const excuse=(cells[1]||'').trim().slice(0,45);const real=(cells[2]||'');
 const toks=[...new Set((real.match(/#\d{2,4}|`[A-Za-z0-9_.]{4,}`|[0-9]{4}-[0-9]{2}-[0-9]{2}|[A-Za-zÀ-ÿ]{6,}/g)||[]).map(x=>x.replace(/`/g,'')))].filter(x=>!stop.has(x.toLowerCase())).slice(0,8);
 let best=null;
 for(const c of corpus){const n=toks.filter(k=>c.t.includes(k)).length;if(!best||n>best.n)best={f:c.f,n};}
 console.log((best.n>=2?'COUVERT ':'ORPHELIN')+' ['+best.n+'/'+toks.length+'] '+excuse+' -> '+best.f);
}
