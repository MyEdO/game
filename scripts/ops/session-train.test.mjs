import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { setTimeout as attendre } from 'node:timers/promises'
import { citerArgv, lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { NAISSANCE_ABSENTE, estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'

const racine = fileURLToPath(new URL('../../', import.meta.url))
const natif = fileURLToPath(new URL('../guards/lib/processusJob.cs', import.meta.url))
const lanceur = new URL('../guards/lib/lancerDetache.mjs', import.meta.url).href
const BLOCKER = `using System;using System.Runtime.InteropServices;public static class Blocker {
[DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateJobObject(IntPtr a,string n);
[DllImport("kernel32.dll")]static extern bool SetInformationJobObject(IntPtr j,int c,IntPtr p,uint s);
[DllImport("kernel32.dll")]static extern bool AssignProcessToJobObject(IntPtr j,IntPtr p);
[DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
static IntPtr job;
public static void Enter(){job=CreateJobObject(IntPtr.Zero,null);IntPtr p=Marshal.AllocHGlobal(144);try{Marshal.Copy(new byte[144],0,p,144);if(!SetInformationJobObject(job,9,p,144)||!AssignProcessToJobObject(job,GetCurrentProcess()))throw new Exception("blocker");}finally{Marshal.FreeHGlobal(p);}}
}`
const ps = (texte) => "'" + texte.replaceAll("'", "''") + "'"
async function jusqua(lire, nom, ms = 15000) {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    const valeur = lire()
    if (valeur) return valeur
    await attendre(20)
  }
  throw new Error('Échéance : ' + nom)
}


const lancement = {script:'train', args:[], cwd:racine, fdLog:'ignore', plateforme:'win32'}
for (const vu of [{status:1,stdout:'{"ReturnValue":0,"ProcessId":4242}'},{status:null,signal:'SIGTERM'},{error:{code:'ETIMEDOUT'}},{stdout:'{"ReturnValue":0,"ProcessId":4242}'},{status:0,stdout:'4242'},{status:0,stdout:'{"ReturnValue":0,"ProcessId":"4242"}'},{status:0,stdout:'{"ReturnValue":0,"ProcessId":0}'}]) {
  test('broker : réponse indéterminée '+JSON.stringify(vu), () => {
    let appels=0
    assert.throws(()=>lancerDetache({...lancement,executerSync:()=>{appels++;return vu}}),/EINDETERMINE.*ne pas relancer/)
    assert.equal(appels,1)
  })
}
for (const code of [2,3,21,9]) {
  test('broker : refus non retentable '+code,()=>{
    let appels=0
    assert.throws(()=>lancerDetache({...lancement,executerSync:()=>{appels++;return {status:0,stdout:JSON.stringify({ReturnValue:code,ProcessId:4242})}}}), code===21 ? /EVALIDATION/ : code===9 ? /EREFUS/ : /EPERMISSION/)
    assert.equal(appels,1)
  })
}
test('broker : données stdin UTF8 et programme fixe local',()=>{
  const captures=[]
  for (const arg of ['é', 'quote"; $env:TRAIN_VALUE', '中文']) lancerDetache({...lancement,args:[arg],envSupplementaire:{TRAIN_VALUE:arg,GIT_INDEX_FILE:'interdit',WFRP_VERROU_TEST:'interdit'},executerSync:(exe,args,options)=>{
    captures.push({exe,args,options});return {status:0,stdout:'{"ReturnValue":0,"ProcessId":4242}'}
  }})
  assert.deepEqual(captures[0].args,captures[1].args)
  assert.equal(captures[0].exe,'powershell.exe')
  assert.equal(captures[0].options.timeout,10000)
  assert.equal(captures[0].options.windowsHide,true)
  assert.match(captures[0].args.at(-1),/Invoke-CimMethod -ClassName Win32_Process -MethodName Create/)
  assert.match(captures[0].args.at(-1),/CreateFlags=\[uint32\]0x01000410/)
  assert.match(captures[0].args.at(-1),/ShowWindow=\[uint16\]0/)
  assert.doesNotMatch(captures[0].args.at(-1),/ComputerName|CimSession|Credential|Start-Process|Add-Type/)
  const data=JSON.parse(captures[2].options.input)
  assert.equal(data.cwd,racine)
  assert.ok(data.environment.includes('TRAIN_VALUE=中文'))
  assert.ok(!data.environment.some(v => v.startsWith('GIT_INDEX_FILE=') || v.startsWith('WFRP_VERROU_TEST=')))
  assert.equal(captures[2].options.env.TRAIN_VALUE, undefined)
  assert.equal(captures[2].options.env.GIT_INDEX_FILE, undefined)
  assert.ok(data.commande.includes(citerArgv('中文')))
})
for (const champ of ['cwd', 'node']) {
  test('broker : chemin relatif refusé avant helper, ' + champ, () => {
    assert.throws(() => lancerDetache({
      ...lancement,
      [champ]: 'relatif',
      executerSync: () => assert.fail('helper'),
    }), /EVALIDATION/)
  })
}
test('broker : exception du helper classée indéterminée', () => {
  assert.throws(() => lancerDetache({
    ...lancement,
    executerSync: () => { throw new Error('helper interrompu') },
  }), /EINDETERMINE/)
})


test('broker natif : helper expiré après création, résultat indéterminé et train vivant', {
  skip: process.platform !== 'win32', timeout: 20000,
}, async () => {
  const base = mkdtempSync(join(tmpdir(), 'session-broker-course-'))
  const marqueur = join(base, 'entree.json')
  const fini = join(base, 'fin.json')
  const train = join(base, 'train.mjs')
  writeFileSync(train, `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marqueur)},JSON.stringify({pid:process.pid}));setTimeout(()=>fs.writeFileSync(${JSON.stringify(fini)},'fini'),5000)`)
  try {
    let appels = 0
    assert.throws(() => lancerDetache({
      script: train, args: [], cwd: racine, fdLog: 'ignore',
      executerSync: (exe, args, options) => {
        appels++
        return spawnSync(exe, [...args.slice(0, -1), args.at(-1) + '; Start-Sleep -Seconds 20'], {
          ...options, timeout: 4000,
        })
      },
    }), /EINDETERMINE/)
    assert.equal(appels, 1)
    const entree = JSON.parse(readFileSync(marqueur, 'utf8'))
    assert.equal(estPidVivantDepuis(entree.pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), true)
    assert.equal(existsSync(fini), false)
    await jusqua(() => existsSync(fini), 'train après helper mort')
    await jusqua(() => !estPidVivantDepuis(entree.pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), 'sortie après helper mort')
  } finally {
    if (existsSync(marqueur)) {
      const { pid } = JSON.parse(readFileSync(marqueur, 'utf8'))
      await jusqua(() => !estPidVivantDepuis(pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), 'nettoyage train course')
    }
    rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  }
})

for (const mode of ['racine', 'entree', 'parent-bloquant']) {
  test('train natif : ' + mode + ', détaché sélectif et clôture', { skip: process.platform !== 'win32', timeout: 45000 }, async (t) => {
    const base = mkdtempSync(join(tmpdir(), 'session-train-'))
    const controle = join(base, 'controle'), generation = randomUUID()
    mkdirSync(controle); mkdirSync(join(controle, 'requetes')); mkdirSync(join(controle, 'reponses'))
    writeFileSync(join(controle, 'configuration.json'), JSON.stringify({ version: 1, generation, delaiArretMs: 2000 }))
    const lire = (nom) => existsSync(join(base, nom)) && JSON.parse(readFileSync(join(base, nom), 'utf8'))
    const enfant = join(base, 'enfant.mjs'), worker = join(base, 'worker.mjs'), train = join(base, 'train.mjs')
    writeFileSync(train, `import fs from 'node:fs';import {userInfo,getPriority} from 'node:os'; const data={pid:process.pid,cwd:process.cwd(),argv:process.argv.slice(4),env:process.env.TRAIN_UNICODE,owner:userInfo().username,priority:getPriority()};fs.appendFileSync(process.argv[2]+'.journal','entrée');fs.writeFileSync(process.argv[2],JSON.stringify(data));const timer=setInterval(()=>{if(fs.existsSync(process.argv[3]+'.autoriser')){clearInterval(timer);fs.writeFileSync(process.argv[3],JSON.stringify(data))}},20);setTimeout(()=>process.exit(0),12000).unref()`)
    writeFileSync(enfant, `import fs from 'node:fs';import {spawn} from 'node:child_process';import {lancerDetache} from ${JSON.stringify(lanceur)};
const base=${JSON.stringify(base)};fs.writeFileSync(base+'/entree.json',JSON.stringify({pid:process.pid}));
const timer=setInterval(()=>{if(!fs.existsSync(base+'/lancer'))return;clearInterval(timer);
const ordinaire=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
fs.writeFileSync(base+'/ordinaire.json',JSON.stringify({pid:ordinaire.pid}));
try {const pid=lancerDetache({script:${JSON.stringify(train)},args:[base+'/debut.json',base+'/fin.json','é 中文', 'quote" espace', 'fin\\\\'],envSupplementaire:{TRAIN_UNICODE:'été 中文'},cwd:${JSON.stringify(racine)},fdLog:'ignore'});fs.writeFileSync(base+'/resultat.json',JSON.stringify({pid}))}
catch(error){fs.writeFileSync(base+'/resultat.json',JSON.stringify({erreur:error.message}))}
},20);setInterval(()=>{},1000)`)
    writeFileSync(worker, `import fs from 'node:fs';import {spawn} from 'node:child_process';spawn(process.execPath,[${JSON.stringify(enfant)}],{stdio:'inherit'});setInterval(()=>{if(fs.existsSync(${JSON.stringify(join(base, 'fermer'))}))process.exit(0)},20)`)

    const host = join(base, 'hote.ps1')
    writeFileSync(host, `$ErrorActionPreference='Stop'\nAdd-Type -Path ${ps(natif)}\n${mode === 'parent-bloquant' ? 'Add-Type -TypeDefinition '+ps(BLOCKER)+'\n[Blocker]::Enter()\n' : ''}[SessionJob]::Run(${ps(process.execPath)},${ps([process.execPath, worker].map(citerArgv).join(' '))},${ps(racine)},30000,0,${ps(controle)},2000)\n`)
    const hote = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', host], { windowsHide: true, cwd: racine, stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    hote.stdout.on('data', (d) => { sortie += d }); hote.stderr.on('data', (d) => { sortie += d })
    const termine = new Promise((resolve) => hote.once('close', (code) => resolve(code)))
    t.after(async () => {
      writeFileSync(join(base, 'fermer'), '')
      await termine
      writeFileSync(join(base, 'fin.json.autoriser'), '')
      await jusqua(() => !lire('debut.json') || existsSync(join(base, 'fin.json')), 'fin détaché', 10000)
      rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    })
    const entree = await jusqua(() => { if(hote.exitCode !== null)throw new Error(sortie);return lire('entree.json') }, 'entrée')
    let numero = 0
    async function requete(operation, champs = {}) {
      const id = 'r' + (++numero), fichier = join(controle, 'requetes', id + '.json')
      writeFileSync(fichier + '.tmp', JSON.stringify({ version: 1, generation, id, operation, echeance: Date.now() + 10000, ...champs }))
      renameSync(fichier + '.tmp', fichier)
      return jusqua(() => existsSync(join(controle, 'reponses', id + '.json')) && JSON.parse(readFileSync(join(controle, 'reponses', id + '.json'), 'utf8')), id)
    }
    if (mode === 'entree') {
      const vue = await requete('vue')
      assert.equal(vue.ok, true, JSON.stringify(vue))
      const instance = vue.vue.processus.find((p) => p.pid === entree.pid)
      assert.ok(instance)
      const affectation = await requete('attribuer', { identifiant: instance.identifiant, pid: instance.pid, creation: instance.creation, destination: { type: 'entree', id: 'train' } })
      assert.equal(affectation.ok, true, JSON.stringify(affectation))
    }
    writeFileSync(join(base, 'lancer'), '')
    const resultat = await jusqua(() => lire('resultat.json'), 'détachement')
    assert.ok(resultat.pid > 0, JSON.stringify(resultat))
    const debut = await jusqua(() => lire('debut.json'), 'démarrage train')
    assert.equal(debut.pid, resultat.pid)
    assert.equal(debut.cwd.replaceAll('\\','/').toLowerCase(), racine.slice(0,-1).replaceAll('\\','/').toLowerCase())
    assert.equal(debut.env, 'été 中文')
    assert.deepEqual(debut.argv, ['é 中文', 'quote" espace', 'fin\\'])
    assert.equal(debut.priority, 10)
    assert.equal(debut.owner, process.env.USERNAME)
    assert.equal(readFileSync(join(base, 'debut.json.journal'), 'utf8'), 'entrée')
    const ordinaire = await jusqua(() => lire('ordinaire.json'), 'ordinaire')
    writeFileSync(join(base, 'fermer'), '')
    assert.equal(await termine, 0, sortie)
    const certificat = JSON.parse(readFileSync(join(controle, 'certificat.json'), 'utf8'))
    assert.equal(certificat.zero, true)
    assert.deepEqual(certificat.erreurs, [])
    t.diagnostic(JSON.stringify({ mode, hote: hote.pid, train: resultat.pid, ordinaire: ordinaire.pid, debut, certificat }))
    assert.equal(estPidVivantDepuis(ordinaire.pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), false)
    {
      assert.equal(existsSync(join(base, 'fin.json')), false, 'train encore en vol à la clôture')
      assert.equal(estPidVivantDepuis(resultat.pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), true)
      writeFileSync(join(base, 'fin.json.autoriser'), '')
      assert.equal((await jusqua(() => lire('fin.json'), 'survie du train')).pid, resultat.pid)
      await jusqua(() => !estPidVivantDepuis(resultat.pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), 'sortie du train')
    }
  })
}
