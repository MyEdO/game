/**
 * Migration #2968 L16b (#1463) — le corps d'une entité de scène désigné par `ref(type)`
 * (`src/data/schemas/grammaire/ref.ts`), sous une clé qui NOMME son type, jamais par un id nu sous `ref` :
 * `"ref": "x"` devient `"decor": { "id": "x" }` (décor), `"creature"`, `"vehicule"` ou `"engin"` (personnage).
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `<projet> › scenes[].entities[].ref`. La destination se lit au
 * `kind` de l'entité et, pour un personnage, au catalogue où l'id se trouve (`CibleRenommee`) ; la clé garde son rang,
 * les autres clés le leur.
 *
 * ENTRÉES : écrites — les quatre projets de campagne ; lues — `src/data/props.json`, `creatures.json`,
 * `vehicles.json`, `trappings.json` et `weaponGroups.json` (engins de siège : le marqueur `siege` du Groupe).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur et destination.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

const lire = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const groupesDeSiege = new Set(lire('src/data/weaponGroups.json').filter((g) => g.siege).map((g) => g.id));
const engins = new Set(lire('src/data/trappings.json').filter((t) => groupesDeSiege.has(t.subType?.id)).map((t) => t.id));

const PERSONNAGE = { kind: 'personnage' };
const CORPS = {
  vers: [
    { cle: 'decor', type: 'prop', si: { kind: 'prop' } },
    { cle: 'creature', type: 'creature', si: PERSONNAGE },
    { cle: 'vehicule', type: 'vehicle', si: PERSONNAGE },
    { cle: 'engin', type: 'engin', si: PERSONNAGE },
  ],
};

/** Gestes du premier passage par porteur et destination, mesurés le 2026-11-09 sur `2665df0c90`. */
const PAR_PORTEUR = {
  'arene-projet.json › scenes[].entities[].ref → decor': 291,
  'arene-projet.json › scenes[].entities[].ref → creature': 130,
  'barge-du-sel-projet.json › scenes[].entities[].ref → decor': 1,
  'barge-du-sel-projet.json › scenes[].entities[].ref → creature': 3,
  'barge-du-sel-projet.json › scenes[].entities[].ref → vehicule': 2,
  'diligence-projet.json › scenes[].entities[].ref → decor': 275,
  'loup-et-saumure-projet.json › scenes[].entities[].ref → decor': 2,
  'loup-et-saumure-projet.json › scenes[].entities[].ref → creature': 17,
  'loup-et-saumure-projet.json › scenes[].entities[].ref → vehicule': 4,
};
const CARDINAL = 725;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L16b corps d’entité',
  porteurs: tableTotale(PROJETS, () => ({ objet: true, cles: { 'scenes[].entities[].ref': CORPS } })),
  catalogues: {
    prop: idsDe(ROOT, 'src/data/props.json'),
    creature: idsDe(ROOT, 'src/data/creatures.json'),
    vehicle: idsDe(ROOT, 'src/data/vehicles.json'),
    engin: engins,
  },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
