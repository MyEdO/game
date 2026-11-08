/**
 * Migration #2968 L07 (#1463) — le Groupe d'objet et la munition représentative désignés par `ref(type)`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `trappings.json › [].subType` : `ref('weaponGroup')` ;
 *  - `trappings.json › [].weaponGroup` : `ref('weaponGroup')` ;
 *  - `trappings.json › [].derivedWeapon.subType` : `ref('weaponGroup')` ;
 *  - `trappings.json › [].defaultAmmo` : `ref('trapping', undefined, 'ammunition')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrite — `src/data/trappings.json` ; lue — `src/data/weaponGroups.json` (catalogue des Groupes) et
 * `src/data/trappings.json` (sa sous-liste `ammunition`).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TRAPPINGS = 'src/data/trappings.json';

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `f814787264`. */
const PAR_PORTEUR = {
  'trappings.json › subType': 441,
  'trappings.json › weaponGroup': 22,
  'trappings.json › derivedWeapon.subType': 1,
  'trappings.json › defaultAmmo': 9,
};
const CARDINAL = 473;

/** Sous-liste `ammunition` du catalogue des objets (discriminant `categorie`, `defs/trappings.ts`). */
const munitions = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, TRAPPINGS), 'utf8'))
    .filter((t) => t.categorie === 'ammunition')
    .map((t) => t.id),
);

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L07 Groupe d’objet et munition',
  porteurs: {
    [TRAPPINGS]: { cles: { subType: 'weaponGroup', weaponGroup: 'weaponGroup', 'derivedWeapon.subType': 'weaponGroup', defaultAmmo: 'munition' } },
  },
  catalogues: { weaponGroup: idsDe(ROOT, 'src/data/weaponGroups.json'), munition: munitions },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
