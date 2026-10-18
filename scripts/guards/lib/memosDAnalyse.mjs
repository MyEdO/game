// MÉMOS D'ANALYSE (#2400, #2603) : des valeurs calculées sur le texte d'un module, adressées par contenu
// (`blobDe`) et signées par la version de l'analyseur (`versionDesMemos`), un fichier par famille ET par
// version (`memosDe`) : deux arbres aux analyseurs différents ne s'évincent pas. Les versions périmées partent
// par `purgerPerimes`. Le dossier est celui de l'appelant (`memosDe`), ou `<git-common-dir>/DOSSIER_DES_MEMOS`
// (`memosDAnalyse`). Un mémo illisible, d'une autre version ou de forme fausse est ignoré ; une sauvegarde impossible n'est qu'un
// avertissement : un mémo ne change aucun verdict.
import { createHash } from 'node:crypto'
import { closeSync, openSync, readSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHEMIN_TSCONFIG } from './importGraph.mjs'
import { dossierGitCommun } from './gitPorte.mjs'
import { ecrireTexteAtomique } from './ecritureJsonAtomique.mjs'
import { PEREMPTION_MS, purgerPerimes } from './purgerPerimes.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Les modules dont le code DÉCIDE du contenu des mémos : leur texte signe la version des mémos. Les mémos de la
 *  dérivation du périmètre se signent à part (`versionDesMemosDeDerivation`, #2603). */
const VERSIONNANTS = Object.freeze(['scripts/guards/lib/importGraph.mjs', 'scripts/guards/lib/racinesBalayees.mjs', 'scripts/guards/lib/dialecte.mjs',
  'scripts/guards/lib/tsProgram.mjs', 'scripts/guards/lib/memosDAnalyse.mjs'])
/** Les paquets dont la version DÉCIDE aussi des mémos : l'analyseur et le transpileur (`sourceALExecution`). */
export const PAQUETS_VERSIONNANTS = Object.freeze(['typescript', 'rolldown'])

/** Le texte du fichier `chemin` lu par `lire`, `absent` s'il n'existe pas ; une autre panne de lecture lève avec sa `cause` (#2586). */
export function texteSiPresent(chemin, lire = readFileSync, absent = '') {
  try { return lire(chemin, 'utf8') }
  catch (cause) {
    if (cause?.code === 'ENOENT') return absent
    throw new Error(`${chemin} illisible`, { cause })
  }
}

/** Le nom du fichier d'une famille de mémos sous une version. */
const MOTIF_DES_MEMOS = /^[\w-]+\.(?:[0-9a-f]{40}|[0-9a-f]{64})\.json$/

/** L'empreinte de blob git d'un texte (`git hash-object`). */
export const blobDe = (texte) => {
  const octets = Buffer.from(texte, 'utf8')
  return createHash('sha1').update(`blob ${octets.length}\0`).update(octets).digest('hex')
}

/**
 * La version des mémos du dépôt de `racine` : le texte des `VERSIONNANTS`, le `tsconfig.json` du dépôt
 * (`CHEMIN_TSCONFIG`, lu par `sourceALExecution`) et la version installée des `PAQUETS_VERSIONNANTS`.
 * @param {string} racine
 * @param {(versionnant: string) => string} [lireVersionnant] le texte d'un `VERSIONNANTS`, relatif à ce dépôt
 */
export function versionDesMemos(racine, lireVersionnant = (f) => readFileSync(join(RACINE, f), 'utf8')) {
  return blobDe([
    ...VERSIONNANTS.map(lireVersionnant),
    texteSiPresent(join(racine, CHEMIN_TSCONFIG)),
    ...PAQUETS_VERSIONNANTS.map((p) => `${p}@${JSON.parse(texteSiPresent(join(RACINE, 'node_modules', p, 'package.json')) || '{}').version ?? ''}`),
  ].join('\0'))
}

/**
 * Les mémos du dossier `dossier`, un JSON par famille sous `version` (`<famille>.<version>.json`). `sauver` écrit
 * les familles salies, puis purge les fichiers périmés (`purgerPerimes`) ; son échec n'est qu'un avertissement sur
 * stderr. `dossier` vide : les mémos du seul processus.
 * @param {string} dossier @param {string} version
 */
export function memosDe(dossier, version, { lectureSeule = false, limiteFamille = Infinity, diagnostic = () => {}, depassementStrict = false, finDeLigne = '' } = {}) {
  const familles = new Map()
  const fichier = (nom) => join(dossier, `${nom}.${version}.json`)
  const horsBorne = (nom, octets) => {
    const erreur = new Error(`mémos : famille ${nom} : ${octets} octets > limite ${limiteFamille}`)
    erreur.code = 'MEMOS_HORS_BORNE'
    return erreur
  }
  const charger = (nom) => {
    if (familles.has(nom)) return familles.get(nom).entrees
    let entrees = {}
    if (dossier) {
      let fd
      try {
        let texte
        if (Number.isFinite(limiteFamille)) {
          fd = openSync(fichier(nom), 'r')
          const prefixe = Buffer.alloc(512)
          const n = readSync(fd, prefixe, 0, Math.min(prefixe.length, limiteFamille + 1), 0)
          const entete = /^\{"version":"([^"\\]*)",/.exec(prefixe.subarray(0, n).toString('utf8'))
          if (!entete || entete[1] !== version) {
            diagnostic(nom, entete ? 'version incompatible' : 'entête invalide ou ancien')
            familles.set(nom, { entrees, sale: false })
            return entrees
          }
          const morceaux = []
          const tampon = Buffer.alloc(64 * 1024)
          let total = 0
          for (;;) {
            const lus = readSync(fd, tampon, 0, Math.min(tampon.length, limiteFamille + 1 - total), total)
            if (!lus) break
            total += lus
            if (total > limiteFamille) throw horsBorne(nom, total)
            morceaux.push(Buffer.from(tampon.subarray(0, lus)))
          }
          texte = Buffer.concat(morceaux).toString('utf8')
        } else texte = readFileSync(fichier(nom), 'utf8')
        const lu = JSON.parse(texte)
        if (lu?.version === version && lu.memos && typeof lu.memos === 'object' && !Array.isArray(lu.memos)) entrees = lu.memos
        else diagnostic(nom, 'corps invalide')
      } catch (e) {
        if (e.code === 'MEMOS_HORS_BORNE' && depassementStrict) throw e
        diagnostic(nom, e.code === 'ENOENT' ? 'absent' : e.code === 'MEMOS_HORS_BORNE' ? e.message : 'tronqué ou invalide')
      } finally { if (fd !== undefined) closeSync(fd) }
    }
    familles.set(nom, { entrees, sale: false })
    return entrees
  }
  return {
    lire: (nom, cle) => charger(nom)[cle],
    ecrire: (nom, cle, valeur) => { charger(nom)[cle] = valeur; familles.get(nom).sale = true },
    parcourir: (visiter) => {
      for (const [nom, famille] of familles)
        for (const [cle, valeur] of Object.entries(famille.entrees)) visiter(nom, cle, valeur)
    },
    supprimer: (nom, cle) => {
      const famille = familles.get(nom)
      if (famille && Object.hasOwn(famille.entrees, cle)) { delete famille.entrees[cle]; famille.sale = true }
    },
    sauver: () => {
      if (!dossier || lectureSeule) return
      const salies = [...familles].filter(([, { sale }]) => sale)
      if (!salies.length) return
      try {
        for (const [nom, famille] of salies) {
          const texte = JSON.stringify({ version, memos: famille.entrees }) + finDeLigne
          const octets = Buffer.byteLength(texte)
          if (octets > limiteFamille) throw horsBorne(nom, octets)
          ecrireTexteAtomique(fichier(nom), texte)
          famille.sale = false
        }
        purgerPerimes({ dossier, motif: MOTIF_DES_MEMOS, ageMs: PEREMPTION_MS })
      } catch (e) {
        if (e.code === 'MEMOS_HORS_BORNE' && depassementStrict) throw e
        process.stderr.write(`⚠ mémos d'analyse non sauvés sous ${dossier} (${e.code ?? e.message}) : recalculés au prochain geste\n`)
      }
    },
  }
}

/** Un site mémoïsé a-t-il la forme qu'en lit `importsDirectsDesSites` ? */
const estSite = (s) => typeof s?.spec === 'string' && typeof s.nature === 'string'

/**
 * L'option `specificateurs` de `clotureDImports` sur `memos`, adressée par contenu (extension, `blobDe`) :
 * une famille par régime de marche (`typesEffaces`), les sites n'étant valables que sous le leur. Un mémo dont
 * la forme n'est pas une liste de sites est ignoré.
 * @param {ReturnType<typeof memosDe>} memos @param {{ typesEffaces: boolean }} regime
 */
export function specificateursMemoises(memos, { typesEffaces }) {
  const famille = typesEffaces ? 'specificateurs' : 'specificateurs-typage'
  const cle = (a, t) => `${posix.extname(a)}:${blobDe(t)}`
  return {
    lire: (a, t) => {
      const sites = memos.lire(famille, cle(a, t))
      return Array.isArray(sites) && sites.every(estSite) ? sites : undefined
    },
    ecrire: (a, t, sites) => memos.ecrire(famille, cle(a, t), sites.map(({ spec, motifs, nature, ligne }) => ({ spec, motifs, nature, ligne }))),
  }
}

/** Le dossier des mémos d'analyse, sous le répertoire git COMMUN. */
export const DOSSIER_DES_MEMOS = 'hooks-git/memos-analyse'

/** `<git-common-dir>/DOSSIER_DES_MEMOS` du dépôt, ou `''` sans répertoire commun. @param {import('./gitPorte.mjs').Depot} depot */
function dossierParDefaut(depot) {
  const commun = dossierGitCommun(depot)
  return commun.disponible ? join(commun.valeur, DOSSIER_DES_MEMOS) : ''
}

/** @typedef {{ lire: (abs: string, texte: string) => { spec: string, nature: string }[] | undefined,
 *   ecrire: (abs: string, texte: string, sites: any[]) => void }} Specificateurs */

/**
 * Les mémos d'analyse PAR FICHIER du dépôt `depot` : les spécificateurs NON RÉSOLUS d'un texte, sous le régime de
 * typage (`specificateursMemoises`), signés par `versionDesMemos` de `racine`, sous `dossierDesMemos`, par défaut
 * `<git-common-dir>/DOSSIER_DES_MEMOS` ; `sauver`, UNE fois par geste, les écrit (`memosDe`). Sans répertoire commun,
 * ceux du seul processus.
 * @param {import('./gitPorte.mjs').Depot} depot @param {{ racine?: string, dossierDesMemos?: string }} [options]
 * @returns {{ specificateurs: Specificateurs, sauver: () => void }}
 */
export function memosDAnalyse(depot, { racine = depot.cwd, dossierDesMemos = dossierParDefaut(depot) } = {}) {
  const memos = memosDe(dossierDesMemos, versionDesMemos(racine))
  return { specificateurs: specificateursMemoises(memos, { typesEffaces: false }), sauver: memos.sauver }
}
