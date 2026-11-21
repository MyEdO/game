import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { aJugerParAst } from './check-doc-refs.mjs'
const CLI = fileURLToPath(new URL('./check-doc-refs.mjs', import.meta.url))
const site = (fichier, ligne) => [fichier, ligne].join(':')
const decrireGate = (raison) => `{ ecrit: [], lit: [], raison: ${raison} }`
for (const porteur of ['commentaire', 'raison']) test(`suite citée ${porteur} : cible existante verte puis supprimée rouge`, () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-suite-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const cible = 'scripts/test/temoin.test.mjs'
    writeFileSync(join(racine, cible), '')
    writeFileSync(join(racine, 'scripts/porteur.mjs'), porteur === 'commentaire' ? `// ${cible}\n// src/noyau/X.test.tsx ; src/x.test.ts ; src/.test.ts\nconst exemple = '// scripts/test/invente.test.mjs'\n` : `const mesures = { gate: ${decrireGate(JSON.stringify(cible))} }\nconst fixture = { raison: 'scripts/test/invente.test.mjs' }`)
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
    const textes = {
      'scripts/non-candidat.mjs': [
        "const suffixe = '.test.mjs'",
        '// scripts/test/outil.mjs',
        '// src/noyau/X.test.tsx ; src/x.test.ts ; src/.test.ts',
        '// scripts/test/<nom>.test.mjs',
      ].join('\n'),
      'scripts/citations.mjs': [
        `// (${cible}).`,
        `const inline = 1 /* ${autre} */`,
        `const trailing = 2 // ${cible};`,
        '/* plusieurs lignes',
        ` * ${autre},`,
        ' */',
        `const mesures = { gate: ${decrireGate(`'suite : ' + '${cible}' + '\\n' + '${autre}'`)} }`,
      ].join('\n'),
      'scripts/fixtures.mjs': [
        "const chaine = '// scripts/test/invente.test.mjs'",
        'const regexp = /scripts\\/test\\/invente.test.mjs/',
        'const template = `/* scripts/test/invente.test.mjs */`',
        "const fixture = { raison: 'scripts/test/invente.test.mjs' }",
      ].join('\n'),
    }
    for (const [rel, texte] of Object.entries(textes)) writeFileSync(join(racine, rel), texte)
    assert.deepEqual(Object.keys(textes).filter((rel) => aJugerParAst(textes[rel])), ['scripts/citations.mjs', 'scripts/fixtures.mjs'])
    const lancer = () => spawnSync(process.execPath, [CLI], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
    const vert = lancer()
    assert.equal(vert.status, 0, vert.stderr)
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

test('préfiltre : chemins et propriété de raison échappés restent jugés par AST', () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-encodees-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const cible = 'scripts/test/temoin.test.mjs'
    writeFileSync(join(racine, 'scripts/raisons.mjs'), `const mesures = { gate: ${decrireGate("'scr\\u0069pts/test/temoin.test.mjs'")} }\n`)
    writeFileSync(join(racine, 'scripts/continuation.mjs'), `const mesures = { gate: ${decrireGate("'scripts\\x2ftest/te\\\nmoin.test.mjs'")} }\n`)
    writeFileSync(join(racine, 'scripts/identifiant.mjs'), "const mesures = { gate: { ecrit: [], lit: [], rais\\u006fn: 'scripts\\x2ftest/temoin.te\\u0073t.mjs' } }\n")
    writeFileSync(join(racine, 'scripts/fixture.mjs'), [
      "const fixture = { raison: 'scr\\u0069pts/test/invente.test.mjs' }",
      "const lecture = { lit: [], raison: 'scripts/test/invente.test.mjs' }",
      "const ecriture = { ecrit: [], raison: 'scripts/test/invente.test.mjs' }",
    ].join('\n'))
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

test('un chemin cité par un hook est jugé une fois, en commentaire comme en chaîne', () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-hooks-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const suite = 'scripts/test/absente.test.mjs'
    const chemin = 'scripts/test/absent.mjs'
    const hooks = ['scripts/git-hooks/porteur.mjs', 'scripts/hooks/porteur.mjs']
    for (const hook of hooks) writeFileSync(join(racine, hook), `// ${suite}\nconst chemin = '${chemin}'\n`)
    writeFileSync(join(racine, 'scripts/porteur.mjs'), `// ${suite}\nconst chemin = '${chemin}'\n`)
    const vu = spawnSync(process.execPath, [CLI], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
    assert.equal(vu.status, 1, vu.stderr)
    assert.deepEqual(vu.stderr.trim().split(/\r?\n/).slice(1).map((ligne) => ligne.trim().replaceAll('\\', '/')), [
      ...hooks.flatMap((hook) => [
        `${hook}:1  [chemin cité par un hook, absent du disque]  ${suite}`,
        `${hook}:2  [chemin cité par un hook, absent du disque]  ${chemin}`,
      ]),
      `scripts/porteur.mjs:1  [suite citée mais absente]  ${suite}`,
    ])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('un hook juge chaque occurrence, y compris une raison échappée ou plusieurs citations sur la même ligne', () => {
  const racine = mkdtempSync(join(tmpdir(), 'refs-raisons-de-hook-'))
  try {
    for (const dir of ['src', 'scripts/test', 'scripts/git-hooks', 'scripts/hooks', 'docs', '.claude/rules', '.claude/agents', '.claude/skills', '.codex/agents']) mkdirSync(join(racine, dir), { recursive: true })
    const hook = 'scripts/hooks/porteur.mjs'
    const suite = 'scripts/test/absente.test.mjs'
    const suiteEchappee = 'scripts/test/temoin.test.mjs'
    const chemin = 'scripts/test/ressource.mjs'
    writeFileSync(join(racine, hook), [
      `const gate = ${decrireGate(JSON.stringify(`${suite} ${chemin}`))}; const repete = '${suite}' // ${suite}`,
      `const secondeGate = ${decrireGate("'scripts/test/tem\\u006fin.test.mjs'")}`,
      `const suiteDeRaison = ${decrireGate(`'Une raison \\u00e9crite sur \\` + '\n' + `${chemin}'`)}`,
      `const unChemin = '${chemin}'`,
    ].join('\n'))
    const lancer = () => spawnSync(process.execPath, [CLI], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
    const rouge = lancer()
    assert.equal(rouge.status, 1, rouge.stderr)
    const references = rouge.stderr.trim().split(/\r?\n/).slice(1).map((ligne) => ligne.trim().replaceAll('\\', '/'))
    const raison = (ligne, cible) => `${hook}:${ligne}  [suite citée mais absente]  ${cible}`
    const brut = (ligne, cible) => `${hook}:${ligne}  [chemin cité par un hook, absent du disque]  ${cible}`
    assert.deepEqual(references, [raison(1, suite), brut(1, chemin), brut(1, suite), brut(1, suite), raison(2, suiteEchappee), brut(4, chemin), brut(5, chemin)])
    for (const fichier of [suite, suiteEchappee, chemin]) writeFileSync(join(racine, fichier), '')
    assert.equal(lancer().status, 0)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('chemin cité : un préfixe sans segment le laisse citer, le segment d’un autre chemin non', () => {
  for (const prefixe of ['', './', '/', '<racine>/', '`']) assert.equal(aJugerParAst(`${prefixe}scripts/test/temoin.test.mjs`), true, prefixe)
  for (const prefixe of ['projet/', 'autre/projet/', 'a.b/', 'x-']) assert.equal(aJugerParAst(`${prefixe}scripts/test/temoin.test.mjs`), false, prefixe)
})
