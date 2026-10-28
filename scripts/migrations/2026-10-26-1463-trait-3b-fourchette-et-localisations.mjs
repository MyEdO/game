/**
 * Migration #1463 (PR-3b du Trait posé) — la fourchette (`plage`) et l'Indice par Localisation
 * (`parLocalisation`) d'un Trait, et l'Indice imprimé dans la parenthèse de l'Aspect.
 *
 * GESTES :
 *  1. `traits.json` : l'entrée `armure` DÉCLARE la capacité `parLocalisation` (le seul Trait qui lit un Indice
 *     par Localisation) et perd la raison `maison` des PR-3a et 3b : la lecture de sa parenthèse est celle du
 *     livre (#1463, arbitrage du 2026-10-27). La suite lit la CAPACITÉ, jamais cet id.
 *  2. CLASSEMENT, sur toute liste de Traits posés (`traits`, `optionals`, `addTraits`) des racines de
 *     `RACINES`, par la table PARTAGÉE avec la saisie (`src/engine/classementDeTrait.ts`, `classerParenthese`),
 *     pour un Trait dont la def déclare un Indice, posé avec une parenthèse et sans fourchette :
 *     - sans Indice hors de la parenthèse : fourchette → `plage` ; Aspect et Indice → `arg` et `value` ;
 *     - pour un Trait dont la def déclare `parLocalisation`, une parenthèse qui désigne des Localisations ou
 *       des pièces du catalogue des armures (`trappings.json`, colonne `loc`) → `parLocalisation`, l'Indice
 *       imprimé dehors compris.
 *     La parenthèse classée quitte `arg`, l'Indice dehors quitte `value`.
 *  3. VALEURS IMPRIMÉES : une valeur que la table ne lit pas (une fourchette lue comme un bonus négatif ou
 *     une portée, une parenthèse qui nomme un groupe de la table des armures) prend la forme de `IMPRIMEES`,
 *     chacune citée à sa ligne.
 *
 * ENTRÉES : écrites — les fichiers de `RACINES` et `src/data/traits.json` ; lue — `src/data/trappings.json`.
 * FAIL-FAST — avant toute écriture, sortie 1 : un hôte ou une liste introuvable ; une liste qui ne porte ni
 * l'instance d'origine ni l'instance migrée ; une entrée `armure` qui porte une autre raison `maison` ; un
 * fichier hors de son formatage ; ARBITRAGE REQUIS — une parenthèse d'un Trait à Indice par Localisation que
 * ni la table ni `IMPRIMEES` ne classent, hors des Aspects valant à toutes les Localisations
 * (`aspectAToutesLocalisations`).
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit. Les instances se
 * reconnaissent à leurs valeurs, jamais à l'ordre de leurs clés.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final), un projet de campagne `JSON.stringify(doc, null, 1) + '\n'`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aspectAToutesLocalisations, classerParenthese, emplacementsDesPieces, lirePlage } from '../../src/engine/classementDeTrait.ts';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const serializeProjet = (value) => `${JSON.stringify(value, null, 1)}\n`;

const CREATURES = 'src/data/creatures.json';
const TRAITS = 'src/data/traits.json';
const TRAPPINGS = 'src/data/trappings.json';
/** Racines qui posent des Traits, et leur sérialisation. */
const RACINES = {
  [CREATURES]: serializeDataset,
  'src/data/species.json': serializeDataset,
  'src/data/structures.json': serializeDataset,
  'src/data/vehicles.json': serializeDataset,
  'src/data/mass-battle.json': serializeDataset,
  'src/data/spells.json': serializeDataset,
  'src/scenes/arene/arene-projet.json': serializeProjet,
  'src/scenes/diligence/diligence-projet.json': serializeProjet,
};
/** Clés d'une liste de Traits posés. */
const LISTES = new Set(['traits', 'optionals', 'addTraits']);
/** LDB 85 l.37-39 */
const ARMURE = 'armure';

/** Raisons `maison` des PR-3a et 3b, retirées. */
const RAISONS_RETIREES = new Set([
  'La parenthèse de l’Armure se lit selon son type. Indice seul (type 1), catégorie des règles rapides, Légère ou Moyenne (type 4, LDB 63 l.101-103 « Tous »), nature du corps, peau, écailles, fourrure ou chitine (type 6), ensemble ou matière hors de la table, Cuir, Demi-plate, Plate complète, Divers (type 8) : l’Indice vaut à toutes les Localisations (LDB 85 l.39). Localisations nommées sous un seul Indice, « Poitrine » pour le Corps (type 2), un Indice par zone, les pattes du quadrupède comprises (type 3, AA 09 l.94), un Indice par pièce (type 5), pièces de la table, « Casque » pour la Tête (type 7, LDB 63 l.13) : l’Indice vaut aux seules Localisations désignées, union des Emplacements des pièces, et aucun PA ailleurs. Proposition en cérémonie (#1463).',
  'Un Aspect qui nomme des pièces d’armure (« Plastron et heaume », « Veste de cuir », « Chemise de mailles ») ne restreint pas l’Indice : il vaut à toutes les Localisations (LDB 85 l.39), et non aux seuls Emplacements des pièces nommées (LDB 63 l.13). Lecture proposée en cérémonie (#1463).',
]);

/** Instance `avant` de `hote.liste` (`creatures.json`) → instance `apres` (clés de valeur remplacées, le reste gardé). */
const IMPRIMEES = [
  // ZI 13 l.31
  { hote: 'sirene', liste: 'optionals', avant: { id: 'armure', value: -3 }, apres: { id: 'armure', plage: lirePlage('1-3') } },
  // ZI 13 l.31
  { hote: 'sirene', liste: 'optionals', avant: { id: 'peur', value: -2 }, apres: { id: 'peur', plage: lirePlage('1-2') } },
  // ZI 04 l.228
  { hote: 'experience-unique-du-clan-moulder', liste: 'optionals', avant: { id: 'resistance-a-la-magie', range: 13 }, apres: { id: 'resistance-a-la-magie', plage: lirePlage('1- 3') } },
  // MCLB 02 l.698 ; LDB 63 l.53-58
  { hote: 'moritz-valgeir', liste: 'traits', avant: { id: 'armure', value: 3, arg: 'Heaume 2, Plates 3' }, apres: { id: 'armure', parLocalisation: { tete: 2, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } } },
];

/** Clés qui disent la valeur d'une instance : elles seules changent. */
const CLES_DE_VALEUR = ['value', 'arg', 'range', 'plage', 'parLocalisation'];

/** Égalité de valeur JSON, sans égard à l'ordre des clés. */
function egal(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => egal(a[k], b[k]));
}
/** L'instance porte exactement les clés de valeur de `forme`. */
const porte = (x, forme) => x.id === forme.id && CLES_DE_VALEUR.every((k) => egal(x[k], forme[k]));

/** `x` aux clés de valeur de `forme`, ses autres clés gardées. */
function remplacer(x, forme) {
  const out = Object.fromEntries(Object.entries(x).filter(([k]) => !CLES_DE_VALEUR.includes(k)));
  for (const k of CLES_DE_VALEUR) if (forme[k] !== undefined) out[k] = forme[k];
  return out;
}

const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fautes = [];
const docs = new Map();
for (const [rel, serialiser] of [...Object.entries(RACINES), [TRAITS, serializeDataset]]) {
  const texte = lire(rel);
  const doc = JSON.parse(texte);
  if (serialiser(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte, serialiser });
}
let gestes = 0;
const defs = docs.get(TRAITS).doc;
const armure = defs.find((t) => t.id === ARMURE);
if (!armure) fautes.push(`${TRAITS} : ${ARMURE} introuvable`);
else {
  if (armure.parLocalisation !== true) {
    armure.parLocalisation = true;
    gestes++;
  }
  if (RAISONS_RETIREES.has(armure.maison)) {
    delete armure.maison;
    gestes++;
  } else if (armure.maison !== undefined) fautes.push(`${TRAITS} : ${ARMURE} porte une autre raison maison`);
}
const aIndice = new Set(defs.filter((t) => t.indice).map((t) => t.id));
const parLocalisation = new Set(defs.filter((t) => t.parLocalisation).map((t) => t.id));
const pieces = emplacementsDesPieces(JSON.parse(lire(TRAPPINGS)));

/** Chaque liste de Traits posés d'un document, à toute profondeur. */
function* listesDeTraits(noeud) {
  if (Array.isArray(noeud)) {
    for (const x of noeud) yield* listesDeTraits(x);
    return;
  }
  if (noeud === null || typeof noeud !== 'object') return;
  for (const [cle, valeur] of Object.entries(noeud)) {
    if (LISTES.has(cle) && Array.isArray(valeur) && valeur.every((x) => x !== null && typeof x === 'object')) yield valeur;
    yield* listesDeTraits(valeur);
  }
}

for (const rel of Object.keys(RACINES)) {
  for (const l of listesDeTraits(docs.get(rel).doc)) {
    l.forEach((x, i) => {
      if (!aIndice.has(x.id) || typeof x.arg !== 'string' || x.plage !== undefined) return;
      const classe = classerParenthese(x.arg, { indice: x.value, pieces: parLocalisation.has(x.id) ? pieces : undefined });
      if (!classe) return;
      const { arg: _arg, value: _value, ...reste } = x;
      l[i] = 'aspect' in classe ? { ...reste, arg: classe.aspect, value: classe.indice } : { ...reste, ...classe };
      gestes++;
    });
  }
}

const creatures = docs.get(CREATURES).doc;
for (const { hote, liste, avant, apres } of IMPRIMEES) {
  const l = creatures.find((e) => e.id === hote)?.[liste];
  if (!Array.isArray(l)) {
    fautes.push(`${CREATURES} : ${hote}.${liste} introuvable`);
    continue;
  }
  const i = l.findIndex((x) => porte(x, avant));
  if (i >= 0) {
    l[i] = remplacer(l[i], apres);
    gestes++;
  } else if (!l.some((x) => porte(x, apres))) {
    fautes.push(`${CREATURES} : ${hote}.${liste} ne porte ni ${JSON.stringify(avant)} ni ${JSON.stringify(apres)}`);
  }
}

const arbitrages = [];
for (const rel of Object.keys(RACINES)) {
  for (const l of listesDeTraits(docs.get(rel).doc)) {
    for (const x of l) {
      if (parLocalisation.has(x.id) && typeof x.arg === 'string' && !aspectAToutesLocalisations(x.arg)) arbitrages.push(`${rel} : ${x.id} (${x.arg})`);
    }
  }
}
if (arbitrages.length) fautes.push(`ARBITRAGE REQUIS — ${arbitrages.length} parenthèse(s) d'un Trait à Indice par Localisation, ni classée(s) ni d'un Aspect à toutes les Localisations :`, ...arbitrages);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant, serialiser }] of docs) {
  const apres = serialiser(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-3b : ${gestes} geste(s).`);
