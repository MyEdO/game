// `rendreEtat` (scripts/docs/build-dossiers-de-chapitre.mjs, #2290) : chaque entrée d'une fiche est rendue
// couverte (porteur et paquet), écartée (motif) ou non couverte, avec ses compteurs par fiche et par famille.
//   node --test scripts/docs/build-dossiers-de-chapitre.test.mjs  (chaîné dans `npm run test:docs`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { rendreEtat, rendre } from './build-dossiers-de-chapitre.mjs'
import { FAMILLES_DE_DOSSIER } from '../../src/data/source/dossier.ts'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const vide = tableTotale(FAMILLES_DE_DOSSIER, () => [])
const BEAT = { statut: 'obligatoire', preuveDuStatut: 'p', mediasCandidats: ['dialogue'], ref: ['EDO 01 l.1'] }
const FICHE = {
  chemin: 'docs/dossiers/EDO/01.json',
  abbr: 'EDO',
  nn: '01',
  fiche: {
    ...vide,
    lecture: { date: '2026-10-05', commit: 'a'.repeat(40) },
    beats: [{ id: 'b1', titre: 'La route', ...BEAT }, { id: 'b2', titre: 'Le relais', ...BEAT }, { id: 'b3', titre: 'La nuit', ...BEAT }],
    pnj: [{ id: 'pnj1', nom: 'Gustav', role: 'r', motivation: 'm', ref: ['EDO 01 l.2'] }],
  },
}
const PAQUETS = [{
  paquet: 'diligence/diligence-projet.json',
  lu: {
    couvertures: [
      { entree: 'EDO-01#pnj1', porteur: { kind: 'presetPnj', id: 'edo-gustav' } },
      { entree: 'EDO-01#b1', porteur: { kind: 'entite', id: 'coffre', sceneId: 'la-diligence' } },
    ],
    ecartes: [{ entree: 'EDO-01#b2', motif: 'Résumé en narration.' }],
  },
}]

test('chaque entrée porte son statut et ses preuves ; les compteurs suivent, par fiche et par famille', () => {
  const md = rendreEtat([FICHE], PAQUETS)
  assert.ok(md.includes('| [EDO-01](#edo-01) | 4 | 2 | 1 | 1 |'), 'synthèse par fiche')
  assert.ok(md.includes('| Beats | 3 | 1 | 1 | 1 |'), 'compte de la famille Beats')
  assert.ok(md.includes('| PNJ | 1 | 1 | 0 | 0 |'), 'compte de la famille PNJ')
  assert.ok(md.includes('- `EDO-01#b1` La route — **couverte** : entité `coffre` (scène `la-diligence`), `diligence/diligence-projet.json`'))
  assert.ok(md.includes('- `EDO-01#b2` Le relais — **écartée** : écartée par `diligence/diligence-projet.json` : Résumé en narration.'))
  assert.ok(md.includes('- `EDO-01#b3` La nuit — **non couverte**\n'))
  assert.ok(md.includes('- `EDO-01#pnj1` Gustav — **couverte** : PNJ `edo-gustav`, `diligence/diligence-projet.json`'))
  assert.ok(!md.includes('Secrets'), 'une famille vide ne se rend pas')
})

test('sans paquet, toute entrée est non couverte — jamais une faute', () => {
  assert.ok(rendreEtat([FICHE], []).includes('| [EDO-01](#edo-01) | 4 | 0 | 0 | 4 |'))
})

test('`rendre()` : la cible pure unique, rendue depuis les fiches commitées et les projets livrés', () => {
  const cibles = rendre()
  assert.deepEqual([...cibles.keys()], ['docs/dossiers-de-chapitre.md'])
  assert.match(cibles.get('docs/dossiers-de-chapitre.md'), /GÉNÉRÉ par `node scripts\/docs\/build-dossiers-de-chapitre\.mjs`/)
})
