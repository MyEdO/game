// CLIQUET du stock d'audit (node --test, sans réseau) : le comparateur est joué sur des rapports
// `npm audit --json` en fixture, et le stock RÉEL est confronté à son plafond.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { comparerAudit, paquetsJuges, ghsaDe, CHEMIN_STOCK } from './audit-stock.mjs'

/** Compte EXACT du stock : il vit ICI, jamais dans le JSON ni dans la lib — sans lui, le chemin le plus
 *  court pour « solder » une vulnérabilité neuve resterait d'ajouter une entrée, canari vert. L'égalité
 *  (et non `<=`) fait descendre ce nombre DANS LE GESTE qui éteint une entrée : un plafond resté au-dessus
 *  du compte rouvre en silence la place d'une entrée neuve. */
const PLAFOND = 0

const STOCK = JSON.parse(readFileSync(CHEMIN_STOCK, 'utf8'))

/** Rapport `npm audit --json` minimal : une entrée par paquet, `via` mêlant advisories et paquets. */
const rapport = (paquets) => ({ auditReportVersion: 2, vulnerabilities: paquets })
const advisory = (ghsa, severity = 'high') => ({ name: 'x', severity, url: `https://github.com/advisories/${ghsa}` })
const vuln = (severity, via, range = '<1.0.0') => ({ severity, via, range })

const STOCK_FIXTURE = {
  entrees: [
    { paquet: 'vite', cible: 'racine', severite: 'high', via: ['GHSA-aaa'], plage: '<=6.4.2', fix: 'vite 8', date: '2026-09-04', motif: 'dev', echeance: 'L3' },
  ],
}

test('paquetsJuges ne retient que high/critical, et sépare advisories et paquets porteurs', () => {
  const obs = paquetsJuges(rapport({
    vite: vuln('high', [advisory('GHSA-aaa'), 'esbuild']),
    esbuild: vuln('moderate', [advisory('GHSA-bbb', 'moderate')]),
  }), 'racine')
  assert.deepEqual(obs.map((o) => o.cle), ['racine:vite'])
  assert.deepEqual(obs[0].via, ['GHSA-aaa'])
  assert.deepEqual(obs[0].viaPaquets, ['esbuild'])
})

test('ghsaDe lit l’identifiant STABLE de l’advisory (l’URL), jamais le numéro interne du registre', () => {
  assert.equal(ghsaDe({ source: 1123525, url: 'https://github.com/advisories/GHSA-fx2h-pf6j-xcff' }), 'GHSA-fx2h-pf6j-xcff')
  assert.equal(ghsaDe({ source: 1 }), null)
})

test('paquet CONNU, advisories identiques → JAUNE, aucun rouge', () => {
  const obs = paquetsJuges(rapport({ vite: vuln('high', [advisory('GHSA-aaa')], '<=6.4.2') }), 'racine')
  const { rouges, jaunes } = comparerAudit(STOCK_FIXTURE, obs)
  assert.deepEqual(rouges, [])
  assert.equal(jaunes.length, 1)
  assert.match(jaunes[0], /racine:vite — high, fix : vite 8 \(au stock depuis le 2026-09-04/)
})

test('advisory NEUVE sur un paquet du stock → ROUGE (un paquet au stock n’amnistie pas ses advisories futures)', () => {
  const obs = paquetsJuges(rapport({ vite: vuln('high', [advisory('GHSA-aaa'), advisory('GHSA-zzz')]) }), 'racine')
  const { rouges, jaunes } = comparerAudit(STOCK_FIXTURE, obs)
  assert.equal(rouges.length, 1)
  assert.match(rouges[0], /ADVISORY NEUVE.*racine:vite:GHSA-zzz/)
  assert.deepEqual(jaunes, [], 'le paquet en écart sort des jaunes')
})

test('paquet NEUF >= high hors stock → ROUGE nominatif', () => {
  const obs = paquetsJuges(rapport({
    vite: vuln('high', [advisory('GHSA-aaa')]),
    lodash: vuln('critical', [advisory('GHSA-ccc', 'critical')], '<4.17.21'),
  }), 'racine')
  const { rouges } = comparerAudit(STOCK_FIXTURE, obs)
  assert.equal(rouges.length, 1)
  assert.match(rouges[0], /PAQUET NEUF >= high hors stock : racine:lodash \(critical, <4\.17\.21\)/)
})

test('entrée du stock dont le PAQUET a disparu → ROUGE « entrée périmée : retire-la »', () => {
  const { rouges } = comparerAudit(STOCK_FIXTURE, [])
  assert.equal(rouges.length, 1)
  assert.match(rouges[0], /entrée périmée : retire-la — racine:vite/)
})

test('entrée du stock dont l’ADVISORY a disparu → ROUGE « entrée périmée »', () => {
  const obs = paquetsJuges(rapport({ vite: vuln('high', [advisory('GHSA-aaa'), advisory('GHSA-ddd')]) }), 'racine')
  const stock = { entrees: [{ ...STOCK_FIXTURE.entrees[0], via: ['GHSA-aaa', 'GHSA-ddd', 'GHSA-partie'] }] }
  const { rouges } = comparerAudit(stock, obs)
  assert.equal(rouges.length, 1)
  assert.match(rouges[0], /l'advisory racine:vite:GHSA-partie a disparu du rapport/)
})

test('le paquet PUREMENT transitif (aucune advisory propre) est comparé sur sa seule clé', () => {
  const stock = { entrees: [{ paquet: 'miniflare', cible: 'server', severite: 'high', via: [], plage: 'x', fix: 'y', date: '2026-09-04', motif: 'm', echeance: 'e' }] }
  const obs = paquetsJuges(rapport({ miniflare: vuln('high', ['sharp', 'undici', 'ws']) }), 'server')
  const { rouges, jaunes } = comparerAudit(stock, obs)
  assert.deepEqual(rouges, [])
  assert.equal(jaunes.length, 1)
})

test('CLIQUET : le stock RÉEL vaut EXACTEMENT son compte déclaré et chaque entrée est complète', () => {
  assert.equal(STOCK.entrees.length, PLAFOND, `stock d’audit à ${STOCK.entrees.length} entrées pour un compte déclaré de ${PLAFOND} — en HAUSSE : une vulnérabilité neuve se TRAITE, elle ne s’inscrit pas ; en BAISSE : le compte descend dans le même geste que l’entrée éteinte.`)
  for (const e of STOCK.entrees) {
    for (const champ of ['paquet', 'cible', 'severite', 'plage', 'fix', 'date', 'motif', 'echeance']) {
      assert.ok(String(e[champ] ?? '').trim(), `entrée ${e.paquet} sans ${champ}`)
    }
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `entrée ${e.paquet} : date non ISO`)
    assert.ok(['racine', 'server'].includes(e.cible), `entrée ${e.paquet} : cible inconnue`)
    assert.ok(Array.isArray(e.via) && Array.isArray(e.viaPaquets), `entrée ${e.paquet} : via/viaPaquets absents`)
    assert.ok(e.via.length + e.viaPaquets.length > 0, `entrée ${e.paquet} : ni advisory ni paquet porteur — rien ne la relie à un rapport`)
  }
})
