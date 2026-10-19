import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { Worker } from 'node:worker_threads'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { admettreLancementNode, collecterMemoire, decomposerOptionsNode, environnementDeLaMesure, lancerNodeMesure, profilsDuLancement } from './memoire.mjs'
import { mesurerProcessusWorktrees } from '../guards/lib/processusWorktrees.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'

const gate = fileURLToPath(new URL('./memoire-precharge.cjs', import.meta.url))
const DRIVE = 'C' + ':'
const hacher = (v) => createHash('sha256').update(v).digest('hex')
const mesuresEnMemoire = () => {
  const memos = {}
  return { lire: (nom, valider) => valider(memos[nom] ?? {}), ecrire: (nom, entrees, fusion) => { memos[nom] = fusion(memos[nom] ?? {}, entrees) }, memos }
}
const temporaire = (t, prefixe) => {
  const dossier = mkdtempSync(join(tmpdir(), prefixe))
  t.after(() => rmSync(dossier, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }))
  return dossier
}
const attendre = async (condition) => {
  const fin = Date.now() + 5000
  while (!condition()) { if (Date.now() >= fin) throw new Error('attente physique expirée'); await new Promise((r) => setTimeout(r, 5)) }
}
/** Un lancement mesuré, sa collecte comprise, n'est servi que par l'hôte natif win32 (`lancerNodeMesure`) ; ailleurs, sa
 *  branche sans mesure. */
const MESURE_NATIVE = Object.freeze({ skip: process.platform !== 'win32' && 'mesure mémoire servie par le seul hôte natif win32' })
const SANS_MESURE = Object.freeze({ skip: process.platform === 'win32' && 'branche sans mesure servie hors win32 seulement' })

test('admission : concurrence explicite, pic au-delà de l’objectif servi à 1, profil absent', () => {
  const admission = (disponibleOctets, argv = [], profils = ['a', 'b', 'c'].map((fichier) => ({ fichier, picOctets: 100 }))) =>
    admettreLancementNode({ fichiers: profils.map((p) => p.fichier), profils, parentOctets: 20, disponibleOctets, cpus: 8, argv })
  for (const argv of [['--test-concurrency=2'], ['--test-concurrency', '2'], ['--test-concurrency=3', '--test-concurrency', '2']])
    assert.deepEqual(admission(320, argv).argv, ['--test', '--test-concurrency=2'])
  assert.equal(admission(220, ['--test-concurrency=3']).refus, 'CONCURRENCE_SUPERIEURE_CAPACITE')
  assert.equal(admission(320, ['--test-concurrency=0']).refus, 'CONCURRENCE_INVALIDE')
  const grand = admission(10 * 2 ** 30, [], [{ fichier: 'grand', picOctets: 3 * 2 ** 30 }])
  assert.deepEqual([grand.refus, grand.concurrence, grand.argv], [null, 1, ['--test', '--test-concurrency=1']])
  assert.equal(admettreLancementNode({ fichiers: ['a'], profils: [], parentOctets: 20, disponibleOctets: 1000, cpus: 8 }).refus, 'PROFIL_MEMOIRE_ABSENT')
})

test('acquisition : un historique au-delà du disponible refuse avant tout lancement, profil périmé ou forcé', MESURE_NATIVE, async (t) => {
  const racine = temporaire(t, 'memoire-acquisition-refus-'), fichier = 'lourd.test.mjs', mesures = mesuresEnMemoire()
  writeFileSync(join(racine, fichier), 'export {}')
  const p = { racine, fichiers: [fichier], argv: ['--test'], env: { WFRP_TEST_MEMOIRE_MO: '2048', WFRP_TEST_COEURS: '4' }, mesures,
    journal() {} }
  const [entree] = profilsDuLancement(p).entrees
  const historique = { fichier, blob: entree.blob, picOctets: 3 * 2 ** 30, parentOctets: 2 ** 28, descendantsInclus: true, metrique: 'working-set' }
  for (const [cas, profil, forcer] of [['périmé', { ...historique, blob: 'perime' }, false], ['forcé', historique, true]]) {
    mesures.memos['memoire-node.json'] = { [entree.cle]: profil }
    const r = await lancerNodeMesure({ ...p, forcer })
    assert.deepEqual([r.code, r.refus, r.admission?.minimumOctets, r.message], [CODE_DIFFERE, 'MEMOIRE_INSUFFISANTE', 3 * 2 ** 30 + 2 ** 28, '[memoire] MEMOIRE_INSUFFISANTE : minimum 3328 Mo, disponible 2048 Mo'], cas)
  }
})

test('lecture des sources : ENOENT signe le vide, toute autre erreur lève telle quelle', (t) => {
  const racine = temporaire(t, 'memoire-lecture-')
  mkdirSync(join(racine, 'repertoire.test.mjs'))
  const p = { racine, argv: ['--test'], env: {}, mesures: mesuresEnMemoire() }
  assert.equal(profilsDuLancement({ ...p, fichiers: ['absent.test.mjs'] }).entrees[0].blob, hacher(''))
  assert.throws(() => profilsDuLancement({ ...p, fichiers: ['repertoire.test.mjs'] }), { code: 'EISDIR' })
})

test('options Node : gate CJS première, précharges homonymes conservées et gate héritée exacte retirée', () => {
  const utilisateur = join(tmpdir(), 'utilisateur', 'memoire-precharge.cjs')
  const env = { NODE_OPTIONS: ['--import=file:///user.mjs', '--require', utilisateur, '--require=' + gate, '-r' + gate, '--require', gate].map(JSON.stringify).join(' ') }
  const options = decomposerOptionsNode(environnementDeLaMesure(env, [], tmpdir()).NODE_OPTIONS)
  assert.deepEqual(options, ['--require', gate, '--import=file:///user.mjs', '--require', utilisateur])
  assert.deepEqual(decomposerOptionsNode('"--require" "' + DRIVE + '\\dossier test\\a.cjs"'), ['--require', 'C:dossier testa.cjs'])
  assert.deepEqual(decomposerOptionsNode("--require='a.cjs'"), ["--require='a.cjs'"])
  assert.throws(() => decomposerOptionsNode('"incomplet'), /guillemet/)
})

test('options incompatibles : alias snapshots et isolation none refusés avant toute factory', MESURE_NATIVE, async (t) => {
  const racine = temporaire(t, 'memoire-refus-options-')
  for (const argv of [['--snapshot-blob=x'], ['--snapshot_blob', 'x'], ['--build_snapshot'], ['--test-isolation=none'], ['--experimental_test_isolation', 'none']]) {
    const r = await lancerNodeMesure({ racine, fichiers: [], argv, env: {}, journal() {} })
    assert.equal(r.code, 2)
    assert.equal(r.arret.etat, 'mort')
    assert.match(r.error.message, /snapshot|isolation/)
  }
  assert.throws(() => environnementDeLaMesure({ NODE_OPTIONS: '--snapshot_blob=x' }, [], racine), /snapshot/)
})

/** Les profils se calculent dans un node sous `--permission` sans `--allow-child-process` : toute tentative de lancement,
 *  synchrone ou non, y est refusée, et `NODE_DEBUG=child_process` la journalise avant le refus (`spawn`, `spawnSync`). */
test('profils : sans lancement, synchrone compris, corpus et destinations indépendants, reporter et contenu distingués, contrat antérieur invalidé', async (t) => {
  const racine = temporaire(t, 'memoire-profils-'), corps = join(racine, 'profils.mjs')
  writeFileSync(join(racine, 'a.mjs'), 'export {}')
  writeFileSync(corps, `import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { profilsDuLancement } from ${JSON.stringify(new URL('./memoire.mjs', import.meta.url).href)}
const hacher = ${hacher}, mesuresEnMemoire = ${mesuresEnMemoire}
const racine = ${JSON.stringify(racine)}, mesures = mesuresEnMemoire()
const p = { racine, fichiers: ['a.mjs'], argv: ['--test'], env: {}, mesures }
const lire = (patch = {}) => profilsDuLancement({ ...p, ...patch })
const a = lire().entrees[0]
assert.equal(a.cle, lire({ fichiers: ['a.mjs', 'b.mjs'], argv: ['--test', '--test-reporter-destination=x'] }).entrees[0].cle)
assert.notEqual(a.cle, lire({ argv: ['--test', '--test-reporter=spec'] }).entrees[0].cle)
writeFileSync(join(racine, 'a.mjs'), 'export const x = 1')
assert.equal(a.cle, lire().entrees[0].cle)
assert.notEqual(a.blob, lire().entrees[0].blob)
mesures.memos['memoire-node.json'] = { [hacher('ancien-contrat-' + a.cle)]: { blob: lire().entrees[0].blob, picOctets: 100, parentOctets: 20, descendantsInclus: true, metrique: 'rss' } }
assert.equal(lire().entrees[0].utilisable, false)
`)
  const env = { ...process.env, NODE_DEBUG: 'child_process', TEMP: racine, TMP: racine }
  delete env.NODE_OPTIONS
  delete env.NODE_TEST_CONTEXT
  const enfant = spawn(process.execPath, ['--permission', '--allow-fs-read=*', '--allow-fs-write=' + racine, corps], { cwd: racine, env, stdio: ['ignore', 'ignore', 'pipe'] })
  let erreurs = ''
  enfant.stderr.on('data', (d) => { erreurs += d })
  const code = await new Promise((r, j) => { enfant.once('error', j); enfant.once('close', r) })
  assert.deepEqual([...erreurs.matchAll(/^CHILD_PROCESS \d+: (spawn\w*) .*?^ {2}file: '([^']*)'/gms)].map((m) => m[1] + ' ' + m[2]), [])
  assert.equal(code, 0, erreurs)
})

/** Le dossier commun des terrains : les entrées `a.mjs`, `b.mjs`, `c.mjs` et le corps `enfant.cjs` des processus
 *  d'entrée réels, qui sortent d'eux-mêmes à la mort du test. */
let racineCommune
const racineDesEntrees = () => {
  if (racineCommune) return racineCommune
  racineCommune = mkdtempSync(join(tmpdir(), 'memoire-entrees-'))
  for (const nom of ['a.mjs', 'b.mjs', 'c.mjs']) writeFileSync(join(racineCommune, nom), '')
  writeFileSync(join(racineCommune, 'enfant.cjs'), 'const parent = Number(process.env.WFRP_PARENT_TEST); setInterval(() => { try { process.kill(parent, 0) } catch { process.exit(0) } }, 200)')
  return racineCommune
}
const enfants = []
after(async () => {
  for (const enfant of enfants) if (enfant.exitCode === null && enfant.signalCode === null) enfant.kill()
  await Promise.all(enfants.map((enfant) => enfant.fin))
  if (racineCommune) rmSync(racineCommune, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
})

/** Un processus d'entrée réel `node enfant.cjs ...args` de cwd `racineDesEntrees()` : son PID et sa création native, lus
 *  par `mesurerProcessusWorktrees`. */
async function entreeReelle(args) {
  const racine = racineDesEntrees()
  const enfant = spawn(process.execPath, [join(racine, 'enfant.cjs'), ...args], { cwd: racine, stdio: 'ignore', env: { ...process.env, WFRP_PARENT_TEST: String(process.pid) } })
  enfant.fin = new Promise((r) => enfant.once('close', r))
  enfants.push(enfant)
  await new Promise((r, j) => { enfant.once('spawn', r); enfant.once('error', j) })
  const vue = mesurerProcessusWorktrees({ pids: [enfant.pid], pidsAInspecter: [enfant.pid], memoireSeulement: true, timeout: 5000 })
  const p = vue.processus.find((m) => m.pid === enfant.pid)
  assert.ok(p?.creationNative, JSON.stringify(vue))
  return { pid: enfant.pid, creation: p.creationNative }
}
let entreeCommune
const ENTREE = () => entreeCommune ??= entreeReelle(['a.mjs'])
/** Le PID du descendant de l'entrée : jamais un PID Windows, toute inspection de son identité échoue. */
const DESCENDANT = 14

async function terrain(t, fichier, options = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'memoire-natif-')), generation = randomUUID()
  mkdirSync(join(dossier, 'emissions'))
  mkdirSync(join(dossier, 'acquittements'))
  const entree = await (options.entree ?? ENTREE())
  const creer = (pid, role, residentOctets, creation = '2026-10-01T00:00:00.1234567Z') => ({ identifiant: 'instance-' + pid, pid, ppid: 999, creation,
    residentOctets, metriqueMemoire: 'working-set', etat: 'vivant', erreurs: [], role, entreeId: null })
  const processus = [creer(2, 'hote', 3), creer(3, 'worker', 7), creer(10, null, 20), creer(entree.pid, null, 100, entree.creation), creer(DESCENDANT, null, 300)]
  const identites = [], fermetures = new WeakSet()
  let captures = 0
  /** L'obligation de `collecterMemoire` envers toute requête native : son reste d'échéance d'observation, `]0, 2000]` ms. */
  const budget = ({ timeout }) => assert.ok(timeout > 0 && timeout <= 2000, 'requête native hors échéance d’observation : ' + timeout)
  const controle = {
    pid: 10,
    phase: 'execution',
    estFermeture: (cause) => fermetures.has(cause),
    mesurerDomaine(o) { budget(o); captures++; options.avantVue?.(captures, processus); return { processus: processus.map((p) => ({ ...p })), metriqueMemoire: 'working-set' } },
    attribuer(p, o) {
      budget(o)
      identites.push(p)
      const m = processus.find((m) => m.identifiant === p.identifiant && m.pid === p.pid && m.creation === p.creation)
      assert.ok(m)
      if (p.destination.type === 'parent') m.role = 'cible'
      else for (const n of processus.filter((n) => n.pid === entree.pid || n.pid === DESCENDANT)) n.entreeId = p.destination.id
    },
  }
  const shared = new SharedArrayBuffer(12), compteurs = new Int32Array(shared)
  const repondeur = new Worker(`const {parentPort,workerData}=require('node:worker_threads');const fs=require('node:fs'),path=require('node:path');const {dossier,shared}=workerData,compteurs=new Int32Array(shared);
    const vus=new Set();setInterval(()=>{Atomics.add(compteurs,0,1);
      for(const nom of fs.readdirSync(path.join(dossier,'emissions')).filter(n=>n.endsWith('.challenges'))){
        const base=path.join(dossier,'emissions',nom.slice(0,-11)),challenges=base+'.challenges';
        for(const demande of fs.readdirSync(challenges).filter(n=>n.endsWith('.json'))){
          const fichier=path.join(challenges,demande);if(vus.has(fichier))continue;
          const c=JSON.parse(fs.readFileSync(fichier,'utf8')),e=JSON.parse(fs.readFileSync(base+'.json','utf8'));
          const destination=base+'.'+c.nonce+'.reponse',temp=destination+'.tmp';
          fs.writeFileSync(temp,JSON.stringify({...e,identifiant:c.identifiant,nonce:c.nonce}));fs.renameSync(temp,destination);vus.add(fichier);Atomics.add(compteurs,1,1)
        }
      }
    },1);parentPort.postMessage('pret')`, { eval: true, workerData: { dossier, shared } })
  let erreurRepondeur
  repondeur.on('error', (e) => { erreurRepondeur = e })
  await new Promise((r, j) => { repondeur.once('message', r); repondeur.once('error', j) })
  t.after(async () => { await repondeur.terminate(); rmSync(dossier, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }) })
  const emission = (pid) => {
    const id = randomUUID()
    mkdirSync(join(dossier, 'emissions', id + '.challenges'))
    writeFileSync(join(dossier, 'emissions', id + '.json'), JSON.stringify({ version: 1, generation, id, pid }))
    return id
  }
  const collecte = collecterMemoire({ controle, pid: 10, fichiers: options.fichiers ?? [fichier], racine: racineDesEntrees(), dossier, generation })
  const ack = () => {
    const fichiers = readdirSync(join(dossier, 'acquittements')).filter((n) => n.endsWith('.json'))
    if (!fichiers.length) return null
    return { version: 1, generation, emissions: Object.assign({}, ...fichiers.map((n) => JSON.parse(readFileSync(join(dossier, 'acquittements', n), 'utf8')).emissions)) }
  }
  return { dossier, generation, processus, controle, entree: entree.pid, identites, fermetures, emission, collecte, ack, captures: () => captures, erreurRepondeur: () => erreurRepondeur, compteurs }
}

test('domaine natif : attribution tenue, descendant sans parent visible, P explicite, nouvelle vue avant ACK', MESURE_NATIVE, async (t) => {
  const f = await terrain(t, 'a.mjs')
  const entree = f.emission(f.entree), parent = f.emission(10)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut, undefined)
  assert.deepEqual(f.identites.map((p) => p.destination).sort((a, b) => a.type.localeCompare(b.type)), [{ type: 'entree', id: hacher('a.mjs') }, { type: 'parent' }])
  assert.equal(f.captures(), 2)
  assert.equal(f.ack().generation, f.generation)
  assert.deepEqual(Object.keys(f.ack().emissions).sort(), [entree, parent].sort())
  const observe = f.collecte.terminer()
  assert.equal(observe.parentOctets, 30)
  assert.deepEqual(observe.pics, { 'a.mjs': 400 })
  f.processus[3].ppid = 1
  f.processus[4].ppid = 1
  f.processus[4].residentOctets = 500
  f.collecte.echantillonner()
  assert.equal(f.collecte.terminer().pics['a.mjs'], 600)
})

test('#2586 domaine natif : la cible sortie ou absente de la vue clôt la collecte, sans défaut ni rejet', MESURE_NATIVE, async (t) => {
  for (const sortir of [(processus) => { processus[2].etat = 'sortie' }, (processus) => { processus.splice(2, 1) }]) {
    const f = await terrain(t, 'a.mjs')
    f.emission(f.entree); f.emission(10)
    f.collecte.echantillonner()
    assert.equal(f.collecte.defaut, undefined)
    sortir(f.processus)
    f.collecte.echantillonner()
    assert.equal(f.collecte.defaut, undefined)
    assert.equal(f.collecte.cloturee, true)
    assert.equal(f.collecte.qualite.rejets, 0)
    assert.deepEqual(f.collecte.terminer().pics, { 'a.mjs': 400 })
  }
})

test('domaine natif : émission descendant déjà attribué sans inspection argv ni contexte ENTRY', MESURE_NATIVE, async (t) => {
  const f = await terrain(t, 'a.mjs')
  f.emission(10); f.emission(f.entree)
  f.collecte.echantillonner()
  const id = f.emission(DESCENDANT)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut, undefined, f.collecte.defaut?.message)
  assert.ok(f.ack().emissions[id])
  assert.equal(f.identites.length, 2)
})

test('acquisition : capture avant challenge, émission tardive dans la même borne et aucun ACK intermédiaire', MESURE_NATIVE, async (t) => {
  const f = await terrain(t, 'a.mjs', { avantVue: (numero) => {
    if (numero === 1) assert.equal(readdirSync(join(f.dossier, 'emissions'), { recursive: true }).some((n) => /challenges[\\/].*\.json$/.test(n)), false)
    if (numero === 3) {
      assert.equal(f.ack(), null)
      f.emission(f.entree)
    }
  } })
  f.emission(10)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut, undefined)
  assert.ok(f.captures() >= 4)
  assert.deepEqual(f.collecte.terminer().pics, { 'a.mjs': 400 })
})

test('acquisition : identité non attribuée conservée après expiration puis disparition fatale', MESURE_NATIVE, async (t) => {
  const f = await terrain(t, 'a.mjs', { avantVue: (numero) => {
    if (numero === 2) throw Object.assign(new Error('expiration contrôlée'), { code: 'EXPIRATION', origine: 'controle-natif', operation: 'vue', expiree: true })
  } })
  f.emission(10)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut, undefined)
  assert.equal(f.collecte.qualite.rejets, 1)
  f.processus.splice(3, 1)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut.cause.code, 'MEMBRE_DISPARU_NON_ATTRIBUE')
  assert.equal(f.ack(), null)
})

test('inspection complète : création native exacte, même milliseconde différente refusée sans ACK', MESURE_NATIVE, async (t) => {
  const reelle = await ENTREE()
  const chiffre = reelle.creation.at(-2)
  const f = await terrain(t, 'a.mjs', { entree: { pid: reelle.pid, creation: reelle.creation.slice(0, -2) + (chiffre === '9' ? '8' : String(Number(chiffre) + 1)) + 'Z' } })
  f.emission(10); f.emission(f.entree)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut?.message, 'collecte impossible : inspection initiale sans identité exacte')
  assert.equal(f.ack(), null)
  assert.equal(f.collecte.qualite.echantillonsValides, 0)
})

/** Le PID du processus System : vivant, son PEB refusé à tout processus utilisateur (OpenProcess, ERROR_ACCESS_DENIED). */
const SYSTEM = 4

test('inspection complète : une entrée que l’inspection marque illisible est refusée par sa cause, sans ACK', MESURE_NATIVE, async (t) => {
  const f = await terrain(t, 'a.mjs', { entree: { pid: SYSTEM, creation: '2026-10-01T00:00:00.1234567Z' } })
  f.emission(10); f.emission(f.entree)
  f.collecte.echantillonner()
  assert.match(f.collecte.defaut?.message ?? '', /^collecte impossible : inspection initiale illisible : cwd illisible : \[win32 5\]/)
  assert.equal(f.ack(), null)
  assert.equal(f.collecte.qualite.echantillonsValides, 0)
})

test('inspection complète : un seul chemin candidat dans l’argv complet, sans heuristique argv1', MESURE_NATIVE, async (t) => {
  for (const [cas, args, fichiers] of [['zero', ['c.mjs'], ['a.mjs']], ['plusieurs', ['a.mjs', 'b.mjs'], ['a.mjs', 'b.mjs']]]) {
    const f = await terrain(t, 'a.mjs', { entree: entreeReelle(args), fichiers })
    f.emission(10); f.emission(f.entree)
    f.collecte.echantillonner()
    assert.match(f.collecte.defaut?.message ?? '', /association initiale non unique/, cas)
    assert.equal(f.ack(), null, cas)
  }
})

test('transaction working-set : membre commun inconnu, working-set invalide et somme non sûre empêchent tout ACK', MESURE_NATIVE, async (t) => {
  const causes = { inconnu: 'MEMBRE_NON_ATTRIBUE', rss: 'working-set natif incomplet', erreurs: 'working-set natif incomplet',
    overflow: 'somme working-set entrée invalide', role: 'infrastructure native contradictoire', duplique: 'identité native invalide ou dupliquée' }
  for (const cas of Object.keys(causes)) {
    const f = await terrain(t, 'a.mjs', { avantVue: (numero, ps) => {
      if (numero !== 2) return
      if (cas === 'inconnu') ps[4].entreeId = null
      if (cas === 'rss') ps[4].residentOctets = NaN
      if (cas === 'erreurs') ps[4].erreurs = ['resident illisible']
      if (cas === 'overflow') ps[4].residentOctets = Number.MAX_SAFE_INTEGER
      if (cas === 'role') ps[4].role = 'worker'
      if (cas === 'duplique') ps.push({ ...ps[4] })
    } })
    f.emission(10); f.emission(f.entree)
    f.collecte.echantillonner()
    assert.equal(f.collecte.defaut?.message, 'collecte impossible : ' + causes[cas], cas)
    assert.equal(f.ack(), null, cas)
    assert.throws(() => f.collecte.terminer(), { code: 'MESURE_MEMOIRE_INCOMPLETE' }, cas)
  }
})

test('transaction working-set : expiration structurée après affectation conserve propriété, aucun ACK ni pic partiel', MESURE_NATIVE, async (t) => {
  const f = await terrain(t, 'a.mjs', { avantVue: (numero) => {
    if (numero === 2) throw Object.assign(new Error('expiration structurée'), { code: 'EXPIRATION', origine: 'controle-natif', operation: 'vue', expiree: true })
  } })
  const e = f.emission(f.entree); f.emission(10)
  f.collecte.echantillonner()
  assert.equal(f.collecte.defaut, undefined)
  assert.equal(f.collecte.qualite.echantillonsValides, 0)
  assert.equal(f.ack(), null)
  assert.equal(f.processus[4].entreeId, hacher('a.mjs'))
  f.collecte.echantillonner()
  await new Promise((r) => setImmediate(r))
  assert.equal(f.erreurRepondeur(), undefined)
  assert.equal(f.collecte.defaut, undefined, f.collecte.defaut?.stack + ' compteurs=' + [...f.compteurs])
  assert.ok(f.ack().emissions[e])
  assert.deepEqual(f.collecte.terminer().pics, { 'a.mjs': 400 })
  assert.equal(f.collecte.terminer().qualite.rejets, 1)
})

test('transaction working-set : exception étiquetée, infrastructure absente et changement identité restent fatals', MESURE_NATIVE, async (t) => {
  for (const cas of ['fausse-expiration', 'parent-absent', 'identite']) {
    const f = await terrain(t, 'a.mjs', { avantVue: (numero, ps) => {
      if (numero !== 2) return
      if (cas === 'fausse-expiration') throw Object.assign(new Error('pas une expiration de contrôle'), { code: 'EXPIRATION' })
      if (cas === 'parent-absent') ps.splice(2, 1)
      if (cas === 'identite') ps[3].creation = '2026-10-01T00:00:00.1234568Z'
    } })
    f.emission(10); f.emission(f.entree)
    f.collecte.echantillonner()
    assert.ok(f.collecte.defaut, cas)
    assert.equal(f.ack(), null, cas)
  }
})

test('clôture : seule fermeture marquée par ce contrôle en phase canonique cesse les samples', MESURE_NATIVE, async (t) => {
  for (const cas of ['canonique', 'non-marquee', 'mauvaise-phase']) {
    const f = await terrain(t, 'a.mjs')
    f.emission(10); f.emission(f.entree)
    f.collecte.echantillonner()
    const cause = Object.assign(new Error('fin native'), { code: 'FERMETURE', origine: 'controle-natif', operation: 'vue', terminale: true })
    if (cas !== 'non-marquee') f.fermetures.add(cause)
    if (cas !== 'mauvaise-phase') f.controle.phase = 'cloture'
    f.controle.mesurerDomaine = () => { throw cause }
    f.collecte.echantillonner()
    assert.equal(f.collecte.qualite.echantillonsValides, 1)
    if (cas === 'canonique') {
      assert.equal(f.collecte.cloturee, true)
      assert.equal(f.collecte.defaut, undefined)
      assert.deepEqual(f.collecte.terminer().pics, { 'a.mjs': 400 })
    } else assert.throws(() => f.collecte.terminer(), { code: 'MESURE_MEMOIRE_INCOMPLETE' })
  }
})

test('gate physique : require/import/loader attendent challenge et ACK ; threads sans émission', async (t) => {
  const dossier = temporaire(t, "memoire-gate-l'apostrophe "), generation = randomUUID()
  mkdirSync(join(dossier, 'emissions'))
  mkdirSync(join(dossier, 'acquittements'))
  const marqueur = join(dossier, 'executions')
  const marquer = (nom) => `require('node:fs').appendFileSync(${JSON.stringify(marqueur)},${JSON.stringify(nom)})`
  writeFileSync(join(dossier, 'user.cjs'), marquer('require\n'))
  writeFileSync(join(dossier, 'user.mjs'), `import {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(marqueur)},'import\\n')`)
  writeFileSync(join(dossier, 'loader.mjs'), `import {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(marqueur)},'loader\\n');export async function resolve(s,c,n){return n(s,c)}`)
  writeFileSync(join(dossier, 'body.cjs'), marquer('body\n') + ";const {Worker}=require('node:worker_threads');new Worker('0',{eval:true})")
  writeFileSync(join(dossier, 'cli.cjs'), marquer('require-cli\n'))
  writeFileSync(join(dossier, 'cli.mjs'), `import {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(marqueur)},'import-cli\\n')`)
  const env = environnementDeLaMesure({ ...process.env, WFRP_MEMOIRE_DOSSIER: dossier, WFRP_MEMOIRE_GENERATION: generation,
    NODE_OPTIONS: ['--require', join(dossier, 'user.cjs'), '--import', pathToFileURL(join(dossier, 'user.mjs')).href].map(JSON.stringify).join(' ') }, [], process.cwd())
  const enfant = spawn(process.execPath, ['--require', join(dossier, 'cli.cjs'), '--import', pathToFileURL(join(dossier, 'cli.mjs')).href,
    '--experimental-loader', pathToFileURL(join(dossier, 'loader.mjs')).href, join(dossier, 'body.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let erreurs = ''
  enfant.stderr.on('data', (v) => { erreurs += v })
  const fin = new Promise((r, j) => { enfant.on('error', j); enfant.on('close', (code) => r(code)) })
  t.after(async () => { if (enfant.exitCode === null) enfant.kill(); await fin })
  await attendre(() => readdirSync(join(dossier, 'emissions')).some((f) => f.endsWith('.json')))
  assert.equal(existsSync(marqueur), false)
  const nom = readdirSync(join(dossier, 'emissions')).find((f) => f.endsWith('.json'))
  const e = JSON.parse(readFileSync(join(dossier, 'emissions', nom), 'utf8'))
  assert.equal(e.pid, enfant.pid)
  const nonce = randomBytes(32).toString('hex'), identite = { version: 1, generation, id: e.id, identifiant: 'instance-physique' }
  writeFileSync(join(dossier, 'emissions', e.id + '.challenges', nonce + '.json'), JSON.stringify({ ...identite, nonce }))
  await attendre(() => existsSync(join(dossier, 'emissions', e.id + '.' + nonce + '.reponse')))
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, 'emissions', e.id + '.' + nonce + '.reponse'), 'utf8')), { ...identite, pid: enfant.pid, nonce })
  assert.equal(existsSync(marqueur), false)
  writeFileSync(join(dossier, 'acquittements', 'transaction.json'), JSON.stringify({ version: 1, generation, emissions: { [e.id]: nonce } }))
  assert.equal(await fin, 0, erreurs)
  const texte = readFileSync(marqueur, 'utf8')
  for (const m of ['require', 'import', 'loader', 'body', 'require-cli', 'import-cli']) assert.ok(texte.includes(m), texte)
  assert.equal(readdirSync(join(dossier, 'emissions')).filter((f) => f.endsWith('.json')).length, 1)
})

test('Windows physique : inspection sélectionnée expose création native complète, commande et cwd', MESURE_NATIVE, () => {
  const vue = mesurerProcessusWorktrees({ pids: [process.pid], pidsAInspecter: [process.pid], memoireSeulement: true, timeout: 5000 })
  const p = vue.processus.find((p) => p.pid === process.pid)
  assert.ok(p)
  assert.deepEqual(p.erreurs, [])
  assert.match(p.creationNative, /\.\d{7}Z$/)
  assert.ok(p.commande.includes('memoire.test.mjs'))
  assert.ok(p.cwd)
})

function bancMesurePhysique(t) {
  const racine = temporaire(t, 'memoire-utile-'), fichier = 'court.test.mjs', executions = join(racine, 'executions')
  writeFileSync(join(racine, fichier), `import {appendFileSync} from 'node:fs';import {test} from 'node:test';appendFileSync(${JSON.stringify(executions)},'x');test('verdict',()=>{throw Error('rouge utile')})`)
  const mesures = mesuresEnMemoire(), env = { ...process.env }, journaux = []
  delete env.NODE_TEST_CONTEXT
  return { fichier, executions, mesures, journaux, p: { racine, fichiers: [fichier], argv: ['--test'], env, mesures, journal: (s) => journaux.push(s) } }
}

test('#2586 lancement node hors win32 : aucune collecte, verdict utile en concurrence fixe, aucun profil ; forcé, échoue fermé ENONSUPPORTE sans lancement', SANS_MESURE, async (t) => {
  const { executions, mesures, journaux, p } = bancMesurePhysique(t)
  const r = await lancerNodeMesure(p)
  assert.deepEqual([r.code, r.arret.etat, r.concurrence, r.memoire], [1, 'mort', 1, undefined], journaux.join('\n'))
  assert.equal(readFileSync(executions, 'utf8'), 'x')
  assert.equal(mesures.memos['memoire-node.json'], undefined)
  assert.ok(journaux.includes('[memoire] mesure indisponible sous ' + process.platform + ', concurrence fixe 1 : court.test.mjs'), journaux.join('\n'))
  journaux.length = 0
  const force = await lancerNodeMesure({ ...p, forcer: true })
  assert.deepEqual([force.code, force.error?.code, force.arret.etat], [2, 'ENONSUPPORTE', 'mort'], journaux.join('\n'))
  assert.equal(readFileSync(executions, 'utf8'), 'x')
  assert.deepEqual(journaux, ['[memoire] ENONSUPPORTE : --reacquerir-memoire : mesure mémoire indisponible sous ' + process.platform])
})

test('mesure physique Windows : verdict utile unique, profil complet puis admission, aucune exécution préalable', MESURE_NATIVE, async (t) => {
  const { fichier, executions, mesures, journaux, p } = bancMesurePhysique(t)
  for (const acquisition of [true, false]) {
    const r = await lancerNodeMesure(p)
    assert.equal(r.code, 1, journaux.join('\n'))
    assert.equal(r.acquisition, acquisition, journaux.join('\n'))
    assert.equal(r.arret.etat, 'mort', journaux.join('\n'))
    assert.ok(r.memoire?.pics[fichier] > 0, journaux.join('\n'))
    assert.equal(r.memoire.qualite.resultat, 'complete')
  }
  assert.equal(readFileSync(executions, 'utf8'), 'xx')
  assert.equal(Object.keys(mesures.memos['memoire-node.json']).length, 1)
})
