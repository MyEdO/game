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
//   7. la marche rend des chemins RELATIFS à `racine`, et un membre hors de `racine` lève ;
//   8. un ENSEMBLE de fichiers (`arbre`) remplace le disque : résolution, lecture, motifs d'`import.meta.glob` ;
//      les spécificateurs non résolus se mémoïsent (`specificateurs`), et le graphe INVERSE se lit sur le cache.
import { test, mock } from 'node:test'
import { API } from 'typescript/unstable/sync'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasDe, arcsDe, chargementsDe, clotureDImports, closureOf, directImportsOf, estModule, globsDe, grapheInverse, liaisonsDe, resolveImport, sitesDeModule, specificateursDe, sourceALExecution } from './importGraph.mjs'
import { ast, analyserTexte, analyserCorpus } from './dialecte.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

test('un AST fourni sans diagnostics conserve ses nœuds sans ouvrir de session', () => {
  const rel = 'reutilise.ts'
  const { sourceFile } = analyserTexte({ rel, text: "import { valeur as locale } from './cible';" })
  const close = API.prototype.close
  const update = API.prototype.updateSnapshot
  const fermeture = mock.method(API.prototype, 'close', function () { return close.call(this) })
  const snapshot = mock.method(API.prototype, 'updateSnapshot', function (...args) { return update.apply(this, args) })
  try {
    for (const diagnostics of [undefined, []]) {
      const [site] = sitesDeModule(rel, sourceFile, diagnostics)
      assert.equal(site.noeud, sourceFile.statements[0])
      assert.equal(site.spec, './cible')
      const [liaison] = liaisonsDe(rel, sourceFile, diagnostics)
      assert.equal(liaison.local.position.noeud, sourceFile.statements[0].importClause.namedBindings.elements[0].name)
      assert.equal(liaison.local.nom, 'locale')
      assert.equal(liaison.importe.nom, 'valeur')
      assert.equal(chargementsDe(rel, sourceFile, diagnostics)[0].noeud, sourceFile.statements[0])
      assert.equal(specificateursDe(rel, sourceFile, diagnostics)[0].spec, './cible')
    }
    assert.equal(snapshot.mock.callCount(), 0)
    assert.equal(fermeture.mock.callCount(), 0)
  } finally { snapshot.mock.restore(); fermeture.mock.restore() }
})

test('les diagnostics explicites refusent un AST malformé sans ouvrir de session', () => {
  const rel = 'malforme.ts'
  const { sourceFile, diagnostics } = analyserTexte({ rel, text: "import './cible';\nconst valeur = ;" })
  assert.ok(diagnostics.length > 0)
  const close = API.prototype.close
  const update = API.prototype.updateSnapshot
  const fermeture = mock.method(API.prototype, 'close', function () { return close.call(this) })
  const snapshot = mock.method(API.prototype, 'updateSnapshot', function (...args) { return update.apply(this, args) })
  try {
    for (const lire of [sitesDeModule, liaisonsDe, chargementsDe, specificateursDe]) {
      assert.throws(() => lire(rel, sourceFile, diagnostics), /sitesDeModule : malforme\.ts ne se parse pas, ligne 2/)
    }
    assert.equal(sitesDeModule(rel, sourceFile)[0].spec, './cible')
    assert.equal(snapshot.mock.callCount(), 0)
    assert.equal(fermeture.mock.callCount(), 0)
  } finally { snapshot.mock.restore(); fermeture.mock.restore() }
})

test('directImportsOf : AST et diagnostics préparés gardent les arcs sans session supplémentaire', () => {
  const racine = mkdtempSync(join(tmpdir(), 'imports-prepares-'))
  const close = API.prototype.close
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this) })
  try {
    const rel = 'src/ui/A.tsx'
    const text = "import {\n  X,\n} from '@/ui/Cible';\nimport './Cible';\nconst faux = './Faux';\n"
    const options = { racine, existe: (abs) => abs === resolve(racine, 'src/ui/Cible.tsx').replaceAll('\\', '/'), alias: [{ prefixe: '@/', vers: `${racine.replaceAll('\\', '/')}/src/` }] }
    assert.deepEqual(directImportsOf(rel, text, options), ['src/ui/Cible.tsx'])
    const avant = spy.mock.callCount()
    for (const { sourceFile, diagnostics } of analyserCorpus([{ rel, text }])) {
      assert.deepEqual(directImportsOf(rel, sourceFile, { ...options, diagnostics }), ['src/ui/Cible.tsx'])
      assert.equal(spy.mock.callCount(), avant)
    }
    assert.equal(spy.mock.callCount(), avant + 1)
    for (const { sourceFile, diagnostics } of analyserCorpus([{ rel, text: 'const x = ;' }])) {
      assert.ok(diagnostics.length > 0)
      const avantErreur = spy.mock.callCount()
      assert.throws(() => directImportsOf(rel, sourceFile, { ...options, diagnostics }), /ne se parse pas/)
      assert.equal(spy.mock.callCount(), avantErreur)
    }
    assert.equal(spy.mock.callCount(), avant + 2)
  } finally { spy.mock.restore(); rmSync(racine, { recursive: true, force: true }) }
})

test('effacement bundler : TSX/mts/cts, config héritée et erreurs refusées', () => {
  for (const verbatimModuleSyntax of [false, true]) {
    const racine = mkdtempSync(join(tmpdir(), 'imports-emission-'))
    try {
      writeFileSync(join(racine, 'base.json'), JSON.stringify({ compilerOptions: { verbatimModuleSyntax, jsx: 'preserve' } }))
      writeFileSync(join(racine, 'tsconfig.json'), JSON.stringify({ extends: './base.json' }))
      const code = "import { Shape } from './shape'; import { type X, value } from './mixed'; import './effect'; const shape: Shape = {}; export const out = value; import('./dynamic');"
      for (const ext of ['tsx', 'mts', 'cts']) {
        const emission = sourceALExecution(`a.${ext}`, code + (ext === 'tsx' ? ' export const vue = <div/>;' : ''), { racine })
        const specs = specificateursDe('emission.js', emission).map(site => site.spec)
        assert.deepEqual(specs, [...(verbatimModuleSyntax ? ['./shape'] : []), './mixed', './effect', './dynamic'])
        assert.equal(/\btype X\b/.test(emission), false)
      }
      assert.throws(() => sourceALExecution('invalide.ts', 'const x = ;', { racine }), /sourceALExecution : invalide.ts/)
    } finally { rmSync(racine, { recursive: true, force: true }) }
  }
})

test('frontières : une session par niveau manquant, cycles et cache partagé sans reparse', () => {
  const racine = mkdtempSync(join(tmpdir(), 'imports-batch-'))
  const close = API.prototype.close
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this) })
  try {
    for (const [nom, texte] of Object.entries({
      'a.ts': "import './b'; import './c';",
      'b.ts': "import './d';",
      'c.ts': "import './d';",
      'd.ts': "import './a';",
    })) writeFileSync(join(racine, nom), texte)
    const cache = new Map()
    const marche = () => clotureDImports(['a.ts', 'a.ts', 'absent.ts'], { racine, cache })
    assert.deepEqual([...marche()].sort(), ['a.ts', 'b.ts', 'c.ts', 'd.ts'])
    assert.equal(spy.mock.callCount(), 3)
    assert.equal(cache.get(resolve(racine, 'absent.ts').replaceAll('\\', '/')), null)
    assert.deepEqual([...marche()].sort(), ['a.ts', 'b.ts', 'c.ts', 'd.ts'])
    assert.equal(spy.mock.callCount(), 3)
  } finally { spy.mock.restore(); rmSync(racine, { recursive: true, force: true }) }
})

const nomsDeLiaison = ({ forme, typeSeul, local, importe, exporte }) => ({
  forme, typeSeul, local: local?.nom ?? null, importe: importe?.nom ?? null, exporte: exporte?.nom ?? null,
})

test('L3 imports : défaut, noms aliasés, types effectifs individuels et namespace', () => {
  const texte = [
    'import Defaut, {',
    '  a as localA,',
    '  type T as LocalT,',
    '  b,',
    "} from './mixte';",
    "import type DefType from './type';",
    "import * as Ns from './espace';",
    "import type * as Types from './types';",
  ].join('\n')
  const sites = sitesDeModule('a.ts', texte)
  assert.deepEqual(sites.map(({ genre, nature, acquisition, spec, clause, niveauModule }) =>
    ({ genre, nature, acquisition, spec, clause, niveauModule })), [
    { genre: 'import', nature: 'statique', acquisition: true, spec: './mixte', clause: true, niveauModule: true },
    { genre: 'import', nature: 'type', acquisition: true, spec: './type', clause: true, niveauModule: true },
    { genre: 'import', nature: 'statique', acquisition: true, spec: './espace', clause: true, niveauModule: true },
    { genre: 'import', nature: 'type', acquisition: true, spec: './types', clause: true, niveauModule: true },
  ])
  assert.deepEqual(liaisonsDe('a.ts', texte).map(nomsDeLiaison), [
    { forme: 'defaut', typeSeul: false, local: 'Defaut', importe: 'default', exporte: null },
    { forme: 'nommee', typeSeul: false, local: 'localA', importe: 'a', exporte: null },
    { forme: 'nommee', typeSeul: true, local: 'LocalT', importe: 'T', exporte: null },
    { forme: 'nommee', typeSeul: false, local: 'b', importe: 'b', exporte: null },
    { forme: 'defaut', typeSeul: true, local: 'DefType', importe: 'default', exporte: null },
    { forme: 'espace', typeSeul: false, local: 'Ns', importe: '*', exporte: null },
    { forme: 'espace', typeSeul: true, local: 'Types', importe: '*', exporte: null },
  ])
  const [defaut, nommee, type] = liaisonsDe('a.ts', texte)
  assert.equal(defaut.importe.position, null)
  for (const [role, token, ligne] of [[defaut.local, 'Defaut', 1], [nommee.importe, 'a', 2], [nommee.local, 'localA', 2], [type.importe, 'T', 3], [type.local, 'LocalT', 3]]) {
    assert.equal(texte.slice(role.position.debut, role.position.fin), token)
    assert.equal(role.position.ligne, ligne)
    assert.equal(role.position.noeud.getText(), token)
  }
  assert.equal(type.spec, './mixte')
  assert.equal(type.nature, 'statique')
  assert.equal(type.genre, 'import')
  assert.equal(type.clause, true)
  assert.equal(type.niveauModule, true)
  assert.equal(type.texte, sites[0].texte)
})

test('L3 exports : rôles de réexport, étoile, namespace et export local sans acquisition', () => {
  const texte = [
    "export { a as renomme, type T, default as choisi } from './m';",
    "export type { U as V } from './types';",
    "export * from './etoile';",
    "export * as Ns from './ns';",
    'export { local as publie, type LocalT };',
  ].join('\n')
  const sites = sitesDeModule('a.ts', texte)
  assert.deepEqual(sites.map(({ acquisition, spec, clause }) => ({ acquisition, spec, clause })), [
    { acquisition: true, spec: './m', clause: true },
    { acquisition: true, spec: './types', clause: true },
    { acquisition: true, spec: './etoile', clause: false },
    { acquisition: true, spec: './ns', clause: true },
    { acquisition: false, spec: null, clause: true },
  ])
  const liaisons = liaisonsDe('a.ts', texte)
  assert.deepEqual(liaisons.map(nomsDeLiaison), [
    { forme: 'nommee', typeSeul: false, local: null, importe: 'a', exporte: 'renomme' },
    { forme: 'nommee', typeSeul: true, local: null, importe: 'T', exporte: 'T' },
    { forme: 'nommee', typeSeul: false, local: null, importe: 'default', exporte: 'choisi' },
    { forme: 'nommee', typeSeul: true, local: null, importe: 'U', exporte: 'V' },
    { forme: 'etoile', typeSeul: false, local: null, importe: '*', exporte: '*' },
    { forme: 'espace', typeSeul: false, local: null, importe: '*', exporte: 'Ns' },
    { forme: 'nommee', typeSeul: false, local: 'local', importe: null, exporte: 'publie' },
    { forme: 'nommee', typeSeul: true, local: 'LocalT', importe: null, exporte: 'LocalT' },
  ])
  for (const liaison of liaisons) for (const role of [liaison.local, liaison.importe, liaison.exporte].filter(Boolean)) {
    assert.ok(role.position)
    assert.equal(texte.slice(role.position.debut, role.position.fin), role.nom)
  }
  assert.deepEqual(specificateursDe('a.ts', texte).map(({ spec }) => spec), ['./m', './types', './etoile', './ns'])
  assert.equal(chargementsDe('a.ts', texte).length, 4)
})

test('L3 import nu et clause vide : même acquisition, clauses distinctes sans liaison', () => {
  const sites = sitesDeModule('a.ts', "import './nu'; import {} from './vide'; export {};")
  assert.deepEqual(sites.map(({ acquisition, spec, clause, liaisons }) => ({ acquisition, spec, clause, liaisons })), [
    { acquisition: true, spec: './nu', clause: false, liaisons: [] },
    { acquisition: true, spec: './vide', clause: true, liaisons: [] },
    { acquisition: false, spec: null, clause: true, liaisons: [] },
  ])
})

test('L3 equals : référence interne distincte des acquisitions externes littérales ou calculées', () => {
  const texte = [
    'import Interne = Namespace.member;',
    "import Externe = require('./externe');",
    "import type TypeExterne = require('./type');",
    'import Calcule = require(chemin);',
  ].join('\n')
  const sites = sitesDeModule('a.ts', texte)
  assert.deepEqual(sites.map(({ genre, nature, acquisition, spec, clause }) => ({ genre, nature, acquisition, spec, clause })), [
    { genre: 'importEquals', nature: 'statique', acquisition: false, spec: null, clause: true },
    { genre: 'importEquals', nature: 'require', acquisition: true, spec: './externe', clause: true },
    { genre: 'importEquals', nature: 'type', acquisition: true, spec: './type', clause: true },
    { genre: 'importEquals', nature: 'require', acquisition: true, spec: null, clause: true },
  ])
  const liaisons = liaisonsDe('a.ts', texte)
  assert.deepEqual(liaisons.map(nomsDeLiaison), [
    { forme: 'equals', typeSeul: false, local: 'Interne', importe: 'Namespace.member', exporte: null },
    { forme: 'equals', typeSeul: false, local: 'Externe', importe: '*', exporte: null },
    { forme: 'equals', typeSeul: true, local: 'TypeExterne', importe: '*', exporte: null },
    { forme: 'equals', typeSeul: false, local: 'Calcule', importe: '*', exporte: null },
  ])
  assert.equal(texte.slice(liaisons[0].importe.position.debut, liaisons[0].importe.position.fin), 'Namespace.member')
  for (const liaison of liaisons.slice(1)) assert.equal(liaison.importe.position, null)
  assert.deepEqual(chargementsDe('a.ts', texte).map(({ spec }) => spec), ['./externe', './type', null])
  assert.deepEqual(specificateursDe('a.ts', texte).map(({ spec }) => spec), ['./externe', './type'])
})

test('L3 equals exporté : rôle exporté sur le nom local réel, sans modifier origine ni acquisition', () => {
  const texte = [
    'export import AliasInterne = Namespace.member;',
    "export import AliasExterne = require('./x');",
    "export import type AliasType = require('./types');",
    'import Interne = Namespace.member;',
    "import Externe = require('./x');",
    "import type TypeExterne = require('./types');",
  ].join('\n')
  const sf = ast({ rel: 'a.ts', text: texte })
  assert.equal(analyserTexte({ rel: 'a.ts', text: texte }).diagnostics.length, 0)
  const sites = sitesDeModule('a.ts', sf)
  const liaisons = liaisonsDe('a.ts', sf)
  assert.deepEqual(liaisons.map(nomsDeLiaison), [
    { forme: 'equals', typeSeul: false, local: 'AliasInterne', importe: 'Namespace.member', exporte: 'AliasInterne' },
    { forme: 'equals', typeSeul: false, local: 'AliasExterne', importe: '*', exporte: 'AliasExterne' },
    { forme: 'equals', typeSeul: true, local: 'AliasType', importe: '*', exporte: 'AliasType' },
    { forme: 'equals', typeSeul: false, local: 'Interne', importe: 'Namespace.member', exporte: null },
    { forme: 'equals', typeSeul: false, local: 'Externe', importe: '*', exporte: null },
    { forme: 'equals', typeSeul: true, local: 'TypeExterne', importe: '*', exporte: null },
  ])
  assert.deepEqual(sites.map(({ genre, nature, acquisition, spec, clause }) => ({ genre, nature, acquisition, spec, clause })), [
    { genre: 'importEquals', nature: 'statique', acquisition: false, spec: null, clause: true },
    { genre: 'importEquals', nature: 'require', acquisition: true, spec: './x', clause: true },
    { genre: 'importEquals', nature: 'type', acquisition: true, spec: './types', clause: true },
    { genre: 'importEquals', nature: 'statique', acquisition: false, spec: null, clause: true },
    { genre: 'importEquals', nature: 'require', acquisition: true, spec: './x', clause: true },
    { genre: 'importEquals', nature: 'type', acquisition: true, spec: './types', clause: true },
  ])
  for (const [i, liaison] of liaisons.slice(0, 3).entries()) {
    assert.deepEqual(liaison.exporte.position, liaison.local.position)
    assert.equal(liaison.exporte.position.noeud, sf.statements[i].name)
    assert.equal(liaison.exporte.position.ligne, i + 1)
    assert.equal(texte.slice(liaison.exporte.position.debut, liaison.exporte.position.fin), liaison.exporte.nom)
  }
  assert.equal(liaisons[0].importe.position.noeud, sf.statements[0].moduleReference)
  assert.equal(liaisons[1].importe.position, null)
  assert.equal(liaisons[2].importe.position, null)
})

test('L3 chargements : expressions non littérales, import de type et fournisseur createRequire nu ou imbriqué', () => {
  const texte = [
    "const a = import('./dynamique');",
    'const b = import(chemin);',
    "const c = require('./requis');",
    'const d = require(chemin);',
    'const e = module.require(chemin);',
    "const f = createRequire('./base')('./cible');",
    'export const fourni = createRequire;',
    "let t: import('./type').T;",
  ].join('\n')
  const charges = chargementsDe('a.ts', texte)
  assert.deepEqual(charges.map(({ genre, nature, acquisition, spec }) => ({ genre, nature, acquisition, spec })), [
    { genre: 'appel', nature: 'dynamique', acquisition: true, spec: './dynamique' },
    { genre: 'appel', nature: 'dynamique', acquisition: true, spec: null },
    { genre: 'appel', nature: 'require', acquisition: true, spec: './requis' },
    { genre: 'appel', nature: 'require', acquisition: true, spec: null },
    { genre: 'appel', nature: 'require', acquisition: true, spec: null },
    { genre: 'appel', nature: 'require', acquisition: true, spec: './cible' },
    { genre: 'fournisseur', nature: 'require', acquisition: false, spec: null },
    { genre: 'fournisseur', nature: 'require', acquisition: false, spec: null },
    { genre: 'importType', nature: 'type', acquisition: true, spec: './type' },
  ])
  assert.deepEqual(charges.filter(({ genre }) => genre === 'fournisseur').map(({ texte }) => texte), ['createRequire', 'createRequire'])
  assert.deepEqual(specificateursDe('a.ts', texte).map(({ spec }) => spec), ['./dynamique', './requis', './cible', './type'])
  assert.equal(liaisonsDe('a.ts', texte).length, 0)
  assert.ok(charges.every(({ niveauModule }) => niveauModule === false))
})

test('L3 AST réutilisé sans parents : identité, positions de tokens et niveau module', () => {
  const texte = "import { a as b } from './m';\nnamespace N { import X = Lib.x; export { X }; }"
  const sf = ast({ rel: 'a.ts', text: texte })
  const deparenter = (n) => { n.parent = undefined; n.forEachChild(deparenter) }
  deparenter(sf)
  const sites = sitesDeModule('a.ts', sf)
  assert.deepEqual(sites.map(({ genre, niveauModule }) => ({ genre, niveauModule })), [
    { genre: 'import', niveauModule: true },
    { genre: 'importEquals', niveauModule: false },
    { genre: 'export', niveauModule: false },
  ])
  assert.equal(sites[0].noeud, sf.statements[0])
  assert.equal(Object.isFrozen(sf), false)
  assert.equal(Object.isFrozen(sites[0].noeud), false)
  assert.equal(sites[0].liaisons[0].local.position.noeud, sf.statements[0].importClause.namedBindings.elements[0].name)
  assert.equal(sites[0].noeud.parent, undefined)
  assert.equal(sites[0].liaisons[0].local.position.noeud.parent, undefined)
  assert.equal(sites[0].texte, texte.slice(sites[0].debut, sites[0].fin))
  assert.deepEqual(liaisonsDe('a.ts', sf).map(nomsDeLiaison), liaisonsDe('a.ts', texte).map(nomsDeLiaison))
  assert.deepEqual(specificateursDe('a.ts', sf), specificateursDe('a.ts', texte))
  assert.equal(chargementsDe('a.ts', sf)[0].noeud, sf.statements[0])
})

test('L3 fournisseur : toute occurrence identifiant, sans confondre une chaîne', () => {
  const texte = "import { createRequire as creer } from 'node:module'; const createRequire = 1; const x = obj.createRequire; const s = 'createRequire';"
  const fournisseurs = chargementsDe('a.ts', texte).filter(({ genre }) => genre === 'fournisseur')
  assert.equal(fournisseurs.length, 3)
  assert.ok(fournisseurs.every(({ acquisition, spec, nature, texte }) => !acquisition && spec === null && nature === 'require' && texte === 'createRequire'))
})

test('L3 noms littéraux : noms sémantiques et positions des tokens cités', () => {
  const texte = "import { 'a-b' as local } from './m'; export { local as 'c-d' };"
  const [importe, exporte] = liaisonsDe('a.ts', texte)
  assert.equal(importe.importe.nom, 'a-b')
  assert.equal(texte.slice(importe.importe.position.debut, importe.importe.position.fin), "'a-b'")
  assert.equal(exporte.exporte.nom, 'c-d')
  assert.equal(texte.slice(exporte.exporte.position.debut, exporte.exporte.position.fin), "'c-d'")
  assert.equal(exporte.local.nom, 'local')
  assert.equal(exporte.importe, null)
  assert.equal(Object.hasOwn(importe, 'liaisons'), false)
})

test('L3 positions : CRLF, CR, U+2028 et U+2029, alias multiligne et texte exact', () => {
  const texte = "// entête\r\nimport {\r a as\u2028 b\u2029 } from './m';"
  const [site] = sitesDeModule('a.ts', texte)
  assert.equal(site.debut, 11)
  assert.equal(site.fin, texte.length)
  assert.equal(site.ligne, 2)
  assert.equal(site.texte, texte.slice(11))
  const [{ local, importe }] = site.liaisons
  assert.deepEqual([importe.position.ligne, local.position.ligne], [3, 4])
  assert.equal(texte.slice(importe.position.debut, importe.position.fin), 'a')
  assert.equal(texte.slice(local.position.debut, local.position.fin), 'b')
})

test('L3 projections : compatibilité stricte des spécificateurs/arcs et arbre virtuel sans disque', () => {
  const entree = join(RACINE, 'virtuel', 'a.ts')
  const texte = "import { x } from './x.mjs';"
  const spec = specificateursDe(entree, texte)
  assert.deepEqual(Object.keys(spec[0]).sort(), ['debut', 'fin', 'ligne', 'nature', 'spec', 'texte'])
  const explicite = join(RACINE, 'virtuel', 'x.mjs').replace(/\\/g, '/')
  const source = join(RACINE, 'virtuel', 'x.mts').replace(/\\/g, '/')
  const existe = (abs) => [explicite, source].includes(abs)
  assert.deepEqual(arcsDe(entree, texte, { existe, alias: [] }), [{ ...spec[0], cible: explicite }])
  assert.equal(resolveImport(entree, './x.mjs', (abs) => abs === source, []), source)
  const aucun = arcsDe(join(RACINE, 'src', 'audio', 'music.ts'), "import './types';", { existe: () => false, alias: [] })
  assert.deepEqual(aucun, [])
})

test('L3 cohérence .cts : une source substituée de .cjs reste un module à parcourir', () => {
  const entree = join(RACINE, 'virtuel', 'a.ts')
  const cible = join(RACINE, 'virtuel', 'c.cts').replace(/\\/g, '/')
  const resolu = resolveImport(entree, './c.cjs', (abs) => abs === cible, [])
  assert.equal(resolu, cible)
  assert.equal(estModule(resolu), true)
  const racine = mkdtempSync(join(tmpdir(), 'import-cts-'))
  try {
    writeFileSync(join(racine, 'a.ts'), "import './c.cjs';")
    writeFileSync(join(racine, 'c.cts'), "import './runtime'; import type { T } from './type';")
    writeFileSync(join(racine, 'runtime.ts'), 'export const x = 1;')
    writeFileSync(join(racine, 'type.ts'), 'export type T = number;')
    assert.deepEqual([...clotureDImports(['a.ts'], { racine })].sort(), ['a.ts', 'c.cts', 'runtime.ts', 'type.ts'])
    assert.deepEqual([...clotureDImports(['a.ts'], { racine, typesEffaces: true })].sort(), ['a.ts', 'c.cts', 'runtime.ts'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('L3 négatifs : chaînes, commentaires, regex, JSX et acquisitions non reconnues', () => {
  const texte = [
    "const a = \"import { createRequire } from './chaine'\";",
    "const b = `require('./gabarit')`;",
    "// export { createRequire } from './commentaire';",
    "/* import('./bloc'); */",
    "const r = /createRequire\\('regex'\\)/;",
    "const j = <div title=\"createRequire\">require('./jsx')</div>;",
    "const x = req('./autre');",
  ].join('\n')
  assert.deepEqual(sitesDeModule('a.tsx', texte), [])
  assert.deepEqual(liaisonsDe('a.tsx', texte), [])
  assert.deepEqual(chargementsDe('a.tsx', texte), [])
  assert.throws(() => sitesDeModule('a.mjs', "const x = <T>y; import './apres';"), /ne se parse pas, ligne/)
})

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
    /sitesDeModule : scripts\/a\.mjs ne se parse pas, ligne \d+ : /)
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

/** Un ensemble de fichiers en mémoire, sous une racine qui n'existe pas sur le disque. */
function ensembleEnMemoire(textes) {
  const racine = resolve(tmpdir(), 'import-graph-ensemble-absent').split('\\').join('/')
  const abs = (rel) => `${racine}/${rel}`
  const parAbs = new Map(Object.entries(textes).map(([rel, texte]) => [abs(rel), texte]))
  return {
    racine,
    abs,
    arbre: { existe: (a) => parAbs.has(a), lire: (abss) => new Map(abss.map((a) => [a, parAbs.get(a) ?? null])), fichiers: [...parAbs.keys()] },
  }
}

test('résolution ESM : query et fragment suivent la source physique, alias et replis compris', () => {
  const { abs, arbre } = ensembleEnMemoire({
    'a.mjs': '', 'cible.mjs': '', 'cible#nom.mjs': '', 'cible%nom.mjs': '',
    'lib/remplace.mts': '', 'lib/remplace-js.ts': '', 'lib/dossier/index.mjs': '',
  })
  const alias = [{ prefixe: '@/', vers: abs('lib') + '/' }]
  for (const [spec, cible] of [
    ['./cible.mjs?hote#instance', 'cible.mjs'], ['./cible%23nom.mjs?hote#instance', 'cible#nom.mjs'],
    ['./cible%25nom.mjs#instance', 'cible%nom.mjs'], ['@/remplace.mjs?hote#instance', 'lib/remplace.mts'],
    ['@/remplace-js.js?hote#instance', 'lib/remplace-js.ts'], ['@/dossier?hote#instance', 'lib/dossier/index.mjs'],
  ]) assert.equal(resolveImport(abs('a.mjs'), spec, arbre.existe, alias), abs(cible), spec)
  assert.equal(resolveImport(abs('a.mjs'), 'paquet?hote#instance', arbre.existe, alias), null)
})

test('résolution require : les noms # et % restent littéraux dans les arcs et la clôture', () => {
  const texte = "const a = require('./literal#nom.cjs'); const b = require('./literal%23nom.cjs');"
  const { racine, abs, arbre } = ensembleEnMemoire({
    'a.cjs': texte, 'literal#nom.cjs': 'module.exports = 1', 'literal%23nom.cjs': 'module.exports = 2',
  })
  const arcs = arcsDe(abs('a.cjs'), texte, { existe: arbre.existe, alias: [] })
  assert.deepEqual(arcs.map(({ spec, nature, cible }) => [spec, nature, cible]), [
    ['./literal#nom.cjs', 'require', abs('literal#nom.cjs')], ['./literal%23nom.cjs', 'require', abs('literal%23nom.cjs')],
  ])
  assert.deepEqual([...clotureDImports([abs('a.cjs')], { racine, arbre })].sort(), ['a.cjs', 'literal#nom.cjs', 'literal%23nom.cjs'])
})

test('les alias gardent la substitution de préfixe fichier et le slash initial du suffixe', () => {
  const { abs, arbre } = ensembleEnMemoire({ 'a.mjs': '', 'lib/prefix-cible.mts': '', 'lib/dossier/cible.mjs': '' })
  const alias = [{ prefixe: '@f/', vers: abs('lib/prefix-') }, { prefixe: '@d/', vers: abs('lib/dossier') }]
  assert.equal(resolveImport(abs('a.mjs'), '@f/cible.mjs?hote#instance', arbre.existe, alias), abs('lib/prefix-cible.mts'))
  assert.equal(resolveImport(abs('a.mjs'), '@d//cible.mjs?hote#instance', arbre.existe, alias), abs('lib/dossier/cible.mjs'))
})

test('la résolution ESM utilise NodeURL même si URL globale est remplacée', () => {
  const { abs, arbre } = ensembleEnMemoire({ 'a.mjs': '', 'cible.mjs': '' })
  const avant = globalThis.URL
  try {
    globalThis.URL = class { constructor() { throw new Error('URL globale de navigateur') } }
    assert.equal(resolveImport(abs('a.mjs'), './cible.mjs?hote#instance', arbre.existe, []), abs('cible.mjs'))
  } finally { globalThis.URL = avant }
})

test('une clôture ESM à query et fragment se copie en fichiers physiques et reste chargeable', () => {
  const racine = mkdtempSync(join(tmpdir(), 'import-query-'))
  const copie = mkdtempSync(join(tmpdir(), 'import-query-copie-'))
  try {
    const texte = "import { x as a } from './cible%23nom.mjs?hote#instance'; import { x as b } from './cible%23nom.mjs?autre#instance'; console.log(a + b);"
    writeFileSync(join(racine, 'a.mjs'), texte)
    writeFileSync(join(racine, 'cible#nom.mjs'), 'export const x = 21')
    const arcs = arcsDe(join(racine, 'a.mjs'), texte, { alias: [] })
    assert.deepEqual(arcs.map(({ spec }) => spec), ['./cible%23nom.mjs?hote#instance', './cible%23nom.mjs?autre#instance'])
    const cloture = [...clotureDImports(['a.mjs'], { racine, dynamiques: false })].sort()
    assert.deepEqual(cloture, ['a.mjs', 'cible#nom.mjs'])
    for (const rel of cloture) copyFileSync(join(racine, rel), join(copie, rel))
    assert.equal(readFileSync(join(copie, 'a.mjs'), 'utf8'), texte)
    const vu = spawnSync(process.execPath, ['a.mjs'], { cwd: copie, encoding: 'utf8' })
    assert.equal(vu.status, 0, vu.stderr)
    assert.equal(vu.stdout.trim(), '42')
  } finally { rmSync(racine, { recursive: true, force: true }); rmSync(copie, { recursive: true, force: true }) }
})

test('arbre injecté : la marche résout et lit contre l’ENSEMBLE, jamais le disque ; un membre sans texte (supprimé) garde ses importeurs', () => {
  const { racine, abs, arbre } = ensembleEnMemoire({ 'a.mjs': "import './b.mjs'\nimport './parti.mjs'\n", 'b.mjs': 'export const b = 1\n', 'parti.mjs': null })
  const cache = new Map()
  assert.deepEqual([...clotureDImports([abs('a.mjs')], { racine, cache, arbre })].sort(), ['a.mjs', 'b.mjs', 'parti.mjs'])
  assert.deepEqual(cache.get(abs('parti.mjs')), [])
  assert.deepEqual(grapheInverse(cache).get(abs('parti.mjs')).map((arc) => [arc.importeur, arc.spec]), [[abs('a.mjs'), './parti.mjs']])
  assert.throws(() => clotureDImports([abs('a.mjs')], { racine, cache }), /cache rempli contre un autre ensemble de fichiers/)
})

test('import.meta.glob : un arc `glob` par membre visé de l’ensemble, `!` exclu ; sans `fichiers`, aucun', () => {
  const textes = {
    'src/f.ts': "const x = import.meta.glob(['./jeux/*.json', '!./jeux/b.json'])\nconst y = import.meta.glob('/src/parts/*/{index,_registry.generated}.ts')\n",
    'src/jeux/a.json': '{}', 'src/jeux/b.json': '{}', 'src/parts/p/index.ts': '', 'src/parts/p/_registry.generated.ts': '', 'src/parts/p/autre.ts': '',
  }
  const { racine, abs, arbre } = ensembleEnMemoire(textes)
  assert.deepEqual([...clotureDImports([abs('src/f.ts')], { racine, arbre })].sort(),
    ['src/f.ts', 'src/jeux/a.json', 'src/parts/p/_registry.generated.ts', 'src/parts/p/index.ts'])
  const { fichiers: _fichiers, ...sansFichiers } = arbre
  assert.deepEqual([...clotureDImports([abs('src/f.ts')], { racine, arbre: sansFichiers })], ['src/f.ts'])
})

test('globsDe : motifs littéraux seuls, chaîne ou tableau ; un motif calculé ne rend rien', () => {
  const { sourceFile } = analyserTexte({ rel: 'g.ts', text: "import.meta.glob('./a/*.ts')\nimport.meta.glob(['./b/*', '!./b/c'])\nimport.meta.glob(motif)\nobjet.glob('./d/*')\n" })
  assert.deepEqual(globsDe(sourceFile), [{ motifs: ['./a/*.ts'], ligne: 1 }, { motifs: ['./b/*', '!./b/c'], ligne: 2 }])
})

test('specificateurs : la marche lit le mémo par texte et n’écrit que ce qu’elle analyse ; la résolution se refait', () => {
  const { racine, abs, arbre } = ensembleEnMemoire({ 'a.mjs': "import './b.mjs'\n", 'b.mjs': 'export const b = 1\n' })
  const memo = new Map()
  const ecrits = []
  const specificateurs = { lire: (_a, texte) => memo.get(texte), ecrire: (a, texte, sites) => { ecrits.push(a); memo.set(texte, sites) } }
  clotureDImports([abs('a.mjs')], { racine, arbre, specificateurs })
  assert.deepEqual(ecrits.sort(), [abs('a.mjs'), abs('b.mjs')])
  const autre = { ...arbre, existe: (a) => a !== abs('b.mjs') && arbre.existe(a) }
  assert.deepEqual([...clotureDImports([abs('a.mjs')], { racine, arbre: autre, specificateurs })], ['a.mjs'])
  assert.equal(ecrits.length, 2)
})
