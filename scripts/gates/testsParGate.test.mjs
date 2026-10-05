// COUVERTURE DE LA RÉPARTITION DES TESTS `scripts/**` (#1759).
//   node --test scripts/gates/testsParGate.test.mjs   (joué par `npm run test:hooks`, racine scripts/gates)
//
// Ce que cette garde tient : tout test `scripts/**/*.test.mjs` de l'arbre RÉEL est joué par
// EXACTEMENT UNE gate. Un test qu'aucune racine ne prend ne serait jamais joué — et rien ne le
// dirait : c'est exactement ce qui est arrivé à `spawnResilient.test.mjs` (né le 2026-09-04) et à
// `canauxMecaniques.test.mjs` (né le 2026-09-13) du temps des listes écrites à la main.
// Le verdict est NOMINATIF : il nomme le fichier, jamais un cardinal.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gatesDeCi } from './gatesDeCi.mjs'
import { GATES, RACINES, couverture, gateDe, listerTests, testsDe } from './testsParGate.mjs'
import { gitDe, gitDeLArbreReel } from '../test/gitDeBanc.mjs'

const RACINE = gitDeLArbreReel(undefined, { net: true })('rev-parse', '--show-toplevel')
const listerReel = () => listerTests(RACINE)

test('aucun test de `scripts/**` n’est orphelin, aucun n’est joué deux fois', () => {
  const tests = listerReel()
  assert.ok(tests.length > 0, 'aucun test trouvé sous scripts/ — la découverte est muette, pas verte')
  const { orphelins, doublons } = couverture(listerReel)
  assert.deepEqual(
    orphelins,
    [],
    'ces tests ne sont joués par AUCUNE gate : ajoute leur répertoire aux racines d’une gate ' +
      '(scripts/gates/testsParGate.mjs), ou déplace-les sous une racine existante',
  )
  assert.deepEqual(doublons, [], 'ces tests tombent sous DEUX gates : une racine appartient à une seule gate')
})

test('la somme des gates rend exactement les tests de l’arbre', () => {
  const joues = GATES.flatMap((gate) => testsDe(gate, listerReel)).sort()
  assert.deepEqual(joues, listerReel(), 'un test découvert et non joué est un test qui ment au vert')
  for (const gate of GATES)
    assert.ok(testsDe(gate, listerReel).length > 0, `${gate} : racines ${RACINES[gate].join(', ')} sans aucun test`)
})

test('un test déposé hors de toute racine est NOMMÉ rouge', () => {
  const inconnu = 'scripts/zzz/rien-ne-le-joue.test.mjs'
  const { orphelins, doublons } = couverture(() => [...listerReel(), inconnu])
  assert.deepEqual(orphelins, [inconnu])
  assert.deepEqual(doublons, [])
  assert.equal(gateDe(inconnu), null)
})

test('une racine prise par DEUX gates est NOMMÉE rouge', () => {
  const partage = 'scripts/hooks/exemple.test.mjs'
  // La table du dépôt est GELÉE : le cas se joue sur une COPIE passée en paramètre.
  const racines = { ...RACINES, 'test:ops': [...RACINES['test:ops'], 'scripts/hooks'] }
  const { doublons } = couverture(() => [partage], racines)
  assert.deepEqual(doublons, [{ test: partage, gates: ['test:hooks', 'test:ops'] }])
  assert.equal(gateDe(partage, racines), null, 'un test que deux gates prennent n’a pas de propriétaire')
  assert.equal(gateDe(partage), 'test:hooks', 'la table du dépôt n’a pas bougé')
})

/** Les scripts de `package.json` qui délèguent au lanceur : `{ nom du script -> gate passée }`. */
function scriptsDuLanceur() {
  const scripts = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).scripts ?? {}
  const par = {}
  for (const [nom, commande] of Object.entries(scripts)) {
    const m = /^node scripts\/test\/node-tests\.mjs\s+(\S+)$/.exec(commande)
    if (m) par[nom] = m[1]
  }
  return par
}

test('propriété = EXÉCUTION : la table, package.json et ci.yml nomment le MÊME ensemble de gates', () => {
  const parScript = scriptsDuLanceur()
  for (const [nom, gate] of Object.entries(parScript))
    assert.equal(gate, nom, `« ${nom} » lance le runner sur « ${gate} » : le nom du script EST le nom de la gate`)
  assert.deepEqual(
    Object.keys(parScript).sort(),
    [...GATES].sort(),
    'une gate de RACINES sans script `node scripts/test/node-tests.mjs <gate>` dans package.json (ou l’inverse) : ' +
      'une table qui répartit des tests que personne ne lance ne prouve rien',
  )
  const enCi = gatesDeCi({ cwd: RACINE })
    .map((g) => g.nom)
    .filter((nom) => nom.startsWith('test:'))
  assert.deepEqual(
    enCi.sort(),
    [...GATES].sort(),
    'les steps `npm run test:*` de .github/workflows/ci.yml doivent être exactement les gates de RACINES : ' +
      'une gate hors CI joue dans le vide, un step hors table joue une liste que personne ne tient',
  )
})

test('une gate ajoutée à la table sans script ni step est NOMMÉE', () => {
  const parScript = { ...scriptsDuLanceur() }
  const gatesAvecUneDeTrop = [...GATES, 'test:zzz']
  assert.notDeepEqual(Object.keys(parScript).sort(), gatesAvecUneDeTrop.sort())
  const manquantes = gatesAvecUneDeTrop.filter((g) => !(g in parScript))
  assert.deepEqual(manquantes, ['test:zzz'], 'le verdict nomme la gate sans lanceur')
})

test('la racine `scripts/*` ne prend que les fichiers DIRECTS de scripts/', () => {
  assert.equal(gateDe('scripts/lancer-local.test.mjs'), 'test:runner')
  assert.equal(gateDe('scripts/test/run.test.mjs'), 'test:runner')
  assert.equal(gateDe('scripts/guards/lib/lister.test.mjs'), 'test:hooks', 'une racine est RÉCURSIVE')
  assert.equal(gateDe('scripts/docs/lib/enregistreur-lectures.test.mjs'), 'test:docs')
})

test('la découverte prend le test NEUF (pas encore indexé) et laisse l’IGNORÉ (#1812)', () => {
  // Dépôt JETABLE sous os.tmpdir() — l'arbre du projet n'est jamais écrit : la parité « ce que la CI
  // joue = ce qui est dans l'arbre » ne se mesure pas autrement. Une garde qui vient d'être écrite
  // n'est pas indexée : la lister par les seuls fichiers suivis la rendrait verte par ABSENCE.
  const racine = mkdtempSync(join(tmpdir(), 'testsParGate-'))
  try {
    const git = gitDe(racine)
    git('init', '-q')
    git('config', 'user.email', 'banc@local')
    git('config', 'user.name', 'banc')
    mkdirSync(join(racine, 'scripts', 'hooks'), { recursive: true })
    writeFileSync(join(racine, '.gitignore'), 'scripts/hooks/ignore.test.mjs\n')
    writeFileSync(join(racine, 'scripts', 'hooks', 'suivi.test.mjs'), '// suivi\n')
    writeFileSync(join(racine, 'scripts', 'hooks', 'neuf.test.mjs'), '// écrit, pas encore ajouté\n')
    writeFileSync(join(racine, 'scripts', 'hooks', 'ignore.test.mjs'), '// hors dépôt\n')
    git('add', '.gitignore', 'scripts/hooks/suivi.test.mjs')
    git('commit', '-q', '-m', 'banc')
    const lister = () => listerTests(racine)
    assert.deepEqual(lister(), ['scripts/hooks/neuf.test.mjs', 'scripts/hooks/suivi.test.mjs'])
    assert.deepEqual(testsDe('test:hooks', lister), ['scripts/hooks/neuf.test.mjs', 'scripts/hooks/suivi.test.mjs'])
    assert.deepEqual(couverture(lister), { orphelins: [], doublons: [] })
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une gate inconnue de la table est refusée, pas jouée à vide', () => {
  assert.throws(() => testsDe('test:inexistante', listerReel), /gate inconnue/)
})
