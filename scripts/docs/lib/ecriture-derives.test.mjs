// Contrat de l'APERÇU des divergences de CORPS (#1709) et de la primitive `ecrireOuVerifier` (#1801) :
// un rouge de fraîcheur NOMME les lignes divergentes des deux côtés au lieu de dire « PÉRIMÉ » et rien
// d'autre.
//   node --test scripts/docs/lib/ecriture-derives.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { apercuDivergences, CODE_CORPS_PERIME, estUnDocMarkdown } from './ecriture-derives.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

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
 * `ecrireOuVerifier` joué dans un PROCESSUS À PART : il déclare au code de sortie, que le banc ne
 * doit pas porter. `avant` est le code posé AVANT l'appel (un cliquet). REND `{ status, stderr,
 * stdout, contenu }` — `contenu` = le fichier cible APRÈS l'appel.
 */
function jouerPrimitive({ surDisque, out, check, avant = 0 }) {
  const dossier = mkdtempSync(path.join(tmpdir(), 'ecrire-ou-verifier-'))
  try {
    const cible = path.join(dossier, 'cible.md')
    if (surDisque !== null) writeFileSync(cible, surDisque)
    const code = [
      `import { ecrireOuVerifier } from ${JSON.stringify(pathToFileURL(path.join(ICI, 'ecriture-derives.mjs')).href)}`,
      avant ? `process.exitCode = ${avant}` : '',
      `const aJour = ecrireOuVerifier({ out: ${JSON.stringify(out)}, path: ${JSON.stringify(cible)}, check: ${check}, staleMsg: 'PÉRIMÉ-témoin', rerunMsg: 'RELANCER-témoin', okMsg: 'OK-témoin', writeMsg: 'ÉCRIT-témoin' })`,
      "console.log(`aJour=${aJour}`)",
    ].join('\n')
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' })
    return { status: r.status, stderr: r.stderr, stdout: r.stdout, contenu: existsSync(cible) ? readFileSync(cible, 'utf8') : null }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

test('ecrireOuVerifier --check : corps à jour → vert, rien d’écrit', () => {
  const r = jouerPrimitive({ surDisque: '# doc\n', out: '# doc\n', check: true })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /OK-témoin\naJour=true/)
  assert.equal(r.contenu, '# doc\n')
})

test('ecrireOuVerifier --check : corps PÉRIMÉ → bit CODE_CORPS_PERIME, divergence NOMMÉE, rien d’écrit', () => {
  const r = jouerPrimitive({ surDisque: '# vieux\n', out: '# neuf\n', check: true })
  assert.equal(r.status, CODE_CORPS_PERIME)
  assert.match(r.stderr, /PÉRIMÉ-témoin\nligne 1 — disque : "# vieux" \/ régénéré : "# neuf"[\s\S]*RELANCER-témoin/)
  assert.match(r.stdout, /aJour=false/, 'la primitive REND la main : le processus peut encore parler')
  assert.equal(r.contenu, '# vieux\n', '`--check` n’écrit jamais')
})

test('ecrireOuVerifier --check : cible ABSENTE → corps périmé, le geste qui la produit est nommé', () => {
  const r = jouerPrimitive({ surDisque: null, out: '# neuf\n', check: true })
  assert.equal(r.status, CODE_CORPS_PERIME)
  assert.match(r.stderr, /ABSENT du disque — npm run docs:build le produit/)
  assert.equal(r.contenu, null)
})

test('ecrireOuVerifier --check : un cliquet posé AVANT garde son bit — les deux rouges se lisent au code', () => {
  const r = jouerPrimitive({ surDisque: '# vieux\n', out: '# neuf\n', check: true, avant: 1 })
  assert.equal(r.status, 1 | CODE_CORPS_PERIME)
})

test('ecrireOuVerifier en écriture : écrit le rendu tel quel, rend l’état d’avant', () => {
  const r = jouerPrimitive({ surDisque: '# vieux\n', out: '# neuf\n', check: false })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /ÉCRIT-témoin\naJour=false/)
  assert.equal(r.contenu, '# neuf\n')
  const absente = jouerPrimitive({ surDisque: null, out: '# neuf\n', check: false })
  assert.match(absente.stdout, /aJour=false/, 'une cible absente n’était pas à jour')
  assert.equal(absente.contenu, '# neuf\n')
})

test('estUnDocMarkdown : un doc Markdown, jamais une cible de code', () => {
  assert.equal(estUnDocMarkdown(doc('x')), true)
  assert.equal(estUnDocMarkdown('docs/raw/**/catalogue-*.md'), true)
  assert.equal(estUnDocMarkdown('src/x/_registry.generated.ts'), false)
})
