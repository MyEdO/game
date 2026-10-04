// Banc de la fonction `suivi` du mod `harnais` (#2279), sous `claude plugin test` : les hooks de test
// tiennent lieu du moteur et servent `process.run` comme `scripts/ops/suivi.mjs` (dont `--depuis`).
// Le kit 2.1.289 ne sert ni le `$.session.append` d'un plugin ni `$.state` au banc : l'état du mod se lit sur
// le `--depuis` de la relecture suivante (la clé retenue), et une tentative d'ajout sur le journal de débogage,
// où le kit la fait échouer. Le chemin de succès de l'ajout se prouve en session réelle (DoD #2279).
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SESSION = 'session-de-test'
const lie = (cle: string, prochain: string) => ({
  session: SESSION,
  suivis: [{ epique: 9, chemin: '/s/9.md', lignes: ['[suivi #9] en cours : #4 ouvert', `  prochain geste : ${prochain}`] }],
  contexte: '[suivi #9] /s/9.md — digest',
  ajout: `[suivi] état relu\n[suivi #9] en cours : #4 ouvert\n  prochain geste : ${prochain}`,
  cle,
})
type Etat = ReturnType<typeof lie>
const SANS_LIEN: Etat = { session: SESSION, suivis: [], contexte: '[suivi] session sans suivi lié ; index', ajout: '', cle: 'vide' }
const BANDEAU = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never } as const
const DEMARRAGE = { cwd: '/depot', surface: null, isInteractive: false } as never

/**
 * Le monde sous le mod : `session.id`, et `process.run` qui rend `etat()` comme le lecteur — `ajout` vide
 * quand `--depuis` vaut sa clé, calculé à la RÉPONSE — ou `panne()` quand elle est donnée ; une course lancée
 * quand `suspendre()` est vrai attend `relacher()`. Rend les argv lancés, le journal et `relacher`.
 */
function monde(on: On, etat: () => Etat, panne: () => { exitCode: number; stdout: string; stderr: string } | null = () => null,
  suspendre: () => boolean = () => false) {
  const argvs: string[][] = []
  const journal: { text: string; to?: string }[] = []
  const suspendues: (() => void)[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => ({ value: { tool: `mcp__harnais__${e.name}` } }))
  on('session.id', async () => ({ value: SESSION }))
  on('prompt.context', async (_$, e) => ({ blocks: e.blocks }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, { key: 'moteur' }, 'moteur') as RenderElement
  })
  on('process.run', async (_$, e) => {
    argvs.push([...e.argv])
    if (suspendre()) await new Promise<void>((relache) => { suspendues.push(relache) })
    const enPanne = panne()
    if (enPanne) return { value: { ...enPanne, isStdoutTruncated: false, isStderrTruncated: false } }
    const courant = etat()
    const depuis = e.argv.indexOf('--depuis')
    const rendu = depuis >= 0 && e.argv[depuis + 1] === courant.cle ? { ...courant, ajout: '' } : courant
    return { value: { exitCode: 0, stdout: JSON.stringify(rendu), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.log', async (_$, e) => {
    journal.push({ text: e.text, to: e.to })
    return { value: undefined } as never
  })
  return { argvs, journal, relacher: () => suspendues.splice(0).forEach((relache) => relache()) }
}

/** Les lignes du journal qui disent une tentative d'ajout (le kit la fait échouer). */
const ajoutsTentes = (journal: { text: string; to?: string }[]) => journal.filter((l) => l.text.includes('ajout du suivi'))

const textes = async (ui: { findAll: (q: { type: 'Text' }) => Promise<{ text?: string }[]> }) => (await ui.findAll({ type: 'Text' })).map((el) => el.text)

test('session.start : le lecteur `--session <id> --json` ; le bandeau rend ses lignes sur terminal ET desktop', async ($, on) => {
  mock.clock(on)
  const vu = monde(on, () => lie('k1', 'juge du brief'))
  await $.session.start(DEMARRAGE)
  expect(vu.argvs.length).toBe(1)
  expect(vu.argvs[0]?.[0]).toBe('node')
  expect(vu.argvs[0]?.[1]?.endsWith('/../../../scripts/ops/suivi.mjs')).toBe(true)
  expect(vu.argvs[0]?.slice(2)).toEqual(['--session', SESSION, '--json'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'harnais', surface, ...BANDEAU })
    expect(await textes(ui)).toEqual(['[suivi #9] en cours : #4 ouvert', '  prochain geste : juge du brief'])
    await ui.unmount()
  }
})

test('sans lien : bandeau vide sur terminal ET desktop, l’index en contexte', async ($, on) => {
  mock.clock(on)
  monde(on, () => SANS_LIEN)
  await $.session.start(DEMARRAGE)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'harnais', surface, ...BANDEAU })
    expect(await textes(ui)).toEqual(['moteur'])
    await ui.unmount()
  }
  const contexte = await $.prompt.context({ blocks: [] })
  expect(contexte.blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
})

test('prompt.context porte le bloc `suivi` et sa clé devient le `--depuis` ; un ajout en attente est TENTÉ au tour, son échec ne casse pas le tour et le garde pour le suivant', async ($, on) => {
  const horloge = mock.clock(on)
  let etat = lie('k1', 'juge du brief')
  const vu = monde(on, () => etat)
  await $.session.start(DEMARRAGE)
  const contexte = await $.prompt.context({ blocks: [{ name: 'currentDate', text: 'x' }] })
  expect(contexte.blocks).toEqual([{ name: 'currentDate', text: 'x' }, { name: 'suivi', text: etat.contexte }])
  const depuis = () => vu.argvs.at(-1)?.slice(2)
  await horloge.advance(60 * 1000)
  expect(depuis()).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  expect(await $.turn.start({ text: 'a', turnId: 't1' })).toEqual({ turnId: 't1' })
  expect(ajoutsTentes(vu.journal)).toEqual([])
  etat = lie('k2', 'juge du diff')
  await horloge.advance(60 * 1000)
  expect(depuis()).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  expect(await $.turn.start({ text: 'b', turnId: 't2' })).toEqual({ turnId: 't2' })
  expect(ajoutsTentes(vu.journal).map((l) => l.to)).toEqual(['debug'])
  await horloge.advance(60 * 1000)
  expect(depuis()).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  expect(await $.turn.start({ text: 'c', turnId: 't3' })).toEqual({ turnId: 't3' })
  expect(ajoutsTentes(vu.journal).length).toBe(2)
})

test('course : une relecture lancée avant que l’outil retienne la clé k2, rendue après avec l’ajout de k2, ne le met pas en attente', async ($, on) => {
  const horloge = mock.clock(on)
  let etat = lie('k1', 'juge du brief')
  let suspendu = false
  const vu = monde(on, () => etat, () => null, () => suspendu)
  await $.session.start(DEMARRAGE)
  await $.prompt.context({ blocks: [] })
  suspendu = true
  etat = lie('k2', 'juge du diff')
  await horloge.advance(60 * 1000)
  const relecture = vu.argvs.length - 1
  expect(vu.argvs[relecture]?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  suspendu = false
  await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, geste: 'cocher', ticket: 4, texte: 'juge du b' } as never)
  vu.relacher()
  await horloge.advance(0)
  expect(await $.turn.start({ text: 'a', turnId: 't1' })).toEqual({ turnId: 't1' })
  expect(ajoutsTentes(vu.journal)).toEqual([])
})

test('l’outil lance l’édition avec le bon argv, rafraîchit l’état, retient sa clé et vide l’attente (le tour suivant ne la défait pas)', async ($, on) => {
  const horloge = mock.clock(on)
  let etat = lie('k1', 'juge du brief')
  const vu = monde(on, () => etat)
  await $.session.start(DEMARRAGE)
  etat = lie('k2', 'juge du diff')
  const coche = await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, geste: 'cocher', ticket: 4, texte: 'juge du b' } as never)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['9', '--session', SESSION, '--json', '--cocher', '4', 'juge du b'])
  expect(coche.result).toBe(etat.ajout)
  await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, geste: 'ajouter-item', ticket: 7, texte: '#7 nouveau' } as never)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['9', '--session', SESSION, '--json', '--ajouter-item', '#7 nouveau'])
  const ui = await $.ui.mount({ plugin: 'harnais', surface: 'terminal', ...BANDEAU })
  expect(await textes(ui)).toContain('  prochain geste : juge du diff')
  await ui.unmount()
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k2'])
  await $.turn.start({ text: 'a', turnId: 't1' })
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k2'])
})

test('échec du script — code non nul, JSON illisible : rien n’est rendu, une ligne au journal de DÉBOGAGE, l’outil refuse avec le motif', async ($, on) => {
  mock.clock(on)
  let panne = { exitCode: 1, stdout: '', stderr: '[suivi] item #6 absent' }
  const vu = monde(on, () => lie('k1', 'x'), () => panne)
  await $.session.start(DEMARRAGE)
  expect(vu.journal.length).toBe(1)
  expect(vu.journal[0]?.text).toContain('item #6 absent')
  expect(vu.journal[0]?.to).toBe('debug')
  const ui = await $.ui.mount({ plugin: 'harnais', surface: 'terminal', ...BANDEAU })
  expect(await textes(ui)).toEqual(['moteur'])
  await ui.unmount()
  const refus = await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, geste: 'ajouter-etape', ticket: 6, texte: 'x' } as never)
  expect(refus.deny).toBe('[suivi] item #6 absent')
  panne = { exitCode: 0, stdout: 'pas du JSON', stderr: '' }
  await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, geste: 'ajouter-etape', ticket: 6, texte: 'x' } as never)
  expect(vu.journal.at(-1)?.text).toContain('sortie JSON illisible')
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([])
})
