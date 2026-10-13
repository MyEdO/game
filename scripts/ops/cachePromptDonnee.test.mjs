// Banc de l'extracteur de transcripts (#2596, node --test, sans disque) : une fixture jsonl minuscule, jouée
// ligne à ligne par `traiterLigne` comme la lit `scripts/ops/cache-prompt.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AVANT_MAX, codeDeSortie, contexteDExtraction, etatDuFil, identiteDuFichier, racineDuCwd, racinesDuDepot, traiterLigne } from './cachePromptDonnee.mjs'

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
  assert.equal(use.resume.command.length, 300)
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

function jouerPrincipal(lignes, depuis = T0, jusqua = T0 + 3600e3) {
  const ctx = contexteDExtraction(depuis, jusqua)
  const etat = etatDuFil(identiteDuFichier(['s1.jsonl'], null), 's1.jsonl')
  const requetes = [], evenements = []
  for (const l of lignes.map((o) => JSON.stringify(o))) { const r = traiterLigne(ctx, etat, l); requetes.push(...r.requetes); evenements.push(...r.evenements) }
  return { ctx, etat, requetes, evenements }
}

test('sortie et réflexion d\'un message lu sur plusieurs lignes : celles de la DERNIÈRE ligne', () => {
  const ligne = (out, pense, stop) => assistant(1, 'm', usage(0, 30000, 0, { out, pense }), undefined, { message: { id: 'msg_m', model: 'claude-opus-5-5', usage: usage(0, 30000, 0, { out, pense }), content: [], stop_reason: stop } })
  const [r] = jouer([ligne(3, 1, null), ligne(250, 40, 'end_turn')].map((o) => JSON.stringify(o))).requetes
  assert.deepEqual([r.out, r.pense, r.stop_reason], [250, 40, 'end_turn'])
  const [seule] = jouer([JSON.stringify(ligne(3, 1, null))]).requetes
  assert.deepEqual([seule.out, seule.pense], [3, 1])
})

test('requête d\'avant la fenêtre : son coût, sortie de la dernière ligne comprise, va au cumul du fil', () => {
  const ligne = (out) => assistant(-5, 'p', usage(0, 1e6, 0, { out }), undefined, { message: { id: 'msg_p', model: 'claude-opus-5-5', usage: usage(0, 1e6, 0, { out }), content: [] } })
  const { etat, requetes } = jouerPrincipal([ligne(0), ligne(1e6), assistant(1, 'q', usage(0, 1e6, 0, { out: 0 }))])
  assert.equal(requetes.length, 1)
  assert.ok(Math.abs(etat.fil.dollarsAvantFenetre - (5 + 4e-6 + 20)) < 1e-9)
  assert.equal(jouerPrincipal([ligne(0)], T0 - 3600e3).etat.fil.dollarsAvantFenetre, 0)
})

test('code de sortie : dernier exit=N écrit, en-tête Exit code N d\'une erreur, 0 hors erreur, null sinon', () => {
  assert.equal(codeDeSortie('exit=0\n[perimetre] … exit=1', false), 1)
  assert.equal(codeDeSortie('Exit code 2\nboom', true), 2)
  assert.equal(codeDeSortie('ok', false), 0)
  assert.equal(codeDeSortie('boom', true), null)
})

test('résultat Bash : fin bornée et code ; résultat d\'un autre outil : ni l\'un ni l\'autre', () => {
  const ev = jouer([
    assistant(1, 'u', usage(0, 30000, 0), [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'npm run test:perimetre' } }, { type: 'tool_use', id: 'r1', name: 'Read', input: {} }]),
    user(2, [{ type: 'tool_result', tool_use_id: 'b1', content: 'x'.repeat(500) + ' exit=1' }, { type: 'tool_result', tool_use_id: 'r1', content: 'exit=1' }]),
  ].map((o) => JSON.stringify(o))).evenements.filter((e) => e.type === 'tool_result')
  assert.deepEqual(ev.map((e) => [e.outil, e.code, e.fin?.length]), [['Bash', 1, 300], ['Read', undefined, undefined]])
  assert.ok(ev[0].fin.endsWith('exit=1'))
})

test('notification : statut et code de sortie lus dans le <status> et le <summary>', () => {
  const notif = (statut, sommaire) => ({ type: 'queue-operation', operation: 'enqueue', timestamp: iso(1), content: `<task-notification><status>${statut}</status><summary>${sommaire}</summary></task-notification>` })
  const ev = jouer([notif('failed', 'Background command "t" failed with exit code 1'), notif('completed', 'Agent "c" finished')].map((o) => JSON.stringify(o))).evenements
  assert.deepEqual(ev.map((e) => [e.statut, e.code]), [['failed', 1], ['completed', undefined]])
})

test('frontière de tour : 1re requête après turn_duration, ajout harnais du tour précédent, couverture précédente', () => {
  const td = (min) => ({ type: 'system', subtype: 'turn_duration', timestamp: iso(min) })
  const [a, b, c, d] = jouerPrincipal([
    assistant(1, 'a', usage(0, 30000, 0)),
    user(2, 'texte [suivi] situation relue'),
    assistant(3, 'b', usage(30000, 100, 0)),
    td(4),
    assistant(5, 'c', usage(1000, 30000, 0)),
    td(6), user(6, 'suite'),
    assistant(7, 'd', usage(31000, 10, 0)),
  ]).requetes
  assert.deepEqual([a, b, c, d].map((r) => [r.finDeTour, r.ajoutTourPrecedent, r.couvertPrec]), [[false, null, null], [false, null, 30000], [true, true, 30100], [true, false, 31000]])
})

test('cost-state : sa position est le rang de la dernière requête lue', () => {
  const e = jouerPrincipal([assistant(1, 'a', usage(0, 30000, 0)), { type: 'cost-state', totalCostUSD: 2 }]).evenements.find((x) => x.type === 'etat_cout')
  assert.deepEqual([e.rang, e.totalCostUSD], [1, 2])
})

test('racines d\'un dépôt : l\'arbre principal puis ses frères <slug>-*, jamais un préfixe sans tiret', () => {
  assert.deepEqual(racinesDuDepot('C--Game', ['C--Game--wt-2596', 'C--Gamebis', 'C--Game', 'C--Game-x', 'Autre']), ['C--Game', 'C--Game--wt-2596', 'C--Game-x'])
})
