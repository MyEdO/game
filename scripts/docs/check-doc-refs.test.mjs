import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const CLI = fileURLToPath(new URL('./check-doc-refs.mjs', import.meta.url))
const site = (fichier, ligne) => [fichier, ligne].join(':')
for (const porteur of ['commentaire', 'raison']) test(`suite citée ${porteur} : cible existante verte puis supprimée rouge`, () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-suite-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const cible = 'scripts/test/temoin.test.mjs'
    writeFileSync(join(racine, cible), '')
    writeFileSync(join(racine, 'scripts/porteur.mjs'), porteur === 'commentaire' ? `// ${cible}\n// src/ui/X.test.tsx ; src/x.test.ts ; src/.test.ts\nconst exemple = '// scripts/test/invente.test.mjs'\n` : `const ECRIT_LU = { gate: { raison: '${cible}' } }\nconst fixture = { raison: 'scripts/test/invente.test.mjs' }`)
    const lancer = () => spawnSync(process.execPath, [CLI], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
    const vert = lancer()
    assert.equal(vert.status, 0, vert.stderr)
    rmSync(join(racine, cible))
    const rouge = lancer()
    assert.equal(rouge.status, 1, rouge.stderr)
    assert.match(rouge.stderr, /suite citée mais absente/)
    assert.ok(rouge.stderr.includes(cible), rouge.stderr)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('préfiltre : jetons complets, spans AST et politique de chemins conservés', () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-prefiltre-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const cible = 'scripts/test/temoin.test.mjs'
    const autre = 'src/9_alpha-beta.test.tsx'
    writeFileSync(join(racine, cible), '')
    writeFileSync(join(racine, autre), '')
    writeFileSync(join(racine, 'scripts/non-candidat.mjs'), [
      "const suffixe = '.test.mjs'",
      '// scripts/test/outil.mjs',
      '// src/ui/X.test.tsx ; src/x.test.ts ; src/.test.ts',
      '// scripts/test/<nom>.test.mjs',
    ].join('\n'))
    writeFileSync(join(racine, 'scripts/citations.mjs'), [
      `// (${cible}).`,
      `const inline = 1 /* ${autre} */`,
      `const trailing = 2 // ${cible};`,
      '/* plusieurs lignes',
      ` * ${autre},`,
      ' */',
      `const ECRIT_LU = { gate: { raison: 'suite : ' + '${cible}' + '\\n' + '${autre}' } }`,
    ].join('\n'))
    writeFileSync(join(racine, 'scripts/fixtures.mjs'), [
      "const chaine = '// scripts/test/invente.test.mjs'",
      'const regexp = /scripts\\/test\\/invente.test.mjs/',
      'const template = `/* scripts/test/invente.test.mjs */`',
      "const fixture = { raison: 'scripts/test/invente.test.mjs' }",
    ].join('\n'))
    const observer = join(racine, 'observer.mjs')
    writeFileSync(observer, `import { registerHooks } from 'node:module'
registerHooks({ load(url, context, nextLoad) {
  const resultat = nextLoad(url, context)
  if (url !== ${JSON.stringify(new URL('./check-doc-refs.mjs', import.meta.url).href)}) return resultat
  const source = String(resultat.source)
  const site = 'const sf = ast({ rel: file, text })'
  if (!source.includes(site)) throw new Error('site AST introuvable')
  return { ...resultat, source: source.replace(site, "process.stderr.write('[ast] ' + file.replaceAll('\\\\\\\\', '/') + '\\\\n'); " + site) }
} })
`)
    const lancer = () => spawnSync(process.execPath, ['--import', pathToFileURL(observer).href, CLI], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
    const vert = lancer()
    assert.equal(vert.status, 0, vert.stderr)
    assert.match(vert.stderr, /\[ast\] scripts\/citations.mjs/)
    assert.match(vert.stderr, /\[ast\] scripts\/fixtures.mjs/)
    assert.doesNotMatch(vert.stderr, /\[ast\] scripts\/non-candidat.mjs/)
    rmSync(join(racine, cible))
    rmSync(join(racine, autre))
    const rouge = lancer()
    assert.equal(rouge.status, 1, rouge.stderr)
    const references = rouge.stderr.split('\n').filter((line) => line.includes('[suite citée mais absente]'))
    assert.deepEqual(references.map((line) => line.trim().replaceAll('\\', '/')), [
      `${site('scripts/citations.mjs', 1)}  [suite citée mais absente]  ${cible}`,
      `${site('scripts/citations.mjs', 2)}  [suite citée mais absente]  ${autre}`,
      `${site('scripts/citations.mjs', 3)}  [suite citée mais absente]  ${cible}`,
      `${site('scripts/citations.mjs', 5)}  [suite citée mais absente]  ${autre}`,
      `${site('scripts/citations.mjs', 7)}  [suite citée mais absente]  ${cible}`,
      `${site('scripts/citations.mjs', 7)}  [suite citée mais absente]  ${autre}`,
    ])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('préfiltre : raisons et identifiant encodés restent jugés par AST', () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-encodees-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const cible = 'scripts/test/temoin.test.mjs'
    writeFileSync(join(racine, 'scripts/raisons.mjs'), "const ECRIT_LU = { raison: 'scr\\u0069pts/test/temoin.test.mjs' }\n")
    writeFileSync(join(racine, 'scripts/continuation.mjs'), "const ECRIT_LU = { raison: 'scripts\\x2ftest/te\\\nmoin.test.mjs' }\n")
    writeFileSync(join(racine, 'scripts/identifiant.mjs'), "const ECRIT_\\u004cU = { raison: 'scripts\\x2ftest/temoin.te\\u0073t.mjs' }\n")
    writeFileSync(join(racine, 'scripts/fixture.mjs'), "const fixture = { raison: 'scr\\u0069pts/test/invente.test.mjs' }\n")
    const lancer = () => spawnSync(process.execPath, [CLI], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
    const rouge = lancer()
    assert.equal(rouge.status, 1, rouge.stderr)
    const references = rouge.stderr.split('\n').filter((line) => line.includes('[suite citée mais absente]'))
    assert.equal(references.length, 3, rouge.stderr)
    assert.ok(references.every((line) => line.endsWith(cible)), rouge.stderr)
    assert.ok(references.some((line) => line.includes('identifiant.mjs')), rouge.stderr)
    writeFileSync(join(racine, cible), '')
    const vert = lancer()
    assert.equal(vert.status, 0, vert.stderr)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})
