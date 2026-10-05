// Contrat du filigrane d'arbre : la ligne est mesurée sur un DÉPÔT RÉEL jetable (vrais `git`), pas
// sur un double injecté — c'est la sortie de git qui doit être lue juste, y compris quand l'arbre
// porte du travail non committé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { instanceDeDepot } from './depotGabarit.mjs'
import { enteteArbre } from './enteteArbre.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'

/** Dépôt jetable d'un commit, propre. */
function depot() {
  const { racine } = instanceDeDepot({
    fichiers: { 'a.txt': 'a\n' },
    branche: 'principale',
    message: 'sujet du dernier commit',
  })
  return { racine, git: gitDe(racine) }
}

test('arbre PROPRE : sha court, sujet du dernier commit, zéro fichier non committé', () => {
  const { racine, git } = depot()
  try {
    const ligne = enteteArbre(racine)
    const sha = git('rev-parse', '--short', 'HEAD').trim()
    assert.equal(ligne, `arbre ${sha} « sujet du dernier commit » + 0 fichier(s) non committé(s)`)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('arbre SALE : chaque fichier non committé est compté (suivi modifié ET non suivi)', () => {
  const { racine } = depot()
  try {
    writeFileSync(join(racine, 'a.txt'), 'a modifié\n')
    writeFileSync(join(racine, 'b.txt'), 'b\n')
    assert.match(enteteArbre(racine), / \+ 2 fichier\(s\) non committé\(s\)$/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le sujet est BORNÉ à 70 caractères (une ligne de filigrane reste lisible)', () => {
  const { racine, git } = depot()
  try {
    const long = 'x'.repeat(120)
    writeFileSync(join(racine, 'a.txt'), 'encore\n')
    lancerGit(['commit', '-q', '-am', long], { cwd: racine })
    const ligne = enteteArbre(racine)
    assert.ok(ligne.includes(`« ${'x'.repeat(70)} »`), ligne)
    assert.ok(!ligne.includes('x'.repeat(71)), 'le sujet déborde de sa borne')
    assert.ok(ligne.startsWith(`arbre ${git('rev-parse', '--short', 'HEAD').trim()} `))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('les questions du filigrane sont injectables pour la mesure, sans changer la FORME de la ligne', () => {
  const faux = { sales: () => 3, sha: () => 'abc1234', sujet: () => 'un sujet' }
  assert.equal(enteteArbre('/peu-importe', faux), 'arbre abc1234 « un sujet » + 3 fichier(s) non committé(s)')
})

// Le filigrane est imprimé JUSTE AVANT les refus d'un hook : s'il jette, il les emporte avec lui
// (le hook meurt sur un `fatal:` brut, et pas un seul refus nommé n'atteint l'utilisateur).
test('git INDISPONIBLE (hors dépôt) : ligne DÉGRADÉE nommée, jamais une exception', () => {
  const hors = mkdtempSync(join(tmpdir(), 'entete-hors-'))
  try {
    assert.match(enteteArbre(hors), /^arbre \(git indisponible : .*not a git repository/i)
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('une question qui JETTE ne fait pas tomber le filigrane : la panne est DITE', () => {
  const jette = () => { throw new Error('git absent du PATH') }
  const ligne = enteteArbre('/peu-importe', { sales: jette, sha: () => 'abc1234', sujet: () => 'un sujet' })
  assert.equal(ligne, 'arbre (git indisponible : git absent du PATH)')
})
