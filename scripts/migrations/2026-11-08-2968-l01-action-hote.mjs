/**
 * Migration #2968 (#1463) L01 — l'action hôte d'un geste secondaire désignée par `ref('action')`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `actions.json › [].hote` : `ref('action')`.
 *
 * ENTRÉES : écrite et lue — `src/data/actions.json` (porteur, et catalogue de sa cible).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `7e28c04a8e`. */
const PAR_PORTEUR = { 'actions.json › hote': 1 };
const CARDINAL = 1;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L01',
  porteurs: { 'src/data/actions.json': { cles: { hote: 'action' } } },
  catalogues: { action: idsDe(ROOT, 'src/data/actions.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
