/**
 * Migration #2968 L11 (#1463) — le terrain, le décor de recouvrement d'un terrain et la matière de relief
 * désignés par `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient
 * `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `defauts-de-compilation.json › cheminDeRonde`, `› masse`, `› pont` : `ref('terrain')` ;
 *  - `semences-de-scene.json › terrain` : `ref('terrain')` ;
 *  - `traits.json › [].passive[].terrain` (op `offTerrainMod`) : `ref('terrain')` ;
 *  - `terrains.json › [].overlayProp` : `ref('prop')` ;
 *  - `terrains.json › [].matiere`, `semences-de-scene.json › reliefDefaults.<partie>` et
 *    `<projet> › scenes[].reliefDefaults.<partie>` : `ref('material', undefined, 'relief')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — les six documents des porteurs ; lues — `src/data/terrains.json` (catalogue des
 * terrains), `src/data/props.json` (catalogue des décors) et `src/data/materials.json` (sa sous-liste `relief`).
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

/** Parties de relief d'une scène (`PARTS_RELIEF`, `src/data/materials.types.ts`). */
const RELIEF = { 'reliefDefaults.cliff': 'relief', 'reliefDefaults.ramp': 'relief', 'reliefDefaults.deck': 'relief', 'reliefDefaults.pilier': 'relief' };

const PROJETS = {
  'arene-projet.json': 'src/scenes/arene/arene-projet.json',
  'barge-du-sel-projet.json': 'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'diligence-projet.json': 'src/scenes/diligence/diligence-projet.json',
  'loup-et-saumure-projet.json': 'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
};

/** Scènes par projet, mesurées le 2026-11-08 sur `2b785c1b9f` : quatre parties de relief chacune. */
const SCENES = { 'arene-projet.json': 18, 'barge-du-sel-projet.json': 3, 'diligence-projet.json': 4, 'loup-et-saumure-projet.json': 5 };

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `2b785c1b9f`. */
const PAR_PORTEUR = {
  'defauts-de-compilation.json › cheminDeRonde': 1,
  'defauts-de-compilation.json › masse': 1,
  'defauts-de-compilation.json › pont': 1,
  'semences-de-scene.json › terrain': 1,
  ...Object.fromEntries(Object.keys(RELIEF).map((cle) => [`semences-de-scene.json › ${cle}`, 1])),
  'traits.json › passive[].terrain': 3,
  'terrains.json › overlayProp': 1,
  'terrains.json › matiere': 1,
  ...Object.fromEntries(Object.entries(SCENES).flatMap(([projet, n]) => Object.keys(RELIEF).map((cle) => [`${projet} › scenes[].${cle}`, n]))),
};
const CARDINAL = 133;

/** Sous-liste `relief` du catalogue des matières (discriminant `domain`, `defs/materials.ts`). */
const relief = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/materials.json'), 'utf8'))
    .filter((m) => m.domain === 'relief')
    .map((m) => m.id),
);

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L11 terrain, décor et relief',
  porteurs: {
    'src/data/defauts-de-compilation.json': { objet: true, cles: { cheminDeRonde: 'terrain', masse: 'terrain', pont: 'terrain' } },
    'src/data/semences-de-scene.json': { objet: true, cles: { terrain: 'terrain', ...RELIEF } },
    'src/data/traits.json': { cles: { 'passive[].terrain': 'terrain' } },
    'src/data/terrains.json': { cles: { overlayProp: 'prop', matiere: 'relief' } },
    ...tableTotale(Object.values(PROJETS), () => ({ collection: 'scenes', cles: RELIEF })),
  },
  catalogues: { terrain: idsDe(ROOT, 'src/data/terrains.json'), prop: idsDe(ROOT, 'src/data/props.json'), relief },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
