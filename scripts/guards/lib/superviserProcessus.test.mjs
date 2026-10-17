import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, openSync, closeSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { listerDossier } from './lister.mjs'
import { MESURES_INDETERMINEES_MAX, sortieDeSupervision, superviserProcessus } from './superviserProcessus.mjs'
import { ancetresValidesDe, identitePresente, mesurerArbreProcessus, tuerArbre } from './arbreProcessus.mjs'

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

test('supervision : une panne de mesure isolée suivie d’une vue saine laisse le hook aller à son terme', { timeout: 20000 }, async () => {
  let lectures = 0
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['-e', 'setTimeout(()=>{},2500)'],
    timeout: 15000,
    surveillerGit: true,
    estVivant: () => true,
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
    mesurer: () => {
      if ((lectures += 1) === 1) return vueHook(VUE_SAINE)
      throw new Error('CIM injecté indisponible')
    },
  })
  assert.equal(vu.error?.code, 'EPARENT')
  assert.equal(vu.error.message, 'parent disparu')
  assert.ok(sondes.includes(-2626))
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
    if (petitFils) tuerArbre(petitFils)
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

test('IPC : le résultat lu après la fermeture de l’hôte conserve la réussite et les flux', { timeout: 20000 }, async (t) => {
  const b = bancSupervision(t)
  const cible = b.script('cible-ipc', "process.stdin.setEncoding('utf8');let entree='';process.stdin.on('data',texte=>entree+=texte);process.stdin.on('end',()=>{process.stdout.write('sortie:'+entree);process.stderr.write('erreur intacte')})")
  const fixture = b.script('lecture-ipc', `
import assert from 'node:assert/strict'
import net from 'node:net'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
let hoteFerme = false; let resultatApresFermeture = false; let pause = false
const spawn = childProcess.spawn
childProcess.spawn = (...args) => {
  const enfant = spawn(...args)
  enfant.once('close', () => { hoteFerme = true })
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
      setTimeout(() => socket.resume(), 1000)
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
    if (feuillePid && feuillePid !== etranger.pid) tuerArbre(feuillePid)
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
      const fichiers = listerDossier(join(b.dossier, prive), { avecTypes: true }).entrees.filter((e) => e.nature === 'file')
      assert.ok(fichiers.every((f) => !/options|resultat/.test(f.nom)), 'aucune option ni résultat dans le privé')
      for (const fichier of fichiers) assert.ok(!readFileSync(join(b.dossier, prive, fichier.nom), 'utf8').includes('memoire-2626-privee'))
    }
  } finally {
    if (hote && identitePresente(hote, mesurerArbreProcessus())) tuerArbre(hote.pid)
    if (ciblePid) tuerArbre(ciblePid)
    node.kill()
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
