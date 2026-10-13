// Banc de l'extracteur de transcripts (#2596, node --test, sans disque) : une fixture jsonl minuscule, jouée
// ligne à ligne par `traiterLigne` comme la lit `scripts/ops/cache-prompt.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AVANT_MAX, contexteDExtraction, etatDuFil, identiteDuFichier, racineDuCwd, traiterLigne } from './cachePromptDonnee.mjs'

const T0 = Date.parse('2026-10-12T10:00:00Z')
const iso = (min) => new Date(T0 + min * 60000).toISOString()
const usage = (lu, e5, e1, { nu = 1, out = 10, pense } = {}) => ({
  input_tokens: nu, cache_read_input_tokens: lu, cache_creation_input_tokens: e5 + e1, output_tokens: out,
  ...(pense === undefined ? {} : { output_tokens_details: { thinking_tokens: pense } }),
  cache_creation: { ephemeral_5m_input_tokens: e5, ephemeral_1h_input_tokens: e1 },
})
const assistant = (min, id, u, content = [{ type: 'text', text: 'ok' }], extra = {}) => ({
  type: 'assistant', timestamp: iso(min), requestId: `req_${id}`, version: '2.1.1', gitBranch: 'main',
  message: { id: `msg_${id}`, model: 'claude-opus-5-5', usage: u, content, stop_reason: null }, ...extra,
})
const user = (min, content, extra = {}) => ({ type: 'user', timestamp: iso(min), version: '2.1.1', gitBranch: 'main', message: { content }, ...extra })

/** La fixture : un fil d'agent, une requête avant la fenêtre, un compactage, une version qui change. */
const FIXTURE = [
  { type: 'mode', mode: 'normal' },
  user(-10, 'Tu es codeur. Brief.'),
  assistant(-9, 'a', usage(0, 30000, 0, { pense: 5 })),
  user(-8, '<task-notification><summary>Agent fini</summary></task-notification>'),
  { type: 'attachment', timestamp: iso(-8), attachment: { type: 'total_tokens_reminder', text: 'x'.repeat(40) }, rendered: [{ content: 'r'.repeat(12) }] },
  assistant(1, 'b', usage(30000, 500, 0, { out: 3 }), [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'npm run test:perimetre ' + 'y'.repeat(400), run_in_background: true } }]),
  assistant(1, 'b', usage(30000, 500, 0, { out: 3 }), [{ type: 'text', text: 'suite' }], { message: { id: 'msg_b', model: 'claude-opus-5-5', usage: usage(30000, 500, 0, { out: 3 }), content: [], stop_reason: 'tool_use' } }),
  user(9, [{ type: 'tool_result', tool_use_id: 'tu1', content: 'z'.repeat(1234) }]),
  { type: 'system', subtype: 'compact_boundary', timestamp: iso(10), compactMetadata: { trigger: 'auto', preTokens: 400000, postTokens: 30000, preservedMessages: { uuids: ['u1', 'u2'] } } },
  assistant(12, 'c', usage(0, 32000, 0), undefined, { version: '2.1.2' }),
  assistant(12, 'd', { ...usage(0, 0, 0), output_tokens: 0 }, undefined, { version: '2.1.2', message: { id: 'msg_d', model: '<synthetic>', usage: usage(0, 0, 0), content: [] } }),
  { type: 'cost-state', sessionId: 's', totalCostUSD: 1, modelUsage: { 'claude-opus-5-5': { costUSD: 1, inputTokens: 7 } } },
  { type: 'launched' },
  { type: 'attachment', timestamp: iso(12), attachment: { type: 'thinking_drop', newlyDropped: { reason: 'prefix_mismatch', blockCount: 3 }, clientChange: { kinds: 'messagesHistoryChanged', firstChangedMessageIndex: 0 } } },
  { type: 'assistant', timestamp: iso(13), isApiErrorMessage: true, error: 'rate_limit', message: { content: [{ type: 'text', text: 'API Error: 429' }] } },
].map((o) => JSON.stringify(o))

function jouer(lignes, depuis = T0, jusqua = T0 + 3600e3) {
  const ctx = contexteDExtraction(depuis, jusqua)
  const etat = etatDuFil(identiteDuFichier(['s1', 'subagents', 'agent-a42.jsonl'], { agentType: 'codeur' }), 's1/subagents/agent-a42.jsonl')
  const requetes = [], evenements = []
  for (const l of lignes) { const r = traiterLigne(ctx, etat, l); requetes.push(...r.requetes); evenements.push(...r.evenements) }
  return { ctx, etat, requetes, evenements }
}

test('une requête par message.id|requestId, <synthetic> exclu, fenêtre appliquée à l\'instant', () => {
  const { requetes, ctx } = jouer(FIXTURE)
  assert.deepEqual(requetes.map((r) => r.requestId), ['req_b', 'req_c'])
  assert.equal(ctx.inventaire.requetes, 3)
  assert.equal(ctx.inventaire.doublons, 1)
  assert.equal(ctx.inventaire.synthetiques, 1)
})

test('jetons de la requête : lu, e5, e1, écrit autre, nu, ctx, pensée absente = null', () => {
  const [b] = jouer(FIXTURE).requetes
  assert.deepEqual(
    { lu: b.lu, e5: b.e5, e1: b.e1, ecritAutre: b.ecritAutre, nu: b.nu, out: b.out, pense: b.pense, ctx: b.ctx, fil: b.fil, agentType: b.agentType },
    { lu: 30000, e5: 500, e1: 0, ecritAutre: 0, nu: 1, out: 3, pense: null, ctx: 30501, fil: 'a42', agentType: 'codeur' },
  )
})

test('écart, rang, première et compactage se lisent dans le fil, requête hors fenêtre comprise', () => {
  const [b, c] = jouer(FIXTURE).requetes
  assert.deepEqual([b.ecartMin, b.rang, b.premiere, b.apresCompactage], [10, 2, false, false])
  assert.deepEqual([c.ecartMin, c.rang, c.apresCompactage, c.version], [11, 3, true, '2.1.2'])
})

test('stop_reason d\'une ligne suivante du même message complète la requête', () => {
  assert.equal(jouer(FIXTURE).requetes[0].stop_reason, 'tool_use')
})

test('avant : les événements entre deux requêtes du fil, dans leur ordre', () => {
  const [b, c] = jouer(FIXTURE).requetes
  assert.deepEqual(b.avant.map((e) => e.type), ['prompt', 'attachment'])
  assert.match(b.avant[0].r, /^balise:task-notification/)
  assert.deepEqual(c.avant.map((e) => e.type), ['tool_use', 'tool_result', 'system', 'changement'])
  assert.match(c.avant[0].r, /^Bash \(fond\) npm run test:perimetre /)
})

test('avant est borné, son compte non', () => {
  const bavard = Array.from({ length: AVANT_MAX + 5 }, (_, i) => JSON.stringify(user(i / 100, `msg ${i}`)))
  const [r] = jouer([...bavard, JSON.stringify(assistant(1, 'z', usage(0, 30000, 0)))]).requetes
  assert.equal(r.avant.length, AVANT_MAX)
  assert.equal(r.avantN, AVANT_MAX + 5)
})

test('événements : outil résumé, résultat mesuré, compactage sans liste de messages, changement, erreur, inconnu', () => {
  const ev = jouer(FIXTURE).evenements
  const parType = (t) => ev.filter((e) => e.type === t)
  const [use] = parType('tool_use')
  assert.equal(use.nom, 'Bash')
  assert.equal(use.resume.run_in_background, true)
  assert.equal(use.resume.command.length, 301)
  assert.deepEqual(parType('tool_result').map((e) => [e.outil, e.taille]), [['Bash', 1234]])
  assert.deepEqual(parType('system')[0].compactMetadata, { trigger: 'auto', preTokens: 400000, postTokens: 30000, preservedMessagesN: 2 })
  assert.deepEqual(parType('changement').map((e) => [e.champ, e.de, e.vers]), [['version', '2.1.1', '2.1.2']])
  assert.deepEqual(parType('erreur_api').map((e) => [e.texte, e.erreur]), [['API Error: 429', 'rate_limit']])
  const prompts = jouer(FIXTURE, T0 - 3600e3).evenements.filter((e) => e.type === 'prompt')
  assert.deepEqual(prompts.map((e) => [e.nature, e.sommaire]), [['texte', undefined], ['balise:task-notification', 'Agent fini']])
  assert.deepEqual(parType('etat_cout').map((e) => [e.totalCostUSD, e.modeles, e.tHerite]), [[1, { 'claude-opus-5-5': { costUSD: 1, inputTokens: 7 } }, true]])
  assert.deepEqual(parType('inconnu').map((e) => [e.ligneType, e.t, e.tHerite]), [['launched', Date.parse(iso(12)), true]])
  const drop = parType('attachment').find((e) => e.sorte === 'thinking_drop')
  assert.deepEqual(drop.meta, { 'newlyDropped.reason': 'prefix_mismatch', 'newlyDropped.blockCount': 3, 'clientChange.kinds': 'messagesHistoryChanged', 'clientChange.firstChangedMessageIndex': 0 })
})

test('hors fenêtre : ni requête ni événement, l\'inventaire compte tout', () => {
  const { ctx, requetes, evenements } = jouer(FIXTURE, T0 + 3600e3, T0 + 7200e3)
  assert.deepEqual([requetes.length, evenements.length], [0, 0])
  assert.equal(ctx.inventaire.lignes, FIXTURE.length)
  assert.deepEqual(ctx.inventaire.inconnus.launched.n, 1)
  assert.equal(ctx.inventaire.parSousType['attachment/total_tokens_reminder'], 1)
})

test('le fil porte ses bornes, son contexte max et son premier prompt texte', () => {
  const { etat } = jouer(FIXTURE)
  assert.deepEqual(
    { premierT: etat.fil.premierT, dernierT: etat.fil.dernierT, requetes: etat.fil.requetes, requetesFenetre: etat.fil.requetesFenetre, maxCtx: etat.fil.maxCtx, premierPrompt: etat.fil.premierPrompt },
    { premierT: Date.parse(iso(-9)), dernierT: Date.parse(iso(12)), requetes: 3, requetesFenetre: 2, maxCtx: 32001, premierPrompt: 'Tu es codeur. Brief.' },
  )
})

test('identité du fichier : principal, agent typé par sa méta, agent de workflow sans méta', () => {
  assert.deepEqual(identiteDuFichier(['s1.jsonl'], null), { session: 's1', fil: 'principal', agentType: null, workflow: null, phase: null })
  assert.deepEqual(identiteDuFichier(['s1', 'subagents', 'workflows', 'wf_1', 'agent-a9.jsonl'], { agentType: 'lecteur', workflowPhase: 'Lecture' }),
    { session: 's1', fil: 'a9', agentType: 'lecteur', workflow: 'wf_1', phase: 'Lecture' })
  assert.equal(identiteDuFichier(['s1', 'subagents', 'workflows', 'wf_1', 'agent-a9.jsonl'], null).agentType, 'workflow')
})

test('racine dérivée du cwd comme Claude Code : deux-points, barres et points deviennent des tirets', () => {
  assert.equal(racineDuCwd('a:b\\c/d.e', 'maison\\'), 'maison/.claude/projects/a-b-c-d-e')
})
