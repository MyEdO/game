// Banc des analyses du cache de prompt (#2596, node --test, sans disque) : enregistrements normalisés minuscules,
// de la forme rendue par `cachePromptDonnee.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  basculesOrganisation, causeDEcriture, commandes, comptesCles, analyser, coutDollars, delta, frontieresDeTour, reecritures,
  reprisesSousAgents, reveilsOrchestrateur, thinkingDrops, ttl,
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

test('frontière de tour : l’ajout harnais du tour précédent et la cassure du préfixe ; réécriture attribuée', () => {
  rangs = {}
  const fin = { type: 'system', r: 'turn_duration' }, ajout = { type: 'prompt', r: 'texte [suivi] situation relue' }
  const requetes = [
    req('s', 'principal', 0, { e1: 100000 }),
    req('s', 'principal', 1, { lu: 100000, e1: 500, avant: [ajout] }),
    req('s', 'principal', 3, { lu: 32000, e1: 70000, avant: [fin] }),
    req('s', 'principal', 4, { lu: 102000, e1: 300 }),
    req('s', 'principal', 6, { lu: 102300, e1: 200, avant: [fin] }),
  ]
  assert.deepEqual(frontieresDeTour({ requetes }).map((b) => [b.ajout, b.casse]), [[true, true], [false, false]])
  const r = reecritures({ requetes })
  assert.deepEqual(r.sousTtl.map((x) => x.attribution), ['frontière, ajout harnais au tour précédent'])
})

test('coût en dollars par composante ; modèle hors grille = null', () => {
  rangs = {}
  const r = req('s', 'principal', 0, { lu: 1e6, e5: 1e6, e1: 1e6, nu: 1e6, out: 1e6 })
  assert.deepEqual(coutDollars(r), { lu: 0.2, e5: 5, e1: 8, nu: 4, sortie: 20, pense: 0 })
  assert.equal(coutDollars({ ...r, model: 'inconnu' }), null)
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
