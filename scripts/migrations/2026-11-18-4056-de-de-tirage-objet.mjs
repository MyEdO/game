/**
 * Migration #4056 — le dé de TIRAGE d'une table est un `DiceSpec` NdM, plus une expression.
 *
 *   forme d'avant                     forme d'après
 *   `"d100"`, `"1d100"`               `{ "n": 1, "sides": 100 }`
 *   `"2d10"`                          `{ "n": 2, "sides": 10 }`
 *
 * Le dé se juge au parse (`deDeTirageSchema`, `src/data/schemas/grammaire/valeurs.ts`).
 *
 * Entrées : toute clé `die` de `src/data/*.json` (seuls porteurs : aucun document de scène ni scénario n'en porte).
 *
 * Une expression illisible (hors « NdM », N et M entiers de 1) est un ARRÊT nominatif (exit 1), AUCUNE écriture.
 * Un dé déjà objet passe. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = join(ROOT, 'src/data');
const DE_LU = /^(\d*)d(\d+)$/i;

const arrets = [];
const gestes = new Map();

/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

/** Le `DiceSpec` NdM de l'expression `texte`, ou `null` (arrêt noté) si elle est illisible. */
function deDe(texte, chemin) {
  const m = DE_LU.exec(texte.trim());
  const n = m ? (m[1] ? Number(m[1]) : 1) : 0;
  const sides = m ? Number(m[2]) : 0;
  if (n < 1 || sides < 1) { arrets.push(`${chemin} : « ${texte} » illisible`); return null; }
  return { n, sides };
}

/** Migre, dans `noeud`, chaque `die` en expression. */
function parcourir(noeud, chemin, fichier) {
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => parcourir(v, `${chemin}[${i}]`, fichier)); return; }
  if (!noeud || typeof noeud !== 'object') return;
  if (typeof noeud.die === 'string') {
    const de = deDe(noeud.die, `${chemin}.die`);
    if (de) { noeud.die = de; gestes.set(fichier, (gestes.get(fichier) ?? 0) + 1); }
  }
  for (const [c, v] of Object.entries(noeud)) parcourir(v, `${chemin}.${c}`, fichier);
}

const ecritures = [];
for (const fichier of readdirSync(DATA).filter((f) => f.endsWith('.json')).sort()) {
  const chemin = join(DATA, fichier);
  const brut = readFileSync(chemin, 'utf8');
  if (!brut.includes('"die"')) continue;
  const doc = JSON.parse(brut);
  if (brut !== reserialise(doc, brut)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  parcourir(doc, fichier, fichier);
  if (gestes.get(fichier)) ecritures.push(() => writeFileSync(chemin, reserialise(doc, brut)));
}

if (arrets.length) {
  console.error(`migration #4056 dé de tirage — ${arrets.length} arrêt(s), aucune écriture :\n  ${arrets.join('\n  ')}`);
  process.exit(1);
}
for (const ecrire of ecritures) ecrire();
for (const [fichier, n] of gestes) console.log(`migration #4056 dé de tirage — ${fichier} : ${n} dé(s) en objet.`);
