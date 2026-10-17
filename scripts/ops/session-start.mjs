import fs from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { chargerRegistres } from '../agents/compat-cli.mjs'
import { hooksAttendus, aplatirHooks, SURFACE_CLAUDE, SURFACE_CODEX } from '../agents/compat-core.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { lireStdinBorne, DELAI_STDIN_MS } from '../guards/lib/stdinBorne.mjs'

export const hashSessionStart = (value) => createHash('sha256').update(value).digest('hex')
export const canoniserWorktree = (path) => {
  const real = fs.realpathSync.native(resolve(path))
  return process.platform === 'win32' ? real.toLowerCase() : real
}
const Empreinte = z.string().regex(/^[a-f0-9]{64}$/)
const Contexte = z.object({ sessionId: z.uuid(), nonce: Empreinte, worktree: z.string().min(1), surface: z.enum(['claude', 'codex']), empreinteCanon: Empreinte, empreinteCredo: Empreinte.optional(), debut: z.iso.datetime(), chemin: z.string().min(1) }).strict()
const Recu = Contexte.omit({ chemin: true }).extend({ version: z.literal(1), date: z.iso.datetime(), nativeSessionId: z.string().min(1).optional() }).strict()
export const PreuveSessionStart = Recu.omit({ nonce: true })

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
  const credo = fs.readFileSync(join(worktree, `.${agent}/credo.md`), 'utf8')
  if (!credo.trim()) throw new Error('HOOKS : CREDO VIDE')
  return { empreinteCanon: hashSessionStart(JSON.stringify({ attendus, contenus })), ...(agent === 'codex' ? { empreinteCredo: hashSessionStart(credo) } : {}), delaiMs: (plats.filter((h) => h.phase === 'SessionStart').reduce((total, h) => total + h.timeout, 0) + 10) * 1000 }
}

export const contexteRecu = (carte, dossier, nonce) => Contexte.parse({ sessionId: carte.sessionId, nonce, worktree: canoniserWorktree(carte.worktree), surface: carte.agent, empreinteCanon: carte.hooks.empreinteCanon, ...(carte.hooks.empreinteCredo ? { empreinteCredo: carte.hooks.empreinteCredo } : {}), debut: carte.date, chemin: join(dossier, `${carte.sessionId}.sessionstart`) })

export function produireRecuSessionStart({ surface, entree, env = process.env, worktree = process.cwd(), credo }) {
  if (!env.WFRP_SESSION_START) return null
  const attendu = Contexte.parse(JSON.parse(Buffer.from(env.WFRP_SESSION_START, 'base64').toString('utf8')))
  const native = JSON.parse(entree)
  if (!native || typeof native !== 'object' || Array.isArray(native) || native.hook_event_name !== 'SessionStart' || (native.session_id !== undefined && (typeof native.session_id !== 'string' || !native.session_id.trim()))) throw new Error('REÇU : ENTRÉE NATIVE SESSIONSTART INVALIDE')
  if (attendu.surface !== surface || attendu.worktree !== canoniserWorktree(worktree)) throw new Error('REÇU : PRODUCTEUR ÉTRANGER')
  if (surface === 'codex' && attendu.empreinteCredo !== hashSessionStart(credo ?? '')) throw new Error('REÇU : CREDO DIVERGENT')
  const { chemin, ...identite } = attendu
  const recu = Recu.parse({ ...identite, version: 1, date: new Date().toISOString(), ...(native.session_id ? { nativeSessionId: native.session_id } : {}) })
  ecrireJsonAtomique(chemin, recu)
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
