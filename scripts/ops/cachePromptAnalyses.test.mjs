// Banc des analyses du cache de prompt (#2596, node --test, sans disque) : enregistrements normalisés minuscules,
// de la forme rendue par `cachePromptDonnee.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_MORT, basculesOrganisation, causeDEcriture, causesDeReveil, commandes, comptesCles, analyser, conformiteSendMessage, coutDollars, delta, dollars,
  frontieresDeTour, rapprochementCoutEtat, reecritures, reprisesSousAgents, reveilsOrchestrateur, simuPlafond, surcout, thinkingDrops, transcriptsLus, ttl, verdictPerimetre,
} from './cachePromptAnalyses.mjs'
import { rendreRapport } from './cachePromptRapport.mjs'

const T0 = Date.parse('2026-10-12T10:00:00Z')
const at = (min) => T0 + min * 60000
let rangs = {}
/** Requête du fil `fil` de la session `s` ; rang et écart dérivés de l'ordre d'appel. */
function req(s, fil, min, { lu = 0, e5 = 0, e1 = 0, nu = 1, out = 10, model = 'claude-opus-5-5', avant = [], apresCompactage = false } = {}) {
  const k = `${s}|${fil}`, prec = rangs[k]
  rangs[k] = { rang: (prec?.rang ?? 0) + 1, t: at(min) }
  return { session: s, fichier: k, fil, agentType: fil === 'principal' ? null : 'codeur', model, t: at(min), lu, e5, e1, ecritAutre: 0, nu, out, pense: 0,
    ctx: lu + e5 + e1 + nu, ecartMin: prec ? min - (prec.t - T0) / 60000 : null, rang: rangs[k].rang, premiere: !prec, apresCompactage, avant }
}
const ev = (s, fil, min, e) => ({ session: s, fil, agentType: fil === 'principal' ? null : 'codeur', t: at(min), ...e })
const vide = { requetes: [], evenements: [], fils: [] }

test('cause d’écriture : incrémentale, naissance, compactage, inactivité, sans cause', () => {
  rangs = {}
  const [n, inc, sans, longue] = [req('s', 'a1', 0, { e5: 30000 }), req('s', 'a1', 1, { lu: 30000, e5: 500 }), req('s', 'a1', 2, { lu: 9000, e5: 40000 }), req('s', 'a1', 90, { e5: 50000 })]
  assert.deepEqual([n, inc, sans, longue].map(causeDEcriture), ['naissance d’agent', 'incrémental', 'sans cause visible (< 5 min)', 'inactivité > 1 h'])
  assert.equal(causeDEcriture({ ...sans, apresCompactage: true }), 'après compactage')
})

test('reprise froide de sous-agent : attribuée à test:perimetre qui couvre l’attente, à la latence sinon', () => {
  rangs = {}
  const requetes = [req('s', 'a1', 0, { e5: 30000 }), req('s', 'a1', 1, { lu: 30000, e5: 100 }), req('s', 'a1', 10, { e5: 31000 }), req('s', 'a1', 18, { e5: 32000 })]
  const evenements = [
    ev('s', 'a1', 1, { type: 'tool_use', nom: 'Bash', id: 'tu1', resume: { command: 'npm run test:perimetre' } }),
    ev('s', 'a1', 9.5, { type: 'tool_result', outil: 'Bash', id: 'tu1', taille: 10 }),
  ]
  const r = reprisesSousAgents({ requetes, evenements, fils: [] })
  assert.deepEqual(r.lignes.map((x) => x.cause), ['outil test:perimetre', 'latence du modèle'])
  assert.equal(comptesCles(analyser({ requetes, evenements, fils: [] })).reprisesFroidesCodeurApresPerimetre, 1)
  assert.equal(reprisesSousAgents({ requetes: requetes.slice(0, 2), evenements, fils: [] }).lignes.length, 0)
})

test('réveil de l’orchestrateur après plus d’1 h : cause lue dans les événements de l’écart', () => {
  rangs = {}
  const requetes = [req('s', 'principal', 0, { e1: 30000 }), req('s', 'principal', 80, { e1: 40000 }), req('s', 'principal', 90, { lu: 40000, e1: 100 })]
  const evenements = [ev('s', 'principal', 79, { type: 'prompt', nature: 'balise:task-notification', origin: 'task-notification', debut: '<task-notification>', sommaire: 'Agent "codeur" completed' })]
  const r = reveilsOrchestrateur({ requetes, evenements, fils: [] })
  assert.deepEqual(r.longues.map((x) => x.cause), ['agent rendu'])
  assert.equal(r.distribution.find((d) => d.a === 60).froides, 1)
  assert.deepEqual(reveilsOrchestrateur({ requetes, evenements: [], fils: [] }).longues.map((x) => x.cause), ['aucun événement'])
})

test('frontière de tour : lue sur la segmentation de l’extraction ; couverture précédente hors fenêtre comprise ; réécriture attribuée', () => {
  rangs = {}
  const f = (r, ajout, couvertPrec) => ({ ...r, finDeTour: true, ajoutTourPrecedent: ajout, couvertPrec })
  const requetes = [
    req('s', 'principal', 0, { e1: 100000 }),
    req('s', 'principal', 1, { lu: 100000, e1: 500 }),
    f(req('s', 'principal', 3, { lu: 32000, e1: 70000 }), true, 100500),
    req('s', 'principal', 4, { lu: 102000, e1: 300 }),
    f(req('s', 'principal', 6, { lu: 102300, e1: 200 }), false, 102300),
    f(req('s', 'principal', 90, { e1: 102000 }), false, 102500),
  ]
  assert.deepEqual(frontieresDeTour({ requetes }).map((b) => [b.ajout, b.casse]), [[true, true], [false, false]])
  const r = reecritures({ requetes })
  assert.deepEqual(r.sousTtl.map((x) => x.attribution), ['frontière, ajout harnais au tour précédent'])
  const premiereDeFenetre = { ...f(req('t', 'principal', 0, { lu: 1000, e1: 60000 }), true, 61000), ecartMin: 2 }
  assert.deepEqual(frontieresDeTour({ requetes: [premiereDeFenetre] }).map((b) => [b.ajout, b.casse]), [[true, true]])
  assert.equal(frontieresDeTour({ requetes: [{ ...premiereDeFenetre, finDeTour: false }] }).length, 0)
})

test('coût en dollars par composante ; modèle hors grille = null', () => {
  rangs = {}
  const r = req('s', 'principal', 0, { lu: 1e6, e5: 1e6, e1: 1e6, nu: 1e6, out: 1e6 })
  assert.deepEqual(coutDollars(r), { lu: 0.2, e5: 5, e1: 8, nu: 4, sortie: 20, pense: 0 })
  assert.equal(coutDollars({ ...r, model: 'inconnu' }), null)
})

test('grille : lecture ×0,05 de l’input à Opus, suffixe [1m] reconnu, modèle hors grille compté et nommé, part des écritures en $', () => {
  rangs = {}
  const r = req('s', 'principal', 0, { lu: 1e6, e5: 1e6, nu: 0, out: 0 })
  assert.deepEqual(coutDollars({ ...r, model: 'claude-opus-5-5[1m]' }), coutDollars(r))
  assert.ok(Math.abs(surcout(r) - 4.8) < 1e-9)
  const c = comptesCles(analyser({ requetes: [r, { ...req('s', 'principal', 1, { e5: 10 }), model: 'claude-x-9' }], evenements: [], fils: [] }))
  assert.deepEqual([c.requetesHorsGrille, c.modelesHorsGrille], [1, 'claude-x-9'])
  assert.ok(Math.abs(c.partEcrituresCoutPrompt - 5 / 5.2) < 1e-9)
  assert.equal(comptesCles(analyser({ requetes: [r], evenements: [], fils: [] })).modelesHorsGrille, '')
})

test('réveil : notification d’agent failed / killed / stopped = agent mort ; completed = agent rendu', () => {
  const n = (statut, sommaire) => ({ type: 'prompt', origin: 'task-notification', nature: 'balise:task-notification', debut: '<task-notification>', statut, sommaire })
  assert.deepEqual(causesDeReveil([n('failed', 'Agent "c" failed: Agent stalled: no progress for 600s (stream watchdog)')]), [AGENT_MORT])
  assert.deepEqual(causesDeReveil([n('stopped', 'Background agent "c" didn’t finish before the previous session ended')]), [AGENT_MORT])
  assert.deepEqual(causesDeReveil([n('completed', 'Agent "c" finished')]), ['agent rendu'])
  assert.deepEqual(causesDeReveil([n('failed', 'Background command "x" failed with exit code 1')]), ['commande de fond'])
})

test('rapprochement cost-state : principal jusqu’à son rang, sous-agents jusqu’à son instant, cumuls d’avant la fenêtre', () => {
  rangs = {}
  const o = { e5: 1e6, nu: 0, out: 0 }
  const requetes = [req('s', 'principal', 0, o), req('s', 'a1', 1, o), req('s', 'principal', 3, o), req('s', 'a1', 4, o)]
  const etat = { ...ev('s', 'principal', 2, { type: 'etat_cout', totalCostUSD: 20, modeles: {} }), rang: 1 }
  const fils = [{ session: 's', fil: 'principal', dollarsAvantFenetre: 4 }, { session: 's', fil: 'a1', dollarsAvantFenetre: 6 }]
  const [c] = rapprochementCoutEtat({ requetes, evenements: [etat], fils })
  assert.deepEqual([c.principal, c.sousAgents, c.calcule, c.ecart], [9, 11, 20, 0])
  assert.equal(rapprochementCoutEtat({ requetes, evenements: [{ ...etat, rang: 2, totalCostUSD: 25 }], fils })[0].ecart, (25 - 25) / 25)
})

test('plafond simulé : sans dépassement, le coût réel (= dollars) ; au-dessous du contexte, des coupures', () => {
  rangs = {}
  const requetes = [req('s', 'principal', 0, { e1: 100000 }), req('s', 'principal', 1, { lu: 100000, e1: 100000 }), req('s', 'principal', 2, { lu: 150000, e1: 100000 })]
  const [g] = simuPlafond({ requetes })
  assert.ok(Math.abs(g.reel - dollars(requetes).total) < 1e-9)
  const a300 = g.plafonds.find((x) => x.C === 300e3), a150 = g.plafonds.find((x) => x.C === 150e3)
  assert.deepEqual([a300.compactage.coupures, a150.compactage.coupures > 0, a150.redemarrage.coupures > 0], [0, true, true])
  assert.ok(Math.abs(a300.compactage.dollars - g.reel) < 1e-9)
  assert.equal(a150.compactage.coupures, 2)
  assert.ok(Math.abs(a150.compactage.dollars - 8.0706684) < 1e-9)
})

test('verdict de test:perimetre par codeur : code du résultat, de la notification en fond ; dernier run du fil', () => {
  const evenements = [
    ev('s', 'a1', 0, { type: 'tool_use', nom: 'Bash', id: 't1', resume: { command: 'npm run test:perimetre' } }),
    ev('s', 'a1', 5, { type: 'tool_result', outil: 'Bash', id: 't1', taille: 1, code: 1, fin: 'exit=1' }),
    ev('s', 'a1', 6, { type: 'tool_use', nom: 'Bash', id: 'toolu_0123456789abcdefZZ', resume: { command: 'npm run test:perimetre', run_in_background: true } }),
    ev('s', 'a1', 9, { type: 'file', debut: '<task-notification><tool-use-id>toolu_0123456789abcdef', sommaire: 'Background command "p" completed (exit code 0)', code: 0 }),
    ev('s', 'a2', 0, { type: 'tool_use', nom: 'Bash', id: 't3', resume: { command: 'npm run test:perimetre' } }),
    ev('s', 'a2', 3, { type: 'tool_result', outil: 'Bash', id: 't3', taille: 1, code: 2 }),
    ev('s', 'a3', 0, { type: 'tool_use', nom: 'Bash', id: 't4', resume: { command: 'npm run test:perimetre' } }),
  ]
  const v = verdictPerimetre({ evenements })
  assert.deepEqual(v.parFil.map((f) => [f.fil, f.runs, f.rouges, f.verdict]), [['a1', 2, 1, 'vert'], ['a2', 1, 1, 'rouge'], ['a3', 1, 0, 'inconnu']])
})

test('SendMessage : livraison sur agent rendu, et rendu depuis plus de 5 min', () => {
  const h = (fil, min) => ev('s', fil, min, { type: 'tool_use', nom: 'SubagentHandback', id: `h${fil}${min}`, resume: {} })
  const m = (fil, min) => ev('s', fil, min, { type: 'prompt', debut: 'The coordinator sent a message: x' })
  const r = conformiteSendMessage({ evenements: [h('a1', 0), m('a1', 10), h('a2', 0), m('a2', 3), m('a3', 1)] })
  assert.deepEqual([r.livraisons.length, r.surAgentRendu, r.renduPlus5.map((x) => x.fil)], [3, 2, ['a1']])
})

test('transcripts lus : les fichiers qui portent une requête de la fenêtre, une fois chacun', () => {
  rangs = {}
  assert.equal(transcriptsLus([req('s', 'a1', 0), req('s', 'a1', 1), req('s', 'principal', 2)]), 2)
  assert.equal(transcriptsLus([]), 0)
})

test('TTL servi et empirique : e5 / e1 par type, part froide par tranche', () => {
  rangs = {}
  const requetes = [req('s', 'a1', 0, { e5: 30000 }), req('s', 'a1', 6, { e5: 30000 }), req('s', 'a1', 6.2, { lu: 30000, e5: 10 })]
  const t = ttl({ requetes })
  assert.deepEqual(t.servi.map((x) => [x.type, x.e5, x.e1, x.mixtes]), [['codeur', 60010, 0, 0]])
  assert.deepEqual(t.empirique[0].tranches.find((x) => x.a === 5.5), { a: 5.5, b: 7, n: 1, froides: 1 })
})

test('commande en fond : durée jusqu’à la notification qui porte son id ; premier plan jusqu’au résultat', () => {
  const evenements = [
    ev('s', 'a1', 0, { type: 'tool_use', nom: 'Bash', id: 'toolu_0123456789abcdefXYZ', resume: { command: 'npm run test:perimetre', run_in_background: true } }),
    ev('s', 'a1', 7, { type: 'prompt', debut: '<task-notification><tool-use-id>toolu_0123456789abcdef' }),
    ev('s', 'a1', 8, { type: 'tool_use', nom: 'Bash', id: 'tu2', resume: { command: 'git status' } }),
    ev('s', 'a1', 8.5, { type: 'tool_result', id: 'tu2', outil: 'Bash', taille: 1 }),
    ev('s', 'a1', 9, { type: 'tool_use', nom: 'Bash', id: 'tu3', resume: { command: 'npm run test:perimetre -- --liste' } }),
  ]
  assert.deepEqual(commandes({ evenements }).map((c) => [c.min, c.fond, c.perim, c.classe]), [[7, true, true, 'test:perimetre'], [0.5, false, false, 'git'], [null, false, false, 'test:perimetre']])
})

test('thinking_drop : champs dépliés et requête suivante du même fil', () => {
  rangs = {}
  const requetes = [req('s', 'principal', 0, { e1: 100000 }), req('s', 'principal', 2, { lu: 32000, e1: 70000 })]
  const evenements = [ev('s', 'principal', 1, { type: 'attachment', sorte: 'thinking_drop', meta: { 'newlyDropped.reason': 'prefix_mismatch', 'clientChange.kinds': 'messagesHistoryChanged' } })]
  const d = thinkingDrops({ requetes, evenements })
  assert.deepEqual([d.n, d.parRaison, d.suivante], [1, { prefix_mismatch: 1 }, { 'réécriture complète': 1 }])
  assert.equal(thinkingDrops({ requetes, evenements: [] }).n, 0)
})

test('bascule d’organisation : seul un changement d’uuid compte', () => {
  const o = (min, u) => ev('s', 'principal', min, { type: 'attachment', sorte: 'credential_org', meta: { organizationUuid: u } })
  assert.deepEqual(basculesOrganisation({ evenements: [o(0, 'A'), o(1, 'A'), o(2, 'B')] }).map((b) => [b.de, b.vers]), [['A', 'B']])
  assert.deepEqual(basculesOrganisation({ evenements: [o(0, 'A'), o(1, 'A')] }), [])
})

test('delta des comptes et rapport rendu sur un jeu vide', () => {
  assert.deepEqual(delta({ a: 3, b: 'x' }, { a: 5, c: 1 }), { a: { avant: 3, apres: 5, delta: 2 }, b: { avant: 'x', apres: null, delta: null }, c: { avant: null, apres: 1, delta: null } })
  const a = analyser(vide)
  assert.match(rendreRapport({ depuis: T0, jusqua: at(60), exclues: ['moi'], fichiers: 0 }, a, comptesCles(a)), /## 16\. thinking_drop/)
})
