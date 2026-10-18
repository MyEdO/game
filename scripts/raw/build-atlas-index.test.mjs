// #2801 : rapport pur `docs/raw/atlas.generated.md`, cœurs et domaines issus de leurs registres.
// Registre INJECTÉ, à cœurs et sigles INVENTÉS : un banc qui prendrait le registre réel jugerait
// l'état du jour, pas le RÉGIME (« un cœur de plus au registre est une ligne de plus »).
import test from 'node:test'
import assert from 'node:assert/strict'
import { avecAtlasFixture } from './atlasFixture.mjs'
import {
  RAPPORT, NOM_INDEX, rendre, ancreDuCoeur,
  lignesDesCoeurs, lignesDesDomaines,
} from './build-atlas-index.mjs'

const COEUR_A = 'coeur-alpha'
const COEUR_B = 'coeur-beta'
/** Domaines de fixture : cœurs, clés et titres INVENTÉS — le banc dit le RÉGIME, pas l'état du jour. */
const DOMAINES = {
  [COEUR_A]: [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-deux', titre: 'Second Domaine de Fixture' },
  ],
  [COEUR_B]: [{ cle: 'domaine-trois', titre: 'Troisieme Domaine de Fixture' }],
}
/** Un cœur dont la carte est ENTIÈRE avant sa première fiche : une aire extraite, une à extraire. */
const DOMAINES_A_EXTRAIRE = {
  [COEUR_A]: [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-cadre', titre: 'Domaine Cadre de Fixture', ticket: '#4242' },
  ],
}
/** Registre de fixture : deux cœurs inventés, un supplément SANS cœur, un livre non extrait. */
const REGISTRE = [
  { abbr: 'XAA', dir: 'Livre Alpha', coeur: COEUR_A },
  { abbr: 'XAB', dir: 'Alpha bis', coeur: COEUR_A },
  { abbr: 'XBA', dir: 'Livre Beta', coeur: COEUR_B },
  { abbr: 'XSU', dir: 'Supplement' },
  { abbr: 'XNE', coeur: COEUR_B },
]

test('un cœur à dossier rend un LIEN vers son index, et ses livres de cœur', () => {
  avecAtlasFixture(
    { '00-index.md': '# Alpha\n', 'combat.md': '# Combat\n' },
    (rawDir) => {
      const lignes = lignesDesCoeurs(rawDir, REGISTRE)
      assert.equal(lignes.length, 2)
      assert.equal(lignes[0], `- [\`${COEUR_A}/\`](${COEUR_A}/00-index.md) — livre(s) de cœur : XAA, XAB`)
    },
    { coeur: COEUR_A },
  )
})

test('un cœur du registre SANS dossier est DIT, jamais tu', () => {
  avecAtlasFixture(
    { '00-index.md': '# Alpha\n' },
    (rawDir) => {
      const lignes = lignesDesCoeurs(rawDir, REGISTRE)
      assert.equal(lignes[1], `- \`${COEUR_B}/\` — dossier à créer — livre(s) de cœur : XBA`)
    },
    { coeur: COEUR_A },
  )
})

test('les sigles viennent du registre REÇU, jamais du registre global', () => {
  avecAtlasFixture(
    { '00-index.md': '# Alpha\n' },
    (rawDir) => {
      const bloc = lignesDesCoeurs(rawDir, REGISTRE).join('\n')
      // Le livre non EXTRAIT (sans `dir`) n'est pas adressable par l'outillage : il ne s'affiche pas.
      assert.equal(bloc.includes('XNE'), false)
      // Un supplément (sans `coeur`) n'est le livre de cœur de personne.
      assert.equal(bloc.includes('XSU'), false)
    },
    { coeur: COEUR_A },
  )
})

test('le bloc des DOMAINES lie chaque CLÉ à sa fiche, et porte son titre en affichage', () => {
  assert.deepEqual(lignesDesDomaines(DOMAINES[COEUR_A]), [
    '| Domaine | Titre |',
    '|---|---|',
    '| [`domaine-un`](domaine-un.md) | Premier Domaine de Fixture |',
    '| [`domaine-deux`](domaine-deux.md) | Second Domaine de Fixture |',
  ])
})

test('le bloc des DOMAINES : une aire à EXTRAIRE se rend SANS lien et DIT son ticket', () => {
  const lignes = lignesDesDomaines(DOMAINES_A_EXTRAIRE[COEUR_A])
  assert.deepEqual(lignes, [
    '| Domaine | Titre |',
    '|---|---|',
    '| [`domaine-un`](domaine-un.md) | Premier Domaine de Fixture |',
    '| `domaine-cadre` | Domaine Cadre de Fixture — aire cadrée, fiche à extraire (#4242) |',
  ])
  // Un lien vers une fiche absente serait MORT : la clé à extraire n'en porte AUCUN.
  assert.equal(/\(domaine-cadre\.md\)/.test(lignes.join('\n')), false)
})

test('rapport pur : domaine neuf, liens depuis la cible et aucune lecture de sa sortie', () => {
  avecAtlasFixture({ [NOM_INDEX]: '# Alpha\n', 'domaine-un.md': '# Un\n' }, (rawDir) => {
    const rendu = rendre(rawDir, REGISTRE, DOMAINES)
    assert.deepEqual([...rendu.keys()], [RAPPORT])
    const texte = rendu.get(RAPPORT)
    assert.match(texte, /coeur-alpha\/domaine-un\.md/)
    assert.match(texte, /coeur-alpha\/domaine-deux\.md/)
    assert.equal(texte.includes('## Domaines coeur-beta'), false)
    assert.equal(ancreDuCoeur(COEUR_A), 'domaines-coeur-alpha')
    assert.equal(texte.includes('# Alpha'), false)
  }, { coeur: COEUR_A })
})
