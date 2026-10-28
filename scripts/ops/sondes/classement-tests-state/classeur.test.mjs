// CONTRAT des fonctions pures du classement des tests de `src/state` (#3058, lot 1) : clés du store lues par le
// vérificateur, cas canonique de chaque classe sur des sources fictives en mémoire, signaux, citations. Lancé par
// `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { analyserTexte } from '../../../guards/lib/dialecte.mjs'
import { VIRTUAL_ROOT, libererSessions, virtualProgram } from '../../../guards/lib/tsProgram.mjs'
import {
  STORE, TYPES_DE_L_ADAPTATEUR, TYPE_DE_L_ETAT, arcsDuTest, cheminsCites, classer, clesDesTypes, clesDuStore,
  estHorsStore, estTest, lireUnTest, proceduresDeLHote, signauxDuTest,
} from './classeur.mjs'

const STORE_FICTIF = {
  'src/noyau/etat.ts': [
    'export interface EtatDeJeu { party: string[]; screen: string }',
    'export interface ActionsDuNoyau { startBattle: () => void }',
    'export type Jeu = EtatDeJeu & ActionsDuNoyau',
  ].join('\n'),
  [STORE]: [
    "import type { Jeu } from '../noyau/etat'",
    'interface Vue { zoom: number }',
    'export interface EtatDeLAdaptateur extends Vue { camRot: number }',
    'export interface ActionsDeLAdaptateur { setZoom: (z: number) => void }',
    'export type GameState = Jeu & EtatDeLAdaptateur & ActionsDeLAdaptateur',
  ].join('\n'),
}

test('clesDesTypes + clesDuStore : adaptateur = les deux interfaces (héritage compris), jeu = GameState hors adaptateur', () => {
  const session = virtualProgram(STORE_FICTIF)
  try {
    const cles = clesDuStore(clesDesTypes(session, path.resolve(VIRTUAL_ROOT, STORE).split('\\').join('/'), [TYPE_DE_L_ETAT, ...TYPES_DE_L_ADAPTATEUR]))
    assert.deepEqual([...cles.adaptateur].sort(), ['camRot', 'setZoom', 'zoom'])
    assert.deepEqual([...cles.jeu].sort(), ['party', 'screen', 'startBattle'])
  } finally {
    libererSessions([session])
  }
})

test('clesDesTypes : un type absent du fichier lève', () => {
  const session = virtualProgram(STORE_FICTIF)
  try {
    assert.throws(() => clesDesTypes(session, path.resolve(VIRTUAL_ROOT, STORE).split('\\').join('/'), ['Absent']), /Absent/)
  } finally {
    libererSessions([session])
  }
})

const RACINE = '/depot'
const ARBRE = new Set([
  STORE, 'src/state/stagePan.ts', 'src/state/combat.testkit.ts', 'src/engine/tests.ts',
  'src/hote/sauvegardes.ts', 'src/hote/roster.ts',
].map((c) => `${RACINE}/${c}`))
const lire = (rel, lignes) => {
  const { sourceFile, diagnostics } = analyserTexte({ rel, text: lignes.join('\n') })
  const lecture = lireUnTest(rel, sourceFile, diagnostics)
  return { lecture, arcs: arcsDuTest(lecture, { racine: RACINE, existe: (abs) => ARBRE.has(abs), alias: [] }) }
}
const CONTEXTE = {
  adaptateur: new Set(['zoom', 'setZoom', 'camRot']),
  jeu: new Set(['party', 'screen', 'startBattle']),
  horsStore: new Map([['src/hote/sauvegardes.ts#lireLaSauvegarde', ['src/hote/sauvegardes.hors-store.test.ts']]]),
}

test('noyau : le store importé, seules des clés du jeu lues', () => {
  const t = lire('src/state/combat.test.ts', [
    "import { useGame } from './store'",
    'useGame.getState().startBattle()',
    'const { party } = useGame.getState()',
  ])
  assert.equal(classer(t, CONTEXTE).classe, 'noyau')
})

test('noyau : un banc de src/state porte le store, il n\'est pas un module web', () => {
  const t = lire('src/state/flux.test.ts', ["import { ouvrir } from './combat.testkit'", 'ouvrir().party'])
  assert.deepEqual(classer(t, CONTEXTE), { classe: 'noyau', base: 'noyau', clesAdaptateur: [], clesJeu: 1, modulesWeb: [], doublons: [] })
})

test('web : une clé de l\'adaptateur lue, aucune du jeu', () => {
  const t = lire('src/state/camera.test.ts', ["import { useGame } from './store'", 'useGame.getState().setZoom(2)', "useGame.setState({ camRot: 1 })"])
  const c = classer(t, CONTEXTE)
  assert.equal(c.classe, 'web')
  assert.deepEqual(c.clesAdaptateur, ['camRot', 'setZoom'])
})

test('web : un module de src/state hors store et hors banc importé', () => {
  const t = lire('src/state/stagePan.test.ts', ["import { pan } from './stagePan'", 'pan(1)'])
  assert.deepEqual(classer(t, CONTEXTE).modulesWeb, ['src/state/stagePan.ts'])
  assert.equal(classer(t, CONTEXTE).classe, 'web')
})

test('mixte : une clé de l\'adaptateur et une clé du jeu lues', () => {
  const t = lire('src/ui/Vue.test.tsx', ["import { useGame } from '../state/store'", 'useGame.getState().zoom', "useGame.getState()['screen']"])
  assert.equal(classer(t, CONTEXTE).classe, 'mixte')
})

test('moteur : aucun arc d\'exécution vers src/state — un import de type seul n\'en est pas un', () => {
  const t = lire('src/state/regle.test.ts', [
    "import { rollTest } from '../engine/tests'",
    "import type { GameState } from './store'",
    'const s = {} as GameState; s.zoom; s.party; rollTest()',
  ])
  assert.equal(classer(t, CONTEXTE).classe, 'moteur')
})

test('doublon : une procédure de src/hote qu\'un test hors store importe déjà ; base gardée', () => {
  const t = lire('src/state/saves-flow.test.ts', [
    "import { useGame } from './store'",
    "import { lireLaSauvegarde } from '../hote/sauvegardes'",
    "import { ajouterAuRoster } from '../hote/roster'",
    'useGame.getState().party; lireLaSauvegarde(); ajouterAuRoster()',
  ])
  const c = classer(t, CONTEXTE)
  assert.equal(c.classe, 'doublon')
  assert.equal(c.base, 'noyau')
  assert.deepEqual(c.doublons, [{ procedure: 'src/hote/sauvegardes.ts#lireLaSauvegarde', tests: ['src/hote/sauvegardes.hors-store.test.ts'] }])
  assert.deepEqual(proceduresDeLHote(t.arcs), ['src/hote/roster.ts#ajouterAuRoster', 'src/hote/sauvegardes.ts#lireLaSauvegarde'])
})

test('signaux : minuteries posées et avancées, cadence auto par setCadence, par initCombatAuto ; « auto » seul n\'en est pas une', () => {
  const horloge = lire('src/state/a.test.ts', ['vi.useFakeTimers()', 'vi.advanceTimersByTime(10)', 'vi.runOnlyPendingTimers()', "setCadence('auto')"])
  assert.deepEqual(signauxDuTest(horloge.lecture), { poseLHorloge: true, avanceLHorloge: ['advanceTimersByTime', 'runOnlyPendingTimers'], cadenceAuto: true })
  assert.equal(signauxDuTest(lire('src/state/b.test.ts', ['initCombatAuto()']).lecture).cadenceAuto, true)
  assert.deepEqual(signauxDuTest(lire('src/state/c.test.ts', ["const mode = 'auto'"]).lecture), { poseLHorloge: false, avanceLHorloge: [], cadenceAuto: false })
})

test('estTest, estHorsStore : une suite, et une suite hors store du noyau ou de ses hôtes seulement', () => {
  assert.equal(estTest('src/state/a.test.tsx'), true)
  assert.equal(estTest('src/state/a.testkit.ts'), false)
  assert.equal(estHorsStore('src/hote/sauvegardes.hors-store.test.ts'), true)
  assert.equal(estHorsStore('src/hote/coop/session.hors-store.test.ts'), true)
  assert.equal(estHorsStore('src/noyau/coop.hors-store.test.ts'), true)
  assert.equal(estHorsStore('src/state/x.hors-store.test.ts'), false)
  assert.equal(estHorsStore('src/hote/sauvegardes.test.ts'), false)
})

test('cheminsCites : chemins de tests de src/state, sans doublon, triés ; un module non test n\'en est pas un', () => {
  const texte = "'src/state/b.test.ts', \"src/state/combat/a.test.tsx\" src/state/b.test.ts src/state/store.ts src/ui/x.test.ts"
  assert.deepEqual(cheminsCites(texte), ['src/state/b.test.ts', 'src/state/combat/a.test.tsx'])
})
