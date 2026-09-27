// Contrat du DELTA de `docs/.sources-lues.json` (#1679 L2), de l'APERÇU des divergences de CORPS
// (#1709) et de la primitive `ecrireOuVerifier` (#1801) : un rouge de fraîcheur NOMME ce qui a bougé — générateur, champ, chemins d'un côté,
// lignes divergentes des deux côtés de l'autre — au lieu de dire « PÉRIMÉ » et rien d'autre.
//   node --test scripts/docs/lib/empreinte-sources.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  apercuDivergences, avecPied, CODE_CORPS_PERIME, deltaSourcesLues, lirePied, estUnDocMarkdown, retirerPied,
} from './empreinte-sources.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

const entree = (fichiers = [], dossiers = [], cibles = []) => ({ cibles, fichiers, dossiers })

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte.
const doc = (nom) => ['docs', `${nom}.md`].join('/')

test('deltaSourcesLues : deux mesures identiques ne rendent rien', () => {
  const m = { 'scripts/docs/build-systemes.mjs': entree(['src/a.ts', 'src/b.ts'], ['src/data'], ['docs/systemes.md']) }
  assert.deepEqual(deltaSourcesLues(m, structuredClone(m)), [])
})

test('deltaSourcesLues : un fichier AJOUTÉ, un dossier RETIRÉ, nommés par champ', () => {
  const avant = { 'g.mjs': entree(['src/a.ts'], ['src/data', 'src/ui']) }
  const apres = { 'g.mjs': entree(['src/a.ts', 'src/neuf.ts'], ['src/data']) }
  assert.deepEqual(deltaSourcesLues(avant, apres), [
    { generateur: 'g.mjs', champ: 'dossiers', ajoutes: [], retires: ['src/ui'] },
    { generateur: 'g.mjs', champ: 'fichiers', ajoutes: ['src/neuf.ts'], retires: [] },
  ])
})

test('deltaSourcesLues : un générateur absent d\'un côté rend TOUT son champ', () => {
  const avant = { 'parti.mjs': entree(['src/a.ts'], [], [doc('parti')]) }
  const apres = { 'neuf.mjs': entree(['src/b.ts'], ['src/data'], [doc('neuf')]) }
  assert.deepEqual(deltaSourcesLues(avant, apres), [
    { generateur: 'neuf.mjs', champ: 'cibles', ajoutes: [doc('neuf')], retires: [] },
    { generateur: 'neuf.mjs', champ: 'dossiers', ajoutes: ['src/data'], retires: [] },
    { generateur: 'neuf.mjs', champ: 'fichiers', ajoutes: ['src/b.ts'], retires: [] },
    { generateur: 'parti.mjs', champ: 'cibles', ajoutes: [], retires: [doc('parti')] },
    { generateur: 'parti.mjs', champ: 'fichiers', ajoutes: [], retires: ['src/a.ts'] },
  ])
})

test('deltaSourcesLues : ordre des chemins et des générateurs déterministe', () => {
  const avant = { b: entree([]), a: entree(['z.ts']) }
  const apres = { a: entree([]), b: entree(['m.ts', 'a.ts', 'z.ts']) }
  assert.deepEqual(deltaSourcesLues(avant, apres), [
    { generateur: 'a', champ: 'fichiers', ajoutes: [], retires: ['z.ts'] },
    { generateur: 'b', champ: 'fichiers', ajoutes: ['a.ts', 'm.ts', 'z.ts'], retires: [] },
  ])
})

const A = 'a\nb\nc'

test('apercuDivergences : doc committé ABSENT', () => {
  assert.equal(apercuDivergences(A, null), 'le doc committé est ABSENT du dépôt')
})

test('apercuDivergences : corps IDENTIQUES, aucun aperçu', () => {
  assert.equal(apercuDivergences(A, A), '')
  assert.equal(apercuDivergences('a', 'a'), '')
})

test('apercuDivergences : ligne qui DIVERGE, nommée puis rendue des DEUX côtés', () => {
  assert.equal(
    apercuDivergences(A, 'a\nX\nc'),
    'ligne 2 — committé : "X" / régénéré : "b"\nl.2\n  committé : "X"\n  régénéré : "b"',
  )
})

test('apercuDivergences : committé PRÉFIXE du régénéré — la ligne MANQUE, jamais « undefined »', () => {
  assert.equal(
    apercuDivergences(A, 'a\nb'),
    'ligne 3 MANQUE au committé : "c"\nl.3\n  committé : <absente>\n  régénéré : "c"',
  )
})

test('apercuDivergences : régénéré PRÉFIXE du committé — la ligne est EN TROP, jamais « ligne 0 »', () => {
  assert.equal(
    apercuDivergences('a\nb', A),
    'ligne 3 EN TROP au committé : "c"\nl.3\n  committé : "c"\n  régénéré : <absente>',
  )
})

test('apercuDivergences : toutes les lignes divergentes des deux côtés, le reste COMPTÉ', () => {
  assert.equal(
    apercuDivergences('a\nb\nc', 'a\nX\nY'),
    'ligne 2 — committé : "X" / régénéré : "b"\n' +
      'l.2\n  committé : "X"\n  régénéré : "b"\n' +
      'l.3\n  committé : "Y"\n  régénéré : "c"',
  )
  assert.equal(
    apercuDivergences('x\nx\nx', 'y\ny\ny', 2),
    'ligne 1 — committé : "y" / régénéré : "x"\n' +
      'l.1\n  committé : "y"\n  régénéré : "x"\n' +
      'l.2\n  committé : "y"\n  régénéré : "x"\n' +
      '… et 1 autre(s) ligne(s) divergente(s)',
  )
})

test('apercuDivergences : une ligne longue est BORNÉE à 240 caractères', () => {
  const apercu = apercuDivergences('z'.repeat(300), 'a')
  assert.ok(apercu.includes(`${'z'.repeat(240)}…`))
  assert.ok(!apercu.includes('z'.repeat(241)))
})

/**
 * `ecrireOuVerifier` joué dans un PROCESSUS À PART : il déclare au code de sortie, que le banc ne
 * doit pas porter. `avant` est le code posé AVANT l'appel (un cliquet). REND `{ status, stderr,
 * stdout, contenu }` — `contenu` = le fichier cible APRÈS l'appel.
 */
function jouerPrimitive({ committe, out, check, avant = 0 }) {
  const dossier = mkdtempSync(path.join(tmpdir(), 'ecrire-ou-verifier-'))
  try {
    const cible = path.join(dossier, 'cible.md')
    if (committe !== null) writeFileSync(cible, committe)
    const code = [
      `import { ecrireOuVerifier } from ${JSON.stringify(pathToFileURL(path.join(ICI, 'empreinte-sources.mjs')).href)}`,
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

const SIGNE = (corps) => avecPied(corps, { empreinte: 'a'.repeat(40), fichiers: 1, dossiers: 1 })

test('ecrireOuVerifier --check : corps à jour (pied compris) → vert, rien d’écrit', () => {
  const r = jouerPrimitive({ committe: SIGNE('# doc\n'), out: '# doc\n', check: true })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /OK-témoin\naJour=true/)
  assert.equal(r.contenu, SIGNE('# doc\n'))
})

test('ecrireOuVerifier --check : corps PÉRIMÉ → bit CODE_CORPS_PERIME, divergence NOMMÉE, rien d’écrit', () => {
  const r = jouerPrimitive({ committe: SIGNE('# vieux\n'), out: '# neuf\n', check: true })
  assert.equal(r.status, CODE_CORPS_PERIME)
  assert.match(r.stderr, /PÉRIMÉ-témoin\nligne 1 — committé : "# vieux" \/ régénéré : "# neuf"[\s\S]*RELANCER-témoin/)
  assert.match(r.stdout, /aJour=false/, 'la primitive REND la main : le processus peut encore parler')
  assert.equal(r.contenu, SIGNE('# vieux\n'), '`--check` n’écrit jamais')
})

test('ecrireOuVerifier --check : un cliquet posé AVANT garde son bit — les deux rouges se lisent au code', () => {
  const r = jouerPrimitive({ committe: '# vieux\n', out: '# neuf\n', check: true, avant: 1 })
  assert.equal(r.status, 1 | CODE_CORPS_PERIME)
})

test('ecrireOuVerifier en écriture : réécrit le corps en CONSERVANT le pied, rend l’état d’avant', () => {
  const r = jouerPrimitive({ committe: SIGNE('# vieux\n'), out: '# neuf\n', check: false })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /ÉCRIT-témoin\naJour=false/)
  assert.equal(retirerPied(r.contenu), '# neuf\n')
  assert.equal(lirePied(r.contenu).empreinte, 'a'.repeat(40))
  assert.match(jouerPrimitive({ committe: null, out: '# neuf\n', check: false }).stdout, /aJour=false/, 'une cible absente n’était pas à jour')
})

test('estUnDocMarkdown : un doc Markdown, jamais une cible de code', () => {
  assert.equal(estUnDocMarkdown(doc('x')), true)
  assert.equal(estUnDocMarkdown('docs/raw/**/catalogue-*.md'), true)
  assert.equal(estUnDocMarkdown('src/x/_registry.generated.ts'), false)
})
