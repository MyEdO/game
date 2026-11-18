// scripts/gen-noyau-godot.mjs — LES IDS QUE LE NOYAU ÉMET VERS GODOT (#4056 lot 4), lus des unions TypeScript par le
// vérificateur de types : une cible de CODE de `GENERATORS` (scripts/docs/build-all.mjs),
// `hotes/godot/projet/scripts/noyau.generated.gd`, jamais commitée. Sa `class_name Noyau` porte une classe interne par
// famille de `FAMILLES`, une `const` String par valeur de l'union ; un script Godot y lit l'id en accès statique
// (`Noyau.Effet.COUP`), et un id renommé côté TypeScript casse au parse du script qui le lit (`godot:sonde`).
//
//   node scripts/gen-noyau-godot.mjs            écrit la cible
//   node scripts/gen-noyau-godot.mjs --check    compare sans écrire
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SORTIE_NOYAU_GODOT as SORTIE } from './docs/lib/cibles-registres.mjs'
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs'
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
  { classe: 'TypeDeSaisie', module: 'src/hote/elements.ts', type: 'Saisie', champ: 'type' },
]

const absolu = (racine, module) => path.resolve(racine, module).replaceAll('\\', '/')
const membres = (t) => (t.isUnionType() ? t.getTypes() : [t])
const chaines = (t) => membres(t).map((m) => m.value).filter((v) => typeof v === 'string')

/** Les valeurs de la famille `f`, triées, lues sur `session`. */
function valeursDe({ checker, program }, racine, f) {
  const decl = program.getSourceFile(absolu(racine, f.module))?.statements.find((st) => st.name?.text === f.type)
  if (!decl) throw new Error(`gen-noyau-godot : \`${f.type}\` introuvable dans ${f.module}`)
  const t = checker.getTypeAtLocation(decl.name)
  const valeurs = f.champ ? membres(t).flatMap((m) => chaines(checker.getTypeOfSymbol(checker.getPropertyOfType(m, f.champ)))) : chaines(t)
  return [...new Set(valeurs)].sort(parUnitesDeCode)
}

/** Les valeurs de chaque famille, par classe. */
export function famillesLues(racine = RACINE_DU_DEPOT) {
  const session = repoProgram(racine, () => [...new Set(FAMILLES.map((f) => absolu(racine, f.module)))])
  try {
    return FAMILLES.map((f) => ({ ...f, valeurs: valeursDe(session, racine, f) }))
  } finally {
    libererSessions([session])
  }
}

/** Le nom de la constante d'une valeur : un `_` avant chaque majuscule interne, `-` en `_`, tout en majuscules. */
const nomDeConstante = (valeur) => valeur.replace(/(?<=.)(?=[A-Z])/g, '_').replaceAll('-', '_').toUpperCase()

/** Le texte de la cible. */
const texteDeSortie = (familles) =>
  `## GÉNÉRÉ par scripts/gen-noyau-godot.mjs (#4056) — jamais édité, jamais commité.\n`
  + `class_name Noyau\n`
  + familles.map((f) => `\n\n## \`${f.type}${f.champ ? `['${f.champ}']` : ''}\` (\`${f.module}\`).\nclass ${f.classe}:\n`
    + f.valeurs.map((v) => `\tconst ${nomDeConstante(v)} := ${JSON.stringify(v)}\n`).join('')).join('')

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map([[SORTIE, texteDeSortie(famillesLues())]])
}

if (import.meta.main) {
  const familles = famillesLues()
  console.log(`gen-noyau-godot — ${familles.length} familles`)
  ecrireOuVerifier({
    out: texteDeSortie(familles),
    path: SORTIE,
    check: process.argv.includes('--check'),
    staleMsg: `gen-noyau-godot — ${SORTIE} est PÉRIMÉ (diverge des unions du noyau).`,
    rerunMsg: '  → relancer `npm run gen`.',
  })
}
