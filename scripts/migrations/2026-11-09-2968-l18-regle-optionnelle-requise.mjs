/**
 * Migration #2968 L18 (#1463) — la règle optionnelle qu'exige une espèce ou une Caractéristique alternative
 * désignée par `ref('regleOptionnelle')` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"`
 * devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) : `species.json › gatedByRule` et
 * `skills.json › altChar.gatedByRule`, cibles de `reglesOptionnelles.json`. La clé garde son rang, les autres
 * clés le leur.
 *
 * ENTRÉES : écrites — `src/data/species.json`, `src/data/skills.json` ; lue — le catalogue
 * `src/data/reglesOptionnelles.json`.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `0a5f4a1071`. */
const PAR_PORTEUR = {
  'species.json › gatedByRule': 1,
  'skills.json › altChar.gatedByRule': 2,
};
const CARDINAL = 3;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L18 règle optionnelle requise',
  porteurs: {
    'src/data/species.json': { cles: { gatedByRule: 'regleOptionnelle' } },
    'src/data/skills.json': { cles: { 'altChar.gatedByRule': 'regleOptionnelle' } },
  },
  catalogues: { regleOptionnelle: idsDe(ROOT, 'src/data/reglesOptionnelles.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
