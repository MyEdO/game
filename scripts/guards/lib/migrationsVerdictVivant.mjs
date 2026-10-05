// GARDE de classe (#1887 lot 6a-2c) : aucune migration DATÉE de `scripts/migrations/` (`estUneMigration`
// de `replay.mjs` : ni `lib/`, ni les portes `replay*.mjs`) n'atteint le verdict VIVANT d'adressabilité
// (`scripts/source/derive-decoupes.mjs`), ni directement ni par un module qui le ré-exporte. Une
// migration rejouée rend la même chose quel que soit le `judge` du jour (CI rouge de T2, `2d357e28d`) :
// elle porte ses décisions en table datée et les prouve. Marche : `clotureDImports` (`importGraph.mjs`),
// arcs d'EXÉCUTION (`typesEffaces`). Module ESM pur (node nu).
import { join } from 'node:path';
import { clotureDImports } from './importGraph.mjs';
import { listerDossier } from './lister.mjs';
import { estUneMigration } from '../../migrations/replay.mjs';

/** Le verdict VIVANT d'adressabilité, relatif à la racine du dépôt. */
export const VERDICT_VIVANT = 'scripts/source/derive-decoupes.mjs';
/** Le dossier des migrations datées, relatif à la racine du dépôt. */
export const DOSSIER_DES_MIGRATIONS = 'scripts/migrations';

/**
 * Les migrations datées dont la clôture d'imports d'exécution contient `VERDICT_VIVANT`.
 * @param {{ racine?: string }} [options] la racine du dépôt jugé (le répertoire courant par défaut)
 * @returns {string[]} chemins POSIX relatifs à `racine`, en ordre total
 */
export function migrationsAuVerdictVivant({ racine = '.' } = {}) {
  const cache = new Map();
  return listerDossier(join(racine, DOSSIER_DES_MIGRATIONS))
    .filter(estUneMigration)
    .map((nom) => `${DOSSIER_DES_MIGRATIONS}/${nom}`)
    .filter((migration) => clotureDImports([migration], { racine, cache, typesEffaces: true }).has(VERDICT_VIVANT));
}
