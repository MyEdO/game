import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { spawnSync, spawn } from 'node:child_process'
import { Writable } from 'node:stream'
import { Readable } from 'node:stream'
import { preflightSessionStart, contexteRecu, produireRecuSessionStart, validerRecuSessionStart, hashSessionStart, entreeHookNative } from './session-start.mjs'
import { injectProjectCredo } from '../hooks/inject-project-credo.mjs'
import { bootstrapSessionStart } from '../hooks/bootstrap-conteneur.mjs'
import { lancerSession } from './session.mjs'
import { aplatirHooks } from '../agents/compat-core.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
function fixture(t) {
  const worktree = fs.mkdtempSync(join(tmpdir(), 'sessionstart-'))
  t.after(() => fs.rmSync(worktree, { recursive: true, force: true }))
  for (const surface of ['.claude/settings.json', '.codex/hooks.json']) {
    const agent = surface.includes('codex') ? 'codex' : 'claude'
    fs.mkdirSync(join(worktree, `.${agent}`), { recursive: true })
    fs.copyFileSync(join(root, surface), join(worktree, surface))
    fs.copyFileSync(join(root, `.${agent}/credo.md`), join(worktree, `.${agent}/credo.md`))
    fs.mkdirSync(join(worktree, 'scripts/hooks'), { recursive: true })
    for (const hook of aplatirHooks(JSON.parse(fs.readFileSync(join(root, surface), 'utf8')), surface)) fs.copyFileSync(join(root, 'scripts/hooks', hook.script), join(worktree, 'scripts/hooks', hook.script))
  }
  return worktree
}
async function contexte(t, agent) {
  const worktree = fixture(t), nonce = 'c'.repeat(64), date = new Date().toISOString()
  const carte = { sessionId: randomUUID(), worktree, agent, date, demarrageJusqua: Date.now() + 360000, empreinteNonceHook: hashSessionStart(nonce), hooks: await preflightSessionStart(worktree, agent) }
  const attendu = contexteRecu(carte, worktree, nonce)
  return { worktree, carte, attendu, env: { WFRP_SESSION_START: Buffer.from(JSON.stringify(attendu)).toString('base64') }, entree: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'native-test' }) }
}

test('préflight refuse configuration absente, JSON illisible, hooks divergents et script absent avant toute réservation ou WT', async (t) => {
  for (const panne of ['absente', 'illisible', 'divergente', 'script']) {
    const worktree = fixture(t), config = join(worktree, '.codex/hooks.json')
    if (panne === 'absente') fs.rmSync(config)
    if (panne === 'illisible') fs.writeFileSync(config, '{')
    if (panne === 'divergente') fs.writeFileSync(config, '{}')
    if (panne === 'script') fs.rmSync(join(worktree, 'scripts/hooks/inject-project-credo.mjs'))
    const consigne = join(worktree, '2527.md'); fs.writeFileSync(consigne, 'faire')
    let effets = 0
    await assert.rejects(lancerSession({ ticket: 2527, agent: 'codex', consigne }, {
      contexte: () => ({ worktree, gitCommun: worktree, head: 'a'.repeat(40), branche: 'b' }), natif: () => 'codex.exe', contrat: () => {},
      terminal: () => { effets++; return { nom: 'PS' } }, sessionsDe: () => { effets++; }, lancerWT: () => { effets++; },
    }), /HOOKS : (CONFIGURATION|SCRIPT)/)
    assert.equal(effets, 0)
  }
})

test('préflight empreinte les scripts déclarés et dérive le délai des hooks SessionStart', async (t) => {
  const worktree = fixture(t), avant = await preflightSessionStart(worktree, 'codex')
  assert.ok(avant.delaiMs >= 300000)
  fs.appendFileSync(join(worktree, 'scripts/hooks/inject-project-credo.mjs'), '\n')
  assert.notEqual((await preflightSessionStart(worktree, 'codex')).empreinteCanon, avant.empreinteCanon)
})

test('deux producteurs réels : credo émis avant reçu Codex, bootstrap local silencieux avant reçu Claude', async (t) => {
  for (const agent of ['codex', 'claude']) {
    const c = await contexte(t, agent)
    let texte = ''
    const output = { write: (s) => { assert.equal(fs.existsSync(c.attendu.chemin), false); texte += s } }
    if (agent === 'codex') await injectProjectCredo(agent, pathToFileURL(join(c.worktree, 'scripts/hooks/inject-project-credo.mjs')).href, output, { ...c })
    else assert.deepEqual(bootstrapSessionStart({ ...c, racine: c.worktree, output }), [])
    const recu = JSON.parse(fs.readFileSync(c.attendu.chemin, 'utf8'))
    assert.equal(validerRecuSessionStart(recu, c.carte).ok, true)
    assert.equal(recu.nativeSessionId, 'native-test')
    assert.equal(texte, agent === 'codex' ? fs.readFileSync(join(c.worktree, '.codex/credo.md'), 'utf8') : '')
  }
})

test('reçu strict refuse identité étrangère, nonce erroné et péremption', async (t) => {
  const c = await contexte(t, 'claude')
  const recu = produireRecuSessionStart({ ...c, surface: 'claude' })
  for (const [change, raison] of [[{ sessionId: randomUUID() }, 'ÉTRANGER'], [{ surface: 'codex' }, 'ÉTRANGER'], [{ empreinteCanon: 'd'.repeat(64) }, 'ÉTRANGER'], [{ nonce: 'd'.repeat(64) }, 'NONCE'], [{ date: new Date(0).toISOString() }, 'PÉRIMÉ'], [{ debut: new Date(0).toISOString() }, 'PÉRIMÉ'], [{ date: new Date(c.carte.demarrageJusqua + 1).toISOString() }, 'PÉRIMÉ'], [{ addition: true }, 'INVALIDE']]) {
    assert.match(validerRecuSessionStart({ ...recu, ...change }, c.carte).raison, new RegExp(raison))
  }
})

test('entrée native invalide, credo vide ou écriture échouée ne produisent aucun reçu positif', async (t) => {
  for (const panne of ['native', 'vide', 'write', 'writeasync']) {
    const c = await contexte(t, 'codex'), url = pathToFileURL(join(c.worktree, 'scripts/hooks/inject-project-credo.mjs')).href
    if (panne === 'native') c.entree = '{}'
    if (panne === 'vide') fs.writeFileSync(join(c.worktree, '.codex/credo.md'), '')
    const output = panne === 'writeasync' ? new Writable({ write: (_chunk, _encoding, done) => done(new Error('write async refusé')) }) : { write: () => { if (panne === 'write') throw new Error('write refusé') } }
    await assert.rejects(injectProjectCredo('codex', url, output, { ...c }))
    assert.equal(fs.existsSync(c.attendu.chemin), false)
  }
})

test('hooks natifs exécutés avec stdin SessionStart : reçu corrélé et sortie normale hors ops:session', async (t) => {
  for (const agent of ['codex', 'claude']) {
    const c = await contexte(t, agent), script = join(root, 'scripts/hooks', agent === 'codex' ? 'inject-project-credo.mjs' : 'bootstrap-conteneur.mjs')
    const vu = spawnSync(process.execPath, [script, ...(agent === 'codex' ? ['codex'] : [])], { cwd: c.worktree, env: { ...process.env, ...c.env, CLAUDE_CODE_REMOTE: 'false', CLAUDE_PROJECT_DIR: c.worktree }, input: c.entree, encoding: 'utf8', timeout: 10000 })
    assert.equal(vu.status, 0, vu.stderr); assert.equal(vu.error, undefined)
    const recu = JSON.parse(fs.readFileSync(c.attendu.chemin, 'utf8'))
    assert.equal(validerRecuSessionStart(recu, c.carte).ok, true)
    fs.rmSync(c.attendu.chemin)
    const env = { ...process.env, CLAUDE_CODE_REMOTE: 'false', CLAUDE_PROJECT_DIR: c.worktree }; delete env.WFRP_SESSION_START
    const normal = spawnSync(process.execPath, [script, ...(agent === 'codex' ? ['codex'] : [])], { cwd: c.worktree, env, encoding: 'utf8', timeout: 10000 })
    assert.equal(normal.status, 0, normal.stderr); assert.equal(fs.existsSync(c.attendu.chemin), false)
  }
})

test('entrée native trop grande ou flux en erreur ne produit aucun reçu', async (t) => {
  for (const panne of ['limite', 'erreur']) {
    const c = await contexte(t, 'codex')
    const stdin = panne === 'limite' ? Readable.from(['x'.repeat(65537)]) : new Readable({ read() { this.destroy(new Error('flux illisible')) } })
    const entree = await entreeHookNative(c.env, stdin, 1000)
    assert.equal(entree.length, 0)
    await assert.rejects(injectProjectCredo('codex', pathToFileURL(join(c.worktree, 'scripts/hooks/inject-project-credo.mjs')).href, { write() {} }, { ...c, entree }))
    assert.equal(fs.existsSync(c.attendu.chemin), false)
  }
})

test('hooks natifs au stdin jamais fermé sortent seuls en exit0 sans reçu', async (t) => {
  for (const agent of ['codex', 'claude']) {
    const c = await contexte(t, agent), script = join(root, 'scripts/hooks', agent === 'codex' ? 'inject-project-credo.mjs' : 'bootstrap-conteneur.mjs')
    const child = spawn(process.execPath, [script, ...(agent === 'codex' ? ['codex'] : [])], { cwd: c.worktree, env: { ...process.env, ...c.env, CLAUDE_CODE_REMOTE: 'false', CLAUDE_PROJECT_DIR: c.worktree }, stdio: ['pipe', 'ignore', 'ignore'] })
    const coupe = setTimeout(() => child.kill(), 12000)
    let fin
    try { fin = await new Promise((ok, non) => { child.once('error', non); child.once('exit', (code, signal) => ok({ code, signal })) }) }
    finally { clearTimeout(coupe); child.kill() }
    assert.deepEqual(fin, { code: 0, signal: null })
    assert.equal(fs.existsSync(c.attendu.chemin), false)
    console.log(`STDIN preuve : ${agent} PID ${child.pid} terminé sans reçu`)
  }
})
