// La RACINE D'UN MOD Claude Code (#2278), définie une fois : un enfant direct de `.claude/skills/` qui
// porte `.claude-plugin/plugin.json`. Lue sur le disque (gate `mods:check`, classement du push) ou sur
// une liste de chemins (miroir Codex, scripts/agents/compat-core.mjs). N'importe que `node:*` et des
// fichiers du dépôt : le classement du push la charge avant `npm ci` (scripts/gates/classerPush.mjs).
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'

/** Le manifeste qui fait d'une racine de `.claude/skills/` un mod, en chemin POSIX relatif à cette racine. */
export const MANIFESTE = '.claude-plugin/plugin.json'

/** Le dossier des skills, en chemin POSIX relatif à la racine du dépôt. */
export const SKILLS = '.claude/skills/'

/**
 * Les racines de mod d'un dossier `.claude/skills` sur le disque : ses enfants qui portent `MANIFESTE`.
 * @param {string} dossierSkills
 * @returns {string[]} chemins absolus, triés
 */
export function racinesDeMods(dossierSkills) {
  return listerDossier(dossierSkills, { absent: 'vide' })
    .map((nom) => join(dossierSkills, nom))
    .filter((racine) => existsSync(join(racine, MANIFESTE)))
}

/**
 * Les racines de mod (`.claude/skills/<x>/`, slash final) que nomme une liste de chemins POSIX relatifs
 * à la racine du dépôt : `<x>` est un seul segment, et `.claude/skills/<x>/` + `MANIFESTE` est dans la liste.
 * @param {Iterable<string>} chemins
 * @returns {string[]} dans l'ordre de première apparition
 */
export function racinesDeModsParmi(chemins) {
  const racines = []
  for (const chemin of chemins) {
    if (!chemin.startsWith(SKILLS) || !chemin.endsWith(`/${MANIFESTE}`)) continue
    const racine = chemin.slice(0, -MANIFESTE.length)
    if (racine.slice(SKILLS.length, -1).includes('/') || racines.includes(racine)) continue
    racines.push(racine)
  }
  return racines
}
