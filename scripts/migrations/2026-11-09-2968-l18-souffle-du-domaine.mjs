/**
 * Migration #2968 L18 (#1463) — le Type de Souffle d'un Domaine des Arcanes désigné par `ref('breathType')`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `domains.json › arcane`, cible de `breath-types.json`. La
 * clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrite — `src/data/domains.json` ; lue — le catalogue `src/data/breath-types.json`.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `0a5f4a1071`. */
const PAR_PORTEUR = { 'domains.json › arcane': 14 };
const CARDINAL = 14;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L18 Type de Souffle du Domaine',
  porteurs: { 'src/data/domains.json': { cles: { arcane: 'breathType' } } },
  catalogues: { breathType: idsDe(ROOT, 'src/data/breath-types.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
