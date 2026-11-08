/**
 * Migration #2968 (#1463) L03 — la Carrière, la Classe de Carrière et l'espèce jouable désignées par
 * `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `careerLevels.json › [].career` : `ref('career')` ;
 *  - `careers.json › [].class` : `ref('classe')` ;
 *  - `pregens.json › [].career` : `ref('career')` ;
 *  - `pregens.json › [].species` : `ref('species')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — `src/data/careerLevels.json`, `src/data/careers.json`, `src/data/pregens.json` ;
 * lues — `src/data/classes.json`, `src/data/species.json` (catalogues des cibles, avec `careers.json`).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `3347ab97d6`. */
const PAR_PORTEUR = {
  'careerLevels.json › career': 432,
  'careers.json › class': 108,
  'pregens.json › career': 8,
  'pregens.json › species': 8,
};
const CARDINAL = 556;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L03',
  porteurs: {
    'src/data/careerLevels.json': { cles: { career: 'career' } },
    'src/data/careers.json': { cles: { class: 'classe' } },
    'src/data/pregens.json': { cles: { career: 'career', species: 'species' } },
  },
  catalogues: {
    career: idsDe(ROOT, 'src/data/careers.json'),
    classe: idsDe(ROOT, 'src/data/classes.json'),
    species: idsDe(ROOT, 'src/data/species.json'),
  },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
