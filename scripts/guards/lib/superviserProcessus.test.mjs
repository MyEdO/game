import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sortieDeSupervision, superviserProcessus } from './superviserProcessus.mjs'
import { capturerDescendants, identitePresente, mesurerArbreProcessus, tuerArbre } from './arbreProcessus.mjs'

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
  assert.deepEqual([...capturerDescendants(1, vue).keys()], [8, 7, 4])
  assert.deepEqual([...capturerDescendants(99, vue).keys()], [])
})

test('une identité PID réutilisée ne désigne jamais le processus capturé', () => {
  assert.equal(identitePresente({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'nouveau' }]), false)
  assert.equal(identitePresente({ pid: 42, creation: 'ancien' }, [{ pid: 42, creation: 'ancien' }]), true)
})

test('supervision : une panne de mesure après spawn nettoie l’enfant démarré', { timeout: 20000 }, async () => {
  let lectures = 0
  let enfant
  const vu = await superviserProcessus({
    commande: process.execPath,
    args: ['--input-type=module', '-e', 'setInterval(()=>{},1000)'],
    timeout: 2000,
    mesurer: () => {
      const vue = mesurerArbreProcessus()
      lectures += 1
      if (lectures > 1) {
        enfant ??= vue.find((p) => p.ppid === process.pid && /^node(?:\.exe)?$/i.test(p.nom))
        throw new Error('CIM injecté indisponible')
      }
      return vue
    },
  })
  assert.equal(vu.error.code, 'EMESURE')
  assert.match(vu.error.message, /CIM injecté indisponible/)
  assert.ok(enfant)
  assert.equal(identitePresente(enfant, mesurerArbreProcessus()), false)
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

test('supervision : la mort du parent tue le descendant détaché', { timeout: 30000 }, async () => {
  const racine = mkdtempSync(join(tmpdir(), '2626-parent-'))
  let lanceur; let petitFils
  try {
    const feuille = join(racine, 'feuille.mjs')
    const parent = join(racine, 'parent.mjs')
    const preuve = join(racine, 'preuve')
    const pid = join(racine, 'pid')
    writeFileSync(feuille, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(pid)},String(process.pid));setInterval(()=>writeFileSync(${JSON.stringify(preuve)},String(Date.now())),20)`)
    const resultat = join(racine, 'resultat.json')
    const options = Buffer.from(JSON.stringify({ commande: process.execPath, args: [feuille], timeout: 15000 })).toString('base64')
    const superviseur = fileURLToPath(new URL('./superviserProcessus.mjs', import.meta.url))
    writeFileSync(parent, `import {spawn} from 'node:child_process';import {openSync} from 'node:fs';spawn(process.execPath,${JSON.stringify([superviseur, options])},{detached:true,stdio:['ignore',openSync(${JSON.stringify(resultat)},'w'),'ignore']});setInterval(()=>{},1000)`)
    lanceur = spawn(process.execPath, [parent], { stdio: 'ignore' })
    for (let i = 0; i < 100; i++) {
      try { petitFils = Number(readFileSync(pid, 'utf8')); break } catch {}
      await new Promise((r) => setTimeout(r, 50))
    }
    assert.ok(petitFils, 'le descendant a démarré sous supervision')
    await new Promise((r) => setTimeout(r, 1000))
    lanceur.kill('SIGKILL')
    for (let i = 0; i < 5; i++) {
      if (!mesurerArbreProcessus().some((p) => p.pid === petitFils && p.etat !== 'Z')) break
      await new Promise((r) => setTimeout(r, 100))
    }
    const avant = readFileSync(preuve, 'utf8')
    await new Promise((r) => setTimeout(r, 300))
    assert.equal(readFileSync(preuve, 'utf8'), avant, 'le descendant écrit encore après disparition du parent')
    let verdict
    for (let i = 0; i < 30; i++) {
      try { verdict = JSON.parse(readFileSync(resultat, 'utf8')); break } catch {}
      await new Promise((r) => setTimeout(r, 100))
    }
    assert.equal(verdict?.error?.code, 'EPARENT')
  } finally {
    if (petitFils) tuerArbre(petitFils)
    if (lanceur?.pid) tuerArbre(lanceur.pid)
    rmSync(racine, { recursive: true, force: true })
  }
})
