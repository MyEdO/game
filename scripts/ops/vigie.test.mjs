// La vigie (#2280, V4) : la mesure instantanée `{ ligne, transitions, etat }`, ses transitions calculées
// depuis l'état décodé, et ses mémoires machine des mesures distantes (#2603).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CiIllisible, FRAICHEUR_MS, decoder, executer, encoder, ligneDe, memoireMachine, optionsDe, tick, transitionsDe, verdictDeCi } from './vigie.mjs'
import { cheminsDeJournal, journalVide } from './publier.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const jeter = (d) => rmSync(d, { recursive: true, force: true })
const train = (etat, extra = {}) => ({ run: '7-1', seq: 3, etat, etape: 'pr', rang: 4, total: 7, ...extra })
const mesure = ({ main = { sha: A, verdict: 'verte' }, branche = { nom: 'chantier/9', sha: B, verdict: 'en-vol' }, t = train('en-vol') } = {}) => ({ main, branche, train: t })
const minimal = (m) => ({ main: m.main, branche: m.branche, train: { run: m.train.run, seq: m.train.seq, etat: m.train.etat } })

test('optionsDe : `--json` et `--arbre <racine>` exigés, `--depuis <etat>` facultatif', () => {
  assert.deepEqual(optionsDe(['--json', '--arbre', '/r']), { arbre: '/r', depuis: null })
  assert.deepEqual(optionsDe(['--arbre', '/r', '--json', '--depuis', 'xyz']), { arbre: '/r', depuis: 'xyz' })
  for (const argv of [[], ['--json'], ['--arbre', '/r'], ['--json', '--arbre'], ['--json', '--arbre', '--depuis', 'x'], ['--json', '--arbre', '/r', '--x']])
    assert.equal(optionsDe(argv), null, argv.join(' '))
})

test('encoder / decoder : l’état fait l’aller-retour ; un `--depuis` absent ou illisible est un PREMIER tick', () => {
  const etat = minimal(mesure())
  assert.match(encoder(etat), /^[\w-]+$/, 'un seul jeton d’argv, sans guillemet ni espace')
  assert.deepEqual(decoder(encoder(etat)), etat)
  for (const texte of [null, '', 'pas du base64 ¤', encoder({ autre: 1 }), encoder(null)]) assert.equal(decoder(texte), null, String(texte))
})

test('transitionsDe : une CI qui ATTEINT un verdict final se signale une fois ; en vol et inchangée, rien', () => {
  const avant = minimal(mesure())
  assert.deepEqual(transitionsDe(avant, mesure()), [])
  assert.deepEqual(transitionsDe(avant, mesure({ branche: { nom: 'chantier/9', sha: B, verdict: 'rouge' } })), ['CI chantier/9 ROUGE (bbbbbbbbb)'])
  assert.deepEqual(transitionsDe(avant, mesure({ branche: { nom: 'chantier/9', sha: B, verdict: 'annulee' } })), ['CI chantier/9 annulée (bbbbbbbbb)'])
  const rougi = minimal(mesure({ branche: { nom: 'chantier/9', sha: B, verdict: 'rouge' } }))
  assert.deepEqual(transitionsDe(rougi, mesure({ branche: { nom: 'chantier/9', sha: B, verdict: 'rouge' } })), [], 'un rouge déjà dit ne se redit pas')
  assert.deepEqual(transitionsDe(avant, mesure({ main: { sha: B, verdict: 'verte' } })), ['CI main verte (bbbbbbbbb)'], 'un NOUVEAU sha déjà vert se signale')
  assert.deepEqual(transitionsDe(avant, mesure({ branche: { nom: 'chantier/9', sha: null, verdict: null } })), [], 'rien de poussé : rien à dire')
})

test('transitionsDe : le train arrivé, rouge, indéterminé ou mort se signale ; un autre run au même état aussi ; périmé, jamais', () => {
  const avant = minimal(mesure())
  assert.deepEqual(transitionsDe(avant, mesure({ t: train('vert', { etape: 'fin', rang: 7 }) })), ['train arrivé : publié'])
  assert.deepEqual(transitionsDe(avant, mesure({ t: train('rouge') })), ['train ROUGE à pr'])
  assert.deepEqual(transitionsDe(avant, mesure({ t: train('indéterminée', { etape: 'file' }) })), ['train indéterminé à file'])
  assert.deepEqual(transitionsDe(avant, mesure({ t: train('mort') })), ['train MORT à pr sans verdict'])
  assert.deepEqual(transitionsDe(avant, mesure({ t: train('périmé') })), [])
  const rouge = minimal(mesure({ t: train('rouge') }))
  assert.deepEqual(transitionsDe(rouge, mesure({ t: train('rouge') })), [])
  assert.deepEqual(transitionsDe(rouge, mesure({ t: train('rouge', { run: '8-2' }) })), ['train ROUGE à pr'], 'un run NEUF rouge se signale')
})

test('transitionsDe : au PREMIER tick (sans `--depuis`), seuls un rouge et un train mort se signalent', () => {
  assert.deepEqual(transitionsDe(null, mesure({ main: { sha: A, verdict: 'verte' }, t: train('vert') })), [])
  assert.deepEqual(transitionsDe(null, mesure({ main: { sha: A, verdict: 'annulee' } })), [])
  assert.deepEqual(transitionsDe(null, mesure({ main: { sha: A, verdict: 'rouge' }, t: train('mort') })), ['CI main ROUGE (aaaaaaaaa)', 'train MORT à pr sans verdict'])
})

test('verdictDeCi : une course en échec SANS job rouge, un job annulé, est `annulee` (jamais ✗) ; des jobs illisibles la laissent rouge', () => {
  const dossier = join(mkdtempSync(join(tmpdir(), 'vigie-cache-')), 'vigie')
  const echec = () => ({ disponible: true, valeur: [{ headSha: A, workflowName: 'CI', status: 'completed', conclusion: 'failure', databaseId: 37371342026 }] })
  try {
    const ids = []
    const annules = (id) => { ids.push(id); return { disponible: true, valeur: { rouges: [], annules: ['docs', 'suite 1/3'] } } }
    assert.equal(verdictDeCi({ sha: A, dossier, lire: echec, jobs: annules, horloge: () => 0 }), 'annulee')
    assert.deepEqual(ids, [37371342026])
    assert.equal(verdictDeCi({ sha: A, dossier, lire: echec, jobs: () => ({ disponible: false, raison: 'gh absent' }), horloge: () => FRAICHEUR_MS }), 'rouge')
  } finally { jeter(join(dossier, '..')) }
})

test('verdictDeCi : un cache VIDE, illisible ou d’une autre forme est un cache absent — le verdict se relit et se réécrit, jamais une panne', () => {
  const dossier = join(mkdtempSync(join(tmpdir(), 'vigie-cache-')), 'vigie')
  try {
    mkdirSync(dossier)
    for (const contenu of ['', '{"mesureA":', '"verte"', '{"verdict":"verte"}', '{"valeur":"verte"}']) {
      writeFileSync(join(dossier, `${A}.json`), contenu)
      let lus = 0
      const vu = verdictDeCi({ sha: A, dossier, horloge: () => 7, lire: () => { lus += 1; return { disponible: true, valeur: [{ headSha: A, workflowName: 'CI', status: 'completed', conclusion: 'success', databaseId: 5 }] } } })
      assert.deepEqual([vu, lus], ['verte', 1], JSON.stringify(contenu))
      assert.deepEqual(JSON.parse(readFileSync(join(dossier, `${A}.json`), 'utf8')), { mesureA: 7, valeur: 'verte' })
    }
  } finally { jeter(join(dossier, '..')) }
})

test('ligneDe : `CI main <s> · <branche> <s> · train : <étape k/n>`', () => {
  assert.equal(ligneDe(mesure({ t: train('en-vol', { etape: null, rang: 0 }) })), 'CI main ✓ · chantier/9 … · train : en vol', 'en vol avant sa première transition')
  assert.equal(ligneDe(mesure()), 'CI main ✓ · chantier/9 … · train : pr 4/7')
  assert.equal(ligneDe(mesure({ branche: { nom: 'chantier/9', sha: null, verdict: null }, t: train('aucun', { etape: null, rang: 0 }) })), 'CI main ✓ · chantier/9 — · train : —')
  assert.equal(ligneDe(mesure({ main: { sha: A, verdict: 'rouge' }, branche: null, t: train('vert', { etape: 'fin', rang: 7 }) })), 'CI main ✗ · train : arrivé ✓')
  assert.equal(ligneDe(mesure({ branche: { nom: 'b', sha: B, verdict: 'annulee' }, t: train('mort') })), 'CI main ✓ · b ⊘ · train : mort pr 4/7')
  assert.equal(ligneDe(mesure({ branche: { nom: 'b', sha: B, verdict: 'absente' }, t: train('rouge') })), 'CI main ✓ · b ∅ · train : ✗ pr 4/7')
})

test('verdictDeCi : un rouge se reprend à moins de `FRAICHEUR_MS` et se relit après ; un `verte` se garde sans limite ; une lecture illisible LÈVE', () => {
  const dossier = join(mkdtempSync(join(tmpdir(), 'vigie-cache-')), 'vigie')
  const course = (conclusion, attempt = 1) => ({ disponible: true, valeur: [{ headSha: A, workflowName: 'CI', status: 'completed', conclusion, databaseId: 5, attempt }] })
  try {
    let lus = 0
    const rouges = () => ({ disponible: true, valeur: { rouges: ['suite'], annules: [] } })
    assert.equal(verdictDeCi({ sha: A, dossier, horloge: () => 1000, lire: () => { lus += 1; return course('failure') }, jobs: rouges }), 'rouge')
    assert.equal(verdictDeCi({ sha: A, dossier, horloge: () => 1000 + FRAICHEUR_MS - 1, lire: () => assert.fail('un rouge frais ne se relit pas') }), 'rouge')
    assert.equal(verdictDeCi({ sha: A, dossier, horloge: () => 1000 + FRAICHEUR_MS, lire: () => { lus += 1; return course('success', 2) } }), 'verte')
    assert.deepEqual(JSON.parse(readFileSync(join(dossier, `${A}.json`), 'utf8')), { mesureA: 1000 + FRAICHEUR_MS, valeur: 'verte' })
    assert.deepEqual(readdirSync(dossier), [`${A}.json`], 'le temporaire de l’écriture atomique est renommé, le verrou libéré')
    assert.equal(verdictDeCi({ sha: A, dossier, horloge: () => 1e12, lire: () => assert.fail('un verte gardé ne se relit pas') }), 'verte')
    assert.equal(lus, 2)
    assert.equal(verdictDeCi({ sha: null, dossier, lire: () => assert.fail('rien de poussé, rien à lire') }), null)
    assert.throws(() => verdictDeCi({ sha: B, dossier, lire: () => ({ disponible: false, raison: 'gh absent' }) }), (e) => e instanceof CiIllisible && /gh absent/.test(e.message))
    assert.equal(existsSync(join(dossier, `${B}.json`)), false, 'une mesure qui lève ne s’écrit pas')
  } finally { jeter(join(dossier, '..')) }
})

test('memoireMachine : deux lectures à moins de `FRAICHEUR_MS` font UNE mesure ; au-delà, une seconde', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'vigie-memoire-'))
  const chemin = join(dossier, 'distants.json')
  try {
    let mesures = 0
    const mesurer = () => { mesures += 1; return { 'refs/heads/main': A, n: mesures } }
    assert.deepEqual(memoireMachine({ chemin, mesurer, horloge: () => 0 }), { 'refs/heads/main': A, n: 1 })
    assert.deepEqual(memoireMachine({ chemin, mesurer, horloge: () => FRAICHEUR_MS - 1 }), { 'refs/heads/main': A, n: 1 })
    assert.equal(mesures, 1)
    assert.deepEqual(memoireMachine({ chemin, mesurer, horloge: () => FRAICHEUR_MS }), { 'refs/heads/main': A, n: 2 })
    assert.equal(mesures, 2)
    assert.deepEqual(readdirSync(dossier), ['distants.json'])
  } finally { jeter(dossier) }
})

test('memoireMachine : le verrou TENU par un vivant fait servir la mémoire périmée sans mesurer, ou mesurer sans mémoire ; un verrou d’un PID mort se reprend', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'vigie-memoire-'))
  const chemin = join(dossier, 'distants.json')
  const verrou = `${chemin}.verrou`
  const tenu = (pid) => writeFileSync(verrou, JSON.stringify({ pid, commande: 'scripts/ops/vigie.mjs', cwd: '', date: '' }))
  try {
    tenu(4242)
    assert.equal(memoireMachine({ chemin, mesurer: () => 'premiere', horloge: () => 0, estVivant: () => true }), 'premiere', 'sans mémoire, le perdant mesure')
    assert.equal(memoireMachine({ chemin, mesurer: () => assert.fail('le perdant ne mesure pas'), horloge: () => 5 * FRAICHEUR_MS, estVivant: () => true }), 'premiere')
    assert.equal(readFileSync(verrou, 'utf8').includes('4242'), true, 'le verrou du vivant reste en place')
    assert.equal(memoireMachine({ chemin, mesurer: () => 'reprise', horloge: () => 5 * FRAICHEUR_MS, estVivant: (pid) => pid !== 4242 }), 'reprise')
    assert.equal(existsSync(verrou), false, 'le verrou repris est libéré')
    assert.deepEqual(JSON.parse(readFileSync(chemin, 'utf8')), { mesureA: 5 * FRAICHEUR_MS, valeur: 'reprise' })
  } finally { jeter(dossier) }
})

test('memoireMachine : une écriture purge le temporaire d’`ecrireJsonAtomique` (`<cible>.<uuid>.tmp`) et le verrou laissés par un tick tué, périmés', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'vigie-memoire-'))
  try {
    const vieux = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    const restes = [`${A}.json.${randomUUID()}.tmp`, `distants.json.${randomUUID()}.tmp`, `${B}.json.verrou`, `${B}.json.verrou.4242.${randomUUID()}`, `${B}.json.verrou.reprise`]
    for (const nom of [...restes, 'autre.json']) {
      writeFileSync(join(dossier, nom), '{}')
      utimesSync(join(dossier, nom), vieux, vieux)
    }
    memoireMachine({ chemin: join(dossier, 'distants.json'), mesurer: () => ({}), horloge: () => 0 })
    assert.deepEqual(readdirSync(dossier).sort(), ['autre.json', 'distants.json'])
  } finally { jeter(dossier) }
})

/** Un dépôt `amont` (l'origine) et son clone `aval` sur la branche `chantier/9` poussée. */
function depotsDuTick() {
  const amont = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'un' })
  const aval = mkdtempSync(join(tmpdir(), 'vigie-aval-'))
  lancerGit(['clone', '-q', '--no-local', amont.racine, aval])
  const g = gitDe(aval, { net: true })
  g('switch', '-q', '-c', 'chantier/9')
  writeFileSync(join(aval, 'b.txt'), 'b\n')
  g('add', 'b.txt'); g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'deux')
  g('push', '-q', 'origin', 'chantier/9')
  return { amont: amont.racine, aval, main: amont.sha, branche: g('rev-parse', 'HEAD') }
}

test('câblage : `tick` lit les têtes de l’origine, la CI par sha, le journal du train de l’arbre ; le `--depuis` rendu calcule la transition suivante', () => {
  const { amont, aval, main, branche } = depotsDuTick()
  try {
    const verdicts = new Map([[main, 'success'], [branche, '']])
    const lus = []
    const lire = (sha) => {
      lus.push(sha)
      const conclusion = verdicts.get(sha)
      return { disponible: true, valeur: [{ headSha: sha, workflowName: 'CI', status: conclusion ? 'completed' : 'in_progress', conclusion, databaseId: 1, attempt: 1 }] }
    }
    const rougesDuTick = () => ({ disponible: true, valeur: { rouges: ['suite'], annules: [] } })
    const premier = tick({ arbre: aval, lire, jobs: rougesDuTick, horloge: () => 0 })
    assert.equal(premier.ligne, 'CI main ✓ · chantier/9 … · train : —')
    assert.deepEqual(premier.transitions, [])
    assert.deepEqual(lus, [main, branche])
    assert.deepEqual(readdirSync(join(aval, '.git', 'vigie')).sort(), [`${branche}.json`, `${main}.json`, 'distants.json'].sort(), 'les mémoires vivent sous le .git commun')

    const { json } = cheminsDeJournal(aval, 'chantier/9')
    ecrireJsonAtomique(json, { ...journalVide('chantier/9'), tete: branche, run: `${process.pid}-1`, pid: process.pid, seq: 1, etapes: { preflight: { etat: 'en-vol', run: `${process.pid}-1`, seq: 1, tete: branche } } })
    verdicts.set(branche, 'failure')
    const second = tick({ arbre: aval, depuis: premier.etat, lire, jobs: rougesDuTick, horloge: () => FRAICHEUR_MS })
    assert.deepEqual(lus, [main, branche, branche], 'main, verte au cache, ne se relit pas')
    assert.equal(second.ligne, 'CI main ✓ · chantier/9 ✗ · train : preflight 1/7', 'le pid du run vit : en vol')
    assert.equal(second.transitions[0], `CI chantier/9 ROUGE (${branche.slice(0, 9)})`)
    assert.deepEqual(tick({ arbre: aval, depuis: second.etat, lire, jobs: rougesDuTick, horloge: () => FRAICHEUR_MS }).transitions.filter((t) => t.startsWith('CI')), [], 'le rouge rendu au `--depuis` ne se redit pas')
  } finally {
    jeter(amont)
    jeter(aval)
  }
})

test('câblage : deux ticks à moins de `FRAICHEUR_MS` font UN `ls-remote` — une tête poussée entre eux ne se voit qu’au tick d’après la péremption', () => {
  const { amont, aval, main } = depotsDuTick()
  try {
    const lire = (sha) => ({ disponible: true, valeur: [{ headSha: sha, workflowName: 'CI', status: 'completed', conclusion: 'success', databaseId: 1, attempt: 1 }] })
    const shaDeMain = (horloge) => decoder(tick({ arbre: aval, lire, horloge }).etat).main.sha
    assert.equal(shaDeMain(() => 0), main)
    const g = gitDe(amont)
    writeFileSync(join(amont, 'c.txt'), 'c\n')
    g('add', 'c.txt'); g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'trois')
    const neuf = g('rev-parse', 'HEAD').trim()
    assert.equal(shaDeMain(() => FRAICHEUR_MS - 1), main, 'la mémoire fraîche sert : aucun ls-remote')
    assert.equal(shaDeMain(() => FRAICHEUR_MS), neuf, 'la mémoire périmée se remesure')
  } finally {
    jeter(amont)
    jeter(aval)
  }
})

test('câblage : `vigie.mjs` écrit UN objet JSON `{ ligne, transitions, etat }` ; une panne sort non nulle, motif sur stderr', () => {
  const script = fileURLToPath(new URL('./vigie.mjs', import.meta.url))
  const usage = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(usage.status, 1)
  assert.match(usage.stderr, /usage/)
  const horsDepot = mkdtempSync(join(tmpdir(), 'vigie-hors-'))
  try {
    mkdirSync(join(horsDepot, 'x'))
    const panne = spawnSync(process.execPath, [script, '--json', '--arbre', join(horsDepot, 'x')], { encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: horsDepot } })
    assert.notEqual(panne.status, 0)
    assert.equal(panne.stdout, '')
    assert.match(panne.stderr, /^\[vigie\] /)
  } finally { jeter(horsDepot) }
  const { amont, aval, main } = depotsDuTick()
  try {
    let texte = ''
    const lire = (sha) => ({ disponible: true, valeur: sha === main ? [{ headSha: main, workflowName: 'CI', status: 'completed', conclusion: 'success', databaseId: 1, attempt: 1 }] : [] })
    const code = executer({ argv: ['--json', '--arbre', aval], sortie: (t) => { texte += t }, erreur: (t) => assert.fail(t), lire, jobs: () => assert.fail('aucun rouge') })
    assert.equal(code, 0)
    assert.equal(texte.split('\n').length, 2, 'UNE ligne JSON')
    const sortie = JSON.parse(texte)
    assert.deepEqual(Object.keys(sortie).sort(), ['etat', 'ligne', 'transitions'])
    assert.equal(sortie.ligne, 'CI main ✓ · chantier/9 ∅ · train : —')
    assert.deepEqual(sortie.transitions, [])
  } finally {
    jeter(amont)
    jeter(aval)
  }
})
