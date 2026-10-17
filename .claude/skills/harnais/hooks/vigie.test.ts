// Banc de la fonction `vigie` du mod `harnais` (#2280, V5), sous `claude plugin test` : les hooks de test
// tiennent lieu du moteur et servent `process.run` selon le contrat de `scripts/ops/vigie.mjs --json --arbre
// <racine> [--depuis <etat>]` : un objet `{ ligne, transitions, etat }`, sans transition quand `--depuis` vaut
// l'état mesuré, ou un code non nul et le motif sur stderr. Contrat : https://github.com/MyEdO/game/issues/2280#issuecomment-5995626734
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const RACINE = '/depot/.wt-7'
const PERIODE_MS = 60 * 1000
const DEMARRAGE = { cwd: RACINE, surface: 'terminal', isInteractive: true } as never
type Mesure = { ligne: string; transitions: string[]; etat: string }
type Panne = { exitCode: number; stdout: string; stderr: string }

/**
 * Le monde sous le mod : `session.root`, et `process.run` qui rend `mesure()` pour `vigie.mjs`, ou
 * `panne()` quand elle est donnée ; les scripts des autres fonctions du mod reçoivent une panne neutre.
 * Rend les argv de `vigie.mjs`, les status lines, les toasts et le journal.
 */
function monde(on: On, mesure: () => Mesure, panne: () => Panne | null = () => null) {
  const argvs: string[][] = []
  const lignes: (string | undefined)[] = []
  const toasts: string[] = []
  const journal: { text: string; to?: string }[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.root', async () => ({ value: RACINE }))
  on('session.id', async () => ({ value: 'session-de-test' }))
  on('tool.register', async (_$, e) => ({ value: { tool: `mcp__harnais__${e.name}` } }))
  on('process.run', async (_$, e) => {
    const sortie = (r: Panne) => ({ value: { ...r, isStdoutTruncated: false, isStderrTruncated: false } })
    if (!e.argv[1]?.endsWith('/scripts/ops/vigie.mjs')) return sortie({ exitCode: 1, stdout: '', stderr: 'hors banc' })
    argvs.push([...e.argv])
    const lu = mesure()
    const depuis = e.argv.indexOf('--depuis')
    const rendu = depuis >= 0 && e.argv[depuis + 1] === lu.etat ? { ...lu, transitions: [] } : lu
    return sortie(panne() ?? { exitCode: 0, stdout: JSON.stringify(rendu), stderr: '' })
  })
  on('ui.status', async (_$, e) => {
    lignes.push(e.text)
    return { value: undefined } as never
  })
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('ui.log', async (_$, e) => {
    journal.push({ text: e.text, to: e.to })
    return { value: undefined } as never
  })
  return { argvs, lignes, toasts, journal }
}

/** Les journaux de la fonction `vigie` seule. */
const deVigie = (journal: { text: string; to?: string }[]) => journal.filter((l) => l.text.includes('vigie.mjs'))

test('session.start : `vigie.mjs --json --arbre <racine de session>` sans `--depuis` ; la ligne va à la status line, chaque transition à un toast', async ($, on) => {
  const horloge = mock.clock(on)
  const vu = monde(on, () => ({ ligne: 'main verte · #7 rouge', transitions: ['#7 : CI rouge (lint)', 'train mort'], etat: 'e1' }))
  await $.session.start(DEMARRAGE)
  await horloge.advance(0)
  expect(vu.argvs.length).toBe(1)
  expect(vu.argvs[0]?.[0]).toBe('node')
  expect(vu.argvs[0]?.[1]?.endsWith('/../../../scripts/ops/vigie.mjs')).toBe(true)
  expect(vu.argvs[0]?.slice(2)).toEqual(['--json', '--arbre', RACINE])
  expect(vu.lignes).toEqual(['main verte · #7 rouge'])
  expect(vu.toasts).toEqual(['#7 : CI rouge (lint)', 'train mort'])
})

test('chaque période : l’`etat` rendu est repassé TEL QUEL en `--depuis` ; la status line est posée à chaque mesure, même sans transition', async ($, on) => {
  const horloge = mock.clock(on)
  let mesure: Mesure = { ligne: 'main en vol', transitions: [], etat: 'e1' }
  const vu = monde(on, () => mesure)
  await $.session.start(DEMARRAGE)
  await horloge.advance(0)
  await horloge.advance(PERIODE_MS)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--json', '--arbre', RACINE, '--depuis', 'e1'])
  mesure = { ligne: 'main verte', transitions: ['main : CI verte'], etat: '{"main":{"sha":"abc"}} opaque' }
  await horloge.advance(PERIODE_MS)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--json', '--arbre', RACINE, '--depuis', 'e1'])
  await horloge.advance(PERIODE_MS)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--json', '--arbre', RACINE, '--depuis', '{"main":{"sha":"abc"}} opaque'])
  expect(vu.argvs.length).toBe(4)
  expect(vu.lignes).toEqual(['main en vol', 'main en vol', 'main verte', 'main verte'])
  expect(vu.toasts).toEqual(['main : CI verte'])
})

test('panne — code non nul, JSON illisible : la dernière ligne n’est pas effacée, aucun toast, le motif au journal de DÉBOGAGE, le `--depuis` reste le dernier état valide', async ($, on) => {
  const horloge = mock.clock(on)
  let panne: Panne | null = null
  const vu = monde(on, () => ({ ligne: 'main verte', transitions: [], etat: 'e1' }), () => panne)
  await $.session.start(DEMARRAGE)
  await horloge.advance(0)
  panne = { exitCode: 2, stdout: '', stderr: '[vigie] gh injoignable' }
  await horloge.advance(PERIODE_MS)
  panne = { exitCode: 0, stdout: 'pas du JSON', stderr: '' }
  await horloge.advance(PERIODE_MS)
  expect(vu.lignes).toEqual(['main verte'])
  expect(vu.toasts).toEqual([])
  expect(deVigie(vu.journal).map((l) => l.to)).toEqual(['debug', 'debug'])
  expect(deVigie(vu.journal)[0]?.text).toContain('gh injoignable')
  expect(deVigie(vu.journal)[1]?.text).toContain('sortie JSON illisible')
  panne = null
  await horloge.advance(PERIODE_MS)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--json', '--arbre', RACINE, '--depuis', 'e1'])
  expect(vu.lignes).toEqual(['main verte', 'main verte'])
})
