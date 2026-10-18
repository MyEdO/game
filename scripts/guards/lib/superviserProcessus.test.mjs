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
import { MESURES_INDETERMINEES_MAX, sortieDeSupervision, superviserProcessus, lancerProcessusSupervise } from './superviserProcessus.mjs'
import { ancetresValidesDe, identitePresente, mesurerArbreProcessus } from './arbreProcessus.mjs'

test('un hook refuse de démarrer quand son parent a disparu pendant la mesure initiale', async () => {
  const vu = await superviserProcessus({ commande: 'executable-introuvable-2626', surveillerGit: true, mesurer: () => [] })
  assert.equal(vu.error.code, 'EPARENT')
  assert.equal(vu.status, null)
  assert.match(vu.error.message, /avant démarrage/)
})

function vueHook(git) {
  return [
    { pid: process.pid, ppid: process.ppid, nom: 'node', creation: '2026-10-16T01:00:00.000000002Z' },
    { pid: process.ppid, ppid: -2626, nom: 'sh', creation: '2026-10-16T01:00:00.000000001Z' },
    ...(git ? [{ pid: -2626, ppid: 0, nom: 'git.exe', creation: git }] : []),
  ]
}

test('ascendance du hook : un shell vivant sans git refuse tout lancement', async () => {
  const vu = await superviserProcessus({ commande: 'executable-introuvable-2626', surveillerGit: true, mesurer: () => vueHook() })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.status, null)
  assert.equal(vu.error.message, 'ancêtre git absent avant démarrage du hook')
})

test('ascendance du hook : un PID git réutilisé plus jeune que le shell refuse tout lancement', async () => {
  const vu = await superviserProcessus({ commande: 'executable-introuvable-2626', surveillerGit: true, mesurer: () => vueHook('2026-10-16T01:00:00.000000002Z') })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.status, null)
})

test('ascendance du hook : une identité courante absente refuse tout lancement', async () => {
  const vu = await superviserProcessus({ commande: 'executable-introuvable-2626', surveillerGit: true, mesurer: () => vueHook('2026-10-16T01:00:00.000000000Z').filter((p) => p.pid !== process.pid) })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.status, null)
})

test('ascendance du hook : une chaîne chronologique valide autorise le lancement', async () => {
  const vu = await superviserProcessus({ commande: process.execPath, args: ['--version'], stdio: 'ignore', surveillerGit: true, mesurer: () => vueHook('2026-10-16T01:00:00.000000000Z') })
  assert.equal(vu.status, 0)
  assert.equal(vu.error, undefined)
})

test('une erreur de supervision refuse la sortie même après un enfant réussi', () => {
  let diagnostic = ''
  const journal = { write: (texte) => { diagnostic += texte } }
  for (const code of ['EMESURE', 'EFLUX']) {
    const resultat = { status: 0, error: { code, message: 'nettoyage impossible' } }
    assert.equal(sortieDeSupervision(resultat, journal), 1)
    assert.ok(diagnostic.includes(`${code} : nettoyage impossible`))
  }
  assert.equal(sortieDeSupervision({ status: 0 }, journal), 0)
  assert.equal(sortieDeSupervision({ status: 3 }, journal), 3)
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
  assert.equal(identitePresente({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'nouveau' }]), false)
  assert.equal(identitePresente({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'ancien' }]), true)
  assert.equal(identitePresente({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'ancien', etat: 'Z' }]), false)
})

const VUE_SAINE = '2026-10-16T01:00:00.000000000Z'

/** L'identité de création des gardiens de `vue` : leur `creation` lue dans la vue injectée, `decalageMs` en plus (#2586). */
function identiteDe(vue, decalageMs = 0) {
  return {
    lireCreation: (pid) => {
      const gardien = vue.find((p) => p.pid === pid)
      return gardien ? Date.parse(gardien.creation) + decalageMs : null
    },
    toleranceMs: 0,
  }
}

test('supervision : une panne de mesure isolée suivie d’une vue saine laisse le hook aller à son terme', { timeout: 20000 }, async () => {
  let lectures = 0
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', 'setTimeout(()=>{},2500)'],
    timeout: 15000,
    surveillerGit: true,
    estVivant: () => true,
    identite: identiteDe(vueHook(VUE_SAINE)),
    mesurer: () => {
      lectures += 1
      if (lectures === 2) throw new Error('CIM injecté indisponible')
      return vueHook(VUE_SAINE)
    },
  })
  assert.equal(vu.error, undefined)
  assert.equal(vu.status, 0)
  assert.ok(lectures > 3, `${lectures} lectures : la surveillance a repris après la panne`)
})

test('supervision : des pannes de mesure consécutives au-delà de la borne interrompent, nomment leur compte et nettoient l’enfant', { timeout: 60000 }, async () => {
  let lectures = 0
  let enfant
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['--input-type=module', '-e', 'setInterval(()=>{},1000)'],
    timeout: 45000,
    surveillerGit: true,
    estVivant: () => true,
    identite: identiteDe(vueHook(VUE_SAINE)),
    mesurer: () => {
      lectures += 1
      if (lectures === 1) return vueHook(VUE_SAINE)
      enfant ??= mesurerArbreProcessus().find((p) => p.ppid === process.pid && /^(?:powershell(?:\.exe)?|python(?:3(?:\.\d+)?)?)$/i.test(p.nom))
      throw new Error('CIM injecté indisponible')
    },
  })
  assert.equal(vu.error?.code, 'EMESURE')
  assert.equal(vu.error.message, `${MESURES_INDETERMINEES_MAX} mesures consécutives indéterminées : CIM injecté indisponible`)
  assert.ok(lectures >= 1 + MESURES_INDETERMINEES_MAX)
  assert.ok(enfant)
  assert.equal(identitePresente(enfant, mesurerArbreProcessus()), false)
})

test('supervision : un gardien absent d’une vue saine interrompt en EPARENT', { timeout: 20000 }, async () => {
  let lectures = 0
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
    timeout: 15000,
    surveillerGit: true,
    estVivant: () => true,
    mesurer: () => (lectures += 1) === 1 ? vueHook(VUE_SAINE) : vueHook(),
  })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.error.message, 'parent disparu')
})

test('supervision : une mesure en échec avec un gardien prouvé mort (ESRCH) interrompt en EPARENT, jamais en EMESURE', { timeout: 20000 }, async () => {
  let lectures = 0
  const sondes = []
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
    timeout: 15000,
    surveillerGit: true,
    estVivant: (pid) => { sondes.push(pid); return pid !== -2626 },
    identite: identiteDe(vueHook(VUE_SAINE)),
    mesurer: () => {
      if ((lectures += 1) === 1) return vueHook(VUE_SAINE)
      throw new Error('CIM injecté indisponible')
    },
  })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.error.message, 'parent disparu')
  assert.ok(sondes.includes(-2626))
})

test('supervision : une mesure en échec avec un gardien au pid réutilisé (né après sa capture) interrompt en EPARENT sans attendre la borne', { timeout: 20000 }, async () => {
  let lectures = 0
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
    timeout: 15000,
    surveillerGit: true,
    estVivant: () => true,
    identite: identiteDe(vueHook(VUE_SAINE), 60_000),
    mesurer: () => {
      if ((lectures += 1) === 1) return vueHook(VUE_SAINE)
      throw new Error('CIM injecté indisponible')
    },
  })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.error.message, 'parent disparu')
  assert.ok(lectures < 1 + MESURES_INDETERMINEES_MAX, `${lectures} lectures`)
})

test('supervision : une sonde de pid qui lève reste indéterminée, jamais une mort', { timeout: 60000 }, async () => {
  let lectures = 0
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
    timeout: 45000,
    surveillerGit: true,
    estVivant: () => { throw Object.assign(new Error('sonde indisponible'), { code: 'EINVAL' }) },
    mesurer: () => {
      if ((lectures += 1) === 1) return vueHook(VUE_SAINE)
      throw new Error('CIM injecté indisponible')
    },
  })
  assert.equal(vu.error?.code, 'EMESURE')
  assert.ok(lectures >= 1 + MESURES_INDETERMINEES_MAX)
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
  let petitFils
  try {
    const feuille = join(racine, 'feuille.mjs')
    const parent = join(racine, 'parent.mjs')
    const preuve = join(racine, 'preuve')
    const pid = join(racine, 'pid')
    writeFileSync(feuille, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>writeFileSync(${JSON.stringify(preuve)},String(Date.now())),20)`)
    writeFileSync(parent, `import {spawn} from 'node:child_process';spawn(process.execPath,[${JSON.stringify(feuille)}],{detached:true,stdio:['ignore',1,2]}).unref();setInterval(()=>{},1000)`)
    const vu = await superviserProcessus({ commande: process.execPath, args: [parent], timeout: 3500 })
    petitFils = Number(readFileSync(pid, 'utf8'))
    const avant = readFileSync(preuve, 'utf8')
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(readFileSync(preuve, 'utf8'), avant, 'le petit-fils écrit encore après le retour du superviseur')
    assert.match(vu.error?.message, /échéance/)
    assert.ok(!mesurerArbreProcessus().some((p) => p.pid === petitFils && p.etat !== 'Z'), 'le petit-fils doit avoir disparu')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('supervision générique longue : aucune mesure de processus, même défaillante', { timeout: 15000 }, async () => {
  let mesures = 0
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', "setTimeout(()=>console.log('fin générique'),2500)"],
    mesurer: () => { mesures += 1; throw new Error('CIM interdit pour le générique') },
    timeout: 10000,
  })
  assert.equal(vu.status, 0, JSON.stringify(vu))
  assert.equal(vu.stdout.trim(), 'fin générique')
  assert.equal(vu.error, undefined)
  assert.equal(mesures, 0)
  console.log('GÉNÉRIQUE : compteur mesures=' + mesures)
})

function bancSupervision(t) {
  const dossier = mkdtempSync(join(tmpdir(), '2626-confinement-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const script = (nom, code) => { const chemin = join(dossier, nom + '.mjs'); writeFileSync(chemin, code); return chemin }
  return { dossier, script }
}

/** Joue le script `pilote` dans un Node à part ; son code de sortie nul fait le verdict, sa sortie le diagnostic (#2586). */
async function jouerPilote(pilote) {
  const enfant = spawn(process.execPath, [pilote], { stdio: ['ignore', 'pipe', 'pipe'] })
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
const vu = await superviserProcessus({ commande: process.execPath, args: [${JSON.stringify(cible)}], cwd: ${JSON.stringify(b.dossier)}, entree: 'entrée intacte', timeout: 10000 })
console.log(JSON.stringify(vu))
assert.equal(pause, true)
assert.equal(hoteFerme, true)
assert.equal(resultatApresFermeture, true)
assert.equal(vu.status, 0, JSON.stringify(vu))
assert.equal(vu.error, undefined)
assert.equal(vu.stdout, 'sortie:entrée intacte')
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

async function attendreFichier(chemin) {
  for (let i = 0; i < 200; i++) {
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

test('confinement : stdin stdout stderr simultanés de plus de 2MiB et UTF8 intact', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const taille = (2 << 20) + 17
  const cible = b.script('io', `let n=0;process.stdin.on('data',b=>n+=b.length);process.stdout.write('é'.repeat(${taille}));process.stderr.write('è'.repeat(${taille}));process.stdin.on('end',()=>{process.stdout.write(':'+n)})`)
  const vu = await superviserProcessus({ commande: process.execPath, args: [cible], entree: Buffer.alloc(taille, 113), timeout: 15000 })
  assert.equal(vu.status, 0, JSON.stringify(vu.error))
  assert.equal(vu.stdout, 'é'.repeat(taille) + ':' + taille)
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

test('confinement : interruption SIGTERM refuse le succès et nettoie la cible', { timeout: 30000 }, async (t) => {
  const b = bancSupervision(t)
  const pid = join(b.dossier, 'pid')
  const cible = b.script('signal', `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>{},1000)`)
  const supervision = superviserProcessus({ commande: process.execPath, args: [cible], timeout: 15000 })
  const ciblePid = Number(await attendreFichier(pid))
  process.emit('SIGTERM')
  const vu = await supervision
  assert.equal(vu.error?.code, 'EINTR')
  assert.ok(!mesurerArbreProcessus().some((p) => p.pid === ciblePid && p.etat !== 'Z'))
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
  let ciblePid; let hote
  try {
    ciblePid = Number(await attendreFichier(pid).catch((e) => assert.fail(e.message + ' : ' + readFileSync(diagnostic, 'utf8'))))
    hote = mesurerArbreProcessus().find((p) => p.ppid === node.pid && /^(?:powershell|python)/i.test(p.nom))
    assert.ok(hote, 'hôte natif propriétaire présent')
    node.kill('SIGKILL'); await fin
    for (let i = 0; i < 50; i++) {
      if (!mesurerArbreProcessus().some((p) => p.pid === ciblePid && p.etat !== 'Z')) break
      await new Promise((r) => setTimeout(r, 30))
    }
    assert.ok(!mesurerArbreProcessus().some((p) => p.pid === ciblePid && p.etat !== 'Z'), 'la feuille survit à la mort de Node')
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
      entree: 'stdin joueur',
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
    ecrireJsonAtomique(join(dossier, 'certificat.json'), {version:1,generation:configuration.generation,methode:process.platform==='win32'?'job-windows':'ledger-linux',zero:true,echeance:cloture.echeance,erreurs:[]})
    canal.end(JSON.stringify({type:'resultat',instanceCible:'fixture-exacte',resultat:{status,signal,pid:enfant.pid}})+'\\n')
    if (mode === 'close-en-file') process.exit(0)
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
  await jouerPilote(pilote)
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
    ecrireJsonAtomique(join(dossier, 'certificat.json'), {version:1,generation:configuration.generation,methode:process.platform==='win32'?'job-windows':'ledger-linux',zero:true,echeance:cloture.echeance,erreurs:[]})
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
  await jouerPilote(pilote)
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
  await jouerPilote(pilote)
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
  await jouerPilote(pilote)
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
  await jouerPilote(pilote)
})
