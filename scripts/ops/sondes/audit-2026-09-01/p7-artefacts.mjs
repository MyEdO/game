// SONDE (lecture seule) — skill `orchestrer-des-agents` (SKILL.md et annexes) : chemins cités existants/MORTS, portes exécutables citées, part des segments de vécu porteurs d'une clause normative.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p7-artefacts.mjs

import fs from 'fs';
import { RACINE, skillOrchestration } from './_socle.mjs';

const root=RACINE + '/';
const t=skillOrchestration();
const paths=[...new Set([...t.matchAll(/`([a-zA-Z0-9_./-]*(?:src|scripts|\.claude|docs)[a-zA-Z0-9_./-]*)`/g)].map(m=>m[1]))];
const ok=paths.filter(p=>fs.existsSync(root+p)), ko=paths.filter(p=>!fs.existsSync(root+p));
console.log('chemins cites',paths.length,'existent',ok.length,'MORTS',ko.length);
console.log('morts:',ko.join(', '));
// portes executables citees
const portes=[...new Set([...t.matchAll(/`([a-zA-Z0-9_./-]+\.(test\.tsx?|mjs|mts))`/g)].map(m=>m[1]))];
console.log('portes executables citees:',portes.length,portes.join(', '));
// segments vecu contenant aussi une norme
const sent=t.split(/(?<=[.!?»])\s+/);
const rx=/([Vv]écu|[MmÉé]esuré|[Aa]udit 20)/;
const norm=/(jamais|OBLIGATOIRE|tout brief|doit|se \w+ent\b|exige|interdit|→)/i;
let both=0,only=0;for(const s of sent){if(rx.test(s)){if(norm.test(s))both++;else only++;}}
console.log('segments vecu AVEC clause normative',both,'/ vecu pur',only);
