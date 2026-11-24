// L'OUTILLAGE HORS DES ZONES (#4903 L3) : le seul code du dépôt qui n'est dans aucune zone de `COUCHES`
// (`couches.mjs`). `murs/zone` (`couchesLint.mjs`) refuse tout autre fichier de code hors des zones.
import { posix as cheminPosix } from 'node:path';
import { couvre } from './couches.mjs';

/** L'outillage hors des zones, chaque clé au sens de `couvre` : les scripts, le relais coop, les workflows, les
 *  configurations de la racine. */
const OUTILLAGE_HORS_DES_ZONES = Object.freeze(['scripts/', 'server/', '.claude/workflows/', 'oxlint.config.mjs', 'oxlint.noms-par-ligne.config.mjs', 'vitest.config.ts']);

/** Les dossiers d'un mod (`.claude/skills/<mod>/`, #2278) qui portent son code. */
export const DOSSIERS_DE_CODE_DE_MOD = Object.freeze(['hooks', 'types', 'tests']);

/** Le chemin POSIX `rel` (relatif à la racine) est-il de l'outillage hors des zones (`OUTILLAGE_HORS_DES_ZONES`, ou le
 *  code d'un mod sous l'un de ses `DOSSIERS_DE_CODE_DE_MOD`) ? PURE. */
export function estOutillageHorsDesZones(rel) {
  const chemin = cheminPosix.normalize(rel);
  if (OUTILLAGE_HORS_DES_ZONES.some((cle) => couvre(cle, chemin))) return true;
  const [racine, skills, , dossier, ...reste] = chemin.split('/');
  return racine === '.claude' && skills === 'skills' && DOSSIERS_DE_CODE_DE_MOD.includes(dossier) && reste.length > 0;
}
