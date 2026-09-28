// LECTURE des images CSS (#1806 L1) : le lieu UNIQUE où un arbre — ref git, index, arbre de travail —
// devient l'image `{ fichiers, manifeste, partagees, reutilises }` que mesure `cssCouches.mjs`, et le
// CÔTÉ `{ manifeste, partagees, reutilises, lire }` qu'en lit la garde `RECLASSEMENT:`. Les imports
// qui fixent `reutilises` sont ceux de `directImportsOf` (`importGraph.mjs`) sur le contenu entier des
// modules que `git grep -l` (`fichiersDuGrep`, `gitPorte.mjs`) présélectionne (`motifDeCitation`), lus par lot
// (`lireEnLot`) et résolus contre l'arbre lu. Appelants : `cssCouchesAudit.ts` (disque),
// `ventilationDeGit` (l'admission du RETOURNÉ par la régénération de `cssCouchesAudit.ts`, et
// `scripts/ui/ventilation-css-couches.mts`), le garde de solde au commit, la porte de plage au push.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CHEMIN_TSCONFIG, aliasDe, directImportsOf, estModule, pathspecsDeModules } from './importGraph.mjs'
import { INDEX, SUIVI, TRAVAIL, ceQuiChange, depotDe, fichiersDuGrep, lireEnLot, listerImage, shaDe } from './gitPorte.mjs'
import {
  CHEMIN_COUCHES, CHEMIN_MANIFESTE, RACINE_DES_MODULES, feuillesPartageesDe, fichiersReutilises,
  manifesteDe, modulesDePrimitive, ventiler,
} from './cssCouches.mjs'

/** @typedef {{ lister: (dossier: string) => readonly string[], lire: (rel: string) => string | null,
 *   lireTout: (rels: readonly string[]) => Map<string, string | null>,
 *   citants: (motif: string) => readonly string[] }} SourceCss */

/** Racine où cherchent les importeurs. */
export const RACINE_DES_SOURCES = 'src'

// Chargé après la porte de version des hooks qui l'importent : scripts/node-requis.mjs (#1801).
const { alternationDe } = await import('../../../src/lib/regex.ts')
const { FORMAT_MJS } = await import('./stockDeSites.mjs')

/**
 * Les NOMS par lesquels un spécificateur atteint `chemin` sous l'ordre de repli de `resolveImport`
 * (`importGraph.mjs`) : son nom sans extension, et celui de son dossier pour un `index.*`.
 * @param {string} chemin @returns {string[]}
 */
export function nomsDImportDe(chemin) {
  const segments = chemin.split('/')
  const base = segments.at(-1).replace(/\.[^.]+$/, '')
  return base === 'index' && segments.length > 1 ? [base, segments.at(-2)] : [base]
}

/**
 * Les NOMS d'import des `fichier`s du manifeste (`nomsDImportDe`).
 * @param {readonly { fichier?: string }[]} manifeste @returns {Set<string>}
 */
export function nomsDImport(manifeste) {
  return new Set(manifeste.flatMap(({ fichier }) => (typeof fichier === 'string' ? nomsDImportDe(fichier) : [])))
}

/**
 * Le motif `-E` (`git grep` comme `RegExp`) des lignes qui CITENT un `fichier` du manifeste : un de ses
 * noms (`nomsDImport`) en mot entier après une barre oblique — tout spécificateur relatif ou sous un
 * alias l'y écrit —, ou un spécificateur que `resolveImport` résout sans écrire de nom, fini par `.`,
 * `..` ou `/`. Il PRÉSÉLECTIONNE : `directImportsOf` lit ensuite le fichier entier. `null` = rien à
 * chercher.
 * @param {readonly { fichier?: string }[]} manifeste @returns {string | null}
 */
export function motifDeCitation(manifeste) {
  const noms = nomsDImport(manifeste)
  if (!noms.size) return null
  return `/(${alternationDe(noms)})([^A-Za-z0-9_$]|$)|['"](([^'"]*/)?\\.\\.?|[^'"]*/)['"]`
}

/**
 * Les imports DIRECTS (`directImportsOf`, `importGraph.mjs`) de chaque chemin de `rels` dans l'arbre
 * `source`, lus par lot (`lireTout`) et résolus contre les SEULS fichiers (`lister`) et les alias
 * (`tsconfig.json`, `aliasDe`) de cet arbre : le disque n'est pas l'arbre jugé (#1806). Un chemin absent
 * de l'arbre, ou qui n'est pas un module de code (`estModule`), n'importe rien.
 * @param {SourceCss} source @param {readonly string[]} rels @param {{ racine?: string }} [options]
 * @returns {[string, string[]][]}
 */
export function importsDansLArbre(source, rels, { racine = '.' } = {}) {
  const modules = rels.filter(estModule)
  if (!modules.length) return rels.map((rel) => [rel, []])
  const racineAbs = resolve(racine).split('\\').join('/')
  const arbre = new Set(source.lister(RACINE_DES_SOURCES).map((rel) => `${racineAbs}/${rel}`))
  const options = { racine, existe: (abs) => arbre.has(abs), alias: aliasDe(source.lire(CHEMIN_TSCONFIG), racineAbs) }
  const textes = source.lireTout(modules)
  return rels.map((rel) => {
    const texte = textes.get(rel)
    return [rel, typeof texte === 'string' ? directImportsOf(rel, texte, options) : []]
  })
}

/**
 * Le CÔTÉ d'un arbre : manifeste, `FEUILLES_PARTAGEES`, `fichier`s RÉUTILISÉS et lecteur de texte. Les
 * importeurs sont les modules de `src/` qui citent le manifeste (`citants`, `motifDeCitation`), lus
 * ENTIERS (`importsDansLArbre`).
 * @param {SourceCss} source @param {{ racine?: string }} [options] le dépôt où les imports se résolvent
 * @throws {Error} manifeste ou `cssCouches.mjs` illisible.
 */
export function coteCss(source, { racine = '.' } = {}) {
  const manifeste = manifesteDe(source.lire(CHEMIN_MANIFESTE))
  const partagees = feuillesPartageesDe(source.lire(CHEMIN_COUCHES))
  const motif = motifDeCitation(manifeste)
  const imports = motif ? importsDansLArbre(source, source.citants(motif), { racine }) : []
  return { manifeste, partagees, reutilises: fichiersReutilises(manifeste, imports), lire: source.lire }
}

/**
 * L'IMAGE mesurable d'un arbre : son côté, et ses feuilles MESURÉES — `src/ui/styles/` ∪ les modules
 * déclarés par le manifeste (champ `css`), où qu'ils vivent (#1806 A3).
 * @param {Parameters<typeof coteCss>[0]} source
 * @param {{ racine?: string }} [options]
 */
export function imageCss(source, options) {
  const { manifeste, partagees, reutilises } = coteCss(source, options)
  const rels = new Set(source.lister(RACINE_DES_MODULES).filter((f) => f.endsWith('.css')))
  for (const c of modulesDePrimitive(manifeste)) rels.add(c)
  const fichiers = [...rels]
    .map((rel) => ({ rel, text: source.lire(rel) }))
    .filter((f) => f.text !== null)
  return { fichiers, manifeste, partagees, reutilises }
}

/**
 * Une source lue par git dans `cwd` : `arbre` = une ref, `INDEX`, `SUIVI` ou `TRAVAIL` (`gitPorte.mjs`),
 * ces deux derniers lus sur le disque. `depot` (`depotDe`) est le dépôt de l'appelant ; par défaut
 * `depotDe(cwd)`, dont une indisponibilité LÈVE (`GitIndisponible`) : une image vide jugerait sur rien.
 * @param {{ cwd?: string, arbre: string, depot?: import('./gitPorte.mjs').Depot }} p
 */
export function sourceGit({ cwd = process.cwd(), arbre, depot = depotDe(cwd) }) {
  const disque = arbre === SUIVI || arbre === TRAVAIL
  const portee = arbre === INDEX ? ['--cached'] : arbre === SUIVI ? [] : arbre === TRAVAIL ? ['--untracked'] : [arbre]
  return {
    existe: () => arbre === INDEX || disque || shaDe(depot, arbre) !== null,
    lister: (dossier) => listerImage(depot, arbre, dossier),
    lire: disque
      ? (rel) => lireDuTravail(cwd, rel)
      : (rel) => lireEnLot(depot, arbre, [rel]).get(rel) ?? null,
    lireTout: disque
      ? (rels) => new Map(rels.map((rel) => [rel, lireDuTravail(cwd, rel)]))
      : (rels) => lireEnLot(depot, arbre, rels),
    citants: (motif) => fichiersDuGrep(depot, portee, motif, pathspecsDeModules(RACINE_DES_SOURCES)),
  }
}

/**
 * La source des chemins que `dans` retient lus dans `dedans`, et de tous les autres dans `dehors` :
 * l'arbre d'un `git commit -- <pathspec>` (`dedans` = l'arbre de travail, `dehors` = `HEAD`).
 * @param {{ dans: (rel: string) => boolean, dedans: SourceCss, dehors: SourceCss }} p @returns {SourceCss}
 */
export function sourceMelee({ dans, dedans, dehors }) {
  const hors = (rel) => !dans(rel)
  return {
    lister: (dossier) => [...dehors.lister(dossier).filter(hors), ...dedans.lister(dossier).filter(dans)],
    lire: (rel) => (dans(rel) ? dedans : dehors).lire(rel),
    lireTout: (rels) => {
      const lus = new Map([...dehors.lireTout(rels.filter(hors)), ...dedans.lireTout(rels.filter(dans))])
      return new Map(rels.map((rel) => [rel, lus.get(rel) ?? null]))
    },
    citants: (motif) => [...dehors.citants(motif).filter(hors), ...dedans.citants(motif).filter(dans)],
  }
}

/** Le texte d'un fichier de l'arbre de travail, `null` s'il n'existe pas. */
export function lireDuTravail(cwd, rel) {
  try {
    return readFileSync(join(cwd, rel), 'utf8')
  } catch {
    return null
  }
}

/** Le stock CSS nominatif, et ses deux collections que la ventilation lit, keyées par volet. */
export const CHEMIN_STOCK_CSS = 'scripts/guards/lib/cssCouchesStock.mjs'
export const COLLECTIONS_VENTILEES = Object.freeze({ identite: 'CSS_IDENTITE_ECRAN_RATCHET', espacement: 'CSS_ESPACEMENT_RATCHET' })

/**
 * Les deux volets ventilés du stock CSS ÉCRIT dans `texte`, lus par `FORMAT_MJS`. Une collection que le
 * format ne reconnaît pas (absente, ou une entrée hors forme) LÈVE en se nommant, `ou` dans la phrase.
 * @param {string} texte @param {string} ou
 */
export function stockCssDe(texte, ou) {
  const lu = FORMAT_MJS.lire(texte, CHEMIN_STOCK_CSS)
  const absentes = Object.values(COLLECTIONS_VENTILEES).filter((nom) => !lu.collections.has(nom))
  if (absentes.length) throw new Error(`${CHEMIN_STOCK_CSS} illisible ${ou} : collection(s) ${absentes.join(', ')} introuvable(s)`)
  return { identite: lu.collections.get(COLLECTIONS_VENTILEES.identite), espacement: lu.collections.get(COLLECTIONS_VENTILEES.espacement) }
}

/**
 * La VENTILATION de `base` à `tete` (une ref, ou `TRAVAIL`) telle que git les porte — le seul chemin
 * de `scripts/ui/ventilation-css-couches.mts` et de l'admission du RETOURNÉ (`cssCouchesAudit.ts`) :
 * images lues par `imageCss`, renommages `-M` de l'intervalle, et Sb = le stock ÉCRIT à `base`
 * (`CHEMIN_STOCK_CSS`, `stockCssDe`) quand il existe. Une ref absente de l'histoire LÈVE en se nommant :
 * un clone superficiel ne ventile rien.
 * @param {{ cwd?: string, base: string, tete?: string, depot?: import('./gitPorte.mjs').Depot }} p
 */
export function ventilationDeGit({ cwd = process.cwd(), base, tete = TRAVAIL, depot = depotDe(cwd) }) {
  const source = (arbre) => {
    const s = sourceGit({ cwd, arbre, depot })
    if (!s.existe()) throw new Error(`ref ${arbre} absente de l'histoire de ${cwd} (clone superficiel ? il faut \`fetch-depth: 0\`)`)
    return s
  }
  const avant = source(base)
  const texte = avant.lire(CHEMIN_STOCK_CSS)
  const stockAvant = texte === null ? undefined : stockCssDe(texte, `à ${base}`)
  const v = ventiler(imageCss(avant, { racine: cwd }), imageCss(source(tete), { racine: cwd }), {
    renommages: ceQuiChange(depot, base, tete === TRAVAIL ? SUIVI : tete).renommages(),
    stockAvant,
  })
  return { ...v, stockAvant: stockAvant ?? { identite: [], espacement: [] } }
}
