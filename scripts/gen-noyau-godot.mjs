// scripts/gen-noyau-godot.mjs — LES IDS QUE LE NOYAU ÉMET VERS GODOT (#4056 lot 4), lus des unions TypeScript par le
// vérificateur de types : une cible de CODE de `GENERATORS` (scripts/docs/build-all.mjs),
// `hotes/godot/projet/scripts/noyau.generated.gd`, jamais commitée. Sa `class_name Noyau` porte une classe interne par
// famille de `FAMILLES`, une `const` String par valeur de l'union ; un script Godot y lit l'id en accès statique
// (`Noyau.Effet.COUP`), et un id renommé côté TypeScript casse au parse du script qui le lit (`godot:sonde`). Elle porte
// aussi les listes qu'une scène vérifie à son instanciation (`Zone`, `Liaison`, #3328) : `SOURCES`, `CHAMPS`, `TYPES`,
// `TONS`, et `TypeDElement` pour les comparaisons de code ; et `ZONES_DES_MEMBRES`, les zones des avant-bras et des
// mains, sur lesquelles un objet rangé ne s'appuie pas (`MontageDeComposition._appuyer`, #4351).
//
//   node scripts/gen-noyau-godot.mjs            écrit la cible
//   node scripts/gen-noyau-godot.mjs --check    compare sans écrire
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript/unstable/ast'
import { SignatureKind, TypeFlags } from 'typescript/unstable/sync'
import { SORTIE_NOYAU_GODOT as SORTIE } from './docs/lib/cibles-registres.mjs'
import { lancerDepuisCLI } from './docs/lib/ecriture-derives.mjs'
import { libererSessions, repoProgram } from './guards/lib/tsProgram.mjs'
import { parUnitesDeCode } from './guards/lib/lister.mjs'

const RACINE_DU_DEPOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

/** Les familles : la classe interne GDScript, le type déclaré dans `module`, et, pour une union d'objets, le champ dont
 *  elle lit les valeurs (`champ`). */
export const FAMILLES = [
  { classe: 'Role', module: 'src/noyau/animation.ts', type: 'RoleDAnimation' },
  { classe: 'Effet', module: 'src/noyau/effetsDeLAppel.ts', type: 'Effet', champ: 'quoi' },
  { classe: 'IssueDuCoup', module: 'src/noyau/effetsDeLAppel.ts', type: 'IssueDuCoup' },
  { classe: 'Variante', module: 'src/noyau/effetsDeLAppel.ts', type: 'VarianteDeVitrine' },
  { classe: 'Piece', module: 'src/noyau/monde/aretes.ts', type: 'PieceDArete' },
  { classe: 'PieceDEscalier', module: 'src/noyau/monde/cotesDeMarches.ts', type: 'PieceDEscalier' },
  { classe: 'PieceDeToit', module: 'src/noyau/monde/piecesDeToit.ts', type: 'PieceDeToit' },
  { classe: 'Position', module: 'src/noyau/monde/aretes.ts', type: 'PositionDansLOuverture' },
  { classe: 'TypeDeSaisie', module: 'src/hote/elements.ts', type: 'Saisie', champ: 'type' },
]

/** Le module des méthodes du pont, dont les retours portent les zones de la vue, celui des éléments, et celui des zones
 *  des membres de l'évaluateur. */
const PONT = 'hotes/godot/pont/pont.ts'
const ELEMENTS = 'src/hote/elements.ts'
const MEMBRES = 'hotes/godot/asset/evaluateur/gardes/membres.ts'

const absolu = (racine, module) => path.resolve(racine, module).replaceAll('\\', '/')
const membres = (t) => (t.isUnionType() || t.isIntersectionType?.() ? t.getTypes() : [t])
const fichier = ({ program }, racine, module) => {
  const source = program.getSourceFile(absolu(racine, module))
  if (!source) throw new Error(`gen-noyau-godot : ${module} absent du programme`)
  return source
}
const declaration = ({ program }, racine, module, nom) => {
  const decl = fichier({ program }, racine, module).statements.find((st) => st.name?.text === nom)
  if (!decl) throw new Error(`gen-noyau-godot : \`${nom}\` introuvable dans ${module}`)
  return decl
}
/** Les chaînes du tuple littéral (`as const`) de la constante `nom` déclarée dans `module`. */
const tupleDe = ({ checker, program }, racine, module, nom) => {
  const decl = fichier({ program }, racine, module).statements.flatMap((st) => (ts.isVariableStatement(st) ? st.declarationList.declarations : [])).find((d) => d.name.text === nom)
  const t = decl && checker.getTypeAtLocation(decl.name)
  if (!t || !checker.isTupleType(t)) throw new Error(`gen-noyau-godot : \`${nom}\`, tuple littéral, introuvable dans ${module}`)
  return checker.getTypeArguments(t).flatMap(chaines)
}
const objet = (checker, t) => Boolean(t.flags & TypeFlags.Object) && !checker.isArrayType(t) && !checker.isTupleType(t)
const trie = (valeurs) => [...new Set(valeurs)].sort(parUnitesDeCode)
const chaines = (t) => membres(t).map((m) => m.value).filter((v) => typeof v === 'string')

/** Les valeurs de la famille `f`, triées, lues sur `session`. */
function valeursDe({ checker, program }, racine, f) {
  const t = checker.getTypeAtLocation(declaration({ program }, racine, f.module, f.type).name)
  return trie(f.champ ? membres(t).flatMap((m) => chaines(checker.getTypeOfSymbol(checker.getPropertyOfType(m, f.champ)))) : chaines(t))
}

/** Les clés de zone de la vue : celles de chaque membre `zones` objet, à toute profondeur, des retours des méthodes du
 *  pont (l'initialiseur de `methodes`, `PONT`). */
function sourcesDe({ checker, program }, racine) {
  let methodes = null
  const chercher = (n) => { if (ts.isVariableDeclaration(n) && n.name.text === 'methodes') methodes = n.initializer; else if (!methodes) n.forEachChild(chercher) }
  chercher(fichier({ program }, racine, PONT))
  if (!methodes) throw new Error(`gen-noyau-godot : \`methodes\` introuvable dans ${PONT}`)
  const cles = []
  const vus = new Set()
  const marcher = (t) => {
    if (vus.has(t)) return
    vus.add(t)
    if (checker.isArrayType(t) || checker.isTupleType(t)) checker.getTypeArguments(t).forEach(marcher)
    else if (membres(t).length > 1) membres(t).forEach(marcher)
    else if (t.flags & TypeFlags.Object) for (const p of checker.getPropertiesOfType(t)) {
      const pt = checker.getTypeOfSymbol(p)
      if (p.name === 'zones') cles.push(...membres(pt).filter((z) => objet(checker, z)).flatMap((z) => checker.getPropertiesOfType(z).map((q) => q.name)))
      marcher(pt)
    }
  }
  for (const m of checker.getPropertiesOfType(checker.getTypeAtLocation(methodes))) {
    for (const sig of checker.getSignaturesOfType(checker.getTypeOfSymbol(m), SignatureKind.Call)) marcher(checker.getReturnTypeOfSignature(sig))
  }
  return trie(cles)
}

/** Ce qu'une zone dessine : chaque variante d'`Element` (`ELEMENTS:234`), puis, de proche en proche, chaque objet à
 *  membre `type` qu'un membre-tableau d'un dessinable contient (`ELEMENTS:211`). Leurs types et leurs champs. */
function dessinablesDe({ checker, program }, racine) {
  const vus = new Set()
  const file = membres(checker.getTypeAtLocation(declaration({ program }, racine, ELEMENTS, 'Element').name))
  while (file.length) {
    const v = file.shift()
    if (vus.has(v) || !checker.getPropertyOfType(v, 'type')) continue
    vus.add(v)
    for (const p of checker.getPropertiesOfType(v)) {
      for (const m of membres(checker.getTypeOfSymbol(p))) if (checker.isArrayType(m)) file.push(...checker.getTypeArguments(m).flatMap(membres))
    }
  }
  return {
    types: trie([...vus].flatMap((v) => chaines(checker.getTypeOfSymbol(checker.getPropertyOfType(v, 'type'))))),
    champs: trie([...vus].flatMap((v) => checker.getPropertiesOfType(v).map((p) => p.name))),
  }
}

/** Les valeurs de chaque famille, par classe, et les listes de l'instanciation des scènes. */
export function noyauLu(racine = RACINE_DU_DEPOT) {
  const session = repoProgram(racine, () => [...new Set([...FAMILLES.map((f) => f.module), PONT, ELEMENTS, MEMBRES].map((m) => absolu(racine, m)))])
  try {
    const { types, champs } = dessinablesDe(session, racine)
    return {
      familles: [
        ...FAMILLES.map((f) => ({ classe: f.classe, dit: `\`${f.type}${f.champ ? `['${f.champ}']` : ''}\` (\`${f.module}\`)`, valeurs: valeursDe(session, racine, f) })),
        { classe: 'TypeDElement', dit: `Les types de ce qu'une zone dessine (\`${ELEMENTS}\`)`, valeurs: types },
      ],
      listes: [
        { nom: 'SOURCES', dit: `Les clés de zone de la vue (\`zones\` des retours de \`methodes\`, \`${PONT}\`)`, valeurs: sourcesDe(session, racine) },
        { nom: 'CHAMPS', dit: `Les champs de ce qu'une zone dessine (\`${ELEMENTS}\`)`, valeurs: champs },
        { nom: 'TYPES', dit: `Les types de ce qu'une zone dessine (\`${ELEMENTS}\`)`, valeurs: types },
        { nom: 'TONS', dit: `\`Ton\` (\`${ELEMENTS}\`)`, valeurs: trie(chaines(session.checker.getTypeAtLocation(declaration(session, racine, ELEMENTS, 'Ton').name))) },
        { nom: 'ZONES_DES_MEMBRES', dit: `\`ZONES_DES_MEMBRES\` (\`${MEMBRES}\`)`, valeurs: trie(tupleDe(session, racine, MEMBRES, 'ZONES_DES_MEMBRES')) },
      ],
    }
  } finally {
    libererSessions([session])
  }
}

/** Le nom de la constante d'une valeur : un `_` avant chaque majuscule interne, `-` en `_`, tout en majuscules. */
const nomDeConstante = (valeur) => valeur.replace(/(?<=.)(?=[A-Z])/g, '_').replaceAll('-', '_').toUpperCase()

/** Une classe interne : une `const` String par valeur. */
const classe = (nom, dit, valeurs) => `\n\n## ${dit}.\nclass ${nom}:\n` + valeurs.map((v) => `\tconst ${nomDeConstante(v)} := ${JSON.stringify(v)}\n`).join('')

/** Le texte de la cible. */
const texteDeSortie = ({ familles, listes }) =>
  `## GÉNÉRÉ par scripts/gen-noyau-godot.mjs (#4056) — jamais édité, jamais commité.\n`
  + `class_name Noyau\n`
  + listes.map((l) => `\n## ${l.dit}.\nconst ${l.nom}: PackedStringArray = [\n${l.valeurs.map((v) => `\t${JSON.stringify(v)},\n`).join('')}]\n`).join('')
  + familles.map((f) => classe(f.classe, f.dit, f.valeurs)).join('')

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map([[SORTIE, texteDeSortie(noyauLu())]])
}

export function* produire() {
  const noyau = noyauLu()
  console.log(`gen-noyau-godot — ${noyau.familles.length} familles, ${noyau.listes.map((l) => `${l.nom} ${l.valeurs.length}`).join(', ')}`)
  yield {
    out: texteDeSortie(noyau),
    path: SORTIE,
    staleMsg: `gen-noyau-godot — ${SORTIE} est PÉRIMÉ (diverge des unions du noyau).`,
    rerunMsg: '  → relancer `npm run gen`.',
  }
}

if (import.meta.main) await lancerDepuisCLI(import.meta, produire)
