// LA SERRURE DES LECTURES BRUTES (#5037) : sous les tests, une lecture `node:fs` du dossier `projets/` de CE dépôt
// lève le refus de la serrure (`exigerLaPorte`, `serrureDesProjets.mjs`), sauf si la pile l'admet (ses modules hors de
// node, de `node_modules` et de ce module) : le module qui lit est une passerelle (il importe la serrure et exige la
// passe lui-même), un module de la pile atteint la porte par sa clôture d'imports statiques (`porteDesProjets.mjs` :
// tout test qui l'importe aussi), ou un module de la pile est du projet lu. Une pile sans module du dépôt (chargeur de
// node, Vitest, TypeScript rappelé par node_modules seul) est hors serrure.
// Installé une fois par processus : par le setup Vitest (`vitest.config.ts`) et, sous `--import`, par l'environnement
// du contrôle des écritures (`environnementDuControle`, `controleEcritures.mjs`), que tout enfant node hérite.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEPOT, exigerLaPorte } from './serrureDesProjets.mjs'

const ICI = fileURLToPath(import.meta.url)
const PROJETS = join(DEPOT, 'projets')
const SERRURE = join(dirname(ICI), 'serrureDesProjets.mjs')
const PORTE = join(dirname(ICI), 'porteDesProjets.mjs')
const lireLeTexte = fs.readFileSync
const MARQUE = Symbol.for('wfrp.tests.lecturesDesProjets')

/** Les lectures gardées : le nom, l'index de son chemin, et si elle descend RÉCURSIVEMENT (`readdir` sous
 *  `recursive`, `cp`), donc lit `projets/` depuis un ancêtre. */
const LECTURES = Object.freeze({
  readFileSync: 0, readFile: 0, readdirSync: 0, readdir: 0, opendirSync: 0, opendir: 0, createReadStream: 0,
  openSync: 0, open: 0, copyFileSync: 0, copyFile: 0, cpSync: 0, cp: 0,
})
const recursive = (nom, args) => nom.startsWith('cp') || (nom.startsWith('readdir') && args[1]?.recursive === true)

/** Le chemin absolu d'un argument de chemin de `node:fs`, `null` pour un descripteur ou un handle. */
function cheminDe(p) {
  if (typeof p === 'string') return resolve(p)
  if (Buffer.isBuffer(p)) return resolve(p.toString())
  if (p instanceof URL && p.protocol === 'file:') return fileURLToPath(p)
  return null
}

/** Le fichier d'un site de pile, sans requête ni schéma `file:`, `null` hors d'un fichier. */
function fichierDuSite(site) {
  const nom = site.getFileName()
  if (!nom || nom.startsWith('node:')) return null
  const sansRequete = nom.replace(/[?#].*$/, '')
  if (sansRequete.startsWith('file:')) return fileURLToPath(sansRequete)
  return sansRequete.startsWith(sep) || /^[A-Za-z]:[\\/]/.test(sansRequete) ? sansRequete : null
}

/** Les modules de la pile, du plus proche au plus lointain : ses fichiers hors de node, de `node_modules` et de ce module. */
function modulesDeLaPile() {
  const limite = Error.stackTraceLimit
  const preparer = Error.prepareStackTrace
  Error.stackTraceLimit = Infinity
  Error.prepareStackTrace = (_e, sites) => sites
  const pile = {}
  Error.captureStackTrace(pile, modulesDeLaPile)
  const sites = pile.stack
  Error.prepareStackTrace = preparer
  Error.stackTraceLimit = limite
  return [...new Set(sites.map(fichierDuSite).filter((f) => f && f !== ICI && !f.split(/[\\/]/).includes('node_modules')))]
}

/** Les spécificateurs STATIQUES d'un texte de module : `import … from`, `export … from`, `} from` d'un import sur
 *  plusieurs lignes, `import '…'`, chacun en tête de ligne. */
const STATIQUES = /^\s*(?:(?:import|export)\b[^\n]*?\bfrom|\}\s*from|import)\s*(['"])([^'"\n]+)\1/gm

/** Le fichier qu'un spécificateur relatif ou `@/` (`src/`) de `depuis` désigne, `null` pour un paquet ou un absent. */
function resoudreSpec(depuis, spec) {
  const base = spec.startsWith('@/') ? join(DEPOT, 'src', spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(depuis), spec) : null
  if (base === null) return null
  const candidats = [base, base.replace(/\.js$/, '.ts'), ...['.ts', '.mts', '.mjs', '.js', '.tsx'].map((ext) => base + ext), ...['index.ts', 'index.mjs', 'index.js'].map((nom) => join(base, nom))]
  return candidats.find((c) => fs.statSync(c, { throwIfNoEntry: false })?.isFile()) ?? null
}

/** Les cibles des spécificateurs statiques du module `module`. */
function importsDe(module) {
  let texte = ''
  try { texte = lireLeTexte(module, 'utf8') } catch { /* module sans texte sur le disque (`-e`, REPL) : il n'importe rien */ }
  return [...texte.matchAll(STATIQUES)].map(([, , spec]) => resoudreSpec(module, spec)).filter((cible) => cible !== null)
}

/** Le module `fichier` est-il une PASSERELLE, qui importe la serrure ? */
const importeLaSerrure = (fichier) => importsDe(fichier).includes(SERRURE)

/** La clôture d'imports statiques de `fichier` atteint-elle la porte ? Mémoïsé par fichier. @type {Map<string, boolean>} */
const LECTEURS = new Map()
function atteintLaPorte(fichier) {
  if (!LECTEURS.has(fichier)) {
    const vus = new Set([fichier])
    const aVoir = [fichier]
    let atteint = false
    while (aVoir.length && !atteint) {
      for (const cible of importsDe(aVoir.pop())) {
        if (vus.has(cible)) continue
        atteint = cible === PORTE
        if (atteint) break
        vus.add(cible)
        aVoir.push(cible)
      }
    }
    LECTEURS.set(fichier, atteint)
  }
  return LECTEURS.get(fichier)
}

/** Le dossier `projets/<p>` qui contient `abs`, `null` hors d'un projet. */
function projetDe(abs) {
  const rel = relative(PROJETS, abs)
  if (!rel || rel.startsWith('..')) return null
  return join(PROJETS, rel.split(sep)[0])
}

/** Refuse la lecture `nom` de `abs` quand rien ne l'admet : ni le module qui lit (le plus proche) s'il est une
 *  passerelle, ni un module de la pile qui atteint la porte ou qui est du projet lu. Une passerelle plus loin dans la
 *  pile n'admet pas : elle n'a pas jugé la lecture d'un rappel qu'elle fait. Le refus nomme le module qui lit. */
function verifier(nom, abs, args) {
  const ancetres = recursive(nom, args)
  const sous = abs === PROJETS || abs.startsWith(PROJETS + sep)
  if (!sous && !(ancetres && PROJETS.startsWith(abs.endsWith(sep) ? abs : abs + sep))) return
  const modules = modulesDeLaPile()
  const projet = sous ? projetDe(abs) : null
  if (!modules.length || importeLaSerrure(modules[0]) || modules.some((m) => (projet !== null && projetDe(m) === projet) || atteintLaPorte(m))) return
  exigerLaPorte(abs, undefined, `lecture brute ${nom} par ${relative(DEPOT, modules[0]).split(sep).join('/')}`, { ancetres })
}

/** Enveloppe les lectures de `fs` (le refus lève) et de `fs.promises` (le refus rejette) ; idempotente par processus. */
export function installerLaSerrureDesLectures() {
  if (globalThis[MARQUE]) return
  globalThis[MARQUE] = true
  for (const objet of [fs, fs.promises]) {
    for (const [nom, index] of Object.entries(LECTURES)) {
      const original = objet[nom]
      if (typeof original !== 'function') continue
      const garde = objet === fs ? function (...args) {
        const abs = cheminDe(args[index])
        if (abs) verifier(nom, abs, args)
        return new.target ? Reflect.construct(original, args, new.target) : original.apply(this, args)
      } : function (...args) {
        const abs = cheminDe(args[index])
        try {
          if (abs) verifier(nom, abs, args)
        } catch (refus) {
          return Promise.reject(refus)
        }
        return original.apply(this, args)
      }
      Object.defineProperty(objet, nom, { value: Object.assign(garde, { prototype: original.prototype }), writable: true, enumerable: true, configurable: true })
    }
  }
  syncBuiltinESMExports()
}

installerLaSerrureDesLectures()
