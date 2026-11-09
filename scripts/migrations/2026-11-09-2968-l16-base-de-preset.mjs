/**
 * Migration #2968 L16 (#1463) — la créature de base d'un preset de PNJ désignée par `ref('creature')`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `<projet> › narratif.presetsPnj[].base`. La clé garde son
 * rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — les projets de campagne qui portent un preset à base ; lue — `src/data/creatures.json`.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
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

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `78b7b7d40f`. */
const PAR_PORTEUR = {
  'diligence-projet.json › narratif.presetsPnj[].base': 25,
};
const CARDINAL = 25;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L16 base de preset',
  porteurs: tableTotale(PROJETS, () => ({ objet: true, cles: { 'narratif.presetsPnj[].base': 'creature' } })),
  catalogues: { creature: idsDe(ROOT, 'src/data/creatures.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
