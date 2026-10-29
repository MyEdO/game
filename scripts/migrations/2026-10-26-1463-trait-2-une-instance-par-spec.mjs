/**
 * Migration #1463 (PR-2 du Trait posé) — une instance de Trait porte UNE spécialisation : le marqueur
 * `specsMulti` part, et chaque instance qui joignait plusieurs specs dans son `arg` est éclatée en autant
 * d'instances, à la place de l'originale.
 *
 * GESTES :
 *  1. `traits.json` : le champ `specsMulti` est retiré de toute entrée.
 *  2. L'instance de `ECLATEMENTS` (profil imprimé cité ligne par ligne) EXACTEMENT à sa forme d'avant
 *     `{ id: trait, arg }` devient une instance par spec.
 *
 * ENTRÉES : écrites — `src/data/traits.json`, `src/data/creatures.json`,
 * `src/scenes/diligence/diligence-projet.json` ; aucun autre fichier n'est lu.
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : un hôte absent, une instance déjà éclatée ou révisée
 * après la migration, est laissé tel quel.
 * FAIL-FAST — avant toute écriture, sortie 1 : une instance d'un Trait à registre FERMÉ dont l'`arg` joint
 * encore plusieurs parts par une virgule ; un fichier hors de son formatage.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final), le projet de campagne `JSON.stringify(doc, null, 1) + '\n'`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { remplacerLaFormeDAvant } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const serializeProjet = (value) => `${JSON.stringify(value, null, 1)}\n`;

const TRAITS = 'src/data/traits.json';
const CREATURES = 'src/data/creatures.json';
const DILIGENCE = 'src/scenes/diligence/diligence-projet.json';

/** Chaque fichier, avec son formatage et l'accès à une liste d'instances (`liste`) de l'hôte `hote`. */
const FICHIERS = {
  [TRAITS]: { serialiser: serializeDataset },
  [CREATURES]: { serialiser: serializeDataset, listes: (doc) => doc.map((e) => [e.id, e]) },
  [DILIGENCE]: { serialiser: serializeProjet, listes: (doc) => (doc.narratif?.presetsPnj ?? []).map((p) => [p.id, p.profil ?? {}]) },
};

/** Instance à éclater `{ id: trait, arg }` → une instance par entrée de `specs` (ids du registre du Trait). */
const ECLATEMENTS = [
  // LDB 77 l.95
  { fichier: CREATURES, hote: 'bella-la-noire', liste: 'traits', trait: 'animosite', arg: 'noble, homme-bete', specs: ['noble', 'homme-bete'] },
  // LDB 77 l.95
  { fichier: CREATURES, hote: 'bella-la-noire', liste: 'traits', trait: 'prejuge', arg: 'bailli, juriste', specs: ['bailli', 'juriste'] },
  // EDOC 13 l.606
  { fichier: CREATURES, hote: 'furie-du-chaos', liste: 'optionals', trait: 'effraye', arg: 'demon, demonologue', specs: ['demon', 'demonologue'] },
  // MCLB 10 l.95, l.97 ; LDB 47 l.7, l.9
  { fichier: CREATURES, hote: 'babrakkos', liste: 'traits', trait: 'lanceur-de-sorts', arg: 'Mort et Nécromancie', specs: ['mort', 'necromancie'] },
  // EDO 02 l.301
  { fichier: DILIGENCE, hote: 'edo-patrouilleurs-de-pflaster', liste: 'traits', trait: 'prejuge', arg: 'criminel, personnes-qui-ne-leur-offrent-rien', specs: ['criminel', 'personnes-qui-ne-leur-offrent-rien'] },
];

const fautes = [];
const docs = new Map();
for (const [rel, { serialiser }] of Object.entries(FICHIERS)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serialiser(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte, serialiser });
}

let gestes = 0;
const traits = docs.get(TRAITS).doc;
for (const t of traits) {
  if (Object.prototype.hasOwnProperty.call(t, 'specsMulti')) {
    delete t.specsMulti;
    gestes++;
  }
}

/** Liste `liste` de l'hôte `hote` dans `rel`, ou `undefined`. */
function listeDe(rel, hote, liste) {
  return FICHIERS[rel].listes(docs.get(rel).doc).find(([id]) => id === hote)?.[1]?.[liste];
}

for (const { fichier, hote, liste, trait, arg, specs } of ECLATEMENTS) {
  gestes += remplacerLaFormeDAvant(listeDe(fichier, hote, liste), { id: trait, arg }, specs.map((spec) => ({ id: trait, arg: spec })));
}

/** Traits à registre FERMÉ : une virgule dans leur `arg` joint plusieurs specs. */
const fermes = new Set(traits.filter((t) => t.specsSource && !t.specsOpen).map((t) => t.id));
for (const rel of [CREATURES, DILIGENCE]) {
  for (const [hote, porteur] of FICHIERS[rel].listes(docs.get(rel).doc)) {
    for (const liste of ['traits', 'optionals']) {
      for (const x of porteur?.[liste] ?? []) {
        if (fermes.has(x?.id) && typeof x.arg === 'string' && x.arg.includes(',')) fautes.push(`${rel} : ${hote}.${liste} ${x.id} « ${x.arg} » joint plusieurs specs, hors table`);
      }
    }
  }
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant, serialiser }] of docs) {
  const apres = serialiser(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-2 : ${gestes} geste(s).`);
