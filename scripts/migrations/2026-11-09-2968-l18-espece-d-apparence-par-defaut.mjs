/**
 * Migration #2968 L18 (#1463) — l'espèce d'apparence par défaut désignée par `ref('planDeBestiaire')`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : `speciesRace.json › default`, document `objet`, cible de
 * `planDeBestiaire.json`. La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrite — `src/data/speciesRace.json` ; lue — le catalogue `src/data/planDeBestiaire.json`.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `0a5f4a1071`. */
const PAR_PORTEUR = { 'speciesRace.json › default': 1 };
const CARDINAL = 1;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L18 espèce d’apparence par défaut',
  porteurs: { 'src/data/speciesRace.json': { objet: true, cles: { default: 'planDeBestiaire' } } },
  catalogues: { planDeBestiaire: idsDe(ROOT, 'src/data/planDeBestiaire.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
