// Banc du VÉRIFICATEUR de tri (#1887, lot 8) : un livre FIXTURE pour chaque refus, l'adresse dérivée et
// le score ; sur le CRB RÉEL, l'invariant de l'adresse dérivée des preuves du rappel (les comptes
// s'impriment) ; la garde de fuite sur la consigne livrée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { livreDuReleve, preparerLivre } from './releve.mjs'
import { CONSIGNE_DE_TRI, replier, sectionsDuPaquet } from './paquet.mjs'
import { RAPPEL, adresseDeLaPreuve, fuitesDeLaConsigne, score, verifier } from './tri.mjs'
import { estErreur, fragmentBlocs, intervalleDe, parseChapitre, resoudreAdresse } from '../../src/data/source/decoupe.ts'

const chapitre = (fichier, lignes) => ({ fichier, parse: parseChapitre(lignes.join('\n')) })
const FIXTURE = preparerLivre({
  book: 'fixture',
  langue: 'VO',
  chapitres: [
    chapitre('01 - Rules.md', [
      '# <span id="page-9-0" data-folio="10"></span>**Poisons**', '',
      'A poison harms whoever drinks it.', '',
      '**Lethal** poison kills within the hour.', '',
      'A poison harms whoever drinks it.', '',
      '# **Combat**', '', 'Strike first. A coated blade carries poison into the wound.', '',
      '# **Healing**', '', 'A healer may draw out the poison with a Heal Test.',
    ]),
  ],
  indexMd: null,
  horsRegle: () => false,
  plages: [],
})
const TERMES = ['poison']
const SECTIONS = sectionsDuPaquet(FIXTURE, TERMES)
const [POISONS, COMBAT, HEALING] = ['01 l.3', '01 l.11', '01 l.15']
const chapitreFixture = FIXTURE.indexe.chapitres.get('01 - Rules.md')
/** Un bloc de la section Poisons de la fixture (`BlocDuFil`). */
const bloc = (idx) => ({ sec: 'poisons', secOcc: 1, idx })

const valide = [
  { ref: POISONS, role: 'définit', preuve: 'Lethal poison kills within the hour.' },
  { ref: COMBAT, role: 'déclenche', preuve: 'A coated blade carries poison into the wound.' },
  { ref: HEALING, role: 'hors-système', raison: 'ignorée' },
]
const refusDe = (verdict) => verifier(FIXTURE, SECTIONS, verdict).refus.map(({ refus, ligne, ref, blocs, lignes }) => ({ refus, ligne, ref, blocs, lignes }))
const sans = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

test('#1887 : le paquet de la fixture porte les trois sections attendues', () => {
  assert.deepEqual(SECTIONS.map((it) => `${it.ref} ${it.titre}`), [`${POISONS} Poisons`, `${COMBAT} Combat`, `${HEALING} Healing`])
})

test('#1887 : un verdict juste ne rend aucun refus ; l’adresse est DÉRIVÉE de la preuve (aligner, emphase comprise), jamais lue du verdict', () => {
  const faux = { book: 'fixture', ch: '01', parts: [{ kind: 'blocs', sec: 'poisons', secOcc: 1, b0: 0, b1: 0, sum: '0000000000000000' }] }
  const { lignes, refus } = verifier(FIXTURE, SECTIONS, [{ ...valide[0], adresse: faux }, ...valide.slice(1)])
  assert.deepEqual(refus, [])
  const [poisons, combat, healing] = lignes
  assert.deepEqual(healing, { ref: HEALING, role: 'hors-système' })
  assert.deepEqual([poisons.adresse.parts[0].b0, poisons.adresse.parts[0].b1], [1, 1], 'le bloc où s’aligne la preuve, pas celui du verdict')
  const r = resoudreAdresse(chapitreFixture, poisons.adresse)
  assert.equal(estErreur(r) ? r.error : r.md, '**Lethal** poison kills within the hour.')
  assert.equal(combat.adresse.parts[0].sec, 'combat')
})

test('#1887 : refus `ref-hors-paquet`, avec sa ligne', () => {
  assert.deepEqual(refusDe([...valide, { ref: '99 l.1', role: 'définit', preuve: 'x' }]).map(sans), [{ refus: 'ref-hors-paquet', ligne: 3 }])
})

test('#1887 : refus `section-sans-verdict`, avec sa section', () => {
  assert.deepEqual(refusDe(valide.slice(0, 2)).map(sans), [{ refus: 'section-sans-verdict', ref: HEALING }])
})

test('#1887 : refus `hors-systeme-non-exclusif`, avec ses lignes', () => {
  assert.deepEqual(refusDe([...valide, { ref: COMBAT, role: 'hors-système' }]).map(sans), [{ refus: 'hors-systeme-non-exclusif', ref: COMBAT, lignes: [1, 3] }])
})

test('#1887 : refus `role-inconnu`, avec sa ligne', () => {
  assert.deepEqual(refusDe([...valide, { ref: COMBAT, role: 'variante', preuve: 'A coated blade carries poison into the wound.' }]).map(sans), [{ refus: 'role-inconnu', ligne: 3 }])
})

test('#1887 : refus `preuve-introuvable` — preuve absente de sa section, ou d’une autre section', () => {
  assert.deepEqual(refusDe([...valide, { ref: COMBAT, role: 'modifie', preuve: 'A healer may draw out the poison with a Heal Test.' }]).map(sans), [{ refus: 'preuve-introuvable', ligne: 3, blocs: [] }])
})

test('#1887 : refus `preuve-ambigue` — la même phrase à deux blocs de sa section, blocs nommés', () => {
  assert.deepEqual(refusDe([...valide, { ref: POISONS, role: 'modifie', preuve: 'A poison harms whoever drinks it.' }]).map(sans), [{ refus: 'preuve-ambigue', ligne: 3, blocs: [bloc(0), bloc(2)] }])
})

test('#1887 : refus `preuve-introuvable` — une preuve qui coupe un mot n’est pas recopiée mot pour mot (bornes de mot)', () => {
  assert.deepEqual(refusDe([...valide, { ref: COMBAT, role: 'modifie', preuve: 'oiso' }]).map(sans), [{ refus: 'preuve-introuvable', ligne: 3, blocs: [] }])
  assert.deepEqual(refusDe([...valide, { ref: COMBAT, role: 'modifie', preuve: 'blade carries poi' }]).map(sans), [{ refus: 'preuve-introuvable', ligne: 3, blocs: [] }])
})

test('#1887 : refus `preuve-introuvable` — une preuve qui ne touche que la LÉGENDE d’une table ne localise rien (`couvertes` nul)', () => {
  const livre = preparerLivre({
    book: 'fixture-legende',
    langue: 'VO',
    chapitres: [chapitre('01 - Rules.md', [
      '# **Poisons**', '',
      '**Poison Table**', '',
      '| Poison | Effect |', '|---|---|', '| Lethal poison | Death |',
    ])],
    indexMd: null,
    horsRegle: () => false,
    plages: [],
  })
  const [it] = sectionsDuPaquet(livre, TERMES)
  assert.deepEqual(adresseDeLaPreuve(livre, it, 'Poison Table'), { refus: 'preuve-introuvable', blocs: [] })
  assert.equal(adresseDeLaPreuve(livre, it, 'Lethal poison').adresse?.parts[0].b0, 1)
})

test('#1887 : refus `preuve-sans-terme` — la section nomme un terme, la preuve aucun', () => {
  assert.deepEqual(refusDe([...valide, { ref: POISONS, role: 'modifie', preuve: 'kills within the hour' }]).map(sans), [{ refus: 'preuve-sans-terme', ligne: 3, blocs: [bloc(1)] }])
})

test('#1887 : une section du paquet en INTERVALLE — la preuve se cherche sur toute sa couverture, section de fin comprise', () => {
  const intervalle = intervalleDe(chapitreFixture, bloc(0), { sec: 'combat', secOcc: 1, idx: 0 })
  const it = { ...SECTIONS[0], adresse: { ...SECTIONS[0].adresse, parts: [intervalle] } }
  const d = adresseDeLaPreuve(FIXTURE, it, 'A coated blade carries poison into the wound.')
  assert.deepEqual(d.adresse?.parts, [fragmentBlocs(chapitreFixture, { sec: 'combat', secOcc: 1, b0: 0, b1: 0 })])
})

test('#1887 : `replier` — une section incluse dans un INTERVALLE à plusieurs sections s’y replie, origines comprises', () => {
  const copie = (it, adresse = it.adresse) => ({ ...it, adresse, origines: it.origines.map((o) => ({ ...o })) })
  const [poisons, combat, healing] = SECTIONS
  const intervalle = intervalleDe(chapitreFixture, bloc(0), { sec: 'combat', secOcc: 1, idx: 0 })
  const hote = copie(poisons, { ...poisons.adresse, parts: [intervalle] })
  const gardes = replier(FIXTURE, [hote, copie(combat), copie(healing)])
  assert.deepEqual(gardes.map((it) => it.ref), [POISONS, HEALING])
  assert.deepEqual(hote.origines, [...poisons.origines, ...combat.origines.filter((o) => !poisons.origines.some((h) => h.origine === o.origine && h.terme === o.terme))])
})

test('#1887 : score — tout retenu, tout rejeté : la matrice et les cas nommés', () => {
  const systeme = { id: 'fixture', attendus: [{ ref: POISONS, titre: 'Poisons', role: 'définit' }], ecartees: [{ ref: COMBAT, titre: 'Combat', raison: 'r' }] }
  const roles = (role) => verifier(FIXTURE, SECTIONS, SECTIONS.map((it) => ({ ref: it.ref, role }))).roles
  const tout = score(SECTIONS, roles('modifie'), systeme)
  assert.deepEqual(tout.matrice, { attendue: { retenue: 1, rejetee: 0 }, ecartee: { retenue: 1, rejetee: 0 }, nonEtiquetee: { retenue: 1, rejetee: 0 } })
  assert.deepEqual(tout.accordDeRole, { accord: 0, attenduesRetenues: 1 })
  assert.deepEqual(tout.cas, {
    attendusRejetes: [],
    ecarteesRetenues: [`${COMBAT} Combat`],
    nonEtiqueteesRetenues: [{ section: `${HEALING} Healing`, roles: ['modifie'] }],
    rolesEnDesaccord: [{ section: `${POISONS} Poisons`, rappel: 'définit', agent: ['modifie'] }],
    attendusHorsPaquet: [],
  })
  const rien = score(SECTIONS, roles('hors-système'), systeme)
  assert.deepEqual(rien.matrice, { attendue: { retenue: 0, rejetee: 1 }, ecartee: { retenue: 0, rejetee: 1 }, nonEtiquetee: { retenue: 0, rejetee: 1 } })
  assert.deepEqual(rien.cas, { attendusRejetes: [`${POISONS} Poisons`], ecarteesRetenues: [], nonEtiqueteesRetenues: [], rolesEnDesaccord: [], attendusHorsPaquet: [] })
})

const RAPPEL_JSON = JSON.parse(readFileSync(RAPPEL, 'utf8'))

test('#1887 : garde de fuite — une consigne qui recopie une preuve du rappel est refusée ; `tri-consigne.md` passe', () => {
  const preuve = RAPPEL_JSON.systemes.poison.attendus[0].preuve
  const fuites = fuitesDeLaConsigne(`Exemple : ${preuve}`, RAPPEL_JSON)
  assert.ok(fuites.length > 0 && fuites.every((f) => f.systeme === 'poison' && f.champ === 'attendus[].preuve' && f.ref === RAPPEL_JSON.systemes.poison.attendus[0].ref))
  assert.deepEqual(fuitesDeLaConsigne(readFileSync(CONSIGNE_DE_TRI, 'utf8'), RAPPEL_JSON), [])
})

test('#1887 : garde de fuite — un titre d’écartée de moins de six mots recopié dans la consigne est refusé', () => {
  const courte = Object.entries(RAPPEL_JSON.systemes).flatMap(([systeme, s]) => s.ecartees.map((e) => ({ systeme, ...e }))).find((e) => e.titre.trim().split(/\s+/).length < 6)
  const fuites = fuitesDeLaConsigne(`${readFileSync(CONSIGNE_DE_TRI, 'utf8')}\nExemple de section hors-système : ${courte.titre}.`, RAPPEL_JSON)
  assert.ok(fuites.some((f) => f.champ === 'ecartees[].titre' && f.ref === courte.ref && f.systeme === courte.systeme), JSON.stringify(fuites))
})

// S5 du juge de design (lot 8) : sur les preuves du rappel, emphase Markdown retirée (ce qu'un agent
// recopie), chaque preuve dérive une adresse UNIQUE qui résout, ou un refus `preuve-ambigue` nommé.
const CRB = livreDuReleve('core-rulebook-5e')
const sansEmphase = (s) => s.replace(/\*\*|\*|_/g, '')

test('#1887 : CRB — chaque preuve du rappel dérive une adresse de bloc qui résout, ou un refus `preuve-ambigue` nommé', (t) => {
  const bilan = { adressees: 0, ambigues: [] }
  for (const [id, { termes, attendus }] of Object.entries(RAPPEL_JSON.systemes)) {
    const sections = new Map(sectionsDuPaquet(CRB, termes).map((it) => [it.ref, it]))
    for (const a of attendus) {
      const it = sections.get(a.ref)
      assert.ok(it, `${id} ${a.ref} : hors du paquet`)
      const d = adresseDeLaPreuve(CRB, it, sansEmphase(a.preuve))
      if (d.adresse) {
        const r = resoudreAdresse(CRB.indexe.chapitres.get(it.fichier), d.adresse)
        assert.ok(!estErreur(r), `${id} ${a.ref} : l'adresse dérivée ne résout pas`)
        bilan.adressees++
      } else {
        assert.equal(d.refus, 'preuve-ambigue', `${id} ${a.ref} : ${d.refus}`)
        assert.ok(d.blocs.length > 1)
        bilan.ambigues.push(`${id} ${a.ref} blocs ${d.blocs.map((b) => `§${b.sec}#${b.secOcc}:${b.idx}`).join(',')}`)
      }
    }
  }
  t.diagnostic(`adresse dérivée : ${bilan.adressees} ; preuve-ambigue : ${bilan.ambigues.length} ${JSON.stringify(bilan.ambigues)}`)
})

test('#1887 : CRB — une preuve DÉGÉNÉRÉE (« e », morceau de mot « nves ») ne dérive aucune adresse', (t) => {
  const refus = {}
  for (const { termes } of Object.values(RAPPEL_JSON.systemes)) {
    for (const it of sectionsDuPaquet(CRB, termes)) {
      for (const preuve of ['e', 'nves']) {
        const d = adresseDeLaPreuve(CRB, it, preuve)
        assert.ok(!d.adresse, `${it.ref} : « ${preuve} » dérive une adresse`)
        refus[`${preuve} ${d.refus}`] = (refus[`${preuve} ${d.refus}`] ?? 0) + 1
      }
    }
  }
  t.diagnostic(JSON.stringify(refus))
})
