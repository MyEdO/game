/**
 * Migration #2968 (#1463) L17, concept « fond » — la bande d'ambiance désignée par `ref('fond')`
 * (`src/data/schemas/grammaire/ref.ts`, espace `vocabulaire:fonds`, #2968 P-art), jamais par un id nu :
 * `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `lieux-services.json › [].backdrop` et
 * `loup-et-saumure-projet.json › worldMap.places[].backdrop`, chacun `ref('fond')`. Aucun des trois autres
 * projets ne porte de fond.
 *
 * ENTRÉES : écrites et lues — `src/data/lieux-services.json`, `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` ;
 * lues — les defs du registre des fonds (`src/data/fonds/defs`, `vocabulaireDuRegistre` de
 * `scripts/gen-registry.mjs`), catalogue de la cible.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { REGISTRIES, vocabulaireDuRegistre } from '../gen-registry.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Le registre dont le vocabulaire est l'espace du type `fond`. */
const REGISTRE = REGISTRIES.find((r) => r.vocabulaire?.nom === 'fonds');

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `bea57563a4`. */
const PAR_PORTEUR = {
  'lieux-services.json › backdrop': 4,
  'loup-et-saumure-projet.json › worldMap.places[].backdrop': 2,
};
const CARDINAL = 6;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L17 fond',
  porteurs: {
    'src/data/lieux-services.json': { cles: { backdrop: 'fond' } },
    'src/scenes/loup-et-saumure/loup-et-saumure-projet.json': { collection: 'worldMap.places', cles: { backdrop: 'fond' } },
  },
  catalogues: { fond: new Set(Object.keys(vocabulaireDuRegistre(path.join(ROOT, REGISTRE.dir), REGISTRE.vocabulaire))) },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
