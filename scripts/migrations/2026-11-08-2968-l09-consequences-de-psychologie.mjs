/**
 * Migration #2968 (#1463) L09 — les conséquences d'un Test de Psychologie désignées par `ref(type)`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `psychology.json › [].becomes` : `ref('psychology')` ;
 *  - `psychology.json › [].failCondition` : `ref('etat')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrite — `src/data/psychology.json` ; lue — `src/data/etats.json` (catalogue de la cible de
 * `failCondition`, avec `psychology.json`).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `7e28c04a8e`. */
const PAR_PORTEUR = {
  'psychology.json › becomes': 1,
  'psychology.json › failCondition': 1,
};
const CARDINAL = 2;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L09',
  porteurs: { 'src/data/psychology.json': { cles: { becomes: 'psychology', failCondition: 'etat' } } },
  catalogues: {
    psychology: idsDe(ROOT, 'src/data/psychology.json'),
    etat: idsDe(ROOT, 'src/data/etats.json'),
  },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
