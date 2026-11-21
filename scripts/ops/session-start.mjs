import fs from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import { spawnSync } from 'node:child_process'
import { setTimeout as pause } from 'node:timers/promises'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { chargerRegistres } from '../agents/compat-cli.mjs'
import { hooksAttendus, aplatirHooks, SURFACE_CLAUDE, SURFACE_CODEX } from '../agents/compat-core.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { lireStdinBorne, DELAI_STDIN_MS } from '../guards/lib/stdinBorne.mjs'
import { ancetresValidesDe } from '../guards/lib/arbreProcessus.mjs'
import { DELAI_MESURE_PROCESSUS_MS, mesurerProcessusWorktrees } from '../guards/lib/processusWorktrees.mjs'
import { depotDe, dossierGitCommun, ENV_GIT_FEINT } from '../guards/lib/gitPorte.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { CarteSession, Contexte, Recu, dossierSessions, nomDeCarte } from './session-carte.mjs'
import { refusSession } from './session-rejeu.mjs'
import { estObjet } from '../../src/lib/objet.mjs'

export const ANNEXES_SESSION_START = Object.freeze({ recu: 'sessionstart' })
export const hashSessionStart = (value) => createHash('sha256').update(value).digest('hex')
export const canoniserWorktree = (path) => {
  const real = fs.realpathSync.native(resolve(path))
  return process.platform === 'win32' ? real.toLowerCase() : real
}
export async function preflightSessionStart(worktree, agent) {
  const surface = agent === 'codex' ? SURFACE_CODEX : agent === 'claude' ? SURFACE_CLAUDE : null
  if (!surface) throw new Error('HOOKS : SURFACE INCONNUE')
  const registres = await chargerRegistres()
  const attendus = hooksAttendus(registres, surface)
  let config
  try { config = JSON.parse(fs.readFileSync(join(worktree, surface), 'utf8')) }
  catch (e) { throw new Error(`HOOKS : CONFIGURATION ABSENTE OU ILLISIBLE : ${surface} — ${e.code ?? e.message}`, { cause: e }) }
  if (!isDeepStrictEqual(config.hooks, attendus)) throw new Error(`HOOKS : CONFIGURATION DIVERGENTE : ${surface} ; npm run agents:sync`)
  const plats = aplatirHooks({ hooks: attendus }, surface)
  const contenus = []
  for (const script of [...new Set(plats.map((h) => h.script))].sort()) {
    try { contenus.push([script, fs.readFileSync(join(worktree, 'scripts/hooks', script), 'utf8')]) }
    catch (e) { throw new Error(`HOOKS : SCRIPT ABSENT OU ILLISIBLE : ${script} — ${e.code ?? e.message}`, { cause: e }) }
  }
  const credo = fs.readFileSync(join(worktree, '.claude/credo.md'), 'utf8')
  if (!credo.trim()) throw new Error('HOOKS : CREDO VIDE')
  return { empreinteCanon: hashSessionStart(JSON.stringify({ attendus, contenus })), ...(agent === 'codex' ? { empreinteCredo: hashSessionStart(credo) } : {}), delaiMs: (plats.filter((h) => h.phase === 'SessionStart').reduce((total, h) => total + h.timeout, 0) + 10) * 1000 }
}

export const contexteRecu = (carte, dossier, nonce) => Contexte.parse({ sessionId: carte.sessionId, nonce, worktree: canoniserWorktree(carte.worktree), surface: carte.agent, empreinteCanon: carte.hooks.empreinteCanon, ...(carte.hooks.empreinteCredo ? { empreinteCredo: carte.hooks.empreinteCredo } : {}), debut: carte.date, chemin: join(dossier, `${carte.sessionId}.${ANNEXES_SESSION_START.recu}`) })

/** Le contexte de la session inscrite que porte `env`, `null` hors session inscrite ; un contexte invalide lève. */
export const contexteDeSession = (env = process.env) => env.WFRP_SESSION_START ? Contexte.parse(JSON.parse(Buffer.from(env.WFRP_SESSION_START, 'base64').toString('utf8'))) : null

export const DELAI_PREUVE_HOOK_MS = 9000
const PAS_LECTURE_CARTE_MS = 50
const RELAIS_CODEX = /^(?:cmd|powershell|pwsh|sh|bash|zsh)(?:[.]exe)?$/i
const cheminComparable = (chemin) => process.platform === 'win32' ? resolve(chemin).toLowerCase() : resolve(chemin)

function depotBorne(worktree, restant) {
  const aiguillageGit = new Set(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', ENV_GIT_FEINT])
  const env = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !aiguillageGit.has(cle.toUpperCase())))
  return depotDe(worktree, {
    env,
    spawn: (commande, args, options) => {
      const timeout = restant()
      return timeout > 0 ? spawnSync(commande, args, { ...options, timeout }) : { error: Object.assign(new Error('Échéance git du hook'), { code: 'ETIMEDOUT' }), status: null }
    },
    attendre: (ms) => attendreSync(Math.min(ms, Math.max(0, restant()))),
  })
}

function donneesDeLaCarte(contexte, dossier) {
  let texte
  try { texte = fs.readFileSync(join(dossier, nomDeCarte(contexte.sessionId)), 'utf8') }
  catch (e) { if (e.code === 'ENOENT') return null; throw e }
  const vu = CarteSession.safeParse(JSON.parse(texte))
  if (!vu.success || !['vivante', 'arret-demande'].includes(vu.data.etat)) return null
  const carte = vu.data
  if (hashSessionStart(contexte.nonce) !== carte.empreinteNonceHook) return null
  const attendu = contexteRecu(carte, dossier, contexte.nonce)
  const chemin = cheminComparable(contexte.chemin)
  return isDeepStrictEqual({ ...contexte, chemin }, { ...attendu, chemin: cheminComparable(attendu.chemin) }) ? carte : null
}

async function lireCarteDuHook(contexte, dossier, echeance) {
  while (performance.now() < echeance) {
    try { return donneesDeLaCarte(contexte, dossier) }
    catch (e) {
      if (!refusSession(e).retentable) throw e
      const restant = echeance - performance.now()
      if (restant > 0) await pause(Math.min(PAS_LECTURE_CARTE_MS, restant))
    }
  }
  return null
}

/** La carte d'une session active et son reçu canonique, quand l'OS rattache le hook au processus inscrit. */
export async function inscriptionDuHook(contexte, { surface, worktree, attendreInscription = false, echeance = performance.now() + DELAI_PREUVE_HOOK_MS, mesurer = mesurerProcessusWorktrees }) {
  if (contexte.surface !== surface || contexte.worktree !== canoniserWorktree(worktree) || !isAbsolute(contexte.chemin)) return null
  const restant = () => Math.floor(echeance - performance.now())
  const git = dossierGitCommun(depotBorne(worktree, restant))
  if (!git.disponible) return null
  const dossier = dossierSessions(git.valeur)
  let carte = await lireCarteDuHook(contexte, dossier, echeance)
  if (!carte) return null

  if (attendreInscription && !carte.agentProcessus) {
    const limite = performance.now() + carte.demarrageJusqua - Date.now()
    while (carte && !carte.agentProcessus && performance.now() < limite) {
      await pause(Math.min(PAS_LECTURE_CARTE_MS, limite - performance.now()))
      carte = await lireCarteDuHook(contexte, dossier, limite)
    }
    echeance = Math.min(limite, performance.now() + DELAI_PREUVE_HOOK_MS)
  }
  if (!carte?.agentProcessus || restant() <= 0) return null

  const vue = mesurer({ identites: true, timeout: Math.min(DELAI_MESURE_PROCESSUS_MS, restant()) })
  if (vue.indeterminee || restant() <= 0) return null
  const [parent, grandParent] = ancetresValidesDe(process.pid, vue.processus)
  const identite = surface === 'codex' && RELAIS_CODEX.test(parent?.nom ?? '') && parent.pid !== carte.agentProcessus.pid ? grandParent : parent
  if (identite?.pid !== carte.agentProcessus.pid || identite.creation !== carte.agentProcessus.creation) return null
  return { carte, chemin: contexteRecu(carte, dossier, contexte.nonce).chemin }
}

/** `true` si le reçu SessionStart de `contexte` existe, est valide et porte sa session, son nonce et `nativeSessionId`. */
export function recuConcordant(contexte, nativeSessionId) {
  let brut
  try { brut = JSON.parse(fs.readFileSync(contexte.chemin, 'utf8')) } catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return false; throw e }
  const vu = Recu.safeParse(brut)
  if (!vu.success) return false
  const { version: _version, date: _date, nativeSessionId: natif, ...identite } = vu.data
  const { chemin: _chemin, ...attendu } = contexte
  return natif === nativeSessionId && isDeepStrictEqual(identite, attendu)
}

export async function produireRecuSessionStart({ surface, entree, env = process.env, worktree = process.cwd(), credo, echeance }) {
  const attendu = contexteDeSession(env)
  if (!attendu) return null
  const native = JSON.parse(entree)
  if (!estObjet(native) || native.hook_event_name !== 'SessionStart' || (native.session_id !== undefined && (typeof native.session_id !== 'string' || !native.session_id.trim()))) throw new Error('REÇU : ENTRÉE NATIVE SESSIONSTART INVALIDE')
  if (attendu.surface !== surface || attendu.worktree !== canoniserWorktree(worktree)) throw new Error('REÇU : PRODUCTEUR ÉTRANGER')
  if (surface === 'codex' && attendu.empreinteCredo !== hashSessionStart(credo ?? '')) throw new Error('REÇU : CREDO DIVERGENT')
  const inscription = await inscriptionDuHook(attendu, { surface, worktree, attendreInscription: surface === 'claude', echeance })
  if (!inscription) return null
  const date = Date.now()
  if (!inscription.carte.recuSessionStart && date > inscription.carte.demarrageJusqua) return null
  const { chemin: _chemin, ...identite } = attendu
  const recu = Recu.parse({ ...identite, version: 1, date: new Date(date).toISOString(), ...(native.session_id ? { nativeSessionId: native.session_id } : {}) })
  ecrireJsonAtomique(inscription.chemin, recu)
  return recu
}

export function validerRecuSessionStart(brut, carte) {
  const parse = Recu.safeParse(brut)
  if (!parse.success) return { ok: false, raison: 'REÇU SESSIONSTART INVALIDE' }
  const recu = parse.data
  if (recu.sessionId !== carte.sessionId || recu.surface !== carte.agent || recu.worktree !== canoniserWorktree(carte.worktree) || recu.empreinteCanon !== carte.hooks?.empreinteCanon || recu.empreinteCredo !== carte.hooks?.empreinteCredo) return { ok: false, raison: 'REÇU SESSIONSTART ÉTRANGER' }
  if (hashSessionStart(recu.nonce) !== carte.empreinteNonceHook) return { ok: false, raison: 'REÇU SESSIONSTART NONCE INCORRECT' }
  if (recu.debut !== carte.date || Date.parse(recu.date) < Date.parse(carte.date) || Date.parse(recu.date) > carte.demarrageJusqua) return { ok: false, raison: 'REÇU SESSIONSTART PÉRIMÉ' }
  return { ok: true, recu }
}

export async function entreeHookNative(env = process.env, stdin = process.stdin, delaiMs = DELAI_STDIN_MS) {
  if (!env.WFRP_SESSION_START) return undefined
  return lireStdinBorne(delaiMs, { stdin, limite: 65536 })
}
