// Garde PreToolUse de la RACINE DE CONFIANCE des hooks d'appel d'outil (#2712) : les modules sans lesquels
// la barrière ne refuse plus rien ou refuse tout, y compris l'édition qui les répare (`barriere-outil.mjs`).
// Une écriture qui y pose un texte que `node --check` rejette est refusée. Limite : une écriture par le
// shell n'est pas jugée (#2187 commentaire 6029118597, C6, limite A).
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OUTILS_ECRITURE, cheminDEcriture, ecrituresDe } from '../guards/lib/contratGarde.mjs'

/** Les modules de la racine de confiance, relatifs à la racine de l'arbre. */
export const RACINE_DE_CONFIANCE = Object.freeze([
  'scripts/hooks/repartiteur.mjs', 'scripts/hooks/barriere-outil.mjs', 'scripts/hooks/panne-outil.mjs', 'scripts/guards/lib/stdinBorne.mjs',
])

/** Le fichier après l'écriture `ecrit` sur `reel` : `content` entier, ou `old_string` remplacé ; `undefined`
 *  pour une écriture que la garde ne sait pas rejouer, `null` quand l'outil échouera de lui-même. */
export function imageApres(ecrit, reel, lire = () => readFileSync(reel, 'utf8')) {
  if (typeof ecrit?.content === 'string') return ecrit.content
  if (typeof ecrit?.old_string !== 'string' || typeof ecrit?.new_string !== 'string') return undefined
  let avant
  try {
    avant = lire()
  } catch {
    return null
  }
  if (!avant.includes(ecrit.old_string)) return null
  return ecrit.replace_all === true ? avant.split(ecrit.old_string).join(ecrit.new_string) : avant.replace(ecrit.old_string, () => ecrit.new_string)
}

/** Le diagnostic de `node --check` sur `texte`, ou `null` s'il passe. */
export function erreurDeSyntaxe(texte) {
  const dossier = mkdtempSync(join(tmpdir(), 'racine-de-confiance-'))
  try {
    const fichier = join(dossier, 'image.mjs')
    writeFileSync(fichier, texte)
    const vu = spawnSync(process.execPath, ['--check', fichier], { encoding: 'utf8' })
    return vu.status === 0 ? null : String(vu.stderr || vu.error?.message || `node --check : ${vu.status}`).trim()
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

function evaluer(entree, { dir }) {
  return ecrituresDe(entree).map((ecrit) => {
    const chemin = cheminDEcriture(ecrit, { base: dir })
    if (!chemin || chemin.racine === null || !RACINE_DE_CONFIANCE.includes(chemin.relatif)) return null
    const image = imageApres(ecrit, chemin.reel)
    if (image === null) return null
    if (image === undefined) return { decision: 'deny', raison: `${chemin.relatif} est de la racine de confiance des hooks : l'écrire par Write ou Edit, seuls rejoués avant écriture.` }
    const erreur = erreurDeSyntaxe(image)
    return erreur === null ? null : { decision: 'deny', raison: `${chemin.relatif} ne passerait plus \`node --check\` ; or la barrière des hooks ne se charge pas sans lui :\n${erreur}` }
  })
}

export const garde = { nom: 'racine-de-confiance', categorie: 'validation', outils: OUTILS_ECRITURE, evaluer }
