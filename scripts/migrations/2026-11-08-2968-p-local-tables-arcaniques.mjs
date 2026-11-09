/**
 * Migration #2968 P-local (#1463) — la table d'un phénomène arcanique désignée par `ref(portee)`
 * (`src/data/schemas/grammaire/ref.ts`, portée locale `tables` du document), jamais par un id nu : `"x"`
 * devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `arcane-phenomena.json › phenomena[].fluxTableId` et
 * `› phenomena[].tableId`, chacun une entrée de `tables` du MÊME document. La clé garde son rang, les autres
 * clés le leur.
 *
 * ENTRÉES : écrite et lue — `src/data/arcane-phenomena.json`, dont `tables` est le catalogue de la cible.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DOCUMENT = 'src/data/arcane-phenomena.json';

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `a1e26bf337`. */
const PAR_PORTEUR = {
  'arcane-phenomena.json › phenomena[].fluxTableId': 1,
  'arcane-phenomena.json › phenomena[].tableId': 2,
};
const CARDINAL = 3;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 P-local tables arcaniques',
  porteurs: { [DOCUMENT]: { collection: 'phenomena', cles: { fluxTableId: 'tables', tableId: 'tables' } } },
  catalogues: { tables: idsDe(ROOT, DOCUMENT, 'tables') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
