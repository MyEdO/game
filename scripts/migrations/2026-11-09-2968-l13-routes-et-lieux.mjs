/**
 * Migration #2968 L13 (#1463) — les extrémités d'une route de la carte désignées par `ref(portee)`
 * (`src/data/schemas/grammaire/ref.ts`, portée locale), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot), dans chaque projet de campagne :
 * `worldMap.routes[].a`, `.b` et `.from`, une entrée de `worldMap.places` du MÊME projet. La clé garde son
 * rang, les autres clés le leur. `worldMap.routes[].billets{}.depuis` n'a aucune valeur posée ; `suite` reste
 * une liste d'ids (`refs(portee)`).
 *
 * ENTRÉES : écrites et lues — les quatre projets de `src/scenes/`, dont la carte porte le catalogue de ses lieux.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Les lieux de la carte, catalogue de la portée qu'ouvre `worldMap`. */
const LIEUX = { collection: 'places', ouvreur: 'worldMap' };

/** Porteurs d'un projet : les extrémités et le sens unique d'une route. */
const PROJET = {
  'worldMap.routes[].a': LIEUX,
  'worldMap.routes[].b': LIEUX,
  'worldMap.routes[].from': LIEUX,
};

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `2e65cf0dca`. */
const PAR_PORTEUR = {
  'arene-projet.json › worldMap.routes[].a': 4,
  'arene-projet.json › worldMap.routes[].b': 4,
  'barge-du-sel-projet.json › worldMap.routes[].a': 1,
  'barge-du-sel-projet.json › worldMap.routes[].b': 1,
  'diligence-projet.json › worldMap.routes[].a': 3,
  'diligence-projet.json › worldMap.routes[].b': 3,
  'diligence-projet.json › worldMap.routes[].from': 3,
  'loup-et-saumure-projet.json › worldMap.routes[].a': 2,
  'loup-et-saumure-projet.json › worldMap.routes[].b': 2,
  'loup-et-saumure-projet.json › worldMap.routes[].from': 2,
};
const CARDINAL = 25;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L13 routes et lieux',
  porteurs: tableTotale(PROJETS, () => ({ objet: true, cles: PROJET })),
  catalogues: {},
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
