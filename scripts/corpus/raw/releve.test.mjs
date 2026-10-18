// Banc du RELEVÉ et du PAQUET (#1887, lot 7) sur le CRB RÉEL : des INVARIANTS (les comptes
// s'impriment) et le RAPPEL de `releve-rappel.json` ; les livres FIXTURE : `scripts/raw/releve.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ORIGINES, cleDAdresse, livreDuReleve, releve, sortDeLEntree } from '../../raw/releve.mjs'
import { estForte, paquet, passagesDe, releveDesTermes, sectionsDuPaquet, taillesDuPaquet, texteReduit } from '../../raw/paquet.mjs'
import { estErreur, estSeparateur, graphieDuFichier, resoudreAdresse } from '../../../src/data/source/decoupe.ts'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

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
    const par = (liste) => tableTotale(ORIGINES, (o) => liste.filter((it) => it.origines.includes(o)).length)
    t.diagnostic(`« ${terme} » : regle ${r.regle.length} ${JSON.stringify(par(r.regle))}, entite ${r.entite.length}, ambigus ${r.ambigus.length}, introuvables ${r.introuvables.length}`)
  }
})

// RAPPEL : `releve-rappel.json` porte, par système, les adresses ATTENDUES qu'un juge a établies au
// Source sous sa `consigne`, sans lancer le relevé. Ensemble POSITIF : la précision s'imprime.
const RAPPEL = JSON.parse(readFileSync(new URL('../../raw/releve-rappel.json', import.meta.url), 'utf8'))

const chapitreDe = (livre, ch) => livre.indexe.chapitres.get([...livre.indexe.chapitres.keys()].find((f) => graphieDuFichier(f) === ch))

for (const [id, { termes }] of Object.entries(RAPPEL.systemes)) {
  test(`#1887 : CRB, forme \`tri\` de « ${id} » — passages sous-chaînes du texte résolu dans l'ordre, sans séparatrice ; section forte entière ; aucune adresse`, (t) => {
    const md = paquet(CRB, termes, { forme: 'tri' })
    assert.doesNotMatch(md, /^## (Entités|Ambigus|Introuvables)/m)
    for (const it of sectionsDuPaquet(CRB, termes)) {
      const r = resoudreAdresse(chapitreDe(CRB, it.adresse.ch), it.adresse)
      assert.ok(!estErreur(r), it.ref)
      assert.ok(!md.includes(it.adresse.parts[0].sum), `${it.ref} : aucune adresse dans le paquet`)
      if (estForte(it)) {
        assert.ok(md.includes(`\n\n${r.md}\n\n`), `${it.ref} : section forte entière`)
        continue
      }
      const passages = passagesDe(CRB, it)
      assert.ok(passages.length > 0, `${it.ref} : aucun passage`)
      assert.ok(md.includes(`\n\n${texteReduit(CRB, it)}\n\n`), `${it.ref} : passages rendus`)
      let curseur = 0
      for (const p of passages) {
        assert.ok(p.debut >= curseur && r.md.slice(p.debut, p.fin) === p.md, `${it.ref} : « ${p.md.slice(0, 60)} » n'est pas une sous-chaîne du texte résolu, dans l'ordre`)
        curseur = p.fin
        assert.ok(p.md.split('\n').every((l) => !estSeparateur(l)), `${it.ref} : ligne séparatrice dans un passage`)
      }
    }
    t.diagnostic(JSON.stringify(taillesDuPaquet(CRB, termes, { forme: 'tri' })))
  })
}

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
