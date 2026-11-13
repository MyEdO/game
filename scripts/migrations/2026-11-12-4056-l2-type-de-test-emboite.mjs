/**
 * Migration #4056 L2 — l'op `skillDRBonus` désigne son type de Test d'équipage par une référence EMBOÎTÉE.
 *
 *   forme d'avant                     forme d'après
 *   `testType: "<id>"`                `testType: { id: "<id>" }`
 *
 * La référence se juge au parse (`ref('crewTestType')`, `src/data/schemas/grammaire/mecanique.ts`).
 *
 * Entrées : `src/data/naval-traits.json`, `src/data/crew-test-types.json`.
 *
 * Un id absent de `crew-test-types.json#types` est un ARRÊT nominatif (exit 1), AUCUNE écriture. Une référence déjà
 * emboîtée passe. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = join(ROOT, 'src/data/naval-traits.json');
const TYPES = new Set(JSON.parse(readFileSync(join(ROOT, 'src/data/crew-test-types.json'), 'utf8')).types.map((t) => t.id));

const arrets = [];
let gestes = 0;

/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

/** Parcourt `noeud` et emboîte le `testType` à plat de chaque op `skillDRBonus`, à son rang. */
function parcourir(noeud, chemin) {
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => parcourir(v, `${chemin}[${i}]`)); return; }
  if (!noeud || typeof noeud !== 'object') return;
  if (noeud.op === 'skillDRBonus' && typeof noeud.testType === 'string') {
    if (!TYPES.has(noeud.testType)) arrets.push(`${chemin}.testType : « ${noeud.testType} » absent de crew-test-types.json#types`);
    noeud.testType = { id: noeud.testType };
    gestes++;
  }
  for (const [k, v] of Object.entries(noeud)) parcourir(v, `${chemin}.${k}`);
}

const brut = readFileSync(FICHIER, 'utf8');
const doc = JSON.parse(brut);
if (brut !== reserialise(doc, brut)) arrets.push('naval-traits.json : forme non canonique');
else parcourir(doc, 'naval-traits.json');

if (arrets.length) {
  console.error(`migration #4056 L2 — ${arrets.length} arrêt(s), aucune écriture :\n  ${arrets.join('\n  ')}`);
  process.exit(1);
}
if (gestes) {
  writeFileSync(FICHIER, reserialise(doc, brut));
  console.log(`migration #4056 L2 — ${gestes} type(s) de Test emboîté(s).`);
}
