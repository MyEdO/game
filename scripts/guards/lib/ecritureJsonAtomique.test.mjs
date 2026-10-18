// Contrat de l'ÉCRITURE JSON ATOMIQUE : la cible porte la valeur, le dossier se crée, aucun temporaire ne reste,
// et le fichier qu'un lecteur tient n'est jamais réécrit en place (`ecrireTexteAtomique`, #2603).
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ecrireJsonAtomique, ecrireTexteAtomique, lireTextePublie, publierJsonSiAbsent } from './ecritureJsonAtomique.mjs'
import { listerDossier } from './lister.mjs'
import { BACKOFFS_MS } from './spawnResilient.mjs'

test('ecrireJsonAtomique : la cible porte la valeur, son dossier se crée, aucun temporaire ne reste', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const dossier = join(racine, 'sous', 'dossier')
  ecrireJsonAtomique(join(dossier, 'a.json'), { a: 1 })
  ecrireJsonAtomique(join(dossier, 'a.json'), { a: 2, b: [3] })
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, 'a.json'), 'utf8')), { a: 2, b: [3] })
  assert.deepEqual(listerDossier(dossier), ['a.json'])
})

test('écriture JSON : un ancien temporaire du même PID reste intact', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'a.json'), ancien = `${cible}.${process.pid}.tmp`
  writeFileSync(ancien, 'preuve ancienne')
  ecrireJsonAtomique(cible, { a: 1 })
  assert.equal(readFileSync(ancien, 'utf8'), 'preuve ancienne')
  assert.deepEqual(JSON.parse(readFileSync(cible, 'utf8')), { a: 1 })
})

test('écriture JSON : échec du renommage purge seulement le temporaire propre', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'occupee.json'); mkdirSync(cible)
  assert.throws(() => ecrireJsonAtomique(cible, { a: 1 }, { attendre: () => {} }))
  assert.deepEqual(listerDossier(racine), ['occupee.json'])
})

test('#2603 — ecrireTexteAtomique : le fichier lu n’est jamais réécrit en place — un lien dur vers l’ancienne cible garde l’ancien contenu ENTIER', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-texte-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'registre.js'), ancienne = join(racine, 'ancienne.js')
  ecrireTexteAtomique(cible, 'v1\n')
  linkSync(cible, ancienne)
  ecrireTexteAtomique(cible, 'v2\n')
  assert.equal(readFileSync(cible, 'utf8'), 'v2\n')
  assert.equal(readFileSync(ancienne, 'utf8'), 'v1\n', 'un lecteur qui tient l’ancienne cible la lit entière : rien ne l’a tronquée ni réécrite')
  assert.deepEqual(listerDossier(racine), ['ancienne.js', 'registre.js'])
})

test('#2491 écriture JSON : le retry du renommage consomme l’attente injectée', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-horloge-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'occupee.json')
  mkdirSync(cible)
  writeFileSync(join(cible, 'tenant'), 'tenu')
  const attentes = []
  const options = { attendre: (ms) => {
    attentes.push(ms)
    rmSync(cible, { recursive: true, force: true })
  } }
  if (process.platform === 'win32') {
    ecrireJsonAtomique(cible, { a: 1 }, options)
    assert.deepEqual(attentes, [BACKOFFS_MS[0]])
    assert.deepEqual(JSON.parse(readFileSync(cible, 'utf8')), { a: 1 })
    assert.deepEqual(listerDossier(racine), ['occupee.json'])
  } else {
    assert.throws(() => ecrireJsonAtomique(cible, { a: 1 }, options), { code: 'EISDIR' })
    assert.deepEqual(attentes, [])
    assert.deepEqual(listerDossier(racine), ['occupee.json'])
  }
})

test('écriture JSON : indentation compacte explicite, défaut indenté conservé', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'json-indent-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const f = join(dossier, 'memo.json')
  ecrireJsonAtomique(f, { version: 'v', memos: { a: [1] } }, { indentation: 0 })
  assert.equal(readFileSync(f, 'utf8'), '{"version":"v","memos":{"a":[1]}}\n')
  ecrireJsonAtomique(f, { a: 1 })
  assert.equal(readFileSync(f, 'utf8'), '{\n  "a": 1\n}\n')
})

test('publication exclusive : le premier JSON complet gagne et reste immuable', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'cloture-exclusive-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const cible = join(dossier, 'cloture.json')
  const premier = { version: 1, generation: 'première', echeance: 100 }
  assert.equal(publierJsonSiAbsent(cible, premier), true)
  assert.equal(publierJsonSiAbsent(cible, { ...premier, echeance: 200 }), false)
  assert.deepEqual(JSON.parse(readFileSync(cible, 'utf8')), premier)
  assert.deepEqual(listerDossier(dossier), ['cloture.json'])
})

test('publication concurrente : un seul gagnant, aucun remplacement ni temporaire perdu', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'cloture-concurrente-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const cible = join(dossier, 'cloture.json')
  const module = new URL('./ecritureJsonAtomique.mjs', import.meta.url).href
  const lancements = Array.from({ length: 4 }, (_, index) => {
    const code = 'import { publierJsonSiAbsent } from ' + JSON.stringify(module) + ';process.stdout.write(JSON.stringify({index:' + index + ',gagnant:publierJsonSiAbsent(' + JSON.stringify(cible) + ',{version:1,generation:"commune",echeance:' + index + '})}))'
    const enfant = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    enfant.stdout.on('data', (d) => { stdout += d }); enfant.stderr.on('data', (d) => { stderr += d })
    return new Promise((ok, non) => { enfant.once('error', non); enfant.once('close', (status) => { if (status !== 0) non(new Error(stderr)); else ok(JSON.parse(stdout)) }) })
  })
  const resultats = await Promise.all(lancements)
  const gagnants = resultats.filter((r) => r.gagnant)
  assert.equal(gagnants.length, 1)
  assert.deepEqual(JSON.parse(readFileSync(cible, 'utf8')), { version: 1, generation: 'commune', echeance: gagnants[0].index })
  assert.deepEqual(listerDossier(dossier), ['cloture.json'])
})

test('#2586 lecture publiée : absente ou tenue sans partage par un tiers, elle rend undefined ; toute autre erreur lève', { skip: process.platform !== 'win32', timeout: 30000 }, async (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'lecture-publiee-'))
  t.after(() => rmSync(racine, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }))
  const cible = join(racine, 'reponse.json'), tenu = join(racine, 'tenu')
  assert.equal(lireTextePublie(cible), undefined)
  writeFileSync(cible, '{"ok":true}')
  const tiers = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$h=[IO.File]::Open('${cible}','Open','Read','Delete'); Set-Content '${tenu}' x; Start-Sleep -Milliseconds 1500; $h.Close()`], { stdio: 'ignore', windowsHide: true })
  const fin = new Promise((ok, non) => { tiers.once('error', non); tiers.once('close', ok) })
  const borne = Date.now() + 20000
  while (!existsSync(tenu) && Date.now() < borne) await new Promise((ok) => setTimeout(ok, 10))
  assert.equal(lireTextePublie(cible), undefined)
  assert.equal(await fin, 0)
  assert.equal(lireTextePublie(cible), '{"ok":true}')
  assert.throws(() => lireTextePublie(racine), { code: 'EISDIR' })
})
