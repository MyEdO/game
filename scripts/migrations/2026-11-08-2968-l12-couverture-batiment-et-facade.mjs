/**
 * Migration #2968 L12 (#1463) — la matière de couverture, le type de bâtiment et la structure de façade par
 * défaut désignés par `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient
 * `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `buildings.json › [].roofMaterial`, `semences-de-scene.json › roofDefaults.material`,
 *    `<projet> › scenes[].roofDefaults.material`, `› scenes[].architecture[].roofDefaults.material` et
 *    `› scenes[].architecture[].masses[].material` : `ref('material', undefined, 'roof')` ;
 *  - `<projet> › scenes[].architecture[].style` : `ref('building')` ;
 *  - `semences-de-scene.json › facade` : `ref('structure')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — les six documents des porteurs ; lues — `src/data/materials.json` (sa sous-liste `roof`),
 * `src/data/buildings.json` (catalogue des bâtiments) et `src/data/structures.json` (catalogue des structures).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Porteurs d'une scène de projet : la toiture de la scène, l'intention de toiture et les masses d'un corps, son type. */
const SCENE = {
  'roofDefaults.material': 'roof',
  'architecture[].roofDefaults.material': 'roof',
  'architecture[].masses[].material': 'roof',
  'architecture[].style': 'building',
};

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `8f3bc998e2`. */
const PAR_PORTEUR = {
  'buildings.json › roofMaterial': 7,
  'semences-de-scene.json › roofDefaults.material': 1,
  'semences-de-scene.json › facade': 1,
  'arene-projet.json › scenes[].roofDefaults.material': 18,
  'barge-du-sel-projet.json › scenes[].roofDefaults.material': 3,
  'diligence-projet.json › scenes[].roofDefaults.material': 4,
  'loup-et-saumure-projet.json › scenes[].roofDefaults.material': 5,
  'arene-projet.json › scenes[].architecture[].masses[].material': 9,
  'diligence-projet.json › scenes[].architecture[].style': 2,
};
const CARDINAL = 50;

/** Sous-liste `roof` du catalogue des matières (discriminant `domain`, `defs/materials.ts`). */
const roof = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/materials.json'), 'utf8'))
    .filter((m) => m.domain === 'roof')
    .map((m) => m.id),
);

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L12 couverture, bâtiment et façade',
  porteurs: {
    'src/data/buildings.json': { cles: { roofMaterial: 'roof' } },
    'src/data/semences-de-scene.json': { objet: true, cles: { 'roofDefaults.material': 'roof', facade: 'structure' } },
    ...tableTotale(PROJETS, () => ({ collection: 'scenes', cles: SCENE })),
  },
  catalogues: { roof, building: idsDe(ROOT, 'src/data/buildings.json'), structure: idsDe(ROOT, 'src/data/structures.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
