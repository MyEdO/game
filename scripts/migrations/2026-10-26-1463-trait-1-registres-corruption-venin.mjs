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
 * FAIL-FAST — avant toute écriture, sortie 1 : un `arg` de Corruption qui ne nomme aucun Degré (son
 * registre est fermé) ; un fichier hors de son formatage ; une entrée de `traits.json` absente.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final), le projet de campagne `JSON.stringify(doc, null, 1) + '\n'`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis un script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);
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
/** Trait dont le registre est FERMÉ : un `arg` qui n'y nomme rien est une faute. */
const FERME = new Set(['corruption']);

/** Déclarations de `traits.json` : champs retirés, champs posés après `label`. */
const DECLARATIONS = {
  corruption: { retirer: ['indice'], poser: { specsSource: 'exposureLevels' } },
  venin: { retirer: ['indice'], poser: { specsSource: 'difficulties', specsOpen: true } },
  morsure: { retirer: [], poser: { specsOpen: true } },
  armure: { retirer: [], poser: { specsOpen: true } },
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
  if (i < 0) {
    fautes.push(`traits.json : « ${id} » absent`);
    continue;
  }
  const e = traits[i];
  const aFaire = decl.retirer.some((k) => k in e) || Object.entries(decl.poser).some(([k, v]) => e[k] !== v);
  if (aFaire) {
    traits[i] = declarer(e, decl);
    gestes++;
  }
}

/** Convertit en place l'`arg` de chaque Trait `corruption`/`venin` posé ou octroyé sous `noeud`. */
function convertir(noeud, rel) {
  if (Array.isArray(noeud)) return noeud.forEach((n) => convertir(n, rel));
  if (!noeud || typeof noeud !== 'object') return;
  const id = noeud.op === 'grantTrait' ? noeud.traitId : noeud.id;
  const paliers = Object.prototype.hasOwnProperty.call(PALIERS, id) ? PALIERS[id] : undefined;
  if (paliers && typeof noeud.arg === 'string') {
    const ids = new Set(Object.values(paliers));
    if (Object.prototype.hasOwnProperty.call(paliers, noeud.arg)) {
      noeud.arg = paliers[noeud.arg];
      gestes++;
    } else if (!ids.has(noeud.arg) && FERME.has(id)) fautes.push(`${rel} : ${id} « ${noeud.arg} » ne nomme aucun palier de son registre`);
  }
  for (const v of Object.values(noeud)) convertir(v, rel);
}
for (const rel of ['src/data/creatures.json', 'src/data/mutations.json', 'src/scenes/diligence/diligence-projet.json']) convertir(docs.get(rel).doc, rel);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant, serialiser }] of docs) {
  const apres = serialiser(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-1 : ${gestes} geste(s).`);
