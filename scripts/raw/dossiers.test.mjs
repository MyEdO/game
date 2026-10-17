// Garde des fiches de dossier de chapitre (#2290, node --test, `npm run test:raw`) : chaque fiche
// commitée `docs/dossiers/<ABBR>/<NN>.json` est au schéma `ficheDeDossier` (`src/data/source/dossier.ts`),
// ses `id` sont uniques, son `<ABBR>` est un sigle de `src/data/books.json` et son chapitre a un fichier
// (`chapterFile`), chaque élément de `ref` est UNE réf entière à la graphie `refRe`, tout `l.<ligne>` d'un champ
// texte appartient à une telle réf entière ; bornes et ligne non aveugle
// relèvent des scanners CITANTS (`scripts/raw/lib/fichiersCitants.mjs`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chargerDossiers } from './lib/dossiers.mjs'
import { chapterFile, livreDuSigle } from './_lib.mjs'
import { ficheDeDossier, idDEntree, ID_D_ENTREE } from '../../src/data/source/dossier.ts'

const DOSSIERS = chargerDossiers()

test('chaque fiche commitée est au schéma, sigle et chapitre résolus', () => {
  const fautes = DOSSIERS.flatMap(({ chemin, abbr, nn }) => [
    livreDuSigle(abbr) ? null : `${chemin} : « ${abbr} » n'est le sigle d'aucun livre de src/data/books.json`,
    livreDuSigle(abbr) && !chapterFile(abbr, nn) ? `${chemin} : ${abbr} ${nn} n'a aucun fichier chapitre (chapterFile)` : null,
  ]).filter(Boolean)
  assert.deepEqual(fautes, [])
})

test('ids globaux uniques par fiche, au format `<ABBR>-<NN>#<id>`', () => {
  for (const { chemin, ids } of DOSSIERS) {
    assert.equal(new Set(ids).size, ids.length, `${chemin} : id en double`)
    for (const id of ids) assert.match(id, ID_D_ENTREE, `${chemin} : ${id}`)
  }
})

test('un id en double dans la fiche est refusé', () => {
  const [{ fiche }] = DOSSIERS
  const doublon = { ...fiche, beats: [...fiche.beats, { ...fiche.beats[0] }] }
  const lu = ficheDeDossier.safeParse(doublon)
  assert.equal(lu.success, false)
  assert.ok(lu.error.issues.some((i) => /en double/.test(i.message)))
})

test('un champ dérivable (livre, chapitre) ou une famille inconnue est refusé', () => {
  const [{ fiche }] = DOSSIERS
  for (const intrus of [{ livre: 'X' }, { chapitre: '01' }, { besoins: [] }]) {
    assert.equal(ficheDeDossier.safeParse({ ...fiche, ...intrus }).success, false, JSON.stringify(intrus))
  }
})

test('le chargeur refuse un fichier hors de `<ABBR>/<NN>.json`', () => {
  const racine = mkdtempSync(join(tmpdir(), 'dossiers-'))
  try {
    mkdirSync(join(racine, 'EDO'))
    writeFileSync(join(racine, 'EDO', 'chapitre-un.json'), '{}')
    assert.throws(() => chargerDossiers(racine), /<ABBR>\/<NN>\.json/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Charge une fiche commitée dont la première entrée de `beats` porte `champs`, posée sous une racine jetable. */
function chargerAvecBeat(champs) {
  const racine = mkdtempSync(join(tmpdir(), 'dossiers-'))
  try {
    const [{ fiche }] = DOSSIERS
    mkdirSync(join(racine, 'EDO'))
    writeFileSync(join(racine, 'EDO', '01.json'), JSON.stringify({ ...fiche, beats: [{ ...fiche.beats[0], ...champs }, ...fiche.beats.slice(1)] }))
    return chargerDossiers(racine)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

test('une réf entière à la graphie refRe est chargée', () => {
  const [{ fiche }] = chargerAvecBeat({ ref: ['EDO 01 l.9-13', 'EDOC 08 l.48', 'EDO 01 l.298/315'] })
  assert.deepEqual(fiche.beats[0].ref, ['EDO 01 l.9-13', 'EDOC 08 l.48', 'EDO 01 l.298/315'])
})

test('une réf hors graphie, préfixée, suivie d’un reste ou en liste est refusée, fiche, famille, id et réf nommés', () => {
  for (const faute of ['Compagnon Voyager (08) l.48-84', 'La Main Pourpre l.483', 'l.150', 'voir EDO 01 l.7', 'EDO 01 l.7 (encadré)', 'EDO 01 l.7, l.9', 'EDO 01 l.7 ; EDOC 08 l.48']) {
    assert.throws(() => chargerAvecBeat({ ref: ['EDO 01 l.9', faute] }), (err) => {
      assert.match(err.message, /EDO\/01\.json : réf hors graphie/)
      assert.ok(err.message.includes(`beats b1 « ${faute} »`), err.message)
      assert.ok(!err.message.includes('« EDO 01 l.9 »'), err.message)
      return true
    }, faute)
  }
})

test('une prose dont chaque `l.<ligne>` appartient à une réf entière est chargée', () => {
  const preuveDuStatut = 'Non qualifié (EDO 01 l.11, EDOC 08 l.48-84) ; voir aussi EDO 01 l.298/315, renvoi à la p.147.'
  const [{ fiche }] = chargerAvecBeat({ preuveDuStatut })
  assert.equal(fiche.beats[0].preuveDuStatut, preuveDuStatut)
})

test('une `l.<ligne>` nue en prose est refusée, fiche, famille, id, champ et extrait nommés', () => {
  for (const [champ, texte, extrait] of [
    ['preuveDuStatut', 'Non qualifié (l.11).', '(l.11'],
    ['preuveDuStatut', 'Joueurs novices (EDO 01 l.17, l.194).', 'EDO 01 l.17, l.194'],
    ['preuveDuStatut', 'Péager (Bronze 5, profil complet l.42-54).', 'profil complet l.42'],
    ['titre', 'Scène l.7', 'Scène l.7'],
  ]) {
    assert.throws(() => chargerAvecBeat({ [champ]: texte }), (err) => {
      assert.match(err.message, /EDO\/01\.json : ligne nue en prose/)
      assert.ok(err.message.includes(`beats b1 ${champ} « …`) && err.message.includes(`${extrait} »`), err.message)
      return true
    }, texte)
  }
})

test('identifiant global : écriture, et format `ID_D_ENTREE`', () => {
  assert.equal(idDEntree('EDO', '01', 'b3'), 'EDO-01#b3')
  assert.equal(idDEntree('ADE I', '04', 'lieu12'), 'ADE I-04#lieu12')
  assert.match(idDEntree('ADE I', '04', 'lieu12'), ID_D_ENTREE)
  assert.doesNotMatch('EDO-01', ID_D_ENTREE)
})
