// scripts/gen-combattants-de-l-etat.mjs — LES CHEMINS DES COMBATTANTS de l'état du jeu (#1463), dérivés du
// TYPE `EtatDeJeu` (src/noyau/etat.ts) : chaque chemin, du champ de premier niveau au `Combatant`
// (src/engine/types.ts), qu'atteint le type. Une cible de CODE de `GENERATORS` (scripts/docs/build-all.mjs),
// `src/noyau/combattantsDeLEtat.generated.ts`, jamais commitée. `transitionDuJeu` (src/noyau/transitionDuJeu.ts)
// y réconcilie les Blessures de tout combattant que l'écriture a pu toucher : un champ neuf qui porte un
// combattant y entre sans qu'aucune liste ne se tienne à la main.
//
// Un pas de chemin est un nom de champ, ou `[]` (chaque élément d'un tableau ou d'un tuple). Un combattant
// atteint par une autre collection (signature d'index, `Map`, `Set`) LÈVE, chemin nommé : la transition ne
// sait pas l'écrire.
//
//   node scripts/gen-combattants-de-l-etat.mjs            écrit la cible
//   node scripts/gen-combattants-de-l-etat.mjs --check    compare sans écrire
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript/unstable/ast'
import { TypeFlags } from 'typescript/unstable/sync'
import { SORTIE_COMBATTANTS_DE_L_ETAT as SORTIE } from './docs/lib/cibles-registres.mjs'
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs'
import { libererSessions, repoProgram } from './guards/lib/tsProgram.mjs'
import { parUnitesDeCode } from './guards/lib/lister.mjs'

const RACINE_DU_DEPOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
/** Le type racine et le type cherché, chacun dans son module. */
export const ETAT = { module: 'src/noyau/etat.ts', type: 'EtatDeJeu' }
export const COMBATTANT = { module: 'src/engine/types.ts', type: 'Combatant' }
const CONTENEURS_REFUSES = new Set(['Map', 'Set', 'ReadonlyMap', 'ReadonlySet', 'WeakMap', 'WeakSet'])

/** Le type de l'interface `nom` déclarée dans `module`. */
function typeDeLInterface(session, racine, { module, type: nom }) {
  const fichier = path.resolve(racine, module).replaceAll('\\', '/')
  const sf = session.program.getSourceFile(fichier)
  if (!sf) throw new Error(`gen-combattants-de-l-etat : ${module} hors du programme`)
  let decl
  sf.forEachChild((n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === nom) decl = n })
  if (!decl) throw new Error(`gen-combattants-de-l-etat : interface \`${nom}\` introuvable dans ${module}`)
  return session.checker.getTypeAtLocation(decl.name)
}

/** Les chemins (listes de pas) de `EtatDeJeu` qui atteignent un `Combatant`, triés. */
export function cheminsDesCombattants(racine = RACINE_DU_DEPOT) {
  const session = repoProgram(racine, () => [ETAT, COMBATTANT].map((r) => path.resolve(racine, r.module).replaceAll('\\', '/')))
  try {
    return cheminsDeLaSession(session, racine)
  } finally {
    libererSessions([session])
  }
}

/** Le nom d'un lieu de l'état : `EtatDeJeu`, puis ses pas (`.champ`, `[]`, `{}`, `<Map>`). */
const nommer = (chemin) => ETAT.type + chemin.map((pas) => (/^[[{<]/.test(pas) ? pas : `.${pas}`)).join('')

/** `cheminsDesCombattants` sur une session ouverte, dont `racine` porte `src/noyau/etat.ts` et `src/engine/types.ts`. */
export function cheminsDeLaSession(session, racine) {
  const { checker } = session
  const combattant = typeDeLInterface(session, racine, COMBATTANT).id
  // 1. Le graphe des types atteints depuis `EtatDeJeu`, chaque type visité UNE fois : ses arêtes `[pas, enfant]`
  //    (`pas` null = membre d'union ou d'intersection), le `Combatant` en feuille.
  const aretes = new Map()
  const pile = [typeDeLInterface(session, racine, ETAT)]
  const racineId = pile[0].id
  while (pile.length) {
    const t = pile.pop()
    if (aretes.has(t.id)) continue
    const sortantes = []
    aretes.set(t.id, sortantes)
    if (t.id === combattant) continue
    const suivre = (u, pas) => { sortantes.push([pas, u.id]); pile.push(u) }
    if (t.flags & (TypeFlags.Union | TypeFlags.Intersection)) for (const u of t.getTypes()) suivre(u, null)
    else if (t.flags & TypeFlags.Object) {
      const nom = t.getSymbol()?.name
      if (checker.isArrayType(t) || checker.isTupleType(t)) for (const u of checker.getTypeArguments(t)) suivre(u, '[]')
      else if (CONTENEURS_REFUSES.has(nom)) {
        for (const u of t.isTypeReference() ? checker.getTypeArguments(t) : []) suivre(u, `<${nom}>`)
      } else {
        for (const i of checker.getIndexInfosOfType(t)) suivre(i.valueType, '{}')
        for (const p of checker.getPropertiesOfType(t)) suivre(checker.getTypeOfSymbol(p), p.name)
      }
    }
  }
  // 2. Les types qui atteignent un `Combatant` : point fixe sur les arêtes.
  const atteint = new Set([combattant])
  for (let change = true; change;) {
    change = false
    for (const [id, sortantes] of aretes) {
      if (!atteint.has(id) && sortantes.some(([, u]) => atteint.has(u))) { atteint.add(id); change = true }
    }
  }
  // 3. Les chemins de la racine au `Combatant`, par les seuls types qui l'atteignent ; un cycle y rendrait des
  //    chemins sans fin, un pas d'index ou de `Map`/`Set` un combattant que la transition ne sait pas écrire.
  const chemins = new Map()
  const enCours = new Set()
  const descendre = (id, chemin) => {
    if (id === combattant) { chemins.set(chemin.join('.'), chemin); return }
    if (enCours.has(id)) throw new Error(`gen-combattants-de-l-etat : ${nommer(chemin)} porte un Combatant par un type récursif`)
    enCours.add(id)
    for (const [pas, u] of aretes.get(id)) {
      if (!atteint.has(u)) continue
      if (pas === '{}' || pas?.startsWith('<')) throw new Error(`gen-combattants-de-l-etat : ${nommer([...chemin, pas])} porte un Combatant que transitionDuJeu ne sait pas écrire`)
      descendre(u, pas === null ? chemin : [...chemin, pas])
    }
    enCours.delete(id)
  }
  descendre(racineId, [])
  return [...chemins.values()].sort((a, b) => parUnitesDeCode(a.join('.'), b.join('.')))
}

/** Le texte de la cible : un chemin par ligne. */
const texteDeSortie = (chemins) =>
  `// GÉNÉRÉ par scripts/gen-combattants-de-l-etat.mjs (#1463) — jamais édité, jamais commité.\n`
  + `import type { EtatDeJeu } from './etat';\n\n`
  + `/** Chaque chemin de \`EtatDeJeu\` qui atteint un \`Combatant\`, lu de son type : un champ de premier niveau, puis\n`
  + ` *  des noms de champ ou \`[]\` (chaque élément). */\n`
  + `export const CHEMINS_DES_COMBATTANTS = [\n`
  + chemins.map((c) => `  ${JSON.stringify(c)},\n`).join('')
  + `] as const satisfies readonly (readonly [keyof EtatDeJeu, ...string[]])[];\n`

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map([[SORTIE, texteDeSortie(cheminsDesCombattants())]])
}

/** L'écriture (ou la vérification) de la cible, les chemins tenus dans sa seule portée. */
function ecrireLaCible() {
  const chemins = cheminsDesCombattants()
  console.log(`gen-combattants-de-l-etat — ${chemins.length} chemins`)
  ecrireOuVerifier({
    out: texteDeSortie(chemins),
    path: SORTIE,
    check: process.argv.includes('--check'),
    staleMsg: `gen-combattants-de-l-etat — ${SORTIE} est PÉRIMÉ (diverge du type \`EtatDeJeu\`).`,
    rerunMsg: '  → relancer `npm run gen`.',
  })
}

if (import.meta.main) ecrireLaCible()
