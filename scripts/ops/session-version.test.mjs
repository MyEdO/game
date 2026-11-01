import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delai } from 'node:timers/promises'
import { choisirCodex, comparerVersions, installerCodex, planifierMiseAJourCodex } from './session-version.mjs'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'

test('version Codex : comparaison semver et préversions', () => {
  assert.equal(comparerVersions('0.163.0+build.1', '0.163.0+build.2'), 0)
  for (const invalide of ['0.163.0-01', '0.163.0-alpha..1', '01.163.0', '0.163.0+']) assert.throws(() => comparerVersions(invalide, '0.163.0'), /VERSION CODEX INVALIDE/)
  for (const [a, b] of [['0.9.0', '0.10.0'], ['0.163.0-rc.2', '0.163.0-rc.10'], ['0.163.0-rc.1', '0.163.0'], ['0.163.0-1', '0.163.0-alpha']]) {
    assert.equal(comparerVersions(a, b), -1)
    assert.equal(comparerVersions(b, a), 1)
    assert.equal(comparerVersions(a, a), 0)
  }
})

function depot(t) {
  const dossier = mkdtempSync(join(tmpdir(), 'session-version-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const versions = join(dossier, 'versions'), globale = join(dossier, 'global', 'codex.exe')
  mkdirSync(versions); mkdirSync(join(dossier, 'global')); writeFileSync(globale, '')
  return { dossier, versions, globale }
}
const plateforme = (versions, version, disposition) => disposition === 'imbriquee'
  ? join(versions, version, 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64')
  : join(versions, version, 'node_modules', '@openai', 'codex-win32-x64')
const executableDe = (versions, version, disposition = 'hissee') => join(plateforme(versions, version, disposition), 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')
function versionnee(versions, version, { marqueur = true } = {}) {
  const paquet = join(versions, version, 'node_modules', '@openai', 'codex'), executable = executableDe(versions, version)
  mkdirSync(join(paquet, 'bin'), { recursive: true }); writeFileSync(join(paquet, 'package.json'), JSON.stringify({ name: '@openai/codex', version })); writeFileSync(join(paquet, 'bin', 'codex.js'), '')
  mkdirSync(dirname(executable), { recursive: true }); writeFileSync(join(plateforme(versions, version, 'hissee'), 'package.json'), JSON.stringify({ name: '@openai/codex', version: `${version}-win32-x64` }))
  writeFileSync(executable, ''); writeFileSync(join(dirname(executable), 'rg.exe'), '')
  if (marqueur) writeFileSync(join(versions, version, 'complet.json'), JSON.stringify({ version, executable }))
  return executable
}
const repond = (sortie) => (exe, args, options) => { assert.deepEqual(args, ['--version']); assert.equal(options.shell, false); assert.ok(options.timeout <= 10_000); return { status: 0, stdout: sortie } }
const publiee = (version) => async (url, options) => {
  assert.equal(url, 'https://registry.npmjs.org/@openai%2fcodex/latest'); assert.ok(options.signal)
  return { ok: true, json: async () => ({ version }) }
}

test('choix Codex : la plus récente des versions complètes, dossier sans marqueur ignoré', (t) => {
  const d = depot(t)
  versionnee(d.versions, '0.99.0')
  const attendue = versionnee(d.versions, '0.168.0')
  versionnee(d.versions, '0.169.0', { marqueur: false })
  mkdirSync(join(d.versions, '0.170.0'))
  assert.deepEqual(choisirCodex({ globale: () => d.globale, dossier: d.versions, executer: repond('codex-cli 0.166.0') }), { version: '0.168.0', executable: attendue })
  assert.deepEqual(choisirCodex({ globale: () => d.globale, dossier: d.versions, executer: repond('codex-cli 0.171.0') }), { version: '0.171.0', executable: d.globale })
  assert.deepEqual(choisirCodex({ globale: () => { throw new Error('AGENT NATIF ABSENT') }, dossier: d.versions }), { version: '0.168.0', executable: attendue })
  assert.throws(() => choisirCodex({ globale: () => { throw new Error('AGENT NATIF ABSENT') }, dossier: join(d.dossier, 'aucune') }), /AGENT NATIF ABSENT/)
})

test('choix Codex : version illisible à exit 0 avertie et lancée telle quelle', (t) => {
  const d = depot(t), avertissements = []
  assert.deepEqual(choisirCodex({ globale: () => d.globale, dossier: d.versions, executer: repond('v0.170.0'), avertir: (m) => avertissements.push(m) }), { version: null, executable: d.globale })
  assert.deepEqual(avertissements, [`${prefixeDeRefus('validation')} VERSION CODEX ILLISIBLE : v0.170.0 ; ${d.globale} lancé tel quel`])
})

test('mise à jour Codex : planifiée en tâche détachée depuis le dossier du cache, rendue sans attendre l’installation', (t) => {
  const d = depot(t), lances = []
  for (const meilleure of ['0.166.0', null]) {
    const enfant = Object.assign(new EventEmitter(), { unref: () => lances.at(-1).push('unref') })
    const env = { CODEX_HOME: 'banc' }
    assert.equal(planifierMiseAJourCodex({ meilleure, dossier: d.versions, env, lancer: (exe, args, options) => { lances.push([exe, args, options]); return enfant } }), undefined)
    const [exe, args, options, unref] = lances.at(-1)
    assert.equal(exe, process.execPath); assert.match(args[0], /session-version\.mjs$/); assert.deepEqual(args.slice(1), ['--installer', d.versions, meilleure ?? ''])
    assert.equal(options.cwd, d.versions); assert.equal(options.detached, true); assert.equal(options.stdio, 'ignore'); assert.equal(options.shell, false); assert.equal(options.env, env); assert.equal(unref, 'unref')
    enfant.emit('error', new Error('spawn EPERM'))
  }
  assert.match(readFileSync(join(d.versions, 'maj.log'), 'utf8'), /lancement de la mise à jour : spawn EPERM/)
})

test('mise à jour Codex : planification en échec avertie, jamais levée ni fatale au lancement', (t) => {
  const d = depot(t), avertissements = [], avertir = (m) => avertissements.push(m), fichier = join(d.dossier, 'fichier'), perdu = join(d.dossier, 'perdu')
  writeFileSync(fichier, '')
  planifierMiseAJourCodex({ meilleure: null, dossier: join(fichier, 'versions'), avertir, lancer: () => assert.fail('lancé sans dossier') })
  planifierMiseAJourCodex({ meilleure: null, dossier: d.versions, avertir, lancer: () => { throw Object.assign(new Error('spawn EACCES'), { code: 'EACCES' }) } })
  const enfant = Object.assign(new EventEmitter(), { unref() {} })
  planifierMiseAJourCodex({ meilleure: null, dossier: perdu, avertir, lancer: () => enfant })
  rmSync(perdu, { recursive: true })
  enfant.emit('error', new Error('spawn ENOENT'))
  assert.equal(avertissements.length, 3)
  for (const [i, cause] of [/E(EXIST|NOTDIR)/, /spawn EACCES/, /spawn ENOENT/].entries()) {
    assert.ok(avertissements[i].startsWith(`${prefixeDeRefus('panne')} MISE À JOUR CODEX NON PLANIFIÉE : `), avertissements[i])
    assert.match(avertissements[i], cause); assert.match(avertissements[i], / ; lancement poursuivi$/)
  }
})

test('mise à jour Codex : l’entrée CLI détachée tourne dans le dossier du cache et y journalise, sans réseau', async (t) => {
  const d = depot(t), sonde = join(d.dossier, 'sans-reseau.mjs'), cwd = join(d.dossier, 'cwd.txt')
  writeFileSync(sonde, `import { writeFileSync } from 'node:fs'
writeFileSync(${JSON.stringify(cwd)}, process.cwd())
globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: '0.166.0' }) })
`)
  let enfant
  planifierMiseAJourCodex({ meilleure: '0.166.0', dossier: d.versions, avertir: (m) => assert.fail(m), lancer: (exe, args, options) => (enfant = spawn(exe, ['--import', pathToFileURL(sonde).href, ...args], options)) })
  for (let i = 0; i < 200 && enfant.exitCode === null; i++) await delai(50)
  assert.equal(enfant.exitCode, 0)
  assert.equal(readFileSync(cwd, 'utf8'), d.versions)
  assert.match(readFileSync(join(d.versions, 'maj.log'), 'utf8'), /^\S+ à jour : 0\.166\.0\n$/)
})

const NPM_FACTICE = `const fs = require('node:fs'), path = require('node:path')
const argv = process.argv.slice(2), cible = argv[argv.indexOf('--prefix') + 1], ici = __dirname
fs.appendFileSync(path.join(ici, 'appels.log'), argv.join(' ') + '\\n')
const lire = (nom) => fs.readFileSync(path.join(ici, nom), 'utf8'), mode = lire('mode'), version = argv.at(-1).split('@').at(-1)
const nm = path.join(cible, 'node_modules', '@openai'), paquet = path.join(nm, 'codex')
fs.mkdirSync(path.join(paquet, 'bin'), { recursive: true }); fs.writeFileSync(path.join(paquet, 'package.json'), JSON.stringify({ name: '@openai/codex', version })); fs.writeFileSync(path.join(paquet, 'bin', 'codex.js'), '')
const binaire = () => {
  const plat = lire('disposition') === 'imbriquee' ? path.join(paquet, 'node_modules', '@openai', 'codex-win32-x64') : path.join(nm, 'codex-win32-x64'), bin = path.join(plat, 'vendor', 'x86_64-pc-windows-msvc', 'bin')
  fs.mkdirSync(bin, { recursive: true }); fs.writeFileSync(path.join(plat, 'package.json'), JSON.stringify({ name: '@openai/codex', version: version + '-win32-x64' }))
  fs.writeFileSync(path.join(bin, 'codex.exe'), ''); fs.writeFileSync(path.join(bin, 'rg.exe'), '')
}
if (mode === 'pend') { fs.writeFileSync(path.join(ici, 'npm.pid'), String(process.pid)); setInterval(() => {}, 1000) }
else if (mode === 'complet' || (mode === 'scripts' && !argv.includes('--ignore-scripts'))) binaire()
`
function npmFactice(d, mode, disposition = 'hissee') {
  const npmCli = join(d.dossier, 'npm', 'npm-cli.js')
  mkdirSync(join(d.dossier, 'npm'), { recursive: true }); writeFileSync(npmCli, NPM_FACTICE); writeFileSync(join(d.dossier, 'npm', 'mode'), mode); writeFileSync(join(d.dossier, 'npm', 'disposition'), disposition)
  return { npmCli, appels: () => existsSync(join(d.dossier, 'npm', 'appels.log')) ? readFileSync(join(d.dossier, 'npm', 'appels.log'), 'utf8').trim().split('\n') : [] }
}
const executerFactice = (exe, args, options) => args[0] === '--version' ? { status: 0, stdout: 'codex-cli 0.166.0' } : spawnSync(exe, args, options)
const installation = (d, npmCli, options = {}) => installerCodex({ dossier: d.versions, meilleure: '0.165.0', fetcher: publiee('0.166.0'), executer: executerFactice, npmCli, arch: 'x64', ...options })
const choixFace = (d, globale = '0.165.0') => choisirCodex({ globale: () => d.globale, dossier: d.versions, executer: repond(`codex-cli ${globale}`) })
const versionsPresentes = (d) => readdirSync(d.versions).filter((n) => /^\d+\.\d+\.\d+$/.test(n)).sort(comparerVersions)

test('mise à jour Codex : installation coupée ignorée au lancement suivant, puis reprise et choisie', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'pend'), pilote = join(d.dossier, 'pilote.mjs')
  writeFileSync(pilote, `const { installerCodex } = await import(${JSON.stringify(pathToFileURL(join(import.meta.dirname, 'session-version.mjs')).href)})
await installerCodex({ dossier: ${JSON.stringify(d.versions)}, meilleure: '0.165.0', fetcher: async () => ({ ok: true, json: async () => ({ version: '0.166.0' }) }), npmCli: ${JSON.stringify(npm.npmCli)}, arch: 'x64' })
`)
  const coupe = spawn(process.execPath, [pilote], { stdio: 'ignore', windowsHide: true })
  const pidNpm = join(d.dossier, 'npm', 'npm.pid')
  for (let i = 0; i < 200 && !existsSync(pidNpm); i++) await delai(50)
  assert.ok(existsSync(pidNpm), 'npm factice jamais lancé')
  coupe.kill(); process.kill(Number(readFileSync(pidNpm, 'utf8')))
  await new Promise((fin) => coupe.exitCode !== null || coupe.signalCode !== null ? fin() : coupe.once('exit', fin))
  assert.ok(existsSync(join(d.versions, '0.166.0', 'node_modules')) && !existsSync(join(d.versions, '0.166.0', 'complet.json')), 'installation coupée attendue')
  assert.ok(existsSync(join(d.versions, '0.166.0.verrou')), 'verrou du pilote tué attendu')
  assert.deepEqual(choixFace(d), { version: '0.165.0', executable: d.globale })
  writeFileSync(join(d.dossier, 'npm', 'mode'), 'complet')
  assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0')
  assert.deepEqual(choixFace(d), { version: '0.166.0', executable: executableDe(d.versions, '0.166.0') })
})

test('mise à jour Codex : codex.exe résolu après npm, paquet de plateforme hissé ou imbriqué', async (t) => {
  for (const disposition of ['hissee', 'imbriquee']) {
    const d = depot(t), npm = npmFactice(d, 'complet', disposition)
    assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0', disposition)
    assert.deepEqual(choixFace(d), { version: '0.166.0', executable: executableDe(d.versions, '0.166.0', disposition) }, disposition)
  }
})

test('mise à jour Codex : binaire absent sans scripts, réinstallé une fois avec ses scripts', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'scripts')
  assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0')
  assert.deepEqual(npm.appels().map((a) => a.includes('--ignore-scripts')), [true, false])
  assert.equal(choixFace(d).version, '0.166.0')
})

test('mise à jour Codex : --version en échec après installation, version ni complète ni choisie, aucun ménage', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'complet')
  for (const version of ['0.159.0', '0.160.0']) versionnee(d.versions, version)
  const executer = (exe, args, options) => args[0] === '--version' ? { status: 1, stderr: 'binaire corrompu' } : spawnSync(exe, args, options)
  assert.equal(await installation(d, npm.npmCli, { executer }), 'échouée : 0.166.0 --version : binaire corrompu')
  assert.equal(existsSync(join(d.versions, '0.166.0', 'complet.json')), false)
  assert.deepEqual(choixFace(d), { version: '0.165.0', executable: d.globale })
  assert.deepEqual(versionsPresentes(d), ['0.159.0', '0.160.0', '0.166.0'])
})

test('mise à jour Codex : verrou tenu par un vivant, aucune installation concurrente ni ménage ; verrou d’un mort repris', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'complet'), verrou = join(d.versions, '0.166.0.verrou')
  for (const version of ['0.159.0', '0.160.0']) versionnee(d.versions, version)
  writeFileSync(verrou, String(process.pid))
  assert.equal(await installation(d, npm.npmCli, { pid: process.pid + 1 }), 'occupée : 0.166.0')
  assert.deepEqual(npm.appels(), [])
  assert.deepEqual(versionsPresentes(d), ['0.159.0', '0.160.0'])
  writeFileSync(verrou, String(spawnSync(process.execPath, ['-e', '']).pid))
  assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0')
  assert.equal(existsSync(verrou), false)
})

test('mise à jour Codex : version achevée par un autre installeur pendant la prise du verrou, jamais réinstallée', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'complet'), mort = 424242
  writeFileSync(join(d.versions, '0.166.0.verrou'), String(mort))
  let achevee
  const estVivant = (pid) => { assert.equal(pid, mort); achevee = versionnee(d.versions, '0.166.0'); return false }
  assert.equal(await installation(d, npm.npmCli, { estVivant }), 'à jour : 0.166.0')
  assert.deepEqual(npm.appels(), [])
  assert.deepEqual(choixFace(d), { version: '0.166.0', executable: achevee })
})

test('mise à jour Codex : ménage par le seul installeur qui vient d’écrire son marqueur, des versions plus anciennes que la sienne', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'complet')
  for (const version of ['0.163.0', '0.164.0', '0.165.0', '0.167.0']) versionnee(d.versions, version)
  versionnee(d.versions, '0.162.0', { marqueur: false })
  versionnee(d.versions, '0.161.0', { marqueur: false }); writeFileSync(join(d.versions, '0.161.0.verrou'), String(process.pid))
  assert.equal(await installation(d, npm.npmCli, { fetcher: publiee('0.165.0') }), 'à jour : 0.165.0')
  assert.deepEqual(versionsPresentes(d), ['0.161.0', '0.162.0', '0.163.0', '0.164.0', '0.165.0', '0.167.0'])
  assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0')
  assert.deepEqual(versionsPresentes(d), ['0.161.0', '0.165.0', '0.166.0', '0.167.0'])
  assert.deepEqual(readdirSync(d.versions).filter((n) => n.endsWith('.verrou')), ['0.161.0.verrou'])
})

test('mise à jour Codex : version en service jamais entamée par le ménage', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'complet')
  for (const version of ['0.163.0', '0.164.0', '0.165.0']) versionnee(d.versions, version)
  const enService = executableDe(d.versions, '0.163.0')
  const delier = (chemin) => { if (chemin === enService) throw Object.assign(new Error(`EBUSY: resource busy or locked, unlink '${chemin}'`), { code: 'EBUSY' }); unlinkSync(chemin) }
  assert.equal(await installation(d, npm.npmCli, { delier }), 'installée : 0.166.0')
  assert.deepEqual(readdirSync(dirname(enService)).sort(), ['codex.exe', 'rg.exe'])
  assert.ok(existsSync(join(d.versions, '0.163.0', 'complet.json')))
  assert.deepEqual(versionsPresentes(d), ['0.163.0', '0.165.0', '0.166.0'])
  assert.equal(existsSync(join(d.versions, '0.163.0.verrou')), false)
  assert.match(readFileSync(join(d.versions, 'maj.log'), 'utf8'), /ménage de 0\.163\.0 reporté : EBUSY/)
})

function exterieurPose(d) {
  const exterieur = executableDe(d.versions, '')
  mkdirSync(dirname(exterieur), { recursive: true }); writeFileSync(join(plateforme(d.versions, '', 'hissee'), 'package.json'), JSON.stringify({ name: '@openai/codex', version: '0.150.0-win32-x64' })); writeFileSync(exterieur, '')
  assert.equal(exterieur, join(d.versions, 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'))
  return exterieur
}

test('mise à jour Codex : un codex.exe hors du dossier de la version n’est ni délié par le ménage ni adopté par l’installeur', async (t) => {
  const sansBinaire = depot(t), npmSansBinaire = npmFactice(sansBinaire, 'paquet-seul')
  exterieurPose(sansBinaire)
  assert.equal(await installation(sansBinaire, npmSansBinaire.npmCli), 'échouée : 0.166.0 sans codex.exe (npm sans erreur)')
  assert.equal(existsSync(join(sansBinaire.versions, '0.166.0', 'complet.json')), false)
  assert.deepEqual(choixFace(sansBinaire), { version: '0.165.0', executable: sansBinaire.globale })
  const d = depot(t), npm = npmFactice(d, 'complet'), exterieur = exterieurPose(d)
  versionnee(d.versions, '0.165.0')
  mkdirSync(join(d.versions, '0.163.0', 'node_modules', '@openai', 'codex'), { recursive: true }); writeFileSync(join(d.versions, '0.163.0', 'node_modules', '@openai', 'codex', 'package.json'), JSON.stringify({ name: '@openai/codex', version: '0.163.0' }))
  assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0')
  assert.deepEqual(versionsPresentes(d), ['0.165.0', '0.166.0'])
  assert.ok(existsSync(exterieur), 'binaire extérieur délié par le ménage')
})

test('mise à jour Codex : dans un même processus, une installation ratée n’empêche pas la suivante de résoudre son propre binaire', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'paquet-seul'), exterieur = exterieurPose(d)
  assert.equal(await installation(d, npm.npmCli), 'échouée : 0.166.0 sans codex.exe (npm sans erreur)')
  writeFileSync(join(d.dossier, 'npm', 'mode'), 'complet')
  assert.equal(await installation(d, npm.npmCli), 'installée : 0.166.0')
  assert.deepEqual(choixFace(d), { version: '0.166.0', executable: executableDe(d.versions, '0.166.0') })
  assert.ok(existsSync(exterieur))
})

test('mise à jour Codex : registre injoignable, rien d’installé et lancement intact', async (t) => {
  const d = depot(t), npm = npmFactice(d, 'complet')
  for (const fetcher of [async () => { throw new Error('hors ligne') }, async () => ({ ok: false, status: 503 }), () => new Promise(() => {})]) {
    const debut = Date.now()
    assert.match(await installation(d, npm.npmCli, { fetcher, timeoutMs: 10 }), /^échouée : (hors ligne|HTTP 503|délai registre dépassé)$/)
    assert.ok(Date.now() - debut < 1000)
  }
  assert.deepEqual(npm.appels(), [])
})
