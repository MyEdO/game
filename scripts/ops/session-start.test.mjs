import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { spawnSync, spawn } from 'node:child_process'
import { Writable } from 'node:stream'
import { Readable } from 'node:stream'
import { preflightSessionStart, produireRecuSessionStart, validerRecuSessionStart, entreeHookNative, inscriptionDuHook } from './session-start.mjs'
import { annexeDe, controleur, creerSessions, piloterAgent } from './session-runtime.mjs'
import { dossierSessions, nomDeCarte } from './session-carte.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { mesurerProcessusWorktrees } from '../guards/lib/processusWorktrees.mjs'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'
import { injectProjectCredo } from '../hooks/inject-project-credo.mjs'
import { bootstrapSessionStart } from '../hooks/bootstrap-conteneur.mjs'
import { finDeTour } from '../hooks/fin-de-tour.mjs'
import { lancerSession } from './session.mjs'
import { aplatirHooks } from '../agents/compat-core.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
function fixture(t, worktree = fs.mkdtempSync(join(tmpdir(), 'sessionstart-'))) {
  t.after(() => fs.rmSync(worktree, { recursive: true, force: true }))
  fs.mkdirSync(join(worktree, '.claude'), { recursive: true })
  fs.copyFileSync(join(root, '.claude/credo.md'), join(worktree, '.claude/credo.md'))
  for (const surface of ['.claude/settings.json', '.codex/hooks.json']) {
    const agent = surface.includes('codex') ? 'codex' : 'claude'
    fs.mkdirSync(join(worktree, `.${agent}`), { recursive: true })
    fs.copyFileSync(join(root, surface), join(worktree, surface))
    fs.mkdirSync(join(worktree, 'scripts/hooks'), { recursive: true })
    for (const hook of aplatirHooks(JSON.parse(fs.readFileSync(join(root, surface), 'utf8')), surface)) fs.copyFileSync(join(root, 'scripts/hooks', hook.script), join(worktree, 'scripts/hooks', hook.script))
  }
  return worktree
}
const inventaire = () => mesurerProcessusWorktrees({ identites: true, timeout: 5000 }).processus
const mesurer = (pid) => inventaire().find((p) => p.pid === pid)

async function contexte(t, agent, pid = process.ppid) {
  const worktree = fixture(t, instanceDeDepot({ commit: false }).racine)
  const dossier = dossierSessions(join(worktree, '.git'))
  const sessions = creerSessions({ dossier, inventaire, processus: mesurer })
  const consigne = join(worktree, 'brief.md')
  const reservation = sessions.reserver({
    worktree, racine: worktree, agent, ticket: 3295, nom: 'test-recu', consigne,
    branche: 'test', head: 'a'.repeat(40), hooks: await preflightSessionStart(worktree, agent),
  })
  const id = reservation.carte.sessionId
  sessions.revendiquer(id, reservation.nonce, { controleurPid: process.pid, jobHostPid: process.ppid })
  const carte = sessions.agentDemarre(id, mesurer(pid))
  const attendu = JSON.parse(fs.readFileSync(join(dossier, `${id}.hook-context`), 'utf8'))
  return { worktree, carte, attendu, sessions, env: { WFRP_SESSION_START: Buffer.from(JSON.stringify(attendu)).toString('base64') }, entree: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'native-test' }) }
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
      contexte: () => ({ worktree, gitCommun: worktree, head: 'a'.repeat(40), branche: 'b' }), natif: () => 'codex.exe', contrat: () => {}, choisir: (globale) => ({ executable: globale(), version: null }), miseAJour: () => {},
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
    else assert.deepEqual(await bootstrapSessionStart({ ...c, racine: c.worktree, output }), [])
    const recu = JSON.parse(fs.readFileSync(c.attendu.chemin, 'utf8'))
    assert.equal(validerRecuSessionStart(recu, c.carte).ok, true)
    assert.equal(recu.nativeSessionId, 'native-test')
    assert.equal(texte, agent === 'codex' ? fs.readFileSync(join(c.worktree, '.claude/credo.md'), 'utf8') : '')
  }
})

test('reçu strict refuse identité étrangère, nonce erroné et péremption', async (t) => {
  const c = await contexte(t, 'claude')
  const recu = await produireRecuSessionStart({ ...c, surface: 'claude' })
  assert.equal(validerRecuSessionStart(recu, c.carte).ok, true)
  for (const [change, raison] of [[{ sessionId: randomUUID() }, 'ÉTRANGER'], [{ surface: 'codex' }, 'ÉTRANGER'], [{ empreinteCanon: 'd'.repeat(64) }, 'ÉTRANGER'], [{ nonce: 'd'.repeat(64) }, 'NONCE'], [{ date: new Date(0).toISOString() }, 'PÉRIMÉ'], [{ debut: new Date(0).toISOString() }, 'PÉRIMÉ'], [{ date: new Date(c.carte.demarrageJusqua + 1).toISOString() }, 'PÉRIMÉ'], [{ addition: true }, 'INVALIDE']]) {
    assert.match(validerRecuSessionStart({ ...recu, ...change }, c.carte).raison, new RegExp(raison))
  }
})

test('entrée native invalide, credo vide ou écriture échouée ne produisent aucun reçu positif', async (t) => {
  for (const panne of ['native', 'vide', 'write', 'writeasync']) {
    const c = await contexte(t, 'codex'), url = pathToFileURL(join(c.worktree, 'scripts/hooks/inject-project-credo.mjs')).href
    if (panne === 'native') c.entree = '{}'
    if (panne === 'vide') fs.writeFileSync(join(c.worktree, '.claude/credo.md'), '')
    const output = panne === 'writeasync' ? new Writable({ write: (_chunk, _encoding, done) => done(new Error('write async refusé')) }) : { write: () => { if (panne === 'write') throw new Error('write refusé') } }
    await assert.rejects(injectProjectCredo('codex', url, output, { ...c }))
    assert.equal(fs.existsSync(c.attendu.chemin), false)
  }
})

test('hooks natifs exécutés avec stdin SessionStart : reçu corrélé et sortie normale hors ops:session', async (t) => {
  for (const agent of ['codex', 'claude']) {
    const c = await contexte(t, agent, process.pid), script = join(root, 'scripts/hooks', agent === 'codex' ? 'inject-project-credo.mjs' : 'bootstrap-conteneur.mjs')
    const commande = agent === 'codex' && process.platform === 'linux'
      ? ['/bin/sh', '-c', '"$@"; exit "$?"', 'hook', process.execPath, script, 'codex']
      : [process.execPath, script, ...(agent === 'codex' ? ['codex'] : [])]
    const [executable, ...args] = commande
    const vu = spawnSync(executable, args, {
      cwd: c.worktree, env: { ...process.env, ...c.env, CLAUDE_CODE_REMOTE: 'false', CLAUDE_PROJECT_DIR: c.worktree },
      input: c.entree, encoding: 'utf8', timeout: 10000,
    })
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
    const c = await contexte(t, agent, process.pid), script = join(root, 'scripts/hooks', agent === 'codex' ? 'inject-project-credo.mjs' : 'bootstrap-conteneur.mjs')
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

test('#3295 : l’identité mesurée et le registre canonique conditionnent le reçu', async (t) => {
  const c = await contexte(t, 'claude')
  const produire = (env = c.env) => produireRecuSessionStart({ ...c, surface: 'claude', env })
  const { sessionId, agentProcessus } = c.carte
  for (const identite of [{ ...agentProcessus, creation: new Date(0).toISOString() }, mesurer(process.pid)]) {
    c.sessions.agentDemarre(sessionId, identite)
    assert.equal(await produire(), null)
    assert.equal(fs.existsSync(c.attendu.chemin), false)
  }
  c.sessions.agentDemarre(sessionId, agentProcessus)
  const copie = join(c.worktree, 'registre-copie')
  fs.mkdirSync(copie)
  fs.copyFileSync(join(c.worktree, '.git', 'sessions', `${sessionId}.json`), join(copie, `${sessionId}.json`))
  const chemin = join(copie, `${sessionId}.sessionstart`)
  const contexteCopie = Buffer.from(JSON.stringify({ ...c.attendu, chemin })).toString('base64')
  assert.equal(await produire({ WFRP_SESSION_START: contexteCopie }), null)
  assert.equal(fs.existsSync(chemin), false)
  assert.equal(fs.existsSync(c.attendu.chemin), false)
  assert.equal((await produire()).nativeSessionId, 'native-test')
})

const cheminCarteDuBanc = ({ worktree, carte }) => join(dossierSessions(join(worktree, '.git')), nomDeCarte(carte.sessionId))
const carteTenue = () => Object.assign(new Error('Carte tenue par un lecteur'), { code: 'EBUSY' })

test('#3295 : SessionStart et Stop relisent une carte momentanément tenue', async (t) => {
  const c = await contexte(t, 'claude')
  const cheminCarte = cheminCarteDuBanc(c)
  const lire = fs.readFileSync
  let tenues = 0
  let tenir = true
  t.mock.method(fs, 'readFileSync', (chemin, ...options) => {
    if (chemin === cheminCarte && tenir) {
      tenir = false
      tenues++
      throw carteTenue()
    }
    return lire(chemin, ...options)
  })
  assert.equal((await produireRecuSessionStart({ ...c, surface: 'claude' }))?.nativeSessionId, 'native-test')

  tenir = true
  const stdin = Readable.from([JSON.stringify({ hook_event_name: 'Stop', session_id: 'native-test' })])
  const transition = await finDeTour({ ...c, stdin })
  assert.deepEqual([transition?.type, transition?.seq, tenues], ['inactif', 1, 2])
})

test('#3295 : Claude attend l’inscription dans toute la fenêtre canonique malgré une carte tenue', async (t) => {
  const c = await contexte(t, 'claude')
  const cheminCarte = cheminCarteDuBanc(c)
  const texteInscrit = fs.readFileSync(cheminCarte, 'utf8')
  c.sessions.muter(c.carte.sessionId, (carte) => { delete carte.agentProcessus })

  const lire = fs.readFileSync
  const maintenant = Date.now.bind(Date)
  const monotone = performance.now.bind(performance)
  let avance = 0
  let lectures = 0
  t.mock.method(Date, 'now', () => maintenant() + avance)
  t.mock.method(performance, 'now', () => monotone() + avance)
  t.mock.method(fs, 'readFileSync', (chemin, ...options) => {
    if (chemin === cheminCarte) {
      lectures++
      if (lectures === 2) avance = 105_001
      if (lectures === 3) {
        avance = 111_751
        throw carteTenue()
      }
      if (lectures === 4) fs.writeFileSync(cheminCarte, texteInscrit)
    }
    return lire(chemin, ...options)
  })
  const recu = await produireRecuSessionStart({ ...c, surface: 'claude' })
  assert.equal(lectures, 4)
  assert.equal(recu?.nativeSessionId, 'native-test')
  assert.ok(Date.parse(recu.date) - Date.parse(c.carte.date) >= 111_751)
  assert.equal(validerRecuSessionStart(recu, c.carte).ok, true)
})

test('#3295 : Codex tolère un seul relais shell natif', async (t) => {
  const c = await contexte(t, 'codex')
  const { pid, creation } = c.carte.agentProcessus
  const enfant = { pid: process.pid, ppid: pid + 1000000, nom: 'node', creation }
  const relais = { pid: enfant.ppid, ppid: pid, creation }
  const options = { surface: 'codex', worktree: c.worktree }
  for (const nom of ['cmd.exe', 'powershell.exe', 'pwsh.exe', 'sh', 'bash.exe', 'zsh']) {
    const mesurer = () => ({ processus: [enfant, { ...relais, nom }, c.carte.agentProcessus] })
    assert.equal((await inscriptionDuHook(c.attendu, { ...options, mesurer })).carte.agentProcessus.pid, pid)
  }
  const extra = { pid: relais.pid + 1, ppid: pid, nom: 'sh', creation }
  const invalides = [
    [enfant, { ...relais, nom: 'node' }, c.carte.agentProcessus],
    [enfant, { ...relais, nom: 'sh', ppid: extra.pid }, extra, c.carte.agentProcessus],
  ]
  for (const processus of invalides) {
    assert.equal(await inscriptionDuHook(c.attendu, { ...options, mesurer: () => ({ processus }) }), null)
  }
  assert.equal(await inscriptionDuHook(c.attendu, { ...options, mesurer: () => ({ indeterminee: 'échéance', processus: [] }) }), null)
})

const CLIENT_CLAUDE_DU_BANC = `
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const [client, start, stop, marqueur, mode] = process.argv.slice(1)
function executer(script, args, entree) {
  const result = spawnSync(process.execPath, [script, ...args], {
    input: entree ? JSON.stringify(entree) : undefined, encoding: 'utf8', timeout: 10000,
  })
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Processus incomplet')
}
const sessionStart = (id) => executer(start, [], { hook_event_name: 'SessionStart', session_id: id })
const fin = (id) => executer(stop, ['--refus-non-bloquant'], { hook_event_name: 'Stop', session_id: id, transcript_path: id + '.jsonl' })
if (mode === 'enfant') {
  fin('natif-parent')
  sessionStart('natif-enfant')
  fin('natif-enfant')
} else {
  writeFileSync(marqueur, String(process.pid))
  sessionStart('natif-parent')
  process.on('message', (action) => {
    if (action === 'tour') fin('natif-parent')
    if (action === 'enfant') executer(client, [start, stop, marqueur, 'enfant'])
    if (action === 'reprise') {
      sessionStart('natif-repris')
      fin('natif-parent')
      fin('natif-repris')
    }
    process.send(action)
  })
}
`

test('#3295 : le lanceur inscrit le parent, ignore l’enfant hérité et suit l’identifiant repris', { timeout: 30000 }, async (t) => {
  const worktree = fixture(t, instanceDeDepot({ message: 'Banc #3295' }).racine)
  const consigne = join(worktree, 'brief.md'), client = join(worktree, 'client.mjs'), marqueur = join(worktree, 'sessionstart-appel')
  fs.writeFileSync(consigne, 'Banc de suivi')
  fs.writeFileSync(client, CLIENT_CLAUDE_DU_BANC)
  const dossier = dossierSessions(join(worktree, '.git'))
  const sessions = creerSessions({ dossier, inventaire, processus: mesurer })
  const inscrire = sessions.agentDemarre
  let essais = 0
  sessions.agentDemarre = (id, identite) => {
    essais++
    if (!fs.existsSync(marqueur) || essais === 1) throw Error(`${prefixeDeRefus('transitoire')} inscription attendue par le banc`)
    return inscrire(id, identite)
  }
  let id, enfant, supervision
  try {
    const resultat = await lancerSession({ ticket: 3295, agent: 'claude', consigne }, {
      cwd: worktree, natif: () => 'claude.exe', contrat: () => {}, terminal: () => ({ nom: 'PS' }),
      sessionsDe: (registre) => { assert.equal(registre, dossier); return sessions },
      enregistrerReprise: (reprise) => { id = reprise.sessionId },
      lancerWT: () => {
        supervision = controleur({
          dossier, id, sessions, hostPid: process.ppid,
          piloter: (options) => piloterAgent({
            ...options,
            lancer: (_executable, _args, { env, ...optionsSpawn }) => {
              const hooks = ['bootstrap-conteneur', 'fin-de-tour'].map((nom) => join(root, 'scripts/hooks', nom + '.mjs'))
              enfant = spawn(process.execPath, [client, ...hooks, marqueur], {
                ...optionsSpawn, env: { ...env, CLAUDE_CODE_REMOTE: 'false', CLAUDE_PROJECT_DIR: worktree },
                stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
              })
              return enfant
            },
          }),
        })
        supervision.catch(() => {})
        return { status: 0 }
      },
    })
    assert.equal(resultat.sessionId, id)
    assert.ok(essais > 1)
    const { agentProcessus, recuSessionStart } = sessions.lire(id)
    assert.deepEqual({ pid: agentProcessus.pid, creation: agentProcessus.creation }, { pid: enfant.pid, creation: mesurer(enfant.pid).creation })
    assert.equal(recuSessionStart.nativeSessionId, 'natif-parent')
    const jouer = async (action) => {
      const reponse = once(enfant, 'message', { signal: AbortSignal.timeout(12000) })
      enfant.send(action)
      const [recu] = await reponse
      assert.equal(recu, action)
    }
    const recu = annexeDe(dossier, id, 'recu'), journal = annexeDe(dossier, id, 'journalClaude')
    await jouer('tour')
    const transition = await sessions.attendre(id, { timeoutMs: 1000, depuis: 0 })
    assert.deepEqual([transition.seq, transition.curseur, transition.transcript], [1, 1, 'natif-parent.jsonl'])

    const avant = { recu: fs.readFileSync(recu, 'utf8'), journal: fs.readFileSync(journal, 'utf8') }
    await jouer('enfant')
    assert.deepEqual({ recu: fs.readFileSync(recu, 'utf8'), journal: fs.readFileSync(journal, 'utf8') }, avant, 'seul le parent peut écrire le reçu ou le journal')

    sessions.muter(id, (carte) => { carte.demarrageJusqua = Date.parse(recuSessionStart.date) })
    await jouer('reprise')
    const actuel = JSON.parse(fs.readFileSync(recu, 'utf8'))
    const carte = sessions.lire(id)
    assert.equal(actuel.nativeSessionId, 'natif-repris')
    assert.ok(Date.parse(actuel.date) > carte.demarrageJusqua)
    assert.deepEqual(carte.recuSessionStart, recuSessionStart)
    const suivante = await sessions.attendre(id, { timeoutMs: 1000, depuis: transition.curseur })
    assert.deepEqual([suivante.seq, suivante.curseur, suivante.transcript], [2, 2, 'natif-repris.jsonl'])
    assert.equal((await sessions.attendre(id, { timeoutMs: 0, depuis: suivante.curseur })).etat, 'indeterminee')
    t.diagnostic(`parent ${agentProcessus.pid} inscrit après ${essais} tentatives, journal 1 → 2, natif-parent → natif-repris`)
  } finally {
    if (enfant?.exitCode === null) enfant.kill()
    if (supervision) await supervision
  }
})
