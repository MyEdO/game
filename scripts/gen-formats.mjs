// scripts/gen-formats.mjs — le FORMAT de chaque donnée persistée sans schéma, dérivé de son TYPE
// sérialisé (#2404, option C du design jugé) : une cible de CODE de `GENERATORS`
// (scripts/docs/build-all.mjs), `src/state/formats.generated.ts`, jamais commitée.
//
//   node scripts/gen-formats.mjs            écrit la cible
//   node scripts/gen-formats.mjs --check    compare sans écrire
//
// FORME CANONIQUE, indépendante de l'identité interne des types et de l'ordre de chargement :
// 1. le graphe des types atteints depuis la racine (propriétés triées, `?` porté, unions et
//    intersections non ordonnées, littéraux, gabarits, tableaux, tuples, signatures d'index, marque
//    d'appel ; fonctions nues sautées). Une racine qui atteint `any`/`unknown`, ou un drapeau de type
//    non traité, ÉCHOUE en nommant le chemin ;
// 2. raffinement de partition (couleur = étiquette + couleurs des enfants) jusqu'au point fixe : deux
//    types de même couleur ont la même forme dépliée, cycles compris ;
// 3. sérialisation du graphe QUOTIENT depuis la racine, enfants non ordonnés triés par couleur, chaque
//    classe numérotée à sa première visite. Le format est le sha256 de cette sérialisation.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { libererSessions, repoProgram } from './guards/lib/tsProgram.mjs'
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs'

const require = createRequire(import.meta.url)
const RACINE_DU_DEPOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

/** LA cible. */
export const SORTIE = 'src/state/formats.generated.ts'

/** Les racines persistées, déclarées UNE fois : la constante générée, le module qui écrit le format
 *  et le type exporté qui en porte la forme sérialisée. */
export const RACINES = [
  { constante: 'FORMAT_SAVE', module: 'src/state/saves.ts', type: 'SaveGame' },
  { constante: 'FORMAT_ROSTER', module: 'src/state/roster.ts', type: 'RosterStocke' },
  { constante: 'FORMAT_EXPORT_HEROS', module: 'src/state/roster.ts', type: 'ExportDeHeros' },
  { constante: 'FORMAT_CALQUE', module: 'src/state/traceLayer.ts', type: 'CalqueStocke' },
]

/** Fichier virtuel qui nomme chaque racine (`R<i>`), ajouté au programme du dépôt. */
const SONDE = 'src/__formats_sonde.ts'

const texteDeSonde = (racines) =>
  racines.map((r, i) => `export type R${i} = import('${`./${path.posix.relative('src', r.module)}`.replace(/\.tsx?$/, '')}').${r.type};`).join('\n') + '\n'

const sha = (s) => createHash('sha256').update(s).digest('hex')

/** Le nom d'une propriété sans l'id interne qu'y porte une clé `unique symbol` (`__@nom@<id>`). */
const nomStable = (nom) => nom.replace(/^(__@.*)@\d+$/, '$1')

/**
 * Le graphe de forme de `racine` : `noeuds[i] = { etiquette, enfants, libres }` (`libres` : enfants non
 * ordonnés), le nœud 0 étant la racine. `anys` : TOUS les chemins où un `any` ou un `unknown` est
 * atteint, une arête entrante par chemin. Un drapeau de type non traité LÈVE, chemin nommé.
 */
export function grapheDeForme(checker, racine, lieu) {
  const { TypeFlags, SymbolFlags, SignatureKind } = require('typescript/unstable/sync')
  const indexDe = new Map()
  const noeuds = []
  const anys = []
  const PRIMITIFS = TypeFlags.String | TypeFlags.Number | TypeFlags.Boolean | TypeFlags.Null | TypeFlags.Undefined
    | TypeFlags.Void | TypeFlags.Never | TypeFlags.BooleanLiteral | TypeFlags.BigInt | TypeFlags.ESSymbol | TypeFlags.NonPrimitive
  const appelable = (t) => checker.getSignaturesOfType(t, SignatureKind.Call).length > 0
  const fonctionNue = (t) => appelable(t) && checker.getPropertiesOfType(t).length === 0 && checker.getIndexInfosOfType(t).length === 0
  const visiter = (t, chemin) => {
    if (t.flags & (TypeFlags.Any | TypeFlags.Unknown)) anys.push(`${chemin} : ${t.flags & TypeFlags.Any ? 'any' : 'unknown'}`)
    if (indexDe.has(t.id)) return indexDe.get(t.id)
    const i = noeuds.length
    indexDe.set(t.id, i)
    const n = { etiquette: '', enfants: [], libres: false }
    noeuds.push(n)
    const f = t.flags
    if (f & (TypeFlags.Any | TypeFlags.Unknown)) {
      n.etiquette = f & TypeFlags.Any ? 'any' : 'unknown'
    } else if (f & (TypeFlags.StringLiteral | TypeFlags.NumberLiteral)) {
      n.etiquette = `lit:${JSON.stringify(t.value)}`
    } else if (f & TypeFlags.BigIntLiteral) {
      n.etiquette = `bigint:${String(t.value)}`
    } else if (f & TypeFlags.UniqueESSymbol) {
      n.etiquette = `usym:${t.getSymbol().name}`
    } else if (f & PRIMITIFS) {
      n.etiquette = `prim:${checker.typeToString(t)}`
    } else if (f & TypeFlags.TemplateLiteral) {
      n.etiquette = `tpl:${JSON.stringify(t.texts)}`
      n.enfants = t.getTypes().map((m, k) => visiter(m, `${chemin}<${k}>`))
    } else if (f & TypeFlags.StringMapping) {
      n.etiquette = `map:${t.getSymbol().name}`
      n.enfants = [visiter(t.getTarget(), `${chemin}<>`)]
    } else if (f & TypeFlags.TypeParameter) {
      n.etiquette = `param:${checker.typeToString(t)}`
    } else if (t.isUnionType() || t.isIntersectionType()) {
      n.etiquette = t.isUnionType() ? 'U' : 'I'
      n.libres = true
      n.enfants = t.getTypes().map((m) => visiter(m, chemin))
    } else if (!(f & TypeFlags.Object)) {
      throw new Error(`gen-formats : drapeau de type non traité (${f}) en ${chemin} : ${checker.typeToString(t)}`)
    } else if (checker.isArrayType(t)) {
      n.etiquette = 'A'
      n.enfants = [visiter(checker.getTypeArguments(t)[0], `${chemin}[]`)]
    } else if (checker.isTupleType(t)) {
      const args = checker.getTypeArguments(t)
      n.etiquette = `T${args.length}`
      n.enfants = args.map((a, k) => visiter(a, `${chemin}[${k}]`))
    } else if (fonctionNue(t)) {
      n.etiquette = 'fn'
    } else {
      const parties = []
      for (const ii of checker.getIndexInfosOfType(t)) {
        const k = visiter(ii.keyType, `${chemin}[clé]`)
        parties.push({ cle: `[${k}]`, nom: '[]', enfants: [k, visiter(ii.valueType, `${chemin}[*]`)] })
      }
      const props = checker.getPropertiesOfType(t).map((p) => ({ p, nom: nomStable(p.name) })).sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0))
      for (const { p, nom } of props) {
        const pt = checker.getTypeOfSymbolAtLocation(p, lieu)
        if (!pt.isUnionType() && fonctionNue(pt)) continue
        parties.push({ nom: `${nom}${p.flags & SymbolFlags.Optional ? '?' : ''}`, enfants: [visiter(pt, `${chemin}.${nom}`)] })
      }
      n.etiquette = `${appelable(t) ? 'F' : 'O'}{${parties.map((p) => p.nom).join(';')}}`
      n.enfants = parties.flatMap((p) => p.enfants)
    }
    return i
  }
  visiter(racine, '$')
  return { noeuds, anys }
}

/** Raffinement de partition jusqu'au point fixe : la couleur de chaque nœud, indépendante des ids. */
export function couleurs(noeuds) {
  let c = noeuds.map((n) => sha(n.etiquette))
  let classes = new Set(c).size
  for (;;) {
    const suivante = noeuds.map((n, i) => {
      const k = n.enfants.map((e) => c[e])
      return sha(`${c[i]}(${(n.libres ? k.sort() : k).join(',')})`)
    })
    const nombre = new Set(suivante).size
    c = suivante
    if (nombre === classes) return c
    classes = nombre
  }
}

/** La sérialisation canonique du graphe quotient depuis le nœud 0. */
export function serialisation(noeuds, c) {
  const numero = new Map()
  const out = []
  const ecrire = (i) => {
    if (numero.has(c[i])) { out.push(`@${numero.get(c[i])}`); return }
    numero.set(c[i], numero.size)
    const n = noeuds[i]
    const enfants = n.libres
      ? [...new Map(n.enfants.map((e) => [c[e], e])).entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, e]) => e)
      : n.enfants
    out.push(`${n.etiquette}(`)
    enfants.forEach((e, k) => { if (k) out.push(','); ecrire(e) })
    out.push(')')
  }
  ecrire(0)
  return out.join('')
}

/** Une racine dont la forme atteint `any`/`unknown` : son format ne se dérive pas. */
export class FormatNonDerivable extends Error {
  constructor(constante, chemins) {
    super(`gen-formats : ${constante} atteint any/unknown, son format ne se dérive pas :\n${chemins.map((c) => `  ${c}`).join('\n')}`)
    this.name = 'FormatNonDerivable'
    this.chemins = chemins
  }
}

/**
 * Le programme de `racineDuDepot` qui calcule les formats, `recouvrement` (chemin relatif → texte)
 * par-dessus le disque. `avant` : fichiers du dépôt chargés AVANT la sonde (ordre de racines) ; `extra` :
 * alias de sonde ajoutés à ceux des `racines`. REND `lire({ checker, alias })`, `alias` = nom → déclaration.
 */
function dansLeProgramme({ racineDuDepot = RACINE_DU_DEPOT, racines = RACINES, recouvrement = {}, avant = [], extra = '' }, lire) {
  const prog = repoProgram(racineDuDepot, (_, cle) => [...avant.map((f) => `${cle}/${f}`), `${cle}/${SONDE}`], { [SONDE]: texteDeSonde(racines) + extra, ...recouvrement })
  const erreurs = []
  try {
    const { checker, program } = prog
    const sf = program.getSourceFile(`${path.resolve(racineDuDepot).replaceAll('\\', '/')}/${SONDE}`)
    const alias = new Map()
    sf.forEachChild((n) => { if (n.name?.text) alias.set(n.name.text, n) })
    return lire({ checker, alias })
  } catch (e) {
    erreurs.push(e)
  } finally {
    libererSessions([prog], erreurs)
  }
}

/**
 * Les formats de `racines` (options de `dansLeProgramme`). REND `[{ constante, format, noeuds }]` ;
 * LÈVE `FormatNonDerivable` si une racine atteint `any`/`unknown`.
 */
export function calculerFormats(options = {}) {
  const racines = options.racines ?? RACINES
  return dansLeProgramme(options, ({ checker, alias }) => racines.map((r, i) => {
    const decl = alias.get(`R${i}`)
    const type = checker.getTypeAtLocation(decl.name)
    if (type.flags & require('typescript/unstable/sync').TypeFlags.Any) throw new Error(`gen-formats : ${r.module} n'exporte pas le type ${r.type}`)
    const { noeuds, anys } = grapheDeForme(checker, type, decl)
    if (anys.length) throw new FormatNonDerivable(r.constante, anys)
    return { constante: r.constante, format: sha(serialisation(noeuds, couleurs(noeuds))).slice(0, 16), noeuds: noeuds.length }
  }))
}

/** Les `def` de `EtatDeSequence` (`src/state/sequenceContract.ts`) que voit le programme des formats,
 *  triés : les familles de séquence dont `FORMAT_SAVE` porte la forme. */
export function defsDeSequence(options = {}) {
  const extra = "export type DEFS = import('./state/sequenceContract').EtatDeSequence['def'];\n"
  return dansLeProgramme({ ...options, extra }, ({ checker, alias }) => {
    const t = checker.getTypeAtLocation(alias.get('DEFS').name)
    return (t.isUnionType() ? t.getTypes() : [t]).map((m) => m.value).sort()
  })
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map([[SORTIE, texteDeSortie(calculerFormats())]])
}

const texteDeSortie = (formats) =>
  `// GÉNÉRÉ par scripts/gen-formats.mjs (#2404) — jamais édité, jamais commité.\n`
  + formats.map((e) => `export const ${e.constante} = '${e.format}';\n`).join('')

if (import.meta.main) {
  const formats = calculerFormats()
  for (const e of formats) console.log(`gen-formats — ${e.constante} = ${e.format} (${e.noeuds} nœuds)`)
  ecrireOuVerifier({
    out: texteDeSortie(formats),
    path: SORTIE,
    check: process.argv.includes('--check'),
    staleMsg: `gen-formats — ${SORTIE} est PÉRIMÉ (diverge des types persistés).`,
    rerunMsg: '  → relancer `npm run gen`.',
  })
}
