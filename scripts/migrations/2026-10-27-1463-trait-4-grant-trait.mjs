/**
 * Migration #1463 (PR-4 du Trait posé) — l'op `grantTrait` accorde un Trait POSÉ (`trait`), `removeTrait`
 * nomme le Trait qu'elle retire (`trait`), et la Cible tirée sur le Tableau des Obsessions désigne un Groupe.
 *
 * GESTES :
 *  1. `grantTrait` : `traitId`, `arg`, `indice`, `range` à plat → le Trait posé `trait` (`id`, `arg`, `value`,
 *     `range`) ; `argFrom: 'obsessions'` → la Cible tirée `cible: { pick: 1, table: { id: 'obsessions' } }`
 *     (EDOC 12 l.217, l.241). Les autres clés (`indicePerSL`, `onlyGroups`, durées) restent sur l'op.
 *  2. `removeTrait` : `traitId` → `trait: { id }`. `domeWard` : `traitId` et `indice` → le Trait octroyé
 *     `trait: { id, value }` (LDB 47 l.410).
 *  3. ARGUMENTS IMPRIMÉS : un `arg` que le registre du Trait ne résout pas prend la forme de `IMPRIMES`,
 *     chacun cité à sa ligne.
 *  4. `groups.json` : chaque Cible du Tableau des Obsessions absente du registre y entre (`OBSESSIONS`), à
 *     son libellé imprimé et au folio du Tableau (`obsessions.json`).
 *  5. `obsessions.json` : chaque rangée désigne son Groupe par son `id` ; son libellé quitte la rangée (le
 *     Groupe le porte).
 *
 * ENTRÉES : écrites — les fichiers de `RACINES`, `src/data/groups.json`, `src/data/obsessions.json`.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; une op qui porte à la fois
 * une clé à plat et `trait` ; un `argFrom` autre que `obsessions` ; une clé inconnue sur un `grantTrait`, un
 * `removeTrait` ou un `domeWard` ; un Indice de `domeWard` qui porte un terme de jet ; un Groupe de `OBSESSIONS` présent sous un autre libellé ; une rangée du Tableau introuvable
 * ou qui porte un libellé différent de celui de `OBSESSIONS`.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final), un projet de campagne `JSON.stringify(doc, null, 1) + '\n'`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const serializeProjet = (value) => `${JSON.stringify(value, null, 1)}\n`;

const GROUPS = 'src/data/groups.json';
const OBSESSIONS_JSON = 'src/data/obsessions.json';
/** Racines qui portent des ops, et leur sérialisation. */
const RACINES = {
  'src/data/domains.json': serializeDataset,
  'src/data/maneuvers.json': serializeDataset,
  'src/data/mutations.json': serializeDataset,
  'src/data/spells.json': serializeDataset,
  'src/data/symptoms.json': serializeDataset,
  'src/data/tables.json': serializeDataset,
  'src/data/traits.json': serializeDataset,
  'src/data/trappings.json': serializeDataset,
  'src/scenes/arene/arene-projet.json': serializeProjet,
  'src/scenes/barge-du-sel/barge-du-sel-projet.json': serializeProjet,
  'src/scenes/diligence/diligence-projet.json': serializeProjet,
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json': serializeProjet,
};

/** Clés à plat d'un `grantTrait` → clé du Trait posé. */
const A_PLAT = { traitId: 'id', arg: 'arg', indice: 'value', range: 'range' };
/** Clés que l'op garde. */
const CLES_DE_L_OP = new Set(['op', 'trait', 'cible', 'indicePerSL', 'onlyGroups', 'durationRounds', 'durationMinutes', 'durationHours']);
const CIBLE_OBSESSIONS = { pick: 1, table: { id: 'obsessions' } };

/** Trait (`id`) dont l'`arg` imprimé → la forme résolue (`arg` absent : le Trait est posé sans argument). */
const IMPRIMES = [
  // EDOC 13 l.236 ; LDB 85 l.316-331
  { id: 'souffle', avant: 'Feu', apres: { arg: 'feu' } },
  // EDOC 13 l.239 ; #3040
  { id: 'maladie', avant: 'Pourriture de Nurgle', apres: {} },
];

/** Folio du Tableau des Obsessions (`obsessions.json`). */
const SOURCE_EDOC = { book: 'ennemi-dans-l-ombre-compagnon', page: 69 };
/** Rangées du Tableau des Obsessions (EDOC 12 l.170) : `avant` = id de la rangée, `id` = son Groupe ; `neuf` pour un Groupe absent du registre. */
const OBSESSIONS = [
  { avant: 'objets-inanimes', id: 'objets-inanimes', label: 'Objets inanimés', neuf: true },
  { avant: 'pauvrete', id: 'pauvrete', label: 'Pauvreté', neuf: true },
  { avant: 'feu', id: 'feu', label: 'Feu', neuf: true },
  { avant: 'figures-symboles-de-guerre', id: 'figures-symboles-de-guerre', label: 'Figures/Symboles de guerre', neuf: true },
  { avant: 'figures-symboles-d-autorite', id: 'figures-symboles-d-autorite', label: 'Figures/Symboles d\'autorité', neuf: true },
  { avant: 'figures-symboles-religieux', id: 'figures-symboles-religieux', label: 'Figures/Symboles religieux', neuf: true },
  { avant: 'monstres', id: 'monstres', label: 'Monstres', neuf: true },
  { avant: 'mutants', id: 'mutants', label: 'Mutants', neuf: true },
  { avant: 'halflings', id: 'halfling', label: 'Halflings' },
  { avant: 'humains', id: 'humain', label: 'Humains' },
  { avant: 'nains', id: 'nain', label: 'Nains' },
  { avant: 'elfes', id: 'elfe', label: 'Elfes' },
  { avant: 'animaux-sauvages', id: 'animaux-sauvages', label: 'Animaux sauvages', neuf: true },
  { avant: 'animaux-domestiques', id: 'animaux-domestiques', label: 'Animaux domestiques', neuf: true },
  { avant: 'magie', id: 'magie', label: 'Magie', neuf: true },
  { avant: 'maladie', id: 'maladie', label: 'Maladie', neuf: true },
  { avant: 'eau', id: 'eau', label: 'Eau', neuf: true },
  { avant: 'richesse', id: 'richesse', label: 'Richesse', neuf: true },
  { avant: 'bonheur', id: 'bonheur', label: 'Bonheur', neuf: true },
];

const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fautes = [];
const docs = new Map();
for (const [rel, serialiser] of [...Object.entries(RACINES), [GROUPS, serializeDataset], [OBSESSIONS_JSON, serializeDataset]]) {
  const texte = lire(rel);
  const doc = JSON.parse(texte);
  if (serialiser(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte, serialiser });
}
let gestes = 0;

/** Le Trait posé d'un `grantTrait` à plat, ses arguments imprimés résolus. */
function traitPose(o) {
  const trait = {};
  for (const [plat, cle] of Object.entries(A_PLAT)) if (o[plat] !== undefined) trait[cle] = o[plat];
  const imprime = IMPRIMES.find((x) => x.id === trait.id && x.avant === trait.arg);
  if (!imprime) return trait;
  const { arg: _arg, ...reste } = trait;
  return { ...reste, ...imprime.apres };
}

/** Un terme de jet (`dice`, `rolled`, `sl`) à une profondeur quelconque d'une formule. */
const porteUnJet = (f) => f !== null && typeof f === 'object' && (['dice', 'rolled', 'sl'].some((k) => k in f) || Object.values(f).some(porteUnJet));

function migrerOp(o, rel) {
  if (o.op === 'domeWard') {
    if (o.traitId === undefined) return;
    if (o.trait !== undefined) return void fautes.push(`${rel} : domeWard porte « traitId » et « trait »`);
    for (const k of Object.keys(o)) if (!['op', 'traitId', 'indice'].includes(k)) fautes.push(`${rel} : domeWard porte la clé inconnue « ${k} »`);
    if (porteUnJet(o.indice)) return void fautes.push(`${rel} : l'Indice du domeWard porte un terme de jet`);
    const trait = { id: o.traitId, value: o.indice };
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, { op: 'domeWard', trait });
    gestes++;
    return;
  }
  if (o.op === 'removeTrait') {
    if (o.traitId === undefined) return;
    if (o.trait !== undefined) return void fautes.push(`${rel} : removeTrait porte « traitId » et « trait »`);
    const { traitId, ...reste } = o;
    for (const k of Object.keys(reste)) if (k !== 'op') fautes.push(`${rel} : removeTrait porte la clé inconnue « ${k} »`);
    delete o.traitId;
    o.trait = { id: traitId };
    gestes++;
    return;
  }
  const plates = Object.keys(o).filter((k) => k in A_PLAT || k === 'argFrom');
  for (const k of Object.keys(o)) if (!CLES_DE_L_OP.has(k) && !plates.includes(k)) fautes.push(`${rel} : grantTrait porte la clé inconnue « ${k} »`);
  if (!plates.length) return;
  if (o.trait !== undefined) return void fautes.push(`${rel} : grantTrait porte « ${plates.join(' », « ')} » et « trait »`);
  if (o.argFrom !== undefined && o.argFrom !== 'obsessions') return void fautes.push(`${rel} : argFrom « ${o.argFrom} » inconnu`);
  const trait = traitPose(o);
  const cible = o.argFrom === 'obsessions' ? CIBLE_OBSESSIONS : undefined;
  const reste = Object.fromEntries(Object.entries(o).filter(([k]) => !plates.includes(k) && k !== 'op'));
  for (const k of Object.keys(o)) delete o[k];
  Object.assign(o, { op: 'grantTrait', trait, ...(cible ? { cible } : {}), ...reste });
  gestes++;
}

function parcourir(noeud, rel) {
  if (Array.isArray(noeud)) return noeud.forEach((x) => parcourir(x, rel));
  if (noeud === null || typeof noeud !== 'object') return;
  if (noeud.op === 'grantTrait' || noeud.op === 'removeTrait' || noeud.op === 'domeWard') migrerOp(noeud, rel);
  for (const v of Object.values(noeud)) parcourir(v, rel);
}
for (const rel of Object.keys(RACINES)) parcourir(docs.get(rel).doc, rel);

const groupes = docs.get(GROUPS).doc;
for (const { id, label, neuf } of OBSESSIONS) {
  if (!neuf) {
    if (!groupes.some((g) => g.id === id)) fautes.push(`${GROUPS} : Groupe « ${id} » introuvable`);
    continue;
  }
  const g = groupes.find((x) => x.id === id);
  if (g) {
    if (g.label !== label) fautes.push(`${GROUPS} : « ${id} » porte le libellé « ${g.label} », attendu « ${label} »`);
    continue;
  }
  groupes.push({ id, type: 'groups', label, source: SOURCE_EDOC });
  gestes++;
}

const rangees = docs.get(OBSESSIONS_JSON).doc.entries;
for (const { avant, id, label } of OBSESSIONS) {
  const i = rangees.findIndex((r) => r.id === avant || r.id === id);
  if (i < 0) {
    fautes.push(`${OBSESSIONS_JSON} : rangée « ${avant} » introuvable`);
    continue;
  }
  const r = rangees[i];
  if (r.label !== undefined && r.label !== label) fautes.push(`${OBSESSIONS_JSON} : « ${r.id} » porte le libellé « ${r.label} », attendu « ${label} »`);
  if (r.id === id && r.label === undefined) continue;
  rangees[i] = { id, min: r.min, max: r.max };
  gestes++;
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant, serialiser }] of docs) {
  const apres = serialiser(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-4 : ${gestes} geste(s).`);
