// Primitives d'écriture des dérivés et de la MESURE de leurs sources (#1679) — socle partagé par
// `scripts/docs/build-all.mjs` et chaque générateur de `GENERATORS`.
//
// `ecrireOuVerifier` écrit une cible, ou la compare au disque sous `--check` ; `enregistreur-lectures.mjs`
// MESURE ce que le générateur lit, et `fusionnerLectures` / `serialiserSourcesLues` en font le dérivé
// local `docs/.sources-lues.json` (jamais commité, #2203 A2).
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { listerDossier } from '../../guards/lib/lister.mjs'
import path from 'node:path'
import { coupeAuMot } from '../../../src/lib/coupeAuMot.mjs'

const sha1 = (donnee) => createHash('sha1').update(donnee).digest('hex')

/** Une cible est un doc MARKDOWN ; toute autre cible de `GENERATORS` est du CODE (`generateursDeCode`,
 *  build-all.mjs). */
export const estUnDocMarkdown = (cible) => cible.endsWith('.md')

/**
 * Écrit un dérivé. N'ÉCRIT QUE SI LE RENDU DIFFÈRE : la suite lit les dérivés pendant que les gates
 * tournent en LANES parallèles (`scripts/gates/toutes.mjs`), et un fichier réécrit à l'identique
 * serait un lecteur sur un fichier en cours d'écriture.
 */
export function ecrireDoc(chemin, contenu) {
  let actuel
  try { actuel = readFileSync(chemin, 'utf8') } catch { actuel = null }
  if (actuel !== contenu) writeFileSync(chemin, contenu)
}

/**
 * Bit du code de sortie qui dit « corps périmé » — une seule convention pour tout dérivé. Le bit 1
 * reste celui de tout autre rouge (cliquet, refus, exception), si bien qu'un générateur dont le
 * cliquet ET le corps sont rouges sort en 3. La convention ne produit que 1, 2 et 3 : `natureDuRouge`
 * (build-all.mjs) ne lit ce bit que sur 2 et 3, tout autre code étant une sortie de Node.
 */
export const CODE_CORPS_PERIME = 2

/** Variable d'env posée par build-all.mjs : le fichier où `declarerCorpsPerime` APPEND le sha1 de
 *  chaque corps rendu qu'il déclare périmé, une ligne par corps. */
export const ENV_CORPS_RENDUS = 'WFRP_CORPS_RENDUS'

/** Variable d'env posée par build-all.mjs : le fichier où `ecrireOuVerifier` APPEND chaque cible qu'il
 *  rend (chemin POSIX relatif au répertoire courant), une ligne par cible. */
export const ENV_CIBLES_RENDUES = 'WFRP_CIBLES_RENDUES'

/** Déclare un corps périmé au code de sortie SANS quitter le processus : un cliquet posé avant garde
 *  son bit, et ce qui suit l'appel peut encore parler. `corps` : le(s) corps RENDU(S) — ce que
 *  `docs:build` écrirait — au moins un, consignés sous `ENV_CORPS_RENDUS` (#1801). */
export function declarerCorpsPerime(...corps) {
  if (!corps.length) throw new Error('declarerCorpsPerime : aucun corps rendu déclaré')
  const fichier = process.env[ENV_CORPS_RENDUS]
  if (fichier) appendFileSync(fichier, corps.map((c) => `${sha1(c)}\n`).join(''))
  process.exitCode = (Number(process.exitCode) || 0) | CODE_CORPS_PERIME
}

/**
 * LA primitive d'un dérivé : écrit `out` dans `path` (par `ecrireDoc`) — ou, sous `check`, le
 * compare au disque SANS RIEN ÉCRIRE. Un corps périmé imprime `staleMsg`, la première
 * divergence NOMMÉE et l'aperçu des suivantes (`apercuDivergences`), puis `rerunMsg`, et se déclare
 * au code de sortie (`declarerCorpsPerime`) : la primitive ne quitte jamais le processus, un
 * générateur à plusieurs cibles les nomme donc TOUTES.
 * `okMsg` / `writeMsg` sont facultatifs (un générateur qui résume lui-même ne les passe pas).
 * REND `true` quand le corps était déjà à jour.
 */
export function ecrireOuVerifier({ out, path: chemin, check, staleMsg, rerunMsg, okMsg, writeMsg }) {
  const consigne = process.env[ENV_CIBLES_RENDUES]
  if (consigne) appendFileSync(consigne, `${path.relative(process.cwd(), path.resolve(chemin)).split(path.sep).join('/')}\n`)
  const actuel = existeFichier(chemin) ? readFileSync(chemin, 'utf8') : null
  const aJour = actuel === out
  if (!check) {
    ecrireDoc(chemin, out)
    if (writeMsg) console.log(writeMsg)
    return aJour
  }
  if (aJour) {
    if (okMsg) console.log(okMsg)
    return true
  }
  console.error(staleMsg)
  console.error(apercuDivergences(out, actuel))
  console.error(rerunMsg)
  declarerCorpsPerime(out)
  return false
}

/** Fusion des fichiers `<base>.<pid>.json` d'un dossier : le set du générateur, PID compris. */
export function fusionnerLectures(dossier) {
  const fichiers = new Set()
  const ecrits = new Set()
  const dossiers = new Map()
  // Chemins LUS hors racine, refusés par les enveloppes : sans ce compte, un rejet est indiscernable
  // d'une absence de lecture. UNITÉ : des chemins canoniques distincts PAR PROCESSUS, sommés entre
  // PID — un même fichier hors racine lu par deux processus compte 2. Le thread des hooks n'en rend
  // aucun : il n'appende que ce qu'il retient.
  let cheminsRejetes = 0
  for (const nom of listerDossier(dossier, { absent: 'vide' })) {
    if (nom.endsWith('.hooks.jsonl')) {
      for (const rel of readFileSync(path.join(dossier, nom), 'utf8').split('\n')) if (rel) fichiers.add(rel)
      continue
    }
    if (!nom.endsWith('.json')) continue
    const lu = JSON.parse(readFileSync(path.join(dossier, nom), 'utf8'))
    cheminsRejetes += lu.cheminsRejetes ?? 0
    for (const f of lu.fichiers ?? []) fichiers.add(f)
    for (const e of lu.ecrits ?? []) ecrits.add(e)
    // Un dossier listé par DEUX processus (un dumper et son parent) : le premier PID lu gagne, et
    // les PID sont parcourus dans l'ordre des noms de fichiers. Deux listings du même dossier au
    // cours d'un même `docs:build` ne divergent que si un tiers écrit dedans pendant la génération.
    for (const [d, entrees] of Object.entries(lu.dossiers ?? {})) if (!dossiers.has(d)) dossiers.set(d, entrees)
  }
  for (const e of ecrits) fichiers.delete(e)
  return { fichiers: [...fichiers].sort(), dossiers, ecrits: [...ecrits].sort(), cheminsRejetes }
}

/** Sérialisation de `docs/.sources-lues.json` : trié, UN chemin par ligne (diff lisible). */
export function serialiserSourcesLues(parGenerateur) {
  const cles = Object.keys(parGenerateur).sort()
  const bloc = (nom, valeurs) =>
    valeurs.length ? `    "${nom}": [\n${valeurs.map((v) => `      ${JSON.stringify(v)}`).join(',\n')}\n    ]` : `    "${nom}": []`
  const corps = cles.map((cle) => {
    const e = parGenerateur[cle]
    return `  ${JSON.stringify(cle)}: {\n${[bloc('cibles', [...e.cibles].sort()), bloc('fichiers', [...e.fichiers].sort()), bloc('dossiers', [...e.dossiers].sort())].join(',\n')}\n  }`
  })
  return `{\n${corps.join(',\n')}\n}\n`
}

/** Un côté rendu dans l'aperçu est coupé au mot vers `LARGEUR` (`coupeAuMot`). */
const LARGEUR = 240

/** Un côté d'une ligne dans l'aperçu : rendu JSON coupé au mot vers `LARGEUR` (`coupeAuMot`), `<absente>` quand ce côté n'a pas la ligne. */
const cote = (ligne) => (ligne === undefined ? '<absente>' : JSON.stringify(coupeAuMot(ligne, LARGEUR)))

/** La première divergence, NOMMÉE : ligne présente des deux côtés, ou d'un seul (manque / en trop). */
function premiereDivergence(k, regeneree, surDisque) {
  if (surDisque === undefined) return `ligne ${k + 1} MANQUE au disque : ${cote(regeneree)}`
  if (regeneree === undefined) return `ligne ${k + 1} EN TROP au disque : ${cote(surDisque)}`
  return `ligne ${k + 1} — disque : ${cote(surDisque)} / régénéré : ${cote(regeneree)}`
}

/**
 * L'écart entre un corps RÉGÉNÉRÉ et le corps du disque, en clair : la première divergence NOMMÉE,
 * puis l'aperçu des `max` premières lignes divergentes des DEUX côtés, puis le compte du reste.
 * Vide = les deux corps sont identiques ; `surDisque` à `null` = le doc n'est pas sur le disque.
 */
export function apercuDivergences(regenere, surDisque, max = 10) {
  if (surDisque === null) return 'le doc est ABSENT du disque — npm run docs:build le produit'
  const attendues = regenere.split('\n')
  const lues = surDisque.split('\n')
  const total = Math.max(attendues.length, lues.length)
  const blocs = []
  let premiere = null
  let restantes = 0
  for (let k = 0; k < total; k++) {
    if (attendues[k] === lues[k]) continue
    if (premiere === null) premiere = premiereDivergence(k, attendues[k], lues[k])
    if (blocs.length >= max) {
      restantes++
      continue
    }
    blocs.push(`l.${k + 1}\n  disque : ${cote(lues[k])}\n  régénéré : ${cote(attendues[k])}`)
  }
  if (premiere === null) return ''
  if (restantes > 0) blocs.push(`… et ${restantes} autre(s) ligne(s) divergente(s)`)
  return [premiere, ...blocs].join('\n')
}

/** Le doc EXISTE-t-il sur le disque (une cible en glob peut ne rien viser). */
export const existeFichier = (p) => { try { return statSync(p).isFile() } catch { return false } }
