// SONDE (lecture seule) — densité NARRATIVE du skill `orchestrer-des-agents` (SKILL.md et annexes) : part de caractères en récit daté/vécu, par section.
// Usage : node scripts/ops/sondes/audit-2026-09-01/classe.mjs

import { skillOrchestration } from './_socle.mjs';

const txt=skillOrchestration();
// unite = phrase (split sur . ; : ) en gardant la position
const NARR=/[Vv]écu|[Mm]esuré[e]?\b|Mesuré|audit 20|20\d\d-\d\d-\d\d|contre-modèle|flag de l|flag user|Audit 20/;
const SELF=/je (ne )?(sais|le sais|retiens|applique)|Mon grounding|ma pratique|je réponds bien/i;
let total=0, narr=0, self=0;
const units=txt.split(/(?<=[.;])\s+/);
for(const u of units){ total+=u.length; if(NARR.test(u)) narr+=u.length; else if(SELF.test(u)) self+=u.length; }
console.log('caracteres total',total,'| narratif(vecu/mesure date)',narr,(100*narr/total).toFixed(1)+'%','| auto-eval',self);
// densite par section : une section par titre Markdown (`#` ou `##`)
const secs=txt.split(/^(?=#{1,2} )/m).filter((s)=>s.trim());
for(const s of secs){ const n=s.split('\n')[0].replace(/^#+ /,''); const us=s.split(/(?<=[.;])\s+/); let t=0,v=0; for(const u of us){t+=u.length; if(NARR.test(u)) v+=u.length;} console.log(n,'lignes',s.split('\n').length,'chars',t,'narratif',v,(100*v/t).toFixed(0)+'%'); }
