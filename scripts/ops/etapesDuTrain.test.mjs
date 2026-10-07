import { ast } from '../guards/lib/dialecte.mjs';
// CLÔTURE des ÉTAPES du train (#1806), gardée contre une retouche de bonne foi : une étape n'atteint
// aucun LANCEMENT de processus hors de son contexte.
//   node --test scripts/ops/etapesDuTrain.test.mjs   (chaîné dans `npm run test:ops`)
//
// La frontière est une CAPACITÉ, pas un nom. Sur la clôture d'imports de `etapesDuTrain.mjs`
// (`clotureDImports`, `importGraph.mjs`), un point fixe INTER-MODULES calcule les liaisons qui
// atteignent un lancement. Les SOURCES de capacité d'un module, chacune avec sa règle (une source
// neuve = une ligne) :
//   | source                          | règle                                                        |
//   | import d'un module intégré      | lanceur hors de la liste blanche `INERTES` (module, nom)     |
//   | import d'un paquet              | lanceur : sa source n'est pas lue                            |
//   | import d'un module du dépôt     | lanceur si le module l'exporte lanceur (point fixe) ;        |
//   |                                 | lanceur s'il n'est pas lu (JSON, `.cjs`, `.cts`)             |
//   | import dynamique, `require`     | déclaration RACINE                                           |
//   | `createRequire`, `getBuiltinModule`, `binding` | déclaration RACINE (`MENTIONS`)               |
//   | accès ambiant (global lu)       | déclaration RACINE hors de la liste blanche `AMBIANTS_INERTES` |
//   | évaluation (`eval`, `Function`) | accès ambiant, jamais inerte                                 |
//   | `import.meta`                   | inerte (`url`, `resolve`, `dirname`, `filename`)             |
// Une déclaration de tête qui référence une liaison lanceuse l'est à son tour, et tout export qui en
// porte une. Le module des étapes n'en acquiert aucune et ne lit aucun accès ambiant. Résidu que ce
// test ne garde pas : évaluation par `.constructor`, état mutable posé par un autre module, effet au
// chargement d'un module de la clôture (#2073).
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { typescript } from '../guards/lib/dialecte.mjs'
import { clotureDImports, estModule, resolveImport } from '../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const ETAPES = fileURLToPath(new URL('./etapesDuTrain.mjs', import.meta.url))
const HOTE = fileURLToPath(new URL('../guards/lib/gitPorte.mjs', import.meta.url))
const posix = (chemin) => chemin.split('\\').join('/')

/**
 * Les liaisons INERTES des modules intégrés, par (module, nom) ; `'*'` : le module entier, défaut et
 * espace de noms compris. Toute autre liaison d'un module intégré est lanceuse.
 */
const INERTES = new Map([
  ['path', '*'],
  ['url', '*'],
  ['buffer', '*'],
  ['crypto', new Set(['createHash'])],
  ['fs', new Set(['existsSync', 'readFileSync', 'statSync', 'lstatSync', 'readdirSync', 'realpathSync'])],
])
const estInerte = (integre, nom) => {
  const inertes = INERTES.get(integre)
  return inertes === '*' || (inertes instanceof Set && inertes.has(nom))
}
/** Les accès qui ouvrent un module intégré sans import : nodejs.org/api/process.html (`getBuiltinModule`), nodejs.org/api/module.html (`createRequire`). */
const MENTIONS = new Set(['getBuiltinModule', 'binding', '_linkedBinding', 'createRequire'])
/** Les noms GLOBAUX du processus qui joue ce test : un global neuf de Node y entre de lui-même. */
const GLOBAUX = new Set([...Object.getOwnPropertyNames(globalThis), 'globalThis'])
/**
 * Les globaux INERTES : toute autre lecture d'un global est un accès AMBIANT, lanceur. Réf. des
 * capacités : nodejs.org/api/globals.html, tc39.es/ecma262 (§ 19, objet global).
 */
const AMBIANTS_INERTES = new Set([
  'undefined',          // valeur
  'Object',             // données
  'Array',              // données
  'String',             // données
  'Number',             // données
  'Boolean',            // données
  'Symbol',             // données
  'Map',                // données
  'Set',                // données
  'WeakMap',            // données
  'Date',               // horloge lue, sans entrée-sortie
  'Math',               // calcul
  'JSON',               // codage, sans entrée-sortie
  'RegExp',             // calcul
  'encodeURIComponent', // codage, sans entrée-sortie
  'decodeURIComponent', // codage, sans entrée-sortie
  'URL',                // codage, sans entrée-sortie
  'TextDecoder',        // codage, sans entrée-sortie
  'Buffer',             // codage, sans entrée-sortie
  'Error',              // erreur
  'TypeError',          // erreur
  'Promise',            // différé dans le même processus
  'setTimeout',         // différé dans le même processus
  'Atomics',            // attente dans le même processus
  'SharedArrayBuffer',  // mémoire du même processus
  'Int32Array',         // mémoire du même processus
  'console',            // écrit sur les flux déjà ouverts du processus, ne lance rien
])

/** Le DISQUE : la source d'un module, et l'existence d'un chemin pour `resolveImport`. */
const DISQUE = Object.freeze({ lire: (chemin) => readFileSync(chemin, 'utf8'), existe: existsSync })

const arbreDe = (chemin, disque = DISQUE) => {
  return ast({ rel: chemin, text: disque.lire(chemin) })
}

/** Un nom qui n'est PAS une référence : propriété d'un accès membre, clé d'un littéral objet, nom de membre. */
function estNomDePropriete(n) {
  const ts = typescript()
  const p = n.parent
  return !!p && ((ts.isPropertyAccessExpression(p) && p.name === n)
    || ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === n)
    || (ts.isBindingElement(p) && p.propertyName === n))
}

const texteLitteral = (n) => {
  const ts = typescript()
  return n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null
}

/** Les noms qu'un motif de liaison (`const { a, b: [c] } = …`) déclare. */
function identifiantsLies(nom) {
  const ts = typescript()
  if (ts.isIdentifier(nom)) return [nom.text]
  return nom.elements.flatMap((e) => (ts.isOmittedExpression(e) ? [] : identifiantsLies(e.name)))
}

/** Les noms qu'une liste d'instructions déclare dans SA portée : imports, `var`/`let`/`const`, fonctions, classes. */
function nomsDeclares(instructions) {
  const ts = typescript()
  return instructions.flatMap((st) => {
    if (ts.isVariableStatement(st)) return st.declarationList.declarations.flatMap((d) => identifiantsLies(d.name))
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) return [st.name.text]
    if (!ts.isImportDeclaration(st) || !st.importClause) return []
    const { name, namedBindings } = st.importClause
    return [...(name ? [name.text] : []),
      ...(!namedBindings ? [] : ts.isNamespaceImport(namedBindings) ? [namedBindings.name.text] : namedBindings.elements.map((e) => e.name.text))]
  })
}

/** Les noms qu'un nœud lie pour ses descendants : paramètres, nom propre d'une expression, variable de boucle ou de `catch`. */
function nomsLiesPar(n) {
  const ts = typescript()
  if (ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n)) return nomsDeclares(n.statements)
  if (ts.isCaseBlock(n)) return nomsDeclares(n.clauses.flatMap((c) => c.statements))
  if (ts.isFunctionLikeDeclaration(n)) return [...(n.parameters ?? []).flatMap((p) => identifiantsLies(p.name)),
    ...(ts.isFunctionExpression(n) && n.name ? [n.name.text] : [])]
  if (ts.isClassExpression(n) && n.name) return [n.name.text]
  if (ts.isCatchClause(n) && n.variableDeclaration) return identifiantsLies(n.variableDeclaration.name)
  if ((ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n)) && n.initializer && ts.isVariableDeclarationList(n.initializer))
    return n.initializer.declarations.flatMap((d) => identifiantsLies(d.name))
  return []
}

/**
 * Un accès AMBIANT : un identifiant LU (ni nom de propriété, ni étiquette) qui porte un nom de
 * `GLOBAUX` hors de `AMBIANTS_INERTES`, et qu'aucune portée englobante ne déclare. Un nom d'export
 * n'est pas lu : `lectureDe` ne visite aucun `export { … }`. Un `var` hissé hors de son bloc n'est pas
 * suivi : l'erreur est du côté lanceur.
 */
function estAmbiant(n) {
  const ts = typescript()
  if (!GLOBAUX.has(n.text) || AMBIANTS_INERTES.has(n.text)) return false
  const p = n.parent
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false
  for (let a = p; a; a = a.parent) if (nomsLiesPar(a).includes(n.text)) return false
  return true
}

/**
 * La lecture d'un module pour le point fixe : ses liaisons importées, ses ré-exports, ses
 * déclarations de tête (les noms qu'elles lient, ceux qu'elles référencent, et si elles sont RACINE :
 * un accès de `MENTIONS`, un chargement dynamique ou un accès ambiant), ses exports.
 */
function lectureDe(chemin, disque = DISQUE) {
  const ts = typescript()
  const versModule = (spec) => (isBuiltin(spec) ? { integre: spec.replace(/^node:/, '') }
    : { abs: resolveImport(chemin, spec, disque.existe) })
  const lu = { imports: [], reexports: [], exports: new Map(), decls: [], dynamiques: [], mentions: [], ambiants: [] }
  const analyser = (st) => {
    const refs = new Set()
    const rangements = []
    let racine = false
    const racineDe = (e) => (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) ? racineDe(e.expression) : e)
    const refsDe = (noeuds) => {
      const vus = new Set()
      const marcher = (n) => {
        if (ts.isIdentifier(n) && !estNomDePropriete(n)) vus.add(n.text)
        n.forEachChild(marcher)
      }
      for (const n of noeuds) marcher(n)
      return vus
    }
    const ranger = (cible, valeurs) => {
      const r = racineDe(cible)
      if (ts.isIdentifier(r)) rangements.push({ cible: r.text, refs: refsDe(valeurs) })
    }
    const visiter = (n) => {
      if (ts.isTypeNode(n)) return;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ranger(n.left, [n.right])
      if (ts.isCallExpression(n) && (ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression))) ranger(n.expression, n.arguments)
      if (ts.isIdentifier(n)) {
        if (MENTIONS.has(n.text)) { racine = true; lu.mentions.push(n.text) }
        if (!estNomDePropriete(n)) {
          refs.add(n.text)
          if (estAmbiant(n)) { racine = true; lu.ambiants.push(n.text) }
        }
      }
      if (ts.isElementAccessExpression(n) && MENTIONS.has(texteLitteral(n.argumentExpression) ?? '')) { racine = true; lu.mentions.push(n.getText()) }
      if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
        racine = true
        lu.dynamiques.push(n.getText())
      }
      n.forEachChild(visiter)
    }
    visiter(st)
    return { refs, rangements, racine }
  }
  for (const st of arbreDe(chemin, disque).statements) {
    if (ts.isImportDeclaration(st)) {
      const cible = versModule(st.moduleSpecifier.text)
      const clause = st.importClause
      if (clause?.name) lu.imports.push({ local: clause.name.text, nom: 'default', ...cible })
      const liens = clause?.namedBindings
      if (liens && ts.isNamespaceImport(liens)) lu.imports.push({ local: liens.name.text, nom: '*', ...cible })
      else if (liens) for (const e of liens.elements) lu.imports.push({ local: e.name.text, nom: (e.propertyName ?? e.name).text, ...cible })
      continue
    }
    if (ts.isExportDeclaration(st)) {
      const clause = st.exportClause
      if (st.moduleSpecifier) {
        const cible = versModule(st.moduleSpecifier.text)
        if (!clause) lu.reexports.push({ exporte: '*', nom: '*', ...cible })
        else if (ts.isNamespaceExport(clause)) lu.reexports.push({ exporte: clause.name.text, nom: '*ns', ...cible })
        else for (const e of clause.elements) lu.reexports.push({ exporte: e.name.text, nom: (e.propertyName ?? e.name).text, ...cible })
      } else if (clause && ts.isNamedExports(clause)) for (const e of clause.elements) lu.exports.set(e.name.text, (e.propertyName ?? e.name).text)
      continue
    }
    const modificateurs = (('modifiers' in st) && st.modifiers) || []
    const exporte = modificateurs.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    const parDefaut = modificateurs.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    const noms = (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name ? [st.name.text]
      : ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap((d) => identifiantsLies(d.name))
        : ts.isExportAssignment(st) || (parDefaut && !st.name) ? ['default']
          : []
    lu.decls.push({ noms, ...analyser(st) })
    if (exporte) for (const nom of noms) lu.exports.set(parDefaut ? 'default' : nom, nom)
    if (ts.isExportAssignment(st)) lu.exports.set('default', 'default')
  }
  return lu
}

/**
 * Le point fixe INTER-MODULES sur la clôture : pour chaque module, les liaisons LOCALES qui
 * atteignent un lancement (`locaux`) et les EXPORTS qui en portent une. Une liaison d'un module
 * intégré hors de `INERTES`, ou d'un spécificateur qui ne se résout pas dans la clôture (un paquet),
 * est tenue pour lanceuse : sa source n'est pas lue. Une déclaration de tête où une instruction RANGE une liaison lanceuse (membre
 * droit d'une affectation, argument d'un appel de méthode sur elle) devient lanceuse à son tour.
 */
function lanceursDeLaCloture(cloture, disque = DISQUE) {
  const lectures = new Map(cloture.map((f) => [posix(f), lectureDe(f, disque)]))
  const exportsLanceurs = new Map([...lectures.keys()].map((f) => [f, new Set()]))
  const locaux = new Map([...lectures.keys()].map((f) => [f, new Set()]))
  const cibleDe = ({ abs }) => (abs ? exportsLanceurs.get(posix(abs)) : undefined)
  const lanceuse = (liaison) => {
    if (liaison.integre) return !estInerte(liaison.integre, liaison.nom)
    const cible = cibleDe(liaison)
    if (!cible) return true
    return liaison.nom === '*' || liaison.nom === '*ns' ? cible.size > 0 : cible.has(liaison.nom)
  }
  for (let change = true; change;) {
    change = false
    const ajouter = (ens, nom) => {
      if (!ens.has(nom)) {
        ens.add(nom)
        change = true
      }
    }
    for (const [f, lu] of lectures) {
      const locs = locaux.get(f)
      for (const i of lu.imports) if (lanceuse(i)) ajouter(locs, i.local)
      for (const d of lu.decls) {
        for (const { cible, refs } of d.rangements)
          if ([...refs].some((r) => locs.has(r)) && lu.decls.some((x) => x.noms.includes(cible))) ajouter(locs, cible)
        if (d.racine || [...d.refs].some((r) => locs.has(r) && !d.noms.includes(r))) for (const n of d.noms) ajouter(locs, n)
      }
      const exps = exportsLanceurs.get(f)
      for (const [exporte, local] of lu.exports) if (locs.has(local)) ajouter(exps, exporte)
      for (const r of lu.reexports) {
        if (r.nom !== '*') {
          if (lanceuse(r)) ajouter(exps, r.exporte)
          continue
        }
        const cible = cibleDe(r)
        if (r.integre ? !estInerte(r.integre, '*') : !cible) ajouter(exps, '*')
        else if (cible) for (const n of cible) if (n !== 'default') ajouter(exps, n)
      }
    }
  }
  return { lectures, exportsLanceurs, locaux }
}

const clotureDesEtapes = () =>
  [...clotureDImports([ETAPES], { racine: RACINE })].map((rel) => resolve(RACINE, rel)).filter(estModule)

test('le point fixe voit les lanceurs de la clôture : questions et écrivains de l’hôte, `coursesCi`, `execFileResilient`, `appelGhRunner`', () => {
  const { exportsLanceurs, locaux } = lanceursDeLaCloture(clotureDesEtapes())
  const hote = exportsLanceurs.get(posix(HOTE))
  assert.ok(hote, 'la clôture lit bien l’hôte git : sinon ce test ne mesure rien')
  for (const nom of ['lancer', 'interroger', 'lire', 'ecrire']) assert.ok(locaux.get(posix(HOTE)).has(nom), `${nom} atteint un lancement`)
  for (const nom of ['commitDe', 'pousser', 'fusionner', 'shaDe', 'ceQuiChange', 'listerImage', 'journalDe'])
    assert.ok(hote.has(nom), `${nom} manque aux lanceurs de l’hôte : ${[...hote].join(', ')}`)
  for (const nom of ['TRONC', 'reussi', 'raisonCourte', 'urlOrigineAcceptee']) assert.ok(!hote.has(nom), `${nom} est un pur`)
  const de = (rel) => exportsLanceurs.get(posix(resolve(rel))) ?? new Set()
  assert.ok(de('scripts/guards/lib/coursesCi.mjs').has('coursesCi'))
  assert.ok(de('scripts/guards/lib/spawnResilient.mjs').has('execFileResilient'))
  assert.ok(de('scripts/guards/lib/ticketsGh.mjs').has('appelGhRunner'))
  assert.ok(de('scripts/lancer-local.mjs').has('sortieOutilLocal'))
})

test('le point fixe suit le RANGEMENT, le ré-export, l’espace de noms et le défaut, d’un module à l’autre ; une liaison intégrée hors de `INERTES` lance, un global lu hors de `AMBIANTS_INERTES` aussi', () => {
  const sources = new Map()
  const ecrire = (nom, texte) => { sources.set(posix(resolve('/banc', nom)), texte); return resolve('/banc', nom) }
  const disque = { lire: (chemin) => sources.get(posix(chemin)), existe: (chemin) => sources.has(posix(chemin)) }
  const a = ecrire('a.mjs', [
    "import { spawnSync } from 'node:child_process'",
    'const REGISTRE = []',
    'export function enregistrer() { REGISTRE.push(spawnSync) }',
    'export const premier = () => REGISTRE[0]',
    'export const pur = (x) => x + 1',
    'export { REGISTRE as alias }',
    'export default function () { return spawnSync }',
  ].join('\n'))
  const b = ecrire('b.mjs', "export * from './a.mjs'\nexport { default as defaut } from './a.mjs'\nexport const inerte = 1\n")
  const c = ecrire('c.mjs', "import * as tout from './b.mjs'\nimport { pur } from './b.mjs'\nexport const viaEspace = () => tout\nexport const viaPur = () => pur(1)\n")
  const d = ecrire('d.mjs', [
    "import { readFileSync, writeFileSync } from 'node:fs'",
    "import fs from 'fs'",
    "import * as chemin from 'node:path'",
    "import { execve } from 'node:process'",
    'export const lit = (f) => readFileSync(f)',
    "export const ecrit = (f) => writeFileSync(f, '')",
    'export const parDefaut = () => fs',
    'export const joint = (x) => chemin.join(x)',
    "export const remplace = () => execve('/bin/true')",
  ].join('\n'))
  const e = ecrire('e.mjs', "export * from 'node:path'\n")
  const f = ecrire('f.mjs', "export * from 'node:fs'\n")
  const g = ecrire('g.mjs', [
    'export const env = () => process',
    'export const appel = (u) => fetch(u)',
    'export const evalue = (t) => globalThis[t]',
    'export const masque = (fetch) => fetch(1)',
    'export const cle = () => ({ process: 1 }).process',
    'export const inerte = (x) => JSON.stringify(new Map([[x, Date.now()]]))',
    'export { masque as fetch }',
    'export const etiq = () => { process: for (;;) break process; return 1 }',
    'export const pris = () => { try { return 1 } catch (fetch) { return fetch } }',
    'export const nommee = class fetch { m() { return fetch } }',
  ].join('\n'))
  const { exportsLanceurs } = lanceursDeLaCloture([a, b, c, d, e, f, g], disque)
  const de = (m) => [...exportsLanceurs.get(posix(m))].sort()
  assert.deepEqual(de(a), ['alias', 'default', 'enregistrer', 'premier'])
  assert.deepEqual(de(b), ['alias', 'defaut', 'enregistrer', 'premier'])
  assert.deepEqual(de(c), ['viaEspace'])
  assert.deepEqual(de(d), ['ecrit', 'parDefaut', 'remplace'])
  assert.deepEqual(de(e), [])
  assert.deepEqual(de(f), ['*'])
  assert.deepEqual(de(g), ['appel', 'env', 'evalue'])
})

test('le module des ÉTAPES n’acquiert aucune liaison qui atteint un lancement, depuis aucun module', () => {
  const { lectures, locaux } = lanceursDeLaCloture(clotureDesEtapes())
  const lu = lectures.get(posix(ETAPES))
  assert.ok(lu.imports.length > 0, 'les imports des étapes se lisent')
  const fautes = [
    ...lu.imports.filter((i) => locaux.get(posix(ETAPES)).has(i.local))
      .map((i) => `importe ${i.nom === '*' ? `* as ${i.local}` : i.nom} de ${i.abs ? posix(i.abs) : i.integre ? `node:${i.integre}` : 'un paquet'}`),
    ...lu.reexports.map((r) => `ré-exporte ${r.exporte}`),
    ...lu.dynamiques.map((d) => `charge dynamiquement : ${d}`),
  ]
  assert.deepEqual(fautes, [], 'une étape ne tient que son contexte : un lanceur y exprimerait un geste non nommé')
})

test('le module des ÉTAPES ne mentionne aucun accès qui ouvre un module intégré, ni aucun accès ambiant', () => {
  const { mentions, ambiants } = lectureDe(ETAPES)
  assert.deepEqual({ mentions, ambiants }, { mentions: [], ambiants: [] })
})
