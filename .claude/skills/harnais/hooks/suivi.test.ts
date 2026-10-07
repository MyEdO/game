// Banc de la fonction `suivi` du mod `harnais` (#2279), sous `claude plugin test` : les hooks de test
// tiennent lieu du moteur et servent `process.run` comme `scripts/ops/suivi.mjs` : le fichier est lu au
// LANCEMENT, `ajout` vide quand `--depuis` vaut la clé lue, `--outil --json` rend la définition de l'outil. Le kit 2.1.289 ne sert ni le
// `$.session.append` d'un plugin ni `$.state` au banc : l'atome se lit sur le `--depuis` de la relecture
// suivante (la clé retenue), sur le bandeau (l'état gardé), et une tentative d'ajout sur le journal de
// débogage, où le kit la fait échouer. Le chemin de succès de l'ajout se prouve en session réelle (DoD #2279).
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SESSION = 'session-de-test'
const lie = (cle: string, prochain: string, aMesurer: number[] = []) => ({
  session: SESSION,
  suivis: [{ epique: 9, chemin: '/s/9.json', lignes: ['[suivi #9] en cours : #4 ouvert', `  prochain geste : ${prochain}`] }],
  contexte: `[suivi #9] /s/9.json — digest ${cle}`,
  ajout: `[suivi] situation relue\n[suivi #9] en cours : #4 ouvert\n  prochain geste : ${prochain}`,
  cle,
  aMesurer,
})
type Etat = ReturnType<typeof lie>
const SANS_LIEN: Etat = { session: SESSION, suivis: [], contexte: '[suivi] session sans suivi lié ; index', ajout: '', cle: 'vide', aMesurer: [] }
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
  synchro: () => Panne = () => ({ exitCode: 0, stdout: JSON.stringify({ etat: 'a-jour', sha: 'a' }), stderr: '' })) {
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
      return { value: { ...synchro(), isStdoutTruncated: false, isStderrTruncated: false } }
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
    const depuis = e.argv.indexOf('--depuis')
    const rendu = depuis >= 0 && e.argv[depuis + 1] === lu.cle ? { ...lu, ajout: '' } : lu
    return { value: { exitCode: 0, stdout: JSON.stringify(rendu), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.log', async (_$, e) => {
    journal.push({ text: e.text, to: e.to })
    return { value: undefined } as never
  })
  return { argvs, synchros, outils, ordre, journal, mesures, relacher: () => suspendues.shift()?.(), finirMesure: () => mesuresSuspendues.shift()?.() }
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

test('un état de synchronisation nommé (code 1) entre UNE fois en contexte, tel quel ; un échec de lancement aussi (#2187)', async ($, on) => {
  mock.clock(on)
  const conflit = { etat: 'conflit', chemins: [{ chemin: 'a.md', raison: 'fusion de a.md en conflit' }], versions: '/v' }
  monde(on, () => SANS_LIEN, () => null, () => false, () => ({ exitCode: 1, stdout: JSON.stringify(conflit), stderr: '' }))
  await $.session.start(DEMARRAGE)
  const reprise = ' — reprise : `npm run ops:synchroniser`'
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([
    { name: 'synchroniser', text: `[synchroniser] principal : ${JSON.stringify(conflit)}${reprise}` },
    { name: 'suivi', text: SANS_LIEN.contexte },
  ])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
})

test('`avance` avec configuration client changée : en contexte, une fois, les chemins de la configuration d’avant (#2187 commentaire 6029118597, C4)', async ($, on) => {
  mock.clock(on)
  const avance = { etat: 'avance', de: 'a', vers: 'b', configurationClientChangee: ['.claude/settings.json'] }
  monde(on, () => SANS_LIEN, () => null, () => false, () => ({ exitCode: 0, stdout: JSON.stringify(avance), stderr: '' }))
  await $.session.start(DEMARRAGE)
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([
    { name: 'synchroniser', text: `[synchroniser] principal : ${JSON.stringify(avance)} — la session tourne sur la configuration d'avant : .claude/settings.json` },
    { name: 'suivi', text: SANS_LIEN.contexte },
  ])
  expect((await $.prompt.context({ blocks: [] })).blocks).toEqual([{ name: 'suivi', text: SANS_LIEN.contexte }])
})

test('synchroniseur muet (code 1, stdout vide) : le motif en contexte, une fois (#2187)', async ($, on) => {
  mock.clock(on)
  monde(on, () => SANS_LIEN, () => null, () => false, () => ({ exitCode: 1, stdout: '', stderr: 'tué' }))
  await $.session.start(DEMARRAGE)
  expect((await $.prompt.context({ blocks: [] })).blocks[0]).toEqual({ name: 'synchroniser', text: '[synchroniser] principal non synchronisé : sortie JSON illisible — reprise : `npm run ops:synchroniser`' })
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
  let fichier = lie('k1', 'juge du brief')
  const vu = monde(on, () => fichier)
  await $.session.start(DEMARRAGE)
  const contexte = await $.prompt.context({ blocks: [{ name: 'currentDate', text: 'x' }] })
  expect(contexte.blocks).toEqual([{ name: 'currentDate', text: 'x' }, { name: 'suivi', text: fichier.contexte }])
  const depuis = () => vu.argvs.at(-1)?.slice(2)
  await horloge.advance(60 * 1000)
  expect(depuis()).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  expect(await $.turn.start({ text: 'a', turnId: 't1' })).toEqual({ turnId: 't1' })
  expect(ajoutsTentes(vu.journal)).toEqual([])
  fichier = lie('k2', 'juge du diff')
  await horloge.advance(60 * 1000)
  expect(depuis()).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  expect(await $.turn.start({ text: 'b', turnId: 't2' })).toEqual({ turnId: 't2' })
  expect(ajoutsTentes(vu.journal).map((l) => l.to)).toEqual(['debug'])
  await horloge.advance(60 * 1000)
  expect(depuis()).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  expect(await $.turn.start({ text: 'c', turnId: 't3' })).toEqual({ turnId: 't3' })
  expect(ajoutsTentes(vu.journal).length).toBe(2)
})

test('course C2 : une relecture LANCÉE avant l’édition de l’outil et rendue après est ignorée — ni bandeau qui régresse, ni ajout antérieur en attente', async ($, on) => {
  const horloge = mock.clock(on)
  let fichier = lie('k1', 'juge du brief')
  let suspendu = false
  const vu = monde(on, () => fichier, () => null, () => suspendu)
  await $.session.start(DEMARRAGE)
  await $.prompt.context({ blocks: [] })
  fichier = lie('k2', 'juge du diff')
  suspendu = true
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  suspendu = false
  fichier = lie('k3', 'publier')
  await $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, mutations: LOT } as never)
  vu.relacher()
  await horloge.advance(0)
  const ui = await $.ui.mount({ plugin: 'harnais', surface: 'terminal', ...BANDEAU })
  expect(await textes(ui)).toEqual(['[suivi #9] en cours : #4 ouvert', '  prochain geste : publier'])
  await ui.unmount()
  expect(await $.turn.start({ text: 'a', turnId: 't1' })).toEqual({ turnId: 't1' })
  expect(ajoutsTentes(vu.journal)).toEqual([])
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k3'])
})

test('course C2, variante étroite : une relecture lancée PENDANT le script de l’outil, qui lit déjà son écriture, et rendue après lui est ignorée — l’ajout de l’outil n’est pas remis en attente', async ($, on) => {
  const horloge = mock.clock(on)
  let fichier = lie('k1', 'juge du brief')
  let suspendu = false
  const vu = monde(on, () => fichier, () => null, () => suspendu)
  await $.session.start(DEMARRAGE)
  await $.prompt.context({ blocks: [] })
  suspendu = true
  fichier = lie('k3', 'publier')
  const outil = $.tool.call({ tool: 'mcp__harnais__suivi', epique: 9, mutations: LOT } as never)
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k1'])
  suspendu = false
  vu.relacher()
  expect((await outil).result).toBe(fichier.ajout)
  vu.relacher()
  await horloge.advance(0)
  expect(await $.turn.start({ text: 'a', turnId: 't1' })).toEqual({ turnId: 't1' })
  expect(ajoutsTentes(vu.journal)).toEqual([])
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k3'])
})

test('l’outil passe son lot ENTIER par `--lot <json>` (#2460), rafraîchit l’état, retient sa clé et vide l’attente', async ($, on) => {
  const horloge = mock.clock(on)
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
  await $.turn.start({ text: 'a', turnId: 't1' })
  expect(ajoutsTentes(vu.journal)).toEqual([])
  await horloge.advance(60 * 1000)
  expect(vu.argvs.at(-1)?.slice(2)).toEqual(['--session', SESSION, '--json', '--depuis', 'k2'])
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
