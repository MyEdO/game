/**
 * Migration #2968 (#1463) — le Type de Dégâts désigné par `ref('damageType')`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `breath-types.json › [].typeDeDegats` : `ref('damageType')` ;
 *  - `etats.json › [].typeDeDegats` : `ref('damageType')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — `src/data/breath-types.json`, `src/data/etats.json` ; lue — `src/data/damage-types.json`
 * (catalogue de la cible).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `778ad5e932`. */
const PAR_PORTEUR = {
  'breath-types.json › typeDeDegats': 3,
  'etats.json › typeDeDegats': 1,
};
const CARDINAL = 4;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 type de Dégâts',
  porteurs: {
    'src/data/breath-types.json': { cles: { typeDeDegats: 'damageType' } },
    'src/data/etats.json': { cles: { typeDeDegats: 'damageType' } },
  },
  catalogues: { damageType: idsDe(ROOT, 'src/data/damage-types.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
