import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join, resolve, win32 } from 'node:path'
import { liensProcessus, mesurerProcessusWorktrees, porteeProcessus, racineProcessusLinux } from './processusWorktrees.mjs'
import { litteralJs } from './litteralJs.mjs'

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
  const racine = win32.resolve('/terrain avec espace/.wt-1')
  const fichier = racine.replace(/\\/g, '/') + '/x.cjs'
  for (const commande of [`node -e "require('${fichier}');setInterval(()=>{},1000)"`, `node -e "import('file:///${fichier}');setInterval(()=>{},1000)"`])
    assert.ok(liensProcessus({ cwd: win32.resolve('/autre'), commande }, racine, 'win32').length, commande)
  assert.deepEqual(liensProcessus({ cwd: win32.resolve('/autre'), commande: `node -e "require('${fichier.replace('/.wt-1/', '/.wt-1-bis/')}')"` }, racine, 'win32'), [])
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
  const racine = win32.resolve('/terrain avec espace/.wt-1')
  for (const p of [
    { cwd: racine, commande: 'node' },
    { cwd: win32.resolve('/autre'), commande: 'node "' + racine + '\\x.mjs"' },
    { cwd: win32.dirname(racine), commande: 'node ".wt-1/x.mjs"' },
    { cwd: win32.resolve('/autre'), commande: 'npm --prefix="' + racine + '" run dev' },
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
  assert.match(vue.portee, /hors portée : [1-9]\d* processus/)
  console.log('TEMOIN système illisible réel ' + JSON.stringify(p) + ' ' + vue.portee)
})
