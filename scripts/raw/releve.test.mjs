// Banc du RELEVÉ et du PAQUET (#1887, lot 7) : un livre FIXTURE pour chaque origine et chaque
// compartiment. Sur le CRB RÉEL : `scripts/corpus/raw/releve.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORIGINES, nomme, preparerLivre, releve } from './releve.mjs'
import { ELISION, paquet, sectionsDuPaquet, taillesDuPaquet } from './paquet.mjs'
import { parseChapitre } from '../../src/data/source/decoupe.ts'

const chapitre = (fichier, lignes) => ({ fichier, parse: parseChapitre(lignes.join('\n')) })

const ancre = (folio) => `<span id="page-${folio - 1}-0" data-folio="${folio}"></span>`

const FIXTURE = preparerLivre({
  book: 'fixture',
  langue: 'VO',
  chapitres: [
    chapitre('01 - Rules.md', [
      `# ${ancre(10)}**Poisons**`, '', 'A poison harms whoever drinks it, unless a cure is found in time.', '',
      '**POISON TABLE**', '', '| d10 | Poison |', '|---|---|', '| 1 | Hemlock draught of the marshes |', '',
      '# **Poison Lore**', '',
      '# **Combat**', '', 'When a foe is struck by a coated blade, roll for the poison effect at once.',
    ]),
    chapitre('02 - Advice.md', [
      `# ${ancre(11)}**Healing**`, '', 'Treat the wounded as described under Combat (see page 10) before resting.',
    ]),
    chapitre('03 - Talents.md', [
      `# ${ancre(12)}**Venom Resistance**`, '', 'You shrug off poison and every other venom a foe may brew.',
    ]),
    chapitre('04 - Credits.md', [
      `# ${ancre(13)}**Credits**`, '', 'Thanks to the poison tasters of the studio for their patient work.',
    ]),
  ],
  indexMd: [
    '| A                  | P                    |',
    '|--------------------|----------------------|',
    '| Poisons 10         | Credits for Poison 13 |',
    '| Poison Rules 11    | Poison Darts 99      |',
    '| Poison Table 10    |                      |',
  ].join('\n'),
  horsRegle: (n) => n === 4,
  plages: [{ ch: 3, motif: 'talents' }],
})

const resume = (it) => `${it.ref} ${it.titre} [${it.origines.join(', ')}]`

test('#1887 : `nomme` — terme dans un titre et dans un texte, par mots, au singulier, ponctuation et emphase aplaties', () => {
  assert.equal(nomme(FIXTURE, 'Selection of Poisons', 'Poisons'), true)
  assert.equal(nomme(FIXTURE, 'POISONED', 'poison'), false)
  assert.equal(nomme(FIXTURE, 'You gain +1 *Advantage*. Then lose it.', 'advantage'), true)
  assert.equal(nomme(FIXTURE, 'Disadvantaged foes', 'advantage'), false)
})

test('#1887 : les quatre origines, l’entité, l’ambigu et les introuvables, chacun nommé', () => {
  const r = releve(FIXTURE, 'poison')
  assert.deepEqual(r.regle.map(resume), [
    '01 l.3 Poisons [index, titre, mention]',
    '01 l.5 Poisons [index]',
    '01 l.15 Combat [mention]',
    '02 l.3 Healing [renvoi]',
  ])
  assert.deepEqual(r.entite.map(resume), ['03 l.3 Venom Resistance [mention]'])
  assert.deepEqual(r.ambigus.map((a) => [a.entree.terme, a.page, a.niveau, a.candidats]), [['Poison Rules', 11, 'page', ['02 - Advice.md § Healing']]])
  assert.deepEqual(r.introuvables.map((i) => [i.origine, i.entree?.terme ?? i.section, i.erreur]), [
    ['index', 'Credits for Poison', 'hors-regle'],
    ['index', 'Poison Darts', 'introuvable'],
    ['titre', '01 - Rules.md § Poison Lore', 'bornes-hors-limites'],
  ])
})

test('#1887 : une section `horsRegle` n’est jamais relevée, même quand son texte nomme le terme', () => {
  const r = releve(FIXTURE, 'poison')
  assert.equal([...r.regle, ...r.entite].some((it) => it.fichier === '04 - Credits.md'), false)
})

test('#1887 : `origines` restreint le relevé ; `renvoi` ne part que des sections relevées par les autres', () => {
  const sansMention = releve(FIXTURE, 'poison', { origines: ORIGINES.filter((o) => o !== 'mention') })
  assert.deepEqual(sansMention.regle.map(resume), ['01 l.3 Poisons [index, titre]', '01 l.5 Poisons [index]'])
  assert.deepEqual(sansMention.entite, [])
})

test('#1887 : le paquet porte le texte RÉSOLU des sections de règle, une seule fois, les entités en déclencheurs, puis les ambigus et introuvables', () => {
  const md = paquet(FIXTURE, ['poison'])
  assert.equal(md, paquet(FIXTURE, ['poison']), 'le paquet est déterministe')
  assert.match(md, /### 01 l\.3 — Poisons \[index « poison », titre « poison », mention « poison »\]\n\nA poison harms whoever drinks it/)
  assert.doesNotMatch(md, /### 01 l\.5/, 'la table relevée par l’index se replie sur sa section entière')
  assert.equal(md.split('Hemlock draught').length, 2, 'le texte de la table n’est porté qu’une fois')
  assert.match(md, /### 02 l\.3 — Healing \[renvoi « poison »\]\n\nTreat the wounded as described under Combat \(see page 10\)/)
  assert.match(md, /- 03 l\.3 — Venom Resistance \[mention « poison »\]/)
  assert.doesNotMatch(md, /You shrug off/)
  assert.match(md, /- « Poison Rules » p\.11 \(page, terme « poison »\) : 02 - Advice\.md § Healing/)
  assert.match(md, /- 01 - Rules\.md § Poison Lore \(titre, terme « poison »\) : bornes-hors-limites/)
  const t = taillesDuPaquet(FIXTURE, ['poison'])
  assert.deepEqual([t.sections, t.paquet], [3, md.length])
  assert.ok(t.parOrigine.mention > 0 && t.parOrigine.renvoi > 0)
})

// Forme `tri` (lot 8) : une section FORTE (titre) entière, une section à origine `mention` seule réduite
// à ses phrases et à ses lignes de table qui nomment le terme, jointes par `[…]` là où du texte est élidé,
// par leur blanc d'origine sinon.
const FIXTURE_TRI = preparerLivre({
  book: 'fixture-tri',
  langue: 'VO',
  chapitres: [
    chapitre('01 - Rules.md', [
      `# ${ancre(10)}**Poisons**`, '', 'A poison harms whoever drinks it. It acts at once.', '',
      '# **Combat**', '', 'Strike first. A coated blade carries poison into the wound. The poison burns. Then roll.', '',
      'Poison lingers in the blood.', '',
      '| Foe | Effect |', '|---|---|', '| Spider | Bite |', '| Snake | Poison fang |', '| Wolf | Bite |',
    ]),
  ],
  indexMd: null,
  horsRegle: () => false,
  plages: [],
})

test('#1887 : forme `tri` — `## Règle` seule, la section forte entière, la section `mention` réduite à ses passages, sans séparatrice ni adresse', () => {
  const md = paquet(FIXTURE_TRI, ['poison'], { forme: 'tri' })
  const elision = `\n\n${ELISION}\n\n`
  assert.equal(md, [
    '# Paquet — fixture-tri — « poison »', '', '## Règle (2)', '',
    '### 01 l.3 — Poisons [titre « poison », mention « poison »]', '', 'A poison harms whoever drinks it. It acts at once.', '',
    '### 01 l.7 — Combat [mention « poison »]', '',
    ['A coated blade carries poison into the wound. The poison burns', 'Poison lingers in the blood.\n\n| Foe | Effect |', '| Snake | Poison fang |'].join(elision), '', '',
  ].join('\n'))
  for (const it of sectionsDuPaquet(FIXTURE_TRI, ['poison'])) assert.ok(!md.includes(it.adresse.parts[0].sum), `${it.ref} : aucune adresse dans le paquet`)
  const t = taillesDuPaquet(FIXTURE_TRI, ['poison'], { forme: 'tri' })
  assert.deepEqual([t.paquet, t.sections, t.parForme.fortes.sections, t.parForme.reduites.sections, t.parForme.reduites.passages], [md.length, 2, 1, 1, 4])
})
