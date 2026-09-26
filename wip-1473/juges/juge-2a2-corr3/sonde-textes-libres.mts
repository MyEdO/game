// Compte les specs de Talent en texte libre (non résolues) dans creatures/careerLevels/species, par Talent,
// et leur admission par specsOpen — mesure de ce que couvrait l'ancien PLAFOND 24 (textes d'instance).
import { findTalentById, specResolves } from '/home/claude/game/.wt-1473-t2/src/data/index';
import { entreeOuverte } from '/home/claude/game/.wt-1473-t2/src/data/schemas/grammaire/ref';
import { readFileSync } from 'node:fs';
const R = '/home/claude/game/.wt-1473-t2/src/data/';
const par = new Map<string, number>(); let n = 0; let seen = 0;
const walk = (x: any, inTal = false) => {
  if (Array.isArray(x)) { for (const e of x) walk(e, inTal); return; }
  if (x && typeof x === 'object') {
    if (inTal && typeof x.id === 'string' && typeof x.spec === 'string') {
      seen++; const d = findTalentById(x.id);
      if (d && !specResolves(d as any, x.spec) && !/au choix/i.test(x.spec)) { n++; const k = `${x.id}${entreeOuverte('talent', x.id) ? '(ouverte)' : '(FERMEE)'}`; par.set(k, (par.get(k) ?? 0) + 1); }
    }
    for (const [k, v] of Object.entries(x)) walk(v, k === 'talents' || (inTal && k !== 'talents' ? false : inTal));
  }
};
for (const f of ['creatures', 'careerLevels', 'species']) walk(JSON.parse(readFileSync(R + f + '.json', 'utf8')));
console.log('seen', seen, 'non resolues', n, JSON.stringify([...par]));
