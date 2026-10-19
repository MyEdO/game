// La GARDE des renvois d'ancre de l'Atlas (#1824) : ce qu'elle voit, et ce qu'elle refuse de rater.
// L'Atlas des cas est JETABLE (`atlasFixture.mjs`) — le banc ne lit jamais `docs/raw/`, et n'y écrit
// rien : sans cet Atlas forgé, un renvoi réparé au dépôt rendrait le banc vert par ABSENCE.
//   node --test scripts/raw/check-ancres.test.mjs   (joué par `npm run test:raw`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { avecAtlasFixture } from './atlasFixture.mjs'
import { pagesAvecAncres, renvoisDAncre, renvoisMorts } from './check-ancres.mjs'

test('clone sans cibles : les rapports rendus en mémoire résolvent leurs liens et remplacent le disque', () => {
  avecAtlasFixture({ 'une.md': '# Une\n\n[état](../implemente.generated.md#topic)\n', '/implemente.generated.md': '# Périmé\n' }, (rawDir) => {
    const rendus = new Map([['implemente.generated.md', '# Rapport\n\n## Topic\n']])
    assert.deepEqual(mortsDe(pagesAvecAncres(rawDir, { rendus })), [])
    assert.equal(pagesAvecAncres(rawDir, { rendus }).get('implemente.generated.md').texte.includes('Périmé'), false)
  })
  avecAtlasFixture({ 'une.md': '# Une\n\n[état](../implemente.generated.md#topic)\n' }, (rawDir) => {
    const rendus = new Map([['implemente.generated.md', '# Rapport\n\n## Topic\n']])
    assert.deepEqual(mortsDe(pagesAvecAncres(rawDir, { rendus })), [])
  })
})

const mortsDe = (pages) => renvoisMorts(pages).map((m) => `${m.page}:${m.ligne} ${m.ecrit}`)

test('renvoisDAncre : les TROIS formes de renvoi sont vues — page courante, sœur, autre cœur', () => {
  avecAtlasFixture(
    {
      'une.md': '# Une\n\n## Un Titre\n\n[ici](#un-titre) · [la sœur](autre.md#autre-titre) · [transverse](../sources.md#un-livre)\n',
      'autre.md': '# Autre\n\n## Autre Titre\n',
      '/sources.md': '# Sources\n',
    },
    (rawDir, coeur) => {
      const pages = pagesAvecAncres(rawDir)
      assert.deepEqual(
        renvoisDAncre(pages).map((r) => [r.ancre, r.vise]),
        [['un-titre', `${coeur}/une.md`], ['autre-titre', `${coeur}/autre.md`], ['un-livre', 'sources.md']],
      )
      // La page transverse EXISTE et ne porte pas cette ancre : c'est le renvoi qui est mort, pas la page.
      assert.deepEqual(mortsDe(pages), [`${coeur}/une.md:5 ../sources.md#un-livre`])
    },
  )
})

test('renvoisMorts : l’ancre d’un HOMONYME non suffixé est morte — le renvoi désignerait la première section', () => {
  avecAtlasFixture(
    { 'une.md': '# Une\n\n## Surprise\n\n### Surprise\n\n[vers la seconde](#surprise-1) · [inventée](#surprise-2)\n' },
    (rawDir, coeur) => assert.deepEqual(mortsDe(pagesAvecAncres(rawDir)), [`${coeur}/une.md:7 #surprise-2`]),
  )
})

test('renvoisMorts : un `id=` HTML est une ancre de la page — les catalogues en posent par folio', () => {
  avecAtlasFixture(
    { 'catalogue-x.md': '# Catalogue\n\n<span id="page-3-0" data-folio="2"></span>\n\n[le folio](#page-3-0) · [aucun](#page-4-0)\n' },
    (rawDir, coeur) => assert.deepEqual(mortsDe(pagesAvecAncres(rawDir)), [`${coeur}/catalogue-x.md:5 #page-4-0`]),
  )
})

test('renvoisMorts : un renvoi écrit dans un BLOC DE CODE est un exemple — la garde ne le juge pas', () => {
  avecAtlasFixture(
    { 'une.md': '# Une\n\n```md\n[exemple](#jamais-ancre)\n```\n' },
    (rawDir) => assert.deepEqual(mortsDe(pagesAvecAncres(rawDir)), []),
  )
})

test('renvoisMorts : l’ancre URL-ENCODÉE se juge décodée — c’est la même ancre', () => {
  avecAtlasFixture(
    { 'une.md': '# Une\n\n## Accès\n\n[encodé](#acc%C3%A8s)\n' },
    (rawDir) => assert.deepEqual(mortsDe(pagesAvecAncres(rawDir)), []),
  )
})
