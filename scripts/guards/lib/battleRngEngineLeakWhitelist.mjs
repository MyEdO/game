// Whitelist du garde « rng vivant → résolveur moteur » (#370, `battleRngEngineLeak.mjs`). RÉUTILISE
// la whitelist du seam de jet (`rollSeamWhitelist.mjs`, #274) : le garde renforcé au niveau FICHIER
// (#370, ronde 2) portait dette pour deux entrées supplémentaires. Depuis l'affinage par SIGNATURE
// (#912, ronde 3 — cf. en-tête de `battleRngEngineLeak.mjs`), le scanner ne signale plus un résolveur
// `resolveXxx` importé dont la signature moteur ne prend PAS de paramètre `RNG` — `resolveOpposed`
// (`src/engine/tests.ts`) et `resolveTavernRound` (`src/engine/tavernGame.ts`) sont PURS
// (`TestResult, TestResult → issue`, jamais de rng en paramètre) : `portFlow.ts` et `tavernFlow.ts`
// ne matchent PLUS AUCUN site et sont RETIRÉS de cette liste — ils n'y restaient que par imprécision
// du scan à l'échelle du fichier, jamais pour de la dette réelle.
//
// Seule entrée AU-DELÀ de la whitelist sœur : `combatSlice.ts` (recensé par le scan #370 — cœur de
// la boucle de combat, même régime que `combatFlow.ts`/`combatManeuvers.ts` déjà listés, mais
// n'appelle jamais `rollTest(`/`d100(` EN DIRECT — seulement via des résolveurs `resolve*` du moteur
// combat, RNG-capables pour de vrai (`resolveAttack`, `resolveMagicMissile`, `resolveCasting`,
// `resolveDistraire`…) — d'où l'absence de cette entrée dans la whitelist SŒUR). Son retrait relève
// d'un arbitrage d'architecture, pas d'une imprécision du scan.
//
// COUPLAGE avec #274 : cette liste RÉUTILISE `ROLL_SEAM_FILE_WHITELIST`, donc tout retrait là-bas
// dé-whiteliste AUSSI ici. Les 5 retraits de #918 lot B (`src/data/mutations.ts`, `landMarketFlow.ts`,
// `shipCrew.ts`, `encounterPsychFlow.ts`, `restFlow.ts`) ne produisent AUCUN offender ici (mesuré).
// Comptes LATENTS mesurés au 2026-07-29 dans les fichiers encore couverts, qui deviendront visibles à
// mesure que la phase 2 de #918 les retirera du stock : `combatFlow.ts` 21, `rollFlowSpecs.ts` 10,
// `combat/turnHooks.ts` 6, `combatEffects.ts` 6, `riverVoyageFlow.ts` 3, `seaVoyageFlow.ts` 1,
// `travelFlow.ts` 1.
//
// Entrées PROPRES à ce garde (au-delà de la whitelist sœur), portant leur dette #370 en propre :
//  - `combatSlice.ts` (cf. ci-dessus) ;
//  - `combat/turnHooks.ts` — SORTI du stock #918 (phase 2a : son unique `rollTest(` inline est routé
//    par `rollSansPilote`), mais ses 6 sites LATENTS `resolvePeurTest`/`resolveTerreurTest`/
//    `resolveFrenzyEntry`/`resolveCalmeSimple` avec `battleRng()` relèvent de #370, pas de #918 :
//    la dette CHANGE de liste, elle ne disparaît pas. `shipwreck.ts`, sorti du même coup, ne produit
//    AUCUN offender ici (mesuré) — pas d'entrée.

import { RACINE_DU_SEAM, ROLL_SEAM_FILE_WHITELIST } from './rollSeamWhitelist.mjs';

/** @type {Set<string>} */
export const BATTLE_RNG_ENGINE_LEAK_WHITELIST = new Set([
  ...ROLL_SEAM_FILE_WHITELIST,
  'src/state/combatSlice.ts',
  'src/state/combat/turnHooks.ts',
]);

/** @param {string} rel @returns {boolean} */
export function battleRngEngineLeakExcluded(rel) {
  return !rel.startsWith(`${RACINE_DU_SEAM}/`) || rel.startsWith('src/engine/') || BATTLE_RNG_ENGINE_LEAK_WHITELIST.has(rel);
}
