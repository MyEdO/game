// BANC de l'écrivain du bloc des cœurs de `docs/raw/00-index.md` (#1825) — `npm run test:raw`.
//
// Ce que ce banc tient, et pourquoi : le routeur de l'Atlas est la SEULE page qui dise quels cœurs
// existent. Un bloc qui oublie un cœur du registre, ou qui pointe une page absente, rend un routeur
// qui MENT — et rien d'autre ne le mesure.
// Registre INJECTÉ, à cœurs et sigles INVENTÉS : un banc qui prendrait le registre réel jugerait
// l'état du jour, pas le RÉGIME (« un cœur de plus au registre est une ligne de plus »).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { avecAtlasFixture, coeurDeBanc } from './atlasFixture.mjs'
import { CODE_CORPS_PERIME } from '../docs/lib/empreinte-sources.mjs'
import {
  DEBUT, DEBUT_DOMAINES, FIN, FIN_DOMAINES, INDEX_PATH, NOM_INDEX, blocsDeLAtlas, injecter,
  lignesDesCoeurs, lignesDesDomaines,
} from './build-atlas-index.mjs'

const SCRIPT = fileURLToPath(new URL('./build-atlas-index.mjs', import.meta.url))

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

test('injecter — marqueur manquant : LÈVE, jamais une page réécrite de travers', () => {
  assert.throws(() => injecter('# Atlas\nsans marqueurs\n', ['- x']), /marqueurs/)
  assert.throws(() => injecter(`${FIN}\n${DEBUT}\n`, ['- x']), /introuvables ou invers/)
})

test('injecter — le hors-bloc est INTOUCHÉ, le bloc est remplacé', () => {
  const contenu = `# Atlas\n\navant\n${DEBUT}\n- périmé\n${FIN}\naprès\n`
  assert.equal(injecter(contenu, ['- a', '- b']), `# Atlas\n\navant\n${DEBUT}\n- a\n- b\n${FIN}\naprès\n`)
  // IDEMPOTENT : ré-injecter les mêmes lignes ne bouge plus rien.
  const une = injecter(contenu, ['- a'])
  assert.equal(injecter(une, ['- a']), une)
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

test('blocsDeLAtlas — le routeur racine, puis l’index de CHAQUE cœur à dossier ; rien d’écrit à la main', () => {
  avecAtlasFixture(
    { [NOM_INDEX]: '# Alpha\n', 'domaine-un.md': '# Un\n' },
    (rawDir) => {
      const blocs = blocsDeLAtlas(rawDir, REGISTRE, DOMAINES)
      assert.deepEqual(blocs.map((b) => [b.chemin, b.debut]), [
        [join(rawDir, NOM_INDEX), DEBUT],
        [join(rawDir, COEUR_A, NOM_INDEX), DEBUT_DOMAINES],
      ])
      // Le cœur SANS dossier n'a pas de bloc : il n'a pas de page où l'écrire.
      assert.equal(blocs.some((b) => b.chemin.includes(COEUR_B)), false)
      assert.deepEqual(blocs[1].lignes, lignesDesDomaines(DOMAINES[COEUR_A]))
    },
    { coeur: COEUR_A },
  )
})

test('un index de cœur SANS sa paire de marqueurs : refus d’UNE ligne, jamais une trace de pile', () => {
  const arbre = mkdtempSync(join(tmpdir(), 'atlas-index-refus-'))
  const coeur = coeurDeBanc()
  try {
    mkdirSync(join(arbre, 'docs', 'raw', coeur), { recursive: true })
    writeFileSync(join(arbre, INDEX_PATH), `# Atlas\n\n${DEBUT}\n${FIN}\n`, 'utf8')
    writeFileSync(join(arbre, 'docs', 'raw', coeur, NOM_INDEX), '# Cœur\n\nun index sans marqueurs\n', 'utf8')
    const rendu = spawnSync(process.execPath, [SCRIPT], { cwd: arbre, encoding: 'utf8' })
    assert.equal(rendu.status, 1)
    assert.match(rendu.stderr, /marqueurs/)
    assert.equal(rendu.stderr.trim().split('\n').length, 1, `refus en plusieurs lignes :\n${rendu.stderr}`)
  } finally { rmSync(arbre, { recursive: true, force: true }) }
})

test('--check : un bloc PÉRIMÉ sort en CORPS PÉRIMÉ — au routeur comme à l’index d’un cœur', () => {
  const arbre = mkdtempSync(join(tmpdir(), 'atlas-index-banc-'))
  const coeur = coeurDeBanc()
  try {
    mkdirSync(join(arbre, 'docs', 'raw', coeur), { recursive: true })
    const page = join(arbre, INDEX_PATH)
    const pageDuCoeur = join(arbre, 'docs', 'raw', coeur, NOM_INDEX)
    writeFileSync(page, `# Atlas\n\n${DEBUT}\n- cœur inventé d'une autre époque\n${FIN}\n`, 'utf8')
    writeFileSync(pageDuCoeur, `# Cœur\n\n${DEBUT_DOMAINES}\n| domaine inventé d'une autre époque |\n${FIN_DOMAINES}\n`, 'utf8')
    const jouer = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: arbre, encoding: 'utf8' })
    assert.equal(jouer('--check').status, CODE_CORPS_PERIME)
    assert.equal(jouer().status, 0)
    for (const p of [page, pageDuCoeur]) assert.equal(readFileSync(p, 'utf8').includes("d'une autre époque"), false)
    assert.equal(jouer('--check').status, 0)
  } finally { rmSync(arbre, { recursive: true, force: true }) }
})
