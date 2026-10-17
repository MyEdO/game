// Banc de la fonction `suivi` du mod `harnais` (#2279), sous `claude plugin test` : les hooks de test
// tiennent lieu du moteur et servent `process.run` comme `scripts/ops/suivi.mjs` : le fichier est lu au
// LANCEMENT, `--outil --json` rend la définition de l'outil. Le kit 2.1.289 ne sert pas `$.state` au banc :
// l'atome se lit sur le bandeau, le bloc `suivi` du `prompt.context` et le résultat de l'outil. Aucun tour
// n'écrit dans l'historique de la session (#2596) ; le mur `murs/mod-sans-regle` refuse `$.session.append`.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SESSION = 'session-de-test'
const lie = (digest: string, prochain: string, aMesurer: number[] = []) => ({
  session: SESSION,
  suivis: [{ epique: 9, chemin: '/s/9.json', lignes: ['[suivi #9] en cours : #4 ouvert', `  prochain geste : ${prochain}`] }],
  contexte: `[suivi #9] /s/9.json — digest ${digest}`,
  ajout: `[suivi] situation relue\n[suivi #9] en cours : #4 ouvert\n  prochain geste : ${prochain}`,
  aMesurer,
})
type Etat = ReturnType<typeof lie>
const SANS_LIEN: Etat = { session: SESSION, suivis: [], contexte: '[suivi] session sans suivi lié ; index', ajout: '', aMesurer: [] }
const BANDEAU = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never } as const
const DEMARRAGE = { cwd: '/depot', surface: null, isInteractive: false } as never
type Panne = { exitCode: number; stdout: string; stderr: string }
/** La définition que rend `suivi.mjs --outil --json`, telle quelle. */
const OUTIL = { name: 'suivi', description: 'écrit le suivi', inputSchema: { type: 'object', properties: { epique: { type: 'integer' } } } }
const LOT = [{ geste: 'cocher', ticket: 4, n: 2 }]

/**
 * Le monde sous le mod : `session.id`, et `process.run` qui lit `fichier()` AU LANCEMENT et rend son état
 * comme le lecteur, ou `panne()` quand elle est donnée ; une course lancée quand `suspendre()` est vrai
 * attend `relacher()`, qui rend la plus ancienne. Une MESURE (`--mesurer`) attend `finirMesure()`, qui rend
 * la plus ancienne. Rend les argv lancés (lecteur, mesures), le journal, `relacher` et `finirMesure`.
 */
function monde(on: On, fichier: () => Etat, panne: () => Panne | null = () => null, suspendre: () => boolean = () => false,
  synchro: (argv: readonly string[]) => Panne = () => ({ exitCode: 0, stdout: JSON.stringify({ etat: 'a-jour', sha: 'a', texte: '' }), stderr: '' })) {
  const argvs: string[][] = []
  const synchros: string[][] = []
  const outils: unknown[] = []
  const ordre: string[] = []
  const journal: { text: string; to?: string }[] = []
  const suspendues: (() => void)[] = []
  const mesures: string[][] = []
  const mesuresSuspendues: (() => void)[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => {
    outils.push(e)
    return { value: { tool: `mcp__harnais__${e.name}` } }
  })
  on('session.id', async () => ({ value: SESSION }))
  on('prompt.context', async (_$, e) => ({ blocks: e.blocks }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, { key: 'moteur' }, 'moteur') as RenderElement
  })
  on('process.run', async (_$, e) => {
    if (e.argv[1]?.endsWith('/scripts/ops/synchroniser.mjs')) {
      synchros.push([...e.argv])
      ordre.push('synchroniser')
      return { value: { ...synchro(e.argv.slice(2)), isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (e.argv.includes('--mesurer')) {
      mesures.push([...e.argv])
      await new Promise<void>((finie) => { mesuresSuspendues.push(finie) })
      return { value: { exitCode: 0, stdout: JSON.stringify({ epique: 9 }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (e.argv.includes('--outil')) {
      ordre.push('outil')
      return { value: { exitCode: 0, stdout: JSON.stringify(OUTIL), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    ordre.push('suivi')
    argvs.push([...e.argv])
    const lu = fichier()
    const enPanne = panne()
    if (suspendre()) await new Promise<void>((relache) => { suspendues.push(relache) })
    if (enPanne) return { value: { ...enPanne, isStdoutTruncated: false, isStderrTruncated: false } }
    return { value: { exitCode: 0, stdout: JSON.stringify(lu), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.log', async (_$, e) => {
    journal.push({ text: e.text, to: e.to })
    return { value: undefined } as never
  })
  return { argvs, synchros, outils, ordre, journal, mesures, relacher: () => suspendues.shift()?.(), finirMesure: () => mesuresSuspendues.shift()?.() }
}

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

test('`aMesurer` (#2460) : chaque relecture lance `--mesurer --sans-fetch --json` pour CHAQUE épique de `aMesurer` ; le verrou du script dédoublonne, pas le mod', async ($, on) => {
  const horloge = mock.clock(on)
  const vu = monde(on, () => lie('k1', 'juge du brief', [9, 12]))
  await $.session.start(DEMARRAGE)
  await horloge.advance(0)
  expect(vu.mesures.map((argv) => argv.slice(2))).toEqual([['9', '--mesurer', '--sans-fetch', '--json'], ['12', '--mesurer', '--sans-fetch', '--json']])
  expect(vu.mesures[0]?.[1]?.endsWith('/../../../scripts/ops/suivi.mjs')).toBe(true)
  await horloge.advance(60 * 1000)
  expect([vu.argvs.length, vu.mesures.length]).toEqual([2, 4])
  for (let k = 0; k < 4; k += 1) vu.finirMesure()
  await horloge.advance(0)
})

test('sans `aMesurer`, aucune mesure n’est lancée', async ($, on) => {
  const horloge = mock.clock(on)
  const vu = monde(on, () => lie('k1', 'juge du brief'))
  await $.session.start(DEMARRAGE)
  await horloge.advance(60 * 1000)
  expect([vu.argvs.length, vu.mesures.length]).toEqual([2, 0])
})

test('session.start : `synchroniser.mjs --json` AVANT le lecteur ; `a-jour` ne dit rien (#2187) ; l’outil enregistré est CELUI que rend `--outil --json` (#2460)', async ($, on) => {
  mock.clock(on)
  const vu = monde(on, () => SANS_LIEN)
  await $.session.start(DEMARRAGE)
  expect(vu.ordre).toEqual(['synchroniser', 'suivi', 'outil'])
  expect(vu.outils).toEqual([OUTIL])
  expect(vu.synchros[0]?.slice(2)).toEqual(['--json'])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
})

test('le `texte` d’un état de synchronisation nommé (code 1) entre UNE fois en contexte, tel quel (#2187, #2493)', async ($, on) => {
  mock.clock(on)
  const texte = '[synchroniser] principal refusé (conflit) : a.md — reprise : `npm run ops:synchroniser`'
  const conflit = { etat: 'conflit', chemins: [{ chemin: 'a.md', raison: 'fusion de a.md en conflit' }], versions: '/v', texte }
  monde(on, () => SANS_LIEN, () => null, () => false, () => ({ exitCode: 1, stdout: JSON.stringify(conflit), stderr: '' }))
  await $.session.start(DEMARRAGE)
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([
    { name: 'synchroniser', text: texte },
    { name: 'suivi', text: SANS_LIEN.contexte },
  ])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
})

test('`avance` dont le post-merge court en fond : son `texte` en contexte, une fois (#2493)', async ($, on) => {
  mock.clock(on)
  const texte = '[synchroniser] principal avancé de aaaaaaaaa à bbbbbbbbb ; post-merge aaaaaaaaa..bbbbbbbbb en fond : PID 7 depuis 2026-10-08T10:00:00.000Z (3 s), issue : /l/7.log'
  const avance = { etat: 'avance', de: 'a'.repeat(40), vers: 'b'.repeat(40), configurationClientChangee: [], texte }
  const vu = monde(on, () => SANS_LIEN, () => null, () => false, () => ({ exitCode: 0, stdout: JSON.stringify(avance), stderr: '' }))
  await $.session.start(DEMARRAGE)
  expect(vu.synchros.map((argv) => argv.slice(2))).toEqual([['--json']])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([
    { name: 'synchroniser', text: texte },
    { name: 'suivi', text: SANS_LIEN.contexte },
  ])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
})

test('synchroniseur sorti sans état (code 1, stdout vide) : le motif et la re-mesure `--mesurer --json`, une fois (#2493)', async ($, on) => {
  mock.clock(on)
  const ligne = 'interrompu : avance aaaaaaaaa..bbbbbbbbb entamée (étape avance), HEAD bbbbbbbbb — reprise due (journal /j)'
  const mesure = { etat: 'interrompu', mesure: true, ligne, texte: `[synchroniser] principal ${ligne}` }
  const vu = monde(on, () => SANS_LIEN, () => null, () => false, (argv) => (argv.includes('--mesurer')
    ? { exitCode: 1, stdout: JSON.stringify(mesure), stderr: '' }
    : { exitCode: 1, stdout: '', stderr: 'tué' }))
  await $.session.start(DEMARRAGE)
  expect(vu.synchros.map((argv) => argv.slice(2))).toEqual([['--json'], ['--mesurer', '--json']])
  expect((await $.prompt.context({ blocks: [] })).blocks[0]).toEqual({ name: 'synchroniser', text: `[synchroniser] principal : synchroniseur sorti sans état (sortie JSON illisible) ; re-mesure : ${ligne}` })
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
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

test('prompt.context porte le bloc `suivi` de l’état relu ; un tour passe sans rien écrire, ni à l’historique ni au journal (#2596)', async ($, on) => {
  const horloge = mock.clock(on)
  let fichier = lie('k1', 'juge du brief')
  const vu = monde(on, () => fichier)
  await $.session.start(DEMARRAGE)
  const contexte = await $.prompt.context({ blocks: [{ name: 'currentDate', text: 'x' }] })
  expect(contexte.blocks).toEqual([{ name: 'currentDate', text: 'x' }, { name: 'suivi', text: fichier.contexte }])
  fichier = lie('k2', 'juge du diff')
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json'])
  expect(await $.turn.start({ text: 'a', turnId: 't1' })).toEqual({ turnId: 't1' })
  expect(vu.journal).toEqual([])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: fichier.contexte }])
})

test('course C2 : une relecture LANCÉE avant l’édition de l’outil et rendue après est ignorée — le bandeau ne régresse pas', async ($, on) => {
  const horloge = mock.clock(on)
  let fichier = lie('k1', 'juge du brief')
  let suspendu = false
  const vu = monde(on, () => fichier, () => null, () => suspendu)
  await $.session.start(DEMARRAGE)
  await $.prompt.context({ blocks: [] })
  fichier = lie('k2', 'juge du diff')
  suspendu = true
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json'])
  suspendu = false
  fichier = lie('k3', 'publier')
  await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, mutations: LOT } as never)
  vu.relacher()
  await horloge.advance(0)
  const ui = await $.ui.mount({ plugin: 'harnais', surface: 'terminal', ...BANDEAU })
  expect(await textes(ui)).toEqual(['[suivi #9] en cours : #4 ouvert', '  prochain geste : publier'])
  await ui.unmount()
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: fichier.contexte }])
})

test('l’outil passe son lot ENTIER par `--lot <json>` (#2460), rafraîchit l’état et rend la situation datée en résultat', async ($, on) => {
  mock.clock(on)
  let fichier = lie('k1', 'juge du brief')
  const vu = monde(on, () => fichier)
  await $.session.start(DEMARRAGE)
  fichier = lie('k2', 'juge du diff')
  const lot = [{ geste: 'cocher', ticket: 4, n: 1 }, { geste: 'ajouter-etape', ticket: 4, texte: 'tour 10 publié' }]
  const coche = await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, mutations: lot } as never)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['9', '--session', SESSION, '--json', '--lot', JSON.stringify({ epique: 9, mutations: lot })])
  expect(coche.result).toBe(fichier.ajout)
  const ui = await $.ui.mount({ plugin: 'harnais', surface: 'terminal', ...BANDEAU })
  expect(await textes(ui)).toContain('  prochain geste : juge du diff')
  await ui.unmount()
})

test('échec du script — code non nul, JSON illisible : le dernier état VALIDE est gardé (bandeau, contexte), une ligne au journal de DÉBOGAGE, l’outil refuse avec le motif', async ($, on) => {
  const horloge = mock.clock(on)
  let panne: Panne | null = null
  const vu = monde(on, () => lie('k1', 'juge du brief'), () => panne)
  await $.session.start(DEMARRAGE)
  panne = { exitCode: 1, stdout: '', stderr: '[suivi] item #6 absent' }
  await horloge.advance(60 * 1000)
  expect(vu.journal.length).toBe(1)
  expect(vu.journal[0]?.text).toContain('item #6 absent')
  expect(vu.journal[0]?.to).toBe('debug')
  const ui = await $.ui.mount({ plugin: 'harnais', surface: 'terminal', ...BANDEAU })
  expect(await textes(ui)).toEqual(['[suivi #9] en cours : #4 ouvert', '  prochain geste : juge du brief'])
  await ui.unmount()
  const refus = await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, mutations: [{ geste: 'ajouter-etape', ticket: 6, texte: 'x' }] } as never)
  expect(refus.deny).toBe('[suivi] item #6 absent')
  panne = { exitCode: 0, stdout: 'pas du JSON', stderr: '' }
  await horloge.advance(60 * 1000)
  expect(vu.journal.at(-1)?.text).toContain('sortie JSON illisible')
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: lie('k1', '').contexte }])
})
