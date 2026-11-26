// LE FILET DE `main` (#5037 L2) : `filetDuPush` rejoue la suite entière dès qu'une entrée de file du push avait une zone,
// et le workflow `filet-de-main.yml` la joue sur `main`, fermé par défaut, sans check au nom d'un check requis.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { filetDuPush } from './filetDeMain.mjs'
import { contextesRequis } from './gatesDeCi.mjs'
import { branchesDePush, corpsRun } from './workflowsDuDepot.mjs'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c'.repeat(40)
/** `main` en A, puis deux entrées de file fusionnées B (sur A) et C (sur B), chacune avec la tête de sa PR. */
const GRAPHE = [{ sha: B, parents: [A, '1'.repeat(40)] }, { sha: C, parents: [B, '2'.repeat(40)] }]
const zones = (parSha) => ({ sha }) => parSha[sha] ?? null

test('une entrée de file à zone fait jouer le filet, même seconde d’un lot de deux', () => {
  assert.equal(filetDuPush({ avant: B, apres: C, graphe: GRAPHE, zoneDe: zones({ [C]: 'roguelite' }) }).filet, true)
  assert.equal(filetDuPush({ avant: A, apres: C, graphe: GRAPHE, zoneDe: zones({ [B]: 'roguelite' }) }).filet, true)
  assert.equal(filetDuPush({ avant: A, apres: C, graphe: GRAPHE, zoneDe: zones({ [C]: 'jeu-de-role' }) }).filet, true)
})

test('un push dont aucune entrée n’avait de zone ne joue rien', () => {
  const vu = []
  const verdict = filetDuPush({ avant: A, apres: C, graphe: GRAPHE, zoneDe: (e) => (vu.push(e), null) })
  assert.equal(verdict.filet, false)
  assert.deepEqual(vu, [{ base: B, sha: C }, { base: A, sha: B }], 'chaque entrée se juge contre son premier parent')
})

test('fermé par défaut : sans sha avant le push, ou une chaîne de premiers parents qui n’atteint pas ce sha', () => {
  const sansZone = () => null
  assert.equal(filetDuPush({ avant: '0'.repeat(40), apres: C, graphe: GRAPHE, zoneDe: sansZone }).filet, true)
  assert.equal(filetDuPush({ avant: undefined, apres: C, graphe: GRAPHE, zoneDe: sansZone }).filet, true)
  assert.equal(filetDuPush({ avant: 'd'.repeat(40), apres: C, graphe: GRAPHE, zoneDe: sansZone }).filet, true)
  assert.equal(filetDuPush({ avant: A, apres: C, graphe: [], zoneDe: sansZone }).filet, true)
})

test('filet-de-main.yml : push de `main`, la suite entière sous la décision du filet, fermée par défaut, hors des checks requis', () => {
  const texte = readFileSync(fileURLToPath(new URL('../../.github/workflows/filet-de-main.yml', import.meta.url)), 'utf8')
  assert.deepEqual(branchesDePush(texte, 'filet-de-main.yml'), ['main'])
  assert.ok(corpsRun(texte).includes('node scripts/gates/filetDeMain.mjs >> "$GITHUB_OUTPUT"'))
  assert.ok(corpsRun(texte).includes('npm test'))
  assert.doesNotMatch(texte, /WFRP_TEST_ZONE/, 'le filet joue la suite sans zone')
  const suite = /^ {2}suite:\n((?: {4}.*\n|\n)*)/m.exec(texte)?.[1] ?? ''
  assert.match(suite, /^ {4}if: \$\{\{ !cancelled\(\) && needs\.zone\.outputs\.filet != 'false' \}\}$/m,
    'seul un `filet=false` lu saute la suite : un job `zone` rouge la joue')
  const noms = [...texte.matchAll(/^ {4}name: (.+)$/gm)].flatMap(([, nom]) =>
    [1, 2, 3].map((i) => nom.replace('${{ matrix.partie }}', String(i)).replace('${{ strategy.job-total }}', '3')))
  const requis = new Set(contextesRequis())
  assert.deepEqual(noms.filter((n) => requis.has(n)), [], 'un check du filet porte le nom d’un check requis (scripts/ops/checks-requis.mjs)')
})
