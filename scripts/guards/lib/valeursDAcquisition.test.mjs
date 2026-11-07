// VALEURS D'ACQUISITION (#3058 B2, `valeursDAcquisition` de `racinesBalayees.mjs`) : la forme fermée qui lit l'argument
// d'une acquisition calculée, sur un dépôt forgé en mémoire. Les formes que la sonde du juge a réfutées sous le régime de
// lecture rendent `non` ou le module qu'elles chargent à l'exécution, jamais un module qu'elles ne chargent pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyserTexte } from './dialecte.mjs'
import { resolveImport, sitesDeModule } from './importGraph.mjs'
import { valeursDAcquisition } from './racinesBalayees.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

const F = '/forge'
const BASE = {
  'src/noyau/a.ts': 'export const a = 1\n',
  'src/scenes/a.ts': 'export const a = 2\n',
  'scripts/guards/lib/lister.mjs': 'export const listerEntrees = () => ({ entrees: [] })\n',
  'scripts/reg.mjs': "export const REG = ['../src/noyau/a.ts']\nexport const CFG = { p: '../src/noyau/a.ts' }\n",
  'scripts/reg2.mjs': "export const P = '../src/noyau/a.ts'.replace('noyau', 'scenes')\n",
  'scripts/mut.mjs': "import { REG, CFG } from './reg.mjs'\nREG.push('../src/scenes/a.ts')\nCFG.p = '../src/scenes/a.ts'\n",
  'scripts/gel.mjs': "export const G = Object.freeze([{ s: 'src/noyau/a.ts' }, { s: 'src/scenes/a.ts' }].map(Object.freeze))\n",
}
const URLS = "import { join, dirname } from 'node:path'\nimport { fileURLToPath, pathToFileURL } from 'node:url'\nimport { listerEntrees } from './guards/lib/lister.mjs'\n"

/** Les valeurs de chaque acquisition calculée de `scripts/pont.mjs` (`acquisition && spec === null`, `sitesDeModule`),
 *  une raison `non` réduite à `non`. */
function valeurs(pont) {
  const fichiers = { ...BASE, 'scripts/pont.mjs': pont }
  const arbreDe = (rel) => (rel in fichiers ? analyserTexte({ rel, text: fichiers[rel] }).sourceFile : null)
  const existe = (a) => a.startsWith(`${F}/`) && a.slice(F.length + 1) in fichiers
  const cible = (rel, spec) => {
    const c = resolveImport(`${F}/${rel}`, spec, existe, [], 'statique', F)
    return c?.startsWith(`${F}/`) ? c.slice(F.length + 1) : null
  }
  const arbre = arbreDe('scripts/pont.mjs')
  return sitesDeModule('scripts/pont.mjs', arbre).filter((s) => s.acquisition && s.spec === null)
    .map((s) => valeursDAcquisition('scripts/pont.mjs', arbre, s.noeud.arguments[0], { arbreDe, cible }).map((v) => ('non' in v ? 'non' : v)))
}

/** Les formes de la sonde du juge (`forge-evaluateur.mjs` et ses suites), et le verdict de la forme fermée : `non`, ou le
 *  module que l'exécution charge. */
const CAS = {
  'replace': ["export const x = () => import('../src/noyau/a.ts'.replace('noyau', 'scenes'))\n", [['non']]],
  'replaceAll': ["export const x = () => import('../src/noyau/a.ts'.replaceAll('noyau', 'scenes'))\n", [['non']]],
  'split/join': ["export const x = () => import('../src/noyau/a.ts'.split('noyau').join('scenes'))\n", [['non']]],
  'slice': ["const s = '../src/noyau/a.ts#../src/scenes/a.ts'\nexport const x = () => import(s.slice(18))\n", [['non']]],
  'push local': ["const L = ['../src/noyau/a.ts']\nL.push('../src/scenes/a.ts')\nexport const x = () => Promise.all(L.map((m) => import(m)))\n", [['non']]],
  'Object.assign': ["const C = { p: '../src/noyau/a.ts' }\nObject.assign(C, { p: '../src/scenes/a.ts' })\nexport const x = () => import(C.p)\n", [['non']]],
  'registre muté ailleurs (push)': ["import './mut.mjs'\nimport { REG } from './reg.mjs'\nexport const x = () => Promise.all(REG.map((m) => import(m)))\n", [['non']]],
  'objet muté ailleurs (champ)': ["import './mut.mjs'\nimport { CFG } from './reg.mjs'\nexport const x = () => import(CFG.p)\n", [['non']]],
  'resolve depuis le cwd': ["import { resolve } from 'node:path'\nexport const x = () => import(resolve('src/scenes/a.ts'))\n", [[{ fichier: 'src/scenes/a.ts' }]]],
  'pathToFileURL(texte).href': ["import { pathToFileURL } from 'node:url'\nexport const x = () => import(pathToFileURL('src/scenes/a.ts').href)\n", [[{ fichier: 'src/scenes/a.ts' }]]],
  'ternaire': ["export const x = (c) => import(c ? '../src/noyau/a.ts' : '../src/scenes/a.ts')\n", [['non']]],
  'relais méthode': ["class C { m(p) { return import(p) } }\nexport const x = () => new C().m('../src/scenes/a.ts')\n", [['non']]],
  'relais lambda imbriquée': ["export function f() { const load = (p) => import(p); return load('../src/scenes/a.ts') }\n", [['non']]],
  'then': ["export const x = () => Promise.resolve('../src/scenes/a.ts').then((p) => import(p))\n", [['non']]],
  'find non gelé': ["const L = ['../src/noyau/a.ts', '../src/scenes/a.ts']\nexport const x = () => import(L.find((s) => s.includes('scenes')))\n", [['non']]],
  'replace dans un autre module': ["import { P } from './reg2.mjs'\nexport const x = () => import(P)\n", [['non']]],
  'join homonyme local': ["const join = (a, b) => '../src/scenes/a.ts'\nexport const x = () => import(join('../src/noyau', 'a.ts'))\n", [['non']]],
  'resolve de createRequire': ["import { createRequire } from 'node:module'\nconst { resolve } = createRequire(import.meta.url)\nexport const x = () => import(resolve('../src/scenes/a.ts'))\n", [['non']]],
  'liaison masquée par un paramètre': ["const m = '../src/noyau/a.ts'\nexport const x = (m) => import(m)\n", [['non']]],
  'pathToFileURL(x) sans .href': ["import { pathToFileURL } from 'node:url'\nexport const x = () => import(pathToFileURL('src/noyau/a.ts'))\n", [['non']]],
  '{ href }.href': ["const u = { href: 'src/noyau/a.ts' }\nexport const x = () => import(u.href)\n", [['non']]],
  'élément gelé et son champ': ["import { G } from './gel.mjs'\nimport { join } from 'node:path'\nimport { fileURLToPath, pathToFileURL } from 'node:url'\nconst R = fileURLToPath(new URL('../', import.meta.url))\nexport const x = (g) => { const c = G.find((y) => y.s === g); return import(pathToFileURL(join(R, c.s)).href) }\n", [[{ fichier: 'src/noyau/a.ts' }, { fichier: 'src/scenes/a.ts' }]]],
  'littéral lié': ["const m = '../src/noyau/a.ts'\nexport const x = () => import(m)\n", [[{ specificateur: '../src/noyau/a.ts' }]]],
  'descente': [`${URLS}const D = fileURLToPath(new URL('../src/noyau/', import.meta.url))\nexport const x = listerEntrees(D).entrees.filter((f) => f).map((f) => import(pathToFileURL(join(D, f.nom)).href))\n`, [[{ dossier: 'src/noyau' }]]],
  'descente sous join': [`${URLS}const D = fileURLToPath(new URL('../src/noyau/', import.meta.url))\nexport const x = listerEntrees(D).entrees.map((f) => import(join(join(D, f.nom), '../../scenes/a.ts')))\n`, [['non']]],
  'descente sous dirname': [`${URLS}const D = fileURLToPath(new URL('../src/noyau/', import.meta.url))\nexport const x = listerEntrees(D).entrees.map((f) => import(join(dirname(join(D, f.nom)), 'a.ts')))\n`, [['non']]],
  'descente concaténée': [`${URLS}const D = fileURLToPath(new URL('../src/noyau/', import.meta.url))\nexport const x = listerEntrees(D).entrees.map((f) => import(join(D, f.nom) + '/../../scenes/a.ts'))\n`, [['non']]],
  'descente d’un autre dossier': [`${URLS}const D = fileURLToPath(new URL('../src/noyau/', import.meta.url))\nconst E = fileURLToPath(new URL('../src/scenes/', import.meta.url))\nexport const x = listerEntrees(D).entrees.map((f) => import(join(E, f.nom)))\n`, [['non']]],
  'gel superficiel': ["const V = Object.freeze([{ s: 'src/noyau/a.ts' }])\nexport const x = () => import(V.find((v) => v).s)\n", [['non']]],
  'Object masqué': ["const Object = { freeze: (x) => x }\nconst V = Object.freeze([{ s: 'src/noyau/a.ts' }].map(Object.freeze))\nexport const x = () => import(V.find((v) => v).s)\n", [['non']]],
  'constante gelée vide': ["const V = Object.freeze([].map(Object.freeze))\nexport const x = () => import(V.find((v) => v).s)\n", [[]]],
}

test('VALEURS D’ACQUISITION : chaque forme hors de la liste blanche rend `non`, chaque forme lue rend le module que l’exécution charge', () => {
  const formes = Object.keys(CAS)
  assert.deepEqual(tableTotale(formes, (forme) => valeurs(CAS[forme][0])), tableTotale(formes, (forme) => CAS[forme][1]))
})
