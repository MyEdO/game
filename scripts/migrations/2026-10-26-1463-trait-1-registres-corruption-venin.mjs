/**
 * Migration #1463 (PR-1 du Trait posé) — le Degré de Corruption et la Difficulté du Venin deviennent des
 * spécialisations de REGISTRE, désignées par id ; Morsure et Armure admettent un Aspect libre.
 *
 * GESTES :
 *  1. `traits.json` :
 *     - `corruption` perd `indice` (son Degré n'est pas un nombre, `LDB 85 l.85`) et déclare
 *       `specsSource: exposureLevels` ;
 *     - `venin` perd `indice` (sa Difficulté n'est pas un nombre, `LDB 85 l.423`) et déclare
 *       `specsSource: difficulties`, `specsOpen: true` (une fourchette imprimée n'est pas une Difficulté) ;
 *     - `morsure`, `armure` déclarent `specsOpen: true`.
 *  2. Partout où un Trait `corruption` ou `venin` est posé (`id`) ou octroyé (`grantTrait`, `traitId`),
 *     son `arg` qui NOMME un palier devient son id : Degré d'Exposition (`LDB 19 l.33`, `l.43`, `l.56`),
 *     Difficulté (`LDB 12 l.143-151`, `EDO App.2 l.156-165`). Un `arg` de Venin qui n'en nomme aucun reste.
 *
 * ENTRÉES : écrites — `src/data/traits.json`, `src/data/creatures.json`, `src/data/mutations.json`,
 * `src/scenes/diligence/diligence-projet.json` ; aucun autre fichier n'est lu.
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : une entrée de `traits.json` n'est déclarée que si les clés
 * de son geste sont EXACTEMENT à leur forme d'avant (`avant`) ; absente, déjà déclarée ou révisée après la
 * migration, elle est laissée telle quelle.
 * Un `arg` qui ne nomme aucun palier imprimé (déjà un id, ou révisé depuis) est laissé tel quel.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final), le projet de campagne `JSON.stringify(doc, null, 1) + '\n'`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { porteLaTranche } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const serializeProjet = (value) => `${JSON.stringify(value, null, 1)}\n`;

/** Chaque fichier, avec son formatage. */
const FICHIERS = {
  'src/data/traits.json': serializeDataset,
  'src/data/creatures.json': serializeDataset,
  'src/data/mutations.json': serializeDataset,
  'src/scenes/diligence/diligence-projet.json': serializeProjet,
};

/** Libellé imprimé → id, par Trait. */
const PALIERS = {
  corruption: { Mineure: 'mineure', Modérée: 'moderee', Majeure: 'majeure' },
  venin: {
    'Très Facile': 'tresFacile',
    Facile: 'facile',
    Accessible: 'accessible',
    Intermédiaire: 'intermediaire',
    Complexe: 'complexe',
    Difficile: 'difficile',
    'Très Difficile': 'tresDifficile',
    'Presque Impossible': 'presqueImpossible',
    Impossible: 'impossible',
  },
};
/** Déclarations de `traits.json` : forme d'avant des clés du geste, champs retirés, champs posés après `label`. */
const DECLARATIONS = {
  corruption: { avant: { indice: { label: 'Degré' }, specsSource: undefined }, retirer: ['indice'], poser: { specsSource: 'exposureLevels' } },
  venin: { avant: { indice: { label: 'Difficulté' }, specsSource: undefined, specsOpen: undefined }, retirer: ['indice'], poser: { specsSource: 'difficulties', specsOpen: true } },
  morsure: { avant: { specsOpen: undefined }, retirer: [], poser: { specsOpen: true } },
  armure: { avant: { specsOpen: undefined }, retirer: [], poser: { specsOpen: true } },
};

const fautes = [];
const docs = new Map();
for (const [rel, serialiser] of Object.entries(FICHIERS)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serialiser(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte, serialiser });
}

/** L'entrée `e` avec ses déclarations : `retirer` ôtés, `poser` placés juste après `label`. */
function declarer(e, { retirer, poser }) {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (retirer.includes(k) || k in poser) continue;
    out[k] = v;
    if (k === 'label') Object.assign(out, poser);
  }
  return out;
}

const traits = docs.get('src/data/traits.json').doc;
let gestes = 0;
for (const [id, decl] of Object.entries(DECLARATIONS)) {
  const i = traits.findIndex((t) => t.id === id);
  if (i < 0 || !porteLaTranche(traits[i], decl.avant)) continue;
  traits[i] = declarer(traits[i], decl);
  gestes++;
}

/** Convertit en place l'`arg` de chaque Trait `corruption`/`venin` posé ou octroyé sous `noeud`. */
function convertir(noeud) {
  if (Array.isArray(noeud)) return noeud.forEach(convertir);
  if (!noeud || typeof noeud !== 'object') return;
  const id = noeud.op === 'grantTrait' ? noeud.traitId : noeud.id;
  const paliers = Object.prototype.hasOwnProperty.call(PALIERS, id) ? PALIERS[id] : undefined;
  if (paliers && typeof noeud.arg === 'string' && Object.prototype.hasOwnProperty.call(paliers, noeud.arg)) {
    noeud.arg = paliers[noeud.arg];
    gestes++;
  }
  for (const v of Object.values(noeud)) convertir(v);
}
for (const rel of ['src/data/creatures.json', 'src/data/mutations.json', 'src/scenes/diligence/diligence-projet.json']) convertir(docs.get(rel).doc);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant, serialiser }] of docs) {
  const apres = serialiser(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-1 : ${gestes} geste(s).`);
