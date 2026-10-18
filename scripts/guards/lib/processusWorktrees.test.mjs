import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join, resolve, win32 } from 'node:path'
import { cheminDArgument, liensProcessus, lireCause, mesurerProcessusWorktrees, porteeProcessus, racineProcessusLinux, sousArbre, toleranceDeMesure, classerFiliation, argumentsProcessus, DELAI_MESURE_PROCESSUS_MS } from './processusWorktrees.mjs'
import { citerArgv } from './lancerDetache.mjs'
import { litteralJs } from './litteralJs.mjs'

const DRIVE = 'C' + ':'

test('#2795 cause de lecture : champ et code tirés de la forme des collecteurs ; une cause nue seulement pour un champ muet', () => {
  assert.deepEqual(lireCause('cwd illisible : [win32 5] Accès refusé'), { champ: 'cwd', code: 'win32 5' })
  assert.deepEqual(lireCause('propriétaire illisible : [EACCES] permission denied'), { champ: 'proprietaire', code: 'EACCES' })
  assert.deepEqual(lireCause('cwd illisible : accès refusé (EACCES)'), { champ: 'cwd', code: null })
  assert.deepEqual(lireCause('cwd illisible'), { champ: 'cwd', code: null })
  assert.deepEqual(lireCause('ancêtre illisible : [EACCES] x'), { champ: null, code: null })
  assert.deepEqual(lireCause(Object.assign(new Error('ancêtre illisible'), { cause: { code: 'UNKNOWN' } })), { champ: null, code: 'UNKNOWN' })
  const p = { pid: 1, proprietaire: 'moi', cwd: null, commande: null, creation: 'a', erreurs: ['cwd illisible : [win32 5] Accès refusé', 'commande illisible : [win32 5] Accès refusé'] }
  const erreurs = (q) => porteeProcessus({ utilisateur: 'moi', processus: [q] }).processus[0].erreurs
  assert.deepEqual(erreurs(p), p.erreurs)
  assert.deepEqual(erreurs({ ...p, creation: '', erreurs: [] }), ['commande illisible', 'cwd illisible', 'creation illisible'])
  assert.deepEqual(erreurs({ ...p, commande: '', cwd: '/', erreurs: [] }), [])
})

test('#2795 argument : seule sa part en forme de chemin se canonise ; un chemin \\\\ se compare sans lecture', () => {
  const racine = DRIVE + '\\terrain\\.wt-1'
  assert.equal(cheminDArgument('// Windows may deny (EPERM, EACCES).\nconst x = 1', 'win32'), '// Windows may deny (EPERM, EACCES).')
  assert.equal(cheminDArgument(racine + '\\src\\*.ts', 'win32'), racine + '\\src\\')
  assert.equal(cheminDArgument(racine + '\\f.txt:flux', 'win32'), racine + '\\f.txt')
  assert.equal(cheminDArgument('https://exemple.org/x', 'win32'), 'https')
  assert.equal(cheminDArgument('|', 'win32'), null)
  assert.equal(cheminDArgument('a\nb:c', 'linux'), 'a\nb:c')
  const autre = DRIVE + '\\autre'
  for (const commande of ['node --eval "// Windows may deny (EPERM, EACCES).\nconst p = \\"a/b\\""', 'node -e 1 //serveur/partage/x', 'node \\\\.\\pipe\\x']) assert.deepEqual(liensProcessus({ cwd: autre, commande }, racine, 'win32'), [], commande)
  for (const argument of [racine + '\\src\\*.ts', '\\\\?\\' + racine + '\\x.mjs']) assert.ok(liensProcessus({ cwd: autre, commande: 'node ' + argument }, racine, 'win32').includes('argument ' + argument), argument)
  const avant = DRIVE + '/terrain/.wt-1/x.mjs'
  assert.equal(cheminDArgument('//./' + avant, 'win32'), avant)
  for (const argument of ['//./' + avant, '//?/' + avant, '\\\\.\\' + avant]) assert.ok(liensProcessus({ cwd: autre, argv: ['node', argument] }, racine, 'win32').includes('argument ' + argument), argument)
  assert.ok(sousArbre('\\\\.\\' + racine + '\\x', racine, 'win32'))
  assert.equal(sousArbre('\\\\serveur\\partage\\.wt-1', racine, 'win32'), false)
})

test('arguments processus Windows : CRT, apostrophe littérale, chaînes vides et aller-retour du canon citerArgv', () => {
  const valeurs = ['', DRIVE + "\\l'apostrophe\\test avec espace.mjs", 'a"b', 'fin\\', '\\\\"', 'onglet\tinterne', "l'apostrophe", 'a\\ b']
  const executable = DRIVE + '\\Program Files\\node.exe'
  assert.deepEqual(argumentsProcessus([citerArgv(executable), ...valeurs.map(citerArgv)].join(' '), 'win32'), [executable, ...valeurs])
  for (const [commande, attendu] of [
    [String.raw`node "a b c" d e`, ['node', 'a b c', 'd', 'e']],
    [String.raw`node "ab\"c" "\\" d`, ['node', 'ab"c', '\\', 'd']],
    [String.raw`node a\\\b d"e f"g h`, ['node', String.raw`a\\\b`, 'de fg', 'h']],
    [String.raw`node a\\\"b c d`, ['node', String.raw`a\"b`, 'c', 'd']],
    [String.raw`node a\\\\"b c" d e`, ['node', String.raw`a\\b c`, 'd', 'e']],
    [String.raw`node a"b"" c d`, ['node', 'ab" c d']],
    [String.raw`node a\ b ""`, ['node', 'a\\', 'b', '']],
  ]) assert.deepEqual(argumentsProcessus(commande, 'win32'), attendu, commande)
  assert.deepEqual(argumentsProcessus("node 'a b' \"c d\"", 'linux'), ['node', 'a b', 'c d'])
  assert.deepEqual(liensProcessus({ commande: 'node ' + citerArgv(DRIVE + "\\l'arbre\\test avec espace.mjs") }, DRIVE + "\\l'arbre", 'win32'), ['argument ' + DRIVE + "\\l'arbre\\test avec espace.mjs"])
})

test('projection mémoire : topologie RSS globale, métadonnées ciblées dans la même vue', () => {
  const vue = mesurerProcessusWorktrees({ memoireSeulement: true, pidsAInspecter: [process.pid, process.pid], timeout: DELAI_MESURE_PROCESSUS_MS })
  assert.equal(vue.indeterminee, undefined)
  const courant = vue.processus.find((p) => p.pid === process.pid)
  assert.equal(courant.ppid, process.ppid)
  assert.ok(courant.residentOctets > 0)
  assert.ok(courant.commande)
  assert.ok(courant.cwd)
  assert.ok(courant.creation)
  assert.deepEqual(courant.erreurs, [])
  const autres = vue.processus.filter((p) => p.pid !== process.pid)
  assert.ok(autres.length > 0)
  assert.ok(autres.some((p) => p.residentOctets > 0))
  assert.ok(autres.every((p) => !p.cwd && !p.commande))
})

test('#2626 : le mode identités garde PID, parent et création sans lire cwd ni commande', () => {
  const complet = mesurerProcessusWorktrees({ pids: [process.pid] }).processus[0]
  assert.equal(resolve(complet.image), resolve(process.execPath))
  const leger = mesurerProcessusWorktrees({ pids: [process.pid], identites: true }).processus[0]
  assert.equal(leger.pid, process.pid)
  assert.equal(leger.ppid, process.ppid)
  assert.equal(leger.creation, complet.creation)
  assert.ok(!leger.cwd)
  assert.ok(!leger.commande)
})

test('collecteur Windows : sélection massive locale, une énumération projetée et échec jamais vide valide', { skip: process.platform !== 'win32' }, () => {
  const executable = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
  const collecteur = fileURLToPath(new URL('../../ops/processus-worktrees.ps1', import.meta.url))
  const selection = Array.from({ length: 1500 }, (_, i) => i + 1)
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$global:appels = 0
function Get-CimInstance {
  param($ClassName, $Property, $Filter)
  $global:appels++
  if ($Filter) { throw 'requete ciblee interdite' }
  if ($env:ECHEC_CIM) { throw 'panne CIM temoin' }
  if (@($Property).Count -ne [int]$env:NOMBRE_PROPRIETES) { throw 'projection incorrecte' }
  1..1501 | ForEach-Object {
    [pscustomobject]@{ProcessId=$_;ParentProcessId=0;CreationDate=[DateTime]::Parse('2026-10-16T00:00:00Z').ToUniversalTime();WorkingSetSize=4096}
  }
}
$texte = & $env:COLLECTEUR -Pids $env:SELECTION -Identites:([bool]::Parse($env:IDENTITES)) -MemoireSeulement:([bool]::Parse($env:MEMOIRE))
if ($global:appels -ne 1) { throw 'enumerations multiples' }
$texte
`
  const executer = (memoire, echec = false) => execFileSync(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', timeout: 30_000, windowsHide: true,
    env: { ...process.env, COLLECTEUR: collecteur, SELECTION: selection.join(','), IDENTITES: String(!memoire), MEMOIRE: String(memoire), NOMBRE_PROPRIETES: '4', ECHEC_CIM: echec ? '1' : '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const memoire of [false, true]) {
    const vue = JSON.parse(executer(memoire))
    assert.deepEqual(vue.processus.map((p) => p.pid), selection)
    assert.deepEqual(vue.erreurs, [])
    for (const p of vue.processus) {
      assert.equal(p.ppid, 0)
      assert.equal(Date.parse(p.creation), Date.parse('2026-10-16T00:00:00Z'))
      assert.deepEqual(p.erreurs, [])
      assert.equal(p.residentOctets, memoire ? 4096 : undefined)
    }
  }
  assert.throws(() => executer(false, true), (erreur) => {
    assert.notEqual(erreur.status, 0)
    assert.match(String(erreur.stderr), /panne CIM temoin/)
    assert.throws(() => JSON.parse(String(erreur.stdout)))
    return true
  })
})

test('collecteur Windows : PID 0 jamais rendu, image absente de CIM lue au processus réel', { skip: process.platform !== 'win32' }, () => {
  const executable = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
  const script = String.raw`
$ErrorActionPreference = 'Stop'
function Get-CimInstance {
  param($ClassName, $Property)
  foreach ($id in @(0, $PID)) { [pscustomobject]@{ProcessId=$id;ParentProcessId=0;CreationDate=$null;WorkingSetSize=4096;Name='temoin';ExecutablePath=$null} }
}
& $env:COLLECTEUR
`
  const vue = JSON.parse(execFileSync(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', timeout: 60_000, windowsHide: true, env: { ...process.env, COLLECTEUR: fileURLToPath(new URL('../../ops/processus-worktrees.ps1', import.meta.url)) },
  }))
  assert.equal(vue.processus.length, 1)
  const [p] = vue.processus
  assert.notEqual(p.pid, 0)
  assert.ok(p.cwd && p.commande && p.image, JSON.stringify(p))
  assert.deepEqual(p.erreurs, ['creation illisible'])
})

test('jonction réelle extérieure vers arbre : cwd et référence commandée physiques', async () => {
  const terrain = mkdtempSync(join(tmpdir(), 'processus-alias-'))
  const racine = join(terrain, 'arbre')
  const alias = join(terrain, 'alias')
  mkdirSync(racine)
  symlinkSync(racine, alias, 'junction')
  const enfant = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: alias, stdio: 'ignore' })
  try {
    await new Promise((r) => setTimeout(r, 300))
    const p = mesurerProcessusWorktrees({ pids: [enfant.pid] }).processus.find((p) => p.pid === enfant.pid)
    assert.ok(p)
    assert.ok(liensProcessus(p, racine).includes('cwd'))
    assert.ok(liensProcessus({ cwd: terrain, commande: `node "${join(alias, 'x.mjs')}"` }, racine).length)
    console.log('TEMOIN junction cwd réel ' + JSON.stringify(p))
  } finally {
    const sortie = new Promise((r) => enfant.once('exit', r))
    enfant.kill(); await sortie
    rmSync(terrain, { recursive: true, force: true })
  }
})

test('références de commande : code inline, URL fichier et frontières des chemins voisins', () => {
  const racine = DRIVE + '/terrain avec espace/.wt-1'
  const fichier = racine.replace(/\\/g, '/') + '/x.cjs'
  for (const commande of [`node -e "require('${fichier}');setInterval(()=>{},1000)"`, `node -e "import('file:///${fichier}');setInterval(()=>{},1000)"`])
    assert.ok(liensProcessus({ cwd: DRIVE + '/autre', commande }, racine, 'win32').length, commande)
  assert.deepEqual(liensProcessus({ cwd: DRIVE + '/autre', commande: `node -e "require('${fichier.replace('/.wt-1/', '/.wt-1-bis/')}')"` }, racine, 'win32'), [])
  assert.equal(racineProcessusLinux('linux'), '/proc')
  assert.throws(() => racineProcessusLinux('win32'), /non supporté/)
})

test('références réelles depuis un autre cwd : require inline et import URL fichier', async () => {
  const racine = mkdtempSync(join(tmpdir(), 'processus reference '))
  const fichier = join(racine, 'x.cjs')
  writeFileSync(fichier, 'module.exports = {}')
  try {
    for (const code of [`require(${litteralJs(fichier.replace(/\\/g, '/'))});setInterval(()=>{},1000)`, `import(${litteralJs(pathToFileURL(fichier).href)});setInterval(()=>{},1000)`]) {
      const enfant = spawn(process.execPath, ['-e', code], { cwd: tmpdir(), stdio: 'ignore' })
      try {
        await new Promise((r) => setTimeout(r, 300))
        const vue = mesurerProcessusWorktrees({ pids: [enfant.pid] })
        const p = vue.processus.find((p) => p.pid === enfant.pid)
        assert.ok(p, 'PID témoin présent')
        assert.ok(liensProcessus(p, racine).some((l) => l.startsWith('argument ')), p.commande)
        assert.deepEqual(vue.erreurs, [])
        console.log('TEMOIN référence inline réelle ' + JSON.stringify(p))
      } finally {
        const sortie = new Promise((r) => enfant.once('exit', r))
        enfant.kill()
        await sortie
      }
    }
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('processus : cwd, argument absolu/relatif, prefix, espaces et frontière', () => {
  const racine = DRIVE + '/terrain avec espace/.wt-1'
  for (const p of [
    { cwd: racine, commande: 'node' },
    { cwd: DRIVE + '/autre', commande: 'node "' + racine + '\\x.mjs"' },
    { cwd: win32.dirname(racine), commande: 'node ".wt-1/x.mjs"' },
    { cwd: DRIVE + '/autre', commande: 'npm --prefix="' + racine + '" run dev' },
  ]) assert.ok(liensProcessus(p, racine, 'win32').length, JSON.stringify(p))
  assert.deepEqual(liensProcessus({ cwd: racine + '-bis', commande: 'node "' + racine + '-bis/x"' }, racine, 'win32'), [])
})

test('processus réel : cwd seul et identité mesurée, enfant arrêté', async () => {
  const racine = mkdtempSync(join(tmpdir(), 'processus wt '))
  const configurations = [
    { nom: 'Node cwd seul', executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: racine, lien: 'cwd' },
    { nom: 'Node argument absolu seul', executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)', '--', join(racine, 'argument')], cwd: tmpdir(), lien: 'argument ' },
  ]
  const wow = process.platform === 'win32' ? resolve(process.cwd(), process.env.SystemRoot, 'SysWOW64/WindowsPowerShell/v1.0/powershell.exe') : null
  if (wow && existsSync(wow)) configurations.push({ nom: 'PEB32 cwd seul', executable: wow, args: ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 60'], cwd: racine, lien: 'cwd' })
  try {
  for (const configuration of configurations) {
  const enfant = spawn(configuration.executable, configuration.args, { cwd: configuration.cwd, stdio: 'ignore' })
  try {
    await new Promise((r) => setTimeout(r, 200))
    const vue = mesurerProcessusWorktrees({ pids: [enfant.pid] })
    const p = vue.processus.find((x) => x.pid === enfant.pid)
    assert.ok(p, 'PID témoin présent')
    assert.ok(p.creation)
    assert.ok(liensProcessus(p, racine).some((lien) => lien.startsWith(configuration.lien)), configuration.nom)
    assert.deepEqual(vue.erreurs, [], configuration.nom)
    console.log('TEMOIN ' + configuration.nom + ' PID=' + p.pid + ' creation=' + p.creation + ' cwd=' + p.cwd + ' commande=' + p.commande + ' portee=' + vue.portee)
  } finally {
    const sortie = new Promise((r) => enfant.once('exit', r))
    enfant.kill()
    await sortie
  }
  }
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('portée : propriétaire seul, informations lisibles conservées et utilisateur indéterminé nommé', () => {
  const utilisateur = 'compte courant'
  const vue = porteeProcessus({ utilisateur, processus: [
    { pid: 1, nom: 'courant', proprietaire: utilisateur, commande: 'node', cwd: null, creation: 'a' },
    { pid: 2, nom: 'autre', proprietaire: 'autre compte', commande: 'node /terrain/x', cwd: '/terrain', creation: 'b' },
    { pid: 3, nom: 'inconnu', proprietaire: null, commande: null, cwd: null, creation: null },
  ] })
  assert.match(vue.erreurs.join(' '), /PID 1 courant.*cwd illisible/)
  assert.equal(vue.erreurs.length, 1)
  assert.deepEqual(vue.horsPortee.map((p) => p.pid), [2, 3])
  assert.ok(liensProcessus(vue.processus[1], '/terrain', 'linux').length)
  assert.match(vue.portee, /hors portée : 2.*autre, inconnu/)
})

const TEMOIN_DACL = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TemoinDacl {
  [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("advapi32.dll",SetLastError=true)] public static extern bool GetKernelObjectSecurity(IntPtr h,uint info,byte[] bytes,uint length,out uint needed);
  [DllImport("advapi32.dll",SetLastError=true)] public static extern bool SetKernelObjectSecurity(IntPtr h,uint info,byte[] bytes);
}
'@
$handle = [TemoinDacl]::OpenProcess(0x60000,$false,[int]$env:TEMOIN_PID)
if ($handle -eq [IntPtr]::Zero) { throw 'OpenProcess READ_CONTROL/WRITE_DAC refuse' }
try {
  [uint32]$needed = 0
  [void][TemoinDacl]::GetKernelObjectSecurity($handle,4,$null,0,[ref]$needed)
  $original = New-Object byte[] $needed
  if (-not [TemoinDacl]::GetKernelObjectSecurity($handle,4,$original,$needed,[ref]$needed)) { throw 'DACL illisible' }
  $descriptor = New-Object System.Security.AccessControl.RawSecurityDescriptor($original,0)
  $owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $deny = New-Object System.Security.AccessControl.CommonAce([System.Security.AccessControl.AceFlags]::None,[System.Security.AccessControl.AceQualifier]::AccessDenied,0x10,$owner,$false,$null)
  $descriptor.DiscretionaryAcl.InsertAce(0,$deny)
  $restricted = New-Object byte[] $descriptor.BinaryLength
  $descriptor.GetBinaryForm($restricted,0)
  if (-not [TemoinDacl]::SetKernelObjectSecurity($handle,4,$restricted)) { throw 'restriction DACL refusee' }
  try {
    & $env:TEMOIN_NODE --input-type=module -e 'const { mesurerProcessusWorktrees } = await import(process.env.TEMOIN_LECTEUR); console.log(JSON.stringify(mesurerProcessusWorktrees({pids:[Number(process.env.TEMOIN_PID)]})))'
    if ($LASTEXITCODE -ne 0) { throw "mesure sortie $LASTEXITCODE" }
  } finally {
    if (-not [TemoinDacl]::SetKernelObjectSecurity($handle,4,$original)) { throw 'restauration DACL refusee' }
  }
} finally { [void][TemoinDacl]::CloseHandle($handle) }
`

test('processus utilisateur réel illisible : SID prouvé, VM_READ refusé, DACL restaurée', { skip: process.platform !== 'win32' }, async () => {
  const enfant = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' })
  try {
    await new Promise((r) => setTimeout(r, 200))
    const script = TEMOIN_DACL
    const executable = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
    const vue = JSON.parse(execFileSync(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      encoding: 'utf8', env: { ...process.env, TEMOIN_PID: String(enfant.pid), TEMOIN_NODE: process.execPath, TEMOIN_LECTEUR: new URL('./processusWorktrees.mjs', import.meta.url).href },
    }))
    const p = vue.processus.find((p) => p.pid === enfant.pid)
    assert.equal(p.proprietaire, vue.utilisateur)
    assert.equal(p.cwd, null)
    assert.deepEqual(p.erreurs.map(lireCause), [{ champ: 'cwd', code: 'win32 5' }, { champ: 'commande', code: 'win32 5' }])
    assert.match(vue.erreurs.join(' '), new RegExp('PID ' + enfant.pid + ' node.exe.*cwd illisible'))
    console.log('TEMOIN utilisateur illisible réel ' + JSON.stringify(p))
    assert.ok(mesurerProcessusWorktrees({ pids: [enfant.pid] }).processus[0].cwd, 'DACL restaurée : cwd de nouveau lisible')
  } finally {
    const sortie = new Promise((r) => enfant.once('exit', r))
    enfant.kill()
    await sortie
  }
})

test('processus système réel illisible : propriétaire exclu et portée annoncée', { skip: process.platform !== 'win32' }, () => {
  const vue = mesurerProcessusWorktrees()
  const p = vue.horsPortee.find((p) => !p.proprietaire && !p.commande && !p.cwd)
  assert.ok(p, 'au moins un propriétaire système illisible sur cette machine')
  assert.ok(!vue.erreurs.some((erreur) => erreur.startsWith('PID ' + p.pid + ' ')))
  const causes = p.erreurs.map(lireCause)
  assert.ok(causes.every((c) => c.champ && c.code), p.erreurs.join('; '))
  assert.equal(new Set(causes.map((c) => c.champ)).size, causes.length, p.erreurs.join('; '))
  assert.match(vue.portee, /hors portée : [1-9]\d* processus/)
  console.log('TEMOIN système illisible réel ' + JSON.stringify(p) + ' ' + vue.portee)
})

test('#2603 — création RÉELLE du processus courant : date ISO absolue, à `performance.timeOrigin` près de la tolérance de sa source ; `pids` ne lit que lui', () => {
  const vue = mesurerProcessusWorktrees({ pids: [process.pid], timeout: 30_000 })
  assert.equal(vue.indeterminee, undefined)
  assert.deepEqual(vue.processus.map((p) => p.pid), [process.pid])
  const [{ creation }] = vue.processus
  assert.match(creation, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  const ecart = Date.parse(creation) - performance.timeOrigin
  assert.ok(Math.abs(ecart) <= toleranceDeMesure() + 1_000, `écart ${ecart} ms (${creation})`)
})

test('#2603 — mesure BORNÉE : l’échéance atteinte rend une vue `indeterminee`, jamais une exception', () => {
  // win32 : `execFileSync({ timeout: 0 })` n'a pas d'échéance, la borne la plus courte est 1 ms.
  const timeout = process.platform === 'win32' ? 1 : 0
  const vue = mesurerProcessusWorktrees({ pids: [process.pid], timeout })
  assert.match(vue.indeterminee, /échéance de \d+ ms atteinte/)
  assert.equal(vue.code, 'MESURE_PROCESSUS_EXPIREE')
})

test('filiation : exclusion chronologique précise et qualité d’identité explicite', () => {
  const parent = { pid: 100, ppid: 1, creation: '2026-10-16T00:00:00.000000002Z' }
  const etranger = { pid: 200, ppid: 100, creation: '2026-10-16T00:00:00.000000001Z', residentOctets: NaN, erreurs: ['résident illisible'] }
  assert.equal(classerFiliation(parent, etranger), 'exclue')
  for (const modification of [{ creation: null }, { erreurs: ['identité illisible'] }, { etat: 'Z' }, { creation: '2026-02-30T00:00:00Z' }]) {
    const enfant = { ...etranger, erreurs: [], ...modification }
    assert.equal(classerFiliation(parent, enfant), 'indeterminee')
  }
})
