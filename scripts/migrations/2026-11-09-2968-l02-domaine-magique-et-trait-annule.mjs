/**
 * Migration #2968 L02 (#1463) — le Domaine de magie et le Trait annulé par un phénomène arcanique désignés par
 * `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `spells.json › [].domainId` : `ref('domain')` ;
 *  - `arcane-phenomena.json › windSaturationEffects[].domainId` : `ref('domain')` ;
 *  - `damage-types.json › [].domaine` : `ref('domain')` ;
 *  - `traits.json › [].capabilities.spellDomainImmunity` : `ref('domain')` ;
 *  - `arcane-phenomena.json › phenomena[].cancelsTraitId` : `ref('trait')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — les quatre documents des porteurs ; lues — `src/data/domains.json` (catalogue des
 * Domaines) et `src/data/traits.json` (catalogue des Traits).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur. Le compte des sorts se
 * dérive de `spells.json` (chaque `domainId` en chaîne, 239 le 2026-11-09 sur `4a987a6a52`) : un sort ajouté
 * avant le jeu de la migration en est un geste de plus, pas un périmètre déplacé.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPELLS = 'src/data/spells.json';

const sortsADomaineNu = JSON.parse(fs.readFileSync(path.join(ROOT, SPELLS), 'utf8')).filter((s) => typeof s.domainId === 'string').length;

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `4a987a6a52`, les sorts dérivés de leur document. */
const PAR_PORTEUR = {
  'spells.json › domainId': sortsADomaineNu,
  'arcane-phenomena.json › windSaturationEffects[].domainId': 8,
  'arcane-phenomena.json › phenomena[].cancelsTraitId': 1,
  'damage-types.json › domaine': 2,
  'traits.json › capabilities.spellDomainImmunity': 1,
};
const CARDINAL = Object.values(PAR_PORTEUR).reduce((a, n) => a + n, 0);

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L02 Domaine de magie et Trait annulé',
  porteurs: {
    [SPELLS]: { cles: { domainId: 'domain' } },
    'src/data/arcane-phenomena.json': { objet: true, cles: { 'windSaturationEffects[].domainId': 'domain', 'phenomena[].cancelsTraitId': 'trait' } },
    'src/data/damage-types.json': { cles: { domaine: 'domain' } },
    'src/data/traits.json': { cles: { 'capabilities.spellDomainImmunity': 'domain' } },
  },
  catalogues: { domain: idsDe(ROOT, 'src/data/domains.json'), trait: idsDe(ROOT, 'src/data/traits.json') },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
