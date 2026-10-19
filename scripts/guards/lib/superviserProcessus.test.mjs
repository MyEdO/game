import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, openSync, closeSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync, ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { listerDossier, listerEntrees } from './lister.mjs'
import { gitEnFond } from '../../test/gitDeBanc.mjs'
import { jouerSousSuspendeur } from '../../test/suspendeurDeMesure.mjs'
import { sortieDeSupervision, superviserProcessus, lancerProcessusSupervise } from './superviserProcessus.mjs'
import { ancetresValidesDe, gardienDisparu, mesurerArbreProcessus } from './arbreProcessus.mjs'
import { creationMemorisee, estPidVivantDepuis } from './pid.mjs'
import { IDENTITE_MESUREE } from '../../test/identiteMesuree.mjs'

test('une erreur de supervision refuse la sortie même après un enfant réussi', () => {
  let diagnostic = ''
  const journal = { write: (texte) => { diagnostic += texte } }
  for (const code of ['EMESURE', 'EFLUX']) {
    const resultat = { status: 0, error: { code, message: 'nettoyage impossible' } }
    assert.equal(sortieDeSupervision(resultat, journal), 1)
    assert.ok(diagnostic.includes(`${code} : nettoyage impossible`))
  }
  diagnostic = ''
  assert.equal(sortieDeSupervision({ status: 0, error: { message: 'sans code' } }, journal), 1)
  assert.equal(diagnostic, '[supervision] sans code\n')
  assert.equal(sortieDeSupervision({ status: 0 }, journal), 0)
  assert.equal(sortieDeSupervision({ status: 3 }, journal), 3)
})

test('superviserProcessus : le rendu porte l’arrêt certifié de l’unique fin native', { timeout: 20000 }, async () => {
  const vu = await superviserProcessus({ commande: process.execPath, args: ['-e', 'process.exit(3)'], stdio: 'ignore' })
  assert.equal(vu.status, 3, JSON.stringify(vu))
  assert.deepEqual([vu.arret?.etat, vu.arret?.erreurs, vu.arret?.methode], ['mort', [], process.platform === 'win32' ? 'job-windows' : 'subreaper-linux'], JSON.stringify(vu))
})

test('la filiation coupe les PID parents réutilisés à chaque profondeur', () => {
  const vue = [
    { pid: 1, ppid: 0, creation: '2026-10-16T00:00:00.0000000Z' },
    { pid: 2, ppid: 1, creation: '2026-10-15T00:00:00.0000000Z' },
    { pid: 3, ppid: 2, creation: '2026-10-17T00:00:00.0000000Z' },
    { pid: 4, ppid: 1, creation: '2026-10-16T01:00:00.0000001Z' },
    { pid: 5, ppid: 4, creation: '2026-10-16T01:00:00.0000000Z' },
    { pid: 6, ppid: 5, creation: '2026-10-18T00:00:00.0000000Z' },
    { pid: 7, ppid: 4, creation: '2026-10-16T02:00:00.000Z' },
    { pid: 8, ppid: 7, creation: '2026-10-16T03:00:00.000Z' },
    { pid: 9, ppid: 99, creation: '2026-10-16T04:00:00.000Z' },
  ]
  assert.deepEqual(ancetresValidesDe(8, vue).map((p) => p.pid), [7, 4, 1])
  assert.deepEqual(ancetresValidesDe(6, vue).map((p) => p.pid), [5])
  assert.deepEqual(ancetresValidesDe(99, vue), [])
  assert.deepEqual(ancetresValidesDe(1, [{ pid: 1, ppid: 2, creation: '2026-10-16T00:00:00Z' }, { pid: 2, ppid: 1, creation: '2026-10-16T00:00:00Z' }]).map((p) => p.pid), [2])
})

test('une identité PID réutilisée ne désigne jamais le processus capturé', () => {
  assert.equal(gardienDisparu({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'nouveau' }]), true)
  assert.equal(gardienDisparu({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'ancien' }]), false)
  assert.equal(gardienDisparu({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'ancien', etat: 'Z' }]), true)
})

test('gardien en vol, vue mesurée ou mesure en échec : seuls un pid mort et un pid réutilisé, né après la capture, ont disparu', { timeout: 30000 }, () => {
  const vue = mesurerArbreProcessus()
  const capture = vue.find((p) => p.pid === process.pid)
  const reutilise = { pid: process.pid, creation: new Date(Date.parse(capture.creation) - 3_600_000).toISOString() }
  const { pid: mort } = spawnSync(process.execPath, ['-e', ''])
  for (const vueDuTour of [vue, null]) {
    assert.equal(gardienDisparu(capture, vueDuTour), false, `vivant, vue ${vueDuTour ? 'mesurée' : 'en échec'}`)
    assert.equal(gardienDisparu(reutilise, vueDuTour), true, `réutilisé, vue ${vueDuTour ? 'mesurée' : 'en échec'}`)
    assert.equal(gardienDisparu({ pid: mort, creation: capture.creation }, vueDuTour), true, `mort, vue ${vueDuTour ? 'mesurée' : 'en échec'}`)
  }
})

test('supervision : sortie volumineuse drainée et stdio explicite sans pipe', { timeout: 20000 }, async () => {
  const texte = await superviserProcessus({ commande: process.execPath, args: ['-e', "process.stdout.write('x'.repeat(2<<20))"] })
  assert.equal(texte.status, 0)
  assert.equal(texte.stdout.length, 2 << 20)
  const ignore = await superviserProcessus({ commande: process.execPath, args: ['-e', 'process.exit(0)'], stdio: 'ignore' })
  assert.equal(ignore.status, 0)
  assert.equal(ignore.error, undefined)
})

test('supervision : le plafond tue aussi le petit-fils détaché persistant', { timeout: 30000 }, async () => {
  const racine = mkdtempSync(join(tmpdir(), '2626-supervision-'))
  try {
    const feuille = join(racine, 'feuille.mjs')
    const parent = join(racine, 'parent.mjs')
    const preuve = join(racine, 'preuve')
    const pid = join(racine, 'pid')
    writeFileSync(feuille, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>writeFileSync(${JSON.stringify(preuve)},String(Date.now())),20)`)
    writeFileSync(parent, `import {spawn} from 'node:child_process';spawn(process.execPath,[${JSON.stringify(feuille)}],{detached:true,stdio:['ignore',1,2]}).unref();setInterval(()=>{},1000)`)
    const supervision = superviserProcessus({ commande: process.execPath, args: [parent], timeout: 3500 })
    const petitFils = identiteMesureeDe(Number(await attendreFichier(pid)))
    const vu = await supervision
    const avant = readFileSync(preuve, 'utf8')
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(readFileSync(preuve, 'utf8'), avant, 'le petit-fils écrit encore après le retour du superviseur')
    assert.match(vu.error?.message, /échéance/)
    assert.ok(gardienDisparu(petitFils, mesurerArbreProcessus()), 'le petit-fils doit avoir disparu')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** L'identité de création des P de `jouerHook`, mesurée au plus une fois par seconde et par PID (#2603). */
const IDENTITE_MEMORISEE = { ...IDENTITE_MESUREE, lireCreation: creationMemorisee(IDENTITE_MESUREE.lireCreation, { pasMs: 1000, horloge: Date.now }) }

/** Joue `superviserProcessus({ surveillerGit: true })` dans un Node P à l'ascendance RÉELLE de `mode` et rend `{ vu, temoins }`
 *  que P écrit (#2586, #2626). `orphelin` : P lancé par un relais vivant dont le parent est sorti, aucun git au-dessus ;
 *  `parent-mort` : le relais sort dès P lancé, P attend sa mort. Relais et P attendent la mort de LEUR lanceur, PID et
 *  naissance reçus par argv, car hors win32 le `process.ppid` d'un orphelin est déjà son nouveau parent (getppid(2)) ;
 *  `git` : P lancé par un alias `!` de git, l'ascendance d'un hook. Les modes `git-…` suivants lancent une cible longue,
 *  puis : `git-tue`, le parent de P tué ; `git-mesure-coupee`, la mesure de P rendue impossible (son `SystemRoot` retiré)
 *  un temps puis rétablie, puis retirée pour de bon, `temoins.depuisCoupureMs` du dernier retrait à la fin ;
 *  `git-mesure-coupee-tue`, la mesure retirée puis le parent tué. */
async function jouerHook(t, mode) {
  const b = bancSupervision(t)
  const sortie = join(b.dossier, 'resultat.json')
  const hook = b.script('hook', `
import { spawn } from 'node:child_process'
import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { superviserProcessus } from ${JSON.stringify(new URL('./superviserProcessus.mjs', import.meta.url).href)}
import { creationMemorisee, estPidVivantDepuis } from ${JSON.stringify(new URL('./pid.mjs', import.meta.url).href)}
import { IDENTITE_MESUREE } from ${JSON.stringify(new URL('../../test/identiteMesuree.mjs', import.meta.url).href)}
const naissance = Date.now()
const [role, mode, sortie, lanceur, naissanceDuLanceur] = process.argv.slice(2)
const identite = { ...IDENTITE_MESUREE, lireCreation: creationMemorisee(IDENTITE_MESUREE.lireCreation, { pasMs: 1000, horloge: Date.now }) }
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms))
const publier = (chemin, texte) => { writeFileSync(chemin + '.tmp', texte); renameSync(chemin + '.tmp', chemin) }
const attendreMortDuLanceur = async () => { while (estPidVivantDepuis(Number(lanceur), Number(naissanceDuLanceur), identite)) await pause(20) }
const relancer = (suite, options) => spawn(process.execPath, [fileURLToPath(import.meta.url), suite, mode, sortie, String(process.pid), String(naissance)], options)
if (role === 'a') relancer('i', { detached: true, stdio: 'ignore' }).unref()
else if (role === 'i') {
  await attendreMortDuLanceur()
  const p = relancer('p', { detached: true, stdio: 'ignore' })
  if (mode === 'parent-mort') p.unref()
  else await new Promise((ok) => p.once('close', ok))
} else {
  if (mode === 'parent-mort') await attendreMortDuLanceur()
  const longue = mode.startsWith('git-')
  const cible = longue ? "require('fs').writeFileSync(" + JSON.stringify(sortie + '.cible') + ",'');setInterval(()=>{},1000)" : 'process.exit(0)'
  let finie = false
  const supervision = superviserProcessus({ commande: process.execPath, args: ['-e', cible], surveillerGit: true, timeout: 45000 }).finally(() => { finie = true })
  const temoins = {}
  if (longue) {
    while (!finie && !existsSync(sortie + '.cible')) await pause(25)
    const systemRoot = process.env.SystemRoot
    if (mode === 'git-mesure-coupee') { delete process.env.SystemRoot; await pause(3750); process.env.SystemRoot = systemRoot; await pause(1500) }
    if (mode.startsWith('git-mesure-coupee')) { delete process.env.SystemRoot; temoins.coupure = Date.now() }
    publier(sortie + '.parent', String(process.ppid))
  }
  const vu = await supervision
  if (temoins.coupure) temoins.depuisCoupureMs = Date.now() - temoins.coupure
  publier(sortie, JSON.stringify({ vu, temoins, pid: process.pid, naissance }))
}
`)
  if (mode.startsWith('git')) {
    const node = process.execPath.replaceAll('\\', '/')
    const git = gitEnFond(['-c', `alias.wfrp-hook=!"${node}" "${hook.replaceAll('\\', '/')}" p ${mode} "${sortie.replaceAll('\\', '/')}"`, 'wfrp-hook'], { cwd: b.dossier })
    let ferme = false
    const fin = new Promise((ok) => git.once('close', () => { ferme = true; ok() }))
    if (mode.endsWith('-tue')) {
      while (!ferme && !existsSync(sortie + '.parent')) await new Promise((ok) => setTimeout(ok, 25))
      const parent = ferme ? null : Number(readFileSync(sortie + '.parent', 'utf8'))
      if (parent !== null) { assert.ok(Number.isInteger(parent) && parent > 0, `parent illisible : ${parent}`); process.kill(parent) }
    }
    await fin
  } else spawn(process.execPath, [hook, 'a', mode, sortie], { stdio: 'ignore' })
  const { vu, temoins, pid, naissance } = JSON.parse(await attendreFichier(sortie, 1200))
  while (estPidVivantDepuis(pid, naissance, IDENTITE_MEMORISEE)) await new Promise((ok) => setTimeout(ok, 25))
  return { vu, temoins }
}

test('ascendance du hook : un parent disparu avant la mesure initiale refuse tout lancement', { timeout: 60000 }, async (t) => {
  const { vu } = await jouerHook(t, 'parent-mort')
  assert.equal(vu.error?.code, 'EPARENT', JSON.stringify(vu))
  assert.equal(vu.status, null)
  // Hors win32, l'orphelin est rattaché à un nouveau parent vivant : seule l'absence de git s'y observe.
  if (process.platform === 'win32') assert.equal(vu.error.message, 'parent disparu avant démarrage du hook')
  else assert.match(vu.error.message, /avant démarrage du hook/)
})

test('ascendance du hook : un parent vivant sans git au-dessus refuse tout lancement', { timeout: 60000 }, async (t) => {
  const { vu } = await jouerHook(t, 'orphelin')
  assert.equal(vu.error?.code, 'EPARENT', JSON.stringify(vu))
  assert.equal(vu.status, null)
  assert.match(vu.error.message, /avant démarrage du hook/)
})

test('ascendance du hook : sous un alias de git, la chaîne réelle autorise le lancement', { timeout: 60000 }, async (t) => {
  const { vu } = await jouerHook(t, 'git')
  assert.equal(vu.error, undefined, JSON.stringify(vu))
  assert.equal(vu.status, 0)
  assert.equal(vu.arret.etat, 'mort')
})

test('supervision : le parent réel du hook tué en vol interrompt en EPARENT', { timeout: 60000 }, async (t) => {
  const { vu } = await jouerHook(t, 'git-tue')
  assert.equal(vu.error?.code, 'EPARENT', JSON.stringify(vu))
  assert.equal(vu.error.message, 'parent disparu')
})

// La mesure Windows lit `SystemRoot` à chaque appel (processusWorktrees.mjs, mesurerProcessusWorktrees) ; la mesure Linux lit /proc, qu'aucun processus non privilégié ne retire.
const MESURE_RETIRABLE = { skip: process.platform !== 'win32' && 'mesure /proc non retirable hors privilège' }

test('supervision : une mesure perdue en vol, après une panne isolée rattrapée, interrompt en EMESURE au seuil de pannes CONSÉCUTIVES, sa cause nommée, la cible arrêtée', { ...MESURE_RETIRABLE, timeout: 90000 }, async (t) => {
  const { vu, temoins } = await jouerHook(t, 'git-mesure-coupee')
  assert.equal(vu.error?.code, 'EMESURE', JSON.stringify(vu))
  const [, pannes] = /^(\d+) mesures consécutives indéterminées : .*SystemRoot absent/.exec(vu.error.message) ?? []
  assert.ok(Number(pannes) > 1, vu.error.message)
  assert.ok(temoins.depuisCoupureMs >= (Number(pannes) - 1) * 250, `${pannes} pannes comptées en ${temoins.depuisCoupureMs} ms : la panne isolée n'est pas remise à zéro`)
  assert.deepEqual([vu.error.codeMesure, vu.error.categorie], [vu.error.cause.code, vu.error.cause.categorie])
  assert.deepEqual([vu.error.cause.code, vu.error.cause.categorie], ['MESURE_PROCESSUS_IMPOSSIBLE', 'panne'])
  assert.equal(vu.arret.etat, 'mort', JSON.stringify(vu.arret))
})

test('supervision : une mesure perdue en vol avec le parent réel tué (ESRCH) interrompt en EPARENT, jamais en EMESURE', { ...MESURE_RETIRABLE, timeout: 60000 }, async (t) => {
  const { vu } = await jouerHook(t, 'git-mesure-coupee-tue')
  assert.equal(vu.error?.code, 'EPARENT', JSON.stringify(vu))
  assert.equal(vu.error.message, 'parent disparu')
})

test('#2795 mesure initiale impossible : EMESURE conserve le code, la catégorie et la cause de la mesure, avant tout hôte', MESURE_RETIRABLE, async () => {
  const systemRoot = process.env.SystemRoot
  let lancement; let supervision
  delete process.env.SystemRoot
  try {
    lancement = lancerProcessusSupervise('executable-introuvable-2795', [], { surveillerGit: true })
    supervision = superviserProcessus({ commande: 'executable-introuvable-2795', surveillerGit: true })
  } finally { process.env.SystemRoot = systemRoot }
  await assert.rejects(lancement, (e) => {
    assert.deepEqual([e.code, e.codeMesure, e.categorie, e.hoteLance], ['EMESURE', e.cause.code, e.cause.categorie, false])
    assert.deepEqual([e.cause.code, e.cause.categorie], ['MESURE_PROCESSUS_IMPOSSIBLE', 'panne'])
    assert.match(e.message, /SystemRoot absent/)
    return true
  })
  const vu = await supervision
  assert.deepEqual([vu.status, vu.error.code, vu.error.codeMesure, vu.error.categorie], [null, 'EMESURE', 'MESURE_PROCESSUS_IMPOSSIBLE', 'panne'], JSON.stringify(vu))
  assert.deepEqual(vu.error.cause, { code: 'MESURE_PROCESSUS_IMPOSSIBLE', categorie: 'panne', message: vu.error.message })
  assert.doesNotThrow(() => JSON.stringify(vu))
})

// La mesure Windows est un `powershell.exe` enfant du superviseur, borné par `DELAI_MESURE_PROCESSUS_MS` (processusWorktrees.mjs, mesurerProcessusWorktrees) ; la mesure Linux lit /proc dans le processus superviseur lui-même.
const MESUREUR_SUSPENDU = { skip: process.platform !== 'win32' && 'mesure Linux sans processus mesureur distinct à suspendre' }

test('#2795 mesure initiale expirée deux fois : EMESURE porte le code et la catégorie transitoire de sa cause, avant tout hôte', { ...MESUREUR_SUSPENDU, timeout: 90000 }, async (t) => {
  const vu = await jouerSousSuspendeur(t, `
import assert from 'node:assert/strict'
const { lancerProcessusSupervise, superviserProcessus } = await import(${JSON.stringify(new URL('./superviserProcessus.mjs', import.meta.url).href)})
const echeance = /^\\[transitoire · retentable\\] mesure des processus indéterminée : échéance de \\d+ ms atteinte$/
await assert.rejects(lancerProcessusSupervise('executable-introuvable-2795', [], { surveillerGit: true }), (e) => {
  assert.deepEqual([e.code, e.codeMesure, e.categorie, e.hoteLance], ['EMESURE', 'MESURE_PROCESSUS_EXPIREE', 'transitoire', false], e.message)
  assert.deepEqual([e.cause.code, e.cause.categorie], ['MESURE_PROCESSUS_EXPIREE', 'transitoire'])
  assert.match(e.message, echeance)
  return true
})
const vu = await superviserProcessus({ commande: 'executable-introuvable-2795', surveillerGit: true })
assert.deepEqual([vu.status, vu.error?.code, vu.error?.codeMesure, vu.error?.categorie], [null, 'EMESURE', 'MESURE_PROCESSUS_EXPIREE', 'transitoire'], JSON.stringify(vu))
assert.deepEqual(vu.error.cause, { code: 'MESURE_PROCESSUS_EXPIREE', categorie: 'transitoire', message: vu.error.message })
assert.match(vu.error.message, echeance)
`)
  assert.equal(vu.status, 0, vu.sortie)
  assert.deepEqual(vu.suspendeur, { status: 0, erreurs: '' })
  assert.equal(vu.suspendus.length, 4, `mesureurs suspendus : ${vu.suspendus}`)
})

test('supervision générique longue : aucune mesure de processus, même rendue impossible en vol', { ...MESURE_RETIRABLE, timeout: 60000 }, async (t) => {
  const b = bancSupervision(t)
  const lancee = join(b.dossier, 'cible-lancee')
  const pilote = b.script('generique', `
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
const { superviserProcessus } = await import(${JSON.stringify(new URL('./superviserProcessus.mjs', import.meta.url).href)})
const supervision = superviserProcessus({ commande: process.execPath, args: ['-e', "require('fs').writeFileSync(" + JSON.stringify(${JSON.stringify(lancee)}) + ",'');setTimeout(()=>console.log('fin générique'),6500)"], timeout: 30000 })
while (!existsSync(${JSON.stringify(lancee)})) await new Promise((ok) => setTimeout(ok, 25))
delete process.env.SystemRoot
const vu = await supervision
assert.equal(vu.error, undefined, JSON.stringify(vu))
assert.equal(vu.status, 0)
assert.equal(vu.stdout.trim(), 'fin générique')
`)
  await jouerPilote(b, pilote)
})

/** L'identité `{ pid, creation }` du processus VIVANT `pid`, mesurée : un PID réutilisé après sa mort ne la porte pas, et
 *  `gardienDisparu` juge sa disparition sur elle (#2586). */
function identiteMesureeDe(pid) {
  const identite = mesurerArbreProcessus().find((p) => p.pid === pid)
  assert.ok(identite?.creation, `processus ${pid} absent de la vue`)
  return identite
}

function bancSupervision(t) {
  const dossier = mkdtempSync(join(tmpdir(), '2626-confinement-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const script = (nom, code) => { const chemin = join(dossier, nom + '.mjs'); writeFileSync(chemin, code); return chemin }
  return { dossier, script }
}

/** Joue le script `pilote` dans un Node à part ; son code de sortie nul fait le verdict, sa sortie le diagnostic (#2586). */
async function jouerPilote(b, pilote) {
  const enfant = spawn(process.execPath, [pilote], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TMP: b.dossier, TEMP: b.dossier, TMPDIR: b.dossier } })
  let sortie = ''
  enfant.stdout.on('data', (d) => { sortie += d }); enfant.stderr.on('data', (d) => { sortie += d })
  const status = await new Promise((ok, non) => { enfant.once('error', non); enfant.once('close', ok) })
  assert.equal(status, 0, sortie)
}

test('IPC : le résultat lu après la fermeture de l’hôte conserve la réussite et les flux', { timeout: 20000 }, async (t) => {
  const b = bancSupervision(t)
  const cible = b.script('cible-ipc', "process.stdin.setEncoding('utf8');let entree='';process.stdin.on('data',texte=>entree+=texte);process.stdin.on('end',()=>{process.stdout.write('sortie:'+entree);process.stderr.write('erreur intacte')})")
  const fixture = b.script('lecture-ipc', `
import assert from 'node:assert/strict'
import net from 'node:net'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
let hoteFerme = false; let resultatApresFermeture = false; let pause = false; let reprendre
const spawn = childProcess.spawn
childProcess.spawn = (...args) => {
  const enfant = spawn(...args)
  enfant.once('close', () => {
    hoteFerme = true
    reprendre?.()
  })
  return enfant
}
const creer = net.createServer
net.createServer = (ecouter) => creer((socket) => {
  const ecrire = socket.write.bind(socket)
  socket.write = (texte, ...args) => {
    const retour = ecrire(texte, ...args)
    if (String(texte).includes('"type":"options"')) {
      pause = true
      socket.pause()
      reprendre = () => socket.resume()
      if (hoteFerme) reprendre()
    }
    return retour
  }
  ecouter(socket)
  socket.on('data', (texte) => {
    if (texte.includes('"type":"resultat"')) resultatApresFermeture = hoteFerme
  })
})
syncBuiltinESMExports()
const { superviserProcessus } = await import(${JSON.stringify(new URL('./superviserProcessus.mjs', import.meta.url).href)})
const vu = await superviserProcessus({ commande: process.execPath, args: [${JSON.stringify(cible)}], cwd: ${JSON.stringify(b.dossier)}, timeout: 10000 })
console.log(JSON.stringify(vu))
assert.equal(pause, true)
assert.equal(hoteFerme, true)
assert.equal(resultatApresFermeture, true)
assert.equal(vu.status, 0, JSON.stringify(vu))
assert.equal(vu.error, undefined)
assert.equal(vu.stdout, 'sortie:')
assert.equal(vu.stderr, 'erreur intacte')
`)
  const enfant = spawn(process.execPath, [fixture], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''; let stderr = ''
  enfant.stdout.setEncoding('utf8').on('data', (texte) => { stdout += texte })
  enfant.stderr.setEncoding('utf8').on('data', (texte) => { stderr += texte })
  const fin = await new Promise((ok, non) => {
    enfant.once('error', non)
    enfant.once('close', (status, signal) => ok({ status, signal }))
  })
  assert.equal(fin.status, 0, stdout + stderr)
  assert.equal(fin.signal, null)
  assert.equal(stderr, '')
  assert.equal(JSON.parse(stdout).status, 0)
})

async function attendreFichier(chemin, essais = 200) {
  for (let i = 0; i < essais; i++) {
    try { return readFileSync(chemin, 'utf8') } catch {}
    await new Promise((r) => setTimeout(r, 25))
  }
  assert.fail('fixture non démarrée : ' + chemin)
}

test('confinement : parent bref, feuille détachée et processus étranger préservé', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const pid = join(b.dossier, 'pid')
  const feuille = b.script('feuille', `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>{},1000)`)
  const parent = b.script('bref', `import {spawn} from 'node:child_process';import {existsSync} from 'node:fs';spawn(process.execPath,[${JSON.stringify(feuille)}],{detached:true,stdio:'ignore'}).unref();const i=setInterval(()=>{if(existsSync(${JSON.stringify(pid)})){clearInterval(i);process.exit(0)}},10)`)
  const etranger = spawn(process.execPath, [b.script('etranger', 'setInterval(()=>{},1000)')], { stdio: 'ignore' })
  const finEtranger = new Promise((r) => etranger.once('close', r))
  let feuillePid
  try {
    const vu = await superviserProcessus({ commande: process.execPath, args: [parent], timeout: 10000 })
    feuillePid = Number(readFileSync(pid, 'utf8'))
    assert.equal(vu.status, 0, JSON.stringify(vu))
    assert.equal(vu.error, undefined)
    const vue = mesurerArbreProcessus()
    assert.ok(!vue.some((p) => p.pid === feuillePid && p.etat !== 'Z'), 'la feuille détachée survit au parent bref')
    assert.ok(vue.some((p) => p.pid === etranger.pid && p.etat !== 'Z'), 'le processus étranger doit rester vivant')
    console.log(`CONFINEMENT bref : feuille=${feuillePid} absente, étranger=${etranger.pid} vivant`)
  } finally {
    etranger.kill(); await finEtranger
  }
})

test('confinement : stdin fermé vide, stdout stderr simultanés de plus de 2MiB et UTF8 intact', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const taille = (2 << 20) + 17
  const cible = b.script('io', `let n=0;process.stdin.on('data',b=>n+=b.length);process.stdout.write('é'.repeat(${taille}));process.stderr.write('è'.repeat(${taille}));process.stdin.on('end',()=>{process.stdout.write(':'+n)})`)
  const vu = await superviserProcessus({ commande: process.execPath, args: [cible], timeout: 15000 })
  assert.equal(vu.status, 0, JSON.stringify(vu.error))
  assert.equal(vu.stdout, 'é'.repeat(taille) + ':0')
  assert.equal(vu.stderr, 'è'.repeat(taille))
})

test('confinement : argv exact, environnement cible et absence exécutable', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const args = ['', 'deux mots', 'un"guillemet', 'final\\', '\\\"']
  const cible = b.script('argv', "process.stdout.write(JSON.stringify({args:process.argv.slice(2),path:process.env.PATH,secret:process.env.SECRET_2626}));process.exitCode=42")
  for (const chemin of ['', b.dossier]) {
    const vu = await superviserProcessus({ commande: process.execPath, args: [cible, ...args], env: { PATH: chemin, SECRET_2626: 'secret sans argv' } })
    assert.equal(vu.status, 42, JSON.stringify(vu))
    assert.deepEqual(JSON.parse(vu.stdout), { args, path: chemin, secret: 'secret sans argv' })
  }
  const shell = await superviserProcessus({ commande: 'echo', args: ['IPC-shell'], shell: true })
  assert.equal(shell.status, 0, JSON.stringify(shell))
  assert.equal(shell.stdout.trim(), 'IPC-shell')
  const absent = await superviserProcessus({ commande: 'absent-2626-impossible', env: { PATH: '' } })
  assert.equal(absent.error?.code, 'ENOENT')
  assert.equal(absent.status, null)
  const invalide = await superviserProcessus({ commande: process.execPath, args: ['--version'], env: { SECRET_2626: 'ne-jamais-imprimer\0secret' } })
  assert.ok(invalide.error)
  assert.ok(!JSON.stringify(invalide).includes('ne-jamais-imprimer'))
})

test('confinement : interruption par signal du processus refuse le succès et nettoie la cible', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const pid = join(b.dossier, 'pid')
  const cible = b.script('signal', `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>{},1000)`)
  const supervision = superviserProcessus({ commande: process.execPath, args: [cible], timeout: 15000 })
  const lancee = identiteMesureeDe(Number(await attendreFichier(pid)))
  // SIGINT et SIGTERM de ce processus relaient aussi depotGabarit.mjs:32-33, chargé par gitDeBanc.mjs.
  process.emit('SIGHUP')
  const vu = await supervision
  assert.equal(vu.error?.code, 'EINTR')
  assert.ok(gardienDisparu(lancee, mesurerArbreProcessus()))
})

test('confinement : mort du Node appelant nettoie une feuille déjà orpheline', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const pid = join(b.dossier, 'pid')
  const feuille = b.script('orpheline', `import {writeFileSync} from 'node:fs';if(process.env.SECRET_2626!=='memoire-2626-privee')process.exit(43);writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>{},1000)`)
  const bref = b.script('bref', `import {spawn} from 'node:child_process';spawn(process.execPath,[${JSON.stringify(feuille)}],{detached:true,stdio:'ignore'}).unref()`)
  const parent = b.script('parent', `import {spawn} from 'node:child_process';spawn(process.execPath,[${JSON.stringify(bref)}],{stdio:'ignore'});setInterval(()=>{},1000)`)
  const appelant = b.script('appelant', `import {superviserProcessus} from ${JSON.stringify(new URL('./superviserProcessus.mjs', import.meta.url).href)};const vu=await superviserProcessus({commande:process.execPath,args:[${JSON.stringify(parent)}],heriter:true,env:{...process.env,SECRET_2626:'memoire-2626-privee'}});process.stderr.write(JSON.stringify(vu))`)
  const diagnostic = join(b.dossier, 'hote.log')
  const fd = openSync(diagnostic, 'w')
  const node = spawn(process.execPath, [appelant], { stdio: ['ignore', 'ignore', fd], env: { ...process.env, TMP: b.dossier, TEMP: b.dossier, TMPDIR: b.dossier } })
  closeSync(fd)
  const fin = new Promise((r) => node.once('close', r))
  try {
    const cible = identiteMesureeDe(Number(await attendreFichier(pid).catch((e) => assert.fail(e.message + ' : ' + readFileSync(diagnostic, 'utf8')))))
    const hote = mesurerArbreProcessus().find((p) => p.ppid === node.pid && /^(?:powershell|python)/i.test(p.nom))
    assert.ok(hote, 'hôte natif propriétaire présent')
    node.kill('SIGKILL'); await fin
    for (let i = 0; i < 50; i++) {
      if (gardienDisparu(cible, mesurerArbreProcessus())) break
      await new Promise((r) => setTimeout(r, 30))
    }
    assert.ok(gardienDisparu(cible, mesurerArbreProcessus()), 'la feuille survit à la mort de Node')
    const prives = listerDossier(b.dossier).filter((n) => n.startsWith('wfrp-supervision-'))
    assert.ok(prives.length, 'le contrôle du canal privé doit porter sur le dossier du Node mort')
    for (const prive of prives) {
      const fichiers = listerEntrees(join(b.dossier, prive)).entrees.filter((e) => e.nature === 'file')
      assert.ok(fichiers.every((f) => !/options|resultat/.test(f.nom)), 'aucune option ni résultat dans le privé')
      for (const fichier of fichiers) assert.ok(!readFileSync(join(b.dossier, prive, fichier.nom), 'utf8').includes('memoire-2626-privee'))
    }
  } finally {
    node.kill(); await fin
  }
})

test('IPC : EOF avant les options complètes refuse la cible et conserve stdin séparé', { timeout: 15000 }, async (t) => {
  const b = bancSupervision(t)
  const preuve = join(b.dossier, 'cible-interdite')
  const cible = b.script('interdite', `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(preuve)},'exécutée')`)
  const adresse = process.platform === 'win32' ? '\\\\.\\pipe\\2626-eof-' + randomUUID() : join(b.dossier, 'eof.sock')
  const options = { commande: process.execPath, args: [cible], cwd: b.dossier, shell: false }
  const serveur = createServer((socket) => {
    socket.on('error', () => {})
    socket.resume()
    socket.end(JSON.stringify({ type: 'options', options }))
  })
  await new Promise((ok, non) => { serveur.once('error', non); serveur.listen(adresse, ok) })
  try {
    const vu = await superviserProcessus({
      commande: process.execPath,
      args: [fileURLToPath(new URL('./enfantSupervise.mjs', import.meta.url)), adresse, 'fixture'],
      timeout: 5000,
    })
    assert.equal(vu.status, 1, JSON.stringify(vu))
    assert.equal(vu.error, undefined)
    assert.equal(existsSync(preuve), false, 'EOF ne doit pas autoriser le spawn de cible')
  } finally {
    await new Promise((ok) => serveur.close(ok))
  }
})

test('factory : vrai ChildProcess hôte, cible distincte, streams avant fin et résultat cible conservé', { timeout: 15000 }, async () => {
  const { hote, controle } = await lancerProcessusSupervise(process.execPath, ['-e', "process.stdout.write('IMMÉDIAT\\n');setTimeout(()=>process.exit(37),300)"])
  assert.ok(hote instanceof ChildProcess)
  hote.stdin.end()
  const { pidCible, instanceCible } = await controle.pret
  assert.ok(Number.isSafeInteger(pidCible)); assert.notEqual(pidCible, hote.pid); assert.ok(instanceCible)
  assert.equal(controle.phase, 'execution')
  assert.equal(controle.estFermeture({ code: 'FERMETURE', origine: 'controle-natif', terminale: true }), false)
  let finie = false
  controle.fin.then(() => { finie = true })
  const texte = await new Promise((ok) => hote.stdout.once('data', (b) => ok(b.toString())))
  assert.match(texte, /IMMÉDIAT/); assert.equal(finie, false)
  const fin = await controle.fin
  assert.equal(fin.resultatCible.status, 37); assert.equal(fin.resultatCible.pid, pidCible)
  assert.equal(hote.exitCode, 0); assert.equal(fin.arret.etat, 'mort')
  assert.equal(controle.phase, 'termine')
  assert.throws(() => controle.mesurerDomaine(), (cause) => {
    assert.equal(controle.estFermeture(cause), true)
    assert.equal(controle.estFermeture({ ...cause }), false)
    return true
  })
})

test('factory : des supervisions simultanées partagent un seul écouteur par signal du processus, retiré à la dernière fin', { timeout: 20000 }, async () => {
  const signaux = ['SIGINT', 'SIGTERM', 'SIGHUP']
  const compter = () => signaux.map((nom) => process.listenerCount(nom))
  const avant = compter()
  const lances = await Promise.all([0, 1].map(() => lancerProcessusSupervise(process.execPath, ['-e', 'setTimeout(()=>{},200)'])))
  for (const { hote } of lances) { hote.stdin.end(); hote.stdout.resume(); hote.stderr.resume() }
  assert.deepEqual(compter(), avant.map((n) => n + 1))
  await Promise.all(lances.map(({ controle }) => controle.finPhysique))
  assert.deepEqual(compter(), avant)
})

test('factory : un hôte natif tué après pret publie un arrêt indéterminé qui nomme sa cause', { timeout: 20000 }, async () => {
  const { hote, controle } = await lancerProcessusSupervise(process.execPath, ['-e', 'setInterval(()=>{},1000)'])
  hote.stdin.end(); hote.stdout.resume(); hote.stderr.resume()
  await controle.pret
  hote.kill()
  const fin = await controle.fin
  await controle.finPhysique
  assert.equal(fin.arret.etat, 'indetermine', JSON.stringify(fin))
  assert.deepEqual(fin.arret.erreurs.map((e) => [e.operation, e.code, e.message]), [['cloture', fin.resultatCible.error.code, fin.resultatCible.error.message]], JSON.stringify(fin))
})

test('factory : en processus nu, la projection est l’identité des options reçues', () => {
  const env = { TEMOIN: 'intact' }; const options = { env, cwd: process.cwd() }
  const args = ['--test', 'cible.test.mjs']
  const vue = lancerProcessusSupervise.optionsEffectives(process.execPath, args, options)
  assert.strictEqual(vue.options, options)
  assert.strictEqual(vue.args, args)
  assert.deepEqual(env, { TEMOIN: 'intact' })
  assert.deepEqual(lancerProcessusSupervise.optionsEffectives('autre', [], options), { args: [], options })
})

test('factory : sous la précharge, la projection porte l’intercepteur sans nonce ni modification des options reçues', () => {
  const precharge = new URL('./perimetreSansEcriture.mjs', import.meta.url).href
  const superviseur = new URL('./superviserProcessus.mjs', import.meta.url).href
  const code = `
    const { lancerProcessusSupervise } = await import(${JSON.stringify(superviseur)});
    const env = { TEMOIN: 'intact' }; const options = { env, cwd: process.cwd() };
    const vue = lancerProcessusSupervise.optionsEffectives(process.execPath, ['--test', 'cible.test.mjs'], options);
    const autre = lancerProcessusSupervise.optionsEffectives('autre', [], options);
    console.log(JSON.stringify({ env, args: vue.args, intercepte: vue.options.env.NODE_OPTIONS.includes('intercepterEcritures'),
      nonce: 'WFRP_TESTS_REFUS' in vue.options.env, autreIdentite: autre.options === options }));
  `
  const environnement = { ...process.env }
  delete environnement.NODE_TEST_CONTEXT
  const r = spawnSync(process.execPath, ['--import', precharge, '--input-type=module', '--eval', code], { env: environnement, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout), { env: { TEMOIN: 'intact' }, args: ['--test', 'cible.test.mjs'], intercepte: true, nonce: false, autreIdentite: true })
})

for (const mode of ['persistant', 'close-en-file']) test('clôture bornée : hôte de protocole réel ' + mode, { timeout: 10000 }, async (t) => {
  const b = bancSupervision(t)
  const liberation = join(b.dossier, 'liberer-hote')
  const atomique = new URL('./ecritureJsonAtomique.mjs', import.meta.url).href
  const superviseur = new URL('./superviserProcessus.mjs', import.meta.url).href
  const hoteFixture = b.script('hote-protocole', `
import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ecrireJsonAtomique, publierJsonSiAbsent } from ${JSON.stringify(atomique)}
import { creationMemorisee, estPidVivantDepuis } from ${JSON.stringify(new URL('./pid.mjs', import.meta.url).href)}
import { IDENTITE_MESUREE } from ${JSON.stringify(new URL('../../test/identiteMesuree.mjs', import.meta.url).href)}
const [adresse, jeton, dossier, liberation, mode, naissanceParent] = process.argv.slice(2)
const identiteParent = { ...IDENTITE_MESUREE, lireCreation: creationMemorisee(IDENTITE_MESUREE.lireCreation, { pasMs: 1000, horloge: Date.now }) } // #2586
const configuration = JSON.parse(readFileSync(join(dossier, 'configuration.json'), 'utf8'))
const canal = connect(adresse); canal.setEncoding('utf8')
canal.once('connect', () => canal.write(JSON.stringify({type:'pret',jeton})+'\\n'))
let tampon = ''
canal.on('data', (d) => {
  tampon += d
  if (!tampon.includes('\\n')) return
  const enfant = spawn(process.execPath, ['-e', 'process.exit(37)'], {stdio:'ignore'})
  enfant.once('spawn', () => canal.write(JSON.stringify({type:'cible',pid:enfant.pid,instanceCible:'fixture-exacte'})+'\\n'))
  enfant.once('close', (status, signal) => {
    publierJsonSiAbsent(join(dossier, 'cloture.json'), {version:1,generation:configuration.generation,echeance:Date.now()+configuration.delaiArretMs})
    const cloture = JSON.parse(readFileSync(join(dossier, 'cloture.json'), 'utf8'))
    ecrireJsonAtomique(join(dossier, 'certificat.json'), {version:1,generation:configuration.generation,methode:process.platform==='win32'?'job-windows':'subreaper-linux',zero:true,echeance:cloture.echeance,erreurs:[]})
    canal.end(JSON.stringify({type:'resultat',instanceCible:'fixture-exacte',resultat:{status,signal,pid:enfant.pid}})+'\\n')
    if (mode !== 'persistant') process.exit(0)
    const attente = setInterval(() => { if (existsSync(liberation) || !estPidVivantDepuis(process.ppid, Number(naissanceParent), identiteParent)) { clearInterval(attente); process.exit(0) } }, 5)
  })
})
`)
  const pilote = b.script('pilote-watchdog', `
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { existsSync, writeFileSync } from 'node:fs'
const spawn = childProcess.spawn
const immediat = global.setImmediate; const minuterie = global.setTimeout
let hote; let dossier; let closeEnFile; let closeDistribue = false
childProcess.spawn = (_commande, args, options) => {
  const windows = args.includes('-ControlDirectory')
  dossier = windows ? args[args.indexOf('-ControlDirectory')+1] : args[6]
  const adresse = windows ? args[args.indexOf('-CommandLine')+1] : null
  const commandeWorker = windows ? /"([^"]+)" "([^"]+)"$/.exec(adresse) : null
  const adresseIPC = windows ? commandeWorker[1] : args[4]
  const jeton = windows ? commandeWorker[2] : args[5]
  hote = spawn(process.execPath, [${JSON.stringify(hoteFixture)}, adresseIPC, jeton, dossier, ${JSON.stringify(liberation)}, ${JSON.stringify(mode)}, String(Date.now())], options) // #2586
  if (${JSON.stringify(mode)} === 'close-en-file') {
    const emettre = hote.emit.bind(hote)
    hote.emit = (nom, ...valeurs) => {
      if (nom !== 'close') return emettre(nom, ...valeurs)
      closeEnFile = () => { closeDistribue = true; emettre(nom, ...valeurs) }
      for (const suite of quandCloseEnFile.splice(0)) suite()
      return true
    }
  }
  return hote
}
const quandCloseEnFile = []
const apresCloseEnFile = (suite) => { if (closeEnFile) suite(); else quandCloseEnFile.push(suite) }
if (${JSON.stringify(mode)} === 'close-en-file') global.setTimeout = (fn, ms, ...args) => ms > 100 ? minuterie(fn, ms, ...args) : minuterie(() => apresCloseEnFile(() => {
  immediat(() => immediat(closeEnFile))
  fn(...args)
}), ms)
syncBuiltinESMExports()
const { lancerProcessusSupervise } = await import(${JSON.stringify(superviseur)})
const { controle } = await lancerProcessusSupervise(process.execPath, ['--version'], {delaiArretMs:100})
hote.stdin.end(); hote.stdout.resume(); hote.stderr.resume()
try {
  await controle.pret
  const fin = await controle.fin
  if (${JSON.stringify(mode)} === 'persistant') {
    assert.equal(fin.arret.etat, 'indetermine')
    assert.equal(fin.arret.zeroNatif, true)
    const [cloture] = fin.arret.erreurs
    assert.deepEqual([cloture.operation, cloture.pid, cloture.code, cloture.message], ['cloture', fin.arret.pid, cloture.cause.code, cloture.cause.message], JSON.stringify(fin))
    assert.ok(cloture.cause instanceof Error, JSON.stringify(fin))
    assert.equal(hote.exitCode, null)
    assert.equal(controle.phase, 'cloture')
    assert.equal(existsSync(dossier), true)
    writeFileSync(${JSON.stringify(liberation)}, 'fin')
    await controle.finPhysique
    assert.equal(fin.arret.etat, 'indetermine')
    assert.equal(await controle.fin, fin)
  } else {
    assert.ok(closeEnFile); assert.equal(closeDistribue, true)
    assert.equal(fin.arret.etat, 'mort')
    assert.equal(fin.resultatCible.status, 37)
  }
  assert.equal(existsSync(dossier), false)
  assert.equal(controle.phase, 'termine')
} finally {
  writeFileSync(${JSON.stringify(liberation)}, 'fin')
  await controle.finPhysique
}
`)
  await jouerPilote(b, pilote)
})

test('#2586 requête native : une clôture publiée sans réponse lève FERMETURE avant l’échéance de la requête', { timeout: 15000 }, async (t) => {
  const b = bancSupervision(t)
  const atomique = new URL('./ecritureJsonAtomique.mjs', import.meta.url).href
  const lister = new URL('./lister.mjs', import.meta.url).href
  const superviseur = new URL('./superviserProcessus.mjs', import.meta.url).href
  const hoteFixture = b.script('hote-cloture-sans-reponse', `
import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ecrireJsonAtomique, publierJsonSiAbsent } from ${JSON.stringify(atomique)}
import { listerDossier } from ${JSON.stringify(lister)}
const [adresse, jeton, dossier] = process.argv.slice(2)
const configuration = JSON.parse(readFileSync(join(dossier, 'configuration.json'), 'utf8'))
const canal = connect(adresse); canal.setEncoding('utf8')
canal.once('connect', () => canal.write(JSON.stringify({type:'pret',jeton})+'\\n'))
let tampon = ''; let lance = false
canal.on('data', (d) => {
  tampon += d
  if (lance || !tampon.includes('\\n')) return
  lance = true
  const enfant = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'ignore'})
  enfant.once('spawn', () => canal.write(JSON.stringify({type:'cible',pid:enfant.pid,instanceCible:'fixture-cloture'})+'\\n'))
  const veille = setInterval(() => {
    if (!listerDossier(join(dossier, 'requetes')).some((nom) => nom.endsWith('.json'))) return
    clearInterval(veille)
    publierJsonSiAbsent(join(dossier, 'cloture.json'), {version:1,generation:configuration.generation,echeance:Date.now()+configuration.delaiArretMs})
    enfant.kill()
  }, 5)
  enfant.once('close', (status, signal) => {
    const cloture = JSON.parse(readFileSync(join(dossier, 'cloture.json'), 'utf8'))
    ecrireJsonAtomique(join(dossier, 'certificat.json'), {version:1,generation:configuration.generation,methode:process.platform==='win32'?'job-windows':'subreaper-linux',zero:true,echeance:cloture.echeance,erreurs:[]})
    canal.end(JSON.stringify({type:'resultat',instanceCible:'fixture-cloture',resultat:{status,signal,pid:enfant.pid}})+'\\n', () => process.exit(0))
  })
})
`)
  const pilote = b.script('pilote-cloture-sans-reponse', `
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
const spawn = childProcess.spawn
let hote
childProcess.spawn = (_commande, args, options) => {
  const windows = args.includes('-ControlDirectory')
  const dossier = windows ? args[args.indexOf('-ControlDirectory')+1] : args[6]
  const commandeWorker = windows ? /"([^"]+)" "([^"]+)"$/.exec(args[args.indexOf('-CommandLine')+1]) : null
  const adresseIPC = windows ? commandeWorker[1] : args[4]
  const jeton = windows ? commandeWorker[2] : args[5]
  hote = spawn(process.execPath, [${JSON.stringify(hoteFixture)}, adresseIPC, jeton, dossier], options)
  return hote
}
syncBuiltinESMExports()
const { lancerProcessusSupervise } = await import(${JSON.stringify(superviseur)})
const { controle } = await lancerProcessusSupervise(process.execPath, ['--version'], {delaiArretMs:2000})
hote.stdin.end(); hote.stdout.resume(); hote.stderr.resume()
await controle.pret
const debut = Date.now()
let cause
try { controle.mesurerDomaine({ timeout: 5000 }) } catch (e) { cause = e }
const duree = Date.now() - debut
assert.equal(controle.estFermeture(cause), true, cause?.code + ' : ' + cause?.message)
assert.ok(duree < 5000, duree + ' ms')
const fin = await controle.fin
assert.equal(fin.arret.etat, 'mort', JSON.stringify(fin))
await controle.finPhysique
`)
  await jouerPilote(b, pilote)
})

test('#2586 refus avant l’hôte : un signal déjà annulé rejette avec hoteLance false', async () => {
  const annulation = new AbortController()
  annulation.abort()
  await assert.rejects(lancerProcessusSupervise(process.execPath, ['--version'], { signal: annulation.signal }),
    (e) => e.code === 'ABORT_ERR' && e.hoteLance === false)
})

test('#2586 refus après l’hôte : une panne qui suit le spawn rejette avec hoteLance true', { timeout: 20000 }, async (t) => {
  const b = bancSupervision(t)
  const superviseur = new URL('./superviserProcessus.mjs', import.meta.url).href
  const pilote = b.script('pilote-refus-apres-hote', `
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
const spawn = childProcess.spawn
childProcess.spawn = (_commande, _args, options) => {
  const hote = spawn(process.execPath, ['-e', 'setTimeout(()=>{},200)'], { ...options, stdio: 'ignore' })
  const once = hote.once.bind(hote)
  hote.once = (...args) => { once(...args); throw Object.assign(new Error('panne après lancement'), { code: 'EPANNE' }) }
  return hote
}
syncBuiltinESMExports()
const { lancerProcessusSupervise } = await import(${JSON.stringify(superviseur)})
await assert.rejects(lancerProcessusSupervise(process.execPath, ['--version'], { delaiArretMs: 2000 }),
  (e) => e.code === 'EPANNE' && e.hoteLance === true)
`)
  await jouerPilote(b, pilote)
})

test('#2586 requête native : une réponse tenue sans partage par un tiers se relit sous l’échéance de la requête', { skip: process.platform !== 'win32', timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const atomique = new URL('./ecritureJsonAtomique.mjs', import.meta.url).href
  const lister = new URL('./lister.mjs', import.meta.url).href
  const superviseur = new URL('./superviserProcessus.mjs', import.meta.url).href
  const hoteFixture = b.script('hote-reponse-tenue', `
import { spawn, spawnSync } from 'node:child_process'
import { connect } from 'node:net'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ecrireJsonAtomique } from ${JSON.stringify(atomique)}
import { listerDossier } from ${JSON.stringify(lister)}
const NL = String.fromCharCode(10)
const [adresse, jeton, dossier] = process.argv.slice(2)
const configuration = JSON.parse(readFileSync(join(dossier, 'configuration.json'), 'utf8'))
const canal = connect(adresse); canal.setEncoding('utf8')
canal.once('connect', () => canal.write(JSON.stringify({type:'pret',jeton})+NL))
let tampon = ''; let lance = false
canal.on('data', (d) => {
  tampon += d
  if (lance || !tampon.includes(NL)) return
  lance = true
  const enfant = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'ignore'})
  enfant.once('spawn', () => canal.write(JSON.stringify({type:'cible',pid:enfant.pid,instanceCible:'fixture-reponse-tenue'})+NL))
  let repondu = false
  const veille = setInterval(() => {
    if (existsSync(join(dossier, 'cloture.json'))) { clearInterval(veille); enfant.kill(); return }
    if (repondu) return
    const nom = listerDossier(join(dossier, 'requetes')).find((n) => n.endsWith('.json'))
    if (!nom) return
    repondu = true
    const requete = JSON.parse(readFileSync(join(dossier, 'requetes', nom), 'utf8'))
    const reponse = join(dossier, 'reponses', requete.id + '.json')
    const temporaire = reponse + '.tenu'
    writeFileSync(temporaire, JSON.stringify({version:1,generation:configuration.generation,id:requete.id,ok:true,vue:{processus:[],metriqueMemoire:'fixture'}}))
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$h=[IO.File]::Open('" + temporaire + "','Open','Read','Delete'); [IO.File]::Move('" + temporaire + "','" + reponse + "'); Start-Sleep -Milliseconds 1500; $h.Close()"],
      {stdio:'ignore', windowsHide:true, timeout:20000})
  }, 5)
  enfant.once('close', (status, signal) => {
    const cloture = JSON.parse(readFileSync(join(dossier, 'cloture.json'), 'utf8'))
    ecrireJsonAtomique(join(dossier, 'certificat.json'), {version:1,generation:configuration.generation,methode:'job-windows',zero:true,echeance:cloture.echeance,erreurs:[]})
    canal.end(JSON.stringify({type:'resultat',instanceCible:'fixture-reponse-tenue',resultat:{status,signal,pid:enfant.pid}})+NL, () => process.exit(0))
  })
})
`)
  const pilote = b.script('pilote-reponse-tenue', `
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
const spawn = childProcess.spawn
let hote
childProcess.spawn = (_commande, args, options) => {
  const dossier = args[args.indexOf('-ControlDirectory')+1]
  const commandeWorker = /"([^"]+)" "([^"]+)"$/.exec(args[args.indexOf('-CommandLine')+1])
  hote = spawn(process.execPath, [${JSON.stringify(hoteFixture)}, commandeWorker[1], commandeWorker[2], dossier], options)
  return hote
}
syncBuiltinESMExports()
const { lancerProcessusSupervise } = await import(${JSON.stringify(superviseur)})
const { controle } = await lancerProcessusSupervise(process.execPath, ['--version'], {delaiArretMs:2000})
hote.stdin.end(); hote.stdout.resume(); hote.stderr.resume()
await controle.pret
const vue = controle.mesurerDomaine({ timeout: 15000 })
assert.equal(vue.metriqueMemoire, 'fixture')
controle.demanderArret()
await controle.fin
await controle.finPhysique
`)
  await jouerPilote(b, pilote)
})

test('#2586 refus après l’hôte : des écouteurs de l’hôte qui lèvent rejettent sans attendre une fermeture jamais écoutée', { timeout: 20000 }, async (t) => {
  const b = bancSupervision(t)
  const superviseur = new URL('./superviserProcessus.mjs', import.meta.url).href
  const pilote = b.script('pilote-ecouteurs-qui-levent', `
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
const spawn = childProcess.spawn
childProcess.spawn = (_commande, _args, options) => {
  const hote = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...options, stdio: 'ignore' })
  hote.unref()
  hote.on = () => { throw Object.assign(new Error('écouteur refusé'), { code: 'EPANNE' }) }
  process.once('exit', () => hote.kill())
  return hote
}
syncBuiltinESMExports()
const { lancerProcessusSupervise } = await import(${JSON.stringify(superviseur)})
await assert.rejects(lancerProcessusSupervise(process.execPath, ['--version'], { delaiArretMs: 2000 }),
  (e) => e.code === 'EPANNE' && e.hoteLance === true)
`)
  await jouerPilote(b, pilote)
})

/** Supervise `niveau.mjs <restant>` depuis ce test : chaque niveau supervise le suivant, le dernier supervise un shell
 *  qui pose un petit-enfant `setsid` et un petit-enfant à double fork, puis demande la vue native. Rend le résultat
 *  externe et les rapports des niveaux internes (#2586 c.6244746949). */
async function jouerImbrication(t, restant) {
  const b = bancSupervision(t)
  writeFileSync(join(b.dossier, 'feuille.sh'), [
    `setsid sh -c 'echo $$ >> "$0"; exec sleep 60' "$1" &`,
    `(sh -c 'echo $$ >> "$0"; exec sleep 60' "$1" &)`,
    'wait',
    '',
  ].join('\n'))
  const url = (chemin) => JSON.stringify(new URL(chemin, import.meta.url).href)
  const niveau = b.script('niveau', `
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancerProcessusSupervise } from ${url('./superviserProcessus.mjs')}
import { estPidVivantDepuis } from ${url('./pid.mjs')}
import { IDENTITE_MESUREE } from ${url('../../test/identiteMesuree.mjs')}
const restant = Number(process.argv[2]), dossier = process.argv[3]
const rapport = { niveau: restant }
try {
  if (restant > 1) {
    const { controle } = await lancerProcessusSupervise(process.execPath, [fileURLToPath(import.meta.url), String(restant - 1), dossier], { stdio: 'ignore', timeout: 40000 })
    const { resultatCible, arret } = await controle.fin
    Object.assign(rapport, { status: resultatCible.status, erreur: resultatCible.error ?? null, etat: arret.etat, methode: arret.methode })
  } else {
    const fichier = join(dossier, 'pids')
    const { controle } = await lancerProcessusSupervise('/bin/sh', [join(dossier, 'feuille.sh'), fichier], { stdio: 'ignore', timeout: 30000 })
    await controle.pret
    const borne = Date.now() + 10000
    let pids = []
    while ((pids = existsSync(fichier) ? readFileSync(fichier, 'utf8').split(/\\s+/).filter(Boolean).map(Number) : []).length < 2) {
      if (Date.now() > borne) throw new Error('petits-enfants non démarrés')
      await new Promise((r) => setTimeout(r, 10))
    }
    const lu = Date.now()
    rapport.refus = null
    try { controle.mesurerDomaine({ timeout: 5000 }) } catch (e) { rapport.refus = e.code }
    const { arret } = await controle.fin
    Object.assign(rapport, { etat: arret.etat, methode: arret.methode, petitsEnfants: pids,
      survivants: pids.filter((pid) => estPidVivantDepuis(pid, lu, IDENTITE_MESUREE)) })
  }
} catch (e) { rapport.exception = e.code + ' ' + e.message }
writeFileSync(join(dossier, 'rapport-' + restant + '.json'), JSON.stringify(rapport))
`)
  const externe = await superviserProcessus({ commande: process.execPath, args: [niveau, String(restant), b.dossier], timeout: 50000 })
  const rapports = Array.from({ length: restant }, (_, i) => JSON.parse(readFileSync(join(b.dossier, `rapport-${i + 1}.json`), 'utf8')))
  return { externe, rapports }
}

function verifierImbrication({ externe, rapports }) {
  const [feuille, ...intermediaires] = rapports
  const diagnostic = JSON.stringify({ externe: { ...externe, stdout: undefined }, rapports })
  assert.equal(feuille.exception, undefined, diagnostic)
  assert.equal(feuille.refus, 'ENONSUPPORTE', diagnostic)
  assert.equal(feuille.etat, 'mort', diagnostic)
  assert.equal(feuille.methode, 'subreaper-linux', diagnostic)
  assert.equal(feuille.petitsEnfants.length, 2, diagnostic)
  assert.deepEqual(feuille.survivants, [], diagnostic)
  for (const r of intermediaires) assert.deepEqual([r.exception, r.status, r.erreur, r.etat, r.methode], [undefined, 0, null, 'mort', 'subreaper-linux'], diagnostic)
  assert.deepEqual([externe.status, externe.error, externe.arret.etat, externe.arret.methode], [0, undefined, 'mort', 'subreaper-linux'], diagnostic)
  const vue = mesurerArbreProcessus()
  assert.ok(!feuille.petitsEnfants.some((pid) => vue.some((p) => p.pid === pid && p.etat !== 'Z')), diagnostic)
}

test('#2586 imbrication Linux : supervisé dans supervisé, petits-enfants setsid et double fork tués, vue refusée ENONSUPPORTE', { skip: process.platform !== 'linux', timeout: 60000 }, async (t) => {
  verifierImbrication(await jouerImbrication(t, 1))
})

test('#2586 imbrication Linux sur 3 niveaux : chaque hôte subreaper certifie son zéro', { skip: process.platform !== 'linux', timeout: 90000 }, async (t) => {
  verifierImbrication(await jouerImbrication(t, 2))
})
