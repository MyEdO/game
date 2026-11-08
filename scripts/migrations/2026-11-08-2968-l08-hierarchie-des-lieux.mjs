/**
 * Migration #2968 (#1463) L08 — le lieu parent désigné par `ref('location')`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }` ; un
 * `null` (lieu racine) reste `null`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `locations.json › [].parent` : `ref('location')`.
 *
 * ENTRÉES : écrite et lue — `src/data/locations.json` (porteur, et catalogue de sa cible).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `7e28c04a8e`. */
const PAR_PORTEUR = { 'locations.json › parent': 46 };
const CARDINAL = 46;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L08',
  porteurs: { 'src/data/locations.json': { cles: { parent: 'location' } } },
  catalogues: { location: idsDe(ROOT, 'src/data/locations.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
