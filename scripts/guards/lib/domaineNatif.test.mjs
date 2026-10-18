import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync, linkSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { setTimeout as attendre } from 'node:timers/promises'
import { estPidVivantDepuis } from './pid.mjs'
import { IDENTITE_MESUREE } from '../../test/identiteMesuree.mjs'
import { lireTextePublie, publierJsonSiAbsent } from './ecritureJsonAtomique.mjs'
import { listerDossier } from './lister.mjs'
import { superviserProcessus } from './superviserProcessus.mjs'

const sources = process.env.NATIF_SOURCE_DIRECTORY ?? dirname(fileURLToPath(import.meta.url))
const windows = process.platform === 'win32'
const DRIVE = 'C' + ':'
const citer = (texte) => `"${texte.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`

async function attendreCondition(lire, description, borne = Date.now() + 4000) {
  while (Date.now() < borne) {
    const resultat = lire()
    if (resultat) return resultat
    await attendre(5)
  }
  throw new Error(`Attente native expirée : ${description}`)
}

async function fixture(t, { codeWorker = 0 } = {}) {
  const base = mkdtempSync(join(process.env.NATIF_SCRATCHPAD ?? tmpdir(), 'domaine-natif-'))
  const controle = join(base, 'controle')
  const generation = randomUUID()
  mkdirSync(controle)
  mkdirSync(join(controle, 'requetes'))
  mkdirSync(join(controle, 'reponses'))
  writeFileSync(join(controle, 'configuration.json'), JSON.stringify({ version: 1, generation, delaiArretMs: 2000 }))
  for (const fichier of ['hoteSupervision.ps1', 'processusJob.cs', 'hoteSupervision.py']) copyFileSync(join(sources, fichier), join(base, fichier))
  const worker = join(base, 'worker.cjs')
  writeFileSync(worker, `
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const base=process.argv[2];
const ecrire=(nom,valeur)=>{const tmp=path.join(base,nom+'.tmp');fs.writeFileSync(tmp,JSON.stringify(valeur));fs.renameSync(tmp,path.join(base,nom))};
const runner=spawn(process.execPath,[path.join(base,'descendant.cjs'),base,'runner'],{stdio:'inherit'});
ecrire('worker.json',{pid:process.pid,cible:runner.pid});
setInterval(()=>{if(fs.existsSync(path.join(base,'fin-worker')))process.exit(${codeWorker})},5);
`)
  writeFileSync(join(base, 'descendant.cjs'), `
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const base=process.argv[2],mode=process.argv[3];let lance=false,rafale=false;
const ecrire=(nom,valeur)=>{const tmp=path.join(base,nom+'.tmp');fs.writeFileSync(tmp,JSON.stringify(valeur));fs.renameSync(tmp,path.join(base,nom))};
ecrire(mode+'.json',{pid:process.pid});
setInterval(()=>{
 if(mode==='entree'&&fs.existsSync(path.join(base,'fin-entree')))process.exit(0);
 if(!lance&&mode==='runner'&&fs.existsSync(path.join(base,'creer-entree'))){lance=true;spawn(process.execPath,[__filename,base,'entree'],{stdio:'inherit',env:{}})}
 if(!rafale&&mode==='entree'&&fs.existsSync(path.join(base,'creer-rafale'))){rafale=true;
 const court=()=>spawn(process.platform==='win32'?'${DRIVE}/Windows/System32/cmd.exe':'/bin/true',process.platform==='win32'?['/d','/c','exit']:[],{stdio:'ignore',env:{SystemRoot:'${DRIVE}/Windows'}}).on('exit',()=>{if(!fs.existsSync(path.join(base,'fin-entree')))court()});
 for(let i=0;i<4;i++)court();
 }
 if(!lance&&mode==='entree'&&fs.existsSync(path.join(base,'creer-natif'))){lance=true;
 const enfant=process.platform==='win32'?spawn('${DRIVE}/Windows/System32/ping.exe',['-t','127.0.0.1'],{stdio:'ignore',detached:true,env:{SystemRoot:'${DRIVE}/Windows',windir:'${DRIVE}/Windows'}}):spawn('/bin/sh',['-c','sleep 100'],{stdio:'ignore',detached:true,env:{}});
 ecrire('natif.json',{pid:enfant.pid});
 }
},5);
`)
  const args = windows
    ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(base, 'hoteSupervision.ps1'), '-Node', process.execPath,
      '-CommandLine', [process.execPath, worker, base, 'fixture'].map(citer).join(' '), '-Worktree', base,
      '-ParentPid', String(process.pid), '-ControlDirectory', controle, '-DelaiArretMs', '2000']
    : [join(base, 'hoteSupervision.py'), String(process.pid), process.execPath, worker, base, 'fixture', controle, '2000']
  const hote = spawn(windows ? 'powershell.exe' : 'python3', args, { cwd: base, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let sortie = ''
  hote.stdout.on('data', (chunk) => { sortie += chunk })
  hote.stderr.on('data', (chunk) => { sortie += chunk })
  const fin = new Promise((resolve, reject) => {
    hote.once('error', reject)
    hote.once('close', (code, signal) => resolve({ code, signal, sortie }))
  })
  const fermer = () => publierJsonSiAbsent(join(controle, 'cloture.json'), { version: 1, generation, echeance: Date.now() + 2000 })
  t.after(async () => {
    fermer()
    const resultat = await fin
    assert.equal(resultat.signal, null, resultat.sortie)
    rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 })
  })
  const lire = (nom) => existsSync(join(base, nom)) && JSON.parse(readFileSync(join(base, nom), 'utf8'))
  await attendreCondition(() => {
    if (hote.exitCode !== null) throw new Error(`Hôte fermé avant worker : ${sortie}`)
    return lire('runner.json') && lire('worker.json')
  }, 'worker et cible', Date.now() + 6000)
  let numero = 0
  const requete = async (operation, champs = {}, duree = 1500) => {
    const id = `requete-${++numero}`
    const chemin = join(controle, 'requetes', `${id}.json`)
    const temporaire = `${chemin}.tmp`
    writeFileSync(temporaire, JSON.stringify({ version: 1, generation, id, operation, echeance: Date.now() + duree, ...champs }))
    renameSync(temporaire, chemin)
    return attendreCondition(() => {
      const texte = lireTextePublie(join(controle, 'reponses', `${id}.json`))
      return texte !== undefined && JSON.parse(texte)
    }, id)
  }
  const vue = async () => {
    const reponse = await requete('vue')
    assert.equal(reponse.ok, true, JSON.stringify(reponse))
    return reponse.vue
  }
  const attribuer = (instance, destination, autres = {}) => requete('attribuer', {
    identifiant: instance.identifiant, pid: instance.pid, creation: instance.creation, destination, ...autres,
  })
  return { base, controle, generation, hote, fin, fermer, lire, requete, vue, attribuer }
}

test('domaine natif Windows : Job, attribution exclusive héritée et zéro après sortie worker', { timeout: 10000, skip: !windows }, async (t) => {
  const f = await fixture(t)
  const initiale = await f.vue()
  const parent = initiale.processus.find((p) => p.pid === f.lire('worker.json').cible)
  assert.ok(parent)
  assert.equal(initiale.processus.filter((p) => p.role === 'hote').length, 1)
  assert.equal(initiale.processus.filter((p) => p.role === 'worker').length, 1)
  assert.equal(parent.role, null)
  assert.equal(parent.entreeId, null)
  assert.equal((await f.attribuer(parent, { type: 'parent' })).ok, true)
  assert.equal((await f.attribuer(parent, { type: 'parent' })).ok, true)
  const expiree = await f.requete('vue', {}, -1)
  assert.equal(expiree.ok, false)
  assert.equal(expiree.error.code, 'EXPIRATION')
  assert.equal(existsSync(join(f.controle, 'certificat.json')), false)
  writeFileSync(join(f.base, 'creer-entree'), '')
  const entree = await attendreCondition(() => f.lire('entree.json'), 'entrée')
  const avant = (await f.vue()).processus.find((p) => p.pid === entree.pid)
  assert.ok(avant)
  assert.equal(avant.role, null)
  assert.equal(avant.entreeId, null)
  assert.equal((await f.attribuer(avant, { type: 'entree', id: 'entree-physique' })).ok, true)
  assert.equal((await f.attribuer(avant, { type: 'entree', id: 'entree-physique' })).ok, true)
  writeFileSync(join(f.base, 'creer-natif'), '')
  const natif = await attendreCondition(() => f.lire('natif.json'), 'descendant natif sans émission')
  const apres = await f.vue()
  assert.equal(new Set(apres.processus.map((p) => p.pid)).size, apres.processus.length)
  assert.equal(apres.processus.find((p) => p.pid === parent.pid).role, 'cible')
  const enfant = apres.processus.find((p) => p.pid === natif.pid)
  assert.ok(enfant, JSON.stringify(apres))
  assert.equal(enfant.role, null)
  assert.equal(enfant.entreeId, 'entree-physique')
  for (const processus of apres.processus) {
    assert.ok(processus.identifiant)
    assert.match(processus.creation, /^\d{4}-\d\d-\d\dT.*Z$/)
    assert.ok(Number.isSafeInteger(processus.residentOctets) && processus.residentOctets >= 0)
    assert.equal(processus.etat, 'vivant')
    assert.deepEqual(processus.erreurs, [])
  }
  writeFileSync(join(f.base, 'fin-entree'), '')
  await attendreCondition(() => {
    return !estPidVivantDepuis(entree.pid, Date.parse(avant.creation), IDENTITE_MESUREE)
  }, 'sortie réelle du parent entrée')
  const orpheline = await f.vue()
  assert.equal(orpheline.processus.some((p) => p.pid === entree.pid), false)
  assert.equal(orpheline.processus.find((p) => p.pid === natif.pid)?.entreeId, 'entree-physique')
  writeFileSync(join(f.base, 'fin-worker'), '')
  const resultat = await f.fin
  assert.equal(resultat.code, 0, resultat.sortie)
  assert.equal(estPidVivantDepuis(natif.pid, Date.parse(enfant.creation), IDENTITE_MESUREE), false)
  const certificat = JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8'))
  assert.equal(certificat.zero, true)
  assert.equal(certificat.generation, f.generation)
  assert.equal(certificat.methode, 'job-windows')
  assert.deepEqual(certificat.erreurs, [])
  assert.ok(certificat.echeance >= Date.now() - 2000)
  const fichiers = [join(f.controle, 'configuration.json'), join(f.controle, 'cloture.json'), join(f.controle, 'certificat.json'),
    ...listerDossier(join(f.controle, 'reponses')).map((nom) => join(f.controle, 'reponses', nom))]
  for (const fichier of fichiers) assert.doesNotMatch(readFileSync(fichier, 'utf8'), /argv|NODE_OPTIONS|jeton|CommandLine/)
})

test('#2586 domaine natif : un descendant court sorti pendant la capture n’est ni une faute de vue ni une faute de clôture', { timeout: 20000, skip: !windows }, async (t) => {
  const f = await fixture(t)
  const parent = (await f.vue()).processus.find((p) => p.pid === f.lire('worker.json').cible)
  assert.equal((await f.attribuer(parent, { type: 'parent' })).ok, true)
  writeFileSync(join(f.base, 'creer-entree'), '')
  const entree = await attendreCondition(() => f.lire('entree.json'), 'entrée')
  const instance = (await f.vue()).processus.find((p) => p.pid === entree.pid)
  assert.equal((await f.attribuer(instance, { type: 'entree', id: 'entree-rafale' })).ok, true)
  writeFileSync(join(f.base, 'creer-rafale'), '')
  let courts = 0
  for (const borne = Date.now() + 4000; Date.now() < borne;) {
    const reponse = await f.requete('vue')
    assert.equal(reponse.ok, true, JSON.stringify(reponse))
    for (const p of reponse.vue.processus) assert.equal(p.etat, 'vivant')
    courts += reponse.vue.processus.filter((p) => p.pid !== entree.pid && p.entreeId === 'entree-rafale').length
  }
  assert.ok(courts > 0, 'aucun descendant court observé')
  writeFileSync(join(f.base, 'fin-entree'), '')
  writeFileSync(join(f.base, 'fin-worker'), '')
  const resultat = await f.fin
  assert.equal(resultat.code, 0, resultat.sortie)
  assert.deepEqual(JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8')).erreurs, [])
})

test('domaine natif Windows : identité falsifiée refusée sans adoption PID et clôture immuable gagnante', { timeout: 10000, skip: !windows }, async (t) => {
  const f = await fixture(t)
  const parent = (await f.vue()).processus.find((p) => p.pid === f.lire('worker.json').cible)
  const refusee = await f.attribuer(parent, { type: 'parent' }, { identifiant: `${parent.identifiant}-faux` })
  assert.equal(refusee.ok, false)
  assert.equal(refusee.error.code, 'ECONTROLE')
  const resultat = await f.fin
  assert.equal(resultat.code, 70, resultat.sortie)
  const cloture = readFileSync(join(f.controle, 'cloture.json'), 'utf8')
  f.fermer()
  assert.equal(readFileSync(join(f.controle, 'cloture.json'), 'utf8'), cloture)
  const certificat = JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8'))
  assert.equal(certificat.zero, true)
  assert.ok(certificat.erreurs.length > 0)
  assert.equal(certificat.echeance, JSON.parse(cloture).echeance)
})

test('domaine natif : publication externe gagnante conserve exactement son échéance', { timeout: 10000 }, async (t) => {
  const f = await fixture(t)
  const { pid, cible } = f.lire('worker.json')
  const lu = Date.now()
  const echeance = Date.now() + 1000
  const candidat = join(f.controle, 'gagnant.tmp')
  writeFileSync(candidat, JSON.stringify({ version: 1, generation: f.generation, echeance }))
  linkSync(candidat, join(f.controle, 'cloture.json'))
  const resultat = await f.fin
  assert.equal(resultat.code, 0, resultat.sortie)
  const certificat = JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8'))
  assert.equal(certificat.echeance, echeance)
  assert.equal(certificat.zero, true)
  assert.deepEqual(certificat.erreurs, [])
  for (const lance of [pid, cible]) assert.equal(estPidVivantDepuis(lance, lu, IDENTITE_MESUREE), false, String(lance))
})

test('domaine natif Windows : destination entrée monotone, conflit fatal sur instance réellement détenue', { timeout: 10000, skip: !windows }, async (t) => {
  const f = await fixture(t)
  writeFileSync(join(f.base, 'creer-entree'), '')
  const entree = await attendreCondition(() => f.lire('entree.json'), 'entrée')
  const instance = (await f.vue()).processus.find((p) => p.pid === entree.pid)
  assert.equal((await f.attribuer(instance, { type: 'entree', id: 'premiere' })).ok, true)
  assert.equal((await f.vue()).processus.find((p) => p.pid === entree.pid).entreeId, 'premiere')
  const conflit = await f.attribuer(instance, { type: 'entree', id: 'autre' })
  assert.equal(conflit.ok, false)
  assert.equal(conflit.error.code, 'ECONTROLE')
  assert.equal((await f.fin).code, 70)
  const certificat = JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8'))
  assert.equal(certificat.zero, true)
  assert.ok(certificat.erreurs.length > 0)
})

test('domaine natif : Run quatre arguments compose le même Job et clôt le descendant détaché', { timeout: 10000, skip: !windows }, async (t) => {
  const base = mkdtempSync(join(process.env.NATIF_SCRATCHPAD ?? tmpdir(), 'domaine-natif-quatre-'))
  t.after(() => rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }))
  copyFileSync(join(sources, 'processusJob.cs'), join(base, 'processusJob.cs'))
  const worker = join(base, 'worker.cjs')
  const pidFichier = join(base, 'descendant.json')
  writeFileSync(worker, `const {spawn}=require('node:child_process');const fs=require('node:fs');const enfant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',detached:true,env:{}});fs.writeFileSync(${JSON.stringify(pidFichier)},JSON.stringify({pid:enfant.pid}));process.exit(0)`)
  const hoteFichier = join(base, 'quatre.ps1')
  writeFileSync(hoteFichier, `param([string]$Node,[string]$CommandLine,[string]$Worktree)\n$ErrorActionPreference='Stop'\nAdd-Type -Path (Join-Path $PSScriptRoot 'processusJob.cs')\n[SessionJob]::Run($Node,$CommandLine,$Worktree,2000)\n`)
  const hote = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', hoteFichier, '-Node', process.execPath,
    '-CommandLine', [process.execPath, worker].map(citer).join(' '), '-Worktree', base], {
    cwd: base, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, TEMP: base, TMP: base },
  })
  let erreurs = ''
  hote.stderr.on('data', (chunk) => { erreurs += chunk })
  hote.stdout.resume()
  const resultat = await new Promise((resolve, reject) => {
    hote.once('error', reject)
    hote.once('close', (code, signal) => resolve({ code, signal }))
  })
  assert.deepEqual(resultat, { code: 0, signal: null }, erreurs)
  assert.ok(existsSync(pidFichier), 'Le vrai worker quatre arguments a été exécuté')
  const { pid } = JSON.parse(readFileSync(pidFichier, 'utf8'))
  const lu = Date.now()
  assert.ok(Number.isInteger(pid) && pid > 0)
  assert.equal(estPidVivantDepuis(pid, lu, IDENTITE_MESUREE), false)
  assert.equal(listerDossier(base).some((nom) => nom.startsWith('session-job-')), false)
})

test('#2586 domaine natif : en supervision, un worker sorti en code non nul refuse le certificat (EWORKER)', { timeout: 10000 }, async (t) => {
  const f = await fixture(t, { codeWorker: 3 })
  writeFileSync(join(f.base, 'fin-worker'), '')
  const resultat = await f.fin
  assert.equal(resultat.code, 70, resultat.sortie)
  const certificat = JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8'))
  assert.ok(certificat.erreurs.includes('EWORKER statut non nul'), JSON.stringify(certificat))
})

test('#2586 domaine natif Linux : un petit-fils zombie rattaché au subreaper est récolté, arrêt mort', { timeout: 20000, skip: process.platform !== 'linux' }, async () => {
  const vu = await superviserProcessus({ commande: '/bin/sh', args: ['-c', 'sleep 0.1 & exec sleep 0.5'], timeout: 15000 })
  assert.equal(vu.error, undefined, JSON.stringify(vu))
  assert.equal(vu.status, 0)
  assert.deepEqual(vu.arret.erreurs, [])
  assert.equal(vu.arret.etat, 'mort')
})

test('#2586 domaine natif Linux : vue et attribuer refusés ENONSUPPORTE sans faute, descendants détaché et arrêté tués, zéro certifié', { timeout: 10000, skip: process.platform !== 'linux' }, async (t) => {
  const f = await fixture(t)
  const worker = f.lire('worker.json')
  const attribution = { identifiant: 'instance', pid: worker.cible, creation: '2026-10-18T00:00:00.000000000Z', destination: { type: 'parent' } }
  for (const [operation, champs] of [['vue', {}], ['attribuer', attribution]]) {
    const reponse = await f.requete(operation, champs)
    assert.deepEqual([reponse.ok, reponse.error?.code], [false, 'ENONSUPPORTE'], JSON.stringify(reponse))
  }
  writeFileSync(join(f.base, 'creer-entree'), '')
  const entree = await attendreCondition(() => f.lire('entree.json'), 'entrée')
  writeFileSync(join(f.base, 'creer-natif'), '')
  const natif = await attendreCondition(() => f.lire('natif.json'), 'descendant natif détaché')
  const lu = Date.now()
  process.kill(natif.pid, 'SIGSTOP')
  writeFileSync(join(f.base, 'fin-worker'), '')
  const resultat = await f.fin
  assert.equal(resultat.code, 0, resultat.sortie)
  for (const pid of [worker.pid, worker.cible, entree.pid, natif.pid]) assert.equal(estPidVivantDepuis(pid, lu, IDENTITE_MESUREE), false, String(pid))
  const certificat = JSON.parse(readFileSync(join(f.controle, 'certificat.json'), 'utf8'))
  assert.deepEqual([certificat.methode, certificat.zero, certificat.erreurs, certificat.generation], ['subreaper-linux', true, [], f.generation])
})

test('#2586 hôte Linux : vue et attribuer refusés ENONSUPPORTE sans faute, échéance EXPIRATION, opération inconnue fautive et dernière servie', { timeout: 10000 }, (t) => {
  const base = mkdtempSync(join(process.env.NATIF_SCRATCHPAD ?? tmpdir(), 'hote-requetes-'))
  t.after(() => rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }))
  const generation = randomUUID()
  writeFileSync(join(base, 'configuration.json'), JSON.stringify({ version: 1, generation, delaiArretMs: 2000 }))
  mkdirSync(join(base, 'requetes'))
  const requetes = { 'a-vue': ['vue', 1], 'b-attribuer': ['attribuer', 1], 'c-expiree': ['vue', -1], 'd-inconnue': ['inconnue', 1], 'e-apres-faute': ['vue', 1] }
  for (const [id, [operation, signe]] of Object.entries(requetes)) {
    writeFileSync(join(base, 'requetes', id + '.json'), JSON.stringify({ version: 1, generation, id, operation, echeance: Date.now() + signe * 60000 }))
  }
  const banc = 'import importlib.util,json,sys\n' +
    'spec=importlib.util.spec_from_file_location("hote",sys.argv[1]);hote=importlib.util.module_from_spec(spec);spec.loader.exec_module(hote)\n' +
    'domaine=hote.Domaine(sys.argv[2],2000);domaine.requetes();print(json.dumps(domaine.erreurs))\n'
  const r = spawnSync(windows ? 'python' : 'python3', ['-B', '-c', banc, join(sources, 'hoteSupervision.py'), base], { encoding: 'utf8', timeout: 8000 })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout), ['EPROTO opération'])
  const reponse = (id) => existsSync(join(base, 'reponses', id + '.json')) ? JSON.parse(readFileSync(join(base, 'reponses', id + '.json'), 'utf8')) : null
  assert.deepEqual(Object.keys(requetes).map((id) => [id, reponse(id)?.ok, reponse(id)?.error?.code]), [
    ['a-vue', false, 'ENONSUPPORTE'], ['b-attribuer', false, 'ENONSUPPORTE'], ['c-expiree', false, 'EXPIRATION'],
    ['d-inconnue', false, 'ECONTROLE'], ['e-apres-faute', undefined, undefined]])
})
