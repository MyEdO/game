// La forme du stock permanent : une RÈGLE, pas un RÉCIT. Volet PUR (fixtures), plus la mesure de
// l'arbre pour le volet « motif de récit », soldé par le train A de #1728 et gardé à zéro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TAILLE_MAX, corpsDe, defautsDeForme, familleDe, raisonDeRefusDeForme } from './memoire-forme.mjs'
import { gitDeLArbreReel } from '../test/gitDeBanc.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const entete = '---\nname: x\ndescription: "d"\n---\n'
const fiche = (corps) => `${entete}\n${corps}\n`

test('le périmètre est NOMMÉ : fiches, skills, agents, credo — et MEMORY.md en est exclu', () => {
  assert.equal(familleDe('.claude/memory/game-x.md'), 'fiche')
  assert.equal(familleDe('.claude/memory/MEMORY.md'), null)
  assert.equal(familleDe('.claude/skills/creer-une-map/SKILL.md'), 'prose')
  assert.equal(familleDe('.claude/agents/codeur.md'), 'prose')
  assert.equal(familleDe('.claude/credo.md'), 'prose')
  assert.equal(familleDe('docs/architecture.md'), null)
  assert.equal(familleDe('.claude/memory/sous/dossier.md'), null)
})

test('le corps exclut le frontmatter, et la ligne rendue est celle du FICHIER', () => {
  const { corps, premiereLigne } = corpsDe(`${entete}\nrègle\n`)
  assert.equal(corps, '\nrègle\n')
  assert.equal(premiereLigne, 5)
  assert.equal(corpsDe('sans frontmatter\n').premiereLigne, 1)
})

test('une fiche dont le CORPS dépasse le plafond est refusée, le plafond et la taille NOMMÉS', () => {
  const [d] = defautsDeForme('.claude/memory/game-x.md', fiche('a'.repeat(TAILLE_MAX + 1)))
  assert.equal(d.quoi, 'fiche trop longue')
  assert.match(d.detail, new RegExp(`${TAILLE_MAX + 3} octets de PROSE \\(citations exclues\\) pour un plafond de ${TAILLE_MAX}`))
  assert.deepEqual(defautsDeForme('.claude/memory/game-x.md', fiche('a'.repeat(TAILLE_MAX - 3))), [])
})

test('le texte CITÉ ne compte pas dans le plafond — un verbatim ne se tronque pas, même sur plusieurs lignes', () => {
  const verbatim = `Verbatim (2026-09-06) : « ${'mot '.repeat(250)}\n${'mot '.repeat(250)}»`
  const corps = `${'a'.repeat(TAILLE_MAX - 40)}\n${verbatim}`
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche(corps)), [], 'la citation gonflait la mesure')
  // La PROSE, elle, reste bornée : quelques octets de plus autour du verbatim et la fiche est refusée.
  const [d] = defautsDeForme('.claude/memory/user-x.md', fiche(`${corps}\n${'a'.repeat(40)}`))
  assert.equal(d.quoi, 'fiche trop longue')
})

test('un mot cité n’exempte PAS la ligne qui le porte : la prose autour compte', () => {
  const ligne = `${'a'.repeat(TAILLE_MAX)} « x » ${'a'.repeat(10)}`
  const [d] = defautsDeForme('.claude/memory/game-x.md', fiche(ligne))
  assert.equal(d?.quoi, 'fiche trop longue')
})

test('un « jamais refermé ne retire rien de la mesure', () => {
  const [d] = defautsDeForme('.claude/memory/game-x.md', fiche(`« ${'a'.repeat(TAILLE_MAX)}`))
  assert.equal(d?.quoi, 'fiche trop longue')
})

test('le plafond de taille ne juge QUE les fiches : un skill ou un agent long passe', () => {
  assert.deepEqual(defautsDeForme('.claude/skills/a/SKILL.md', fiche('a'.repeat(TAILLE_MAX * 4))), [])
  assert.deepEqual(defautsDeForme('.claude/credo.md', fiche('a'.repeat(TAILLE_MAX * 4))), [])
})

test('une date HORS ligne de citation est refusée, avec sa ligne', () => {
  const [d] = defautsDeForme('.claude/memory/game-x.md', fiche('règle.\nmesure du 2026-09-08 : 12 s'))
  assert.equal(d.quoi, 'date hors citation')
  assert.equal(d.ligne, 7)
})

test('une date SUR une ligne de citation verbatim passe, autant de fois qu’il y a de verbatims', () => {
  const corps = 'Verbatim (2026-07-16) : « a »\n\nVerbatim (2026-09-06) : « b »'
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche(corps)), [])
  assert.deepEqual(defautsDeForme('.claude/memory/feedback-x.md', fiche(corps)), [])
})

test('une date dans le NOM du fichier ou dans le FRONTMATTER n’est pas jugée (angle mort dit)', () => {
  assert.deepEqual(defautsDeForme('.claude/memory/user-vision-2026-09-06.md', fiche('règle')), [])
  assert.deepEqual(
    defautsDeForme('.claude/memory/game-x.md', '---\nname: x\ndescription: "posé le 2026-09-06"\n---\n\nrègle\n'),
    [],
  )
})

test('chaque motif de RÉCIT est refusé, dans une fiche comme dans un skill, un agent ou le credo', () => {
  const cas = ['vécu #254', 'mesuré le 8 septembre', 'précédent : la fausse piste', 'audit 2026-07', 'session du 3 août']
  for (const phrase of cas) {
    for (const chemin of ['.claude/memory/game-x.md', '.claude/skills/a/SKILL.md', '.claude/agents/codeur.md', '.claude/credo.md']) {
      const defauts = defautsDeForme(chemin, fiche(phrase)).filter((d) => d.quoi === 'motif de récit')
      assert.equal(defauts.length, 1, `${chemin} — ${phrase}`)
    }
  }
})

test('le refus NOMME chaque site en fichier:ligne, et se tait quand il n’y a rien', () => {
  assert.equal(raisonDeRefusDeForme([]), null)
  assert.equal(raisonDeRefusDeForme([{ chemin: 'a.md', defauts: [] }]), null)
  const msg = raisonDeRefusDeForme([{ chemin: '.claude/memory/game-x.md', defauts: [{ ligne: 7, quoi: 'motif de récit', detail: 'd' }] }])
  assert.match(msg, /\.claude\/memory\/game-x\.md:7 \[motif de récit\]/)
})

test('AUCUN motif de récit ne subsiste dans le stock permanent de cet arbre', () => {
  const fichiers = gitDeLArbreReel(RACINE)('ls-files', '.claude/')
    .split('\n').filter(Boolean).filter(familleDe)
  assert.ok(fichiers.length > 0, `périmètre vide ou illisible : ${fichiers.length} fichier(s)`)
  const recits = fichiers.flatMap((c) => defautsDeForme(c, readFileSync(join(RACINE, c), 'utf8'))
    .filter((d) => d.quoi === 'motif de récit')
    .map((d) => `${c}:${d.ligne} ${d.detail}`))
  assert.deepEqual(recits, [])
})

test('AUCUNE date hors citation ne subsiste dans le stock permanent de cet arbre', () => {
  const fichiers = gitDeLArbreReel(RACINE)('ls-files', '.claude/memory')
    .split('\n').filter(Boolean).filter(familleDe)
  assert.ok(fichiers.length > 0, `périmètre vide ou illisible : ${fichiers.length} fichier(s)`)
  const dates = fichiers.flatMap((c) => defautsDeForme(c, readFileSync(join(RACINE, c), 'utf8'))
    .filter((d) => d.quoi === 'date hors citation')
    .map((d) => `${c}:${d.ligne}`))
  assert.deepEqual(dates, [])
})

test('AUCUNE fiche ne dépasse le plafond de PROSE dans le stock permanent de cet arbre', () => {
  const fichiers = gitDeLArbreReel(RACINE)('ls-files', '.claude/memory')
    .split('\n').filter(Boolean).filter((c) => familleDe(c) === 'fiche')
  assert.ok(fichiers.length > 0, `périmètre vide ou illisible : ${fichiers.length} fichier(s)`)
  const trop = fichiers.flatMap((c) => defautsDeForme(c, readFileSync(join(RACINE, c), 'utf8'))
    .filter((d) => d.quoi === 'fiche trop longue')
    .map((d) => `${c}:${d.ligne} ${d.detail}`))
  assert.deepEqual(trop, [])
})
