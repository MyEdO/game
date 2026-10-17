// La forme du stock permanent : une RÈGLE, pas un RÉCIT. Volet PUR (fixtures), plus la mesure de
// l'arbre pour le volet « motif de récit », soldé par le train A de #1728 et gardé à zéro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PLAFONDS_DE_L_INDEX, REGLE_TAILLE_MAX, TAILLE_MAX, corpsDe, defautsDeForme, estNomDeMemoireAdmis, familleDe, raisonDeRefusDeForme,
} from './memoire-forme.mjs'
import { gitDeLArbreReel } from '../test/gitDeBanc.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const entete = '---\nname: x\ndescription: "d"\n---\n'
const fiche = (corps) => `${entete}\n${corps}\n`

test('le périmètre est NOMMÉ : fiches user-*, index, intrus, règles, skills, agents, credo', () => {
  assert.equal(familleDe('.claude/memory/user-x.md'), 'fiche')
  assert.equal(familleDe('.claude/memory/MEMORY.md'), 'index')
  assert.equal(familleDe('.claude/memory/regle-x.md'), 'intrus')
  assert.equal(familleDe('.claude/rules/tests.md'), 'regle')
  assert.equal(familleDe('.claude/rules/sous/x.md'), null)
  assert.equal(familleDe('.claude/skills/creer-une-map/SKILL.md'), 'prose')
  assert.equal(familleDe('.claude/agents/codeur.md'), 'prose')
  assert.equal(familleDe('.claude/credo.md'), 'prose')
  assert.equal(familleDe('docs/architecture.md'), null)
  assert.equal(familleDe('.claude/memory/sous/dossier.md'), null)
})

test('sous `.claude/memory/`, seuls MEMORY.md et une fiche `user-*` sont admis : tout autre nom est refusé, sans liste', () => {
  assert.ok(estNomDeMemoireAdmis('MEMORY.md'))
  assert.ok(estNomDeMemoireAdmis('user-doctrine-x.md'))
  for (const nom of ['consigne-x.md', 'memory.md', 'user.md', 'x-user-y.md']) {
    assert.equal(estNomDeMemoireAdmis(nom), false, nom)
    const [d] = defautsDeForme(`.claude/memory/${nom}`, fiche('règle'))
    assert.equal(d?.quoi, 'fiche hors user-*', nom)
    assert.match(d.detail, /\.claude\/rules\/contexte-agents\.md/)
  }
})

test('le corps exclut le frontmatter, et la ligne rendue est celle du FICHIER', () => {
  const { corps, premiereLigne } = corpsDe(`${entete}\nrègle\n`)
  assert.equal(corps, '\nrègle\n')
  assert.equal(premiereLigne, 5)
  assert.equal(corpsDe('sans frontmatter\n').premiereLigne, 1)
})

test('une fiche dont le CORPS dépasse le plafond est refusée, le plafond et la taille NOMMÉS', () => {
  const [d] = defautsDeForme('.claude/memory/user-x.md', fiche('a'.repeat(TAILLE_MAX + 1)))
  assert.equal(d.quoi, 'fiche trop longue')
  assert.match(d.detail, new RegExp(`${TAILLE_MAX + 3} octets de PROSE \\(citations exclues\\) pour un plafond de ${TAILLE_MAX}`))
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche('a'.repeat(TAILLE_MAX - 3))), [])
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
  const [d] = defautsDeForme('.claude/memory/user-x.md', fiche(ligne))
  assert.equal(d?.quoi, 'fiche trop longue')
})

test('un « jamais refermé ne retire rien de la mesure', () => {
  const [d] = defautsDeForme('.claude/memory/user-x.md', fiche(`« ${'a'.repeat(TAILLE_MAX)}`))
  assert.equal(d?.quoi, 'fiche trop longue')
})

test('le plafond de taille ne juge QUE les fiches : un skill ou un agent long passe', () => {
  assert.deepEqual(defautsDeForme('.claude/skills/a/SKILL.md', fiche('a'.repeat(TAILLE_MAX * 4))), [])
  assert.deepEqual(defautsDeForme('.claude/credo.md', fiche('a'.repeat(TAILLE_MAX * 4))), [])
})

test('une date HORS ligne de citation est refusée, avec sa ligne', () => {
  const [d] = defautsDeForme('.claude/memory/user-x.md', fiche('règle.\nmesure du 2026-09-08 : 12 s'))
  assert.equal(d.quoi, 'date hors citation')
  assert.equal(d.ligne, 7)
})

test('une date SUR une ligne de citation verbatim passe, autant de fois qu’il y a de verbatims', () => {
  const corps = 'Verbatim (2026-07-16) : « a »\n\nVerbatim (2026-09-06) : « b »'
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche(corps)), [])
})

test('une date dans le NOM du fichier ou dans le FRONTMATTER n’est pas jugée (angle mort dit)', () => {
  assert.deepEqual(defautsDeForme('.claude/memory/user-vision-2026-09-06.md', fiche('règle')), [])
  assert.deepEqual(
    defautsDeForme('.claude/memory/user-x.md', '---\nname: x\ndescription: "posé le 2026-09-06"\n---\n\nrègle\n'),
    [],
  )
})

const regle = (corps) => `---\npaths:\n  - "scripts/**"\n---\n\n${corps}\n`

test('une règle .claude/rules/*.md au présent, sous le plafond, avec un verbatim daté, passe', () => {
  const corps = '- Une garde se teste par mutation.\n- Verbatim (2026-09-06) : « une garde se prouve »'
  const texte = regle(corps)
  assert.ok(Buffer.byteLength(texte, 'utf8') <= REGLE_TAILLE_MAX)
  assert.deepEqual(defautsDeForme('.claude/rules/tests.md', texte), [])
  const pile = regle('a'.repeat(REGLE_TAILLE_MAX - Buffer.byteLength(regle(''), 'utf8')))
  assert.equal(Buffer.byteLength(pile, 'utf8'), REGLE_TAILLE_MAX)
  assert.deepEqual(defautsDeForme('.claude/rules/tests.md', pile), [], 'le plafond est inclus')
})

test('une règle dont le FICHIER ENTIER dépasse REGLE_TAILLE_MAX octets est refusée, taille et plafond NOMMÉS', () => {
  const texte = regle('a'.repeat(REGLE_TAILLE_MAX - Buffer.byteLength(regle(''), 'utf8') + 1))
  const [d] = defautsDeForme('.claude/rules/tests.md', texte)
  assert.equal(d?.quoi, 'règle trop longue')
  assert.equal(d.ligne, 1)
  assert.match(d.detail, new RegExp(`${REGLE_TAILLE_MAX + 1} octets pour un plafond de ${REGLE_TAILLE_MAX}`))
})

test('une règle portant une date HORS ligne de citation est refusée, à la ligne du FICHIER', () => {
  const [d] = defautsDeForme('.claude/rules/tests.md', regle('- règle.\n- mesure du 2026-09-08 : 12 s'))
  assert.equal(d?.quoi, 'date hors citation')
  assert.equal(d.ligne, 7)
})

test('une ligne qui cite l’utilisateur sans date est refusée ; datée, ou citation sans attribution, elle passe', () => {
  for (const ligne of ['Verbatim utilisateur : « fais-le »', '**Verbatims** : « a » ; « b »', 'Utilisateur, #12 : « non »']) {
    const [d] = defautsDeForme('.claude/memory/user-x.md', fiche(ligne))
    assert.equal(d?.quoi, 'citation sans date', ligne)
    assert.equal(d.ligne, 6)
  }
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche('Verbatim utilisateur (2026-09-01) : « fais-le »')), [])
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche('Le livre dit : « Test opposé »')), [])
  assert.deepEqual(defautsDeForme('.claude/memory/user-x.md', fiche('un « arbitrage utilisateur » se cite')), [])
})

test('l’index est jugé à ses PLAFONDS DE CHARGEMENT, chacun nommé avec sa mesure', () => {
  const ligne = '- [quand](fiche.md)\n'
  assert.equal(PLAFONDS_DE_L_INDEX.lignes, 10, 'MEMORY.md est un en-tête de ROUTAGE')
  assert.deepEqual(defautsDeForme('.claude/memory/MEMORY.md', ligne.repeat(PLAFONDS_DE_L_INDEX.lignes)), [])
  assert.deepEqual(defautsDeForme('.claude/memory/MEMORY.md', ligne.repeat(PLAFONDS_DE_L_INDEX.lignes).replace(/\n/g, '\r\n')), [])
  const [lignes] = defautsDeForme('.claude/memory/MEMORY.md', ligne.repeat(PLAFONDS_DE_L_INDEX.lignes + 1))
  assert.equal(lignes.quoi, 'index hors plafond')
  assert.match(lignes.detail, new RegExp(`^${PLAFONDS_DE_L_INDEX.lignes + 1} lignes pour un plafond de ${PLAFONDS_DE_L_INDEX.lignes}`))
  const [caracteres] = defautsDeForme('.claude/memory/MEMORY.md', `${'é'.repeat(PLAFONDS_DE_L_INDEX.caracteres + 1)}\n`)
  assert.match(caracteres.detail, / caracteres pour un plafond de /)
  const unites = defautsDeForme('.claude/memory/MEMORY.md', `${'é'.repeat(PLAFONDS_DE_L_INDEX.octets)}\n`).map((d) => d.detail.split(' ')[1])
  assert.deepEqual(unites, ['octets', 'caracteres'], 'un é compte deux octets et un caractère')
})

test('chaque motif de RÉCIT est refusé, dans une fiche comme dans un skill, un agent ou le credo', () => {
  const cas = ['vécu #254', 'mesuré le 8 septembre', 'précédent : la fausse piste', 'audit 2026-07', 'session du 3 août']
  for (const phrase of cas) {
    for (const chemin of ['.claude/memory/user-x.md', '.claude/rules/tests.md', '.claude/skills/a/SKILL.md', '.claude/agents/codeur.md', '.claude/credo.md']) {
      const defauts = defautsDeForme(chemin, fiche(phrase)).filter((d) => d.quoi === 'motif de récit')
      assert.equal(defauts.length, 1, `${chemin} — ${phrase}`)
    }
  }
})

test('le refus NOMME chaque site en fichier:ligne, et se tait quand il n’y a rien', () => {
  assert.equal(raisonDeRefusDeForme([]), null)
  assert.equal(raisonDeRefusDeForme([{ chemin: 'a.md', defauts: [] }]), null)
  const msg = raisonDeRefusDeForme([{ chemin: '.claude/memory/user-x.md', defauts: [{ ligne: 7, quoi: 'motif de récit', detail: 'd' }] }])
  assert.match(msg, /\.claude\/memory\/user-x\.md:7 \[motif de récit\]/)
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

test('ARBRE RÉEL : `.claude/memory/` ne porte que MEMORY.md, de routage, et des fiches `user-*`', () => {
  const chemins = gitDeLArbreReel(RACINE)('ls-files', '--cached', '--others', '--exclude-standard', '.claude/memory')
    .split('\n').filter(Boolean)
  assert.ok(chemins.includes('.claude/memory/MEMORY.md'), `index absent : ${chemins.length} chemin(s)`)
  const defauts = chemins.filter((c) => ['intrus', 'index'].includes(familleDe(c)))
    .flatMap((c) => defautsDeForme(c, readFileSync(join(RACINE, c), 'utf8')).map((d) => `${c}:${d.ligne} [${d.quoi}]`))
  assert.deepEqual(defauts, [])
})

test('AUCUNE date hors citation ne subsiste dans le stock permanent de cet arbre', () => {
  const fichiers = gitDeLArbreReel(RACINE)('ls-files', '.claude/memory', '.claude/rules')
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

test('AUCUNE règle .claude/rules/*.md ne dépasse REGLE_TAILLE_MAX octets dans cet arbre', () => {
  const fichiers = gitDeLArbreReel(RACINE)('ls-files', '.claude/rules')
    .split('\n').filter(Boolean).filter((c) => familleDe(c) === 'regle')
  assert.ok(fichiers.length > 0, `périmètre vide ou illisible : ${fichiers.length} fichier(s)`)
  const trop = fichiers.flatMap((c) => defautsDeForme(c, readFileSync(join(RACINE, c), 'utf8'))
    .filter((d) => d.quoi === 'règle trop longue')
    .map((d) => `${c}:${d.ligne} ${d.detail}`))
  assert.deepEqual(trop, [])
})

test('AUCUNE ligne CITATION_DE_L_UTILISATEUR sans date dans le stock permanent de cet arbre', () => {
  const fichiers = gitDeLArbreReel(RACINE)('ls-files', '.claude/memory', '.claude/rules')
    .split('\n').filter(Boolean).filter((c) => ['fiche', 'regle'].includes(familleDe(c)))
  assert.ok(fichiers.length > 0, `périmètre vide ou illisible : ${fichiers.length} fichier(s)`)
  const sansDate = fichiers.flatMap((c) => defautsDeForme(c, readFileSync(join(RACINE, c), 'utf8'))
    .filter((d) => d.quoi === 'citation sans date')
    .map((d) => `${c}:${d.ligne}`))
  assert.deepEqual(sansDate, [])
})

test('l’index de cet arbre tient dans ses plafonds de chargement', () => {
  const index = '.claude/memory/MEMORY.md'
  assert.deepEqual(defautsDeForme(index, readFileSync(join(RACINE, index), 'utf8')).map((d) => d.detail), [])
})
