// BARRIÈRE des hooks d'appel d'outil (#2187, verdict `.git/suivi/2187-design-synchroniseur-verdict-2026-10-07.md`,
// point 2) : le point d'entrée de `repartiteur.mjs`. Ses imports
// STATIQUES sont des modules intégrés de Node : un `npm ci` ou un `read-tree` en cours dans cet arbre ne
// l'empêche pas de se charger. Il attend que le verrou d'OUTILLAGE de son arbre soit libre, puis charge
// par `import()` la porte de version (`scripts/node-requis.mjs`) et le reste ; à échéance, il sort en 2
// (refus nommé, retentable) ; sur un échec de chargement, il refuse avec le geste qui répare, sauf l'appel
// qui franchit la panne (`panne-outil.mjs`, #2712).
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
 * rend le geste du hook, joué ensuite. Verrou tenu à échéance : `refuser(texte)`. `charger` qui lève :
 * l'appel qui franchit la panne passe sans garde, tout autre est refusé avec son geste de réparation ;
 * un lecteur d'entrée qui ne se charge pas refuse tout, `panne-outil.mjs` qui ne se charge pas ne laisse
 * passer que `editionDeSessionPrincipale`.
 * @param {() => Promise<() => unknown>} charger
 * @param {{ racine?: string, attente?: { echeanceMs: number, pasMs: number }, refuser?: (texte: string) => never, entree?: () => unknown | Promise<unknown>, panne?: () => Promise<{ panneDe: Function }> }} [p]
 */
export async function franchir(charger, { racine = RACINE, attente = ATTENTE_BARRIERE, refuser = refuserEtSortir, entree = lireEntree, panne = () => import('./panne-outil.mjs') } = {}) {
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
    const enPanne = `outillage de ${racine} en panne : chargement des gardes impossible —`
    const appel = await entree()
    if (appel === LECTEUR_EN_PANNE) return refuser(`${enPanne} ${e?.message ?? e} — lecteur d'entrée en panne aussi, appel non jugeable : restaurer ${LECTEUR} hors session`)
    let panneDe
    try {
      ({ panneDe } = await panne())
    } catch (p) {
      if (editionDeSessionPrincipale(appel)) return undefined
      return refuser(`${enPanne} ${p?.message ?? p} — non retentable : corriger scripts/hooks/panne-outil.mjs par une édition de fichier, seul geste admis en session principale`)
    }
    const vu = panneDe(e, appel, racine)
    return vu.franchit ? undefined : refuser(`${enPanne} ${vu.message} — ${vu.geste}`)
  }
  return geste()
}

/** L'entrée du hook quand son lecteur ne se charge pas : l'appel n'est pas jugeable. */
export const LECTEUR_EN_PANNE = Symbol('lecteur en panne')

/** Le lecteur d'entrée, relatif à la racine. */
const LECTEUR = 'scripts/guards/lib/stdinBorne.mjs'

/** Les outils d'édition de fichier qu'ouvre l'exutoire d'une panne ; un shell n'y passe jamais (son effet
 *  n'est pas jugeable). */
export const EDITIONS_D_EXUTOIRE = Object.freeze(['Write', 'Edit', 'NotebookEdit', 'apply_patch'])

/** L'appel est-il une édition de fichier de la session principale ? Un sous-agent porte `agent_id`
 *  (`sousAgent` de `scripts/guards/lib/contratGarde.mjs`). PURE. */
export const editionDeSessionPrincipale = (appel) => !appel?.agent_id && EDITIONS_D_EXUTOIRE.includes(String(appel?.tool_name ?? ''))

/** L'entrée du hook, lue sur stdin seulement quand les gardes n'ont pas pu se charger ; `null` si illisible. */
async function lireEntree() {
  let lire
  try {
    ({ lireStdinBorne: lire } = await import(`../../${LECTEUR}`))
  } catch {
    return LECTEUR_EN_PANNE
  }
  try {
    return JSON.parse(await lire())
  } catch {
    return null
  }
}

/** Le refus de la barrière : stderr, puis sortie `SORTIE_REFUS`. @param {string} texte @returns {never} */
function refuserEtSortir(texte) {
  process.stderr.write(`[barrière] ${texte}\n`)
  process.exit(SORTIE_REFUS)
}
