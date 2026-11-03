/**
 * Migration #1463 (PR-3c du Trait posé) — la matière de l'Armure du Trait (`TraitPose.matiere`), lue par les
 * règles qui contournent une matière (Perforante LDB 62 l.270, Cieux LDB 48 l.106, Métal LDB 48 l.399, Magie
 * des Arcanes LDB 46 l.150-152).
 *
 * GESTES, sur les Traits dont la def déclare l'Indice par Localisation (`traits.json`, `parLocalisation`) :
 *  1. ASPECT : une instance de `creatures.json` (`traits`, `optionals`, `addTraits`) qui porte un Aspect (`arg`)
 *     et aucune matière reçoit celle que la saisie lit (`lireMatiere`, `src/engine/classementDeTrait.ts`).
 *  2. IMPRIMÉES : une instance dont l'Aspect imprimé a quitté la donnée (classée en `parLocalisation` par la
 *     PR-3b, ou jamais saisi) prend la forme de `IMPRIMEES`, chacune citée à sa ligne.
 *
 * ENTRÉES : lues — `src/data/traits.json`, `src/data/trappings.json`, `src/data/weaponGroups.json` ; écrites —
 * `src/data/creatures.json`, `src/data/maneuvers.json`.
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : une instance de `IMPRIMEES` n'est réécrite qu'EXACTEMENT à sa
 * forme d'avant ; une instance qui porte déjà une matière n'est pas touchée.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture (`serializeDataset`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { emplacementsDesPieces, lireMatiere } from '../../src/engine/classementDeTrait.ts';
import { serializeDataset } from '../../src/data/serialize.ts';
import { remplacerLaFormeDAvant } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CREATURES = 'src/data/creatures.json';
const MANEUVERS = 'src/data/maneuvers.json';
const TRAITS = 'src/data/traits.json';
const TRAPPINGS = 'src/data/trappings.json';
const WEAPON_GROUPS = 'src/data/weaponGroups.json';
/** Clés d'une liste de Traits posés. */
const LISTES = new Set(['traits', 'optionals', 'addTraits']);

const parLoc = (tete, bras, corps, jambes) => ({ tete, brasG: bras, brasD: bras, corps, jambeG: jambes, jambeD: jambes });

/** Instance `avant` de `hote.liste` (`creatures.json`) → instance `apres`. */
const IMPRIMEES = [
  // MCLB 02 l.85 ; LDB 63 l.55, l.58
  { hote: 'wolfgard-hohmann', liste: 'traits', avant: { id: 'armure', parLocalisation: parLoc(2, 0, 2, 0) }, apres: { id: 'armure', parLocalisation: parLoc(2, 0, 2, 0), matiere: 'metal' } },
  // MCLB 02 l.101 ; LDB 63 l.55, l.58
  { hote: 'wereburga-krotpreffer', liste: 'traits', avant: { id: 'armure', parLocalisation: parLoc(2, 0, 2, 0) }, apres: { id: 'armure', parLocalisation: parLoc(2, 0, 2, 0), matiere: 'metal' } },
  // MCLB 02 l.698 ; LDB 63 l.53-58
  { hote: 'moritz-valgeir', liste: 'traits', avant: { id: 'armure', parLocalisation: parLoc(2, 3, 3, 3) }, apres: { id: 'armure', parLocalisation: parLoc(2, 3, 3, 3), matiere: 'metal' } },
  // MCLB 02 l.1326 ; LDB 63 l.45
  { hote: 'marta-gerbenshreiber', liste: 'traits', avant: { id: 'armure', parLocalisation: parLoc(0, 1, 1, 0) }, apres: { id: 'armure', parLocalisation: parLoc(0, 1, 1, 0), matiere: 'leather' } },
  // MCLB 02 l.2014 ; LDB 63 l.45
  { hote: 'agna-lottrisdottir', liste: 'traits', avant: { id: 'armure', parLocalisation: parLoc(0, 1, 1, 0) }, apres: { id: 'armure', parLocalisation: parLoc(0, 1, 1, 0), matiere: 'leather' } },
  // MCLB 02 l.2034 ; LDB 63 l.50
  { hote: 'helmut-beckenbauer', liste: 'traits', avant: { id: 'armure', parLocalisation: parLoc(0, 0, 2, 0) }, apres: { id: 'armure', parLocalisation: parLoc(0, 0, 2, 0), matiere: 'metal' } },
  // MCLB 04 l.29
  { hote: 'enfant-d-ulric', liste: 'traits', avant: { id: 'armure', value: 2 }, apres: { id: 'armure', arg: 'Peau', value: 2, matiere: 'peau' } },
  // MCLB 04 l.70
  { hote: 'loup-blanc', liste: 'traits', avant: { id: 'armure', value: 1 }, apres: { id: 'armure', arg: 'Peau', value: 1, matiere: 'peau' } },
  // VDM 13 l.252, l.497
  { hote: 'familier-de-combat', liste: 'traits', avant: { id: 'armure', value: 2 }, apres: { id: 'armure', value: 2, matiere: 'metal' } },
  // MDG 16 l.464 ; LDB 63 l.97
  { hote: 'wulfrik', liste: 'traits', avant: { id: 'armure', value: 4 }, apres: { id: 'armure', value: 4, matiere: 'metal' } },
  // ADE II 01 l.229 ; ADE II 02 l.652 ; LDB 63 l.49, l.51-52
  { hote: 'isrogdal-lempresse', liste: 'traits', avant: { id: 'armure', value: 2 }, apres: { id: 'armure', value: 2, matiere: 'metal' } },
];
/** Trait accordé `avant` par la manœuvre `hote` (op `grantTrait`) → `apres`. MCLB 04 l.29 */
const ACCORDEES = [
  { hote: 'forme-hybride-ulric', avant: { id: 'armure', value: 2 }, apres: { id: 'armure', arg: 'Peau', value: 2, matiere: 'peau' } },
];

const fautes = [];
const charger = (rel) => {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  return { rel, doc, avant: texte };
};
const lire = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const creatures = charger(CREATURES);
const maneuvers = charger(MANEUVERS);
const armures = new Set(lire(TRAITS).filter((t) => t.parLocalisation).map((t) => t.id));
const groupes = new Map(lire(WEAPON_GROUPS).filter((g) => g.kind === 'armour').map((g) => [g.id, g.material]));
const pieces = emplacementsDesPieces(lire(TRAPPINGS), (groupe) => groupes.get(groupe));

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

/** Chaque op `grantTrait` d'un nœud, à toute profondeur. */
function* octrois(noeud) {
  if (Array.isArray(noeud)) {
    for (const x of noeud) yield* octrois(x);
    return;
  }
  if (noeud === null || typeof noeud !== 'object') return;
  if (noeud.op === 'grantTrait') yield noeud;
  for (const valeur of Object.values(noeud)) yield* octrois(valeur);
}

let gestes = 0;
for (const l of listesDeTraits(creatures.doc)) {
  for (const x of l) {
    if (!armures.has(x.id) || typeof x.arg !== 'string' || x.matiere !== undefined) continue;
    const matiere = lireMatiere(x.arg, { indice: x.value, pieces });
    if (!matiere) continue;
    x.matiere = matiere;
    gestes++;
  }
}
for (const { hote, liste, avant, apres } of IMPRIMEES) {
  gestes += remplacerLaFormeDAvant(creatures.doc.find((e) => e.id === hote)?.[liste], avant, [apres]);
}
for (const { hote, avant, apres } of ACCORDEES) {
  for (const op of octrois(maneuvers.doc.find((e) => e.id === hote))) {
    if (!egal(op.trait, avant)) continue;
    op.trait = structuredClone(apres);
    gestes++;
  }
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const { rel, doc, avant } of [creatures, maneuvers]) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-3c : ${gestes} geste(s).`);
