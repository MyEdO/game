// NOMS D'UN CHANTIER — branche, préfixe et chemin de son worktree. Module feuille : `node:path` seul.
// #2603 constat 26
import { join } from 'node:path'

/** Nom de branche d'un chantier. PURE. */
export const brancheDe = (nom) => `chantier/${nom}`

/** Préfixe du dossier d'un worktree de chantier, posé sous l'arbre principal. */
export const PREFIXE_DE_CHANTIER = '.wt-'

/** Chemin du worktree d'un chantier dans `racine`. PURE (hors `join`). */
export const cibleDe = (racine, nom) => join(racine, `${PREFIXE_DE_CHANTIER}${nom}`)
