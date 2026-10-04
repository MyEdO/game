// Banc du RELEVÉ et du PAQUET (#1887, lot 7) : un livre FIXTURE pour chaque origine et chaque
// compartiment ; sur le CRB RÉEL, des INVARIANTS (les comptes s'impriment) et le rappel des fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ORIGINES, cleDAdresse, livreDuReleve, nomme, preparerLivre, releve, sortDeLEntree } from './releve.mjs'
import { paquet, releveDesTermes, taillesDuPaquet } from './paquet.mjs'
import { estErreur, graphieDuFichier, parseChapitre, resoudreAdresse } from '../../src/data/source/decoupe.ts'

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

const CRB = livreDuReleve('core-rulebook-5e')
const COMPARTIMENTS = ['regle', 'entite', 'ambigus', 'introuvables']

test('#1887 : CRB — chaque page d’entrée d’index tombe dans UN compartiment connu', (t) => {
  const sorts = {}
  let paires = 0
  for (const e of CRB.index) for (const p of e.pages) {
    paires++
    const s = sortDeLEntree(CRB, e, p)
    sorts[s.sort] = (sorts[s.sort] ?? 0) + 1
    assert.ok(COMPARTIMENTS.includes(s.sort), `${e.terme} p.${p} : sort ${s.sort}`)
    if (s.sort === 'ambigus') assert.ok(s.candidats.length > 0, `${e.terme} p.${p} : un ambigu nomme ses candidats`)
  }
  assert.equal(Object.values(sorts).reduce((a, b) => a + b, 0), paires)
  t.diagnostic(`${CRB.index.length} entrées, ${paires} pages : ${JSON.stringify(sorts)}`)
})

test('#1887 : CRB — relevé de « poison », « ranged », « advantage » : origines connues, réf à la ligne, jamais `horsRegle`', (t) => {
  for (const terme of ['poison', 'ranged', 'advantage']) {
    const r = releve(CRB, terme)
    for (const it of [...r.regle, ...r.entite]) {
      assert.ok(it.origines.length > 0 && it.origines.every((o) => ORIGINES.includes(o)), `${it.ref} : ${it.origines}`)
      assert.equal(it.ref, `${it.adresse.ch} l.${it.ligne}`)
      const [f] = it.adresse.parts
      const rang = CRB.indexe.chapitres.get(it.fichier).sections.findIndex((s) => s.slug === f.sec && s.occ === f.secOcc)
      assert.notEqual(CRB.natures.get(it.fichier)[rang], 'horsRegle', it.ref)
    }
    const par = (liste) => Object.fromEntries(ORIGINES.map((o) => [o, liste.filter((it) => it.origines.includes(o)).length]))
    t.diagnostic(`« ${terme} » : regle ${r.regle.length} ${JSON.stringify(par(r.regle))}, entite ${r.entite.length}, ambigus ${r.ambigus.length}, introuvables ${r.introuvables.length}`)
  }
})

// RAPPEL : `releve-rappel.json` porte, par système, les adresses ATTENDUES qu'un juge a établies au
// Source sous sa `consigne`, sans lancer le relevé. Ensemble POSITIF : la précision s'imprime.
const RAPPEL = JSON.parse(readFileSync(new URL('./releve-rappel.json', import.meta.url), 'utf8'))
const chapitreDe = (livre, ch) => livre.indexe.chapitres.get([...livre.indexe.chapitres.keys()].find((f) => graphieDuFichier(f) === ch))

for (const [id, { termes, attendus }] of Object.entries(RAPPEL.systemes)) {
  test(`#1887 : rappel « ${id} » — chaque adresse attendue se résout et le relevé de ses termes la rend sous \`regle\``, (t) => {
    const perimees = attendus.filter((a) => estErreur(resoudreAdresse(chapitreDe(CRB, a.adresse.ch), a.adresse))).map((a) => `${a.ref} ${a.titre}`)
    assert.deepEqual(perimees, [], `attendu(s) périmé(s) : l'adresse ne se résout plus — le juge la réétablit au Source`)
    const { regle } = releveDesTermes(CRB, termes)
    const rendues = new Set(regle.map((it) => cleDAdresse(it.adresse)))
    const manquantes = attendus.filter((a) => !rendues.has(cleDAdresse(a.adresse))).map((a) => `${a.ref} ${a.titre} — « ${a.preuve} »`)
    assert.deepEqual(manquantes, [], `rappel < 100 % : ${manquantes.length}/${attendus.length} attendue(s) non rendue(s)`)
    t.diagnostic(`précision : ${attendus.length} attendues sur ${regle.length} sections de règle relevées`)
  })
}
