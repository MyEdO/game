// L'ÉVÉNEMENT de frontière du stock CSS (#1806 D1″/D2″, `reclassementCss.mjs`) : un module qui
// FRANCHIT la frontière exige UNE ligne `RECLASSEMENT: <module> +N — <motif #ticket>` au N exact ; trois
// refus — franchi sans ligne, ligne sans franchissement, N faux. Aucun disque : les côtés sont en
// mémoire. Joué par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deplaceLaFrontiere, ecartsDeReclassement, franchisDesCotes, raisonDeRefusDeReclassement, reclassementsNonDeclares,
} from './reclassementCss.mjs'
import { motifDeCitation } from './cssImages.mjs'
import { CHEMIN_COUCHES, CHEMIN_MANIFESTE } from './cssCouches.mjs'
import { CHEMIN_TSCONFIG } from './importGraph.mjs'

const Q = 'src/ui/styles/ecran-q.css'
const P = 'src/ui/styles/prim-p.css'
const CSS = '.e { color: red; border: 0; font-size: 3px; gap: 3px }'

/** Un côté : `textes` = `{ chemin: texte }`, `reutilisees` = les modules d'une primitive réutilisée,
 *  `declares` = les modules revendiqués au manifeste (réutilisés ou non). */
const cote = (textes, reutilisees = [], declares = reutilisees) => ({
  manifeste: [{ id: 'sans-css' }, ...declares.map((css) => ({ id: css, fichier: `${css}.tsx`, css }))],
  partagees: [],
  reutilises: new Set(reutilisees.map((css) => `${css}.tsx`)),
  lire: (f) => textes[f] ?? null,
})
const ligne = (module, n, motif = 'la console devient une primitive, refs #1806') => `RECLASSEMENT: ${module} +${n} — ${motif}\n`
const message = (...lignes) => `refactor\n\n${lignes.join('')}`

/** S1 : Q franchit (4 sites), aucun autre module ne bouge. */
const S1 = { base: cote({ [Q]: CSS }), commit: cote({ [Q]: CSS }, [Q]) }

test('D2″ : un module franchi SANS ligne est refusé, avec son prix', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: 'refactor' }, S1), [{ module: Q, n: 4, declare: null }])
})

test('D2″ : la ligne au N exact passe ; un N faux est refusé ; deux lignes pour un module sont refusées', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4)) }, S1), [])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 3)) }, S1), [{ module: Q, n: 4, declare: 3 }])
  assert.deepEqual(
    reclassementsNonDeclares({ message: message(ligne(Q, 999), ligne(Q, 4)) }, S1),
    [{ module: Q, n: 4, declare: 999, declarees: [999, 4] }],
  )
})

test('D2″ : une ligne SANS franchissement est refusée — la ligne fausse ne couvre pas le vrai franchi (S2)', () => {
  const S2 = { base: cote({ [Q]: CSS }), commit: cote({ [Q]: CSS, [P]: CSS }, [Q, P]) }
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(P, 4)) }, S2), [
    { module: Q, n: 4, declare: null },
    { module: P, n: null, declare: 4 },
  ])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4)) }, S2), [], 'P naît exempté : il ne franchit pas')
})

test('D2″ : sans `#ticket` ou sous le motif minimal, la ligne n’est pas lue', () => {
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4, 'la console devient une primitive')) }, S1), [{ module: Q, n: 4, declare: null }])
  assert.deepEqual(reclassementsNonDeclares({ message: message(ligne(Q, 4, '#1806')) }, S1), [{ module: Q, n: 4, declare: null }])
})

test('D1″ : un SECOND importeur gagné fait franchir le module (S11) ; revendiquer à un seul hôte ne fait rien franchir', () => {
  const S11 = { base: cote({ [P]: CSS }, [], [P]), commit: cote({ [P]: CSS }, [P]) }
  assert.deepEqual(franchisDesCotes(S11.base, S11.commit), [{ module: P, identite: 3, espacement: 1, n: 4 }])
  const monoHote = { base: cote({ [Q]: CSS }), commit: cote({ [Q]: CSS }, [], [Q]) }
  assert.deepEqual(franchisDesCotes(monoHote.base, monoHote.commit), [])
})

test('D1″ : un module franchi à 0 site n’exige aucune ligne', () => {
  const vide = { base: cote({ [P]: '.p { gap: var(--sp-md) }' }), commit: cote({ [P]: '.p { gap: var(--sp-md) }' }, [P]) }
  assert.deepEqual(reclassementsNonDeclares({ message: 'refactor' }, vide), [])
})

test('franchisDesCotes ne lit que les candidats — exemptés au commit, pas à la base', () => {
  const lus = []
  const espion = (c) => ({ ...c, lire: (f) => { lus.push(f); return c.lire(f) } })
  const base = cote({ [Q]: CSS, [P]: CSS }, [P])
  const commit = cote({ [Q]: CSS, [P]: CSS }, [P, Q])
  franchisDesCotes(espion(base), espion(commit))
  assert.deepEqual([...new Set(lus)], [Q])
})

// ── deplaceLaFrontiere (#1806 E) : une branche, un test ─────────────────────────────────────────
const COMPOSANT_CONSOLE = 'src/ui/Console.tsx'
const MODULE_CONSOLE = 'src/ui/styles/console.css'
const MANIFESTE_CONSOLE = [{ id: 'a' }, { id: 'console', fichier: COMPOSANT_CONSOLE, css: MODULE_CONSOLE }]
const ECRAN = 'src/ui/Ecran.tsx'
const jamais = (quoi) => () => { throw new Error(`${quoi} lu alors que les chemins suffisent`) }
/** Un côté en mémoire : le manifeste, `textes` (`{ chemin: texte }`) et le composant cité. */
const arbreDe = (textes, manifeste = MANIFESTE_CONSOLE) => {
  const lire = (rel) => (rel === CHEMIN_MANIFESTE ? JSON.stringify(manifeste) : textes[rel] ?? null)
  return {
    lire,
    lireTout: (rels) => new Map(rels.map((rel) => [rel, lire(rel)])),
    citants: jamais('citants'),
    lister: () => [...Object.keys(textes).filter((f) => f.startsWith('src/')), COMPOSANT_CONSOLE],
  }
}
/** `avant` et `apres` : les textes de la base et du commit ; les chemins touchés sont leurs clés. */
const deplace = (avant, apres, nesOuMorts = []) => deplaceLaFrontiere({
  chemins: [...new Set([...Object.keys(avant), ...Object.keys(apres)])],
  nesOuMorts: () => nesOuMorts, base: arbreDe(avant), commit: arbreDe(apres), racine: '/r',
})
const sansLecture = { nesOuMorts: jamais('nesOuMorts'), base: { lire: jamais('base') }, commit: { lire: jamais('commit') } }
const IMPORT = "import { Console } from './Console'\n"

test('deplaceLaFrontiere : le MANIFESTE, `cssCouches.mjs` ou `tsconfig.json` touché suffit, sans rien lire d’autre', () => {
  for (const f of [CHEMIN_MANIFESTE, CHEMIN_COUCHES, CHEMIN_TSCONFIG]) {
    assert.equal(deplaceLaFrontiere({ chemins: [f], ...sansLecture }), true, f)
  }
})

test('deplaceLaFrontiere : un import d’un `fichier` du manifeste GAGNÉ ou PERDU relit la frontière', () => {
  assert.equal(deplace({ [ECRAN]: 'const a = 1\n' }, { [ECRAN]: IMPORT }), true, 'gagné')
  assert.equal(deplace({ [ECRAN]: "import { Console } from './Console.tsx'\n" }, { [ECRAN]: 'const a = 1\n' }), true, 'perdu')
  assert.equal(deplace({ [ECRAN]: IMPORT }, {}), true, 'importeur SUPPRIMÉ en entier')
})

test('deplaceLaFrontiere : un import sur PLUSIEURS lignes dont seule la ligne qui ne cite rien change relit la frontière', () => {
  assert.equal(deplace({ [ECRAN]: "const M = await charger(\n  './Console')\n" }, { [ECRAN]: "const M = await import(\n  './Console')\n" }), true)
})

test('deplaceLaFrontiere : des arcs vers le manifeste INCHANGÉS ne relisent rien — littéral, autre module, import déplacé', () => {
  assert.equal(deplace({ [ECRAN]: 'const a = 1\n' }, { [ECRAN]: "const p = './Console'\nimport { B } from './ConsoleBis'\nimport { t } from 'Console'\n" }), false)
  assert.equal(deplace({ [ECRAN]: IMPORT }, { [ECRAN]: `const a = 1\n${IMPORT}` }), false, 'le même arc')
  assert.equal(deplace({ 'src/ui/NOTES.md': 'a' }, { 'src/ui/NOTES.md': IMPORT }), false, 'un fichier qui n’est pas un module n’importe pas')
  assert.equal(deplaceLaFrontiere({ chemins: [ECRAN], nesOuMorts: jamais('nesOuMorts'), base: arbreDe({}, [{ id: 'sans-fichier' }]), commit: sansLecture.commit }),
    false, 'un manifeste sans `fichier` n’a rien à importer : ni les chemins nés ou morts ni le commit ne sont lus')
})

test('deplaceLaFrontiere : un module touché HORS de `src/` n’est pas un importeur — ses arcs vers le manifeste ne relisent rien', () => {
  const outil = 'scripts/outil.ts'
  assert.equal(deplace({ [outil]: 'const a = 1\n' }, { [outil]: "import { Console } from '../src/ui/Console'\n" }), false)
})

test('deplaceLaFrontiere : les MÊMES cibles importées dans un autre ordre ne relisent rien', () => {
  const PUPITRE = 'src/ui/Pupitre.tsx'
  const manifeste = [...MANIFESTE_CONSOLE, { id: 'pupitre', fichier: PUPITRE, css: 'src/ui/styles/pupitre.css' }]
  const importe = (...noms) => noms.map((n) => `import { ${n} } from './${n}'\n`).join('')
  const arbre = (texte) => arbreDe({ [ECRAN]: texte, [PUPITRE]: 'export const Pupitre = 1\n' }, manifeste)
  const juger = (avant, apres) => deplaceLaFrontiere({ chemins: [ECRAN], nesOuMorts: () => [], base: arbre(avant), commit: arbre(apres), racine: '/r' })
  assert.equal(juger(importe('Console', 'Pupitre'), importe('Pupitre', 'Console')), false)
  assert.equal(juger(importe('Console'), importe('Pupitre', 'Console')), true, 'témoin : une cible gagnée')
})

test('deplaceLaFrontiere : un module HOMONYME ajouté ou supprimé relit la frontière, VIDE compris — `./Console` peut changer de cible', () => {
  assert.equal(deplace({}, { 'src/ui/Console.ts': '' }, ['src/ui/Console.ts']), true, '`Console.ts` VIDE ajouté passe avant `Console.tsx`')
  assert.equal(deplace({ 'src/ui/Console.ts': '' }, {}, ['src/ui/Console.ts']), true, 'le retirer, vide, rend `./Console` à `Console.tsx`')
  assert.equal(deplace({}, { 'src/ui/Console/index.ts': '' }, ['src/ui/Console/index.ts']), true, 'repli `index.*`')
  assert.equal(deplace({}, { 'src/ui/Console.css': '' }, ['src/ui/Console.css']), false, 'une feuille n’est pas un module de code')
  assert.equal(deplace({}, { 'src/ui/Autre.ts': '' }, ['src/ui/Autre.ts']), false, 'témoin : un autre nom')
  assert.equal(deplace({ [COMPOSANT_CONSOLE]: 'export const Console = 1\n' }, { [COMPOSANT_CONSOLE]: 'export const Console = 2\n' }), false,
    'une simple MODIFICATION de l’homonyme ne change aucune résolution')
})

test('motifDeCitation : un nom du manifeste en mot entier après `/`, ou un spécificateur fini par `.`, `..` ou `/`', () => {
  const cite = new RegExp(motifDeCitation(MANIFESTE_CONSOLE))
  for (const l of [
    "import { C } from './Console'", "export { C } from '../d/Console.tsx'", "import Z from './Console/index'",
    "import X from './Console/'", "  './Console' // primitive", "  './Console').then((m) => m.Console)",
    "import { R } from '@/ui/Console'", "export * from '.'", "export { W } from '../..'", "import Y from './a/..'", "import V from '@/'",
  ]) assert.equal(cite.test(l), true, l)
  for (const l of ["const k = 'Console'", "import { B } from './ConsoleBis'", "import { t } from 'Console'", "import { u } from './MaConsole'", "const v = ''"]) {
    assert.equal(cite.test(l), false, l)
  }
  assert.equal(new RegExp(motifDeCitation([{ id: 'i', fichier: 'src/ui/Console/index.tsx' }])).test("import I from './index'"), true,
    'un `index.*` se cite aussi par `index`')
  assert.equal(motifDeCitation([{ id: 'sans-fichier' }]), null)
})

test('le refus nomme chaque écart, le commit, et le geste `rebase -i` sur une plage', () => {
  const ecarts = ecartsDeReclassement([{ module: Q, identite: 3, espacement: 1, n: 4 }], [{ fichier: P, n: 2 }])
  const raison = raisonDeRefusDeReclassement([{ sha: 'c1aaaaaaaaaa', ecarts }])
  assert.match(raison, /c1aaaaaaa src\/ui\/styles\/ecran-q\.css : franchi au prix 4, aucune ligne, src\/ui\/styles\/prim-p\.css : ligne `\+2` sans franchissement/)
  assert.match(raison, /git rebase -i/)
  assert.match(raison, /quittent le stock \(xxi\)/)
  assert.match(raisonDeRefusDeReclassement([{ sha: 'c2bbbbbbbbbb', illisible: 'manifeste illisible' }]), /c2bbbbbbb injugeable : manifeste illisible/)
  assert.doesNotMatch(raisonDeRefusDeReclassement([{ ecarts }]), /rebase/)
})
