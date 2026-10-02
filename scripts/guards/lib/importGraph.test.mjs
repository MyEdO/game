// Contrat du parseur d'imports PARTAGÉ (`importGraph.mjs`) — deux points que ses consommateurs
// (`build-systemes.mjs`, `genericDomainImport.mjs`, `build-implemente.mjs`) tiennent pour acquis :
//   1. les extensions résolues couvrent ce que le dépôt écrit VRAIMENT, `.mjs`/`.cjs` compris —
//      109 imports relatifs de `src/**` vers les libs de garde de `scripts/**` en dépendent ;
//   2. la CLOSURE reste bornée à `src/` — la borne est le PRÉDICAT que `closureOf` passe à la marche
//      (`clotureDImports`), pas une propriété de la marche : une lib de `scripts/` résolue n'entre pas
//      pour autant dans une closure. Le test le dit en POSITIF pour qu'un élargissement de la frontière
//      se voie ici, jamais par surprise chez un consommateur ;
//   3. la MARCHE NON BORNÉE (`clotureDImports` sans prédicat) atteint, elle, les libs de `scripts/` —
//      c'est ce que `lister.test.mjs` (#1679 L3b) exige pour voir un listing dans une lib de garde
//      atteinte par un générateur, là où `closureOf` ne rend AUCUN module `scripts/` ;
//   4. `typesEffaces` retranche les arcs de TYPE PUR — un appelant qui suit un EFFET DE MODULE (la
//      locale zod posée au chargement, #1588) conclurait sinon à une atteignabilité que le bundle ne
//      réalise pas, un `import type` étant effacé à la compilation ;
//   5. `dynamiques: false` retranche les `import('…')` et les `require` — la clôture que le CHARGEMENT
//      lie avant toute évaluation, celle que `scripts/node-requis.test.mjs` exige chargeable sous un
//      Node refusé ;
//   6. le LECTEUR (`specificateursDe`) lit l'arbre syntaxique : une chaîne, un gabarit, un commentaire,
//      une regex littérale ou du JSX n'est pas un import ;
//   7. la marche rend des chemins RELATIFS à `racine`, et un membre hors de `racine` lève.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasDe, arcsDe, clotureDImports, closureOf, directImportsOf, estModule, resolveImport, specificateursDe } from './importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

test('les noms à points sans extension résolvent leurs modules et propagent arcs et clôture', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-points-'))
  try {
    const entree = join(racine, 'a.ts')
    const texte = "import './props.types'; import './_registry.generated'; import './dossier.points';"
    writeFileSync(entree, texte)
    writeFileSync(join(racine, 'props.types.ts'), 'export const x = 1')
    writeFileSync(join(racine, '_registry.generated.ts'), 'export const x = 1')
    mkdirSync(join(racine, 'dossier.points'))
    writeFileSync(join(racine, 'dossier.points', 'index.ts'), "import '../suite';")
    writeFileSync(join(racine, 'suite.ts'), 'export const x = 1')
    const cibles = ['props.types.ts', '_registry.generated.ts', 'dossier.points/index.ts']
    for (const [spec, cible] of [['./props.types', cibles[0]], ['./_registry.generated', cibles[1]], ['./dossier.points', cibles[2]]])
      assert.equal(resolveImport(entree, spec), join(racine, cible).replace(/\\/g, '/'))
    assert.deepEqual(arcsDe(entree, texte).map(({ cible }) => cible), cibles.map((cible) => join(racine, cible).replace(/\\/g, '/')))
    assert.deepEqual([...clotureDImports(['a.ts'], { racine })].sort(), ['a.ts', ...cibles, 'suite.ts'].sort())
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le fichier explicite et la substitution JS→TS précèdent le repli des noms à points', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-priorite-'))
  try {
    const entree = join(racine, 'a.ts')
    for (const nom of ['style.css', 'style.css.ts', 'image.svg', 'image.svg.ts', 'x.js', 'x.ts', 'x.js.ts', 'y.ts', 'y.js.ts'])
      writeFileSync(join(racine, nom), '')
    for (const [spec, cible] of [['./style.css', 'style.css'], ['./image.svg', 'image.svg'], ['./x.js', 'x.js'], ['./y.js', 'y.ts']])
      assert.equal(resolveImport(entree, spec), join(racine, cible).replace(/\\/g, '/'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('les sites portent les positions exactes du texte fourni, propagées aux arcs', () => {
  const fichier = join(RACINE, 'src', 'entree.ts')
  const texte = "// entête\r\n  import {\r\n x } from './a';\r\nconst p = import('./b');"
  const sites = specificateursDe(fichier, texte)
  assert.deepEqual(sites.map(({ spec, ligne, texte }) => ({ spec, ligne, texte })), [
    { spec: './a', ligne: 2, texte: "import {\r\n x } from './a';" },
    { spec: './b', ligne: 4, texte: "import('./b')" },
  ])
  for (const site of sites) assert.equal(texte.slice(site.debut, site.fin), site.texte)
  assert.deepEqual(arcsDe(fichier, texte, { existe: () => true, alias: [] }),
    sites.map((site) => ({ ...site, cible: resolveImport(fichier, site.spec, () => true, []) })))
})

test('les ressources explicites se résolvent sans devenir des modules à parser', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-ressources-'))
  try {
    writeFileSync(join(racine, 'a.mjs'), "import './style.css'; import './image.svg'; import './dossier.css';")
    writeFileSync(join(racine, 'style.css'), '.x { color: red; }')
    writeFileSync(join(racine, 'image.svg'), '<svg/>')
    mkdirSync(join(racine, 'dossier.css'))
    assert.equal(resolveImport(join(racine, 'a.mjs'), './dossier.css'), null)
    assert.deepEqual([...clotureDImports(['a.mjs'], { racine })].sort(), ['a.mjs', 'image.svg', 'style.css'])
    assert.equal(estModule('style.css'), false)
    assert.equal(estModule('image.svg'), false)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un import relatif `.mjs` d’une lib de garde se résout vers son fichier (site réel)', () => {
  const depuis = join(RACINE, 'src', 'data', 'entity-orphans.test.ts')
  const resolu = resolveImport(depuis, '../../scripts/guards/lib/entityOrphanStock.mjs')
  assert.ok(resolu, 'l’import `.mjs` de `entity-orphans.test.ts` doit se résoudre, pas rendre null')
  assert.match(resolu, /scripts\/guards\/lib\/entityOrphanStock\.mjs$/)
})

test('l’extension `.mjs` se déduit aussi d’un spécificateur SANS extension', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import { x } from './b'\n")
    writeFileSync(join(racine, 'src', 'b.mjs'), 'export const x = 1\n')
    assert.match(resolveImport(join(racine, 'src', 'a.ts'), './b'), /\/src\/b\.mjs$/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un spécificateur `.mjs` sans `.mjs` sur disque désigne sa source `.mts` (substitution TypeScript)', () => {
  const racine = mkdtempSync(join(tmpdir(), 'importgraph-mts-'))
  try {
    mkdirSync(join(racine, 'src'))
    mkdirSync(join(racine, 'scripts'))
    writeFileSync(join(racine, 'src', 'a.test.ts'), "import { x } from '../scripts/lib.mjs'\n")
    writeFileSync(join(racine, 'scripts', 'lib.mts'), 'export const x = 1\n')
    writeFileSync(join(racine, 'src', 'b.ts'), "import { y } from './c.js'\n")
    writeFileSync(join(racine, 'src', 'c.ts'), 'export const y = 1\n')
    assert.match(resolveImport(join(racine, 'src', 'a.test.ts'), '../scripts/lib.mjs'), /\/scripts\/lib\.mts$/)
    assert.match(resolveImport(join(racine, 'src', 'b.ts'), './c.js'), /\/src\/c\.ts$/)
    assert.equal(resolveImport(join(racine, 'src', 'b.ts'), './absent.mjs'), null)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un `.mjs` de `src/` entre dans la closure, avec le module qui l’importe', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import { x } from './b.mjs'\n")
    writeFileSync(join(racine, 'src', 'b.mjs'), 'export const x = 1\n')
    assert.deepEqual([...closureOf([join(racine, 'src', 'a.ts')], { racine })].sort(), ['src/a.ts', 'src/b.mjs'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FRONTIÈRE : une lib hors `src/` reste hors closure, même résolue', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    mkdirSync(join(racine, 'scripts'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import { s } from '../scripts/lib.mjs'\n")
    writeFileSync(join(racine, 'scripts', 'lib.mjs'), 'export const s = 1\n')
    // Résolu par `resolveImport`…
    assert.match(resolveImport(join(racine, 'src', 'a.ts'), '../scripts/lib.mjs'), /\/scripts\/lib\.mjs$/)
    // …et pourtant absent de la closure : `closureOf` ne garde que les enfants sous `src/`.
    assert.deepEqual([...closureOf([join(racine, 'src', 'a.ts')], { racine })], ['src/a.ts'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un import À EFFET DE BORD (`import \'./x\'`, sans `from`) entre dans la marche', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), "import './b.mjs'\n")
    writeFileSync(join(racine, 'src', 'b.mjs'), 'export const x = 1\n')
    assert.deepEqual([...closureOf([join(racine, 'src', 'a.ts')], { racine })].sort(), ['src/a.ts', 'src/b.mjs'],
      'un module tiré par un import à effet de bord reste invisible de la marche — donc du mur d’ordre total (#1679 L3b)')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('MARCHE NON BORNÉE : depuis une racine de `scripts/`, `clotureDImports` atteint une lib de `scripts/guards/lib/`', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'scripts', 'docs'), { recursive: true })
    mkdirSync(join(racine, 'scripts', 'guards', 'lib'), { recursive: true })
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'scripts', 'docs', 'g.mjs'),
      "import { c } from '../guards/lib/conso.mjs'\nimport { d } from '../../src/d.ts'\n")
    writeFileSync(join(racine, 'scripts', 'guards', 'lib', 'conso.mjs'), 'export const c = 1\n')
    writeFileSync(join(racine, 'src', 'd.ts'), 'export const d = 1\n')
    assert.deepEqual([...clotureDImports([join(racine, 'scripts', 'docs', 'g.mjs')], { racine })].sort(),
      ['scripts/docs/g.mjs', 'scripts/guards/lib/conso.mjs', 'src/d.ts'],
      'la marche non bornée doit voir la lib de garde atteinte par le générateur')
    // Contre-épreuve : la MEME racine sous `closureOf` ne rend que la racine de marche et `src/`.
    assert.deepEqual([...closureOf([join(racine, 'scripts', 'docs', 'g.mjs')], { racine })].sort(), ['scripts/docs/g.mjs', 'src/d.ts'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`dynamiques: false` : ni `import(…)` ni `require` ne sont liés au chargement, la marche ne les suit pas', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'scripts'), { recursive: true })
    writeFileSync(join(racine, 'scripts', 'a.mjs'), [
      "import './porte.mjs'",
      "export { s } from './statique.mjs'",
      "const { d } = await import('./dynamique.mjs')",
      "const { r } = createRequire(import.meta.url)('./requis.mjs')",
      '',
    ].join('\n'))
    for (const f of ['porte', 'statique', 'dynamique', 'requis']) writeFileSync(join(racine, 'scripts', `${f}.mjs`), 'export const s = 1, d = 1, r = 1\n')
    const depart = [join(racine, 'scripts', 'a.mjs')]
    const marche = (options) => [...clotureDImports(depart, { racine, ...options })].sort()

    assert.deepEqual(marche({}), ['scripts/a.mjs', 'scripts/dynamique.mjs', 'scripts/porte.mjs', 'scripts/requis.mjs', 'scripts/statique.mjs'],
      'la marche PAR DÉFAUT suit l’import dynamique et le `require`')
    assert.deepEqual(marche({ dynamiques: false }), ['scripts/a.mjs', 'scripts/porte.mjs', 'scripts/statique.mjs'],
      'sans `dynamiques`, effet de bord et ré-export restent, l’import dynamique et le `require` sortent')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`typesEffaces` : un arc de TYPE PUR ne porte aucun effet de module, la marche ne le suit pas', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    // `a` n'atteint `effet` QUE par un `import type` : l'arc existe au typage, jamais à l'exécution.
    writeFileSync(join(racine, 'src', 'a.ts'), "import type { T } from './pont'\nexport const a = 1\n")
    writeFileSync(join(racine, 'src', 'pont.ts'), "import './effet'\nexport type T = number\n")
    writeFileSync(join(racine, 'src', 'effet.ts'), 'globalThis.pose = true\n')
    const depart = [join(racine, 'src', 'a.ts')]

    assert.ok(clotureDImports(depart, { racine }).has('src/effet.ts'),
      'la marche PAR DÉFAUT suit l’arc de type — c’est son régime historique')

    assert.equal(clotureDImports(depart, { racine, typesEffaces: true }).has('src/effet.ts'), false,
      'sous `typesEffaces`, un module atteint par le seul `import type` reste HORS marche')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`typesEffaces` : la marche suit ce que le BUNDLER garde — tout arc effacé à la compilation en sort, l’effet de bord et la valeur servie restent', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src', 'a.ts'), [
      'import type {',
      '  T,',
      '  U,',
      "} from './multi'",
      "import { type V, type W } from './accolades'",
      "export type { Z } from './reexport'",
      "import { S } from './typeSeul'",
      "import { type M, m } from './mixte'",
      "import './effetDeBord'",
      'let t: import(\'./positionType\').T',
      "let u: typeof import('./typeofImport')",
      'let s: S',
      "import('./dynamique').then((d) => d)",
      'export const a = m',
      '',
    ].join('\n'))
    const cibles = ['multi', 'accolades', 'reexport', 'typeSeul', 'mixte', 'effetDeBord', 'positionType', 'typeofImport', 'dynamique']
    for (const c of cibles) writeFileSync(join(racine, 'src', `${c}.ts`), 'export const m = 1\nexport const S = 1\nexport type T = number\n')
    const atteints = (regime) => cibles.filter((c) =>
      clotureDImports([join(racine, 'src', 'a.ts')], { racine, ...regime }).has(`src/${c}.ts`))

    assert.deepEqual(atteints({}), cibles, 'la marche PAR DÉFAUT suit tous les arcs, de type compris')
    assert.deepEqual(atteints({ typesEffaces: true }), ['mixte', 'effetDeBord', 'dynamique'],
      'sous `typesEffaces`, restent la valeur SERVIE d’un import mixte, l’effet de bord et l’import dynamique ; ' +
      'l’import dont la liaison ne sert qu’au typage (`typeSeul`) sort comme les autres arcs de type')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('resolveImport : un spécificateur sous l’ALIAS de tsconfig.json (`@/…`) se résout sous sa cible ; un paquet npm reste hors graphe', () => {
  const racine = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '')
  const depuis = `${racine}/src/ui/Ailleurs.tsx`
  assert.equal(resolveImport(depuis, '@/ui/RollShell'), `${racine}/src/ui/RollShell.tsx`)
  assert.equal(resolveImport(depuis, '@/ui/RollShell'), resolveImport(depuis, './RollShell'), 'alias et relatif désignent le même fichier')
  assert.equal(resolveImport(depuis, 'react'), null)
})

test('directImportsOf : l’alias se résout sous `racine` (son `tsconfig.json`), jamais sous le dépôt du module — checkout IMBRIQUÉ compris', () => {
  const externe = mkdtempSync(join(tmpdir(), 'import-graph-'))
  const imbrique = join(externe, '.wt-x')
  try {
    for (const r of [externe, imbrique]) {
      mkdirSync(join(r, 'src', 'ui'), { recursive: true })
      writeFileSync(join(r, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }))
      writeFileSync(join(r, 'src', 'ui', 'Cible.tsx'), 'export const C = 1\n')
    }
    const texte = "import { C } from '@/ui/Cible'\n"
    assert.deepEqual(directImportsOf('src/ui/X.tsx', texte, { racine: externe }), ['src/ui/Cible.tsx'])
    assert.deepEqual(directImportsOf('src/ui/X.tsx', texte, { racine: imbrique }), ['src/ui/Cible.tsx'])
    assert.deepEqual(aliasDe(null, externe), [], 'un arbre sans `tsconfig.json` n’a aucun alias')
    const [alias, ...autres] = aliasDe(JSON.stringify({ compilerOptions: { baseUrl: 'src', paths: { '~/*': ['ui/*'] } } }), externe)
    assert.deepEqual([alias.prefixe, autres], ['~/', []])
    assert.equal(resolve(alias.vers), join(externe, 'src', 'ui'), 'la cible se pose sous `racine` via `baseUrl`')
    assert.match(alias.vers, /^[^\\]*\/$/, 'graphie POSIX, barre finale')
  } finally {
    rmSync(externe, { recursive: true, force: true })
  }
})

test('specificateursDe : chaque nature d’acquisition est lue ; une chaîne, un gabarit, un commentaire, une regex littérale ou du JSX ne sont pas des imports', () => {
  const lu = (fichier, texte) => specificateursDe(fichier, texte).map(({ spec, nature }) => `${nature} ${spec}`)
  assert.deepEqual(lu('a.ts', [
    "import { x } from './statique'",
    "export * from './reexport'",
    "import './effet'",
    "import type { T } from './typeSeul'",
    "export type { U } from './typeReexport'",
    "let t: import('./positionType').T",
    "const d = await import(\n  './dynamique').then((m) => m.x)",
    "const r = require('./requis')",
    "const c = createRequire(import.meta.url)('./createRequire')",
    "const m = module.require('./moduleRequire')",
    "import e = require('./importEquals')",
    "import type te = require('./importEqualsType')",
    '',
  ].join('\n')), [
    'statique ./statique', 'statique ./reexport', 'statique ./effet', 'type ./typeSeul', 'type ./typeReexport',
    'type ./positionType', 'dynamique ./dynamique', 'require ./requis', 'require ./createRequire',
    'require ./moduleRequire', 'require ./importEquals', 'type ./importEqualsType',
  ])
  assert.deepEqual(lu('a.tsx', [
    "const chaine = \"import { x } from '../../src/chaine'\"",
    "const gabarit = `import { x } from '../../src/gabarit'`",
    "const interpole = `${a} import { x } from '../../src/interpole' ${b}`",
    "// import x from './commentaire'",
    "/* from './bloc' */",
    "const re = /from '.\\/regex'/",
    "const j = <div>{\"from './jsx'\"}</div>",
    'const variable = await import(chemin)',
    "const autreNom = req('./req')",
    '',
  ].join('\n')), [])
})

test('A4 : un membre HORS de `racine` lève en nommant importeur et spécificateur ; une chaîne de fixture n’en est pas un (worktree imbriqué)', () => {
  const externe = mkdtempSync(join(tmpdir(), 'import-graph-'))
  const racine = join(externe, '.wt-x')
  try {
    mkdirSync(join(externe, 'src'), { recursive: true })
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(externe, 'src', 'dehors.ts'), 'export const x = 1\n')
    writeFileSync(join(racine, 'src', 'fuite.ts'), "import { x } from '../../src/dehors'\n")
    writeFileSync(join(racine, 'src', 'fixture.ts'), "export const f = \"import { x } from '../../src/dehors'\"\n")
    assert.throws(() => clotureDImports([join(racine, 'src', 'fuite.ts')], { racine }),
      /src\/fuite\.ts importe « \.\.\/\.\.\/src\/dehors », hors de la racine/)
    assert.throws(() => clotureDImports([join(externe, 'src', 'dehors.ts')], { racine }), /racine de marche .* hors de la racine/)
    assert.deepEqual([...clotureDImports([join(racine, 'src', 'fixture.ts')], { racine })], ['src/fixture.ts'])
  } finally {
    rmSync(externe, { recursive: true, force: true })
  }
})

test('specificateursDe : un texte qui ne se parse pas LÈVE, en nommant le fichier et la première erreur — jamais une lecture partielle', () => {
  // `<T>y` en `.mjs` ouvre un élément JSX jamais fermé : l'import qui suit était avalé en silence.
  assert.throws(() => specificateursDe('scripts/a.mjs', "import { a } from './avant'\nconst x = <T>y\nimport { b } from './apres'\n"),
    /specificateursDe : scripts\/a\.mjs ne se parse pas, ligne \d+ : /)
})

test('cache de marche : partagé entre le défaut et `dynamiques: false`, il rend les deux clôtures justes ; sous un autre régime, il LÈVE', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-graph-'))
  const autre = mkdtempSync(join(tmpdir(), 'import-graph-'))
  try {
    mkdirSync(join(racine, 'scripts'), { recursive: true })
    writeFileSync(join(racine, 'scripts', 'a.mjs'), "import './statique.mjs'\nconst d = await import('./dynamique.mjs')\n")
    for (const f of ['statique', 'dynamique']) writeFileSync(join(racine, 'scripts', `${f}.mjs`), 'export const x = 1\n')
    const depart = [join(racine, 'scripts', 'a.mjs')]
    const defaut = ['scripts/a.mjs', 'scripts/dynamique.mjs', 'scripts/statique.mjs']
    const statique = ['scripts/a.mjs', 'scripts/statique.mjs']
    for (const ordre of [[false, true], [true, false]]) {
      const cache = new Map()
      for (const dynamiques of ordre)
        assert.deepEqual([...clotureDImports(depart, { racine, cache, dynamiques })].sort(), dynamiques ? defaut : statique,
          `cache partagé, marche ${dynamiques ? 'par défaut' : 'statique'} après l’autre régime de \`dynamiques\``)
    }
    const cache = new Map()
    clotureDImports(depart, { racine, cache })
    assert.throws(() => clotureDImports(depart, { racine, cache, typesEffaces: true }), /cache rempli sous le régime « typage, racine .* réutilisé sous « typesEffaces, racine /)
    assert.throws(() => clotureDImports([], { racine: autre, cache }), /cache rempli sous le régime .* réutilisé sous/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(autre, { recursive: true, force: true })
  }
})
