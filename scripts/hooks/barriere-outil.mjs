// BARRIÈRE des hooks d'appel d'outil (#2187, verdict `.git/suivi/2187-design-synchroniseur-verdict-2026-10-07.md`,
// point 2) : le point d'entrée commun de `repartiteur.mjs` et `solde-ticket-hook.mjs`. Ses imports
// STATIQUES sont des modules intégrés de Node : un `npm ci` ou un `read-tree` en cours dans cet arbre ne
// l'empêche pas de se charger. Il attend que le verrou d'OUTILLAGE de son arbre soit libre, puis charge
// par `import()` la porte de version (`scripts/node-requis.mjs`) et le reste ; à échéance, ou sur un
// échec de chargement, il sort en 2 (refus nommé).
// Limite : #2187 commentaire 6029118597, C6 (limite A).
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Racine de l'arbre qui porte CE script. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Le nom du verrou d'outillage, sous le git-dir de son arbre (`verrouOutillageDe`). */
export const VERROU_OUTILLAGE = 'outillage.verrou'

/** L'attente de la barrière : elle et la lecture bornée du stdin (`DELAI_STDIN_MS`) tiennent sous le
 *  `timeout` des hooks d'outil (`ENTREES_OUTIL`), `scripts/guards/lib/stdinBorne.test.mjs`. Valeur maison. */
export const ATTENTE_BARRIERE = Object.freeze({ echeanceMs: 1_500, pasMs: 100 })

/** Le code de sortie d'un refus : un hook bloquant (`PreToolUse`) refuse l'appel et rend son stderr. */
export const SORTIE_REFUS = 2

/**
 * Le git-dir de l'arbre `racine`, lu SANS lancer git : `.git` dossier (arbre principal), ou fichier
 * `gitdir: <chemin>` (worktree lié, `git help gitrepository-layout`). `null` hors dépôt.
 * @param {string} racine @returns {string | null}
 */
export function gitDirDe(racine) {
  const point = join(racine, '.git')
  let dossier
  try {
    dossier = statSync(point).isDirectory()
  } catch {
    return null
  }
  if (dossier) return point
  const lu = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(point, 'utf8'))
  return lu ? resolve(racine, lu[1]) : null
}

/** Le verrou d'outillage de l'arbre `racine`, `null` hors dépôt. @param {string} racine */
export function verrouOutillageDe(racine) {
  const gitDir = gitDirDe(racine)
  return gitDir === null ? null : join(gitDir, VERROU_OUTILLAGE)
}

/**
 * Franchit la barrière de l'arbre `racine` : attend le verrou d'outillage libre, puis `charger()` qui
 * rend le geste du hook, joué ensuite. Verrou tenu à échéance, ou `charger` qui lève : `refuser(texte)`.
 * @param {() => Promise<() => unknown>} charger
 * @param {{ racine?: string, attente?: { echeanceMs: number, pasMs: number }, refuser?: (texte: string) => never }} [p]
 */
export async function franchir(charger, { racine = RACINE, attente = ATTENTE_BARRIERE, refuser = refuserEtSortir } = {}) {
  let geste
  try {
    const { attendreLibre } = await import('../test/verrou.mjs')
    const chemin = verrouOutillageDe(racine)
    const vu = chemin === null ? { etat: 'libre' } : attendreLibre({ chemin, attente })
    if (vu.etat !== 'libre') {
      const pid = vu.tenant?.pid ?? '?'
      const commande = vu.tenant?.commande ?? 'commande inconnue'
      return refuser(`outillage de ${racine} en mise à jour : verrou ${chemin} tenu par le PID ${pid} (${commande}) — relancer l'appel une fois la mise à jour finie ; si le PID ${pid} n'exécute pas ${commande}, supprimer ${chemin}`)
    }
    await import('../node-requis.mjs')
    geste = await charger()
  } catch (e) {
    return refuser(`outillage de ${racine} en mise à jour : chargement des gardes impossible — ${e?.message ?? e}`)
  }
  return geste()
}

/** Le refus de la barrière : stderr, puis sortie `SORTIE_REFUS`. @param {string} texte @returns {never} */
function refuserEtSortir(texte) {
  process.stderr.write(`[barrière] ${texte}\n`)
  process.exit(SORTIE_REFUS)
}
