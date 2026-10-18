import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { arbrePrincipal, depotDe } from '../guards/lib/gitPorte.mjs'
import { prendreVerrou } from './verrou.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
/** Les entrées `{ [fichier]: ms }` d'un objet dont la valeur est un nombre fini ≥ 0. PURE. */
export const dureesValides = (lu) => lu !== null && typeof lu === 'object' && !Array.isArray(lu)
  ? Object.fromEntries(Object.entries(lu).filter(([, ms]) => Number.isFinite(ms) && ms >= 0))
  : {}
/** L'attente du verrou d'un mémo (`prendreVerrou`, #2400). */
const ATTENTE_DES_MESURES = Object.freeze({ echeanceMs: 30_000, pasMs: 25 })

/** Le mémo `nom` du dossier `dossier` lu par `valider` (`DUREES`, `SURCOUTS` : `dureesValides` ; `DUREES_CI` :
 *  `memoCiDe`) ; `{}` s'il est absent. Un mémo illisible ou corrompu lève avec sa `cause` : `ecrire` l'écraserait. */
const memoDe = (dossier, nom, valider = dureesValides) => {
  const chemin = join(dossier, nom)
  let lu
  try { lu = JSON.parse(readFileSync(chemin, 'utf8')) }
  catch (cause) { if (cause.code === 'ENOENT') return {}; throw new Error(`mesures : mémo ${chemin} illisible`, { cause }) }
  return valider(lu)
}

/** Le dossier des mesures de `racine` : `.git/perimetre` de l'arbre principal, commun aux worktrees (#2400). */
export function dossierDesMesures(racine) {
  const principal = arbrePrincipal(depotDe(racine))
  if (!principal.disponible) throw new Error(`perimetre : mesures sans dossier commun — ${principal.raison}`)
  return join(principal.valeur, '.git', 'perimetre')
}

/**
 * Les MESURES sous `dossier` (`DUREES`, `SURCOUTS`, `DUREES_CI`), que plusieurs sessions écrivent, sous verrou
 * (`prendreVerrou`) et d'un geste (`ecrireJsonAtomique`). `lire(nom, valider)` : `memoDe`. `ecrire(nom, entrees)`
 * relit et fusionne entrée par entrée — la mesure écrite, la plus récente, gagne. `remplacer(nom, valeur)` écrit
 * `valeur` entière, sans fusion.
 * @param {string} dossier
 */
export function mesuresDe(dossier) {
  const sousVerrou = (nom, valeur) => {
    const prise = prendreVerrou({ chemin: join(dossier, `${nom}.verrou`), libelle: `mesures ${nom} du périmètre`, attente: ATTENTE_DES_MESURES })
    if (prise.etat !== 'pris') throw new Error(prise.message)
    try { ecrireJsonAtomique(join(dossier, nom), valeur()) } finally { prise.liberer() }
  }
  return {
    lire: (nom, valider) => memoDe(dossier, nom, valider),
    ecrire: (nom, entrees, fusion) => sousVerrou(nom, () => fusion
      ? fusion(memoDe(dossier, nom, (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {}), entrees)
      : { ...memoDe(dossier, nom), ...entrees }),
    remplacer: (nom, valeur) => sousVerrou(nom, () => valeur),
  }
}
