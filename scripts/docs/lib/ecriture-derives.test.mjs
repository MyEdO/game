// Contrat de l'APERÇU des divergences de CORPS (#1709) et du lanceur des dérivés (#1801) :
// un rouge de fraîcheur NOMME les lignes divergentes des deux côtés au lieu de dire « PÉRIMÉ » et rien
// d'autre.
//   node --test scripts/docs/lib/ecriture-derives.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apercuDivergences, estUnDocMarkdown } from './ecriture-derives.mjs'

const LANCEUR = fileURLToPath(new URL('./jouer-generateur.mjs', import.meta.url))

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte.
const doc = (nom) => ['docs', `${nom}.md`].join('/')

const A = 'a\nb\nc'

test('apercuDivergences : doc ABSENT du disque, le geste qui le produit est nommé', () => {
  assert.equal(apercuDivergences(A, null), 'le doc est ABSENT du disque — npm run docs:build le produit')
})

test('apercuDivergences : corps IDENTIQUES, aucun aperçu', () => {
  assert.equal(apercuDivergences(A, A), '')
  assert.equal(apercuDivergences('a', 'a'), '')
})

test('apercuDivergences : ligne qui DIVERGE, nommée puis rendue des DEUX côtés', () => {
  assert.equal(
    apercuDivergences(A, 'a\nX\nc'),
    'ligne 2 — disque : "X" / régénéré : "b"\nl.2\n  disque : "X"\n  régénéré : "b"',
  )
})

test('apercuDivergences : disque PRÉFIXE du régénéré — la ligne MANQUE, jamais « undefined »', () => {
  assert.equal(
    apercuDivergences(A, 'a\nb'),
    'ligne 3 MANQUE au disque : "c"\nl.3\n  disque : <absente>\n  régénéré : "c"',
  )
})

test('apercuDivergences : régénéré PRÉFIXE du disque — la ligne est EN TROP, jamais « ligne 0 »', () => {
  assert.equal(
    apercuDivergences('a\nb', A),
    'ligne 3 EN TROP au disque : "c"\nl.3\n  disque : "c"\n  régénéré : <absente>',
  )
})

test('apercuDivergences : toutes les lignes divergentes des deux côtés, le reste COMPTÉ', () => {
  assert.equal(
    apercuDivergences('a\nb\nc', 'a\nX\nY'),
    'ligne 2 — disque : "X" / régénéré : "b"\n' +
      'l.2\n  disque : "X"\n  régénéré : "b"\n' +
      'l.3\n  disque : "Y"\n  régénéré : "c"',
  )
  assert.equal(
    apercuDivergences('x\nx\nx', 'y\ny\ny', 2),
    'ligne 1 — disque : "y" / régénéré : "x"\n' +
      'l.1\n  disque : "y"\n  régénéré : "x"\n' +
      'l.2\n  disque : "y"\n  régénéré : "x"\n' +
      '… et 1 autre(s) ligne(s) divergente(s)',
  )
})

test('apercuDivergences : une ligne longue est coupée AU MOT sous 240 caractères (`coupeAuMot`), jamais dans un mot', () => {
  const apercu = apercuDivergences('mot '.repeat(100).trimEnd(), 'a')
  assert.ok(apercu.includes(`"${'mot '.repeat(59)}mot…"`), apercu)
  assert.ok(!apercu.includes('mot '.repeat(61)))
  assert.ok(apercuDivergences('z'.repeat(300), 'a').includes(`"${'z'.repeat(300)}"`), 'un mot seul se rend entier')
})

/**
 * Lance un producteur témoin dans un PROCESSUS À PART. REND `{ status, stderr,
 * stdout, contenu }` — `contenu` = le fichier cible APRÈS l'appel.
 */
function jouerPrimitive({ surDisque, out, check, injecte = false, cheminRendu = 'cible.md', lien, usurperJournal = false, usurperMode = false }) {
  const dossier = mkdtempSync(path.join(tmpdir(), 'ecrire-ou-verifier-'))
  try {
    const cible = path.join(dossier, 'cible.md')
    if (lien) symlinkSync(lien, path.join(dossier, 'documents'), 'junction')
    if (surDisque !== null) {
      writeFileSync(cible, surDisque)
      utimesSync(cible, 50, 50)
    }
    const code = [
      ...(usurperMode ? ["process.argv.splice(process.argv.indexOf('--check'), 1)"] : []),
      'export function* produire() {',
      ...(usurperJournal ? ["  process.env.WFRP_CIBLES_RENDUES = 'cible.md'"] : []),
      `  const aJour = yield { out: ${JSON.stringify(out)}, path: ${JSON.stringify(cheminRendu)}, staleMsg: 'PÉRIMÉ-témoin', rerunMsg: 'RELANCER-témoin', okMsg: 'OK-témoin', writeMsg: 'ÉCRIT-témoin' }`,
      "  console.log(`aJour=${aJour}`)",
      '}',
    ].join('\n')
    const script = 'produire.mjs'
    writeFileSync(path.join(dossier, script), code)
    const cibleDeclaree = lien ? 'documents/cible.md' : 'cible.md'
    const declaration = injecte
      ? { script, targets: [], injecte: [cibleDeclaree] }
      : { script, targets: [cibleDeclaree] }
    const args = [LANCEUR, JSON.stringify(declaration), ...(check ? ['--check'] : [])]
    const r = spawnSync(process.execPath, args, { cwd: dossier, encoding: 'utf8' })
    const stat = statSync(cible, { throwIfNoEntry: false })
    return {
      status: r.status, stderr: r.stderr, stdout: r.stdout,
      contenu: stat ? readFileSync(cible, 'utf8') : null, mtime: stat?.mtimeMs,
      cheminRenduExiste: existsSync(path.resolve(dossier, cheminRendu)),
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

test('lanceur --check : corps à jour → vert, rien d’écrit', () => {
  const r = jouerPrimitive({ surDisque: '# doc\n', out: '# doc\n', check: true })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /OK-témoin\naJour=true/)
  assert.equal(r.contenu, '# doc\n')
  assert.equal(r.mtime, 50_000)
})

test('lanceur --check : corps PÉRIMÉ → sortie 1, divergence NOMMÉE, rien d’écrit', () => {
  const r = jouerPrimitive({ surDisque: '# vieux\n', out: '# neuf\n', check: true })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /PÉRIMÉ-témoin\nligne 1 — disque : "# vieux" \/ régénéré : "# neuf"[\s\S]*RELANCER-témoin/)
  assert.match(r.stdout, /aJour=false/, 'la primitive REND la main : le processus peut encore parler')
  assert.equal(r.contenu, '# vieux\n', '`--check` n’écrit jamais')
  assert.equal(r.mtime, 50_000)
})

test('lanceur --check : cible ABSENTE → corps périmé, le geste qui la produit est nommé', () => {
  const r = jouerPrimitive({ surDisque: null, out: '# neuf\n', check: true })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /ABSENT du disque — npm run docs:build le produit/)
  assert.equal(r.contenu, null)
})

test('lanceur en écriture : écrit le rendu tel quel, rend l’état d’avant', () => {
  const r = jouerPrimitive({ surDisque: '# vieux\n', out: '# neuf\n', check: false })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /ÉCRIT-témoin\naJour=false/)
  assert.equal(r.contenu, '# neuf\n')
  const absente = jouerPrimitive({ surDisque: null, out: '# neuf\n', check: false })
  assert.match(absente.stdout, /aJour=false/, 'une cible absente n’était pas à jour')
  assert.equal(absente.contenu, '# neuf\n')
})

test('une injection suit les mêmes modes que les cibles entières', () => {
  const enPlace = '# notes de départ\n'
  const rendu = enPlace + 'bloc injecté\n'
  const check = jouerPrimitive({ surDisque: enPlace, out: rendu, check: true, injecte: true })
  assert.equal(check.status, 1, check.stderr)
  assert.equal(check.contenu, enPlace)
  assert.equal(check.mtime, 50_000)
  const ecriture = jouerPrimitive({ surDisque: enPlace, out: rendu, check: false, injecte: true })
  assert.equal(ecriture.status, 0, ecriture.stderr)
  assert.equal(ecriture.contenu, rendu)
  const identique = jouerPrimitive({ surDisque: rendu, out: rendu, check: false, injecte: true })
  assert.equal(identique.mtime, 50_000)
})

test('un producteur ne peut rediriger le journal vers sa cible en vérification', () => {
  const enPlace = '# corps\n'
  const r = jouerPrimitive({ surDisque: enPlace, out: enPlace, check: true, usurperJournal: true })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.contenu, enPlace)
  assert.equal(r.mtime, 50_000)
})

test('le mode de vérification est fixé avant le chargement du producteur', () => {
  const enPlace = '# ancien\n'
  const r = jouerPrimitive({ surDisque: enPlace, out: '# nouveau\n', check: true, usurperMode: true })
  assert.equal(r.status, 1, r.stderr)
  assert.match(r.stderr, /PÉRIMÉ-témoin/)
  assert.equal(r.contenu, enPlace)
  assert.equal(r.mtime, 50_000)
})

test('le lanceur refuse une sortie étrangère à la déclaration du producteur', () => {
  const r = jouerPrimitive({ surDisque: null, out: 'hors déclaration', check: false, cheminRendu: 'autre.md' })
  assert.equal(r.status, 1, r.stderr)
  assert.match(r.stderr, /produire\.mjs : cible hors de targets\/injecte : autre\.md/)
  assert.equal(r.cheminRenduExiste, false)
})

test('le lanceur refuse une cible déclarée dont la jonction sort de l’arbre', () => {
  const dehors = mkdtempSync(path.join(tmpdir(), 'hors-racine-'))
  try {
    const r = jouerPrimitive({ surDisque: null, out: 'hors racine', check: false, cheminRendu: 'documents/cible.md', lien: dehors })
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stderr, /cible hors de targets\/injecte : documents\/cible\.md/)
    assert.equal(existsSync(path.join(dehors, 'cible.md')), false)
  } finally {
    rmSync(dehors, { recursive: true, force: true })
  }
})

test('estUnDocMarkdown : un doc Markdown, jamais une cible de code', () => {
  assert.equal(estUnDocMarkdown(doc('x')), true)
  assert.equal(estUnDocMarkdown('docs/raw/**/catalogue-*.md'), true)
  assert.equal(estUnDocMarkdown('src/x/_registry.generated.ts'), false)
})
