/**
 * Migration #2968 (#1463) L10 — le rôle essentiel d'un type de Test d'équipage désigné par
 * `ref('crewRole')` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient
 * `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `crew-test-types.json › types[].essential` :
 * `ref('crewRole')`. Les `roles` sont déjà une liste d'ids (`refs('crewRole')`) : aucun geste.
 *
 * ENTRÉES : écrite — `src/data/crew-test-types.json` ; lue — `src/data/crew-roles.json` (catalogue de la
 * cible).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `7e28c04a8e`. */
const PAR_PORTEUR = { 'crew-test-types.json › types[].essential': 10 };
const CARDINAL = 10;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L10',
  porteurs: { 'src/data/crew-test-types.json': { collection: 'types', cles: { essential: 'crewRole' } } },
  catalogues: { crewRole: idsDe(ROOT, 'src/data/crew-roles.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
